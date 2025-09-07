import { useRef, useEffect } from 'react';

interface VideoPlayerProps {
  stream: MediaStream | null;
  className?: string;
}

export default function VideoPlayer({ stream, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    
    if (!video) {
      console.warn('VideoPlayer: No video element ref available');
      return;
    }

    if (!stream) {
      console.warn('VideoPlayer: No stream provided');
      video.srcObject = null;
      return;
    }

    console.log('🎥 VideoPlayer: Asignando stream al video element');
    console.log('📊 Stream info:', {
      id: stream.id,
      active: stream.active,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      videoTrackEnabled: stream.getVideoTracks()[0]?.enabled
    });

    // Diagnóstico detallado del stream
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      console.log('🔍 Video Track Details:', {
        id: videoTrack.id,
        kind: videoTrack.kind,
        label: videoTrack.label,
        enabled: videoTrack.enabled,
        muted: videoTrack.muted,
        readyState: videoTrack.readyState,
        settings: videoTrack.getSettings(),
        constraints: videoTrack.getConstraints()
      });
    }

    // Asignar el stream al elemento video
    video.srcObject = stream;

    // Configurar atributos importantes del video
    video.autoplay = true;
    video.playsInline = true;
    video.muted = false; // No silenciar para streams remotos

    // Listeners para eventos del video
    const handleLoadedMetadata = () => {
      console.log('✅ VideoPlayer: Metadata cargada');
      console.log('📐 Video dimensions:', video.videoWidth, 'x', video.videoHeight);
      
      // Si las dimensiones son muy pequeñas, hay un problema
      if (video.videoWidth <= 10 || video.videoHeight <= 10) {
        console.warn('⚠️ VideoPlayer: Dimensiones de video muy pequeñas, posible problema con el stream');
      }
    };

    const handleCanPlay = () => {
      console.log('✅ VideoPlayer: Video listo para reproducir');
      // Forzar play si no se reproduce automáticamente
      video.play().catch(e => {
        console.log('ℹ️ VideoPlayer: No se pudo hacer autoplay, esto es normal en algunos navegadores');
      });
    };

    const handleError = (e: Event) => {
      console.error('❌ VideoPlayer: Error en video element:', e);
    };

    const handleResize = () => {
      console.log('🔄 VideoPlayer: Video redimensionado a:', video.videoWidth, 'x', video.videoHeight);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('resize', handleResize);
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      className={`w-full h-full object-contain bg-black ${className}`}
      playsInline
      autoPlay
      muted
      controls={false}
      style={{ 
        minHeight: '200px',
        backgroundColor: '#000000'
      }}
    />
  );
}