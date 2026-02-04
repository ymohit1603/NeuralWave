/**
 * Trajectory Generator
 * Generates movement patterns for spatial audio positioning
 * Supports left-right, circular, and figure-8 patterns
 */

import { MovementPattern, mapParameterValue, PARAMETER_MAPPINGS } from './types';

export type TrajectoryCallback = (position: number, x: number, y: number) => void;

export class TrajectoryGenerator {
  private animationFrameId: number | null = null;
  private startTime: number = 0;
  private isRunning: boolean = false;

  // Settings
  private pattern: MovementPattern = 'leftright';
  private frequency: number = 0.1; // Hz
  private width: number = 1; // 0-1

  // Callback for position updates
  private callback: TrajectoryCallback | null = null;

  constructor() {}

  /**
   * Set the movement pattern
   */
  setPattern(pattern: MovementPattern): void {
    this.pattern = pattern;
  }

  /**
   * Set the movement speed (0-100 slider value)
   * Maps to 0.02-0.2 Hz
   */
  setSpeed(value: number): void {
    this.frequency = mapParameterValue(value, PARAMETER_MAPPINGS.travelSpeed);
  }

  /**
   * Set the movement width (0-100)
   */
  setWidth(value: number): void {
    this.width = value / 100;
  }

  /**
   * Set the callback for position updates
   */
  onUpdate(callback: TrajectoryCallback): void {
    this.callback = callback;
  }

  /**
   * Start generating trajectory
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = performance.now();
    this.tick();
  }

  /**
   * Stop generating trajectory
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Get current position at a specific time
   */
  getPositionAtTime(timeMs: number): { position: number; x: number; y: number } {
    const timeSeconds = timeMs / 1000;
    const phase = timeSeconds * this.frequency * Math.PI * 2;

    let position: number;
    let x: number;
    let y: number;

    switch (this.pattern) {
      case 'leftright':
        // Simple sine wave left-right
        position = Math.sin(phase) * this.width;
        x = position;
        y = 0;
        break;

      case 'circular':
        // Circular motion around the listener
        x = Math.sin(phase) * this.width;
        y = Math.cos(phase) * this.width;
        position = x; // Primary pan position is X
        break;

      case 'figure8':
        // Figure-8 pattern (Lissajous curve)
        x = Math.sin(phase) * this.width;
        y = Math.sin(phase * 2) * this.width * 0.5;
        position = x;
        break;

      default:
        position = 0;
        x = 0;
        y = 0;
    }

    return { position, x, y };
  }

  private tick = (): void => {
    if (!this.isRunning) return;

    const elapsed = performance.now() - this.startTime;
    const { position, x, y } = this.getPositionAtTime(elapsed);

    if (this.callback) {
      this.callback(position, x, y);
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  /**
   * Check if generator is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current settings
   */
  getSettings(): { pattern: MovementPattern; frequency: number; width: number } {
    return {
      pattern: this.pattern,
      frequency: this.frequency,
      width: this.width,
    };
  }

  /**
   * Dispose of the generator
   */
  dispose(): void {
    this.stop();
    this.callback = null;
  }
}
