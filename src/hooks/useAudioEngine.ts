/**
 * useAudioEngine Hook
 * React hook for managing the AudioEngine instance
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AudioEngine,
  UserAudioSettings,
  AudioEngineState,
  EffectMode,
} from '@/lib/audio';

interface UseAudioEngineOptions {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onStateChange?: (state: AudioEngineState) => void;
  onError?: (error: Error) => void;
  onSettingsChange?: (settings: UserAudioSettings) => void;
}

interface UseAudioEngineReturn {
  // State
  state: AudioEngineState;
  currentTime: number;
  duration: number;
  settings: UserAudioSettings;
  isPlaying: boolean;
  isPaused: boolean;
  isReady: boolean;
  isLoading: boolean;

  // Playback controls
  play: (startOffset?: number) => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  togglePlayPause: () => void;

  // Loading
  loadFile: (file: File) => Promise<void>;
  loadUrl: (url: string) => Promise<void>;
  loadBuffer: (buffer: AudioBuffer) => Promise<void>;

  // Settings
  updateParameter: <K extends keyof UserAudioSettings>(
    param: K,
    value: UserAudioSettings[K]
  ) => void;
  setMode: (mode: EffectMode) => void;
  applySettings: (settings: UserAudioSettings) => void;

  // Undo/Reset
  undo: () => void;
  redo: () => void;
  reset: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Engine instance (for advanced use)
  engine: AudioEngine | null;

  // Initialize
  initialize: () => Promise<void>;
}

export function useAudioEngine(options: UseAudioEngineOptions = {}): UseAudioEngineReturn {
  const engineRef = useRef<AudioEngine | null>(null);
  const [state, setState] = useState<AudioEngineState>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [settings, setSettings] = useState<UserAudioSettings | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Initialize engine on mount
  useEffect(() => {
    const engine = new AudioEngine({
      onStateChange: (newState) => {
        setState(newState);
        options.onStateChange?.(newState);
      },
      onTimeUpdate: (time, dur) => {
        setCurrentTime(time);
        setDuration(dur);
        options.onTimeUpdate?.(time, dur);
      },
      onError: (error) => {
        options.onError?.(error);
      },
      onSettingsChange: (newSettings) => {
        setSettings(newSettings);
        setCanUndo(engine.canUndo());
        setCanRedo(engine.canRedo());
        options.onSettingsChange?.(newSettings);
      },
    });

    engineRef.current = engine;
    setSettings(engine.getSettings());

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Initialize the audio context
  const initialize = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.initialize();
    }
  }, []);

  // Playback controls
  const play = useCallback((startOffset?: number) => {
    engineRef.current?.play(startOffset);
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setCurrentTime(0);
  }, []);

  const seek = useCallback((time: number) => {
    engineRef.current?.seek(time);
    setCurrentTime(time);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (state === 'playing') {
      pause();
    } else {
      play();
    }
  }, [state, play, pause]);

  // Loading
  const loadFile = useCallback(async (file: File) => {
    const engine = engineRef.current;
    if (!engine) return;

    await engine.loadFile(file);
    if (engineRef.current !== engine) return;

    setDuration(engine.getDuration());
  }, []);

  const loadUrl = useCallback(async (url: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    await engine.loadUrl(url);
    if (engineRef.current !== engine) return;

    setDuration(engine.getDuration());
  }, []);

  const loadBuffer = useCallback(async (buffer: AudioBuffer) => {
    const engine = engineRef.current;
    if (!engine) return;

    await engine.loadAudio(buffer);
    if (engineRef.current !== engine) return;

    const dur = engine.getDuration();
    if (dur !== null && isFinite(dur)) {
      setDuration(dur);
    }
  }, []);

  // Settings
  const updateParameter = useCallback(<K extends keyof UserAudioSettings>(
    param: K,
    value: UserAudioSettings[K]
  ) => {
    engineRef.current?.updateParameter(param, value);
  }, []);

  const setMode = useCallback((mode: EffectMode) => {
    engineRef.current?.setMode(mode);
  }, []);

  const applySettings = useCallback((newSettings: UserAudioSettings) => {
    engineRef.current?.applySettings(newSettings, true);
  }, []);

  // Undo/Reset
  const undo = useCallback(() => {
    engineRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    engineRef.current?.redo();
  }, []);

  const reset = useCallback(() => {
    engineRef.current?.reset();
  }, []);

  return {
    // State
    state,
    currentTime,
    duration,
    settings: settings || engineRef.current?.getSettings() || {} as UserAudioSettings,
    isPlaying: state === 'playing',
    isPaused: state === 'paused',
    isReady: state === 'ready' || state === 'paused',
    isLoading: state === 'loading',

    // Playback controls
    play,
    pause,
    stop,
    seek,
    togglePlayPause,

    // Loading
    loadFile,
    loadUrl,
    loadBuffer,

    // Settings
    updateParameter,
    setMode,
    applySettings,

    // Undo/Reset
    undo,
    redo,
    reset,
    canUndo,
    canRedo,

    // Engine instance
    engine: engineRef.current,

    // Initialize
    initialize,
  };
}

export default useAudioEngine;
