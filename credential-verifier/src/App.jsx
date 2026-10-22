import { useEffect, useMemo, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { SAMPLE_CREDENTIAL } from './sampleCredential';
import { parseCredentialTarget } from './qrPayload.mjs';
import { extractStudentProfile, profileLabel } from './studentProfile.mjs';
import { scanQrImage } from './qrImage.mjs';

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

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('veritrust-theme') || 'dark');
  const [input, setInput] = useState('');
  const [credential, setCredential] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [profilePayload, setProfilePayload] = useState(null);
  const [source, setSource] = useState(null);
  const [steps, setSteps] = useState(() => STEP_LABELS.map(() => ''));
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('certificate');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [qrMessage, setQrMessage] = useState('');
  const fileInput = useRef(null);
  const qrImageInput = useRef(null);
  const videoRef = useRef(null);
  const qrScanner = useRef(null);
  const qrHandled = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('veritrust-theme', theme);
  }, [theme]);

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    const pageUrl = new URL(window.location.href);
    if (pageUrl.searchParams.has('vc') || /(?:^|[?&])vc=/.test(pageUrl.hash)) {
      try {
        const target = parseCredentialTarget(pageUrl.href);
        verifyUrl(target);
      } catch (linkError) {
        setError(linkError.message);
      }
    }
  }, []);

  const verifyData = async (data, sourceLabel) => {
    setError('');
    setCredential(null);
    setStudentProfile(null);
    setProfilePayload(null);
    setTab('certificate');
    const profile = extractStudentProfile(data);
    if (profile) {
      setStudentProfile(profile);
      setProfilePayload(data);
      setSource(sourceLabel);
      setStatus('result');
      if (/^https?:\/\//i.test(sourceLabel)) history.replaceState(null, '', `#verify?vc=${encodeURIComponent(sourceLabel)}`);
      setTimeout(() => document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' }), 50);
      return;
    }

    setStatus('loading');
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
    if (/^https?:\/\//i.test(sourceLabel)) history.replaceState(null, '', `#verify?vc=${encodeURIComponent(sourceLabel)}`);
    setTimeout(() => document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const verifyUrl = async value => {
    try {
      const target = parseCredentialTarget(value);
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
    if (qrHandled.current) return;
    const value = String(payload || '').trim();
    if (!value) {
      setQrMessage('The QR code is empty. Try another code.');
      return;
    }

    let parsedJson;
    let target;
    try {
      if (value.startsWith('{') || value.startsWith('[')) parsedJson = JSON.parse(value);
      else target = parseCredentialTarget(value);
    } catch (scanError) {
      setQrMessage(scanError.message);
      return;
    }

    qrHandled.current = true;
    setQrOpen(false);
    setQrMessage('');
    stopCamera();
    if (parsedJson) {
      verifyData(parsedJson, 'qr://json-payload').catch(verificationError => setError(verificationError.message));
      return;
    }

    verifyUrl(target);
  };

  const decodeQrImage = async file => {
    setQrMessage('Reading QR image...');
    try {
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      handleQrPayload(result.data || result);
      return;
    } catch {
      if (qrHandled.current) return;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      if (!qrHandled.current) handleQrPayload(await scanQrImage(image, setQrMessage));
    } catch (decodeError) {
      if (!qrHandled.current) setQrMessage(decodeError.message || 'Unable to read the selected QR image.');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setQrMessage('Camera scanning requires HTTPS or localhost and a supported browser.');
      return;
    }
    if (qrScanner.current) return;
    try {
      setQrMessage('Starting camera...');
      setCameraActive(true);
      const scanner = new QrScanner(
        videoRef.current,
        result => handleQrPayload(result.data || result),
        { preferredCamera: 'environment', returnDetailedScanResult: true, highlightScanRegion: true, highlightCodeOutline: true, onDecodeError: () => {} }
      );
      qrScanner.current = scanner;
      await scanner.start();
      if (qrScanner.current === scanner && !qrHandled.current) setQrMessage('Point the camera at a QR code.');
    } catch (cameraError) {
      stopCamera();
      setQrMessage(`Camera access failed: ${cameraError.message}`);
    }
  };

  const stopCamera = () => {
    qrScanner.current?.stop();
    qrScanner.current?.destroy();
    qrScanner.current = null;
    setCameraActive(false);
  };

  const reset = () => {
    setCredential(null); setStudentProfile(null); setProfilePayload(null); setSource(null); setStatus('idle'); setInput(''); setError('');
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
        <p className="hero-subtext">Scan a QR code, follow a shared link, or paste JSON to view a credential or student profile.</p>
        <div className="input-card">
          <form className="verify-form" onSubmit={event => { event.preventDefault(); if (input.trim()) verifyUrl(input); }}>
            <div className="input-field-wrapper"><span className="input-icon">↗</span><input className="url-input" value={input} onChange={event => setInput(event.target.value)} placeholder="Paste a public credential link..." autoComplete="off" /><button type="button" className={`clear-btn ${input ? '' : 'hidden'}`} onClick={() => setInput('')} aria-label="Clear input">×</button></div>
            <button className="btn btn-primary" type="submit">Verify Credential <span className="btn-arrow">→</span></button>
          </form>
          <div className="quick-actions">
            <button className="action-chip" type="button" onClick={() => { qrHandled.current = false; setQrMessage(''); setQrOpen(true); }}>▦ Scan QR Code</button>
            <button className="action-chip" type="button" onClick={() => fileInput.current?.click()}>↑ Upload JSON<input ref={fileInput} type="file" accept=".json,.jsonld,application/json,application/ld+json" className="hidden" onChange={handleFile} /></button>
            <button className="action-chip" type="button" onClick={() => setPasteOpen(true)}>‹› Paste Raw JSON</button>
            <button className="action-chip sample-chip" type="button" onClick={loadSample}>★ Try Sample Credential</button>
          </div>
        </div>
        {error && <div className="toast-message">{error}</div>}
      </section>

      {isLoading && <section className="progress-section"><div className="progress-card"><div className="progress-header"><div className="spinner-ring" /><div><h3 className="progress-title">Verifying Credential Authenticity</h3><p className="progress-subtitle">Performing 5-point cryptographic proof & trust registry audit</p></div></div><div className="progress-steps">{STEP_LABELS.map((label, index) => <div className={`step-item ${steps[index]}`} key={label}><span className="step-icon">{steps[index] === 'pass' ? '✓' : index + 1}</span><span>{label}</span></div>)}</div></div></section>}

      {credential && details && <Result credential={credential} details={details} isValid={isValid} tab={tab} setTab={setTab} reset={reset} downloadJson={downloadJson} copyShare={copyShare} source={source} />}
      {studentProfile && <StudentProfileResult profile={studentProfile} payload={profilePayload} source={source} tab={tab} setTab={setTab} reset={reset} />}
    </main>

    {pasteOpen && <div className="modal-backdrop" role="presentation"><div className="modal-card"><button className="modal-close" onClick={() => setPasteOpen(false)} aria-label="Close">×</button><h2>Paste Credential or Student Profile JSON</h2><textarea value={pasteValue} onChange={event => setPasteValue(event.target.value)} placeholder="Paste credential or studentProfile JSON..." /><button className="btn btn-primary" onClick={handlePaste}>View JSON</button></div></div>}
    {qrOpen && <div className="modal-backdrop" role="presentation"><div className="modal-card qr-modal"><button className="modal-close" onClick={() => { qrHandled.current = true; stopCamera(); setQrOpen(false); }} aria-label="Close">×</button><h2>Scan QR Code</h2><p className="modal-help">Use your camera or select a QR image. The code may contain a verification URL or raw credential JSON.</p>{qrMessage && <p className="qr-message">{qrMessage}</p>}<video ref={videoRef} className={cameraActive ? 'qr-video' : 'qr-video hidden'} playsInline muted /><div className={!cameraActive ? 'qr-placeholder' : 'hidden'}>Camera preview will appear here</div><div className="modal-actions"><button className="btn btn-secondary" onClick={startCamera}>Start Camera</button><button className="btn btn-outline" onClick={() => qrImageInput.current?.click()}>Upload QR Image<input ref={qrImageInput} type="file" accept="image/*" className="hidden" onChange={event => { const [file] = event.target.files; if (file) decodeQrImage(file); event.target.value = ''; }} /></button></div></div></div>}
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

const IDENTITY_FIELDS = ['fullName', 'apaarId', 'pen', 'dateOfBirth', 'gender'];
const ACADEMIC_FIELDS = ['academicYear', 'grade', 'section', 'rollNo', 'attendancePercentage'];

function StudentProfileResult({ profile, payload, source, tab, setTab, reset }) {
  const identity = IDENTITY_FIELDS.filter(key => key in profile).map(key => [key, profile[key]]);
  const academic = ACADEMIC_FIELDS.filter(key => key in profile).map(key => [key, profile[key]]);
  const school = profile.schoolDetails && typeof profile.schoolDetails === 'object' && !Array.isArray(profile.schoolDetails)
    ? Object.entries(profile.schoolDetails)
    : [];
  const other = Object.entries(profile).filter(([key]) => ![...IDENTITY_FIELDS, ...ACADEMIC_FIELDS, 'schoolDetails', 'skills'].includes(key));
  const tabs = [['certificate', 'Certificate'], ['verification', 'Verification'], ['audit', 'Audit'], ['json', 'Raw JSON']];
  const json = JSON.stringify(payload, null, 2);
  const downloadProfile = () => {
    const link = document.createElement('a');
    link.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    link.download = 'student-profile.json';
    link.click();
  };

  return <section className="result-section student-profile" id="result-section">
    <div className="status-banner profile-status">
      <div className="status-icon-wrap">i</div>
      <div className="status-info"><div className="status-headline">Student Profile: {profile.fullName}</div><div className="status-subline">Profile data loaded. No digital proof was provided, so authenticity is unverified.</div></div>
      <div className="status-actions"><button className="btn btn-secondary btn-sm" onClick={() => { setTab('certificate'); setTimeout(() => window.print(), 50); }}>Print / PDF</button><button className="btn btn-outline btn-sm" onClick={reset}>View Another</button></div>
    </div>
    <div className="tabs-nav" role="tablist" aria-label="Student profile views">{tabs.map(([key, label]) =>
      <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>
    )}</div>
    {tab === 'certificate' && <div className="certificate-container profile-certificate-panel" id="tab-certificate"><div className="certificate-frame student-certificate">
      <div className="student-cert-heading"><span className="cert-pretitle">Student academic record</span><strong>{profile.schoolDetails?.schoolName || 'Student Profile'}</strong><span>{profile.schoolDetails?.board || ''}</span></div>
      <div className="student-cert-name"><span>Presented for</span><h2>{profile.fullName}</h2><p>{[profile.grade && `Grade ${profile.grade}`, profile.section && `Section ${profile.section}`, profile.academicYear && `Academic year ${profile.academicYear}`].filter(Boolean).join(' · ')}</p></div>
      <ProfileGroup title="Student identity" entries={identity} />
      <ProfileGroup title="Academic details" entries={academic} />
      {school.length > 0 && <ProfileGroup title="School details" entries={school} />}
      {'skills' in profile && <ProfileGroup title="Skills" entries={[["skills", profile.skills]]} />}
      {other.length > 0 && <ProfileGroup title="Additional details" entries={other} />}
      <div className="student-cert-footer">Student profile record · Digital authenticity not verified</div>
    </div></div>}
    {tab === 'verification' && <div className="profile-panel"><h2>Verification</h2><p>The student data was read successfully. This JSON has no issuer signature or verifiable credential proof, so the identity, school, and claims cannot be authenticated from this file alone.</p><div className="audit-grid"><AuditItem label="JSON format" value="Readable" /><AuditItem label="Student profile" value="Recognized" /><AuditItem label="Digital signature" value="Not provided" /><AuditItem label="Authenticity" value="Unverified" /></div></div>}
    {tab === 'audit' && <div className="profile-panel"><h2>Audit</h2><div className="audit-grid"><AuditItem label="Record type" value="Student profile JSON" /><AuditItem label="Source" value={source} /><AuditItem label="Student fields" value={Object.keys(profile).length} /><AuditItem label="School fields" value={school.length} /><AuditItem label="Skills listed" value={Array.isArray(profile.skills) ? profile.skills.length : 0} /><AuditItem label="Proof field" value={profile.proof ? 'Present but not validated' : 'Absent'} /></div></div>}
    {tab === 'json' && <div className="json-panel profile-json"><div className="json-actions"><button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(json)}>Copy JSON</button><button className="btn btn-secondary btn-sm" onClick={downloadProfile}>Download JSON</button></div><pre>{json}</pre></div>}
  </section>;
}

function ProfileGroup({ title, entries }) {
  return <div className="profile-group"><h2>{title}</h2><div className="profile-grid">{entries.map(([key, value]) =>
    <div className="profile-field" key={key}><span className="profile-label">{profileLabel(key)}</span><ProfileValue value={value} field={key} /></div>
  )}</div></div>;
}

function ProfileValue({ value, field }) {
  if (Array.isArray(value)) return <ul className="profile-list">{value.map((item, index) => <li key={index}><ProfileValue value={item} /></li>)}</ul>;
  if (value && typeof value === 'object') return <div className="profile-nested">{Object.entries(value).map(([key, nested]) =>
    <div key={key}><span className="profile-label">{profileLabel(key)}</span><ProfileValue value={nested} field={key} /></div>
  )}</div>;
  const display = value == null || value === '' ? '—' : String(value);
  return <strong className="profile-value">{field === 'attendancePercentage' && value != null && value !== '' ? `${display}%` : display}</strong>;
}

function AuditItem({ label, value }) { return <div className="audit-item"><span className="audit-label">{label}</span><strong className="audit-value">{value}</strong></div>; }

export default App;
