/**
 * Utilidades para el manejo de streams en el sistema de transmisión multipantalla
 */

export interface StreamData {
  id: string;
  stream: MediaStream;
  participantId: string;
  participantEmail: string;
  participantTeamId: number | null;
  socketId: string;
  createdAt: Date;
}

/**
 * Genera un identificador único para un stream
 * @param socketId ID del socket del participante
 * @param participantId ID del participante
 * @param mediaStreamId ID del MediaStream nativo (opcional)
 * @returns Identificador único del stream
 */
export const generateStreamId = (
  socketId: string, 
  participantId: string, 
  mediaStreamId?: string
): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const streamIdSuffix = mediaStreamId ? `_${mediaStreamId.substring(0, 8)}` : '';
  
  return `stream_${participantId}_${socketId}_${timestamp}_${random}${streamIdSuffix}`;
};

/**
 * Valida si un identificador de stream es válido
 * @param streamId Identificador del stream a validar
 * @returns true si el ID es válido, false en caso contrario
 */
export const isValidStreamId = (streamId: string): boolean => {
  if (!streamId || typeof streamId !== 'string') {
    return false;
  }
  
  // Patrón: stream_[participantId]_[socketId]_[timestamp]_[random]_[mediaStreamId]?
  const pattern = /^stream_[\w]+_[\w-]+_\d+_[\w]+(_[\w]+)?$/;
  return pattern.test(streamId);
};

/**
 * Extrae información de un identificador de stream
 * @param streamId Identificador del stream
 * @returns Objeto con información extraída del ID
 */
export const parseStreamId = (streamId: string): {
  participantId: string | null;
  socketId: string | null;
  timestamp: number | null;
  isValid: boolean;
} => {
  if (!isValidStreamId(streamId)) {
    return {
      participantId: null,
      socketId: null,
      timestamp: null,
      isValid: false
    };
  }
  
  const parts = streamId.split('_');
  
  return {
    participantId: parts[1] || null,
    socketId: parts[2] || null,
    timestamp: parts[3] ? parseInt(parts[3], 10) : null,
    isValid: true
  };
};

/**
 * Filtra streams por socketId del participante
 * @param streams Objeto con todos los streams
 * @param socketId ID del socket a filtrar
 * @returns Array de StreamData que pertenecen al participante
 */
export const getStreamsBySocketId = (
  streams: { [streamId: string]: StreamData }, 
  socketId: string
): StreamData[] => {
  return Object.values(streams).filter(streamData => streamData.socketId === socketId);
};

/**
 * Verifica si un participante tiene streams activos
 * @param streams Objeto con todos los streams
 * @param socketId ID del socket del participante
 * @returns true si el participante tiene streams activos
 */
export const hasActiveStreams = (
  streams: { [streamId: string]: StreamData }, 
  socketId: string
): boolean => {
  return Object.values(streams).some(streamData => 
    streamData.socketId === socketId && streamData.stream.active
  );
};

/**
 * Limpia streams inactivos de un participante
 * @param streams Objeto con todos los streams
 * @param socketId ID del socket del participante
 * @returns Nuevo objeto de streams sin los streams inactivos
 */
export const cleanInactiveStreams = (
  streams: { [streamId: string]: StreamData }, 
  socketId: string
): { [streamId: string]: StreamData } => {
  const newStreams = { ...streams };
  
  Object.keys(newStreams).forEach(streamId => {
    if (newStreams[streamId].socketId === socketId && !newStreams[streamId].stream.active) {
      console.log('🧹 Limpiando stream inactivo:', streamId);
      delete newStreams[streamId];
    }
  });
  
  return newStreams;
};

/**
 * Obtiene estadísticas de los streams activos
 * @param streams Objeto con todos los streams
 * @returns Estadísticas de los streams
 */
export const getStreamStats = (streams: { [streamId: string]: StreamData }) => {
  const totalStreams = Object.keys(streams).length;
  const activeStreams = Object.values(streams).filter(s => s.stream.active).length;
  const uniqueParticipants = new Set(Object.values(streams).map(s => s.socketId)).size;
  
  return {
    totalStreams,
    activeStreams,
    inactiveStreams: totalStreams - activeStreams,
    uniqueParticipants
  };
};