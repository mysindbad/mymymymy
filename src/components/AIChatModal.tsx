import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { MascotSindbad } from './MascotSindbad';
import { ApiAuthenticationError, sendChatMessage } from '../services/api';
import { useAuthSession } from '../lib/authSession';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';
import { AppNavigationAction, resolveAppNavigationHelp } from '../lib/appNavigation';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: string;
  onNavigateApp: (action: AppNavigationAction) => void;
  language?: SupportedLanguage;
}

interface Message {
  id: string;
  sender: 'user' | 'sindbad';
  text: string;
  timestamp: string;
  actions?: AppNavigationAction[];
}

export const AIChatModal: React.FC<AIChatModalProps> = ({
  isOpen,
  onClose,
  destination,
  onNavigateApp,
  language = 'en',
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const { status: authStatus } = useAuthSession();
  const localize = (english: string, arabic: string, french: string) => isAr ? arabic : isFr ? french : english;
  const welcome = localize(
    'Hi. Ask me about travel or how to use My Sindbad.',
    'مرحباً. اسألني عن السفر أو عن كيفية استخدام My Sindbad.',
    'Bonjour. Posez-moi une question sur le voyage ou sur My Sindbad.'
  );
  const nowLabel = isAr ? 'الآن' : isFr ? "À l'instant" : 'Now';
  const [messages, setMessages] = useState<Message[]>([{ id: 'welcome', sender: 'sindbad', text: welcome, timestamp: nowLabel }]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serviceNotice, setServiceNotice] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages((current) => current.length <= 1
      ? [{ id: 'welcome', sender: 'sindbad', text: welcome, timestamp: nowLabel }]
      : current);
  }, [language]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const addAssistantMessage = (text: string, actions?: AppNavigationAction[]) => {
    setMessages((current) => current.concat({
      id: `ai-${Date.now()}-${current.length}`,
      sender: 'sindbad',
      text,
      actions,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    const userMessage: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((current) => current.concat(userMessage));
    setInputValue('');
    setServiceNotice(null);

    const navigationHelp = resolveAppNavigationHelp(text, language);
    if (navigationHelp) {
      addAssistantMessage(navigationHelp.text, navigationHelp.actions);
      return;
    }

    if (authStatus !== 'authed') {
      setServiceNotice(localize('Sign in to ask travel questions.', 'سجّل الدخول لطرح أسئلة السفر.', 'Connectez-vous pour poser des questions de voyage.'));
      return;
    }

    setIsLoading(true);
    try {
      const history = messages.slice(-6).map((message) => ({ sender: message.sender, text: message.text }));
      const reply = await sendChatMessage(text, destination, language, history);
      addAssistantMessage(reply);
    } catch (error) {
      if (error instanceof ApiAuthenticationError) {
        setServiceNotice(localize('Your session ended. Sign in again.', 'انتهت جلسة الدخول. سجّل الدخول مجدداً.', 'Votre session a expiré. Reconnectez-vous.'));
      } else {
        setServiceNotice(localize('Sindbad is temporarily unavailable.', 'سندباد غير متاح مؤقتاً.', 'Sindbad est temporairement indisponible.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
          <div className="flex items-center gap-3"><MascotSindbad size="sm" mood="happy" /><div><h2 className="text-base font-black">{t.sindbadAiCompanion}</h2><p className="text-xs text-blue-100">{destination}</p></div></div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15" aria-label={localize('Close', 'إغلاق', 'Fermer')}><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4">
          {serviceNotice && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-bold text-amber-900">{serviceNotice}</div>}
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 text-xs sm:text-sm ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.sender === 'sindbad' && <div className="mt-1 shrink-0"><MascotSindbad size="sm" mood="happy" /></div>}
              <div className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed shadow-xs sm:p-4 ${message.sender === 'user' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-800'}`}>
                <div className="whitespace-pre-line">{message.text.replace(/\*\*/g, '')}</div>
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.actions.map((action) => (
                      <button key={`${message.id}-${action.target}-${action.label}`} type="button" onClick={() => { onNavigateApp(action); onClose(); }} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className={`mt-1 text-end text-[10px] ${message.sender === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>{message.timestamp}</div>
              </div>
            </div>
          ))}
          {isLoading && <div className="flex items-center gap-3 text-xs text-slate-500"><MascotSindbad size="sm" mood="thinking" /><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3"><Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />{t.thinking}</div></div>}
          <div ref={chatEndRef} />
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white p-3">
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void handleSend(); }}
            placeholder={localize('Ask anything about travel or the app', 'اسأل عن السفر أو التطبيق', 'Posez une question sur le voyage ou l’application')}
            className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
          />
          <button id="send-ai-chat-btn" type="button" onClick={() => void handleSend()} disabled={!inputValue.trim() || isLoading} className="rounded-2xl bg-blue-600 p-2.5 text-white disabled:opacity-40"><Send className="h-4 w-4 rtl:rotate-180" /></button>
        </div>
      </div>
    </div>
  );
};
