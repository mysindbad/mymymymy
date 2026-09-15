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
import moroccoAuthBg from '../assets/images/morocco_auth_bg.jpg';
import { SupportedLanguage } from '../data/translations';
import { LanguageFlagSelector } from './LanguageFlagSelector';
import { getAuthRedirectUrl, getPasswordRecoveryRedirectUrl, isSupabaseConfigured, supabase } from '../lib/supabase';

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
      return localize('Invalid login credentials', 'بيانات تسجيل الدخول غير صحيحة', 'Identifiants de connexion invalides');
    }
    if (normalized.includes('email not confirmed')) {
      return localize('Confirm your email before signing in.', 'أكد بريدك الإلكتروني قبل تسجيل الدخول.', 'Confirmez votre e-mail avant de vous connecter.');
    }
    if (normalized.includes('user already registered')) {
      return localize('This email is already registered.', 'هذا البريد الإلكتروني مسجل بالفعل.', 'Cette adresse e-mail est déjà inscrite.');
    }
    if (!isSupabaseConfigured || normalized.includes('fetch failed') || normalized.includes('failed to fetch')) {
      return localize(
        'Sign-in is not available right now. This deployment is missing its account service configuration.',
        'تسجيل الدخول غير متاح حالياً. لم يتم إعداد خدمة الحسابات لهذه النسخة.',
        "La connexion n'est pas disponible pour le moment. Le service de comptes n'est pas configuré pour ce déploiement.",
      );
    }
    return message;
  };

  const navigateTo = (screen: AuthScreenType) => {
    setScreenHistory((previous) => previous.concat(currentScreen));
    setCurrentScreen(screen);
    setStatusMessage(null);
  };

  const handleBack = () => {
    if (screenHistory.length === 0) {
      onClose();
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
      avatar: typeof metadata.avatar_url === 'string' && metadata.avatar_url ? metadata.avatar_url : '🧔',
      xp: Number.isFinite(metadataXp) && metadataXp >= 0 ? Math.floor(metadataXp) : undefined,
    });
    onClose();
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl(),
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      setIsLoading(false);
      setStatusMessage(localizeAuthError(error.message));
    }
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
      setStatusMessage(localize('Complete all required fields.', 'أكمل الحقول المطلوبة.', 'Complétez les champs obligatoires.'));
      return;
    }
    if (!agreedToTerms) {
      setStatusMessage(localize('Accept the Terms and Privacy Policy to continue.', 'وافق على الشروط وسياسة الخصوصية للمتابعة.', 'Acceptez les conditions et la politique de confidentialité.'));
      return;
    }
    if (password.length < 6) {
      setStatusMessage(localize('Password must be at least 6 characters.', 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.', 'Le mot de passe doit comporter au moins 6 caractères.'));
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
    if (data.user && data.session) {
      completeAuth(data.user);
      return;
    }
    setStatusMessage(localize('Account created. Check your email to confirm it.', 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتفعيله.', 'Compte créé. Vérifiez votre e-mail pour le confirmer.'));
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
      setStatusMessage(localize('Password must be at least 6 characters.', 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.', 'Le mot de passe doit comporter au moins 6 caractères.'));
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

  const panelTitle = currentScreen === 'sign-in-method'
    ? localize('Continue to My Sindbad', 'تابع إلى My Sindbad', 'Continuer vers My Sindbad')
    : currentScreen === 'sign-in-email'
      ? localize('Welcome Back', 'مرحباً بعودتك', 'Bon retour')
      : currentScreen === 'create-account'
        ? localize('Create Account', 'إنشاء حساب', 'Créer un compte')
        : currentScreen === 'forgot-password'
          ? localize('Reset Password', 'إعادة تعيين كلمة المرور', 'Réinitialiser le mot de passe')
          : currentScreen === 'reset-password'
            ? localize('New Password', 'كلمة مرور جديدة', 'Nouveau mot de passe')
            : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/75 p-0 backdrop-blur-md sm:p-4">
      <div className="relative z-10 flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-slate-900 shadow-2xl sm:h-auto sm:min-h-[680px] sm:max-h-[92vh] sm:rounded-3xl">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img src={moroccoAuthBg} alt="Chefchaouen blue medina backdrop" className="h-full w-full object-cover object-center brightness-[0.82]" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/25 via-slate-950/30 to-slate-950/75" />
        </div>

        <header className="relative z-20 flex items-center justify-between px-4 py-3">
          <div className="w-10">
            {currentScreen !== 'welcome' && (
              <button type="button" onClick={handleBack} aria-label={localize('Back', 'رجوع', 'Retour')} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-950/55 text-white backdrop-blur">
                <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <LanguageFlagSelector currentLanguage={language} onSelectLanguage={(value) => onToggleLanguage?.(value)} variant="auth" />
            <button type="button" onClick={onClose} aria-label={localize('Close', 'إغلاق', 'Fermer')} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-950/55 text-white backdrop-blur">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="relative z-10 flex flex-1 flex-col overflow-y-auto px-5 pb-6" dir={isAr ? 'rtl' : 'ltr'}>
          <div className="mx-auto mb-5 mt-1">
            <BrandLogo size="lg" showSlogan={false} language={language} />
          </div>

          {statusMessage && (
            <div className="mx-auto mb-4 w-full max-w-sm rounded-2xl border border-blue-300/30 bg-slate-950/75 px-4 py-3 text-center text-xs font-bold text-white backdrop-blur">
              {statusMessage}
            </div>
          )}

          {!isSupabaseConfigured && (
            <div className="mx-auto mb-4 w-full max-w-sm rounded-2xl border border-amber-300/40 bg-amber-500/15 px-4 py-3 text-center text-xs font-bold text-amber-100 backdrop-blur">
              {localize(
                'Accounts are not configured on this deployment yet, so sign-in, saved trips, and reviews are unavailable. You can still search and browse.',
                'لم يتم إعداد الحسابات على هذه النسخة بعد، لذا تسجيل الدخول والرحلات المحفوظة والمراجعات غير متاحة حالياً. يمكنك متابعة البحث والتصفح.',
                "Les comptes ne sont pas encore configurés sur ce déploiement, la connexion, les voyages enregistrés et les avis sont indisponibles. Vous pouvez continuer à rechercher et parcourir.",
              )}
            </div>
          )}

          {currentScreen === 'welcome' && (
            <section className="mx-auto my-auto w-full max-w-sm rounded-[30px] border border-white/30 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-xl">
              <h1 className="text-2xl font-black text-slate-900">{localize('Your trip starts here', 'رحلتك تبدأ من هنا', 'Votre voyage commence ici')}</h1>
              <p className="mt-2 text-sm text-slate-600">{localize('Discover nearby places and plan your trip.', 'اكتشف الأماكن القريبة وخطّط رحلتك.', 'Découvrez les lieux proches et planifiez votre voyage.')}</p>
              <button type="button" onClick={() => navigateTo('sign-in-method')} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/20">
                {localize('Get Started', 'ابدأ الآن', 'Commencer')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </button>
              <button type="button" onClick={() => navigateTo('sign-in-email')} className="mt-4 text-xs font-bold text-blue-700 underline underline-offset-4">
                {localize('I already have an account', 'لدي حساب بالفعل', 'J’ai déjà un compte')}
              </button>
            </section>
          )}

          {currentScreen !== 'welcome' && (
            <section className="mx-auto my-auto w-full max-w-sm rounded-[30px] border border-white/30 bg-white/95 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
              <div className="mb-5 text-center">
                <h2 className="text-xl font-black text-slate-900">{panelTitle}</h2>
                {currentScreen === 'sign-in-method' && (
                  <p className="mt-1.5 text-sm text-slate-600">{localize('Discover your destination and plan your trip with ease.', 'اكتشف وجهتك وخطّط رحلتك بسهولة.', 'Découvrez votre destination et planifiez votre voyage facilement.')}</p>
                )}
              </div>

              {currentScreen === 'sign-in-method' && (
                <div className="space-y-3">
                  <button type="button" disabled={isLoading} onClick={() => void handleGoogleAuth()} className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 disabled:opacity-50">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black text-blue-600">G</span>
                    {localize('Continue with Google', 'المتابعة عبر Google', 'Continuer avec Google')}
                  </button>
                  <button type="button" onClick={() => navigateTo('sign-in-email')} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">
                    <Mail className="h-4 w-4" />
                    {localize('Continue with email', 'المتابعة بالبريد الإلكتروني', 'Continuer par e-mail')}
                  </button>
                  <button type="button" onClick={() => navigateTo('create-account')} className="w-full py-2 text-xs font-bold text-blue-700">
                    {localize('Create an account', 'إنشاء حساب', 'Créer un compte')}
                  </button>
                </div>
              )}

              {currentScreen === 'sign-in-email' && (
                <form onSubmit={handleEmailSignIn} className="space-y-3">
                  <InputField icon={<Mail className="h-4 w-4" />} type="email" placeholder={localize('Email address', 'البريد الإلكتروني', 'Adresse e-mail')} value={email} onChange={setEmail} />
                  <PasswordField placeholder={localize('Password', 'كلمة المرور', 'Mot de passe')} value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
                  <button type="button" onClick={() => navigateTo('forgot-password')} className="text-xs font-bold text-blue-700">{localize('Forgot password?', 'نسيت كلمة المرور؟', 'Mot de passe oublié ?')}</button>
                  <button type="submit" disabled={isLoading} className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{localize('Sign In', 'تسجيل الدخول', 'Se connecter')}</button>
                  <button type="button" onClick={() => navigateTo('create-account')} className="w-full py-1 text-xs font-bold text-slate-600">{localize('Create an account', 'إنشاء حساب', 'Créer un compte')}</button>
                </form>
              )}

              {currentScreen === 'create-account' && (
                <form onSubmit={handleCreateAccount} className="space-y-3">
                  <InputField icon={<User className="h-4 w-4" />} placeholder={localize('Full name', 'الاسم الكامل', 'Nom complet')} value={fullName} onChange={setFullName} />
                  <InputField icon={<Mail className="h-4 w-4" />} type="email" placeholder={localize('Email address', 'البريد الإلكتروني', 'Adresse e-mail')} value={email} onChange={setEmail} />
                  <InputField placeholder={localize('Country', 'البلد', 'Pays')} value={country} onChange={setCountry} />
                  <PasswordField placeholder={localize('Password', 'كلمة المرور', 'Mot de passe')} value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
                  <PasswordField placeholder={localize('Confirm password', 'تأكيد كلمة المرور', 'Confirmer le mot de passe')} value={confirmPassword} onChange={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((value) => !value)} />
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                    <input type="checkbox" checked={agreedToTerms} onChange={(event) => setAgreedToTerms(event.target.checked)} className="mt-0.5" />
                    <span>{localize('I accept the Terms of Service and Privacy Policy.', 'أوافق على شروط الخدمة وسياسة الخصوصية.', 'J’accepte les conditions d’utilisation et la politique de confidentialité.')}</span>
                  </label>
                  <button type="submit" disabled={!agreedToTerms || isLoading} className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">{localize('Create Account', 'إنشاء الحساب', 'Créer le compte')}</button>
                </form>
              )}

              {currentScreen === 'forgot-password' && (
                <form onSubmit={handleSendResetLink} className="space-y-3">
                  <InputField icon={<Mail className="h-4 w-4" />} type="email" placeholder={localize('Email address', 'البريد الإلكتروني', 'Adresse e-mail')} value={email} onChange={setEmail} />
                  <button type="submit" disabled={isLoading} className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{localize('Send reset link', 'إرسال رابط إعادة التعيين', 'Envoyer le lien')}</button>
                </form>
              )}

              {currentScreen === 'reset-password' && (
                <form onSubmit={handleUpdatePassword} className="space-y-3">
                  <PasswordField placeholder={localize('New password', 'كلمة المرور الجديدة', 'Nouveau mot de passe')} value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
                  <PasswordField placeholder={localize('Confirm password', 'تأكيد كلمة المرور', 'Confirmer le mot de passe')} value={confirmPassword} onChange={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((value) => !value)} />
                  <div className="space-y-1 text-[11px] text-slate-500">
                    <p className={password.length >= 6 ? 'text-emerald-600' : ''}><CheckCircle2 className="me-1 inline h-3 w-3" />{localize('At least 6 characters', '6 أحرف على الأقل', 'Au moins 6 caractères')}</p>
                    <p className={password && password === confirmPassword ? 'text-emerald-600' : ''}><CheckCircle2 className="me-1 inline h-3 w-3" />{localize('Passwords match', 'كلمتا المرور متطابقتان', 'Les mots de passe correspondent')}</p>
                  </div>
                  <button type="submit" disabled={isLoading} className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{localize('Update Password', 'تحديث كلمة المرور', 'Mettre à jour')}</button>
                </form>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

const InputField: React.FC<{
  icon?: React.ReactNode;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ icon, type = 'text', placeholder, value, onChange }) => (
  <label className="relative block">
    {icon && <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-2xl border border-slate-200 bg-white py-3 pe-4 text-sm text-slate-800 outline-none focus:border-blue-500 ${icon ? 'ps-10' : 'ps-4'}`}
    />
  </label>
);

const PasswordField: React.FC<{
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}> = ({ placeholder, value, onChange, visible, onToggle }) => (
  <label className="relative block">
    <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-slate-200 bg-white py-3 ps-10 pe-11 text-sm text-slate-800 outline-none focus:border-blue-500"
    />
    <button type="button" onClick={onToggle} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={visible ? 'Hide password' : 'Show password'}>
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  </label>
);
