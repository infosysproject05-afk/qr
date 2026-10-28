import { MongoClient, ServerApiVersion } from 'mongodb';

const memoryStore = globalThis.__verifierCredentialStore || new Map();
globalThis.__verifierCredentialStore = memoryStore;

const DIRECT_ATLAS_URI =
  'mongodb://infosysproject05_db_user:Infosys@ac-anqzyfe-shard-00-00.j1exgn9.mongodb.net:27017,ac-anqzyfe-shard-00-01.j1exgn9.mongodb.net:27017,ac-anqzyfe-shard-00-02.j1exgn9.mongodb.net:27017/files?ssl=true&replicaSet=atlas-1dsaq9-shard-0&authSource=admin&retryWrites=true&w=majority';

const MONGODB_URI = process.env.MONGODB_URI || DIRECT_ATLAS_URI;

const DB_NAME = process.env.MONGODB_DB_NAME || 'files';
const COLLECTION_NAME = process.env.MONGODB_COLLECTION || 'credentials';

let client = null;
let clientPromise = null;

async function getCollection() {
  if (client) {
    return client.db(DB_NAME).collection(COLLECTION_NAME);
  }

  if (!clientPromise) {
    const uri = MONGODB_URI || DIRECT_ATLAS_URI;
    const mongoClient = new MongoClient(uri, {
      connectTimeoutMS: 8000,
      serverSelectionTimeoutMS: 8000,
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