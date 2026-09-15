import { discoverNearbyPlaces } from '../server/placeDiscovery.js';

function parseCoordinate(value: unknown, min: number, max: number, name: string) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} is invalid`);
  }
  return parsed;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const latitude = parseCoordinate(req.query.lat, -90, 90, 'lat');
    const longitude = parseCoordinate(req.query.lng, -180, 180, 'lng');
    const places = await discoverNearbyPlaces([latitude, longitude]);
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json({ places, total: places.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nearby discovery unavailable';
    const status = /invalid/i.test(message) ? 400 : 503;
    return res.status(status).json({ error: status === 400 ? message : 'Nearby discovery unavailable' });
  }
}
