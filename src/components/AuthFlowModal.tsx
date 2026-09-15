import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import santoriniBg from '../assets/images/santorini_bg.jpg';
import { SupportedLanguage } from '../data/translations';
import { LanguageFlagSelector } from './LanguageFlagSelector';
import { getAuthRedirectUrl, getPasswordRecoveryRedirectUrl, supabase } from '../lib/supabase';

export type AuthScreenType =
  | 'welcome'
  | 'sign-in-method'
  | 'sign-in-email'
  | 'create-account'
  | 'forgot-password'
  | 'reset-password';

interface AuthFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialScreen?: AuthScreenType;
  onAuthSuccess?: (user: { name: string; email: string; avatar: string; xp?: number }) => void;
  language?: SupportedLanguage;
  onToggleLanguage?: (lang: SupportedLanguage) => void;
}

export const AuthFlowModal: React.FC<AuthFlowModalProps> = ({
  isOpen,
  onClose,
  initialScreen = 'welcome',
  onAuthSuccess,
  language = 'en',
  onToggleLanguage,
}) => {
  const [currentScreen, setCurrentScreen] = useState<AuthScreenType>(initialScreen);
  const [screenHistory, setScreenHistory] = useState<AuthScreenType[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const localize = (english: string, arabic: string, french: string) =>
    isAr ? arabic : isFr ? french : english;

  useEffect(() => {
    if (!isOpen) return;
    setCurrentScreen(initialScreen);
    setScreenHistory([]);
    setStatusMessage(null);
  }, [isOpen, initialScreen]);

  if (!isOpen) return null;

  const localizeAuthError = (message: string) => {
    const normalized = message.trim().toLowerCase();
    if (normalized.includes('invalid login credentials')) {
      return localize('Invalid email or password.', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'E-mail ou mot de passe incorrect.');
    }
    if (normalized.includes('email not confirmed')) {
      return localize('Confirm your email before signing in.', 'أكد بريدك الإلكتروني قبل تسجيل الدخول.', 'Confirmez votre e-mail avant de vous connecter.');
    }
    if (normalized.includes('user already registered')) {
      return localize('This email is already registered.', 'هذا البريد الإلكتروني مسجل بالفعل.', 'Cette adresse e-mail est déjà inscrite.');
    }
    return message;
  };

  const navigateTo = (screen: AuthScreenType) => {
    setScreenHistory((history) => [...history, currentScreen]);
    setCurrentScreen(screen);
    setStatusMessage(null);
  };

  const handleBack = () => {
    if (screenHistory.length === 0) {
      setCurrentScreen('welcome');
      return;
    }
    const previous = screenHistory[screenHistory.length - 1];
    setScreenHistory((history) => history.slice(0, -1));
    setCurrentScreen(previous);
    setStatusMessage(null);
  };

  const completeAuth = (user: { email?: string; user_metadata?: Record<string, unknown> }) => {
    const metadata = user.user_metadata || {};
    const metadataXp = Number(metadata.community_xp);
    onAuthSuccess?.({
      name: typeof metadata.full_name === 'string' && metadata.full_name.trim()
        ? metadata.full_name
        : user.email?.split('@')[0] || 'Traveler',
      email: user.email || '',
      avatar: typeof metadata.avatar_url === 'string' && metadata.avatar_url ? metadata.avatar_url : '🧭',
      xp: Number.isFinite(metadataXp) && metadataXp >= 0 ? Math.floor(metadataXp) : undefined,
    });
    onClose();
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl(),
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      setIsLoading(false);
      setStatusMessage(localizeAuthError(error.message));
      return;
    }
    if (!data.url) {
      setIsLoading(false);
      setStatusMessage(localize('Google sign-in could not start.', 'تعذر بدء تسجيل الدخول عبر Google.', 'Impossible de démarrer la connexion Google.'));
      return;
    }
    window.location.assign(data.url);
  };

  const handleEmailSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setStatusMessage(localize('Enter your email and password.', 'أدخل البريد الإلكتروني وكلمة المرور.', 'Saisissez votre e-mail et votre mot de passe.'));
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (error) {
      setStatusMessage(localizeAuthError(error.message));
      return;
    }
    if (data.user) completeAuth(data.user);
  };

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password || !fullName || !country) {
      setStatusMessage(localize('Complete the required fields.', 'أكمل الحقول المطلوبة.', 'Complétez les champs requis.'));
      return;
    }
    if (!agreedToTerms) {
      setStatusMessage(localize('Accept the terms to continue.', 'وافق على الشروط للمتابعة.', 'Acceptez les conditions pour continuer.'));
      return;
    }
    if (password.length < 6) {
      setStatusMessage(localize('Use at least 6 characters.', 'استخدم 6 أحرف على الأقل.', 'Utilisez au moins 6 caractères.'));
      return;
    }
    if (password !== confirmPassword) {
      setStatusMessage(localize('Passwords do not match.', 'كلمتا المرور غير متطابقتين.', 'Les mots de passe ne correspondent pas.'));
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, country, preferred_language: language } },
    });
    setIsLoading(false);
    if (error) {
      setStatusMessage(localizeAuthError(error.message));
      return;
    }
    if (data.user && data.session) completeAuth(data.user);
    else setStatusMessage(localize('Check your email to confirm your account.', 'تحقق من بريدك لتأكيد حسابك.', 'Consultez votre e-mail pour confirmer votre compte.'));
  };

  const handleSendResetLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) {
      setStatusMessage(localize('Enter your email address.', 'أدخل بريدك الإلكتروني.', 'Saisissez votre adresse e-mail.'));
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: getPasswordRecoveryRedirectUrl() });
    setIsLoading(false);
    setStatusMessage(error
      ? localizeAuthError(error.message)
      : localize('Reset link sent.', 'تم إرسال رابط إعادة التعيين.', 'Lien de réinitialisation envoyé.'));
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      setStatusMessage(localize('Use at least 6 characters.', 'استخدم 6 أحرف على الأقل.', 'Utilisez au moins 6 caractères.'));
      return;
    }
    if (password !== confirmPassword) {
      setStatusMessage(localize('Passwords do not match.', 'كلمتا المرور غير متطابقتين.', 'Les mots de passe ne correspondent pas.'));
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) {
      setStatusMessage(localizeAuthError(error.message));
      return;
    }
    setStatusMessage(localize('Password updated.', 'تم تحديث كلمة المرور.', 'Mot de passe mis à jour.'));
    navigateTo('sign-in-email');
  };

  const title = currentScreen === 'welcome'
    ? localize('Plan. Explore. Navigate.', 'خطط، استكشف، وتنقّل.', 'Planifiez. Explorez. Naviguez.')
    : currentScreen === 'sign-in-method'
      ? localize('Start your journey', 'ابدأ رحلتك', 'Commencez votre voyage')
      : currentScreen === 'sign-in-email'
        ? localize('Welcome Back', 'مرحباً بعودتك', 'Bon retour')
        : currentScreen === 'create-account'
          ? localize('Create account', 'إنشاء حساب', 'Créer un compte')
          : currentScreen === 'forgot-password'
            ? localize('Reset password', 'استعادة كلمة المرور', 'Réinitialiser le mot de passe')
            : localize('New password', 'كلمة مرور جديدة', 'Nouveau mot de passe');

  const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
  const primaryClass = 'w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-0 backdrop-blur-sm sm:p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="relative flex min-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl sm:min-h-0 sm:max-h-[92vh] sm:rounded-[2rem]">
        <div className="relative h-48 shrink-0 overflow-hidden bg-slate-900 sm:h-52">
          <img src={santoriniBg} alt="Travel coast" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-slate-950/20" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
            <div>
              {currentScreen !== 'welcome' && (
                <button type="button" onClick={handleBack} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/60 text-white backdrop-blur" aria-label={localize('Back', 'رجوع', 'Retour')}>
                  <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <LanguageFlagSelector currentLanguage={language} onSelectLanguage={(next) => onToggleLanguage?.(next)} variant="auth" />
              <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/60 text-white backdrop-blur" aria-label={localize('Close', 'إغلاق', 'Fermer')}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-4 flex flex-col items-center px-6 text-center text-white">
            <BrandLogo size="md" showSlogan={false} language={language} />
            <h1 className="mt-2 text-2xl font-black tracking-tight">{title}</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {statusMessage && (
            <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-xs font-bold text-blue-900" aria-live="polite">
              {statusMessage}
            </div>
          )}

          {currentScreen === 'welcome' && (
            <div className="space-y-4">
              <p className="text-center text-sm text-slate-600">
                {localize('Your travel companion for places, trips, and navigation.', 'رفيقك لاكتشاف الأماكن وتخطيط الرحلات والتنقّل.', 'Votre compagnon pour les lieux, les voyages et la navigation.')}
              </p>
              <button type="button" onClick={() => navigateTo('sign-in-method')} className={primaryClass}>
                <span className="flex items-center justify-center gap-2">{localize('Start Now', 'ابدأ الآن', 'Commencer')}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></span>
              </button>
              <button type="button" onClick={() => navigateTo('sign-in-email')} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                {localize('I already have an account', 'لدي حساب بالفعل', 'J’ai déjà un compte')}
              </button>
            </div>
          )}

          {currentScreen === 'sign-in-method' && (
            <div className="space-y-3">
              <p className="mb-4 text-center text-sm text-slate-600">
                {localize('Choose how to continue.', 'اختر طريقة المتابعة.', 'Choisissez comment continuer.')}
              </p>
              <button type="button" disabled={isLoading} onClick={() => void handleGoogleAuth()} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
                Google
              </button>
              <button type="button" onClick={() => navigateTo('sign-in-email')} className={primaryClass}>
                {localize('Continue with email', 'المتابعة بالبريد الإلكتروني', 'Continuer avec e-mail')}
              </button>
              <button type="button" onClick={() => navigateTo('create-account')} className="w-full px-4 py-2 text-sm font-bold text-blue-600">
                {localize('Create account', 'إنشاء حساب', 'Créer un compte')}
              </button>
            </div>
          )}

          {currentScreen === 'sign-in-email' && (
            <form className="space-y-3" onSubmit={handleEmailSignIn}>
              <label className="block text-xs font-bold text-slate-700">{localize('Email', 'البريد الإلكتروني', 'E-mail')}</label>
              <div className="relative"><Mail className="absolute start-3 top-3.5 h-4 w-4 text-slate-400" /><input className={`${inputClass} ps-10`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" autoComplete="email" /></div>
              <label className="block text-xs font-bold text-slate-700">{localize('Password', 'كلمة المرور', 'Mot de passe')}</label>
              <div className="relative"><Lock className="absolute start-3 top-3.5 h-4 w-4 text-slate-400" /><input className={`${inputClass} ps-10 pe-11`} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute end-3 top-3 text-slate-400" aria-label={localize('Show password', 'إظهار كلمة المرور', 'Afficher le mot de passe')}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>
              <button type="submit" disabled={isLoading} className={primaryClass}>{isLoading ? localize('Signing in…', 'جارٍ تسجيل الدخول…', 'Connexion…') : 'Sign In'}</button>
              <div className="flex items-center justify-between gap-3 text-xs font-bold">
                <button type="button" onClick={() => navigateTo('forgot-password')} className="text-blue-600">{localize('Forgot password?', 'نسيت كلمة المرور؟', 'Mot de passe oublié ?')}</button>
                <button type="button" onClick={() => navigateTo('create-account')} className="text-slate-600">{localize('Create account', 'إنشاء حساب', 'Créer un compte')}</button>
              </div>
            </form>
          )}

          {currentScreen === 'create-account' && (
            <form className="space-y-3" onSubmit={handleCreateAccount}>
              <div className="relative"><User className="absolute start-3 top-3.5 h-4 w-4 text-slate-400" /><input className={`${inputClass} ps-10`} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={localize('Full name', 'الاسم الكامل', 'Nom complet')} autoComplete="name" /></div>
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" autoComplete="email" />
              <input className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)} placeholder={localize('Country', 'البلد', 'Pays')} autoComplete="country-name" />
              <div className="relative"><input className={`${inputClass} pe-11`} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute end-3 top-3 text-slate-400" aria-label={localize('Show password', 'إظهار كلمة المرور', 'Afficher le mot de passe')}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>
              <div className="relative"><input className={`${inputClass} pe-11`} type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={localize('Confirm password', 'تأكيد كلمة المرور', 'Confirmer le mot de passe')} autoComplete="new-password" /><button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="absolute end-3 top-3 text-slate-400" aria-label={localize('Show confirmation', 'إظهار التأكيد', 'Afficher la confirmation')}>{showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>
              <label className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600"><input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-0.5" /><span>{localize('I accept the Terms of Service and Privacy Policy.', 'أوافق على شروط الخدمة وسياسة الخصوصية.', 'J’accepte les Conditions d’utilisation et la Politique de confidentialité.')}</span></label>
              <button type="submit" disabled={!agreedToTerms || isLoading} className={primaryClass}>{isLoading ? localize('Creating…', 'جارٍ الإنشاء…', 'Création…') : localize('Create account', 'إنشاء حساب', 'Créer un compte')}</button>
            </form>
          )}

          {currentScreen === 'forgot-password' && (
            <form className="space-y-3" onSubmit={handleSendResetLink}>
              <p className="text-sm text-slate-600">{localize('Enter your email to receive a reset link.', 'أدخل بريدك لاستلام رابط إعادة التعيين.', 'Saisissez votre e-mail pour recevoir un lien de réinitialisation.')}</p>
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" autoComplete="email" />
              <button type="submit" disabled={isLoading} className={primaryClass}>{isLoading ? localize('Sending…', 'جارٍ الإرسال…', 'Envoi…') : localize('Send reset link', 'إرسال رابط الاستعادة', 'Envoyer le lien')}</button>
            </form>
          )}

          {currentScreen === 'reset-password' && (
            <form className="space-y-3" onSubmit={handleUpdatePassword}>
              <input className={inputClass} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={localize('New password', 'كلمة المرور الجديدة', 'Nouveau mot de passe')} autoComplete="new-password" />
              <input className={inputClass} type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={localize('Confirm password', 'تأكيد كلمة المرور', 'Confirmer le mot de passe')} autoComplete="new-password" />
              <div className="space-y-1 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                <div className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${password.length >= 6 ? 'text-emerald-600' : 'text-slate-300'}`} />{localize('At least 6 characters', '6 أحرف على الأقل', 'Au moins 6 caractères')}</div>
                <div className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${password.length > 0 && password === confirmPassword ? 'text-emerald-600' : 'text-slate-300'}`} />{localize('Passwords match', 'كلمتا المرور متطابقتان', 'Les mots de passe correspondent')}</div>
              </div>
              <button type="submit" disabled={isLoading} className={primaryClass}>{localize('Save password', 'حفظ كلمة المرور', 'Enregistrer le mot de passe')}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
