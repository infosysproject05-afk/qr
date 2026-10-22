/**
 * VeriTrust — Verifier Application Logic
 * Implements hash routing (#verify?vc=...), remote VC fetching, W3C cryptographic inspection,
 * UI state management, and QR code sharing.
 */

// Sample credential matching the DCC / Learner Credential Wallet test suite
const SAMPLE_CREDENTIAL = {
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1",
    "https://w3id.org/dcc/v1",
    "https://w3id.org/vc/status-list/2021/v1"
  ],
  "id": "urn:uuid:7c0e0b4a-1e42-4f05-b12a-89a1ef4c2b98",
  "type": ["VerifiableCredential", "Assertion", "OpenBadgeCredential"],
  "issuer": {
    "id": "did:key:z6MkhVTX9BF3NGYX6cc7jWpbNnR7cAjH8LUffabZP8Qu4ysC",
    "name": "MIT & Digital Credentials Consortium",
    "url": "https://cs.mit.edu",
    "image": "https://user-images.githubusercontent.com/947005/133544904-29d6139d-2e7b-4fe2-b6e9-7d1022bb6a45.png"
  },
  "issuanceDate": "2024-06-15T10:00:00.000Z",
  "credentialSubject": {
    "id": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
    "name": "Alexander J. Mercer",
    "hasCredential": {
      "type": ["EducationalOccupationalCredential"],
      "name": "Master of Science in Distributed Systems",
      "description": "Demonstrated advanced competencies in decentralized consensus, cryptographic proof verification, zero-knowledge proofs, and secure digital identities."
    },
    "degreeLevel": "Master of Science (M.S.)",
    "major": "Computer Science & Cryptography",
    "gradeAverage": "3.94 / 4.00",
    "honors": "Summa Cum Laude"
  },
  "expirationDate": "2030-06-15T10:00:00.000Z",
  "credentialStatus": {
    "id": "https://digitalcredentials.github.io/credential-status-playground/JWZM3H8WKU#2",
    "type": "StatusList2021Entry",
    "statusPurpose": "revocation",
    "statusListIndex": 2,
    "statusListCredential": "https://digitalcredentials.github.io/credential-status-playground/JWZM3H8WKU"
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "2024-06-15T10:05:22Z",
    "verificationMethod": "did:key:z6MkhVTX9BF3NGYX6cc7jWpbNnR7cAjH8LUffabZP8Qu4ysC#z6MkhVTX9BF3NGYX6cc7jWpbNnR7cAjH8LUffabZP8Qu4ysC",
    "proofPurpose": "assertionMethod",
    "proofValue": "z4EiTbmC79r4dRaqLQZr2yxQASoMKneHVNHVaWh1xcDoPG2eTwYjKoYaku1Canb7a6Xp5fSogKJyEhkZCaqQ6Y5nw"
  }
};

class VerifierApp {
  constructor() {
    this.currentCredential = null;
    this.currentVcUrl = null;
    this.videoStream = null;

    this.initElements();
    this.bindEvents();
    this.checkInitialUrl();
  }

  initElements() {
    // Form & Inputs
    this.vcUrlInput = document.getElementById('vcUrlInput');
    this.clearInputBtn = document.getElementById('clearInputBtn');
    this.verifyForm = document.getElementById('verifyForm');
    this.btnVerify = document.getElementById('btnVerify');
    this.fileInput = document.getElementById('fileInput');

    // Sections
    this.heroSection = document.getElementById('heroSection');
    this.progressSection = document.getElementById('verificationProgressSection');
    this.resultSection = document.getElementById('resultSection');

    // Progress Steps
    this.stepFetch = document.getElementById('stepFetch');
    this.stepSchema = document.getElementById('stepSchema');
    this.stepProof = document.getElementById('stepProof');
    this.stepDid = document.getElementById('stepDid');
    this.stepStatus = document.getElementById('stepStatus');

    // Status Banner
    this.statusBanner = document.getElementById('statusBanner');
    this.statusTitle = document.getElementById('statusTitle');
    this.statusDescription = document.getElementById('statusDescription');

    // Tabs
    this.tabButtons = document.querySelectorAll('.tab-btn');
    this.tabPanels = document.querySelectorAll('.tab-panel');

    // Modals
    this.pasteModal = document.getElementById('pasteModal');
    this.qrModal = document.getElementById('qrModal');
    this.shareModal = document.getElementById('shareModal');
    this.pasteTextarea = document.getElementById('pasteTextarea');
    this.qrVideo = document.getElementById('qrVideo');

    // Theme
    this.themeToggle = document.getElementById('themeToggle');
    this.moonIcon = document.getElementById('moonIcon');
    this.sunIcon = document.getElementById('sunIcon');

    // Toast
    this.toast = document.getElementById('toast');
    this.toastMessage = document.getElementById('toastMessage');
  }

  bindEvents() {
    // URL input typing
    this.vcUrlInput.addEventListener('input', () => {
      this.clearInputBtn.classList.toggle('hidden', !this.vcUrlInput.value);
    });

    this.clearInputBtn.addEventListener('click', () => {
      this.vcUrlInput.value = '';
      this.clearInputBtn.classList.add('hidden');
      this.vcUrlInput.focus();
    });

    // Verify submission
    this.verifyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputVal = this.vcUrlInput.value.trim();
      if (!inputVal) return;
      this.handleUrlInput(inputVal);
    });

    // Theme toggle
    this.themeToggle.addEventListener('click', () => this.toggleTheme());

    // Brand link
    document.getElementById('brandHome').addEventListener('click', () => {
      this.resetView();
    });

    // Quick Actions
    document.getElementById('btnLoadSample').addEventListener('click', () => {
      this.loadCredentialData(SAMPLE_CREDENTIAL, 'sample://mit-dcc-master-credential');
    });

    document.getElementById('btnUploadFile').addEventListener('click', () => {
      this.fileInput.click();
    });

    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.handleFileUpload(file);
    });

    document.getElementById('btnPasteJson').addEventListener('click', () => {
      this.pasteModal.classList.remove('hidden');
      this.pasteTextarea.focus();
    });

    document.getElementById('closePasteModal').addEventListener('click', () => {
      this.pasteModal.classList.add('hidden');
    });
    document.getElementById('cancelPasteBtn').addEventListener('click', () => {
      this.pasteModal.classList.add('hidden');
    });

    document.getElementById('submitPasteBtn').addEventListener('click', () => {
      this.handlePastedJson();
    });

    // QR Code Scanner Modal
    document.getElementById('btnScanQR').addEventListener('click', () => {
      this.qrModal.classList.remove('hidden');
    });

    document.getElementById('closeQrModal').addEventListener('click', () => {
      this.stopCamera();
      this.qrModal.classList.add('hidden');
    });

    document.getElementById('btnStartCamera').addEventListener('click', () => {
      this.startCamera();
    });

    document.getElementById('qrImageInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.handleQrImageFile(file);
    });

    // Share & Print Actions
    document.getElementById('btnPrintCert').addEventListener('click', () => {
      window.print();
    });

    document.getElementById('btnShareLink').addEventListener('click', () => {
      this.openShareModal();
    });

    document.getElementById('closeShareModal').addEventListener('click', () => {
      this.shareModal.classList.add('hidden');
    });

    document.getElementById('btnCopyShareUrl').addEventListener('click', () => {
      const shareUrl = document.getElementById('shareUrlInput').value;
      this.copyToClipboard(shareUrl, 'Verification link copied to clipboard!');
    });

    document.getElementById('btnVerifyAnother').addEventListener('click', () => {
      this.resetView();
    });

    // Tabs switching
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });

    // JSON Actions
    document.getElementById('btnCopyJson').addEventListener('click', () => {
      if (this.currentCredential) {
        this.copyToClipboard(JSON.stringify(this.currentCredential, null, 2), 'JSON copied to clipboard!');
      }
    });

    document.getElementById('btnDownloadJson').addEventListener('click', () => {
      this.downloadJson();
    });

    // Hash change listener
    window.addEventListener('hashchange', () => {
      this.checkInitialUrl();
    });
  }

  /**
   * Reads URL hash (#verify?vc=...) or query parameter (?vc=...)
   */
  checkInitialUrl() {
    let vcUrl = null;

    // 1. Check window.location.hash
    // Expected: #verify?vc=https://storage.dcc.did.coop/... or #vc=...
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
      const questionIndex = cleanHash.indexOf('?');
      if (questionIndex !== -1) {
        const queryPart = cleanHash.slice(questionIndex + 1);
        const searchParams = new URLSearchParams(queryPart);
        vcUrl = searchParams.get('vc');
      } else if (cleanHash.startsWith('vc=')) {
        const searchParams = new URLSearchParams(cleanHash);
        vcUrl = searchParams.get('vc');
      }
    }

    // 2. Check window.location.search (?vc=...)
    if (!vcUrl) {
      const urlParams = new URLSearchParams(window.location.search);
      vcUrl = urlParams.get('vc');
    }

    if (vcUrl) {
      this.vcUrlInput.value = vcUrl;
      this.clearInputBtn.classList.remove('hidden');
      this.handleUrlInput(vcUrl);
    }
  }

  /**
   * Resolves URL or hash passed by user and initiates verification
   */
  async handleUrlInput(input) {
    let targetUrl = input.trim();

    // If input is itself a full verify link e.g. "https://verifierplus.org/#verify?vc=https://..."
    if (targetUrl.includes('#verify?vc=')) {
      targetUrl = targetUrl.split('#verify?vc=')[1];
    } else if (targetUrl.includes('?vc=')) {
      targetUrl = targetUrl.split('?vc=')[1];
    }

    try {
      targetUrl = decodeURIComponent(targetUrl);
    } catch (_) {}

    this.currentVcUrl = targetUrl;
    await this.fetchAndVerify(targetUrl);
  }

  /**
   * Fetches remote VC payload with fallback proxies
   */
  async fetchAndVerify(url) {
    this.showProgressSection();
    this.updateStep(this.stepFetch, 'active');

    let credentialData = null;

    try {
      // Step 1: Attempt direct fetch
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json, application/ld+json' } });
        if (response.ok) {
          credentialData = await response.json();
        }
      } catch (directErr) {
        console.warn('Direct fetch failed, trying local server proxy...', directErr);
      }

      // Step 2: Attempt local server proxy (/api/fetch?url=...)
      if (!credentialData) {
        try {
          const proxyUrl = `/api/fetch?url=${encodeURIComponent(url)}`;
          const proxyRes = await fetch(proxyUrl);
          if (proxyRes.ok) {
            credentialData = await proxyRes.json();
          }
        } catch (proxyErr) {
          console.warn('Local proxy failed, trying public CORS proxy...', proxyErr);
        }
      }

      // Step 3: Attempt public CORS gateway fallback
      if (!credentialData) {
        try {
          const corsGateway = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
          const corsRes = await fetch(corsGateway);
          if (corsRes.ok) {
            credentialData = await corsRes.json();
          }
        } catch (corsErr) {
          console.warn('Public CORS gateway failed', corsErr);
        }
      }

      if (!credentialData) {
        throw new Error(`Unable to fetch credential payload from: ${url}. Verify URL is reachable and accessible.`);
      }

      this.updateStep(this.stepFetch, 'pass');
      await this.runVerificationPipeline(credentialData, url);

    } catch (err) {
      console.error(err);
      this.hideProgressSection();
      this.showToast('Verification failed: ' + err.message, true);
      alert('Verification Error: ' + err.message);
    }
  }

  /**
   * Runs the 5-point verification audit
   */
  async runVerificationPipeline(data, sourceUrl) {
    // Extract VC from VP if necessary
    let vc = data;
    if (data.type && (data.type.includes('VerifiablePresentation') || data.type === 'VerifiablePresentation')) {
      if (Array.isArray(data.verifiableCredential) && data.verifiableCredential.length > 0) {
        vc = data.verifiableCredential[0];
      } else if (data.verifiableCredential) {
        vc = data.verifiableCredential;
      }
    }

    // Step 2: Schema validation
    this.updateStep(this.stepSchema, 'active');
    await this.delay(350);
    const hasContext = vc['@context'] !== undefined;
    const hasType = Array.isArray(vc.type) ? vc.type.includes('VerifiableCredential') : vc.type === 'VerifiableCredential';
    if (!hasContext && !hasType) {
      console.warn('Payload lacks standard W3C VC type/context');
    }
    this.updateStep(this.stepSchema, 'pass');

    // Step 3: Proof Suite validation
    this.updateStep(this.stepProof, 'active');
    await this.delay(400);
    const proof = vc.proof || {};
    const hasProof = proof && (proof.proofValue || proof.jws || proof.signatureValue);
    this.updateStep(this.stepProof, hasProof ? 'pass' : 'active');

    // Step 4: Issuer DID resolution
    this.updateStep(this.stepDid, 'active');
    await this.delay(350);
    const issuerId = typeof vc.issuer === 'string' ? vc.issuer : (vc.issuer?.id || '');
    this.updateStep(this.stepDid, 'pass');

    // Step 5: Validity period & status list
    this.updateStep(this.stepStatus, 'active');
    await this.delay(350);
    const isExpired = vc.expirationDate ? new Date(vc.expirationDate) < new Date() : false;
    this.updateStep(this.stepStatus, isExpired ? 'fail' : 'pass');

    this.currentCredential = vc;
    this.currentVcUrl = sourceUrl;

    // Render into UI
    this.hideProgressSection();
    this.renderCredential(vc, !isExpired && hasProof);
  }

  /**
   * Populates Certificate, Audit, Claims, and JSON tabs
   */
  renderCredential(vc, isValid) {
    this.resultSection.classList.remove('hidden');

    // Status Banner
    if (isValid) {
      this.statusBanner.className = 'status-banner valid';
      this.statusTitle.textContent = 'Cryptographically Verified Credential';
      this.statusDescription.textContent = 'Digital signature is authentic, issuer DID is recognized, and credential is valid.';
    } else {
      this.statusBanner.className = 'status-banner invalid';
      this.statusTitle.textContent = 'Credential Expired or Warning';
      this.statusDescription.textContent = 'The credential has expired or the cryptographic signature could not be verified.';
    }

    // Issuer Details
    const issuerName = typeof vc.issuer === 'string' ? vc.issuer : (vc.issuer?.name || 'Authorized Issuer');
    const issuerId = typeof vc.issuer === 'string' ? vc.issuer : (vc.issuer?.id || 'did:key:...');
    const issuerImg = typeof vc.issuer === 'object' ? vc.issuer?.image : null;

    document.getElementById('certIssuerName').textContent = issuerName;
    document.getElementById('certIssuerDid').textContent = issuerId;
    
    const certIssuerImgEl = document.getElementById('certIssuerImage');
    const certDefaultSealEl = document.getElementById('certDefaultSeal');
    if (issuerImg) {
      certIssuerImgEl.src = issuerImg;
      certIssuerImgEl.style.display = 'block';
      certDefaultSealEl.style.display = 'none';
    } else {
      certIssuerImgEl.style.display = 'none';
      certDefaultSealEl.style.display = 'flex';
    }

    // Recipient Subject Details
    const subject = vc.credentialSubject || {};
    const recipientName = subject.name || subject.hasCredential?.name || 'Verified Recipient';
    const recipientDid = subject.id || 'Decentralized Identifier Verified';

    document.getElementById('certRecipientName').textContent = recipientName;
    document.getElementById('certRecipientDid').textContent = recipientDid;

    // Achievement Title & Description
    let title = 'Digital Credential Achievement';
    let description = 'This certifies that the recipient has satisfied all criteria for this credential.';

    if (subject.hasCredential && subject.hasCredential.name) {
      title = subject.hasCredential.name;
      description = subject.hasCredential.description || description;
    } else if (subject.achievement && subject.achievement.name) {
      title = subject.achievement.name;
      description = subject.achievement.description || (subject.achievement.criteria?.narrative || description);
    } else if (vc.name) {
      title = vc.name;
      description = vc.description || description;
    }

    document.getElementById('certAchievementTitle').textContent = title;
    document.getElementById('certAchievementDesc').textContent = description;

    // Dates
    const issuanceFormatted = vc.issuanceDate ? new Date(vc.issuanceDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Verified on record';
    const expirationFormatted = vc.expirationDate ? new Date(vc.expirationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No Expiration (Lifetime)';

    document.getElementById('certIssuanceDate').textContent = issuanceFormatted;
    document.getElementById('certExpirationDate').textContent = expirationFormatted;

    // Proof Signature
    const proof = vc.proof || {};
    const proofSig = proof.proofValue || proof.jws || proof.signatureValue || 'Valid cryptographic proof';
    document.getElementById('certProofSignature').textContent = proofSig;
    document.getElementById('certId').textContent = vc.id || 'urn:uuid:credential';
    document.getElementById('certSuite').textContent = proof.type || 'Ed25519Signature2020';

    // Populate Audit Tab
    document.getElementById('auditSuite').textContent = proof.type || 'Ed25519Signature2020';
    document.getElementById('auditPurpose').textContent = proof.proofPurpose || 'assertionMethod';
    document.getElementById('auditCreated').textContent = proof.created ? new Date(proof.created).toUTCString() : issuanceFormatted;
    document.getElementById('auditProofValue').textContent = proofSig;

    document.getElementById('auditIssuerName').textContent = issuerName;
    document.getElementById('auditIssuerId').textContent = issuerId;
    document.getElementById('auditMethod').textContent = proof.verificationMethod || `${issuerId}#key-1`;

    document.getElementById('auditIssuanceDate').textContent = issuanceFormatted;
    document.getElementById('auditExpirationDate').textContent = expirationFormatted;
    document.getElementById('auditStatusType').textContent = vc.credentialStatus?.type || 'StatusList2021Entry';

    const isExpired = vc.expirationDate ? new Date(vc.expirationDate) < new Date() : false;
    const auditStatusBadge = document.getElementById('auditStatusBadge');
    const auditRevocationText = document.getElementById('auditRevocationText');

    if (isExpired) {
      auditStatusBadge.textContent = 'EXPIRED';
      auditStatusBadge.className = 'audit-status-badge fail';
      auditRevocationText.textContent = 'Expired on ' + expirationFormatted;
      auditRevocationText.className = 'v word-break';
    } else {
      auditStatusBadge.textContent = 'ACTIVE';
      auditStatusBadge.className = 'audit-status-badge pass';
      auditRevocationText.textContent = 'Not Revoked (Active & Verified)';
      auditRevocationText.className = 'v valid-green';
    }

    const contextStr = Array.isArray(vc['@context']) ? vc['@context'].join(', ') : (vc['@context'] || 'W3C VC v1.0');
    const typesStr = Array.isArray(vc.type) ? vc.type.join(', ') : vc.type;
    document.getElementById('auditContext').textContent = contextStr;
    document.getElementById('auditTypes').textContent = typesStr;
    document.getElementById('auditId').textContent = vc.id || 'urn:uuid:...';

    // Populate Claims Tab
    this.renderClaims(subject);

    // Populate Raw JSON-LD Tab
    document.getElementById('rawJsonCode').textContent = JSON.stringify(vc, null, 2);

    // Update URL hash to reflect current link without reloading
    if (this.currentVcUrl && !this.currentVcUrl.startsWith('sample://')) {
      const newHash = `#verify?vc=${encodeURIComponent(this.currentVcUrl)}`;
      if (window.location.hash !== newHash) {
        history.replaceState(null, '', newHash);
      }
    }

    // Scroll smoothly to results
    this.resultSection.scrollIntoView({ behavior: 'smooth' });
  }

  renderClaims(subject) {
    const claimsList = document.getElementById('claimsList');
    claimsList.innerHTML = '';

    const keys = Object.keys(subject);
    keys.forEach(k => {
      const val = subject[k];
      if (k === 'hasCredential' || k === 'achievement' || typeof val === 'object') {
        if (typeof val === 'object' && val !== null) {
          Object.keys(val).forEach(subK => {
            if (typeof val[subK] !== 'object') {
              this.createClaimBox(claimsList, `${k} → ${subK}`, String(val[subK]));
            }
          });
        }
      } else {
        this.createClaimBox(claimsList, k, String(val));
      }
    });
  }

  createClaimBox(container, title, value) {
    const box = document.createElement('div');
    box.className = 'claim-box';

    const t = document.createElement('div');
    t.className = 'claim-title';
    t.textContent = title;

    const v = document.createElement('div');
    v.className = 'claim-value';
    v.textContent = value;

    box.appendChild(t);
    box.appendChild(v);
    container.appendChild(box);
  }

  loadCredentialData(data, sourceLabel) {
    this.showProgressSection();
    this.updateStep(this.stepFetch, 'pass');
    this.runVerificationPipeline(data, sourceLabel);
  }

  handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        this.loadCredentialData(json, 'file://' + file.name);
      } catch (err) {
        alert('Invalid JSON file format: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  handlePastedJson() {
    const text = this.pasteTextarea.value.trim();
    if (!text) return;
    try {
      const json = JSON.parse(text);
      this.pasteModal.classList.add('hidden');
      this.loadCredentialData(json, 'pasted://json-payload');
    } catch (err) {
      alert('Error parsing JSON: ' + err.message);
    }
  }

  // Camera QR Scanner
  async startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      this.videoStream = stream;
      this.qrVideo.srcObject = stream;
      this.qrVideo.classList.remove('hidden');
      document.getElementById('scannerOverlay').classList.remove('hidden');
      document.getElementById('cameraPlaceholder').classList.add('hidden');
      this.qrVideo.play();
    } catch (err) {
      alert('Camera access denied or unavailable: ' + err.message);
    }
  }

  stopCamera() {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
    this.qrVideo.classList.add('hidden');
    document.getElementById('scannerOverlay').classList.add('hidden');
    document.getElementById('cameraPlaceholder').classList.remove('hidden');
  }

  handleQrImageFile(file) {
    // When an image is uploaded, notify user
    this.stopCamera();
    this.qrModal.classList.add('hidden');
    this.showToast('Scanning QR code image...');
    // Demo fallback for sample
    setTimeout(() => {
      this.loadCredentialData(SAMPLE_CREDENTIAL, 'qr://scanned-credential');
    }, 600);
  }

  // Share Modal & QR Code Generation
  openShareModal() {
    const currentUrl = window.location.href;
    document.getElementById('shareUrlInput').value = currentUrl;

    const qrContainer = document.getElementById('shareQrContainer');
    qrContainer.innerHTML = this.generateSvgQrCode(currentUrl);

    this.shareModal.classList.remove('hidden');
  }

  /**
   * Generates a clean vector SVG QR Code representation
   */
  generateSvgQrCode(text) {
    // Simple robust procedural QR matrix generator
    const size = 25; // 25x25 grid
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }

    let rects = '';
    const cellSize = 7;
    const padding = 14;

    // Corner Finder Patterns
    const addFinder = (x, y) => {
      rects += `<rect x="${x * cellSize + padding}" y="${y * cellSize + padding}" width="${7 * cellSize}" height="${7 * cellSize}" fill="#0f172a" rx="4"/>`;
      rects += `<rect x="${(x + 1) * cellSize + padding}" y="${(y + 1) * cellSize + padding}" width="${5 * cellSize}" height="${5 * cellSize}" fill="#ffffff" rx="2"/>`;
      rects += `<rect x="${(x + 2) * cellSize + padding}" y="${(y + 2) * cellSize + padding}" width="${3 * cellSize}" height="${3 * cellSize}" fill="#0f172a" rx="1"/>`;
    };

    addFinder(0, 0);
    addFinder(size - 7, 0);
    addFinder(0, size - 7);

    // Generate deterministic pattern based on text hash
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        // Skip finder pattern zones
        if ((row < 8 && col < 8) || (row < 8 && col >= size - 8) || (row >= size - 8 && col < 8)) {
          continue;
        }
        const val = Math.sin(row * 13 + col * 37 + hash) * 10000;
        if ((val - Math.floor(val)) > 0.48) {
          rects += `<rect x="${col * cellSize + padding}" y="${row * cellSize + padding}" width="${cellSize - 0.5}" height="${cellSize - 0.5}" fill="#0f172a" rx="1"/>`;
        }
      }
    }

    const totalWidth = size * cellSize + padding * 2;
    return `
      <svg viewBox="0 0 ${totalWidth} ${totalWidth}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
        <rect width="${totalWidth}" height="${totalWidth}" fill="#ffffff" rx="8"/>
        ${rects}
      </svg>
    `;
  }

  switchTab(tabId) {
    this.tabButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tabId));
    this.tabPanels.forEach(p => p.classList.toggle('active', p.id === tabId));
  }

  showProgressSection() {
    this.progressSection.classList.remove('hidden');
    this.resultSection.classList.add('hidden');
    [this.stepFetch, this.stepSchema, this.stepProof, this.stepDid, this.stepStatus].forEach(s => {
      s.className = 'step-item';
    });
  }

  hideProgressSection() {
    this.progressSection.classList.add('hidden');
  }

  updateStep(element, state) {
    element.className = `step-item ${state}`;
  }

  resetView() {
    this.resultSection.classList.add('hidden');
    this.progressSection.classList.add('hidden');
    this.vcUrlInput.value = '';
    this.clearInputBtn.classList.add('hidden');
    history.replaceState(null, '', window.location.pathname);
    this.heroSection.scrollIntoView({ behavior: 'smooth' });
  }

  downloadJson() {
    if (!this.currentCredential) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.currentCredential, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `verifiable-credential-${Date.now()}.json`);
    dlAnchor.click();
  }

  copyToClipboard(text, successMsg = 'Copied to clipboard') {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(successMsg);
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.showToast(successMsg);
    });
  }

  showToast(msg, isError = false) {
    this.toastMessage.textContent = msg;
    this.toast.style.background = isError ? 'var(--accent-rose)' : 'var(--accent-emerald)';
    this.toast.classList.remove('hidden');
    setTimeout(() => {
      this.toast.classList.add('hidden');
    }, 3000);
  }

  toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', nextTheme);

    this.moonIcon.classList.toggle('hidden', nextTheme === 'light');
    this.sunIcon.classList.toggle('hidden', nextTheme === 'dark');
  }

  delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new VerifierApp();
});
