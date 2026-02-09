/**
 * Default Presets for Audio Effect Modes
 */

import { UserAudioSettings, EffectMode } from './types';

/**
 * Default settings for each effect mode
 */
export const MODE_PRESETS: Record<EffectMode, UserAudioSettings> = {
  '8d-spatial': {
    mode: '8d-spatial',
    // Sound Quality
    bassWarmth: 40,
    clarity: 50,
    airBrightness: 30,
    // Spatial - MAX VALUES AS REQUESTED
    travelSpeed: 100,          // MAX: ~0.2 Hz
    effectIntensity: 100,      // MAX: Full intensity
    travelWidth: 100,          // MAX: Full width
    spatialDepth: 40,
    movementPattern: 'leftright',
    // Bilateral (not used in this mode but included for completeness)
    bilateralType: 'smooth',
    bilateralFrequency: 50,    // ~1 Hz
    // Haas (not used in this mode)
    haasDelay: 50,             // ~15ms
    leadEar: 'left',
    // Master
    masterVolume: 80,
  },

  'bilateral': {
    mode: 'bilateral',
    // Sound Quality - slightly reduced for focus
    bassWarmth: 30,
    clarity: 40,
    airBrightness: 20,
    // Spatial
    travelSpeed: 50,           // ~1.0 Hz for bilateral
    effectIntensity: 90,
    travelWidth: 100,
    spatialDepth: 20,
    movementPattern: 'leftright',
    // Bilateral
    bilateralType: 'smooth',
    bilateralFrequency: 50,    // ~1 Hz
    // Haas
    haasDelay: 50,
    leadEar: 'left',
    // Master
    masterVolume: 80,
  },

  'emdr': {
    mode: 'emdr',
    // Sound Quality - minimal processing for therapy
    bassWarmth: 20,
    clarity: 30,
    airBrightness: 10,
    // Spatial
    travelSpeed: 50,
    effectIntensity: 100,      // Full intensity for EMDR
    travelWidth: 100,          // Full width
    spatialDepth: 30,
    movementPattern: 'leftright',
    // Bilateral - hard-cut for EMDR therapy
    bilateralType: 'hard-cut',
    bilateralFrequency: 50,    // ~1 Hz
    // Haas
    haasDelay: 50,
    leadEar: 'left',
    // Master
    masterVolume: 80,
  },

  'haas': {
    mode: 'haas',
    // Sound Quality
    bassWarmth: 40,
    clarity: 50,
    airBrightness: 30,
    // Spatial - minimal movement for Haas
    travelSpeed: 0,
    effectIntensity: 50,
    travelWidth: 50,
    spatialDepth: 30,
    movementPattern: 'leftright',
    // Bilateral
    bilateralType: 'smooth',
    bilateralFrequency: 50,
    // Haas - main effect
    haasDelay: 45,             // ~14ms default
    leadEar: 'left',
    // Master
    masterVolume: 80,
  },
};

/**
 * Get default settings for a mode
 */
export function getDefaultSettings(mode: EffectMode): UserAudioSettings {
  return { ...MODE_PRESETS[mode] };
}

/**
 * Get the initial default settings (8D Spatial)
 */
export function getInitialSettings(): UserAudioSettings {
  return getDefaultSettings('8d-spatial');
}

/**
 * User-friendly labels for effect modes
 */
export const MODE_LABELS: Record<EffectMode, { name: string; description: string }> = {
  '8d-spatial': {
    name: '8D Spatial',
    description: 'Immersive 360° audio movement around your head',
  },
  'bilateral': {
    name: 'Bilateral',
    description: 'Smooth left-right stimulation for focus and relaxation',
  },
  'emdr': {
    name: 'EMDR',
    description: 'Therapeutic hard-cut bilateral stimulation',
  },
  'haas': {
    name: 'Stereo Width',
    description: 'Enhanced stereo image using the Haas effect',
  },
};

/**
 * User-friendly labels for parameters
 */
export const PARAMETER_LABELS: Record<string, { label: string; description: string }> = {
  // Sound Quality
  bassWarmth: {
    label: 'Bass Warmth',
    description: 'Add richness to low frequencies',
  },
  clarity: {
    label: 'Clarity',
    description: 'Enhance vocal and instrument detail',
  },
  airBrightness: {
    label: 'Air & Brightness',
    description: 'Add sparkle and openness',
  },

  // Spatial
  travelSpeed: {
    label: 'Travel Speed',
    description: 'How fast the sound moves around you',
  },
  effectIntensity: {
    label: 'Effect Intensity',
    description: 'How strong the spatial effect feels',
  },
  travelWidth: {
    label: 'Travel Distance',
    description: 'How far the sound travels left to right',
  },
  spatialDepth: {
    label: 'Spatial Depth',
    description: 'Add 3D room feeling',
  },
  movementPattern: {
    label: 'Movement Pattern',
    description: 'The path the sound takes around you',
  },

  // Bilateral
  bilateralType: {
    label: 'Transition Type',
    description: 'Smooth fade or instant switch between ears',
  },
  bilateralFrequency: {
    label: 'Switch Speed',
    description: 'How fast the sound alternates between ears',
  },

  // Haas
  haasDelay: {
    label: 'Stereo Width',
    description: 'Widen the stereo image',
  },
  leadEar: {
    label: 'Lead Ear',
    description: 'Which ear receives the sound first',
  },

  // Master
  masterVolume: {
    label: 'Volume',
    description: 'Master output volume',
  },
};

/**
 * Movement pattern labels
 */
export const MOVEMENT_PATTERN_LABELS = {
  leftright: { label: 'Left-Right', description: 'Simple side-to-side movement' },
  circular: { label: 'Circular', description: '360° rotation around your head' },
  figure8: { label: 'Figure 8', description: 'Smooth figure-8 pattern' },
};
