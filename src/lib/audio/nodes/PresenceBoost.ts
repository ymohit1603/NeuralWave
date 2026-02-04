/**
 * Presence Boost (Clarity)
 * Peaking filter in the 2-5kHz range to enhance vocal and instrument clarity
 */

import { AudioProcessingNode, mapParameterValue, PARAMETER_MAPPINGS } from '../types';

export class PresenceBoost implements AudioProcessingNode {
  private context: AudioContext;
  private peakingFilter: BiquadFilterNode;
  private _input: GainNode;
  private _output: GainNode;

  constructor(context: AudioContext) {
    this.context = context;

    // Create nodes
    this._input = context.createGain();
    this._output = context.createGain();
    this.peakingFilter = context.createBiquadFilter();

    // Configure peaking filter for presence/clarity
    this.peakingFilter.type = 'peaking';
    this.peakingFilter.frequency.value = 3000; // Center frequency (3kHz)
    this.peakingFilter.Q.value = 1.0; // Moderate Q for natural sound
    this.peakingFilter.gain.value = 0; // Start neutral

    // Connect chain
    this._input.connect(this.peakingFilter);
    this.peakingFilter.connect(this._output);
  }

  get input(): AudioNode {
    return this._input;
  }

  get output(): AudioNode {
    return this._output;
  }

  /**
   * Set clarity amount (0-100)
   * @param value - Slider value 0-100
   * @param transitionTime - Smooth transition time in seconds
   */
  setAmount(value: number, transitionTime: number = 0.05): void {
    const gainDb = mapParameterValue(value, PARAMETER_MAPPINGS.clarity);
    const currentTime = this.context.currentTime;

    this.peakingFilter.gain.cancelScheduledValues(currentTime);
    this.peakingFilter.gain.setTargetAtTime(
      gainDb,
      currentTime,
      transitionTime
    );
  }

  /**
   * Set the center frequency for the presence boost
   * @param frequency - Frequency in Hz (typically 2000-5000)
   */
  setFrequency(frequency: number): void {
    this.peakingFilter.frequency.setTargetAtTime(
      frequency,
      this.context.currentTime,
      0.05
    );
  }

  /**
   * Set the Q (bandwidth) of the filter
   * @param q - Q value (0.5 = wide, 2.0 = narrow)
   */
  setQ(q: number): void {
    this.peakingFilter.Q.setTargetAtTime(
      q,
      this.context.currentTime,
      0.05
    );
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
    this.peakingFilter.disconnect();
    this._output.disconnect();
  }
}
