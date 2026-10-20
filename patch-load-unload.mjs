import fs from 'fs';

let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

// 1. Add states
const stateInjectionPoint = `const [totalCasesLoad, setTotalCasesLoad] = useState<string>('');`;
const stateInjectionCode = `const [totalCasesLoad, setTotalCasesLoad] = useState<string>('');

  // Dual Loading State
  const [company1, setCompany1] = useState('AHPL');
  const [supervisor1, setSupervisor1] = useState(supervisors[0] || '');
  const [cases1, setCases1] = useState('');

  const [company2, setCompany2] = useState('AIL');
  const [supervisor2, setSupervisor2] = useState(supervisors[0] || '');
  const [cases2, setCases2] = useState('');

  // Auto-calculation effect
  React.useEffect(() => {
    if (opType === 'LOADING' && unit === 'BOTH') {
      const c1 = Number(cases1) || 0;
      const c2 = Number(cases2) || 0;
      const sum = c1 + c2;
      setTotalCasesLoad(sum > 0 ? sum.toString() : '');
    }
  }, [cases1, cases2, unit, opType]);
`;
content = content.replace(stateInjectionPoint, stateInjectionCode);

// 2. Modify handleSubmit
const newOpInjection = `    const newOp: LoadUnloadEntry = {
      id: \`OP-\${Date.now()}\`,
      opType,
      unit,
      bayNo,
      vehicleNo: vehicleNo.trim().toUpperCase(),
      fromLoc: fromLoc.trim().toUpperCase(),
      toLoc: toLoc.trim().toUpperCase(),
      transporter,
      operator: (opType === 'LOADING' && unit === 'BOTH') ? \`\${supervisor1} & \${supervisor2}\` : operator.trim(),
      startTime: startTime || new Date().toTimeString().substring(0, 5),
      endTime: '',
      duration: '-- In Progress --',
      status: opType === 'LOADING' ? 'LOADING IN-PROGRESS' : 'UNLOADING IN-PROGRESS',
      totalCases: totalCasesVal,
      damagedCases: isUnloading && damagedCases !== '' ? Number(damagedCases) : 0,
      damagedValue: isUnloading && damagedValue !== '' ? Number(damagedValue) : 0,
      podStatus: isUnloading ? unloadingPodStatus : 'N/A',
      grNo: opGrNo,
      remarks: (opType === 'LOADING' && unit === 'BOTH') ? \`Dual Load - \${company1}: \${cases1} cases, \${company2}: \${cases2} cases\` : undefined
    };`;
content = content.replace(/    const newOp: LoadUnloadEntry = \{[\s\S]*?\};/, newOpInjection);


// 3. Update the Cases Loaded Field to be readonly and style changes when BOTH
const totalCasesRegex = /<input[\s\S]*?value=\{totalCasesLoad\}[\s\S]*?onChange=\{\(e\) => setTotalCasesLoad\(e\.target\.value\)\}[\s\S]*?placeholder="e\.g\. 150 \(Optional\)"[\s\S]*?\/>/;
const newTotalCasesInput = `<input
                  type="number"
                  min="0"
                  value={totalCasesLoad}
                  onChange={(e) => setTotalCasesLoad(e.target.value)}
                  placeholder="e.g. 150 (Optional)"
                  readOnly={unit === 'BOTH'}
                  className={\`w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded p-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 \${unit === 'BOTH' ? 'opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}\`}
                />`;
content = content.replace(totalCasesRegex, newTotalCasesInput);

// 4. Inject the Dual Loading Section right after Cases Loaded Field
const dualLoadingSection = `
            {/* DUAL LOADING SECTION (Visible only if BOTH and LOADING) */}
            {opType === 'LOADING' && unit === 'BOTH' && (
              <div className="bg-blue-50/50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
                <h4 className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider border-b border-blue-200 dark:border-blue-800 pb-1">
                  Dual Loading Configuration
                </h4>
                
                {/* Block 1 */}
                <div className="space-y-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Block 1 (First Loading)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Company</label>
                      <select value={company1} onChange={e => setCompany1(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <option value="AHPL">AHPL</option>
                        <option value="AIL">AIL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Supervisor</label>
                      <select value={supervisor1} onChange={e => setSupervisor1(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                        {supervisors.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Cases Loaded</label>
                    <input type="number" min="0" value={cases1} onChange={e => setCases1(e.target.value)} placeholder="0" className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-xs font-bold text-blue-600 dark:text-blue-400" />
                  </div>
                </div>

                {/* Block 2 */}
                <div className="space-y-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Block 2 (Additional Loading)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Company</label>
                      <select value={company2} onChange={e => setCompany2(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <option value="AIL">AIL</option>
                        <option value="AHPL">AHPL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Additional Supervisor</label>
                      <select value={supervisor2} onChange={e => setSupervisor2(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                        {supervisors.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Cases Loaded</label>
                    <input type="number" min="0" value={cases2} onChange={e => setCases2(e.target.value)} placeholder="0" className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-xs font-bold text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>
            )}
`;
const endOfCasesField = `</div>
            )}`;
content = content.replace(endOfCasesField, endOfCasesField + '\n' + dualLoadingSection);

// 5. Hide main Supervisor Incharge if BOTH is selected
const supervisorRegex = /<div(>[\s\S]*?<label className="block text-\[10px\] font-bold text-slate-500 uppercase tracking-wider mb-1">Supervisor Incharge)/;
content = content.replace(supervisorRegex, `{!(opType === 'LOADING' && unit === 'BOTH') && (<div$1`);
const endSupervisorRegex = /<\/select>\n\s*<\/div>/;
// Wait, if I replace the closing div it might match the wrong thing, so let's do a precise string replace
const supervisorFullBlock = `            {/* Supervisor Incharge */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Supervisor Incharge *</label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                {supervisors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>`;

const supervisorReplacement = `            {/* Supervisor Incharge */}
            {!(opType === 'LOADING' && unit === 'BOTH') && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Supervisor Incharge *</label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  {supervisors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}`;
content = content.replace(supervisorFullBlock, supervisorReplacement);

fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
