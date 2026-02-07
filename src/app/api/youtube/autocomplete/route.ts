import { NextRequest, NextResponse } from 'next/server';

const AUTOCOMPLETE_URL = 'https://suggestqueries.google.com/complete/search';

function parseSuggestions(payload: unknown): string[] {
  if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[1])) {
    return [];
  }

  return payload[1]
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, 8);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() || '';

  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  if (query.length > 100) {
    return NextResponse.json({ error: 'Search query is too long' }, { status: 400 });
  }

  const url = `${AUTOCOMPLETE_URL}?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      throw new Error(`Autocomplete failed with status ${response.status}`);
    }

    const payload = await response.json();
    const suggestions = parseSuggestions(payload);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('[YouTube Autocomplete] Error:', error);
    return NextResponse.json({ suggestions: [] });
  }
}
