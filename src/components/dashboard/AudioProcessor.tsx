'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, Download, Play, Pause, RotateCcw, X, Lock, Settings2 } from "lucide-react";
import { processAudio, exportAsWAV, estimateProcessingTime, type UserProfile } from "@/lib/audioProcessor";
import { useToast } from "@/hooks/use-toast";
import { createPreviewWithFade, PREVIEW_DURATION } from "@/lib/audioPreview";
import { AuthModal } from "@/components/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import { AudioControlPanel } from "@/components/audio-controls";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { UserAudioSettings, EffectMode } from "@/lib/audio";

interface AudioProcessorProps {
  fileName: string;
  audioBuffer: AudioBuffer | null;
  userProfile: UserProfile;
  onComplete: () => void;
  onReset: () => void;
  onSaveTrack?: (settings: UserAudioSettings) => Promise<void>;
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
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Initializing...");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<"original" | "optimized">("optimized");
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [useRealTimeEngine] = useState(true);
  const [hasSavedTrack, setHasSavedTrack] = useState(!!trackId);

  const { user, hasActiveSubscription } = useAuth();
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Real-time audio engine hook
  const audioEngine = useAudioEngine({
    onTimeUpdate: (time, dur) => {
      if (useRealTimeEngine && playMode === "optimized") {
        setCurrentTime(time);
        setDuration(dur);

        // Check preview limits
        if (!user && time >= 30) {
          audioEngine.pause();
          setShowAuthModal(true);
          toast({
            title: "Sign In to Continue Listening",
            description: "Sign in to play the full track.",
          });
        } else if (user && !hasActiveSubscription && time >= 30) {
          audioEngine.pause();
          // Redirect to upgrade page
          router.push('/dashboard/upgrade');
          toast({
            title: "30-Second Preview Complete",
            description: "Upgrade to Pro for unlimited full-length audio.",
          });
        }
      }
    },
    onStateChange: (state) => {
      if (useRealTimeEngine && playMode === "optimized") {
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

  // Check subscription status
  const isSubscribed = hasActiveSubscription;

  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    return () => {
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

  // Apply initial settings when loading a saved track
  useEffect(() => {
    if (initialSettings && audioEngine.engine) {
      audioEngine.applySettings(initialSettings);
    }
  }, [initialSettings, audioEngine.engine]);

  // If we have a trackId, mark as already complete (loading saved track)
  useEffect(() => {
    if (trackId && audioBuffer && !isComplete && !isProcessing) {
      setIsComplete(true);
      setHasSavedTrack(true);
    }
  }, [trackId, audioBuffer]);

  // Start processing automatically
  useEffect(() => {
    if (audioBuffer && !isProcessing && !isComplete && !processedBuffer) {
      startProcessing();
    }
  }, [audioBuffer]);

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

    setIsProcessing(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      const processed = await processAudio(
        audioBuffer,
        userProfile,
        (progressData) => {
          setStage(progressData.stage);
          setProgress(progressData.progress);
        },
        abortControllerRef.current.signal
      );

      setProcessedBuffer(processed);
      setIsComplete(true);
      onComplete();

      // Save the track to browser storage
      if (onSaveTrack && !hasSavedTrack) {
        try {
          await onSaveTrack(audioEngine.settings);
          setHasSavedTrack(true);
        } catch (saveError) {
          console.error('Error saving track:', saveError);
        }
      }

      toast({
        title: "🧠 Neural Optimization Complete!",
        description: "Your brain-activating audio is ready.",
      });

    } catch (err) {
      const errorMessage = (err as Error).message;
      if (errorMessage.includes('cancelled')) {
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
    }
  };

  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
    }
  };

  const togglePlayback = () => {
    // Use real-time engine for optimized mode
    if (useRealTimeEngine && playMode === "optimized" && audioBuffer) {
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

    // Legacy playback for original mode or when real-time engine is disabled
    if (!audioContextRef.current) return;

    const bufferToPlay = playMode === "optimized" ? processedBuffer : audioBuffer;
    if (!bufferToPlay) return;

    if (isPlaying) {
      cleanup();
    } else {
      // Set duration
      setDuration(bufferToPlay.duration);

      // For non-subscribers (including non-signed users), use preview buffer
      let playBuffer = bufferToPlay;
      if (!isSubscribed && playMode === "optimized") {
        playBuffer = createPreviewWithFade(bufferToPlay, PREVIEW_DURATION);
      }

      sourceNodeRef.current = audioContextRef.current.createBufferSource();
      sourceNodeRef.current.buffer = playBuffer;
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
    // Use real-time engine for optimized mode
    if (useRealTimeEngine && playMode === "optimized") {
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

        const bufferToPlay = playMode === "optimized" ? processedBuffer : audioBuffer;
        if (!bufferToPlay) return;

        let playBuffer = bufferToPlay;
        if (!isSubscribed && playMode === "optimized") {
          playBuffer = createPreviewWithFade(bufferToPlay, PREVIEW_DURATION);
        }

        sourceNodeRef.current = audioContextRef.current.createBufferSource();
        sourceNodeRef.current.buffer = playBuffer;
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

    // Check if 30-second preview limit reached for non-signed users
    if (!user && playMode === "optimized" && elapsed >= 30) {
      cleanup();

      // Not signed in - show auth modal after 30-second preview
      setShowAuthModal(true);
      toast({
        title: "Sign In to Continue Listening",
        description: "Sign in to play the full track.",
      });
      return;
    }

    // Check if user is signed in but not subscribed
    if (user && !isSubscribed && playMode === "optimized" && elapsed >= 30) {
      cleanup();

      // Signed in but not subscribed - redirect to upgrade
      router.push('/dashboard/upgrade');
      toast({
        title: "30-Second Preview Complete",
        description: "Upgrade to Pro for unlimited full-length audio.",
      });
      return;
    }

    animationFrameRef.current = requestAnimationFrame(updatePlaybackTime);
  };

  const handleDownload = () => {
    if (!user) {
      setShowAuthModal(true);
      toast({
        title: "Sign in to download",
        description: "Create a free account to download your audio.",
      });
      return;
    }

    if (!isSubscribed) {
      router.push('/dashboard/upgrade');
      toast({
        title: "Premium feature",
        description: "Upgrade to Pro to download your audio.",
      });
      return;
    }

    if (processedBuffer) {
      exportAsWAV(processedBuffer, fileName);
      toast({
        title: "Download started",
        description: "Your neural-optimized audio is downloading.",
      });
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

    // Auto-save settings for existing saved tracks (debounced via the engine)
    if (hasSavedTrack && onSaveTrack) {
      // Get updated settings after the parameter change
      const updatedSettings = { ...audioEngine.settings, [param]: value };
      onSaveTrack(updatedSettings).catch(console.error);
    }
  }, [audioEngine, hasSavedTrack, onSaveTrack]);

  const handleModeChange = useCallback((mode: EffectMode) => {
    audioEngine.setMode(mode);
  }, [audioEngine]);

  // Generate wave bars for visualization
  const waveBars = Array.from({ length: 40 }, (_, i) => i);
  const estimatedTime = audioBuffer ? estimateProcessingTime(audioBuffer.duration) : '';

  return (
    <div className="w-full max-w-full space-y-4">
      {/* Audio Control Panel - shown ABOVE the player when controls are toggled */}
      {isComplete && showControls && playMode === "optimized" && (
        <AudioControlPanel
          settings={audioEngine.settings}
          onSettingsChange={handleSettingsChange}
          onModeChange={handleModeChange}
          onUndo={audioEngine.undo}
          onRedo={audioEngine.redo}
          onReset={audioEngine.reset}
          canUndo={audioEngine.canUndo}
          canRedo={audioEngine.canRedo}
          disabled={!audioEngine.isReady && !audioEngine.isPlaying}
        />
      )}

      <div className="p-4 sm:p-6 md:p-8 rounded-2xl glass-card border border-primary/20 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className={`p-2 sm:p-3 rounded-xl bg-gradient-to-br from-primary to-accent flex-shrink-0 ${
            isProcessing ? 'animate-neural-pulse' : ''
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
                  className={showControls ? 'bg-primary/10' : ''}
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
              className={`w-1 sm:w-1.5 rounded-full transition-all duration-150 ${
                isComplete
                  ? 'bg-gradient-to-t from-primary to-accent'
                  : 'bg-primary/50'
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
              className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-accent to-transparent opacity-60"
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
              className={`h-full transition-all duration-300 rounded-full ${
                error ? 'bg-destructive' : 'bg-gradient-to-r from-primary via-neural-purple to-accent'
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
            {/* Mode toggle */}
            <div className="flex justify-center overflow-x-auto">
              <div className="inline-flex p-1 rounded-xl bg-secondary/50 min-w-0">
                <button
                  onClick={() => {
                    setPlayMode("original");
                    if (isPlaying && useRealTimeEngine) {
                      audioEngine.pause();
                    }
                  }}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                    playMode === "original"
                      ? "bg-card shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Original
                </button>
                <button
                  onClick={() => setPlayMode("optimized")}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                    playMode === "optimized"
                      ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Neural-Optimized
                </button>
              </div>
            </div>

            {/* Preview notice for non-subscribers */}
            {!isSubscribed && playMode === "optimized" && (
              <div className="flex items-center justify-center gap-2 p-2 sm:p-3 rounded-xl bg-accent/10 border border-accent/20">
                <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-accent flex-shrink-0" />
                <p className="text-xs sm:text-sm text-accent font-medium text-center">
                  {user
                    ? "Preview: First 30 seconds • Subscribe for unlimited access"
                    : "Free Preview: 30 seconds • Sign in to play full track"
                  }
                </p>
              </div>
            )}

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
                      [&::-webkit-slider-thumb]:bg-primary
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-webkit-slider-thumb]:shadow-lg
                      [&::-webkit-slider-thumb]:transition-transform
                      [&::-webkit-slider-thumb]:hover:scale-110
                      [&::-webkit-slider-thumb]:active:scale-125
                      [&::-moz-range-thumb]:w-4
                      [&::-moz-range-thumb]:h-4
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-primary
                      [&::-moz-range-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:shadow-lg
                      [&::-moz-range-thumb]:transition-transform
                      [&::-moz-range-thumb]:hover:scale-110
                      [&::-moz-range-thumb]:active:scale-125"
                    style={{
                      background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${(currentTime / (duration || 1)) * 100}%, hsl(var(--secondary)) ${(currentTime / (duration || 1)) * 100}%, hsl(var(--secondary)) 100%)`
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
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleDownload}
                  className="gap-2 w-full sm:w-auto"
                >
                  {!isSubscribed && <Lock className="w-3 h-3 sm:w-4 sm:h-4" />}
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  Download
                </Button>
              </div>
            </div>

            {/* Benefit reminder */}
            <p className="text-center text-xs sm:text-sm text-accent mt-3 sm:mt-4">
              {isSubscribed
                ? 'Enjoy Your Premium Neural-Optimized Audio'
                : user
                  ? 'Upgrade to Pro for Unlimited Full-Length Audio'
                  : 'Sign In After 30s Preview to Play Full Track'
              }
            </p>
          </div>
        )}

        {/* Auth Modal */}
        <AuthModal
          open={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          mode="signup"
          title="Sign In to Continue Listening"
          description="Sign in to play the full track and save your music."
        />
      </div>
    </div>
  );
}
