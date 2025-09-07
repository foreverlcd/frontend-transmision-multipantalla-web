import { useRouter } from 'next/router';
import { useContext, useEffect, useState, useRef } from 'react';
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

interface CompartirComponentProps {
  user: User;
}

export default function CompartirComponent({ user }: CompartirComponentProps) {
  const authContext = useContext(AuthContext);
  const router = useRouter();

  // Estados para Socket.IO y streaming
  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, SimplePeer.Instance>>(new Map());
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activePeerConnections, setActivePeerConnections] = useState<Set<string>>(new Set());
  
  // Ref para mantener la referencia actual del stream
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // Ref para mantener la referencia actual de peers
  const peersRef = useRef<Map<string, SimplePeer.Instance>>(new Map());
  
  // Set para rastrear señales procesadas y evitar duplicados
  const processedSignalsRef = useRef<Set<string>>(new Set());

  // useEffect para actualizar la ref cuando cambie localStream
  useEffect(() => {
    localStreamRef.current = localStream;
    console.log('🔄 Stream ref actualizada:', !!localStream);
  }, [localStream]);

  // useEffect para actualizar la ref cuando cambien los peers
  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  // Verificar que el contexto esté disponible
  if (!authContext) {
    throw new Error('CompartirComponent debe estar dentro de un AuthProvider');
  }

  const { logout, token } = authContext;

  // useEffect para establecer conexión Socket.IO
  useEffect(() => {
    if (!token) {
      console.log('❌ No hay token disponible');
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Inicializando conexión Socket.IO...');
      console.log('🔍 Token:', token.substring(0, 20) + '...');
      console.log('🔍 Backend URL:', process.env.NEXT_PUBLIC_BACKEND_URL);
    }

    // Establecer conexión con el servidor Socket.IO
    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001', {
      auth: {
        token: token
      }
    });

    // Eventos de conexión
    newSocket.on('connect', () => {
      console.log('✅ Conectado al servidor Socket.IO');
      console.log('🔗 Socket ID:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Error de conexión Socket.IO:', error);
      console.error('📝 Error details:', error.message);
      setIsConnected(false);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('⚠️ Desconectado del servidor Socket.IO:', reason);
      setIsConnected(false);
    });

    // Listener para admins que quieren conectarse
    newSocket.on('admin-wants-to-connect', (data: { adminSocketId: string }) => {
      console.log('🔗 Admin quiere conectarse:', data.adminSocketId);
      
      // Verificar si ya existe una conexión con este admin
      if (activePeerConnections.has(data.adminSocketId)) {
        console.log('⚠️ Ya existe una conexión con este admin, ignorando solicitud duplicada');
        return;
      }
      
      // Obtener el stream actual de la ref (siempre actualizada)
      const currentStream = localStreamRef.current;
      console.log('🔍 Stream actual (ref):', currentStream);
      console.log('🔍 Estado localStream (state):', !!localStream);
      console.log('🔍 Stream activo:', currentStream?.active);
      
      if (!currentStream || !currentStream.active) {
        console.warn('❌ No hay stream local disponible para compartir');
        console.warn('💡 El admin deberá esperar a que se inicie la compartición de pantalla');
        return;
      }

      // Marcar esta conexión como activa
      setActivePeerConnections(prev => new Set(prev).add(data.adminSocketId));

      // Crear nueva instancia de SimplePeer como iniciador
      const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream: currentStream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      // Listener para señales WebRTC
      peer.on('signal', (signal) => {
        console.log('📡 Enviando señal WebRTC al admin:', data.adminSocketId);
        console.log('📦 Tipo de señal:', signal.type);
        // Enviar señal al servidor para que la reenvíe al admin
        newSocket.emit('sending-signal', {
          signal: signal,
          adminSocketId: data.adminSocketId
        });
      });

      // Listener para errores del peer
      peer.on('error', (error) => {
        console.error('❌ Error en conexión WebRTC:', error);
        // Limpiar conexión en caso de error
        setActivePeerConnections(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.adminSocketId);
          return newSet;
        });
      });

      // Listener para cuando la conexión se cierre
      peer.on('close', () => {
        console.log('🔌 Conexión WebRTC cerrada con admin:', data.adminSocketId);
        setActivePeerConnections(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.adminSocketId);
          return newSet;
        });
      });

      // Guardar el peer en el mapa
      setPeers(prevPeers => {
        const newPeers = new Map(prevPeers);
        newPeers.set(data.adminSocketId, peer);
        return newPeers;
      });
    });

    // Listener para respuesta de señal del admin
    newSocket.on('return-signal-received', (data: { signal: any, adminSocketId: string }) => {
      console.log('📡 Señal de respuesta recibida del admin:', data.adminSocketId);
      console.log('📦 Tipo de señal:', data.signal.type);
      
      // Crear un ID único para esta señal para evitar procesamiento duplicado
      const signalId = `${data.adminSocketId}-${data.signal.type}-${Date.now()}`;
      
      // Verificar si ya procesamos una señal similar recientemente
      if (processedSignalsRef.current.has(`${data.adminSocketId}-${data.signal.type}`)) {
        console.warn('⚠️ Señal duplicada detectada, ignorando:', data.adminSocketId, data.signal.type);
        return;
      }
      
      // Marcar como procesada
      processedSignalsRef.current.add(`${data.adminSocketId}-${data.signal.type}`);
      
      // Limpiar señales antiguas después de 5 segundos
      setTimeout(() => {
        processedSignalsRef.current.delete(`${data.adminSocketId}-${data.signal.type}`);
      }, 5000);
      
      // Buscar el peer correspondiente al admin usando la ref actual
      const currentPeers = peersRef.current || new Map();
      const peer = currentPeers.get(data.adminSocketId);
      
      if (peer && !peer.destroyed) {
        try {
          // Verificar el estado actual del peer antes de procesar la señal
          console.log('🔍 Estado del peer antes de procesar:', peer.connected, peer.destroyed);
          
          peer.signal(data.signal);
          console.log('✅ Conexión WebRTC completada con admin:', data.adminSocketId);
        } catch (error) {
          console.error('❌ Error al procesar señal de respuesta:', error);
          // Limpiar el peer que falló
          setPeers(prevPeers => {
            const newPeers = new Map(prevPeers);
            newPeers.delete(data.adminSocketId);
            return newPeers;
          });
        }
      } else {
        console.warn('⚠️ No se encontró peer válido para admin:', data.adminSocketId);
      }
    });

    // Guardar socket en el estado
    setSocket(newSocket);

    // Cleanup: desconectar socket cuando el componente se desmonte
    return () => {
      console.log('🧹 Desconectando socket y cerrando conexiones WebRTC...');
      
      // Resetear estado de conexión
      setIsConnected(false);
      
      // Cerrar todas las conexiones WebRTC
      setPeers(currentPeers => {
        currentPeers.forEach((peer, adminSocketId) => {
          console.log('🔌 Cerrando conexión WebRTC con admin:', adminSocketId);
          peer.destroy();
        });
        return new Map();
      });
      
      // Desconectar socket
      newSocket.disconnect();
    };
  }, [token]); // Dependencias: solo token (eliminamos localStream y peers para evitar loops)

  // Función para compartir pantalla
  const shareScreen = async () => {
    try {
      console.log('🎬 Iniciando compartición de pantalla...');
      
      // Verificar si el socket está conectado
      if (!socket?.connected || !isConnected) {
        console.warn('⚠️ Socket no está conectado, esperando conexión...');
        alert('Esperando conexión al servidor. Por favor, intenta de nuevo en unos segundos.');
        return;
      }

      // Solicitar al usuario que comparta su pantalla
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

      console.log('✅ Stream de pantalla obtenido:', stream);
      console.log('📊 Stream details:', {
        id: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });

      // Log detalles de video tracks
      stream.getVideoTracks().forEach((track, index) => {
        console.log(`📹 Video Track ${index}:`, {
          id: track.id,
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          settings: track.getSettings(),
          constraints: track.getConstraints()
        });
      });

      // Guardar el stream en el estado
      setLocalStream(stream);

      // Agregar listener para cuando el usuario detenga la compartición
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('📺 Usuario detuvo la compartición de pantalla manualmente');
        stopSharing(); // Usar la función centralizada
      });

      // Notificar al servidor que estamos listos para conexiones
      socket.emit('participant-ready', {
        userId: user.id,
        email: user.email,
        teamId: user.teamId
      });
      console.log('📡 Evento participant-ready enviado al servidor');

      console.log('🎉 Pantalla compartida exitosamente');

      // Una vez que tenemos el stream, procesar cualquier solicitud de admin pendiente
      if (socket) {
        socket.emit('participant-stream-ready', {
          userId: user.id,
          email: user.email,
          teamId: user.teamId
        });
        console.log('📡 Evento participant-stream-ready enviado - listo para conexiones WebRTC');
      }

    } catch (error: any) {
      console.error('❌ Error al compartir pantalla:', error);
      if (error.name === 'NotAllowedError') {
        alert('Necesitas dar permisos para compartir pantalla. Por favor, recarga la página e intenta de nuevo.');
      } else if (error.name === 'NotSupportedError') {
        alert('Tu navegador no soporta compartir pantalla.');
      } else {
        alert('Error al acceder a la pantalla. Asegúrate de dar permisos para compartir pantalla.');
      }
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleStartSharing = () => {
    shareScreen();
  };

  const handleStopSharing = () => {
    // Mostrar confirmación antes de detener
    const confirmStop = window.confirm(
      '¿Estás seguro de que quieres dejar de compartir tu pantalla?\n\n' +
      'Esto terminará la transmisión para todos los administradores que te estén observando.'
    );

    if (confirmStop) {
      console.log('🛑 Usuario decidió detener la compartición');
      stopSharing();
    }
  };

  const stopSharing = () => {
    console.log('🔴 Deteniendo compartición de pantalla...');

    // Detener todas las pistas del stream
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log('⏹️ Deteniendo track:', track.kind);
        track.stop();
      });
      setLocalStream(null);
    }

    // Cerrar todas las conexiones WebRTC activas
    if (peers.size > 0) {
      console.log('🔌 Cerrando', peers.size, 'conexiones WebRTC...');
      peers.forEach((peer, adminSocketId) => {
        console.log('📴 Cerrando conexión con admin:', adminSocketId);
        if (!peer.destroyed) {
          peer.destroy();
        }
      });
      setPeers(new Map());
    }

    // Limpiar conexiones activas
    setActivePeerConnections(new Set());

    // Notificar al servidor que ya no estamos transmitiendo
    if (socket) {
      socket.emit('participant-stopped-sharing', {
        userId: user.id,
        email: user.email,
        teamId: user.teamId
      });
      console.log('📡 Notificación de detención enviada al servidor');
    }

    console.log('✅ Compartición detenida exitosamente');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Sala de Transmisión</h1>
            <p className="text-lg text-gray-300 mt-2">Hola, {user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition duration-150 ease-in-out"
          >
            Cerrar Sesión
          </button>
        </div>
        
        <div className="flex flex-col items-center justify-center space-y-8">
          {/* Botones para compartir pantalla */}
          <div className="text-center space-y-4">
            {!localStream ? (
              // Botón para iniciar compartición
              <button
                onClick={handleStartSharing}
                disabled={!isConnected}
                className={`px-12 py-6 text-white text-xl font-bold rounded-xl shadow-2xl transform transition duration-200 focus:outline-none focus:ring-4 ${
                  isConnected
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:scale-105 focus:ring-blue-300'
                    : 'bg-gray-600 cursor-not-allowed'
                }`}
              >
                🖥️ Empezar a Compartir Pantalla
              </button>
            ) : (
              // Botones cuando está compartiendo
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-lg font-semibold text-green-400">✅ Transmitiendo en vivo</span>
                </div>
                
                <button
                  onClick={handleStopSharing}
                  className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white text-lg font-bold rounded-xl shadow-2xl transform transition duration-200 focus:outline-none focus:ring-4 focus:ring-red-300 hover:scale-105"
                >
                  🛑 Detener Compartición
                </button>
              </div>
            )}
            
            <p className="text-gray-400 mt-4 text-sm">
              {localStream 
                ? 'Tu pantalla se está transmitiendo a los administradores' 
                : isConnected 
                  ? 'Haz clic para comenzar la transmisión de tu pantalla'
                  : 'Conectando al servidor...'
              }
            </p>
          </div>

          {/* Información del usuario */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-4xl">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Tu Información</h2>
              <div className="space-y-2">
                <p className="text-gray-300">
                  <span className="text-gray-400">Email:</span> {user.email}
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-400">Rol:</span> {user.role}
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-400">Equipo:</span> {user.teamId ? `#${user.teamId}` : 'No asignado'}
                </p>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Estado de Transmisión</h2>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500 animate-pulse'}`}></div>
                <span className="text-gray-300">
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <div className={`w-3 h-3 rounded-full ${localStream ? 'bg-blue-500 animate-pulse' : 'bg-gray-500'}`}></div>
                <span className="text-gray-300">
                  {localStream ? 'Transmitiendo' : 'Sin transmisión'}
                </span>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <div className={`w-3 h-3 rounded-full ${peers.size > 0 ? 'bg-orange-500 animate-pulse' : 'bg-gray-500'}`}></div>
                <span className="text-gray-300">
                  {peers.size > 0 ? `${peers.size} administrador${peers.size > 1 ? 'es' : ''} observando` : 'Ningún administrador observando'}
                </span>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                {localStream 
                  ? `Transmisión activa${peers.size > 0 ? ` para ${peers.size} observador${peers.size > 1 ? 'es' : ''}` : ''}`
                  : isConnected 
                    ? 'Listo para transmitir' 
                    : 'Conectando al servidor...'
                }
              </p>
            </div>
          </div>

          {/* Vista previa local */}
          {localStream && (
            <div className="w-full max-w-4xl">
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Vista Previa de tu Pantalla</h2>
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <VideoPlayer 
                    stream={localStream} 
                    className="w-full h-64 object-contain" 
                  />
                  <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded text-sm">
                    EN VIVO
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
