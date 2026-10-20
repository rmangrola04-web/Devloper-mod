import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Update State
const stateTarget = `  const [filterType, setFilterType] = useState<'DATE' | 'MONTH' | 'ALL'>('DATE');
  const [filterValue, setFilterValue] = useState<string>(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return \`\${yyyy}-\${mm}-\${dd}\`;
  });

  const { startIso, endIso } = useMemo(() => {
    if (filterType === 'ALL') return { startIso: undefined, endIso: undefined };
    try {
      if (filterType === 'DATE') {
        const [y, m, d] = filterValue.split('-').map(Number);
        const start = new Date(y, m - 1, d, 0, 0, 0, 0);
        const end = new Date(y, m - 1, d, 23, 59, 59, 999);
        return { startIso: start.toISOString(), endIso: end.toISOString() };
      } else if (filterType === 'MONTH') {
        const [y, m] = filterValue.split('-').map(Number);
        const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
        const end = new Date(y, m, 0, 23, 59, 59, 999);
        return { startIso: start.toISOString(), endIso: end.toISOString() };
      }
    } catch(err) {
      console.warn("Date parse error", err);
    }
    return { startIso: undefined, endIso: undefined };
  }, [filterType, filterValue]);`;

const stateReplacement = `  const [filterType, setFilterType] = useState<'DATE' | 'MONTH' | 'RANGE' | 'ALL'>('DATE');
  const [filterValue, setFilterValue] = useState<string>(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return \`\${yyyy}-\${mm}-\${dd}\`;
  });
  const [filterEndDate, setFilterEndDate] = useState<string>(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return \`\${yyyy}-\${mm}-\${dd}\`;
  });

  const { startIso, endIso } = useMemo(() => {
    if (filterType === 'ALL') return { startIso: undefined, endIso: undefined };
    try {
      if (filterType === 'DATE') {
        const [y, m, d] = filterValue.split('-').map(Number);
        const start = new Date(y, m - 1, d, 0, 0, 0, 0);
        const end = new Date(y, m - 1, d, 23, 59, 59, 999);
        return { startIso: start.toISOString(), endIso: end.toISOString() };
      } else if (filterType === 'MONTH') {
        const [y, m] = filterValue.split('-').map(Number);
        const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
        const end = new Date(y, m, 0, 23, 59, 59, 999);
        return { startIso: start.toISOString(), endIso: end.toISOString() };
      } else if (filterType === 'RANGE') {
        const [sy, sm, sd] = filterValue.split('-').map(Number);
        const [ey, em, ed] = filterEndDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
        return { startIso: start.toISOString(), endIso: end.toISOString() };
      }
    } catch(err) {
      console.warn("Date parse error", err);
    }
    return { startIso: undefined, endIso: undefined };
  }, [filterType, filterValue, filterEndDate]);`;

content = content.replace(stateTarget, stateReplacement);

// 2. Update UI
const uiTarget = `              {/* Global Date Filter */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded p-1 text-xs shadow-sm hidden sm:flex">
                <div className="flex items-center pr-2 border-r border-slate-300 dark:border-slate-600 mr-2">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mr-1.5" />
                  <select 
                    value={filterType} 
                    onChange={(e) => {
                      setFilterType(e.target.value as 'DATE' | 'MONTH' | 'ALL');
                      if (e.target.value === 'MONTH') setFilterValue(filterValue.substring(0, 7));
                    }}
                    className="bg-transparent font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="DATE">Day</option>
                    <option value="MONTH">Month</option>
                    <option value="ALL">All Time</option>
                  </select>
                </div>
                {filterType !== 'ALL' && (
                  <input 
                    type={filterType === 'MONTH' ? 'month' : 'date'}
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="bg-transparent text-slate-700 dark:text-slate-200 font-medium outline-none cursor-pointer w-[110px]"
                  />
                )}
              </div>`;

const uiReplacement = `              {/* Global Date Filter */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded p-1 text-xs shadow-sm hidden md:flex">
                <div className="flex items-center pr-2 border-r border-slate-300 dark:border-slate-600 mr-2">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mr-1.5" />
                  <select 
                    value={filterType} 
                    onChange={(e) => {
                      setFilterType(e.target.value as 'DATE' | 'MONTH' | 'RANGE' | 'ALL');
                      if (e.target.value === 'MONTH') setFilterValue(filterValue.substring(0, 7));
                    }}
                    className="bg-transparent font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="DATE">Day</option>
                    <option value="MONTH">Month</option>
                    <option value="RANGE">Date Range</option>
                    <option value="ALL">All Time</option>
                  </select>
                </div>
                {filterType !== 'ALL' && filterType !== 'RANGE' && (
                  <input 
                    type={filterType === 'MONTH' ? 'month' : 'date'}
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="bg-transparent text-slate-700 dark:text-slate-200 font-medium outline-none cursor-pointer w-[110px]"
                  />
                )}
                {filterType === 'RANGE' && (
                  <div className="flex items-center gap-1">
                    <input 
                      type="date"
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                      className="bg-transparent text-slate-700 dark:text-slate-200 font-medium outline-none cursor-pointer w-[110px]"
                    />
                    <span className="text-slate-400 font-bold px-1">to</span>
                    <input 
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="bg-transparent text-slate-700 dark:text-slate-200 font-medium outline-none cursor-pointer w-[110px]"
                    />
                  </div>
                )}
              </div>`;

content = content.replace(uiTarget, uiReplacement);
fs.writeFileSync('src/App.tsx', content);
console.log('patched App.tsx');
