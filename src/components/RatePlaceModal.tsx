import React, { useEffect, useState } from 'react';
import { X, Star, Check, Loader2, Sparkles } from 'lucide-react';
import { Place } from '../types';
import { submitPlaceReview } from '../services/api';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';

interface RatePlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  place: Place | null;
  onReviewSuccess: (updatedPlace: Place) => void;
  onUserEarnedXp: (xp: number) => void;
  language?: SupportedLanguage;
}

export const RatePlaceModal: React.FC<RatePlaceModalProps> = ({
  isOpen,
  onClose,
  place,
  onReviewSuccess,
  language = 'en',
}) => {
  const isAr = language === 'ar';
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const [rating, setRating] = useState(5);
  const [authorName, setAuthorName] = useState('');
  const [authorRole, setAuthorRole] = useState<'traveler' | 'local_resident' | 'guide'>('traveler');
  const [reviewText, setReviewText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRating(5);
    setAuthorName('');
    setAuthorRole('traveler');
    setReviewText('');
    setSelectedTags([]);
    setPhotoUrl('');
    setIsSubmitting(false);
    setIsSuccess(false);
    setSubmitError(null);
  }, [isOpen, place?.id]);

  if (!isOpen || !place) return null;

  const ASPECT_TAGS = [
    { key: 'Scenery', label: isAr ? 'المناظر الطبيعية' : 'Scenery' },
    { key: 'Hidden Gem', label: isAr ? 'جوهرة مخفية' : 'Hidden Gem' },
    { key: 'Cleanliness', label: isAr ? 'النظافة' : 'Cleanliness' },
    { key: 'Authentic Food', label: isAr ? 'طعام أصيل' : 'Authentic Food' },
    { key: 'Quiet & Calm', label: isAr ? 'هدوء وراحة' : 'Quiet & Calm' },
    { key: 'Good Value', label: isAr ? 'سعر مناسب' : 'Good Value' },
    { key: 'Helpful Staff', label: isAr ? 'معاملة طيبة' : 'Helpful Staff' },
    { key: 'Scenic Sunset', label: isAr ? 'غروب ساحر' : 'Scenic Sunset' },
  ];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanAuthorName = authorName.trim();
    const cleanReviewText = reviewText.trim();

    if (!cleanAuthorName || !cleanReviewText) {
      setSubmitError(isAr
        ? 'أدخل الاسم الذي تريد إظهاره ونص تقييم حقيقي قبل النشر.'
        : 'Enter the name you want displayed and your real review text before publishing.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const result = await submitPlaceReview(place.id, {
      authorName: cleanAuthorName,
      authorRole,
      rating,
      text: cleanReviewText,
      tags: selectedTags,
      photo: photoUrl.trim() || undefined,
    });

    setIsSubmitting(false);
    if (result.success && result.updatedPlace) {
      setIsSuccess(true);
      onReviewSuccess(result.updatedPlace);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1200);
      return;
    }

    setSubmitError(isAr
      ? 'تعذر نشر التقييم. تحقق من تسجيل الدخول والاتصال ثم حاول مجدداً.'
      : 'The review could not be published. Check your sign-in and connection, then try again.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-1 text-blue-600 font-bold text-[11px]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAr ? 'مساهمة في تقييمات المجتمع' : 'Community review contribution'}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {isAr ? `تقييم: ${place.name}` : `Rate: ${place.name}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition shadow-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60 text-center space-y-2">
            <span className="text-xs font-bold text-slate-600 block">
              {isAr ? 'تقييمك الإجمالي للتجربة' : 'Your Overall Rating'}
            </span>
            <div className="flex items-center justify-center gap-2 text-amber-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-125 transition transform"
                >
                  <Star className={`w-8 h-8 ${star <= rating ? 'fill-current text-amber-400' : 'text-slate-300'}`} />
                </button>
              ))}
            </div>
            <div className="text-xs font-bold text-amber-600">
              {rating === 5 && (isAr ? 'تجربة استثنائية (5/5)' : 'Exceptional (5/5)')}
              {rating === 4 && (isAr ? 'ممتاز جداً (4/5)' : 'Very Good (4/5)')}
              {rating === 3 && (isAr ? 'جيد (3/5)' : 'Good (3/5)')}
              {rating <= 2 && (isAr ? 'يحتاج تحسين (2/5)' : 'Needs Improvement')}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {isAr ? 'الاسم الذي سيظهر' : 'Display Name'}
              </label>
              <input
                type="text"
                required
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder={isAr ? 'اكتب اسمك أو اسماً مستعاراً' : 'Your name or a nickname'}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {isAr ? 'صفتك' : 'Your Traveler Type'}
              </label>
              <select
                value={authorRole}
                onChange={(e) => setAuthorRole(e.target.value as 'traveler' | 'local_resident' | 'guide')}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none bg-white font-medium"
              >
                <option value="traveler">{isAr ? 'مسافر زائر' : 'Traveler / Visitor'}</option>
                <option value="local_resident">{isAr ? 'مقيم محلي' : 'Local Resident'}</option>
                <option value="guide">{isAr ? 'مرشد سياحي' : 'Guide'}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
              {isAr ? 'ما أبرز ما لفت انتباهك؟ (اختياري)' : 'What stood out? (Optional tags)'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ASPECT_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag.key);
                return (
                  <button
                    key={tag.key}
                    type="button"
                    onClick={() =>
                      setSelectedTags(
                        isSelected ? selectedTags.filter((selected) => selected !== tag.key) : [...selectedTags, tag.key]
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {isAr ? 'ملاحظاتك ونصائحك للمسافرين القادمين' : 'Your Detailed Experience & Tips'}
            </label>
            <textarea
              rows={3}
              required
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder={
                isAr
                  ? 'شارك ما شاهدته فعلاً: أفضل وقت للزيارة، حالة المسار، الأسعار أو نصائح مفيدة...'
                  : 'Share what you actually experienced: arrival times, trail conditions, prices, or useful tips...'
              }
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {isAr ? 'رابط صورة (اختياري)' : 'Photo URL (Optional)'}
            </label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {submitError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
              {submitError}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isSuccess}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{isAr ? 'جاري نشر التقييم...' : 'Publishing Review...'}</span>
                </>
              ) : isSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white stroke-[3]" />
                  <span>{isAr ? 'تم نشر التقييم' : 'Review Published'}</span>
                </>
              ) : (
                <span>{isAr ? 'نشر التقييم' : 'Publish Review'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
