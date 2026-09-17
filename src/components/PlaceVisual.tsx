import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { Place } from '../types';
import type { SupportedLanguage } from '../data/translations';
import { categoryMeta, placeDisplayName } from '../lib/placeView';

interface PlaceVisualProps {
  place: Place;
  language?: SupportedLanguage;
  /** Frame classes — the caller owns the box, this component fills it. */
  className?: string;
  imageClassName?: string;
  eager?: boolean;
  /** Overlay text is normally painted by the card, so the fallback stays quiet. */
  showFallbackLabel?: boolean;
  /** Which entry of `place.photos` to paint (detail gallery). */
  photoIndex?: number;
}

/**
 * Single image treatment for places: lazy-loaded, fade-in, contour fallback when
 * no usable photo exists, and never a fabricated image.
 */
export const PlaceVisual: React.FC<PlaceVisualProps> = ({
  place,
  language = 'en',
  className = 'h-full w-full',
  imageClassName = 'object-cover',
  eager = false,
  showFallbackLabel = false,
  photoIndex = 0,
}) => {
  const photo = place.photos?.[photoIndex] || place.photos?.[0] || '';
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>(photo ? 'loading' : 'failed');
  const displayName = placeDisplayName(place, language);
  const CategoryIcon = categoryMeta(place.category).icon;

  useEffect(() => {
    setStatus(photo ? 'loading' : 'failed');
  }, [photo, place.id]);

  if (!photo || status === 'failed') {
    return (
      <div
        className={`sindbad-photo-fallback relative flex items-center justify-center overflow-hidden ${className}`}
        data-place-photo-fallback="true"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface/90 text-brand-accent shadow-xs">
          {photo ? <ImageOff className="h-4 w-4" aria-hidden="true" /> : <CategoryIcon className="h-4 w-4" aria-hidden="true" />}
        </span>
        {showFallbackLabel && (
          <span className="absolute inset-x-2 bottom-2 truncate text-center text-micro font-bold text-muted">
            {displayName}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-surface-sunken ${className}`}>
      {status === 'loading' && <span className="sindbad-photo-fallback absolute inset-0" aria-hidden="true" />}
      <img
        src={photo}
        alt={displayName}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : 'auto'}
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('failed')}
        className={`h-full w-full ${imageClassName} transition-opacity duration-300 ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};
