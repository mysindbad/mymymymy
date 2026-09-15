import React, { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles, Star, X } from 'lucide-react';
import { Place } from '../types';
import { createPlace, submitPlaceReview } from '../services/api';
import { SupportedLanguage } from '../data/translations';
import { useAuthSession } from '../lib/authSession';

interface RatePlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  place: Place | null;
  onReviewSuccess: (updatedPlace: Place) => void;
  onUserEarnedXp: (xp: number) => void;
  language?: SupportedLanguage;
}

const tagOptions = [
  { value: 'Scenery', en: 'Scenery', ar: 'المناظر', fr: 'Paysages' },
  { value: 'Hidden Gem', en: 'Hidden Gem', ar: 'مكان مميز', fr: 'Pépite' },
  { value: 'Cleanliness', en: 'Cleanliness', ar: 'النظافة', fr: 'Propreté' },
  { value: 'Authentic Food', en: 'Authentic Food', ar: 'طعام أصيل', fr: 'Cuisine authentique' },
  { value: 'Quiet & Calm', en: 'Quiet & Calm', ar: 'هادئ ومريح', fr: 'Calme' },
  { value: 'Good Value', en: 'Good Value', ar: 'قيمة جيدة', fr: 'Bon rapport qualité-prix' },
  { value: 'Helpful Staff', en: 'Helpful Staff', ar: 'طاقم متعاون', fr: 'Personnel serviable' },
  { value: 'Scenic Sunset', en: 'Scenic Sunset', ar: 'غروب جميل', fr: 'Beau coucher de soleil' },
];

function isExternalPlace(place: Place) {
  return place.dataSource === 'openstreetmap' || place.source === 'external' || place.id.startsWith('osm-');
}

export const RatePlaceModal: React.FC<RatePlaceModalProps> = ({
  isOpen,
  onClose,
  place,
  onReviewSuccess,
  language = 'en',
}) => {
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const { status: authStatus, user } = useAuthSession();
  const [rating, setRating] = useState(0);
  const [authorName, setAuthorName] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const text = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;

  useEffect(() => {
    if (!isOpen) return;
    setRating(0);
    setReviewText('');
    setSelectedTags([]);
    setPhotoUrl('');
    setIsSuccess(false);
    setErrorMessage('');
    setAuthorName(user?.name || '');
  }, [isOpen, place?.id, user?.name]);

  if (!isOpen || !place) return null;

  const ensureReviewablePlace = async (): Promise<Place | null> => {
    if (!isExternalPlace(place)) return place;
    const created = await createPlace({
      name: place.name,
      arabicName: place.arabicName,
      frenchName: place.frenchName,
      category: place.category,
      subCategory: place.subCategory,
      region: place.region,
      area: place.area,
      coordinates: place.coordinates,
      address: place.address,
      photos: place.photos || [],
      description: place.description || place.name,
      formationInfo: place.formationInfo,
      features: place.features,
      priceLevel: place.priceLevel,
      openingHours: place.openingHours,
      contactPhone: place.contactPhone,
    });
    return created.success && created.place ? created.place : null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');

    if (authStatus !== 'authed') {
      setErrorMessage(text('Sign in before publishing a review.', 'سجّل الدخول قبل نشر التقييم.', 'Connectez-vous avant de publier un avis.'));
      return;
    }
    if (!authorName.trim()) {
      setErrorMessage(text('Enter the name or alias shown with this review.', 'أدخل الاسم أو الاسم المستعار الذي سيظهر مع التقييم.', 'Saisissez le nom ou pseudonyme à afficher avec cet avis.'));
      return;
    }
    if (rating < 1 || rating > 5) {
      setErrorMessage(text('Choose a rating from 1 to 5.', 'اختر تقييماً من 1 إلى 5.', 'Choisissez une note de 1 à 5.'));
      return;
    }
    if (!reviewText.trim()) {
      setErrorMessage(text('Write your experience before publishing.', 'اكتب تجربتك قبل النشر.', 'Décrivez votre expérience avant de publier.'));
      return;
    }
    if (photoUrl.trim()) {
      try {
        const parsed = new URL(photoUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
      } catch {
        setErrorMessage(text('Photo URL must start with http or https.', 'يجب أن يبدأ رابط الصورة بـ http أو https.', 'Le lien de la photo doit commencer par http ou https.'));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const targetPlace = await ensureReviewablePlace();
      if (!targetPlace) {
        setErrorMessage(text('Could not prepare this place for reviews. Try again.', 'تعذر تجهيز هذا المكان للتقييم. حاول مجدداً.', 'Impossible de préparer ce lieu pour les avis. Réessayez.'));
        return;
      }

      const result = await submitPlaceReview(targetPlace.id, {
        authorName: authorName.trim(),
        authorRole: 'traveler',
        rating,
        text: reviewText.trim(),
        tags: selectedTags,
        photo: photoUrl.trim() || undefined,
      });

      if (!result.success || !result.updatedPlace) {
        setErrorMessage(text('Could not publish the review. Try again.', 'تعذر نشر التقييم. حاول مجدداً.', 'Impossible de publier l’avis. Réessayez.'));
        return;
      }

      setIsSuccess(true);
      onReviewSuccess({ ...result.updatedPlace, distanceKm: place.distanceKm });
      window.setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 900);
    } catch {
      setErrorMessage(text('Could not publish the review. Try again.', 'تعذر نشر التقييم. حاول مجدداً.', 'Impossible de publier l’avis. Réessayez.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = isAr && place.arabicName ? place.arabicName : isFr && place.frenchName ? place.frenchName : place.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm animate-in fade-in sm:p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{text('Traveler review', 'تقييم مسافر', 'Avis voyageur')}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">{text(`Rate: ${displayName}`, `تقييم: ${displayName}`, `Évaluer : ${displayName}`)}</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 hover:bg-slate-100" aria-label={text('Close', 'إغلاق', 'Fermer')}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-5 text-xs text-slate-700">
          {errorMessage && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{errorMessage}</div>}

          <div className="space-y-2 rounded-2xl border border-amber-200/60 bg-amber-50/50 p-4 text-center">
            <span className="block text-xs font-bold text-slate-600">{text('Your rating', 'تقييمك', 'Votre note')}</span>
            <div className="flex items-center justify-center gap-2 text-amber-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(star)} className="p-1 transition hover:scale-110" aria-label={`${star}/5`}>
                  <Star className={`h-8 w-8 ${star <= rating ? 'fill-current text-amber-400' : 'text-slate-300'}`} />
                </button>
              ))}
            </div>
            <div className="text-[11px] text-slate-500">{rating ? `${rating}/5` : text('Choose a rating', 'اختر تقييماً', 'Choisissez une note')}</div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-slate-600">{text('Display name / alias', 'الاسم الظاهر / المستعار', 'Nom affiché / pseudonyme')}</span>
            <input value={authorName} onChange={(event) => setAuthorName(event.target.value)} required className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-blue-500" />
          </label>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-slate-600">{text('Tags (optional)', 'وسوم (اختيارية)', 'Tags (facultatif)')}</label>
            <div className="flex flex-wrap gap-1.5">
              {tagOptions.map((tag) => {
                const selected = selectedTags.includes(tag.value);
                const label = isAr ? tag.ar : isFr ? tag.fr : tag.en;
                return (
                  <button key={tag.value} type="button" onClick={() => setSelectedTags(selected ? selectedTags.filter((item) => item !== tag.value) : [...selectedTags, tag.value])} className={`rounded-full border px-3 py-1.5 text-xs ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-slate-600">{text('Your experience *', 'تجربتك *', 'Votre expérience *')}</span>
            <textarea rows={4} required value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder={text('Share what you experienced.', 'شارك تجربتك مع المكان.', 'Partagez votre expérience.')} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-blue-500" />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-slate-600">{text('Photo URL (optional)', 'رابط صورة (اختياري)', 'Lien photo (facultatif)')}</span>
            <input type="url" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} placeholder="https://..." className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-blue-500" />
          </label>

          <button type="submit" disabled={isSubmitting || isSuccess} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />{text('Publishing...', 'جارٍ النشر...', 'Publication...')}</> : isSuccess ? <><Check className="h-4 w-4" />{text('Published', 'تم النشر', 'Publié')}</> : text('Publish review', 'نشر التقييم', 'Publier l’avis')}
          </button>
        </form>
      </div>
    </div>
  );
};
