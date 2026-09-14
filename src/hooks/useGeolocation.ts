import { useCallback, useEffect, useRef, useState } from 'react';
import { updateUserLocation } from '../lib/supabase';

export type UserLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export type GeolocationPermission = PermissionState | 'unsupported';

export function useGeolocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [permission, setPermission] = useState<GeolocationPermission>(() => (
    typeof navigator === 'undefined' || !navigator.geolocation ? 'unsupported' : 'prompt'
  ));
  const [error, setError] = useState<string | null>(null);
  const requestingRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation || !navigator.permissions?.query) return;

    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;
    let handleChange: (() => void) | null = null;

    void navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      if (cancelled) return;
      permissionStatus = status;
      setPermission(status.state);
      handleChange = () => setPermission(status.state);
      status.addEventListener('change', handleChange);
    }).catch(() => {
      // Some browsers do not expose permission state; keep the prompt state.
    });

    return () => {
      cancelled = true;
      if (permissionStatus && handleChange) {
        permissionStatus.removeEventListener('change', handleChange);
      }
    };
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPermission('unsupported');
      setError('Geolocation is not supported by this browser.');
      return null;
    }
    if (requestingRef.current) return location;

    requestingRef.current = true;
    setError(null);

    try {
      const nextLocation = await new Promise<UserLocation>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => resolve({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : undefined,
          }),
          reject,
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
      });

      setPermission('granted');
      setLocation(nextLocation);
      try {
        const response = await updateUserLocation(nextLocation.latitude, nextLocation.longitude, nextLocation.accuracy);
        if (response && !response.ok) throw new Error('Could not save your location.');
      } catch (saveError) {
        console.warn('Unable to sync user location:', saveError);
      }
      return nextLocation;
    } catch (geolocationError) {
      const code = typeof geolocationError === 'object' && geolocationError && 'code' in geolocationError
        ? Number((geolocationError as { code?: number }).code)
        : 0;
      const nextPermission: GeolocationPermission = code === 1 ? 'denied' : permission;
      setPermission(nextPermission);
      setError(code === 1
        ? 'Location permission was denied.'
        : 'Your current location could not be detected.');
      return null;
    } finally {
      requestingRef.current = false;
    }
  }, [location, permission]);

  return { location, permission, requestPermission, error };
}
