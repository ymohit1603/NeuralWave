import {
  UserAudioSettings,
  mapParameterValue,
  PARAMETER_MAPPINGS,
} from '@/lib/audio';

function clampPan(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function getPatternValue(pattern: UserAudioSettings['movementPattern'], phase: number): number {
  switch (pattern) {
    case 'circular':
      return Math.sin(phase);
    case 'figure8':
      return Math.sin(phase);
    case 'leftright':
    default:
      return Math.sin(phase);
  }
}

function applyEqChain(
  context: OfflineAudioContext,
  input: AudioNode,
  settings: UserAudioSettings
): AudioNode {
  const lowShelf = context.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 120;
  lowShelf.gain.value = mapParameterValue(settings.bassWarmth, PARAMETER_MAPPINGS.bassWarmth);

  const presence = context.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3000;
  presence.Q.value = 0.8;
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

function addDepthMix(
  context: OfflineAudioContext,
  input: AudioNode,
  settings: UserAudioSettings
): AudioNode {
  const depth = mapParameterValue(settings.spatialDepth, PARAMETER_MAPPINGS.spatialDepth);
  if (depth <= 0.001) {
    return input;
  }

  const dryGain = context.createGain();
  const wetGain = context.createGain();
  const delay = context.createDelay(0.45);
  const feedback = context.createGain();
  const mix = Math.min(0.45, depth * 0.5);

  delay.delayTime.value = 0.08 + depth * 0.12;
  feedback.gain.value = 0.15 + depth * 0.2;
  dryGain.gain.value = 1 - mix;
  wetGain.gain.value = mix;

  input.connect(dryGain);
  input.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wetGain);

  const output = context.createGain();
  dryGain.connect(output);
  wetGain.connect(output);
  return output;
}

function applySpatialMode(
  context: OfflineAudioContext,
  input: AudioNode,
  settings: UserAudioSettings,
  duration: number
): AudioNode {
  const panner = context.createStereoPanner();
  const speedHz = mapParameterValue(settings.travelSpeed, PARAMETER_MAPPINGS.travelSpeed);
  const width = mapParameterValue(settings.travelWidth, PARAMETER_MAPPINGS.travelWidth);
  const intensity = mapParameterValue(settings.effectIntensity, PARAMETER_MAPPINGS.effectIntensity);
  const amount = width * intensity;
  const step = 1 / 30;

  panner.pan.setValueAtTime(0, 0);
  for (let t = 0; t <= duration; t += step) {
    const phase = t * speedHz * Math.PI * 2;
    const value = clampPan(getPatternValue(settings.movementPattern, phase) * amount);
    panner.pan.setValueAtTime(value, t);
  }

  input.connect(panner);
  return panner;
}

function applyBilateralMode(
  context: OfflineAudioContext,
  input: AudioNode,
  settings: UserAudioSettings,
  duration: number
): AudioNode {
  const panner = context.createStereoPanner();
  const frequencyHz = mapParameterValue(settings.bilateralFrequency, PARAMETER_MAPPINGS.bilateralFrequency);
  const width = mapParameterValue(settings.travelWidth, PARAMETER_MAPPINGS.travelWidth);
  const step = 1 / (frequencyHz * 2);

  if (settings.bilateralType === 'hard-cut') {
    let t = 0;
    let side: -1 | 1 = -1;
    while (t <= duration) {
      panner.pan.setValueAtTime(side * width, t);
      side = side === -1 ? 1 : -1;
      t += step;
    }
  } else {
    let t = 0;
    let side: -1 | 1 = -1;
    panner.pan.setValueAtTime(-width, 0);
    while (t <= duration) {
      const nextT = Math.min(duration, t + step);
      const currentPan = side * width;
      const nextPan = (side === -1 ? 1 : -1) * width;
      panner.pan.setValueAtTime(currentPan, t);
      panner.pan.linearRampToValueAtTime(nextPan, nextT);
      side = side === -1 ? 1 : -1;
      t = nextT;
    }
  }

  input.connect(panner);
  return panner;
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
      currentNode = applyBilateralMode(context, currentNode, settings, sourceBuffer.duration);
      break;
    case 'haas':
      currentNode = applyHaasMode(context, currentNode, settings);
      break;
    case '8d-spatial':
    default:
      currentNode = applySpatialMode(context, currentNode, settings, sourceBuffer.duration);
      break;
  }

  currentNode = addDepthMix(context, currentNode, settings);

  const master = context.createGain();
  master.gain.value = mapParameterValue(settings.masterVolume, PARAMETER_MAPPINGS.masterVolume);
  currentNode.connect(master);
  master.connect(context.destination);

  source.start(0);
  return context.startRendering();
}
