import { Place, PlaceReview, NavigationRouteData, TravelMode } from '../types';
import { supabase } from '../lib/supabase';

export class ApiAuthenticationError extends Error {
  status = 401;

  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'ApiAuthenticationError';
  }
}

interface ApiErrorPayload {
  error?: string;
}

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  requiresAuth?: boolean;
}

export interface AiMemoryInsights {
  totalLearnedPlaces: number;
  totalPassiveGpsTraces: number;
  underservedRegionHighlight: string;
  hiddenGemsCount: number;
  topRankedHiddenGems: Array<{
    id: string;
    name: string;
    area: string;
    category: string;
    rating: number;
    reviewCount: number;
    aiConfidenceScore: number;
    recentCheckIns: number;
    reason: string;
  }>;
  aiMemoryStatus: string;
}

export interface WeatherData {
  temperatureC: number;
  weatherCode: number;
  windSpeedKmh: number;
  observedAt: string;
}

export interface TraceSummary {
  totalTraces: number;
  recent: Array<{
    id: string;
    timestamp: string;
    coordinates: [number, number];
    mode: string;
  }>;
}

async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session?.access_token || null;
}

async function apiRequest<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  const { requiresAuth = false, body, headers, ...requestOptions } = options;
  const token = await getAccessToken();
  if (requiresAuth && !token) throw new ApiAuthenticationError();

  const requestHeaders = new Headers(headers);
  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json');
  if (token) requestHeaders.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, {
    ...requestOptions,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: options.signal || AbortSignal.timeout(8000),
  });
  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;
  if (response.status === 401) throw new ApiAuthenticationError(payload.error);
  if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`);
  return payload;
}

export async function fetchPlaces(params?: {
  category?: string;
  region?: string;
  query?: string;
  hiddenGemsOnly?: boolean;
  minRating?: number;
}): Promise<Place[]> {
  const searchParams = new URLSearchParams();
  if (params?.category && params.category !== 'All') searchParams.set('category', params.category);
  if (params?.region && params.region !== 'All') searchParams.set('region', params.region);
  if (params?.query) searchParams.set('query', params.query);
  if (params?.hiddenGemsOnly) searchParams.set('hiddenGemsOnly', 'true');
  if (params?.minRating) searchParams.set('minRating', params.minRating.toString());
  const data = await apiRequest<{ places?: Place[] }>(`/api/places?${searchParams.toString()}`);
  return data.places || [];
}

export async function fetchPlaceById(id: string): Promise<Place | null> {
  try {
    const data = await apiRequest<{ place?: Place }>(`/api/places/${encodeURIComponent(id)}`);
    return data.place || null;
  } catch (error) {
    if (error instanceof Error && 'status' in error && (error as Error & { status?: number }).status === 404) return null;
    throw error;
  }
}

export async function createPlace(placeData: Partial<Place>): Promise<{ success: boolean; place?: Place; error?: string }> {
  try {
    const data = await apiRequest<{ place?: Place }>('/api/places', {
      method: 'POST',
      body: placeData,
      requiresAuth: true,
    });
    return { success: true, place: data.place };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create listing';
    console.error('createPlace error:', error);
    return { success: false, error: message };
  }
}

export async function submitPlaceReview(
  placeId: string,
  review: {
    authorName: string;
    authorRole?: string;
    rating: number;
    text: string;
    tags: string[];
    photo?: string;
  }
): Promise<{ success: boolean; updatedPlace?: Place; review?: PlaceReview }> {
  try {
    const data = await apiRequest<{ updatedPlace?: Place; review?: PlaceReview }>(`/api/places/${encodeURIComponent(placeId)}/reviews`, {
      method: 'POST',
      body: review,
      requiresAuth: true,
    });
    return { success: true, updatedPlace: data.updatedPlace, review: data.review };
  } catch (error) {
    console.error('submitPlaceReview error:', error);
    return { success: false };
  }
}

export async function submitPlaceCheckIn(placeId: string): Promise<boolean> {
  try {
    await apiRequest(`/api/places/${encodeURIComponent(placeId)}/checkin`, { method: 'POST' });
    return true;
  } catch (error) {
    console.error('submitPlaceCheckIn error:', error);
    return false;
  }
}

export async function submitPassiveTrace(trace: {
  coordinates: [number, number];
  mode: string;
  speedKmh?: number;
  anonymousUserId?: string;
  nearPlaceId?: string;
  region?: string;
}): Promise<boolean> {
  try {
    await apiRequest('/api/traces/passive', { method: 'POST', body: trace, requiresAuth: true });
    return true;
  } catch (error) {
    console.error('submitPassiveTrace error:', error);
    return false;
  }
}

export async function fetchTracesSummary(): Promise<TraceSummary> {
  return apiRequest<TraceSummary>('/api/traces/summary');
}

export async function sendChatMessage(
  message: string,
  destination: string,
  language: string,
  history: Array<Record<string, unknown>> = []
): Promise<string> {
  const data = await apiRequest<{ text: string }>('/api/ai/chat', {
    method: 'POST',
    body: { message, destination, language, history },
  });
  return data.text;
}

export async function fetchNavigationGuidance(
  destinationId: string,
  travelMode: TravelMode = 'driving',
  language: string = 'en',
  startLatitude?: number,
  startLongitude?: number
): Promise<NavigationRouteData> {
  return apiRequest<NavigationRouteData>('/api/ai/navigation-guidance', {
    method: 'POST',
    body: { destinationId, travelMode, language, startLatitude, startLongitude },
  });
}

export async function fetchAiMemoryInsights(): Promise<AiMemoryInsights> {
  const data = await apiRequest<{ insights: AiMemoryInsights }>('/api/ai/memory/insights', { method: 'POST' });
  return data.insights;
}

export async function getWeather(latitude: number, longitude: number): Promise<WeatherData> {
  return apiRequest<WeatherData>(`/api/weather?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`);
}
