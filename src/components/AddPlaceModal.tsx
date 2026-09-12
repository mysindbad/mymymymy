import React, { useEffect, useState } from 'react';
import { X, MapPin, Building2, Landmark, Utensils, AlertTriangle, Tent, Plus, Check, Loader2, Sparkles, Navigation } from 'lucide-react';
import { PlaceCategory, Place } from '../types';
import { createPlace } from '../services/api';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';

interface AddPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaceAdded: (place: Place) => void;
  initialCoordinates?: [number, number];
  language?: SupportedLanguage;
}

export const AddPlaceModal: React.FC<AddPlaceModalProps> = ({
  isOpen,
  onClose,
  onPlaceAdded,
  initialCoordinates,
  language = 'en',
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';

  const [role, setRole] = useState<'business_owner' | 'community_traveler'>('business_owner');
  const [name, setName] = useState('');
  const [arabicName, setArabicName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('accommodation');
  const [subCategory, setSubCategory] = useState('');
  const [region, setRegion] = useState('Northern Morocco');
  const [area, setArea] = useState('Chefchaouen');
  const [lat, setLat] = useState(initialCoordinates?.[0]?.toString() || '');
  const [lng, setLng] = useState(initialCoordinates?.[1]?.toString() || '');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [formationInfo, setFormationInfo] = useState('');
  const [priceLevel, setPriceLevel] = useState<'$' | '$$' | '$$$' | '$$$$'>('$$');
  const [businessOwnerName, setBusinessOwnerName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [openingHours, setOpeningHours] = useState('09:00 - 22:00 Daily');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (initialCoordinates) {
      setLat(initialCoordinates[0].toString());
      setLng(initialCoordinates[1].toString());
    } else {
      setLat('');
      setLng('');
    }
  }, [isOpen, initialCoordinates]);

  // Preset photo suggestions by category
  const defaultPhotos: Record<PlaceCategory, string> = {
    accommodation: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
    tourist_poi: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&auto=format&fit=crop&q=80',
    restaurant: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
    emergency: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800&auto=format&fit=crop&q=80',
    campsite: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&auto=format&fit=crop&q=80',
    service: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&auto=format&fit=crop&q=80',
  };

  if (!isOpen) return null;

  const handleUseCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude.toFixed(5));
          setLng(pos.coords.longitude.toFixed(5));
        },
        () => {
          setErrorMessage(isAr ? 'تعذر الوصول إلى موقعك الحالي' : 'Could not access your current location');
        }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage(isAr ? 'يرجى كتابة اسم المكان' : 'Please enter place name');
      return;
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      setErrorMessage(isAr ? 'إحداثيات غير صحيحة' : 'Invalid coordinates');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name: name.trim(),
      arabicName: arabicName.trim() || name.trim(),
      category,
      subCategory: subCategory.trim() || (category === 'accommodation' ? 'Riad / Guesthouse' : 'Local Landmark'),
      region,
      area: area.trim() || 'Northern Morocco',
      coordinates: [latitude, longitude] as [number, number],
      address: address.trim() || `${name}, ${area}, Morocco`,
      photos: [photoUrl.trim() || defaultPhotos[category]],
      description: description.trim() || `${name} in ${area}, welcoming visitors and travelers.`,
      formationInfo: formationInfo.trim() || 'Documented by the local community on Sindbad.',
      priceLevel,
      openingHours,
      contactPhone: contactPhone.trim(),
      source: role,
      businessOwnerName: role === 'business_owner' ? businessOwnerName.trim() || 'Verified Local Owner' : undefined,
      ownerVerified: role === 'business_owner',
      features: {
        familyFriendly: true,
        accessible: false,
        wifi: true,
        parking: true,
      },
    };

    const result = await createPlace(payload);
    setIsSubmitting(false);

    if (result.success && result.place) {
      setIsSuccess(true);
      onPlaceAdded(result.place);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1200);
    } else {
      setErrorMessage(result.error || (isAr ? 'فشل الحفظ، حاول مجدداً' : 'Failed to create listing'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-xs">
              <Plus className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight leading-tight">
                {isAr ? 'إضافة نشاط تجاري أو معلم للمجتمع' : 'Add Place or Business Listing'}
              </h2>
              <p className="text-xs text-blue-100">
                {isAr ? 'يغذي خريطة سندباد الحية والذاكرة الذكية فوراً' : 'Feeds into shared AI memory & live map instantly'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Submitter Role Selector (Local Business Owner vs Explorer) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              {isAr ? 'هل أنت صاحب المشروع أم مسافر مكتشف؟' : 'Are you the Business Owner or a Traveler Explorer?'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('business_owner')}
                className={`p-3 rounded-2xl border text-left rtl:text-right transition flex items-center gap-2.5 ${
                  role === 'business_owner'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Building2 className={`w-5 h-5 ${role === 'business_owner' ? 'text-blue-600' : 'text-slate-400'}`} />
                <div>
                  <div className="font-bold text-xs">{isAr ? 'صاحب نشاط محلي' : 'Local Business Owner'}</div>
                  <div className="text-[10px] text-slate-500">{isAr ? 'فندق، مطعم، نزل ريفي، مقهى' : 'Hotel, riad, restaurant, guide'}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole('community_traveler')}
                className={`p-3 rounded-2xl border text-left rtl:text-right transition flex items-center gap-2.5 ${
                  role === 'community_traveler'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Landmark className={`w-5 h-5 ${role === 'community_traveler' ? 'text-blue-600' : 'text-slate-400'}`} />
                <div>
                  <div className="font-bold text-xs">{isAr ? 'مسافر / مستكشف' : 'Traveler / Pioneer'}</div>
                  <div className="text-[10px] text-slate-500">{isAr ? 'معلم طبيعي، نقطة مخفية' : 'Hidden gem, natural sight'}</div>
                </div>
              </button>
            </div>
          </div>

          {/* Place Category Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              {isAr ? 'تصنيف المكان' : 'Category'}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {[
                { cat: 'accommodation' as PlaceCategory, label: isAr ? 'إقامة ورياض' : 'Stay / Riad', icon: Building2 },
                { cat: 'tourist_poi' as PlaceCategory, label: isAr ? 'معلم / طبيعة' : 'Tourist POI', icon: Landmark },
                { cat: 'restaurant' as PlaceCategory, label: isAr ? 'مطعم / مقهى' : 'Food / Cafe', icon: Utensils },
                { cat: 'emergency' as PlaceCategory, label: isAr ? 'طوارئ / أمن' : 'Emergency', icon: AlertTriangle },
                { cat: 'campsite' as PlaceCategory, label: isAr ? 'مخيم / طبيعة' : 'Campsite', icon: Tent },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = category === item.cat;
                return (
                  <button
                    key={item.cat}
                    type="button"
                    onClick={() => setCategory(item.cat)}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Place Name & Arabic Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {isAr ? 'اسم المكان (إنجليزي / لاتيني)' : 'Place / Business Name (Required)'}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Riad Kasbah Akchour"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {isAr ? 'الاسم باللغة العربية' : 'Arabic Name (Optional)'}
              </label>
              <input
                type="text"
                value={arabicName}
                onChange={(e) => setArabicName(e.target.value)}
                placeholder="مثال: رياض قصبة أقشور"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Region & Area */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {isAr ? 'المنطقة الكبرى' : 'Region'}
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="Northern Morocco">Northern Morocco (Chefchaouen, Rif, Akchour)</option>
                <option value="Marrakech">Marrakech & High Atlas</option>
                <option value="Santorini">Santorini (Greece)</option>
                <option value="Global">Global Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {isAr ? 'المدينة / الوادي' : 'City / Area'}
              </label>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. Akchour, Chefchaouen, Tetouan"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Exact Coordinates with "Use My GPS" */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-600">
                {isAr ? 'الإحداثيات الجغرافية الدقيقة (خط الطول والعرض)' : 'Exact GPS Coordinates (Lat, Lng)'}
              </label>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Navigation className="w-3 h-3" />
                <span>{isAr ? 'استخدام موقعي الحالي' : 'Use Current GPS'}</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-[11px]">Lat:</span>
                <input
                  type="text"
                  required
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="35.1689"
                  className="w-full pl-11 pr-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-[11px]">Lng:</span>
                <input
                  type="text"
                  required
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="-5.2633"
                  className="w-full pl-11 pr-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Description & Formation Background (Feature 1 & 2) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {isAr ? 'وصف المكان وما يميزه' : 'Description & Highlights'}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isAr
                  ? 'صف الأجواء، الخدمات، الإطلالة الجبلية أو المعالم القريبة...'
                  : 'Describe the ambiance, views, local specialties or experience...'
              }
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {isAr ? 'معلومات التكوين أو التاريخ المحلي (Formation / History)' : 'Formation / Historical Background'}
            </label>
            <textarea
              rows={2}
              value={formationInfo}
              onChange={(e) => setFormationInfo(e.target.value)}
              placeholder={
                isAr
                  ? 'كيف تم تأسيسه؟ تاريخ المعلم أو التكوين الجيولوجي أو معلومات عن الحرفيين...'
                  : 'Historical origin, architectural story, geological formation, or local background...'
              }
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Business Owner Credentials if role === 'business_owner' */}
          {role === 'business_owner' && (
            <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-100 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>{isAr ? 'بيانات المالك للتحقق والتوثيق' : 'Business Owner Details & Verification'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={businessOwnerName}
                  onChange={(e) => setBusinessOwnerName(e.target.value)}
                  placeholder={isAr ? 'اسم المالك أو المدير' : 'Owner / Manager Name'}
                  className="px-3 py-2 rounded-xl border border-blue-200 text-slate-800 text-xs bg-white outline-none"
                />
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder={isAr ? 'رقم الهاتف (+212...)' : 'Phone Number (+212...)'}
                  className="px-3 py-2 rounded-xl border border-blue-200 text-slate-800 text-xs bg-white outline-none"
                />
              </div>
            </div>
          )}

          {/* Photo URL */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {isAr ? 'رابط الصورة (Photo URL)' : 'Photo URL (Leave empty for category default)'}
            </label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder={defaultPhotos[category]}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Footer Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{isAr ? 'جاري الحفظ في الذاكرة...' : 'Saving to AI Memory...'}</span>
                </>
              ) : isSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300 stroke-[3]" />
                  <span>{isAr ? 'تمت الإضافة بنجاح!' : 'Successfully Listed & Saved!'}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>{isAr ? 'نشر المكان وحفظه في الذاكرة الحية' : 'Publish & Save to Shared AI Memory'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
