import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, PhoneOff, Send, X } from 'lucide-react';
import { SindbadMark } from './BrandLogo';
import { ApiAuthenticationError, sendChatMessage } from '../services/api';
import { useAuthSession } from '../lib/authSession';
import { SupportedLanguage, TRANSLATIONS } from '../data/translations';
import { AppNavigationAction, resolveAppNavigationHelp } from '../lib/appNavigation';
import { useLocale } from '../lib/i18n';
import { Sheet } from '../ui/Sheet';
import { Button, IconButton } from '../ui/Button';
import { Alert } from '../ui/Feedback';

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
  const locale = useLocale(language);
  const localize = locale.t;
  const { status: authStatus } = useAuthSession();
  const welcome = localize(
    'Hi, I’m Sindbad. Where would you like to go?',
    'أهلاً، أنا سندباد. إلى أين تريد أن تذهب؟',
    'Bonjour, je suis Sindbad. Où souhaitez-vous aller ?'
  );
  const nowLabel = locale.isArabic ? 'الآن' : locale.isFrench ? "À l'instant" : 'Now';
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
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMessages((current) => current.length <= 1
      ? [{ id: 'welcome', sender: 'sindbad', text: welcome, timestamp: nowLabel }]
      : current);
  }, [language]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 260);
  }, [isOpen]);

  useEffect(() => () => {
    voiceModeRef.current = false;
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (!isOpen && voiceModeRef.current) stopVoiceConversation();
  }, [isOpen]);

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
      recognition.lang = locale.isArabic ? 'ar-MA' : locale.isFrench ? 'fr-FR' : 'en-US';
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
    utterance.lang = locale.isArabic ? 'ar-MA' : locale.isFrench ? 'fr-FR' : 'en-US';
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
      const notice = localize('Sign in to continue.', 'سجّل الدخول للمتابعة.', 'Connectez-vous pour continuer.');
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

  const followUp = (action: AppNavigationAction) => {
    onNavigateApp(action);
    closeChat();
  };

  const header = (
    <div className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2.5">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-fill text-on-brand">
        <SindbadMark className="h-5 w-5" tone="onDark" />
        {voiceMode && (
          <span className="absolute inset-0 rounded-full ring-2 ring-positive animate-[sindbad-pulse_1.8s_ease-in-out_infinite]" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-title font-bold tracking-tight text-ink">{t.sindbadAiCompanion}</h2>
        <p className="truncate text-micro text-muted">
          {voiceMode
            ? localize(isListening ? 'Listening…' : 'Voice call active', isListening ? 'أستمع إليك…' : 'المحادثة الصوتية مفعّلة', isListening ? 'Écoute…' : 'Conversation vocale active')
            : destination}
        </p>
      </div>
      <button
        id="ai-voice-call-btn"
        type="button"
        onClick={toggleVoiceConversation}
        aria-pressed={voiceMode}
        aria-label={voiceMode ? localize('End voice call', 'إنهاء المحادثة الصوتية', 'Terminer l’appel vocal') : localize('Start voice call', 'بدء محادثة صوتية', 'Démarrer un appel vocal')}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-label font-bold transition-colors duration-150 ${
          voiceMode
            ? 'border-negative-line bg-negative-fill text-negative-ink'
            : 'border-line-strong bg-surface text-ink-soft hover:bg-surface-muted'
        }`}
      >
        {voiceMode ? <PhoneOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
        <span className="hidden sm:inline">{voiceMode ? localize('End', 'إنهاء', 'Terminer') : localize('Voice', 'صوت', 'Voix')}</span>
      </button>
      <IconButton label={localize('Close', 'إغلاق', 'Fermer')} onClick={closeChat} size="sm" variant="ghost">
        <X className="h-4 w-4" />
      </IconButton>
    </div>
  );

  const composer = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void sendMessage(inputValue);
      }}
      className="flex items-center gap-2"
    >
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        placeholder={localize('Write a message', 'اكتب رسالتك', 'Écrivez un message')}
        aria-label={localize('Message for Sindbad', 'رسالة إلى سندباد', 'Message pour Sindbad')}
        className="h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3.5 text-body text-ink outline-none transition-colors placeholder:text-muted focus:border-brand-500 focus:ring-3 focus:ring-brand-soft"
      />
      <button
        id="send-ai-chat-btn"
        type="submit"
        disabled={!inputValue.trim() || isLoading}
        aria-label={localize('Send message', 'إرسال الرسالة', 'Envoyer le message')}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-fill text-on-brand transition-colors duration-150 hover:bg-brand-500 disabled:bg-surface-sunken disabled:text-muted"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4 sindbad-mirror" aria-hidden="true" />}
      </button>
    </form>
  );

  return (
    <Sheet
      open={isOpen}
      onClose={closeChat}
      size="lg"
      header={header}
      footer={composer}
      language={language}
      className="h-[92dvh] sm:h-[82vh] sm:max-h-[82vh]"
      bodyClassName="bg-canvas"
    >
      <div className="px-3 py-4 sm:px-5">
        {serviceNotice && (
          <Alert
            tone="warning"
            className="mb-3"
            action={authStatus !== 'authed' ? (
              <Button size="sm" variant="secondary" onClick={() => followUp({ target: 'account', label: localize('Sign in', 'تسجيل الدخول', 'Se connecter') })}>
                {localize('Sign in', 'تسجيل الدخول', 'Se connecter')}
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setServiceNotice(null)}>
                {localize('Dismiss', 'إخفاء', 'Ignorer')}
              </Button>
            )}
          >
            {serviceNotice}
          </Alert>
        )}

        <ul className="space-y-4">
          {messages.map((message) => (
            <li key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'gap-2.5'}`}>
              {message.sender === 'sindbad' && (
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-accent">
                  <SindbadMark className="h-3.5 w-3.5" />
                </span>
              )}
              <div className={`min-w-0 ${message.sender === 'user' ? 'max-w-[85%]' : 'flex-1'}`}>
                <div
                  className={
                    message.sender === 'user'
                      ? 'whitespace-pre-line rounded-xl rounded-ee-sm bg-brand-fill px-3.5 py-2.5 text-caption leading-relaxed font-medium text-on-brand'
                      : 'whitespace-pre-line text-body leading-relaxed text-ink-soft'
                  }
                >
                  {message.text.replace(/\*\*/g, '')}
                </div>
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.actions.map((action) => (
                      <Button key={`${message.id}-${action.target}-${action.label}`} size="sm" variant="secondary" onClick={() => followUp(action)}>
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
                <p className={`mt-1 text-micro text-muted tabular-nums ${message.sender === 'user' ? 'text-end' : ''}`}>{message.timestamp}</p>
              </div>
            </li>
          ))}
        </ul>

        {isLoading && (
          <div className="mt-4 flex items-center gap-2.5 text-caption text-muted">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-accent">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            </span>
            <span className="flex items-center gap-1.5">
              {t.thinking}
              <span className="sindbad-typing inline-flex items-end gap-0.5" aria-hidden="true">
                <span className="h-1 w-1 rounded-full bg-muted" />
                <span className="h-1 w-1 rounded-full bg-muted" />
                <span className="h-1 w-1 rounded-full bg-muted" />
              </span>
            </span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
    </Sheet>
  );
};
