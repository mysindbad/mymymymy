import React from 'react';
import { Star } from 'lucide-react';
import { formatVerifiedRating, liveReviewsLabel, unratedShortLabel } from '../lib/placeRating';
import type { Place } from '../types';

/**
 * Ratings are only painted when a real, review-backed value exists.
 * An unrated place says so plainly instead of showing empty stars.
 */
export function PlaceRating({
  place,
  language = 'en',
  tone = 'ink',
  showCount = true,
  className = '',
}: {
  place: Place;
  language?: string;
  tone?: 'ink' | 'muted' | 'onPhoto';
  showCount?: boolean;
  className?: string;
}) {
  const rating = formatVerifiedRating(place.rating, place.reviewCount);

  if (!rating) {
    return (
      <span className={`text-micro font-semibold ${tone === 'onPhoto' ? 'text-white/75' : 'text-muted'} ${className}`}>
        {unratedShortLabel(language)}
      </span>
    );
  }

  const toneClass = tone === 'onPhoto' ? 'text-sand-300' : tone === 'muted' ? 'text-muted' : 'text-ink';

  return (
    <span className={`inline-flex items-center gap-1 ${toneClass} ${className}`}>
      <Star className="h-3 w-3 shrink-0 fill-current text-sand-400" aria-hidden="true" />
      <span className="text-micro font-bold tabular-nums">{rating}</span>
      {showCount && place.reviewCount > 0 && (
        <span className={`text-micro font-medium ${tone === 'onPhoto' ? 'text-white/70' : 'text-muted'}`}>
          ({liveReviewsLabel(place.reviewCount, language)})
        </span>
      )}
    </span>
  );
}
