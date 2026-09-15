import { Place } from '../types';
import type { UserLocation } from '../hooks/useGeolocation';

export const NEARBY_RADIUS_KM = 50;
export const TRIP_DESTINATION_RADIUS_KM = 35;
export const TRIP_CORRIDOR_RADIUS_KM = 20;

const EARTH_RADIUS_KM = 6371;
const toRadians = (value: number) => value * Math.PI / 180;

export function haversineDistanceKm(
  a: [number, number],
  b: [number, number],
): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const value = sinLat * sinLat
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * sinLng * sinLng;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function projectedPoint(
  coordinate: [number, number],
  referenceLatitude: number,
): [number, number] {
  const [latitude, longitude] = coordinate;
  const x = toRadians(longitude) * EARTH_RADIUS_KM * Math.cos(toRadians(referenceLatitude));
  const y = toRadians(latitude) * EARTH_RADIUS_KM;
  return [x, y];
}

export function distanceToRouteSegmentKm(
  point: [number, number],
  origin: [number, number],
  destination: [number, number],
): { distanceKm: number; progress: number } {
  const referenceLatitude = (origin[0] + destination[0] + point[0]) / 3;
  const [px, py] = projectedPoint(point, referenceLatitude);
  const [ax, ay] = projectedPoint(origin, referenceLatitude);
  const [bx, by] = projectedPoint(destination, referenceLatitude);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return { distanceKm: Math.hypot(px - ax, py - ay), progress: 0 };
  }
  const rawProgress = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
  const progress = Math.max(0, Math.min(1, rawProgress));
  const closestX = ax + progress * dx;
  const closestY = ay + progress * dy;
  return { distanceKm: Math.hypot(px - closestX, py - closestY), progress: rawProgress };
}

export function withComputedDistance(places: Place[], location: UserLocation): Place[] {
  const origin: [number, number] = [location.latitude, location.longitude];
  return places.map((place) => ({
    ...place,
    distanceKm: haversineDistanceKm(origin, place.coordinates),
  }));
}

function nearbyDisplayScore(place: Place) {
  const reviewSignal = place.reviewCount > 0 ? Math.min(10, Math.log10(place.reviewCount + 1) * 4) : 0;
  const ratingSignal = place.rating !== null && place.reviewCount > 0 ? Math.max(0, place.rating - 3) * 2 : 0;
  const distancePenalty = Math.min(6, (place.distanceKm ?? 0) * 0.12);
  return (place.prominenceScore ?? 0)
    + (place.ownerVerified ? 12 : 0)
    + (place.photos?.length ? 5 : 0)
    + (place.category === 'tourist_poi' ? 3 : 0)
    + reviewSignal
    + ratingSignal
    - distancePenalty;
}

export function filterNearbyPlaces(
  places: Place[],
  location: UserLocation,
  radiusKm = NEARBY_RADIUS_KM,
): Place[] {
  return withComputedDistance(places, location)
    .filter((place) => typeof place.distanceKm === 'number' && place.distanceKm <= radiusKm)
    .sort((a, b) => {
      const relevanceDelta = nearbyDisplayScore(b) - nearbyDisplayScore(a);
      if (Math.abs(relevanceDelta) > 0.01) return relevanceDelta;
      return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
    });
}

export function filterPlacesForTrip(
  places: Place[],
  destination: Place,
  origin?: UserLocation | null,
): Place[] {
  const destinationPoint = destination.coordinates;
  const originPoint: [number, number] | null = origin
    ? [origin.latitude, origin.longitude]
    : null;
  const destinationArea = destination.area.trim().toLocaleLowerCase();

  return places
    .map((place) => {
      const destinationDistanceKm = haversineDistanceKm(place.coordinates, destinationPoint);
      const route = originPoint
        ? distanceToRouteSegmentKm(place.coordinates, originPoint, destinationPoint)
        : null;
      return { place, destinationDistanceKm, route };
    })
    .filter(({ place, destinationDistanceKm, route }) => {
      const sameArea = Boolean(destinationArea)
        && place.area.trim().toLocaleLowerCase() === destinationArea;
      const nearDestination = destinationDistanceKm <= TRIP_DESTINATION_RADIUS_KM;
      const alongDirection = Boolean(route)
        && route!.progress >= 0
        && route!.progress <= 1
        && route!.distanceKm <= TRIP_CORRIDOR_RADIUS_KM;
      return sameArea || nearDestination || alongDirection;
    })
    .sort((a, b) => {
      const scoreA = Math.min(a.destinationDistanceKm, a.route?.distanceKm ?? Number.POSITIVE_INFINITY);
      const scoreB = Math.min(b.destinationDistanceKm, b.route?.distanceKm ?? Number.POSITIVE_INFINITY);
      return scoreA - scoreB;
    })
    .map(({ place, destinationDistanceKm }) => ({
      ...place,
      distanceKm: destinationDistanceKm,
    }));
}
