/**
 * SliderControl Component
 * Reusable slider with label, value display, and touch-friendly design
 */

'use client';

import * as React from 'react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface SliderControlProps {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

export function SliderControl({
  label,
  description,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  showValue = true,
  formatValue,
  disabled = false,
  className,
}: SliderControlProps) {
  // Debounce the onChange to prevent too many updates
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleChange = React.useCallback(
    (newValue: number[]) => {
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Debounce updates (16ms = ~60fps)
      timeoutRef.current = setTimeout(() => {
        onChange(newValue[0]);
      }, 16);
    },
    [onChange]
  );

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Format the display value
  const displayValue = React.useMemo(() => {
    if (formatValue) {
      return formatValue(value);
    }
    return `${Math.round(value)}${unit}`;
  }, [value, unit, formatValue]);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <label className="text-sm font-medium text-foreground">{label}</label>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {showValue && (
          <span className="text-sm font-mono text-muted-foreground min-w-[3rem] text-right">
            {displayValue}
          </span>
        )}
      </div>
      <Slider
        value={[value]}
        onValueChange={handleChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={cn(
          'w-full',
          // Touch-friendly: larger touch target
          '[&_[data-radix-slider-thumb]]:h-6 [&_[data-radix-slider-thumb]]:w-6',
          '[&_[data-radix-slider-thumb]]:touch-none',
          // Hover effect
          '[&_[data-radix-slider-thumb]]:hover:scale-110 [&_[data-radix-slider-thumb]]:transition-transform',
          // Active state
          '[&_[data-radix-slider-thumb]]:active:scale-95',
          // Track styling
          '[&_[data-radix-slider-track]]:h-2',
          '[&_[data-radix-slider-range]]:bg-gradient-to-r [&_[data-radix-slider-range]]:from-primary [&_[data-radix-slider-range]]:to-accent'
        )}
      />
    </div>
  );
}

export default SliderControl;
