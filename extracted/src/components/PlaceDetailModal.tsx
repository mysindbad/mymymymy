import React, { useState } from 'react';
import {
  X,
  Star,
  MapPin,
  Navigation,
  Heart,
  Share2,
  Phone,
  Clock,
  Building2,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Camera,
  AlertCircle,
  Plus
} from 'lucide-react';
import { Place } from '../types';
import { submitPlaceCheckIn } from '../services/api';
import { RatePlaceModal } from './RatePlaceModal';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';
import { formatPriceLevel } from '../data/currency';

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
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';

  if (!place) return null;

  const handleCheckIn = async () => {
    setIsCheckedIn(true);
    await submitPlaceCheckIn(place.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in select-none">
      <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95">
        {/* Photo Hero with Overlaid Controls */}
        <div className="relative h-64 sm:h-72 w-full bg-slate-900 shrink-0">
          <img
            src={place.photos[activePhotoIdx] || place.photos[0]}
            alt={place.name}
            className="w-full h-full object-cover transition-all duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />

          {/* Top Bar Controls */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase text-white bg-black/50 backdrop-blur-md border border-white/20">
                {place.category === 'accommodation'
                  ? '🛏️ Stay & Riad'
                  : place.category === 'tourist_poi'
                  ? '🏛️ Tourist POI'
                  : place.category === 'emergency'
                  ? '🚨 Emergency'
                  : place.category === 'restaurant'
                  ? '🍽️ Dining'
                  : '⛺ Campsite'}
              </span>
              {place.isUnderDocumentedGem && (
                <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-amber-400 text-slate-950 flex items-center gap-1 shadow-md">
                  <Sparkles className="w-3 h-3 fill-slate-950" />
                  <span>Hidden Gem</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onSaveToggle(place.id)}
                className={`p-2.5 rounded-full backdrop-blur-md transition ${
                  isSaved ? 'bg-rose-500 text-white' : 'bg-black/50 hover:bg-black/70 text-white'
                }`}
              >
                <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2.5 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Hero Info */}
          <div className="absolute bottom-4 left-4 right-4 text-white z-10">
            <h1 className="text-xl sm:text-2xl font-black leading-tight drop-shadow-md">
              {isAr && place.arabicName ? place.arabicName : place.name}
            </h1>
            <p className="text-xs text-slate-200 drop-shadow-sm flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>{place.address}</span>
            </p>
          </div>

          {/* Photo Dots if multiple */}
          {place.photos.length > 1 && (
            <div className="absolute bottom-2 right-4 flex gap-1 z-20">
              {place.photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhotoIdx(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    activePhotoIdx === i ? 'bg-white w-4' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-slate-700 text-xs sm:text-sm">
          {/* Quick Metrics Bar: Rating, Price, Distance, Reviews */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-center">
            <div>
              <div className="flex items-center justify-center text-amber-500 font-black text-base">
                <Star className="w-4 h-4 fill-current mr-0.5" />
                <span>{place.rating.toFixed(1)}</span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {place.reviewCount} {isAr ? 'تقييم مجتمعي' : 'Reviews'}
              </span>
            </div>

            <div className="w-px h-8 bg-slate-200" />

            <div>
              <div className="text-base font-black text-slate-900">
                {formatPriceLevel(place.priceLevel, currency)}
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {isAr ? 'مستوى السعر' : 'Price Level'}
              </span>
            </div>

            <div className="w-px h-8 bg-slate-200" />

            <div>
              <div className="text-base font-black text-blue-600">
                {place.distanceKm || 1.4} km
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {isAr ? 'المسافة عنك' : 'Distance'}
              </span>
            </div>
          </div>

          {/* Business Owner Verification (Feature 4) */}
          {place.ownerVerified && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <strong>{isAr ? 'نشاط تجاري موثق' : 'Verified Business Listing'}:</strong>{' '}
                <span>
                  {place.businessOwnerName
                    ? `${place.businessOwnerName} (${isAr ? 'صاحب المنشأة' : 'Owner'})`
                    : isAr ? 'تم التحقق من الموقع والإدارة المحلية' : 'Confirmed by local operator'}
                </span>
              </div>
            </div>
          )}

          {/* Description Section */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              {isAr ? 'عن المكان والخدمات' : 'About this Place'}
            </h3>
            <p className="text-slate-700 leading-relaxed text-xs sm:text-sm">
              {place.description}
            </p>
          </div>

          {/* FORMATION & BACKGROUND (Explicit client requirement for Feature 2) */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 space-y-1.5">
            <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>{isAr ? 'التكوين والتاريخ المحلي (Formation & History)' : 'Formation & Historical Context'}</span>
            </div>
            <p className="text-blue-950 text-xs leading-relaxed">
              {place.formationInfo ||
                'Discovered and documented through the collective contributions of Moroccan travelers and local community residents.'}
            </p>
          </div>

          {/* Opening hours & contact if available */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {place.openingHours && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="truncate">{place.openingHours}</span>
              </div>
            )}
            {place.contactPhone && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                <a href={`tel:${place.contactPhone}`} className="text-blue-600 font-bold underline">
                  {place.contactPhone}
                </a>
              </div>
            )}
          </div>

          {/* User Reviews Section (Feature 1 & Feature 4) */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {isAr ? 'تقييمات المسافرين والمجتمع' : 'Community Reviews & Ratings'}
              </h3>
              <button
                onClick={() => setIsRateModalOpen(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? 'أضف تقييمك' : 'Write Review'}</span>
              </button>
            </div>

            {place.reviews && place.reviews.length > 0 ? (
              <div className="space-y-2.5">
                {place.reviews.map((rev) => (
                  <div key={rev.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-xs">{rev.authorName}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-blue-100 text-blue-800 font-semibold">
                          {rev.authorRole}
                        </span>
                      </div>
                      <div className="flex items-center text-amber-500 text-xs font-bold">
                        <Star className="w-3 h-3 fill-current mr-0.5" />
                        <span>{rev.rating}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{rev.text}</p>
                    {rev.tags && rev.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {rev.tags.map((tg) => (
                          <span key={tg} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                            #{tg}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                {isAr ? 'كن أول من يقيّم هذا المكان ويفيد مجتمع المسافرين!' : 'Be the first traveler to rate and review this place!'}
              </p>
            )}
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2 shrink-0">
          <button
            onClick={handleCheckIn}
            disabled={isCheckedIn}
            className={`py-3 px-4 rounded-2xl border flex items-center justify-center gap-1.5 text-xs font-bold transition ${
              isCheckedIn
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 ${isCheckedIn ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>{isCheckedIn ? t.checkedIn : t.checkIn}</span>
          </button>

          <button
            id="modal-start-navigation-btn"
            onClick={() => onStartNavigation(place)}
            className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition active:scale-98"
          >
            <Navigation className="w-4 h-4 fill-current" />
            <span>{t.startNavigation}</span>
          </button>
        </div>
      </div>

      {/* Write Review Modal */}
      <RatePlaceModal
        isOpen={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        place={place}
        onReviewSuccess={(updated) => {
          if (onPlaceUpdated) onPlaceUpdated(updated);
        }}
        onUserEarnedXp={() => {}}
        language={language}
      />
    </div>
  );
};
