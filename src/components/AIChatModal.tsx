import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Phone, PhoneOff, Send, X } from 'lucide-react';
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
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceModeRef = useRef(false);
  const processingVoiceRef = useRef(false);

  useEffect(() => {
    setMessages((current) => current.length <= 1
      ? [{ id: 'welcome', sender: 'sindbad', text: welcome, timestamp: nowLabel }]
      : current);
  }, [language]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => () => {
    voiceModeRef.current = false;
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (!isOpen && voiceModeRef.current) stopVoiceConversation();
  }, [isOpen]);

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

  function stopVoiceConversation() {
    voiceModeRef.current = false;
    processingVoiceRef.current = false;
    setVoiceMode(false);
    setIsListening(false);
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    window.speechSynthesis?.cancel();
  }

  function startRecognition() {
    if (!voiceModeRef.current || isLoading || processingVoiceRef.current || recognitionRef.current) return;
    const browserWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setServiceNotice(localize(
        'Voice conversation is not supported on this browser.',
        'المحادثة الصوتية غير مدعومة في هذا المتصفح.',
        'La conversation vocale n’est pas prise en charge par ce navigateur.'
      ));
      stopVoiceConversation();
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.lang = isAr ? 'ar-MA' : isFr ? 'fr-FR' : 'en-US';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onstart = () => {
        setServiceNotice(null);
        setIsListening(true);
      };
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (!transcript) return;
        processingVoiceRef.current = true;
        void sendMessage(transcript, true).finally(() => {
          processingVoiceRef.current = false;
        });
      };
      recognition.onerror = (event) => {
        const blocked = event.error === 'not-allowed' || event.error === 'service-not-allowed';
        const noSpeech = event.error === 'no-speech';
        setServiceNotice(blocked
          ? localize('Microphone permission is blocked.', 'إذن الميكروفون محظور.', 'L’autorisation du microphone est bloquée.')
          : noSpeech
            ? localize('I did not hear anything.', 'لم أسمع كلاماً.', 'Je n’ai rien entendu.')
            : localize('Voice input stopped.', 'توقف الإدخال الصوتي.', 'La saisie vocale s’est arrêtée.'));
        if (blocked) stopVoiceConversation();
      };
      recognition.onend = () => {
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        setIsListening(false);
        if (voiceModeRef.current && !processingVoiceRef.current && !isLoading) {
          window.setTimeout(startRecognition, 250);
        }
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setServiceNotice(localize('Could not start the microphone.', 'تعذر تشغيل الميكروفون.', 'Impossible de démarrer le microphone.'));
      stopVoiceConversation();
    }
  }

  function speakAndContinue(text: string) {
    if (!voiceModeRef.current) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      window.setTimeout(startRecognition, 250);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ''));
    utterance.lang = isAr ? 'ar-MA' : isFr ? 'fr-FR' : 'en-US';
    utterance.rate = 1;
    utterance.onend = () => {
      if (voiceModeRef.current) window.setTimeout(startRecognition, 250);
    };
    utterance.onerror = () => {
      if (voiceModeRef.current) window.setTimeout(startRecognition, 250);
    };
    window.speechSynthesis.speak(utterance);
  }

  async function sendMessage(rawText: string, fromVoice = false) {
    const text = rawText.trim();
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
      if (fromVoice) speakAndContinue(navigationHelp.text);
      return;
    }

    if (authStatus !== 'authed') {
      const notice = localize('Sign in to ask travel questions.', 'سجّل الدخول لطرح أسئلة السفر.', 'Connectez-vous pour poser des questions de voyage.');
      setServiceNotice(notice);
      if (fromVoice) speakAndContinue(notice);
      return;
    }

    setIsLoading(true);
    try {
      const history = messages.slice(-6).map((message) => ({ sender: message.sender, text: message.text }));
      const reply = await sendChatMessage(text, destination, language, history);
      addAssistantMessage(reply);
      if (fromVoice) speakAndContinue(reply);
    } catch (error) {
      const notice = error instanceof ApiAuthenticationError
        ? localize('Your session ended. Sign in again.', 'انتهت جلسة الدخول. سجّل الدخول مجدداً.', 'Votre session a expiré. Reconnectez-vous.')
        : localize('Sindbad is temporarily unavailable.', 'سندباد غير متاح مؤقتاً.', 'Sindbad est temporairement indisponible.');
      setServiceNotice(notice);
      if (fromVoice) speakAndContinue(notice);
    } finally {
      setIsLoading(false);
    }
  }

  const toggleVoiceConversation = () => {
    if (voiceModeRef.current) {
      stopVoiceConversation();
      return;
    }
    const browserWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    if (!(browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition)) {
      setServiceNotice(localize(
        'Voice conversation is not supported on this browser.',
        'المحادثة الصوتية غير مدعومة في هذا المتصفح.',
        'La conversation vocale n’est pas prise en charge par ce navigateur.'
      ));
      return;
    }
    voiceModeRef.current = true;
    setVoiceMode(true);
    setServiceNotice(null);
    startRecognition();
  };

  const closeChat = () => {
    stopVoiceConversation();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <MascotSindbad size="sm" mood={voiceMode ? 'thinking' : 'happy'} />
            <div className="min-w-0">
              <h2 className="truncate text-base font-black">{t.sindbadAiCompanion}</h2>
              <p className="truncate text-xs text-blue-100">{voiceMode ? localize(isListening ? 'Listening…' : 'Voice call active', isListening ? 'أستمع إليك…' : 'المحادثة الصوتية مفعّلة', isListening ? 'Écoute…' : 'Conversation vocale active') : destination}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button id="ai-voice-call-btn" type="button" onClick={toggleVoiceConversation} className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition ${voiceMode ? 'bg-rose-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'}`} aria-pressed={voiceMode} aria-label={voiceMode ? localize('End voice call', 'إنهاء المحادثة الصوتية', 'Terminer l’appel vocal') : localize('Start voice call', 'بدء محادثة صوتية', 'Démarrer un appel vocal')}>
              {voiceMode ? <PhoneOff className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
              <span className="hidden sm:inline">{voiceMode ? localize('End', 'إنهاء', 'Terminer') : localize('Voice', 'صوت', 'Voix')}</span>
            </button>
            <button type="button" onClick={closeChat} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15" aria-label={localize('Close', 'إغلاق', 'Fermer')}><X className="h-4 w-4" /></button>
          </div>
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
                      <button key={`${message.id}-${action.target}-${action.label}`} type="button" onClick={() => { onNavigateApp(action); closeChat(); }} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">
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
          <button type="button" onClick={toggleVoiceConversation} className={`rounded-2xl p-2.5 transition ${voiceMode ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} aria-label={voiceMode ? localize('End voice call', 'إنهاء المحادثة الصوتية', 'Terminer l’appel vocal') : localize('Start voice call', 'بدء محادثة صوتية', 'Démarrer un appel vocal')}>
            <Mic className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void sendMessage(inputValue); }}
            placeholder={localize('Ask anything about travel or the app', 'اسأل عن السفر أو التطبيق', 'Question sur le voyage ou l’application')}
            className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
          />
          <button id="send-ai-chat-btn" type="button" onClick={() => void sendMessage(inputValue)} disabled={!inputValue.trim() || isLoading} className="rounded-2xl bg-blue-600 p-2.5 text-white disabled:opacity-40"><Send className="h-4 w-4 rtl:rotate-180" /></button>
        </div>
      </div>
    </div>
  );
};
