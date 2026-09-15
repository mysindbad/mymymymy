import type { Place, PlaceCategory } from '../src/types.ts';

const DISCOVERY_RADIUS_METERS = 20_000;
const MAX_PUBLIC_PLACES = 12;
const CACHE_TTL_MS = 15 * 60 * 1000;
const USER_AGENT = 'MySindbad/0.1 (+https://mymymymy-dusky.vercel.app)';

type FetchLike = typeof fetch;
type CacheEntry = { expiresAt: number; places: Place[] };
const nearbyCache = new Map<string, CacheEntry>();

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function distanceKm(a: [number, number], b: [number, number]) {
  const radiusKm = 6371;
  const dLat = toRadians(b[0] - a[0]);
  const dLng = toRadians(b[1] - a[1]);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(a[0])) * Math.cos(toRadians(b[0])) * Math.sin(dLng / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function cleanText(value: unknown, max = 240) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function safeImage(value: unknown) {
  const text = cleanText(value, 800);
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

async function fetchJson(url: string, fetcher: FetchLike, init?: RequestInit, timeoutMs = 6500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Public place source returned ${response.status}`);
    return await response.json() as any;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeLanguage(language: string) {
  return language === 'ar' ? 'ar' : language === 'fr' ? 'fr' : 'en';
}

async function resolveAreaName(latitude: number, longitude: number, language: string, fetcher: FetchLike) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '10',
    addressdetails: '1',
    'accept-language': normalizeLanguage(language),
  });
  try {
    const data = await fetchJson(`https://nominatim.openstreetmap.org/reverse?${params}`, fetcher, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    }, 4500);
    const address = data?.address || {};
    const city = cleanText(address.city || address.town || address.village || address.municipality || address.county, 80);
    const region = cleanText(address.state || address.region || address.country, 80);
    return { city: city || region || 'Nearby', region: region || city || 'Nearby' };
  } catch {
    return { city: 'Nearby', region: 'Nearby' };
  }
}

function categoryFromTags(tags: Record<string, unknown>): PlaceCategory {
  const tourism = cleanText(tags.tourism, 40);
  const amenity = cleanText(tags.amenity, 40);
  if (['hotel', 'guest_house', 'hostel', 'apartment', 'motel', 'chalet'].includes(tourism)) return 'accommodation';
  if (['camp_site', 'caravan_site'].includes(tourism)) return 'campsite';
  if (['restaurant', 'cafe', 'fast_food', 'food_court'].includes(amenity)) return 'restaurant';
  if (['hospital', 'clinic', 'police', 'fire_station'].includes(amenity)) return 'emergency';
  return 'tourist_poi';
}

function subCategoryFromTags(tags: Record<string, unknown>) {
  const value = cleanText(tags.tourism || tags.historic || tags.leisure || tags.amenity, 60);
  return value ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Point of interest';
}

function addressFromTags(tags: Record<string, unknown>, fallbackArea: string) {
  const parts = [
    cleanText(tags['addr:housenumber'], 20),
    cleanText(tags['addr:street'], 100),
    cleanText(tags['addr:place'], 100),
    cleanText(tags['addr:city'], 80),
  ].filter(Boolean);
  return parts.join(', ') || fallbackArea;
}

function scoreElement(tags: Record<string, unknown>, km: number) {
  let score = 0;
  if (tags.wikipedia || tags.wikidata) score += 12;
  if (tags.image || tags.wikimedia_commons) score += 4;
  if (tags.website || tags['contact:website']) score += 2;
  if (tags.opening_hours) score += 1;
  if (tags.tourism === 'attraction' || tags.tourism === 'museum') score += 5;
  if (tags.historic) score += 4;
  if (tags.tourism === 'viewpoint' || tags.leisure === 'park' || tags.leisure === 'nature_reserve') score += 3;
  return score - Math.min(km / 8, 3);
}

function osmElementToPlace(
  element: any,
  area: { city: string; region: string },
  origin: [number, number],
): (Place & { _score?: number }) | null {
  const tags = element?.tags || {};
  const name = cleanText(tags.name || tags['name:en'] || tags['name:fr'] || tags['name:ar'], 120);
  const latitude = Number(element?.lat ?? element?.center?.lat);
  const longitude = Number(element?.lon ?? element?.center?.lon);
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const point: [number, number] = [latitude, longitude];
  const km = distanceKm(origin, point);
  const category = categoryFromTags(tags);
  const image = safeImage(tags.image);
  const description = cleanText(tags.description || tags['description:en'] || tags['description:fr'] || tags['description:ar'], 360);
  const openingHours = cleanText(tags.opening_hours, 120);
  const phone = cleanText(tags.phone || tags['contact:phone'], 80);

  return {
    id: `osm-${element.type}-${element.id}`,
    name,
    arabicName: cleanText(tags['name:ar'], 120) || undefined,
    frenchName: cleanText(tags['name:fr'], 120) || undefined,
    category,
    subCategory: subCategoryFromTags(tags),
    region: area.region,
    area: area.city,
    coordinates: point,
    address: addressFromTags(tags, area.city),
    photos: image ? [image] : [],
    description: description || `${name} · ${area.city}`,
    rating: null,
    reviewCount: 0,
    reviews: [],
    features: {},
    openingHours: openingHours || undefined,
    contactPhone: phone || undefined,
    isUnderDocumentedGem: false,
    source: 'external_public',
    ownerVerified: false,
    checkInsCount: 0,
    aiConfidenceScore: 0,
    distanceKm: Number(km.toFixed(2)),
    seedData: false,
    photoProvenance: image ? 'external_public' : null,
    ratingProvenance: 'unrated',
    dataSource: 'openstreetmap',
    trustLevel: 'external',
    _score: scoreElement(tags, km),
  } as Place & { _score?: number };
}

async function fetchOverpassPlaces(
  latitude: number,
  longitude: number,
  area: { city: string; region: string },
  fetcher: FetchLike,
) {
  const query = `[out:json][timeout:10];(
    nwr(around:${DISCOVERY_RADIUS_METERS},${latitude},${longitude})["tourism"~"attraction|museum|viewpoint|gallery|zoo|theme_park|hotel|guest_house|hostel|camp_site|caravan_site"]["name"];
    nwr(around:${DISCOVERY_RADIUS_METERS},${latitude},${longitude})["historic"]["name"];
    nwr(around:${DISCOVERY_RADIUS_METERS},${latitude},${longitude})["leisure"~"park|nature_reserve"]["name"];
    nwr(around:${DISCOVERY_RADIUS_METERS},${latitude},${longitude})["amenity"~"restaurant|cafe"]["wikipedia"]["name"];
  );out center tags 80;`;
  const body = new URLSearchParams({ data: query }).toString();
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint, fetcher, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        body,
      }, 7500);
      return (Array.isArray(data?.elements) ? data.elements : [])
        .map((element: any) => osmElementToPlace(element, area, [latitude, longitude]))
        .filter(Boolean) as Array<Place & { _score?: number }>;
    } catch {
      // Try the next public endpoint.
    }
  }
  return [];
}

async function fetchWikipediaPlaces(latitude: number, longitude: number, language: string, area: { city: string; region: string }, fetcher: FetchLike) {
  const lang = normalizeLanguage(language);
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'geosearch',
    ggsprimary: 'all',
    ggsnamespace: '0',
    ggsradius: String(DISCOVERY_RADIUS_METERS),
    ggslimit: '12',
    ggscoord: `${latitude}|${longitude}`,
    prop: 'coordinates|pageimages|extracts',
    piprop: 'thumbnail',
    pithumbsize: '900',
    exintro: '1',
    explaintext: '1',
    exsentences: '2',
  });
  try {
    const data = await fetchJson(`https://${lang}.wikipedia.org/w/api.php?${params}`, fetcher, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    }, 6000);
    return Object.values(data?.query?.pages || {}).map((page: any) => {
      const coordinate = page?.coordinates?.[0];
      const lat = Number(coordinate?.lat);
      const lon = Number(coordinate?.lon);
      const name = cleanText(page?.title, 120);
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const km = distanceKm([latitude, longitude], [lat, lon]);
      const photo = safeImage(page?.thumbnail?.source);
      return {
        id: `wikipedia-${lang}-${page.pageid}`,
        name,
        category: 'tourist_poi',
        subCategory: 'Landmark',
        region: area.region,
        area: area.city,
        coordinates: [lat, lon] as [number, number],
        address: area.city,
        photos: photo ? [photo] : [],
        description: cleanText(page?.extract, 360) || `${name} · ${area.city}`,
        rating: null,
        reviewCount: 0,
        reviews: [],
        features: {},
        isUnderDocumentedGem: false,
        source: 'external_public',
        ownerVerified: false,
        checkInsCount: 0,
        aiConfidenceScore: 0,
        distanceKm: Number(km.toFixed(2)),
        seedData: false,
        photoProvenance: photo ? 'wikipedia' : null,
        ratingProvenance: 'unrated',
        dataSource: 'wikipedia',
        trustLevel: 'external',
        _score: 10 - Math.min(km / 8, 3),
      } as Place & { _score?: number };
    }).filter(Boolean) as Array<Place & { _score?: number }>;
  } catch {
    return [];
  }
}

function dedupeAndRank(places: Array<Place & { _score?: number }>) {
  const seen = new Set<string>();
  return places
    .sort((a, b) => (b._score || 0) - (a._score || 0) || (a.distanceKm || 0) - (b.distanceKm || 0))
    .filter((place) => {
      const key = `${place.name.toLocaleLowerCase()}|${place.coordinates[0].toFixed(3)}|${place.coordinates[1].toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_PUBLIC_PLACES)
    .map(({ _score: _ignored, ...place }) => place as Place);
}

export async function discoverNearbyPublicPlaces(options: {
  latitude: number;
  longitude: number;
  language?: string;
  category?: string;
  fetcher?: FetchLike;
}): Promise<Place[]> {
  const { latitude, longitude } = options;
  const language = normalizeLanguage(options.language || 'en');
  const category = options.category && options.category !== 'All' ? options.category : '';
  const fetcher = options.fetcher || fetch;
  const cacheKey = `${latitude.toFixed(2)}:${longitude.toFixed(2)}:${language}:${category}`;
  const cached = nearbyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.places.map((place) => ({ ...place }));

  const area = await resolveAreaName(latitude, longitude, language, fetcher);
  let places = await fetchOverpassPlaces(latitude, longitude, area, fetcher);
  if (places.length < 5) {
    const wikipedia = await fetchWikipediaPlaces(latitude, longitude, language, area, fetcher);
    places = places.concat(wikipedia);
  }
  let result = dedupeAndRank(places);
  if (category) result = result.filter((place) => place.category === category);
  nearbyCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, places: result });
  return result.map((place) => ({ ...place }));
}
