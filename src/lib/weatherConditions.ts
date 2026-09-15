import type { SupportedLanguage } from '../data/translations';

// WMO weather interpretation codes, resolved into copy for every language the
// app actually offers. This lives in `lib` (not inside the modal) so it can be
// unit tested without pulling the Supabase-backed component graph into Node.
export function weatherCodeToLabel(code: number, language: SupportedLanguage = 'en'): string {
  const pick = (en: string, ar: string, fr: string) => (language === 'ar' ? ar : language === 'fr' ? fr : en);

  if (code === 0) return pick('Clear sky', 'سماء صافية', 'Ciel dégagé');
  if ([1, 2, 3].includes(code)) return pick('Partly cloudy', 'غائم جزئياً', 'Partiellement nuageux');
  if ([45, 48].includes(code)) return pick('Fog', 'ضباب', 'Brouillard');
  if ([51, 52, 53, 54, 55, 56, 57].includes(code)) return pick('Drizzle', 'رذاذ', 'Bruine');
  if ([61, 62, 63, 64, 65, 66, 67].includes(code)) return pick('Rain', 'أمطار', 'Pluie');
  if ([71, 72, 73, 74, 75, 76, 77, 85, 86].includes(code)) return pick('Snow', 'ثلوج', 'Neige');
  if ([80, 81, 82].includes(code)) return pick('Rain showers', 'زخات مطرية', 'Averses');
  if ([95, 96, 99].includes(code)) return pick('Thunderstorm', 'عواصف رعدية', 'Orage');
  return pick('Unknown', 'غير معروف', 'Inconnu');
}

// The fallback list is used only when the traveler has shared no location and
// has no active trip destination. Each entry carries its own localized label so
// an Arabic or French interface never shows English-only city names.
export const FALLBACK_WEATHER_PLACES: Array<{
  id: string;
  labels: Record<SupportedLanguage, string>;
  coordinates: [number, number];
}> = [
  { id: 'chefchaouen', labels: { en: 'Chefchaouen, Morocco', ar: 'شفشاون، المغرب', fr: 'Chefchaouen, Maroc' }, coordinates: [35.1695, -5.2625] },
  { id: 'akchour', labels: { en: 'Akchour Cascades, Morocco', ar: 'شلالات أقشور، المغرب', fr: 'Cascades d’Akchour, Maroc' }, coordinates: [35.2415, -5.1742] },
  { id: 'marrakech', labels: { en: 'Marrakech, Morocco', ar: 'مراكش، المغرب', fr: 'Marrakech, Maroc' }, coordinates: [31.625, -7.99] },
  { id: 'casablanca', labels: { en: 'Casablanca, Morocco', ar: 'الدار البيضاء، المغرب', fr: 'Casablanca, Maroc' }, coordinates: [33.5731, -7.5898] },
  { id: 'fes', labels: { en: 'Fes, Morocco', ar: 'فاس، المغرب', fr: 'Fès, Maroc' }, coordinates: [34.0331, -5.0003] },
  { id: 'tangier', labels: { en: 'Tangier, Morocco', ar: 'طنجة، المغرب', fr: 'Tanger, Maroc' }, coordinates: [35.7595, -5.834] },
];

export function localizedFallbackLabel(
  place: { labels: Record<SupportedLanguage, string> },
  language: SupportedLanguage,
): string {
  return place.labels[language] || place.labels.en;
}
