import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

const IOS_HINT_SEEN_KEY = 'sindbad_ios_install_hint_seen';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((window.navigator as NavigatorWithStandalone).standalone);
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const standalone = isStandalone();
    const ios = isIosDevice();
    setIsInstalled(standalone);
    if (ios && !standalone) {
      try {
        setShowIosHint(localStorage.getItem(IOS_HINT_SEEN_KEY) !== 'true');
      } catch {
        setShowIosHint(true);
      }
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setShowIosHint(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === 'accepted') setIsInstalled(true);
    return choice.outcome === 'accepted';
  }, [deferredPrompt]);

  const dismissIosHint = useCallback(() => {
    setShowIosHint(false);
    try {
      localStorage.setItem(IOS_HINT_SEEN_KEY, 'true');
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }, []);

  return {
    canInstall: Boolean(deferredPrompt) && !isInstalled,
    isInstalled,
    showIosHint: showIosHint && !isInstalled,
    promptInstall,
    dismissIosHint,
  };
}