/**
 * EffectModeSelector Component
 * Tabs for selecting between 8D Spatial, Bilateral, EMDR, and Haas modes
 */

'use client';

import * as React from 'react';
import { EffectMode, MODE_LABELS } from '@/lib/audio';
import { cn } from '@/lib/utils';
import { Headphones, Brain, Zap, Radio, ChevronLeft, ChevronRight } from 'lucide-react';

interface EffectModeSelectorProps {
  mode: EffectMode;
  onModeChange: (mode: EffectMode) => void;
  disabled?: boolean;
  className?: string;
}

const MODE_ICONS: Record<EffectMode, React.ReactNode> = {
  '8d-spatial': <Headphones className="w-4 h-4" />,
  'bilateral': <Brain className="w-4 h-4" />,
  'emdr': <Zap className="w-4 h-4" />,
  'haas': <Radio className="w-4 h-4" />,
};

const MODES: EffectMode[] = ['8d-spatial', 'bilateral', 'emdr', 'haas'];

export function EffectModeSelector({
  mode,
  onModeChange,
  disabled = false,
  className,
}: EffectModeSelectorProps) {
  const currentIndex = MODES.indexOf(mode);

  const goToPrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : MODES.length - 1;
    onModeChange(MODES[newIndex]);
  };

  const goToNext = () => {
    const newIndex = currentIndex < MODES.length - 1 ? currentIndex + 1 : 0;
    onModeChange(MODES[newIndex]);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Mobile: Swipeable mode selector with arrows */}
      <div className="sm:hidden">
        <div className="flex items-center gap-2 p-1 bg-secondary/30 rounded-lg">
          <button
            onClick={goToPrevious}
            disabled={disabled}
            className={cn(
              'p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Previous mode"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => {}}
            disabled={disabled}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-md transition-all',
              'bg-primary text-primary-foreground shadow-sm',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {MODE_ICONS[mode]}
            <span>{MODE_LABELS[mode].name}</span>
          </button>

          <button
            onClick={goToNext}
            disabled={disabled}
            className={cn(
              'p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Next mode"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mode indicator dots */}
        <div className="flex justify-center gap-1.5 mt-2">
          {MODES.map((m, index) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              disabled={disabled}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                index === currentIndex
                  ? 'bg-primary scale-110'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50',
                disabled && 'cursor-not-allowed'
              )}
              aria-label={MODE_LABELS[m].name}
            />
          ))}
        </div>
      </div>

      {/* Desktop: Tab buttons */}
      <div className="hidden sm:flex gap-1 p-1 bg-secondary/30 rounded-lg">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            disabled={disabled}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-all',
              mode === m
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {MODE_ICONS[m]}
            <span>{MODE_LABELS[m].name}</span>
          </button>
        ))}
      </div>

      {/* Mode description */}
      <p className="text-xs text-muted-foreground text-center px-2">
        {MODE_LABELS[mode].description}
      </p>
    </div>
  );
}

export default EffectModeSelector;
