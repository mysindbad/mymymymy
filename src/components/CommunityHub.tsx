import React from 'react';
import { Award, Mail, Plus, Radio, UserRound } from 'lucide-react';
import { SupportedLanguage } from '../data/translations';

interface CommunityHubProps {
  onOpenAddModal: () => void;
  onOpenPassiveModal: () => void;
  isPassiveOptedIn: boolean;
  userXp: number;
  language?: SupportedLanguage;
  currentUser?: { name: string; email: string; avatar?: string; isLoggedIn?: boolean };
  onOpenAuth?: () => void;
}

export const CommunityHub: React.FC<CommunityHubProps> = ({
  onOpenAddModal,
  onOpenPassiveModal,
  isPassiveOptedIn,
  userXp,
  language = 'en',
  currentUser,
  onOpenAuth,
}) => {
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const userLevel = Math.max(1, Math.floor(userXp / 200) + 1);
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white text-2xl shrink-0">
            {currentUser?.avatar || '🧔'}
          </div>
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
            {localize('Sign in to save your account progress', 'سجّل الدخول لحفظ تقدم حسابك', 'Connectez-vous pour conserver votre progression')}
          </button>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-blue-50 border border-blue-100 p-4">
          <Award className="w-5 h-5 text-blue-600 mb-3" />
          <p className="text-[11px] font-bold text-blue-700">{localize('Experience', 'الخبرة', 'Expérience')}</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{userXp}</p>
          <p className="text-[11px] text-slate-500">XP</p>
        </div>
        <div className="rounded-3xl bg-amber-50 border border-amber-100 p-4">
          <UserRound className="w-5 h-5 text-amber-600 mb-3" />
          <p className="text-[11px] font-bold text-amber-700">{localize('Level', 'المستوى', 'Niveau')}</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{userLevel}</p>
          <p className="text-[11px] text-slate-500">{localize('Current level', 'المستوى الحالي', 'Niveau actuel')}</p>
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
              ? localize('GPS sharing is on', 'مشاركة GPS مفعّلة', 'Partage GPS activé')
              : localize('Manage GPS sharing', 'إدارة مشاركة GPS', 'Gérer le partage GPS')}
          </button>
        </div>
      </section>
    </div>
  );
};
