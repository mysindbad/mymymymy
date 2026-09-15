import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverNearbyPublicPlaces } from '../../src/services/publicPlaces.ts';

function response(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('public discovery returns real nearby landmarks with city context', async () => {
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('nominatim.openstreetmap.org')) {
      return response({ address: { city: 'Tangier', state: 'Tanger-Tetouan-Al Hoceima' } });
    }
    if (url.includes('overpass')) {
      return response({
        elements: [
          { type: 'node', id: 1, lat: 35.789, lon: -5.812, tags: { name: 'Kasbah Museum', tourism: 'museum', wikipedia: 'en:Kasbah Museum' } },
          { type: 'node', id: 2, lat: 35.792, lon: -5.81, tags: { name: 'City Viewpoint', tourism: 'viewpoint' } },
          { type: 'node', id: 3, lat: 35.785, lon: -5.815, tags: { name: 'Historic Gate', historic: 'city_gate' } },
          { type: 'node', id: 4, lat: 35.787, lon: -5.817, tags: { name: 'City Park', leisure: 'park' } },
          { type: 'node', id: 5, lat: 35.786, lon: -5.818, tags: { name: 'Old Gallery', tourism: 'gallery' } },
        ],
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  const places = await discoverNearbyPublicPlaces({ latitude: 35.788, longitude: -5.812, language: 'en', fetcher });
  assert.ok(places.length >= 5);
  assert.equal(places[0].area, 'Tangier');
  assert.equal(places[0].region, 'Tanger-Tetouan-Al Hoceima');
  assert.equal(places[0].source, 'external_public');
  assert.equal(places[0].trustLevel, 'external');
  assert.equal(places[0].rating, null);
  assert.ok(places.every((place) => typeof place.distanceKm === 'number'));
});

test('public discovery falls back to Wikipedia when map results are sparse', async () => {
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('nominatim.openstreetmap.org')) return response({ address: { city: 'Agadir', state: 'Souss-Massa' } });
    if (url.includes('overpass')) return response({ elements: [] });
    if (url.includes('wikipedia.org')) {
      return response({ query: { pages: { 42: { pageid: 42, title: 'Agadir Oufella', coordinates: [{ lat: 30.439, lon: -9.614 }], extract: 'Historic hilltop landmark.', thumbnail: { source: 'https://upload.wikimedia.org/example.jpg' } } } } });
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  const places = await discoverNearbyPublicPlaces({ latitude: 30.4278, longitude: -9.5981, language: 'en', fetcher });
  assert.equal(places.length, 1);
  assert.equal(places[0].name, 'Agadir Oufella');
  assert.equal(places[0].area, 'Agadir');
  assert.equal(places[0].dataSource, 'wikipedia');
  assert.equal(places[0].photos.length, 1);
});
