import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCredentialTarget } from '../src/qrPayload.mjs';

test('reads wallet public links with an unencoded credential URL', () => {
  assert.equal(
    parseCredentialTarget('https://verifier.example/#verify?vc=https://storage.example/credential?id=1&name=one'),
    'https://storage.example/credential?id=1&name=one'
  );
});

test('reads encoded credential URLs and query parameter links', () => {
  const source = 'https://storage.example/credential?id=1&name=one';
  assert.equal(parseCredentialTarget(`https://verifier.example/#verify?vc=${encodeURIComponent(source)}`), source);
  assert.equal(parseCredentialTarget(`https://verifier.example/?vc=${encodeURIComponent(source)}`), source);
});

test('accepts direct credential URLs and relative VC routes', () => {
  assert.equal(parseCredentialTarget('https://storage.example/credential'), 'https://storage.example/credential');
  assert.equal(parseCredentialTarget('https://verifier.example/#verify?vc=%2Fapi%2Fcredentials%2F123'), 'https://verifier.example/api/credentials/123');
});

test('rejects invalid QR destinations', () => {
  assert.throws(() => parseCredentialTarget('not a link'), /HTTP\(S\)/);
  assert.throws(() => parseCredentialTarget('javascript:alert(1)'), /HTTP\(S\)/);
  assert.throws(() => parseCredentialTarget('https://verifier.example/#verify?vc='), /empty credential URL/);
  assert.throws(() => parseCredentialTarget('https://verifier.example/#verify?vc=javascript%3Aalert(1)'), /invalid credential URL/);
});
