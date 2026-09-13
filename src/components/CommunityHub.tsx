import React from 'react';
import { Mail, Plus, Radio, ShieldCheck } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';
import { UserAvatar } from './UserAvatar';

interface CommunityHubProps {
  onOpenAddModal: () => void;
  onOpenPassiveModal: () => void;
  isPassiveOptedIn: boolean;
  userXp: number;
  language?: SupportedLanguage;
  currentUser?: { name: string; email: string; avatarUrl?: string; isLoggedIn?: boolean };
  onOpenAuth?: () => void;
}

export const CommunityHub: React.FC<CommunityHubProps> = ({
  onOpenAddModal,
  onOpenPassiveModal,
  isPassiveOptedIn,
  language = 'en',
  currentUser,
  onOpenAuth,
}) => {
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const localize = (english: string, arabic: string, french: string) =>
    isAr ? arabic : isFr ? french : english;
  const isLoggedIn = Boolean(currentUser?.isLoggedIn);
  const displayName = isLoggedIn && currentUser?.name
    ? currentUser.name
    : localize('Guest traveler', 'مسافر زائر', 'Voyageur invité');

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4 pb-24">
      <section className="rounded-3xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar
            name={currentUser?.name}
            avatarUrl={currentUser?.avatarUrl}
            className="h-14 w-14 shrink-0 rounded-2xl"
            textClassName="text-2xl"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {localize('Account', 'الحساب', 'Compte')}
            </p>
            <h1 className="text-lg font-black text-slate-900 truncate">{displayName}</h1>
            {isLoggedIn && currentUser?.email ? (
              <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                {currentUser.email}
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                {localize('Guest mode', 'وضع الزائر', 'Mode invité')}
              </p>
            )}
          </div>
        </div>
        {!isLoggedIn && onOpenAuth && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-4 w-full py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
          >
            {localize('Sign in to save trips and contributions', 'سجّل الدخول لحفظ الرحلات والمساهمات', 'Connectez-vous pour enregistrer vos voyages et contributions')}
          </button>
        )}
      </section>

      <section className="rounded-3xl bg-slate-50 border border-slate-200 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-black text-slate-900">
              {localize('Community reputation', 'سمعة المجتمع', 'Réputation communautaire')}
            </h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              {localize(
                'XP and levels are not shown yet. They will only be enabled when contribution scores are calculated and stored by the server.',
                'لا نعرض نقاط XP أو المستويات حالياً. لن يتم تفعيلها إلا عندما تُحسب درجات المساهمات وتُحفظ من الخادم.',
                'Les XP et niveaux ne sont pas encore affichés. Ils ne seront activés que lorsque les scores de contribution seront calculés et stockés côté serveur.'
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="font-black text-slate-900">{localize('Your contributions', 'مساهماتك', 'Vos contributions')}</h2>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            {localize('Add a place or manage optional GPS sharing from here.', 'أضف مكاناً أو أدر مشاركة GPS الاختيارية من هنا.', 'Ajoutez un lieu ou gérez le partage GPS facultatif depuis ici.')}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onOpenAddModal}
            className="py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            {localize('Add a place', 'إضافة مكان', 'Ajouter un lieu')}
          </button>
          <button
            type="button"
            onClick={onOpenPassiveModal}
            className="py-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            <Radio className="w-4 h-4" />
            {isPassiveOptedIn
              ? localize('Location contribution preference is on', 'تفضيل مساهمة الموقع مفعّل', 'Préférence de contribution de localisation activée')
              : localize('Manage location contribution', 'إدارة مساهمة الموقع', 'Gérer la contribution de localisation')}
          </button>
        </div>
      </section>
    </div>
  );
};
