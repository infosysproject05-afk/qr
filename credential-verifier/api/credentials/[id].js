import store from '../_credentialStore.js';

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default function handler(request, response) {
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
    if (!store.has(id)) {
      response.status(404).json({ error: 'Credential not found' });
      return;
    }
    response.status(200).json(store.get(id));
    return;
  }

  if (request.method === 'DELETE') {
    store.delete(id);
    response.status(200).json({ status: 'unshared' });
    return;
  }

  response.status(405).json({ error: 'Method not allowed' });
}