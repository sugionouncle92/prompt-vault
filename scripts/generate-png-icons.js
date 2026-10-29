import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, drawFn) {
  // Generate raw RGBA buffer with scanline filter bytes
  const bytesPerPixel = 4;
  const rowSize = 1 + width * bytesPerPixel;
  const rawBuffer = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawBuffer[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * bytesPerPixel;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawBuffer[pixelOffset] = r;
      rawBuffer[pixelOffset + 1] = g;
      rawBuffer[pixelOffset + 2] = b;
      rawBuffer[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawBuffer);

  // Helper to build chunk
  function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = data.length;
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(len, 0);

    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0, 0);

    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', compressedData);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table & calculation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Pixel drawing function for PromptVault icon
function drawPromptVaultIcon(x, y, w, h, isMaskable = false) {
  const nx = x / w;
  const ny = y / h;

  // Background gradient: Indigo-600 (#4f46e5) to Purple-600 (#9333ea) to Pink-500 (#ec4899)
  const grad = (nx + ny) / 2;
  let rBg = Math.round(79 + (236 - 79) * grad);
  let gBg = Math.round(70 + (72 - 70) * grad);
  let bBg = Math.round(229 + (153 - 229) * grad);

  if (isMaskable) {
    // Fill full canvas
    return [rBg, gBg, bBg, 255];
  }

  // Rounded squircle container with radius
  const pad = 0.06;
  if (nx < pad || nx > 1 - pad || ny < pad || ny > 1 - pad) {
    // Outside safe bounds with subtle dark slate backing
    return [2, 6, 23, 255];
  }

  // Draw inner bookmark emblem in center (nx 0.25 to 0.75, ny 0.2 to 0.8)
  if (nx >= 0.28 && nx <= 0.72 && ny >= 0.22 && ny <= 0.78) {
    // Check if bottom notch of bookmark
    const bookmarkMidX = 0.5;
    const bookmarkBottomY = 0.78;
    const notchY = 0.65;
    const dxFromMid = Math.abs(nx - bookmarkMidX);
    const notchBoundY = notchY + (1 - dxFromMid / 0.22) * (bookmarkBottomY - notchY);

    if (ny > notchBoundY) {
      // Cutout notch
      return [rBg, gBg, bBg, 255];
    }

    // Inside white bookmark
    // Check if in center sparkle star (nx 0.42 to 0.58, ny 0.35 to 0.51)
    const starDist = Math.hypot(nx - 0.5, ny - 0.43);
    if (starDist < 0.05) {
      // Amber center
      return [251, 191, 36, 255];
    }

    return [255, 255, 255, 250];
  }

  return [rBg, gBg, bBg, 255];
}

// Generate files
const iconsDir = path.resolve('public', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

console.log('Generating PNG icons for PWA...');

const sizes = [192, 512];
sizes.forEach((size) => {
  const bufRegular = createPNG(size, size, (x, y, w, h) => drawPromptVaultIcon(x, y, w, h, false));
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), bufRegular);
  console.log(`Created icon-${size}.png (${size}x${size})`);

  const bufMaskable = createPNG(size, size, (x, y, w, h) => drawPromptVaultIcon(x, y, w, h, true));
  fs.writeFileSync(path.join(iconsDir, `icon-maskable-${size}.png`), bufMaskable);
  console.log(`Created icon-maskable-${size}.png (${size}x${size})`);
});

// Apple touch icon
const appleTouchBuf = createPNG(180, 180, (x, y, w, h) => drawPromptVaultIcon(x, y, w, h, false));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), appleTouchBuf);
fs.writeFileSync(path.join('public', 'apple-touch-icon.png'), appleTouchBuf);
console.log('Created apple-touch-icon.png (180x180)');

// Copy icon.svg to favicon.svg
const svgIconPath = path.join(iconsDir, 'icon.svg');
if (fs.existsSync(svgIconPath)) {
  fs.copyFileSync(svgIconPath, path.join('public', 'favicon.svg'));
  console.log('Created favicon.svg');
}

console.log('All PWA icons generated successfully!');
