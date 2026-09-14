import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const inputPath = path.join(process.cwd(), 'server', 'data', 'places.json');
const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid seed ${field}`);
  return value.trim();
}

function validatePlace(place: any) {
  requiredString(place.name, 'name');
  requiredString(place.category, 'category');
  requiredString(place.region, 'region');
  requiredString(place.area, 'area');
  requiredString(place.address, 'address');
  requiredString(place.description, 'description');
  if (!Array.isArray(place.coordinates) || place.coordinates.length !== 2) throw new Error(`Invalid coordinates for ${place.name}`);
  if (place.coordinates.some((coordinate: unknown) => typeof coordinate !== 'number' || !Number.isFinite(coordinate))) {
    throw new Error(`Invalid coordinates for ${place.name}`);
  }
  if (!Array.isArray(place.photos) || place.photos.some((photo: unknown) => typeof photo !== 'string')) {
    throw new Error(`Invalid photos for ${place.name}`);
  }
  if (!Array.isArray(place.reviews)) throw new Error(`Invalid reviews for ${place.name}`);
}

if (!Array.isArray(input) || input.length === 0) throw new Error('server/data/places.json must contain a non-empty array');
input.forEach(validatePlace);

const { data: existing, error: preflightError } = await supabase.from('places').select('id').eq('seed_data', true).limit(1);
if (preflightError) throw preflightError;
if (existing?.length) throw new Error('Seed aborted: seed_data=true places already exist');

const placeIds = new Map<string, string>();
const placeRows = input.map((place: any) => {
  const id = crypto.randomUUID();
  placeIds.set(place.id || place.name, id);
  return {
    id,
    name: place.name,
    arabic_name: place.arabicName || null,
    french_name: place.frenchName || null,
    category: place.category,
    sub_category: place.subCategory || null,
    region: place.region,
    area: place.area,
    coordinates: place.coordinates,
    address: place.address,
    photos: place.photos,
    description: place.description,
    formation_info: place.formationInfo || null,
    rating: null,
    review_count: 0,
    ratings_breakdown: place.ratingsBreakdown || null,
    features: place.features || null,
    price_level: place.priceLevel || null,
    opening_hours: place.openingHours || null,
    contact_phone: place.contactPhone || null,
    is_under_documented_gem: Boolean(place.isUnderDocumentedGem),
    source: place.source || 'initial_seed',
    rating_provenance: 'unrated',
    data_source: 'curated_seed',
    last_verified_at: null,
    trust_level: 'unverified',
    owner_verified: Boolean(place.ownerVerified),
    business_owner_name: place.businessOwnerName || null,
    check_ins_count: Number.isInteger(place.checkInsCount) ? place.checkInsCount : 0,
    ai_confidence_score: place.aiConfidenceScore ?? null,
    last_activity_timestamp: place.lastActivityTimestamp || null,
    rank_text: place.rankText || null,
    seed_data: true,
    created_by_user_id: null,
  };
});

const { error: placeError } = await supabase.from('places').insert(placeRows);
if (placeError) throw placeError;

const archivedReviewRows = input.flatMap((place: any) => (place.reviews || []).map((review: any) => ({
  original_id: crypto.randomUUID(),
  place_id: placeIds.get(place.id || place.name),
  author_name: requiredString(review.authorName, 'review authorName'),
  author_role: review.authorRole,
  rating: review.rating,
  review_date: review.date || null,
  review_text: requiredString(review.text, 'review text'),
  tags: review.tags || [],
  photos: review.photos || [],
})));

if (archivedReviewRows.length) {
  const { error: reviewError } = await supabase.from('review_seed_archive').insert(archivedReviewRows);
  if (reviewError) throw reviewError;
}

console.log(`Seeded ${placeRows.length} places and archived ${archivedReviewRows.length} reference reviews.`);
