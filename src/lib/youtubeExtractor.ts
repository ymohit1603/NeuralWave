/**
 * YouTube Audio Extractor - Client Side
 * Browser-first download with server fallback.
 */

export interface StreamCandidate {
  url: string;
  formatId: string;
  ext: string;
  protocol: string;
  abr: number;
  sourceStrategy: string;
}

export interface VideoInfo {
  title: string;
  author: string;
  lengthSeconds: number;
  audioUrl: string;
  videoId: string;
  thumbnail: string;
}

interface MetadataResponse extends VideoInfo {
  clientStreamCandidates?: StreamCandidate[];
  clientStreamStatus?: 'ready' | 'unavailable';
  clientStreamErrorCode?: string | null;
}

const BROWSER_CANDIDATE_TIMEOUT_MS = 30000;

/**
 * Extract video ID from various YouTube URL formats.
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Get YouTube thumbnail URL.
 */
export function getThumbnailUrl(
  videoId: string,
  quality: 'default' | 'hq' | 'mq' | 'sd' | 'maxres' = 'hq'
): string {
  const qualityMap = {
    default: 'default',
    mq: 'mqdefault',
    hq: 'hqdefault',
    sd: 'sddefault',
    maxres: 'maxresdefault',
  };

  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

function toVideoInfo(metadata: Partial<MetadataResponse>, fallbackVideoId: string): VideoInfo {
  return {
    title: metadata.title || 'YouTube Video',
    author: metadata.author || 'Unknown',
    lengthSeconds: Number.isFinite(metadata.lengthSeconds) ? Number(metadata.lengthSeconds) : 0,
    audioUrl: '',
    videoId: metadata.videoId || fallbackVideoId,
    thumbnail: metadata.thumbnail || getThumbnailUrl(fallbackVideoId),
  };
}

function toVideoInfoFromHeaders(response: Response, fallbackVideoId: string): VideoInfo {
  return {
    title: decodeURIComponent(response.headers.get('X-Video-Title') || 'YouTube Video'),
    author: decodeURIComponent(response.headers.get('X-Video-Author') || 'Unknown'),
    lengthSeconds: parseInt(response.headers.get('X-Video-Length') || '0', 10) || 0,
    audioUrl: '',
    videoId: response.headers.get('X-Video-Id') || fallbackVideoId,
    thumbnail: response.headers.get('X-Video-Thumbnail') || getThumbnailUrl(fallbackVideoId),
  };
}

function isLikelyCorsOrNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('failed to fetch') || message.includes('networkerror') || message.includes('cors');
}

async function readResponseToBytes(
  response: Response,
  startProgress: number,
  endProgress: number,
  stageLabel: string,
  onProgress?: (stage: string, progress: number) => void
): Promise<Uint8Array> {
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress?.(stageLabel, endProgress);
    return new Uint8Array(buffer);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    if (total > 0) {
      const ratio = Math.min(receivedLength / total, 1);
      const progress = startProgress + ratio * (endProgress - startProgress);
      onProgress?.(stageLabel, progress);
    }
  }

  const output = new Uint8Array(receivedLength);
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }

  onProgress?.(stageLabel, endProgress);
  return output;
}

async function tryBrowserCandidates(
  candidates: StreamCandidate[],
  onProgress?: (stage: string, progress: number) => void
): Promise<Uint8Array | null> {
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    const attemptProgress = 35 + (index / Math.max(candidates.length, 1)) * 10;
    onProgress?.(`Trying browser stream ${index + 1}/${candidates.length}...`, attemptProgress);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BROWSER_CANDIDATE_TIMEOUT_MS);

    try {
      const response = await fetch(candidate.url, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Candidate HTTP ${response.status}`);
      }

      const bytes = await readResponseToBytes(
        response,
        45,
        75,
        `Downloading in browser (${index + 1}/${candidates.length})...`,
        onProgress
      );

      console.log(
        `[Client] Browser stream success (${candidate.sourceStrategy}, format=${candidate.formatId}, ext=${candidate.ext})`
      );
      return bytes;
    } catch (candidateError) {
      const errorText = candidateError instanceof Error ? candidateError.message : String(candidateError);
      if (isLikelyCorsOrNetworkError(candidateError)) {
        console.warn(
          `[Client] Browser candidate failed (likely CORS/network): ${candidate.sourceStrategy} | ${candidate.formatId} | ${errorText}`
        );
      } else {
        console.warn(
          `[Client] Browser candidate failed: ${candidate.sourceStrategy} | ${candidate.formatId} | ${errorText}`
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

async function decodeAudioBytes(
  audioBytes: Uint8Array,
  onProgress?: (stage: string, progress: number) => void
): Promise<AudioBuffer> {
  if (typeof window === 'undefined') {
    throw new Error('Audio decoding must be done on the client side');
  }

  onProgress?.('Processing audio data...', 80);
  await new Promise((resolve) => setTimeout(resolve, 80));

  onProgress?.('Decoding audio...', 90);
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error('Web Audio API is not available in this browser');
  }

  const audioContext = new AudioContextCtor();
  const decodeBuffer = new ArrayBuffer(audioBytes.byteLength);
  new Uint8Array(decodeBuffer).set(audioBytes);
  const decoded = await audioContext.decodeAudioData(decodeBuffer);

  onProgress?.('Finalizing...', 95);
  await new Promise((resolve) => setTimeout(resolve, 80));
  onProgress?.('Complete!', 100);

  return decoded;
}

/**
 * Main function to extract audio from YouTube URL.
 */
export async function extractYouTubeAudio(
  url: string,
  onProgress?: (stage: string, progress: number) => void
): Promise<{ audioBuffer: AudioBuffer; videoInfo: VideoInfo }> {
  try {
    onProgress?.('Extracting video ID...', 5);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL. Please provide a valid YouTube video link.');
    }

    console.log('[Client] Starting YouTube audio extraction for:', videoId);

    onProgress?.('Connecting to YouTube...', 15);
    await new Promise((resolve) => setTimeout(resolve, 80));
    onProgress?.('Fetching video information...', 25);

    const metadataResponse = await fetch('/api/youtube/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, downloadAudio: false, includeStreamCandidates: true }),
    });

    if (!metadataResponse.ok) {
      const error = await metadataResponse.json();
      throw new Error(error.error || 'Failed to fetch YouTube metadata');
    }

    const metadata = (await metadataResponse.json()) as MetadataResponse;
    const fallbackVideoInfo = toVideoInfo(metadata, videoId);
    const browserCandidates = Array.isArray(metadata.clientStreamCandidates)
      ? metadata.clientStreamCandidates
      : [];

    onProgress?.('Video information received', 32);
    await new Promise((resolve) => setTimeout(resolve, 80));

    if (browserCandidates.length > 0) {
      const browserBytes = await tryBrowserCandidates(browserCandidates, onProgress);
      if (browserBytes) {
        const audioBuffer = await decodeAudioBytes(browserBytes, onProgress);
        console.log('[Client] Browser-first YouTube extraction complete');
        return {
          audioBuffer,
          videoInfo: fallbackVideoInfo,
        };
      }
    } else {
      console.warn(
        `[Client] No browser candidates returned (status=${metadata.clientStreamStatus || 'unknown'}, code=${metadata.clientStreamErrorCode || 'none'})`
      );
    }

    onProgress?.('Browser method unavailable, switching to server fallback...', 42);
    const fallbackReason = browserCandidates.length > 0
      ? 'browser_candidate_failed_or_cors'
      : `no_browser_candidates:${metadata.clientStreamErrorCode || 'none'}`;

    const response = await fetch('/api/youtube/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        downloadAudio: true,
        clientFallbackReason: fallbackReason,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract YouTube audio');
    }

    const serverVideoInfo = toVideoInfoFromHeaders(response, videoId);
    const audioBytes = await readResponseToBytes(
      response,
      45,
      75,
      'Downloading audio from server fallback...',
      onProgress
    );

    const audioBuffer = await decodeAudioBytes(audioBytes, onProgress);
    console.log('[Client] Server fallback YouTube extraction complete');

    return {
      audioBuffer,
      videoInfo: {
        ...fallbackVideoInfo,
        ...serverVideoInfo,
      },
    };
  } catch (error) {
    console.error('[Client] YouTube extraction error:', error);
    throw error;
  }
}
