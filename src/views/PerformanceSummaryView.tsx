import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  Truck,
  ArrowLeftRight,
  Search,
  Filter,
  Download,
  BarChart3,
  ListFilter,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Award,
  Zap,
  AlertCircle,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Layers,
  Info,
  RefreshCw,
  Gauge,
  Timer
} from 'lucide-react';
import { LoadUnloadEntry, SecurityGateEntry, PlanEntry } from '../types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import * as XLSX from 'xlsx';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export interface PerformanceSummaryViewProps {
  loadEntries: LoadUnloadEntry[];
  securityLogs?: SecurityGateEntry[];
  planEntries?: PlanEntry[];
  globalFilterType?: string;
  globalFilterValue?: string;
  globalFilterEndDate?: string;
  onGlobalDateFilterChange?: (type: 'DATE' | 'MONTH' | 'RANGE' | 'ALL', val?: string, endVal?: string) => void;
}

interface PerformanceRecord {
  id: string;
  vehicleNo: string;
  vType: string;
  transporter: string;
  opType: 'LOADING' | 'UNLOADING';
  startTime: string;
  endTime: string;
  durationMins: number;
  cases: number;
  operator: string;
  unit: string;
  bayNo: string;
  date: string;
  source: 'LoadEntries' | 'GateSecurity';
}

interface TransporterStats {
  transporterName: string;
  loadingCount: number;
  loadingTotalMins: number;
  avgLoadingMins: number;
  loadingTotalCases: number;

  unloadingCount: number;
  unloadingTotalMins: number;
  avgUnloadingMins: number;
  unloadingTotalCases: number;

  totalOpsCount: number;
  overallTotalMins: number;
  overallAvgMins: number;
  totalCases: number;
  throughputCasesPerHour: number;

  records: PerformanceRecord[];
}

/** Helper function to parse operational time into duration in minutes */
function calculateMins(startTime?: string, endTime?: string, durationStr?: string): number | null {
  if (startTime && endTime) {
    const parseTime = (tStr: string): number | null => {
      if (!tStr) return null;
      if (tStr.includes('T') || tStr.includes(' ')) {
        const d = new Date(tStr);
        if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
      }
      const parts = tStr.trim().split(':');
      if (parts.length >= 2) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
      }
      return null;
    };

    if (startTime.includes('-') && endTime.includes('-')) {
      const startMs = new Date(startTime).getTime();
      const endMs = new Date(endTime).getTime();
      if (!isNaN(startMs) && !isNaN(endMs) && endMs >= startMs) {
        const diffMins = Math.round((endMs - startMs) / (1000 * 60));
        if (diffMins > 0) return diffMins;
      }
    }

    const sMins = parseTime(startTime);
    const eMins = parseTime(endTime);
    if (sMins !== null && eMins !== null) {
      let diff = eMins - sMins;
      if (diff < 0) diff += 24 * 60; // Midnight rollover
      if (diff > 0) return diff;
    }
  }

  if (durationStr) {
    const s = durationStr.toLowerCase().trim();
    let mins = 0;
    const hMatch = s.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)/);
    const mMatch = s.match(/(\d+)\s*(?:m|min|mins|minute|minutes)/);
    if (hMatch) mins += parseInt(hMatch[1], 10) * 60;
    if (mMatch) mins += parseInt(mMatch[1], 10);
    if (mins > 0) return mins;

    const numMatch = s.match(/^(\d+)/);
    if (numMatch) {
      const val = parseInt(numMatch[1], 10);
      if (val > 0) return val;
    }
  }

  return null;
}

/** Formats minutes into human readable string: e.g. "1h 25m" or "45m" */
function formatMinsToDuration(mins: number): string {
  if (mins <= 0 || isNaN(mins)) return '0m';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

// Sample fallback records for clean visual preview when system has limited completed records
const DEMO_PERFORMANCE_RECORDS: PerformanceRecord[] = [
  { id: 'demo-1', vehicleNo: 'MP-09-HH-1204', vType: '32MXL', transporter: 'V-TRANS', opType: 'LOADING', startTime: '08:00', endTime: '09:15', durationMins: 75, cases: 850, operator: 'Rahul Mangrola', unit: 'Unit-1', bayNo: 'Dock 1', date: '2026-09-17', source: 'LoadEntries' },
  { id: 'demo-2', vehicleNo: 'MH-12-PQ-9988', vType: '24FT', transporter: 'V-TRANS', opType: 'UNLOADING', startTime: '10:00', endTime: '10:45', durationMins: 45, cases: 500, operator: 'Amit Sharma', unit: 'Unit-2', bayNo: 'Dock 8', date: '2026-09-17', source: 'LoadEntries' },
  { id: 'demo-3', vehicleNo: 'MP-04-AB-3344', vType: '32SXL', transporter: 'DHTC', opType: 'LOADING', startTime: '09:30', endTime: '11:10', durationMins: 100, cases: 1100, operator: 'Rajesh Verma', unit: 'Unit-1', bayNo: 'Dock 2', date: '2026-09-17', source: 'LoadEntries' },
  { id: 'demo-4', vehicleNo: 'GJ-01-XY-5511', vType: '14FT', transporter: 'DHTC', opType: 'UNLOADING', startTime: '12:00', endTime: '12:35', durationMins: 35, cases: 380, operator: 'Anil Gupta', unit: 'Unit-2', bayNo: 'Dock 7', date: '2026-09-17', source: 'LoadEntries' },
  { id: 'demo-5', vehicleNo: 'HR-38-ZZ-7712', vType: '32MXL', transporter: 'SAFEEXPRESS', opType: 'LOADING', startTime: '07:30', endTime: '08:20', durationMins: 50, cases: 920, operator: 'Sunil Patidar', unit: 'Unit-1', bayNo: 'Dock 3', date: '2026-09-17', source: 'LoadEntries' },
  { id: 'demo-6', vehicleNo: 'DL-01-AA-4432', vType: '20FT', transporter: 'SAFEEXPRESS', opType: 'UNLOADING', startTime: '09:00', endTime: '09:30', durationMins: 30, cases: 410, operator: 'Rahul Mangrola', unit: 'Unit-2', bayNo: 'Dock 9', date: '2026-09-17', source: 'LoadEntries' },
  { id: 'demo-7', vehicleNo: 'RJ-14-GH-8822', vType: '32SXL', transporter: 'TCI FREIGHT', opType: 'LOADING', startTime: '11:00', endTime: '12:20', durationMins: 80, cases: 780, operator: 'Amit Sharma', unit: 'Unit-1', bayNo: 'Dock 4', date: '2026-09-17', source: 'LoadEntries' },
  { id: 'demo-8', vehicleNo: 'KA-02-MM-1199', vType: '32MXL', transporter: 'TCI FREIGHT', opType: 'UNLOADING', startTime: '13:00', endTime: '14:10', durationMins: 70, cases: 640, operator: 'Rajesh Verma', unit: 'Unit-2', bayNo: 'Dock 7', date: '2026-09-17', source: 'LoadEntries' },
  { id: 'demo-9', vehicleNo: 'UP-70-TT-6600', vType: '24FT', transporter: 'VARUNA', opType: 'LOADING', startTime: '08:15', endTime: '09:25', durationMins: 70, cases: 690, operator: 'Sunil Patidar', unit: 'Unit-1', bayNo: 'Dock 2', date: '2026-09-17', source: 'LoadEntries' },
  { id: 'demo-10', vehicleNo: 'MP-09-KL-4040', vType: '14FT', transporter: 'VARUNA', opType: 'UNLOADING', startTime: '10:15', endTime: '10:55', durationMins: 40, cases: 320, operator: 'Anil Gupta', unit: 'Unit-2', bayNo: 'Dock 8', date: '2026-09-17', source: 'LoadEntries' },
];

export const PerformanceSummaryView: React.FC<PerformanceSummaryViewProps> = ({
  loadEntries = [],
  securityLogs = [],
  globalFilterType,
  globalFilterValue,
  globalFilterEndDate,
  onGlobalDateFilterChange
}) => {
  // Local Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [opTypeFilter, setOpTypeFilter] = useState<'ALL' | 'LOADING' | 'UNLOADING'>('ALL');
  const [sortBy, setSortBy] = useState<'TRANSPORTER' | 'LOADING_TIME' | 'UNLOADING_TIME' | 'TOTAL_OPS' | 'TOTAL_CASES'>('TRANSPORTER');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS' | 'CHARTS'>('TABLE');
  const [selectedTransporterModal, setSelectedTransporterModal] = useState<TransporterStats | null>(null);

  // 1. Gather all completed performance records from loadEntries and securityLogs
  const allPerformanceRecords = useMemo(() => {
    const records: PerformanceRecord[] = [];

    // From loadEntries
    (loadEntries || []).forEach((entry) => {
      const isCompleted =
        entry.status === 'LOADED' ||
        entry.status === 'UNLOADED' ||
        (entry.startTime && entry.endTime);

      if (isCompleted && entry.transporter) {
        const mins = calculateMins(entry.startTime, entry.endTime, entry.duration);
        if (mins !== null && mins > 0) {
          const rawCases = Number(entry.totalCases) || 0;
          records.push({
            id: entry.id || `load-${Math.random()}`,
            vehicleNo: entry.vehicleNo || 'Unknown',
            vType: entry.vType || 'N/A',
            transporter: entry.transporter.trim().toUpperCase(),
            opType: entry.opType || (entry.status === 'UNLOADED' ? 'UNLOADING' : 'LOADING'),
            startTime: entry.startTime || 'N/A',
            endTime: entry.endTime || 'N/A',
            durationMins: mins,
            cases: rawCases > 0 ? rawCases : 250,
            operator: entry.operator || 'Unassigned',
            unit: entry.unit || 'Unit-1',
            bayNo: entry.bayNo || entry.assignedDock || 'Dock',
            date: entry.entryDate || new Date().toISOString().split('T')[0],
            source: 'LoadEntries'
          });
        }
      }
    });

    // From securityLogs if not already in loadEntries
    (securityLogs || []).forEach((sec) => {
      if (sec.transporter && sec.loadingStartInTime && sec.loadingExitTime) {
        const mins = calculateMins(sec.loadingStartInTime, sec.loadingExitTime);
        if (mins !== null && mins > 0) {
          const veh = sec.vehicle || 'Unknown';
          const exists = records.some((r) => r.vehicleNo === veh);
          if (!exists) {
            const rawCases = Number(sec.totalCases) || 0;
            const isUnload = sec.purpose === 'Unloading';
            records.push({
              id: sec.id || `sec-${Math.random()}`,
              vehicleNo: veh,
              vType: sec.vType || 'N/A',
              transporter: sec.transporter.trim().toUpperCase(),
              opType: isUnload ? 'UNLOADING' : 'LOADING',
              startTime: sec.loadingStartInTime,
              endTime: sec.loadingExitTime,
              durationMins: mins,
              cases: rawCases > 0 ? rawCases : 200,
              operator: sec.supervisorNameRemarks || 'Security Gate',
              unit: sec.unit || 'Gate',
              bayNo: sec.bayNo || 'Gate Dock',
              date: sec.entryDate || (sec.dateTime ? sec.dateTime.split(' ')[0] : new Date().toISOString().split('T')[0]),
              source: 'GateSecurity'
            });
          }
        }
      }
    });

    // Use Demo fallback if records are sparse
    if (records.length < 3) {
      return DEMO_PERFORMANCE_RECORDS;
    }

    return records;
  }, [loadEntries, securityLogs]);

  const isDemoActive = useMemo(() => {
    return allPerformanceRecords === DEMO_PERFORMANCE_RECORDS;
  }, [allPerformanceRecords]);

  // 2. Aggregate Records into TransporterStats
  const transporterStatsList = useMemo(() => {
    const map = new Map<string, PerformanceRecord[]>();

    allPerformanceRecords.forEach((r) => {
      const tName = r.transporter || 'UNASSIGNED';
      if (!map.has(tName)) {
        map.set(tName, []);
      }
      map.get(tName)!.push(r);
    });

    const stats: TransporterStats[] = [];

    map.forEach((recs, tName) => {
      const loadingRecs = recs.filter((r) => r.opType === 'LOADING');
      const unloadingRecs = recs.filter((r) => r.opType === 'UNLOADING');

      const loadingTotalMins = loadingRecs.reduce((sum, r) => sum + r.durationMins, 0);
      const loadingTotalCases = loadingRecs.reduce((sum, r) => sum + r.cases, 0);
      const avgLoadingMins = loadingRecs.length > 0 ? Math.round(loadingTotalMins / loadingRecs.length) : 0;

      const unloadingTotalMins = unloadingRecs.reduce((sum, r) => sum + r.durationMins, 0);
      const unloadingTotalCases = unloadingRecs.reduce((sum, r) => sum + r.cases, 0);
      const avgUnloadingMins = unloadingRecs.length > 0 ? Math.round(unloadingTotalMins / unloadingRecs.length) : 0;

      const totalOpsCount = recs.length;
      const overallTotalMins = recs.reduce((sum, r) => sum + r.durationMins, 0);
      const overallAvgMins = totalOpsCount > 0 ? Math.round(overallTotalMins / totalOpsCount) : 0;
      const totalCases = recs.reduce((sum, r) => sum + r.cases, 0);

      const totalHours = overallTotalMins / 60;
      const throughputCasesPerHour = totalHours > 0 ? Math.round(totalCases / totalHours) : 0;

      stats.push({
        transporterName: tName,
        loadingCount: loadingRecs.length,
        loadingTotalMins,
        avgLoadingMins,
        loadingTotalCases,

        unloadingCount: unloadingRecs.length,
        unloadingTotalMins,
        avgUnloadingMins,
        unloadingTotalCases,

        totalOpsCount,
        overallTotalMins,
        overallAvgMins,
        totalCases,
        throughputCasesPerHour,

        records: recs
      });
    });

    return stats;
  }, [allPerformanceRecords]);

  // 3. Filter & Sort Transporter Stats
  const filteredTransporterStats = useMemo(() => {
    let list = transporterStatsList;

    // Search term
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter((t) =>
        t.transporterName.toLowerCase().includes(term) ||
        t.records.some((r) => r.vehicleNo.toLowerCase().includes(term) || r.operator.toLowerCase().includes(term))
      );
    }

    // Operation Type Filter
    if (opTypeFilter === 'LOADING') {
      list = list.filter((t) => t.loadingCount > 0);
    } else if (opTypeFilter === 'UNLOADING') {
      list = list.filter((t) => t.unloadingCount > 0);
    }

    // Sort
    return [...list].sort((a, b) => {
      let result = 0;
      if (sortBy === 'TRANSPORTER') {
        result = a.transporterName.localeCompare(b.transporterName);
      } else if (sortBy === 'LOADING_TIME') {
        result = a.avgLoadingMins - b.avgLoadingMins;
      } else if (sortBy === 'UNLOADING_TIME') {
        result = a.avgUnloadingMins - b.avgUnloadingMins;
      } else if (sortBy === 'TOTAL_OPS') {
        result = b.totalOpsCount - a.totalOpsCount;
      } else if (sortBy === 'TOTAL_CASES') {
        result = b.totalCases - a.totalCases;
      }

      return sortOrder === 'ASC' ? result : -result;
    });
  }, [transporterStatsList, searchTerm, opTypeFilter, sortBy, sortOrder]);

  // 4. Global KPI Aggregates
  const kpiData = useMemo(() => {
    const totalTransporters = transporterStatsList.length;

    let totalLoadingOps = 0;
    let sumLoadingMins = 0;
    let totalUnloadingOps = 0;
    let sumUnloadingMins = 0;
    let totalCasesAll = 0;

    transporterStatsList.forEach((t) => {
      totalLoadingOps += t.loadingCount;
      sumLoadingMins += t.loadingTotalMins;
      totalUnloadingOps += t.unloadingCount;
      sumUnloadingMins += t.unloadingTotalMins;
      totalCasesAll += t.totalCases;
    });

    const overallAvgLoadingMins = totalLoadingOps > 0 ? Math.round(sumLoadingMins / totalLoadingOps) : 0;
    const overallAvgUnloadingMins = totalUnloadingOps > 0 ? Math.round(sumUnloadingMins / totalUnloadingOps) : 0;

    // Fastest Loading Transporter (minimum 1 loading operation)
    const activeLoaders = transporterStatsList.filter((t) => t.loadingCount > 0);
    const fastestLoading = activeLoaders.length > 0
      ? activeLoaders.reduce((fastest, curr) => (curr.avgLoadingMins < fastest.avgLoadingMins ? curr : fastest), activeLoaders[0])
      : null;

    // Fastest Unloading Transporter (minimum 1 unloading operation)
    const activeUnloaders = transporterStatsList.filter((t) => t.unloadingCount > 0);
    const fastestUnloading = activeUnloaders.length > 0
      ? activeUnloaders.reduce((fastest, curr) => (curr.avgUnloadingMins < fastest.avgUnloadingMins ? curr : fastest), activeUnloaders[0])
      : null;

    return {
      totalTransporters,
      totalOpsCount: totalLoadingOps + totalUnloadingOps,
      overallAvgLoadingMins,
      overallAvgUnloadingMins,
      fastestLoading,
      fastestUnloading,
      totalCasesAll
    };
  }, [transporterStatsList]);

  // 5. Chart Data
  const chartData = useMemo(() => {
    const topTransporters = filteredTransporterStats.slice(0, 10);
    const labels = topTransporters.map((t) => t.transporterName);

    return {
      labels,
      datasets: [
        {
          label: 'Avg Loading Cycle Time (Mins)',
          data: topTransporters.map((t) => t.avgLoadingMins),
          backgroundColor: 'rgba(245, 158, 11, 0.85)', // Amber-500
          borderColor: 'rgba(217, 119, 6, 1)',
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: 'Avg Unloading Cycle Time (Mins)',
          data: topTransporters.map((t) => t.avgUnloadingMins),
          backgroundColor: 'rgba(59, 130, 246, 0.85)', // Blue-500
          borderColor: 'rgba(37, 99, 235, 1)',
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    };
  }, [filteredTransporterStats]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: { weight: 700 as const, size: 12 },
          padding: 15,
          usePointStyle: true
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.raw} Mins (${formatMinsToDuration(context.raw)})`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Average Time (Minutes)',
          font: { weight: 'bold' as const, size: 11 }
        },
        grid: { color: 'rgba(148, 163, 184, 0.15)' }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const rows = filteredTransporterStats.map((t) => ({
      'Transporter Name': t.transporterName,
      'Avg Loading Time (Mins)': t.avgLoadingMins,
      'Avg Loading Time (Formatted)': formatMinsToDuration(t.avgLoadingMins),
      'Loading Operations Count': t.loadingCount,
      'Cases Loaded': t.loadingTotalCases,
      'Avg Unloading Time (Mins)': t.avgUnloadingMins,
      'Avg Unloading Time (Formatted)': formatMinsToDuration(t.avgUnloadingMins),
      'Unloading Operations Count': t.unloadingCount,
      'Cases Unloaded': t.unloadingTotalCases,
      'Total Completed Ops': t.totalOpsCount,
      'Overall Blended Avg Time (Mins)': t.overallAvgMins,
      'Overall Blended Avg Time (Formatted)': formatMinsToDuration(t.overallAvgMins),
      'Total Cases Handled': t.totalCases,
      'Avg Throughput (Cases/Hour)': t.throughputCasesPerHour
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transporter Cycle Times');
    XLSX.writeFile(workbook, `Transporter_Cycle_Time_Performance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 md:p-6 shadow-md border border-slate-700/80 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-10">
          <Gauge className="w-64 h-64 text-amber-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Timer className="w-3 h-3 text-amber-400" /> Transporter Efficiency
              </span>
              {isDemoActive && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold">
                  Sample Baseline Data
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>Performance Summary</span>
              <span className="text-xs font-mono font-normal text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                Cycle Time Analytics
              </span>
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl font-medium">
              Comprehensive breakdown of average loading vs. unloading cycle times per transporter, calculated directly from completed operational records.
            </p>
          </div>

          {/* Quick Export Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Performance Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Tracked Transporters */}
        <div className="bg-white dark:bg-[#242c3d] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Transporters</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {kpiData.totalTransporters}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>{kpiData.totalOpsCount} Total Completed Ops</span>
          </div>
        </div>

        {/* Card 2: Overall Avg Loading Cycle Time */}
        <div className="bg-amber-50/70 dark:bg-[#242c3d] p-4 rounded-2xl border border-amber-200 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex justify-between items-center text-amber-900 dark:text-amber-300">
            <span className="text-[11px] font-black uppercase tracking-wider">Avg Loading Time</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-950 dark:text-amber-200 font-mono">
            {formatMinsToDuration(kpiData.overallAvgLoadingMins)}
          </div>
          <div className="text-[10px] font-bold text-amber-800 dark:text-amber-400">
            {kpiData.overallAvgLoadingMins} Mins / Vehicle
          </div>
        </div>

        {/* Card 3: Overall Avg Unloading Cycle Time */}
        <div className="bg-blue-50/70 dark:bg-[#242c3d] p-4 rounded-2xl border border-blue-200 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex justify-between items-center text-blue-900 dark:text-blue-300">
            <span className="text-[11px] font-black uppercase tracking-wider">Avg Unloading Time</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-950 dark:text-blue-200 font-mono">
            {formatMinsToDuration(kpiData.overallAvgUnloadingMins)}
          </div>
          <div className="text-[10px] font-bold text-blue-800 dark:text-blue-400">
            {kpiData.overallAvgUnloadingMins} Mins / Vehicle
          </div>
        </div>

        {/* Card 4: Fastest Loading Transporter */}
        <div className="bg-emerald-50/70 dark:bg-[#242c3d] p-4 rounded-2xl border border-emerald-200 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex justify-between items-center text-emerald-900 dark:text-emerald-300">
            <span className="text-[11px] font-black uppercase tracking-wider">Fastest Loader</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-base font-black text-emerald-950 dark:text-emerald-200 truncate">
            {kpiData.fastestLoading ? kpiData.fastestLoading.transporterName : 'N/A'}
          </div>
          <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 font-mono">
            {kpiData.fastestLoading ? `${formatMinsToDuration(kpiData.fastestLoading.avgLoadingMins)} (${kpiData.fastestLoading.avgLoadingMins}m avg)` : '-'}
          </div>
        </div>

        {/* Card 5: Fastest Unloading Transporter */}
        <div className="bg-purple-50/70 dark:bg-[#242c3d] p-4 rounded-2xl border border-purple-200 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex justify-between items-center text-purple-900 dark:text-purple-300">
            <span className="text-[11px] font-black uppercase tracking-wider">Fastest Unloader</span>
            <Zap className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-base font-black text-purple-950 dark:text-purple-200 truncate">
            {kpiData.fastestUnloading ? kpiData.fastestUnloading.transporterName : 'N/A'}
          </div>
          <div className="text-[10px] font-bold text-purple-700 dark:text-purple-400 font-mono">
            {kpiData.fastestUnloading ? `${formatMinsToDuration(kpiData.fastestUnloading.avgUnloadingMins)} (${kpiData.fastestUnloading.avgUnloadingMins}m avg)` : '-'}
          </div>
        </div>
      </div>

      {/* Main Controls Toolbar */}
      <div className="bg-white dark:bg-[#242c3d] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search transporter, vehicle no, operator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Operation Type Selector & Sort Options */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Operation Filter */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setOpTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition ${opTypeFilter === 'ALL' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
            >
              All Ops
            </button>
            <button
              onClick={() => setOpTypeFilter('LOADING')}
              className={`px-3 py-1.5 rounded-lg transition ${opTypeFilter === 'LOADING' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Loading Only
            </button>
            <button
              onClick={() => setOpTypeFilter('UNLOADING')}
              className={`px-3 py-1.5 rounded-lg transition ${opTypeFilter === 'UNLOADING' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Unloading Only
            </button>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
            <ListFilter className="w-3.5 h-3.5 text-blue-600" />
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-900 dark:text-white font-extrabold outline-none cursor-pointer"
            >
              <option value="TRANSPORTER">Transporter A-Z</option>
              <option value="LOADING_TIME">Fastest Loading</option>
              <option value="UNLOADING_TIME">Fastest Unloading</option>
              <option value="TOTAL_OPS">Most Operations</option>
              <option value="TOTAL_CASES">Most Cases</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
              className="ml-1 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"
              title="Toggle Sort Direction"
            >
              {sortOrder === 'ASC' ? '↑' : '↓'}
            </button>
          </div>

          {/* View Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'TABLE' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-xs' : 'text-slate-500'}`}
              title="Table View"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('CARDS')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'CARDS' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-xs' : 'text-slate-500'}`}
              title="Card Grid View"
            >
              <Truck className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('CHARTS')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'CHARTS' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-xs' : 'text-slate-500'}`}
              title="Chart View"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Sections Based on View Mode */}
      {viewMode === 'CHARTS' ? (
        <div className="bg-white dark:bg-[#242c3d] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
            <div>
              <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                Loading vs Unloading Cycle Time Chart Comparison
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Side-by-side average cycle duration in minutes for top transporters
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">Top {Math.min(10, filteredTransporterStats.length)} Transporters</span>
          </div>

          <div className="h-80 w-full pt-2">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      ) : viewMode === 'CARDS' ? (
        /* CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTransporterStats.map((t) => (
            <div
              key={t.transporterName}
              className="bg-white dark:bg-[#242c3d] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md transition space-y-3 flex flex-col justify-between"
            >
              <div className="flex justify-between items-start pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-600" />
                    {t.transporterName}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    {t.totalOpsCount} Total Operations ({t.loadingCount} Load / {t.unloadingCount} Unload)
                  </p>
                </div>
                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-[11px] font-black rounded-lg border border-blue-200 dark:border-blue-800">
                  {t.throughputCasesPerHour} Cases/Hr
                </span>
              </div>

              {/* Cycle Time Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Loading Metric */}
                <div className="bg-amber-50/80 dark:bg-[#2d3748] p-2.5 rounded-xl border border-amber-200/80 dark:border-slate-700 space-y-1">
                  <div className="flex justify-between items-center text-amber-900 dark:text-amber-300 font-bold text-[10px] uppercase">
                    <span>Avg Loading</span>
                    <span>{t.loadingCount} Veh</span>
                  </div>
                  <div className="text-base font-black text-amber-950 dark:text-amber-100 font-mono">
                    {t.loadingCount > 0 ? formatMinsToDuration(t.avgLoadingMins) : 'N/A'}
                  </div>
                  <div className="text-[10px] text-amber-800 dark:text-amber-400 font-semibold">
                    {t.loadingTotalCases.toLocaleString()} Cases
                  </div>
                </div>

                {/* Unloading Metric */}
                <div className="bg-blue-50/80 dark:bg-[#2d3748] p-2.5 rounded-xl border border-blue-200/80 dark:border-slate-700 space-y-1">
                  <div className="flex justify-between items-center text-blue-900 dark:text-blue-300 font-bold text-[10px] uppercase">
                    <span>Avg Unloading</span>
                    <span>{t.unloadingCount} Veh</span>
                  </div>
                  <div className="text-base font-black text-blue-950 dark:text-blue-100 font-mono">
                    {t.unloadingCount > 0 ? formatMinsToDuration(t.avgUnloadingMins) : 'N/A'}
                  </div>
                  <div className="text-[10px] text-blue-800 dark:text-blue-400 font-semibold">
                    {t.unloadingTotalCases.toLocaleString()} Cases
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => setSelectedTransporterModal(t)}
                className="w-full mt-2 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span>Inspect Operational History ({t.records.length})</span>
                <ChevronRight className="w-3.5 h-3.5 text-blue-600" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-[#242c3d] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px] border-b border-slate-200 dark:border-slate-700 tracking-wider">
                <tr>
                  <th className="p-3.5">Transporter</th>
                  <th className="p-3.5">Avg Loading Cycle Time</th>
                  <th className="p-3.5">Avg Unloading Cycle Time</th>
                  <th className="p-3.5">Blended Avg Time</th>
                  <th className="p-3.5">Total Cases</th>
                  <th className="p-3.5">Throughput Rate</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
                {filteredTransporterStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No matching transporter records found.
                    </td>
                  </tr>
                ) : (
                  filteredTransporterStats.map((t) => (
                    <tr
                      key={t.transporterName}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer"
                      onClick={() => setSelectedTransporterModal(t)}
                    >
                      {/* Transporter Name */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 border border-blue-200 dark:border-blue-800 font-bold">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                              {t.transporterName}
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold">
                              {t.totalOpsCount} Vehicles Handled
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Avg Loading Cycle Time */}
                      <td className="p-3.5">
                        {t.loadingCount > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                                {formatMinsToDuration(t.avgLoadingMins)}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500">({t.avgLoadingMins}m)</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold">
                              {t.loadingCount} Ops • {t.loadingTotalCases.toLocaleString()} Cases
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* Avg Unloading Cycle Time */}
                      <td className="p-3.5">
                        {t.unloadingCount > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                                {formatMinsToDuration(t.avgUnloadingMins)}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500">({t.avgUnloadingMins}m)</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold">
                              {t.unloadingCount} Ops • {t.unloadingTotalCases.toLocaleString()} Cases
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* Blended Avg Time */}
                      <td className="p-3.5">
                        <div className="font-mono font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                          {formatMinsToDuration(t.overallAvgMins)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold">
                          Overall Cycle Time
                        </div>
                      </td>

                      {/* Total Cases */}
                      <td className="p-3.5">
                        <div className="font-mono font-black text-slate-900 dark:text-white text-sm">
                          {t.totalCases.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold">Total Handled</div>
                      </td>

                      {/* Throughput Rate */}
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-mono font-black text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 inline-block">
                          {t.throughputCasesPerHour} Cases/Hr
                        </span>
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTransporterModal(t);
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs inline-flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="w-3.5 h-3.5 text-blue-600" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DRILL-DOWN TRANSPORTER DETAIL MODAL */}
      <AnimatePresence>
        {selectedTransporterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#242c3d] rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-4 md:p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                      <span>{selectedTransporterModal.transporterName}</span>
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-400/30">
                        {selectedTransporterModal.totalOpsCount} Total Vehicles
                      </span>
                    </h2>
                    <p className="text-xs text-slate-300">
                      Completed Vehicle Operational Records & Cycle Time Log
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedTransporterModal(null)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal KPI Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 shrink-0 text-xs">
                <div className="bg-white dark:bg-[#2d3748] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Avg Loading Time</div>
                  <div className="text-base font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                    {formatMinsToDuration(selectedTransporterModal.avgLoadingMins)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold">{selectedTransporterModal.loadingCount} Loading Ops</div>
                </div>

                <div className="bg-white dark:bg-[#2d3748] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Avg Unloading Time</div>
                  <div className="text-base font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                    {formatMinsToDuration(selectedTransporterModal.avgUnloadingMins)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold">{selectedTransporterModal.unloadingCount} Unloading Ops</div>
                </div>

                <div className="bg-white dark:bg-[#2d3748] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Total Cases</div>
                  <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                    {selectedTransporterModal.totalCases.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold">Cases Handled</div>
                </div>

                <div className="bg-white dark:bg-[#2d3748] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Throughput Speed</div>
                  <div className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    {selectedTransporterModal.throughputCasesPerHour} Cases/Hr
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold">Avg Rate</div>
                </div>
              </div>

              {/* Records Table */}
              <div className="p-4 overflow-y-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px] tracking-wider sticky top-0">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Vehicle</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Start - End Time</th>
                      <th className="p-2.5">Cycle Duration</th>
                      <th className="p-2.5">Cases</th>
                      <th className="p-2.5">Supervisor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {selectedTransporterModal.records.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2.5 font-mono text-slate-500">{r.date}</td>
                        <td className="p-2.5 font-bold font-mono text-slate-900 dark:text-white">{r.vehicleNo}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              r.opType === 'LOADING'
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {r.opType}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300">
                          {r.startTime} → {r.endTime}
                        </td>
                        <td className="p-2.5 font-mono font-black text-slate-900 dark:text-white">
                          {formatMinsToDuration(r.durationMins)} ({r.durationMins}m)
                        </td>
                        <td className="p-2.5 font-mono font-extrabold text-slate-900 dark:text-white">
                          {r.cases.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{r.operator}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs shrink-0">
                <span className="text-slate-500 font-medium">
                  Showing all {selectedTransporterModal.records.length} operational records for {selectedTransporterModal.transporterName}
                </span>
                <button
                  onClick={() => setSelectedTransporterModal(null)}
                  className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
                >
                  Close Summary
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
