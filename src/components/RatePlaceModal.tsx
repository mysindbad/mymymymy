import React, { useEffect, useState } from 'react';
import { Check, Star } from 'lucide-react';
import { Place } from '../types';
import { createPlace, submitPlaceReview } from '../services/api';
import { SupportedLanguage } from '../data/translations';
import { useAuthSession } from '../lib/authSession';
import { useLocale } from '../lib/i18n';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { FilterChip } from '../ui/Chip';
import { Alert } from '../ui/Feedback';
import { TextArea, TextInput } from '../ui/Field';
import { PlaceVisual } from './PlaceVisual';

interface RatePlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  place: Place | null;
  onReviewSuccess: (updatedPlace: Place) => void;
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

const RATING_WORDS: Record<number, { en: string; ar: string; fr: string }> = {
  1: { en: 'Disappointing', ar: 'مخيّب', fr: 'Décevant' },
  2: { en: 'Below expectations', ar: 'دون التوقعات', fr: 'En dessous des attentes' },
  3: { en: 'Worth a stop', ar: 'يستوقفة', fr: 'Mérite un arrêt' },
  4: { en: 'Very good', ar: 'جيد جداً', fr: 'Très bien' },
  5: { en: 'Unmissable', ar: 'لا يُفوَّت', fr: 'Incontournable' },
};

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
  const locale = useLocale(language);
  const { t, isArabic, isFrench } = locale;
  const { status: authStatus, user } = useAuthSession();
  const [rating, setRating] = useState(0);
  const [authorName, setAuthorName] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

  const ensureReviewablePlace = async (): Promise<Place | null> => {
    if (!place || !isExternalPlace(place)) return place;
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
    if (!place) return;

    if (authStatus !== 'authed') {
      setErrorMessage(t('Sign in before publishing a review.', 'سجّل الدخول قبل نشر التقييم.', 'Connectez-vous avant de publier un avis.'));
      return;
    }
    if (!authorName.trim()) {
      setErrorMessage(t('Enter the name or alias shown with this review.', 'أدخل الاسم أو الاسم المستعار الذي سيظهر مع التقييم.', 'Saisissez le nom ou pseudonyme à afficher avec cet avis.'));
      return;
    }
    if (rating < 1 || rating > 5) {
      setErrorMessage(t('Choose a rating from 1 to 5.', 'اختر تقييماً من 1 إلى 5.', 'Choisissez une note de 1 à 5.'));
      return;
    }
    if (!reviewText.trim()) {
      setErrorMessage(t('Write your experience before publishing.', 'اكتب تجربتك قبل النشر.', 'Décrivez votre expérience avant de publier.'));
      return;
    }
    if (photoUrl.trim()) {
      try {
        const parsed = new URL(photoUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
      } catch {
        setErrorMessage(t('Photo link must start with http or https.', 'يجب أن يبدأ رابط الصورة بـ http أو https.', 'Le lien de la photo doit commencer par http ou https.'));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const targetPlace = await ensureReviewablePlace();
      if (!targetPlace) {
        setErrorMessage(t('Could not prepare this place for reviews. Try again.', 'تعذر تجهيز هذا المكان للتقييم. حاول مجدداً.', 'Impossible de préparer ce lieu pour les avis. Réessayez.'));
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
        setErrorMessage(t('Could not publish the review. Try again.', 'تعذر نشر التقييم. حاول مجدداً.', 'Impossible de publier l’avis. Réessayez.'));
        return;
      }

      setIsSuccess(true);
      onReviewSuccess({ ...result.updatedPlace, distanceKm: place.distanceKm });
      window.setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 900);
    } catch {
      setErrorMessage(t('Could not publish the review. Try again.', 'تعذر نشر التقييم. حاول مجدداً.', 'Impossible de publier l’avis. Réessayez.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = place
    ? (isArabic && place.arabicName ? place.arabicName : isFrench && place.frenchName ? place.frenchName : place.name)
    : '';

  const ratingWord = rating
    ? (isArabic ? RATING_WORDS[rating].ar : isFrench ? RATING_WORDS[rating].fr : RATING_WORDS[rating].en)
    : t('Tap a star', 'اختر نجمة', 'Touchez une étoile');

  return (
    <Sheet
      open={isOpen && Boolean(place)}
      onClose={onClose}
      title={t('Rate this place', 'قيّم هذا المكان', 'Évaluer ce lieu')}
      subtitle={displayName}
      size="md"
      language={language}
      footer={
        <Button
          type="submit"
          form="rate-place-form"
          full
          loading={isSubmitting}
          disabled={isSuccess}
          icon={!isSubmitting && !isSuccess ? <Check className="h-4 w-4" /> : undefined}
        >
          {isSuccess
            ? t('Published', 'تم النشر', 'Publié')
            : t('Publish review', 'نشر التقييم', 'Publier l’avis')}
        </Button>
      }
    >
      <form id="rate-place-form" onSubmit={handleSubmit} className="space-y-4 px-4 pb-6 pt-3 sm:px-5">
        {place && (
          <div className="flex items-center gap-3">
            <PlaceVisual place={place} className="h-12 w-12 shrink-0 rounded-lg" language={language} />
            <div className="min-w-0">
              <p className="truncate text-body font-bold text-ink">{displayName}</p>
              <p className="truncate text-micro text-muted">
                {place.area || place.region || t('Morocco', 'المغرب', 'Maroc')}
              </p>
            </div>
          </div>
        )}

        {errorMessage && (
          <Alert tone="error">{errorMessage}</Alert>
        )}

        <fieldset className="border-0 p-0">
          <legend className="mb-1.5 text-label font-semibold text-muted">
            {t('Your rating', 'تقييمك', 'Votre note')}
          </legend>
          <div
            className="flex items-center gap-1"
            role="radiogroup"
            aria-label={t('Rating out of five', 'التقييم من خمس نجوم', 'Note sur cinq')}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={rating === star}
                aria-label={`${star} / 5`}
                onClick={() => { setRating(star); setErrorMessage(''); }}
                className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <Star
                  className={`h-6 w-6 ${star <= rating ? 'fill-sand-400 text-sand-400' : 'text-line-strong'} transition-colors`}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
          <p className="mt-0.5 text-caption font-semibold text-muted" aria-live="polite">{ratingWord}</p>
        </fieldset>

        <div>
          <span className="mb-1.5 block text-label font-semibold text-muted">
            {t('What stood out', 'ما لفت انتباهك', 'Ce qui a marqué')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {tagOptions.map((tag) => {
              const selected = selectedTags.includes(tag.value);
              const label = isArabic ? tag.ar : isFrench ? tag.fr : tag.en;
              return (
                <FilterChip
                  key={tag.value}
                  selected={selected}
                  onClick={() => setSelectedTags(selected ? selectedTags.filter((item) => item !== tag.value) : [...selectedTags, tag.value])}
                >
                  {label}
                </FilterChip>
              );
            })}
          </div>
        </div>

        <TextArea
          id="rate-place-text"
          label={t('Your experience', 'تجربتك', 'Votre expérience')}
          rows={4}
          required
          value={reviewText}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setReviewText(event.target.value)}
          placeholder={t(
            'What was the place like, and who would enjoy it?',
            'كيف كان المكان، ومن قد يستمتع به؟',
            'Comment était le lieu, et qui l’apprécierait ?',
          )}
        />

        {authStatus === 'authed' ? (
          <TextInput
            id="rate-place-name"
            label={t('Display name', 'الاسم الظاهر', 'Nom affiché')}
            value={authorName}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setAuthorName(event.target.value)}
            hint={t('Shown next to your review.', 'يظهر بجانب تقييمك.', 'Affiché à côté de votre avis.')}
          />
        ) : (
          <TextInput
            id="rate-place-name"
            label={t('Display name', 'الاسم الظاهر', 'Nom affiché')}
            value={authorName}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setAuthorName(event.target.value)}
            hint={t('Sign in to publish.', 'سجّل الدخول للنشر.', 'Connectez-vous pour publier.')}
          />
        )}

        <TextInput
          id="rate-place-photo"
          type="url"
          label={t('Photo link (optional)', 'رابط صورة (اختياري)', 'Lien photo (facultatif)')}
          value={photoUrl}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPhotoUrl(event.target.value)}
          placeholder="https://…"
          inputMode="url"
        />
      </form>
    </Sheet>
  );
};
