import { getStore } from '@netlify/blobs';

const STORE_NAME = 'policy-monitoring';
const BLOB_KEY = 'data.json';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  if (req.method !== 'POST') return respond(405, { ok: false, error: 'Method not allowed' });

  const secret = req.headers.get('x-deploy-secret');
  if (!secret || secret !== process.env.POLICY_MONITORING_INGEST_SECRET) {
    return respond(401, { ok: false, error: 'Unauthorized' });
  }

  let body;
  try { body = await req.json(); } catch { return respond(400, { ok: false, error: 'Invalid JSON body' }); }

  await getStore(STORE_NAME).setJSON(BLOB_KEY, body);
  return respond(200, { ok: true });
}

export const config = { path: '/api/policy-monitoring-ingest' };
