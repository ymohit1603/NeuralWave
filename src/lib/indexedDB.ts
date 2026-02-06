/**
 * IndexedDB utility for storing large data like audio tracks
 * Much better than localStorage for audio data (no 5-10MB limit)
 */

const DB_NAME = 'neuralwave-db';
const DB_VERSION = 1;
const TRACKS_STORE = 'saved-tracks';

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create tracks store if it doesn't exist
      if (!db.objectStoreNames.contains(TRACKS_STORE)) {
        const store = db.createObjectStore(TRACKS_STORE, { keyPath: 'id' });
        store.createIndex('processedDate', 'processedDate', { unique: false });
      }
    };
  });
}

export interface StoredTrack {
  id: string;
  title: string;
  author?: string;
  duration: number;
  thumbnail?: string;
  processedDate: string;
  audioData: string; // base64 encoded audio
  settings: any;
  source: 'upload' | 'youtube' | 'search';
  originalFileName?: string;
}

export async function getAllTracks(): Promise<StoredTrack[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TRACKS_STORE, 'readonly');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const tracks = request.result || [];
        // Sort by date, newest first
        tracks.sort((a: StoredTrack, b: StoredTrack) =>
          new Date(b.processedDate).getTime() - new Date(a.processedDate).getTime()
        );
        resolve(tracks);
      };

      request.onerror = () => {
        reject(new Error('Failed to get tracks from IndexedDB'));
      };
    });
  } catch (error) {
    console.error('Error getting tracks from IndexedDB:', error);
    return [];
  }
}

export async function saveTrack(track: StoredTrack): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TRACKS_STORE, 'readwrite');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.put(track);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error('Failed to save track to IndexedDB'));
    });
  } catch (error) {
    console.error('Error saving track to IndexedDB:', error);
    return false;
  }
}

export async function deleteTrack(trackId: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TRACKS_STORE, 'readwrite');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.delete(trackId);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error('Failed to delete track from IndexedDB'));
    });
  } catch (error) {
    console.error('Error deleting track from IndexedDB:', error);
    return false;
  }
}

export async function getTrack(trackId: string): Promise<StoredTrack | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TRACKS_STORE, 'readonly');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.get(trackId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get track from IndexedDB'));
    });
  } catch (error) {
    console.error('Error getting track from IndexedDB:', error);
    return null;
  }
}

export async function clearAllTracks(): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TRACKS_STORE, 'readwrite');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error('Failed to clear tracks from IndexedDB'));
    });
  } catch (error) {
    console.error('Error clearing tracks from IndexedDB:', error);
    return false;
  }
}

export async function updateTrack(trackId: string, updates: Partial<StoredTrack>): Promise<boolean> {
  try {
    const existingTrack = await getTrack(trackId);
    if (!existingTrack) return false;

    const updatedTrack = { ...existingTrack, ...updates, id: trackId };
    return await saveTrack(updatedTrack);
  } catch (error) {
    console.error('Error updating track in IndexedDB:', error);
    return false;
  }
}

// Migrate from localStorage to IndexedDB (one-time migration)
export async function migrateFromLocalStorage(): Promise<void> {
  const STORAGE_KEY = 'neuralwave-saved-tracks';
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const tracks = JSON.parse(stored) as StoredTrack[];
    if (!Array.isArray(tracks) || tracks.length === 0) return;

    // Save all tracks to IndexedDB
    for (const track of tracks) {
      await saveTrack(track);
    }

    // Clear localStorage after successful migration
    localStorage.removeItem(STORAGE_KEY);
    console.log(`Migrated ${tracks.length} tracks from localStorage to IndexedDB`);
  } catch (error) {
    console.error('Error migrating from localStorage:', error);
  }
}

// Get storage usage estimate
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    } catch {
      return null;
    }
  }
  return null;
}
