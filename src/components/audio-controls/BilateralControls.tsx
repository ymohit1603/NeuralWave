/**
 * BilateralControls Component
 * Controls for bilateral stimulation: Type toggle and frequency
 */

'use client';

import * as React from 'react';
import { SliderControl } from './SliderControl';
import { PARAMETER_LABELS, BilateralType } from '@/lib/audio';
import { cn } from '@/lib/utils';

interface BilateralControlsProps {
  bilateralType: BilateralType;
  bilateralFrequency: number;
  travelWidth: number;
  spatialDepth: number;
  onBilateralTypeChange: (type: BilateralType) => void;
  onBilateralFrequencyChange: (value: number) => void;
  onTravelWidthChange: (value: number) => void;
  onSpatialDepthChange: (value: number) => void;
  isEMDR?: boolean;
  disabled?: boolean;
  className?: string;
}

export function BilateralControls({
  bilateralType,
  bilateralFrequency,
  travelWidth,
  spatialDepth,
  onBilateralTypeChange,
  onBilateralFrequencyChange,
  onTravelWidthChange,
  onSpatialDepthChange,
  isEMDR = false,
  disabled = false,
  className,
}: BilateralControlsProps) {
  const types: { value: BilateralType; label: string; description: string }[] = [
    {
      value: 'smooth',
      label: 'Smooth',
      description: 'Gradual fade between ears',
    },
    {
      value: 'hard-cut',
      label: 'Hard Cut',
      description: 'Instant switch between ears',
    },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
        {isEMDR ? 'EMDR Settings' : 'Bilateral Stimulation'}
      </h3>

      <div className="space-y-5">
        {/* Transition Type Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {PARAMETER_LABELS.bilateralType.label}
          </label>
          <p className="text-xs text-muted-foreground">
            {PARAMETER_LABELS.bilateralType.description}
          </p>
          <div className="flex gap-2 mt-2">
            {types.map((type) => (
              <button
                key={type.value}
                onClick={() => onBilateralTypeChange(type.value)}
                disabled={disabled}
                className={cn(
                  'flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all',
                  'border border-border',
                  bilateralType === type.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span className="block">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        <SliderControl
          label={PARAMETER_LABELS.bilateralFrequency.label}
          description={PARAMETER_LABELS.bilateralFrequency.description}
          value={bilateralFrequency}
          onChange={onBilateralFrequencyChange}
          disabled={disabled}
          formatValue={(v) => {
            // Map 0-100 to 0.5-2 Hz and display
            const hz = 0.5 + (v / 100) * 1.5;
            return `${hz.toFixed(1)} Hz`;
          }}
        />

        <SliderControl
          label="Pan Width"
          description="How far the sound moves between ears"
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

        {isEMDR && (
          <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
            <p className="text-xs text-muted-foreground">
              <strong className="text-accent">EMDR Mode:</strong> Uses hard-cut bilateral
              stimulation commonly used in Eye Movement Desensitization and Reprocessing
              therapy. Consult a licensed therapist for therapeutic use.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default BilateralControls;
