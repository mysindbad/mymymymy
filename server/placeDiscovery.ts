type Coordinate = [number, number];

export type DiscoveredPlace = {
  id: string;
  name: string;
  arabicName?: string;
  frenchName?: string;
  category: 'accommodation' | 'tourist_poi' | 'restaurant' | 'emergency' | 'campsite' | 'service';
  subCategory?: string;
  region: string;
  area: string;
  coordinates: Coordinate;
  address: string;
  photos: string[];
  description: string;
  formationInfo?: string;
  rating: null;
  reviewCount: number;
  reviews: [];
  features?: Record<string, boolean>;
  priceLevel?: '$' | '$$' | '$$$' | '$$$$';
  openingHours?: string;
  contactPhone?: string;
  isUnderDocumentedGem: false;
  source: 'external';
  ownerVerified: false;
  checkInsCount: number;
  seedData: false;
  photoProvenance: string | null;
  ratingProvenance: 'unrated';
  dataSource: 'openstreetmap';
  lastVerifiedAt: string;
  trustLevel: 'external';
  distanceKm?: number;
  prominenceScore?: number;
};

type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements?: OsmElement[] };
type DiscoveryCacheEntry = { expiresAt: number; staleUntil: number; places: DiscoveredPlace[] };

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const PRIMARY_RADIUS_METERS = 15_000;
const EXPANDED_RADIUS_METERS = 30_000;
const MIN_BASELINE_PLACES = 6;
const DISCOVERY_LIMIT = 18;
const CACHE_TTL_MS = 30 * 60 * 1000;
const STALE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const OVERPASS_TIMEOUT_MS = 5_000;
const discoveryCache = new Map<string, DiscoveryCacheEntry>();

function toRadians(value: number) {
  return value * Math.PI / 180;
}

export function distanceKm(a: Coordinate, b: Coordinate) {
  const radius = 6371;
  const dLat = toRadians(b[0] - a[0]);
  const dLng = toRadians(b[1] - a[1]);
  const q = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(a[0])) * Math.cos(toRadians(b[0])) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}

function safeHttpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function commonsImageUrl(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^File:(.+)$/i);
  if (!match?.[1]) return null;
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(match[1])}`;
}

function titleCase(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function placeCategory(tags: Record<string, string>): DiscoveredPlace['category'] {
  const tourism = tags.tourism;
  const amenity = tags.amenity;
  if (['hotel', 'guest_house', 'hostel', 'motel', 'apartment', 'chalet'].includes(tourism)) return 'accommodation';
  if (['camp_site', 'caravan_site'].includes(tourism)) return 'campsite';
  if (['restaurant', 'cafe', 'fast_food', 'food_court'].includes(amenity)) return 'restaurant';
  if (['hospital', 'clinic', 'police', 'fire_station'].includes(amenity)) return 'emergency';
  return 'tourist_poi';
}

function placeSubtype(tags: Record<string, string>) {
  return titleCase(tags.tourism || tags.historic || tags.leisure || tags.amenity || tags.natural || 'place');
}

function placeArea(tags: Record<string, string>) {
  return tags['addr:city']
    || tags['addr:town']
    || tags['addr:village']
    || tags['addr:suburb']
    || tags['is_in:city']
    || tags['is_in:town']
    || 'Nearby';
}

function placeRegion(tags: Record<string, string>, area: string) {
  return tags['addr:state'] || tags['is_in:state'] || tags['addr:province'] || area;
}

function placeAddress(tags: Record<string, string>, area: string) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const locality = [tags['addr:suburb'], tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || area]
    .filter(Boolean)
    .join(', ');
  return [street, locality, tags['addr:country']].filter(Boolean).join(', ') || area;
}

function featureFlags(tags: Record<string, string>) {
  const yes = (value: string | undefined) => value === 'yes' || value === 'designated';
  return {
    accessible: yes(tags.wheelchair),
    parking: Boolean(tags.parking) || tags.amenity === 'parking',
    wifi: yes(tags.internet_access) || tags.internet_access === 'wlan',
    familyFriendly: !['nightclub', 'bar'].includes(tags.amenity || ''),
  };
}

export function prominenceScore(element: OsmElement) {
  const tags = element.tags || {};
  let score = 0;
  const hasReference = Boolean(tags.wikipedia || tags.wikidata);
  if (tags.wikipedia) score += 26;
  if (tags.wikidata) score += 18;
  if (tags.image || tags.wikimedia_commons) score += 10;
  if (tags.tourism === 'attraction' || tags.tourism === 'museum') score += 14;
  if (tags.historic) score += hasReference ? 12 : 4;
  if (tags.tourism === 'viewpoint') score += 12;
  if (tags.leisure === 'park' || tags.leisure === 'garden') score += 7;
  if (tags.amenity === 'theatre') score += 6;
  if (tags.amenity === 'place_of_worship') score += hasReference ? 5 : 1;
  if (tags.tourism === 'hotel' || tags.tourism === 'guest_house') score += 2;
  if (tags.amenity === 'restaurant' || tags.amenity === 'cafe') score += 1;
  if (tags.website || tags['contact:website']) score += 1;
  if (tags.phone || tags['contact:phone']) score += 1;
  if (tags.opening_hours) score += 1;
  if (tags['name:ar'] || tags['name:fr']) score += 1;
  return score;
}

export function normalizeOsmPlace(element: OsmElement, origin: Coordinate): DiscoveredPlace | null {
  const tags = element.tags || {};
  const name = tags.name?.trim();
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const coordinates: Coordinate = [Number(latitude), Number(longitude)];
  const area = placeArea(tags);
  const subtype = placeSubtype(tags);
  const taggedImage = safeHttpUrl(tags.image);
  const commonsImage = commonsImageUrl(tags.wikimedia_commons);
  const image = taggedImage || commonsImage;
  const description = tags.description?.trim() || tags['description:en']?.trim() || `${subtype} · ${area}`;

  return {
    id: `osm-${element.type}-${element.id}`,
    name,
    arabicName: tags['name:ar']?.trim() || undefined,
    frenchName: tags['name:fr']?.trim() || undefined,
    category: placeCategory(tags),
    subCategory: subtype,
    region: placeRegion(tags, area),
    area,
    coordinates,
    address: placeAddress(tags, area),
    photos: image ? [image] : [],
    description,
    formationInfo: tags['historic:period'] ? titleCase(tags['historic:period']) : undefined,
    rating: null,
    reviewCount: 0,
    reviews: [],
    features: featureFlags(tags),
    openingHours: tags.opening_hours || undefined,
    contactPhone: tags.phone || tags['contact:phone'] || undefined,
    isUnderDocumentedGem: false,
    source: 'external',
    ownerVerified: false,
    checkInsCount: 0,
    seedData: false,
    photoProvenance: taggedImage ? 'openstreetmap_tag' : commonsImage ? 'wikimedia_commons' : null,
    ratingProvenance: 'unrated',
    dataSource: 'openstreetmap',
    lastVerifiedAt: new Date().toISOString(),
    trustLevel: 'external',
    distanceKm: Number(distanceKm(origin, coordinates).toFixed(2)),
    prominenceScore: prominenceScore(element),
  };
}

function cacheKey([lat, lng]: Coordinate) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function buildOverpassQuery([lat, lng]: Coordinate, radiusMeters: number) {
  const around = `(around:${radiusMeters},${lat},${lng})`;
  return `[out:json][timeout:12];(`
    + `nwr${around}[name][tourism~\"attraction|museum|gallery|viewpoint|zoo|theme_park|hotel|guest_house|hostel|camp_site|caravan_site\"];`
    + `nwr${around}[name][historic];`
    + `nwr${around}[name][leisure~\"park|garden\"];`
    + `nwr${around}[name][amenity~\"restaurant|cafe|place_of_worship|theatre|hospital|clinic|police\"];`
    + `);out center tags 120;`;
}

async function requestOverpass(endpoint: string, query: string): Promise<OsmElement[]> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'MySindbad/1.0 (travel discovery; contact: mysindbad.traveler.ai@gmail.com)',
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Overpass responded ${response.status}`);
  const payload = await response.json() as OverpassResponse;
  return Array.isArray(payload.elements) ? payload.elements : [];
}

async function queryOverpass(origin: Coordinate, radiusMeters: number): Promise<OsmElement[]> {
  const query = buildOverpassQuery(origin, radiusMeters);
  try {
    return await Promise.any(OVERPASS_ENDPOINTS.map((endpoint) => requestOverpass(endpoint, query)));
  } catch (error) {
    throw error instanceof Error ? error : new Error('Nearby discovery unavailable');
  }
}

function normalizeAndRank(elements: OsmElement[], origin: Coordinate) {
  const seenNames = new Set<string>();
  return elements
    .map((element) => ({ element, place: normalizeOsmPlace(element, origin) }))
    .filter((entry): entry is { element: OsmElement; place: DiscoveredPlace } => Boolean(entry.place))
    .filter(({ place }) => {
      const keyName = `${place.name.toLocaleLowerCase()}|${place.coordinates[0].toFixed(4)}|${place.coordinates[1].toFixed(4)}`;
      if (seenNames.has(keyName)) return false;
      seenNames.add(keyName);
      return true;
    })
    .sort((a, b) => {
      const scoreDelta = prominenceScore(b.element) - prominenceScore(a.element);
      return scoreDelta || (a.place.distanceKm ?? 0) - (b.place.distanceKm ?? 0);
    })
    .slice(0, DISCOVERY_LIMIT)
    .map(({ place }) => place);
}

export async function discoverNearbyPlaces(origin: Coordinate): Promise<DiscoveredPlace[]> {
  const key = cacheKey(origin);
  const cached = discoveryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.places;

  try {
    let places = normalizeAndRank(await queryOverpass(origin, PRIMARY_RADIUS_METERS), origin);
    if (places.length < MIN_BASELINE_PLACES) {
      places = normalizeAndRank(await queryOverpass(origin, EXPANDED_RADIUS_METERS), origin);
    }

    const now = Date.now();
    discoveryCache.set(key, {
      expiresAt: now + CACHE_TTL_MS,
      staleUntil: now + STALE_CACHE_TTL_MS,
      places,
    });
    return places;
  } catch (error) {
    if (cached && cached.staleUntil > Date.now() && cached.places.length > 0) return cached.places;
    throw error;
  }
}

export function mergeNearbyPlaces<T extends { id: string; name: string; coordinates: Coordinate }>(
  existing: T[],
  discovered: DiscoveredPlace[],
): Array<T | DiscoveredPlace> {
  const merged: Array<T | DiscoveredPlace> = [...existing];
  for (const place of discovered) {
    const duplicate = merged.some((current) => {
      const sameName = current.name.trim().toLocaleLowerCase() === place.name.trim().toLocaleLowerCase();
      const close = distanceKm(current.coordinates, place.coordinates) < 0.15;
      return current.id === place.id || (sameName && close);
    });
    if (!duplicate) merged.push(place);
  }
  return merged;
}
