import React from 'react';
import { HelpCircle, X, User, Mail, Phone, GitCommit } from 'lucide-react';
import { APP_VERSION, getAppVersion } from '../config';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  appVersion?: string;
}

export const HelpSupportModal: React.FC<HelpSupportModalProps> = ({ isOpen, onClose, appVersion }) => {
  if (!isOpen) return null;
  const displayVersion = appVersion || getAppVersion();

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-4 shadow-xl space-y-3">
        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
            <HelpCircle className="w-3.5 h-3.5" /> Help & Support Center
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3 text-xs">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Need assistance with warehouse logistics, dock allocation, transport master, or supervisor uploads at ICH Indore? Contact the support desk below:
          </p>

          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded border border-slate-200 dark:border-slate-700 space-y-2">
            <p className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <User className="w-3.5 h-3.5 text-blue-500" />
              <span>Lead Developer: <b className="text-blue-600 dark:text-blue-400">Rahul Mangrola</b></span>
            </p>
            <p className="font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Mail className="w-3.5 h-3.5 text-blue-500" />
              <a href="mailto:devrahul0412@gmail.com" className="hover:underline text-blue-600 dark:text-blue-400">rmangrola04@zohomail.in</a>
            </p>
            <p className="font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Phone className="w-3.5 h-3.5 text-emerald-500" />
              <a href="tel:+919691532690" className="hover:underline text-emerald-600 dark:text-emerald-400 font-mono font-bold">+91 9691532690</a>
            </p>
            <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700/60">
              <p className="font-semibold flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-2"><GitCommit className="w-3.5 h-3.5 text-slate-400" /> Application Version:</span>
                <span id="support-version-display" className="font-mono font-bold text-slate-800 dark:text-slate-200">{displayVersion}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 rounded-lg text-xs transition shadow-xs cursor-pointer"
          >
            Close Support
          </button>
        </div>
      </div>
    </div>
  );
};
