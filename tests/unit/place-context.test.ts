import assert from 'node:assert/strict';
import test from 'node:test';
import { filterNearbyPlaces, filterPlacesForTrip } from '../../src/lib/placeContext.ts';
import type { Place } from '../../src/types.ts';

const makePlace = (id: string, name: string, area: string, coordinates: [number, number]): Place => ({
  id,
  name,
  category: 'tourist_poi',
  region: 'Test Region',
  area,
  coordinates,
  address: name,
  photos: [],
  description: name,
  rating: null,
  reviewCount: 0,
  reviews: [],
  source: 'community_traveler',
  checkInsCount: 0,
});

test('nearby filtering excludes unrelated distant places', () => {
  const location = { latitude: 35.78, longitude: -5.81 };
  const near = makePlace('near', 'Tangier Place', 'Tangier', [35.79, -5.80]);
  const far = makePlace('far', 'Marrakech Place', 'Marrakech', [31.63, -8.0]);
  const result = filterNearbyPlaces([far, near], location, 50);
  assert.deepEqual(result.map((place) => place.id), ['near']);
  assert.ok((result[0].distanceKm ?? 100) < 5);
});

test('nearby display ranks notable landmarks ahead of generic closer POIs', () => {
  const location = { latitude: 35.78, longitude: -5.81 };
  const generic = { ...makePlace('generic', 'Generic Nearby Place', 'Tangier', [35.784, -5.81]), prominenceScore: 1 };
  const landmark = { ...makePlace('landmark', 'Documented Landmark', 'Tangier', [35.87, -5.81]), prominenceScore: 42, photos: ['https://example.com/landmark.jpg'] };
  const result = filterNearbyPlaces([generic, landmark], location, 50);
  assert.deepEqual(result.map((place) => place.id), ['landmark', 'generic']);
});

test('trip filtering keeps destination-area, nearby, and along-direction places', () => {
  const destination = makePlace('dest', 'Marrakech', 'Marrakech', [31.63, -8.0]);
  const sameArea = makePlace('city', 'Medina', 'Marrakech', [31.64, -7.99]);
  const alongRoute = makePlace('route', 'Road Stop', 'Road', [33.7, -6.9]);
  const unrelated = makePlace('wrong', 'Far Away', 'Elsewhere', [35.77, -5.8]);
  const origin = { latitude: 34.02, longitude: -6.84 };
  const result = filterPlacesForTrip([unrelated, alongRoute, sameArea], destination, origin);
  assert.ok(result.some((place) => place.id === 'city'));
  assert.ok(result.some((place) => place.id === 'route'));
  assert.ok(!result.some((place) => place.id === 'wrong'));
});
