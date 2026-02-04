/**
 * SoundQualityControls Component
 * Controls for Bass Warmth, Clarity, and Air/Brightness
 */

'use client';

import * as React from 'react';
import { SliderControl } from './SliderControl';
import { PARAMETER_LABELS } from '@/lib/audio';
import { cn } from '@/lib/utils';

interface SoundQualityControlsProps {
  bassWarmth: number;
  clarity: number;
  airBrightness: number;
  onBassWarmthChange: (value: number) => void;
  onClarityChange: (value: number) => void;
  onAirBrightnessChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export function SoundQualityControls({
  bassWarmth,
  clarity,
  airBrightness,
  onBassWarmthChange,
  onClarityChange,
  onAirBrightnessChange,
  disabled = false,
  className,
}: SoundQualityControlsProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
        Sound Quality
      </h3>

      <div className="space-y-5">
        <SliderControl
          label={PARAMETER_LABELS.bassWarmth.label}
          description={PARAMETER_LABELS.bassWarmth.description}
          value={bassWarmth}
          onChange={onBassWarmthChange}
          disabled={disabled}
        />

        <SliderControl
          label={PARAMETER_LABELS.clarity.label}
          description={PARAMETER_LABELS.clarity.description}
          value={clarity}
          onChange={onClarityChange}
          disabled={disabled}
        />

        <SliderControl
          label={PARAMETER_LABELS.airBrightness.label}
          description={PARAMETER_LABELS.airBrightness.description}
          value={airBrightness}
          onChange={onAirBrightnessChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export default SoundQualityControls;
