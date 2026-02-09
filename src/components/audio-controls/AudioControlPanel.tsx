/**
 * AudioControlPanel Component
 * Main control panel for real-time audio effect adjustments
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { UserAudioSettings, EffectMode } from '@/lib/audio';
import { EffectModeSelector } from './EffectModeSelector';
import { SoundQualityControls } from './SoundQualityControls';
import { SpatialControls } from './SpatialControls';
import { BilateralControls } from './BilateralControls';
import { HaasControls } from './HaasControls';
import { UndoResetControls } from './UndoResetControls';
import { SliderControl } from './SliderControl';
import { PARAMETER_LABELS } from '@/lib/audio';
import { ChevronDown, ChevronUp, Sliders, Volume2, Sparkles } from 'lucide-react';

interface AudioControlPanelProps {
  settings: UserAudioSettings;
  onSettingsChange: <K extends keyof UserAudioSettings>(
    param: K,
    value: UserAudioSettings[K]
  ) => void;
  onModeChange: (mode: EffectMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
  className?: string;
}

export function AudioControlPanel({
  settings,
  onSettingsChange,
  onModeChange,
  onUndo,
  onRedo,
  onReset,
  canUndo,
  canRedo,
  disabled = false,
  className,
}: AudioControlPanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // Render mode-specific controls
  const renderModeControls = () => {
    switch (settings.mode) {
      case '8d-spatial':
        return (
          <SpatialControls
            travelSpeed={settings.travelSpeed}
            effectIntensity={settings.effectIntensity}
            travelWidth={settings.travelWidth}
            spatialDepth={settings.spatialDepth}
            movementPattern={settings.movementPattern}
            onTravelSpeedChange={(v) => onSettingsChange('travelSpeed', v)}
            onEffectIntensityChange={(v) => onSettingsChange('effectIntensity', v)}
            onTravelWidthChange={(v) => onSettingsChange('travelWidth', v)}
            onSpatialDepthChange={(v) => onSettingsChange('spatialDepth', v)}
            onMovementPatternChange={(p) => onSettingsChange('movementPattern', p)}
            disabled={disabled}
          />
        );

      case 'bilateral':
        return (
          <BilateralControls
            bilateralType={settings.bilateralType}
            bilateralFrequency={settings.bilateralFrequency}
            travelWidth={settings.travelWidth}
            spatialDepth={settings.spatialDepth}
            onBilateralTypeChange={(t) => onSettingsChange('bilateralType', t)}
            onBilateralFrequencyChange={(v) => onSettingsChange('bilateralFrequency', v)}
            onTravelWidthChange={(v) => onSettingsChange('travelWidth', v)}
            onSpatialDepthChange={(v) => onSettingsChange('spatialDepth', v)}
            disabled={disabled}
          />
        );

      case 'emdr':
        return (
          <BilateralControls
            bilateralType={settings.bilateralType}
            bilateralFrequency={settings.bilateralFrequency}
            travelWidth={settings.travelWidth}
            spatialDepth={settings.spatialDepth}
            onBilateralTypeChange={(t) => onSettingsChange('bilateralType', t)}
            onBilateralFrequencyChange={(v) => onSettingsChange('bilateralFrequency', v)}
            onTravelWidthChange={(v) => onSettingsChange('travelWidth', v)}
            onSpatialDepthChange={(v) => onSettingsChange('spatialDepth', v)}
            isEMDR={true}
            disabled={disabled}
          />
        );

      case 'haas':
        return (
          <HaasControls
            haasDelay={settings.haasDelay}
            leadEar={settings.leadEar}
            spatialDepth={settings.spatialDepth}
            onHaasDelayChange={(v) => onSettingsChange('haasDelay', v)}
            onLeadEarChange={(e) => onSettingsChange('leadEar', e)}
            onSpatialDepthChange={(v) => onSettingsChange('spatialDepth', v)}
            disabled={disabled}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-2xl overflow-hidden',
        'transition-all duration-300',
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b border-border/50 cursor-pointer hover:bg-secondary/20 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 rounded-lg bg-secondary">
            <Sliders className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
          </div>
          <div>
            <span className="text-sm sm:text-base font-semibold">Audio Controls</span>
            <p className="text-xs text-muted-foreground hidden sm:block">Customize your audio experience</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <UndoResetControls
            onUndo={onUndo}
            onRedo={onRedo}
            onReset={onReset}
            canUndo={canUndo}
            canRedo={canRedo}
            disabled={disabled}
          />
          <div className="p-1.5 rounded-md hover:bg-secondary/50 transition-colors">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-5 sm:space-y-6">
          {/* Mode Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">Effect Mode</span>
            </div>
            <EffectModeSelector
              mode={settings.mode}
              onModeChange={onModeChange}
              disabled={disabled}
            />
          </div>

          {/* Master Volume */}
          <div className="flex items-center gap-3 p-3 sm:p-4 bg-secondary/50 rounded-xl border border-border">
            <div className="p-2 rounded-lg bg-secondary">
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
            </div>
            <SliderControl
              label={PARAMETER_LABELS.masterVolume.label}
              value={settings.masterVolume}
              onChange={(v) => onSettingsChange('masterVolume', v)}
              disabled={disabled}
              unit="%"
              className="flex-1"
            />
          </div>

          {/* Mode-specific Controls */}
          <div className="pt-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border/50" />
              <span className="text-xs font-medium text-muted-foreground px-2">Effect Settings</span>
              <div className="h-px flex-1 bg-border/50" />
            </div>
            {renderModeControls()}
          </div>

          {/* Advanced Controls Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAdvanced(!showAdvanced);
            }}
            className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2 rounded-lg hover:bg-secondary/30"
          >
            {showAdvanced ? (
              <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4" />
            ) : (
              <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />
            )}
            <span>{showAdvanced ? 'Hide' : 'Show'} Sound Quality (EQ)</span>
          </button>

          {/* Sound Quality Controls (Advanced) */}
          {showAdvanced && (
            <div className="pt-3 border-t border-border/50 animate-fade-in">
              <SoundQualityControls
                bassWarmth={settings.bassWarmth}
                clarity={settings.clarity}
                airBrightness={settings.airBrightness}
                onBassWarmthChange={(v) => onSettingsChange('bassWarmth', v)}
                onClarityChange={(v) => onSettingsChange('clarity', v)}
                onAirBrightnessChange={(v) => onSettingsChange('airBrightness', v)}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AudioControlPanel;
