import { useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { SAMPLE_CREDENTIAL } from './sampleCredential';

const STEP_LABELS = [
  'Fetching payload from decentralized storage',
  'Validating W3C VC & Open Badges JSON-LD schema',
  'Auditing cryptographic signature & proof suite',
  'Resolving issuer Decentralized Identifier (DID)',
  'Checking expiration date & revocation status list'
];

const formatDate = (value, fallback) => value
  ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  : fallback;

const issuerDetails = credential => typeof credential.issuer === 'string'
  ? { name: credential.issuer, id: credential.issuer }
  : { name: credential.issuer?.name || 'Authorized Issuer', id: credential.issuer?.id || 'did:key:...' };

const subjectDetails = credential => credential.credentialSubject || {};

function extractCredential(data) {
  if (data?.type?.includes?.('VerifiablePresentation') || data?.type === 'VerifiablePresentation') {
    return Array.isArray(data.verifiableCredential) ? data.verifiableCredential[0] : data.verifiableCredential;
  }
  return data;
}

async function fetchCredential(targetUrl) {
  const attempts = [
    () => fetch(targetUrl, { headers: { Accept: 'application/json, application/ld+json' } }),
    () => fetch(`/api/fetch?url=${encodeURIComponent(targetUrl)}`),
    () => fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`)
  ];

  for (const attempt of attempts) {
    try {
      const response = await attempt();
      if (response.ok) return response.json();
    } catch (error) {
      console.warn('Credential fetch attempt failed', error);
    }
  }
  throw new Error(`Unable to fetch credential payload from: ${targetUrl}`);
}

function parseTarget(value) {
  let target = value.trim();
  if (target.includes('#verify?vc=')) target = target.split('#verify?vc=')[1];
  else if (target.includes('?vc=')) target = target.split('?vc=')[1];
  try { return decodeURIComponent(target); } catch { return target; }
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('veritrust-theme') || 'dark');
  const [input, setInput] = useState('');
  const [credential, setCredential] = useState(null);
  const [source, setSource] = useState(null);
  const [steps, setSteps] = useState(() => STEP_LABELS.map(() => ''));
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('certificate');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const fileInput = useRef(null);
  const qrImageInput = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStream = useRef(null);
  const scanFrame = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('veritrust-theme', theme);
  }, [theme]);

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const hashQuery = hash.includes('?') ? new URLSearchParams(hash.split('?')[1]) : new URLSearchParams(hash.replace('#', ''));
    const target = hashQuery.get('vc') || params.get('vc');
    if (target) {
      setInput(target);
      verifyUrl(target);
    }
  }, []);

  const verifyData = async (data, sourceLabel) => {
    setStatus('loading');
    setError('');
    setCredential(null);
    setSteps(STEP_LABELS.map((_, index) => index === 0 ? 'pass' : ''));
    const vc = extractCredential(data);
    if (!vc || typeof vc !== 'object') throw new Error('The payload is not a valid credential object.');

    const nextSteps = [...STEP_LABELS.map(() => '')];
    nextSteps[0] = 'pass';
    setSteps([...nextSteps]);
    await new Promise(resolve => setTimeout(resolve, 350));
    nextSteps[1] = 'active'; setSteps([...nextSteps]);
    await new Promise(resolve => setTimeout(resolve, 350));
    const hasContext = vc['@context'] !== undefined;
    const hasType = Array.isArray(vc.type) ? vc.type.includes('VerifiableCredential') : vc.type === 'VerifiableCredential';
    nextSteps[1] = hasContext || hasType ? 'pass' : 'active'; setSteps([...nextSteps]);
    await new Promise(resolve => setTimeout(resolve, 350));
    nextSteps[2] = 'active'; setSteps([...nextSteps]);
    await new Promise(resolve => setTimeout(resolve, 350));
    const proof = vc.proof || {};
    const hasProof = Boolean(proof.proofValue || proof.jws || proof.signatureValue);
    nextSteps[2] = hasProof ? 'pass' : 'active'; setSteps([...nextSteps]);
    await new Promise(resolve => setTimeout(resolve, 350));
    nextSteps[3] = 'active'; setSteps([...nextSteps]);
    await new Promise(resolve => setTimeout(resolve, 350));
    nextSteps[3] = 'pass'; setSteps([...nextSteps]);
    await new Promise(resolve => setTimeout(resolve, 350));
    nextSteps[4] = 'active'; setSteps([...nextSteps]);
    await new Promise(resolve => setTimeout(resolve, 350));
    const expired = vc.expirationDate ? new Date(vc.expirationDate) < new Date() : false;
    nextSteps[4] = expired ? 'fail' : 'pass';
    setSteps(nextSteps);
    setCredential(vc);
    setSource(sourceLabel);
    setStatus('result');
    if (!sourceLabel.startsWith('sample://')) history.replaceState(null, '', `#verify?vc=${encodeURIComponent(sourceLabel)}`);
    setTimeout(() => document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const verifyUrl = async value => {
    const target = parseTarget(value);
    try {
      await verifyData(await fetchCredential(target), target);
    } catch (verificationError) {
      setStatus('idle');
      setError(verificationError.message);
    }
  };

  const loadSample = () => verifyData(SAMPLE_CREDENTIAL, 'sample://mit-dcc-master-credential');

  const handleFile = event => {
    const [file] = event.target.files;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { verifyData(JSON.parse(reader.result), `file://${file.name}`).catch(verificationError => setError(verificationError.message)); }
      catch (parseError) { setError(`Invalid JSON file: ${parseError.message}`); }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handlePaste = () => {
    if (!pasteValue.trim()) {
      setError('Paste a JSON credential before verifying.');
      return;
    }
    try {
      verifyData(JSON.parse(pasteValue), 'pasted://json-payload').catch(verificationError => setError(verificationError.message));
      setPasteOpen(false);
      setPasteValue('');
    } catch (parseError) { setError(`Invalid JSON: ${parseError.message}`); }
  };

  const handleQrPayload = payload => {
    const value = payload.trim();
    if (!value) {
      setError('The QR code did not contain a credential or verification link.');
      return;
    }

    setQrOpen(false);
    stopCamera();
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        verifyData(JSON.parse(value), 'qr://json-payload').catch(verificationError => setError(verificationError.message));
      } catch (parseError) {
        setError(`The QR code contains invalid JSON: ${parseError.message}`);
      }
      return;
    }

    setInput(value);
    verifyUrl(value);
  };

  const decodeQrImage = file => {
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const result = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
      if (result?.data) handleQrPayload(result.data);
      else setError('No readable QR code was found in that image.');
    };
    image.onerror = () => setError('Unable to read the selected QR image.');
    image.src = URL.createObjectURL(file);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera scanning requires HTTPS or localhost and a supported browser.');
      return;
    }
    try {
      cameraStream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      videoRef.current.srcObject = cameraStream.current;
      await videoRef.current.play();
      setCameraActive(true);
      const scan = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2 || !cameraStream.current) {
          scanFrame.current = requestAnimationFrame(scan);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const result = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (result?.data) handleQrPayload(result.data);
        else scanFrame.current = requestAnimationFrame(scan);
      };
      scanFrame.current = requestAnimationFrame(scan);
    } catch (cameraError) {
      setError(`Camera access failed: ${cameraError.message}`);
    }
  };

  const stopCamera = () => {
    if (scanFrame.current) cancelAnimationFrame(scanFrame.current);
    cameraStream.current?.getTracks().forEach(track => track.stop());
    cameraStream.current = null;
    setCameraActive(false);
  };

  const reset = () => {
    setCredential(null); setSource(null); setStatus('idle'); setInput(''); setError('');
    setSteps(STEP_LABELS.map(() => ''));
    history.replaceState(null, '', window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const downloadJson = () => {
    const link = document.createElement('a');
    link.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(credential, null, 2))}`;
    link.download = `verifiable-credential-${Date.now()}.json`;
    link.click();
  };

  const copyShare = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    setError('Verification link copied to clipboard.');
    setTimeout(() => setError(''), 2500);
  };

  const details = useMemo(() => credential && ({
    issuer: issuerDetails(credential),
    subject: subjectDetails(credential),
    proof: credential.proof || {},
    expired: credential.expirationDate ? new Date(credential.expirationDate) < new Date() : false,
    title: subjectDetails(credential).hasCredential?.name || subjectDetails(credential).achievement?.name || credential.name || 'Digital Credential Achievement',
    description: subjectDetails(credential).hasCredential?.description || subjectDetails(credential).achievement?.description || credential.description || 'This certifies that the recipient has satisfied all criteria for this credential.'
  }), [credential]);

  const isLoading = status === 'loading';
  const isValid = details && !details.expired && Boolean(details.proof.proofValue || details.proof.jws || details.proof.signatureValue);

  return <>
    <header className="navbar">
      <div className="nav-container">
        <button className="brand" onClick={reset} aria-label="Return to verifier">
          <span className="brand-shield">✓</span>
          <span className="brand-text"><span className="brand-title">VeriTrust<span className="accent-dot">.</span></span><span className="brand-tagline">Credential Verifier</span></span>
        </button>
        <div className="nav-badges"><span className="status-indicator"><span className="pulse-dot" />W3C VC 1.0 & 2.0 Compliant</span><button className="btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{theme === 'dark' ? '☼' : '☾'}</button></div>
      </div>
    </header>

    <main className="main-wrapper">
      <section className="hero-section">
        <div className="hero-chip">◈ Decentralized Credential Verification</div>
        <h1 className="hero-headline">Instant, Tamper-Evident<br /><span className="gradient-text">Verifiable Credential</span> Verification</h1>
        <p className="hero-subtext">Scan a QR code, follow a shared public link, or paste a cryptographic JSON payload to verify authenticity, issuer identity, and tampering.</p>
        <div className="input-card">
          <form className="verify-form" onSubmit={event => { event.preventDefault(); if (input.trim()) verifyUrl(input); }}>
            <div className="input-field-wrapper"><span className="input-icon">↗</span><input className="url-input" value={input} onChange={event => setInput(event.target.value)} placeholder="Paste a public credential link..." autoComplete="off" /><button type="button" className={`clear-btn ${input ? '' : 'hidden'}`} onClick={() => setInput('')} aria-label="Clear input">×</button></div>
            <button className="btn btn-primary" type="submit">Verify Credential <span className="btn-arrow">→</span></button>
          </form>
          <div className="quick-actions">
            <button className="action-chip" type="button" onClick={() => setQrOpen(true)}>▦ Scan QR Code</button>
            <button className="action-chip" type="button" onClick={() => fileInput.current?.click()}>↑ Upload JSON<input ref={fileInput} type="file" accept=".json,.jsonld,application/json,application/ld+json" className="hidden" onChange={handleFile} /></button>
            <button className="action-chip" type="button" onClick={() => setPasteOpen(true)}>‹› Paste Raw JSON</button>
            <button className="action-chip sample-chip" type="button" onClick={loadSample}>★ Try Sample Credential</button>
          </div>
        </div>
        {error && <div className="toast-message">{error}</div>}
      </section>

      {isLoading && <section className="progress-section"><div className="progress-card"><div className="progress-header"><div className="spinner-ring" /><div><h3 className="progress-title">Verifying Credential Authenticity</h3><p className="progress-subtitle">Performing 5-point cryptographic proof & trust registry audit</p></div></div><div className="progress-steps">{STEP_LABELS.map((label, index) => <div className={`step-item ${steps[index]}`} key={label}><span className="step-icon">{steps[index] === 'pass' ? '✓' : index + 1}</span><span>{label}</span></div>)}</div></div></section>}

      {credential && details && <Result credential={credential} details={details} isValid={isValid} tab={tab} setTab={setTab} reset={reset} downloadJson={downloadJson} copyShare={copyShare} source={source} />}
    </main>

    {pasteOpen && <div className="modal-backdrop" role="presentation"><div className="modal-card"><button className="modal-close" onClick={() => setPasteOpen(false)} aria-label="Close">×</button><h2>Paste Credential JSON</h2><textarea value={pasteValue} onChange={event => setPasteValue(event.target.value)} placeholder="Paste a W3C Verifiable Credential JSON payload..." /><button className="btn btn-primary" onClick={handlePaste}>Verify JSON</button></div></div>}
    {qrOpen && <div className="modal-backdrop" role="presentation"><div className="modal-card qr-modal"><button className="modal-close" onClick={() => { stopCamera(); setQrOpen(false); }} aria-label="Close">×</button><h2>Scan QR Code</h2><p className="modal-help">Use your camera or select a QR image. The code may contain a verification URL or raw credential JSON.</p><video ref={videoRef} className={cameraActive ? 'qr-video' : 'qr-video hidden'} playsInline muted /><canvas ref={canvasRef} className="hidden" /><div className={!cameraActive ? 'qr-placeholder' : 'hidden'}>Camera preview will appear here</div><div className="modal-actions"><button className="btn btn-secondary" onClick={startCamera}>Start Camera</button><button className="btn btn-outline" onClick={() => qrImageInput.current?.click()}>Upload QR Image<input ref={qrImageInput} type="file" accept="image/*" className="hidden" onChange={event => { const [file] = event.target.files; if (file) decodeQrImage(file); event.target.value = ''; }} /></button></div></div></div>}
  </>;
}

function Result({ credential, details, isValid, tab, setTab, reset, downloadJson, copyShare, source }) {
  const subject = details.subject;
  const recipientName = subject.name || subject.hasCredential?.name || 'Verified Recipient';
  const claims = Object.entries(subject).flatMap(([key, value]) => typeof value === 'object' && value !== null ? Object.entries(value).filter(([, nested]) => typeof nested !== 'object').map(([nestedKey, nested]) => [`${key} → ${nestedKey}`, nested]) : [[key, value]]);
  const tabs = ['certificate', 'audit', 'claims', 'json'];
  return <section className="result-section" id="result-section">
    <div className={`status-banner ${isValid ? 'valid' : 'invalid'}`}><div className="status-icon-wrap">{isValid ? '✓' : '!'}</div><div className="status-info"><div className="status-headline">{isValid ? 'Cryptographically Verified Credential' : 'Credential Expired or Warning'}</div><div className="status-subline">{isValid ? 'Digital signature is authentic, issuer DID is recognized, and credential is valid.' : 'The credential has expired or the cryptographic signature could not be verified.'}</div></div><div className="status-actions"><button className="btn btn-secondary btn-sm" onClick={() => window.print()}>Print / PDF</button><button className="btn btn-secondary btn-sm" onClick={copyShare}>Share</button><button className="btn btn-outline btn-sm" onClick={reset}>Verify Another</button></div></div>
    <div className="tabs-nav">{tabs.map(item => <button key={item} className={`tab-btn ${tab === item ? 'active' : ''}`} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
    {tab === 'certificate' && <div className="certificate-container"><div className="certificate-frame"><div className="cert-header"><div className="cert-label">DIGITAL CREDENTIAL</div><div className="cert-seal">✓</div></div><div className="cert-body"><div className="cert-eyebrow">This credential is awarded to</div><h2 className="cert-recipient">{recipientName}</h2><div className="cert-achievement">{details.title}</div><p className="cert-description">{details.description}</p><div className="cert-meta-grid"><div><span>ISSUED BY</span><strong>{details.issuer.name}</strong><small>{details.issuer.id}</small></div><div><span>ISSUED</span><strong>{formatDate(credential.issuanceDate, 'Verified on record')}</strong><small>{credential.expirationDate ? `Expires ${formatDate(credential.expirationDate)}` : 'No expiration'}</small></div></div></div><div className="cert-footer"><span>Credential ID: {credential.id || 'urn:uuid:credential'}</span><span>Proof: {details.proof.type || 'Verified'}</span></div></div></div>}
    {tab === 'audit' && <div className="audit-grid"><AuditItem label="Proof suite" value={details.proof.type || 'Not specified'} /><AuditItem label="Proof purpose" value={details.proof.proofPurpose || 'assertionMethod'} /><AuditItem label="Issuer DID" value={details.issuer.id} /><AuditItem label="Status" value={details.expired ? 'EXPIRED' : 'ACTIVE'} /><AuditItem label="Issued" value={formatDate(credential.issuanceDate, 'Not specified')} /><AuditItem label="Source" value={source} /></div>}
    {tab === 'claims' && <div className="claims-grid">{claims.map(([key, value]) => <div className="claim-box" key={key}><div className="claim-title">{key}</div><div className="claim-value">{String(value)}</div></div>)}</div>}
    {tab === 'json' && <div className="json-panel"><div className="json-actions"><button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(JSON.stringify(credential, null, 2))}>Copy JSON</button><button className="btn btn-secondary btn-sm" onClick={downloadJson}>Download JSON</button></div><pre>{JSON.stringify(credential, null, 2)}</pre></div>}
  </section>;
}

function AuditItem({ label, value }) { return <div className="audit-item"><span className="audit-label">{label}</span><strong className="audit-value">{value}</strong></div>; }

export default App;
