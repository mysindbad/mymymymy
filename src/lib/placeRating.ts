export function hasVerifiedRating(rating: number | null | undefined, reviewCount: number): rating is number {
  return typeof rating === 'number' && Number.isFinite(rating) && reviewCount > 0;
}

export function formatVerifiedRating(rating: number | null | undefined, reviewCount: number): string | null {
  return hasVerifiedRating(rating, reviewCount) ? rating.toFixed(1) : null;
}

export function unratedLabel(language: string): string {
  if (language === 'ar') return 'لا يوجد تقييم موثوق بعد';
  if (language === 'fr') return 'Aucune note vérifiée';
  return 'No verified rating';
}

export function unratedShortLabel(language: string): string {
  if (language === 'ar') return 'غير مُقيّم';
  if (language === 'fr') return 'Non noté';
  return 'Unrated';
}

export function liveReviewsLabel(reviewCount: number, language: string): string {
  if (language === 'ar') return `${reviewCount} تقييم حي`;
  if (language === 'fr') return `${reviewCount} avis actifs`;
  return `${reviewCount} live reviews`;
}
