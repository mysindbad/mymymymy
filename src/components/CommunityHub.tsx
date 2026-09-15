import React from 'react';
import { Plus, Radio } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';

interface CommunityHubProps {
  onOpenAddModal: () => void;
  onOpenPassiveModal: () => void;
  isPassiveOptedIn: boolean;
  language?: SupportedLanguage;
}

export const CommunityHub: React.FC<CommunityHubProps> = ({
  onOpenAddModal,
  onOpenPassiveModal,
  isPassiveOptedIn,
  language = 'en',
}) => {
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const t = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24 sm:p-6" dir={isAr ? 'rtl' : 'ltr'}>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-black text-slate-900">{t('Community', 'المجتمع', 'Communauté')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('Help travelers by adding useful places.', 'ساعد المسافرين بإضافة أماكن مفيدة.', 'Aidez les voyageurs en ajoutant des lieux utiles.')}</p>
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onOpenAddModal} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-3xl bg-slate-900 p-4 text-sm font-bold text-white shadow-sm"><Plus className="h-5 w-5" />{t('Add Place', 'إضافة مكان', 'Ajouter un lieu')}</button>
        <button type="button" onClick={onOpenPassiveModal} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><Radio className="h-5 w-5" />{isPassiveOptedIn ? t('Location sharing: On', 'مشاركة الموقع: مفعّلة', 'Partage de localisation : activé') : t('Location sharing', 'مشاركة الموقع', 'Partage de localisation')}</button>
      </section>
    </div>
  );
};
