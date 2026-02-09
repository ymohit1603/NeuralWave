/**
 * Hook for managing saved/converted tracks using IndexedDB
 * Uses IndexedDB instead of localStorage to handle larger audio files
 */

import { useState, useEffect, useCallback } from 'react';
import { UserAudioSettings } from '@/lib/audio';
import lamejs from '@breezystack/lamejs';
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

const MP3_STORAGE_BITRATE = 128;
const MP3_FRAME_SIZE = 1152;
const MP3_STORAGE_YIELD_EVERY_FRAMES = 200;

function yieldToMainThread(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function floatToInt16Sample(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
}

async function encodeAudioBufferToMp3(buffer: AudioBuffer): Promise<Uint8Array> {
  // Yield immediately so UI can transition out of processing state first.
  await yieldToMainThread();

  const channelCount = Math.min(2, Math.max(1, buffer.numberOfChannels));
  const leftChannel = buffer.getChannelData(0);
  const rightChannel = channelCount > 1 ? buffer.getChannelData(1) : leftChannel;

  const encoder = new lamejs.Mp3Encoder(channelCount, buffer.sampleRate, MP3_STORAGE_BITRATE);
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  const leftFrameBuffer = new Int16Array(MP3_FRAME_SIZE);
  const rightFrameBuffer = new Int16Array(MP3_FRAME_SIZE);

  for (let i = 0; i < buffer.length; i += MP3_FRAME_SIZE) {
    const frameLength = Math.min(MP3_FRAME_SIZE, buffer.length - i);

    for (let j = 0; j < frameLength; j++) {
      leftFrameBuffer[j] = floatToInt16Sample(leftChannel[i + j]);
    }

    let encodedFrame: Uint8Array;
    const leftFrame = frameLength === MP3_FRAME_SIZE
      ? leftFrameBuffer
      : leftFrameBuffer.subarray(0, frameLength);

    if (channelCount > 1) {
      for (let j = 0; j < frameLength; j++) {
        rightFrameBuffer[j] = floatToInt16Sample(rightChannel[i + j]);
      }
      const rightFrame = frameLength === MP3_FRAME_SIZE
        ? rightFrameBuffer
        : rightFrameBuffer.subarray(0, frameLength);
      encodedFrame = encoder.encodeBuffer(leftFrame, rightFrame);
    } else {
      encodedFrame = encoder.encodeBuffer(leftFrame);
    }

    if (encodedFrame.length > 0) {
      const chunk = new Uint8Array(encodedFrame);
      chunks.push(chunk);
      totalLength += chunk.length;
    }

    if ((i / MP3_FRAME_SIZE) % MP3_STORAGE_YIELD_EVERY_FRAMES === 0) {
      await yieldToMainThread();
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    const flushChunk = new Uint8Array(flushed);
    chunks.push(flushChunk);
    totalLength += flushChunk.length;
  }

  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function bytesToBase64(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const arrayBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(arrayBuffer).set(bytes);

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to convert audio bytes to base64'));
        return;
      }

      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to convert audio bytes to base64'));
    reader.readAsDataURL(new Blob([arrayBuffer], { type: 'audio/mpeg' }));
  });
}

// Helper to convert AudioBuffer to base64 MP3 for compact storage
export async function audioBufferToBase64(buffer: AudioBuffer): Promise<string> {
  const mp3Bytes = await encodeAudioBufferToMp3(buffer);
  return bytesToBase64(mp3Bytes);
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
