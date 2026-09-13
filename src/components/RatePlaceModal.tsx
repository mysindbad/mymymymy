import React, { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles, Star, X } from 'lucide-react';
import { Place } from '../types';
import { ApiAuthenticationError, submitPlaceReview } from '../services/api';
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

const tags = [
  'Scenery',
  'Hidden Gem',
  'Cleanliness',
  'Authentic Food',
  'Quiet & Calm',
  'Good Value',
  'Helpful Staff',
  'Scenic Sunset',
];

export const RatePlaceModal: React.FC<RatePlaceModalProps> = ({
  isOpen,
  onClose,
  place,
  onReviewSuccess,
  language = 'en',
}) => {
  const isAr = language === 'ar';
  const { status: authStatus, user } = useAuthSession();
  const [rating, setRating] = useState(0);
  const [authorName, setAuthorName] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const text = (en: string, ar: string) => (isAr ? ar : en);

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');

    if (authStatus !== 'authed') {
      setErrorMessage(text('Sign in before publishing a review.', 'سجّل الدخول قبل نشر التقييم.'));
      return;
    }
    if (!authorName.trim()) {
      setErrorMessage(text('Enter the name or alias you want displayed with this review.', 'أدخل الاسم أو الاسم المستعار الذي تريد عرضه مع التقييم.'));
      return;
    }
    if (rating < 1 || rating > 5) {
      setErrorMessage(text('Choose a rating from 1 to 5.', 'اختر تقييماً من 1 إلى 5.'));
      return;
    }
    if (!reviewText.trim()) {
      setErrorMessage(text('Write your own experience before publishing.', 'اكتب تجربتك الفعلية قبل النشر.'));
      return;
    }
    if (photoUrl.trim()) {
      try {
        const parsed = new URL(photoUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
      } catch {
        setErrorMessage(text('Photo URL must be a valid http(s) URL.', 'يجب أن يكون رابط الصورة صالحاً ويبدأ بـ http أو https.'));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const result = await submitPlaceReview(place.id, {
        authorName: authorName.trim(),
        authorRole: 'traveler',
        rating,
        text: reviewText.trim(),
        tags: selectedTags,
        photo: photoUrl.trim() || undefined,
      });

      if (!result.success || !result.updatedPlace) {
        setErrorMessage(text('The review was not confirmed by the server. Nothing was published.', 'لم يؤكد الخادم التقييم، لذلك لم يتم نشر شيء.'));
        return;
      }

      setIsSuccess(true);
      onReviewSuccess(result.updatedPlace);
      window.setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 900);
    } catch (error) {
      setErrorMessage(error instanceof ApiAuthenticationError
        ? text('Your sign-in session is not available. Sign in again and retry.', 'جلسة الدخول غير متاحة. سجّل الدخول مجدداً وحاول مرة أخرى.')
        : text('Could not publish the review. Try again.', 'تعذر نشر التقييم. حاول مرة أخرى.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-1 text-blue-600 font-bold text-[11px]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{text('Traveler review', 'تقييم مسافر')}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">{text(`Rate: ${place.name}`, `تقييم: ${place.arabicName || place.name}`)}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-400" aria-label={text('Close', 'إغلاق')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {errorMessage && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{errorMessage}</div>}

          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60 text-center space-y-2">
            <span className="text-xs font-bold text-slate-600 block">{text('Your rating', 'تقييمك')}</span>
            <div className="flex items-center justify-center gap-2 text-amber-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(star)} className="p-1 hover:scale-110 transition" aria-label={`${star}/5`}>
                  <Star className={`w-8 h-8 ${star <= rating ? 'fill-current text-amber-400' : 'text-slate-300'}`} />
                </button>
              ))}
            </div>
            <div className="text-[11px] text-slate-500">{rating ? `${rating}/5` : text('Choose a rating', 'اختر تقييماً')}</div>
          </div>

          <label className="block">
            <span className="block text-[11px] font-bold text-slate-600 mb-1">{text('Display name / alias', 'الاسم الظاهر / المستعار')}</span>
            <input value={authorName} onChange={(event) => setAuthorName(event.target.value)} required className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="block mt-1 text-[10px] text-slate-400">{text('Trust-bearing roles such as guide or owner are not self-assigned here.', 'الأدوار الموثوقة مثل المرشد أو صاحب النشاط لا يحددها المستخدم بنفسه هنا.')}</span>
          </label>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5">{text('Tags (optional)', 'وسوم (اختيارية)')}</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const selected = selectedTags.includes(tag);
                return (
                  <button key={tag} type="button" onClick={() => setSelectedTags(selected ? selectedTags.filter((item) => item !== tag) : [...selectedTags, tag])} className={`px-3 py-1.5 rounded-full text-xs border ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="block text-[11px] font-bold text-slate-600 mb-1">{text('Your experience *', 'تجربتك *')}</span>
            <textarea rows={4} required value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder={text('Share only what you actually experienced.', 'شارك فقط ما عشته أو لاحظته فعلاً.')} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" />
          </label>

          <label className="block">
            <span className="block text-[11px] font-bold text-slate-600 mb-1">{text('Photo URL (optional)', 'رابط صورة (اختياري)')}</span>
            <input type="url" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} placeholder="https://..." className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
            {text('The review is shown as published only after the server confirms it. This screen does not award XP or claim an AI-memory update.', 'لا يظهر التقييم كمنشور إلا بعد تأكيد الخادم. هذه الشاشة لا تمنح XP ولا تدّعي تحديث ذاكرة الذكاء الاصطناعي.')}
          </div>

          <button type="submit" disabled={isSubmitting || isSuccess} className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />{text('Publishing...', 'جاري النشر...')}</> : isSuccess ? <><Check className="w-4 h-4" />{text('Published', 'تم النشر')}</> : text('Publish review', 'نشر التقييم')}
          </button>
        </form>
      </div>
    </div>
  );
};
