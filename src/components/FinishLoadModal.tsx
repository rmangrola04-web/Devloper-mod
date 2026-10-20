import React, { useState, useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { LoadUnloadEntry } from '../types';
import { AnimatedStatusChip } from './AnimatedStatusChip';

interface FinishLoadModalProps {
  isOpen: boolean;
  entry: LoadUnloadEntry | null;
  onClose: () => void;
  onConfirm: (entryId: string, totalCases: number, sealNo: string) => void;
}

export const FinishLoadModal: React.FC<FinishLoadModalProps> = ({
  isOpen,
  entry,
  onClose,
  onConfirm
}) => {
  const [cases, setCases] = useState('');
  const [seal, setSeal] = useState('');

  useEffect(() => {
    if (entry) {
      setCases(entry.totalCases ? String(entry.totalCases) : '');
      setSeal(entry.sealNo || '');
    }
  }, [entry]);

  if (!isOpen || !entry) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seal.trim()) {
      alert('Seal Number is required to finish loading!');
      return;
    }
    const casesCount = cases !== '' ? Number(cases) : (Number(entry.totalCases) || 0);
    onConfirm(entry.id, casesCount, seal.trim().toUpperCase());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
      <div className="bg-white  rounded border border-slate-200  max-w-sm w-full p-4 shadow-xl space-y-3">
        <div className="flex justify-between items-center pb-2 border-b border-slate-200 ">
          <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-600  flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Complete Loading Operation
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 :text-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-between items-center text-xs text-slate-500 bg-slate-50  p-2 rounded-lg border border-slate-200 ">
          <div>
            Vehicle: <b className="font-mono text-blue-600 ">{entry.vehicleNo}</b> ({entry.bayNo})
          </div>
          <AnimatedStatusChip status={entry.opType === 'UNLOADING' ? 'UNLOADED' : 'LOADED'} size="sm" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5 text-xs">
          <div>
            <label className="block text-[10px] uppercase font-bold text-amber-700  mb-1">
              Total Cases Loaded <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="number"
              min="0"
              value={cases}
              onChange={(e) => setCases(e.target.value)}
              placeholder="e.g. 160 (Optional)"
              className="w-full bg-slate-50  border border-slate-300  rounded p-1.5 text-xs font-bold text-slate-800 "
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Seal Number *</label>
            <input
              type="text"
              value={seal}
              onChange={(e) => setSeal(e.target.value.toUpperCase())}
              required
              placeholder="e.g. SL-99120"
              className="w-full bg-slate-50  border border-slate-300  rounded p-1.5 text-xs font-mono font-bold uppercase text-slate-800 "
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-200 ">
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded text-xs shadow-xs transition"
            >
              Complete Load
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 rounded text-xs transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
