
import { NextRequest, NextResponse } from 'next/server';
import play from 'play-dl';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const execAsync = promisify(exec);

function getWritableTempDir(): string {
  // Vercel/Lambda writable filesystem lives under /tmp.
  const baseTmp = os.tmpdir();
  const appTmp = path.join(baseTmp, 'neuralwave-temp');
  fs.mkdirSync(appTmp, { recursive: true });
  return appTmp;
}

interface VideoInfo {
  title: string;
  author: string;
  lengthSeconds: number;
  audioUrl: string;
  videoId: string;
  thumbnail: string;
}

function extractVideoId(url: string): string | null {
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

function getThumbnailUrl(videoId: string, quality: 'default' | 'hq' | 'mq' | 'sd' | 'maxres' = 'hq'): string {
  const qualityMap = {
    'default': 'default',
    'mq': 'mqdefault',
    'hq': 'hqdefault',
    'sd': 'sddefault',
    'maxres': 'maxresdefault',
  };

  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`[Server] Attempt ${attempt + 1} failed, retrying in ${baseDelay * Math.pow(2, attempt)}ms...`);

      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
}

// Try different yt-dlp configurations
async function downloadWithYtDlp(url: string, outputPath: string, _videoId: string): Promise<void> {
  // Different command configurations to try
  const commands = [
    // Method 1: Default with android client (most reliable)
    `yt-dlp -x --audio-format mp3 --audio-quality 0 --no-playlist -o "${outputPath.replace('.opus', '.mp3')}" --extractor-args "youtube:player_client=android" "${url}"`,

    // Method 2: iOS client
    `yt-dlp -x --audio-format mp3 --audio-quality 0 --no-playlist -o "${outputPath.replace('.opus', '.mp3')}" --extractor-args "youtube:player_client=ios" "${url}"`,

    // Method 3: Web client with cookies bypass
    `yt-dlp -x --audio-format mp3 --audio-quality 0 --no-playlist -o "${outputPath.replace('.opus', '.mp3')}" --extractor-args "youtube:player_client=web" --no-check-certificates "${url}"`,

    // Method 4: MediaConnect client
    `yt-dlp -x --audio-format mp3 --audio-quality 0 --no-playlist -o "${outputPath.replace('.opus', '.mp3')}" --extractor-args "youtube:player_client=mediaconnect" "${url}"`,

    // Method 5: Best audio without format conversion
    `yt-dlp -f "bestaudio[ext=m4a]/bestaudio" --no-playlist -o "${outputPath.replace('.opus', '.m4a')}" "${url}"`,
  ];

  let lastError: Error | null = null;

  for (let i = 0; i < commands.length; i++) {
    try {
      console.log(`[Server] Trying download method ${i + 1}...`);
      await execAsync(commands[i], { timeout: 120000 }); // 2 minute timeout

      // Check which file was created
      const possibleFiles = [
        outputPath.replace('.opus', '.mp3'),
        outputPath.replace('.opus', '.m4a'),
        outputPath,
      ];

      for (const file of possibleFiles) {
        if (fs.existsSync(file)) {
          console.log(`[Server] ✓ Download successful with method ${i + 1}`);
          // Rename to expected output path if different
          if (file !== outputPath) {
            fs.renameSync(file, outputPath.replace('.opus', path.extname(file)));
          }
          return;
        }
      }

      throw new Error('Download completed but file not found');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`[Server] Method ${i + 1} failed:`, lastError.message.substring(0, 100));

      // Clean up any partial files
      const possibleFiles = [
        outputPath.replace('.opus', '.mp3'),
        outputPath.replace('.opus', '.m4a'),
        outputPath,
      ];
      for (const file of possibleFiles) {
        if (fs.existsSync(file)) {
          try { fs.unlinkSync(file); } catch {}
        }
      }
    }
  }

  throw new Error(`All download methods failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

// Alternative: Use play-dl stream directly
async function downloadWithPlayDl(url: string, outputPath: string): Promise<void> {
  console.log('[Server] Trying play-dl stream method...');

  const stream = await play.stream(url, { quality: 2 }); // quality 2 = highest

  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(outputPath.replace('.opus', '.webm'));

    stream.stream.pipe(writeStream);

    writeStream.on('finish', () => {
      console.log('[Server] ✓ play-dl stream download complete');
      resolve();
    });

    writeStream.on('error', (error) => {
      reject(error);
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      writeStream.destroy();
      reject(new Error('Download timeout'));
    }, 120000);
  });
}

async function getOEmbedInfo(url: string): Promise<{ title?: string; author?: string } | null> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    if (!response.ok) return null;
    const data = await response.json() as { title?: string; author_name?: string };
    return {
      title: data.title,
      author: data.author_name,
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, downloadAudio: shouldDownloadAudio } = body;

    console.log('[Server] ========================================');
    console.log('[Server] Received YouTube extract request');
    console.log('[Server] URL:', url);
    console.log('[Server] Download audio:', shouldDownloadAudio);

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);

    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL. Please use a valid YouTube link.' },
        { status: 400 }
      );
    }

    console.log(`[Server] Extracted video ID: ${videoId}`);

    // Validate URL
    const isValid = play.yt_validate(url);
    if (isValid !== 'video') {
      return NextResponse.json(
        { error: 'Invalid YouTube video URL. Please provide a direct video link.' },
        { status: 400 }
      );
    }

    // Get video info with retry
    console.log('[Server] Fetching video info...');
    let videoInfo: VideoInfo;

    try {
      const basicInfo = await retryWithBackoff(
        () => play.video_basic_info(url),
        3,
        1000
      );

      const videoDetails = basicInfo.video_details;
      videoInfo = {
        title: videoDetails.title || 'Unknown Title',
        author: videoDetails.channel?.name || 'Unknown',
        lengthSeconds: videoDetails.durationInSec || 0,
        audioUrl: '',
        videoId: videoId,
        thumbnail: videoDetails.thumbnails[videoDetails.thumbnails.length - 1]?.url || getThumbnailUrl(videoId, 'hq'),
      };
    } catch (infoError) {
      console.warn('[Server] Video info from play-dl failed, using fallback metadata.');
      const oembed = await getOEmbedInfo(url);
      videoInfo = {
        title: oembed?.title || 'YouTube Video',
        author: oembed?.author || 'Unknown',
        lengthSeconds: 0,
        audioUrl: '',
        videoId: videoId,
        thumbnail: getThumbnailUrl(videoId, 'hq'),
      };
    }

    if (videoInfo.lengthSeconds > 1800) {
      return NextResponse.json(
        { error: 'Video is too long. Please use videos under 30 minutes.' },
        { status: 400 }
      );
    }

    console.log(`[Server] ✓ Video info: ${videoInfo.title}`);

    // If downloadAudio is true, download and return the audio directly
    if (shouldDownloadAudio) {
      console.log('[Server] Starting audio download...');

      // Use writable temp storage (e.g. /tmp on Vercel)
      const tempDir = getWritableTempDir();
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const outputPath = path.join(tempDir, `${videoId}_${uniqueSuffix}.opus`);
      let audioBuffer: Buffer | null = null;
      let audioFile: string | null = null;

      // Try yt-dlp first
      try {
        await downloadWithYtDlp(url, outputPath, videoId);

        // Find the downloaded file
        const possibleFiles = [
          outputPath.replace('.opus', '.mp3'),
          outputPath.replace('.opus', '.m4a'),
          outputPath.replace('.opus', '.webm'),
          outputPath,
        ];

        for (const file of possibleFiles) {
          if (fs.existsSync(file)) {
            audioFile = file;
            audioBuffer = fs.readFileSync(file);
            break;
          }
        }
      } catch (ytdlpError) {
        console.log('[Server] yt-dlp failed, trying play-dl...');

        // Fallback to play-dl
        try {
          await downloadWithPlayDl(url, outputPath);

          const webmPath = outputPath.replace('.opus', '.webm');
          if (fs.existsSync(webmPath)) {
            audioFile = webmPath;
            audioBuffer = fs.readFileSync(webmPath);
          }
        } catch (playDlError) {
          console.error('[Server] play-dl also failed:', playDlError);
          throw new Error('Unable to download audio. This video may be restricted or unavailable. Please try a different video.');
        }
      }

      if (!audioBuffer || !audioFile) {
        throw new Error('Failed to download audio file. Please try again.');
      }

      console.log('[Server] ✓ Audio file size:', (audioBuffer.length / 1024 / 1024).toFixed(2), 'MB');

      // Clean up temp file
      try {
        fs.unlinkSync(audioFile);
      } catch {}

      // Determine content type based on file extension
      const ext = path.extname(audioFile).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.webm': 'audio/webm',
        '.opus': 'audio/opus',
      };

      console.log('[Server] ========================================');

      // Return audio with video info in headers
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
    }

    // Otherwise just return video info
    console.log('[Server] ========================================');
    return NextResponse.json(videoInfo);
  } catch (error) {
    console.error('[Server] ========================================');
    console.error('[Server] YouTube extraction error:', error);
    console.error('[Server] ========================================');

    // Provide user-friendly error messages
    let errorMessage = 'Failed to extract video. Please try again.';

    if (error instanceof Error) {
      if (error.message.includes('restricted') || error.message.includes('unavailable')) {
        errorMessage = 'This video is restricted or unavailable. Please try a different video.';
      } else if (error.message.includes('too long')) {
        errorMessage = 'Video is too long. Please use videos under 30 minutes.';
      } else if (error.message.includes('Invalid')) {
        errorMessage = error.message;
      } else {
        errorMessage = 'Unable to download this video. Please try a different one or try again later.';
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
