/**
 * HaasControls Component
 * Controls for Haas effect stereo widening: Delay and lead ear
 */

'use client';

import * as React from 'react';
import { SliderControl } from './SliderControl';
import { PARAMETER_LABELS, LeadEar } from '@/lib/audio';
import { cn } from '@/lib/utils';

interface HaasControlsProps {
  haasDelay: number;
  leadEar: LeadEar;
  spatialDepth: number;
  onHaasDelayChange: (value: number) => void;
  onLeadEarChange: (ear: LeadEar) => void;
  onSpatialDepthChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export function HaasControls({
  haasDelay,
  leadEar,
  spatialDepth,
  onHaasDelayChange,
  onLeadEarChange,
  onSpatialDepthChange,
  disabled = false,
  className,
}: HaasControlsProps) {
  const ears: { value: LeadEar; label: string }[] = [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
        Stereo Width (Haas Effect)
      </h3>

      <div className="space-y-5">
        <SliderControl
          label={PARAMETER_LABELS.haasDelay.label}
          description={PARAMETER_LABELS.haasDelay.description}
          value={haasDelay}
          onChange={onHaasDelayChange}
          disabled={disabled}
          formatValue={(v) => {
            // Map 0-100 to 5-60ms
            const ms = 5 + (v / 100) * 55;
            return `${ms.toFixed(0)}ms`;
          }}
        />

        {/* Lead Ear Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {PARAMETER_LABELS.leadEar.label}
          </label>
          <p className="text-xs text-muted-foreground">
            {PARAMETER_LABELS.leadEar.description}
          </p>
          <div className="flex gap-2 mt-2">
            {ears.map((ear) => (
              <button
                key={ear.value}
                onClick={() => onLeadEarChange(ear.value)}
                disabled={disabled}
                className={cn(
                  'flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                  'border border-border',
                  leadEar === ear.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {ear.label}
              </button>
            ))}
          </div>
        </div>

        <SliderControl
          label={PARAMETER_LABELS.spatialDepth.label}
          description={PARAMETER_LABELS.spatialDepth.description}
          value={spatialDepth}
          onChange={onSpatialDepthChange}
          disabled={disabled}
          unit="%"
        />

        <div className="p-3 bg-secondary/30 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Haas Effect:</strong> Creates a wider stereo
            image by slightly delaying one channel. The brain perceives the sound as coming
            from the leading ear while maintaining a natural, spacious feel.
          </p>
        </div>
      </div>
    </div>
  );
}

export default HaasControls;
