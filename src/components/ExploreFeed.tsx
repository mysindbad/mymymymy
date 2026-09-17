import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map, MapPin, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { Place } from '../types';
import { fetchPlaces } from '../services/api';
import { SupportedLanguage } from '../data/translations';
import type { UserLocation } from '../hooks/useGeolocation';
import { filterNearbyPlaces, filterPlacesForTrip } from '../lib/placeContext';
import { useLocale } from '../lib/i18n';
import { Button } from '../ui/Button';
import { FilterChip } from '../ui/Chip';
import { EmptyState, ErrorState, NoResultsIcon, SkeletonList } from '../ui/Feedback';
import { PlaceCard } from '../ui/PlaceCard';
import { SectionHeading } from '../ui/Panel';

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
  onSwitchToMap?: () => void;
  /** Places the shell already holds (trip or nearby context) — avoids a second request. */
  globalPlaces?: Place[];
}

type CategoryFilter = 'all' | 'accommodation' | 'tourist_poi' | 'restaurant' | 'emergency';

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
  onSwitchToMap,
  globalPlaces = [],
}) => {
  const locale = useLocale(language);
  const t = locale.t;
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => setSearchQuery(initialQuery), [initialQuery]);

  const runSearch = useCallback(async () => {
    const query = searchQuery.trim();
    const sequence = ++requestSequence.current;

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
        const allPlaces = globalPlaces.length ? globalPlaces : await fetchPlaces();
        nextPlaces = filterPlacesForTrip(allPlaces, tripDestination, userLocation);
      } else if (userLocation) {
        const allPlaces = globalPlaces.length ? globalPlaces : await fetchPlaces({ userLat: userLocation.latitude, userLng: userLocation.longitude });
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
      setLoadError(error instanceof Error ? error.message : t('Could not load places.', 'تعذر تحميل الأماكن.', 'Impossible de charger les lieux.'));
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false);
    }
  }, [searchQuery, userLocation, tripDestination, globalPlaces, onPlacesLoaded, reloadToken, t]);

  useEffect(() => {
    const query = searchQuery.trim();
    const timer = window.setTimeout(() => { void runSearch(); }, query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [runSearch, searchQuery]);

  const visiblePlaces = useMemo(() => places.filter((place) => {
    if (selectedFilter === 'all') return true;
    return place.category === selectedFilter;
  }), [places, selectedFilter]);

  const hasOpenStreetMapData = places.some((place) => place.dataSource === 'openstreetmap');
  const isSearching = Boolean(searchQuery.trim());
  const contextTitle = isSearching
    ? t('Search results', 'نتائج البحث', 'Résultats de recherche')
    : tripDestination
      ? t(`Places for ${tripDestination.name}`, `أماكن لرحلة ${tripDestination.arabicName || tripDestination.name}`, `Lieux pour ${tripDestination.frenchName || tripDestination.name}`)
      : t('Nearby places', 'أماكن قريبة', 'Lieux proches');
  const countLabel = visiblePlaces.length === 0
    ? ''
    : t(`${visiblePlaces.length} places`, `${visiblePlaces.length} أماكن`, `${visiblePlaces.length} lieux`);

  const filters: Array<[CategoryFilter, string]> = [
    ['all', t('All', 'الكل', 'Tous')],
    ['tourist_poi', t('Sights', 'معالم', 'Sites')],
    ['restaurant', t('Food', 'مطاعم', 'Restaurants')],
    ['accommodation', t('Stays', 'إقامات', 'Hébergements')],
    ['emergency', t('Emergency', 'طوارئ', 'Urgences')],
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-6 pt-4 sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="w-full lg:max-w-md">
          <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 transition-colors focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-soft">
            <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('Search a city or place', 'ابحث عن مدينة أو مكان', 'Rechercher une ville ou un lieu')}
              aria-label={t('Search places', 'البحث عن أماكن', 'Rechercher des lieux')}
              className="h-11 w-full min-w-0 bg-transparent text-body font-medium text-ink outline-none placeholder:text-muted"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={t('Clear search', 'مسح البحث', 'Effacer la recherche')}
                className="rounded-md p-1 text-muted transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onOpenPassiveModal} icon={<MapPin className="h-3.5 w-3.5" />}>
            {t('Location', 'الموقع', 'Localisation')}
          </Button>
          <Button size="sm" onClick={onOpenAddModal} icon={<Plus className="h-3.5 w-3.5" />}>
            {t('Add Place', 'إضافة مكان', 'Ajouter un lieu')}
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-b border-line pb-3">
        <SlidersHorizontal className="me-1 hidden h-4 w-4 shrink-0 text-muted sm:block" aria-hidden="true" />
        <div className="sindbad-scroll-x -mx-3 flex-1 px-3 sm:mx-0 sm:px-0">
          {filters.map(([id, label]) => (
            <FilterChip key={id} selected={selectedFilter === id} onClick={() => setSelectedFilter(id)} count={id === 'all' ? places.length : undefined}>
              {label}
            </FilterChip>
          ))}
        </div>
      </div>

      {(countLabel || isSearching) && (
        <SectionHeading
          size="sm"
          title={contextTitle}
          description={isLoading ? t('Searching…', 'جارٍ البحث…', 'Recherche…') : countLabel}
          className="mt-4"
        />
      )}

      {loadError && (
        <div className="mt-3">
          <ErrorState
            title={t('Places could not be loaded.', 'تعذر تحميل الأماكن.', 'Impossible de charger les lieux.')}
            description={loadError}
            retryLabel={t('Try again', 'إعادة المحاولة', 'Réessayer')}
            onRetry={() => setReloadToken((token) => token + 1)}
          />
        </div>
      )}

      {isLoading && !loadError && <SkeletonList rows={4} className="mt-3" />}

      {!isLoading && !loadError && !isSearching && !userLocation && !tripDestination && (
        <EmptyState
          className="mt-4"
          icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
          title={t('Start where you are', 'ابدأ من حيث أنت', 'Commencez là où vous êtes')}
          description={t(
            'Share your location or search for a destination.',
            'شارك موقعك أو ابحث عن وجهة.',
            'Partagez votre position ou recherchez une destination.',
          )}
          action={
            <>
              <Button size="sm" onClick={onOpenPassiveModal}>
                {t('Use my location', 'استخدم موقعي', 'Utiliser ma position')}
              </Button>
              {onSwitchToMap && (
                <Button size="sm" variant="secondary" onClick={onSwitchToMap} icon={<Map className="h-3.5 w-3.5" />}>
                  {t('Open map', 'فتح الخريطة', 'Ouvrir la carte')}
                </Button>
              )}
            </>
          }
        />
      )}

      {!isLoading && !loadError && (isSearching || userLocation || tripDestination) && visiblePlaces.length === 0 && (
        <EmptyState
          className="mt-3"
          icon={<NoResultsIcon />}
          title={t('No places match this search', 'لا توجد أماكن مطابقة لهذا البحث', 'Aucun lieu ne correspond à cette recherche')}
          description={places.length > 0 && selectedFilter !== 'all'
            ? t(`${places.length} places were found, none in this category.`, `تم العثور على ${places.length} أماكن، ولا شيء في هذه الفئة.`, `${places.length} lieux trouvés, aucun dans cette catégorie.`)
            : t('Try a nearby city or a shorter name.', 'جرّب اسماً أقصر أو مدينة قريبة.', 'Essayez un nom plus court ou une ville proche.')}
          action={
            <>
              {places.length > 0 && selectedFilter !== 'all' && (
                <Button size="sm" onClick={() => setSelectedFilter('all')}>
                  {t('Clear filter', 'إلغاء التصفية', 'Retirer le filtre')}
                </Button>
              )}
              {isSearching && (
                <Button size="sm" variant="secondary" onClick={() => setSearchQuery('')}>
                  {t('Clear search', 'مسح البحث', 'Effacer la recherche')}
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={onOpenAddModal}>
                {t('Add this place', 'أضف هذا المكان', 'Ajouter ce lieu')}
              </Button>
            </>
          }
        />
      )}

      {!isLoading && visiblePlaces.length > 0 && (
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
          {visiblePlaces.map((place, index) => (
            <li key={place.id}>
              <PlaceCard
                place={place}
                variant="grid"
                language={locale.language}
                currency={currency}
                saved={savedPlaceIds.includes(place.id)}
                onToggleSave={onToggleSave}
                onSelect={onSelectPlace}
                onRoute={onStartRoute}
                eager={index < 3}
                className="h-full"
              />
            </li>
          ))}
        </ul>
      )}

      {hasOpenStreetMapData && (
        <p className="mt-4 text-center text-micro text-muted">© OpenStreetMap contributors</p>
      )}
    </div>
  );
};
