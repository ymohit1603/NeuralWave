/**
 * useSettingsHistory Hook
 * React hook for managing audio settings undo/reset functionality
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { UserAudioSettings, SettingsHistory, getInitialSettings } from '@/lib/audio';

interface UseSettingsHistoryOptions {
  initialSettings?: UserAudioSettings;
  maxHistory?: number;
  onSettingsChange?: (settings: UserAudioSettings) => void;
}

interface UseSettingsHistoryReturn {
  // Current settings
  settings: UserAudioSettings;

  // Update settings
  updateSettings: (settings: UserAudioSettings, label?: string) => void;
  updateParameter: <K extends keyof UserAudioSettings>(
    param: K,
    value: UserAudioSettings[K],
    label?: string
  ) => void;

  // Undo/Redo/Reset
  undo: () => UserAudioSettings | null;
  redo: () => UserAudioSettings | null;
  reset: () => UserAudioSettings;

  // State
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  currentIndex: number;

  // History instance (for advanced use)
  history: SettingsHistory;
}

export function useSettingsHistory(
  options: UseSettingsHistoryOptions = {}
): UseSettingsHistoryReturn {
  const {
    initialSettings = getInitialSettings(),
    maxHistory = 50,
    onSettingsChange,
  } = options;

  const historyRef = useRef<SettingsHistory>(
    new SettingsHistory(initialSettings, maxHistory)
  );

  const [settings, setSettings] = useState<UserAudioSettings>(initialSettings);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [historyLength, setHistoryLength] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Update state from history
  const updateState = useCallback(() => {
    const history = historyRef.current;
    setCanUndo(history.canUndo());
    setCanRedo(history.canRedo());
    setHistoryLength(history.getHistoryLength());
    setCurrentIndex(history.getCurrentIndex());
  }, []);

  // Update settings
  const updateSettings = useCallback(
    (newSettings: UserAudioSettings, label?: string) => {
      historyRef.current.push(newSettings, label);
      setSettings(newSettings);
      updateState();
      onSettingsChange?.(newSettings);
    },
    [updateState, onSettingsChange]
  );

  // Update a single parameter
  const updateParameter = useCallback(
    <K extends keyof UserAudioSettings>(
      param: K,
      value: UserAudioSettings[K],
      label?: string
    ) => {
      const newSettings = { ...settings, [param]: value };
      updateSettings(newSettings, label || `Changed ${param}`);
    },
    [settings, updateSettings]
  );

  // Undo
  const undo = useCallback(() => {
    const prevSettings = historyRef.current.undo();
    if (prevSettings) {
      setSettings(prevSettings);
      updateState();
      onSettingsChange?.(prevSettings);
    }
    return prevSettings;
  }, [updateState, onSettingsChange]);

  // Redo
  const redo = useCallback(() => {
    const nextSettings = historyRef.current.redo();
    if (nextSettings) {
      setSettings(nextSettings);
      updateState();
      onSettingsChange?.(nextSettings);
    }
    return nextSettings;
  }, [updateState, onSettingsChange]);

  // Reset
  const reset = useCallback(() => {
    const defaultSettings = historyRef.current.reset();
    setSettings(defaultSettings);
    updateState();
    onSettingsChange?.(defaultSettings);
    return defaultSettings;
  }, [updateState, onSettingsChange]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd + Z (undo) or Ctrl/Cmd + Shift + Z (redo)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      // Also support Ctrl/Cmd + Y for redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    settings,
    updateSettings,
    updateParameter,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
    historyLength,
    currentIndex,
    history: historyRef.current,
  };
}

export default useSettingsHistory;
