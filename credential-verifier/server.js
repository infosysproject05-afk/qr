/**
 * VeriTrust Credential Verifier Server
 * Lightweight, zero-dependency Node.js HTTP server.
 * Serves static verifier UI, handles CORS proxies, and supports VC-API store endpoints.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : __dirname;

// In-memory store for credentials posted via /api/credentials fallback
const credentialStore = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonld': 'application/ld+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. CORS Proxy Endpoint for fetching remote VCs (e.g. from storage.dcc.did.coop)
  if (pathname === '/api/fetch') {
    const targetUrl = parsedUrl.query.url;
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing ?url parameter' }));
      return;
    }

    try {
      const client = targetUrl.startsWith('https') ? https : http;
      client.get(targetUrl, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json'
        });
        proxyRes.pipe(res);
      }).on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch upstream URL: ' + err.message }));
      });
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid URL format' }));
    }
    return;
  }

  // 2. VC-API Compatible Credential Store (/api/credentials)
  // Matches verifierInstance.ts in the wallet app
  if (pathname === '/api/credentials' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const id = crypto.randomUUID();
        credentialStore.set(id, data.vp || data);

        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers.host || `localhost:${PORT}`;
        const serverBase = `${protocol}://${host}`;

        const responsePayload = {
          server: serverBase,
          url: {
            view: `/#verify?vc=${encodeURIComponent(`${serverBase}/api/credentials/${id}`)}`,
            get: `/api/credentials/${id}`,
            unshare: `/api/credentials/${id}`
          }
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responsePayload));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
      }
    });
    return;
  }

  // 3. Retrieve stored credential by ID (/api/credentials/:id)
  if (pathname.startsWith('/api/credentials/') && req.method === 'GET') {
    const id = pathname.replace('/api/credentials/', '');
    if (credentialStore.has(id)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(credentialStore.get(id)));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Credential not found' }));
    }
    return;
  }

  // 4. Delete/Unshare stored credential (/api/credentials/:id)
  if (pathname.startsWith('/api/credentials/') && req.method === 'DELETE') {
    const id = pathname.replace('/api/credentials/', '');
    credentialStore.delete(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'unshared' }));
    return;
  }

  // 5. Static Files
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Server error loading file');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🛡️  VeriTrust Credential Verifier Server Running!`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔗 Verify Link Format: http://localhost:${PORT}/#verify?vc=<url>`);
  console.log(`=======================================================`);
});
