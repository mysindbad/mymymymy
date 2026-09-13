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

requirePattern('src/components/NavigationFlow.tsx', [
  'useState<[number, number] | null>(null)',
  '!routeData || steps.length === 0',
  'Start Route Guidance',
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
