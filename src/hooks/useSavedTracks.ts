/**
 * Hook for managing saved/converted tracks using IndexedDB
 * Uses IndexedDB instead of localStorage to handle larger audio files
 */

import { useState, useEffect, useCallback } from 'react';
import { UserAudioSettings } from '@/lib/audio';
import {
  getAllTracks,
  saveTrack as saveTrackToDB,
  deleteTrack as deleteTrackFromDB,
  clearAllTracks as clearTracksFromDB,
  updateTrack as updateTrackInDB,
  migrateFromLocalStorage,
  StoredTrack,
} from '@/lib/indexedDB';

export interface SavedTrack extends StoredTrack {
  settings: UserAudioSettings;
}

const MAX_TRACKS = 50; // Increased limit since IndexedDB can handle more

// Helper to generate unique ID
function generateId(): string {
  return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to convert AudioBuffer to base64
export async function audioBufferToBase64(buffer: AudioBuffer): Promise<string> {
  // Create offline context to render the buffer
  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start();

  const renderedBuffer = await offlineCtx.startRendering();

  // Convert to WAV format
  const wavData = audioBufferToWav(renderedBuffer);

  // Convert to base64
  const base64 = btoa(
    new Uint8Array(wavData).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  return base64;
}

// Helper to convert base64 back to AudioBuffer
export async function base64ToAudioBuffer(base64: string): Promise<AudioBuffer> {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
  audioContext.close();

  return audioBuffer;
}

// Convert AudioBuffer to WAV format
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write audio data
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function useSavedTracks() {
  const [tracks, setTracks] = useState<SavedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load tracks from IndexedDB on mount
  useEffect(() => {
    const loadTracks = async () => {
      try {
        // First, migrate from localStorage if needed (one-time)
        await migrateFromLocalStorage();

        // Then load from IndexedDB
        const storedTracks = await getAllTracks();
        setTracks(storedTracks as SavedTrack[]);
      } catch (error) {
        console.error('Error loading saved tracks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTracks();
  }, []);

  // Add a new track
  const addTrack = useCallback(async (
    title: string,
    audioBuffer: AudioBuffer,
    settings: UserAudioSettings,
    options?: {
      author?: string;
      thumbnail?: string;
      source?: 'upload' | 'youtube' | 'search';
      originalFileName?: string;
    }
  ): Promise<{ track: SavedTrack | null; warning?: string; error?: string }> => {
    try {
      const audioData = await audioBufferToBase64(audioBuffer);

      const newTrack: SavedTrack = {
        id: generateId(),
        title,
        author: options?.author,
        duration: audioBuffer.duration,
        thumbnail: options?.thumbnail,
        processedDate: new Date().toISOString(),
        audioData,
        settings,
        source: options?.source || 'upload',
        originalFileName: options?.originalFileName,
      };

      // Save to IndexedDB
      const saved = await saveTrackToDB(newTrack);
      if (!saved) {
        return { track: null, error: 'Failed to save track. Please try again.' };
      }

      // Update state
      const newTracks = [newTrack, ...tracks];

      // If we exceed max tracks, remove oldest ones
      if (newTracks.length > MAX_TRACKS) {
        const tracksToRemove = newTracks.slice(MAX_TRACKS);
        for (const track of tracksToRemove) {
          await deleteTrackFromDB(track.id);
        }
        setTracks(newTracks.slice(0, MAX_TRACKS));
        return {
          track: newTrack,
          warning: `Storage limit reached. Removed ${tracksToRemove.length} older track(s).`
        };
      }

      setTracks(newTracks);
      return { track: newTrack };
    } catch (error) {
      console.error('Error adding track:', error);
      return { track: null, error: 'Failed to process audio for saving.' };
    }
  }, [tracks]);

  // Update track settings
  const updateTrackSettings = useCallback(async (trackId: string, settings: UserAudioSettings) => {
    const success = await updateTrackInDB(trackId, { settings });
    if (success) {
      setTracks(prev => prev.map(track =>
        track.id === trackId ? { ...track, settings } : track
      ));
    }
  }, []);

  // Delete a track
  const deleteTrack = useCallback(async (trackId: string) => {
    const success = await deleteTrackFromDB(trackId);
    if (success) {
      setTracks(prev => prev.filter(track => track.id !== trackId));
    }
  }, []);

  // Get a track by ID
  const getTrack = useCallback((trackId: string): SavedTrack | undefined => {
    return tracks.find(track => track.id === trackId);
  }, [tracks]);

  // Get audio buffer for a track
  const getTrackAudioBuffer = useCallback(async (trackId: string): Promise<AudioBuffer | null> => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return null;

    try {
      return await base64ToAudioBuffer(track.audioData);
    } catch (error) {
      console.error('Error loading track audio:', error);
      return null;
    }
  }, [tracks]);

  // Get recent tracks (for dashboard)
  const getRecentTracks = useCallback((limit: number = 3): SavedTrack[] => {
    return tracks.slice(0, limit);
  }, [tracks]);

  // Clear all tracks
  const clearAllTracks = useCallback(async () => {
    await clearTracksFromDB();
    setTracks([]);
  }, []);

  return {
    tracks,
    isLoading,
    addTrack,
    updateTrackSettings,
    deleteTrack,
    getTrack,
    getTrackAudioBuffer,
    getRecentTracks,
    clearAllTracks,
    totalTracks: tracks.length,
  };
}
