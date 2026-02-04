/**
 * Breath Enhancement (Air & Brightness)
 * High-shelf filter that adds sparkle and openness to the high frequencies
 */

import { AudioProcessingNode, mapParameterValue, PARAMETER_MAPPINGS } from '../types';

export class BreathEnhancement implements AudioProcessingNode {
  private context: AudioContext;
  private highShelfFilter: BiquadFilterNode;
  private _input: GainNode;
  private _output: GainNode;

  constructor(context: AudioContext) {
    this.context = context;

    // Create nodes
    this._input = context.createGain();
    this._output = context.createGain();
    this.highShelfFilter = context.createBiquadFilter();

    // Configure high-shelf filter for air/brightness
    this.highShelfFilter.type = 'highshelf';
    this.highShelfFilter.frequency.value = 8000; // Frequency above which boost is applied
    this.highShelfFilter.gain.value = 0; // Start neutral

    // Connect chain
    this._input.connect(this.highShelfFilter);
    this.highShelfFilter.connect(this._output);
  }

  get input(): AudioNode {
    return this._input;
  }

  get output(): AudioNode {
    return this._output;
  }

  /**
   * Set air/brightness amount (0-100)
   * @param value - Slider value 0-100
   * @param transitionTime - Smooth transition time in seconds
   */
  setAmount(value: number, transitionTime: number = 0.05): void {
    const gainDb = mapParameterValue(value, PARAMETER_MAPPINGS.airBrightness);
    const currentTime = this.context.currentTime;

    this.highShelfFilter.gain.cancelScheduledValues(currentTime);
    this.highShelfFilter.gain.setTargetAtTime(
      gainDb,
      currentTime,
      transitionTime
    );
  }

  /**
   * Set the frequency cutoff for the high-shelf filter
   * @param frequency - Frequency in Hz (typically 6000-12000)
   */
  setFrequency(frequency: number): void {
    this.highShelfFilter.frequency.setTargetAtTime(
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
    this.highShelfFilter.disconnect();
    this._output.disconnect();
  }
}
