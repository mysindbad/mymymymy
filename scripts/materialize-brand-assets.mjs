import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const assets = [
  // Keep the legacy build-time target for compatibility with any older code,
  // but also publish the logo at a stable public URL that is not rewritten or
  // renamed by Vite. BrandLogo uses the stable public target below.
  {
    source: 'brand-assets/my-sindbad-logo-user-v4.webp.b64',
    target: 'src/assets/images/my_sindbad_logo_user_v4.webp',
    kind: 'webp',
  },
  {
    source: 'brand-assets/my-sindbad-logo-user-v4.webp.b64',
    target: 'public/brand/my-sindbad-logo-v6.webp',
    kind: 'webp',
  },
  // Preserve the previous icon URLs while publishing new versioned URLs so
  // PWA/browser icon caches cannot keep the old application identity.
  {
    source: 'brand-assets/my-sindbad-app-icon-user-v4-192.jpg.b64',
    target: 'public/icons/my-sindbad-app-icon-user-v4-192.jpg',
    kind: 'jpeg',
  },
  {
    source: 'brand-assets/my-sindbad-app-icon-user-v4-192.jpg.b64',
    target: 'public/icons/my-sindbad-app-icon-v6-192.jpg',
    kind: 'jpeg',
  },
  {
    source: 'brand-assets/my-sindbad-app-icon-user-v4-512.jpg.b64',
    target: 'public/icons/my-sindbad-app-icon-user-v4-512.jpg',
    kind: 'jpeg',
  },
  {
    source: 'brand-assets/my-sindbad-app-icon-user-v4-512.jpg.b64',
    target: 'public/icons/my-sindbad-app-icon-v6-512.jpg',
    kind: 'jpeg',
  },
];

for (const asset of assets) {
  const encoded = readFileSync(asset.source, 'utf8').replace(/\s+/g, '');
  const bytes = Buffer.from(encoded, 'base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  const isWebP = bytes.length > 16 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  const isJpeg = bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  const valid = asset.kind === 'webp' ? isWebP : isJpeg;

  if (!valid) {
    throw new Error(`Brand asset decode check failed for ${asset.source}`);
  }

  mkdirSync(dirname(asset.target), { recursive: true });
  writeFileSync(asset.target, bytes);
  console.log(`[brand] materialized ${asset.target} (${bytes.length} bytes, sha256=${sha256})`);
}
