import { deleteCredential, getCredential } from '../_credentialStore.js';

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(request, response) {
  setCors(response);

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  const id = request.query?.id;
  if (!id) {
    response.status(400).json({ error: 'Missing credential ID' });
    return;
  }

  if (request.method === 'GET') {
    let credential;
    try {
      credential = await getCredential(id);
    } catch (error) {
      response.status(503).json({ error: `Credential store unavailable: ${error.message}` });
      return;
    }
    if (!credential) {
      response.status(404).json({ error: 'Credential not found' });
      return;
    }
    const acceptsHtml = String(request.headers.accept || '').includes('text/html');
    if (acceptsHtml) {
      const credentialUrl = `https://${request.headers['x-forwarded-host'] || request.headers.host}/api/credentials/${id}`;
      response.status(302).setHeader('Location', `/?vc=${encodeURIComponent(credentialUrl)}`).end();
      return;
    }
    response.status(200).json(credential);
    return;
  }

  if (request.method === 'DELETE') {
    try {
      await deleteCredential(id);
    } catch (error) {
      console.warn('Delete warning:', error.message);
    }
    response.status(200).json({ status: 'unshared' });
    return;
  }

  response.status(405).json({ error: 'Method not allowed' });
}