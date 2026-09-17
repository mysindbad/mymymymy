import React from 'react';
import { Navigation } from 'lucide-react';
import { PlaceVisual } from '../components/PlaceVisual';
import { SaveButton } from './SaveButton';
import { Button } from './Button';
import { PlaceRating } from './PlaceRating';
import { formatPriceLevel } from '../data/currency';
import { formatDistance, placeDisplayName, placeSubtitle, placeTypeLabel } from '../lib/placeView';
import type { Place } from '../types';
import { useLocale } from '../lib/i18n';

export type PlaceCardVariant = 'media' | 'row' | 'grid';

export interface PlaceCardProps {
  place: Place;
  language?: string;
  currency?: string;
  saved: boolean;
  onToggleSave: (placeId: string) => void;
  onSelect: (place: Place) => void;
  onRoute?: (place: Place) => void;
  variant?: PlaceCardVariant;
  eager?: boolean;
  className?: string;
}

/**
 * One place, one card contract: what it is, why it matters, where it is, and the
 * next action. Three presentations because a discovery rail and a search result
 * do not carry the same weight — the data and controls stay identical.
 */
export function PlaceCard({
  place,
  language = 'en',
  currency = 'MAD',
  saved,
  onToggleSave,
  onSelect,
  onRoute,
  variant = 'row',
  eager = false,
  className = '',
}: PlaceCardProps) {
  const locale = useLocale(language);
  const name = placeDisplayName(place, locale.language);
  const distance = formatDistance(place.distanceKm, locale.language);
  const openPlace = () => onSelect(place);
  const openLabel = locale.t(`Open ${name}`, `فتح ${name}`, `Ouvrir ${name}`);

  if (variant === 'media') {
    return (
      <article
        data-surface="card"
        className={`relative isolate h-56 w-40 shrink-0 overflow-hidden rounded-3xl border border-line bg-surface shadow-xs sm:w-44 ${className}`}
      >
        <button
          type="button"
          onClick={openPlace}
          aria-label={openLabel}
          className="absolute inset-0 z-0 block h-full w-full text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <PlaceVisual place={place} language={locale.language} eager={eager} className="h-full w-full" imageClassName="object-cover object-center" />
          <span className="sindbad-photo-scrim absolute inset-x-0 bottom-0 h-2/3" aria-hidden="true" />
          <span className="absolute inset-x-3 bottom-3 block text-white">
            <span className="block text-label font-semibold uppercase tracking-wide text-white/70">{placeTypeLabel(place, locale.language)}</span>
            <span className="mt-0.5 block text-body leading-tight font-bold [text-wrap:balance]">{name}</span>
            <span className="mt-1 flex items-center gap-1.5 text-micro text-white/85">
              <PlaceRating place={place} language={locale.language} tone="onPhoto" />
              {distance && <span className="tabular-nums">{distance}</span>}
            </span>
          </span>
        </button>
        <SaveButton
          saved={saved}
          onToggle={() => onToggleSave(place.id)}
          placeName={name}
          language={locale.language}
          size="sm"
          className="absolute end-2 top-2 z-10"
        />
      </article>
    );
  }

  if (variant === 'grid') {
    return (
      <article
        data-surface="card"
        className={`group relative isolate flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs transition-shadow duration-200 hover:shadow-md ${className}`}
      >
        <button
          type="button"
          onClick={openPlace}
          aria-label={openLabel}
          className="relative block h-36 w-full overflow-hidden bg-surface-sunken text-start"
        >
          <PlaceVisual place={place} language={locale.language} eager={eager} className="h-full w-full" imageClassName="object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]" />
          <span className="absolute inset-x-2.5 top-2.5 flex items-start">
            <span className="rounded-full bg-scrim/55 px-2 py-0.5 text-micro font-bold text-white backdrop-blur-sm">
              {placeTypeLabel(place, locale.language)}
            </span>
          </span>
        </button>
        <SaveButton
          saved={saved}
          onToggle={() => onToggleSave(place.id)}
          placeName={name}
          language={locale.language}
          size="sm"
          className="absolute end-2.5 top-2.5"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3.5">
          <button type="button" onClick={openPlace} className="min-w-0 text-start pointer-coarse:flex pointer-coarse:min-h-[44px] pointer-coarse:flex-col pointer-coarse:justify-center">
            <h3 className="line-clamp-2 text-body font-bold leading-snug text-ink">{name}</h3>
            <p className="mt-1 truncate text-micro text-muted">{placeSubtitle(place)}</p>
          </button>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-micro text-muted">
            <PlaceRating place={place} language={locale.language} />
            {distance && <span className="tabular-nums">{distance}</span>}
            {place.priceLevel && <span className="tabular-nums">{formatPriceLevel(place.priceLevel, currency)}</span>}
          </div>
          {onRoute && (
            <Button size="sm" variant="secondary" className="mt-auto w-full" onClick={() => onRoute(place)} icon={<Navigation className="h-3.5 w-3.5" />}>
              {locale.t('Directions', 'الاتجاهات', 'Itinéraire')}
            </Button>
          )}
        </div>
      </article>
    );
  }

  return (
    <article
      data-surface="card"
      className={`relative flex items-stretch gap-3 rounded-xl border border-line bg-surface p-2.5 shadow-xs transition-colors duration-150 hover:border-line-strong ${className}`}
    >
      <button
        type="button"
        onClick={openPlace}
        aria-label={openLabel}
        className="flex min-w-0 flex-1 items-start gap-3 text-start"
      >
        <PlaceVisual
          place={place}
          language={locale.language}
          eager={eager}
          className="h-20 w-20 shrink-0 overflow-hidden rounded-lg sm:h-[86px] sm:w-[86px]"
          imageClassName="object-cover object-center"
        />
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="block truncate text-body font-bold text-ink">{name}</span>
          <span className="mt-0.5 block truncate text-micro text-muted">
            {placeTypeLabel(place, locale.language)} · {placeSubtitle(place)}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-micro text-muted">
            <PlaceRating place={place} language={locale.language} />
            {distance && <span className="tabular-nums">{distance}</span>}
            {place.priceLevel && <span className="tabular-nums">{formatPriceLevel(place.priceLevel, currency)}</span>}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 flex-col items-end justify-between gap-1 py-0.5">
        <SaveButton
          saved={saved}
          onToggle={() => onToggleSave(place.id)}
          placeName={name}
          language={locale.language}
          variant="inline"
          size="sm"
        />
        {onRoute && (
          <Button size="sm" variant="ghost" className="px-2 text-micro" onClick={() => onRoute(place)} icon={<Navigation className="h-3.5 w-3.5" />}>
            {locale.t('Route', 'المسار', 'Itinéraire')}
          </Button>
        )}
      </div>
    </article>
  );
}
