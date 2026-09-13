import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, MapPin, Loader2 } from 'lucide-react';
import { MascotSindbad } from './MascotSindbad';
import { ApiAuthenticationError, sendChatMessage } from '../services/api';
import { useAuthSession } from '../lib/authSession';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: string;
  onPlanTripFromAI: (destination: string, days: number) => void;
  language?: SupportedLanguage;
}

interface Message {
  id: string;
  sender: 'user' | 'sindbad';
  text: string;
  timestamp: string;
}

export const AIChatModal: React.FC<AIChatModalProps> = ({
  isOpen,
  onClose,
  destination = 'Northern Morocco',
  onPlanTripFromAI,
  language = 'en',
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const { status: authStatus } = useAuthSession();

  const localize = (english: string, arabic: string, french: string) =>
    isAr ? arabic : isFr ? french : english;

  const quickPromptsByLang: Record<SupportedLanguage, string[]> = {
    en: [
      'Hidden natural spots in Akchour',
      'Quiet riads in Chefchaouen medina',
      'What emergency services exist in Rif?',
      'Best time for Spanish Mosque sunset',
    ],
    ar: [
      'أماكن طبيعية مخفية في أقشور',
      'رياض هادئ في مدينة شفشاون العتيقة',
      'ما هي مراكز الطوارئ في جبال الريف؟',
      'أفضل وقت لغروب المسجد الإسباني',
    ],
    fr: [
      'Coins secrets naturels à Akchour',
      'Riads paisibles dans la médina de Chefchaouen',
      'Quels sont les services d’urgence dans le Rif ?',
      'Meilleur moment pour le coucher de soleil à la Mosquée Espagnole',
    ],
  };

  const initialWelcomeText: Record<SupportedLanguage, string> = {
    en: `Hello. I'm Sindbad, your travel guide for ${destination || 'Morocco'}. I can help with places, routes, and local tips. Where would you like to go?`,
    ar: `مرحباً. أنا سندباد، دليلك في ${destination || 'المغرب'}. أساعدك في اختيار الأماكن والمسارات وتقديم النصائح المحلية. إلى أين تود الذهاب؟`,
    fr: `Bonjour. Je suis Sindbad, votre guide pour ${destination || 'le Maroc'}. Je peux vous aider avec les lieux, les itinéraires et les conseils locaux. Où souhaitez-vous aller ?`,
  };

  const nowLabel = isAr ? 'الآن' : isFr ? "À l'instant" : 'Now';

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      sender: 'sindbad',
      text: initialWelcomeText[language] || initialWelcomeText.en,
      timestamp: nowLabel,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serviceNotice, setServiceNotice] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const canUseAi = authStatus === 'authed';

  useEffect(() => {
    if (messages.length === 1 && messages[0].sender === 'sindbad') {
      setMessages([
        {
          id: 'm1',
          sender: 'sindbad',
          text: initialWelcomeText[language] || initialWelcomeText.en,
          timestamp: nowLabel,
        },
      ]);
    }
  }, [language, destination]);

  useEffect(() => {
    if (authStatus === 'authed') {
      setServiceNotice(null);
    } else if (authStatus === 'anonymous') {
      setServiceNotice(localize(
        'Sign in from your account to ask Sindbad AI.',
        'سجّل الدخول من حسابك لاستخدام ذكاء سندباد.',
        'Connectez-vous depuis votre compte pour utiliser Sindbad AI.'
      ));
    }
  }, [authStatus, language]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim() || isLoading) return;

    if (!canUseAi) {
      setServiceNotice(localize(
        'Sign in from your account to ask Sindbad AI.',
        'سجّل الدخول من حسابك لاستخدام ذكاء سندباد.',
        'Connectez-vous depuis votre compte pour utiliser Sindbad AI.'
      ));
      return;
    }

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setServiceNotice(null);
    setIsLoading(true);

    try {
      const reply = await sendChatMessage(text, destination, language, messages.slice(-4));
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'sindbad',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      if (error instanceof ApiAuthenticationError) {
        setServiceNotice(localize(
          'Your session is not available. Sign in again before asking Sindbad AI.',
          'جلسة الدخول غير متاحة. سجّل الدخول مجدداً قبل استخدام ذكاء سندباد.',
          'Votre session n’est pas disponible. Reconnectez-vous avant d’utiliser Sindbad AI.'
        ));
      } else {
        setServiceNotice(localize(
          'Sindbad AI is temporarily unavailable. No substitute answer was generated.',
          'ذكاء سندباد غير متاح مؤقتاً. لم يتم إنشاء إجابة بديلة غير حقيقية.',
          'Sindbad AI est temporairement indisponible. Aucune réponse de substitution n’a été générée.'
        ));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
      <div className="bg-white w-full max-w-xl h-[88vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <MascotSindbad size="sm" mood="happy" />
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold tracking-tight">{t.sindbadAiCompanion}</h2>
                <span className={`w-2 h-2 rounded-full ${canUseAi ? 'bg-emerald-400' : 'bg-slate-300'}`} />
              </div>
              <p className="text-xs text-blue-100 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>
                  {destination} • {canUseAi
                    ? localize('AI ready for requests', 'الذكاء جاهز للطلبات', 'IA prête pour les demandes')
                    : localize('Sign-in required', 'يتطلب تسجيل الدخول', 'Connexion requise')}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60">
          {serviceNotice && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-bold text-amber-900">
              {serviceNotice}
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 text-xs sm:text-sm ${
                m.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {m.sender === 'sindbad' && (
                <div className="shrink-0 mt-1">
                  <MascotSindbad size="sm" mood="happy" />
                </div>
              )}

              <div
                className={`p-3.5 sm:p-4 rounded-2xl max-w-[85%] leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-sm'
                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-none shadow-xs'
                }`}
              >
                <div className="whitespace-pre-line">{m.text.replace(/\*\*/g, '')}</div>
                <div
                  className={`text-[10px] mt-1 text-right ${
                    m.sender === 'user' ? 'text-blue-200' : 'text-slate-400'
                  }`}
                >
                  {m.timestamp}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-center text-xs text-slate-500">
              <MascotSindbad size="sm" mood="thinking" />
              <div className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>{t.thinking}</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="p-2.5 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-2 rtl:pl-0 rtl:pr-2 whitespace-nowrap flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>{t.quickQuestions}:</span>
          </span>
          {(quickPromptsByLang[language] || quickPromptsByLang.en).map((prompt) => (
            <button
              key={prompt}
              onClick={() => void handleSend(prompt)}
              disabled={!canUseAi || isLoading}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition border bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSend();
            }}
            disabled={!canUseAi}
            placeholder={canUseAi
              ? t.askSindbadPlaceholder
              : localize('Sign in to ask Sindbad AI', 'سجّل الدخول لاستخدام ذكاء سندباد', 'Connectez-vous pour utiliser Sindbad AI')}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium disabled:opacity-60"
          />
          <button
            id="send-ai-chat-btn"
            onClick={() => void handleSend()}
            disabled={!canUseAi || !inputValue.trim() || isLoading}
            className="p-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white shadow-sm transition active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
};
