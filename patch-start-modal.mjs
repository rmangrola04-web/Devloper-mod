import fs from 'fs';
const file = './src/components/StartStepModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const importSearch = `import { LoadUnloadEntry, ShuttleStep } from '../types';`;
const importReplace = `import { LoadUnloadEntry, ShuttleStep } from '../types';
import { DEFAULT_LOAD_LOCATIONS } from '../data/defaultData';`;
content = content.replace(importSearch, importReplace);

const stateSearch = `  const step = entry.shuttleSteps![stepIndex];
  const [division, setDivision] = useState('AIL');
  const [vType, setVType] = useState(entry.vType || '');
  const [supervisor, setSupervisor] = useState(supervisors[0] || '');
  const [startTime, setStartTime] = useState(() => new Date().toTimeString().substring(0, 5));`;

const stateReplace = `  const step = entry.shuttleSteps![stepIndex];
  const [division, setDivision] = useState(step.unit || 'AIL');
  const [vType, setVType] = useState(entry.vType || '');
  const [supervisor, setSupervisor] = useState(supervisors[0] || '');
  const [startTime, setStartTime] = useState(() => new Date().toTimeString().substring(0, 5));
  const [dock, setDock] = useState(step.bayNo || 'Dock 1');
  const [destination, setDestination] = useState(step.destination || '');
  const [remarks, setRemarks] = useState(step.remarks || '');

  const allDocks = ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4', 'Dock 5', 'Dock 6', 'Dock 7', 'Dock 8', 'Dock 9'];`;

content = content.replace(stateSearch, stateReplace);

const submitSearch = `    updatedSteps[stepIndex] = {
      ...step,
      unit: division,
      operator: supervisor,
      vType,
      startTime,
      status: 'IN-PROGRESS'
    };

    const updatedEntry: LoadUnloadEntry = {
      ...entry,
      shuttleSteps: updatedSteps,
      status: 'LOADING IN-PROGRESS',
      unit: division, // keep root unit updated
      operator: supervisor,
      startTime: entry.startTime || startTime, // set root startTime if not set
      toLoc: step.destination // update current target
    };`;

const submitReplace = `    updatedSteps[stepIndex] = {
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
    };`;

content = content.replace(submitSearch, submitReplace);

const uiSearch = `          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Destination</label>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{step.destination}</div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Division (Mandatory) *</label>
            <select value={division} onChange={e => setDivision(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs">
              <option value="AIL">AIL</option>
              <option value="AHPL">AHPL</option>
            </select>
          </div>`;

const uiReplace = `          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Destination (Drop Point) *</label>
            <input type="text" value={destination} onChange={e => setDestination(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-bold" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Division *</label>
              <select value={division} onChange={e => setDivision(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs">
                <option value="AIL">AIL</option>
                <option value="AHPL">AHPL</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assigned Dock *</label>
              <select value={dock} onChange={e => setDock(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs">
                {allDocks.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Remarks / Notes (Optional)</label>
            <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. verified load" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs" />
          </div>`;

content = content.replace(uiSearch, uiReplace);

fs.writeFileSync(file, content);
console.log('patched StartStepModal');
