import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { LoadUnloadEntry, PlanEntry, SecurityGateEntry, TrackingRecord } from '../types';
import { BarChart3, TrendingUp, Truck, Package, Layers, Activity } from 'lucide-react';

interface DailyMisAnalyticsViewProps {
  planEntries: PlanEntry[];
  loadEntries: LoadUnloadEntry[];
  securityLogs: SecurityGateEntry[];
  trackingRecords: TrackingRecord[];
}

export const DailyMisAnalyticsView: React.FC<DailyMisAnalyticsViewProps> = ({
  loadEntries,
}) => {
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | 'ALL'>('7D');

  const extractCases = (l: any) => Number(l.totalCases) || Number(l.cases) || Number(l.cartons) || Number(l.qty) || Number(l.originalGateEntry?.totalCases) || 0;
  const getUnit = (l: any) => (l.unit || l.company || 'AHPL').toUpperCase();

  const { totalCases, loadingCases, unloadingCases, ailCases, ahplCases } = useMemo(() => {
    let tCases = 0;
    let lCases = 0;
    let uCases = 0;
    let aCases = 0;
    let hCases = 0;
    
    loadEntries.forEach(entry => {
      const c = extractCases(entry);
      const isLoad = (entry.opType || '').toUpperCase() === 'LOADING';
      const u = getUnit(entry);

      tCases += c;
      if (isLoad) {
        lCases += c;
      } else {
        uCases += c;
      }

      if (u.includes('AIL') || u.includes('BOTH')) {
        aCases += c;
      } else {
        hCases += c;
      }
    });

    return {
      totalCases: tCases,
      loadingCases: lCases,
      unloadingCases: uCases,
      ailCases: aCases,
      ahplCases: hCases
    };
  }, [loadEntries]);

  const dailyChartData = useMemo(() => {
    const map: Record<string, { date: string; loading: number; unloading: number; ail: number; ahpl: number; total: number }> = {};
    
    loadEntries.forEach(entry => {
      const dateStr = (entry.date || entry.dateTime || new Date().toISOString()).substring(0, 10);
      if (!map[dateStr]) {
        map[dateStr] = { date: dateStr, loading: 0, unloading: 0, ail: 0, ahpl: 0, total: 0 };
      }
      const c = extractCases(entry);
      const isLoad = (entry.opType || '').toUpperCase() === 'LOADING';
      const u = getUnit(entry);

      if (isLoad) {
        map[dateStr].loading += c;
      } else {
        map[dateStr].unloading += c;
      }

      if (u.includes('AIL') || u.includes('BOTH')) {
        map[dateStr].ail += c;
      } else {
        map[dateStr].ahpl += c;
      }
      map[dateStr].total += c;
    });

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [loadEntries]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider">Executive MIS Dashboard</span>
            <span className="text-xs text-blue-200">Integrated Central Hub Indore</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Daily MIS Analytics & Performance Intelligence</h2>
          <p className="text-xs text-blue-100/80 mt-1">Real-time aggregation of operational case volumes, loading ratios, and division-wise KPIs using Recharts.</p>
        </div>
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-1.5 rounded-xl border border-white/20">
          <button
            onClick={() => setTimeRange('7D')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${timeRange === '7D' ? 'bg-white text-blue-900 shadow-sm' : 'text-white hover:bg-white/10'}`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setTimeRange('30D')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${timeRange === '30D' ? 'bg-white text-blue-900 shadow-sm' : 'text-white hover:bg-white/10'}`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setTimeRange('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${timeRange === 'ALL' ? 'bg-white text-blue-900 shadow-sm' : 'text-white hover:bg-white/10'}`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Cases Handled</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">{(totalCases || 0).toLocaleString()} <span className="text-xs text-slate-400">Cases</span></h3>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> Active Operational Volume
            </span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Loading vs Unloading</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">{(loadingCases || 0).toLocaleString()} <span className="text-xs text-slate-400">/</span> {(unloadingCases || 0).toLocaleString()}</h3>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 mt-1">
              <Truck className="w-3 h-3" /> {loadingCases + unloadingCases > 0 ? Math.round((loadingCases / (loadingCases + unloadingCases)) * 100) : 0}% Loading Ratio
            </span>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-[#1e293b] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">AIL Division Cases</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">{(ailCases || 0).toLocaleString()} <span className="text-xs text-slate-400">C</span></h3>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 mt-1">
              {totalCases > 0 ? Math.round((ailCases / totalCases) * 100) : 0}% of Total Volume
            </span>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">AHPL Division Cases</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">{(ahplCases || 0).toLocaleString()} <span className="text-xs text-slate-400">C</span></h3>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-1">
              {totalCases > 0 ? Math.round((ahplCases / totalCases) * 100) : 0}% of Total Volume
            </span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Charts Section using Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Total Cases Bar Chart */}
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Daily Case Volume Trend</h3>
              <p className="text-xs text-slate-500">Aggregated loading and unloading cases per day</p>
            </div>
            <span className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-1 rounded-lg font-bold">Recharts Bar</span>
          </div>
          <div className="h-72 w-full">
            {dailyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">No daily operational data recorded yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="loading" name="Loading Cases" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="unloading" name="Unloading Cases" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Division-wise Performance Bar Chart */}
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Division-Wise Performance (AIL vs AHPL)</h3>
              <p className="text-xs text-slate-500">Comparison of daily throughput by company division</p>
            </div>
            <span className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 rounded-lg font-bold">Recharts Grouped</span>
          </div>
          <div className="h-72 w-full">
            {dailyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">No division data recorded yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="ail" name="AIL Division Cases" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ahpl" name="AHPL Division Cases" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
