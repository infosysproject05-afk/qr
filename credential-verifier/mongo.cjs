try {
  if (process.loadEnvFile) process.loadEnvFile();
} catch (e) {
  // .env file missing or already loaded
}

const dns = require('dns');
try {
  // Use public DNS to ensure SRV record resolution succeeds on Windows/private DNS
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if cannot set servers in certain environments
}

const { MongoClient, ServerApiVersion } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || '';

const DB_NAME = process.env.MONGODB_DB_NAME || 'files';
const COLLECTION_NAME = process.env.MONGODB_COLLECTION || 'credentials';

let client = null;
let clientPromise = null;
let lastError = null;

// Fallback in-memory store if MongoDB is temporarily connecting or IP is not yet whitelisted
const memoryFallback = globalThis.__verifierCredentialStore || new Map();
globalThis.__verifierCredentialStore = memoryFallback;

async function getClient() {
  if (client) return client;

  if (!MONGODB_URI) {
    lastError = 'MONGODB_URI environment variable is not configured; using memory store.';
    return null;
  }

  if (!clientPromise) {
    const mongoClient = new MongoClient(MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      connectTimeoutMS: 8000,
      serverSelectionTimeoutMS: 8000,
    });

    clientPromise = mongoClient
      .connect()
      .then((c) => {
        client = c;
        lastError = null;
        console.log(`[MongoDB] Connected successfully to database: "${DB_NAME}", collection: "${COLLECTION_NAME}"`);
        // Ensure index on credentialId
        const db = client.db(DB_NAME);
        db.collection(COLLECTION_NAME)
          .createIndex({ credentialId: 1 }, { unique: true })
          .catch((idxErr) => console.warn('[MongoDB] Index creation warning:', idxErr.message));
        return client;
      })
      .catch((err) => {
        clientPromise = null;
        client = null;
        lastError = err.message;
        console.error('[MongoDB] Connection error:', err.message);
        throw err;
      });
  }

  return clientPromise;
}

async function getCollection() {
  const c = await getClient();
  if (!c) return null;
  return c.db(DB_NAME).collection(COLLECTION_NAME);
}

/**
 * Save credential data to MongoDB
 * @param {string} id - Unique credential ID
 * @param {any} data - Verifiable credential or presentation JSON payload
 */
async function saveCredential(id, data) {
  // Always update memory fallback for instant access
  memoryFallback.set(id, data);

  try {
    const col = await getCollection();
    if (!col) return;
    await col.updateOne(
      { credentialId: id },
      {
        $set: {
          credentialId: id,
          data,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    console.log(`[MongoDB] Successfully stored credential "${id}" in MongoDB Atlas`);
  } catch (err) {
    console.warn(`[MongoDB] Failed to persist "${id}" to MongoDB (falling back to memory):`, err.message);
    // Don't re-throw if memory fallback already holds it, so API continues working
  }
}

/**
 * Retrieve credential data by ID
 * @param {string} id - Unique credential ID
 * @returns {Promise<any|null>} - The credential/presentation object or null
 */
async function getCredential(id) {
  try {
    const col = await getCollection();
    if (col) {
      const doc = await col.findOne({ credentialId: id });
      if (doc && doc.data) {
        // Also update memory fallback
        memoryFallback.set(id, doc.data);
        return doc.data;
      }
    }
  } catch (err) {
    console.warn(`[MongoDB] Failed to query "${id}" from MongoDB (checking memory fallback):`, err.message);
  }

  // Fallback to memory
  return memoryFallback.get(id) || null;
}

/**
 * Delete credential data by ID
 * @param {string} id - Unique credential ID
 */
async function deleteCredential(id) {
  memoryFallback.delete(id);
  try {
    const col = await getCollection();
    if (col) {
      await col.deleteOne({ credentialId: id });
      console.log(`[MongoDB] Successfully deleted credential "${id}" from MongoDB Atlas`);
    }
  } catch (err) {
    console.warn(`[MongoDB] Failed to delete "${id}" from MongoDB:`, err.message);
  }
}

function getMongoStatus() {
  return {
    connected: Boolean(client),
    lastError,
    uriMasked: MONGODB_URI ? MONGODB_URI.replace(/:([^@]+)@/, ':****@') : 'Not Configured',
  };
}

module.exports = {
  saveCredential,
  getCredential,
  deleteCredential,
  getMongoStatus,
  getClient,
};
