/**
 * SpatialControls Component
 * Controls for 8D spatial audio: Speed, Intensity, Width, Depth, Pattern
 */

'use client';

import * as React from 'react';
import { SliderControl } from './SliderControl';
import { PARAMETER_LABELS, MOVEMENT_PATTERN_LABELS, MovementPattern } from '@/lib/audio';
import { cn } from '@/lib/utils';

interface SpatialControlsProps {
  travelSpeed: number;
  effectIntensity: number;
  travelWidth: number;
  spatialDepth: number;
  movementPattern: MovementPattern;
  onTravelSpeedChange: (value: number) => void;
  onEffectIntensityChange: (value: number) => void;
  onTravelWidthChange: (value: number) => void;
  onSpatialDepthChange: (value: number) => void;
  onMovementPatternChange: (pattern: MovementPattern) => void;
  disabled?: boolean;
  className?: string;
}

export function SpatialControls({
  travelSpeed,
  effectIntensity,
  travelWidth,
  spatialDepth,
  movementPattern,
  onTravelSpeedChange,
  onEffectIntensityChange,
  onTravelWidthChange,
  onSpatialDepthChange,
  onMovementPatternChange,
  disabled = false,
  className,
}: SpatialControlsProps) {
  const patterns: MovementPattern[] = ['leftright', 'circular', 'figure8'];

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
        Spatial Movement
      </h3>

      <div className="space-y-5">
        {/* Movement Pattern Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {PARAMETER_LABELS.movementPattern.label}
          </label>
          <p className="text-xs text-muted-foreground">
            {PARAMETER_LABELS.movementPattern.description}
          </p>
          <div className="flex gap-2 mt-2">
            {patterns.map((pattern) => (
              <button
                key={pattern}
                onClick={() => onMovementPatternChange(pattern)}
                disabled={disabled}
                className={cn(
                  'flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all',
                  'border border-border',
                  movementPattern === pattern
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {MOVEMENT_PATTERN_LABELS[pattern].label}
              </button>
            ))}
          </div>
        </div>

        <SliderControl
          label={PARAMETER_LABELS.travelSpeed.label}
          description={PARAMETER_LABELS.travelSpeed.description}
          value={travelSpeed}
          onChange={onTravelSpeedChange}
          disabled={disabled}
          formatValue={(v) => {
            // Map 0-100 to descriptive labels
            if (v < 20) return 'Very Slow';
            if (v < 40) return 'Slow';
            if (v < 60) return 'Medium';
            if (v < 80) return 'Fast';
            return 'Very Fast';
          }}
        />

        <SliderControl
          label={PARAMETER_LABELS.effectIntensity.label}
          description={PARAMETER_LABELS.effectIntensity.description}
          value={effectIntensity}
          onChange={onEffectIntensityChange}
          disabled={disabled}
          unit="%"
        />

        <SliderControl
          label={PARAMETER_LABELS.travelWidth.label}
          description={PARAMETER_LABELS.travelWidth.description}
          value={travelWidth}
          onChange={onTravelWidthChange}
          disabled={disabled}
          unit="%"
        />

        <SliderControl
          label={PARAMETER_LABELS.spatialDepth.label}
          description={PARAMETER_LABELS.spatialDepth.description}
          value={spatialDepth}
          onChange={onSpatialDepthChange}
          disabled={disabled}
          unit="%"
        />
      </div>
    </div>
  );
}

export default SpatialControls;
