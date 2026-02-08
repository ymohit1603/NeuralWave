// Cloudflare Worker: YouTube API & audio stream proxy
// Deploy to Cloudflare Workers (free tier: 100K req/day)
// Set WORKER_SECRET env var in Worker settings to match CF_WORKER_SECRET in Vercel

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Worker-Secret',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const secret = request.headers.get('X-Worker-Secret');
    if (env.WORKER_SECRET && secret !== env.WORKER_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const { targetUrl, method, headers, body, stream } = await request.json();
      if (!targetUrl) {
        return new Response('Missing targetUrl', { status: 400 });
      }

      const resp = await fetch(targetUrl, {
        method: method || 'GET',
        headers: headers || {},
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      });

      if (stream) {
        // Stream the response back (for audio downloads)
        return new Response(resp.body, {
          status: resp.status,
          headers: {
            'Content-Type': resp.headers.get('Content-Type') || 'application/octet-stream',
            'Content-Length': resp.headers.get('Content-Length') || '',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const data = await resp.text();
      return new Response(data, {
        status: resp.status,
        headers: {
          'Content-Type': resp.headers.get('Content-Type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
