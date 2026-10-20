const fs = require('fs');
let content = fs.readFileSync('src/views/DashboardView.tsx', 'utf-8');

const targetStart = '{/* 5 Primary Operational KPI Cards */}';
const targetEnd = '{/* Main Dashboard Interactive Reports Section */}';

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(targetEnd);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find boundaries.");
    process.exit(1);
}

const newCards = `{/* 4 Primary Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Loading Vehicles */}
        <div className="widget-card bg-amber-50/80 dark:bg-[#242c3d] rounded-xl border border-amber-300 dark:border-[#3e4859] shadow-sm transition hover:shadow-md flex flex-col h-full">
          <div className="flex justify-between items-center text-amber-900 dark:text-amber-400 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">Loading Vehicles</span>
            <div className="p-1.5 rounded bg-amber-200/80 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
              <UploadCloud className="w-4 h-4" />
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="widget-main-stat text-amber-950 dark:text-amber-300 flex items-baseline gap-1">
                {totalLoadingVehicles} <span className="text-xs font-bold text-amber-700 dark:text-amber-400 tracking-wide uppercase">Vehicles</span>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-black text-amber-900 dark:text-amber-300">{totalLoadedCases.toLocaleString()}</div>
                <div className="text-[10px] text-amber-800 dark:text-amber-400 font-bold uppercase tracking-wider">Cases</div>
              </div>
            </div>
            
            <div className="mt-auto grid grid-cols-2 gap-2 pt-3 border-t border-amber-200 dark:border-[#3e4859]">
              <div className="bg-white/90 dark:bg-[#2d3748] rounded-md px-2 py-1.5 flex justify-between items-center border border-amber-200/80 dark:border-slate-700">
                <span className="text-amber-800 dark:text-slate-300 font-bold text-[10px] uppercase">Active</span>
                <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">{activeLoadingVehicles}</span>
              </div>
              <div className="bg-white/90 dark:bg-[#2d3748] rounded-md px-2 py-1.5 flex justify-between items-center border border-amber-200/80 dark:border-slate-700">
                <span className="text-emerald-800 dark:text-slate-300 font-bold text-[10px] uppercase">Loaded</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">{completedLoadingVehicles}</span>
              </div>
              
              <div className="col-span-2 grid grid-cols-2 gap-2 mt-1">
                <div className="bg-amber-100/70 dark:bg-amber-900/40 rounded-md p-2 flex flex-col justify-between h-full border border-amber-200/50 dark:border-amber-700/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-black text-amber-900 dark:text-amber-300 uppercase tracking-widest">AIL</span>
                    <span className="font-mono font-bold text-amber-950 dark:text-amber-200 text-xs">{ailLoadingCount} <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-400">Veh</span></span>
                  </div>
                  <div className="text-[10px] text-amber-800 dark:text-amber-300/90 font-bold text-right mt-1 pt-1 border-t border-amber-200/60 dark:border-amber-700/60">
                    {ailLoadedCases.toLocaleString()} Cases
                  </div>
                </div>
                <div className="bg-amber-100/70 dark:bg-amber-900/40 rounded-md p-2 flex flex-col justify-between h-full border border-amber-200/50 dark:border-amber-700/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-black text-amber-900 dark:text-amber-300 uppercase tracking-widest">AHPL</span>
                    <span className="font-mono font-bold text-amber-950 dark:text-amber-200 text-xs">{ahplLoadingCount} <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-400">Veh</span></span>
                  </div>
                  <div className="text-[10px] text-amber-800 dark:text-amber-300/90 font-bold text-right mt-1 pt-1 border-t border-amber-200/60 dark:border-amber-700/60">
                    {ahplLoadedCases.toLocaleString()} Cases
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Total Unloading Vehicles */}
        <div className="widget-card bg-blue-50/80 dark:bg-[#242c3d] rounded-xl border border-blue-300 dark:border-[#3e4859] shadow-sm transition hover:shadow-md flex flex-col h-full">
          <div className="flex justify-between items-center text-blue-900 dark:text-blue-400 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">Unloading Vehicles</span>
            <div className="p-1.5 rounded bg-blue-200/80 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300">
              <DownloadCloud className="w-4 h-4" />
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="widget-main-stat text-blue-950 dark:text-blue-300 flex items-baseline gap-1">
                {totalUnloadingVehicles} <span className="text-xs font-bold text-blue-700 dark:text-blue-400 tracking-wide uppercase">Vehicles</span>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-black text-blue-900 dark:text-blue-300">{totalUnloadedCases.toLocaleString()}</div>
                <div className="text-[10px] text-blue-800 dark:text-blue-400 font-bold uppercase tracking-wider">Cases</div>
              </div>
            </div>
            
            <div className="mt-auto grid grid-cols-2 gap-2 pt-3 border-t border-blue-200 dark:border-[#3e4859]">
              <div className="bg-white/90 dark:bg-[#2d3748] rounded-md px-2 py-1.5 flex justify-between items-center border border-blue-200/80 dark:border-slate-700">
                <span className="text-blue-800 dark:text-slate-300 font-bold text-[10px] uppercase">Active</span>
                <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">{activeUnloadingVehicles}</span>
              </div>
              <div className="bg-white/90 dark:bg-[#2d3748] rounded-md px-2 py-1.5 flex justify-between items-center border border-blue-200/80 dark:border-slate-700">
                <span className="text-emerald-800 dark:text-slate-300 font-bold text-[10px] uppercase">Unloaded</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">{completedUnloadingVehicles}</span>
              </div>
              
              <div className="col-span-2 grid grid-cols-2 gap-2 mt-1">
                <div className="bg-blue-100/70 dark:bg-blue-900/40 rounded-md p-2 flex flex-col justify-between h-full border border-blue-200/50 dark:border-blue-700/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-black text-blue-900 dark:text-blue-300 uppercase tracking-widest">AIL</span>
                    <span className="font-mono font-bold text-blue-950 dark:text-blue-200 text-xs">{ailUnloadingCount} <span className="text-[9px] font-semibold text-blue-700 dark:text-blue-400">Veh</span></span>
                  </div>
                  <div className="text-[10px] text-blue-800 dark:text-blue-300/90 font-bold text-right mt-1 pt-1 border-t border-blue-200/60 dark:border-blue-700/60">
                    {ailUnloadedCases.toLocaleString()} Cases
                  </div>
                </div>
                <div className="bg-blue-100/70 dark:bg-blue-900/40 rounded-md p-2 flex flex-col justify-between h-full border border-blue-200/50 dark:border-blue-700/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-black text-blue-900 dark:text-blue-300 uppercase tracking-widest">AHPL</span>
                    <span className="font-mono font-bold text-blue-950 dark:text-blue-200 text-xs">{ahplUnloadingCount} <span className="text-[9px] font-semibold text-blue-700 dark:text-blue-400">Veh</span></span>
                  </div>
                  <div className="text-[10px] text-blue-800 dark:text-blue-300/90 font-bold text-right mt-1 pt-1 border-t border-blue-200/60 dark:border-blue-700/60">
                    {ahplUnloadedCases.toLocaleString()} Cases
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Completed Plans */}
        <div className="widget-card bg-emerald-50/80 dark:bg-[#242c3d] rounded-xl border border-emerald-300 dark:border-[#3e4859] shadow-sm transition hover:shadow-md flex flex-col h-full">
          <div className="flex justify-between items-center text-emerald-900 dark:text-emerald-400 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">Completed Plans</span>
            <div className="p-1.5 rounded bg-emerald-200/80 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="widget-main-stat text-emerald-950 dark:text-emerald-300">
                {completedPlansToday}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold uppercase tracking-wider">
                  Plans<br/>Finished
                </span>
              </div>
            </div>
            
            <div className="mt-auto pt-3 border-t border-emerald-200 dark:border-[#3e4859]">
              <div className="bg-emerald-100/70 dark:bg-emerald-900/40 rounded-md p-3 flex flex-col border border-emerald-200/50 dark:border-emerald-700/50">
                 <p className="text-xs text-emerald-800 dark:text-emerald-300 font-bold mb-1">
                   Confirmed / Archived
                 </p>
                 <p className="text-[10px] text-emerald-700/80 dark:text-slate-400 font-medium">
                   Fully executed plans successfully cleared from the pending queue.
                 </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Gate Inward Vehicles (AIL & AHPL in One Single Block) */}
        <div className="widget-card bg-purple-50/80 dark:bg-[#242c3d] rounded-xl border border-purple-300 dark:border-[#3e4859] shadow-sm transition hover:shadow-md flex flex-col h-full">
          <div className="flex justify-between items-center text-purple-900 dark:text-purple-400 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">PENDING PLAN</span>
            <div className="p-1.5 rounded bg-purple-200/80 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="widget-main-stat text-purple-950 dark:text-purple-300">
                {totalPendingPlans}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-purple-700 dark:text-purple-400 font-bold uppercase tracking-wider">
                  Total<br/>Pending
                </span>
              </div>
            </div>
            
            <div className="mt-auto grid grid-cols-2 gap-2 pt-3 border-t border-purple-200 dark:border-[#3e4859]">
              <div className="bg-purple-100/70 dark:bg-purple-900/40 rounded-md p-2 flex flex-col items-center justify-center border border-purple-200/50 dark:border-purple-700/50">
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-900 dark:text-purple-300 mb-1">AIL</span>
                <span className="text-sm font-mono font-black text-purple-950 dark:text-purple-200">{ailPendingPlans} <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-400">{ailPendingPlans === 1 ? 'Plan' : 'Plans'}</span></span>
              </div>
              <div className="bg-purple-100/70 dark:bg-purple-900/40 rounded-md p-2 flex flex-col items-center justify-center border border-purple-200/50 dark:border-purple-700/50">
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-900 dark:text-purple-300 mb-1">AHPL</span>
                <span className="text-sm font-mono font-black text-purple-950 dark:text-purple-200">{ahplPendingPlans} <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-400">{ahplPendingPlans === 1 ? 'Plan' : 'Plans'}</span></span>
              </div>
            </div>
          </div>
        </div>

      </div>
      
      `;

const finalContent = content.substring(0, startIndex) + newCards + content.substring(endIndex);

fs.writeFileSync('src/views/DashboardView.tsx', finalContent);
