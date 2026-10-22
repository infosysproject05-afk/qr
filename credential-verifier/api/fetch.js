export default async function handler(request, response) {
  const targetUrl = request.query?.url;

  if (!targetUrl) {
    response.status(400).json({ error: 'Missing ?url parameter' });
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported protocol');
  } catch {
    response.status(400).json({ error: 'Invalid URL format' });
    return;
  }

  try {
    const upstream = await fetch(parsedUrl, {
      headers: { Accept: 'application/json, application/ld+json' }
    });
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const body = await upstream.text();
    response.status(upstream.status).setHeader('Content-Type', contentType).send(body);
  } catch (error) {
    response.status(502).json({ error: `Failed to fetch upstream URL: ${error.message}` });
  }
}
