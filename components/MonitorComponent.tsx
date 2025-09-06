import { useRouter } from 'next/router';
import { useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';
import { AuthContext } from '../context/AuthContext';
import VideoPlayer from './VideoPlayer';

interface User {
  id: number;
  email: string;
  role: string;
  teamId: number | null;
}

interface MonitorComponentProps {
  user: User;
}

export default function MonitorComponent({ user }: MonitorComponentProps) {
  const authContext = useContext(AuthContext);
  const router = useRouter();

  // Estados para Socket.IO y WebRTC
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peers, setPeers] = useState<{ [socketId: string]: SimplePeer.Instance }>({});
  const [streams, setStreams] = useState<{ [socketId: string]: MediaStream }>({});
  const [participants, setParticipants] = useState<{ [socketId: string]: any }>({});
  const [connectionAttempts, setConnectionAttempts] = useState<Set<string>>(new Set());

  // Verificar que el contexto esté disponible
  if (!authContext) {
    throw new Error('MonitorComponent debe estar dentro de un AuthProvider');
  }

  const { logout, token } = authContext;

  // useEffect para establecer conexión Socket.IO
  useEffect(() => {
    if (!token) {
      console.log('❌ Admin: No hay token disponible');
      return;
    }

    console.log('🔄 Admin: Inicializando conexión Socket.IO...');
    console.log('🔍 Admin: Backend URL:', process.env.NEXT_PUBLIC_BACKEND_URL);

    // Establecer conexión con el servidor Socket.IO
    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001', {
      auth: {
        token: token
      }
    });

    // Eventos de conexión
    newSocket.on('connect', () => {
      console.log('✅ Admin conectado al servidor Socket.IO');
      console.log('🔗 Admin Socket ID:', newSocket.id);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Admin: Error de conexión Socket.IO:', error);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('⚠️ Admin desconectado del servidor Socket.IO:', reason);
    });

    // Listener para cuando un participante se une
    newSocket.on('user-joined', (data: { socketId: string, userData: any }) => {
      console.log('🎉 Participante se unió:', data.socketId, data.userData);
      console.log('📊 Datos del participante:', JSON.stringify(data.userData, null, 2));

      // Verificar si ya existe un peer para este participante
      setPeers(prevPeers => {
        if (prevPeers[data.socketId]) {
          console.log('⚠️ Ya existe un peer para este participante:', data.socketId);
          return prevPeers; // No crear uno nuevo
        }

        // Agregar participante a la lista
        setParticipants(prevParticipants => ({
          ...prevParticipants,
          [data.socketId]: data.userData
        }));

        return prevPeers;
      });
    });

    // Listener para señales WebRTC del participante
    newSocket.on('receiving-signal', (data: { signal: any, participantSocketId: string }) => {
      console.log('📡 Señal WebRTC recibida del participante:', data.participantSocketId);
      
      // Buscar el peer correspondiente y completar el handshake
      setPeers(prevPeers => {
        const peer = prevPeers[data.participantSocketId];
        if (peer && !peer.destroyed) {
          try {
            peer.signal(data.signal);
            console.log('✅ Handshake WebRTC completado con participante:', data.participantSocketId);
          } catch (error) {
            console.error('❌ Error al procesar señal WebRTC:', error);
            // Si hay error, limpiar el peer
            setConnectionAttempts(prev => {
              const newSet = new Set(prev);
              newSet.delete(data.participantSocketId);
              return newSet;
            });
          }
        } else {
          console.warn('⚠️ No se encontró peer válido para participante:', data.participantSocketId);
        }
        return prevPeers;
      });
    });

    // Listener para cuando un participante se desconecta
    newSocket.on('user-left', (data: { socketId: string }) => {
      console.log('Participante se desconectó:', data.socketId);
      
      // Remover participante de la lista
      setParticipants(prevParticipants => {
        const newParticipants = { ...prevParticipants };
        delete newParticipants[data.socketId];
        return newParticipants;
      });

      // Cerrar conexión WebRTC si existe
      setPeers(prevPeers => {
        const peer = prevPeers[data.socketId];
        if (peer) {
          peer.destroy();
        }
        const newPeers = { ...prevPeers };
        delete newPeers[data.socketId];
        return newPeers;
      });

      // Remover stream
      setStreams(prevStreams => {
        const newStreams = { ...prevStreams };
        delete newStreams[data.socketId];
        return newStreams;
      });
    });

    // Guardar socket en el estado
    setSocket(newSocket);

    // Cleanup: desconectar socket y cerrar todas las conexiones
    return () => {
      console.log('Desconectando socket y cerrando conexiones WebRTC...');
      
      // Cerrar todas las conexiones WebRTC
      setPeers(currentPeers => {
        Object.values(currentPeers).forEach(peer => {
          peer.destroy();
        });
        return {};
      });
      
      // Limpiar streams
      setStreams({});
      
      // Desconectar socket
      newSocket.disconnect();
    };
  }, [token]); // Dependencia: token

  // Función para observar a un participante
  const observeParticipant = (participantSocketId: string) => {
    if (!socket) {
      console.warn('Socket no está conectado');
      return;
    }

    // Verificar si ya existe un peer para este participante
    if (peers[participantSocketId]) {
      console.log('Ya hay una conexión activa con este participante');
      return;
    }

    // Verificar si ya se está intentando una conexión
    if (connectionAttempts.has(participantSocketId)) {
      console.log('⚠️ Ya se está intentando conectar con este participante, ignorando solicitud duplicada');
      return;
    }

    console.log('Solicitando observar participante:', participantSocketId);

    // Marcar intento de conexión
    setConnectionAttempts(prev => new Set(prev).add(participantSocketId));

    // Crear nueva instancia de SimplePeer como receptor (no iniciador)
    const peer = new SimplePeer({
      initiator: false,
      trickle: false,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    // Listener para señales WebRTC
    peer.on('signal', (signal) => {
      console.log('📡 Enviando señal de respuesta al participante:', participantSocketId);
      // Enviar señal de respuesta al servidor para que la reenvíe al participante
      socket.emit('returning-signal', {
        signal: signal,
        participantSocketId: participantSocketId
      });
    });

    // Listener para recibir el stream de video del participante
    peer.on('stream', (stream: MediaStream) => {
      console.log('🎥 Stream recibido del participante:', participantSocketId);
      console.log('📊 Stream details:', {
        id: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });
      
      // Añadir el stream al estado usando el socketId como clave
      setStreams(prevStreams => ({
        ...prevStreams,
        [participantSocketId]: stream
      }));
    });

    // Listener para errores del peer
    peer.on('error', (error) => {
      console.error('❌ Error en conexión WebRTC con participante:', participantSocketId, error);
      // Limpiar estado en caso de error
      setConnectionAttempts(prev => {
        const newSet = new Set(prev);
        newSet.delete(participantSocketId);
        return newSet;
      });
      setPeers(prevPeers => {
        const newPeers = { ...prevPeers };
        delete newPeers[participantSocketId];
        return newPeers;
      });
    });

    // Listener para conexión exitosa
    peer.on('connect', () => {
      console.log('✅ Conexión WebRTC establecida con participante:', participantSocketId);
      // Limpiar marcador de intento de conexión ya que fue exitoso
      setConnectionAttempts(prev => {
        const newSet = new Set(prev);
        newSet.delete(participantSocketId);
        return newSet;
      });
    });

    // Listener para cuando se cierre la conexión
    peer.on('close', () => {
      console.log('🔌 Conexión WebRTC cerrada con participante:', participantSocketId);
      setConnectionAttempts(prev => {
        const newSet = new Set(prev);
        newSet.delete(participantSocketId);
        return newSet;
      });
      setPeers(prevPeers => {
        const newPeers = { ...prevPeers };
        delete newPeers[participantSocketId];
        return newPeers;
      });
      setStreams(prevStreams => {
        const newStreams = { ...prevStreams };
        delete newStreams[participantSocketId];
        return newStreams;
      });
    });

    // Guardar el peer en el estado usando el socketId como clave
    setPeers(prevPeers => ({
      ...prevPeers,
      [participantSocketId]: peer
    }));
    
    // Emitir evento al servidor para solicitar conexión con el participante
    // Pequeño delay para asegurar que el peer esté completamente configurado
    setTimeout(() => {
      socket.emit('admin-wants-to-connect', {
        participantSocketId: participantSocketId
      });
    }, 100);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard del Administrador</h1>
            <p className="text-lg text-gray-300 mt-2">Bienvenido, {user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition duration-150 ease-in-out"
          >
            Cerrar Sesión
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Participantes Disponibles</h2>
            <div className="mb-4">
              <button
                onClick={() => {
                  console.log('🔍 Debug - Estado actual:');
                  console.log('🔗 Socket conectado:', socket?.connected);
                  console.log('👥 Participantes:', participants);
                  console.log('📺 Streams:', Object.keys(streams));
                  console.log('🤝 Peers:', Object.keys(peers));
                }}
                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm"
              >
                🔍 Debug Estado
              </button>
            </div>
            <div className="space-y-3">
              {Object.keys(participants).length === 0 ? (
                <p className="text-gray-400">No hay participantes conectados</p>
              ) : (
                Object.entries(participants).map(([socketId, userData]) => (
                  <div key={socketId} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                    <div>
                      <p className="text-white font-medium">{userData.email}</p>
                      <p className="text-gray-400 text-sm">
                        Equipo: {userData.teamId ? `#${userData.teamId}` : 'Sin asignar'}
                      </p>
                    </div>
                    <button
                      onClick={() => observeParticipant(socketId)}
                      disabled={!!streams[socketId]}
                      className={`px-3 py-1 rounded text-sm font-medium transition ${
                        streams[socketId]
                          ? 'bg-green-600 text-white cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {streams[socketId] ? 'Observando' : 'Observar'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Estado del Sistema</h2>
            <div className="space-y-2">
              <p className="text-gray-300">
                <span className="text-gray-400">Conexión:</span> {' '}
                <span className={socket?.connected ? 'text-green-400' : 'text-red-400'}>
                  {socket?.connected ? 'Conectado' : 'Desconectado'}
                </span>
              </p>
              <p className="text-gray-300">
                <span className="text-gray-400">Participantes:</span> {Object.keys(participants).length}
              </p>
              <p className="text-gray-300">
                <span className="text-gray-400">Streams activos:</span> {Object.keys(streams).length}
              </p>
            </div>
          </div>
        </div>

        {/* Área de streams de video */}
        {Object.keys(streams).length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">Pantallas Compartidas</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {Object.entries(streams).map(([socketId, stream]) => (
                <div key={socketId} className="bg-gray-800 rounded-lg p-4">
                  <div className="mb-2 flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">{participants[socketId]?.email}</p>
                      <p className="text-gray-400 text-sm">Equipo: {participants[socketId]?.teamId || 'Sin asignar'}</p>
                    </div>
                    <button
                      onClick={() => {
                        const videoElement = document.querySelector(`[data-stream-id="${socketId}"] video`) as HTMLVideoElement;
                        if (videoElement) {
                          if (videoElement.requestFullscreen) {
                            videoElement.requestFullscreen();
                          }
                        }
                      }}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                    >
                      🔍 Pantalla Completa
                    </button>
                  </div>
                  <div 
                    className="aspect-video bg-black rounded-lg overflow-hidden"
                    data-stream-id={socketId}
                  >
                    <VideoPlayer 
                      stream={stream} 
                      className="rounded-lg"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
