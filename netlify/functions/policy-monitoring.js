import { getStore } from '@netlify/blobs';

const STORE_NAME = 'policy-monitoring';
const BLOB_KEY = 'data.json';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-deploy-secret',
};

function respond(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS }); // 200, not 204 — null body required
  }
  if (req.method !== 'GET') return respond(405, { ok: false, error: 'Method not allowed' });

  const data = await getStore(STORE_NAME).get(BLOB_KEY, { type: 'json' });
  if (!data) return respond(404, { ok: false, error: 'No data ingested yet' });

  return respond(200, data);
}

export const config = { path: '/api/policy-monitoring' };
