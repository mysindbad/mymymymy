import React, { useEffect, useState } from 'react';
import { Landmark, MapPin, Plus, Building2, Tent, Utensils, AlertTriangle } from 'lucide-react';
import { Place, PlaceCategory } from '../types';
import { createPlace } from '../services/api';
import { SupportedLanguage } from '../data/translations';
import { useAuthSession } from '../lib/authSession';
import { useLocale } from '../lib/i18n';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Select, TextArea, TextInput } from '../ui/Field';
import { Alert, ErrorState } from '../ui/Feedback';
import { Divider, SectionHeading } from '../ui/Panel';

interface AddPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaceAdded: (place: Place) => void;
  initialCoordinates?: [number, number];
  onOpenAuth?: () => void;
  language?: SupportedLanguage;
}

const categories: Array<{ cat: PlaceCategory; en: string; ar: string; fr: string; icon: React.ComponentType<{ className?: string }> }> = [
  { cat: 'accommodation', en: 'Stay', ar: 'إقامة', fr: 'Hébergement', icon: Building2 },
  { cat: 'tourist_poi', en: 'Sight', ar: 'معلم', fr: 'Lieu', icon: Landmark },
  { cat: 'restaurant', en: 'Food', ar: 'مطعم', fr: 'Restaurant', icon: Utensils },
  { cat: 'emergency', en: 'Emergency', ar: 'طوارئ', fr: 'Urgence', icon: AlertTriangle },
  { cat: 'campsite', en: 'Campsite', ar: 'مخيم', fr: 'Camping', icon: Tent },
];

type FieldKey = 'name' | 'region' | 'area' | 'address' | 'description' | 'coordinates' | 'photo';

export const AddPlaceModal: React.FC<AddPlaceModalProps> = ({
  isOpen,
  onClose,
  onPlaceAdded,
  initialCoordinates,
  onOpenAuth,
  language = 'en',
}) => {
  const locale = useLocale(language);
  const t = locale.t;
  const { status: authStatus } = useAuthSession();
  const isSignedIn = authStatus === 'authed';

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
  const [showDetails, setShowDetails] = useState(false);
  const [locating, setLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  useEffect(() => {
    if (!isOpen) return;
    if (initialCoordinates) {
      setLat(String(initialCoordinates[0]));
      setLng(String(initialCoordinates[1]));
    }
    setErrorMessage('');
    setFieldErrors({});
    setShowDetails(false);
  }, [isOpen, initialCoordinates]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFieldErrors((current) => ({ ...current, coordinates: t('This browser cannot share a location.', 'هذا المتصفح لا يستطيع مشاركة الموقع.', 'Ce navigateur ne peut pas partager la position.') }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setFieldErrors((current) => ({ ...current, coordinates: undefined }));
        setLocating(false);
      },
      () => {
        setLocating(false);
        setFieldErrors((current) => ({
          ...current,
          coordinates: t('Location access was denied. Enter the coordinates manually.', 'تم رفض الوصول إلى الموقع. أدخل الإحداثيات يدوياً.', 'Accès à la position refusé. Saisissez les coordonnées à la main.'),
        }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    const latitude = Number(lat);
    const longitude = Number(lng);
    const nextErrors: Partial<Record<FieldKey, string>> = {};

    if (!name.trim()) nextErrors.name = t('Required', 'مطلوب', 'Requis');
    if (!region.trim()) nextErrors.region = t('Required', 'مطلوب', 'Requis');
    if (!area.trim()) nextErrors.area = t('Required', 'مطلوب', 'Requis');
    if (!address.trim()) nextErrors.address = t('Required', 'مطلوب', 'Requis');
    if (!description.trim()) nextErrors.description = t('Required', 'مطلوب', 'Requis');
    if (!lat.trim() || !lng.trim() || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      nextErrors.coordinates = t('Enter coordinates between -90–90 and -180–180.', 'أدخل إحداثيات ضمن ‎-90–90 و‎-180–180.', 'Saisissez des coordonnées entre -90 à 90 et -180 à 180.');
    }
    if (photoUrl.trim()) {
      try {
        const parsed = new URL(photoUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
      } catch {
        nextErrors.photo = t('A photo link must start with http or https.', 'رابط الصورة يجب أن يبدأ بـ http أو https.', 'Un lien photo doit commencer par http ou https.');
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setErrorMessage(t('Some fields need attention.', 'بعض الحقول تحتاج تصحيحاً.', 'Certains champs sont à corriger.'));
      return;
    }
    setFieldErrors({});

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
      photos: photoUrl.trim() ? [photoUrl.trim()] : [],
      description: description.trim(),
      formationInfo: formationInfo.trim() || undefined,
      priceLevel,
      openingHours: openingHours.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      businessOwnerName: businessOwnerName.trim() || undefined,
    };

    const result = await createPlace(payload);
    setIsSubmitting(false);
    if (!result.success || !result.place) {
      setErrorMessage(result.error || t('The place was not submitted. Try again.', 'لم تُرسل البيانات. حاول مجدداً.', 'L’envoi a échoué. Réessayez.'));
      return;
    }
    setIsSuccess(true);
    onPlaceAdded(result.place);
    window.setTimeout(() => {
      setIsSuccess(false);
      setName('');
      setArabicName('');
      setSubCategory('');
      setRegion('');
      setArea('');
      setAddress('');
      setDescription('');
      setFormationInfo('');
      setPhotoUrl('');
      setBusinessOwnerName('');
      setContactPhone('');
      setOpeningHours('');
      onClose();
    }, 900);
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title={t('Add a place', 'إضافة مكان', 'Ajouter un lieu')}
      subtitle={t('Reviewed before it appears publicly', 'تُراجع قبل النشر', 'Vérifiée avant publication')}
      size="md"
      language={language}
      footer={isSignedIn ? (
        <Button
          type="submit"
          form="add-place-form"
          full
          loading={isSubmitting}
          disabled={isSuccess}
          icon={!isSubmitting && !isSuccess ? <Plus className="h-4 w-4" /> : undefined}
        >
          {isSuccess
            ? t('Submitted', 'تم الإرسال', 'Envoyé')
            : t('Submit place', 'إرسال المكان', 'Proposer le lieu')}
        </Button>
      ) : undefined}
    >
      {!isSignedIn ? (
        <div className="px-4 pb-6 pt-4 sm:px-5">
          <ErrorState
            title={t('Sign in to add a place', 'سجّل الدخول لإضافة مكان', 'Connectez-vous pour ajouter un lieu')}
            description={t(
              'Submissions are tied to an account so places can be checked later.',
              'الرسائل مرتبطة بحساب حتى يمكن التحقق من الأماكن لاحقاً.',
              'Les propositions sont liées à un compte pour pouvoir vérifier les lieux plus tard.',
            )}
          >
            {onOpenAuth && (
              <Button size="sm" onClick={onOpenAuth} className="mt-3">
                {t('Sign in', 'تسجيل الدخول', 'Se connecter')}
              </Button>
            )}
          </ErrorState>
        </div>
      ) : (
        <form id="add-place-form" onSubmit={handleSubmit} className="space-y-4 px-4 pb-6 pt-3 sm:px-5">
          {errorMessage && (
            <Alert tone="error" title={t('Not submitted', 'لم يُرسل', 'Envoi impossible')}>
              {errorMessage}
            </Alert>
          )}

          <SectionHeading size="sm" className="px-0 pb-1" title={t('What it is', 'ما هو المكان', 'De quoi il s’agit')} />
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {categories.map((item) => {
              const selected = category === item.cat;
              const Icon = item.icon;
              return (
                <button
                  key={item.cat}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategory(item.cat)}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-1.5 text-micro font-semibold transition-colors ${
                    selected
                      ? 'border-brand-500 bg-brand-soft text-brand-accent'
                      : 'border-line bg-surface text-muted hover:bg-surface-muted hover:text-ink'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{locale.isArabic ? item.ar : locale.isFrench ? item.fr : item.en}</span>
                </button>
              );
            })}
          </div>

          <TextInput
            id="add-place-name"
            label={t('Name', 'الاسم', 'Nom')}
            required
            value={name}
            error={fieldErrors.name}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
            placeholder={t('e.g. God’s Bridge viewpoint', 'مثال: نقطة مشاهدة جسر الله', 'Ex. Point de vue du Pont de Dieu')}
          />
          <div className="grid-cols-1 grid gap-3 sm:grid-cols-2">
            <TextInput
              id="add-place-name-ar"
              label={t('Name in Arabic', 'الاسم بالعربية', 'Nom en arabe')}
              value={arabicName}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setArabicName(event.target.value)}
            />
            <TextInput
              id="add-place-type"
              label={t('Type', 'النوع', 'Type')}
              value={subCategory}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSubCategory(event.target.value)}
              placeholder={t('waterfall, riad, fondak…', 'شلال، رياض، فندق…', 'cascade, riad, fondak…')}
            />
          </div>

          <Divider className="my-1" />

          <SectionHeading
            size="sm"
            className="px-0 pb-1"
            title={t('Where it is', 'أين يقع', 'Où il se trouve')}
            action={
              <Button size="sm" variant="quiet" onClick={handleUseCurrentLocation} loading={locating} icon={locating ? undefined : <MapPin className="h-3.5 w-3.5" />}>
                {t('Use my location', 'استخدم موقعي', 'Ma position')}
              </Button>
            }
          />
          <div className="grid-cols-1 grid gap-3 sm:grid-cols-2">
            <TextInput
              id="add-place-region"
              label={t('Region', 'المنطقة', 'Région')}
              required
              value={region}
              error={fieldErrors.region}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setRegion(event.target.value)}
              placeholder={t('Tanger-Tetouan-Al Hoceima', 'طنجة – تطوان – الحسيمة', 'Tanger-Tétouan-Al Hoceïma')}
            />
            <TextInput
              id="add-place-area"
              label={t('City or area', 'المدينة أو المنطقة', 'Ville ou secteur')}
              required
              value={area}
              error={fieldErrors.area}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setArea(event.target.value)}
              placeholder={t('Chefchaouen', 'شفشاون', 'Chefchaouen')}
            />
          </div>
          <TextInput
            id="add-place-address"
            label={t('Address or how to find it', 'العنوان أو كيف تصل إليه', 'Adresse ou accès')}
            required
            value={address}
            error={fieldErrors.address}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setAddress(event.target.value)}
            placeholder={t('12 min on foot from Outine road', '12 دقيقة سيراً من طريق أوتيتن', '12 min à pied depuis la route d’Outine')}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              id="add-place-lat"
              label={t('Latitude', 'خط العرض', 'Latitude')}
              inputMode="decimal"
              required
              value={lat}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setLat(event.target.value)}
            />
            <TextInput
              id="add-place-lng"
              label={t('Longitude', 'خط الطول', 'Longitude')}
              inputMode="decimal"
              required
              value={lng}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setLng(event.target.value)}
            />
          </div>
          {fieldErrors.coordinates && (
            <p className="-mt-2 text-micro text-negative" role="alert">{fieldErrors.coordinates}</p>
          )}

          <TextArea
            id="add-place-description"
            label={t('What makes it worth a visit', 'ما الذي يجعله جديراً بالزيارة', 'Ce qui le rend intéressant')}
            rows={3}
            required
            value={description}
            error={fieldErrors.description}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(event.target.value)}
            placeholder={t(
              'Describe it the way you would tell a friend.',
              'صِفه كما تشرحه لصديق.',
              'Décrivez-le comme vous le raconteriez à un ami.',
            )}
          />

          <button
            type="button"
            onClick={() => setShowDetails((current) => !current)}
            aria-expanded={showDetails}
            className="flex min-h-11 w-full items-center justify-between rounded-lg px-1 text-body font-bold text-brand-accent"
          >
            {t('Details (optional)', 'تفاصيل اختيارية', 'Détails (facultatif)')}
            <span className="text-caption font-normal text-muted">{showDetails ? t('Hide', 'إخفاء', 'Masquer') : t('Show', 'إظهار', 'Afficher')}</span>
          </button>

          {showDetails && (
            <div className="space-y-3 rounded-lg border border-line bg-surface-muted p-3">
              <TextArea
                id="add-place-history"
                label={t('Background', 'خلفية', 'Contexte')}
                rows={2}
                value={formationInfo}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setFormationInfo(event.target.value)}
              />
              <div className="grid-cols-1 grid gap-3 sm:grid-cols-2">
                <Select
                  id="add-place-price"
                  label={t('Price', 'السعر', 'Tarif')}
                  value={priceLevel}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setPriceLevel(event.target.value as '$' | '$$' | '$$$' | '$$$$')}
                >
                  <option value="$">$</option>
                  <option value="$$">$$</option>
                  <option value="$$$">$$$</option>
                  <option value="$$$$">$$$$</option>
                </Select>
                <TextInput
                  id="add-place-hours"
                  label={t('Opening hours', 'ساعات العمل', 'Horaires')}
                  value={openingHours}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setOpeningHours(event.target.value)}
                  placeholder={t('Mon–Sat, 9:00–18:00', 'الإثنين–السبت، 9:00–18:00', 'Lun–Sam, 9h00–18h00')}
                />
                <TextInput
                  id="add-place-phone"
                  label={t('Phone', 'الهاتف', 'Téléphone')}
                  type="tel"
                  value={contactPhone}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setContactPhone(event.target.value)}
                />
                <TextInput
                  id="add-place-owner"
                  label={t('Owner or contact name', 'اسم المسؤول أو جهة الاتصال', 'Responsable ou contact')}
                  value={businessOwnerName}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setBusinessOwnerName(event.target.value)}
                />
              </div>
              <TextInput
                id="add-place-photo"
                type="url"
                label={t('Photo link', 'رابط صورة', 'Lien photo')}
                inputMode="url"
                value={photoUrl}
                error={fieldErrors.photo}
                hint={t('A direct image link, if you have one.', 'رابط صورة مباشر إن توفّر.', 'Un lien d’image direct, si vous en avez un.')}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPhotoUrl(event.target.value)}
                placeholder="https://…"
              />
            </div>
          )}
        </form>
      )}
    </Sheet>
  );
};
