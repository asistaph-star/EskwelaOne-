import React, { useState, useEffect, useRef, useCallback } from 'react';

export type GatePlaylistMedia = {
  id: string;
  title: string;
  type: 'image' | 'video';
  url: string; // The ready-to-serve URL, but we will prepend API_BASE_URL if it is relative
  order: number;
  durationMs: number | null;
};

const DEFAULT_IMAGE_DISPLAY_MS = 15_000;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

interface CampusMediaPlaybackProps {
  onAllFailed: () => void; // Call if empty or if everything fails to load
}

export function CampusMediaPlayback({ onAllFailed }: CampusMediaPlaybackProps) {
  const [playlist, setPlaylist] = useState<GatePlaylistMedia[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Track consecutive failures to prevent infinite error loops
  const consecutiveFailuresRef = useRef(0);
  
  // Mount: Fetch playlist
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchPlaylist() {
      try {
        const response = await fetch(`${API_BASE_URL}/media/gate/playlist`, {
          credentials: 'include',
          signal: abortController.signal
        });
        
        // Handle unauthorized session expiration
        if (response.status === 401) {
          onAllFailed(); // Let the normal Gate loop handle session expired
          return;
        }

        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
          setPlaylist(data.data);
          setCurrentIndex(0);
        } else {
          onAllFailed(); // Empty playlist, return to fallback Ready state
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Failed to fetch campus media playlist", err);
          onAllFailed();
        }
      } finally {
        setLoading(false);
      }
    }

    fetchPlaylist();

    return () => {
      abortController.abort();
    };
  }, [onAllFailed]);

  const handleNext = useCallback(() => {
    setCurrentIndex(prevIndex => {
      if (playlist.length === 0) return 0;
      return (prevIndex + 1) % playlist.length;
    });
  }, [playlist.length]);

  const handleMediaError = useCallback(() => {
    consecutiveFailuresRef.current += 1;
    if (consecutiveFailuresRef.current >= playlist.length) {
      // Everything failed
      onAllFailed();
    } else {
      handleNext(); // Skip to next
    }
  }, [handleNext, playlist.length, onAllFailed]);

  const handleMediaSuccess = useCallback(() => {
    consecutiveFailuresRef.current = 0; // Reset failures on successful load
  }, []);

  // Image display timer
  useEffect(() => {
    if (playlist.length === 0 || loading) return;
    
    const currentMedia = playlist[currentIndex];
    
    if (currentMedia.type === 'image') {
      const displayDuration = currentMedia.durationMs || DEFAULT_IMAGE_DISPLAY_MS;
      const timer = setTimeout(() => {
        handleNext();
      }, displayDuration);
      
      return () => clearTimeout(timer);
    }
  }, [currentIndex, playlist, loading, handleNext]);

  if (loading) {
    // Return empty fragment or minimal spinner while fetching so it doesn't flash white
    return <div className="absolute inset-0 z-0 bg-slate-100 flex items-center justify-center opacity-0 transition-opacity" />;
  }

  if (playlist.length === 0) {
    return null;
  }

  const currentMedia = playlist[currentIndex];

  // Resolve media URL
  let mediaUrl = currentMedia.url;
  if (mediaUrl.startsWith('/api')) {
    // E.g. /api/media/gate/serve/:documentId -> http://localhost:4000/api/media/gate/serve/:documentId
    mediaUrl = `${API_BASE_URL.replace('/api', '')}${mediaUrl}`;
  } else if (!mediaUrl.startsWith('http')) {
    mediaUrl = `${API_BASE_URL}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;
  }

  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center bg-slate-100 overflow-hidden">
      {currentMedia.type === 'video' ? (
        <video
          key={currentMedia.id} // Re-mounts if ID changes to restart playback
          src={mediaUrl}
          className="w-full h-full object-contain"
          autoPlay
          muted
          playsInline
          onEnded={handleNext}
          onError={handleMediaError}
          onLoadedData={handleMediaSuccess}
          crossOrigin="use-credentials"
        />
      ) : (
        <img
          key={currentMedia.id}
          src={mediaUrl}
          alt={currentMedia.title}
          className="w-full h-full object-contain"
          onError={handleMediaError}
          onLoad={handleMediaSuccess}
          crossOrigin="use-credentials"
        />
      )}
    </div>
  );
}
