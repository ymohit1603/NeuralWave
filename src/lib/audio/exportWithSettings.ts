import {
  UserAudioSettings,
  mapParameterValue,
  PARAMETER_MAPPINGS,
} from '@/lib/audio';

const MAX_ITD_MS = 0.7;
const MAX_ILD_LOW_DB = 4;
const MAX_ILD_HIGH_DB = 14;
const CROSSOVER_FREQ = 1500;
const PINNA_NOTCH_FREQ = 9000;

const REFLECTION_DELAYS_MS = [11, 17, 23, 31, 37, 43];
const REFLECTION_GAINS = [0.8, 0.6, 0.5, 0.4, 0.3, 0.25];

function applyEqChain(
  context: OfflineAudioContext,
  input: AudioNode,
  settings: UserAudioSettings
): AudioNode {
  const lowShelf = context.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 250;
  lowShelf.gain.value = mapParameterValue(settings.bassWarmth, PARAMETER_MAPPINGS.bassWarmth);

  const presence = context.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3000;
  presence.Q.value = 1.0;
  presence.gain.value = mapParameterValue(settings.clarity, PARAMETER_MAPPINGS.clarity);

  const highShelf = context.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 8000;
  highShelf.gain.value = mapParameterValue(settings.airBrightness, PARAMETER_MAPPINGS.airBrightness);

  input.connect(lowShelf);
  lowShelf.connect(presence);
  presence.connect(highShelf);
  return highShelf;
}

function applySpatialReverb(
  context: OfflineAudioContext,
  input: AudioNode,
  settings: UserAudioSettings
): AudioNode {
  const wetAmount = settings.spatialDepth / 100;
  if (wetAmount <= 0.0001) {
    return input;
  }

  const dryGain = context.createGain();
  const wetGain = context.createGain();
  dryGain.gain.value = 1 - (wetAmount * 0.5);
  wetGain.gain.value = wetAmount;

  const preDelay = context.createDelay(0.1);
  preDelay.delayTime.value = 0.01;

  const diffusionFilter = context.createBiquadFilter();
  diffusionFilter.type = 'lowpass';
  diffusionFilter.frequency.value = 8000;
  diffusionFilter.Q.value = 0.5;

  input.connect(dryGain);

  input.connect(preDelay);
  preDelay.connect(diffusionFilter);

  for (let i = 0; i < REFLECTION_DELAYS_MS.length; i++) {
    const delay = context.createDelay(0.1);
    delay.delayTime.value = REFLECTION_DELAYS_MS[i] / 1000;

    const gain = context.createGain();
    gain.gain.value = REFLECTION_GAINS[i];

    diffusionFilter.connect(delay);
    delay.connect(gain);
    gain.connect(wetGain);
  }

  const output = context.createGain();
  dryGain.connect(output);
  wetGain.connect(output);
  return output;
}

function getPositionForPattern(settings: UserAudioSettings, phase: number): number {
  switch (settings.movementPattern) {
    case 'circular':
      return Math.sin(phase);
    case 'figure8':
      return Math.sin(phase);
    case 'leftright':
    default:
      return Math.sin(phase);
  }
}

function applySpatialMode(
  context: OfflineAudioContext,
  input: AudioNode,
  settings: UserAudioSettings,
  duration: number
): AudioNode {
  const speedHz = mapParameterValue(settings.travelSpeed, PARAMETER_MAPPINGS.travelSpeed);
  const width = settings.travelWidth / 100;
  const effectAmount = settings.effectIntensity / 100;

  const splitter = context.createChannelSplitter(2);
  const merger = context.createChannelMerger(2);

  const leftDelay = context.createDelay(0.001);
  const rightDelay = context.createDelay(0.001);

  const leftLowpass = context.createBiquadFilter();
  const leftHighpass = context.createBiquadFilter();
  const rightLowpass = context.createBiquadFilter();
  const rightHighpass = context.createBiquadFilter();
  
  [leftLowpass, rightLowpass].forEach(filter => {
    filter.type = 'lowpass';
    filter.frequency.value = CROSSOVER_FREQ;
    filter.Q.value = 0.707;
  });
  
  [leftHighpass, rightHighpass].forEach(filter => {
    filter.type = 'highpass';
    filter.frequency.value = CROSSOVER_FREQ;
    filter.Q.value = 0.707;
  });

  const leftLowGain = context.createGain();
  const leftHighGain = context.createGain();
  const rightLowGain = context.createGain();
  const rightHighGain = context.createGain();
  const leftGain = context.createGain();
  const rightGain = context.createGain();

  const leftPinnaNotch = context.createBiquadFilter();
  const rightPinnaNotch = context.createBiquadFilter();
  
  [leftPinnaNotch, rightPinnaNotch].forEach(filter => {
    filter.type = 'notch';
    filter.frequency.value = PINNA_NOTCH_FREQ;
    filter.Q.value = 5;
  });

  input.connect(splitter);

  splitter.connect(leftDelay, 0);
  leftDelay.connect(leftLowpass);
  leftDelay.connect(leftHighpass);
  leftLowpass.connect(leftLowGain);
  leftHighpass.connect(leftHighGain);
  leftLowGain.connect(leftGain);
  leftHighGain.connect(leftGain);
  leftGain.connect(leftPinnaNotch);
  leftPinnaNotch.connect(merger, 0, 0);

  splitter.connect(rightDelay, 1);
  rightDelay.connect(rightLowpass);
  rightDelay.connect(rightHighpass);
  rightLowpass.connect(rightLowGain);
  rightHighpass.connect(rightHighGain);
  rightLowGain.connect(rightGain);
  rightHighGain.connect(rightGain);
  rightGain.connect(rightPinnaNotch);
  rightPinnaNotch.connect(merger, 0, 1);

  const step = 1 / 60; // 60fps automation

  for (let t = 0; t <= duration; t += step) {
    const phase = t * speedHz * Math.PI * 2;
    const position = getPositionForPattern(settings, phase) * width;

    const itdMs = Math.abs(position) * MAX_ITD_MS * effectAmount;
    const itdSeconds = itdMs / 1000;

    if (position > 0) {
      leftDelay.delayTime.setValueAtTime(itdSeconds, t);
      rightDelay.delayTime.setValueAtTime(0, t);
    } else {
      leftDelay.delayTime.setValueAtTime(0, t);
      rightDelay.delayTime.setValueAtTime(itdSeconds, t);
    }

    const ildLowDb = Math.abs(position) * MAX_ILD_LOW_DB * effectAmount;
    const ildHighDb = Math.abs(position) * MAX_ILD_HIGH_DB * effectAmount;
    const ildLowGain = Math.pow(10, ildLowDb / 20);
    const ildHighGain = Math.pow(10, ildHighDb / 20);

    if (position > 0) {
      leftLowGain.gain.setValueAtTime(1 / ildLowGain, t);
      leftHighGain.gain.setValueAtTime(1 / ildHighGain, t);
      rightLowGain.gain.setValueAtTime(1, t);
      rightHighGain.gain.setValueAtTime(1, t);
      leftPinnaNotch.Q.setValueAtTime(8 * effectAmount + 1, t);
      rightPinnaNotch.Q.setValueAtTime(2, t);
    } else {
      leftLowGain.gain.setValueAtTime(1, t);
      leftHighGain.gain.setValueAtTime(1, t);
      rightLowGain.gain.setValueAtTime(1 / ildLowGain, t);
      rightHighGain.gain.setValueAtTime(1 / ildHighGain, t);
      leftPinnaNotch.Q.setValueAtTime(2, t);
      rightPinnaNotch.Q.setValueAtTime(8 * effectAmount + 1, t);
    }
  }

  return merger;
}

function applyBilateralSmoothMode(
  context: OfflineAudioContext,
  input: AudioNode,
  settings: UserAudioSettings,
  duration: number
): AudioNode {
  const panner = context.createStereoPanner();
  const frequencyHz = mapParameterValue(settings.bilateralFrequency, PARAMETER_MAPPINGS.bilateralFrequency);
  const width = settings.travelWidth / 100;

  const lfo = context.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = frequencyHz;

  const lfoGain = context.createGain();
  lfoGain.gain.value = width;

  lfo.connect(lfoGain);
  lfoGain.connect(panner.pan);
  input.connect(panner);
  lfo.start(0);
  lfo.stop(duration);

  return panner;
}

function applyBilateralHardCutMode(
  context: OfflineAudioContext,
  input: AudioNode,
  settings: UserAudioSettings,
  duration: number
): AudioNode {
  const splitter = context.createChannelSplitter(2);
  const merger = context.createChannelMerger(2);
  const leftGain = context.createGain();
  const rightGain = context.createGain();

  input.connect(splitter);
  splitter.connect(leftGain, 0);
  splitter.connect(rightGain, 1);
  leftGain.connect(merger, 0, 0);
  rightGain.connect(merger, 0, 1);

  const frequencyHz = mapParameterValue(settings.bilateralFrequency, PARAMETER_MAPPINGS.bilateralFrequency);
  const width = settings.travelWidth / 100;
  const halfPeriodSeconds = 1 / (frequencyHz * 2);
  const transitionTime = 0.01;

  const applySide = (time: number, side: 'left' | 'right', immediate: boolean) => {
    const leftValue = side === 'left' ? 1 : 1 - width;
    const rightValue = side === 'left' ? 1 - width : 1;

    if (immediate) {
      leftGain.gain.setValueAtTime(leftValue, time);
      rightGain.gain.setValueAtTime(rightValue, time);
      return;
    }

    leftGain.gain.setTargetAtTime(leftValue, time, transitionTime);
    rightGain.gain.setTargetAtTime(rightValue, time, transitionTime);
  };

  let side: 'left' | 'right' = 'left';
  applySide(0, side, true);

  for (let t = halfPeriodSeconds; t <= duration; t += halfPeriodSeconds) {
    side = side === 'left' ? 'right' : 'left';
    applySide(t, side, false);
  }

  return merger;
}

function applyHaasMode(
  context: OfflineAudioContext,
  input: AudioNode,
  settings: UserAudioSettings
): AudioNode {
  const splitter = context.createChannelSplitter(2);
  const merger = context.createChannelMerger(2);
  const leftDelay = context.createDelay(0.06);
  const rightDelay = context.createDelay(0.06);
  const leftGain = context.createGain();
  const rightGain = context.createGain();

  const delaySeconds = mapParameterValue(settings.haasDelay, PARAMETER_MAPPINGS.haasDelay) / 1000;
  const delayedGain = 0.7;

  if (settings.leadEar === 'left') {
    leftDelay.delayTime.value = 0;
    rightDelay.delayTime.value = delaySeconds;
    leftGain.gain.value = 1;
    rightGain.gain.value = delayedGain;
  } else {
    leftDelay.delayTime.value = delaySeconds;
    rightDelay.delayTime.value = 0;
    leftGain.gain.value = delayedGain;
    rightGain.gain.value = 1;
  }

  input.connect(splitter);
  splitter.connect(leftDelay, 0);
  splitter.connect(rightDelay, 1);
  leftDelay.connect(leftGain);
  rightDelay.connect(rightGain);
  leftGain.connect(merger, 0, 0);
  rightGain.connect(merger, 0, 1);
  return merger;
}

export async function renderAudioWithSettings(
  sourceBuffer: AudioBuffer,
  settings: UserAudioSettings
): Promise<AudioBuffer> {
  const channelCount = Math.max(2, sourceBuffer.numberOfChannels);
  const context = new OfflineAudioContext({
    numberOfChannels: channelCount,
    length: sourceBuffer.length,
    sampleRate: sourceBuffer.sampleRate,
  });

  const source = context.createBufferSource();
  source.buffer = sourceBuffer;
  let currentNode: AudioNode = applyEqChain(context, source, settings);

  switch (settings.mode) {
    case 'bilateral':
    case 'emdr':
      currentNode = settings.bilateralType === 'hard-cut'
        ? applyBilateralHardCutMode(context, currentNode, settings, sourceBuffer.duration)
        : applyBilateralSmoothMode(context, currentNode, settings, sourceBuffer.duration);
      break;
    case 'haas':
      currentNode = applyHaasMode(context, currentNode, settings);
      break;
    case '8d-spatial':
    default:
      currentNode = applySpatialMode(context, currentNode, settings, sourceBuffer.duration);
      break;
  }

  currentNode = applySpatialReverb(context, currentNode, settings);

  const master = context.createGain();
  master.gain.value = mapParameterValue(settings.masterVolume, PARAMETER_MAPPINGS.masterVolume);

  currentNode.connect(master);
  master.connect(context.destination);

  source.start(0);
  return context.startRendering();
}
