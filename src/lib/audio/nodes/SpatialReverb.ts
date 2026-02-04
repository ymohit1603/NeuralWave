/**
 * Spatial Reverb
 * Simple early reflections reverb for adding spatial depth
 * Uses multiple delay lines to simulate room reflections
 */

import { AudioProcessingNode } from '../types';

// Early reflection delay times in ms (simulating a small room)
const REFLECTION_DELAYS = [11, 17, 23, 31, 37, 43];
const REFLECTION_GAINS = [0.8, 0.6, 0.5, 0.4, 0.3, 0.25];

export class SpatialReverb implements AudioProcessingNode {
  private context: AudioContext;
  private _input: GainNode;
  private _output: GainNode;

  // Dry/wet mix
  private dryGain: GainNode;
  private wetGain: GainNode;

  // Early reflections
  private reflectionDelays: DelayNode[] = [];
  private reflectionGains: GainNode[] = [];

  // Pre-delay
  private preDelay: DelayNode;

  // Diffusion filter
  private diffusionFilter: BiquadFilterNode;

  // Current mix amount
  private currentMix: number = 0;

  constructor(context: AudioContext) {
    this.context = context;

    // Create input/output
    this._input = context.createGain();
    this._output = context.createGain();

    // Create dry/wet mix
    this.dryGain = context.createGain();
    this.wetGain = context.createGain();

    // Create pre-delay
    this.preDelay = context.createDelay(0.1);
    this.preDelay.delayTime.value = 0.01; // 10ms pre-delay

    // Create diffusion filter (slight high-frequency rolloff)
    this.diffusionFilter = context.createBiquadFilter();
    this.diffusionFilter.type = 'lowpass';
    this.diffusionFilter.frequency.value = 8000;
    this.diffusionFilter.Q.value = 0.5;

    // Create early reflection delay lines
    for (let i = 0; i < REFLECTION_DELAYS.length; i++) {
      const delay = context.createDelay(0.1);
      delay.delayTime.value = REFLECTION_DELAYS[i] / 1000;

      const gain = context.createGain();
      gain.gain.value = REFLECTION_GAINS[i];

      this.reflectionDelays.push(delay);
      this.reflectionGains.push(gain);
    }

    // Build the audio graph
    this.buildGraph();

    // Set initial mix
    this.setMix(0);
  }

  private buildGraph(): void {
    // Dry path: Input -> DryGain -> Output
    this._input.connect(this.dryGain);
    this.dryGain.connect(this._output);

    // Wet path: Input -> PreDelay -> Diffusion -> Reflections -> WetGain -> Output
    this._input.connect(this.preDelay);
    this.preDelay.connect(this.diffusionFilter);

    // Connect each reflection delay line
    for (let i = 0; i < this.reflectionDelays.length; i++) {
      this.diffusionFilter.connect(this.reflectionDelays[i]);
      this.reflectionDelays[i].connect(this.reflectionGains[i]);
      this.reflectionGains[i].connect(this.wetGain);
    }

    this.wetGain.connect(this._output);
  }

  get input(): AudioNode {
    return this._input;
  }

  get output(): AudioNode {
    return this._output;
  }

  /**
   * Set the reverb mix amount (0-100)
   * 0 = fully dry, 100 = fully wet
   */
  setMix(value: number, transitionTime: number = 0.05): void {
    this.currentMix = value;
    const wetAmount = value / 100;
    const dryAmount = 1 - (wetAmount * 0.5); // Keep some dry signal even at 100%

    const currentTime = this.context.currentTime;
    this.dryGain.gain.setTargetAtTime(dryAmount, currentTime, transitionTime);
    this.wetGain.gain.setTargetAtTime(wetAmount, currentTime, transitionTime);
  }

  /**
   * Set the pre-delay time in ms
   */
  setPreDelay(ms: number): void {
    this.preDelay.delayTime.setTargetAtTime(
      ms / 1000,
      this.context.currentTime,
      0.05
    );
  }

  /**
   * Set the high-frequency damping
   * @param frequency - Cutoff frequency in Hz
   */
  setDamping(frequency: number): void {
    this.diffusionFilter.frequency.setTargetAtTime(
      frequency,
      this.context.currentTime,
      0.05
    );
  }

  /**
   * Set room size (scales reflection delays)
   * @param size - Room size multiplier (0.5 = small, 2.0 = large)
   */
  setRoomSize(size: number): void {
    const currentTime = this.context.currentTime;

    for (let i = 0; i < this.reflectionDelays.length; i++) {
      const newDelay = (REFLECTION_DELAYS[i] * size) / 1000;
      this.reflectionDelays[i].delayTime.setTargetAtTime(
        Math.min(newDelay, 0.1), // Cap at 100ms
        currentTime,
        0.05
      );
    }
  }

  /**
   * Get current mix amount
   */
  getMix(): number {
    return this.currentMix;
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
    this.dryGain.disconnect();
    this.wetGain.disconnect();
    this.preDelay.disconnect();
    this.diffusionFilter.disconnect();

    for (const delay of this.reflectionDelays) {
      delay.disconnect();
    }
    for (const gain of this.reflectionGains) {
      gain.disconnect();
    }

    this._output.disconnect();
  }
}
