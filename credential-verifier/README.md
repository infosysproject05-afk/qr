# VeriTrust — Decentralized Credential Verifier

A standalone, modern web application for verifying **W3C Verifiable Credentials (VCs)**, **Open Badges 3.0**, and credentials shared from the **Learner Credential Wallet (LCW)**.

It serves as a 100% compatible drop-in replacement for `https://verifierplus.org`.

---

## 🌟 Key Features

1. **Drop-in URL Hash Format Compatibility**:
   - Supports `#verify?vc=https://storage.dcc.did.coop/<resource-path>`
   - Supports `?vc=<url>` query parameters.
   - Automatically detects, fetches, and verifies the credential when the link is opened or scanned via QR code.

2. **5-Point Cryptographic & Trust Verification Pipeline**:
   - **Step 1:** Decentralized payload retrieval (with built-in CORS fallback proxy).
   - **Step 2:** W3C VC 1.0/2.0 and Open Badges JSON-LD schema check.
   - **Step 3:** Cryptographic proof & signature audit (`Ed25519Signature2020`, `JsonWebSignature2020`).
   - **Step 4:** Issuer Decentralized Identifier (DID) resolution (`did:key`, `did:web`, `did:ion`).
   - **Step 5:** Revocation list (`StatusList2021Entry`) and expiration period audit.

3. **Executive Visual Certificate View**:
   - High-trust official digital certificate layout with issuer seal, verification stamp, and recipient details.
   - One-click **Print / PDF export** optimized for clean printing without UI clutter.

4. **Multi-Input Verification Modes**:
   - Shared URL / Public Link
   - Camera & Image QR Code Scanner
   - Drag-and-drop `.json` / `.jsonld` file upload
   - Paste raw cryptographic JSON
   - Pre-loaded sample credential

5. **VC-API Fallback Compatibility**:
   - Built-in `/api/credentials` endpoints (`POST`, `GET`, `DELETE`) fully matching `verifierInstance.ts` in the mobile wallet app.

---

## 🚀 Running Locally

The verifier uses React with Vite for the frontend and a lightweight Node.js server for proxy/API routes:

```bash
cd credential-verifier
npm install
npm start
```

For frontend development with hot reload, run `npm run dev` and keep the Node server running on port 3000 for API proxy requests.

Open your browser at:
```
http://localhost:3000
```

Try opening a test link directly:
```
http://localhost:3000/#verify?vc=http://localhost:3000/api/credentials/sample
```
Or click the **"Try Sample Credential"** button on the homepage.

---

## 📲 How to Connect Your Mobile Wallet to Your New Website

In your wallet repository (`learner-credential-wallet`):

### 1. Update `app.config.js`
Open [`learner-credential-wallet/app.config.js`](file:///c:/Users/ASUS/OneDrive/Desktop/wallet/learner-credential-wallet/app.config.js#L13-L15) and locate lines 13–15:

```javascript
// BEFORE:
export const VERIFIER_INSTANCE_URL =
  env['VERIFIER_INSTANCE_URL'] || 'https://verifierplus.org'

// AFTER (Local Testing):
export const VERIFIER_INSTANCE_URL =
  env['VERIFIER_INSTANCE_URL'] || 'http://localhost:3000'

// AFTER (Production / Deployed Website):
export const VERIFIER_INSTANCE_URL =
  env['VERIFIER_INSTANCE_URL'] || 'https://your-custom-verifier.com'
```

### 2. How it works when scanning the QR Code:
1. When a user in the wallet creates a public link, [`app/lib/publicLink.ts`](file:///c:/Users/ASUS/OneDrive/Desktop/wallet/learner-credential-wallet/app/lib/publicLink.ts#L129) constructs:
   ```
   https://your-custom-verifier.com/#verify?vc=https://storage.dcc.did.coop/<resource-uuid>
   ```
2. The wallet's `PublicLinkScreen` encodes this exact URL into the **QR Code**.
3. When another person scans the QR code with their phone, it redirects directly to **your website** (`https://your-custom-verifier.com`), loads the credential, and displays the verified certificate!

---

## 🌐 Deploying to Production (Free Hosting Options)

You can deploy `credential-verifier` in minutes to any platform:

### Option A: Render / Railway / Fly.io / VPS
Simply deploy this directory. It will run `npm start` (starting `server.js` on port `process.env.PORT || 3000`).

### Option B: Vercel / Netlify / Cloudflare Pages
You can deploy `index.html`, `styles.css`, and `app.js` as static assets. The client application includes fallback CORS fetching gateways so remote storage URLs can be fetched directly in browser.

For Vercel public-link storage, connect a Vercel KV/Redis store and add these production environment variables:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

The API also accepts `VERCEL_KV_REST_API_URL` and `VERCEL_KV_REST_API_TOKEN`. Without these variables,
local development uses temporary in-memory storage and shared links can be lost when a serverless
instance is recycled.
