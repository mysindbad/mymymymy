// Types for the admin surface. These mirror the DTOs returned by server/admin.ts and are
// deliberately hand-written rather than widened `any` bags: if the server stops returning a
// field, the admin screen that reads it should fail to compile, not render undefined.

export type PlaceModerationStatus = 'pending' | 'approved' | 'needs_changes' | 'rejected';
export type ReviewModerationStatus = 'approved' | 'pending' | 'rejected';
export type AdminRole = 'admin' | 'super_admin';

export interface AdminSession {
  status: 'anonymous' | 'denied' | 'granted' | 'unavailable';
  role?: AdminRole;
  isConfigured: boolean;
}

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface PlaceRow {
  id: string;
  name: string;
  arabicName: string | null;
  frenchName: string | null;
  category: string | null;
  subCategory: string | null;
  region: string;
  area: string;
  address: string;
  description: string;
  formationInfo: string | null;
  coordinates: [number, number] | null;
  openingHours: string | null;
  priceLevel: string | null;
  contactPhone: string | null;
  businessOwnerName: string | null;
  rating: { value: number | null; reviewCount: number; provenance: string };
  seed: { isSeed: boolean; rating: number | null; reviewCount: number; source: string | null };
  checkInsCount: number;
  isUnderDocumentedGem: boolean;
  trustLevel: string;
  dataSource: string;
  source: string;
  photoProvenance: string | null;
  lastVerifiedAt: string | null;
  photos: string[];
  suppressedPhotoCount: number;
  moderation: { status: PlaceModerationStatus; note: string | null; moderatedAt: string | null; moderatedBy: string | null };
  submittedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastActivityAt: string | null;
}

export interface ReviewRow {
  id: string;
  placeId: string;
  placeName: string | null;
  placeArea: string | null;
  authorName: string;
  authorRole: string;
  rating: number;
  text: string;
  tags: string[];
  photos: string[];
  suppressedPhotoCount: number;
  isSeed: boolean;
  moderation: { status: ReviewModerationStatus; note: string | null; moderatedAt: string | null };
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TravelerRow {
  userId: string;
  displayName: string | null;
  preferredLanguage: string | null;
  hasAvatar: boolean;
  hasLocationOnFile: boolean;
  hasHomeLocationOnFile: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  adminRole: AdminRole | null;
  grantedAt: string | null;
}

export interface TravelerDetail {
  profile: TravelerRow | null;
  admin: { role: AdminRole; grantedAt: string | null; grantedBy: string | null } | null;
  activity: { placesSubmitted: number; reviewsWritten: number; tripsCreated: number };
}

export interface AuditRow {
  id: string;
  occurredAt: string | null;
  adminLabel: string | null;
  adminRole: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  changeSummary: Record<string, unknown>;
}

export interface RosterRow {
  userId: string;
  displayName: string | null;
  role: AdminRole;
  grantedAt: string | null;
  grantedBy: string | null;
}

export interface DuplicateCandidate {
  id: string;
  name: string;
  area: string | null;
  category: string | null;
  moderationStatus: string | null;
  distanceMeters: number | null;
  similarity: number;
  likely: boolean;
}

export interface PlaceDetail {
  place: PlaceRow;
  reviews: ReviewRow[];
  duplicateCandidates: DuplicateCandidate[];
  history: AuditRow[];
}

export interface Page<T> extends PageMeta {
  rows: T[];
}

export interface OverviewPayload {
  snapshot: Record<string, any>;
  databaseLatencyMs: number;
  recentActions: AuditRow[];
}

export type ServiceStatus = 'healthy' | 'degraded' | 'unavailable' | 'unknown';

export interface ServiceSignal {
  key: string;
  status: ServiceStatus;
  latencyMs: number | null;
  checkedAt: string | null;
  source: 'live-probe' | 'observed-request' | 'telemetry' | 'configuration';
  detail: string | null;
  ok?: number;
  failed?: number;
  lastProblemAt?: string | null;
}

export interface ServiceHealthPayload {
  health: { services: ServiceSignal[]; telemetryRows: number; window: string; generatedAt: string };
  configuration: { aiProvider: boolean; database: boolean };
}

export interface ProbePayload {
  probes: { services: ServiceSignal[]; checkedAt: string };
}

export interface AiOperationsPayload {
  usage: {
    total7d: number;
    last24h: number;
    perDay: Array<{ date: string; count: number }>;
    byEndpoint: Array<{ endpoint: string; count: number }>;
  };
  outcomes: { total: number; ok: number; failed: number; p50LatencyMs: number | null; p95LatencyMs: number | null };
  configuration: { provider: string; model: string; keyConfigured: boolean };
}

export interface SettingsPayload {
  settings: {
    runtime: { nodeEnvironment: string; hosting: string; revision: string | null };
    capabilities: Record<string, boolean>;
    counters: Record<string, number>;
    editable: unknown[];
  };
  role: AdminRole;
}

export interface QueuePayload extends Page<PlaceRow> {
  queueCounts: Array<{ status: PlaceModerationStatus; total: number }>;
  waitingTotal: number;
}

// Response envelopes. The server groups some payloads (they are single-object reads rather
// than list pages), so these wrapper types stay explicit instead of being flattened away.
export type OverviewResponse = { overview: OverviewPayload };
export type PlaceDetailResponse = { detail: PlaceDetail };
export type TravelerDetailResponse = { traveler: TravelerDetail };
export type QueueResponse = { queue: QueuePayload };
export type ProbeResponse = ProbePayload & { probes: { services: ServiceSignal[]; checkedAt: string } };

export const PLACE_CURATION_FIELDS = [
  'name',
  'description',
  'region',
  'area',
  'address',
  'arabic_name',
  'french_name',
  'formation_info',
  'sub_category',
  'opening_hours',
  'contact_phone',
] as const;

export const PLACE_CURATION_ENUMS = {
  category: ['accommodation', 'tourist_poi', 'restaurant', 'emergency', 'campsite', 'service'],
  price_level: ['$', '$$', '$$$', '$$$$'],
  trust_level: ['unverified', 'community', 'external', 'official'],
} as const;

/** Which decisions the server insists on a written reason for. Mirrored so the form can say
 *  "reason required" before a request is sent, while the server still enforces it. */
export const PLACE_STATUSES_REQUIRING_REASON: PlaceModerationStatus[] = ['rejected', 'needs_changes'];
