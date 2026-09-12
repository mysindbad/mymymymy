import React, { useState } from 'react';
import {
  X,
  ChevronLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Globe,
  Languages,
  CheckCircle2,
  ShieldCheck,
  Compass,
  Calendar,
  Navigation,
  Heart,
  ArrowRight,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import santoriniBg from '../assets/images/santorini_bg.jpg';
import { SupportedLanguage } from '../data/translations';
import { LanguageFlagSelector } from './LanguageFlagSelector';
import { supabase } from '../lib/supabase';

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
  onAuthSuccess?: (user: { name: string; email: string; avatar: string }) => void;
  language?: SupportedLanguage;
  onToggleLanguage?: (lang: SupportedLanguage) => void;
}

export const AuthFlowModal: React.FC<AuthFlowModalProps> = ({
  isOpen,
  onClose,
  initialScreen = 'welcome',
  onAuthSuccess,
  language = 'ar',
  onToggleLanguage,
}) => {
  const [currentScreen, setCurrentScreen] = useState<AuthScreenType>(initialScreen);
  const [screenHistory, setScreenHistory] = useState<AuthScreenType[]>([]);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('Saudi Arabia');
  const [selectedLang, setSelectedLang] = useState('العربية');
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // Visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Feedback states
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const isAr = language === 'ar';

  const navigateTo = (screen: AuthScreenType) => {
    setScreenHistory((prev) => [...prev, currentScreen]);
    setCurrentScreen(screen);
    setStatusMessage(null);
  };

  const handleBack = () => {
    if (screenHistory.length > 0) {
      const prev = screenHistory[screenHistory.length - 1];
      setScreenHistory((history) => history.slice(0, -1));
      setCurrentScreen(prev);
      setStatusMessage(null);
    } else {
      onClose();
    }
  };

  const completeAuth = (user: { email?: string; user_metadata?: Record<string, unknown> }) => {
    const metadata = user.user_metadata || {};
    onAuthSuccess?.({
      name: typeof metadata.full_name === 'string' && metadata.full_name.trim()
        ? metadata.full_name
        : user.email?.split('@')[0] || 'Traveler',
      email: user.email || '',
      avatar: typeof metadata.avatar_url === 'string' && metadata.avatar_url ? metadata.avatar_url : '🧔',
    });
    onClose();
  };

  const handleSocialAuth = async (provider: 'Google' | 'Facebook' | 'Apple') => {
    if (provider !== 'Google') {
      setStatusMessage(isAr ? 'تسجيل الدخول متاح حالياً عبر Google أو البريد الإلكتروني.' : 'Sign in is currently available with Google or email.');
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    setIsLoading(false);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    if (data.user) completeAuth(data.user);
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setStatusMessage('Please fill in both email and password.');
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    if (data.user) completeAuth(data.user);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      setStatusMessage('Please enter your full name, email, and password.');
      return;
    }
    if (password.length < 6) {
      setStatusMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setStatusMessage('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, country, preferred_language: selectedLang } },
    });
    setIsLoading(false);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    if (data.user && data.session) {
      completeAuth(data.user);
    } else {
      setStatusMessage(isAr ? 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتفعيله.' : 'Account created. Check your email to confirm it.');
    }
  };

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setStatusMessage('Please enter your email address.');
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setIsLoading(false);
    setStatusMessage(error?.message || (isAr ? 'تم إرسال رابط إعادة التعيين إلى بريدك.' : 'Reset link sent. Check your email inbox.'));
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setStatusMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setStatusMessage('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    setStatusMessage(isAr ? 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.' : 'Password updated successfully. You can now sign in.');
    navigateTo('sign-in-email');
  };

  // Password validation checks for Screen 6
  const hasMinLength = password.length >= 6;
  const hasLettersAndNumbers = /[a-zA-Z]/.test(password) && /\d/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Background Backdrop Overlay */}
      <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md" onClick={onClose} />

      {/* Main Screen Container (Mobile phone canvas 9:16 aspect ratio) */}
      <div className="relative w-full max-w-md h-[100dvh] sm:h-[840px] sm:max-h-[92vh] sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col z-10 select-none bg-slate-900 border border-white/20">
        {/* Real Photographic Mediterranean Background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img
            src={santoriniBg}
            alt="Santorini coastal backdrop"
            className="w-full h-full object-cover object-top filter contrast-[1.05] brightness-[1.02]"
          />
          {/* Subtle sun ray highlight and gradient fades */}
          <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-transparent to-blue-950/40" />
        </div>

        {/* TOP BAR: Clean, professional header with Language Flag Switcher & Close button */}
        <div className="relative z-30 px-4 pt-3.5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentScreen !== 'welcome' && (
              <button
                onClick={handleBack}
                className="w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white shadow-md flex items-center justify-center transition active:scale-95 border border-white/20 backdrop-blur-md"
                title={isAr ? 'رجوع' : 'Go Back'}
              >
                <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* National Flags Language Switcher right on the outside of Start/Login */}
            <LanguageFlagSelector
              currentLanguage={language}
              onSelectLanguage={(l) => onToggleLanguage?.(l)}
              variant="auth"
            />

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white shadow-md flex items-center justify-center transition active:scale-95 border border-white/20 backdrop-blur-md"
              title={isAr ? 'إغلاق' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SCROLLABLE SCREEN CONTENT */}
        <div
          className="relative z-10 flex-1 overflow-y-auto no-scrollbar flex flex-col justify-between p-4 sm:p-5"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {/* TOP SECTION: 3D Logo */}
          <div className="w-full relative pt-1">
            {/* Playful quotes in sky */}
            <div className="absolute top-0 right-0 text-right pointer-events-none text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
              {currentScreen === 'welcome' && (
                <span className="font-['Caveat',cursive] text-lg font-bold leading-tight block -rotate-3 text-sky-100">
                  Explore & Discover ✈
                </span>
              )}
              {currentScreen === 'sign-in-method' && (
                <span className="font-['Caveat',cursive] text-base font-bold leading-tight block -rotate-3 text-sky-100">
                  Travel Connect Belong ✈
                </span>
              )}
              {currentScreen === 'sign-in-email' && (
                <span className="font-['Caveat',cursive] text-base font-bold leading-tight block -rotate-3 text-sky-100">
                  More Than A Trip ♡
                </span>
              )}
              {currentScreen === 'create-account' && (
                <span className="font-['Caveat',cursive] text-base font-bold leading-tight block -rotate-3 text-sky-100">
                  Travel Learn Connect Belong ✈
                </span>
              )}
              {currentScreen === 'forgot-password' && (
                <span className="font-['Caveat',cursive] text-base font-bold leading-tight block -rotate-3 text-sky-100">
                  Travel Smarter With AI ✈
                </span>
              )}
              {currentScreen === 'reset-password' && (
                <span className="font-['Caveat',cursive] text-base font-bold leading-tight block -rotate-3 text-sky-100">
                  Travel Learn Connect Belong ✈
                </span>
              )}
            </div>

            {currentScreen !== 'welcome' && (
              <div className="absolute top-10 left-0 pointer-events-none text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
                <span className="font-['Caveat',cursive] text-base font-bold leading-tight block rotate-3 text-sky-100">
                  {currentScreen === 'sign-in-method' && 'Different Ways Same Journey ♡'}
                  {currentScreen === 'sign-in-email' && 'Explore Discover Belong ✈'}
                  {currentScreen === 'create-account' && 'New Adventures New You ♡'}
                  {currentScreen === 'forgot-password' && 'Explore Discover Belong ✈'}
                  {currentScreen === 'reset-password' && 'New Password Brighter Journeys ♡'}
                </span>
              </div>
            )}

            {/* Official 3D Transparent Logo */}
            <div className="flex flex-col items-center justify-center pt-2 pb-1">
              <BrandLogo size="lg" showSlogan={true} />
            </div>
          </div>

          {/* STATUS NOTIFICATION MESSAGE */}
          {statusMessage && (
            <div className="my-2 p-2.5 rounded-xl bg-blue-900/90 text-white text-xs font-semibold text-center backdrop-blur-md shadow-md animate-in fade-in">
              {statusMessage}
            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 1: WELCOME / ONBOARDING ("Explore a Brighter World") */}
          {/* ========================================================= */}
          {currentScreen === 'welcome' && (
            <div className="w-full my-auto py-2 flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
              {/* Handwritten Display Title */}
              <div className="text-center mb-6">
                <h2 className="font-['Kaushan_Script',cursive] text-3xl sm:text-4xl text-blue-950 font-black tracking-wide drop-shadow-[0_2px_8px_rgba(255,255,255,0.9)]">
                  {isAr ? 'استكشف' : 'Explore'}
                </h2>
                <h3 className="font-['Kaushan_Script',cursive] text-2xl sm:text-3xl text-blue-900 font-bold -mt-1 tracking-wide drop-shadow-[0_2px_8px_rgba(255,255,255,0.9)]">
                  {isAr ? 'عالماً أكثر إشراقاً' : 'a Brighter World'}
                </h3>
              </div>

              {/* 4 Frosted Glass Feature Cards */}
              <div className="grid grid-cols-4 gap-2 w-full max-w-sm mb-8">
                {/* 1. Discover */}
                <div className="bg-white/85 backdrop-blur-md rounded-2xl p-2.5 flex flex-col items-center text-center shadow-md border border-white/60">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white shadow-sm mb-1.5">
                    <Compass className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span className="font-bold text-xs text-slate-900 leading-tight">
                    {isAr ? 'استكشف' : 'Discover'}
                  </span>
                  <span className="text-[9px] text-slate-600 leading-tight mt-0.5">
                    {isAr ? 'أجمل الوجهات' : 'Amazing places'}
                  </span>
                </div>

                {/* 2. Plan */}
                <div className="bg-white/85 backdrop-blur-md rounded-2xl p-2.5 flex flex-col items-center text-center shadow-md border border-white/60">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-400 flex items-center justify-center text-white shadow-sm mb-1.5">
                    <Calendar className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span className="font-bold text-xs text-slate-900 leading-tight">
                    {isAr ? 'خطط' : 'Plan'}
                  </span>
                  <span className="text-[9px] text-slate-600 leading-tight mt-0.5">
                    {isAr ? 'رحلتك بذكاء' : 'Your trip'}
                  </span>
                </div>

                {/* 3. Navigate */}
                <div className="bg-white/85 backdrop-blur-md rounded-2xl p-2.5 flex flex-col items-center text-center shadow-md border border-white/60">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-sm mb-1.5">
                    <Navigation className="w-5 h-5 stroke-[2.2] fill-current" />
                  </div>
                  <span className="font-bold text-xs text-slate-900 leading-tight">
                    {isAr ? 'تنقل' : 'Navigate'}
                  </span>
                  <span className="text-[9px] text-slate-600 leading-tight mt-0.5">
                    {isAr ? 'بإرشاد ذكي' : 'With AI'}
                  </span>
                </div>

                {/* 4. Belong */}
                <div className="bg-white/85 backdrop-blur-md rounded-2xl p-2.5 flex flex-col items-center text-center shadow-md border border-white/60">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white shadow-sm mb-1.5">
                    <Heart className="w-5 h-5 stroke-[2.2] fill-current" />
                  </div>
                  <span className="font-bold text-xs text-slate-900 leading-tight">
                    {isAr ? 'انضم' : 'Belong'}
                  </span>
                  <span className="text-[9px] text-slate-600 leading-tight mt-0.5">
                    {isAr ? 'لمجتمع السفر' : 'Community'}
                  </span>
                </div>
              </div>

              {/* Glowing CTA Button: "Get Started →" */}
              <div className="w-full max-w-sm space-y-3">
                <button
                  onClick={() => navigateTo('sign-in-method')}
                  className="w-full py-3.5 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-blue-600 hover:from-blue-700 hover:to-sky-600 text-white font-black text-sm tracking-wide shadow-lg shadow-blue-500/40 flex items-center justify-center gap-2 transition transform active:scale-95"
                >
                  <span>{isAr ? 'ابدأ الآن' : 'Get Started'}</span>
                  <ArrowRight className={`w-4 h-4 stroke-[2.5] ${isAr ? 'rotate-180' : ''}`} />
                </button>

                <div className="text-center">
                  <button
                    onClick={() => navigateTo('sign-in-email')}
                    className="text-xs font-bold text-blue-900 hover:text-blue-950 underline underline-offset-4 drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]"
                  >
                    {isAr ? 'لدي حساب بالفعل' : 'I already have an account'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 2: SIGN IN YOUR WAY (OAuth Options & Email)        */}
          {/* ========================================================= */}
          {currentScreen === 'sign-in-method' && (
            <div className="w-full max-w-sm mx-auto my-auto bg-white/95 backdrop-blur-lg rounded-[28px] p-5 shadow-2xl border border-white/80 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="text-center mb-4">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {isAr ? 'سجل دخولك بالطريقة المناسبة' : 'Sign In Your Way'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAr ? 'اختر الوسيلة التي تفضلها للبدء' : 'Choose the method that’s best for you'}
                </p>
                <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-sky-400 mx-auto rounded-full mt-2" />
              </div>

              {/* Social Login Options */}
              <div className="space-y-2.5">
                {/* Google */}
                <button
                  onClick={() => handleSocialAuth('Google')}
                  className="w-full p-2.5 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 shadow-xs flex items-center justify-between transition group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <div className="text-start leading-tight">
                      <span className="text-[10px] text-slate-400 block font-normal">
                        {isAr ? 'المتابعة مع' : 'Continue with'}
                      </span>
                      <span className="text-xs font-bold text-slate-900">Google</span>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 text-slate-400 group-hover:text-slate-900 transition ${isAr ? 'rotate-180' : ''}`} />
                </button>

                {/* Facebook */}
                <button
                  onClick={() => handleSocialAuth('Facebook')}
                  className="w-full p-2.5 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 shadow-xs flex items-center justify-between transition group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#1877F2] flex items-center justify-center text-white shrink-0">
                      <span className="font-black text-xs">f</span>
                    </div>
                    <div className="text-start leading-tight">
                      <span className="text-[10px] text-slate-400 block font-normal">
                        {isAr ? 'المتابعة مع' : 'Continue with'}
                      </span>
                      <span className="text-xs font-bold text-slate-900">Facebook</span>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 text-slate-400 group-hover:text-slate-900 transition ${isAr ? 'rotate-180' : ''}`} />
                </button>

                {/* Apple */}
                <button
                  onClick={() => handleSocialAuth('Apple')}
                  className="w-full p-2.5 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 shadow-xs flex items-center justify-between transition group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 shrink-0 fill-current text-slate-900" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.65-.79 1.1-1.89.98-2.99-.95.04-2.09.63-2.77 1.42-.59.68-1.12 1.79-.98 2.87 1.05.08 2.12-.52 2.77-1.3z" />
                    </svg>
                    <div className="text-start leading-tight">
                      <span className="text-[10px] text-slate-400 block font-normal">
                        {isAr ? 'المتابعة مع' : 'Continue with'}
                      </span>
                      <span className="text-xs font-bold text-slate-900">Apple</span>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 text-slate-400 group-hover:text-slate-900 transition ${isAr ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Divider */}
              <div className="relative my-3 flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  {isAr ? 'أو استخدم بريدك الإلكتروني' : 'Or use your email'}
                </span>
              </div>

              {/* Sign in with Email Option */}
              <button
                onClick={() => navigateTo('sign-in-email')}
                className="w-full p-2.5 px-4 rounded-2xl bg-sky-50/70 hover:bg-sky-50 border border-sky-100 flex items-center justify-between transition group active:scale-[0.98] mb-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="text-start leading-tight">
                    <span className="text-xs font-bold text-slate-900 block">
                      {isAr ? 'تسجيل الدخول بالبريد' : 'Sign in with Email'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {isAr ? 'باستخدام بريدك وكلمة المرور' : 'Use your email and password'}
                    </span>
                  </div>
                </div>
                <ArrowRight className={`w-4 h-4 text-blue-600 transition ${isAr ? 'rotate-180' : ''}`} />
              </button>

              {/* Security Badge */}
              <div className="p-2.5 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-tight text-start">
                  <span className="text-[11px] font-bold text-blue-950 block">
                    {isAr ? 'بياناتك وخصوصيتك في أمان تام' : 'Your data is safe with us'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {isAr
                      ? 'نحن نلتزم بأعلى معايير الأمان والتشفير لبياناتك الشخصية.'
                      : 'We never share your personal information with anyone else.'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 3: WELCOME BACK (Email Sign In)                    */}
          {/* ========================================================= */}
          {currentScreen === 'sign-in-email' && (
            <div className="w-full max-w-sm mx-auto my-auto bg-white/95 backdrop-blur-lg rounded-[28px] p-5 shadow-2xl border border-white/80 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="text-center mb-4">
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-1.5">
                  <span>{isAr ? 'مرحباً بعودتك' : 'Welcome Back'}</span>
                  <span>👋</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAr
                    ? 'سجل دخولك لمتابعة رحلاتك مع ماي سندباد'
                    : 'Sign in to continue your journey with My Sindbad'}
                </p>
              </div>

              <form onSubmit={handleEmailSignIn} className="space-y-3">
                {/* Email Field */}
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isAr ? 'البريد الإلكتروني' : 'Email address'}
                    className="w-full ps-10 pe-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    required
                  />
                </div>

                {/* Password Field */}
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isAr ? 'كلمة المرور' : 'Password'}
                    className="w-full ps-10 pe-10 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Forgot Password Link */}
                <div className="text-end">
                  <button
                    type="button"
                    onClick={() => navigateTo('forgot-password')}
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    {isAr ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                  </button>
                </div>

                {/* Primary Sign In CTA */}
                <button
                  type="submit"
                  className="w-full py-3 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-bold text-xs tracking-wide shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
                  <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-3 flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  {isAr ? 'أو المتابعة عبر' : 'Or continue with'}
                </span>
              </div>

              {/* Social Grid */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => handleSocialAuth('Google')}
                  className="p-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-2 transition"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSocialAuth('Facebook')}
                  className="p-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-2 transition"
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-[#1877F2] flex items-center justify-center text-white shrink-0 text-[9px] font-black">
                    f
                  </div>
                  <span>Facebook</span>
                </button>
              </div>

              {/* Sign up prompt */}
              <div className="text-center mb-2">
                <span className="text-xs text-slate-500">
                  {isAr ? 'ليس لديك حساب بعد؟ ' : "Don't have an account? "}
                </span>
                <button
                  type="button"
                  onClick={() => navigateTo('create-account')}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  {isAr ? 'إنشاء حساب جديد' : 'Sign Up'}
                </button>
              </div>

              {/* Safe Note */}
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>{isAr ? 'بياناتك في أمان تام ومعاملاتك مشفرة' : 'Your data is safe with us'}</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 4: CREATE YOUR ACCOUNT (Sign Up)                   */}
          {/* ========================================================= */}
          {currentScreen === 'create-account' && (
            <div className="w-full max-w-sm mx-auto my-auto bg-white/95 backdrop-blur-lg rounded-[28px] p-4 sm:p-5 shadow-2xl border border-white/80 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="text-center mb-3">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {isAr ? 'إنشاء حساب جديد' : 'Create Your Account'}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isAr
                    ? 'انضم إلى ماي سندباد وابدأ رحلتك إلى عالم ساحر'
                    : 'Join My Sindbad and start your journey to a brighter world'}
                </p>
                <div className="w-10 h-0.5 bg-blue-500 mx-auto rounded-full mt-1.5" />
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-2">
                {/* Full name */}
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={isAr ? 'الاسم الكامل (مثال: أحمد المنصوري)' : 'Full name (e.g. Ahmed Benali)'}
                    className="w-full ps-9 pe-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
                    required
                  />
                </div>

                {/* Email address */}
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isAr ? 'البريد الإلكتروني (مثال: ahmed@example.com)' : 'Email address (e.g. ahmed@example.com)'}
                    className="w-full ps-9 pe-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
                    required
                  />
                </div>

                {/* Password */}
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isAr ? 'كلمة المرور (6 أحرف على الأقل)' : 'Password (at least 6 characters)'}
                    className="w-full ps-9 pe-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Confirm password */}
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={isAr ? 'تأكيد كلمة المرور' : 'Confirm password'}
                    className="w-full ps-9 pe-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Country Dropdown with National Flags */}
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full ps-9 pe-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 transition appearance-none cursor-pointer"
                  >
                    <option value="Saudi Arabia">🇸🇦 {isAr ? 'المملكة العربية السعودية' : 'Saudi Arabia'}</option>
                    <option value="Morocco">🇲🇦 {isAr ? 'المملكة المغربية' : 'Morocco'}</option>
                    <option value="UAE">🇦🇪 {isAr ? 'الإمارات العربية المتحدة' : 'United Arab Emirates'}</option>
                    <option value="Egypt">🇪🇬 {isAr ? 'جمهورية مصر العربية' : 'Egypt'}</option>
                    <option value="Qatar">🇶🇦 {isAr ? 'دولة قطر' : 'Qatar'}</option>
                    <option value="Kuwait">🇰🇼 {isAr ? 'دولة الكويت' : 'Kuwait'}</option>
                    <option value="Turkey">🇹🇷 {isAr ? 'تركيا' : 'Turkey'}</option>
                    <option value="France">🇫🇷 {isAr ? 'فرنسا' : 'France'}</option>
                    <option value="UK">🇬🇧 {isAr ? 'المملكة المتحدة' : 'United Kingdom'}</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Agreement Checkbox */}
                <label className="flex items-start gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-600 leading-tight">
                    {isAr ? (
                      <>
                        أوافق على <span className="text-blue-600 underline">شروط الخدمة</span> و{' '}
                        <span className="text-blue-600 underline">سياسة الخصوصية</span>
                      </>
                    ) : (
                      <>
                        I agree to the <span className="text-blue-600 underline">Terms of Service</span> and{' '}
                        <span className="text-blue-600 underline">Privacy Policy</span>
                      </>
                    )}
                  </span>
                </label>

                {/* Create Account Button */}
                <button
                  type="submit"
                  disabled={!agreedToTerms}
                  className="w-full py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-bold text-xs tracking-wide shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 transition disabled:opacity-50 active:scale-95 mt-1"
                >
                  <span>{isAr ? 'إنشاء الحساب' : 'Create Account'}</span>
                  <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                </button>
              </form>

              {/* Already have an account */}
              <div className="text-center mt-3">
                <span className="text-xs text-slate-500">
                  {isAr ? 'لديك حساب بالفعل؟ ' : 'Already have an account? '}
                </span>
                <button
                  type="button"
                  onClick={() => navigateTo('sign-in-email')}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  {isAr ? 'تسجيل الدخول' : 'Sign In'}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 5: FORGOT YOUR PASSWORD?                           */}
          {/* ========================================================= */}
          {currentScreen === 'forgot-password' && (
            <div className="w-full max-w-sm mx-auto my-auto bg-white/95 backdrop-blur-lg rounded-[28px] p-5 shadow-2xl border border-white/80 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2 shadow-xs">
                  <Lock className="w-6 h-6 stroke-[2.2]" />
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {isAr ? 'استعادة كلمة المرور' : 'Forgot Your Password?'}
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-[260px] mx-auto leading-relaxed">
                  {isAr
                    ? 'أدخل بريدك الإلكتروني وسنرسل لك رابطاً مباشراً لتعيين كلمة مرور جديدة.'
                    : "No worries! Enter your email address and we'll send you a link to reset your password."}
                </p>
              </div>

              <form onSubmit={handleSendResetLink} className="space-y-3">
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isAr ? 'البريد الإلكتروني' : 'Email address'}
                    className="w-full ps-10 pe-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 transition"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-bold text-xs tracking-wide shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <span>{isAr ? 'إرسال رابط التعيين' : 'Send Reset Link'}</span>
                  <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                </button>
              </form>

              {/* Divider: Back to */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  {isAr ? 'الرجوع إلى' : 'Back to'}
                </span>
              </div>

              {/* Secondary Action: Sign In Button */}
              <button
                type="button"
                onClick={() => navigateTo('sign-in-email')}
                className="w-full py-2.5 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50 font-bold text-xs transition active:scale-95 mb-3"
              >
                {isAr ? 'تسجيل الدخول' : 'Sign In'}
              </button>

              {/* Security info note */}
              <div className="p-2.5 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-tight text-start">
                  <span className="text-[11px] font-bold text-blue-950 block">
                    {isAr ? 'حماية وأمان كامل لمعلوماتك' : 'Your data is safe with us'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {isAr
                      ? 'لن يتم مشاركة بريدك الإلكتروني مع أي طرف آخر. الرابط مخصص لك فقط.'
                      : "We'll never share your email with anyone else. This link is only used to reset your password."}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SCREEN 6: RESET YOUR PASSWORD                             */}
          {/* ========================================================= */}
          {currentScreen === 'reset-password' && (
            <div className="w-full max-w-sm mx-auto my-auto bg-white/95 backdrop-blur-lg rounded-[28px] p-5 shadow-2xl border border-white/80 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="text-center mb-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2 shadow-xs">
                  <Lock className="w-6 h-6 stroke-[2.2]" />
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {isAr ? 'تعيين كلمة مرور جديدة' : 'Reset Your Password'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAr ? 'أنشئ كلمة مرور قوية لحماية حسابك' : 'Create a new password for your account'}
                </p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-2.5">
                {/* New password */}
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isAr ? 'كلمة المرور الجديدة' : 'New password (at least 6 characters)'}
                    className="w-full ps-10 pe-10 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Confirm new password */}
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={isAr ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}
                    className="w-full ps-10 pe-10 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                <div className="pt-1">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-500">{isAr ? 'قوة كلمة المرور' : 'Password strength'}</span>
                    <span
                      className={`font-bold ${
                        hasMinLength && hasLettersAndNumbers && passwordsMatch
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {hasMinLength && hasLettersAndNumbers && passwordsMatch
                        ? (isAr ? 'قوية وممتازة' : 'Strong')
                        : (isAr ? 'جيدة' : 'Good')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 h-1.5 mb-2">
                    <div
                      className={`rounded-full ${
                        hasMinLength ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    />
                    <div
                      className={`rounded-full ${
                        hasLettersAndNumbers ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    />
                    <div
                      className={`rounded-full ${
                        passwordsMatch ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    />
                  </div>

                  {/* 3 Checklist Items */}
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2
                        className={`w-3.5 h-3.5 ${
                          hasMinLength ? 'text-emerald-600' : 'text-slate-300'
                        }`}
                      />
                      <span className={hasMinLength ? 'text-slate-800' : 'text-slate-400'}>
                        {isAr ? '6 أحرف على الأقل' : 'At least 6 characters'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2
                        className={`w-3.5 h-3.5 ${
                          hasLettersAndNumbers ? 'text-emerald-600' : 'text-slate-300'
                        }`}
                      />
                      <span className={hasLettersAndNumbers ? 'text-slate-800' : 'text-slate-400'}>
                        {isAr ? 'مزيج من الحروف والأرقام' : 'Use a mix of letters and numbers'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2
                        className={`w-3.5 h-3.5 ${
                          passwordsMatch ? 'text-emerald-600' : 'text-slate-300'
                        }`}
                      />
                      <span className={passwordsMatch ? 'text-slate-800' : 'text-slate-400'}>
                        {isAr ? 'تطابق كلمتي المرور' : 'Both passwords match'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Update Password CTA */}
                <button
                  type="submit"
                  disabled={!hasMinLength || !passwordsMatch}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-bold text-xs tracking-wide shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 mt-1"
                >
                  <span>{isAr ? 'تحديث كلمة المرور' : 'Update Password'}</span>
                  <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                </button>
              </form>

              {/* Divider: Or go back to */}
              <div className="relative my-3 flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  {isAr ? 'أو الرجوع إلى' : 'Or go back to'}
                </span>
              </div>

              {/* Secondary Sign In */}
              <button
                type="button"
                onClick={() => navigateTo('sign-in-email')}
                className="w-full py-2.5 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50 font-bold text-xs transition active:scale-95 mb-2.5"
              >
                {isAr ? 'تسجيل الدخول' : 'Sign In'}
              </button>

              {/* Security info note */}
              <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-tight text-start">
                  <span className="text-[11px] font-bold text-blue-950 block">
                    {isAr ? 'بياناتك مشفرة ومحمية' : 'Your data is safe with us'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {isAr
                      ? 'كلمة مرورك مشفرة ولا يتم مشاركتها أبداً مع أي جهة خارجية.'
                      : 'Your password is encrypted and never shared with anyone else.'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* BOTTOM FOOTER: Wave symbol + Brand Motto */}
          <div className="w-full text-center pt-3 pb-1">
            <div className="text-blue-600 font-bold text-sm leading-none drop-shadow-sm mb-1">
              〰
            </div>
            <div className="text-[9px] font-extrabold tracking-widest text-slate-700 uppercase drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
              EXPLORE • PLAN • TRAVEL • BELONG
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
