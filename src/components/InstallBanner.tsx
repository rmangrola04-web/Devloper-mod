import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';

export const InstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone mode (installed PWA)
    const checkStandalone = () => {
      const isStandalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;

      if (isStandalone) {
        setIsInstalled(true);
        setIsVisible(false);
      }
    };

    checkStandalone();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);

    // 2. Catch the beforeinstallprompt event globally
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Only show banner if not already installed
      if (!isInstalled) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 3. Listen for successful app installation
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
      console.log('[PWA] App installed successfully');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isInstalled]);

  // 4. Trigger the native installation prompt
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the native install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response to the install prompt: ${outcome}`);

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsVisible(false);
    }

    // Clear the deferred prompt variable, it can only be used once.
    setDeferredPrompt(null);
  };

  if (!isVisible || isInstalled || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-sky-500/40 text-white p-4 rounded-2xl shadow-2xl backdrop-blur-lg flex items-center justify-between gap-3 animate-slideUp">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-sky-500/20 border border-sky-400/40 rounded-xl text-sky-400 shrink-0">
          <Smartphone className="w-6 h-6 animate-pulse" />
        </div>
        <div className="space-y-0.5">
          <h4 className="font-bold text-sm text-white tracking-wide">Install Abbott WMS App</h4>
          <p className="text-xs text-sky-200">Get faster access, offline support, and full-screen experience.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstallClick}
          className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Install
        </button>
        <button
          onClick={() => setIsVisible(false)}
          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
