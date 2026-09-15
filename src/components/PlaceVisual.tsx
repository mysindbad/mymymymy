import React, { useEffect, useState } from 'react';
import { ImageOff, MapPin } from 'lucide-react';
import type { Place } from '../types';
import type { SupportedLanguage } from '../data/translations';

interface PlaceVisualProps {
  place: Place;
  language?: SupportedLanguage;
  className?: string;
  imageClassName?: string;
  eager?: boolean;
  showFallbackLabel?: boolean;
}

export const PlaceVisual: React.FC<PlaceVisualProps> = ({
  place,
  language = 'en',
  className = 'h-full w-full',
  imageClassName = 'h-full w-full object-cover',
  eager = false,
  showFallbackLabel = true,
}) => {
  const [failed, setFailed] = useState(false);
  const photo = place.photos?.[0] || '';
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const displayName = isAr && place.arabicName
    ? place.arabicName
    : isFr && place.frenchName
      ? place.frenchName
      : place.name;

  useEffect(() => setFailed(false), [place.id, photo]);

  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt={displayName}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : 'auto'}
        onError={() => setFailed(true)}
        className={`${className} ${imageClassName}`}
      />
    );
  }

  return (
    <div className={`${className} flex items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-blue-100 p-4 text-center dark:from-slate-800 dark:via-slate-900 dark:to-blue-950`} data-place-photo-fallback="true">
      <div className="max-w-full text-slate-600 dark:text-slate-300">
        <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 shadow-sm dark:bg-slate-800/80">
          {photo ? <ImageOff className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
        </span>
        {showFallbackLabel && <><strong className="block truncate text-xs">{displayName}</strong><span className="mt-1 block truncate text-[10px] opacity-75">{place.subCategory || place.category.replace('_', ' ')}</span></>}
      </div>
    </div>
  );
};
