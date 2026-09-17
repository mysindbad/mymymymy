import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation } from 'lucide-react';
import { Place } from '../types';
import { SupportedLanguage } from '../data/translations';
import type { UserLocation } from '../hooks/useGeolocation';
import { useLocale } from '../lib/i18n';
import { placeDisplayName, placeSubtitle, categoryLabel } from '../lib/placeView';
import { PlaceVisual } from './PlaceVisual';
import { Button, IconButton } from '../ui/Button';
import { FilterChip } from '../ui/Chip';
import { EmptyState } from '../ui/Feedback';

interface ContextMapViewProps {
  places: Place[];
  onSelectPlace: (place: Place) => void;
  onStartRoute: (place: Place) => void;
  language?: SupportedLanguage;
  initialQuery?: string;
  initialCategory?: string;
  userLocation?: UserLocation | null;
  isLoading?: boolean;
}

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const CARTO_LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const CARTO_DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

function tileAttribution(provider: 'osm' | 'carto') {
  return provider === 'carto'
    ? '&copy; OpenStreetMap contributors &copy; CARTO'
    : '&copy; OpenStreetMap contributors';
}

export const ContextMapView: React.FC<ContextMapViewProps> = ({
  places,
  onSelectPlace,
  onStartRoute,
  language = 'en',
  initialQuery = '',
  initialCategory = 'All',
  userLocation = null,
  isLoading = false,
}) => {
  const locale = useLocale(language);
  const t = locale.t;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const tileThemeRef = useRef<'light' | 'dark' | null>(null);
  const tileGenerationRef = useRef(0);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory || 'All');
  const [activePlace, setActivePlace] = useState<Place | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
    setCategory(initialCategory || 'All');
  }, [initialQuery, initialCategory]);

  const visiblePlaces = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return places.filter((place) => {
      if (category !== 'All' && place.category !== category) return false;
      if (!term) return true;
      return [place.name, place.arabicName, place.frenchName, place.area, place.region]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(term));
    });
  }, [places, query, category]);

  const installTileLayer = (map: L.Map, theme: 'light' | 'dark', fallback = false) => {
    tileGenerationRef.current += 1;
    const generation = tileGenerationRef.current;
    tileLayerRef.current?.remove();

    const useCarto = theme === 'dark' ? !fallback : fallback;
    const url = useCarto ? (theme === 'dark' ? CARTO_DARK_TILES : CARTO_LIGHT_TILES) : OSM_TILES;
    let errorCount = 0;
    const layer = L.tileLayer(url, {
      attribution: tileAttribution(useCarto ? 'carto' : 'osm'),
      maxZoom: 19,
      crossOrigin: true,
      keepBuffer: 4,
      updateWhenIdle: false,
      className: theme === 'dark' && fallback ? 'sindbad-dark-osm-tile' : 'sindbad-map-tile',
    });
    layer.on('tileerror', () => {
      errorCount += 1;
      if (generation !== tileGenerationRef.current || fallback || errorCount < 3) return;
      installTileLayer(map, theme, true);
    });
    layer.addTo(map);
    tileLayerRef.current = layer;
    tileThemeRef.current = theme;
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [31.7917, -7.0926],
      zoom: 6,
      zoomControl: false,
    });
    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    installTileLayer(map, theme);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const timer = window.setTimeout(() => map.invalidateSize(), 150);

    const observer = new MutationObserver(() => {
      const nextTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      if (nextTheme !== tileThemeRef.current) installTileLayer(map, nextTheme);
      window.setTimeout(() => map.invalidateSize(), 50);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      tileGenerationRef.current += 1;
      tileLayerRef.current = null;
      markerLayerRef.current = null;
      userMarkerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!userLocation) return;
    const marker = L.circleMarker([userLocation.latitude, userLocation.longitude], {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: '#1d47cf',
      fillOpacity: 1,
    }).addTo(map);
    marker.bindTooltip(t('Your location', 'موقعك', 'Votre position'));
    userMarkerRef.current = marker;
    map.flyTo([userLocation.latitude, userLocation.longitude], 12, { duration: 0.8 });
  }, [userLocation?.latitude, userLocation?.longitude, language]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    visiblePlaces.forEach((place) => {
      bounds.push(place.coordinates);
      const isActive = activePlace?.id === place.id;
      const marker = L.circleMarker(place.coordinates, {
        radius: isActive ? 9 : 7,
        color: '#ffffff',
        weight: 2,
        fillColor: isActive ? '#1d47cf' : '#3462e8',
        fillOpacity: 0.96,
      }).addTo(layer);
      const label = document.createElement('span');
      label.textContent = placeDisplayName(place, locale.language);
      marker.bindTooltip(label, {
        permanent: visiblePlaces.length <= 20,
        direction: 'top',
        offset: [0, -8],
        opacity: 0.92,
        className: 'sindbad-place-tooltip',
      });
      marker.on('click', () => {
        setActivePlace(place);
        marker.openTooltip();
        map.flyTo(place.coordinates, Math.max(map.getZoom(), 14), { duration: 0.45 });
      });
    });
    if (!userLocation && bounds.length > 0) {
      if (bounds.length === 1) map.flyTo(bounds[0], 13, { duration: 0.6 });
      else map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13 });
    }
    if (activePlace && !visiblePlaces.some((place) => place.id === activePlace.id)) setActivePlace(null);
    window.setTimeout(() => map.invalidateSize(), 50);
  }, [visiblePlaces, userLocation?.latitude, userLocation?.longitude, activePlace?.id, language]);

  const categories = useMemo(() => Array.from(new Set(places.map((place) => place.category))), [places]);

  return (
    <div
      className="relative h-[calc(100dvh-var(--sindbad-chrome-h)-var(--sindbad-header-h))] w-full overflow-hidden bg-surface-sunken"
      dir="ltr"
    >
      <div ref={mapContainerRef} className="h-full w-full" data-map-tile-fallback="enabled" />

      {(isLoading || (places.length === 0 && !activePlace)) && (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-[500] flex justify-center px-3">
          {isLoading ? (
            <p className="sindbad-safe-top pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-surface/95 px-3 py-2 text-caption font-semibold text-muted shadow-md backdrop-blur">
              <span className="sindbad-skeleton h-3.5 w-3.5 rounded-full" aria-hidden="true" />
              {t('Loading places on the map…', 'جارٍ تحميل الأماكن على الخريطة…', 'Chargement des lieux sur la carte…')}
            </p>
          ) : (
            <div className="pointer-events-auto w-full max-w-sm">
              <EmptyState
                tone="dashed"
                icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
                title={t('Nothing to plot yet', 'لا توجد أماكن لعرضها', 'Rien à afficher pour le moment')}
                titleAs="h2"
                description={t(
                  'Share your location or search for a destination first.',
                  'شارك موقعك أو ابحث عن وجهة أولاً.',
                  'Partagez votre position ou recherchez d’abord une destination.',
                )}
              />
            </div>
          )}
        </div>
      )}

      <div className="absolute inset-x-3 top-3 z-[500] mx-auto max-w-xl space-y-2">
        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface/95 p-1.5 shadow-md backdrop-blur">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Filter on the map', 'تصفية على الخريطة', 'Filtrer sur la carte')}
            aria-label={t('Filter places on map', 'تصفية الأماكن على الخريطة', 'Filtrer les lieux sur la carte')}
            className="h-9 min-w-0 flex-1 bg-transparent px-2 text-body font-medium text-ink outline-none placeholder:text-muted pointer-coarse:min-h-[44px]"
          />
        </div>
        {categories.length > 0 && (
          <div className="sindbad-scroll-x">
            <FilterChip selected={category === 'All'} onClick={() => setCategory('All')}>
              {t('All', 'الكل', 'Tous')}
            </FilterChip>
            {categories.map((value) => (
              <FilterChip key={value} selected={category === value} onClick={() => setCategory(value)}>
                {categoryLabel(value, locale.language)}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {activePlace && (
        <div className="absolute inset-x-3 bottom-3 z-[500] mx-auto max-w-md">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5 shadow-lg">
            <button
              type="button"
              onClick={() => onSelectPlace(activePlace)}
              className="flex min-w-0 flex-1 items-center gap-3 text-start"
              aria-label={t(`Open ${placeDisplayName(activePlace, locale.language)}`, `فتح ${placeDisplayName(activePlace, locale.language)}`, `Ouvrir ${placeDisplayName(activePlace, locale.language)}`)}
            >
              <PlaceVisual
                place={activePlace}
                language={locale.language}
                className="h-14 w-14 shrink-0 overflow-hidden rounded-lg"
                imageClassName="object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-bold text-ink">{placeDisplayName(activePlace, locale.language)}</span>
                <span className="block truncate text-micro text-muted">{placeSubtitle(activePlace) || categoryLabel(activePlace.category, locale.language)}</span>
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-1.5">
              <IconButton label={t('Close preview', 'إغلاق المعاينة', 'Fermer l’aperçu')} size="sm" variant="ghost" onClick={() => setActivePlace(null)}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </IconButton>
              <Button size="sm" onClick={() => onStartRoute(activePlace)} icon={<Navigation className="h-3.5 w-3.5" />}>
                {t('Go', 'اذهب', 'Aller')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
