import React, { useEffect, useState } from 'react';
import { AlertTriangle, Building2, Landmark, Loader2, MapPin, Plus, Tent, Utensils, X } from 'lucide-react';
import { Place, PlaceCategory } from '../types';
import { createPlace } from '../services/api';
import { SupportedLanguage } from '../data/translations';

interface AddPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaceAdded: (place: Place) => void;
  initialCoordinates?: [number, number];
  language?: SupportedLanguage;
}

const categories: Array<{ cat: PlaceCategory; en: string; ar: string; icon: React.ComponentType<{ className?: string }> }> = [
  { cat: 'accommodation', en: 'Stay / Riad', ar: 'إقامة ورياض', icon: Building2 },
  { cat: 'tourist_poi', en: 'Tourist POI', ar: 'معلم / طبيعة', icon: Landmark },
  { cat: 'restaurant', en: 'Food / Cafe', ar: 'مطعم / مقهى', icon: Utensils },
  { cat: 'emergency', en: 'Emergency', ar: 'طوارئ / أمن', icon: AlertTriangle },
  { cat: 'campsite', en: 'Campsite', ar: 'مخيم / طبيعة', icon: Tent },
];

export const AddPlaceModal: React.FC<AddPlaceModalProps> = ({
  isOpen,
  onClose,
  onPlaceAdded,
  initialCoordinates,
  language = 'en',
}) => {
  const isAr = language === 'ar';
  const [role, setRole] = useState<'business_owner' | 'community_traveler'>('community_traveler');
  const [name, setName] = useState('');
  const [arabicName, setArabicName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('tourist_poi');
  const [subCategory, setSubCategory] = useState('');
  const [region, setRegion] = useState('');
  const [area, setArea] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [formationInfo, setFormationInfo] = useState('');
  const [priceLevel, setPriceLevel] = useState<'$' | '$$' | '$$$' | '$$$$'>('$$');
  const [businessOwnerName, setBusinessOwnerName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const text = (en: string, ar: string) => (isAr ? ar : en);

  useEffect(() => {
    if (!isOpen) return;
    if (initialCoordinates) {
      setLat(String(initialCoordinates[0]));
      setLng(String(initialCoordinates[1]));
    } else {
      setLat('');
      setLng('');
    }
    setErrorMessage('');
  }, [isOpen, initialCoordinates]);

  if (!isOpen) return null;

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage(text('Geolocation is not supported by this browser.', 'الموقع الجغرافي غير مدعوم في هذا المتصفح.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setErrorMessage('');
      },
      () => setErrorMessage(text('Could not access your current location.', 'تعذر الوصول إلى موقعك الحالي.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');

    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!name.trim() || !region.trim() || !area.trim() || !address.trim() || !description.trim() || !photoUrl.trim()) {
      setErrorMessage(text(
        'Name, region, area, address, description, and a real photo URL are required.',
        'الاسم والمنطقة والمدينة والعنوان والوصف ورابط صورة حقيقية حقول مطلوبة.',
      ));
      return;
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setErrorMessage(text('Enter valid coordinates.', 'أدخل إحداثيات صحيحة.'));
      return;
    }
    try {
      const parsedPhoto = new URL(photoUrl.trim());
      if (!['http:', 'https:'].includes(parsedPhoto.protocol)) throw new Error('invalid protocol');
    } catch {
      setErrorMessage(text('Photo URL must be a valid http(s) URL for this place.', 'يجب أن يكون رابط الصورة صالحاً ويبدأ بـ http أو https وأن يخص هذا المكان.'));
      return;
    }

    setIsSubmitting(true);
    const payload: Partial<Place> & Record<string, unknown> = {
      name: name.trim(),
      arabicName: arabicName.trim() || undefined,
      category,
      subCategory: subCategory.trim() || undefined,
      region: region.trim(),
      area: area.trim(),
      coordinates: [latitude, longitude],
      address: address.trim(),
      photos: [photoUrl.trim()],
      description: description.trim(),
      formationInfo: formationInfo.trim() || undefined,
      priceLevel,
      openingHours: openingHours.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      source: role,
      businessOwnerName: role === 'business_owner' ? (businessOwnerName.trim() || undefined) : undefined,
    };

    const result = await createPlace(payload);
    setIsSubmitting(false);
    if (!result.success || !result.place) {
      setErrorMessage(result.error || text('Could not submit the listing.', 'تعذر إرسال المكان.'));
      return;
    }

    setIsSuccess(true);
    onPlaceAdded(result.place);
    window.setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center border border-white/30">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">{text('Add Place or Business Listing', 'إضافة مكان أو نشاط للمجتمع')}</h2>
              <p className="text-xs text-blue-100">{text('Submit only details you know to be accurate. Verification is handled separately.', 'أرسل فقط المعلومات التي تعرف أنها صحيحة. التحقق يتم بشكل منفصل.')}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center" aria-label={text('Close', 'إغلاق')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {errorMessage && <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">{errorMessage}</div>}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{text('Submission role (not verification)', 'صفة المساهم (لا تعني التحقق)')}</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRole('business_owner')} className={`p-3 rounded-2xl border text-left rtl:text-right ${role === 'business_owner' ? 'bg-blue-50 border-blue-600 text-blue-900' : 'bg-slate-50 border-slate-200'}`}>
                <Building2 className="w-5 h-5 mb-1" />
                <div className="font-bold">{text('Submitting as owner', 'الإرسال بصفة صاحب النشاط')}</div>
                <div className="text-[10px] text-slate-500">{text('Does not mark the listing verified', 'لا يمنح شارة التحقق')}</div>
              </button>
              <button type="button" onClick={() => setRole('community_traveler')} className={`p-3 rounded-2xl border text-left rtl:text-right ${role === 'community_traveler' ? 'bg-blue-50 border-blue-600 text-blue-900' : 'bg-slate-50 border-slate-200'}`}>
                <Landmark className="w-5 h-5 mb-1" />
                <div className="font-bold">{text('Traveler / community', 'مسافر / مساهم مجتمعي')}</div>
                <div className="text-[10px] text-slate-500">{text('Place discovery contribution', 'مساهمة لاكتشاف مكان')}</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{text('Category', 'التصنيف')}</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {categories.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.cat} type="button" onClick={() => setCategory(item.cat)} className={`p-2 rounded-xl border flex flex-col items-center gap-1 ${category === item.cat ? 'bg-blue-600 border-blue-600 text-white font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px]">{isAr ? item.ar : item.en}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={text('Place / business name *', 'اسم المكان / النشاط *')} value={name} onChange={setName} />
            <Field label={text('Arabic name (optional)', 'الاسم بالعربية (اختياري)')} value={arabicName} onChange={setArabicName} />
            <Field label={text('Subcategory (optional)', 'التصنيف الفرعي (اختياري)')} value={subCategory} onChange={setSubCategory} />
            <Field label={text('Region *', 'المنطقة *')} value={region} onChange={setRegion} placeholder={text('e.g. Northern Morocco', 'مثال: شمال المغرب')} />
            <Field label={text('City / area *', 'المدينة / المنطقة المحلية *')} value={area} onChange={setArea} />
            <Field label={text('Address *', 'العنوان *')} value={address} onChange={setAddress} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600">{text('Exact coordinates *', 'الإحداثيات الدقيقة *')}</label>
              <button type="button" onClick={handleUseCurrentLocation} className="px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-bold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {text('Use my location', 'استخدم موقعي')}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={text('Latitude', 'خط العرض')} value={lat} onChange={setLat} inputMode="decimal" />
              <Field label={text('Longitude', 'خط الطول')} value={lng} onChange={setLng} inputMode="decimal" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">{text('Description *', 'الوصف *')}</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} required className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" placeholder={text('Write only details you personally know or can verify.', 'اكتب فقط ما تعرفه أو تستطيع التحقق منه.')}/>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">{text('Formation / history (optional)', 'التكوين / التاريخ (اختياري)')}</label>
            <textarea value={formationInfo} onChange={(event) => setFormationInfo(event.target.value)} rows={2} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" placeholder={text('Leave blank if you do not know verified background information.', 'اتركه فارغاً إذا لم تكن لديك معلومات موثقة.')}/>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={text('Real photo URL *', 'رابط صورة حقيقية للمكان *')} value={photoUrl} onChange={setPhotoUrl} type="url" placeholder="https://..." />
            <label className="block">
              <span className="block text-[11px] font-bold text-slate-600 mb-1">{text('Price level', 'مستوى السعر')}</span>
              <select value={priceLevel} onChange={(event) => setPriceLevel(event.target.value as '$' | '$$' | '$$$' | '$$$$')} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white">
                <option value="$">$</option><option value="$$">$$</option><option value="$$$">$$$</option><option value="$$$$">$$$$</option>
              </select>
            </label>
            <Field label={text('Opening hours (optional)', 'ساعات العمل (اختياري)')} value={openingHours} onChange={setOpeningHours} />
            <Field label={text('Phone (optional)', 'الهاتف (اختياري)')} value={contactPhone} onChange={setContactPhone} />
            {role === 'business_owner' && <Field label={text('Owner / operator name (optional)', 'اسم صاحب / مشغل النشاط (اختياري)')} value={businessOwnerName} onChange={setBusinessOwnerName} />}
          </div>

          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900">
            {text('Submitting as an owner does not verify ownership. Ratings, check-ins, trust flags, and verification are assigned only by server-side workflows.', 'الإرسال بصفة صاحب نشاط لا يثبت الملكية. التقييمات وتسجيلات الوصول وشارات الثقة والتحقق تُحدد فقط عبر مسارات الخادم.')}
          </div>

          <button type="submit" disabled={isSubmitting || isSuccess} className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />{text('Submitting...', 'جاري الإرسال...')}</> : isSuccess ? text('Submitted', 'تم الإرسال') : text('Submit place', 'إرسال المكان')}
          </button>
        </form>
      </div>
    </div>
  );
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-slate-600 mb-1">{label}</span>
      <input type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
    </label>
  );
}
