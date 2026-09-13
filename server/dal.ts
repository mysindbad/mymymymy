import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export let supabaseAdmin: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type SeedPlace = {
  id: string;
  name: string;
  arabicName?: string;
  frenchName?: string;
  category: string;
  subCategory?: string;
  region: string;
  area: string;
  coordinates: Coordinates;
  address: string;
  photos?: string[];
  description: string;
  formationInfo?: string;
  rating?: number;
  reviewCount?: number;
  ratingsBreakdown?: Record<string, unknown>;
  features?: Record<string, unknown>;
  priceLevel?: string;
  openingHours?: string;
  contactPhone?: string;
  isUnderDocumentedGem?: boolean;
  source?: string;
  ownerVerified?: boolean;
  businessOwnerName?: string;
  checkInsCount?: number;
  aiConfidenceScore?: number;
  lastActivityTimestamp?: string;
  rankText?: string;
  reviews?: Array<Record<string, unknown>>;
};

type SeedTrace = {
  id: string;
  timestamp: string;
  coordinates: [number, number];
  mode: string;
  speedKmh?: number;
  nearPlaceId?: string;
  region?: string;
};

function loadSeedData<T>(fileName: string): T[] {
  try {
    const filePath = path.join(process.cwd(), 'server', 'data', fileName);
    return JSON.parse(readFileSync(filePath, 'utf8')) as T[];
  } catch (error) {
    console.warn(`Unable to load bundled seed data from ${fileName}`, error);
    return [];
  }
}

const seedPlaces = loadSeedData<SeedPlace>('places.json');
const seedTraces = loadSeedData<SeedTrace>('traces.json');

function seedPlaceMatches(place: SeedPlace, filters: {
  category?: string;
  region?: string;
  query?: string;
  hiddenGemsOnly?: boolean;
  minRating?: number;
}) {
  if (filters.category && filters.category !== 'All' && place.category !== filters.category) return false;
  if (filters.region && filters.region !== 'All' && place.region.toLowerCase() !== filters.region.toLowerCase()) return false;
  if (filters.hiddenGemsOnly && !place.isUnderDocumentedGem) return false;
  if (filters.minRating !== undefined && (place.rating || 0) < filters.minRating) return false;
  if (filters.query?.trim()) {
    const term = filters.query.trim().toLowerCase();
    const searchable = [
      place.name,
      place.arabicName,
      place.frenchName,
      place.area,
      place.description,
      place.subCategory,
    ].filter(Boolean).join(' ').toLowerCase();
    if (!searchable.includes(term)) return false;
  }
  return true;
}

function mapSeedPlace(place: SeedPlace): any {
  return {
    ...place,
    photos: place.photos || [],
    rating: Number(place.rating || 0),
    reviewCount: place.reviewCount || 0,
    checkInsCount: place.checkInsCount || 0,
    reviews: place.reviews || [],
    distanceKm: null,
  };
}

function getSeedPlaces(filters: {
  category?: string;
  region?: string;
  query?: string;
  hiddenGemsOnly?: boolean;
  minRating?: number;
} = {}) {
  return seedPlaces.filter((place) => seedPlaceMatches(place, filters)).map(mapSeedPlace);
}

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    throw new Error('Supabase server configuration is missing');
  }
  return supabaseAdmin;
}

export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export class DataValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'DataValidationError';
  }
}

export class DalAuthorizationError extends Error {
  status = 403;
  constructor(message = 'You are not allowed to perform this action') {
    super(message);
    this.name = 'DalAuthorizationError';
  }
}

export class DalAuthenticationError extends Error {
  status = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'DalAuthenticationError';
  }
}

const CATEGORIES = ['accommodation', 'tourist_poi', 'restaurant', 'emergency', 'campsite', 'service'] as const;
const REVIEW_ROLES = ['traveler', 'local_resident', 'guide', 'owner'] as const;

type Coordinates = [number, number];

export interface PlacePayload {
  name: string;
  arabicName?: string;
  frenchName?: string;
  category: string;
  subCategory?: string;
  region: string;
  area: string;
  coordinates: Coordinates;
  address: string;
  photos?: string[];
  description: string;
  formationInfo?: string;
  rating?: number;
  reviewCount?: number;
  ratingsBreakdown?: Record<string, unknown>;
  features?: Record<string, unknown>;
  priceLevel?: '$' | '$$' | '$$$' | '$$$$';
  openingHours?: string;
  contactPhone?: string;
  isUnderDocumentedGem?: boolean;
  source?: string;
  ownerVerified?: boolean;
  businessOwnerName?: string;
  checkInsCount?: number;
  aiConfidenceScore?: number;
  lastActivityTimestamp?: string;
  rankText?: string;
}

export interface ReviewPayload {
  authorName: string;
  authorRole: string;
  rating: number;
  text: string;
  tags?: string[];
  photos?: string[];
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new DataValidationError(`${field} is required`);
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function validateCoordinates(value: unknown): Coordinates {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new DataValidationError('coordinates must be [latitude, longitude]');
  }
  const latitude = Number(value[0]);
  const longitude = Number(value[1]);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new DataValidationError('latitude must be between -90 and 90');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new DataValidationError('longitude must be between -180 and 180');
  }
  return [latitude, longitude];
}

function validateUrls(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new DataValidationError('photos must be an array');
  return value.map((photo) => {
    if (typeof photo !== 'string') throw new DataValidationError('photos must contain URLs');
    let parsed: URL;
    try {
      parsed = new URL(photo);
    } catch {
      throw new DataValidationError('photos must contain valid URLs');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new DataValidationError('photos must use http or https');
    }
    return photo;
  });
}

function optionalNumber(value: unknown, field: string, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new DataValidationError(`${field} must be between ${min} and ${max}`);
  }
  return number;
}

function nonNegativeInteger(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new DataValidationError(`${field} must be a non-negative integer`);
  return number;
}

const TRIP_STATUSES = ['planning', 'active', 'completed', 'cancelled'] as const;
type TripStatus = (typeof TRIP_STATUSES)[number];

export interface TripCreatePayload {
  name: string;
  destinationId?: string;
  startDate: string;
  endDate: string;
  budget: number;
  currency: string;
  participantsCount: number;
  preferences: string[];
}

export interface TripPatchPayload {
  name?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  currency?: string;
  participantsCount?: number;
  status?: TripStatus;
  aiItinerary?: unknown;
  preferences?: string[];
}

function validateTripDate(value: unknown, field: string): string {
  const date = requiredText(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new DataValidationError(`${field} must be a valid date in YYYY-MM-DD format`);
  }
  return date;
}

function validateTripPreferences(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new DataValidationError('preferences must be an array of strings');
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

export function validateTripCreatePayload(input: unknown): TripCreatePayload {
  const value = (input || {}) as Record<string, unknown>;
  const startDate = validateTripDate(value.startDate ?? value.start_date, 'startDate');
  const endDate = validateTripDate(value.endDate ?? value.end_date, 'endDate');
  if (endDate < startDate) throw new DataValidationError('endDate must be on or after startDate');
  const budget = optionalNumber(value.budget, 'budget', Number.MIN_VALUE, Number.MAX_SAFE_INTEGER);
  if (budget === undefined) throw new DataValidationError('budget is required');
  const participantsCount = nonNegativeInteger(value.participantsCount ?? value.participants_count, 'participantsCount');
  if (participantsCount === undefined || participantsCount < 1) throw new DataValidationError('participantsCount must be at least 1');
  const destinationId = optionalText(value.destinationId ?? value.destination_id);
  return {
    name: requiredText(value.name, 'name'),
    destinationId,
    startDate,
    endDate,
    budget,
    currency: optionalText(value.currency) || 'MAD',
    participantsCount,
    preferences: validateTripPreferences(value.preferences),
  };
}

export function validateTripPatchPayload(input: unknown): TripPatchPayload {
  const value = (input || {}) as Record<string, unknown>;
  const patch: TripPatchPayload = {};
  if ('name' in value) patch.name = requiredText(value.name, 'name');
  if ('startDate' in value || 'start_date' in value) patch.startDate = validateTripDate(value.startDate ?? value.start_date, 'startDate');
  if ('endDate' in value || 'end_date' in value) patch.endDate = validateTripDate(value.endDate ?? value.end_date, 'endDate');
  if (patch.startDate && patch.endDate && patch.endDate < patch.startDate) throw new DataValidationError('endDate must be on or after startDate');
  if ('budget' in value) {
    const budget = optionalNumber(value.budget, 'budget', Number.MIN_VALUE, Number.MAX_SAFE_INTEGER);
    if (budget === undefined) throw new DataValidationError('budget is required');
    patch.budget = budget;
  }
  if ('currency' in value) patch.currency = requiredText(value.currency, 'currency');
  if ('participantsCount' in value || 'participants_count' in value) {
    const participantsCount = nonNegativeInteger(value.participantsCount ?? value.participants_count, 'participantsCount');
    if (participantsCount === undefined || participantsCount < 1) throw new DataValidationError('participantsCount must be at least 1');
    patch.participantsCount = participantsCount;
  }
  if ('status' in value) {
    const status = requiredText(value.status, 'status');
    if (!TRIP_STATUSES.includes(status as TripStatus)) throw new DataValidationError('Invalid trip status');
    patch.status = status as TripStatus;
  }
  if ('aiItinerary' in value || 'ai_itinerary' in value) patch.aiItinerary = value.aiItinerary ?? value.ai_itinerary;
  if ('preferences' in value) patch.preferences = validateTripPreferences(value.preferences);
  if (Object.keys(patch).length === 0) throw new DataValidationError('At least one trip field is required');
  return patch;
}

export function validatePlacePayload(input: unknown): PlacePayload {
  const value = (input || {}) as Record<string, unknown>;
  const category = requiredText(value.category, 'category');
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) throw new DataValidationError('Invalid category');
  const rating = optionalNumber(value.rating, 'rating', 0, 5);
  const aiConfidenceScore = optionalNumber(value.aiConfidenceScore, 'aiConfidenceScore', 0, 100);
  const source = optionalText(value.source) || 'community_traveler';
  if (!['initial_seed', 'community_traveler', 'business_owner'].includes(source)) {
    throw new DataValidationError('Invalid source');
  }
  const priceLevel = optionalText(value.priceLevel);
  if (priceLevel && !['$', '$$', '$$$', '$$$$'].includes(priceLevel)) throw new DataValidationError('Invalid priceLevel');
  return {
    name: requiredText(value.name, 'name'),
    arabicName: optionalText(value.arabicName),
    frenchName: optionalText(value.frenchName),
    category,
    subCategory: optionalText(value.subCategory),
    region: requiredText(value.region, 'region'),
    area: requiredText(value.area, 'area'),
    coordinates: validateCoordinates(value.coordinates),
    address: requiredText(value.address, 'address'),
    photos: validateUrls(value.photos),
    description: requiredText(value.description, 'description'),
    formationInfo: optionalText(value.formationInfo),
    rating,
    reviewCount: nonNegativeInteger(value.reviewCount, 'reviewCount'),
    ratingsBreakdown: value.ratingsBreakdown as Record<string, unknown> | undefined,
    features: value.features as Record<string, unknown> | undefined,
    priceLevel: priceLevel as PlacePayload['priceLevel'],
    openingHours: optionalText(value.openingHours),
    contactPhone: optionalText(value.contactPhone),
    isUnderDocumentedGem: Boolean(value.isUnderDocumentedGem),
    source,
    ownerVerified: Boolean(value.ownerVerified),
    businessOwnerName: optionalText(value.businessOwnerName),
    checkInsCount: nonNegativeInteger(value.checkInsCount, 'checkInsCount'),
    aiConfidenceScore,
    lastActivityTimestamp: optionalText(value.lastActivityTimestamp),
    rankText: optionalText(value.rankText),
  };
}

export function validateReviewPayload(input: unknown): ReviewPayload {
  const value = (input || {}) as Record<string, unknown>;
  const authorRole = requiredText(value.authorRole, 'authorRole');
  if (!REVIEW_ROLES.includes(authorRole as (typeof REVIEW_ROLES)[number])) throw new DataValidationError('Invalid authorRole');
  const rating = optionalNumber(value.rating, 'rating', 1, 5);
  if (rating === undefined) throw new DataValidationError('rating is required');
  return {
    authorName: requiredText(value.authorName, 'authorName'),
    authorRole,
    rating,
    text: requiredText(value.text, 'text'),
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    photos: validateUrls(value.photos),
  };
}

function mapReview(row: any): any {
  return {
    id: row.id,
    authorName: row.author_name,
    authorRole: row.author_role,
    rating: Number(row.rating),
    date: row.date,
    text: row.text,
    tags: row.tags || [],
    photos: row.photos || [],
  };
}

function mapPlace(row: any): any {
  return {
    id: row.id,
    name: row.name,
    arabicName: row.arabic_name,
    frenchName: row.french_name,
    category: row.category,
    subCategory: row.sub_category,
    region: row.region,
    area: row.area,
    coordinates: row.coordinates,
    address: row.address,
    photos: row.photos || [],
    description: row.description,
    formationInfo: row.formation_info,
    rating: Number(row.rating || 0),
    reviewCount: row.review_count || 0,
    ratingsBreakdown: row.ratings_breakdown,
    features: row.features,
    priceLevel: row.price_level,
    openingHours: row.opening_hours,
    contactPhone: row.contact_phone,
    isUnderDocumentedGem: row.is_under_documented_gem,
    source: row.source,
    ownerVerified: row.owner_verified,
    businessOwnerName: row.business_owner_name,
    checkInsCount: row.check_ins_count || 0,
    aiConfidenceScore: row.ai_confidence_score === null ? undefined : Number(row.ai_confidence_score),
    lastActivityTimestamp: row.last_activity_timestamp,
    rankText: row.rank_text,
    distanceKm: null,
    reviews: Array.isArray(row.reviews) ? row.reviews.map(mapReview) : [],
  };
}

function mapTrip(row: any): any {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    destinationId: row.destination_id,
    destinationName: row.destination?.name || null,
    startDate: row.start_date,
    endDate: row.end_date,
    budget: Number(row.budget),
    currency: row.currency,
    participantsCount: row.participants_count,
    status: row.status,
    preferences: Array.isArray(row.preferences) ? row.preferences : [],
    aiItinerary: row.ai_itinerary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function throwMappedSupabaseError(error: any): never {
  const message = error?.message || 'Database request failed';
  if (error?.code === '42501' || /row-level security|permission denied/i.test(message)) {
    throw new DalAuthorizationError(message);
  }
  throw error;
}

function requireAccessToken(accessToken?: string): string {
  if (!accessToken) throw new DalAuthenticationError();
  return accessToken;
}

export function createDal(accessToken?: string) {
  const userClient = accessToken ? createUserClient(accessToken) : null;
  const verifyUser = async () => {
    const token = requireAccessToken(accessToken);
    const { data, error } = await userClient!.auth.getUser(token);
    if (error || !data.user) throw new DalAuthenticationError(error?.message || 'Invalid access token');
    return data.user;
  };

  const getOwnedTrip = async (id: string, userId: string) => {
    const { data, error } = await getSupabaseAdmin().from('trips').select('id, user_id').eq('id', id).maybeSingle();
    if (error) throwMappedSupabaseError(error);
    if (!data) return null;
    if (data.user_id !== userId) throw new DalAuthorizationError();
    return data;
  };

  return {
    places: {
      async getAll(filters: { category?: string; region?: string; query?: string; hiddenGemsOnly?: boolean; minRating?: number } = {}) {
        if (!supabaseAdmin) return getSeedPlaces(filters);
        let query = getSupabaseAdmin().from('places').select('*, reviews(*)').order('created_at', { ascending: false });
        if (filters.category && filters.category !== 'All') query = query.eq('category', filters.category);
        if (filters.region && filters.region !== 'All') query = query.ilike('region', filters.region);
        if (filters.hiddenGemsOnly) query = query.eq('is_under_documented_gem', true);
        if (filters.minRating !== undefined) query = query.gte('rating', filters.minRating);
        if (filters.query?.trim()) {
          const term = filters.query.trim().replace(/[,()]/g, ' ');
          query = query.or(`name.ilike.%${term}%,arabic_name.ilike.%${term}%,french_name.ilike.%${term}%,area.ilike.%${term}%,description.ilike.%${term}%,sub_category.ilike.%${term}%`);
        }
        const { data, error } = await query;
        if (error) {
          console.warn('Supabase places read failed; serving bundled seed data', error.message);
          return getSeedPlaces(filters);
        }
        return (data || []).map(mapPlace);
      },
      async getById(id: string) {
        if (!supabaseAdmin) return getSeedPlaces().find((place) => place.id === id) || null;
        const { data, error } = await getSupabaseAdmin().from('places').select('*, reviews(*)').eq('id', id).maybeSingle();
        if (error) {
          console.warn('Supabase place read failed; serving bundled seed data', error.message);
          return getSeedPlaces().find((place) => place.id === id) || null;
        }
        return data ? mapPlace(data) : null;
      },
      async create(input: unknown) {
        const user = await verifyUser();
        const payload = validatePlacePayload(input);
        const row = {
          name: payload.name,
          arabic_name: payload.arabicName,
          french_name: payload.frenchName,
          category: payload.category,
          sub_category: payload.subCategory,
          region: payload.region,
          area: payload.area,
          coordinates: payload.coordinates,
          address: payload.address,
          photos: payload.photos,
          description: payload.description,
          formation_info: payload.formationInfo,
          rating: 0,
          review_count: 0,
          ratings_breakdown: payload.ratingsBreakdown,
          features: payload.features,
          price_level: payload.priceLevel,
          opening_hours: payload.openingHours,
          contact_phone: payload.contactPhone,
          is_under_documented_gem: payload.isUnderDocumentedGem,
          source: payload.source,
          owner_verified: payload.ownerVerified,
          business_owner_name: payload.businessOwnerName,
          check_ins_count: 0,
          ai_confidence_score: payload.aiConfidenceScore,
          last_activity_timestamp: payload.lastActivityTimestamp,
          rank_text: payload.rankText,
          created_by_user_id: user.id,
        };
        const { data, error } = await userClient!.from('places').insert(row).select('*, reviews(*)').single();
        if (error) throwMappedSupabaseError(error);
        return mapPlace(data);
      },
      async addReview(placeId: string, input: unknown) {
        const user = await verifyUser();
        const payload = validateReviewPayload(input);
        const { data, error } = await userClient!.from('reviews').insert({
          place_id: placeId,
          author_name: payload.authorName,
          author_role: payload.authorRole,
          rating: payload.rating,
          text: payload.text,
          tags: payload.tags,
          photos: payload.photos,
          author_user_id: user.id,
        }).select('*').single();
        if (error) throwMappedSupabaseError(error);
        const place = await this.getById(placeId);
        return { review: mapReview(data), place };
      },
      async checkin(placeId: string) {
        const { data, error } = await getSupabaseAdmin().rpc('increment_place_checkins', { place_id_input: placeId });
        if (error) throwMappedSupabaseError(error);
        return { checkInsCount: data };
      },
    },
    trips: {
      async list() {
        const user = await verifyUser();
        const { data, error } = await userClient!.from('trips').select('*, destination:places(name)').eq('user_id', user.id).order('created_at', { ascending: false });
        if (error) throwMappedSupabaseError(error);
        return (data || []).map(mapTrip);
      },
      async create(payload: TripCreatePayload) {
        const user = await verifyUser();
        if (payload.destinationId) {
          const { data: destination, error: destinationError } = await getSupabaseAdmin().from('places').select('id').eq('id', payload.destinationId).maybeSingle();
          if (destinationError) throwMappedSupabaseError(destinationError);
          if (!destination) throw new DataValidationError('destinationId does not exist');
        }
        const { data, error } = await userClient!.from('trips').insert({
          user_id: user.id,
          name: payload.name,
          destination_id: payload.destinationId || null,
          start_date: payload.startDate,
          end_date: payload.endDate,
          budget: payload.budget,
          currency: payload.currency,
          participants_count: payload.participantsCount,
          preferences: payload.preferences,
        }).select('*, destination:places(name)').single();
        if (error) throwMappedSupabaseError(error);
        return mapTrip(data);
      },
      async get(id: string) {
        const user = await verifyUser();
        const owned = await getOwnedTrip(id, user.id);
        if (!owned) return null;
        const { data, error } = await getSupabaseAdmin().from('trips').select('*, destination:places(name)').eq('id', id).single();
        if (error) throwMappedSupabaseError(error);
        return mapTrip(data);
      },
      async update(id: string, patch: TripPatchPayload) {
        const user = await verifyUser();
        const owned = await getOwnedTrip(id, user.id);
        if (!owned) return null;
        const row: Record<string, unknown> = {};
        if (patch.name !== undefined) row.name = patch.name;
        if (patch.startDate !== undefined) row.start_date = patch.startDate;
        if (patch.endDate !== undefined) row.end_date = patch.endDate;
        if (patch.budget !== undefined) row.budget = patch.budget;
        if (patch.currency !== undefined) row.currency = patch.currency;
        if (patch.participantsCount !== undefined) row.participants_count = patch.participantsCount;
        if (patch.status !== undefined) row.status = patch.status;
        if (patch.aiItinerary !== undefined) row.ai_itinerary = patch.aiItinerary;
        if (patch.preferences !== undefined) row.preferences = patch.preferences;
        const { data, error } = await userClient!.from('trips').update(row).eq('id', id).eq('user_id', user.id).select('*, destination:places(name)').single();
        if (error) throwMappedSupabaseError(error);
        return mapTrip(data);
      },
      async remove(id: string) {
        const user = await verifyUser();
        const owned = await getOwnedTrip(id, user.id);
        if (!owned) return false;
        const { error } = await userClient!.from('trips').delete().eq('id', id).eq('user_id', user.id);
        if (error) throwMappedSupabaseError(error);
        return true;
      },
    },
    traces: {
      async add(input: any) {
        const user = await verifyUser();
        const coordinates = validateCoordinates(input?.coordinates);
        const anonymousUserId = requiredText(input?.anonymousUserId, 'anonymousUserId');
        const mode = requiredText(input?.mode, 'mode');
        const speedKmh = optionalNumber(input?.speedKmh, 'speedKmh', 0, Number.MAX_SAFE_INTEGER);
        const { error } = await userClient!.from('traces').insert({
          timestamp: input?.timestamp || new Date().toISOString(),
          anonymous_user_id: anonymousUserId,
          coordinates,
          mode,
          speed_kmh: speedKmh,
          near_place_id: input?.nearPlaceId || null,
          region: optionalText(input?.region),
        });
        if (error) throwMappedSupabaseError(error);
        return { success: true };
      },
      async getSummary() {
        if (!supabaseAdmin) {
          return { totalTraces: seedTraces.length, recent: seedTraces };
        }
        const { data, error } = await getSupabaseAdmin().from('traces').select('*').order('timestamp', { ascending: false }).limit(50);
        if (error) {
          console.warn('Supabase traces read failed; serving bundled seed data', error.message);
          return { totalTraces: seedTraces.length, recent: seedTraces };
        }
        return { totalTraces: data?.length || 0, recent: data || [] };
      },
    },
    getSummary: async () => {
      if (!supabaseAdmin) {
        return { totalPlaces: seedPlaces.length, totalTraces: seedTraces.length };
      }
      const [places, traces] = await Promise.all([
        getSupabaseAdmin().from('places').select('id', { count: 'exact', head: true }),
        getSupabaseAdmin().from('traces').select('id', { count: 'exact', head: true }),
      ]);
      if (places.error || traces.error) {
        console.warn('Supabase summary read failed; serving bundled seed data', places.error || traces.error);
        return { totalPlaces: seedPlaces.length, totalTraces: seedTraces.length };
      }
      return { totalPlaces: places.count || 0, totalTraces: traces.count || 0 };
    },
  };
}