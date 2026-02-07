'use client';

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AudioUploader, SearchResult } from "@/components/dashboard/AudioUploader";
import { AudioProcessor } from "@/components/dashboard/AudioProcessor";
import { AuthModal } from "@/components/AuthModal";
import { ErrorModal } from "@/components/ErrorModal";
import { ProgressTracker } from "@/components/ProgressTracker";
import { Confetti } from "@/components/Confetti";
import { ProcessingOverlay } from "@/components/ProcessingOverlay";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedTracks } from "@/hooks/useSavedTracks";
import { Brain, Sparkles, Music, TrendingUp, Play, Clock, ChevronRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { posthogEvents } from "@/lib/posthog";
import { performanceMonitor } from "@/lib/performance";
import { extractYouTubeAudio } from "@/lib/youtubeExtractor";
import { Button } from "@/components/ui/button";
import { UserAudioSettings, getInitialSettings } from "@/lib/audio";
import Link from "next/link";

type ProcessingState = "idle" | "processing" | "complete";

// Helper to format duration
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Helper function to format relative time
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) {
    return "just now";
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else {
    return `${diffInDays}d ago`;
  }
}

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { preferences, incrementConversions } = useUserPreferences();
  const { user, canConvert, incrementFreeConversion, hasActiveSubscription } = useAuth();
  const { tracks, isLoading: isLoadingSavedTracks, addTrack, getTrack, getTrackAudioBuffer, getRecentTracks, updateTrackSettings } = useSavedTracks();

  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{ title: string; message: string; details?: string }>({
    title: '',
    message: ''
  });
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isLoadingYouTube, setIsLoadingYouTube] = useState(false);
  const [youtubeThumbnail, setYoutubeThumbnail] = useState<string | null>(null);
  const [youtubeVideoInfo, setYoutubeVideoInfo] = useState<{title: string; author: string} | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [loadedTrackSettings, setLoadedTrackSettings] = useState<UserAudioSettings | null>(null);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [audioSource, setAudioSource] = useState<'upload' | 'youtube' | 'search'>('upload');
  const [youtubeProgress, setYoutubeProgress] = useState<{ stage: string; progress: number } | null>(null);
  const [showProcessingOverlay, setShowProcessingOverlay] = useState(false);
  const [hasSavedTrack, setHasSavedTrack] = useState(false);
  const { toast } = useToast();
  const hasTrackedView = useRef(false);
  const didAttemptRestoreRef = useRef(false);

  // Track page view
  useEffect(() => {
    if (!hasTrackedView.current) {
      trackEvent.dashboardPageView();
      posthogEvents.dashboardViewed();
      hasTrackedView.current = true;
    }
  }, []);

  // Prefetch dashboard routes for faster navigation
  useEffect(() => {
    router.prefetch('/dashboard/tracks');
    router.prefetch('/dashboard/upgrade');
  }, [router]);

  // Persist the last active track so returning to Home restores player state
  useEffect(() => {
    if (currentTrackId) {
      sessionStorage.setItem('dashboard_continue_track', currentTrackId);
    }
  }, [currentTrackId]);

  // Handle loading a saved track from URL parameter or session
  useEffect(() => {
    if (isLoadingSavedTracks || isLoadingTrack) {
      return;
    }

    const trackIdFromUrl = searchParams.get('track');
    if (trackIdFromUrl) {
      if (trackIdFromUrl !== currentTrackId) {
        void loadSavedTrack(trackIdFromUrl);
      }
      return;
    }

    if (processingState !== 'idle' || audioBuffer || didAttemptRestoreRef.current) {
      return;
    }

    const persistedTrackId = sessionStorage.getItem('dashboard_continue_track');
    if (!persistedTrackId) {
      didAttemptRestoreRef.current = true;
      return;
    }

    const persistedTrack = tracks.find(track => track.id === persistedTrackId);
    if (!persistedTrack) {
      sessionStorage.removeItem('dashboard_continue_track');
      didAttemptRestoreRef.current = true;
      return;
    }

    // Only restore relatively recent sessions to avoid surprising stale loads.
    const processedDate = new Date(persistedTrack.processedDate);
    const minutesAgo = (Date.now() - processedDate.getTime()) / (1000 * 60);
    if (minutesAgo > 30) {
      didAttemptRestoreRef.current = true;
      return;
    }

    didAttemptRestoreRef.current = true;
    void loadSavedTrack(persistedTrackId);
  }, [searchParams, currentTrackId, processingState, audioBuffer, isLoadingTrack, isLoadingSavedTracks, tracks]);

  const loadSavedTrack = async (trackId: string) => {
    setIsLoadingTrack(true);
    try {
      const track = getTrack(trackId);
      if (!track) {
        toast({
          title: "Track not found",
          description: "The requested track could not be found.",
          variant: "destructive",
        });
        router.replace('/dashboard');
        return;
      }

      const buffer = await getTrackAudioBuffer(trackId);
      if (!buffer) {
        toast({
          title: "Could not load audio",
          description: "The audio data could not be loaded.",
          variant: "destructive",
        });
        router.replace('/dashboard');
        return;
      }

      // Set up the track for playback
      setAudioBuffer(buffer);
      setCurrentFile(track.title);
      setCurrentTrackId(trackId);
      setLoadedTrackSettings(track.settings);
      setYoutubeThumbnail(track.thumbnail || null);
      setYoutubeVideoInfo(track.author ? { title: track.title, author: track.author } : null);
      setProcessingState("complete");
      setHasSavedTrack(true);

      toast({
        title: "Track loaded",
        description: `Now playing: ${track.title}`,
      });
    } catch (error) {
      console.error('Error loading track:', error);
      toast({
        title: "Error loading track",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTrack(false);
    }
  };

  const handleAudioReady = (buffer: AudioBuffer, fileName: string) => {
    setAudioBuffer(buffer);
    setCurrentFile(fileName);
    setCurrentTrackId(null); // New track, not a saved one
    setLoadedTrackSettings(null);
    setHasSavedTrack(false);

    // Track file upload
    trackEvent.fileUploaded(buffer.length, buffer.duration);

    console.log("Audio ready:", fileName, "Duration:", buffer.duration, "seconds");
  };

  const handleProcessStart = () => {
    // Track processing start
    if (currentFile) {
      trackEvent.processingStarted(currentFile);
      performanceMonitor.startTimer('audio_processing');
    }

    setProcessingState("processing");
  };

  const handleFileSelect = (file: File) => {
    setCurrentFile(file.name);
    setAudioSource('upload');
    // Track service usage
    posthogEvents.serviceUsed('upload', { fileName: file.name, fileSize: file.size });
    // Processing state will be set by auto-processing in AudioUploader
  };

  const handleUrlSubmit = async (url: string) => {
    // For YouTube extraction, allow guests and users with free conversions
    // Block only users who have used their free conversion and don't have subscription
    if (user && !hasActiveSubscription && !canConvert) {
      router.push('/dashboard/upgrade');
      toast({
        title: "Free Conversion Used",
        description: "Upgrade to Pro for unlimited conversions.",
      });
      return;
    }

    setIsLoadingYouTube(true);
    setShowProcessingOverlay(true);
    setYoutubeThumbnail(null);
    setYoutubeVideoInfo(null);
    setYoutubeUrl(url);
    setAudioSource('youtube');
    setYoutubeProgress({ stage: 'Starting...', progress: 0 });

    // Track service usage
    posthogEvents.serviceUsed('youtube', { url });

    try {
      const { audioBuffer, videoInfo } = await extractYouTubeAudio(
        url,
        (stage, progress) => {
          // Update progress state for UI
          setYoutubeProgress({ stage, progress });
          console.log(`[YouTube] ${stage} - ${progress}%`);
        }
      );

      // Set the audio buffer and file name
      setAudioBuffer(audioBuffer);
      setCurrentFile(`${videoInfo.title} - ${videoInfo.author}`);
      setYoutubeThumbnail(videoInfo.thumbnail);
      setYoutubeVideoInfo({ title: videoInfo.title, author: videoInfo.author });
      setCurrentTrackId(null);
      setLoadedTrackSettings(null);
      setHasSavedTrack(false);

      // Track the upload
      trackEvent.fileUploaded(audioBuffer.length, audioBuffer.duration);
      posthogEvents.conversionStarted('youtube');

      toast({
        title: "YouTube audio extracted!",
        description: `Processing: ${videoInfo.title}`,
      });

      // Start processing
      trackEvent.processingStarted(videoInfo.title);
      performanceMonitor.startTimer('audio_processing');
      setProcessingState("processing");

    } catch (error) {
      console.error('YouTube extraction error:', error);
      const errorMessage = (error as Error).message || "Failed to extract audio from YouTube";

      // Show error modal with helpful message
      let userFriendlyMessage = errorMessage;
      let details = error instanceof Error ? error.stack : undefined;

      if (errorMessage.includes('Invalid YouTube URL')) {
        userFriendlyMessage = "Please provide a valid YouTube video link (e.g., youtube.com/watch?v=... or youtu.be/...)";
      } else if (errorMessage.includes('too long') || errorMessage.includes('30 minutes')) {
        userFriendlyMessage = "This video is too long. Please choose a video under 30 minutes.";
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        userFriendlyMessage = "Network error. Please check your internet connection and try again.";
      } else if (errorMessage.toLowerCase().includes('authenticated youtube access')) {
        userFriendlyMessage = "YouTube is requiring extra verification for this video right now. Please try a different video, retry later, or add auth cookies in server config.";
      } else if (errorMessage.toLowerCase().includes('temporarily blocked automated access') || errorMessage.toLowerCase().includes('bot')) {
        userFriendlyMessage = "YouTube temporarily blocked automated access for this video. Please try another public video or retry in a few minutes.";
      } else if (errorMessage.includes('unavailable') || errorMessage.includes('private')) {
        userFriendlyMessage = "This video is unavailable or private. Please try a different video.";
      }

      setErrorDetails({
        title: "YouTube Extraction Failed",
        message: userFriendlyMessage,
        details: details
      });
      setShowErrorModal(true);
    } finally {
      setIsLoadingYouTube(false);
      setShowProcessingOverlay(false);
      setYoutubeProgress(null);
    }
  };

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setSearchResults([]);

    try {
      const response = await fetch('/api/youtube/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setSearchResults(data.results || []);

      if (data.results?.length === 0) {
        toast({
          title: "No results found",
          description: "Try a different search term",
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search failed",
        description: (error as Error).message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchResultSelect = (result: SearchResult) => {
    setAudioSource('search');
    // Track service usage
    posthogEvents.serviceUsed('search', { videoId: result.videoId, title: result.title });
    // Convert search result to YouTube URL and trigger extraction
    const youtubeUrl = `https://www.youtube.com/watch?v=${result.videoId}`;
    handleUrlSubmit(youtubeUrl);
  };

  const handleProcessingComplete = async (processedBuffer: AudioBuffer) => {
    setProcessingState("complete");
    const isFirstConversion = preferences.conversions === 0;

    // End performance timer
    const processingTime = performanceMonitor.endTimer('audio_processing');

    // Track completion
    if (audioBuffer && processingTime) {
      trackEvent.processingCompleted(audioBuffer.duration, processingTime);
      posthogEvents.conversionCompleted(audioSource, audioBuffer.duration);
    }

    incrementConversions();
    trackEvent.conversionCompleted(preferences.conversions + 1);

    // Increment free conversion if not subscribed (mark as used immediately)
    if (user && !hasActiveSubscription && canConvert) {
      await incrementFreeConversion();
      toast({
        title: "Free Conversion Used",
        description: "You've used your 1 free conversion. Next track requires Pro!",
      });
    }

    // Save the processed track automatically (only if not already saved)
    if (processedBuffer && currentFile && !currentTrackId && !hasSavedTrack) {
      try {
        // Check if this exact track was just saved (within last 10 seconds)
        const recentTracks = getRecentTracks(5);
        const trackTitle = youtubeVideoInfo?.title || currentFile;
        const justSaved = recentTracks.find(t => {
          const savedDate = new Date(t.processedDate);
          const now = new Date();
          const secondsAgo = (now.getTime() - savedDate.getTime()) / 1000;
          return t.title === trackTitle && secondsAgo < 10;
        });

        if (justSaved) {
          // Track was just saved, use that ID
          setCurrentTrackId(justSaved.id);
          setHasSavedTrack(true);
          return;
        }

        const result = await addTrack(
          trackTitle,
          processedBuffer, // Save the PROCESSED buffer, not the original
          getInitialSettings(),
          {
            author: youtubeVideoInfo?.author,
            thumbnail: youtubeThumbnail || undefined,
            source: audioSource,
            originalFileName: currentFile,
          }
        );

        if (result.track) {
          setCurrentTrackId(result.track.id);
          setHasSavedTrack(true);
          // Store track ID for potential continuation after navigation
          sessionStorage.setItem('dashboard_continue_track', result.track.id);
        }
      } catch (error) {
        console.error('Error saving track:', error);
      }
    }

    // Show confetti on first conversion
    if (isFirstConversion) {
      setShowConfetti(true);
    }

    toast({
      title: isFirstConversion ? "🎉 First Conversion Complete!" : "🧠 Conversion Complete!",
      description: isFirstConversion
        ? "You've created your first 8D audio!"
        : "Your 8D audio is ready!",
    });
  };

  // Save track when settings change (called from AudioProcessor)
  const handleSaveTrack = async (settings: UserAudioSettings, processedBuffer: AudioBuffer) => {
    if (!processedBuffer || !currentFile) return;

    try {
      // If this is an existing track, update its settings
      if (currentTrackId) {
        updateTrackSettings(currentTrackId, settings);
        return;
      }

      // This shouldn't happen since we auto-save in handleProcessingComplete
      // But keep it as a fallback
      const result = await addTrack(
        youtubeVideoInfo?.title || currentFile,
        processedBuffer,
        settings,
        {
          author: youtubeVideoInfo?.author,
          thumbnail: youtubeThumbnail || undefined,
          source: audioSource,
          originalFileName: currentFile,
        }
      );

      if (result.error && !result.track) {
        toast({
          title: "Could not save track",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      if (result.track) {
        setCurrentTrackId(result.track.id);
        setHasSavedTrack(true);
      }
    } catch (error) {
      console.error('Error saving track:', error);
    }
  };

  const handleReset = () => {
    setProcessingState("idle");
    setCurrentFile(null);
    setCurrentTrackId(null);
    setLoadedTrackSettings(null);
    setHasSavedTrack(false);
    setYoutubeThumbnail(null);
    setYoutubeVideoInfo(null);
    setAudioBuffer(null);
    didAttemptRestoreRef.current = true;
    // Clear URL parameter
    router.replace('/dashboard');
    // Clear session storage
    sessionStorage.removeItem('dashboard_continue_track');
  };

  const recentTracks = getRecentTracks(3);

  return (
    <div className="flex min-h-screen bg-background overflow-x-hidden">
      <Sidebar />

      <main className="flex-1 overflow-auto w-full">
        {/* Mobile Menu Bar - Only visible on mobile */}
        <div className="lg:hidden sticky top-0 z-20 glass-card border-b border-primary/10 h-14">
          {/* Hamburger menu button space - button is rendered by Sidebar component */}
        </div>

        {/* Header Content - Below menu bar on mobile, normal on desktop */}
        <header className="glass-card border-b border-primary/10 lg:sticky lg:top-0 lg:z-10">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Transform your music into brain-activating experiences
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full">
          {/* Progress Tracker */}
          {preferences.conversions < 3 && (
            <div className="mb-6 sm:mb-8 animate-fade-in">
              <ProgressTracker />
            </div>
          )}
          {/* Neural profile summary */}
          {preferences.hasCompletedQuiz && (
            <div className="mb-6 sm:mb-8 p-3 sm:p-4 rounded-2xl glass-card border border-primary/20 animate-fade-in">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-primary to-accent flex-shrink-0">
                  <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base">Your Neural Profile</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Optimized for{" "}
                    <span className="text-accent font-medium">{preferences.goal}</span>
                    {preferences.hasADHD === "yes" && " • ADHD-enhanced"}
                    {" • "}
                    <span className="capitalize">{preferences.intensity}</span>
                  </p>
                </div>
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-accent flex-shrink-0" />
              </div>
            </div>
          )}

          {/* Loading track indicator */}
          {isLoadingTrack && (
            <div className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl glass-card border border-primary/20 mb-6">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">Loading your track...</p>
            </div>
          )}

          {/* Uploader or Processor */}
          {!isLoadingTrack && (
            <>
              {processingState === "idle" ? (
                <AudioUploader
                  onFileSelect={handleFileSelect}
                  onUrlSubmit={handleUrlSubmit}
                  onSearch={handleSearch}
                  onSearchResultSelect={handleSearchResultSelect}
                  onAudioReady={handleAudioReady}
                  onProcessStart={handleProcessStart}
                  isLoadingYouTube={isLoadingYouTube}
                  youtubeProgress={youtubeProgress}
                  youtubeThumbnail={youtubeThumbnail}
                  youtubeVideoInfo={youtubeVideoInfo}
                  searchResults={searchResults}
                  isSearching={isSearching}
                />
              ) : (
                <AudioProcessor
                  fileName={currentFile || "Audio File"}
                  audioBuffer={audioBuffer}
                  userProfile={{
                    goal: preferences.goal || 'focus',
                    hasADHD: preferences.hasADHD || 'no',
                    intensity: preferences.intensity || 'moderate'
                  }}
                  onComplete={handleProcessingComplete}
                  onReset={handleReset}
                  onSaveTrack={handleSaveTrack}
                  initialSettings={loadedTrackSettings}
                  trackId={currentTrackId}
                />
              )}
            </>
          )}

          {/* Recent tracks from My Music */}
          {processingState === "idle" && !isLoadingTrack && recentTracks.length > 0 && (
            <div className="mt-8 sm:mt-12">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                  <h2 className="font-semibold text-sm sm:text-base">My Music</h2>
                </div>
                <Link href="/dashboard/tracks">
                  <Button variant="ghost" size="sm" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground">
                    View All
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="grid gap-3 sm:gap-4">
                {recentTracks.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => router.push(`/dashboard?track=${track.id}`)}
                    className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl glass-card border border-white/5 hover:border-primary/20 transition-all text-left w-full group"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden flex-shrink-0">
                      {track.thumbnail ? (
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : null}
                      <div className={`${track.thumbnail ? 'hidden' : ''} absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center`}>
                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      </div>
                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-5 h-5 text-white" />
                      </div>
                    </div>

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{track.title}</p>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(track.duration)}
                        </span>
                        <span>•</span>
                        <span>{getRelativeTime(track.processedDate)}</span>
                      </div>
                    </div>

                    {/* Play indicator */}
                    <div className="flex-shrink-0 p-2 rounded-full bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state for new users */}
          {processingState === "idle" && !isLoadingTrack && recentTracks.length === 0 && preferences.conversions === 0 && (
            <div className="mt-8 sm:mt-12 p-6 rounded-2xl glass-card border border-primary/10 text-center">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 w-fit mx-auto mb-4">
                <Music className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Your music library is empty</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a song or search YouTube to create your first neural-optimized track
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Auth modal */}
      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode="signup"
        title="🎵 Get Your First Free Conversion"
        description="Sign in to convert your first track for free!"
      />

      {/* Confetti celebration */}
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Error Modal */}
      <ErrorModal
        open={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title={errorDetails.title}
        message={errorDetails.message}
        details={errorDetails.details}
        onRetry={youtubeUrl ? () => handleUrlSubmit(youtubeUrl) : undefined}
      />

      {/* Processing Overlay */}
      <ProcessingOverlay
        isVisible={showProcessingOverlay}
        progress={youtubeProgress?.progress || 0}
        stage={youtubeProgress?.stage || 'Processing...'}
        title={youtubeVideoInfo?.title || currentFile || undefined}
        thumbnail={youtubeThumbnail || undefined}
      />
    </div>
  );
}
