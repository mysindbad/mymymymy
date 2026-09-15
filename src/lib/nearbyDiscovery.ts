import type { Place } from '../types';

export type NearbyCoordinate = [number, number];

type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type OverpassPayload = { elements?: OsmElement[] };
type CacheEntry = { expiresAt: number; places: Place[] };

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const PRIMARY_RADIUS_METERS = 15_000;
const EXPANDED_RADIUS_METERS = 30_000;
const MIN_BASELINE_PLACES = 6;
const MAX_DISCOVERED_PLACES = 18;
const CACHE_TTL_MS = 20 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

const toRadians = (value: number) => value * Math.PI / 180;

export function nearbyDistanceKm(a: NearbyCoordinate, b: NearbyCoordinate) {
  const radius = 6371;
  const dLat = toRadians(b[0] - a[0]);
  const dLng = toRadians(b[1] - a[1]);
  const q = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(a[0])) * Math.cos(toRadians(b[0])) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}

function safeHttpUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function titleCase(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function categoryOf(tags: Record<string, string>): Place['category'] {
  const tourism = tags.tourism;
  const amenity = tags.amenity;
  if (['hotel', 'guest_house', 'hostel', 'motel', 'apartment', 'chalet'].includes(tourism)) return 'accommodation';
  if (['camp_site', 'caravan_site'].includes(tourism)) return 'campsite';
  if (['restaurant', 'cafe', 'fast_food', 'food_court'].includes(amenity)) return 'restaurant';
  if (['hospital', 'clinic', 'police', 'fire_station'].includes(amenity)) return 'emergency';
  return 'tourist_poi';
}

function areaOf(tags: Record<string, string>) {
  return tags['addr:city']
    || tags['addr:town']
    || tags['addr:village']
    || tags['addr:suburb']
    || tags['is_in:city']
    || tags['is_in:town']
    || 'Nearby';
}

function addressOf(tags: Record<string, string>, area: string) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const locality = [tags['addr:suburb'], tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || area]
    .filter(Boolean)
    .join(', ');
  return [street, locality, tags['addr:country']].filter(Boolean).join(', ') || area;
}

export function osmProminence(element: OsmElement) {
  const tags = element.tags || {};
  let score = 0;
  if (tags.wikipedia) score += 14;
  if (tags.wikidata) score += 10;
  if (tags.tourism === 'attraction' || tags.tourism === 'museum') score += 9;
  if (tags.historic) score += 8;
  if (tags.tourism === 'viewpoint') score += 7;
  if (tags.leisure === 'park' || tags.leisure === 'garden') score += 6;
  if (tags.amenity === 'place_of_worship' || tags.amenity === 'theatre') score += 5;
  if (tags.tourism === 'hotel' || tags.tourism === 'guest_house') score += 3;
  if (tags.amenity === 'restaurant' || tags.amenity === 'cafe') score += 2;
  if (tags.website || tags['contact:website']) score += 1;
  if (tags.phone || tags['contact:phone']) score += 1;
  if (tags.opening_hours) score += 1;
  return score;
}

export function normalizeOsmPlace(element: OsmElement, origin: NearbyCoordinate): Place | null {
  const tags = element.tags || {};
  const name = tags.name?.trim();
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const coordinates: NearbyCoordinate = [Number(latitude), Number(longitude)];
  const area = areaOf(tags);
  const subtype = titleCase(tags.tourism || tags.historic || tags.leisure || tags.amenity || tags.natural || 'place');
  const image = safeHttpUrl(tags.image);
  const distanceKm = nearbyDistanceKm(origin, coordinates);

  return {
    id: `osm-${element.type}-${element.id}`,
    name,
    arabicName: tags['name:ar']?.trim() || undefined,
    frenchName: tags['name:fr']?.trim() || undefined,
    category: categoryOf(tags),
    subCategory: subtype,
    region: tags['addr:state'] || tags['is_in:state'] || tags['addr:province'] || area,
    area,
    coordinates,
    address: addressOf(tags, area),
    photos: image ? [image] : [],
    description: tags.description?.trim() || tags['description:en']?.trim() || `${subtype} · ${area}`,
    formationInfo: tags['historic:period'] ? titleCase(tags['historic:period']) : undefined,
    rating: null,
    reviewCount: 0,
    reviews: [],
    features: {
      accessible: tags.wheelchair === 'yes' || tags.wheelchair === 'designated',
      parking: Boolean(tags.parking) || tags.amenity === 'parking',
      wifi: tags.internet_access === 'yes' || tags.internet_access === 'wlan',
      familyFriendly: !['nightclub', 'bar'].includes(tags.amenity || ''),
    },
    openingHours: tags.opening_hours || undefined,
    contactPhone: tags.phone || tags['contact:phone'] || undefined,
    isUnderDocumentedGem: false,
    source: 'external',
    ownerVerified: false,
    checkInsCount: 0,
    seedData: false,
    photoProvenance: image ? 'openstreetmap_tag' : null,
    ratingProvenance: 'unrated',
    dataSource: 'openstreetmap',
    lastVerifiedAt: new Date().toISOString(),
    trustLevel: 'external',
    distanceKm: Number(distanceKm.toFixed(2)),
  };
}

function queryFor(origin: NearbyCoordinate, radiusMeters: number) {
  const [lat, lng] = origin;
  const around = `(around:${radiusMeters},${lat},${lng})`;
  return `[out:json][timeout:15];(`
    + `nwr${around}[name][tourism~\"attraction|museum|gallery|viewpoint|zoo|theme_park|hotel|guest_house|hostel|camp_site|caravan_site\"];`
    + `nwr${around}[name][historic];`
    + `nwr${around}[name][leisure~\"park|garden\"];`
    + `nwr${around}[name][amenity~\"restaurant|cafe|place_of_worship|theatre|hospital|clinic|police\"];`
    + `);out center tags 120;`;
}

async function fetchOverpass(origin: NearbyCoordinate, radiusMeters: number): Promise<OsmElement[]> {
  const body = `data=${encodeURIComponent(queryFor(origin, radiusMeters))}`;
  let lastError: unknown;
  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`Nearby discovery responded ${response.status}`);
      const payload = await response.json() as OverpassPayload;
      return Array.isArray(payload.elements) ? payload.elements : [];
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Nearby discovery unavailable');
}

function cacheKey(origin: NearbyCoordinate) {
  return `${origin[0].toFixed(2)},${origin[1].toFixed(2)}`;
}

async function discoverAtRadius(origin: NearbyCoordinate, radiusMeters: number) {
  const elements = await fetchOverpass(origin, radiusMeters);
  const seen = new Set<string>();
  return elements
    .map((element) => ({ element, place: normalizeOsmPlace(element, origin) }))
    .filter((entry): entry is { element: OsmElement; place: Place } => Boolean(entry.place))
    .filter(({ place }) => {
      const key = `${place.name.toLocaleLowerCase()}|${place.coordinates[0].toFixed(4)}|${place.coordinates[1].toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const prominence = osmProminence(b.element) - osmProminence(a.element);
      return prominence || (a.place.distanceKm ?? 0) - (b.place.distanceKm ?? 0);
    })
    .slice(0, MAX_DISCOVERED_PLACES)
    .map(({ place }) => place);
}

export async function discoverNearbyPlaces(origin: NearbyCoordinate): Promise<Place[]> {
  const key = cacheKey(origin);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.places;

  let places = await discoverAtRadius(origin, PRIMARY_RADIUS_METERS);
  if (places.length < MIN_BASELINE_PLACES) {
    places = await discoverAtRadius(origin, EXPANDED_RADIUS_METERS);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, places });
  return places;
}

function mergeUnique(existing: Place[], discovered: Place[]) {
  const merged = [...existing];
  for (const place of discovered) {
    const duplicate = merged.some((current) => {
      const sameName = current.name.trim().toLocaleLowerCase() === place.name.trim().toLocaleLowerCase();
      return current.id === place.id || (sameName && nearbyDistanceKm(current.coordinates, place.coordinates) < 0.15);
    });
    if (!duplicate) merged.push(place);
  }
  return merged;
}

export async function ensureNearbyBaseline(
  existing: Place[],
  origin: NearbyCoordinate,
  minimum = MIN_BASELINE_PLACES,
): Promise<Place[]> {
  const closeExisting = existing.filter((place) => nearbyDistanceKm(origin, place.coordinates) <= 50);
  if (closeExisting.length >= minimum) return existing;
  try {
    return mergeUnique(existing, await discoverNearbyPlaces(origin));
  } catch (error) {
    console.warn('Nearby place discovery failed:', error);
    return existing;
  }
}
