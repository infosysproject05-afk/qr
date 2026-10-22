import crypto from 'node:crypto';
import store from './_credentialStore.js';

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function serverBase(request) {
  const protocol = request.headers['x-forwarded-proto'] || 'https';
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  return `${protocol}://${host}`;
}

export default function handler(request, response) {
  setCors(response);

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let payload = request.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      response.status(400).json({ error: 'Malformed JSON payload' });
      return;
    }
  }

  if (!payload || typeof payload !== 'object') {
    response.status(400).json({ error: 'Malformed JSON payload' });
    return;
  }

  const id = crypto.randomUUID();
  store.set(id, payload.vp ?? payload);
  const base = serverBase(request);
  const credentialUrl = `${base}/api/credentials/${id}`;

  response.status(200).json({
    server: base,
    url: {
      view: `/#verify?vc=${encodeURIComponent(credentialUrl)}`,
      get: `/api/credentials/${id}`,
      unshare: `/api/credentials/${id}`
    }
  });
}