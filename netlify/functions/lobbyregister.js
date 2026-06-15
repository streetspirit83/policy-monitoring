const LR_ORIGIN = 'https://www.lobbyregister.bundestag.de';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function respond(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// Server-side proxy for the lobby register search endpoint. The upstream host
// rejects cross-origin browser requests (403 / no CORS), so the browser can't
// call it directly — we relay the request from the function with browser-like
// headers and re-expose the JSON with permissive CORS.
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== 'GET') return respond(405, { ok: false, error: 'Method not allowed' });

  const incoming = new URL(req.url);
  const upstream = new URL(`${LR_ORIGIN}/sucheDetailJson`);
  const q = incoming.searchParams.get('q');
  const sort = incoming.searchParams.get('sort');
  if (q) upstream.searchParams.set('q', q);
  if (sort) upstream.searchParams.set('sort', sort);

  let res;
  try {
    res = await fetch(upstream, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'de-DE,de;q=0.9',
        'Referer': `${LR_ORIGIN}/suche`,
      },
    });
  } catch (err) {
    return respond(502, { ok: false, error: `Upstream request failed: ${err.message}` });
  }

  if (!res.ok) {
    return respond(res.status, { ok: false, error: `Upstream HTTP ${res.status}` });
  }

  const data = await res.json();
  return respond(200, data);
}

export const config = { path: '/api/lobbyregister' };
