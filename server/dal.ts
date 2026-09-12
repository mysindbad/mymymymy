import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY');
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

  return {
    places: {
      async getAll(filters: { category?: string; region?: string; query?: string; hiddenGemsOnly?: boolean; minRating?: number } = {}) {
        let query = supabaseAdmin.from('places').select('*, reviews(*)').order('created_at', { ascending: false });
        if (filters.category && filters.category !== 'All') query = query.eq('category', filters.category);
        if (filters.region && filters.region !== 'All') query = query.ilike('region', filters.region);
        if (filters.hiddenGemsOnly) query = query.eq('is_under_documented_gem', true);
        if (filters.minRating !== undefined) query = query.gte('rating', filters.minRating);
        if (filters.query?.trim()) {
          const term = filters.query.trim().replace(/[,()]/g, ' ');
          query = query.or(`name.ilike.%${term}%,arabic_name.ilike.%${term}%,french_name.ilike.%${term}%,area.ilike.%${term}%,description.ilike.%${term}%,sub_category.ilike.%${term}%`);
        }
        const { data, error } = await query;
        if (error) throwMappedSupabaseError(error);
        return (data || []).map(mapPlace);
      },
      async getById(id: string) {
        const { data, error } = await supabaseAdmin.from('places').select('*, reviews(*)').eq('id', id).maybeSingle();
        if (error) throwMappedSupabaseError(error);
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
        const { data, error } = await supabaseAdmin.rpc('increment_place_checkins', { place_id_input: placeId });
        if (error) throwMappedSupabaseError(error);
        return { checkInsCount: data };
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
        const { data, error } = await supabaseAdmin.from('traces').select('*').order('timestamp', { ascending: false }).limit(50);
        if (error) throwMappedSupabaseError(error);
        return { totalTraces: data?.length || 0, recent: data || [] };
      },
    },
    getSummary: async () => {
      const [places, traces] = await Promise.all([
        supabaseAdmin.from('places').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('traces').select('id', { count: 'exact', head: true }),
      ]);
      if (places.error) throwMappedSupabaseError(places.error);
      if (traces.error) throwMappedSupabaseError(traces.error);
      return { totalPlaces: places.count || 0, totalTraces: traces.count || 0 };
    },
  };
}