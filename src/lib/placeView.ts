import { Bed, Landmark, PhoneCall, Tent, UtensilsCrossed, Wrench, type LucideIcon } from 'lucide-react';
import { Place, PlaceCategory } from '../types';

/**
 * Shared display rules for place content so every surface (home rail, explore
 * list, map preview, detail sheet) names, labels and orders the same data the
 * same way. Presentation-only: no fetching, no business rules.
 */

export function placeDisplayName(place: Place, language?: string): string {
  if (language === 'ar' && place.arabicName) return place.arabicName;
  if (language === 'fr' && place.frenchName) return place.frenchName;
  return place.name;
}

export function placeSubtitle(place: Place): string {
  return [place.area, place.region].filter(Boolean).join(' · ');
}

const CATEGORY_META: Record<PlaceCategory, { icon: LucideIcon; en: string; ar: string; fr: string }> = {
  accommodation: { icon: Bed, en: 'Stay', ar: 'إقامة', fr: 'Hébergement' },
  tourist_poi: { icon: Landmark, en: 'Sight', ar: 'معلم', fr: 'Site' },
  restaurant: { icon: UtensilsCrossed, en: 'Food', ar: 'مطعم', fr: 'Restaurant' },
  emergency: { icon: PhoneCall, en: 'Emergency', ar: 'طوارئ', fr: 'Urgence' },
  campsite: { icon: Tent, en: 'Campsite', ar: 'مخيم', fr: 'Camping' },
  service: { icon: Wrench, en: 'Service', ar: 'خدمة', fr: 'Service' },
};

export function categoryMeta(category: PlaceCategory | string) {
  return CATEGORY_META[category as PlaceCategory] ?? { icon: Landmark, en: category, ar: category, fr: category };
}

export function categoryLabel(category: PlaceCategory | string, language?: string): string {
  const meta = categoryMeta(category as PlaceCategory);
  return language === 'ar' ? meta.ar : language === 'fr' ? meta.fr : meta.en;
}

export function placeTypeLabel(place: Place, language?: string): string {
  const localised = language === 'ar' ? place.subCategoryAr : language === 'fr' ? place.subCategoryFr : undefined;
  const value = (localised || place.subCategory || '').trim();
  if (!value) return categoryLabel(place.category, language);
  return language === 'ar' || language === 'fr' ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

/** Honest distance: nothing is invented when the coordinate context is missing. */
export function formatDistance(distanceKm: number | undefined, language?: string): string | null {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return null;
  const digits = new Intl.NumberFormat(language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-FR' : 'en-GB', {
    maximumFractionDigits: distanceKm < 10 ? 1 : 0,
    minimumFractionDigits: distanceKm < 10 ? 1 : 0,
  }).format(distanceKm);
  const unit = language === 'ar' ? 'كم' : language === 'fr' ? 'km' : 'km';
  return `${digits} ${unit}`;
}

export function isExternalPlace(place: Place): boolean {
  return place.dataSource === 'openstreetmap' || place.source === 'external' || place.id.startsWith('osm-');
}

/** Trust wording stays factual: seed entries are labelled as catalog data. */
export function sourceLabel(place: Place, language?: string): string | null {
  if (place.ownerVerified) {
    return language === 'ar' ? 'نشاط موثّق' : language === 'fr' ? 'Établissement vérifié' : 'Verified business';
  }
  if (isExternalPlace(place)) {
    return language === 'ar' ? 'من خريطة OpenStreetMap' : language === 'fr' ? 'Donnée OpenStreetMap' : 'OpenStreetMap data';
  }
  if (place.source === 'community_traveler') {
    return language === 'ar' ? 'أضافه مسافر' : language === 'fr' ? 'Ajouté par un voyageur' : 'Added by a traveler';
  }
  if (place.source === 'business_owner') {
    return language === 'ar' ? 'أضافه صاحب النشاط' : language === 'fr' ? 'Ajouté par le propriétaire' : 'Added by the owner';
  }
  return null;
}

/**
 * Content that is only available in the source language must not pretend to be
 * translated: callers show the label next to the text instead of hiding it.
 */
export function localizedText(
  language: string | undefined,
  base: string | undefined,
  arabic: string | undefined,
  french: string | undefined,
): { text: string; isSourceLanguage: boolean } | null {
  if (language === 'ar' && arabic) return { text: arabic, isSourceLanguage: false };
  if (language === 'fr' && french) return { text: french, isSourceLanguage: false };
  if (!base) return null;
  return { text: base, isSourceLanguage: language === 'ar' || language === 'fr' };
}
