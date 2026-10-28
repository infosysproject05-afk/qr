import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const mongo = require('../mongo.cjs');

export async function saveCredential(id, value) {
  return mongo.saveCredential(id, value);
}

export async function getCredential(id) {
  return mongo.getCredential(id);
}

export async function deleteCredential(id) {
  return mongo.deleteCredential(id);
}