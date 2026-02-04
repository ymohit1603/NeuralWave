'use client';

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Search, Link, Music, X, Play, Pause, Loader2, AlertCircle, Clock, Eye } from "lucide-react";
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
  onUrlSubmit: (url: string) => void;
  onSearch: (query: string) => void;
  onSearchResultSelect?: (result: SearchResult) => void;
  onAudioReady?: (audioBuffer: AudioBuffer, fileName: string) => void;
  onProcessStart?: () => void;
  isLoadingYouTube?: boolean;
  youtubeProgress?: { stage: string; progress: number } | null;
  youtubeThumbnail?: string | null;
  youtubeVideoInfo?: {title: string; author: string} | null;
  searchResults?: SearchResult[];
  isSearching?: boolean;
}

interface AudioMetadata {
  fileName: string;
  fileSize: number;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_FORMATS = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave'];

export function AudioUploader({
  onFileSelect,
  onUrlSubmit,
  onSearch,
  onSearchResultSelect,
  onAudioReady,
  onProcessStart,
  isLoadingYouTube = false,
  youtubeProgress = null,
  youtubeThumbnail = null,
  youtubeVideoInfo = null,
  searchResults = [],
  isSearching = false,
}: AudioUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedSearchResult, setSelectedSearchResult] = useState<SearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Initialize AudioContext
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    return () => {
      cleanup();
    };
  }, []);

  // Draw waveform when audio buffer is ready
  useEffect(() => {
    if (audioBuffer && canvasRef.current) {
      drawWaveform(audioBuffer);
    }
  }, [audioBuffer]);

  const cleanup = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
  };

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
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Decode audio data
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const decodedBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      
      // Store audio buffer and metadata
      setAudioBuffer(decodedBuffer);
      setMetadata({
        fileName: file.name,
        fileSize: file.size,
        duration: decodedBuffer.duration,
        sampleRate: decodedBuffer.sampleRate,
        numberOfChannels: decodedBuffer.numberOfChannels,
      });
      
      setShowPreview(true);
      
      // Notify parent component
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
      }, 500);
      
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

  const drawWaveform = (buffer: AudioBuffer) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.clearRect(0, 0, width, height);
    
    // Draw waveform bars
    ctx.fillStyle = 'rgba(139, 92, 246, 0.6)';
    
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      
      const barHeight = Math.max(1, (max - min) * amp);
      const y = (1 + min) * amp;
      
      ctx.fillRect(i * 2, y, 1.5, barHeight);
    }
  };

  const togglePlayback = () => {
    if (!audioBuffer || !audioContextRef.current) return;
    
    if (isPlaying) {
      cleanup();
    } else {
      // Create new source node
      sourceNodeRef.current = audioContextRef.current.createBufferSource();
      sourceNodeRef.current.buffer = audioBuffer;
      sourceNodeRef.current.connect(audioContextRef.current.destination);
      sourceNodeRef.current.onended = () => setIsPlaying(false);
      sourceNodeRef.current.start(0);
      setIsPlaying(true);
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
      onSearch(searchQuery.trim());
    }
  };

  const handleSearchResultClick = (result: SearchResult) => {
    setSelectedSearchResult(result);
    if (onSearchResultSelect) {
      onSearchResultSelect(result);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      onUrlSubmit(urlInput);
    }
  };

  const handleReset = () => {
    cleanup();
    setAudioBuffer(null);
    setMetadata(null);
    setShowPreview(false);
    setError(null);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  return (
    <div className="w-full max-w-full overflow-hidden">
      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary/50 p-1 rounded-xl mb-4 sm:mb-6">
          <TabsTrigger
            value="search"
            className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg text-xs sm:text-sm px-2 sm:px-3"
          >
            <Search className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Search</span>
          </TabsTrigger>
          <TabsTrigger 
            value="upload"
            className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg text-xs sm:text-sm px-2 sm:px-3"
          >
            <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Upload</span>
          </TabsTrigger>
          <TabsTrigger 
            value="url"
            className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg relative text-xs sm:text-sm px-2 sm:px-3"
          >
            <Link className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">YouTube</span>
          </TabsTrigger>
        </TabsList>

        {/* Search Tab */}
        <TabsContent value="search" className="mt-0">
          <div className="space-y-4">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2 sm:gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for songs, artists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isSearching || isLoadingYouTube}
                  className="pl-9 sm:pl-11 h-12 sm:h-14 text-sm sm:text-lg bg-secondary/30 border-primary/20 focus:border-primary rounded-xl"
                />
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
                          <span className="text-[10px] text-white/80">
                            {youtubeProgress?.progress ? `${youtubeProgress.progress}%` : 'Loading...'}
                          </span>
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
                      <Play className="w-3 h-3 sm:w-4 sm:h-4" />
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
                <p className="text-xs sm:text-sm text-muted-foreground text-center">Press the search button or hit Enter to find songs</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl glass-card border border-primary/20">
                <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-3 sm:mb-4">
                  <Music className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">Search for Music</h3>
                <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-md">
                  Search for any song on YouTube and convert it to 8D audio instantly
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="mt-0">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {showPreview && metadata && audioBuffer ? (
            <div className="space-y-4 animate-fade-in">
              {/* Audio Preview Card */}
              <div className="p-6 rounded-2xl glass-card border border-primary/20">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-primary to-accent">
                    <Music className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-lg">{metadata.fileName}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                      <span>Duration: {formatDuration(metadata.duration)}</span>
                      <span>•</span>
                      <span>Size: {formatFileSize(metadata.fileSize)}</span>
                      <span>•</span>
                      <span>Sample Rate: {metadata.sampleRate} Hz</span>
                      <span>•</span>
                      <span>{metadata.numberOfChannels === 2 ? 'Stereo' : 'Mono'}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleReset}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                
                {/* Waveform Visualization */}
                <div className="relative mb-4 p-4 rounded-xl bg-secondary/30 border border-primary/10">
                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={120}
                    className="w-full h-[120px]"
                  />
                </div>
                
                {/* Playback Controls */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={togglePlayback}
                    className="w-full gap-2"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4" />
                        Pause Preview
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Play Preview
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Upload Different File Button */}
              <Button
                variant="outline"
                onClick={handleReset}
                className="w-full"
              >
                Upload Different File
              </Button>
            </div>
          ) : isLoading ? (
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

        {/* URL Tab */}
        <TabsContent value="url" className="mt-0">
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div className="flex gap-3">
              <Input
                type="url"
                placeholder="Paste YouTube URL here..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={isLoadingYouTube}
                className="flex-1 h-14 text-lg bg-secondary/30 border-primary/20 focus:border-primary rounded-xl"
              />
              <Button 
                type="submit" 
                variant="neural" 
                size="lg" 
                className="h-14 px-8"
                disabled={isLoadingYouTube || !urlInput.trim()}
              >
                {isLoadingYouTube ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Link className="w-5 h-5 mr-2" />
                    Import
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Paste a YouTube link and we'll extract the audio automatically
            </p>
            
            {/* Loading State with Progress */}
            {isLoadingYouTube && (
              <div className="p-4 sm:p-6 rounded-xl glass-card border border-primary/20 animate-fade-in">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="relative">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Music className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base">
                      {youtubeProgress?.stage || 'Extracting audio from YouTube...'}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      Please wait, this may take a moment
                    </p>
                    {/* Progress bar */}
                    <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300 rounded-full"
                        style={{ width: `${youtubeProgress?.progress || 10}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 text-right">
                      {youtubeProgress?.progress || 0}%
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Thumbnail Preview */}
            {youtubeThumbnail && youtubeVideoInfo && !isLoadingYouTube && (
              <div className="p-4 rounded-xl glass-card border border-primary/20 animate-fade-in">
                <div className="flex gap-4">
                  <img 
                    src={youtubeThumbnail} 
                    alt={youtubeVideoInfo.title}
                    className="w-32 h-24 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h4 className="font-semibold line-clamp-2 mb-1">{youtubeVideoInfo.title}</h4>
                    <p className="text-sm text-muted-foreground">{youtubeVideoInfo.author}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      <span className="text-sm text-muted-foreground">Processing audio automatically...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
