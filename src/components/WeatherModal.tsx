import React, { useEffect, useMemo, useState } from 'react';
import { CloudSun, Loader2, MapPin, RefreshCw, Wind, X } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';
import { getWeather, WeatherData } from '../services/api';
import type { UserLocation } from '../hooks/useGeolocation';
import type { Place } from '../types';
import { FALLBACK_WEATHER_PLACES, localizedFallbackLabel, weatherCodeToLabel } from '../lib/weatherConditions';

export { weatherCodeToLabel };

interface WeatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: SupportedLanguage;
  userLocation?: UserLocation | null;
  tripDestination?: Place | null;
}

export const WeatherModal: React.FC<WeatherModalProps> = ({
  isOpen,
  onClose,
  language: languageProp,
  userLocation = null,
  tripDestination = null,
}) => {
  // Annotated explicitly: this project does not enable `strict`, so a
  // destructuring default would widen the prop back to `string` and lose the
  // SupportedLanguage union that the localized lookups below depend on.
  const language: SupportedLanguage = languageProp ?? 'en';
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const t = (en: string, ar: string, fr: string) => (isAr ? ar : isFr ? fr : en);

  type LocationOption = { id: string; label: string; coordinates: [number, number]; source: 'my-location' | 'trip' | 'known' };

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
      const name = isAr && tripDestination.arabicName ? tripDestination.arabicName : isFr && tripDestination.frenchName ? tripDestination.frenchName : tripDestination.name;
      list.push({
        id: `trip-${tripDestination.id}`,
        label: t(`Trip: ${name}`, `الرحلة: ${name}`, `Voyage : ${name}`),
        coordinates: tripDestination.coordinates,
        source: 'trip',
      });
    }
    FALLBACK_WEATHER_PLACES.forEach((place) => list.push({
      id: place.id,
      label: localizedFallbackLabel(place, language),
      coordinates: place.coordinates,
      source: 'known',
    }));
    return list;
  }, [userLocation?.latitude, userLocation?.longitude, tripDestination?.id, language]);

  const [selectedId, setSelectedId] = useState(() => options[0]?.id || FALLBACK_WEATHER_PLACES[0].id);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Prefer the traveler's real context (their location, else their active trip)
    // every time the modal opens, instead of remembering a stale manual pick.
    setSelectedId(options[0]?.id || FALLBACK_WEATHER_PLACES[0].id);
  }, [isOpen]);

  const fallbackOption: LocationOption = {
    id: FALLBACK_WEATHER_PLACES[0].id,
    label: localizedFallbackLabel(FALLBACK_WEATHER_PLACES[0], language),
    coordinates: FALLBACK_WEATHER_PLACES[0].coordinates,
    source: 'known',
  };
  const selected = options.find((option) => option.id === selectedId) || options[0] || fallbackOption;

  const loadWeather = async (target: LocationOption) => {
    setIsLoading(true);
    setError(null);
    try {
      setWeather(await getWeather(target.coordinates[0], target.coordinates[1]));
    } catch (loadError) {
      setWeather(null);
      setError(loadError instanceof Error ? loadError.message : t('Weather service temporarily unavailable', 'خدمة الطقس غير متاحة مؤقتاً', 'Service météo temporairement indisponible'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && selected) void loadWeather(selected);
  }, [isOpen, selected?.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
        <div className="p-4 sm:p-5 bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <CloudSun className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">{t('Weather', 'الطقس', 'Météo')}</h3>
              <p className="text-xs text-cyan-100">{t('Live conditions for your location or trip', 'حالة الطقس الحية لموقعك أو رحلتك', 'Conditions en direct pour votre position ou voyage')}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Close', 'إغلاق', 'Fermer')} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              aria-label={t('Choose a place', 'اختر مكاناً', 'Choisir un lieu')}
              className="flex-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs outline-none"
            >
              {options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>

          {!userLocation && (
            <p className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-slate-500">
              {t('Share your location for weather where you actually are.', 'شارك موقعك لعرض الطقس في مكانك الفعلي.', 'Partagez votre position pour voir la météo là où vous êtes.')}
            </p>
          )}

          {isLoading && (
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 flex items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>{t('Loading weather…', 'جارٍ تحميل الطقس…', 'Chargement de la météo…')}</span>
            </div>
          )}
          {error && !isLoading && (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3">
              <span>{t('Weather service temporarily unavailable.', 'خدمة الطقس غير متاحة مؤقتاً.', 'Service météo temporairement indisponible.')}</span>
              <button type="button" onClick={() => void loadWeather(selected)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-white font-bold flex items-center gap-1 shrink-0">
                <RefreshCw className="w-3 h-3" />
                {t('Retry', 'إعادة', 'Réessayer')}
              </button>
            </div>
          )}
          {weather && !isLoading && !error && (
            <>
              <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-3xl font-black text-slate-900">{typeof weather.temperatureC === 'number' ? `${Math.round(weather.temperatureC)}°C` : '—'}</span>
                  <p className="text-xs font-bold text-blue-600 mt-0.5">{weatherCodeToLabel(weather.weatherCode, language)}</p>
                  {weather.observedAt && (
                    <span className="text-[11px] text-slate-500">
                      {t('Observed', 'آخر تحديث', 'Observé')}: {new Date(weather.observedAt).toLocaleString(language)}
                    </span>
                  )}
                </div>
                <CloudSun className="w-12 h-12 text-blue-500" />
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">{t('Wind speed', 'سرعة الرياح', 'Vitesse du vent')}</span>
                <span className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1 mt-0.5">
                  <Wind className="w-3.5 h-3.5 text-blue-600" />
                  {typeof weather.windSpeedKmh === 'number' ? `${Math.round(weather.windSpeedKmh)} km/h` : '—'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{selected.label}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
