import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const assets = [
  {
    source: 'brand-assets/my-sindbad-logo-user-v4.webp.b64',
    target: 'src/assets/images/my_sindbad_logo_user_v4.webp',
    bytes: 22348,
    sha256: '61ffac62fbf3a31fc5e3e46635a2805a070105c42ae4469e9273590f114d2bf6',
  },
  {
    source: 'brand-assets/my-sindbad-app-icon-user-v4-192.jpg.b64',
    target: 'public/icons/my-sindbad-app-icon-user-v4-192.jpg',
    bytes: 7961,
    sha256: 'b15a9c19df01cc2ec8a7b4b9bd53174b13c801b65f8d5b23ec1f8b50c008b323',
  },
  {
    source: 'brand-assets/my-sindbad-app-icon-user-v4-512.jpg.b64',
    target: 'public/icons/my-sindbad-app-icon-user-v4-512.jpg',
    bytes: 19233,
    sha256: '53ab2fd97aaadf034fb1cfdea4997ae9fc5d7b1398a064ad7c322a0b784c633e',
  },
];

for (const asset of assets) {
  const encoded = readFileSync(asset.source, 'utf8').replace(/\s+/g, '');
  const bytes = Buffer.from(encoded, 'base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  if (bytes.length !== asset.bytes || sha256 !== asset.sha256) {
    throw new Error(`Brand asset integrity check failed for ${asset.source}`);
  }

  mkdirSync(dirname(asset.target), { recursive: true });
  writeFileSync(asset.target, bytes);
  console.log(`[brand] materialized ${asset.target} (${bytes.length} bytes, ${sha256})`);
}
