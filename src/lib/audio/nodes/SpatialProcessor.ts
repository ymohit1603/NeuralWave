/**
 * Spatial Processor
 * Implements ITD (Interaural Time Difference), ILD (Interaural Level Difference),
 * and simplified HRTF for realistic 3D audio positioning
 */

import { AudioProcessingNode, SpatialPosition } from '../types';

// Constants for spatial audio
const MAX_ITD_MS = 0.7; // Maximum interaural time difference in ms
const MAX_ILD_LOW_DB = 4; // Maximum ILD for low frequencies
const MAX_ILD_HIGH_DB = 14; // Maximum ILD for high frequencies
const CROSSOVER_FREQ = 1500; // Crossover frequency for frequency-dependent processing
const PINNA_NOTCH_FREQ = 9000; // Pinna notch frequency for HRTF simulation

export class SpatialProcessor implements AudioProcessingNode {
  private context: AudioContext;
  private _input: GainNode;
  private _output: GainNode;

  // Channel splitter/merger for stereo processing
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;

  // ITD delay nodes
  private leftDelay: DelayNode;
  private rightDelay: DelayNode;

  // ILD gain nodes
  private leftGain: GainNode;
  private rightGain: GainNode;

  // Crossover filters for frequency-dependent ILD
  private leftLowpass: BiquadFilterNode;
  private leftHighpass: BiquadFilterNode;
  private rightLowpass: BiquadFilterNode;
  private rightHighpass: BiquadFilterNode;

  // Separate gains for low and high frequency ILD
  private leftLowGain: GainNode;
  private leftHighGain: GainNode;
  private rightLowGain: GainNode;
  private rightHighGain: GainNode;

  // HRTF pinna notch filters
  private leftPinnaNotch: BiquadFilterNode;
  private rightPinnaNotch: BiquadFilterNode;

  // Current position
  private currentPosition: number = 0;

  constructor(context: AudioContext) {
    this.context = context;

    // Create input/output
    this._input = context.createGain();
    this._output = context.createGain();

    // Create splitter and merger for stereo processing
    this.splitter = context.createChannelSplitter(2);
    this.merger = context.createChannelMerger(2);

    // Create ITD delay nodes (max 1ms delay for safety)
    this.leftDelay = context.createDelay(0.001);
    this.rightDelay = context.createDelay(0.001);

    // Create main ILD gain nodes
    this.leftGain = context.createGain();
    this.rightGain = context.createGain();

    // Create crossover filters
    this.leftLowpass = context.createBiquadFilter();
    this.leftHighpass = context.createBiquadFilter();
    this.rightLowpass = context.createBiquadFilter();
    this.rightHighpass = context.createBiquadFilter();

    // Configure crossover filters
    [this.leftLowpass, this.rightLowpass].forEach(filter => {
      filter.type = 'lowpass';
      filter.frequency.value = CROSSOVER_FREQ;
      filter.Q.value = 0.707; // Butterworth
    });

    [this.leftHighpass, this.rightHighpass].forEach(filter => {
      filter.type = 'highpass';
      filter.frequency.value = CROSSOVER_FREQ;
      filter.Q.value = 0.707;
    });

    // Create frequency-dependent ILD gains
    this.leftLowGain = context.createGain();
    this.leftHighGain = context.createGain();
    this.rightLowGain = context.createGain();
    this.rightHighGain = context.createGain();

    // Create HRTF pinna notch filters
    this.leftPinnaNotch = context.createBiquadFilter();
    this.rightPinnaNotch = context.createBiquadFilter();

    [this.leftPinnaNotch, this.rightPinnaNotch].forEach(filter => {
      filter.type = 'notch';
      filter.frequency.value = PINNA_NOTCH_FREQ;
      filter.Q.value = 5; // Narrow notch
    });

    // Build the audio graph
    this.buildGraph();
  }

  private buildGraph(): void {
    // Input -> Splitter
    this._input.connect(this.splitter);

    // Left channel processing
    // Splitter -> Delay -> Crossover -> Gains -> Pinna -> Merger
    this.splitter.connect(this.leftDelay, 0);
    this.leftDelay.connect(this.leftLowpass);
    this.leftDelay.connect(this.leftHighpass);
    this.leftLowpass.connect(this.leftLowGain);
    this.leftHighpass.connect(this.leftHighGain);
    this.leftLowGain.connect(this.leftGain);
    this.leftHighGain.connect(this.leftGain);
    this.leftGain.connect(this.leftPinnaNotch);
    this.leftPinnaNotch.connect(this.merger, 0, 0);

    // Right channel processing
    this.splitter.connect(this.rightDelay, 1);
    this.rightDelay.connect(this.rightLowpass);
    this.rightDelay.connect(this.rightHighpass);
    this.rightLowpass.connect(this.rightLowGain);
    this.rightHighpass.connect(this.rightHighGain);
    this.rightLowGain.connect(this.rightGain);
    this.rightHighGain.connect(this.rightGain);
    this.rightGain.connect(this.rightPinnaNotch);
    this.rightPinnaNotch.connect(this.merger, 0, 1);

    // Merger -> Output
    this.merger.connect(this._output);
  }

  get input(): AudioNode {
    return this._input;
  }

  get output(): AudioNode {
    return this._output;
  }

  /**
   * Set the spatial position
   * @param position - Pan position from -1 (left) to 1 (right)
   * @param intensity - Effect intensity 0-100
   * @param transitionTime - Smooth transition time in seconds
   */
  setPosition(position: number, intensity: number = 100, transitionTime: number = 0.02): void {
    this.currentPosition = position;
    const effectAmount = intensity / 100;
    const currentTime = this.context.currentTime;

    // Calculate ITD using Woodworth-Schlosberg formula
    // ITD = (r/c) * (θ + sin(θ)) where r = head radius, c = speed of sound
    // Simplified: ITD ≈ position * MAX_ITD
    const itdMs = Math.abs(position) * MAX_ITD_MS * effectAmount;
    const itdSeconds = itdMs / 1000;

    // Apply ITD - delay the ear opposite to the sound source
    if (position > 0) {
      // Sound from right - delay left ear
      this.leftDelay.delayTime.setTargetAtTime(itdSeconds, currentTime, transitionTime);
      this.rightDelay.delayTime.setTargetAtTime(0, currentTime, transitionTime);
    } else {
      // Sound from left - delay right ear
      this.leftDelay.delayTime.setTargetAtTime(0, currentTime, transitionTime);
      this.rightDelay.delayTime.setTargetAtTime(itdSeconds, currentTime, transitionTime);
    }

    // Calculate ILD (frequency-dependent)
    const ildLowDb = Math.abs(position) * MAX_ILD_LOW_DB * effectAmount;
    const ildHighDb = Math.abs(position) * MAX_ILD_HIGH_DB * effectAmount;

    // Convert dB to linear gain
    const ildLowGain = Math.pow(10, ildLowDb / 20);
    const ildHighGain = Math.pow(10, ildHighDb / 20);

    // Apply ILD - reduce gain on the far ear
    if (position > 0) {
      // Sound from right - reduce left ear
      this.leftLowGain.gain.setTargetAtTime(1 / ildLowGain, currentTime, transitionTime);
      this.leftHighGain.gain.setTargetAtTime(1 / ildHighGain, currentTime, transitionTime);
      this.rightLowGain.gain.setTargetAtTime(1, currentTime, transitionTime);
      this.rightHighGain.gain.setTargetAtTime(1, currentTime, transitionTime);
    } else {
      // Sound from left - reduce right ear
      this.leftLowGain.gain.setTargetAtTime(1, currentTime, transitionTime);
      this.leftHighGain.gain.setTargetAtTime(1, currentTime, transitionTime);
      this.rightLowGain.gain.setTargetAtTime(1 / ildLowGain, currentTime, transitionTime);
      this.rightHighGain.gain.setTargetAtTime(1 / ildHighGain, currentTime, transitionTime);
    }

    // Apply HRTF pinna notch effect
    // The notch is more pronounced on the far ear
    const nearNotchQ = 2;
    const farNotchQ = 8;

    if (position > 0) {
      this.leftPinnaNotch.Q.setTargetAtTime(farNotchQ * effectAmount + 1, currentTime, transitionTime);
      this.rightPinnaNotch.Q.setTargetAtTime(nearNotchQ, currentTime, transitionTime);
    } else {
      this.leftPinnaNotch.Q.setTargetAtTime(nearNotchQ, currentTime, transitionTime);
      this.rightPinnaNotch.Q.setTargetAtTime(farNotchQ * effectAmount + 1, currentTime, transitionTime);
    }
  }

  /**
   * Set position from a 3D coordinate
   * @param pos - 3D position object
   * @param intensity - Effect intensity 0-100
   */
  setPosition3D(pos: SpatialPosition, intensity: number = 100): void {
    // Convert 3D position to pan position
    // For now, we primarily use the X axis (left-right)
    // Y axis (front-back) could affect reverb/filtering
    // Z axis (up-down) could affect high-frequency content
    this.setPosition(pos.x, intensity);
  }

  /**
   * Get current position
   */
  getPosition(): number {
    return this.currentPosition;
  }

  connect(destination: AudioNode | AudioParam): void {
    if (destination instanceof AudioParam) {
      this._output.connect(destination);
    } else {
      this._output.connect(destination);
    }
  }

  disconnect(): void {
    this._output.disconnect();
  }

  dispose(): void {
    this._input.disconnect();
    this.splitter.disconnect();
    this.leftDelay.disconnect();
    this.rightDelay.disconnect();
    this.leftLowpass.disconnect();
    this.leftHighpass.disconnect();
    this.rightLowpass.disconnect();
    this.rightHighpass.disconnect();
    this.leftLowGain.disconnect();
    this.leftHighGain.disconnect();
    this.rightLowGain.disconnect();
    this.rightHighGain.disconnect();
    this.leftGain.disconnect();
    this.rightGain.disconnect();
    this.leftPinnaNotch.disconnect();
    this.rightPinnaNotch.disconnect();
    this.merger.disconnect();
    this._output.disconnect();
  }
}
