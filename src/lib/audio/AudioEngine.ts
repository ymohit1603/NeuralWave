/**
 * Audio Engine
 * Main real-time audio processing engine using Web Audio API
 * Manages all audio nodes and provides a unified interface for control
 */

import {
  UserAudioSettings,
  AudioEngineState,
  AudioEngineEvents,
  EffectMode,
  MovementPattern,
  BilateralType,
  LeadEar,
  mapParameterValue,
  PARAMETER_MAPPINGS,
} from './types';
import { getDefaultSettings, getInitialSettings } from './presets';
import { ProximityEffect } from './nodes/ProximityEffect';
import { PresenceBoost } from './nodes/PresenceBoost';
import { BreathEnhancement } from './nodes/BreathEnhancement';
import { SpatialProcessor } from './nodes/SpatialProcessor';
import { BilateralPanner } from './nodes/BilateralPanner';
import { HaasEffect } from './nodes/HaasEffect';
import { SpatialReverb } from './nodes/SpatialReverb';
import { TrajectoryGenerator } from './TrajectoryGenerator';
import { SettingsHistory } from './SettingsHistory';

export class AudioEngine {
  // Audio context
  private context: AudioContext | null = null;

  // Source and buffer
  private sourceNode: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;

  // Processing nodes
  private proximityEffect: ProximityEffect | null = null;
  private presenceBoost: PresenceBoost | null = null;
  private breathEnhancement: BreathEnhancement | null = null;
  private spatialProcessor: SpatialProcessor | null = null;
  private bilateralPanner: BilateralPanner | null = null;
  private haasEffect: HaasEffect | null = null;
  private spatialReverb: SpatialReverb | null = null;

  // Master gain
  private masterGain: GainNode | null = null;

  // Trajectory generator for 8D movement
  private trajectoryGenerator: TrajectoryGenerator;

  // Settings and history
  private settings: UserAudioSettings;
  private history: SettingsHistory;

  // State
  private state: AudioEngineState = 'idle';
  private startTime: number = 0;
  private pauseTime: number = 0;
  private duration: number = 0;

  // Events
  private events: AudioEngineEvents = {};

  // Time update interval
  private timeUpdateInterval: number | null = null;

  constructor(events?: AudioEngineEvents) {
    this.settings = getInitialSettings();
    this.history = new SettingsHistory(this.settings);
    this.trajectoryGenerator = new TrajectoryGenerator();

    if (events) {
      this.events = events;
    }

    // Set up trajectory callback
    this.trajectoryGenerator.onUpdate((position, _x, _y) => {
      if (this.spatialProcessor && this.settings.mode === '8d-spatial') {
        const intensity = this.settings.effectIntensity;
        this.spatialProcessor.setPosition(position, intensity, 0.016); // ~60fps
      }
    });
  }

  /**
   * Initialize the audio context and nodes
   */
  async initialize(): Promise<void> {
    if (this.context) return;

    try {
      // Create audio context with fallback for Safari
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.context = new AudioContextClass();

      // Resume context if suspended (required for user gesture)
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      // Create all processing nodes
      this.createNodes();

      // Apply initial settings
      this.applySettings(this.settings);

      this.setState('ready');
    } catch (error) {
      this.setState('error');
      this.events.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Create all audio processing nodes
   */
  private createNodes(): void {
    if (!this.context) return;

    // Create EQ nodes
    this.proximityEffect = new ProximityEffect(this.context);
    this.presenceBoost = new PresenceBoost(this.context);
    this.breathEnhancement = new BreathEnhancement(this.context);

    // Create spatial nodes
    this.spatialProcessor = new SpatialProcessor(this.context);
    this.bilateralPanner = new BilateralPanner(this.context);
    this.haasEffect = new HaasEffect(this.context);
    this.spatialReverb = new SpatialReverb(this.context);

    // Create master gain
    this.masterGain = this.context.createGain();

    // Build the audio graph based on current mode
    this.buildGraph();
  }

  /**
   * Build the audio graph based on current effect mode
   */
  private buildGraph(): void {
    if (!this.context || !this.masterGain) return;

    // Disconnect all nodes first
    this.disconnectAll();

    // EQ chain is always: Proximity -> Presence -> Breath
    this.proximityEffect?.connect(this.presenceBoost!.input);
    this.presenceBoost?.connect(this.breathEnhancement!.input);

    // Connect based on mode
    switch (this.settings.mode) {
      case '8d-spatial':
        // EQ -> Spatial -> Reverb -> Master
        this.breathEnhancement?.connect(this.spatialProcessor!.input);
        this.spatialProcessor?.connect(this.spatialReverb!.input);
        this.spatialReverb?.connect(this.masterGain);
        break;

      case 'bilateral':
      case 'emdr':
        // EQ -> Bilateral -> Reverb -> Master
        this.breathEnhancement?.connect(this.bilateralPanner!.input);
        this.bilateralPanner?.connect(this.spatialReverb!.input);
        this.spatialReverb?.connect(this.masterGain);
        break;

      case 'haas':
        // EQ -> Haas -> Reverb -> Master
        this.breathEnhancement?.connect(this.haasEffect!.input);
        this.haasEffect?.connect(this.spatialReverb!.input);
        this.spatialReverb?.connect(this.masterGain);
        break;
    }

    // Master -> Destination
    this.masterGain.connect(this.context.destination);
  }

  /**
   * Disconnect all nodes
   */
  private disconnectAll(): void {
    this.proximityEffect?.disconnect();
    this.presenceBoost?.disconnect();
    this.breathEnhancement?.disconnect();
    this.spatialProcessor?.disconnect();
    this.bilateralPanner?.disconnect();
    this.haasEffect?.disconnect();
    this.spatialReverb?.disconnect();
    this.masterGain?.disconnect();
  }

  /**
   * Load an audio buffer
   */
  async loadAudio(buffer: AudioBuffer): Promise<void> {
    this.audioBuffer = buffer;
    this.duration = buffer.duration;

    if (!this.context) {
      await this.initialize();
    }

    this.setState('ready');
  }

  /**
   * Load audio from a file
   */
  async loadFile(file: File): Promise<void> {
    this.setState('loading');

    try {
      if (!this.context) {
        await this.initialize();
      }

      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
      await this.loadAudio(audioBuffer);
    } catch (error) {
      this.setState('error');
      this.events.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Load audio from a URL
   */
  async loadUrl(url: string): Promise<void> {
    this.setState('loading');

    try {
      if (!this.context) {
        await this.initialize();
      }

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
      await this.loadAudio(audioBuffer);
    } catch (error) {
      this.setState('error');
      this.events.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Start playback
   */
  play(startOffset: number = 0): void {
    if (!this.context || !this.audioBuffer || !this.proximityEffect) {
      console.error('Audio engine not initialized or no audio loaded');
      return;
    }

    // Stop any existing playback
    this.stopSource();

    // Create new source node
    this.sourceNode = this.context.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;

    // Connect source to processing chain
    this.sourceNode.connect(this.proximityEffect.input);

    // Handle playback end
    this.sourceNode.onended = () => {
      if (this.state === 'playing') {
        this.setState('ready');
        this.stopTimeUpdate();
        this.trajectoryGenerator.stop();
        this.bilateralPanner?.stop();
      }
    };

    // Calculate start position
    const offset = this.pauseTime > 0 ? this.pauseTime : startOffset;
    this.startTime = this.context.currentTime - offset;
    this.pauseTime = 0;

    // Start playback
    this.sourceNode.start(0, offset);
    this.setState('playing');

    // Start trajectory generator for 8D mode
    if (this.settings.mode === '8d-spatial') {
      this.trajectoryGenerator.start();
    }

    // Start bilateral panner for bilateral/EMDR modes
    if (this.settings.mode === 'bilateral' || this.settings.mode === 'emdr') {
      this.bilateralPanner?.start();
    }

    // Start time updates
    this.startTimeUpdate();
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.state !== 'playing' || !this.context) return;

    this.pauseTime = this.context.currentTime - this.startTime;
    this.stopSource();
    this.setState('paused');
    this.stopTimeUpdate();
    this.trajectoryGenerator.stop();
    this.bilateralPanner?.stop();
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.stopSource();
    this.pauseTime = 0;
    this.setState('ready');
    this.stopTimeUpdate();
    this.trajectoryGenerator.stop();
    this.bilateralPanner?.stop();
  }

  /**
   * Seek to a specific time (optimized for smooth scrubbing)
   */
  seek(time: number): void {
    const clampedTime = Math.max(0, Math.min(time, this.duration));
    const wasPlaying = this.state === 'playing';

    // Stop current source
    this.stopSource();

    // Update pause time
    this.pauseTime = clampedTime;

    // Immediately restart if was playing
    if (wasPlaying) {
      // Create new source and start from new position
      if (this.context && this.audioBuffer && this.proximityEffect) {
        this.sourceNode = this.context.createBufferSource();
        this.sourceNode.buffer = this.audioBuffer;
        this.sourceNode.connect(this.proximityEffect.input);

        this.sourceNode.onended = () => {
          if (this.state === 'playing') {
            this.setState('ready');
            this.stopTimeUpdate();
            this.trajectoryGenerator.stop();
            this.bilateralPanner?.stop();
          }
        };

        this.startTime = this.context.currentTime - clampedTime;
        this.pauseTime = 0;
        this.sourceNode.start(0, clampedTime);
      }
    }
  }

  /**
   * Stop the source node
   */
  private stopSource(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
  }

  /**
   * Start time update using requestAnimationFrame for smoother updates
   */
  private startTimeUpdate(): void {
    this.stopTimeUpdate();

    const updateTime = () => {
      if (this.context && this.state === 'playing') {
        const currentTime = this.context.currentTime - this.startTime;
        this.events.onTimeUpdate?.(currentTime, this.duration);
        this.timeUpdateInterval = window.requestAnimationFrame(updateTime);
      }
    };

    this.timeUpdateInterval = window.requestAnimationFrame(updateTime);
  }

  /**
   * Stop time update
   */
  private stopTimeUpdate(): void {
    if (this.timeUpdateInterval !== null) {
      window.cancelAnimationFrame(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  /**
   * Set the engine state
   */
  private setState(state: AudioEngineState): void {
    this.state = state;
    this.events.onStateChange?.(state);
  }

  /**
   * Get current state
   */
  getState(): AudioEngineState {
    return this.state;
  }

  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    if (!this.context) return 0;

    if (this.state === 'playing') {
      return this.context.currentTime - this.startTime;
    }

    return this.pauseTime;
  }

  /**
   * Get audio duration
   */
  getDuration(): number {
    return this.duration;
  }

  /**
   * Apply all settings
   */
  applySettings(settings: UserAudioSettings, saveToHistory: boolean = false): void {
    this.settings = { ...settings };

    // Apply EQ settings
    this.proximityEffect?.setAmount(settings.bassWarmth);
    this.presenceBoost?.setAmount(settings.clarity);
    this.breathEnhancement?.setAmount(settings.airBrightness);

    // Apply spatial settings
    this.trajectoryGenerator.setSpeed(settings.travelSpeed);
    this.trajectoryGenerator.setWidth(settings.travelWidth);
    this.trajectoryGenerator.setPattern(settings.movementPattern);

    // Apply reverb
    this.spatialReverb?.setMix(settings.spatialDepth);

    // Apply bilateral settings
    this.bilateralPanner?.setType(settings.bilateralType);
    this.bilateralPanner?.setFrequency(settings.bilateralFrequency);
    this.bilateralPanner?.setWidth(settings.travelWidth);

    // Apply Haas settings
    this.haasEffect?.setDelay(settings.haasDelay);
    this.haasEffect?.setLeadEar(settings.leadEar);

    // Apply master volume
    if (this.masterGain && this.context) {
      const volume = mapParameterValue(settings.masterVolume, PARAMETER_MAPPINGS.masterVolume);
      this.masterGain.gain.setTargetAtTime(volume, this.context.currentTime, 0.05);
    }

    // Save to history if requested
    if (saveToHistory) {
      this.history.push(settings);
    }

    this.events.onSettingsChange?.(settings);
  }

  /**
   * Update a single parameter
   */
  updateParameter<K extends keyof UserAudioSettings>(
    param: K,
    value: UserAudioSettings[K],
    saveToHistory: boolean = true
  ): void {
    const newSettings = { ...this.settings, [param]: value };

    // Apply the specific parameter change
    switch (param) {
      case 'mode':
        this.setMode(value as EffectMode);
        break;
      case 'bassWarmth':
        this.proximityEffect?.setAmount(value as number);
        break;
      case 'clarity':
        this.presenceBoost?.setAmount(value as number);
        break;
      case 'airBrightness':
        this.breathEnhancement?.setAmount(value as number);
        break;
      case 'travelSpeed':
        this.trajectoryGenerator.setSpeed(value as number);
        break;
      case 'travelWidth':
        this.trajectoryGenerator.setWidth(value as number);
        this.bilateralPanner?.setWidth(value as number);
        break;
      case 'effectIntensity':
        // Intensity is applied in trajectory callback
        break;
      case 'spatialDepth':
        this.spatialReverb?.setMix(value as number);
        break;
      case 'movementPattern':
        this.trajectoryGenerator.setPattern(value as MovementPattern);
        break;
      case 'bilateralType':
        this.bilateralPanner?.setType(value as BilateralType);
        break;
      case 'bilateralFrequency':
        this.bilateralPanner?.setFrequency(value as number);
        break;
      case 'haasDelay':
        this.haasEffect?.setDelay(value as number);
        break;
      case 'leadEar':
        this.haasEffect?.setLeadEar(value as LeadEar);
        break;
      case 'masterVolume':
        if (this.masterGain && this.context) {
          const volume = mapParameterValue(value as number, PARAMETER_MAPPINGS.masterVolume);
          this.masterGain.gain.setTargetAtTime(volume, this.context.currentTime, 0.05);
        }
        break;
    }

    this.settings = newSettings;

    if (saveToHistory) {
      this.history.push(newSettings);
    }

    this.events.onSettingsChange?.(newSettings);
  }

  /**
   * Set the effect mode
   */
  setMode(mode: EffectMode): void {
    if (mode === this.settings.mode) return;

    const wasPlaying = this.state === 'playing';
    const currentTime = this.getCurrentTime();

    // Stop current playback
    if (wasPlaying) {
      this.pause();
    }

    // Stop current mode-specific processing
    this.trajectoryGenerator.stop();
    this.bilateralPanner?.stop();

    // Get default settings for new mode, preserving some user settings
    const newModeDefaults = getDefaultSettings(mode);
    this.settings = {
      ...newModeDefaults,
      // Preserve EQ settings
      bassWarmth: this.settings.bassWarmth,
      clarity: this.settings.clarity,
      airBrightness: this.settings.airBrightness,
      masterVolume: this.settings.masterVolume,
    };

    // Rebuild the audio graph
    this.buildGraph();

    // Apply new settings
    this.applySettings(this.settings, true);

    // Update history default settings
    this.history.setDefaultSettings(newModeDefaults);

    // Resume playback if was playing
    if (wasPlaying) {
      this.pauseTime = currentTime;
      this.play();
    }
  }

  /**
   * Get current settings
   */
  getSettings(): UserAudioSettings {
    return { ...this.settings };
  }

  /**
   * Undo last settings change
   */
  undo(): UserAudioSettings | null {
    const settings = this.history.undo();
    if (settings) {
      this.applySettings(settings, false);
    }
    return settings;
  }

  /**
   * Redo settings change
   */
  redo(): UserAudioSettings | null {
    const settings = this.history.redo();
    if (settings) {
      this.applySettings(settings, false);
    }
    return settings;
  }

  /**
   * Reset to default settings for current mode
   */
  reset(): UserAudioSettings {
    const settings = this.history.reset();
    this.applySettings(settings, false);
    return settings;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.history.canUndo();
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.history.canRedo();
  }

  /**
   * Get the settings history
   */
  getHistory(): SettingsHistory {
    return this.history;
  }

  /**
   * Set event handlers
   */
  setEvents(events: AudioEngineEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Get the audio context
   */
  getContext(): AudioContext | null {
    return this.context;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.stop();
    this.stopTimeUpdate();

    // Dispose all nodes
    this.proximityEffect?.dispose();
    this.presenceBoost?.dispose();
    this.breathEnhancement?.dispose();
    this.spatialProcessor?.dispose();
    this.bilateralPanner?.dispose();
    this.haasEffect?.dispose();
    this.spatialReverb?.dispose();
    this.trajectoryGenerator.dispose();

    // Close audio context
    if (this.context) {
      this.context.close();
      this.context = null;
    }

    this.audioBuffer = null;
    this.setState('idle');
  }
}
