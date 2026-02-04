/**
 * Performance Monitoring System
 * Tracks timing, memory usage, and performance metrics
 */

import { analytics } from './analytics';

interface PerformanceMetric {
  label: string;
  duration: number;
  timestamp: string;
}

class PerformanceMonitor {
  private timers: Map<string, number> = new Map();
  private metrics: PerformanceMetric[] = [];
  private isDebugMode: boolean;

  constructor() {
    // Check for debug mode (only on client-side)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      this.isDebugMode = urlParams.get('debug') === 'true' || 
                         localStorage.getItem('debug_mode') === 'true';
    } else {
      this.isDebugMode = false;
    }
  }

  /**
   * Start a performance timer
   */
  startTimer(label: string): void {
    if (typeof window === 'undefined') return;
    
    this.timers.set(label, performance.now());
    
    if (this.isDebugMode) {
      console.log(`[Performance] Timer started: ${label}`);
    }
  }

  /**
   * End a performance timer and log the duration
   */
  endTimer(label: string): number | null {
    if (typeof window === 'undefined') return null;
    
    const startTime = this.timers.get(label);
    
    if (!startTime) {
      console.warn(`[Performance] Timer "${label}" was not started`);
      return null;
    }

    const duration = performance.now() - startTime;
    const metric: PerformanceMetric = {
      label,
      duration,
      timestamp: new Date().toISOString(),
    };

    this.metrics.push(metric);
    this.timers.delete(label);

    if (this.isDebugMode) {
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    }

    // Track in analytics
    analytics.track('performance_metric', {
      metric: label,
      duration: Math.round(duration),
    });

    return duration;
  }

  /**
   * Measure a function's execution time
   */
  async measure<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
    this.startTimer(label);
    try {
      const result = await fn();
      this.endTimer(label);
      return result;
    } catch (error) {
      this.endTimer(label);
      throw error;
    }
  }

  /**
   * Get memory usage (if available)
   */
  getMemoryUsage(): { used: number; total: number; percentage: number } | null {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      const used = memory.usedJSHeapSize / 1024 / 1024; // MB
      const total = memory.jsHeapSizeLimit / 1024 / 1024; // MB
      const percentage = (used / total) * 100;

      return {
        used: Math.round(used),
        total: Math.round(total),
        percentage: Math.round(percentage),
      };
    }
    return null;
  }

  /**
   * Log memory usage
   */
  logMemoryUsage(label: string = 'Memory'): void {
    const memory = this.getMemoryUsage();
    if (memory && this.isDebugMode) {
      console.log(
        `[Performance] ${label}: ${memory.used}MB / ${memory.total}MB (${memory.percentage}%)`
      );
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetric[] {
    return this.metrics;
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Get average duration for a metric
   */
  getAverageDuration(label: string): number | null {
    const labelMetrics = this.metrics.filter(m => m.label === label);
    if (labelMetrics.length === 0) return null;

    const total = labelMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / labelMetrics.length;
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const report: string[] = ['=== Performance Report ===\n'];

    // Group metrics by label
    const grouped = new Map<string, number[]>();
    this.metrics.forEach(metric => {
      if (!grouped.has(metric.label)) {
        grouped.set(metric.label, []);
      }
      grouped.get(metric.label)!.push(metric.duration);
    });

    // Calculate stats for each label
    grouped.forEach((durations, label) => {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      
      report.push(`${label}:`);
      report.push(`  Count: ${durations.length}`);
      report.push(`  Average: ${avg.toFixed(2)}ms`);
      report.push(`  Min: ${min.toFixed(2)}ms`);
      report.push(`  Max: ${max.toFixed(2)}ms\n`);
    });

    // Memory usage
    const memory = this.getMemoryUsage();
    if (memory) {
      report.push('Memory Usage:');
      report.push(`  Used: ${memory.used}MB`);
      report.push(`  Total: ${memory.total}MB`);
      report.push(`  Percentage: ${memory.percentage}%\n`);
    }

    return report.join('\n');
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    
    this.isDebugMode = enabled;
    localStorage.setItem('debug_mode', enabled ? 'true' : 'false');
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience wrapper for measuring async operations
export async function measureAsync<T>(
  label: string,
  operation: () => Promise<T>
): Promise<T> {
  return performanceMonitor.measure(label, operation);
}

// Convenience wrapper for measuring sync operations
export function measureSync<T>(
  label: string,
  operation: () => T
): T {
  performanceMonitor.startTimer(label);
  try {
    const result = operation();
    performanceMonitor.endTimer(label);
    return result;
  } catch (error) {
    performanceMonitor.endTimer(label);
    throw error;
  }
}
