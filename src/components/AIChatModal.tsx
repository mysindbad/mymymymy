import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, PhoneCall, PhoneOff, Send, X } from 'lucide-react';
import { MascotSindbad } from './MascotSindbad';
import { ApiAuthenticationError, sendChatMessage } from '../services/api';
import { useAuthSession } from '../lib/authSession';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';
import { AppNavigationAction, resolveAppNavigationHelp } from '../lib/appNavigation';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

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
    'Hi. Ask me about travel or My Sindbad.',
    'مرحباً. اسألني عن السفر أو My Sindbad.',
    'Bonjour. Posez-moi une question sur le voyage ou My Sindbad.'
  );
  const nowLabel = isAr ? 'الآن' : isFr ? "À l'instant" : 'Now';
  const [messages, setMessages] = useState<Message[]>([{ id: 'welcome', sender: 'sindbad', text: welcome, timestamp: nowLabel }]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serviceNotice, setServiceNotice] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceCallActive, setVoiceCallActive] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceCallActiveRef = useRef(false);
  const waitingForReplyRef = useRef(false);
  const closingRef = useRef(false);

  useEffect(() => {
    setMessages((current) => current.length <= 1
      ? [{ id: 'welcome', sender: 'sindbad', text: welcome, timestamp: nowLabel }]
      : current);
  }, [language]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const stopVoice = () => {
    voiceCallActiveRef.current = false;
    waitingForReplyRef.current = false;
    setVoiceCallActive(false);
    setIsListening(false);
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  useEffect(() => {
    if (isOpen) {
      closingRef.current = false;
      return;
    }
    closingRef.current = true;
    stopVoice();
  }, [isOpen]);

  useEffect(() => () => {
    closingRef.current = true;
    recognitionRef.current?.abort?.();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

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

  const speechLanguage = () => isAr ? 'ar-MA' : isFr ? 'fr-FR' : 'en-US';

  const resumeVoiceCall = () => {
    waitingForReplyRef.current = false;
    if (!closingRef.current && voiceCallActiveRef.current) {
      window.setTimeout(() => startListening(true), 180);
    }
  };

  const speakAssistantReply = (text: string) => {
    if (!voiceCallActiveRef.current) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      resumeVoiceCall();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ''));
    utterance.lang = speechLanguage();
    utterance.rate = 1;
    utterance.onend = resumeVoiceCall;
    utterance.onerror = resumeVoiceCall;
    window.speechSynthesis.speak(utterance);
  };

  const submitText = async (rawText: string, fromVoice = false) => {
    const text = rawText.trim();
    if (!text || isLoading) {
      if (fromVoice) resumeVoiceCall();
      return;
    }
    const userMessage: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((current) => current.concat(userMessage));
    setInputValue('');
    setServiceNotice(null);
    setVoiceNotice(null);

    const navigationHelp = resolveAppNavigationHelp(text, language);
    if (navigationHelp) {
      addAssistantMessage(navigationHelp.text, navigationHelp.actions);
      if (fromVoice) speakAssistantReply(navigationHelp.text);
      return;
    }

    if (authStatus !== 'authed') {
      const notice = localize('Sign in to ask travel questions.', 'سجّل الدخول لطرح أسئلة السفر.', 'Connectez-vous pour poser des questions de voyage.');
      setServiceNotice(notice);
      if (fromVoice && voiceCallActiveRef.current) speakAssistantReply(notice);
      return;
    }

    setIsLoading(true);
    waitingForReplyRef.current = fromVoice;
    try {
      const history = messages.slice(-6).map((message) => ({ sender: message.sender, text: message.text }));
      const reply = await sendChatMessage(text, destination, language, history);
      addAssistantMessage(reply);
      if (fromVoice) speakAssistantReply(reply);
    } catch (error) {
      const notice = error instanceof ApiAuthenticationError
        ? localize('Your session ended. Sign in again.', 'انتهت جلسة الدخول. سجّل الدخول مجدداً.', 'Votre session a expiré. Reconnectez-vous.')
        : localize('Sindbad is temporarily unavailable.', 'سندباد غير متاح مؤقتاً.', 'Sindbad est temporairement indisponible.');
      setServiceNotice(notice);
      if (fromVoice && voiceCallActiveRef.current) speakAssistantReply(notice);
    } finally {
      setIsLoading(false);
      if (fromVoice && !voiceCallActiveRef.current) waitingForReplyRef.current = false;
    }
  };

  const handleSend = async () => submitText(inputValue, false);

  function startListening(callMode: boolean) {
    if (closingRef.current || recognitionRef.current || isLoading) return;
    const browserWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceNotice(localize('Voice is not supported on this browser.', 'الصوت غير مدعوم في هذا المتصفح.', 'La voix n’est pas prise en charge par ce navigateur.'));
      if (callMode) stopVoice();
      return;
    }

    try {
      let submitted = false;
      const recognition = new SpeechRecognition();
      recognition.lang = speechLanguage();
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onstart = () => {
        setVoiceNotice(null);
        setIsListening(true);
      };
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (!transcript) return;
        submitted = true;
        waitingForReplyRef.current = callMode;
        setIsListening(false);
        recognitionRef.current = null;
        void submitText(transcript, true);
      };
      recognition.onerror = (event) => {
        const notice = event.error === 'not-allowed'
          ? localize('Allow microphone access to use voice.', 'اسمح بالوصول إلى الميكروفون لاستخدام الصوت.', 'Autorisez le microphone pour utiliser la voix.')
          : event.error === 'no-speech'
            ? localize('I did not hear anything.', 'لم أسمع شيئاً.', 'Je n’ai rien entendu.')
            : localize('Voice stopped. Try again.', 'توقف الصوت. حاول مجدداً.', 'La voix s’est arrêtée. Réessayez.');
        setVoiceNotice(notice);
        if (event.error === 'not-allowed' && callMode) stopVoice();
      };
      recognition.onend = () => {
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        setIsListening(false);
        if (callMode && !submitted && !waitingForReplyRef.current && voiceCallActiveRef.current && !closingRef.current) {
          window.setTimeout(() => startListening(true), 350);
        }
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceNotice(localize('Could not start the microphone.', 'تعذر تشغيل الميكروفون.', 'Impossible de démarrer le microphone.'));
      if (callMode) stopVoice();
    }
  }

  const toggleVoiceCall = () => {
    if (voiceCallActiveRef.current) {
      stopVoice();
      return;
    }
    voiceCallActiveRef.current = true;
    waitingForReplyRef.current = false;
    setVoiceCallActive(true);
    setVoiceNotice(localize('Listening…', 'أستمع إليك…', 'Je vous écoute…'));
    startListening(true);
  };

  const closeChat = () => {
    closingRef.current = true;
    stopVoice();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
          <div className="flex min-w-0 items-center gap-3"><MascotSindbad size="sm" mood="happy" /><div className="min-w-0"><h2 className="truncate text-base font-black">{t.sindbadAiCompanion}</h2><p className="truncate text-xs text-blue-100">{destination}</p></div></div>
          <div className="flex items-center gap-2">
            <button
              id="ai-voice-call-btn"
              type="button"
              onClick={toggleVoiceCall}
              aria-pressed={voiceCallActive}
              aria-label={voiceCallActive ? localize('End voice call', 'إنهاء المحادثة الصوتية', 'Terminer l’appel vocal') : localize('Start voice call', 'بدء محادثة صوتية', 'Démarrer un appel vocal')}
              className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/20 ${voiceCallActive ? 'bg-rose-500' : 'bg-white/15 hover:bg-white/25'}`}
            >
              {voiceCallActive ? <PhoneOff className="h-4 w-4" /> : <PhoneCall className="h-4 w-4" />}
            </button>
            <button type="button" onClick={closeChat} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15" aria-label={localize('Close', 'إغلاق', 'Fermer')}><X className="h-4 w-4" /></button>
          </div>
        </header>

        {(voiceCallActive || voiceNotice) && (
          <div className={`flex items-center justify-center gap-2 border-b px-3 py-2 text-xs font-bold ${voiceCallActive ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`} aria-live="polite">
            {isListening && <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />}
            <span>{voiceCallActive ? (isListening ? localize('Listening…', 'أستمع إليك…', 'Écoute…') : isLoading ? localize('Thinking…', 'جاري التفكير…', 'Réflexion…') : localize('Voice conversation active', 'المحادثة الصوتية مفعّلة', 'Conversation vocale active')) : voiceNotice}</span>
          </div>
        )}

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
                      <button key={`${message.id}-${action.target}-${action.label}`} type="button" onClick={() => { stopVoice(); onNavigateApp(action); onClose(); }} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">
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
          <button
            id="ai-voice-message-btn"
            type="button"
            onClick={() => isListening ? recognitionRef.current?.stop() : startListening(false)}
            disabled={voiceCallActive || isLoading}
            aria-pressed={isListening && !voiceCallActive}
            aria-label={localize('Voice message', 'رسالة صوتية', 'Message vocal')}
            className={`rounded-2xl p-2.5 disabled:opacity-40 ${isListening && !voiceCallActive ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Mic className="h-4 w-4" />
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void handleSend(); }}
            placeholder={localize('Ask about travel or the app', 'اسأل عن السفر أو التطبيق', 'Posez une question sur le voyage ou l’application')}
            className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
          />
          <button id="send-ai-chat-btn" type="button" onClick={() => void handleSend()} disabled={!inputValue.trim() || isLoading} className="rounded-2xl bg-blue-600 p-2.5 text-white disabled:opacity-40"><Send className="h-4 w-4 rtl:rotate-180" /></button>
        </div>
      </div>
    </div>
  );
};
