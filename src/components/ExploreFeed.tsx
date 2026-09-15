import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Loader2, MapPin, Navigation, Plus, Search, X } from 'lucide-react';
import { Place } from '../types';
import { fetchPlaces } from '../services/api';
import { SupportedLanguage } from '../data/translations';
import { formatPriceLevel } from '../data/currency';
import { formatVerifiedRating, unratedShortLabel } from '../lib/placeRating';
import type { UserLocation } from '../hooks/useGeolocation';
import { filterNearbyPlaces, filterPlacesForTrip } from '../lib/placeContext';
import { PlaceVisual } from './PlaceVisual';

interface ExploreFeedProps {
  onSelectPlace: (place: Place) => void;
  onStartRoute: (place: Place) => void;
  onOpenAddModal: () => void;
  onOpenPassiveModal: () => void;
  savedPlaceIds: string[];
  onToggleSave: (id: string) => void;
  language?: SupportedLanguage;
  currency?: string;
  initialQuery?: string;
  userLocation?: UserLocation | null;
  tripDestination?: Place | null;
  onPlacesLoaded?: (places: Place[]) => void;
}

export const ExploreFeed: React.FC<ExploreFeedProps> = ({
  onSelectPlace,
  onStartRoute,
  onOpenAddModal,
  onOpenPassiveModal,
  savedPlaceIds,
  onToggleSave,
  language = 'en',
  currency = 'MAD',
  initialQuery = '',
  userLocation = null,
  tripDestination = null,
  onPlacesLoaded,
}) => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'accommodation' | 'tourist_poi' | 'restaurant' | 'emergency'>('all');
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const t = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;

  useEffect(() => setSearchQuery(initialQuery), [initialQuery]);

  useEffect(() => {
    const query = searchQuery.trim();
    const sequence = ++requestSequence.current;
    const timer = window.setTimeout(async () => {
      if (!query && !userLocation && !tripDestination) {
        setPlaces([]);
        onPlacesLoaded?.([]);
        setIsLoading(false);
        setLoadError(null);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      try {
        let nextPlaces: Place[];
        if (query) {
          nextPlaces = await fetchPlaces({ query });
        } else if (tripDestination) {
          const allPlaces = await fetchPlaces();
          nextPlaces = filterPlacesForTrip(allPlaces, tripDestination, userLocation);
        } else if (userLocation) {
          const allPlaces = await fetchPlaces({ userLat: userLocation.latitude, userLng: userLocation.longitude });
          nextPlaces = filterNearbyPlaces(allPlaces, userLocation);
        } else {
          nextPlaces = [];
        }
        if (sequence !== requestSequence.current) return;
        setPlaces(nextPlaces);
        onPlacesLoaded?.(nextPlaces);
      } catch (error) {
        if (sequence !== requestSequence.current) return;
        setPlaces([]);
        onPlacesLoaded?.([]);
        setLoadError(error instanceof Error ? error.message : t('Could not load places.', 'تعذر تحميل الأماكن.', 'Impossible de charger les lieux.'));
      } finally {
        if (sequence === requestSequence.current) setIsLoading(false);
      }
    }, query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [searchQuery, userLocation?.latitude, userLocation?.longitude, tripDestination?.id]);

  const visiblePlaces = useMemo(() => places.filter((place) => {
    if (selectedFilter === 'all') return true;
    return place.category === selectedFilter;
  }), [places, selectedFilter]);

  const hasOpenStreetMapData = places.some((place) => place.dataSource === 'openstreetmap');
  const contextTitle = searchQuery.trim()
    ? t('Search results', 'نتائج البحث', 'Résultats de recherche')
    : tripDestination
      ? t(`Places for ${tripDestination.name}`, `أماكن لرحلة ${tripDestination.arabicName || tripDestination.name}`, `Lieux pour ${tripDestination.frenchName || tripDestination.name}`)
      : t('Nearby places', 'أماكن قريبة', 'Lieux proches');

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-24 sm:p-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-xs">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t('Search a city or place', 'ابحث عن مدينة أو مكان', 'Rechercher une ville ou un lieu')}
          className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
          aria-label={t('Search places', 'البحث عن مكان', 'Rechercher des lieux')}
        />
        {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label={t('Clear search', 'مسح البحث', 'Effacer la recherche')} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-base font-black text-slate-900">{contextTitle}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={onOpenPassiveModal} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">{t('Location', 'الموقع', 'Localisation')}</button>
          <button type="button" onClick={onOpenAddModal} className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5" />{t('Add Place', 'إضافة مكان', 'Ajouter')}</button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          ['all', t('All', 'الكل', 'Tous')],
          ['tourist_poi', t('Sights', 'معالم', 'Sites')],
          ['restaurant', t('Food', 'مطاعم', 'Restaurants')],
          ['accommodation', t('Stays', 'إقامات', 'Hébergements')],
          ['emergency', t('Emergency', 'طوارئ', 'Urgences')],
        ].map(([id, label]) => <button key={id} type="button" onClick={() => setSelectedFilter(id as typeof selectedFilter)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold ${selectedFilter === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{label}</button>)}
      </div>

      {isLoading && <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-blue-600" />{t('Loading places…', 'جارٍ تحميل الأماكن…', 'Chargement…')}</div>}
      {loadError && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{t('Could not load places.', 'تعذر تحميل الأماكن.', 'Impossible de charger les lieux.')}</div>}

      {!isLoading && !loadError && !searchQuery.trim() && !userLocation && !tripDestination && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-7 text-center"><MapPin className="mx-auto mb-2 h-6 w-6 text-blue-600" /><p className="text-sm font-bold text-slate-700">{t('Share your location or search for a destination.', 'شارك موقعك أو ابحث عن وجهة.', 'Partagez votre localisation ou recherchez une destination.')}</p></div>
      )}

      {!isLoading && !loadError && (searchQuery.trim() || userLocation || tripDestination) && visiblePlaces.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">{t('No matching places found.', 'لم يتم العثور على أماكن مطابقة.', 'Aucun lieu correspondant.')}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {visiblePlaces.map((place) => {
          const isSaved = savedPlaceIds.includes(place.id);
          const rating = formatVerifiedRating(place.rating, place.reviewCount);
          const displayName = isAr && place.arabicName ? place.arabicName : isFr && place.frenchName ? place.frenchName : place.name;
          return (
            <article key={place.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-40 bg-slate-200">
                <button type="button" onClick={() => onSelectPlace(place)} className="absolute inset-0 block h-full w-full text-start" aria-label={`${t('Open details for', 'فتح تفاصيل', 'Ouvrir les détails de')} ${displayName}`}>
                  <PlaceVisual place={place} language={language} className="h-full w-full" imageClassName="h-full w-full object-cover" showFallbackLabel={false} />
                </button>
                <button type="button" onClick={() => onToggleSave(place.id)} className={`absolute end-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full ${isSaved ? 'bg-rose-500' : 'bg-black/45'} text-white`} aria-label={isSaved ? t('Remove saved place', 'إزالة من المحفوظات', 'Retirer des favoris') : t('Save place', 'حفظ المكان', 'Enregistrer')}><Heart className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} /></button>
              </div>
              <button type="button" onClick={() => onSelectPlace(place)} className="block w-full p-4 text-start">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-black text-slate-900">{displayName}</h2><p className="mt-1 truncate text-xs text-slate-500">{place.area} · {place.region}</p></div><span className="shrink-0 text-xs font-bold text-slate-600">{rating ? `★ ${rating}` : unratedShortLabel(language)}</span></div><div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span>{formatPriceLevel(place.priceLevel, currency)}</span>{typeof place.distanceKm === 'number' && <span>{place.distanceKm < 10 ? place.distanceKm.toFixed(1) : Math.round(place.distanceKm)} km</span>}</div>
              </button>
              <div className="border-t border-slate-100 p-3"><button type="button" onClick={() => onStartRoute(place)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white"><Navigation className="h-4 w-4" />{t('Directions', 'الاتجاهات', 'Itinéraire')}</button></div>
            </article>
          );
        })}
      </div>

      {hasOpenStreetMapData && <p className="text-center text-[10px] text-slate-400">© OpenStreetMap contributors</p>}
    </div>
  );
};
