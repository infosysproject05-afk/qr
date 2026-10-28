import { MongoClient, ServerApiVersion } from 'mongodb';

const memoryStore = globalThis.__verifierCredentialStore || new Map();
globalThis.__verifierCredentialStore = memoryStore;

const MONGODB_URI = process.env.MONGODB_URI || '';

const DB_NAME = process.env.MONGODB_DB_NAME || 'files';
const COLLECTION_NAME = process.env.MONGODB_COLLECTION || 'credentials';

let client = null;
let clientPromise = null;

async function getCollection() {
  if (client) {
    return client.db(DB_NAME).collection(COLLECTION_NAME);
  }

  if (!MONGODB_URI) {
    console.warn('[Vercel MongoDB] MONGODB_URI is not set in environment variables.');
    return null;
  }

  if (!clientPromise) {
    const mongoClient = new MongoClient(MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });

    clientPromise = mongoClient
      .connect()
      .then((c) => {
        client = c;
        console.log('[Vercel MongoDB] Connected successfully to', DB_NAME);
        const col = client.db(DB_NAME).collection(COLLECTION_NAME);
        col.createIndex({ credentialId: 1 }, { unique: true }).catch(() => {});
        return col;
      })
      .catch((err) => {
        clientPromise = null;
        client = null;
        console.warn('[Vercel MongoDB] Connection warning:', err.message);
        return null;
      });
  }

  return clientPromise;
}

export async function saveCredential(id, value) {
  memoryStore.set(id, value);
  try {
    const col = await getCollection();
    if (col) {
      await col.updateOne(
        { credentialId: id },
        {
          $set: { credentialId: id, data: value, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
      console.log(`[Vercel MongoDB] Stored credential ${id}`);
    }
  } catch (err) {
    console.warn('[Vercel MongoDB] Failed to save to MongoDB (stored in memory):', err.message);
  }
}

export async function getCredential(id) {
  try {
    const col = await getCollection();
    if (col) {
      const doc = await col.findOne({ credentialId: id });
      if (doc && doc.data) {
        memoryStore.set(id, doc.data);
        return doc.data;
      }
    }
  } catch (err) {
    console.warn('[Vercel MongoDB] Failed to query MongoDB (using memory):', err.message);
  }

  return memoryStore.get(id) || null;
}

export async function deleteCredential(id) {
  memoryStore.delete(id);
  try {
    const col = await getCollection();
    if (col) {
      await col.deleteOne({ credentialId: id });
      console.log(`[Vercel MongoDB] Deleted credential ${id}`);
    }
  } catch (err) {
    console.warn('[Vercel MongoDB] Failed to delete from MongoDB:', err.message);
  }
}