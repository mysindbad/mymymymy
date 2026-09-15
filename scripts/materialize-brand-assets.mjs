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
