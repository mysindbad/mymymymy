import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCityDestination, editDistance, rankFuzzyDestinations } from '../../src/lib/fuzzyDestination.ts';
import type { Place } from '../../src/types.ts';

const place = (id: string, name: string, area: string): Place => ({
  id,
  name,
  category: 'tourist_poi',
  region: 'Morocco',
  area,
  coordinates: [31.63, -8],
  address: area,
  photos: [],
  description: name,
  rating: null,
  reviewCount: 0,
  reviews: [],
  source: 'community_traveler',
  checkInsCount: 0,
});

test('edit distance treats Merakech as a close Marrakech typo', () => {
  assert.ok(editDistance('Merakech', 'Marrakech') <= 2);
});

test('destination ranking recovers Marrakech without returning unrelated cities', () => {
  const marrakech = place('marrakech', 'Royal Mansour', 'Marrakech');
  const tangier = place('tangier', 'Kasbah Museum', 'Tangier');
  const agadir = place('agadir', 'Agadir Beach', 'Agadir');
  const result = rankFuzzyDestinations('Merakech', [tangier, agadir, marrakech]);
  assert.equal(result[0]?.id, 'marrakech');
  assert.ok(!result.some((item) => item.id === 'tangier'));
});

test('a sparse hotel result can still produce Marrakech as the city destination', () => {
  const hotel = place('hotel-1', 'Marrakech Hotel', 'Marrakech');
  hotel.category = 'accommodation';
  hotel.coordinates = [31.6295, -7.9811];
  const city = buildCityDestination('Marrakech', [hotel]);
  assert.ok(city);
  assert.ok(city.id.startsWith('city:'));
  assert.equal(city.name, 'Marrakech');
  assert.equal(city.area, 'Marrakech');
  assert.notEqual(city.id, hotel.id);
});
