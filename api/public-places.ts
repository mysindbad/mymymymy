import { discoverNearbyPublicPlaces } from '../src/services/publicPlaces.ts';

function numberParam(value: unknown, name: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw Object.assign(new Error(`${name} must be a number`), { status: 400 });
  return parsed;
}

export default async function handler(req: any, res: any) {
  if (String(req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const latitude = numberParam(req.query?.lat, 'lat');
    const longitude = numberParam(req.query?.lng, 'lng');
    if (latitude < -90 || latitude > 90) return res.status(400).json({ error: 'lat must be between -90 and 90' });
    if (longitude < -180 || longitude > 180) return res.status(400).json({ error: 'lng must be between -180 and 180' });
    const language = typeof req.query?.lang === 'string' ? req.query.lang : 'en';
    const category = typeof req.query?.category === 'string' ? req.query.category : undefined;
    const places = await discoverNearbyPublicPlaces({ latitude, longitude, language, category });
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({ places });
  } catch (error: any) {
    const status = Number(error?.status || 503);
    return res.status(status >= 400 && status < 600 ? status : 503).json({ error: 'Nearby place discovery is temporarily unavailable' });
  }
}
