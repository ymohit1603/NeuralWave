'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Brain, Download, Play, Pause, RotateCcw, X, Lock, Settings2, Loader2 } from "lucide-react";
import { processAudio, exportAsMP3, exportAsWAV, estimateProcessingTime, type UserProfile } from "@/lib/audioProcessor";
import { renderAudioWithSettings } from "@/lib/audio/exportWithSettings";
import { useToast } from "@/hooks/use-toast";
import { AuthModal } from "@/components/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import { AudioControlPanel } from "@/components/audio-controls";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { UserAudioSettings, EffectMode } from "@/lib/audio";

interface AudioProcessorProps {
  fileName: string;
  audioBuffer: AudioBuffer | null;
  userProfile: UserProfile;
  onComplete: (processedBuffer: AudioBuffer) => void;
  onReset: () => void;
  onSaveTrack?: (settings: UserAudioSettings, processedBuffer: AudioBuffer) => Promise<void>;
  initialSettings?: UserAudioSettings | null;
  trackId?: string | null;
}

export function AudioProcessor({
  fileName,
  audioBuffer,
  userProfile,
  onComplete,
  onReset,
  onSaveTrack,
  initialSettings,
  trackId,
}: AudioProcessorProps) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Initializing...");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [useRealTimeEngine] = useState(true);
  const [hasSavedTrack, setHasSavedTrack] = useState(!!trackId);
  const [isExporting, setIsExporting] = useState(false);

  const { user } = useAuth();
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const hasStartedProcessingRef = useRef(false);
  const hasCompletedProcessingRef = useRef(false);
  const isMountedRef = useRef(true);
  const processingRunIdRef = useRef(0);
  const appliedInitialSettingsKeyRef = useRef<string | null>(null);

  const { toast } = useToast();

  // Real-time audio engine hook
  const audioEngine = useAudioEngine({
    onTimeUpdate: (time, dur) => {
      if (useRealTimeEngine) {
        setCurrentTime(time);
        setDuration(dur);
      }
    },
    onStateChange: (state) => {
      if (useRealTimeEngine) {
        setIsPlaying(state === 'playing');
      }
    },
    onError: (err) => {
      toast({
        title: "Audio Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Initialize audio context
  useEffect(() => {
    isMountedRef.current = true;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    return () => {
      isMountedRef.current = false;
      processingRunIdRef.current += 1;
      hasStartedProcessingRef.current = false;
      hasCompletedProcessingRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      cleanup();
      audioEngine.engine?.dispose();
    };
  }, []);

  // Load audio into real-time engine when buffer is available
  useEffect(() => {
    if (audioBuffer && audioEngine.engine) {
      audioEngine.loadBuffer(audioBuffer).catch(console.error);
    }
  }, [audioBuffer, audioEngine.engine]);

  // Apply initial settings once when loading a saved track.
  useEffect(() => {
    if (!initialSettings || !audioEngine.engine || !audioEngine.isReady) {
      return;
    }

    const settingsKey = trackId || `file:${fileName}`;
    if (appliedInitialSettingsKeyRef.current === settingsKey) {
      return;
    }

    // Validate settings before applying
    if (typeof initialSettings.bassWarmth === 'number' &&
      typeof initialSettings.clarity === 'number') {
      audioEngine.applySettings(initialSettings);
      appliedInitialSettingsKeyRef.current = settingsKey;
    }
  }, [initialSettings, audioEngine.engine, audioEngine.isReady, trackId, fileName]);

  // If we have a trackId, mark as already complete (loading saved track)
  useEffect(() => {
    if (trackId && audioBuffer && !isComplete && !isProcessing) {
      setIsComplete(true);
      setHasSavedTrack(true);
      hasCompletedProcessingRef.current = true;
    }
  }, [trackId, audioBuffer]);

  // Start processing automatically
  useEffect(() => {
    if (!audioBuffer || trackId || hasStartedProcessingRef.current || isComplete || processedBuffer) {
      return;
    }

    hasStartedProcessingRef.current = true;
    void startProcessing();

    return () => {
      // StrictMode invokes effect cleanup immediately in development.
      // Reset this flag so the second setup can start a fresh run.
      hasStartedProcessingRef.current = false;
    };
  }, [audioBuffer, trackId, isComplete, processedBuffer]);

  const cleanup = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {
        // Already stopped
      }
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const startProcessing = async () => {
    if (!audioBuffer) return;

    const runId = ++processingRunIdRef.current;
    setIsProcessing(true);
    setError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const processed = await processAudio(
        audioBuffer,
        userProfile,
        (progressData) => {
          if (!isMountedRef.current) return;
          setStage(progressData.stage);
          setProgress(progressData.progress);
        },
        controller.signal
      );

      if (
        !isMountedRef.current ||
        processingRunIdRef.current !== runId ||
        controller.signal.aborted ||
        hasCompletedProcessingRef.current
      ) {
        return;
      }

      hasCompletedProcessingRef.current = true;
      setProcessedBuffer(processed);
      setIsProcessing(false);
      setIsComplete(true);
      onComplete(processed);

      toast({
        title: "🧠 Neural Optimization Complete!",
        description: "Your brain-activating audio is ready.",
      });

    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }

      const errorMessage = (err as Error).message;
      const wasCancelled = controller.signal.aborted || errorMessage.includes('cancelled');

      // Ignore stale/aborted runs (e.g. StrictMode cleanup pass).
      if (processingRunIdRef.current !== runId) {
        return;
      }

      if (wasCancelled) {
        setError('Processing cancelled');
        toast({
          title: "Processing cancelled",
          description: "Audio processing was stopped.",
        });
      } else {
        setError(errorMessage);
        toast({
          title: "Processing failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
      setIsProcessing(false);
    } finally {
      if (processingRunIdRef.current === runId) {
        abortControllerRef.current = null;
      }
    }
  };

  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      processingRunIdRef.current += 1;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      hasStartedProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const togglePlayback = () => {
    // Use real-time engine
    if (useRealTimeEngine && audioBuffer) {
      if (audioEngine.isPlaying) {
        audioEngine.pause();
      } else {
        // Initialize engine if needed
        audioEngine.initialize().then(() => {
          audioEngine.play();
        });
      }
      return;
    }

    // Legacy playback (fallback)
    if (!audioContextRef.current) return;

    const bufferToPlay = processedBuffer;
    if (!bufferToPlay) return;

    if (isPlaying) {
      cleanup();
    } else {
      // Set duration
      setDuration(bufferToPlay.duration);

      sourceNodeRef.current = audioContextRef.current.createBufferSource();
      sourceNodeRef.current.buffer = bufferToPlay;
      sourceNodeRef.current.connect(audioContextRef.current.destination);
      sourceNodeRef.current.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };

      startTimeRef.current = audioContextRef.current.currentTime - currentTime;
      sourceNodeRef.current.start(0, currentTime);
      setIsPlaying(true);

      // Track playback time
      updatePlaybackTime();
    }
  };

  const seekTo = (time: number) => {
    // Use real-time engine
    if (useRealTimeEngine) {
      audioEngine.seek(time);
      return;
    }

    // Legacy seek
    const wasPlaying = isPlaying;

    if (isPlaying) {
      cleanup();
    }

    setCurrentTime(time);

    if (wasPlaying) {
      // Restart playback from new position
      setTimeout(() => {
        if (!audioContextRef.current) return;

        const bufferToPlay = processedBuffer;
        if (!bufferToPlay) return;

        sourceNodeRef.current = audioContextRef.current.createBufferSource();
        sourceNodeRef.current.buffer = bufferToPlay;
        sourceNodeRef.current.connect(audioContextRef.current.destination);
        sourceNodeRef.current.onended = () => {
          setIsPlaying(false);
          setCurrentTime(0);
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
        };

        startTimeRef.current = audioContextRef.current.currentTime - time;
        sourceNodeRef.current.start(0, time);
        setIsPlaying(true);
        updatePlaybackTime();
      }, 10);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const updatePlaybackTime = () => {
    if (!audioContextRef.current || !isPlaying) return;

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
    setCurrentTime(elapsed);

    animationFrameRef.current = requestAnimationFrame(updatePlaybackTime);
  };

  const handleDownload = async (format: 'mp3' | 'wav' = 'mp3') => {
    console.log(`[Download] Starting download process (${format.toUpperCase()})...`);
    console.log('[Download] Current settings:', audioEngine.settings);
    
    if (!user) {
      setShowAuthModal(true);
      toast({
        title: "Sign in to download",
        description: "Create a free account to download your audio.",
      });
      return;
    }

    const sourceForExport = processedBuffer || audioBuffer;
    if (!sourceForExport) {
      console.error('[Download] No audio buffer available');
      toast({
        title: "Download unavailable",
        description: "Audio is not ready yet.",
        variant: "destructive",
      });
      return;
    }

    console.log('[Download] Source buffer:', {
      duration: sourceForExport.duration,
      sampleRate: sourceForExport.sampleRate,
      channels: sourceForExport.numberOfChannels,
      length: sourceForExport.length
    });

    setIsExporting(true);
    const startTime = performance.now();
    
    try {
      console.log('[Download] Rendering audio with settings...');
      console.log('[Download] Settings being applied:', JSON.stringify(audioEngine.settings, null, 2));
      
      const rendered = await renderAudioWithSettings(sourceForExport, audioEngine.settings);
      
      const renderTime = performance.now() - startTime;
      console.log(`[Download] Rendering completed in ${renderTime.toFixed(0)}ms`);
      console.log('[Download] Rendered buffer:', {
        duration: rendered.duration,
        sampleRate: rendered.sampleRate,
        channels: rendered.numberOfChannels,
        length: rendered.length
      });
      
      console.log(`[Download] Starting ${format.toUpperCase()} export...`);
      
      if (format === 'wav') {
        exportAsWAV(rendered, fileName);
      } else {
        exportAsMP3(rendered, fileName);
      }
      
      const totalTime = performance.now() - startTime;
      console.log(`[Download] Total download process completed in ${totalTime.toFixed(0)}ms`);
      
      toast({
        title: "Download started",
        description: `Your ${format.toUpperCase()} file with current settings is downloading.`,
      });

      if (hasSavedTrack && onSaveTrack) {
        await onSaveTrack(audioEngine.settings, sourceForExport);
      }
    } catch (error) {
      console.error("[Download] Download render failed:", error);
      console.error("[Download] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      toast({
        title: "Download failed",
        description: "Could not render audio with current settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleReset = () => {
    cleanup();
    cancelProcessing();
    audioEngine.stop();
    onReset();
  };

  // Handle settings changes from control panel
  const handleSettingsChange = useCallback(<K extends keyof UserAudioSettings>(
    param: K,
    value: UserAudioSettings[K]
  ) => {
    audioEngine.updateParameter(param, value);

    // Auto-save settings for existing saved tracks.
    const bufferForSave = processedBuffer || audioBuffer;
    if (hasSavedTrack && onSaveTrack && bufferForSave) {
      // Get updated settings after the parameter change
      const updatedSettings = { ...audioEngine.settings, [param]: value };
      onSaveTrack(updatedSettings, bufferForSave).catch(console.error);
    }
  }, [audioEngine, hasSavedTrack, onSaveTrack, processedBuffer, audioBuffer]);

  const handleModeChange = useCallback((mode: EffectMode) => {
    audioEngine.setMode(mode);

    const bufferForSave = processedBuffer || audioBuffer;
    if (hasSavedTrack && onSaveTrack && bufferForSave) {
      const updatedSettings = { ...audioEngine.settings, mode };
      onSaveTrack(updatedSettings, bufferForSave).catch(console.error);
    }
  }, [audioEngine, hasSavedTrack, onSaveTrack, processedBuffer, audioBuffer]);

  // Generate wave bars for visualization
  const waveBars = Array.from({ length: 40 }, (_, i) => i);
  const estimatedTime = audioBuffer ? estimateProcessingTime(audioBuffer.duration) : '';

  return (
    <div className="w-full max-w-full space-y-4">
      {/* Audio Control Panel - shown ABOVE the player when controls are toggled */}
      {isComplete && showControls && (
        <AudioControlPanel
          settings={audioEngine.settings}
          onSettingsChange={handleSettingsChange}
          onModeChange={handleModeChange}
          onUndo={audioEngine.undo}
          onRedo={audioEngine.redo}
          onReset={audioEngine.reset}
          canUndo={audioEngine.canUndo}
          canRedo={audioEngine.canRedo}
          disabled={isProcessing || !isComplete}
        />
      )}

      <div className="p-4 sm:p-6 md:p-8 rounded-2xl bg-card border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className={`p-2 sm:p-3 rounded-xl bg-primary flex-shrink-0 ${isProcessing ? '' : ''
            }`}>
            <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base sm:text-lg truncate">{fileName}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {error ? error : isComplete ? "Ready to experience" : stage}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isComplete && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowControls(!showControls)}
                  className={showControls ? 'bg-secondary' : ''}
                  title="Audio Controls"
                >
                  <Settings2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Waveform visualization */}
        <div className="relative h-24 sm:h-32 mb-4 sm:mb-6 flex items-center justify-center gap-[2px] overflow-hidden">
          {waveBars.map((i) => (
            <div
              key={i}
              className={`w-1 sm:w-1.5 rounded-full transition-all duration-150 ${isComplete
                ? 'bg-foreground'
                : 'bg-foreground/30'
                }`}
              style={{
                height: isComplete
                  ? `${30 + Math.sin(i * 0.5) * 20 + Math.random() * 30}%`
                  : `${20 + Math.sin(i * 0.3 + progress * 0.1) * 40}%`,
                opacity: isComplete ? 1 : 0.3 + (progress / 100) * 0.7,
                animationDelay: `${i * 0.05}s`,
                animation: isProcessing ? 'wave-bar 1.2s ease-in-out infinite' : 'none',
              }}
            />
          ))}

          {/* Scanning line animation */}
          {isProcessing && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-foreground/30 opacity-60"
              style={{
                left: `${progress}%`,
                transition: 'left 300ms linear',
              }}
            />
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-4 sm:mb-6">
          <div className="flex justify-between text-xs sm:text-sm mb-2">
            <span className="text-muted-foreground truncate">
              {error ? "Processing Failed" : isComplete ? "Processing Complete" : "Processing..."}
            </span>
            <span className="font-medium flex-shrink-0 ml-2">
              {error ? "" : isComplete ? "100%" : `${Math.round(progress)}%`}
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${error ? 'bg-destructive' : 'bg-foreground'
                }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {isProcessing && !error && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Estimated time: {estimatedTime}
            </p>
          )}
        </div>

        {/* Cancel button during processing (hide when complete) */}
        {isProcessing && !error && !isComplete && (
          <div className="flex justify-center mb-4">
            <Button variant="outline" onClick={cancelProcessing} className="gap-2 text-sm">
              <X className="w-4 h-4" />
              Cancel Processing
            </Button>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex justify-center gap-3 mb-4">
            <Button variant="outline" onClick={handleReset} className="text-sm">
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {/* Completed state - Player controls */}
        {isComplete && (
          <div className="space-y-3 sm:space-y-4 animate-fade-in">
            {/* Audio Player */}
            <div className="space-y-3 sm:space-y-4">
              {/* Time and Progress Slider */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground min-w-[35px] sm:min-w-[45px]">
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={(e) => {
                      const newTime = parseFloat(e.target.value);
                      setCurrentTime(newTime);
                      // Seek immediately for smooth scrubbing
                      seekTo(newTime);
                    }}
                    className="flex-1 h-2 bg-secondary rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full
                      [[&::-webkit-slider-thumb]:bg-primary::-webkit-slider-thumb]:bg-foreground
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-webkit-slider-thumb]:shadow-lg
                      [&::-webkit-slider-thumb]:transition-transform
                      [&::-webkit-slider-thumb]:hover:scale-110
                      [&::-webkit-slider-thumb]:active:scale-125
                      [&::-moz-range-thumb]:w-4
                      [&::-moz-range-thumb]:h-4
                      [&::-moz-range-thumb]:rounded-full
                      [[&::-moz-range-thumb]:bg-primary::-moz-range-thumb]:bg-foreground
                      [&::-moz-range-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:shadow-lg
                      [&::-moz-range-thumb]:transition-transform
                      [&::-moz-range-thumb]:hover:scale-110
                      [&::-moz-range-thumb]:active:scale-125"
                    style={{
                      background: `linear-gradient(to right, hsl(var(--foreground)) 0%, hsl(var(--foreground)) ${(currentTime / (duration || 1)) * 100}%, hsl(var(--secondary)) ${(currentTime / (duration || 1)) * 100}%, hsl(var(--secondary)) 100%)`
                    }}
                  />
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground min-w-[35px] sm:min-w-[45px] text-right">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* Play/Pause and Download Controls */}
              <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3">
                <Button
                  variant="neural"
                  size="lg"
                  onClick={togglePlayback}
                  className="gap-2 w-full sm:w-auto sm:min-w-[140px]"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                      Play
                    </>
                  )}
                </Button>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => void handleDownload('mp3')}
                    className="gap-2 flex-1 sm:flex-initial"
                    disabled={isExporting}
                  >
                    {!user && <Lock className="w-3 h-3 sm:w-4 sm:h-4" />}
                    {isExporting ? (
                      <>
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                        <span className="hidden sm:inline">Preparing...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                        MP3
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => void handleDownload('wav')}
                    className="gap-2 flex-1 sm:flex-initial"
                    disabled={isExporting}
                    title="Download uncompressed WAV (larger file, better quality)"
                  >
                    {!user && <Lock className="w-3 h-3 sm:w-4 sm:h-4" />}
                    {isExporting ? (
                      <>
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                        <span className="hidden sm:inline">Preparing...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                        WAV
                      </>
                    )}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handleReset}
                  className="gap-2 w-full sm:w-auto"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                  Create Another Song
                </Button>
              </div>
            </div>

            {/* Benefit reminder */}
            <p className="text-center text-xs sm:text-sm text-foreground mt-3 sm:mt-4">
              {user
                ? 'Signed in: you can download your processed track.'
                : 'Sign in to download your processed track.'
              }
            </p>
          </div>
        )}

        {/* Auth Modal */}
        <AuthModal
          open={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            if (user) {
              // Small delay to ensure auth state is updated
              setTimeout(() => {
                if (useRealTimeEngine) {
                  audioEngine.play();
                }
              }, 500);
            }
          }}
          mode="signup"
          title="Sign In to Download"
          description="Sign in to download and save your music."
        />
      </div>
    </div>
  );
}
