/**
 * Proximity Effect (Bass Warmth)
 * Low-shelf filter that adds warmth to low frequencies
 * Simulates the proximity effect of being close to a sound source
 */

import { AudioProcessingNode, mapParameterValue, PARAMETER_MAPPINGS } from '../types';

export class ProximityEffect implements AudioProcessingNode {
  private context: AudioContext;
  private lowShelfFilter: BiquadFilterNode;
  private _input: GainNode;
  private _output: GainNode;

  constructor(context: AudioContext) {
    this.context = context;

    // Create nodes
    this._input = context.createGain();
    this._output = context.createGain();
    this.lowShelfFilter = context.createBiquadFilter();

    // Configure low-shelf filter
    this.lowShelfFilter.type = 'lowshelf';
    this.lowShelfFilter.frequency.value = 250; // Frequency below which boost is applied
    this.lowShelfFilter.gain.value = 0; // Start neutral

    // Connect chain
    this._input.connect(this.lowShelfFilter);
    this.lowShelfFilter.connect(this._output);
  }

  get input(): AudioNode {
    return this._input;
  }

  get output(): AudioNode {
    return this._output;
  }

  /**
   * Set bass warmth amount (0-100)
   * @param value - Slider value 0-100
   * @param transitionTime - Smooth transition time in seconds
   */
  setAmount(value: number, transitionTime: number = 0.05): void {
    const gainDb = mapParameterValue(value, PARAMETER_MAPPINGS.bassWarmth);
    const currentTime = this.context.currentTime;

    this.lowShelfFilter.gain.cancelScheduledValues(currentTime);
    this.lowShelfFilter.gain.setTargetAtTime(
      gainDb,
      currentTime,
      transitionTime
    );
  }

  /**
   * Set the frequency cutoff for the low-shelf filter
   * @param frequency - Frequency in Hz
   */
  setFrequency(frequency: number): void {
    this.lowShelfFilter.frequency.setTargetAtTime(
      frequency,
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
    this.lowShelfFilter.disconnect();
    this._output.disconnect();
  }
}
