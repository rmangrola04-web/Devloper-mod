import fs from 'fs';
const file = './src/components/FinishStepModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const stateSearch = `  const [endTime, setEndTime] = useState(() => new Date().toTimeString().substring(0, 5));
  const [cases, setCases] = useState('');`;

const stateReplace = `  const [endTime, setEndTime] = useState(() => new Date().toTimeString().substring(0, 5));
  const [cases, setCases] = useState('');
  const [remarks, setRemarks] = useState(step.remarks || '');`;

content = content.replace(stateSearch, stateReplace);

const submitSearch = `    updatedSteps[stepIndex] = {
      ...step,
      endTime,
      cases: Number(cases) || 0,
      status: 'COMPLETED'
    };`;

const submitReplace = `    updatedSteps[stepIndex] = {
      ...step,
      endTime,
      cases: Number(cases) || 0,
      remarks,
      status: 'COMPLETED'
    };`;

content = content.replace(submitSearch, submitReplace);

const uiSearch = `          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Cases / Cartons *</label>
            <input type="number" min="1" value={cases} onChange={e => setCases(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono" />
          </div>`;

const uiReplace = `          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Cases / Cartons *</label>
            <input type="number" min="1" value={cases} onChange={e => setCases(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Remarks / Notes (Optional)</label>
            <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. loading complete" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs" />
          </div>`;

content = content.replace(uiSearch, uiReplace);

fs.writeFileSync(file, content);
console.log('patched FinishStepModal');
