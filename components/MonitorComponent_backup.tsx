import { useRouter } from 'next/router';
import { useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';
import { AuthContext } from '../context/AuthContext';
import VideoPlayer from './VideoPlayer';

interface StreamData {
  id: string;
  stream: MediaStream;
  participantId: string;
  participantEmail: string;
  participantTeamId: number | null;
  socketId: string;
  createdAt: Date;
}

interface User {
  id: number;
  email: string;
  role: string;
  teamId: number | null;
}

interface MonitorComponentProps {
  user: User;
  selectedCategory: number | null;
}

export default function MonitorComponent({ user, selectedCategory }: MonitorComponentProps) {
  const authContext = useContext(AuthContext);
  const router = useRouter();

  // Estados básicos
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peers, setPeers] = useState<{ [socketId: string]: SimplePeer.Instance }>({});
  const [streams, setStreams] = useState<{ [streamId: string]: StreamData }>({});
  const [participants, setParticipants] = useState<{ [socketId: string]: any }>({});
  const [watchingStreams, setWatchingStreams] = useState<Set<string>>(new Set());
  
  const processedSignalsRef = useRef<Set<string>>(new Set());

  if (!authContext) {
    throw new Error('MonitorComponent debe estar dentro de un AuthProvider');
  }

  const { logout, token } = authContext;

  // Persistencia simple
  const saveWatchingState = (socketId: string) => {
    const current = JSON.parse(localStorage.getItem('watching') || '[]');
    if (!current.includes(socketId)) {
      current.push(socketId);
      localStorage.setItem('watching', JSON.stringify(current));
    }
  };

  const removeWatchingState = (socketId: string) => {
    const current = JSON.parse(localStorage.getItem('watching') || '[]');
    const filtered = current.filter((id: string) => id !== socketId);
    localStorage.setItem('watching', JSON.stringify(filtered));
  };

  // FUNCIÓN PRINCIPAL: Observar participante
  const startWatching = (participantSocketId: string) => {
    console.log('🎯 INICIANDO OBSERVACIÓN:', participantSocketId);
    
    if (!socket || !socket.connected) {
      console.error('❌ Socket no conectado');
      return;
    }

    const participant = participants[participantSocketId];
    if (!participant) {
      console.error('❌ Participante no encontrado:', participantSocketId);
      return;
    }

    if (!participant.streamAvailable) {
      console.error('❌ Participante no tiene stream disponible:', participantSocketId);
      return;
    }

    if (peers[participantSocketId]) {
      console.warn('⚠️ Ya hay una conexión activa con este participante');
      return;
    }

    console.log('📡 Solicitando conexión WebRTC...');
    socket.emit('admin-wants-to-connect', { participantSocketId });
    
    setWatchingStreams(prev => new Set(prev).add(participantSocketId));
    saveWatchingState(participantSocketId);
  };

  // FUNCIÓN PRINCIPAL: Dejar de observar participante
  const stopWatching = (participantSocketId: string) => {
    console.log('🛑 DETENIENDO OBSERVACIÓN:', participantSocketId);
    
    setWatchingStreams(prev => {
      const newSet = new Set(prev);
      newSet.delete(participantSocketId);
      return newSet;
    });
    removeWatchingState(participantSocketId);
    
    const peer = peers[participantSocketId];
    if (peer && !peer.destroyed) {
      peer.destroy();
    }
    setPeers(prev => {
      const newPeers = { ...prev };
      delete newPeers[participantSocketId];
      return newPeers;
    });

    setStreams(prev => {
      const newStreams = { ...prev };
      Object.keys(newStreams).forEach(streamId => {
        if (newStreams[streamId].socketId === participantSocketId) {
          delete newStreams[streamId];
        }
      });
      return newStreams;
    });

    if (socket) {
      socket.emit('admin-stop-observing', { participantSocketId });
    }
  };

  // Función simple para verificar si un participante tiene streams activos
  const hasActiveStreams = (socketId: string): boolean => {
    return Object.values(streams).some(streamData => 
      streamData.socketId === socketId && streamData.stream.active
    );
  };

  // Función para filtrar participantes por categoría
  const getFilteredParticipants = () => {
    console.log('🔍 Filtrando participantes - categoría seleccionada:', selectedCategory);
    console.log('🔍 Participantes disponibles:', participants);
    
    if (!selectedCategory || selectedCategory === 0) {
      console.log('📋 Mostrando todos los participantes');
      return participants;
    }

    const filtered: { [socketId: string]: any } = {};
    Object.entries(participants).forEach(([socketId, userData]) => {
      console.log(`🔍 Participante ${userData.email}: teamId ${userData.teamId}, categoria buscada: ${selectedCategory}`);
      if (userData.teamId === selectedCategory) {
        filtered[socketId] = userData;
      }
    });
    
    console.log('📋 Participantes filtrados:', filtered);
    return filtered;
  };

  const getCategoryName = (categoryId: number | null): string => {
    if (!categoryId || categoryId === 0) return 'Todas las Categorías';
    switch (categoryId) {
      case 1: return 'Equipo A';
      case 2: return 'Equipo B';
      default: return `Categoría ${categoryId}`;
    }
  };

  // useEffect principal para Socket.IO
  useEffect(() => {
    if (!token) {
      console.log('❌ No hay token disponible');
      return;
    }

    console.log('🔄 Inicializando conexión Socket.IO...');
    console.log('🎯 Categoría seleccionada:', selectedCategory);

    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001', {
      auth: { token: token }
    });

    newSocket.on('connect', () => {
      console.log('✅ Admin conectado al servidor Socket.IO');
      console.log('🔗 Admin Socket ID:', newSocket.id);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Error de conexión Socket.IO:', error);
    });

    // Lista inicial de participantes
    newSocket.on('participants-list', (participantsList: Array<{ socketId: string, userData: any }>) => {
      console.log('📋 Lista inicial de participantes recibida:', participantsList.length);
      
      const participantsObj: { [socketId: string]: any } = {};
      participantsList.forEach(participant => {
        console.log('👤 Participante en lista:', participant.socketId, participant.userData);
        participantsObj[participant.socketId] = {
          ...participant.userData,
          streamAvailable: false
        };
      });
      
      setParticipants(participantsObj);
    });

    // Nuevo participante se une
    newSocket.on('user-joined', (data: { socketId: string, userData: any }) => {
      console.log('🎉 Participante se unió:', data.socketId, data.userData);
      
      setParticipants(prevParticipants => ({
        ...prevParticipants,
        [data.socketId]: data.userData
      }));
    });

    // Stream disponible
    newSocket.on('participant-stream-available', (data: { socketId: string, userData: any }) => {
      console.log('📺 Stream disponible para participante:', data.socketId, data.userData);
      
      setParticipants(prevParticipants => ({
        ...prevParticipants,
        [data.socketId]: {
          ...prevParticipants[data.socketId],
          ...data.userData,
          streamAvailable: true
        }
      }));

      // Auto-reconectar si estaba observando
      if (watchingStreams.has(data.socketId)) {
        console.log('🔄 Reconectando automáticamente al stream de:', data.socketId);
        setTimeout(() => startWatching(data.socketId), 1000);
      }
    });

    // Señales WebRTC
    newSocket.on('receiving-signal', (data: { signal: any, participantSocketId: string }) => {
      console.log('📡 Señal WebRTC recibida del participante:', data.participantSocketId);
      
      if (peers[data.participantSocketId]) {
        const existingPeer = peers[data.participantSocketId];
        if (!existingPeer.destroyed) {
          try {
            existingPeer.signal(data.signal);
            console.log('✅ Handshake WebRTC completado');
          } catch (error) {
            console.error('❌ Error al procesar señal WebRTC:', error);
          }
        }
        return;
      }
      
      console.log('🆕 Creando nuevo peer para participante:', data.participantSocketId);
      
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

      peer.on('signal', (signal) => {
        console.log('📡 Enviando señal de respuesta al participante:', data.participantSocketId);
        newSocket.emit('returning-signal', {
          signal: signal,
          participantSocketId: data.participantSocketId
        });
      });

      peer.on('stream', (stream: MediaStream) => {
        console.log('🎥 Stream recibido del participante:', data.participantSocketId);
        console.log('📊 Stream details:', {
          id: stream.id,
          active: stream.active,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });
        
        // ID único simple
        const streamId = `${data.participantSocketId}_${Date.now()}`;
        
        const streamData: StreamData = {
          id: streamId,
          stream: stream,
          participantId: participants[data.participantSocketId]?.id?.toString() || 'unknown',
          participantEmail: participants[data.participantSocketId]?.email || 'unknown',
          participantTeamId: participants[data.participantSocketId]?.teamId || null,
          socketId: data.participantSocketId,
          createdAt: new Date()
        };
        
        setStreams(prevStreams => ({
          ...prevStreams,
          [streamId]: streamData
        }));

        console.log('✅ Stream agregado con ID único:', streamId);
      });

      peer.on('error', (error) => {
        console.error('❌ Error en conexión WebRTC:', error);
        setPeers(prevPeers => {
          const newPeers = { ...prevPeers };
          delete newPeers[data.participantSocketId];
          return newPeers;
        });
      });

      setPeers(prevPeers => ({
        ...prevPeers,
        [data.participantSocketId]: peer
      }));
      
      try {
        peer.signal(data.signal);
        console.log('✅ Procesando señal inicial del participante:', data.participantSocketId);
      } catch (error) {
        console.error('❌ Error al procesar señal inicial:', error);
      }
    });

    // Participante se desconecta
    newSocket.on('user-left', (data: { socketId: string }) => {
      console.log('👋 Participante se desconectó:', data.socketId);
      
      setWatchingStreams(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.socketId);
        return newSet;
      });
      removeWatchingState(data.socketId);
      
      setParticipants(prevParticipants => {
        const newParticipants = { ...prevParticipants };
        delete newParticipants[data.socketId];
        return newParticipants;
      });

      const peer = peers[data.socketId];
      if (peer) {
        peer.destroy();
      }
      setPeers(prevPeers => {
        const newPeers = { ...prevPeers };
        delete newPeers[data.socketId];
        return newPeers;
      });

      setStreams(prevStreams => {
        const newStreams = { ...prevStreams };
        delete newStreams[data.socketId];
        return newStreams;
      });
    });

    setSocket(newSocket);

    // Solicitar lista inicial
    console.log('📡 Solicitando lista inicial de participantes');
    newSocket.emit('admin-get-participants');

    return () => {
      console.log('🧹 Desconectando socket y cerrando conexiones WebRTC...');
      newSocket.disconnect();
      Object.values(peers).forEach(peer => {
        if (peer && !peer.destroyed) {
          peer.destroy();
        }
      });
    };
  }, [token, selectedCategory]);

  const refreshParticipants = () => {
    console.log('🔄 Solicitando actualización de participantes...');
    if (socket) {
      socket.emit('admin-get-participants');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const changeCategorySelection = () => {
    router.push('/category-selection');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard del Administrador</h1>
            <p className="text-lg text-gray-300 mt-2">Bienvenido, {user.email}</p>
            <div className="flex items-center space-x-2 mt-2">
              <span className="text-sm text-gray-400">Monitoreando:</span>
              <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-medium">
                {getCategoryName(selectedCategory)}
              </span>
              <button
                onClick={changeCategorySelection}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded-full text-sm transition"
              >
                🔄 Cambiar
              </button>
            </div>
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Participantes Disponibles</h2>
              <button
                onClick={refreshParticipants}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition duration-150"
              >
                🔄 Actualizar
              </button>
            </div>
            <div className="mb-4 space-x-2">
              <button
                onClick={() => {
                  console.log('🔍 Debug - Estado COMPLETO actual:');
                  console.log('🔗 Socket conectado:', socket?.connected);
                  console.log('👥 Participantes:', participants);
                  console.log('📺 Streams activos:', Object.keys(streams));
                  console.log('👀 Observando:', Array.from(watchingStreams));
                  console.log('🏷️ Categoría seleccionada:', selectedCategory);
                }}
                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm"
              >
                🔍 Debug
              </button>
            </div>
            <div className="space-y-3">
              {(() => {
                const filteredParticipants = getFilteredParticipants();
                const filteredKeys = Object.keys(filteredParticipants);
                
                if (filteredKeys.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-gray-400 mb-2">
                        {Object.keys(participants).length === 0 
                          ? 'No hay participantes conectados'
                          : `No hay participantes en ${getCategoryName(selectedCategory)}`
                        }
                      </p>
                    </div>
                  );
                }
                
                return Object.entries(filteredParticipants).map(([socketId, userData]) => (
                  <div key={socketId} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="text-white font-medium">{userData.email}</p>
                        <div className={`w-2 h-2 rounded-full ${(userData as any).streamAvailable ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                      </div>
                      <p className="text-gray-400 text-sm">
                        Equipo: {userData.teamId ? `#${userData.teamId}` : 'Sin asignar'}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {hasActiveStreams(socketId) ? '🔴 En vivo' : 
                         watchingStreams.has(socketId) ? '🔄 Observando...' :
                         (userData as any).streamAvailable ? '📺 Stream disponible' : '⏳ Esperando stream'}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      {(hasActiveStreams(socketId) || watchingStreams.has(socketId)) ? (
                        <button
                          onClick={() => stopWatching(socketId)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition"
                        >
                          {hasActiveStreams(socketId) ? 'Dejar de ver' : 'Cancelar'}
                        </button>
                      ) : (
                        <button
                          onClick={() => startWatching(socketId)}
                          disabled={!(userData as any).streamAvailable}
                          className={`px-3 py-1 rounded text-sm font-medium transition ${
                            (userData as any).streamAvailable
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {(userData as any).streamAvailable ? 'Observar' : 'Sin stream'}
                        </button>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Streams en Vivo</h2>
            <div className="space-y-4">
              {Object.keys(streams).length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">No hay streams activos</p>
                </div>
              ) : (
                Object.entries(streams).map(([streamId, streamData]) => (
                  <div key={streamId} className="bg-gray-700 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-medium text-white">
                        {streamData.participantEmail}
                      </h3>
                      <button
                        onClick={() => stopWatching(streamData.socketId)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition"
                      >
                        Cerrar
                      </button>
                    </div>
                    <VideoPlayer 
                      stream={streamData.stream} 
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
