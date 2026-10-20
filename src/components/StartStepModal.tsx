import React, { useState } from 'react';
import { LoadUnloadEntry, ShuttleStep } from '../types';
import { DEFAULT_LOAD_LOCATIONS } from '../data/defaultData';
import { isCourierTransporter } from '../utils/wmsDataEngine';

interface StartStepModalProps {
  entry: LoadUnloadEntry;
  stepIndex: number;
  supervisors: string[];
  vehicleTypes: string[];
  loadEntries?: LoadUnloadEntry[];
  onClose: () => void;
  onStart: (updatedEntry: LoadUnloadEntry) => void;
}

export const StartStepModal: React.FC<StartStepModalProps> = ({ entry, stepIndex, supervisors, vehicleTypes, loadEntries = [], onClose, onStart }) => {
  const step = entry.shuttleSteps![stepIndex];
  const [division, setDivision] = useState(step.unit || 'AIL');
  const [vType, setVType] = useState(entry.vType || '');
  const [supervisor, setSupervisor] = useState(supervisors[0] || '');
  const [startTime, setStartTime] = useState(() => new Date().toTimeString().substring(0, 5));
  const [dock, setDock] = useState(step.bayNo || 'Dock 1');
  const [destination, setDestination] = useState(step.destination || '');
  const [remarks, setRemarks] = useState(step.remarks || '');

  const allDocks = ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4', 'Dock 7', 'Dock 8', 'Dock 9'];

  const occupiedDocks = React.useMemo(() => {
    const map = new Map<string, string>();
    loadEntries.forEach(item => {
      // Exclude courier transporters from locking regular docks
      if (isCourierTransporter(item.transporter, item.vType || (item as any).vehicleType)) return;

      const st = (item.status || '').toUpperCase().trim();
      const isCompleted =
        st === 'LOADED' ||
        st === 'UNLOADED' ||
        st === 'COMPLETED' ||
        st === 'DISPATCHED' ||
        st === 'DONE' ||
        st === 'FINISHED' ||
        st === 'EXITED' ||
        st.includes('LOADED') ||
        st.includes('UNLOADED') ||
        st.includes('COMPLETED') ||
        st.includes('DISPATCHED') ||
        st.includes('DONE') ||
        st.includes('FINISHED') ||
        st.includes('EXITED');

      if (!isCompleted) {
        if (item.shuttleSteps && item.shuttleSteps.length > 0) {
          const activeStep =
            item.shuttleSteps.find(s => s.status === 'IN-PROGRESS') ||
            item.shuttleSteps.find(s => s.status === 'PENDING');
          if (activeStep && activeStep.bayNo && activeStep.status !== 'COMPLETED') {
            map.set(activeStep.bayNo, item.vehicleNo);
          }
        } else if (item.bayNo && item.bayNo !== 'Unassigned') {
          map.set(item.bayNo, item.vehicleNo);
        }
      }
    });
    return map;
  }, [loadEntries]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const occupant = occupiedDocks.get(dock);
    if (occupant && occupant.toUpperCase() !== entry.vehicleNo.toUpperCase()) {
      alert(`${dock} is currently Occupied by vehicle ${occupant}. Please select an available dock.`);
      return;
    }

    const updatedSteps = [...entry.shuttleSteps!];
    updatedSteps[stepIndex] = {
      ...step,
      unit: division,
      operator: supervisor,
      vType,
      startTime,
      bayNo: dock,
      destination: destination,
      remarks: remarks,
      status: 'IN-PROGRESS'
    };

    const updatedEntry: LoadUnloadEntry = {
      ...entry,
      shuttleSteps: updatedSteps,
      status: 'LOADING IN-PROGRESS',
      bayNo: stepIndex === entry.currentStepIndex ? dock : entry.bayNo,
      unit: division, // keep root unit updated
      operator: supervisor,
      startTime: entry.startTime || startTime, // set root startTime if not set
      toLoc: destination // update current target
    };
    onStart(updatedEntry);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
          <h3 className="font-bold text-sm">Start Loading Step {stepIndex + 1}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white font-bold">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Vehicle No & Type</label>
            <div className="flex gap-2 items-center"><div className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{entry.vehicleNo}</div><select value={vType} onChange={e => setVType(e.target.value)} className="bg-slate-50 border p-1 rounded text-xs w-full"><option value="">-- Select Type --</option>{vehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Destination (Drop Point) *</label>
            <input type="text" value={destination} onChange={e => setDestination(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-bold" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Division *</label>
              <select value={division} onChange={e => setDivision(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs">
                <option value="AIL">AIL</option>
                <option value="AHPL">AHPL</option>
                <option value="One Abbott">One Abbott</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assigned Dock *</label>
              <select value={dock} onChange={e => setDock(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs">
                {allDocks.map(d => {
                  const occupant = occupiedDocks.get(d);
                  const isOcc = occupant && occupant.toUpperCase() !== entry.vehicleNo.toUpperCase();
                  return (
                    <option key={d} value={d} disabled={isOcc}>
                      {d} {isOcc ? `(Occupied - ${occupant})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Remarks / Notes (Optional)</label>
            <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. verified load" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supervisor Name *</label>
            <select value={supervisor} onChange={e => setSupervisor(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs">
              {supervisors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Time *</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 rounded text-xs">Cancel</button>
            <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-2 rounded text-xs">Start Loading</button>
          </div>
        </form>
      </div>
    </div>
  );
};
