import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const assets = [
  {
    source: 'brand-assets/my-sindbad-logo-v7.png.b64',
    target: 'public/brand/my-sindbad-logo-v7.png',
    kind: 'png',
  },
  {
    source: 'brand-assets/my-sindbad-app-icon-user-v4-192.jpg.b64',
    target: 'public/icons/my-sindbad-app-icon-v7-192.jpg',
    kind: 'jpeg',
  },
  {
    source: 'brand-assets/my-sindbad-app-icon-user-v4-512.jpg.b64',
    target: 'public/icons/my-sindbad-app-icon-v7-512.jpg',
    kind: 'jpeg',
  },
];

const isPng = (bytes) => (
  bytes.length > 8
  && bytes[0] === 0x89
  && bytes[1] === 0x50
  && bytes[2] === 0x4e
  && bytes[3] === 0x47
  && bytes[4] === 0x0d
  && bytes[5] === 0x0a
  && bytes[6] === 0x1a
  && bytes[7] === 0x0a
);

const isJpeg = (bytes) => (
  bytes.length > 4
  && bytes[0] === 0xff
  && bytes[1] === 0xd8
  && bytes.at(-2) === 0xff
  && bytes.at(-1) === 0xd9
);

for (const asset of assets) {
  const encoded = readFileSync(asset.source, 'utf8').replace(/\s+/g, '');
  const bytes = Buffer.from(encoded, 'base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  const valid = asset.kind === 'png' ? isPng(bytes) : isJpeg(bytes);
  if (!valid) {
    throw new Error(`Brand asset decode check failed for ${asset.source}`);
  }

  mkdirSync(dirname(asset.target), { recursive: true });
  writeFileSync(asset.target, bytes);
  console.log(`[brand] materialized ${asset.target} (${bytes.length} bytes, sha256=${sha256})`);
}

// Android applies an additional safe-area treatment to ordinary PWA icons.
// Keep the user's official artwork intact, but zoom past its built-in outer
// blue margin and expose it as a scalable, opaque maskable icon. The crop
// corresponds to the inner app-frame area of the original official artwork.
const maskableSource = readFileSync(
  'brand-assets/my-sindbad-app-icon-user-v4-512.jpg.b64',
  'utf8',
).replace(/\s+/g, '');
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#075aa8"/>
  <image href="data:image/jpeg;base64,${maskableSource}" x="-65" y="-51" width="642" height="642" preserveAspectRatio="xMidYMid slice"/>
</svg>\n`;
const maskableTarget = 'public/icons/my-sindbad-app-icon-v8-maskable.svg';
mkdirSync(dirname(maskableTarget), { recursive: true });
writeFileSync(maskableTarget, maskableSvg, 'utf8');
console.log(`[brand] materialized ${maskableTarget} (${Buffer.byteLength(maskableSvg)} bytes)`);
