/**
 * Audio Processing Library
 * Real-time 8D audio processing with Web Audio API
 */

// Main engine
export { AudioEngine } from './AudioEngine';

// Types
export type {
  EffectMode,
  MovementPattern,
  BilateralType,
  LeadEar,
  UserAudioSettings,
  SettingsSnapshot,
  AudioEngineState,
  AudioEngineEvents,
  ParameterMapping,
  AudioProcessingNode,
  SpatialPosition,
  SpatialParameters,
} from './types';

export {
  PARAMETER_MAPPINGS,
  mapParameterValue,
  unmapParameterValue,
} from './types';

// Presets
export {
  MODE_PRESETS,
  getDefaultSettings,
  getInitialSettings,
  MODE_LABELS,
  PARAMETER_LABELS,
  MOVEMENT_PATTERN_LABELS,
} from './presets';

// Settings History
export { SettingsHistory } from './SettingsHistory';

// Trajectory Generator
export { TrajectoryGenerator } from './TrajectoryGenerator';
export type { TrajectoryCallback } from './TrajectoryGenerator';

// Audio Nodes
export { ProximityEffect } from './nodes/ProximityEffect';
export { PresenceBoost } from './nodes/PresenceBoost';
export { BreathEnhancement } from './nodes/BreathEnhancement';
export { SpatialProcessor } from './nodes/SpatialProcessor';
export { BilateralPanner } from './nodes/BilateralPanner';
export { HaasEffect } from './nodes/HaasEffect';
export { SpatialReverb } from './nodes/SpatialReverb';
