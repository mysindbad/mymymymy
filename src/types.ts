export type PlaceCategory =
  | 'accommodation'
  | 'tourist_poi'
  | 'restaurant'
  | 'emergency'
  | 'campsite'
  | 'service';

export interface PlaceReview {
  id: string;
  authorName: string;
  authorRole: 'traveler' | 'local_resident' | 'guide' | 'owner';
  rating: number | null;
  date: string;
  text: string;
  tags: string[];
  photos?: string[];
}

export interface PlaceFeatures {
  familyFriendly?: boolean;
  accessible?: boolean;
  wifi?: boolean;
  parking?: boolean;
  petFriendly?: boolean;
  cashOnly?: boolean;
  openNowOnly?: boolean;
}

export interface Place {
  id: string;
  name: string;
  arabicName?: string;
  frenchName?: string;
  category: PlaceCategory;
  subCategory?: string;
  region: string;
  area: string;
  coordinates: [number, number]; // [lat, lng]
  address: string;
  photos: string[];
  description: string;
  formationInfo?: string;
  rating: number;
  reviewCount: number;
  ratingsBreakdown?: {
    cleanliness: number;
    scenery: number;
    accessibility: number;
    valueForMoney: number;
    safety: number;
  };
  reviews: PlaceReview[];
  features?: PlaceFeatures;
  priceLevel?: '$' | '$$' | '$$$' | '$$$$';
  openingHours?: string;
  contactPhone?: string;
  isUnderDocumentedGem?: boolean;
  source: 'initial_seed' | 'community_traveler' | 'business_owner';
  ownerVerified?: boolean;
  businessOwnerName?: string;
  checkInsCount: number;
  aiConfidenceScore?: number;
  lastActivityTimestamp?: string;
  rankText?: string;
  distanceKm?: number;
  seedData?: boolean;
  seedCheckInsCount?: number;
  photoProvenance?: string | null;
  ratingProvenance?: string | null;
  dataSource?: string;
  lastVerifiedAt?: string | null;
  trustLevel?: 'unverified' | 'community' | 'external' | 'official';
  seedRating?: number | null;
  seedReviewCount?: number;
  seedOwnerVerified?: boolean;
  seedSource?: string | null;
}

export type TravelMode = 'driving' | 'walking' | 'transit' | 'taxi';

export interface NavigationStep {
  id: string;
  distanceMeters: number;
  instruction: string;
  roadName: string;
  iconType: 'straight' | 'left' | 'right' | 'arrive';
  aiTip?: string;
}

export interface RouteOption {
  id: string;
  name: string;
  durationMinutes: number;
  distanceKm: number;
  description: string;
  isRecommended: boolean;
  steps: NavigationStep[];
}

export interface NavigationRouteData {
  destination: Place;
  travelMode: TravelMode;
  totalDistanceKm: number;
  durationMinutes: number;
  steps: NavigationStep[];
  trafficCondition: string;
  aiSummary: string;
  modeNote?: string;
}

export interface PassiveTrace {
  id: string;
  timestamp: string;
  anonymousUserId: string;
  coordinates: [number, number];
  mode: string;
  speedKmh: number;
  nearPlaceId?: string | null;
  region?: string;
}

export interface FilterSettings {
  category: string;
  priceRanges: string[];
  minRating: number;
  maxDistanceKm: number;
  openNowOnly: boolean;
  familyFriendly: boolean;
  petFriendly: boolean;
  accessible: boolean;
}

export interface Activity {
  id: string;
  time: string;
  title: string;
  locationName: string;
  category: string;
  duration: string;
  notes?: string;
  cost?: number;
  coordinates: [number, number];
  completed: boolean;
}

export interface TripDay {
  dayNumber: number;
  title?: string;
  theme?: string;
  activities: Activity[];
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  country: string;
  dateRange: string;
  dayCount: number;
  travelers: string;
  progress: number;
  totalBudget: number;
  spentBudget: number;
  coverPhoto: string;
  days: TripDay[];
}

export interface UserBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

export interface UserProfile {
  name: string;
  username: string;
  avatar: string;
  level: number;
  currentXp: number;
  nextLevelXp: number;
  homeCity: string;
  travelStyle: 'explorer' | 'cultural' | 'adventurer' | 'relaxer';
  interests: string[];
  stats: {
    placesSaved: number;
    countriesVisited: number;
    reviewsWritten: number;
    checkIns: number;
    passiveTracesShared: number;
  };
  badges: UserBadge[];
}

export interface CommunityPost {
  id: string;
  authorName: string;
  authorAvatar: string;
  authorLevel: number;
  locationName: string;
  timestamp: string;
  content: string;
  photo?: string;
  likes: number;
  isLiked?: boolean;
  commentsCount: number;
  isSaved?: boolean;
  savesCount: number;
  tags: string[];
}

export interface CommunityStory {
  id: string;
  userName: string;
  userAvatar: string;
  storyPhoto: string;
  locationName: string;
  caption: string;
  hasUnseenStory?: boolean;
}

export interface TravelChallenge {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  completed: boolean;
  progress: string;
}
