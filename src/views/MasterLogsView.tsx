import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Filter, 
  Search, 
  Trash2, 
  Pencil, 
  X, 
  SlidersHorizontal, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle,
  Calendar,
  Layers,
  ArrowLeftRight
} from 'lucide-react';
import { LoadUnloadEntry, SecurityGateEntry } from '../types';
import { matchesWmsDateFilter, normalizeWmsDate, isCourierTransporter } from '../utils/wmsDataEngine';
import { AnimatedStatusChip } from '../components/AnimatedStatusChip';

interface MasterLogsViewProps {
  loadEntries: LoadUnloadEntry[];
  securityLogs: SecurityGateEntry[];
  onEditOperation: (entry: LoadUnloadEntry) => void;
  onDeleteOperation: (id: string) => void;
  onFinishLoadModalOpen: (entry: LoadUnloadEntry) => void;
  onFinishUnloadDirect: (id: string) => void;
  onEditGateEntry: (entry: SecurityGateEntry) => void;
  onDeleteGateEntry: (id: string, skipConfirm?: boolean) => void;
  globalFilterValue?: string;
  globalFilterType?: string;
  globalFilterEndDate?: string;
  onGlobalDateFilterChange?: (type: 'DATE' | 'MONTH' | 'RANGE' | 'ALL', val?: string, endVal?: string) => void;
}

export const MasterLogsView: React.FC<MasterLogsViewProps> = ({
  loadEntries,
  securityLogs,
  onEditOperation,
  onDeleteOperation,
  onFinishLoadModalOpen,
  onFinishUnloadDirect,
  onEditGateEntry,
  onDeleteGateEntry,
  globalFilterValue,
  globalFilterType,
  globalFilterEndDate,
  onGlobalDateFilterChange
}) => {
  const [activeTab, setActiveTab] = useState<'dock' | 'gate'>('dock');

  // --- Filter Engine States for Security Logs ---
  const [showFilterCard, setShowFilterCard] = useState(false);
  const [filterMode, setFilterMode] = useState<'DATE' | 'RANGE' | 'MONTH' | 'ALL'>(() => {
    if (globalFilterType === 'RANGE') return 'RANGE';
    if (globalFilterType === 'MONTH') return 'MONTH';
    if (globalFilterType === 'ALL') return 'ALL';
    return 'DATE';
  });

  const getTodayStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayStr = getTodayStr();

  const [selectedDate, setSelectedDate] = useState(() => globalFilterValue || todayStr);
  const [startDate, setStartDate] = useState(() => globalFilterValue || todayStr);
  const [endDate, setEndDate] = useState(() => globalFilterEndDate || todayStr);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  React.useEffect(() => {
    if (globalFilterValue) {
      setSelectedDate(globalFilterValue);
      setStartDate(globalFilterValue);
    }
    if (globalFilterEndDate) {
      setEndDate(globalFilterEndDate);
    }
    if (globalFilterType) {
      if (globalFilterType === 'RANGE') setFilterMode('RANGE');
      else if (globalFilterType === 'MONTH') setFilterMode('MONTH');
      else if (globalFilterType === 'ALL') setFilterMode('ALL');
      else setFilterMode('DATE');
    }
  }, [globalFilterValue, globalFilterEndDate, globalFilterType]);

  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [dockSearchQuery, setDockSearchQuery] = useState('');

  const activeMode = filterMode;

  // --- Active Dock Operations Computations ---
  const filteredDockOperations = useMemo(() => {
    return loadEntries.filter((item) => {
      // 1. Apply date range filters
      const rawDate = item.entryDate || item.dateTime || item.startTime;
      const targetDate = selectedDate;
      let dateMatch = true;

      if (activeMode === 'DATE') {
        dateMatch = matchesWmsDateFilter(rawDate, targetDate, targetDate, targetDate, 'DATE');
      } else if (activeMode === 'RANGE') {
        dateMatch = matchesWmsDateFilter(rawDate, undefined, startDate, endDate, 'RANGE');
      } else if (activeMode === 'MONTH') {
        dateMatch = matchesWmsDateFilter(rawDate, selectedMonth, undefined, undefined, 'MONTH');
      } else if (activeMode === 'ALL') {
        dateMatch = true;
      }

      if (!dateMatch) return false;

      // 2. Direct text search
      if (dockSearchQuery.trim()) {
        const query = dockSearchQuery.toLowerCase();
        const vNo = (item.vehicleNo || '').toLowerCase();
        const transp = (item.transporter || '').toLowerCase();
        const dock = (item.bayNo || '').toLowerCase();
        const op = (item.operator || '').toLowerCase();
        const to = (item.toLoc || '').toLowerCase();
        const from = (item.fromLoc || '').toLowerCase();
        return vNo.includes(query) || transp.includes(query) || dock.includes(query) || op.includes(query) || to.includes(query) || from.includes(query);
      }
      return true;
    });
  }, [loadEntries, activeMode, selectedDate, startDate, endDate, selectedMonth, dockSearchQuery]);

  const activeLoadingCount = useMemo(() => {
    return loadEntries.filter(l => l.opType === 'LOADING' && l.status?.includes('IN-PROGRESS') && !isCourierTransporter(l.transporter, l.vType)).length;
  }, [loadEntries]);

  const activeUnloadingCount = useMemo(() => {
    return loadEntries.filter(l => l.opType === 'UNLOADING' && l.status?.includes('IN-PROGRESS') && !isCourierTransporter(l.transporter, l.vType)).length;
  }, [loadEntries]);

  // --- Security Gate Logs Computations ---
  const displayedSecurityLogs = useMemo(() => {
    return securityLogs.filter((item) => {
      // 1. Apply date range filters
      const rawDate = item.entryDate || item.dateTime;
      const targetDate = selectedDate;
      let dateMatch = true;

      if (activeMode === 'DATE') {
        dateMatch = matchesWmsDateFilter(rawDate, targetDate, targetDate, targetDate, 'DATE');
      } else if (activeMode === 'RANGE') {
        dateMatch = matchesWmsDateFilter(rawDate, undefined, startDate, endDate, 'RANGE');
      } else if (activeMode === 'MONTH') {
        dateMatch = matchesWmsDateFilter(rawDate, selectedMonth, undefined, undefined, 'MONTH');
      } else if (activeMode === 'ALL') {
        dateMatch = true;
      }

      if (!dateMatch) return false;

      // 2. Apply search query
      if (logSearchQuery.trim()) {
        const query = logSearchQuery.toLowerCase();
        const vehicle = (item.vehicle || '').toLowerCase();
        const grNo = (item.grNo || '').toLowerCase();
        const transporter = (item.transporter || '').toLowerCase();
        const driver = (item.mobile || '').toLowerCase();
        const purpose = (item.purpose || '').toLowerCase();
        const remarks = (item.remarks || '').toLowerCase();
        return vehicle.includes(query) || grNo.includes(query) || transporter.includes(query) || driver.includes(query) || purpose.includes(query) || remarks.includes(query);
      }

      return true;
    });
  }, [securityLogs, activeMode, selectedDate, startDate, endDate, selectedMonth, logSearchQuery]);

  return (
    <div id="master-logs-container" className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
      
      {/* Visual Page Header */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Master Operational Logs
          </h1>
          <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 mt-1 font-extrabold leading-relaxed">
            Dedicated operational warehouse hub to monitor, filter, complete, and modify live dock activities and gate security records.
          </p>
        </div>

        {/* View Mode Switcher tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full md:w-auto self-start shrink-0">
          <button
            onClick={() => setActiveTab('dock')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'dock'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Active Dock Operations</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${activeTab === 'dock' ? 'bg-blue-800 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'}`}>
              {loadEntries.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('gate')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'gate'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Security Gate movement</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${activeTab === 'gate' ? 'bg-blue-800 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'}`}>
              {securityLogs.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ACTIVE DOCK OPERATIONS TAB VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'dock' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-500" /> Live Operational Dock Status Log
              </h3>
              <p className="text-xs text-slate-500">
                Double-click on any row to open the editor. Complete loading/unloading tasks directly below.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {activeLoadingCount} Active Loading
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {activeUnloadingCount} Active Unloading
              </span>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by vehicle, dock, supervisor, location..."
              value={dockSearchQuery}
              onChange={(e) => setDockSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {dockSearchQuery && (
              <button
                type="button"
                onClick={() => setDockSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Vehicle & Company</th>
                  <th className="py-2.5 px-3">Dock Assigned</th>
                  <th className="py-2.5 px-3">Stop Location</th>
                  <th className="py-2.5 px-3 text-blue-600 dark:text-blue-400">Total Cases</th>
                  <th className="py-2.5 px-3 text-rose-600 dark:text-rose-400">Damage Claims</th>
                  <th className="py-2.5 px-3">Seal / POD Status</th>
                  <th className="py-2.5 px-3">Supervisor</th>
                  <th className="py-2.5 px-3">Operation Timing</th>
                  <th className="py-2.5 px-3">Duration (TAT)</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {filteredDockOperations.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-12 text-slate-400 font-medium">
                      No active operational records match your query.
                    </td>
                  </tr>
                ) : (
                  filteredDockOperations.map((item) => {
                    const isProgress = item.status?.includes('IN-PROGRESS');
                    const isUnload = item.opType === 'UNLOADING';
                    const statusBadge = <AnimatedStatusChip status={item.status || ''} size="sm" />;

                    const hasDamage = (Number(item.damagedCases) > 0) || (Number(item.damagedValue) > 0);

                    return (
                      <tr key={item.id} className="hover:bg-blue-50/30 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onDoubleClick={() => onEditOperation(item)}>
                        <td className="py-2 px-3">{statusBadge}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.entryDate || '-'}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold font-mono text-blue-600 dark:text-blue-400">{item.vehicleNo}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {item.unit || 'AHPL'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {item.transporter || '-'}
                          </div>
                        </td>
                        <td className="py-2 px-3 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">
                          {item.bayNo}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-[11px] text-slate-700 dark:text-slate-300">
                            {isUnload ? (
                              <span>From: <b className="text-emerald-600">{item.fromLoc || '-'}</b></span>
                            ) : (
                              <span>To: <b className="text-blue-600">{item.toLoc || '-'}</b></span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {item.totalCases !== undefined && item.totalCases !== 'N/A' ? `${item.totalCases} Cases` : '-'}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          {hasDamage ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold text-[9px] bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                              ⚠ {item.damagedCases || 0} pcs / ₹{Number(item.damagedValue || 0).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {item.podStatus && item.podStatus !== 'N/A' ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">POD: {item.podStatus}</span>
                          ) : item.sealNo ? (
                            <span className="font-mono text-blue-600 dark:text-blue-400 text-[10px]">Seal: {item.sealNo}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">{item.operator}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                          <div>In: {item.startTime || '-'}</div>
                          <div>Out: {item.endTime || '--'}</div>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{item.duration || '-'}</td>
                        <td className="py-2 px-3 text-center space-x-1.5">
                          {isProgress ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.opType === 'LOADING') {
                                  onFinishLoadModalOpen(item);
                                } else {
                                  onFinishUnloadDirect(item.id);
                                }
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition shadow-xs cursor-pointer"
                            >
                              ✔ Complete
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-black uppercase tracking-wider px-1">Done</span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditOperation(item);
                            }}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteOperation(item.id);
                            }}
                            className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECURITY GATE MOVEMENT TAB VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'gate' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" /> Security Gate movement movement log
              </h3>
              <p className="text-xs text-slate-500">
                Monitor security entry and exit timestamps. Expand the Filter Engine to query older records.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilterCard(!showFilterCard)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl transition border cursor-pointer ${
                  showFilterCard
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>{showFilterCard ? 'Hide Filter Engine' : 'Filter Engine'}</span>
                {showFilterCard ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <span className="text-xs bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-full font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {displayedSecurityLogs.length} Records found
              </span>
            </div>
          </div>

          {/* Filter Engine Card */}
          {showFilterCard && (
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Filter Config
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('DATE');
                    setSelectedDate(todayStr);
                    setLogSearchQuery('');
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Filter
                </button>
              </div>

              {/* Filter controls row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* 1. Mode Select */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Filter Mode</label>
                  <select
                    value={filterMode}
                    onChange={(e) => setFilterMode(e.target.value as any)}
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                  >
                    <option value="DATE">Single Date</option>
                    <option value="RANGE">Date Range</option>
                    <option value="MONTH">Monthly Log</option>
                    <option value="ALL">All History</option>
                  </select>
                </div>

                {/* 2. Target inputs based on mode */}
                <div className="md:col-span-3 flex items-end">
                  {filterMode === 'DATE' && (
                    <div className="w-full">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Target Date</label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                      />
                    </div>
                  )}

                  {filterMode === 'RANGE' && (
                    <div className="w-full grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">End Date</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {filterMode === 'MONTH' && (
                    <div className="w-full">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Target Month</label>
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                      />
                    </div>
                  )}

                  {filterMode === 'ALL' && (
                    <div className="w-full p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-100 dark:border-emerald-900">
                      ✔ Showing all active security records in history (No pagination filter active)
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Gate Search Box */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by vehicle, driver, transporter, GR#..."
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {logSearchQuery && (
              <button
                type="button"
                onClick={() => setLogSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Company & GR No</th>
                  <th className="py-2.5 px-3">Movement Purpose</th>
                  <th className="py-2.5 px-3">Vehicle No</th>
                  <th className="py-2.5 px-3">Vehicle Type</th>
                  <th className="py-2.5 px-3">Driver Contact</th>
                  <th className="py-2.5 px-3">Transporter</th>
                  <th className="py-2.5 px-3">Route (From &rarr; To)</th>
                  <th className="py-2.5 px-3">Gate Pass DateTime</th>
                  <th className="py-2.5 px-3">Remarks / supervisor</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {displayedSecurityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400 font-medium">
                      No security gate movement logs match your filters.
                    </td>
                  </tr>
                ) : (
                  displayedSecurityLogs.map((item) => {
                    const isAil = (item.unit || '').includes('AIL') || (!item.unit && Number(item.grNo) < 703 && Number(item.grNo) >= 616);
                    const isAhpl = (item.unit || '').includes('AHPL') || (!item.unit && Number(item.grNo) >= 703);
                    const displayUnit = isAil ? 'AIL' : isAhpl ? 'AHPL' : (item.unit || '-');

                    return (
                      <tr key={item.id} className="hover:bg-blue-50/30 dark:hover:bg-[#252e3e]/30 transition-colors">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            {displayUnit !== '-' && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                displayUnit === 'AIL'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              }`}>
                                {displayUnit}
                              </span>
                            )}
                            {item.grNo ? (
                              <span className="font-mono font-black text-slate-900 dark:text-slate-100">#{item.grNo}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.purpose === 'Loading'
                              ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              : item.purpose === 'Unloading'
                              ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600'
                          }`}>
                            {item.purpose}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono font-black text-blue-600 dark:text-blue-400">{item.vehicle}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-300">{item.vType || '32SXL'}</td>
                        <td className="py-2 px-3 font-mono text-slate-500 dark:text-slate-300">{item.mobile || '-'}</td>
                        <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">{item.transporter}</td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300 font-semibold">
                          <span>{item.fromLoc}</span> &rarr; <span>{item.toLoc}</span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">{item.dateTime}</td>
                        <td className="py-2 px-3 text-slate-500 max-w-[150px] truncate" title={item.remarks}>{item.remarks || '-'}</td>
                        <td className="py-2 px-3 text-center space-x-1.5">
                          <button
                            onClick={() => onEditGateEntry(item)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteGateEntry(item.id)}
                            className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
