import React, { useEffect, useMemo, useState } from 'react';
import { CloudSun, MapPin } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';
import { getWeather, WeatherData } from '../services/api';
import type { UserLocation } from '../hooks/useGeolocation';
import type { Place } from '../types';
import { useLocale } from '../lib/i18n';
import { placeDisplayName } from '../lib/placeView';
import { Sheet } from '../ui/Sheet';
import { Select } from '../ui/Field';
import { Button } from '../ui/Button';
import { ErrorState, Skeleton } from '../ui/Feedback';
import { Divider, Stat } from '../ui/Panel';

interface WeatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: SupportedLanguage;
  userLocation?: UserLocation | null;
  tripDestination?: Place | null;
  places?: Place[];
}

// Manual fallback list used only when the traveler has no shared location, no
// active trip and no loaded places. This is explicit, not a hidden default.
const knownPlaces = [
  { id: 'chefchaouen', label: 'Chefchaouen, Morocco', coordinates: [35.1695, -5.2625] as [number, number] },
  { id: 'akchour', label: 'Akchour Cascades, Morocco', coordinates: [35.2415, -5.1742] as [number, number] },
  { id: 'marrakech', label: 'Marrakech, Morocco', coordinates: [31.625, -7.99] as [number, number] },
  { id: 'casablanca', label: 'Casablanca, Morocco', coordinates: [33.5731, -7.5898] as [number, number] },
  { id: 'fes', label: 'Fes, Morocco', coordinates: [34.0331, -5.0003] as [number, number] },
  { id: 'tangier', label: 'Tangier, Morocco', coordinates: [35.7595, -5.834] as [number, number] },
];

export function weatherCodeToLabel(code: number, isAr = false): string {
  if (code === 0) return isAr ? 'سماء صافية' : 'Clear sky';
  if ([1, 2, 3].includes(code)) return isAr ? 'غائم جزئياً' : 'Partly cloudy';
  if ([45, 48].includes(code)) return isAr ? 'ضباب' : 'Fog';
  if ([51, 52, 53, 54, 55, 56, 57].includes(code)) return isAr ? 'رذاذ' : 'Drizzle';
  if ([61, 62, 63, 64, 65, 66, 67].includes(code)) return isAr ? 'أمطار' : 'Rain';
  if ([71, 72, 73, 74, 75, 76, 77, 85, 86].includes(code)) return isAr ? 'ثلوج' : 'Snow';
  if ([80, 81, 82].includes(code)) return isAr ? 'زخات مطرية' : 'Rain showers';
  if ([95, 96, 99].includes(code)) return isAr ? 'عواصف رعدية' : 'Thunderstorm';
  return isAr ? 'غير معروف' : 'Unknown';
}

type LocationOption = {
  id: string;
  label: string;
  coordinates: [number, number];
  source: 'my-location' | 'trip' | 'place' | 'known';
};

export const WeatherModal: React.FC<WeatherModalProps> = ({
  isOpen,
  onClose,
  language = 'en',
  userLocation = null,
  tripDestination = null,
  places = [],
}) => {
  const locale = useLocale(language);
  const t = locale.t;

  const options = useMemo<LocationOption[]>(() => {
    const list: LocationOption[] = [];
    if (userLocation) {
      list.push({
        id: 'my-location',
        label: t('My location', 'موقعي', 'Ma position'),
        coordinates: [userLocation.latitude, userLocation.longitude],
        source: 'my-location',
      });
    }
    if (tripDestination) {
      list.push({
        id: `trip-${tripDestination.id}`,
        label: t(`Trip: ${placeDisplayName(tripDestination, locale.language)}`, `الرحلة: ${placeDisplayName(tripDestination, locale.language)}`, `Voyage : ${placeDisplayName(tripDestination, locale.language)}`),
        coordinates: tripDestination.coordinates,
        source: 'trip',
      });
    }
    const seen = new Set(list.map((item) => item.label));
    places.forEach((place) => {
      const label = placeDisplayName(place, locale.language);
      if (seen.has(label)) return;
      seen.add(label);
      list.push({ id: `place-${place.id}`, label, coordinates: place.coordinates, source: 'place' });
    });
    if (list.length === 0) knownPlaces.forEach((place) => list.push({ ...place, source: 'known' }));
    return list;
  }, [userLocation?.latitude, userLocation?.longitude, tripDestination?.id, places.length, language]);

  const [selectedId, setSelectedId] = useState(() => options[0]?.id || knownPlaces[0].id);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Prefer the traveler's real context (their location, else their active trip)
    // every time the modal opens, instead of remembering a stale manual pick.
    setSelectedId(options[0]?.id || knownPlaces[0].id);
  }, [isOpen]);

  const selected = options.find((option) => option.id === selectedId) || options[0];

  const loadWeather = async (target: LocationOption | undefined) => {
    if (!target) return;
    setIsLoading(true);
    setError(null);
    try {
      setWeather(await getWeather(target.coordinates[0], target.coordinates[1]));
    } catch (loadError) {
      setWeather(null);
      setError(loadError instanceof Error
        ? loadError.message
        : t('Weather service temporarily unavailable.', 'خدمة الطقس غير متاحة مؤقتاً.', 'Service météo temporairement indisponible.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && selected) void loadWeather(selected);
  }, [isOpen, selected?.id]);

  const observed = weather?.observedAt ? new Date(weather.observedAt) : null;

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title={t('Weather', 'الطقس', 'Météo')}
      subtitle={t('Current conditions', 'الظروف الحالية', 'Conditions actuelles')}
      size="sm"
      language={language}
    >
      <div className="space-y-4 px-4 pb-6 pt-3 sm:px-5">
        <Select
          id="weather-place"
          label={t('Place', 'المكان', 'Lieu')}
          value={selectedId}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setSelectedId(event.target.value)}
        >
          {options.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </Select>

        {!userLocation && (
          <p className="flex items-start gap-2 rounded-lg bg-surface-muted px-3 py-2 text-micro leading-snug text-muted">
            <MapPin className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('Share your location for weather where you actually are.', 'شارك موقعك لعرض الطقس في مكانك الفعلي.', 'Partagez votre position pour voir la météo là où vous êtes.')}
          </p>
        )}

        {isLoading && (
          <div className="space-y-2.5 rounded-xl border border-line p-4" aria-busy="true">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-full" />
            <p className="sr-only">{t('Loading weather…', 'جارٍ تحميل الطقس…', 'Chargement de la météo…')}</p>
          </div>
        )}

        {error && !isLoading && (
          <ErrorState
            title={t('Weather is unavailable.', 'الطقس غير متاح.', 'La météo est indisponible.')}
            description={error}
            retryLabel={t('Retry', 'إعادة المحاولة', 'Réessayer')}
            onRetry={() => void loadWeather(selected)}
          />
        )}

        {weather && !isLoading && !error && (
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="flex items-end justify-between gap-3 px-4 pb-3.5 pt-4">
              <div className="min-w-0">
                <p className="text-display font-extrabold leading-none tabular-nums text-ink">
                  {typeof weather.temperatureC === 'number' ? `${Math.round(weather.temperatureC)}°` : '—'}
                </p>
                <p className="mt-1 text-body font-bold text-brand-accent">
                  {weatherCodeToLabel(weather.weatherCode, locale.isArabic)}
                </p>
              </div>
              <CloudSun className="h-10 w-10 shrink-0 text-sand-400" aria-hidden="true" />
            </div>
            <Divider />
            <div className="grid grid-cols-2 gap-3 px-4 py-3">
              <Stat
                label={t('Wind', 'الرياح', 'Vent')}
                value={typeof weather.windSpeedKmh === 'number' ? `${Math.round(weather.windSpeedKmh)} km/h` : '—'}
              />
              <Stat
                label={t('Observed', 'آخر تحديث', 'Observé')}
                value={observed ? observed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                hint={observed ? observed.toLocaleDateString([], { day: 'numeric', month: 'short' }) : undefined}
              />
            </div>
            <p className="border-t border-line bg-surface-muted px-4 py-2 text-micro text-muted">{selected?.label}</p>
          </div>
        )}

        {!isOpen ? null : (
          <Button variant="quiet" size="sm" className="w-full" onClick={() => void loadWeather(selected)} loading={isLoading}>
            {t('Refresh', 'تحديث', 'Actualiser')}
          </Button>
        )}
      </div>
    </Sheet>
  );
};
