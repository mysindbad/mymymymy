import { createClient } from '@supabase/supabase-js';

function normalizedSupabaseUrl() {
  const raw = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!raw) throw new Error('Supabase configuration is missing');

  let value = raw.trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Supabase URL is invalid');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Supabase URL must use http or https');
  }
  return parsed.origin;
}

function numberField(value: unknown, name: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw Object.assign(new Error(`${name} must be a number`), { status: 400 });
  return parsed;
}

function coordinates(lat: unknown, lng: unknown) {
  const latitude = numberField(lat, 'latitude');
  const longitude = numberField(lng, 'longitude');
  if (latitude < -90 || latitude > 90) throw Object.assign(new Error('latitude must be between -90 and 90'), { status: 400 });
  if (longitude < -180 || longitude > 180) throw Object.assign(new Error('longitude must be between -180 and 180'), { status: 400 });
  return [latitude, longitude] as const;
}

function placesClient() {
  const url = normalizedSupabaseUrl();
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('Supabase configuration is missing');
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OSM_PATTERN = /^osm-(node|way|relation)-(\d+)$/;

function osmCategory(tags: Record<string, string>) {
  if (['hotel', 'guest_house', 'hostel', 'motel'].includes(tags.tourism || '')) return 'accommodation';
  if (['restaurant', 'cafe', 'fast_food'].includes(tags.amenity || '')) return 'restaurant';
  if (['hospital', 'clinic', 'police', 'fire_station'].includes(tags.amenity || '')) return 'emergency';
  return 'tourist_poi';
}

async function fetchExternalDestination(destinationId: string) {
  const match = destinationId.match(OSM_PATTERN);
  if (!match) return null;
  const [, osmType, osmId] = match;

  let element: any = null;
  if (osmType === 'node') {
    const response = await fetch(`https://api.openstreetmap.org/api/0.6/node/${encodeURIComponent(osmId)}.json`, {
      headers: { 'User-Agent': 'MySindbad/1.0 (travel navigation)' },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const payload = await response.json();
      element = Array.isArray(payload?.elements) ? payload.elements[0] : null;
    }
  } else {
    const query = `[out:json][timeout:8];${osmType}(${osmId});out center tags;`;
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'MySindbad/1.0 (travel navigation)',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const payload = await response.json();
      element = Array.isArray(payload?.elements) ? payload.elements[0] : null;
    }
  }

  if (!element) return null;
  const tags = element.tags || {};
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const [lat, lng] = coordinates(latitude, longitude);
  const area = tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || tags['addr:suburb'] || 'Nearby';
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const name = String(tags.name || tags['name:en'] || tags['name:ar'] || 'Selected place').trim().slice(0, 160);

  return {
    id: destinationId,
    name,
    arabic_name: typeof tags['name:ar'] === 'string' ? tags['name:ar'].slice(0, 160) : null,
    category: osmCategory(tags),
    region: tags['addr:state'] || tags['addr:province'] || area,
    area,
    coordinates: [lat, lng],
    address: [street, area].filter(Boolean).join(', ') || area,
    rating: null,
  };
}

function modifierText(modifier: unknown, language: string) {
  if (typeof modifier !== 'string' || !modifier.trim()) return '';
  if (language !== 'ar') return ` ${modifier}`;
  const normalized = modifier.toLowerCase();
  if (normalized.includes('right')) return ' يمين';
  if (normalized.includes('left')) return ' يسار';
  if (normalized.includes('uturn')) return ' دوران كامل';
  if (normalized.includes('straight')) return ' مباشرة';
  return ` ${modifier.trim()}`;
}

function instruction(step: any, language: string, destinationName: string) {
  const maneuver = step?.maneuver || {};
  const type = maneuver.type || 'continue';
  const modifier = modifierText(maneuver.modifier, language);
  const roadName = step?.name || (language === 'ar' ? 'الطريق غير مسمى' : 'Unnamed road');
  if (type === 'arrive') return language === 'ar' ? `لقد وصلت إلى وجهتك: ${destinationName}` : `Arrive at destination: ${destinationName}`;
  const phrases: Record<string, string> = {
    depart: language === 'ar' ? 'انطلق' : 'Depart',
    turn: language === 'ar' ? `انعطف${modifier}` : `Turn${modifier}`,
    merge: language === 'ar' ? 'اندمج مع الطريق' : 'Merge onto the road',
    fork: language === 'ar' ? `خذ التفرع${modifier}` : `Take the${modifier} fork`,
    roundabout: language === 'ar' ? 'اسلك الدوار' : 'Enter the roundabout',
    rotary: language === 'ar' ? 'اسلك الدوار' : 'Enter the rotary',
    continue: language === 'ar' ? 'تابع مباشرة' : 'Continue straight',
    'new name': language === 'ar' ? 'تابع إلى الطريق التالي' : 'Continue onto the next road',
    'end of road': language === 'ar' ? `انعطف${modifier} عند نهاية الطريق` : `Turn${modifier} at the end of the road`,
  };
  const base = phrases[type] || (language === 'ar' ? 'تابع المسار' : 'Follow the route');
  return step?.name ? `${base} — ${roadName}` : base;
}

function iconType(maneuver: any): 'straight' | 'left' | 'right' | 'arrive' {
  if (maneuver?.type === 'arrive') return 'arrive';
  if (String(maneuver?.modifier || '').includes('left')) return 'left';
  if (String(maneuver?.modifier || '').includes('right')) return 'right';
  return 'straight';
}

export default async function handler(req: any, res: any) {
  if (String(req.method || 'GET').toUpperCase() !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const destinationId = typeof body.destinationId === 'string' ? body.destinationId.trim() : '';
    const travelMode = String(body.travelMode || 'driving');
    const language = String(body.language || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
    if (!destinationId) return res.status(400).json({ error: 'destinationId is required' });
    if (!['driving', 'walking', 'transit', 'taxi'].includes(travelMode)) {
      return res.status(400).json({ error: 'travelMode must be driving, walking, transit, or taxi' });
    }

    if (travelMode === 'transit') {
      return res.status(501).json({
        error: language === 'ar'
          ? 'التوجيه الحقيقي بالنقل العام غير متاح من مزود الملاحة الحالي.'
          : 'Real public-transit routing is not available from the current routing provider.',
        code: 'TRANSIT_PROVIDER_UNAVAILABLE',
        supportedModes: ['driving', 'walking', 'taxi'],
      });
    }

    const [startLatitude, startLongitude] = coordinates(body.startLatitude, body.startLongitude);
    let destination: any = null;

    if (UUID_PATTERN.test(destinationId)) {
      const { data, error } = await placesClient()
        .from('places')
        .select('id,name,arabic_name,category,region,area,coordinates,address,rating')
        .eq('id', destinationId)
        .eq('moderation_status', 'approved')
        .maybeSingle();
      if (error) throw error;
      destination = data;
    } else if (OSM_PATTERN.test(destinationId)) {
      destination = await fetchExternalDestination(destinationId);
    } else {
      return res.status(400).json({ error: 'Unsupported destination identifier' });
    }

    if (!destination) return res.status(404).json({ error: 'Destination not found' });
    if (!Array.isArray(destination.coordinates) || destination.coordinates.length !== 2) throw new Error('Destination coordinates are invalid');

    const [destLatitude, destLongitude] = coordinates(destination.coordinates[0], destination.coordinates[1]);
    const endpoint = travelMode === 'walking'
      ? 'https://routing.openstreetmap.de/routed-foot/route/v1/driving'
      : 'https://router.project-osrm.org/route/v1/driving';
    const url = `${endpoint}/${startLongitude},${startLatitude};${destLongitude},${destLatitude}?steps=true&geometries=geojson&overview=full`;
    const routeResponse = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!routeResponse.ok) throw new Error(`Routing service returned ${routeResponse.status}`);
    const route = await routeResponse.json();
    const selected = route?.routes?.[0];
    if (!selected) return res.status(404).json({ error: 'No route found' });

    const steps = (selected.legs || []).flatMap((leg: any) => leg.steps || []).map((step: any, index: number) => ({
      id: `route-step-${index + 1}`,
      distanceMeters: Math.round(Number(step.distance || 0)),
      instruction: instruction(step, language, destination.name),
      roadName: step.name || (language === 'ar' ? 'الطريق غير مسمى' : 'Unnamed road'),
      iconType: iconType(step.maneuver),
    }));

    return res.status(200).json({
      destination: {
        id: destination.id,
        name: destination.name,
        arabicName: destination.arabic_name,
        category: destination.category,
        region: destination.region,
        area: destination.area,
        coordinates: destination.coordinates,
        address: destination.address,
        rating: destination.rating === null || destination.rating === undefined ? null : Number(destination.rating),
      },
      travelMode,
      routeBasis: travelMode === 'taxi' ? 'road-network-estimate' : travelMode === 'walking' ? 'pedestrian-network' : 'road-network',
      totalDistanceKm: Number((Number(selected.distance || 0) / 1000).toFixed(2)),
      durationMinutes: Math.max(1, Math.ceil(Number(selected.duration || 0) / 60)),
      steps,
      geometry: selected.geometry,
      trafficCondition: 'unavailable',
      ...(travelMode === 'taxi' ? {
        modeNote: language === 'ar'
          ? 'هذا تقدير لمسار الطريق فقط؛ لا يتضمن توفر سيارات الأجرة أو الأجرة أو حركة المرور الحية.'
          : 'Road-route estimate only; it does not include taxi availability, fare, or live traffic.',
      } : {}),
    });
  } catch (error: any) {
    const status = Number(error?.status || 500);
    if (status >= 500) console.error('Navigation handler failed', { message: String(error?.message || error).slice(0, 300) });
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: status >= 500 ? 'Navigation service temporarily unavailable' : String(error?.message || 'Request failed'),
    });
  }
}
