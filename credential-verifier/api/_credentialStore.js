const memoryStore = globalThis.__verifierCredentialStore || new Map();
const kvUrl = process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.VERCEL_KV_REST_API_TOKEN;

globalThis.__verifierCredentialStore = memoryStore;

const useKv = Boolean(kvUrl && kvToken);

async function kvRequest(command, args) {
	const response = await fetch(`${kvUrl}/${command}/${args.map(encodeURIComponent).join('/')}`, {
		headers: { Authorization: `Bearer ${kvToken}` }
	});
	if (!response.ok) throw new Error(`Credential store request failed with ${response.status}`);
	return response.json();
}

export async function saveCredential(id, value) {
	if (useKv) {
		await kvRequest('set', [id, JSON.stringify(value)]);
		return;
	}
	memoryStore.set(id, value);
}

export async function getCredential(id) {
	if (useKv) {
		const result = await kvRequest('get', [id]);
		return result.result ? JSON.parse(result.result) : null;
	}
	return memoryStore.get(id) || null;
}

export async function deleteCredential(id) {
	if (useKv) {
		await kvRequest('del', [id]);
		return;
	}
	memoryStore.delete(id);
}