import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Eye,
  EyeOff,
  Mail,
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import moroccoAuthBg from '../assets/images/morocco_auth_bg.jpg';
import { SupportedLanguage } from '../data/translations';
import { LanguageFlagSelector } from './LanguageFlagSelector';
import { getAuthRedirectUrl, getPasswordRecoveryRedirectUrl, isSupabaseConfigured, supabase } from '../lib/supabase';
import { useLocale } from '../lib/i18n';
import { Button, IconButton } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { CheckboxRow, TextInput } from '../ui/Field';

export type AuthScreenType =
  | 'welcome'
  | 'sign-in-method'
  | 'sign-in-email'
  | 'create-account'
  | 'forgot-password'
  | 'reset-password';

type StatusKind = 'error' | 'success' | 'info';

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
  const locale = useLocale(language);
  const localize = locale.t;
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
  const [statusKind, setStatusKind] = useState<StatusKind>('error');
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentScreen(initialScreen);
    setScreenHistory([]);
    setStatusMessage(null);
  }, [isOpen, initialScreen]);

  // Escape closes the overlay and focus starts inside the dialog.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]');
      target?.focus({ preventScroll: true });
    }, 40);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      previous?.focus?.({ preventScroll: true });
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const setStatus = (message: string | null, kind: StatusKind = 'error') => {
    setStatusKind(kind);
    setStatusMessage(message);
  };

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
      setStatus(localizeAuthError(error.message));
    }
  };

  const handleEmailSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setStatus(localize('Enter your email and password.', 'أدخل البريد الإلكتروني وكلمة المرور.', 'Saisissez votre e-mail et votre mot de passe.'));
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (error) {
      setStatus(localizeAuthError(error.message));
      return;
    }
    if (data.user) completeAuth(data.user);
  };

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password || !fullName || !country) {
      setStatus(localize('Complete all required fields.', 'أكمل الحقول المطلوبة.', 'Complétez les champs obligatoires.'));
      return;
    }
    if (!agreedToTerms) {
      setStatus(localize('Accept the Terms and Privacy Policy to continue.', 'وافق على الشروط وسياسة الخصوصية للمتابعة.', 'Acceptez les conditions et la politique de confidentialité.'));
      return;
    }
    if (password.length < 6) {
      setStatus(localize('Password must be at least 6 characters.', 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.', 'Le mot de passe doit comporter au moins 6 caractères.'));
      return;
    }
    if (password !== confirmPassword) {
      setStatus(localize('Passwords do not match.', 'كلمتا المرور غير متطابقتين.', 'Les mots de passe ne correspondent pas.'));
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
      setStatus(localizeAuthError(error.message));
      return;
    }
    if (data.user && data.session) {
      completeAuth(data.user);
      return;
    }
    setStatus(localize('Account created. Check your email to confirm it.', 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتفعيله.', 'Compte créé. Vérifiez votre e-mail pour le confirmer.'), 'success');
  };

  const handleSendResetLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) {
      setStatus(localize('Enter your email address.', 'أدخل بريدك الإلكتروني.', 'Saisissez votre adresse e-mail.'));
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: getPasswordRecoveryRedirectUrl() });
    setIsLoading(false);
    setStatus(
      error
        ? localizeAuthError(error.message)
        : localize('Reset link sent.', 'تم إرسال رابط إعادة التعيين.', 'Lien de réinitialisation envoyé.'),
      error ? 'error' : 'success',
    );
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      setStatus(localize('Password must be at least 6 characters.', 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.', 'Le mot de passe doit comporter au moins 6 caractères.'));
      return;
    }
    if (password !== confirmPassword) {
      setStatus(localize('Passwords do not match.', 'كلمتا المرور غير متطابقتين.', 'Les mots de passe ne correspondent pas.'));
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) {
      setStatus(localizeAuthError(error.message));
      return;
    }
    setStatus(localize('Password updated.', 'تم تحديث كلمة المرور.', 'Mot de passe mis à jour.'), 'success');
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

  const fields = (
    <>
      {currentScreen === 'sign-in-method' && (
        <div className="space-y-2.5">
          <Button
            full
            variant="secondary"
            disabled={isLoading}
            onClick={() => void handleGoogleAuth()}
            icon={<span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-sunken text-micro font-black text-brand-accent">G</span>}
          >
            {localize('Continue with Google', 'المتابعة عبر Google', 'Continuer avec Google')}
          </Button>
          <Button full onClick={() => navigateTo('sign-in-email')} icon={<Mail className="h-4 w-4" />}>
            {localize('Continue with email', 'المتابعة بالبريد الإلكتروني', 'Continuer par e-mail')}
          </Button>
          <Button full variant="quiet" onClick={() => navigateTo('create-account')}>
            {localize('Create an account', 'إنشاء حساب', 'Créer un compte')}
          </Button>
        </div>
      )}

      {currentScreen === 'sign-in-email' && (
        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <TextInput
            id="auth-signin-email"
            label={localize('Email address', 'البريد الإلكتروني', 'Adresse e-mail')}
            type="email"
            autoComplete="email"
            placeholder={localize('Email address', 'البريد الإلكتروني', 'Adresse e-mail')}
            value={email}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
          />
          <PasswordTextInput
            id="auth-signin-password"
            label={localize('Password', 'كلمة المرور', 'Mot de passe')}
            placeholder={localize('Password', 'كلمة المرور', 'Mot de passe')}
            autoComplete="current-password"
            value={password}
            visible={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
            onChange={(value: string) => setPassword(value)}
          />
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <button
              type="button"
              onClick={() => navigateTo('forgot-password')}
              className="min-h-11 text-caption font-bold text-brand-accent"
            >
              {localize('Forgot password?', 'نسيت كلمة المرور؟', 'Mot de passe oublié ?')}
            </button>
            <Button type="submit" data-autofocus disabled={isLoading} loading={isLoading}>
              {localize('Sign In', 'تسجيل الدخول', 'Se connecter')}
            </Button>
          </div>
          <Button full variant="quiet" onClick={() => navigateTo('create-account')}>
            {localize('Create an account', 'إنشاء حساب', 'Créer un compte')}
          </Button>
        </form>
      )}

      {currentScreen === 'create-account' && (
        <form onSubmit={handleCreateAccount} className="space-y-3">
          <TextInput
            id="auth-signup-name"
            label={localize('Full name', 'الاسم الكامل', 'Nom complet')}
            autoComplete="name"
            placeholder={localize('Full name', 'الاسم الكامل', 'Nom complet')}
            value={fullName}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFullName(event.target.value)}
          />
          <TextInput
            id="auth-signup-email"
            label={localize('Email address', 'البريد الإلكتروني', 'Adresse e-mail')}
            type="email"
            autoComplete="email"
            placeholder={localize('Email address', 'البريد الإلكتروني', 'Adresse e-mail')}
            value={email}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
          />
          <TextInput
            id="auth-signup-country"
            label={localize('Country', 'البلد', 'Pays')}
            autoComplete="country-name"
            placeholder={localize('Country', 'البلد', 'Pays')}
            value={country}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setCountry(event.target.value)}
          />
          <PasswordTextInput
            id="auth-signup-password"
            label={localize('Password', 'كلمة المرور', 'Mot de passe')}
            placeholder={localize('Password', 'كلمة المرور', 'Mot de passe')}
            autoComplete="new-password"
            hint={localize('At least 6 characters', '6 أحرف على الأقل', 'Au moins 6 caractères')}
            value={password}
            visible={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
            onChange={(value: string) => setPassword(value)}
          />
          <PasswordTextInput
            id="auth-signup-confirm"
            label={localize('Confirm password', 'تأكيد كلمة المرور', 'Confirmer le mot de passe')}
            placeholder={localize('Confirm password', 'تأكيد كلمة المرور', 'Confirmer le mot de passe')}
            autoComplete="new-password"
            value={confirmPassword}
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((value) => !value)}
            onChange={(value: string) => setConfirmPassword(value)}
          />
          <CheckboxRow
            id="auth-signup-terms"
            checked={agreedToTerms}
            onChange={setAgreedToTerms}
            label={localize('I accept the Terms of Service and Privacy Policy.', 'أوافق على شروط الخدمة وسياسة الخصوصية.', 'J’accepte les conditions d’utilisation et la politique de confidentialité.')}
          />
          <Button type="submit" full disabled={!agreedToTerms || isLoading} loading={isLoading}>
            {localize('Create Account', 'إنشاء الحساب', 'Créer le compte')}
          </Button>
        </form>
      )}

      {currentScreen === 'forgot-password' && (
        <form onSubmit={handleSendResetLink} className="space-y-3">
          <p className="text-caption leading-relaxed text-muted">
            {localize(
              'We email a link to set a new password.',
              'نرسل لك بالبريد رابطاً لتعيين كلمة مرور جديدة.',
              'Nous envoyons un lien pour définir un nouveau mot de passe.',
            )}
          </p>
          <TextInput
            id="auth-forgot-email"
            label={localize('Email address', 'البريد الإلكتروني', 'Adresse e-mail')}
            type="email"
            autoComplete="email"
            data-autofocus
            placeholder={localize('Email address', 'البريد الإلكتروني', 'Adresse e-mail')}
            value={email}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
          />
          <Button type="submit" full disabled={isLoading} loading={isLoading}>
            {localize('Send reset link', 'إرسال رابط إعادة التعيين', 'Envoyer le lien')}
          </Button>
        </form>
      )}

      {currentScreen === 'reset-password' && (
        <form onSubmit={handleUpdatePassword} className="space-y-3">
          <PasswordTextInput
            id="auth-reset-password"
            label={localize('New password', 'كلمة المرور الجديدة', 'Nouveau mot de passe')}
            placeholder={localize('New password', 'كلمة المرور الجديدة', 'Nouveau mot de passe')}
            autoComplete="new-password"
            value={password}
            visible={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
            onChange={(value: string) => setPassword(value)}
          />
          <PasswordTextInput
            id="auth-reset-confirm"
            label={localize('Confirm password', 'تأكيد كلمة المرور', 'Confirmer le mot de passe')}
            placeholder={localize('Confirm password', 'تأكيد كلمة المرور', 'Confirmer le mot de passe')}
            autoComplete="new-password"
            value={confirmPassword}
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((value) => !value)}
            onChange={(value: string) => setConfirmPassword(value)}
          />
          <ul className="space-y-1">
            <li className={`flex items-center gap-1.5 text-caption ${password.length >= 6 ? 'font-bold text-positive' : 'text-muted'}`}>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {localize('At least 6 characters', '6 أحرف على الأقل', 'Au moins 6 caractères')}
            </li>
            <li className={`flex items-center gap-1.5 text-caption ${password && password === confirmPassword ? 'font-bold text-positive' : 'text-muted'}`}>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {localize('Passwords match', 'كلمتا المرور متطابقتان', 'Les mots de passe correspondent')}
            </li>
          </ul>
          <Button type="submit" full disabled={isLoading} loading={isLoading}>
            {localize('Update Password', 'تحديث كلمة المرور', 'Mettre à jour')}
          </Button>
        </form>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-scrim/70 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-heading">
      <div
        ref={panelRef}
        dir={locale.isArabic ? 'rtl' : 'ltr'}
        className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-surface shadow-lg sm:min-h-[38rem] sm:rounded-xl sm:border sm:border-line"
      >
        <div className="relative h-[168px] shrink-0 overflow-hidden bg-slate-900 sm:h-[196px]">
          <img src={moroccoAuthBg} alt="" aria-hidden="true" className="h-full w-full object-cover object-center" />
          <div className="sindbad-photo-scrim absolute inset-0" aria-hidden="true" />
          <div className="sindbad-safe-top absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-2.5 py-2.5">
            <span className="flex h-9 w-9 items-center justify-center">
              {currentScreen !== 'welcome' && (
                <IconButton
                  icon={<ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />}
                  label={localize('Back', 'رجوع', 'Retour')}
                  variant="onPhoto"
                  onClick={handleBack}
                />
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <LanguageFlagSelector currentLanguage={language} onSelectLanguage={(value) => onToggleLanguage?.(value)} variant="auth" />
              <IconButton icon={<X className="h-4 w-4" aria-hidden="true" />} label={localize('Close', 'إغلاق', 'Fermer')} variant="onPhoto" onClick={onClose} />
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
            <BrandLogo size="md" showSlogan language={language} tone="onPhoto" />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center px-4 pb-8 pt-5 sm:px-6">
          {statusMessage && (
            <div className="mb-4">
              <Alert tone={statusKind}>{statusMessage}</Alert>
            </div>
          )}

          {!isSupabaseConfigured && (
            <div className="mb-4">
              <Alert tone="warning" title={localize('Accounts are not configured here', 'الحسابات غير مُعدّة في هذه النسخة', 'Les comptes ne sont pas configurés ici')}>
                {localize(
                  'Sign-in, saved trips, and reviews are unavailable. Searching and browsing still work.',
                  'تسجيل الدخول والرحلات المحفوظة والمراجعات غير متاحة. البحث والتصفح يعملان.',
                  'La connexion, les voyages enregistrés et les avis sont indisponibles. La recherche et la navigation fonctionnent.',
                )}
              </Alert>
            </div>
          )}

          {currentScreen === 'welcome' ? (
            <div className="space-y-5">
              <div>
                <h1 id="auth-dialog-heading" className="text-h1 font-extrabold tracking-tight text-ink">
                  {localize('Your trip starts here', 'رحلتك تبدأ من هنا', 'Votre voyage commence ici')}
                </h1>
                <p className="mt-1.5 text-body text-muted">
                  {localize('Discover nearby places and plan your trip.', 'اكتشف الأماكن القريبة وخطّط رحلتك.', 'Découvrez les lieux proches et planifiez votre voyage.')}
                </p>
              </div>
              <div className="space-y-2.5">
                <Button full data-autofocus onClick={() => navigateTo('sign-in-method')} trailingIcon={<ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />}>
                  {localize('Get Started', 'ابدأ الآن', 'Commencer')}
                </Button>
                <Button full variant="secondary" onClick={() => navigateTo('sign-in-email')}>
                  {localize('I already have an account', 'لدي حساب بالفعل', 'J’ai déjà un compte')}
                </Button>
                <Button full variant="quiet" onClick={() => navigateTo('create-account')}>
                  {localize('Create an account', 'إنشاء حساب', 'Créer un compte')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h1 id="auth-dialog-heading" className="text-h1 font-extrabold tracking-tight text-ink">
                  {panelTitle}
                </h1>
                {currentScreen === 'sign-in-method' && (
                  <p className="mt-1.5 text-body text-muted">
                    {localize('Discover your destination and plan your trip with ease.', 'اكتشف وجهتك وخطّط رحلتك بسهولة.', 'Découvrez votre destination et planifiez votre voyage facilement.')}
                  </p>
                )}
              </div>
              {fields}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface PasswordTextInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  autoComplete?: string;
  hint?: string;
  visible: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}

function PasswordTextInput({ id, label, placeholder, value, autoComplete, hint, visible, onToggle, onChange }: PasswordTextInputProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-label font-semibold text-muted">{label}</label>
        {hint && <span className="text-micro text-muted">{hint}</span>}
      </div>
      <div className="relative mt-1">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-lg border border-line-strong bg-surface px-3.5 pe-11 text-body text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute end-0.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-ink"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
