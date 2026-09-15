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

const categories: Array<{ cat: PlaceCategory; en: string; ar: string; fr: string; icon: React.ComponentType<{ className?: string }> }> = [
  { cat: 'accommodation', en: 'Stay', ar: 'إقامة', fr: 'Hébergement', icon: Building2 },
  { cat: 'tourist_poi', en: 'Sight', ar: 'معلم', fr: 'Site', icon: Landmark },
  { cat: 'restaurant', en: 'Food', ar: 'مطعم', fr: 'Restauration', icon: Utensils },
  { cat: 'emergency', en: 'Emergency', ar: 'طوارئ', fr: 'Urgence', icon: AlertTriangle },
  { cat: 'campsite', en: 'Campsite', ar: 'مخيم', fr: 'Camping', icon: Tent },
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
  const isFr = language === 'fr';
  // The contribution form is offered to French speakers too, so every label
  // needs a real French string rather than an English fallback.
  const text = (en: string, ar: string, fr: string) => (isAr ? ar : isFr ? fr : en);

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
      setErrorMessage(text('Location is not supported.', 'الموقع غير مدعوم.', 'La localisation n’est pas prise en charge.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setErrorMessage('');
      },
      () => setErrorMessage(text('Could not access your location.', 'تعذر الوصول إلى موقعك.', 'Impossible d’accéder à votre position.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!name.trim() || !region.trim() || !area.trim() || !address.trim() || !description.trim() || !photoUrl.trim()) {
      setErrorMessage(text('Complete the required fields.', 'أكمل الحقول المطلوبة.', 'Complétez les champs obligatoires.'));
      return;
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setErrorMessage(text('Enter valid coordinates.', 'أدخل إحداثيات صحيحة.', 'Saisissez des coordonnées valides.'));
      return;
    }
    try {
      const parsedPhoto = new URL(photoUrl.trim());
      if (!['http:', 'https:'].includes(parsedPhoto.protocol)) throw new Error('invalid protocol');
    } catch {
      setErrorMessage(text('Enter a valid photo URL.', 'أدخل رابط صورة صالحاً.', 'Saisissez une URL de photo valide.'));
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
      setErrorMessage(result.error || text('Could not submit the place.', 'تعذر إرسال المكان.', 'Impossible d’envoyer le lieu.'));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 p-4 text-white sm:p-5">
          <div className="flex items-center gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20"><Plus className="h-5 w-5" /></span><h2 className="text-base font-bold">{text('Add Place', 'إضافة مكان', 'Ajouter un lieu')}</h2></div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20" aria-label={text('Close', 'إغلاق', 'Fermer')}><X className="h-4 w-4" /></button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-5 text-xs text-slate-700">
          {errorMessage && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 font-medium text-rose-700">{errorMessage}</div>}

          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-slate-500">{text('I am', 'أنا', 'Je suis')}</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRole('business_owner')} className={`rounded-2xl border p-3 text-start ${role === 'business_owner' ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 bg-slate-50'}`}><Building2 className="mb-1 h-5 w-5" /><div className="font-bold">{text('Owner', 'صاحب النشاط', 'Propriétaire')}</div></button>
              <button type="button" onClick={() => setRole('community_traveler')} className={`rounded-2xl border p-3 text-start ${role === 'community_traveler' ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 bg-slate-50'}`}><Landmark className="mb-1 h-5 w-5" /><div className="font-bold">{text('Traveler', 'مسافر', 'Voyageur')}</div></button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-slate-500">{text('Category', 'التصنيف', 'Catégorie')}</label>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {categories.map((item) => {
                const Icon = item.icon;
                return <button key={item.cat} type="button" onClick={() => setCategory(item.cat)} className={`flex flex-col items-center gap-1 rounded-xl border p-2 ${category === item.cat ? 'border-blue-600 bg-blue-600 font-bold text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><Icon className="h-4 w-4" /><span className="text-[10px]">{text(item.en, item.ar, item.fr)}</span></button>;
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={text('Name *', 'الاسم *', 'Nom *')} value={name} onChange={setName} />
            <Field label={text('Arabic name', 'الاسم بالعربية', 'Nom en arabe')} value={arabicName} onChange={setArabicName} />
            <Field label={text('Type', 'النوع', 'Type')} value={subCategory} onChange={setSubCategory} />
            <Field label={text('Region *', 'المنطقة *', 'Région *')} value={region} onChange={setRegion} />
            <Field label={text('City / area *', 'المدينة / المنطقة *', 'Ville / zone *')} value={area} onChange={setArea} />
            <Field label={text('Address *', 'العنوان *', 'Adresse *')} value={address} onChange={setAddress} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between"><label className="text-[11px] font-bold text-slate-600">{text('Coordinates *', 'الإحداثيات *', 'Coordonnées *')}</label><button type="button" onClick={handleUseCurrentLocation} className="flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5 font-bold text-blue-700"><MapPin className="h-3.5 w-3.5" />{text('Use my location', 'استخدم موقعي', 'Utiliser ma position')}</button></div>
            <div className="grid grid-cols-2 gap-3"><Field label={text('Latitude', 'خط العرض', 'Latitude')} value={lat} onChange={setLat} inputMode="decimal" /><Field label={text('Longitude', 'خط الطول', 'Longitude')} value={lng} onChange={setLng} inputMode="decimal" /></div>
          </div>

          <label className="block"><span className="mb-1 block text-[11px] font-bold text-slate-600">{text('Description *', 'الوصف *', 'Description *')}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} required className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-blue-500" placeholder={text('Description', 'الوصف', 'Description')} /></label>
          <label className="block"><span className="mb-1 block text-[11px] font-bold text-slate-600">{text('History', 'التاريخ', 'Histoire')}</span><textarea value={formationInfo} onChange={(event) => setFormationInfo(event.target.value)} rows={2} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-blue-500" placeholder={text('Optional', 'اختياري', 'Facultatif')} /></label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={text('Photo URL *', 'رابط الصورة *', 'URL de la photo *')} value={photoUrl} onChange={setPhotoUrl} type="url" placeholder="https://..." />
            <label className="block"><span className="mb-1 block text-[11px] font-bold text-slate-600">{text('Price', 'السعر', 'Prix')}</span><select value={priceLevel} onChange={(event) => setPriceLevel(event.target.value as '$' | '$$' | '$$$' | '$$$$')} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5"><option value="$">$</option><option value="$$">$$</option><option value="$$$">$$$</option><option value="$$$$">$$$$</option></select></label>
            <Field label={text('Opening hours', 'ساعات العمل', 'Horaires d’ouverture')} value={openingHours} onChange={setOpeningHours} />
            <Field label={text('Phone', 'الهاتف', 'Téléphone')} value={contactPhone} onChange={setContactPhone} />
            {role === 'business_owner' && <Field label={text('Owner name', 'اسم صاحب النشاط', 'Nom du propriétaire')} value={businessOwnerName} onChange={setBusinessOwnerName} />}
          </div>

          <button type="submit" disabled={isSubmitting || isSuccess} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-50">
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />{text('Submitting…', 'جارٍ الإرسال…', 'Envoi en cours…')}</> : isSuccess ? text('Submitted', 'تم الإرسال', 'Envoyé') : text('Submit', 'إرسال', 'Envoyer')}
          </button>
        </form>
      </div>
    </div>
  );
};

function Field({ label, value, onChange, placeholder, type = 'text', inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: React.HTMLInputTypeAttribute; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-bold text-slate-600">{label}</span><input type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" /></label>;
}
