import { Place, PlaceReview, NavigationRouteData, TravelMode } from '../types';

export async function fetchPlaces(params?: {
  category?: string;
  region?: string;
  query?: string;
  hiddenGemsOnly?: boolean;
  minRating?: number;
}): Promise<Place[]> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.category && params.category !== 'All') {
      searchParams.set('category', params.category);
    }
    if (params?.region && params.region !== 'All') {
      searchParams.set('region', params.region);
    }
    if (params?.query) {
      searchParams.set('query', params.query);
    }
    if (params?.hiddenGemsOnly) {
      searchParams.set('hiddenGemsOnly', 'true');
    }
    if (params?.minRating) {
      searchParams.set('minRating', params.minRating.toString());
    }

    const res = await fetch(`/api/places?${searchParams.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch places');
    const data = await res.json();
    return data.places || [];
  } catch (err) {
    console.error('fetchPlaces error:', err);
    return [];
  }
}

export async function fetchPlaceById(id: string): Promise<Place | null> {
  try {
    const res = await fetch(`/api/places/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.place || null;
  } catch (err) {
    console.error('fetchPlaceById error:', err);
    return null;
  }
}

export async function createPlace(placeData: Partial<Place>): Promise<{ success: boolean; place?: Place; error?: string }> {
  try {
    const res = await fetch('/api/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(placeData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create listing');
    return { success: true, place: data.place };
  } catch (err: any) {
    console.error('createPlace error:', err);
    return { success: false, error: err.message };
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
    const res = await fetch(`/api/places/${placeId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review),
    });
    if (!res.ok) throw new Error('Failed to submit review');
    const data = await res.json();
    return { success: true, updatedPlace: data.updatedPlace, review: data.review };
  } catch (err) {
    console.error('submitPlaceReview error:', err);
    return { success: false };
  }
}

export async function submitPlaceCheckIn(placeId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/places/${placeId}/checkin`, {
      method: 'POST',
    });
    return res.ok;
  } catch (err) {
    console.error('submitPlaceCheckIn error:', err);
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
    const res = await fetch('/api/traces/passive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trace),
    });
    return res.ok;
  } catch (err) {
    console.error('submitPassiveTrace error:', err);
    return false;
  }
}

export async function fetchTracesSummary(): Promise<{ totalTraces: number; recent: any[] }> {
  try {
    const res = await fetch('/api/traces/summary');
    if (!res.ok) return { totalTraces: 0, recent: [] };
    return await res.json();
  } catch (err) {
    return { totalTraces: 0, recent: [] };
  }
}

export async function sendChatMessage(
  message: string,
  destination: string,
  language: string,
  history: any[] = []
): Promise<string> {
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, destination, language, history }),
    });
    if (!res.ok) throw new Error('Chat failed');
    const data = await res.json();
    return data.text;
  } catch (err: any) {
    console.error('sendChatMessage error:', err);
    throw err;
  }
}

export async function fetchNavigationGuidance(
  destinationId: string,
  travelMode: TravelMode = 'driving',
  language: string = 'en'
): Promise<NavigationRouteData> {
  try {
    const res = await fetch('/api/ai/navigation-guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationId, travelMode, language }),
    });
    if (!res.ok) throw new Error('Failed to compute navigation route');
    return await res.json();
  } catch (err: any) {
    console.error('fetchNavigationGuidance error:', err);
    throw err;
  }
}

export async function fetchAiMemoryInsights(): Promise<any> {
  try {
    const res = await fetch('/api/ai/memory/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.insights;
  } catch (err) {
    return null;
  }
}
