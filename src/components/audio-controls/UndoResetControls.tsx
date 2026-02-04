/**
 * UndoResetControls Component
 * Undo, Redo, and Reset buttons for audio settings
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Undo2, Redo2, RotateCcw } from 'lucide-react';

interface UndoResetControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
  className?: string;
}

export function UndoResetControls({
  onUndo,
  onRedo,
  onReset,
  canUndo,
  canRedo,
  disabled = false,
  className,
}: UndoResetControlsProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Undo Button */}
      <button
        onClick={onUndo}
        disabled={disabled || !canUndo}
        title="Undo (Ctrl+Z)"
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-lg transition-all',
          'border border-border',
          'text-muted-foreground hover:text-foreground hover:bg-secondary',
          (disabled || !canUndo) && 'opacity-40 cursor-not-allowed hover:bg-transparent'
        )}
      >
        <Undo2 className="w-4 h-4" />
      </button>

      {/* Redo Button */}
      <button
        onClick={onRedo}
        disabled={disabled || !canRedo}
        title="Redo (Ctrl+Shift+Z)"
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-lg transition-all',
          'border border-border',
          'text-muted-foreground hover:text-foreground hover:bg-secondary',
          (disabled || !canRedo) && 'opacity-40 cursor-not-allowed hover:bg-transparent'
        )}
      >
        <Redo2 className="w-4 h-4" />
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* Reset Button */}
      <button
        onClick={onReset}
        disabled={disabled}
        title="Reset to defaults"
        className={cn(
          'flex items-center gap-1.5 px-3 h-9 rounded-lg transition-all',
          'border border-border',
          'text-muted-foreground hover:text-foreground hover:bg-secondary',
          'text-xs font-medium',
          disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
        )}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Reset</span>
      </button>
    </div>
  );
}

export default UndoResetControls;
