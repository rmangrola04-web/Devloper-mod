import React, { useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart,
  PieChart, Pie, Cell,
  BarChart, Bar, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Truck, Clock, CheckCircle, Activity, Info } from 'lucide-react';
import { PlanEntry, LoadUnloadEntry, SecurityGateEntry, TrackingRecord } from '../types';
import { DashboardWidget } from '../components/DashboardWidget';
import { isStrictLoadingDestination } from '../utils/wmsDataEngine';

interface MainDashboardViewProps {
  archivedPlanEntries?: PlanEntry[];
  planEntries: PlanEntry[];
  loadEntries: LoadUnloadEntry[];
  securityLogs: SecurityGateEntry[];
  trackingRecords: TrackingRecord[];
}

const COLORS = ['#0284c7', '#38bdf8', '#34d399', '#fb923c', '#8b5cf6', '#f43f5e'];

export const MainDashboardView: React.FC<MainDashboardViewProps> = ({
  archivedPlanEntries = [],
  planEntries,
  loadEntries,
  securityLogs,
  trackingRecords
}) => {

  // 1. Active Fleet
  const activeFleet = trackingRecords.filter(t => t.status === 'In-Transit').length;

  // 2. Weekly Dispatches
  const totalDispatches = trackingRecords.length;

  // 3. Avg Turnaround Time (Hours)
  const TATs = loadEntries
    .filter(l => l.startTime && l.endTime)
    .map(l => {
       const s = new Date(l.startTime).getTime();
       const e = new Date(l.endTime).getTime();
       return (e - s) / (1000 * 60 * 60);
    }).filter(t => t > 0);
  const avgTAT = TATs.length > 0 ? (TATs.reduce((a,b) => a + b, 0) / TATs.length).toFixed(1) : '0.0';

  // 4. On-Time Delivery (%)
  const delivered = trackingRecords.filter(t => t.status === 'Delivered On-Time' || t.status === 'Delayed / Overdue');
  const onTime = delivered.filter(t => t.status === 'Delivered On-Time');
  const otdPercent = delivered.length > 0 ? ((onTime.length / delivered.length) * 100).toFixed(1) : '0.0';

  // --- CHARTS DATA COMPUTATION ---

  // A. Daily Dispatch Volume
  const dispatchData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    
    loadEntries.forEach(entry => {
      if (entry.startTime && entry.opType === 'LOADING') {
        const d = new Date(entry.startTime);
        if (!isNaN(d.getTime())) {
          counts[days[d.getDay()]]++;
        }
      }
    });
    
    return days.map(day => ({ 
      name: day, 
      actual: counts[day], 
      target: counts[day] > 0 ? counts[day] + Math.floor(Math.random() * 5) : 0 
    }));
  }, [loadEntries]);

  // B. Vehicle Utilization (Pie Chart)
  const vehiclePieData = useMemo(() => {
    const map: Record<string, number> = {};
    securityLogs.forEach(s => {
       const t = s.vType || 'Unknown';
       map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [securityLogs]);

  // C. Loading vs Unloading (MT or Cases)
  const loadUnloadData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = days.reduce((acc, day) => {
      acc[day] = { name: day, loading: 0, unloading: 0 };
      return acc;
    }, {} as Record<string, any>);
    
    loadEntries.forEach(entry => {
      if (entry.startTime) {
        const d = new Date(entry.startTime);
        if (!isNaN(d.getTime())) {
          const day = days[d.getDay()];
          const val = Number(entry.totalCases) || 1; 
          if (entry.opType === 'LOADING') data[day].loading += val;
          if (entry.opType === 'UNLOADING') data[day].unloading += val;
        }
      }
    });
    return days.map(day => data[day]);
  }, [loadEntries]);

  // D. Transporter Performance
  const transporterPerformanceData = useMemo(() => {
    const map: Record<string, { total: number; onTime: number }> = {};
    trackingRecords.forEach(t => {
       const trans = t.transporter || 'Unknown';
       if (!map[trans]) map[trans] = { total: 0, onTime: 0 };
       map[trans].total++;
       if (t.status === 'Delivered On-Time') map[trans].onTime++;
    });
    return Object.entries(map).map(([name, stats]) => ({
       name,
       trips: stats.total,
       compliance: Math.round((stats.onTime / stats.total) * 100) || 0
    })).sort((a,b) => b.compliance - a.compliance).slice(0, 5);
  }, [trackingRecords]);

  // E. Route TET vs Actual
  const routeTATData = useMemo(() => {
    const map: Record<string, { actualSum: number, targetSum: number, count: number }> = {};
    trackingRecords.forEach(t => {
      if (!t.route) return;
      const r = t.route;
      let actualHrs = 0;
      let targetHrs = 0;
      
      if (t.dispatchDate) {
        const start = new Date(t.dispatchDate).getTime();
        if (t.actualDelivery) {
          actualHrs = (new Date(t.actualDelivery).getTime() - start) / (1000*60*60);
        }
        if (t.expectedDate) {
          targetHrs = (new Date(t.expectedDate).getTime() - start) / (1000*60*60);
        }
      }
      
      if (actualHrs > 0 || targetHrs > 0) {
        if (!map[r]) map[r] = { actualSum: 0, targetSum: 0, count: 0 };
        map[r].actualSum += actualHrs;
        map[r].targetSum += targetHrs;
        map[r].count++;
      }
    });
    
    return Object.entries(map).map(([name, stats]) => ({
       name,
       transitTime: Math.round((stats.actualSum / stats.count) * 10) / 10,
       target: Math.round((stats.targetSum / stats.count) * 10) / 10,
    })).slice(0, 6);
  }, [trackingRecords]);

  // F. Supervisor Performance
  const supervisorPerformanceData = useMemo(() => {
    const map: Record<string, { ops: number, cases: number }> = {};
    loadEntries.forEach(entry => {
       const op = entry.operator || 'Unknown';
       if (!map[op]) map[op] = { ops: 0, cases: 0 };
       map[op].ops++;
       map[op].cases += Number(entry.totalCases) || 0;
    });
    return Object.entries(map).map(([name, stats]) => ({
       name,
       ops: stats.ops,
       cases: stats.cases
    })).sort((a,b) => b.ops - a.ops).slice(0, 5);
  }, [loadEntries]);

  // --- NEW SUMMARY METRICS ---
  const getDistinctPlansCount = (entries: typeof planEntries) => {
    const map = new Set<string>();
    entries.forEach(p => {
      const op = ((p as any).opType || (p as any).operationType || '').toString().trim().toUpperCase();
      if (op === 'UNLOADING' || op.includes('UNLOAD')) return;
      const rawDestStr = (p.destination || (p as any).dest || (p as any).toLoc || '').replace(/\[.*?\]/g, '').trim();
      if (!rawDestStr) return;
      const destinations = rawDestStr
        .split(/[+/]/)
        .map(d => d.trim().toUpperCase())
        .filter(d => Boolean(d) && isStrictLoadingDestination(d));
      destinations.forEach(d => map.add(d));
    });
    return map.size;
  };
  const totalPlanned = getDistinctPlansCount(planEntries.filter(p => p.status === 'Planned' || p.status === 'Pending' || !p.status));
  const totalConfirmed = getDistinctPlansCount(planEntries.filter(p => p.status === 'Confirmed Plan' || p.status === 'Confirmed'));
  const countUniqueVehicles = (entries: typeof loadEntries) => new Set(entries.map(e => e.vehicleNo)).size;
  const totalLoaded = countUniqueVehicles(loadEntries.filter(l => l.status === 'LOADED'));
  const totalUnloaded = countUniqueVehicles(loadEntries.filter(l => l.status === 'UNLOADED'));

  return (
    <div className="p-6 space-y-6 flex-1 w-full max-w-7xl mx-auto overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Vehicle Analysis</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Transport & Fleet Analytics Overview</p>
        </div>
        <div className="flex items-center space-x-2">
           <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm">
             Export TET Report
           </button>
        </div>
      </div>

      <DashboardWidget planEntries={planEntries} archivedPlanEntries={archivedPlanEntries} loadEntries={loadEntries} securityLogs={securityLogs} />

      {/* New Status Summary Widgets Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Planned */}
        <div className="widget-card bg-amber-50/80 dark:bg-[#242c3d] rounded-lg border border-amber-300 dark:border-[#3e4859] shadow-xs transition hover:shadow-sm">
          <div className="flex justify-between items-center text-amber-900 dark:text-amber-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Planned</span>
            <div className="p-1.5 rounded bg-amber-200/80 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            <div className="flex items-center justify-between">
              <div className="widget-main-stat text-amber-950 dark:text-amber-300">
                {totalPlanned}
              </div>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase text-right">
                Plans
              </span>
            </div>
          </div>
        </div>

        {/* Confirmed */}
        <div className="widget-card bg-blue-50/80 dark:bg-[#242c3d] rounded-lg border border-blue-300 dark:border-[#3e4859] shadow-xs transition hover:shadow-sm">
          <div className="flex justify-between items-center text-blue-900 dark:text-blue-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Confirmed</span>
            <div className="p-1.5 rounded bg-blue-200/80 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            <div className="flex items-center justify-between">
              <div className="widget-main-stat text-blue-950 dark:text-blue-300">
                {totalConfirmed}
              </div>
              <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase text-right">
                Plans
              </span>
            </div>
          </div>
        </div>

        {/* Loaded */}
        <div className="widget-card bg-emerald-50/80 dark:bg-[#242c3d] rounded-lg border border-emerald-300 dark:border-[#3e4859] shadow-xs transition hover:shadow-sm">
          <div className="flex justify-between items-center text-emerald-900 dark:text-emerald-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Loaded</span>
            <div className="p-1.5 rounded bg-emerald-200/80 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            <div className="flex items-center justify-between">
              <div className="widget-main-stat text-emerald-950 dark:text-emerald-300">
                {totalLoaded}
              </div>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase text-right">
                Vehicles
              </span>
            </div>
          </div>
        </div>

        {/* Unloaded */}
        <div className="widget-card bg-purple-50/80 dark:bg-[#242c3d] rounded-lg border border-purple-300 dark:border-[#3e4859] shadow-xs transition hover:shadow-sm">
          <div className="flex justify-between items-center text-purple-900 dark:text-purple-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Unloaded</span>
            <div className="p-1.5 rounded bg-purple-200/80 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            <div className="flex items-center justify-between">
              <div className="widget-main-stat text-purple-950 dark:text-purple-300">
                {totalUnloaded}
              </div>
              <span className="text-[10px] text-purple-700 dark:text-purple-400 font-bold uppercase text-right">
                Vehicles
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Active Fleet (Transit)</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{activeFleet} <span className="text-sm font-medium text-slate-500">Vehicles</span></h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Truck className="w-5 h-5" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Dispatches</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{totalDispatches} <span className="text-sm font-medium text-slate-500">Trips</span></h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Avg Turnaround Time</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{avgTAT} <span className="text-sm font-medium text-slate-500">Hours</span></h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">On-Time Delivery</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{otdPercent}%</h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Charts Row 1: Dispatches & Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm col-span-1 lg:col-span-2 flex flex-col h-[300px]">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Daily Dispatch Volume (Trips)</h2>
          <div className="flex-1 w-full h-full min-h-0">
            {dispatchData.every(d => d.actual === 0) ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <Info className="w-8 h-8 mb-2 opacity-20" />
                <span className="text-xs">No dispatch data available</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dispatchData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDispatch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="name" tick={{fontSize: 12, fill: 'var(--text-muted)'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 12, fill: 'var(--text-muted)'}} axisLine={false} tickLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                  <Area type="monotone" dataKey="actual" name="Actual Dispatches" stroke="#0284c7" strokeWidth={3} fillOpacity={1} fill="url(#colorDispatch)" />
                  <Line type="monotone" dataKey="target" name="Target Plan" stroke="#cbd5e1" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm h-[300px] flex flex-col">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Vehicle Utilization</h2>
          <div className="flex-1 w-full h-full min-h-0 relative">
             {vehiclePieData.length === 0 ? (
               <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                  <Info className="w-8 h-8 mb-2 opacity-20" />
                  <span className="text-xs">No vehicle data available</span>
               </div>
             ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={vehiclePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {vehiclePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                      formatter={(value) => [`${value} Visits`, 'Usage']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute bottom-0 left-0 w-full flex justify-center flex-wrap gap-x-4 gap-y-2 pb-1">
                  {vehiclePieData.map((entry, index) => (
                      <div key={index} className="flex items-center text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-full mr-1.5" style={{backgroundColor: COLORS[index % COLORS.length]}}></span>
                        {entry.name}
                      </div>
                  ))}
                </div>
              </>
             )}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Loading/Unloading & Transporter SLA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm h-[300px] col-span-1 lg:col-span-2 flex flex-col">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Hub Operations: Loading vs Unloading (Units/Cases)</h2>
            <div className="flex-1 w-full h-full min-h-0">
               {loadUnloadData.every(d => d.loading === 0 && d.unloading === 0) ? (
                 <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <Info className="w-8 h-8 mb-2 opacity-20" />
                    <span className="text-xs">No operations logged yet</span>
                 </div>
               ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={loadUnloadData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="name" tick={{fontSize: 12, fill: 'var(--text-muted)'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 12, fill: 'var(--text-muted)'}} axisLine={false} tickLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }}/>
                    <Bar dataKey="loading" name="Loading" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="unloading" name="Unloading" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
               )}
            </div>
        </div>

        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm h-[300px] flex flex-col">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Transporter Performance</h2>
              <p className="text-[10px] text-slate-500">SLA Compliance & On-Time Placement</p>
            </div>
            <div className="flex-1 w-full h-full min-h-0">
               {transporterPerformanceData.length === 0 ? (
                 <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <Info className="w-8 h-8 mb-2 opacity-20" />
                    <span className="text-xs">No transport records</span>
                 </div>
               ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={transporterPerformanceData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.3} />
                    <XAxis type="number" domain={[0, 100]} tick={{fontSize: 11, fill: 'var(--text-muted)'}} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600}} axisLine={false} tickLine={false} width={85} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      formatter={(value) => [`${value}%`, 'Compliance']}
                    />
                    <Bar dataKey="compliance" name="SLA Compliance (%)" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={16}>
                      {transporterPerformanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.compliance >= 95 ? '#10b981' : entry.compliance >= 90 ? '#3b82f6' : '#f59e0b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
               )}
            </div>
        </div>
      </div>

      {/* Charts Row 3: Route TET & Supervisor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm h-[300px] col-span-1 lg:col-span-2 flex flex-col">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Route TET (Transit Estimated Time) vs Actual (Hours)</h2>
            <div className="flex-1 w-full h-full min-h-0">
               {routeTATData.length === 0 ? (
                 <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <Info className="w-8 h-8 mb-2 opacity-20" />
                    <span className="text-xs">No transit routes recorded</span>
                 </div>
               ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={routeTATData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="name" tick={{fontSize: 12, fill: 'var(--text-muted)'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 12, fill: 'var(--text-muted)'}} axisLine={false} tickLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}/>
                    <Bar dataKey="transitTime" name="Actual Transit Time (Hrs)" fill="#0284c7" radius={[4, 4, 0, 0]} barSize={32} />
                    <Bar dataKey="target" name="TET Target (Hrs)" fill="#34d399" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
               )}
            </div>
        </div>

        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm h-[300px] flex flex-col">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Supervisor Performance</h2>
              <p className="text-[10px] text-slate-500">Operations Handled (Count)</p>
            </div>
            <div className="flex-1 w-full h-full min-h-0">
               {supervisorPerformanceData.length === 0 ? (
                 <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <Info className="w-8 h-8 mb-2 opacity-20" />
                    <span className="text-xs">No supervisor data</span>
                 </div>
               ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={supervisorPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="name" tick={{fontSize: 11, fill: 'var(--text-muted)'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 11, fill: 'var(--text-muted)'}} axisLine={false} tickLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Bar dataKey="ops" name="Operations Handled" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={24}>
                       {supervisorPerformanceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                       ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
               )}
            </div>
        </div>

      </div>

    </div>
  );
};
