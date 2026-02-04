/**
 * Bilateral Panner
 * Implements smooth and hard-cut bilateral stimulation modes
 * Used for focus enhancement, relaxation, and EMDR therapy
 */

import { AudioProcessingNode, BilateralType, mapParameterValue, PARAMETER_MAPPINGS } from '../types';

export class BilateralPanner implements AudioProcessingNode {
  private context: AudioContext;
  private _input: GainNode;
  private _output: GainNode;

  // Stereo panner for smooth mode
  private stereoPanner: StereoPannerNode;

  // Channel splitter/merger for hard-cut mode
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  private leftGain: GainNode;
  private rightGain: GainNode;

  // LFO for smooth panning
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode;

  // Current settings
  private currentType: BilateralType = 'smooth';
  private currentFrequency: number = 1; // Hz
  private currentWidth: number = 1; // 0-1
  private isRunning: boolean = false;

  // Hard-cut scheduling
  private hardCutInterval: number | null = null;
  private currentSide: 'left' | 'right' = 'left';

  constructor(context: AudioContext) {
    this.context = context;

    // Create input/output
    this._input = context.createGain();
    this._output = context.createGain();

    // Create stereo panner for smooth mode
    this.stereoPanner = context.createStereoPanner();

    // Create LFO gain (controls pan width)
    this.lfoGain = context.createGain();
    this.lfoGain.gain.value = 1;

    // Create channel processing for hard-cut mode
    this.splitter = context.createChannelSplitter(2);
    this.merger = context.createChannelMerger(2);
    this.leftGain = context.createGain();
    this.rightGain = context.createGain();

    // Build initial graph (smooth mode)
    this.buildSmoothGraph();
  }

  private buildSmoothGraph(): void {
    // Disconnect everything first
    this._input.disconnect();
    this.stereoPanner.disconnect();
    this.splitter.disconnect();
    this.leftGain.disconnect();
    this.rightGain.disconnect();
    this.merger.disconnect();

    // Simple chain: Input -> StereoPanner -> Output
    this._input.connect(this.stereoPanner);
    this.stereoPanner.connect(this._output);
  }

  private buildHardCutGraph(): void {
    // Disconnect everything first
    this._input.disconnect();
    this.stereoPanner.disconnect();
    this.splitter.disconnect();
    this.leftGain.disconnect();
    this.rightGain.disconnect();
    this.merger.disconnect();

    // Hard-cut chain: Input -> Splitter -> Gains -> Merger -> Output
    this._input.connect(this.splitter);
    this.splitter.connect(this.leftGain, 0);
    this.splitter.connect(this.rightGain, 1);
    this.leftGain.connect(this.merger, 0, 0);
    this.rightGain.connect(this.merger, 0, 1);
    this.merger.connect(this._output);
  }

  get input(): AudioNode {
    return this._input;
  }

  get output(): AudioNode {
    return this._output;
  }

  /**
   * Set the bilateral type (smooth or hard-cut)
   */
  setType(type: BilateralType): void {
    if (type === this.currentType) return;

    const wasRunning = this.isRunning;
    if (wasRunning) {
      this.stop();
    }

    this.currentType = type;

    if (type === 'smooth') {
      this.buildSmoothGraph();
    } else {
      this.buildHardCutGraph();
    }

    if (wasRunning) {
      this.start();
    }
  }

  /**
   * Set the bilateral frequency (0-100 slider value)
   * Maps to 0.5-2 Hz
   */
  setFrequency(value: number): void {
    const frequency = mapParameterValue(value, PARAMETER_MAPPINGS.bilateralFrequency);
    this.currentFrequency = frequency;

    if (this.currentType === 'smooth' && this.lfo) {
      this.lfo.frequency.setTargetAtTime(frequency, this.context.currentTime, 0.05);
    } else if (this.currentType === 'hard-cut' && this.isRunning) {
      // Restart hard-cut with new frequency
      this.stopHardCut();
      this.startHardCut();
    }
  }

  /**
   * Set the pan width (0-100)
   */
  setWidth(value: number): void {
    this.currentWidth = value / 100;

    if (this.currentType === 'smooth') {
      this.lfoGain.gain.setTargetAtTime(this.currentWidth, this.context.currentTime, 0.05);
    }
  }

  /**
   * Start the bilateral stimulation
   */
  start(): void {
    if (this.isRunning) return;

    if (this.currentType === 'smooth') {
      this.startSmooth();
    } else {
      this.startHardCut();
    }

    this.isRunning = true;
  }

  /**
   * Stop the bilateral stimulation
   */
  stop(): void {
    if (!this.isRunning) return;

    if (this.currentType === 'smooth') {
      this.stopSmooth();
    } else {
      this.stopHardCut();
    }

    this.isRunning = false;
  }

  private startSmooth(): void {
    // Create LFO oscillator
    this.lfo = this.context.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = this.currentFrequency;

    // Connect LFO through gain to panner
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.stereoPanner.pan);

    // Set width
    this.lfoGain.gain.value = this.currentWidth;

    // Start LFO
    this.lfo.start();
  }

  private stopSmooth(): void {
    if (this.lfo) {
      this.lfo.stop();
      this.lfo.disconnect();
      this.lfo = null;
    }
    this.lfoGain.disconnect();
    // Reset panner to center
    this.stereoPanner.pan.setTargetAtTime(0, this.context.currentTime, 0.05);
  }

  private startHardCut(): void {
    const periodMs = (1 / this.currentFrequency) * 1000;
    const halfPeriodMs = periodMs / 2;

    // Set initial state
    this.currentSide = 'left';
    this.setHardCutSide('left');

    // Schedule alternating sides
    this.hardCutInterval = window.setInterval(() => {
      this.currentSide = this.currentSide === 'left' ? 'right' : 'left';
      this.setHardCutSide(this.currentSide);
    }, halfPeriodMs);
  }

  private stopHardCut(): void {
    if (this.hardCutInterval !== null) {
      clearInterval(this.hardCutInterval);
      this.hardCutInterval = null;
    }

    // Reset gains to center
    const currentTime = this.context.currentTime;
    this.leftGain.gain.setTargetAtTime(1, currentTime, 0.02);
    this.rightGain.gain.setTargetAtTime(1, currentTime, 0.02);
  }

  private setHardCutSide(side: 'left' | 'right'): void {
    const currentTime = this.context.currentTime;
    const transitionTime = 0.01; // Very fast transition for hard-cut

    if (side === 'left') {
      this.leftGain.gain.setTargetAtTime(1, currentTime, transitionTime);
      this.rightGain.gain.setTargetAtTime(1 - this.currentWidth, currentTime, transitionTime);
    } else {
      this.leftGain.gain.setTargetAtTime(1 - this.currentWidth, currentTime, transitionTime);
      this.rightGain.gain.setTargetAtTime(1, currentTime, transitionTime);
    }
  }

  /**
   * Get current pan position (-1 to 1)
   */
  getCurrentPosition(): number {
    if (this.currentType === 'smooth') {
      return this.stereoPanner.pan.value;
    } else {
      return this.currentSide === 'left' ? -this.currentWidth : this.currentWidth;
    }
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
    this.stop();
    this._input.disconnect();
    this.stereoPanner.disconnect();
    this.lfoGain.disconnect();
    this.splitter.disconnect();
    this.leftGain.disconnect();
    this.rightGain.disconnect();
    this.merger.disconnect();
    this._output.disconnect();
  }
}
