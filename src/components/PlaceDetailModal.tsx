import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquareQuote,
  Navigation,
  Phone,
  Pencil,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Place } from '../types';
import { submitPlaceCheckIn } from '../services/api';
import { RatePlaceModal } from './RatePlaceModal';
import { PlaceVisual } from './PlaceVisual';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';
import { formatPriceLevel } from '../data/currency';
import { formatVerifiedRating, liveReviewsLabel, unratedLabel } from '../lib/placeRating';
import { categoryLabel, formatDistance, localizedText, placeDisplayName, sourceLabel } from '../lib/placeView';
import { useLocale } from '../lib/i18n';
import { Sheet } from '../ui/Sheet';
import { Button, IconButton } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Alert, EmptyState } from '../ui/Feedback';
import { Divider, Stat } from '../ui/Panel';
import { SaveButton } from '../ui/SaveButton';
import { toast } from '../ui/toast';

interface PlaceDetailModalProps {
  place: Place | null;
  onClose: () => void;
  onStartNavigation: (place: Place) => void;
  onSaveToggle: (placeId: string) => void;
  isSaved?: boolean;
  onPlaceUpdated?: (place: Place) => void;
  language?: SupportedLanguage;
  currency?: string;
  onOpenMap?: () => void;
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
  onOpenMap,
}) => {
  const locale = useLocale(language);
  const t = locale.t;
  const copy = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  useEffect(() => {
    setIsCheckedIn(false);
    setIsCheckingIn(false);
    setCheckInError(null);
    setIsRateModalOpen(false);
    setActivePhotoIdx(0);
  }, [place?.id]);

  const handleCheckIn = async () => {
    if (!place || isCheckingIn || isCheckedIn) return;
    setIsCheckingIn(true);
    setCheckInError(null);
    try {
      const success = await submitPlaceCheckIn(place.id);
      if (success) {
        setIsCheckedIn(true);
        toast(t('Checked in', 'تم تسجيل الوصول', 'Passage enregistré'), { tone: 'success' });
      } else {
        setCheckInError(t('Check-in could not be confirmed.', 'تعذر تأكيد تسجيل الوصول.', 'Le check-in n’a pas pu être confirmé.'));
      }
    } catch {
      setCheckInError(t('Check-in needs a connection. Try again.', 'تسجيل الوصول يتطلب اتصالاً. أعد المحاولة.', 'Le check-in nécessite une connexion. Réessayez.'));
    } finally {
      setIsCheckingIn(false);
    }
  };

  if (!place) {
    return (
      <>
        <Sheet open={false} onClose={onClose}>{null}</Sheet>
        <RatePlaceModal isOpen={false} onClose={() => {}} place={place} onReviewSuccess={() => {}} language={language} />
      </>
    );
  }

  const displayName = placeDisplayName(place, locale.language);
  const verifiedRating = formatVerifiedRating(place.rating, place.reviewCount);
  const activePhoto = place.photos[activePhotoIdx] || place.photos[0] || '';
  const visualPlace = activePhoto ? { ...place, photos: [activePhoto] } : { ...place, photos: [] };
  const distance = formatDistance(place.distanceKm, locale.language);
  const trust = sourceLabel(place, locale.language);
  const descriptionInfo = localizedText(locale.language, place.description, place.descriptionAr, place.descriptionFr);
  const formationInfo = localizedText(locale.language, place.formationInfo, place.formationInfoAr, place.formationInfoFr);
  const subCategoryLabel = localizedText(locale.language, place.subCategory, place.subCategoryAr, place.subCategoryFr)?.text
    || categoryLabel(place.category, locale.language);
  const openingHoursLabel = localizedText(locale.language, place.openingHours, place.openingHoursAr, place.openingHoursFr)?.text;
  const sourceLanguageNote = t('Shown in the original language', 'معروض باللغة الأصلية للمصدر', 'Affiché dans la langue d’origine');

  const header = (
    <div className="relative shrink-0 bg-slate-950">
      <div className="h-52 w-full sm:h-64">
        <PlaceVisual
          place={visualPlace}
          language={locale.language}
          photoIndex={activePhotoIdx}
          eager
          showFallbackLabel={false}
          className="h-full w-full"
          imageClassName="h-full w-full object-cover"
        />
      </div>
      <div className="sindbad-photo-scrim absolute inset-x-0 bottom-0 h-3/5" aria-hidden="true" />

      <div className="absolute inset-x-3 top-2.5 z-10 flex items-center justify-between gap-2">
        <Chip tone="onPhoto">{subCategoryLabel}</Chip>
        <div className="flex items-center gap-1.5">
          <SaveButton
            saved={isSaved}
            onToggle={() => onSaveToggle(place.id)}
            placeName={displayName}
            language={locale.language}
            size="sm"
          />
          <IconButton label={t('Close', 'إغلاق', 'Fermer')} onClick={onClose} size="sm" variant="onPhoto">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className="absolute inset-x-4 bottom-3 z-10 text-white">
        <h2 className="text-h2 font-extrabold leading-tight tracking-tight [text-wrap:balance]">{displayName}</h2>
        {(place.area || place.region) && (
          <p className="mt-1 flex items-center gap-1.5 text-micro font-medium text-white/80">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{[place.area, place.region].filter(Boolean).join(' · ')}</span>
          </p>
        )}
      </div>

      {place.photos.length > 1 && (
        <div className="absolute bottom-3 end-4 z-20 flex items-center gap-1">
          {place.photos.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActivePhotoIdx(index)}
              aria-label={`${t('Photo', 'صورة', 'Photo')} ${index + 1}`}
              aria-current={activePhotoIdx === index ? 'true' : undefined}
              className={`h-2 rounded-full transition-all duration-200 ${activePhotoIdx === index ? 'w-4 bg-white' : 'w-2 bg-white/45 hover:bg-white/70'}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  const footer = (
    <div className="flex items-center gap-2">
      <Button
        variant={isCheckedIn ? 'positive' : 'secondary'}
        onClick={() => void handleCheckIn()}
        disabled={isCheckedIn || isCheckingIn}
        loading={isCheckingIn}
        icon={<CheckCircle2 className="h-4 w-4" />}
        className="shrink-0"
      >
        {isCheckedIn ? copy.checkedIn : isCheckingIn ? t('Confirming…', 'جارٍ التأكيد…', 'Confirmation…') : copy.checkIn}
      </Button>
      <Button
        id="modal-start-navigation-btn"
        className="min-w-0 flex-1"
        onClick={() => onStartNavigation(place)}
        icon={<Navigation className="h-4 w-4" />}
      >
        {copy.startNavigation}
      </Button>
    </div>
  );

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        size="lg"
        tone="onPhoto"
        header={header}
        footer={footer}
        language={language}
        bodyClassName="bg-surface"
      >
        <div className="px-4 pb-6 pt-4 sm:px-5">
          <div className="grid grid-cols-3 items-start gap-2 rounded-xl bg-surface-muted px-3 py-2.5">
            <Stat
              label={t('Rating', 'التقييم', 'Note')}
              value={verifiedRating || '—'}
              hint={verifiedRating ? liveReviewsLabel(place.reviewCount, language) : unratedLabel(language)}
            />
            <Stat label={t('Price', 'السعر', 'Prix')} value={formatPriceLevel(place.priceLevel, currency) || '—'} />
            <Stat
              label={t('Distance', 'المسافة', 'Distance')}
              value={distance || '—'}
              hint={distance ? undefined : t('No location context', 'بدون سياق موقع', 'Sans position')}
            />
          </div>

          {checkInError && (
            <div className="mt-3">
              <Alert tone="error" action={
                <Button size="sm" variant="secondary" onClick={() => void handleCheckIn()}>
                  {t('Retry', 'إعادة المحاولة', 'Réessayer')}
                </Button>
              }>
                {checkInError}
              </Alert>
            </div>
          )}

          {(place.ownerVerified || trust) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {place.ownerVerified && (
                <Chip tone="positive" icon={<ShieldCheck className="h-3 w-3" />}>
                  {t('Verified business', 'نشاط موثّق', 'Établissement vérifié')}
                </Chip>
              )}
              {trust && <Chip>{trust}</Chip>}
            </div>
          )}

          {place.address && (
            <div className="mt-4 flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-caption leading-relaxed text-ink-soft">{place.address}</p>
              {onOpenMap && (
                <button
                  type="button"
                  onClick={onOpenMap}
                  className="shrink-0 rounded-lg px-2 py-1 text-label font-bold text-brand-accent transition-colors hover:bg-brand-soft"
                >
                  {t('Map', 'الخريطة', 'Carte')}
                </button>
              )}
            </div>
          )}

          {(descriptionInfo || formationInfo) && (
            <>
              <Divider className="my-4" />
              <div className="space-y-4">
                {[
                  { label: t('About', 'عن المكان', 'À propos'), info: descriptionInfo },
                  { label: t('History', 'التاريخ', 'Histoire'), info: formationInfo },
                ].map((block) => block.info && (
                  <div key={block.label}>
                    <h3 className="text-label font-bold uppercase tracking-wide text-muted">{block.label}</h3>
                    <p className="mt-1 text-body leading-relaxed text-ink-soft">{block.info.text}</p>
                    {block.info.isSourceLanguage && (
                      <p className="mt-1.5 text-micro font-semibold text-muted">{sourceLanguageNote}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {(openingHoursLabel || place.contactPhone) && (
            <>
              <Divider className="my-4" />
              <dl className="space-y-2.5">
                {openingHoursLabel && (
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <dt className="sr-only">{t('Opening hours', 'أوقات العمل', 'Horaires')}</dt>
                    <dd className="min-w-0 flex-1 text-caption font-medium text-ink-soft">{openingHoursLabel}</dd>
                  </div>
                )}
                {place.contactPhone && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <dt className="sr-only">{t('Phone', 'الهاتف', 'Téléphone')}</dt>
                    <dd className="min-w-0 flex-1">
                      <a href={`tel:${place.contactPhone}`} className="text-caption font-bold text-brand-accent underline-offset-2 hover:underline">
                        {place.contactPhone}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </>
          )}

          <Divider className="my-4" />

          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-1.5 text-title font-bold text-ink">
              <MessageSquareQuote className="h-4 w-4 text-muted" aria-hidden="true" />
              {t('Reviews', 'التقييمات', 'Avis')}
              {place.reviewCount > 0 && <span className="text-caption font-semibold text-muted tabular-nums">{place.reviewCount}</span>}
            </h3>
            <Button size="sm" variant="secondary" onClick={() => setIsRateModalOpen(true)} icon={<Pencil className="h-3.5 w-3.5" />}>
              {t('Write review', 'اكتب تقييماً', 'Écrire un avis')}
            </Button>
          </div>

          {place.reviews?.length ? (
            <ul className="mt-3 divide-y divide-line">
              {place.reviews.map((review) => (
                <li key={review.id} className="py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-micro font-bold text-brand-accent">
                      {(review.authorName || '?').trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-label font-bold text-ink">{review.authorName}</span>
                    {typeof review.rating === 'number' && (
                      <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-micro font-bold text-ink-soft tabular-nums">
                        ★ {review.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-caption leading-relaxed text-ink-soft">{review.text}</p>
                  {review.date && <p className="mt-1 text-micro text-muted tabular-nums">{review.date}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              className="mt-3"
              icon={<MessageSquareQuote className="h-5 w-5" aria-hidden="true" />}
              title={t('No reviews yet', 'لا توجد تقييمات بعد', 'Aucun avis pour le moment')}
              description={t(
                'Be the first to tell other travelers what this place is really like.',
                'كن أول من يخبر المسافرين الآخرين عن هذا المكان.',
                'Soyez le premier à décrire ce lieu aux autres voyageurs.',
              )}
            />
          )}
        </div>
      </Sheet>

      <RatePlaceModal
        isOpen={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        place={place}
        onReviewSuccess={(updated) => onPlaceUpdated?.(updated)}
        language={language}
      />
    </>
  );
};
