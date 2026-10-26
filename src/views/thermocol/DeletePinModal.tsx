import React, { useState } from 'react';
import { Lock, AlertCircle, X, Trash2, ShieldAlert } from 'lucide-react';
import { CompanyType } from './utils';

interface DeletePinModalProps {
  isOpen: boolean;
  title?: string;
  itemDescription: string;
  company: CompanyType;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeletePinModal: React.FC<DeletePinModalProps> = ({
  isOpen,
  title = 'Confirm Security PIN Deletion',
  itemDescription,
  company,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const expectedPin = company === 'HPL' ? '1301' : '7308';
  const companyLabel = company === 'HPL' ? 'AHPL (Abbott Healthcare)' : 'AIL (Abbott India)';

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim() !== expectedPin) {
      setError(`Invalid Security PIN for ${companyLabel}! Required PIN is ${expectedPin}. Deletion blocked.`);
      return;
    }
    setError('');
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden space-y-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-700 to-rose-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-rose-500/30 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-rose-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider">{title}</h3>
              <p className="text-[11px] text-rose-200 font-mono font-medium">{companyLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-rose-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleVerify} className="p-5 space-y-4">
          <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs space-y-1">
            <div className="font-extrabold text-rose-900 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Target Record to Delete:</span>
            </div>
            <div className="text-slate-800 font-medium font-mono text-[11px] break-words pl-5">
              {itemDescription}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-rose-600" />
              <span>Enter Security PIN to Confirm Deletion ({companyLabel}):</span>
            </label>
            <input
              type="password"
              autoFocus
              maxLength={6}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError('');
              }}
              placeholder={`Enter ${expectedPin} to authorize...`}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-rose-600 focus:bg-white rounded-xl text-sm font-mono font-bold tracking-widest outline-none transition shadow-2xs"
            />
            <p className="text-[10px] text-slate-500 italic">
              Authorization required: Enter <strong className="font-mono text-rose-700">{expectedPin}</strong> for {companyLabel}.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-extrabold text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Authorize & Delete Record</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
