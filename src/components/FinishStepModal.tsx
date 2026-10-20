import React, { useState } from 'react';
import { LoadUnloadEntry } from '../types';
import { AnimatedStatusChip } from './AnimatedStatusChip';

interface FinishStepModalProps {
  entry: LoadUnloadEntry;
  stepIndex: number;
  onClose: () => void;
  onFinish: (updatedEntry: LoadUnloadEntry) => void;
}

export const FinishStepModal: React.FC<FinishStepModalProps> = ({ entry, stepIndex, onClose, onFinish }) => {
  const step = entry.shuttleSteps![stepIndex];
  const [endTime, setEndTime] = useState(() => step.endTime || new Date().toTimeString().substring(0, 5));
  const [cases, setCases] = useState(step.cases ? String(step.cases) : '');
  const [remarks, setRemarks] = useState(step.remarks || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSteps = [...entry.shuttleSteps!];
    updatedSteps[stepIndex] = {
      ...step,
      endTime,
      cases: Number(cases) || 0,
      remarks,
      status: 'COMPLETED'
    };

    const allCompleted = updatedSteps.every(s => s.status === 'COMPLETED');

    let updatedEntry: LoadUnloadEntry = {
      ...entry,
      shuttleSteps: updatedSteps,
    };

    if (allCompleted) {
      updatedEntry.status = 'LOADED';
      updatedEntry.endTime = endTime; // Complete entire operation
      updatedEntry.totalCases = updatedSteps.reduce((acc, s) => acc + (Number(s.cases) || 0), 0);
    } else {
      updatedEntry.status = 'SHUTTLE TRANSIT'; // Ready for next step
      // Only advance currentStepIndex sequentially if it hasn't exceeded
      const nextPending = updatedSteps.findIndex(s => s.status !== 'COMPLETED');
      updatedEntry.currentStepIndex = nextPending !== -1 ? nextPending : entry.currentStepIndex;
      if (nextPending !== -1) {
          updatedEntry.bayNo = updatedSteps[nextPending].bayNo; // Move the vehicle to the next dock
      }
    }

    onFinish(updatedEntry);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 p-4">
      <div className="bg-white  rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-emerald-600 p-4 flex justify-between items-center text-white">
          <h3 className="font-bold text-sm">Finish Loading Step {stepIndex + 1}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white font-bold">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="flex justify-between items-center bg-slate-50  p-2.5 rounded-lg border border-slate-200 ">
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase">Destination</label>
              <div className="text-xs font-bold text-slate-800 ">{step.destination}</div>
            </div>
            <AnimatedStatusChip status={stepIndex + 1 === (entry.shuttleSteps?.length || 1) ? (entry.opType === 'UNLOADING' ? 'UNLOADED' : 'LOADED') : 'SHUTTLE TRANSIT'} size="sm" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Cases / Cartons *</label>
            <input type="number" min="1" value={cases} onChange={e => setCases(e.target.value)} required className="w-full bg-slate-50  border border-slate-300  rounded p-2 text-xs font-mono" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Remarks / Notes (Optional)</label>
            <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. loading complete" className="w-full bg-slate-50  border border-slate-300  rounded p-2 text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Exit Time *</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="w-full bg-slate-50  border border-slate-300  rounded p-2 text-xs" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-200  text-slate-700  font-bold py-2 rounded text-xs">Cancel</button>
            <button type="submit" className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded text-xs">Complete Step</button>
          </div>
        </form>
      </div>
    </div>
  );
};
