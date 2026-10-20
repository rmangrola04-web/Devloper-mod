import React, { useState } from 'react';
import { Smartphone, Download, CheckCircle2, Globe, Shield, Zap, QrCode, Share2, Info } from 'lucide-react';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  appVersion: string;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({ isOpen, onClose, appVersion }) => {
  const [activeTab, setActiveTab] = useState<'install' | 'apk' | 'features'>('install');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const appUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/20 border border-sky-400/40 rounded-xl text-sky-400 shadow-inner">
              <Smartphone className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Android App & APK Center</h2>
              <p className="text-xs text-sky-300 font-mono">Abbott WMS Mobile Experience (v{appVersion})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('install')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'install'
                ? 'bg-sky-500/20 text-sky-300 border-b-2 border-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            PWA Android Install
          </button>
          <button
            onClick={() => setActiveTab('apk')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'apk'
                ? 'bg-sky-500/20 text-sky-300 border-b-2 border-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            APK / TWA Wrapper
          </button>
          <button
            onClick={() => setActiveTab('features')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'features'
                ? 'bg-sky-500/20 text-sky-300 border-b-2 border-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Mobile Features
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-300 text-sm">
          
          {activeTab === 'install' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-gradient-to-br from-sky-950/50 to-blue-950/30 p-4 rounded-xl border border-sky-500/30 flex items-start gap-4">
                <div className="p-3 bg-sky-500/20 rounded-lg text-sky-400 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-white text-base">Instant Progressive Web App (PWA) Install</h3>
                  <p className="text-xs text-sky-200 leading-relaxed">
                    This application is fully PWA compliant. Installing it on your Android phone creates a native-feeling standalone app icon on your home screen with zero app store downloads required.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">How to Install on Android Chrome:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between space-y-2">
                    <span className="w-6 h-6 rounded-full bg-sky-500 text-slate-950 font-extrabold flex items-center justify-center text-xs">1</span>
                    <p className="text-xs text-slate-200 font-medium">Open this URL in Google Chrome on your Android device.</p>
                    <Globe className="w-5 h-5 text-sky-400 self-end opacity-70" />
                  </div>
                  <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between space-y-2">
                    <span className="w-6 h-6 rounded-full bg-sky-500 text-slate-950 font-extrabold flex items-center justify-center text-xs">2</span>
                    <p className="text-xs text-slate-200 font-medium">Tap the Chrome menu (three vertical dots <span className="text-white font-bold">⋮</span> in top right).</p>
                    <Share2 className="w-5 h-5 text-sky-400 self-end opacity-70" />
                  </div>
                  <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between space-y-2">
                    <span className="w-6 h-6 rounded-full bg-sky-500 text-slate-950 font-extrabold flex items-center justify-center text-xs">3</span>
                    <p className="text-xs text-slate-200 font-medium">Select <span className="text-white font-bold">"Install app"</span> or <span className="text-white font-bold">"Add to Home screen"</span>.</p>
                    <Download className="w-5 h-5 text-sky-400 self-end opacity-70" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-white block">App Link for Mobile Device</span>
                  <span className="text-xs text-slate-400 font-mono break-all">{appUrl}</span>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <QrCode className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'apk' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-gradient-to-br from-indigo-950/50 to-slate-900 p-4 rounded-xl border border-indigo-500/30 space-y-2">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-sky-400" />
                  Android APK via Trusted Web Activity (TWA)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  If your enterprise or warehouse deployment requires a signed <span className="text-white font-semibold">.apk</span> file for direct installation or enterprise MDM enrollment, you can package this web application instantly using Google's official Bubblewrap CLI or PWABuilder.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Quick APK Generation Steps:</h4>
                <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 bg-slate-800/60 p-4 rounded-xl border border-slate-700 leading-relaxed">
                  <li>Visit <span className="text-sky-300 font-mono">pwabuilder.com</span> in your browser.</li>
                  <li>Paste your web application URL (<span className="text-white font-mono">{appUrl}</span>).</li>
                  <li>Click <span className="text-white font-semibold">"Generate"</span> and select <span className="text-white font-semibold">"Android"</span>.</li>
                  <li>Download your signed <span className="text-emerald-400 font-mono">app-release.apk</span> ready for Android deployment!</li>
                </ol>
              </div>

              <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-xl flex items-start gap-3 text-amber-200 text-xs">
                <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-amber-300">Enterprise Note:</strong> Because this WMS connects securely in real-time to Firebase Firestore with offline cache support, both the PWA and the generated Android APK operate with full offline queue resilience and instant sync.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'features' && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="font-bold text-white text-base">Optimized Android Mobile Experience</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
                  <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                    <Shield className="w-4 h-4" />
                    Secure Cloud Sync
                  </div>
                  <p className="text-xs text-slate-400">Real-time Firebase Firestore synchronization across gate security and warehouse supervisors.</p>
                </div>
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
                  <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                    <Zap className="w-4 h-4" />
                    Touch-Optimized Dock
                  </div>
                  <p className="text-xs text-slate-400">Dedicated mobile bottom dock with high-contrast buttons designed for warehouse floor operators.</p>
                </div>
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
                  <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                    <Globe className="w-4 h-4" />
                    Offline Resilience
                  </div>
                  <p className="text-xs text-slate-400">Persistent local cache ensures uninterrupted operations during temporary warehouse Wi-Fi drops.</p>
                </div>
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
                  <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                    <Smartphone className="w-4 h-4" />
                    Full Screen Mode
                  </div>
                  <p className="text-xs text-slate-400">Runs without browser URL bars when installed as a PWA or Android APK wrapper.</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">Abbott WMS Mobile Suite</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
