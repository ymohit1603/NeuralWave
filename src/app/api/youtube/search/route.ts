/**
 * YouTube Search API Route
 * Searches YouTube for videos and returns results
 */

import { NextRequest, NextResponse } from 'next/server';

interface YouTubeSearchResult {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  duration: string;
  views: string;
}

// YouTube search using the Invidious API (public YouTube frontend)
// This avoids needing a YouTube API key
const INVIDIOUS_INSTANCES = [
  'https://vid.puffyan.us',
  'https://invidious.snopyta.org',
  'https://yewtu.be',
  'https://invidious.kavin.rocks',
];

async function searchWithInvidious(query: string): Promise<YouTubeSearchResult[]> {
  const errors: string[] = [];

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const searchUrl = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort_by=relevance`;

      const response = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000), // 8 second timeout per instance
      });

      if (!response.ok) {
        errors.push(`${instance}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        errors.push(`${instance}: Invalid response format`);
        continue;
      }

      // Map Invidious response to our format
      const results: YouTubeSearchResult[] = data
        .filter((item: any) => item.type === 'video')
        .slice(0, 10)
        .map((item: any) => ({
          videoId: item.videoId,
          title: item.title,
          author: item.author,
          thumbnail: item.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
          duration: formatDuration(item.lengthSeconds),
          views: formatViews(item.viewCount),
        }));

      if (results.length > 0) {
        return results;
      }

      errors.push(`${instance}: No results found`);
    } catch (error) {
      errors.push(`${instance}: ${(error as Error).message}`);
      continue;
    }
  }

  // If all Invidious instances fail, try YouTube's suggestion API as fallback
  try {
    return await searchWithYouTubeSuggestions(query);
  } catch (error) {
    console.error('All search methods failed:', errors);
    throw new Error('Search temporarily unavailable. Please try again in a few moments.');
  }
}

// Fallback: Use YouTube's public search page scraping
async function searchWithYouTubeSuggestions(query: string): Promise<YouTubeSearchResult[]> {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`;

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error('YouTube search failed');
  }

  const html = await response.text();

  // Extract ytInitialData from the page
  const dataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s);
  if (!dataMatch) {
    throw new Error('Could not parse YouTube response');
  }

  try {
    const data = JSON.parse(dataMatch[1]);
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

    const results: YouTubeSearchResult[] = contents
      .filter((item: any) => item.videoRenderer)
      .slice(0, 10)
      .map((item: any) => {
        const video = item.videoRenderer;
        return {
          videoId: video.videoId,
          title: video.title?.runs?.[0]?.text || 'Unknown',
          author: video.ownerText?.runs?.[0]?.text || 'Unknown',
          thumbnail: `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
          duration: video.lengthText?.simpleText || '0:00',
          views: video.viewCountText?.simpleText || '0 views',
        };
      });

    return results;
  } catch (error) {
    throw new Error('Failed to parse search results');
  }
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(views: number): string {
  if (!views || views <= 0) return '0 views';

  if (views >= 1000000000) {
    return `${(views / 1000000000).toFixed(1)}B views`;
  }
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M views`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K views`;
  }
  return `${views} views`;
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (trimmedQuery.length > 100) {
      return NextResponse.json(
        { error: 'Search query is too long' },
        { status: 400 }
      );
    }

    console.log('[YouTube Search] Searching for:', trimmedQuery);

    const results = await searchWithInvidious(trimmedQuery);

    console.log(`[YouTube Search] Found ${results.length} results`);

    return NextResponse.json({ results });

  } catch (error) {
    console.error('[YouTube Search] Error:', error);

    return NextResponse.json(
      { error: (error as Error).message || 'Search failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json(
      { error: 'Search query is required (use ?q=your+search)' },
      { status: 400 }
    );
  }

  // Reuse POST logic
  const fakeRequest = {
    json: async () => ({ query }),
  } as NextRequest;

  return POST(fakeRequest);
}
