import { NextRequest, NextResponse } from 'next/server';
import ytDlp from 'yt-dlp-exec';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DOWNLOAD_TIMEOUT_MS = 120000;
const MAX_AUDIO_SIZE_BYTES = 60 * 1024 * 1024;
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.webm', '.opus'] as const;

interface VideoInfo {
  title: string;
  author: string;
  lengthSeconds: number;
  audioUrl: string;
  videoId: string;
  thumbnail: string;
}

interface DownloadStrategy {
  label: string;
  flags: Record<string, string | number | boolean>;
}

class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getWritableTempDir(): string {
  const baseTmp = os.tmpdir();
  const appTmp = path.join(baseTmp, 'neuralwave-temp');
  fs.mkdirSync(appTmp, { recursive: true });
  return appTmp;
}

function extractVideoId(url: string): string | null {
  const normalized = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function getThumbnailUrl(
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

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    const parts = [error.message];
    const maybeError = error as Error & { stderr?: string; stdout?: string; shortMessage?: string };
    if (typeof maybeError.shortMessage === 'string') parts.push(maybeError.shortMessage);
    if (typeof maybeError.stderr === 'string') parts.push(maybeError.stderr);
    if (typeof maybeError.stdout === 'string') parts.push(maybeError.stdout);
    return parts.filter(Boolean).join('\n');
  }

  return String(error ?? 'Unknown error');
}

function isBotProtectionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('sign in to confirm') ||
    normalized.includes("youre not a bot") ||
    normalized.includes("you're not a bot") ||
    normalized.includes('http error 429') ||
    normalized.includes('use --cookies')
  );
}

function isRestrictedVideoError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('video unavailable') ||
    normalized.includes('this video is private') ||
    normalized.includes('private video') ||
    normalized.includes('members-only') ||
    normalized.includes('age-restricted') ||
    normalized.includes('copyright')
  );
}

function toApiErrorFromYtDlp(message: string): ApiError {
  const normalized = message.toLowerCase();

  if (isBotProtectionError(message)) {
    return new ApiError(
      'YouTube temporarily blocked automated access for this video. Please try another public video or retry in a few minutes.',
      503,
      'YOUTUBE_BOT_PROTECTION'
    );
  }

  if (isRestrictedVideoError(message)) {
    return new ApiError(
      'This video is unavailable, private, or restricted. Please try a different public video.',
      400,
      'VIDEO_RESTRICTED'
    );
  }

  if (
    normalized.includes('unsupported url') ||
    normalized.includes('invalid url') ||
    normalized.includes('not a valid url')
  ) {
    return new ApiError(
      'Invalid YouTube URL. Please provide a valid video link.',
      400,
      'INVALID_URL'
    );
  }

  if (
    normalized.includes('timed out') ||
    normalized.includes('network') ||
    normalized.includes('connection reset')
  ) {
    return new ApiError(
      'Network issue while downloading audio. Please retry in a moment.',
      503,
      'NETWORK_ERROR'
    );
  }

  return new ApiError(
    'Unable to download this video right now. Please try a different public video or try again later.',
    500,
    'DOWNLOAD_FAILED'
  );
}

async function getOEmbedInfo(url: string): Promise<{ title?: string; author?: string } | null> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as { title?: string; author_name?: string };
    return {
      title: data.title,
      author: data.author_name,
    };
  } catch {
    return null;
  }
}

function createCookiesFile(tempDir: string): { cookieFile: string | null; shouldCleanup: boolean } {
  const rawCookies = process.env.YOUTUBE_COOKIES?.trim();
  if (rawCookies) {
    const cookieFile = path.join(tempDir, `yt_cookies_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.txt`);
    fs.writeFileSync(cookieFile, rawCookies, 'utf8');
    return { cookieFile, shouldCleanup: true };
  }

  const cookieFileFromEnv = process.env.YOUTUBE_COOKIES_FILE?.trim();
  if (cookieFileFromEnv && fs.existsSync(cookieFileFromEnv)) {
    return { cookieFile: cookieFileFromEnv, shouldCleanup: false };
  }

  return { cookieFile: null, shouldCleanup: false };
}

function buildDownloadStrategies(outputTemplate: string, cookieFile: string | null): DownloadStrategy[] {
  const commonFlags: Record<string, string | number | boolean> = {
    noPlaylist: true,
    noWarnings: true,
    quiet: true,
    format: 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
    output: outputTemplate,
    retries: 2,
    fragmentRetries: 2,
    fileAccessRetries: 2,
    socketTimeout: 15,
    forceIpv4: true,
  };

  if (cookieFile) {
    commonFlags.cookies = cookieFile;
  }

  return [
    {
      label: 'android client',
      flags: {
        ...commonFlags,
        extractorArgs: 'youtube:player_client=android',
      },
    },
    {
      label: 'ios client',
      flags: {
        ...commonFlags,
        extractorArgs: 'youtube:player_client=ios',
      },
    },
    {
      label: 'tv embedded client',
      flags: {
        ...commonFlags,
        extractorArgs: 'youtube:player_client=tv_embedded',
      },
    },
    {
      label: 'default client',
      flags: {
        ...commonFlags,
      },
    },
  ];
}

function findDownloadedAudioFile(outputTemplate: string): string | null {
  const outputDir = path.dirname(outputTemplate);
  const outputPrefix = path.basename(outputTemplate).replace('.%(ext)s', '');

  for (const extension of AUDIO_EXTENSIONS) {
    const candidate = path.join(outputDir, `${outputPrefix}${extension}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const fallback = fs.readdirSync(outputDir).find((entry) => entry.startsWith(outputPrefix));
    return fallback ? path.join(outputDir, fallback) : null;
  } catch {
    return null;
  }
}

function cleanupDownloadedFiles(outputTemplate: string): void {
  const outputDir = path.dirname(outputTemplate);
  const outputPrefix = path.basename(outputTemplate).replace('.%(ext)s', '');

  try {
    const files = fs.readdirSync(outputDir).filter((entry) => entry.startsWith(outputPrefix));
    for (const file of files) {
      try {
        fs.unlinkSync(path.join(outputDir, file));
      } catch {
        // Ignore cleanup failures.
      }
    }
  } catch {
    // Ignore cleanup failures.
  }
}

async function downloadAudioWithYtDlp(
  url: string,
  outputTemplate: string,
  cookieFile: string | null
): Promise<string> {
  const strategies = buildDownloadStrategies(outputTemplate, cookieFile);
  let lastErrorMessage = 'Unknown yt-dlp error';

  for (const strategy of strategies) {
    try {
      console.log(`[Server] yt-dlp strategy: ${strategy.label}`);
      await ytDlp(url, strategy.flags, {
        timeout: DOWNLOAD_TIMEOUT_MS,
        windowsHide: true,
      });

      const audioFile = findDownloadedAudioFile(outputTemplate);
      if (audioFile) {
        return audioFile;
      }

      lastErrorMessage = 'yt-dlp completed without producing an audio file';
      cleanupDownloadedFiles(outputTemplate);
    } catch (error) {
      lastErrorMessage = getErrorText(error);
      console.warn(`[Server] yt-dlp failed for strategy: ${strategy.label}`);
      cleanupDownloadedFiles(outputTemplate);
    }
  }

  throw toApiErrorFromYtDlp(lastErrorMessage);
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof SyntaxError) {
    return new ApiError('Invalid request payload.', 400, 'INVALID_REQUEST');
  }

  if (error instanceof Error) {
    return toApiErrorFromYtDlp(getErrorText(error));
  }

  return new ApiError(
    'Unable to process this video right now. Please try again later.',
    500,
    'UNKNOWN_ERROR'
  );
}

export async function POST(request: NextRequest) {
  let outputTemplate: string | null = null;
  let cookieFile: string | null = null;
  let shouldCleanupCookieFile = false;
  let audioFile: string | null = null;

  try {
    const body = await request.json();
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';
    const shouldDownloadAudio = Boolean(body?.downloadAudio);

    if (!rawUrl) {
      throw new ApiError('URL is required', 400, 'URL_REQUIRED');
    }

    const videoId = extractVideoId(rawUrl);
    if (!videoId) {
      throw new ApiError(
        'Invalid YouTube URL. Please use a valid YouTube link.',
        400,
        'INVALID_URL'
      );
    }

    const normalizedUrl = rawUrl.startsWith('http')
      ? rawUrl
      : `https://www.youtube.com/watch?v=${videoId}`;

    const oembed = await getOEmbedInfo(normalizedUrl);
    const videoInfo: VideoInfo = {
      title: oembed?.title || 'YouTube Video',
      author: oembed?.author || 'Unknown',
      lengthSeconds: 0,
      audioUrl: '',
      videoId,
      thumbnail: getThumbnailUrl(videoId, 'hq'),
    };

    if (!shouldDownloadAudio) {
      return NextResponse.json(videoInfo);
    }

    const tempDir = getWritableTempDir();
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    outputTemplate = path.join(tempDir, `${videoId}_${uniqueSuffix}.%(ext)s`);

    const cookieConfig = createCookiesFile(tempDir);
    cookieFile = cookieConfig.cookieFile;
    shouldCleanupCookieFile = cookieConfig.shouldCleanup;

    audioFile = await downloadAudioWithYtDlp(normalizedUrl, outputTemplate, cookieFile);

    if (!fs.existsSync(audioFile)) {
      throw new ApiError(
        'Unable to download audio for this video.',
        500,
        'AUDIO_NOT_FOUND'
      );
    }

    const audioBuffer = fs.readFileSync(audioFile);
    if (audioBuffer.length > MAX_AUDIO_SIZE_BYTES) {
      throw new ApiError(
        'Video is too long. Please use videos under 30 minutes.',
        400,
        'VIDEO_TOO_LARGE'
      );
    }

    const ext = path.extname(audioFile).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.webm': 'audio/webm',
      '.opus': 'audio/opus',
    };

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': contentTypes[ext] || 'audio/webm',
        'Content-Length': audioBuffer.length.toString(),
        'X-Video-Title': encodeURIComponent(videoInfo.title),
        'X-Video-Author': encodeURIComponent(videoInfo.author),
        'X-Video-Id': videoInfo.videoId,
        'X-Video-Thumbnail': videoInfo.thumbnail,
        'X-Video-Length': videoInfo.lengthSeconds.toString(),
      },
    });
  } catch (error) {
    const apiError = toApiError(error);
    console.error(`[Server] YouTube extraction failed (${apiError.code})`);
    if (!(error instanceof ApiError)) {
      console.error(error);
    }

    return NextResponse.json(
      { error: apiError.message, code: apiError.code },
      { status: apiError.status }
    );
  } finally {
    if (audioFile && fs.existsSync(audioFile)) {
      try {
        fs.unlinkSync(audioFile);
      } catch {
        // Ignore cleanup failures.
      }
    }

    if (outputTemplate) {
      cleanupDownloadedFiles(outputTemplate);
    }

    if (shouldCleanupCookieFile && cookieFile && fs.existsSync(cookieFile)) {
      try {
        fs.unlinkSync(cookieFile);
      } catch {
        // Ignore cleanup failures.
      }
    }
  }
}
