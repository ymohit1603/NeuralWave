
import { NextRequest, NextResponse } from 'next/server';
import play from 'play-dl';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

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
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    console.log(`[Server] Extracted video ID: ${videoId}`);

    // Validate URL
    const isValid = play.yt_validate(url);
    if (isValid !== 'video') {
      return NextResponse.json(
        { error: 'Invalid YouTube video URL' },
        { status: 400 }
      );
    }

    // Get video info
    console.log('[Server] Fetching video info with play-dl...');
    const basicInfo = await play.video_basic_info(url);
    
    const videoDetails = basicInfo.video_details;
    const videoInfo: VideoInfo = {
      title: videoDetails.title || 'Unknown Title',
      author: videoDetails.channel?.name || 'Unknown',
      lengthSeconds: videoDetails.durationInSec || 0,
      audioUrl: '', // Not needed with play-dl
      videoId: videoId,
      thumbnail: videoDetails.thumbnails[videoDetails.thumbnails.length - 1]?.url || getThumbnailUrl(videoId, 'hq'),
    };

    if (videoInfo.lengthSeconds > 1800) {
      return NextResponse.json(
        { error: 'Video is too long. Please use videos under 30 minutes.' },
        { status: 400 }
      );
    }

    console.log(`[Server] ✓ Video info: ${videoInfo.title}`);

    // If downloadAudio is true, download and return the audio directly
    if (shouldDownloadAudio) {
      console.log('[Server] Downloading audio with yt-dlp...');
      
      try {
        // Create temp directory if it doesn't exist
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const outputPath = path.join(tempDir, `${videoId}.opus`);
        
        // Use yt-dlp to download audio with options to bypass restrictions
        console.log('[Server] Running yt-dlp...');
        const command = `yt-dlp -x --audio-format opus --no-playlist --extractor-args "youtube:player_client=web" -o "${outputPath}" "${url}"`;
        
        await execAsync(command);
        
        console.log('[Server] Audio downloaded successfully');
        
        // Read the file
        const audioBuffer = fs.readFileSync(outputPath);
        
        // Clean up temp file
        fs.unlinkSync(outputPath);
        
        console.log('[Server] ✓ Audio file size:', (audioBuffer.length / 1024 / 1024).toFixed(2), 'MB');
        console.log('[Server] ========================================');

        // Return audio with video info in headers
        return new NextResponse(audioBuffer, {
          headers: {
            'Content-Type': 'audio/webm',
            'Content-Length': audioBuffer.length.toString(),
            'X-Video-Title': encodeURIComponent(videoInfo.title),
            'X-Video-Author': encodeURIComponent(videoInfo.author),
            'X-Video-Id': videoInfo.videoId,
            'X-Video-Thumbnail': videoInfo.thumbnail,
            'X-Video-Length': videoInfo.lengthSeconds.toString(),
          },
        });
      } catch (downloadError) {
        console.error('[Server] Audio download failed:', downloadError);
        throw new Error(`Failed to download audio: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`);
      }
    }

    // Otherwise just return video info
    console.log('[Server] ========================================');
    return NextResponse.json(videoInfo);
  } catch (error) {
    console.error('[Server] ========================================');
    console.error('[Server] YouTube extraction error:', error);
    console.error('[Server] ========================================');
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract video information' },
      { status: 500 }
    );
  }
}
