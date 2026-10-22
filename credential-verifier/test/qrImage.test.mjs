import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scanQrImage, tileOrigins } from '../src/qrImage.mjs';

test('tile origins cover the edges with overlap', () => {
  assert.deepEqual(tileOrigins(1600, 900, 450), [0, 450, 700]);
  assert.deepEqual(tileOrigins(500, 900, 450), [0]);
});

test('finds a QR code embedded in a large screenshot', async () => {
  const rows = readFileSync(new URL('./qr-matrix.txt', import.meta.url), 'utf8').trim().split('\n');
  const width = 1200;
  const height = 1600;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  const moduleSize = 5;
  const left = 900;
  const top = 1200;
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] !== '1') continue;
      for (let dy = 0; dy < moduleSize; dy++) {
        for (let dx = 0; dx < moduleSize; dx++) {
          const index = ((top + (y + 4) * moduleSize + dy) * width + left + (x + 4) * moduleSize + dx) * 4;
          pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
        }
      }
    }
  }

  const image = { naturalWidth: width, naturalHeight: height, pixels };
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: () => {
      const canvas = { width: 0, height: 0, data: null };
      const context = {
        fillStyle: '#fff',
        fillRect() { canvas.data = new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(255); },
        drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh) {
          for (let y = 0; y < dh; y++) {
            for (let x = 0; x < dw; x++) {
              const fromX = Math.min(source.naturalWidth - 1, Math.floor(sx + (x + 0.5) * sw / dw));
              const fromY = Math.min(source.naturalHeight - 1, Math.floor(sy + (y + 0.5) * sh / dh));
              const from = (fromY * source.naturalWidth + fromX) * 4;
              const to = (y * canvas.width + x) * 4;
              canvas.data.set(source.pixels.subarray(from, from + 4), to);
            }
          }
        },
        getImageData() { return { data: canvas.data }; }
      };
      canvas.getContext = () => context;
      return canvas;
    }
  };
  try {
    assert.equal(await scanQrImage(image), 'https://example.org/#verify?vc=https://example.org/data');
  } finally {
    globalThis.document = originalDocument;
  }
});
