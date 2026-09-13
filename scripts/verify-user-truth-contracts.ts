import { readFileSync } from 'node:fs';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

function forbid(path: string, patterns: string[]) {
  const source = read(path);
  for (const pattern of patterns) {
    if (source.includes(pattern)) {
      throw new Error(`${path} contains forbidden truth-contract pattern: ${pattern}`);
    }
  }
}

function requirePattern(path: string, patterns: string[]) {
  const source = read(path);
  for (const pattern of patterns) {
    if (!source.includes(pattern)) {
      throw new Error(`${path} is missing required truth-contract pattern: ${pattern}`);
    }
  }
}

forbid('src/components/PassiveDataModal.tsx', [
  'Math.random(',
  '100% Anonymous',
  'Sample anonymous trace recorded on server',
]);

forbid('src/components/AddPlaceModal.tsx', [
  'images.unsplash.com',
  'Verified Local Owner',
  'Documented by the local community on Sindbad',
  'welcoming visitors and travelers',
  'ownerVerified:',
]);

forbid('src/components/RatePlaceModal.tsx', [
  'Ahmed Benali',
  '+50 Community XP',
  'Update AI Memory',
  'Verified review from my recent visit',
]);

forbid('src/components/PlaceDetailModal.tsx', [
  'place.distanceKm || 1.4',
  'Discovered and documented through the collective contributions',
]);

forbid('src/components/AIChatModal.tsx', [
  'Visit Akchour in the morning for its trails and scenery',
  'جرّب أقشور صباحاً',
]);

forbid('src/App.tsx', [
  'USER_XP_KEY',
  "['akchour-bridge', 'riad-el-pueblo']",
  'community_xp:',
  'GPS Active',
  'Explore & AI Memory',
  'Live Interactive Map',
]);

forbid('src/components/ExploreFeed.tsx', [
  'fetchAiMemoryInsights',
  'AiMemoryInsights',
  'Passive GPS',
]);

forbid('src/components/HomeScreen.tsx', [
  "name: 'Istanbul'",
  "name: 'Paris'",
  "name: 'Bali'",
  'Best deals',
  'Chefchaouen & Akchour',
]);

requirePattern('src/components/HomeScreen.tsx', [
  'const availableRegions = useMemo',
  'const featuredPlaces = useMemo(() => places.slice(0, 5)',
  'Available Places',
]);

requirePattern('src/components/NavigationFlow.tsx', [
  'useState<[number, number] | null>(null)',
  '!routeData || steps.length === 0',
  'Start Route Guidance',
  "const isUnavailable = item.mode === 'transit'",
  'disabled={isUnavailable}',
  'Public-transit routing will be enabled here',
]);

requirePattern('src/services/api.ts', [
  "body: { ...payload, name: 'AI itinerary request' }",
  "return await updateTrip(data.trip.id, { aiItinerary: payload.aiItinerary });",
  'requiresAuth: true',
]);

requirePattern('server/dal.ts', [
  "process.env.ALLOW_SEED_FALLBACK === 'true'",
  'throw new DalServiceUnavailableError()',
  "source: 'community_traveler'",
  'owner_verified: false',
  'rating: 0',
  'check_ins_count: 0',
]);

console.log('User-truth contracts verified.');