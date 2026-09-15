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
  'place.seedData',
  'Curated baseline',
  'بيانات تأسيسية منسّقة',
  'curated starting catalog',
]);

forbid('src/components/AIChatModal.tsx', [
  'Visit Akchour in the morning for its trails and scenery',
  'جرّب أقشور صباحاً',
  'Hidden natural spots in Akchour',
  'Quick Questions',
]);

forbid('src/App.tsx', [
  'USER_XP_KEY',
  "['akchour-bridge', 'riad-el-pueblo']",
  'community_xp:',
  'GPS Active',
  'Explore & AI Memory',
  'Live Interactive Map',
  'useEffect(() => void loadPlaces(), [])',
]);

forbid('src/components/AuthFlowModal.tsx', [
  'useState(true)',
  "useState('Saudi Arabia')",
  "useState('العربية')",
  'redirectTo: window.location.origin',
  'Your data is safe with us',
  'بياناتك في أمان تام',
]);

forbid('src/components/TripsPlanner.tsx', [
  'Build a realistic Morocco trip plan',
  'places currently available in Northern Morocco',
  'أنشئ خطة واقعية لرحلتك في المغرب',
  'الأماكن المتاحة حالياً في شمال المغرب',
  'Build a realistic plan for your selected destination',
  'AI Trip Planner',
  'Promise.allSettled([fetchTrips(), fetchPlaces()])',
]);

forbid('server.ts', [
  'const dayCount = Math.min(7,',
]);

forbid('src/components/ExploreFeed.tsx', [
  'fetchAiMemoryInsights',
  'AiMemoryInsights',
  'Passive GPS',
  'place.seedData',
  'Curated baseline',
  'بيانات تأسيسية منسّقة',
  'organizing community signals',
]);

forbid('src/components/HomeScreen.tsx', [
  "name: 'Istanbul'",
  "name: 'Paris'",
  "name: 'Bali'",
  'Best deals',
  'Chefchaouen & Akchour',
  'Good Trips Brighter Stories',
  'Route planning',
  'Browse catalog',
]);

forbid('src/components/CommunityHub.tsx', [
  'XP and levels are not shown yet',
  'contribution scores are calculated',
  'Community score connected',
  'Site engagement enabled',
]);

forbid('src/components/SideMenuDrawer.tsx', [
  'onSignOut',
  '<LogOut',
]);

requirePattern('src/components/HomeScreen.tsx', [
  'const featuredPlaces = useMemo(() => places.slice(0, 5)',
  'Share your location to see nearby places.',
  'onVoiceCommand',
  'recognitionRef',
  'onVoiceAction',
]);

requirePattern('src/lib/placeContext.ts', [
  'filterNearbyPlaces',
  'filterPlacesForTrip',
  'distanceToRouteSegmentKm',
  'TRIP_DESTINATION_RADIUS_KM',
  'TRIP_CORRIDOR_RADIUS_KM',
]);

requirePattern('src/lib/appNavigation.ts', [
  'resolveAppNavigationHelp',
  'extractDestinationIntent',
  'destinationVoiceReply',
  "target: 'trips'",
  "target: 'explore'",
]);

requirePattern('src/components/AIChatModal.tsx', [
  'resolveAppNavigationHelp(text, language)',
  'actions?: AppNavigationAction[]',
  'onNavigateApp(action)',
]);

requirePattern('src/components/ExploreFeed.tsx', [
  'fetchPlaces({ query })',
  'filterNearbyPlaces',
  'filterPlacesForTrip',
  '!query && !userLocation && !tripDestination',
]);

requirePattern('src/components/SideMenuDrawer.tsx', [
  'w-[256px]',
  "onNavigateTab('home')",
  'justify-end',
  'justify-start',
]);

requirePattern('src/components/AccountProfilePage.tsx', [
  'Account',
  'onLanguageChange',
  'onRequestLocation',
  'savedPlacesCount',
  'onSignOut',
]);

requirePattern('src/types.ts', [
  'seedData?: boolean',
  'photoProvenance?: string | null',
  'rating: number | null',
  'ratingProvenance?: string | null',
  "trustLevel?: 'unverified' | 'community' | 'external' | 'official'",
  'seedRating?: number | null',
  'seedReviewCount?: number',
]);

requirePattern('src/components/NavigationFlow.tsx', [
  'useState<[number, number] | null>(null)',
  '!routeData || steps.length === 0',
  'Start Route Guidance',
  "const isUnavailable = item.mode === 'transit'",
  'disabled={isUnavailable}',
  'Public-transit routing will be enabled here',
]);

requirePattern('src/lib/supabase.ts', [
  'function normalizeSupabaseUrl',
  'return parsed.origin',
  'getPasswordRecoveryRedirectUrl',
  "redirect.searchParams.set('mode', 'recovery')",
  "flowType: 'pkce'",
]);

requirePattern('src/App.tsx', [
  "const callbackMode = callbackUrl.searchParams.get('mode')",
  "callbackMode === 'recovery'",
  "setAuthInitialScreen('reset-password')",
  'exchangeCodeForSession(code)',
  'filterNearbyPlaces(all, userLocation)',
  'filterPlacesForTrip(all, destination, userLocation)',
  "activeTab === 'account'",
  'handleVoiceCommand',
]);

requirePattern('src/hooks/useGeolocation.ts', [
  "permissionStatus.removeEventListener('change', handleChange)",
]);

requirePattern('src/components/AuthFlowModal.tsx', [
  "const [country, setCountry] = useState('')",
  'const [agreedToTerms, setAgreedToTerms] = useState(false)',
  'if (!agreedToTerms)',
  'preferred_language: language',
  'getPasswordRecoveryRedirectUrl()',
  'disabled={!agreedToTerms || isLoading}',
]);

requirePattern('src/components/TripsPlanner.tsx', [
  'const MAX_PLAN_DAYS = 7',
  'return dateInputValue(date)',
  'const latestEndDate = addDays(form.startDate, MAX_PLAN_DAYS - 1)',
  'form.startDate < today',
  'Plans support up to 7 days.',
  'min={today}',
  'max={latestEndDate}',
  'fetchPlaces({ query })',
  'Add Trip',
]);

requirePattern('server.ts', [
  "if (dayCount > 7) throw new DataValidationError('AI trip plans support up to 7 days')",
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
  'rating: null',
  'check_ins_count: 0',
  'seedData: Boolean(row.seed_data)',
  'photoProvenance: row.photo_provenance || null',
  'ratingProvenance: row.rating_provenance || null',
  "trustLevel: row.trust_level || 'unverified'",
]);

forbid('server/dal.ts', [
  'Number(row.rating || 0)',
  'rating: 0',
]);

forbid('src/components/PlaceDetailModal.tsx', ['place.rating.toFixed(1)']);
forbid('src/components/ExploreFeed.tsx', ['place.rating.toFixed(1)']);
forbid('src/components/MapView.tsx', [
  'place.rating.toFixed(1)',
  'activeNearbyPlace.rating.toFixed(1)',
]);

requirePattern('src/lib/placeRating.ts', [
  'hasVerifiedRating',
  'No verified rating',
  'لا يوجد تقييم موثوق بعد',
]);

console.log('User-truth contracts verified.');
