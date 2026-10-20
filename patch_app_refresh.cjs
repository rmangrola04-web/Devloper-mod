const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add states
const stateTarget = `  // ----------------------------------------------------
  // GLOBAL DATE FILTER STATE
  // ----------------------------------------------------`;
const stateReplace = `  // ----------------------------------------------------
  // GLOBAL DATE FILTER & AUTO-REFRESH STATE
  // ----------------------------------------------------
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (autoRefresh) {
      interval = setInterval(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 30000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);
`;
content = content.replace(stateTarget, stateReplace);

// 2. Add refreshTrigger to useEffect dependencies
const depsTarget = `  }, [startIso, endIso]);`;
const depsReplace = `  }, [startIso, endIso, refreshTrigger]);`;
content = content.replace(depsTarget, depsReplace);

// 3. Add UI in header
const headerTarget = `            <div className="flex items-center gap-2.5">
              {/* Global Date Filter */}`;
const headerReplace = `            <div className="flex items-center gap-2.5">
              {/* Auto-Refresh Toggle */}
              <div className="flex items-center gap-1.5 hidden md:flex mr-1">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={\`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all \${autoRefresh ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/50' : 'bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400 border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'}\`}
                  title="Auto-refresh data every 30 seconds"
                >
                  <RefreshCw className={\`w-3.5 h-3.5 \${autoRefresh ? 'animate-spin' : ''}\`} />
                  <span className="hidden lg:inline">{autoRefresh ? 'Auto-Refresh: ON' : 'Auto-Refresh: OFF'}</span>
                </button>
              </div>

              {/* Global Date Filter */}`;
content = content.replace(headerTarget, headerReplace);

fs.writeFileSync('src/App.tsx', content);
console.log('patched App.tsx with auto-refresh');
