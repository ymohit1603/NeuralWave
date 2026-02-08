'use client';

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Search, Music, Loader2, AlertCircle, Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface SearchResult {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  duration: string;
  views: string;
}

interface AudioUploaderProps {
  onFileSelect: (file: File) => void;
  onSearch: (query: string) => void;
  onSearchResultSelect?: (result: SearchResult) => void;
  onAudioReady?: (audioBuffer: AudioBuffer, fileName: string) => void;
  onProcessStart?: () => void;
  isLoadingYouTube?: boolean;
  youtubeProgress?: { stage: string; progress: number } | null;
  searchResults?: SearchResult[];
  isSearching?: boolean;
  hasActiveSubscription?: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_FORMATS = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave'];

export function AudioUploader({
  onFileSelect,
  onSearch,
  onSearchResultSelect,
  onAudioReady,
  onProcessStart,
  isLoadingYouTube = false,
  youtubeProgress = null,
  searchResults = [],
  isSearching = false,
}: AudioUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSearchResult, setSelectedSearchResult] = useState<SearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const { toast } = useToast();
  const youtubeProgressValue = Math.max(
    0,
    Math.min(100, typeof youtubeProgress?.progress === 'number' ? youtubeProgress.progress : 0)
  );
  const youtubeProgressLabel = Number.isInteger(youtubeProgressValue)
    ? youtubeProgressValue.toString()
    : youtubeProgressValue.toFixed(1);

  // Initialize AudioContext
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  // Debounced autocomplete (Google/YouTube suggestions)
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2) {
      setSearchSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/youtube/autocomplete?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          setSearchSuggestions([]);
          return;
        }

        const data = await response.json();
        const suggestions = Array.isArray(data?.suggestions)
          ? data.suggestions.filter((item: unknown): item is string => typeof item === 'string')
          : [];
        setSearchSuggestions(suggestions.slice(0, 8));
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setSearchSuggestions([]);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_FORMATS.includes(file.type) && !file.name.match(/\.(mp3|wav)$/i)) {
      return "Unsupported file format. Please upload MP3 or WAV files only.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 50MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`;
    }
    return null;
  };

  const processAudioFile = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const decodedBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      if (onAudioReady) {
        onAudioReady(decodedBuffer, file.name);
      }

      toast({
        title: "Audio loaded successfully!",
        description: `${file.name} is ready for processing.`,
      });

      // Auto-start processing immediately
      setTimeout(() => {
        if (onProcessStart) {
          onProcessStart();
        }
      }, 150);

    } catch (err) {
      console.error("Error processing audio:", err);
      setError("Failed to decode audio file. The file may be corrupted or in an unsupported format.");
      toast({
        title: "Error loading audio",
        description: "Please try a different file.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files?.[0]) {
      const file = files[0];
      const validationError = validateFile(file);

      if (validationError) {
        setError(validationError);
        toast({
          title: "Invalid file",
          description: validationError,
          variant: "destructive",
        });
        return;
      }

      onFileSelect(file);
      processAudioFile(file);
    }
  }, [onFileSelect, toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validationError = validateFile(file);

      if (validationError) {
        setError(validationError);
        toast({
          title: "Invalid file",
          description: validationError,
          variant: "destructive",
        });
        e.target.value = '';
        return;
      }

      onFileSelect(file);
      processAudioFile(file);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setHasSearched(true);
      setShowSuggestions(false);
      onSearch(searchQuery.trim());
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setSearchQuery(suggestion);
    setHasSearched(true);
    setShowSuggestions(false);
    onSearch(suggestion);
  };

  const handleSearchResultClick = (result: SearchResult) => {
    setSelectedSearchResult(result);
    setShowSuggestions(false);
    if (onSearchResultSelect) {
      onSearchResultSelect(result);
    }
  };

  return (
    <div className="w-full max-w-full overflow-hidden">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50 p-1 rounded-xl mb-4 sm:mb-6">
          <TabsTrigger
            value="upload"
            className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg text-xs sm:text-sm px-2 sm:px-3"
          >
            <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>Upload</span>
          </TabsTrigger>
          <TabsTrigger
            value="search"
            className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg text-xs sm:text-sm px-2 sm:px-3"
          >
            <Search className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>Search</span>
      
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="mt-0">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 rounded-2xl glass-card border border-primary/20">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-lg font-medium mb-1">Processing audio file...</p>
              <p className="text-sm text-muted-foreground">Decoding audio data</p>
            </div>
          ) : (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center p-12 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer ${
                isDragging
                  ? 'border-primary bg-primary/10 scale-[1.02]'
                  : 'border-primary/30 hover:border-primary/60 hover:bg-primary/5'
              }`}
            >
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              <div className={`p-4 rounded-2xl glass-card border border-primary/20 mb-4 transition-all duration-300 ${
                isDragging ? 'scale-110 shadow-lg shadow-primary/20' : ''
              }`}>
                <Upload className="w-8 h-8 text-primary" />
              </div>

              <p className="text-lg font-medium mb-1">
                {isDragging ? "Drop your file here" : "Drag & drop your audio file"}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse • MP3, WAV, M4A supported
              </p>

              <Button variant="outline" className="pointer-events-none">
                Choose File
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search" className="mt-0">
          <div className="space-y-4">
            

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2 sm:gap-3 items-start">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for songs, artists..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  disabled={isSearching || isLoadingYouTube}
                  className="pl-9 sm:pl-11 h-12 sm:h-14 text-sm sm:text-lg bg-secondary/30 border-primary/20 focus:border-primary rounded-xl"
                />

                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-primary/20 bg-background shadow-lg overflow-hidden">
                    {searchSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSuggestionSelect(suggestion)}
                        className="w-full px-3 py-2.5 text-left text-sm hover:bg-secondary/40 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                type="submit"
                variant="neural"
                size="lg"
                className="h-12 sm:h-14 px-4 sm:px-6"
                disabled={isSearching || isLoadingYouTube || !searchQuery.trim()}
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </Button>
            </form>

            {/* Search Results */}
            {isSearching ? (
              <div className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl glass-card border border-primary/20">
                <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-primary animate-spin mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base font-medium">Searching YouTube...</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Finding the best matches</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2 sm:space-y-3 max-h-[400px] sm:max-h-[500px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                {searchResults.map((result) => (
                  <button
                    key={result.videoId}
                    onClick={() => handleSearchResultClick(result)}
                    disabled={isLoadingYouTube}
                    className={`w-full flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-xl border transition-all text-left ${
                      selectedSearchResult?.videoId === result.videoId
                        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                        : 'border-primary/10 hover:border-primary/30 hover:bg-secondary/30'
                    } ${isLoadingYouTube && selectedSearchResult?.videoId === result.videoId ? 'opacity-70' : ''}`}
                  >
                    {/* Thumbnail */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={result.thumbnail}
                        alt={result.title}
                        className="w-20 h-14 sm:w-28 sm:h-20 object-cover rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${result.videoId}/hqdefault.jpg`;
                        }}
                      />
                      <div className="absolute bottom-1 right-1 px-1 sm:px-1.5 py-0.5 bg-black/80 rounded text-[10px] sm:text-xs text-white font-medium">
                        {result.duration}
                      </div>
                      {isLoadingYouTube && selectedSearchResult?.videoId === result.videoId && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-lg">
                          <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-spin mb-1" />
                          <span className="text-[10px] text-white/80">{youtubeProgressLabel}%</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-xs sm:text-sm line-clamp-2 mb-0.5 sm:mb-1">{result.title}</h4>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{result.author}</p>
                      <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5 sm:gap-1">
                          <Eye className="w-3 h-3" />
                          {result.views}
                        </span>
                        <span className="flex items-center gap-0.5 sm:gap-1">
                          <Clock className="w-3 h-3" />
                          {result.duration}
                        </span>
                      </div>
                    </div>

                    {/* Play indicator */}
                    <div className={`flex-shrink-0 p-1.5 sm:p-2 rounded-full transition-colors ${
                      selectedSearchResult?.videoId === result.videoId
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary/50 text-muted-foreground'
                    }`}>
                      <Music className="w-3 h-3 sm:w-4 sm:h-4" />
                    </div>
                  </button>
                ))}
              </div>
            ) : searchQuery && hasSearched && !isSearching ? (
              <div className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl glass-card border border-primary/20">
                <Search className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base font-medium">No results found</p>
                <p className="text-xs sm:text-sm text-muted-foreground text-center">Try a different search term</p>
              </div>
            ) : searchQuery && !hasSearched ? (
              <div className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl glass-card border border-primary/20">
                <Search className="w-8 h-8 sm:w-10 sm:h-10 text-primary mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base font-medium">Click the search button</p>
                <p className="text-xs sm:text-sm text-muted-foreground text-center">Press search or select a suggestion</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl glass-card border border-primary/20">
                <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-3 sm:mb-4">
                  <Music className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">Search for Music</h3>
                <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-md">
                  Search songs on YouTube and pick one to convert.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

