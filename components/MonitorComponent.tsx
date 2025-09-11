import { useRouter } from 'next/router';
import { useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';
import { AuthContext } from '../context/AuthContext';
import VideoPlayer from './VideoPlayer';
import { 
  StreamData, 
  generateStreamId, 
  getStreamsBySocketId, 
  hasActiveStreams as utilHasActiveStreams,
  cleanInactiveStreams,
  getStreamStats
} from '../utils/streamUtils';

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

  // Estados para Socket.IO y WebRTC
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peers, setPeers] = useState<{ [socketId: string]: SimplePeer.Instance }>({});
  const [streams, setStreams] = useState<{ [streamId: string]: StreamData }>({});
  const [participants, setParticipants] = useState<{ [socketId: string]: any }>({});
  const [connectionAttempts, setConnectionAttempts] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [watchingStreams, setWatchingStreams] = useState<Set<string>>(new Set());
  const [isRestoringConnections, setIsRestoringConnections] = useState(false);
  
  // Ref para rastrear señales procesadas y evitar duplicados
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const participantsRef = useRef<{ [socketId: string]: any }>({});

  // Verificar que el contexto esté disponible
  if (!authContext) {
    throw new Error('MonitorComponent debe estar dentro de un AuthProvider');
  }

  const { logout, token } = authContext;

  // Funciones para persistencia del estado
  const saveWatchingState = (socketId: string) => {
    try {
      const saved = localStorage.getItem('adminWatchingState');
      let currentState = {
        watchingStreams: [] as string[],
        timestamp: Date.now(),
        category: selectedCategory
      };

      if (saved) {
        const parsedState = JSON.parse(saved);
        if (parsedState.category === selectedCategory) {
          currentState.watchingStreams = parsedState.watchingStreams || [];
        }
      }

      // Agregar el nuevo socketId si no existe
      if (!currentState.watchingStreams.includes(socketId)) {
        currentState.watchingStreams.push(socketId);
      }

      currentState.timestamp = Date.now();
      localStorage.setItem('adminWatchingState', JSON.stringify(currentState));
      console.log('💾 Estado de observación actualizado:', currentState);
    } catch (error) {
      console.error('❌ Error al guardar estado:', error);
    }
  };

  const removeWatchingState = (socketId: string) => {
    try {
      const saved = localStorage.getItem('adminWatchingState');
      if (saved) {
        const currentState = JSON.parse(saved);
        if (currentState.category === selectedCategory) {
          currentState.watchingStreams = currentState.watchingStreams.filter((id: string) => id !== socketId);
          currentState.timestamp = Date.now();
          localStorage.setItem('adminWatchingState', JSON.stringify(currentState));
          console.log('�️ Estado de observación actualizado:', currentState);
        }
      }
    } catch (error) {
      console.error('❌ Error al remover estado:', error);
    }
  };

  const loadWatchingState = (): { watchingStreams: string[], timestamp: number, category: number | null } | null => {
    try {
      const saved = localStorage.getItem('adminWatchingState');
      if (saved) {
        const state = JSON.parse(saved);
        // Solo cargar si es de la misma categoría y no muy antiguo (máximo 30 minutos)
        const maxAge = 30 * 60 * 1000; // 30 minutos
        if (state.category === selectedCategory && (Date.now() - state.timestamp) < maxAge) {
          console.log('📥 Estado de observación cargado:', state);
          return state;
        } else {
          console.log('🚫 Estado de observación expirado o de otra categoría');
        }
      }
    } catch (error) {
      console.error('❌ Error al cargar estado:', error);
    }
    return null;
  };

  const clearWatchingState = () => {
    localStorage.removeItem('adminWatchingState');
    console.log('🧹 Estado de observación limpiado');
  };

  // Función para restaurar conexiones automáticamente
  const restoreWatchingConnections = async (socket: any, participantsList: any[]) => {
    const savedState = loadWatchingState();
    if (!savedState || savedState.watchingStreams.length === 0) {
      return;
    }

    setIsRestoringConnections(true);
    console.log('🔄 Restaurando conexiones de observación...');

    // Esperar un poco para que los participantes se inicialicen
    setTimeout(() => {
      savedState.watchingStreams.forEach(socketId => {
        const participant = participantsList.find(p => p.socketId === socketId);
        if (participant) {
          console.log('🔗 Restaurando conexión con:', socketId);
          observeParticipant(socketId);
        } else {
          console.log('⚠️ Participante no encontrado para restaurar:', socketId);
        }
      });
      
      // Actualizar estado de watching
      setWatchingStreams(new Set(savedState.watchingStreams));
      setIsRestoringConnections(false);
    }, 2000); // Esperar 2 segundos
  };

  // useEffect para establecer conexión Socket.IO
  useEffect(() => {
    if (!token) {
      console.log('❌ Admin: No hay token disponible');
      return;
    }

    console.log('🔄 Admin: Inicializando conexión Socket.IO...');
    console.log('🔍 Admin: Backend URL:', process.env.NEXT_PUBLIC_BACKEND_URL);
    console.log('🎯 Admin: Categoría seleccionada:', selectedCategory);

    // Cargar estado previo si existe
    const savedState = loadWatchingState();
    if (savedState) {
      setWatchingStreams(new Set(savedState.watchingStreams));
      console.log('📂 Estado previo de observación cargado para restaurar');
    }

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

    // Listener para recibir la lista inicial de participantes
    newSocket.on('participants-list', (participantsList: Array<{ socketId: string, userData: any }>) => {
      console.log('📋 Lista inicial de participantes recibida:', participantsList.length);
      
      const participantsObj: { [socketId: string]: any } = {};
      participantsList.forEach(participant => {
        console.log('👤 Participante en lista:', participant.socketId, participant.userData);
        participantsObj[participant.socketId] = {
          ...participant.userData,
          streamAvailable: false // Por defecto, no sabemos si tienen stream hasta que nos notifiquen
        };
      });
      
      setParticipants(participantsObj);
      participantsRef.current = participantsObj;
      setLastUpdate(new Date());

      // Intentar restaurar conexiones después de recibir la lista
      restoreWatchingConnections(newSocket, participantsList);
    });

    // Listener para cuando un participante se une
    newSocket.on('user-joined', (data: { socketId: string, userData: any }) => {
      console.log('🎉 Participante se unió:', data.socketId, data.userData);
      console.log('📊 Datos del participante:', JSON.stringify(data.userData, null, 2));

      // Agregar o actualizar participante
      setParticipants(prevParticipants => {
        const newParticipants = {
          ...prevParticipants,
          [data.socketId]: data.userData
        };
        participantsRef.current = newParticipants;
        return newParticipants;
      });
      setLastUpdate(new Date());

      // Verificar si este participante estaba siendo observado antes
      const savedState = loadWatchingState();
      if (savedState && savedState.watchingStreams.includes(data.socketId)) {
        console.log('🔗 Participante estaba siendo observado, intentando reconectar...', data.socketId);
        setTimeout(() => {
          observeParticipant(data.socketId);
        }, 1000);
      }
    });

    // Listener para cuando un participante tiene stream disponible
    newSocket.on('participant-stream-available', (data: { socketId: string, userData: any }) => {
      console.log('📺 Stream disponible para participante:', data.socketId, data.userData);
      
      // Actualizar el estado para indicar que el stream está disponible
      setParticipants(prevParticipants => ({
        ...prevParticipants,
        [data.socketId]: {
          ...prevParticipants[data.socketId],
          ...data.userData,
          streamAvailable: true
        }
      }));
      setLastUpdate(new Date());

      // Si este participante estaba siendo observado, reconectar automáticamente
      const savedState = loadWatchingState();
      if (savedState && savedState.watchingStreams.includes(data.socketId)) {
        console.log('🔄 Reconectando automáticamente al stream de:', data.socketId);
        setTimeout(() => {
          observeParticipant(data.socketId);
        }, 1000);
      }
    });

    // Listener para cuando un participante deja de compartir
    newSocket.on('participant-stopped-sharing', (data: { socketId: string, userData: any }) => {
      console.log('📴 Participante detuvo compartición:', data.socketId, data.userData);
      
      // Actualizar el estado para indicar que ya no hay stream disponible
      setParticipants(prevParticipants => ({
        ...prevParticipants,
        [data.socketId]: {
          ...prevParticipants[data.socketId],
          ...data.userData,
          streamAvailable: false
        }
      }));
      setLastUpdate(new Date());

      // Limpiar el stream si existía
      setStreams(prevStreams => {
        const newStreams = { ...prevStreams };
        delete newStreams[data.socketId];
        return newStreams;
      });

      // Limpiar el peer si existía
      setPeers(prevPeers => {
        const peer = prevPeers[data.socketId];
        if (peer && !peer.destroyed) {
          peer.destroy();
        }
        const newPeers = { ...prevPeers };
        delete newPeers[data.socketId];
        return newPeers;
      });

      // Limpiar intentos de conexión
      setConnectionAttempts(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.socketId);
        return newSet;
      });
    });

    // Listener para señales WebRTC del participante
    newSocket.on('receiving-signal', (data: { signal: any, participantSocketId: string }) => {
      console.log('📡 Señal WebRTC recibida del participante:', data.participantSocketId);
      console.log('📦 Tipo de señal:', data.signal.type);
      
      // Crear un ID único para esta señal para evitar procesamiento duplicado
      const signalId = `${data.participantSocketId}-${data.signal.type}`;
      
      // Verificar si ya procesamos una señal similar recientemente
      if (processedSignalsRef.current.has(signalId)) {
        console.warn('⚠️ Señal duplicada detectada, ignorando:', data.participantSocketId, data.signal.type);
        return;
      }
      
      // Marcar como procesada
      processedSignalsRef.current.add(signalId);
      
      // Limpiar señales antiguas después de 5 segundos
      setTimeout(() => {
        processedSignalsRef.current.delete(signalId);
      }, 5000);
      
      // Verificar si ya existe un peer para este participante
      if (peers[data.participantSocketId]) {
        console.log('⚠️ Ya existe un peer para este participante, usando el existente');
        const existingPeer = peers[data.participantSocketId];
        if (!existingPeer.destroyed) {
          try {
            existingPeer.signal(data.signal);
            console.log('✅ Handshake WebRTC completado con participante:', data.participantSocketId);
          } catch (error) {
            console.error('❌ Error al procesar señal WebRTC:', error);
          }
        }
        return;
      }
      
      console.log('🆕 Creando nuevo peer para participante:', data.participantSocketId);
      
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
        console.log('📡 Enviando señal de respuesta al participante:', data.participantSocketId);
        // Enviar señal de respuesta al servidor para que la reenvíe al participante
        newSocket.emit('returning-signal', {
          signal: signal,
          participantSocketId: data.participantSocketId
        });
      });

      // Listener para recibir el stream de video del participante
      peer.on('stream', (stream: MediaStream) => {
        console.log('🎥 Stream recibido del participante:', data.participantSocketId);
        console.log('📊 Stream details:', {
          id: stream.id,
          active: stream.active,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });
        
        // Generar ID único para el stream
        const streamId = generateStreamId(
          data.participantSocketId, 
          participants[data.participantSocketId]?.id?.toString() || 'unknown',
          stream.id
        );
        
        // Crear objeto StreamData
        const streamData: StreamData = {
          id: streamId,
          stream: stream,
          participantId: participants[data.participantSocketId]?.id?.toString() || 'unknown',
          participantEmail: participants[data.participantSocketId]?.email || 'unknown',
          participantTeamId: participants[data.participantSocketId]?.teamId || null,
          socketId: data.participantSocketId,
          createdAt: new Date()
        };
        
        // Añadir el stream al estado usando el streamId como clave
        setStreams(prevStreams => ({
          ...prevStreams,
          [streamId]: streamData
        }));

        console.log('📺 Stream agregado con ID:', streamId);
      });

      // Listener para errores del peer
      peer.on('error', (error) => {
        console.error('❌ Error en conexión WebRTC con participante:', data.participantSocketId, error);
        // Limpiar estado en caso de error
        setConnectionAttempts(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.participantSocketId);
          return newSet;
        });
        setPeers(prevPeers => {
          const newPeers = { ...prevPeers };
          delete newPeers[data.participantSocketId];
          return newPeers;
        });
      });

      // Listener para conexión exitosa
      peer.on('connect', () => {
        console.log('✅ Conexión WebRTC establecida con participante:', data.participantSocketId);
        // Limpiar marcador de intento de conexión ya que fue exitoso
        setConnectionAttempts(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.participantSocketId);
          return newSet;
        });
      });

      // Listener para cuando se cierre la conexión
      peer.on('close', () => {
        console.log('🔌 Conexión WebRTC cerrada con participante:', data.participantSocketId);
        setConnectionAttempts(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.participantSocketId);
          return newSet;
        });
        setPeers(prevPeers => {
          const newPeers = { ...prevPeers };
          delete newPeers[data.participantSocketId];
          return newPeers;
        });
        setStreams(prevStreams => {
          const newStreams = { ...prevStreams };
          delete newStreams[data.participantSocketId];
          return newStreams;
        });
      });

      // Guardar el peer en el estado primero
      setPeers(prevPeers => ({
        ...prevPeers,
        [data.participantSocketId]: peer
      }));
      
      // Procesar la señal inicial del participante
      try {
        peer.signal(data.signal);
        console.log('✅ Procesando señal inicial del participante:', data.participantSocketId);
      } catch (error) {
        console.error('❌ Error al procesar señal inicial:', error);
      }
    });

    // Listener para cuando un participante se desconecta
    newSocket.on('user-left', (data: { socketId: string }) => {
      console.log('Participante se desconectó:', data.socketId);
      
      // Actualizar estado local y persistente
      setWatchingStreams(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.socketId);
        return newSet;
      });
      removeWatchingState(data.socketId);
      
      // Remover participante de la lista
      setParticipants(prevParticipants => {
        const newParticipants = { ...prevParticipants };
        delete newParticipants[data.socketId];
        return newParticipants;
      });
      setLastUpdate(new Date());

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
    // Solicitar lista inicial de participantes
    newSocket.emit('request-participants-list');
    console.log('📡 Solicitando lista inicial de participantes');

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
    console.log('🎯 observeParticipant llamado con:', participantSocketId);
    
    if (!socket) {
      console.warn('❌ Socket no está conectado');
      return;
    }

    // Verificar si ya existe un peer para este participante
    if (peers[participantSocketId]) {
      console.log('⚠️ Ya hay una conexión activa con este participante');
      return;
    }

    // Verificar si ya se está intentando una conexión
    if (connectionAttempts.has(participantSocketId)) {
      console.log('⚠️ Ya se está intentando conectar con este participante, ignorando solicitud duplicada');
      return;
    }

    console.log('📞 Solicitando observar participante:', participantSocketId);
    console.log('📊 Estado actual - Socket conectado:', socket.connected);
    console.log('📊 Estado actual - Participantes:', Object.keys(participants));
    console.log('📊 Estado actual - Peers activos:', Object.keys(peers));

    // Marcar intento de conexión
    setConnectionAttempts(prev => new Set(prev).add(participantSocketId));

    // Actualizar estado local y persistente
    setWatchingStreams(prev => new Set(prev).add(participantSocketId));
    saveWatchingState(participantSocketId);

    // Solicitar conexión al participante
    console.log('📡 Enviando admin-wants-to-connect al servidor...');
    socket.emit('admin-wants-to-connect', {
      participantSocketId: participantSocketId
    });
  };

  // Función para dejar de observar a un participante
  const stopObservingParticipant = (participantSocketId: string) => {
    console.log('🛑 Dejando de observar participante:', participantSocketId);
    
    // Actualizar estado local y persistente
    setWatchingStreams(prev => {
      const newSet = new Set(prev);
      newSet.delete(participantSocketId);
      return newSet;
    });
    removeWatchingState(participantSocketId);
    
    // Cerrar conexión WebRTC si existe
    setPeers(prevPeers => {
      const peer = prevPeers[participantSocketId];
      if (peer && !peer.destroyed) {
        console.log('🔌 Cerrando peer para:', participantSocketId);
        peer.destroy();
      }
      const newPeers = { ...prevPeers };
      delete newPeers[participantSocketId];
      return newPeers;
    });

    // Remover stream - buscar por socketId
    setStreams(prevStreams => {
      const newStreams = { ...prevStreams };
      // Buscar y eliminar todos los streams del participante
      Object.keys(newStreams).forEach(streamId => {
        if (newStreams[streamId].socketId === participantSocketId) {
          console.log('🗑️ Eliminando stream:', streamId);
          delete newStreams[streamId];
        }
      });
      return newStreams;
    });

    // Limpiar intentos de conexión
    setConnectionAttempts(prev => {
      const newSet = new Set(prev);
      newSet.delete(participantSocketId);
      return newSet;
    });

    // Notificar al servidor que ya no queremos observar
    if (socket) {
      socket.emit('admin-stop-observing', {
        participantSocketId: participantSocketId
      });
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const refreshParticipants = () => {
    if (socket) {
      console.log('🔄 Solicitando actualización de participantes...');
      socket.emit('request-participants-list');
    }
  };

  // Función auxiliar para verificar si un participante tiene streams activos
  const hasActiveStreams = (socketId: string): boolean => {
    return utilHasActiveStreams(streams, socketId);
  };

  // Función auxiliar para obtener los streams de un participante
  const getParticipantStreams = (socketId: string): StreamData[] => {
    return getStreamsBySocketId(streams, socketId);
  };

  // Función para filtrar participantes por categoría
  const getFilteredParticipants = () => {
    if (!selectedCategory || selectedCategory === 0) {
      // Si no hay categoría seleccionada o es 0 (todas), mostrar todos
      return participants;
    }

    // Filtrar participantes por teamId (categoría)
    const filtered: { [socketId: string]: any } = {};
    Object.entries(participants).forEach(([socketId, userData]) => {
      if (userData.teamId === selectedCategory) {
        filtered[socketId] = userData;
      }
    });
    return filtered;
  };

  // Función para obtener el nombre de la categoría
  const getCategoryName = (categoryId: number | null): string => {
    if (!categoryId || categoryId === 0) return 'Todas las Categorías';
    
    const categories = [
      { id: 1, name: 'Equipo A' },
      { id: 2, name: 'Equipo B' }
    ];
    
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : `Categoría ${categoryId}`;
  };

  // Función para cambiar de categoría
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
                      <p className="text-gray-500 text-sm">
                        {Object.keys(participants).length === 0
                          ? 'Los participantes aparecerán aquí cuando se conecten'
                          : 'Cambia de categoría para ver otros participantes'
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
                        {(userData as any).streamAvailable ? '📺 Stream disponible' : '⏳ Esperando stream'}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      {hasActiveStreams(socketId) ? (
                        <button
                          onClick={() => stopObservingParticipant(socketId)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition"
                        >
                          Dejar de ver
                        </button>
                      ) : (
                        <button
                          onClick={() => observeParticipant(socketId)}
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
                <span className="text-gray-400">Con stream disponible:</span> {Object.values(participants).filter((p: any) => p.streamAvailable).length}
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
              {Object.entries(streams).map(([streamId, streamData]) => (
                <div key={streamId} className="bg-gray-800 rounded-lg p-4">
                  <div className="mb-2 flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">{streamData.participantEmail}</p>
                      <p className="text-gray-400 text-sm">Equipo: {streamData.participantTeamId || 'Sin asignar'}</p>
                      <p className="text-gray-500 text-xs">ID: {streamData.id}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => stopObservingParticipant(streamData.socketId)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition"
                      >
                        🛑 Dejar de ver
                      </button>
                      <button
                        onClick={() => {
                          const videoElement = document.querySelector(`[data-stream-id="${streamId}"] video`) as HTMLVideoElement;
                          if (videoElement) {
                            if (videoElement.requestFullscreen) {
                              videoElement.requestFullscreen();
                            }
                          }
                        }}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition"
                      >
                        🔍 Pantalla Completa
                      </button>
                    </div>
                  </div>
                  <div 
                    className="aspect-video bg-black rounded-lg overflow-hidden"
                    data-stream-id={streamId}
                  >
                    <VideoPlayer 
                      stream={streamData.stream} 
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
