import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Heart,
  MapPin,
  Navigation,
  Phone,
  Plus,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { Place } from '../types';
import { submitPlaceCheckIn } from '../services/api';
import { RatePlaceModal } from './RatePlaceModal';
import { PlaceVisual } from './PlaceVisual';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';
import { formatPriceLevel } from '../data/currency';
import { formatVerifiedRating, liveReviewsLabel, unratedLabel } from '../lib/placeRating';

interface PlaceDetailModalProps {
  place: Place | null;
  onClose: () => void;
  onStartNavigation: (place: Place) => void;
  onSaveToggle: (placeId: string) => void;
  isSaved?: boolean;
  onPlaceUpdated?: (place: Place) => void;
  language?: SupportedLanguage;
  currency?: string;
}

export const PlaceDetailModal: React.FC<PlaceDetailModalProps> = ({
  place,
  onClose,
  onStartNavigation,
  onSaveToggle,
  isSaved = false,
  onPlaceUpdated,
  language = 'en',
  currency = 'MAD',
}) => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const localize = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;

  useEffect(() => {
    setIsCheckedIn(false);
    setIsCheckingIn(false);
    setCheckInError(null);
    setIsRateModalOpen(false);
    setActivePhotoIdx(0);
  }, [place?.id]);

  if (!place) return null;

  const handleCheckIn = async () => {
    if (isCheckingIn || isCheckedIn) return;
    setIsCheckingIn(true);
    setCheckInError(null);
    try {
      const success = await submitPlaceCheckIn(place.id);
      if (success) setIsCheckedIn(true);
      else setCheckInError(localize('Check-in could not be confirmed.', 'تعذر تأكيد تسجيل الوصول.', 'Le check-in n’a pas pu être confirmé.'));
    } finally {
      setIsCheckingIn(false);
    }
  };

  const displayName = isAr && place.arabicName ? place.arabicName : isFr && place.frenchName ? place.frenchName : place.name;
  const verifiedRating = formatVerifiedRating(place.rating, place.reviewCount);
  const activePhoto = place.photos[activePhotoIdx] || place.photos[0] || '';
  const visualPlace = activePhoto ? { ...place, photos: [activePhoto] } : { ...place, photos: [] };

  // Prefer content actually translated into the current language. When only the
  // English/source text exists, show it plainly labeled instead of pretending it
  // was written in the viewer's language.
  const localizedText = (english: string | undefined, arabic: string | undefined, french: string | undefined): { text: string; isSourceLanguage: boolean } | null => {
    if (isAr && arabic) return { text: arabic, isSourceLanguage: false };
    if (isFr && french) return { text: french, isSourceLanguage: false };
    if (!english) return null;
    const isSourceLanguage = isAr || isFr; // showing English/base text while viewer reads Arabic or French
    return { text: english, isSourceLanguage };
  };
  const sourceLanguageNote = localize('Shown in the original language', 'معروض باللغة الأصلية للمصدر', 'Affiché dans la langue d’origine');
  const descriptionInfo = localizedText(place.description, place.descriptionAr, place.descriptionFr);
  const formationInfoText = localizedText(place.formationInfo, place.formationInfoAr, place.formationInfoFr);
  const subCategoryLabel = isAr && place.subCategoryAr ? place.subCategoryAr : isFr && place.subCategoryFr ? place.subCategoryFr : place.subCategory;
  const openingHoursLabel = isAr && place.openingHoursAr ? place.openingHoursAr : isFr && place.openingHoursFr ? place.openingHoursFr : place.openingHours;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-md sm:p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="relative h-64 w-full shrink-0 bg-slate-900 sm:h-72">
          <PlaceVisual place={visualPlace} language={language} className="h-full w-full" imageClassName="h-full w-full object-cover" eager showFallbackLabel={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/35" />

          <div className="absolute inset-x-4 top-4 z-10 flex items-center justify-between">
            <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
              {subCategoryLabel || place.category.replace('_', ' ')}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => onSaveToggle(place.id)} className={`rounded-full p-2.5 text-white backdrop-blur ${isSaved ? 'bg-rose-500' : 'bg-black/45 hover:bg-black/65'}`} aria-label={isSaved ? localize('Remove saved place', 'إزالة من المحفوظات', 'Retirer des favoris') : localize('Save place', 'حفظ المكان', 'Enregistrer')}>
                <Heart className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
              </button>
              <button type="button" onClick={onClose} className="rounded-full bg-black/45 p-2.5 text-white backdrop-blur hover:bg-black/65" aria-label={localize('Close', 'إغلاق', 'Fermer')}><X className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="absolute inset-x-4 bottom-4 z-10 text-white">
            <h1 className="text-xl font-black leading-tight sm:text-2xl">{displayName}</h1>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-200"><MapPin className="h-3.5 w-3.5 shrink-0 text-blue-300" /><span>{place.address}</span></p>
          </div>

          {place.photos.length > 1 && <div className="absolute bottom-2 end-4 z-20 flex gap-1">{place.photos.map((_, index) => <button key={index} type="button" onClick={() => setActivePhotoIdx(index)} aria-label={`${localize('Photo', 'صورة', 'Photo')} ${index + 1}`} className={`h-2 rounded-full ${activePhotoIdx === index ? 'w-4 bg-white' : 'w-2 bg-white/50'}`} />)}</div>}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm text-slate-700">
          <div className="flex items-center justify-around rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
            <div>
              {verifiedRating ? <><div className="flex items-center justify-center gap-1 font-black text-amber-500"><Star className="h-4 w-4 fill-current" />{verifiedRating}</div><span className="text-[10px] font-bold text-slate-500">{liveReviewsLabel(place.reviewCount, language)}</span></> : <span className="block max-w-28 text-[10px] font-bold text-slate-500">{unratedLabel(language)}</span>}
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div><div className="font-black text-slate-900">{formatPriceLevel(place.priceLevel, currency)}</div><span className="text-[10px] font-bold text-slate-500">{localize('Price', 'السعر', 'Prix')}</span></div>
            <div className="h-8 w-px bg-slate-200" />
            <div><div className="font-black text-blue-600">{typeof place.distanceKm === 'number' ? `${place.distanceKm < 10 ? place.distanceKm.toFixed(1) : Math.round(place.distanceKm)} km` : '—'}</div><span className="text-[10px] font-bold text-slate-500">{localize('Distance', 'المسافة', 'Distance')}</span></div>
          </div>

          {place.ownerVerified && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{localize('Verified business', 'نشاط تجاري موثق', 'Établissement vérifié')}</span>
            </div>
          )}

          {descriptionInfo && <div><h3 className="mb-1 text-xs font-bold text-slate-500">{localize('About', 'عن المكان', 'À propos')}</h3><p className="leading-relaxed">{descriptionInfo.text}</p>{descriptionInfo.isSourceLanguage && <p className="mt-1 text-[10px] font-bold text-slate-400">{sourceLanguageNote}</p>}</div>}
          {formationInfoText && <div><h3 className="mb-1 text-xs font-bold text-slate-500">{localize('History', 'التاريخ', 'Histoire')}</h3><p className="leading-relaxed">{formationInfoText.text}</p>{formationInfoText.isSourceLanguage && <p className="mt-1 text-[10px] font-bold text-slate-400">{sourceLanguageNote}</p>}</div>}

          {(openingHoursLabel || place.contactPhone) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {openingHoursLabel && <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5"><Clock className="h-4 w-4 shrink-0 text-slate-500" /><span className="truncate">{openingHoursLabel}</span></div>}
              {place.contactPhone && <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5"><Phone className="h-4 w-4 shrink-0 text-slate-500" /><a href={`tel:${place.contactPhone}`} className="truncate font-bold text-blue-600">{place.contactPhone}</a></div>}
            </div>
          )}

          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold text-slate-900">{localize('Reviews', 'التقييمات', 'Avis')}</h3>
              <button type="button" onClick={() => setIsRateModalOpen(true)} className="flex items-center gap-1 text-xs font-bold text-blue-600"><Plus className="h-3.5 w-3.5" />{localize('Write Review', 'أضف تقييمك', 'Ajouter un avis')}</button>
            </div>

            {place.reviews?.length ? (
              <div className="space-y-2.5">{place.reviews.map((review) => <div key={review.id} className="space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><strong className="text-xs text-slate-900">{review.authorName}</strong>{typeof review.rating === 'number' && <span className="flex items-center gap-1 text-xs font-bold text-amber-500"><Star className="h-3 w-3 fill-current" />{review.rating}</span>}</div><p className="text-xs leading-relaxed text-slate-600">{review.text}</p></div>)}</div>
            ) : (
              <p className="text-xs text-slate-500">{localize('No reviews yet.', 'لا توجد تقييمات بعد.', 'Aucun avis pour le moment.')}</p>
            )}
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-slate-200 bg-slate-50 p-4">
          {checkInError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">{checkInError}</div>}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void handleCheckIn()} disabled={isCheckedIn || isCheckingIn} className={`flex items-center justify-center gap-1.5 rounded-2xl border px-4 py-3 text-xs font-bold ${isCheckedIn ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700 disabled:opacity-60'}`}>
              <CheckCircle2 className="h-4 w-4" />{isCheckedIn ? t.checkedIn : isCheckingIn ? localize('Confirming…', 'جارٍ التأكيد…', 'Confirmation…') : t.checkIn}
            </button>
            <button id="modal-start-navigation-btn" type="button" onClick={() => onStartNavigation(place)} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-xs font-bold text-white shadow-md sm:text-sm"><Navigation className="h-4 w-4" />{t.startNavigation}</button>
          </div>
        </div>
      </div>

      <RatePlaceModal isOpen={isRateModalOpen} onClose={() => setIsRateModalOpen(false)} place={place} onReviewSuccess={(updated) => onPlaceUpdated?.(updated)} onUserEarnedXp={() => {}} language={language} />
    </div>
  );
};
