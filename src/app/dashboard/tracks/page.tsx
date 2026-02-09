'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Music, Sparkles, Download, Play, Clock, Trash2, Loader2, Youtube, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSavedTracks } from "@/hooks/useSavedTracks";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { exportAsMP3 } from "@/lib/audioProcessor";

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
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  } else {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }
}

// Helper to format duration
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Source icon component
function SourceIcon({ source }: { source: 'upload' | 'youtube' | 'search' }) {
  switch (source) {
    case 'youtube':
    case 'search':
      return <Youtube className="w-3 h-3" />;
    case 'upload':
    default:
      return <Upload className="w-3 h-3" />;
  }
}

export default function TracksPage() {
  const router = useRouter();
  const { tracks, isLoading, deleteTrack, getTrackAudioBuffer } = useSavedTracks();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);

  const handlePlay = (trackId: string) => {
    // Navigate to dashboard with track ID to load and play
    router.push(`/dashboard?track=${trackId}`);
  };

  const handleDownload = async (trackId: string, title: string) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to download your audio.",
      });
      return;
    }

    setLoadingTrackId(trackId);
    try {
      const audioBuffer = await getTrackAudioBuffer(trackId);
      if (audioBuffer) {
        await exportAsMP3(audioBuffer, title);
        toast({
          title: "Download started",
          description: "Your neural-optimized audio is downloading.",
        });
      } else {
        throw new Error("Could not load audio");
      }
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download the track. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingTrackId(null);
    }
  };

  const handleDelete = (trackId: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteTrack(trackId);
      toast({
        title: "Track deleted",
        description: `"${title}" has been removed from your library.`,
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        {/* Mobile Menu Bar - Only visible on mobile */}
        <div className="lg:hidden sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-border h-14">
          {/* Hamburger menu button space - button is rendered by Sidebar component */}
        </div>

        {/* Header Content - Below menu bar on mobile, normal on desktop */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-border lg:sticky lg:top-0 lg:z-10">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold">My Music</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Your neural-optimized audio library
                </p>
              </div>
              <Badge variant="secondary" className="px-2 sm:px-3 py-1 text-xs sm:text-sm flex-shrink-0">
                {tracks.length} {tracks.length === 1 ? 'Track' : 'Tracks'}
              </Badge>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl bg-card border border-border">
              <Loader2 className="w-8 h-8 text-foreground animate-spin mb-4" />
              <p className="text-muted-foreground">Loading your music...</p>
            </div>
          ) : tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl bg-card border border-border">
              <div className="p-3 sm:p-4 rounded-2xl bg-secondary mb-3 sm:mb-4">
                <Music className="w-6 h-6 sm:w-8 sm:h-8 text-foreground" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">No tracks yet</h3>
              <p className="text-muted-foreground text-center mb-4 sm:mb-6 max-w-md text-sm sm:text-base px-4">
                Start by uploading an audio file or searching for a song to create your first neural-optimized track.
              </p>
              <Button variant="neural" onClick={() => router.push('/dashboard')} className="text-sm sm:text-base">
                <Sparkles className="w-4 h-4 mr-2" />
                Create Your First Track
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-card border border-border hover:border-foreground/15 transition-all group"
                >
                  {/* Track Thumbnail/Icon */}
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex-shrink-0">
                    {track.thumbnail ? (
                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`${track.thumbnail ? 'hidden' : ''} absolute inset-0 bg-primary flex items-center justify-center`}>
                      <Sparkles className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                    </div>
                  </div>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base mb-1 truncate">{track.title}</h3>
                    {track.author && (
                      <p className="text-xs sm:text-sm text-muted-foreground truncate mb-1">{track.author}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(track.duration)}
                      </span>
                      <span className="hidden xs:inline">•</span>
                      <span>{getRelativeTime(track.processedDate)}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:flex items-center gap-1">
                        <SourceIcon source={track.source} />
                        {track.source === 'youtube' || track.source === 'search' ? 'YouTube' : 'Upload'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <Button
                      variant="neural"
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10"
                      onClick={() => handlePlay(track.id)}
                      title="Play & Edit"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10"
                      onClick={() => handleDownload(track.id, track.title)}
                      disabled={loadingTrackId === track.id}
                      title="Download"
                    >
                      {loadingTrackId === track.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(track.id, track.title)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Storage info */}
          {tracks.length > 0 && (
            <p className="text-xs text-muted-foreground text-center mt-6">
              Tracks are saved locally in your browser. Maximum {20} tracks stored.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
