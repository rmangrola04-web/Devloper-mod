import React from 'react';
import { GitCommit, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { APP_VERSION, getAppVersion } from '../config';

interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  appVersion?: string;
}

export const VersionModal: React.FC<VersionModalProps> = ({ isOpen, onClose, appVersion }) => {
  if (!isOpen) return null;
  const displayVersion = appVersion || getAppVersion();

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 max-w-lg w-full p-4 shadow-xl space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
            <GitCommit className="w-3.5 h-3.5" /> Version History & Changelog
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5 text-xs">
          {/* Latest Release */}
          <div className="p-3 rounded bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-1.5">
            <div className="flex justify-between items-center font-bold">
              <span className="text-blue-700 dark:text-blue-400 flex items-center gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5" /> <span id="changelog-version-display">{displayVersion}</span> (Dock Occupancy Validation & Pre-Assigned Dock Lock)
              </span>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                Latest
              </span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-700 dark:text-slate-300">
              <li><b>Dock Occupancy Validation:</b> Live status checking across all loading, unloading, and shuttle steps to prevent selecting already occupied or assigned docks.</li>
              <li><b>Pre-Assigned Dock Lock:</b> Occupied docks are automatically disabled in selection dropdowns with clear `(Occupied - &lt;VehicleNo&gt;)` indicators.</li>
              <li><b>Form-Level Guards:</b> Strict submission checks prevent assigning vehicles to busy docks across start step, edit operation, and loading/unloading forms.</li>
              <li><b>Dynamic Release:</b> Docks automatically become available for selection once vehicles exit or complete operations.</li>
            </ul>
          </div>

          <div className="p-3 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="flex justify-between items-center font-bold">
              <span className="text-slate-700 dark:text-slate-300 text-xs">v8.9.0 Pro (Transport Master & Unloading Upgrade)</span>
              <span className="text-[10px] text-slate-500 font-mono">Stable</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
              <li><b>Unloading Form Upgrade:</b> Added Total Cases, Damaged Cases (Optional), and Damaged Value in ₹ (Optional) with instant calculation.</li>
              <li><b>Transport Master Import:</b> New dedicated CSV / Excel importer with Column A (Transporter) and Column B (Vehicle Type) multi-field parsing.</li>
              <li><b>Persistent Auth Session:</b> Page refresh no longer logs you out; your login session and workspace role remain saved.</li>
              <li><b>Sample CSV Templates:</b> Instant download buttons for Transport Master, Plan Master, and Vehicle Tracking sheets.</li>
            </ul>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-center text-slate-500">
          <span className="text-[10px] font-mono tracking-wider uppercase">Designed by Rahul Mangrola</span>
        </div>
      </div>
    </div>
  );
};
