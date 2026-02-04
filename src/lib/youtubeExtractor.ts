/**
 * YouTube Audio Extractor - Client Side
 * Uses Next.js API routes to fetch YouTube audio (server-side to avoid CORS)
 */

export interface VideoInfo {
  title: string;
  author: string;
  lengthSeconds: number;
  audioUrl: string;
  videoId: string;
  thumbnail: string;
}

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Get YouTube thumbnail URL (no CORS issues)
 */
export function getThumbnailUrl(videoId: string, quality: 'default' | 'hq' | 'mq' | 'sd' | 'maxres' = 'hq'): string {
  const qualityMap = {
    'default': 'default',
    'mq': 'mqdefault',
    'hq': 'hqdefault',
    'sd': 'sddefault',
    'maxres': 'maxresdefault',
  };
  
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

/**
 * Main function to extract audio from YouTube URL
 */
export async function extractYouTubeAudio(
  url: string,
  onProgress?: (stage: string, progress: number) => void
): Promise<{ audioBuffer: AudioBuffer; videoInfo: VideoInfo }> {
  try {
    // Extract video ID
    onProgress?.('Extracting video ID...', 5);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      throw new Error('Invalid YouTube URL. Please provide a valid YouTube video link.');
    }

    console.log('[Client] Starting YouTube audio extraction for:', videoId);

    // Fetch video info and download audio in one request
    onProgress?.('Connecting to YouTube...', 15);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    onProgress?.('Fetching video information...', 25);
    
    const response = await fetch('/api/youtube/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, downloadAudio: true }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract YouTube audio');
    }

    onProgress?.('Video information received', 35);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get video info from headers
    const videoInfo: VideoInfo = {
      title: decodeURIComponent(response.headers.get('X-Video-Title') || 'Unknown'),
      author: decodeURIComponent(response.headers.get('X-Video-Author') || 'Unknown'),
      lengthSeconds: parseInt(response.headers.get('X-Video-Length') || '0'),
      audioUrl: '', // Not needed anymore
      videoId: response.headers.get('X-Video-Id') || videoId,
      thumbnail: response.headers.get('X-Video-Thumbnail') || getThumbnailUrl(videoId),
    };

    console.log('[Client] ✓ Video info received:', videoInfo.title);

    // Download audio with progress tracking
    onProgress?.('Downloading audio...', 45);
    
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      if (total > 0) {
        // Map download progress from 45% to 75%
        const downloadProgress = (receivedLength / total) * 100;
        const mappedProgress = 45 + (downloadProgress * 0.3);
        onProgress?.('Downloading audio...', Math.min(mappedProgress, 75));
      }
    }

    // Combine chunks into single ArrayBuffer
    const arrayBuffer = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      arrayBuffer.set(chunk, position);
      position += chunk.length;
    }

    console.log('[Client] ✓ Audio downloaded successfully');

    // Decode audio
    onProgress?.('Processing audio data...', 80);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (typeof window === 'undefined') {
      throw new Error('Audio decoding must be done on the client side');
    }
    
    onProgress?.('Decoding audio...', 90);
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.buffer);

    onProgress?.('Finalizing...', 95);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    onProgress?.('Complete!', 100);

    console.log('[Client] ✓ YouTube audio extraction complete!');

    return {
      audioBuffer,
      videoInfo,
    };
  } catch (error) {
    console.error('[Client] YouTube extraction error:', error);
    throw error;
  }
}
