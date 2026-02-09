import {
  UserAudioSettings,
  mapParameterValue,
  PARAMETER_MAPPINGS,
} from '@/lib/audio';

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
  console.log('[RenderAudio] Building advanced spatial processor...');
  
  const speedHz = mapParameterValue(settings.travelSpeed, PARAMETER_MAPPINGS.travelSpeed);
  const width = mapParameterValue(settings.travelWidth, PARAMETER_MAPPINGS.travelWidth);
  const intensity = mapParameterValue(settings.effectIntensity, PARAMETER_MAPPINGS.effectIntensity);
  
  console.log(`[RenderAudio] Spatial params: speed=${speedHz}Hz, width=${width}, intensity=${intensity}`);
  
  // Create channel splitter/merger for stereo processing
  const splitter = context.createChannelSplitter(2);
  const merger = context.createChannelMerger(2);
  
  // ITD delay nodes (Interaural Time Difference)
  const leftDelay = context.createDelay(0.001);
  const rightDelay = context.createDelay(0.001);
  
  // Crossover filters for frequency-dependent ILD
  const CROSSOVER_FREQ = 1500;
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
  
  // ILD gain nodes (Interaural Level Difference)
  const leftLowGain = context.createGain();
  const leftHighGain = context.createGain();
  const rightLowGain = context.createGain();
  const rightHighGain = context.createGain();
  const leftGain = context.createGain();
  const rightGain = context.createGain();
  
  // HRTF pinna notch filters
  const PINNA_NOTCH_FREQ = 9000;
  const leftPinnaNotch = context.createBiquadFilter();
  const rightPinnaNotch = context.createBiquadFilter();
  
  [leftPinnaNotch, rightPinnaNotch].forEach(filter => {
    filter.type = 'notch';
    filter.frequency.value = PINNA_NOTCH_FREQ;
    filter.Q.value = 5;
  });
  
  // Build the audio graph
  input.connect(splitter);
  
  // Left channel
  splitter.connect(leftDelay, 0);
  leftDelay.connect(leftLowpass);
  leftDelay.connect(leftHighpass);
  leftLowpass.connect(leftLowGain);
  leftHighpass.connect(leftHighGain);
  leftLowGain.connect(leftGain);
  leftHighGain.connect(leftGain);
  leftGain.connect(leftPinnaNotch);
  leftPinnaNotch.connect(merger, 0, 0);
  
  // Right channel
  splitter.connect(rightDelay, 1);
  rightDelay.connect(rightLowpass);
  rightDelay.connect(rightHighpass);
  rightLowpass.connect(rightLowGain);
  rightHighpass.connect(rightHighGain);
  rightLowGain.connect(rightGain);
  rightHighGain.connect(rightGain);
  rightGain.connect(rightPinnaNotch);
  rightPinnaNotch.connect(merger, 0, 1);
  
  // Animate spatial position over time
  const MAX_ITD_MS = 0.7;
  const MAX_ILD_LOW_DB = 4;
  const MAX_ILD_HIGH_DB = 14;
  const step = 1 / 60; // 60fps automation
  
  console.log('[RenderAudio] Applying spatial automation...');
  
  for (let t = 0; t <= duration; t += step) {
    const phase = t * speedHz * Math.PI * 2;
    let position: number;
    
    // Calculate position based on pattern
    switch (settings.movementPattern) {
      case 'circular':
        position = Math.sin(phase);
        break;
      case 'figure8':
        position = Math.sin(phase);
        break;
      case 'leftright':
      default:
        position = Math.sin(phase);
        break;
    }
    
    position = position * width * intensity;
    
    // Apply ITD (Interaural Time Difference)
    const itdMs = Math.abs(position) * MAX_ITD_MS * intensity;
    const itdSeconds = itdMs / 1000;
    
    if (position > 0) {
      leftDelay.delayTime.setValueAtTime(itdSeconds, t);
      rightDelay.delayTime.setValueAtTime(0, t);
    } else {
      leftDelay.delayTime.setValueAtTime(0, t);
      rightDelay.delayTime.setValueAtTime(itdSeconds, t);
    }
    
    // Apply ILD (Interaural Level Difference) - frequency dependent
    const ildLowDb = Math.abs(position) * MAX_ILD_LOW_DB * intensity;
    const ildHighDb = Math.abs(position) * MAX_ILD_HIGH_DB * intensity;
    const ildLowGain = Math.pow(10, ildLowDb / 20);
    const ildHighGain = Math.pow(10, ildHighDb / 20);
    
    if (position > 0) {
      // Sound from right
      leftLowGain.gain.setValueAtTime(1 / ildLowGain, t);
      leftHighGain.gain.setValueAtTime(1 / ildHighGain, t);
      rightLowGain.gain.setValueAtTime(1, t);
      rightHighGain.gain.setValueAtTime(1, t);
      
      // Pinna notch
      leftPinnaNotch.Q.setValueAtTime(8 * intensity + 1, t);
      rightPinnaNotch.Q.setValueAtTime(2, t);
    } else {
      // Sound from left
      leftLowGain.gain.setValueAtTime(1, t);
      leftHighGain.gain.setValueAtTime(1, t);
      rightLowGain.gain.setValueAtTime(1 / ildLowGain, t);
      rightHighGain.gain.setValueAtTime(1 / ildHighGain, t);
      
      // Pinna notch
      leftPinnaNotch.Q.setValueAtTime(2, t);
      rightPinnaNotch.Q.setValueAtTime(8 * intensity + 1, t);
    }
  }
  
  console.log('[RenderAudio] Spatial automation complete');
  return merger;
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
  console.log('[RenderAudio] Starting render with settings:', settings);
  console.log('[RenderAudio] Source buffer:', {
    duration: sourceBuffer.duration,
    sampleRate: sourceBuffer.sampleRate,
    channels: sourceBuffer.numberOfChannels
  });
  
  const channelCount = Math.max(2, sourceBuffer.numberOfChannels);
  const context = new OfflineAudioContext({
    numberOfChannels: channelCount,
    length: sourceBuffer.length,
    sampleRate: sourceBuffer.sampleRate,
  });

  console.log('[RenderAudio] Created OfflineAudioContext');

  const source = context.createBufferSource();
  source.buffer = sourceBuffer;

  console.log('[RenderAudio] Applying EQ chain...');
  let currentNode: AudioNode = applyEqChain(context, source, settings);

  console.log(`[RenderAudio] Applying mode: ${settings.mode}`);
  switch (settings.mode) {
    case 'bilateral':
    case 'emdr':
      console.log('[RenderAudio] Applying bilateral mode');
      currentNode = applyBilateralMode(context, currentNode, settings, sourceBuffer.duration);
      break;
    case 'haas':
      console.log('[RenderAudio] Applying Haas mode');
      currentNode = applyHaasMode(context, currentNode, settings);
      break;
    case '8d-spatial':
    default:
      console.log('[RenderAudio] Applying 8D spatial mode');
      currentNode = applySpatialMode(context, currentNode, settings, sourceBuffer.duration);
      break;
  }

  console.log('[RenderAudio] Adding depth mix...');
  currentNode = addDepthMix(context, currentNode, settings);

  const master = context.createGain();
  master.gain.value = mapParameterValue(settings.masterVolume, PARAMETER_MAPPINGS.masterVolume);
  console.log(`[RenderAudio] Master volume: ${master.gain.value}`);
  
  currentNode.connect(master);
  master.connect(context.destination);

  source.start(0);
  
  console.log('[RenderAudio] Starting offline rendering...');
  const startTime = performance.now();
  const result = await context.startRendering();
  const renderTime = performance.now() - startTime;
  
  console.log(`[RenderAudio] Rendering completed in ${renderTime.toFixed(0)}ms`);
  console.log('[RenderAudio] Result buffer:', {
    duration: result.duration,
    sampleRate: result.sampleRate,
    channels: result.numberOfChannels
  });
  
  return result;
}
