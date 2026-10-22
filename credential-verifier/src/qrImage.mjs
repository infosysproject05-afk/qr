import jsQR from 'jsqr';

export function tileOrigins(length, tileSize, step) {
  if (length <= tileSize) return [0];
  const last = length - tileSize;
  const origins = [];
  for (let position = 0; position < last; position += step) origins.push(position);
  if (origins.at(-1) !== last) origins.push(last);
  return origins;
}

function contrastPixels(source) {
  const data = new Uint8ClampedArray(source);
  const histogram = new Uint32Array(256);
  for (let index = 0; index < data.length; index += 4) {
    const gray = Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
    histogram[gray]++;
    data[index] = data[index + 1] = data[index + 2] = gray;
  }

  const count = data.length / 4;
  let total = 0;
  for (let level = 0; level < 256; level++) total += level * histogram[level];
  let backgroundCount = 0;
  let backgroundTotal = 0;
  let bestScore = -1;
  let threshold = 128;
  for (let level = 0; level < 256; level++) {
    backgroundCount += histogram[level];
    if (!backgroundCount || backgroundCount === count) continue;
    backgroundTotal += level * histogram[level];
    const foregroundCount = count - backgroundCount;
    const difference = backgroundTotal / backgroundCount - (total - backgroundTotal) / foregroundCount;
    const score = backgroundCount * foregroundCount * difference * difference;
    if (score > bestScore) { bestScore = score; threshold = level; }
  }
  for (let index = 0; index < data.length; index += 4) {
    const value = data[index] <= threshold ? 0 : 255;
    data[index] = data[index + 1] = data[index + 2] = value;
  }
  return data;
}

export async function scanQrImage(image, onProgress = () => {}) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new Error('The selected image is empty.');

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser cannot read image pixels.');

  const scanRegion = (x, y, sourceWidth, sourceHeight, outputWidth, outputHeight) => {
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    context.imageSmoothingEnabled = outputWidth < sourceWidth || outputHeight < sourceHeight;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.drawImage(image, x, y, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
    const pixels = context.getImageData(0, 0, outputWidth, outputHeight).data;
    const original = jsQR(pixels, outputWidth, outputHeight, { inversionAttempts: 'attemptBoth' });
    if (original?.data) return original.data;
    return jsQR(contrastPixels(pixels), outputWidth, outputHeight, { inversionAttempts: 'attemptBoth' })?.data;
  };

  const scale = Math.min(3, 1800 / Math.max(width, height));
  const fullWidth = Math.max(1, Math.round(width * scale));
  const fullHeight = Math.max(1, Math.round(height * scale));
  let result = scanRegion(0, 0, width, height, fullWidth, fullHeight);
  if (result) return result;

  const tileSize = 900;
  const xs = tileOrigins(width, tileSize, 450);
  const ys = tileOrigins(height, tileSize, 450);
  const total = xs.length * ys.length;
  let checked = 0;
  for (const y of ys) {
    for (const x of xs) {
      const tileWidth = Math.min(tileSize, width - x);
      const tileHeight = Math.min(tileSize, height - y);
      if (tileWidth === width && tileHeight === height) continue;
      result = scanRegion(x, y, tileWidth, tileHeight, tileWidth, tileHeight);
      if (result) return result;
      checked++;
      if (checked % 4 === 0) {
        onProgress(`Searching image sections (${checked}/${total})...`);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }
  throw new Error('No readable QR code was found. Try cropping closely around the QR code.');
}
