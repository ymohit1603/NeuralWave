/**
 * Settings History
 * Manages undo/reset functionality for audio settings
 */

import { UserAudioSettings, SettingsSnapshot } from './types';
import { getDefaultSettings } from './presets';

export class SettingsHistory {
  private history: SettingsSnapshot[] = [];
  private currentIndex: number = -1;
  private maxHistory: number;
  private defaultSettings: UserAudioSettings;

  constructor(initialSettings: UserAudioSettings, maxHistory: number = 50) {
    this.maxHistory = maxHistory;
    this.defaultSettings = { ...initialSettings };

    // Push initial state
    this.push(initialSettings, 'Initial settings');
  }

  /**
   * Push a new settings snapshot to history
   * @param settings - The settings to save
   * @param label - Optional label for the change
   */
  push(settings: UserAudioSettings, label?: string): void {
    // Remove any future history if we're not at the end
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Create snapshot
    const snapshot: SettingsSnapshot = {
      timestamp: Date.now(),
      settings: { ...settings },
      label,
    };

    // Add to history
    this.history.push(snapshot);
    this.currentIndex = this.history.length - 1;

    // Trim history if it exceeds max
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(this.history.length - this.maxHistory);
      this.currentIndex = this.history.length - 1;
    }
  }

  /**
   * Undo to the previous settings state
   * @returns The previous settings, or null if at the beginning
   */
  undo(): UserAudioSettings | null {
    if (!this.canUndo()) {
      return null;
    }

    this.currentIndex--;
    return { ...this.history[this.currentIndex].settings };
  }

  /**
   * Redo to the next settings state
   * @returns The next settings, or null if at the end
   */
  redo(): UserAudioSettings | null {
    if (!this.canRedo()) {
      return null;
    }

    this.currentIndex++;
    return { ...this.history[this.currentIndex].settings };
  }

  /**
   * Reset to the default settings for the current mode
   * @returns The default settings
   */
  reset(): UserAudioSettings {
    const currentSettings = this.getCurrent();
    const defaultForMode = getDefaultSettings(currentSettings?.mode || '8d-spatial');

    this.push(defaultForMode, 'Reset to defaults');
    return { ...defaultForMode };
  }

  /**
   * Reset to the initial settings (when the session started)
   * @returns The initial settings
   */
  resetToInitial(): UserAudioSettings {
    this.push(this.defaultSettings, 'Reset to initial');
    return { ...this.defaultSettings };
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get the current settings
   */
  getCurrent(): UserAudioSettings | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }
    return { ...this.history[this.currentIndex].settings };
  }

  /**
   * Get the current snapshot with metadata
   */
  getCurrentSnapshot(): SettingsSnapshot | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }
    return { ...this.history[this.currentIndex] };
  }

  /**
   * Get the history length
   */
  getHistoryLength(): number {
    return this.history.length;
  }

  /**
   * Get the current index in history
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * Get all history snapshots (for debugging or display)
   */
  getHistory(): SettingsSnapshot[] {
    return this.history.map(s => ({ ...s, settings: { ...s.settings } }));
  }

  /**
   * Clear all history and start fresh
   */
  clear(settings: UserAudioSettings): void {
    this.history = [];
    this.currentIndex = -1;
    this.push(settings, 'History cleared');
  }

  /**
   * Update the default settings (e.g., when mode changes)
   */
  setDefaultSettings(settings: UserAudioSettings): void {
    this.defaultSettings = { ...settings };
  }
}
