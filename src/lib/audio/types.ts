/**
 * Audio Processing Types & Interfaces
 * Real-time 8D audio processing with Web Audio API
 */

// Effect modes available in the application
export type EffectMode = '8d-spatial' | 'bilateral' | 'emdr' | 'haas';

// Movement patterns for spatial audio
export type MovementPattern = 'leftright' | 'circular' | 'figure8';

// Bilateral panning types
export type BilateralType = 'smooth' | 'hard-cut';

// Lead ear for Haas effect
export type LeadEar = 'left' | 'right';

/**
 * User-adjustable audio settings
 * All values are on a 0-100 scale unless otherwise noted
 */
export interface UserAudioSettings {
  // Current effect mode
  mode: EffectMode;

  // Sound Quality (0-100 scale)
  bassWarmth: number;        // Proximity effect - low shelf filter
  clarity: number;           // Presence boost - peaking filter 2-5kHz
  airBrightness: number;     // Breath enhancement - high shelf filter

  // Spatial Controls (0-100 scale)
  travelSpeed: number;       // Movement Hz mapped from 0.02-0.2 Hz
  effectIntensity: number;   // Pan strength / effect amount
  travelWidth: number;       // Pan range / stereo width
  spatialDepth: number;      // Reverb / room amount
  movementPattern: MovementPattern;

  // Bilateral Controls
  bilateralType: BilateralType;
  bilateralFrequency: number; // Hz for bilateral switching (0.5-2 Hz)

  // Haas Effect Controls
  haasDelay: number;         // Delay amount (maps to 5-25ms)
  leadEar: LeadEar;          // Which ear leads

  // Master Controls
  masterVolume: number;      // 0-100
}

/**
 * Settings snapshot for undo/reset functionality
 */
export interface SettingsSnapshot {
  timestamp: number;
  settings: UserAudioSettings;
  label?: string; // Optional label for the change
}

/**
 * Audio engine state
 */
export type AudioEngineState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

/**
 * Audio engine events
 */
export interface AudioEngineEvents {
  onStateChange?: (state: AudioEngineState) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onError?: (error: Error) => void;
  onSettingsChange?: (settings: UserAudioSettings) => void;
}

/**
 * Parameter mapping configuration
 * Maps 0-100 slider values to actual audio parameter ranges
 */
export interface ParameterMapping {
  min: number;
  max: number;
  unit: string;
  curve?: 'linear' | 'exponential' | 'logarithmic';
}

/**
 * Parameter mappings for all audio controls
 */
export const PARAMETER_MAPPINGS: Record<string, ParameterMapping> = {
  // Sound Quality
  bassWarmth: { min: -6, max: 12, unit: 'dB', curve: 'linear' },
  clarity: { min: -6, max: 12, unit: 'dB', curve: 'linear' },
  airBrightness: { min: -6, max: 12, unit: 'dB', curve: 'linear' },

  // Spatial
  travelSpeed: { min: 0.02, max: 0.2, unit: 'Hz', curve: 'exponential' },
  effectIntensity: { min: 0, max: 1, unit: '', curve: 'linear' },
  travelWidth: { min: 0, max: 1, unit: '', curve: 'linear' },
  spatialDepth: { min: 0, max: 1, unit: '', curve: 'linear' },

  // Bilateral
  bilateralFrequency: { min: 0.5, max: 2, unit: 'Hz', curve: 'linear' },

  // Haas
  haasDelay: { min: 5, max: 60, unit: 'ms', curve: 'linear' },

  // Master
  masterVolume: { min: 0, max: 1, unit: '', curve: 'linear' },
};

/**
 * Map a 0-100 slider value to actual parameter value
 */
export function mapParameterValue(
  sliderValue: number,
  mapping: ParameterMapping
): number {
  const normalized = sliderValue / 100;

  if (mapping.curve === 'exponential') {
    // Exponential curve for frequency-like parameters
    return mapping.min * Math.pow(mapping.max / mapping.min, normalized);
  } else if (mapping.curve === 'logarithmic') {
    // Logarithmic curve
    const minLog = Math.log(mapping.min || 0.001);
    const maxLog = Math.log(mapping.max);
    return Math.exp(minLog + normalized * (maxLog - minLog));
  }

  // Linear mapping (default)
  return mapping.min + normalized * (mapping.max - mapping.min);
}

/**
 * Map actual parameter value back to 0-100 slider value
 */
export function unmapParameterValue(
  actualValue: number,
  mapping: ParameterMapping
): number {
  if (mapping.curve === 'exponential') {
    return Math.log(actualValue / mapping.min) / Math.log(mapping.max / mapping.min) * 100;
  } else if (mapping.curve === 'logarithmic') {
    const minLog = Math.log(mapping.min || 0.001);
    const maxLog = Math.log(mapping.max);
    return (Math.log(actualValue) - minLog) / (maxLog - minLog) * 100;
  }

  return ((actualValue - mapping.min) / (mapping.max - mapping.min)) * 100;
}

/**
 * Audio node interface for custom processing nodes
 */
export interface AudioProcessingNode {
  input: AudioNode;
  output: AudioNode;
  connect(destination: AudioNode | AudioParam): void;
  disconnect(): void;
  dispose(): void;
}

/**
 * Spatial position for 3D audio
 */
export interface SpatialPosition {
  x: number; // -1 to 1 (left to right)
  y: number; // -1 to 1 (back to front)
  z: number; // -1 to 1 (down to up)
}

/**
 * ITD/ILD parameters for spatial processing
 */
export interface SpatialParameters {
  itdMs: number;      // Interaural Time Difference in ms
  ildDb: number;      // Interaural Level Difference in dB
  position: number;   // -1 to 1 pan position
}
