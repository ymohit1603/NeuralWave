/**
 * Haas Effect (Stereo Width Enhancement)
 * Creates a wider stereo image by delaying one channel slightly
 * The delayed signal is perceived as coming from the same direction as the leading signal
 */

import { AudioProcessingNode, LeadEar, mapParameterValue, PARAMETER_MAPPINGS } from '../types';

export class HaasEffect implements AudioProcessingNode {
  private context: AudioContext;
  private _input: GainNode;
  private _output: GainNode;

  // Channel processing
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;

  // Delay nodes for each channel
  private leftDelay: DelayNode;
  private rightDelay: DelayNode;

  // Gain nodes for attenuation of delayed channel
  private leftGain: GainNode;
  private rightGain: GainNode;

  // Current settings
  private currentDelay: number = 15; // ms
  private currentLeadEar: LeadEar = 'left';
  private delayedChannelAttenuation: number = 0.7; // -3dB roughly

  constructor(context: AudioContext) {
    this.context = context;

    // Create input/output
    this._input = context.createGain();
    this._output = context.createGain();

    // Create channel processing
    this.splitter = context.createChannelSplitter(2);
    this.merger = context.createChannelMerger(2);

    // Create delay nodes (max 50ms)
    this.leftDelay = context.createDelay(0.05);
    this.rightDelay = context.createDelay(0.05);

    // Create gain nodes
    this.leftGain = context.createGain();
    this.rightGain = context.createGain();

    // Build the audio graph
    this.buildGraph();

    // Apply initial settings
    this.applySettings();
  }

  private buildGraph(): void {
    // Input -> Splitter
    this._input.connect(this.splitter);

    // Left channel: Splitter -> Delay -> Gain -> Merger
    this.splitter.connect(this.leftDelay, 0);
    this.leftDelay.connect(this.leftGain);
    this.leftGain.connect(this.merger, 0, 0);

    // Right channel: Splitter -> Delay -> Gain -> Merger
    this.splitter.connect(this.rightDelay, 1);
    this.rightDelay.connect(this.rightGain);
    this.rightGain.connect(this.merger, 0, 1);

    // Merger -> Output
    this.merger.connect(this._output);
  }

  private applySettings(): void {
    const currentTime = this.context.currentTime;
    const transitionTime = 0.05;
    const delaySeconds = this.currentDelay / 1000;

    if (this.currentLeadEar === 'left') {
      // Left ear leads - delay right channel
      this.leftDelay.delayTime.setTargetAtTime(0, currentTime, transitionTime);
      this.rightDelay.delayTime.setTargetAtTime(delaySeconds, currentTime, transitionTime);
      this.leftGain.gain.setTargetAtTime(1, currentTime, transitionTime);
      this.rightGain.gain.setTargetAtTime(this.delayedChannelAttenuation, currentTime, transitionTime);
    } else {
      // Right ear leads - delay left channel
      this.leftDelay.delayTime.setTargetAtTime(delaySeconds, currentTime, transitionTime);
      this.rightDelay.delayTime.setTargetAtTime(0, currentTime, transitionTime);
      this.leftGain.gain.setTargetAtTime(this.delayedChannelAttenuation, currentTime, transitionTime);
      this.rightGain.gain.setTargetAtTime(1, currentTime, transitionTime);
    }
  }

  get input(): AudioNode {
    return this._input;
  }

  get output(): AudioNode {
    return this._output;
  }

  /**
   * Set the delay amount (0-100 slider value)
   * Maps to 5-25ms
   */
  setDelay(value: number, _transitionTime: number = 0.05): void {
    this.currentDelay = mapParameterValue(value, PARAMETER_MAPPINGS.haasDelay);
    this.applySettings();
  }

  /**
   * Set which ear leads (receives sound first)
   */
  setLeadEar(ear: LeadEar): void {
    if (ear === this.currentLeadEar) return;
    this.currentLeadEar = ear;
    this.applySettings();
  }

  /**
   * Set the attenuation of the delayed channel
   * @param db - Attenuation in dB (negative value)
   */
  setDelayedAttenuation(db: number): void {
    this.delayedChannelAttenuation = Math.pow(10, db / 20);
    this.applySettings();
  }

  /**
   * Get current delay in ms
   */
  getDelay(): number {
    return this.currentDelay;
  }

  /**
   * Get current lead ear
   */
  getLeadEar(): LeadEar {
    return this.currentLeadEar;
  }

  /**
   * Bypass the effect (set delay to 0)
   */
  bypass(): void {
    const currentTime = this.context.currentTime;
    this.leftDelay.delayTime.setTargetAtTime(0, currentTime, 0.05);
    this.rightDelay.delayTime.setTargetAtTime(0, currentTime, 0.05);
    this.leftGain.gain.setTargetAtTime(1, currentTime, 0.05);
    this.rightGain.gain.setTargetAtTime(1, currentTime, 0.05);
  }

  /**
   * Enable the effect with current settings
   */
  enable(): void {
    this.applySettings();
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
    this.leftGain.disconnect();
    this.rightGain.disconnect();
    this.merger.disconnect();
    this._output.disconnect();
  }
}
