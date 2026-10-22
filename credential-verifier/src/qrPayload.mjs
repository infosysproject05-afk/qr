export function parseCredentialTarget(value) {
  const text = value.trim();
  if (!text) throw new Error('Enter a credential link first.');

  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error('The QR code must contain an HTTP(S) credential link or credential JSON.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP(S) credential links are supported.');
  }

  const hash = url.hash.slice(1);
  const hashParams = new URLSearchParams(hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : hash);
  const rawHashVc = /^verify\?vc=(.*)$/s.exec(hash)?.[1];
  const hasVc = rawHashVc !== undefined || hashParams.has('vc') || url.searchParams.has('vc');
  let credentialUrl;
  try {
    credentialUrl = rawHashVc ? decodeURIComponent(rawHashVc) : hashParams.get('vc') || url.searchParams.get('vc');
  } catch {
    throw new Error('The QR code contains an invalid credential URL.');
  }
  if (!credentialUrl) {
    if (hasVc) throw new Error('The QR code contains an empty credential URL.');
    return url.href;
  }

  try {
    const target = new URL(credentialUrl, url);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error();
    return target.href;
  } catch {
    throw new Error('The QR code contains an invalid credential URL.');
  }
}
