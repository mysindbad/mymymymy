import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceKm, normalizeOsmPlace, prominenceScore } from '../../server/placeDiscovery.ts';

const origin: [number, number] = [35.788, -5.812];

test('OpenStreetMap landmarks normalize into complete unrated places', () => {
  const place = normalizeOsmPlace({
    type: 'node',
    id: 42,
    lat: 35.789,
    lon: -5.811,
    tags: {
      name: 'Kasbah Museum',
      'name:ar': 'متحف القصبة',
      tourism: 'museum',
      wikipedia: 'en:Kasbah Museum',
      'addr:city': 'Tangier',
      'addr:street': 'Kasbah Square',
      opening_hours: '10:00-18:00',
      phone: '+212000000000',
    },
  }, origin);

  assert.ok(place);
  assert.equal(place.name, 'Kasbah Museum');
  assert.equal(place.arabicName, 'متحف القصبة');
  assert.equal(place.category, 'tourist_poi');
  assert.equal(place.area, 'Tangier');
  assert.equal(place.rating, null);
  assert.equal(place.reviewCount, 0);
  assert.equal(place.source, 'external');
  assert.equal(place.dataSource, 'openstreetmap');
  assert.equal(place.trustLevel, 'external');
  assert.match(place.address, /Kasbah Square/);
  assert.equal(place.openingHours, '10:00-18:00');
  assert.ok(typeof place.distanceKm === 'number' && place.distanceKm < 1);
});

test('prominence ranks documented landmarks above generic restaurants', () => {
  const museum = prominenceScore({ type: 'node', id: 1, tags: { name: 'Museum', tourism: 'museum', wikipedia: 'en:Museum', wikidata: 'Q1' } });
  const cafe = prominenceScore({ type: 'node', id: 2, tags: { name: 'Cafe', amenity: 'cafe' } });
  assert.ok(museum > cafe);
});

test('distance calculation remains geographically bounded', () => {
  const distance = distanceKm([35.788, -5.812], [35.7595, -5.834]);
  assert.ok(distance > 2 && distance < 5);
});
