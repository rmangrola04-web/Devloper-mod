import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  UploadCloud,
  DownloadCloud,
  CheckCircle2,
  Shield,
  Activity,
  Truck,
  Search,
  MapPin,
  Building2,
  Phone,
  ArrowUpDown,
  Boxes,
  Clock,
  UserCheck,
  AlertTriangle,
  ArrowRight,
  Trash2,
  Plane,
  Train,
  FileSpreadsheet,
  Target,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar
} from 'lucide-react';
import { PlanEntry, LoadUnloadEntry, SecurityGateEntry } from '../types';
import { DashboardWidget } from '../components/DashboardWidget';
import { computeWaitingQueueItems } from '../utils/queueSync';
import { processWMSDataEngine, normalizeWmsDate, extractCasesFromEntry, isCourierTransporter } from '../utils/wmsDataEngine';
import { AnimatedStatusChip } from '../components/AnimatedStatusChip';

interface DashboardViewProps {
  archivedPlanEntries?: PlanEntry[];
  planEntries: PlanEntry[];
  loadEntries: LoadUnloadEntry[];
  securityLogs: SecurityGateEntry[];
  loadLocations?: string[];
  unloadLocations?: string[];
  precomputedWmsData?: ReturnType<typeof processWMSDataEngine>;
  globalFilterType?: 'DATE' | 'MONTH' | 'RANGE' | 'ALL';
  globalFilterValue?: string;
  globalFilterEndDate?: string;
  onGlobalDateFilterChange?: (type: 'DATE' | 'MONTH' | 'RANGE' | 'ALL', val: string, endVal?: string) => void;
  onSelectVehicle?: (gateId: string, dest?: { location: string; unit?: string }) => void;
  onNavigateToQueue?: () => void;
  onNavigateToPlans?: () => void;
  onNavigateToPacking?: () => void;
  onDeleteGateEntry?: (id: string) => void;
  selectedCompany: 'AIL' | 'AHPL';
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  archivedPlanEntries = [],
  planEntries,
  loadEntries,
  securityLogs,
  loadLocations,
  unloadLocations,
  precomputedWmsData,
  globalFilterType,
  globalFilterValue,
  globalFilterEndDate,
  onGlobalDateFilterChange,
  onSelectVehicle,
  onNavigateToQueue,
  onNavigateToPlans,
  onNavigateToPacking,
  onDeleteGateEntry,
  selectedCompany
}) => {
  // Main report switcher: Operations (Loading / Unloading) vs Gate Security
  const [activeReportTab, setActiveReportTab] = useState<'operations' | 'gate'>('operations');

  // Modal & Search state for Consolidated Pending Loading Plans
  const [showPendingPlansModal, setShowPendingPlansModal] = useState(false);
  const [planSearchQuery, setPlanSearchQuery] = useState('');
  const [modalFilterOverdueOnly, setModalFilterOverdueOnly] = useState(false);

  // Today's ISO date string for overdue calculation
  const todayIsoDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Check if an individual plan entry is overdue (pending and target date < today or carried forward)
  const isPlanEntryOverdue = React.useCallback((p: PlanEntry) => {
    const st = (p.status || 'Pending').toLowerCase().trim();
    const isPending = !st.includes('confirmed') && !st.includes('completed') && !st.includes('dispatched') && !st.includes('loaded') && !st.includes('done');
    if (!isPending) return false;

    const rawDate = (p as any).targetDate || (p as any).planDate || (p as any).entryDate || (p as any).date || (p as any).createdAt || p.updatedAt;
    const normDate = normalizeWmsDate(rawDate);

    if (normDate) {
      return normDate < todayIsoDate || p.isCarriedForward === true;
    }
    return p.isCarriedForward === true;
  }, [todayIsoDate]);

  // Check if a consolidated plan group is overdue
  const isConsolidatedPlanOverdue = React.useCallback((planGroup: any) => {
    if (!planGroup) return false;
    const matchingEntries = planEntries.filter(pe => planGroup.entryIds?.includes(pe.id));
    if (matchingEntries.length > 0) {
      return matchingEntries.some(isPlanEntryOverdue);
    }
    const rawDate = planGroup.targetDate || planGroup.planDate || planGroup.entryDate || planGroup.date;
    const normDate = normalizeWmsDate(rawDate);
    const st = (planGroup.status || 'Pending').toLowerCase().trim();
    const isPending = !st.includes('confirmed') && !st.includes('completed') && !st.includes('dispatched') && !st.includes('loaded');
    if (!isPending) return false;

    return (normDate && normDate < todayIsoDate) || planGroup.isCarriedForward === true;
  }, [planEntries, isPlanEntryOverdue, todayIsoDate]);

  // Extract human-readable target date for consolidated plan group
  const getPlanGroupTargetDate = React.useCallback((planGroup: any) => {
    const matchingEntries = planEntries.filter(pe => planGroup.entryIds?.includes(pe.id));
    if (matchingEntries.length > 0) {
      for (const pe of matchingEntries) {
        const rawDate = (pe as any).targetDate || (pe as any).planDate || (pe as any).entryDate || (pe as any).date || (pe as any).createdAt || pe.updatedAt;
        const norm = normalizeWmsDate(rawDate);
        if (norm) return norm;
      }
    }
    const rawDate = planGroup.targetDate || planGroup.planDate || planGroup.entryDate || planGroup.date;
    return normalizeWmsDate(rawDate) || 'Overdue Target';
  }, [planEntries]);

  // WMS Operations & Plans Dashboard Engine State & Logic
  const [filterMode, setFilterMode] = useState<'single' | 'range' | 'all'>('single');
  const [selectedDate, setSelectedDate] = useState<string>(() => globalFilterValue || new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState<string>(() => globalFilterValue || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(() => globalFilterEndDate || new Date().toISOString().split('T')[0]);

  React.useEffect(() => {
    if (globalFilterValue) setSelectedDate(globalFilterValue);
  }, [globalFilterValue]);

  React.useEffect(() => {
    if (globalFilterEndDate) setEndDate(globalFilterEndDate);
  }, [globalFilterEndDate]);

  React.useEffect(() => {
    (window as any).refreshWMSDashboard = () => {
      const el = document.getElementById('dashboard-date') as HTMLInputElement;
      if (el) {
        setSelectedDate(el.value);
        setFilterMode('single');
        if (onGlobalDateFilterChange) onGlobalDateFilterChange('DATE', el.value);
      }
    };
  }, [onGlobalDateFilterChange]);

  const activeMode = useMemo(() => {
    if (globalFilterType) {
      if (globalFilterType === 'DATE' || globalFilterType === 'MONTH') return 'single';
      if (globalFilterType === 'RANGE') return 'range';
      if (globalFilterType === 'ALL') return 'all';
    }
    return filterMode;
  }, [globalFilterType, filterMode]);

  const activeSelDate = globalFilterValue || selectedDate;
  const activeStartDate = globalFilterValue || startDate;
  const activeEndDate = globalFilterEndDate || endDate;

  const wmsData = useMemo(() => {
    if (precomputedWmsData && (!filterMode || filterMode === (globalFilterType === 'RANGE' ? 'range' : globalFilterType === 'ALL' ? 'all' : 'single'))) {
      return precomputedWmsData;
    }
    return processWMSDataEngine(
      planEntries,
      archivedPlanEntries || [],
      loadEntries,
      securityLogs,
      {
        filterType: globalFilterType || activeMode,
        selectedDate: activeMode === 'single' ? activeSelDate : undefined,
        startDate: activeMode === 'range' ? activeStartDate : undefined,
        endDate: activeMode === 'range' ? activeEndDate : undefined,
      }
    );
  }, [precomputedWmsData, planEntries, archivedPlanEntries, loadEntries, securityLogs, activeSelDate, activeStartDate, activeEndDate, activeMode, globalFilterType, filterMode]);

  // Operations Filter States (Vehicle-wise Loading / Unloading)
  const [opSearch, setOpSearch] = useState('');
  const [opTypeFilter, setOpTypeFilter] = useState<'ALL' | 'LOADING' | 'UNLOADING' | 'COURIER'>('ALL');
  const [opCompanyFilter, setOpCompanyFilter] = useState<'ALL' | 'AIL' | 'AHPL' | 'One Abbott'>('ALL');
  const [opStatusFilter, setOpStatusFilter] = useState<'ALL' | 'IN-PROGRESS' | 'COMPLETED'>('ALL');

  // Gate Filter States
  const [gateSearch, setGateSearch] = useState('');
  const [gateCompanyFilter, setGateCompanyFilter] = useState<'ALL' | 'AIL' | 'AHPL' | 'One Abbott'>('ALL');
  const [gatePurposeFilter, setGatePurposeFilter] = useState<'ALL' | 'Loading' | 'Unloading' | 'Parking / Transit'>('ALL');

  // Destructure values from central wmsDataEngine
  const {
    totalLoadingVehicles,
    activeLoadingVehicles,
    completedLoadingVehicles,
    indoreLoadingVehicles,
    totalLoadedCases,
    ailLoadedCases,
    ahplLoadedCases,
    totalUnloadingVehicles,
    activeUnloadingVehicles,
    completedUnloadingVehicles,
    indoreUnloadingVehicles,
    totalUnloadedCases,
    ailUnloadedCases,
    ahplUnloadedCases,
    ailLoadingCount,
    ahplLoadingCount,
    ailUnloadingCount,
    ahplUnloadingCount,
    ailCompletedUnloading: engineAilCompletedUnloading,
    ahplCompletedUnloading: engineAhplCompletedUnloading,
    ailActiveUnloading: engineAilActiveUnloading,
    ahplActiveUnloading: engineAhplActiveUnloading,
    loadingEntries,
    unloadingSecurityLogs,
    railAirDispatch
  } = wmsData;

  const railAirDispatchData = railAirDispatch || {
    ailLocations: 4,
    ailCases: 50,
    ahplLocations: 3,
    ahplCases: 60,
    totalLocations: 7,
    totalCases: 110,
    rail: wmsData.rail,
    air: wmsData.air
  };

  const countUniqueVehicles = (entries: { vehicleNo?: string; vehicle?: string }[]) =>
    new Set(entries.map(e => (e.vehicleNo || e.vehicle || '').trim().toUpperCase())).size;

  const totalCompletedToday = completedLoadingVehicles + completedUnloadingVehicles;
  const totalActiveOps = activeLoadingVehicles + activeUnloadingVehicles;

  const ailCount = wmsData.ailGateLogs.length;
  const ahplCount = wmsData.ahplGateLogs.length;
  const totalGateVehicles = wmsData.filteredSecurityLogs.length;

  // Active/Completed calculations per division
  const ailActiveLoading = countUniqueVehicles(
    loadingEntries.filter(
      l => (l.unit || '').toUpperCase().includes('AIL') &&
      ((l.status as string) === 'LOADING IN-PROGRESS' || l.status === 'PENDING' || l.status === 'SHUTTLE TRANSIT')
    )
  );
  const ailCompletedLoading = countUniqueVehicles(
    loadingEntries.filter(
      l => (l.unit || '').toUpperCase().includes('AIL') &&
      ((l.status as string) === 'LOADED' || (l.status as string) === 'COMPLETED' || (l.status as string) === 'DISPATCHED')
    )
  );

  const ahplActiveLoading = countUniqueVehicles(
    loadingEntries.filter(
      l => !(l.unit || '').toUpperCase().includes('AIL') &&
      ((l.status as string) === 'LOADING IN-PROGRESS' || l.status === 'PENDING' || l.status === 'SHUTTLE TRANSIT')
    )
  );
  const ahplCompletedLoading = countUniqueVehicles(
    loadingEntries.filter(
      l => !(l.unit || '').toUpperCase().includes('AIL') &&
      ((l.status as string) === 'LOADED' || (l.status as string) === 'COMPLETED' || (l.status as string) === 'DISPATCHED')
    )
  );

  const ailCompletedUnloading = engineAilCompletedUnloading !== undefined ? engineAilCompletedUnloading : countUniqueVehicles(
    unloadingSecurityLogs.filter(l => {
      const st = (l.status || '').toUpperCase();
      const isAil = (l.unit || '').toUpperCase().includes('AIL');
      return isAil && (st === 'COMPLETED' || st === 'EXITED' || st === 'DISPATCHED' || (l.loadingExitTime && l.loadingExitTime.trim() !== ''));
    })
  );
  const ailActiveUnloading = engineAilActiveUnloading !== undefined ? engineAilActiveUnloading : Math.max(0, ailUnloadingCount - ailCompletedUnloading);

  const ahplCompletedUnloading = engineAhplCompletedUnloading !== undefined ? engineAhplCompletedUnloading : countUniqueVehicles(
    unloadingSecurityLogs.filter(l => {
      const st = (l.status || '').toUpperCase();
      const isAil = (l.unit || '').toUpperCase().includes('AIL');
      return !isAil && (st === 'COMPLETED' || st === 'EXITED' || st === 'DISPATCHED' || (l.loadingExitTime && l.loadingExitTime.trim() !== ''));
    })
  );
  const ahplActiveUnloading = engineAhplActiveUnloading !== undefined ? engineAhplActiveUnloading : Math.max(0, ahplUnloadingCount - ahplCompletedUnloading);

  const distinctPlansCount = wmsData.plans.total;
  const totalPendingPlans = wmsData.plans.pending;
  const completedPlansToday = wmsData.plans.confirmed;
  const ailPendingPlans = wmsData.plans.ailPending;
  const ahplPendingPlans = wmsData.plans.ahplPending;
  const pendingPlansList = wmsData.plans.pendingPlansList || [];

  const filteredPendingPlansList = useMemo(() => {
    let list = pendingPlansList;
    if (modalFilterOverdueOnly) {
      list = list.filter(isConsolidatedPlanOverdue);
    }
    if (!planSearchQuery.trim()) return list;
    const q = planSearchQuery.toLowerCase().trim();
    return list.filter(p =>
      (p.dest || '').toLowerCase().includes(q) ||
      (p.transporter || '').toLowerCase().includes(q) ||
      (p.vType || '').toLowerCase().includes(q) ||
      (p.unit || '').toLowerCase().includes(q)
    );
  }, [pendingPlansList, planSearchQuery, modalFilterOverdueOnly, isConsolidatedPlanOverdue]);

  const overdueConsolidatedPlans = useMemo(() => {
    return pendingPlansList.filter(isConsolidatedPlanOverdue);
  }, [pendingPlansList, isConsolidatedPlanOverdue]);

  const overduePlanEntriesCount = useMemo(() => {
    return planEntries.filter(isPlanEntryOverdue).length;
  }, [planEntries, isPlanEntryOverdue]);

  // Target Loading Cases Completion Percentage Calculation (Independent Raw DB Query, Overriding Dashboard Filters)
  const targetLoadingCasesInfo = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentNormalized = normalizeWmsDate(activeSelDate) || activeSelDate || todayStr;

    // Direct deep query into raw loadEntries & planEntries databases (using the strictly selected date)
    const getLoadingCasesFromRawDb = (dateStr: string) => {
      let totalCases = 0;
      (loadEntries || []).forEach(l => {
        const op = (l.opType || '').toUpperCase();
        const isCompleted = l.status === 'LOADED' || (l.status as string) === 'COMPLETED' || (l.status as string) === 'DISPATCHED' || (l.startTime && l.endTime) || op === 'LOADING';
        if (isCompleted && op !== 'UNLOADING') {
          const rawDate = l.entryDate || (l as any).date || (l as any).dateTime || (l as any).updatedAt || (l as any).createdAt || l.startTime;
          if (normalizeWmsDate(rawDate) === dateStr) {
            totalCases += extractCasesFromEntry(l);
          }
        }
      });

      // Secondary plan fallback if loaded cases count in database is 0
      if (totalCases === 0) {
        const allPlans = [...planEntries, ...(archivedPlanEntries || [])];
        allPlans.forEach(p => {
          const pDate = (p as any).date || (p as any).planDate || (p as any).createdAt || (p as any).entryDate;
          if (normalizeWmsDate(pDate) === dateStr) {
            const cases = extractCasesFromEntry(p);
            if (cases > 0) {
              totalCases += cases;
            } else {
              const cft = Number(p.cft) || 0;
              const weight = Number(p.weight) || 0;
              totalCases += cft > 0 ? Math.round(cft * 10) : weight > 0 ? Math.round(weight / 15) : 150;
            }
          }
        });
      }

      return totalCases;
    };

    // Deep query strictly on selected date
    let currentDayTarget = getLoadingCasesFromRawDb(currentNormalized);

    const completed = totalLoadedCases || 0;
    const target = currentDayTarget > 0 ? currentDayTarget : (completed > 0 ? completed : 1000);
    const remaining = Math.max(0, target - completed);
    const percentage = target > 0 ? Math.round((completed / target) * 100) : 0;
    const ringPercentage = Math.min(100, Math.max(0, percentage));

    const currDateObj = new Date(currentNormalized + 'T00:00:00');
    currDateObj.setDate(currDateObj.getDate() - 1);
    const prevDayStr = currDateObj.toISOString().split('T')[0];
    const prevDayTotal = getLoadingCasesFromRawDb(prevDayStr);
    const diff = completed - prevDayTotal;
    const percentChange = prevDayTotal > 0 ? Math.round(Math.abs(diff / prevDayTotal) * 100) : (completed > 0 ? 100 : 0);
    const trend: 'up' | 'down' | 'flat' = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';

    return {
      currentDateStr: currentNormalized,
      prevDayStr,
      targetLoadingCases: target,
      completedLoadingCases: completed,
      remaining,
      percentage,
      ringPercentage,
      prevDayTotal,
      diff,
      percentChange,
      trend,
      isPrevDayBaseline: false
    };
  }, [activeSelDate, loadEntries, planEntries, archivedPlanEntries, totalLoadedCases]);

  const railMetrics = wmsData.rail;
  const airMetrics = wmsData.air;

  const displayDateLabel = useMemo(() => {
    if (activeMode === 'range') {
      return `${activeStartDate} to ${activeEndDate}`;
    }
    if (activeMode === 'all') {
      return 'All Time Records';
    }
    if (!activeSelDate) return 'Today';
    const parts = activeSelDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return activeSelDate;
  }, [activeSelDate, activeStartDate, activeEndDate, activeMode]);

  // Filtered Operations (Loading & Unloading Vehicle-wise)
  const filteredOperations = useMemo(() => {
    const enriched = wmsData.filteredLoadEntries.map((item) => {
      const matchingGateLog = securityLogs.find(
        (log) => (log.vehicle || '').trim().toUpperCase() === (item.vehicleNo || '').trim().toUpperCase()
      );
      const vType = item.vType || item.vehicleType || matchingGateLog?.vType || matchingGateLog?.vehicleType || matchingGateLog?.vehicle_type || '-';
      return { ...item, vType };
    });

    return enriched.filter((item) => {
      const query = opSearch.trim().toLowerCase();
      const rawUnit = (item.unit || 'AHPL').toUpperCase();
      const comp = rawUnit.includes('ONE ABBOTT') ? 'One Abbott' : rawUnit.includes('AIL') ? 'AIL' : 'AHPL';
      const isCourier = isCourierTransporter(item.transporter, item.vType);

      if (opTypeFilter === 'COURIER') {
        if (!isCourier) return false;
      } else {
        // Exclude courier transporters from standard loading/unloading views unless searched
        if (isCourier && !query) {
          return false;
        }

        if (opTypeFilter !== 'ALL' && item.opType !== opTypeFilter) {
          return false;
        }
      }

      if (opCompanyFilter !== 'ALL' && comp !== opCompanyFilter) {
        return false;
      }

      if (opStatusFilter === 'IN-PROGRESS' && !item.status?.includes('IN-PROGRESS')) {
        return false;
      }

      if (opStatusFilter === 'COMPLETED' && item.status?.includes('IN-PROGRESS')) {
        return false;
      }

      if (!query) return true;

      const vMatch = (item.vehicleNo || '').toLowerCase().includes(query);
      const fromMatch = (item.fromLoc || '').toLowerCase().includes(query);
      const toMatch = (item.toLoc || '').toLowerCase().includes(query);
      const transMatch = (item.transporter || '').toLowerCase().includes(query);
      const opMatch = (item.operator || '').toLowerCase().includes(query);
      const bayMatch = (item.bayNo || '').toLowerCase().includes(query);
      const statusMatch = (item.status || '').toLowerCase().includes(query);

      return vMatch || fromMatch || toMatch || transMatch || opMatch || bayMatch || statusMatch;
    });
  }, [wmsData.filteredLoadEntries, securityLogs, opSearch, opTypeFilter, opCompanyFilter, opStatusFilter]);

  // Filtered Gate Arrivals
  const filteredSecurityLogs = useMemo(() => {
    return wmsData.filteredSecurityLogs.filter((item) => {
      const query = gateSearch.trim().toLowerCase();
      const unitStr = (item.unit || '').toUpperCase();
      const isOneAbbott = unitStr.includes('ONE ABBOTT');
      const isAil = unitStr.includes('AIL') || (!item.unit && Number(item.grNo) < 691 && Number(item.grNo) >= 616);
      const isAhpl = unitStr.includes('AHPL') || (!item.unit && Number(item.grNo) >= 691);
      const itemCompany = isOneAbbott ? 'One Abbott' : isAil ? 'AIL' : isAhpl ? 'AHPL' : 'OTHER';

      if (gateCompanyFilter !== 'ALL' && itemCompany !== gateCompanyFilter) {
        return false;
      }

      if (gatePurposeFilter !== 'ALL' && item.purpose !== gatePurposeFilter) {
        return false;
      }

      if (!query) return true;

      const vMatch = (item.vehicle || '').toLowerCase().includes(query);
      const fromMatch = (item.fromLoc || '').toLowerCase().includes(query);
      const toMatch = (item.toLoc || '').toLowerCase().includes(query);
      const transMatch = (item.transporter || '').toLowerCase().includes(query);
      const mobileMatch = (item.mobile || '').toLowerCase().includes(query);
      const grMatch = (item.grNo || '').toLowerCase().includes(query);

      return vMatch || fromMatch || toMatch || transMatch || mobileMatch || grMatch;
    });
  }, [wmsData.filteredSecurityLogs, gateSearch, gateCompanyFilter, gatePurposeFilter]);

  const handleExportDashboardCSV = () => {
    const today = new Date().toISOString().split('T')[0];
    const headers = [
      'Date',
      'Vehicle No',
      'Operation Type',
      'Transporter',
      'Vehicle Type',
      'Location / Destination',
      'Unit',
      'Total Cases',
      'Status',
      'Entry / Update Time'
    ];

    const rows: (string | number)[][] = [
      ['--- WMS DASHBOARD METRICS SUMMARY ---'],
      ['Export Date', today],
      ['Total Standard Loading Vehicles', totalLoadingVehicles],
      ['Total Standard Loading Cases', totalLoadedCases],
      ['Total Unloading Vehicles', totalUnloadingVehicles],
      ['Total Unloading Cases', totalUnloadedCases],
      ['Completed Plans Today', completedPlansToday],
      ['Rail Vehicles', railMetrics.vehicleCount],
      ['Rail AIL Cases', railMetrics.ail.cases],
      ['Rail AHPL Cases', railMetrics.ahpl.cases],
      ['Air / Courier Vehicles', airMetrics.vehicleCount],
      ['Air / Courier AIL Cases', airMetrics.ail.cases],
      ['Air / Courier AHPL Cases', airMetrics.ahpl.cases],
      [],
      ['--- VEHICLE REPORT DETAILS ---'],
      headers
    ];

    const currentRecords = activeReportTab === 'operations' ? filteredOperations : filteredSecurityLogs;
    currentRecords.forEach((item: any) => {
      rows.push([
        item.date || item.entryDate || today,
        item.vehicleNo || item.vehicle || '',
        item.opType || item.purpose || item.type || '',
        item.transporter || item.transporterName || '',
        item.vType || item.vehicleType || '',
        item.toLoc || item.location || item.destination || '',
        item.unit || item.company || '',
        item.totalCases || item.cases || 0,
        item.status || '',
        item.updatedAt || item.dateTime || ''
      ]);
    });

    const csvContent = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `WMS_Dashboard_Report_${today}.csv`;
    link.click();
  };

  return (
    <section className="space-y-4">
      <DashboardWidget
        planEntries={planEntries}
        archivedPlanEntries={archivedPlanEntries}
        loadEntries={loadEntries}
        securityLogs={securityLogs}
        loadLocations={loadLocations}
        unloadLocations={unloadLocations}
        selectedDate={activeMode === 'single' ? activeSelDate : undefined}
        startDate={activeMode === 'range' ? activeStartDate : undefined}
        endDate={activeMode === 'range' ? activeEndDate : undefined}
        onNavigateToPlans={onNavigateToPlans}
        onOpenPendingPlansModal={() => setShowPendingPlansModal(true)}
      />


      {/* Primary Operational & Rail/Air KPI Cards */}
      <div id="wms-dashboard-operations" className="space-y-4">
        {/* OVERDUE PENDING LOADING PLANS VISUAL ALERT BANNER FOR SUPERVISORS */}
        {overdueConsolidatedPlans.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-amber-500/15 dark:from-amber-950/50 dark:via-rose-950/50 dark:to-amber-950/50 border-2 border-rose-500/50 dark:border-rose-500/70 rounded-2xl p-4 shadow-md backdrop-blur-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all">
            <div className="flex items-start md:items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-2xs">
                    SUPERVISOR ALERT
                  </span>
                  <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-400">
                    {overdueConsolidatedPlans.length} Overdue Consolidated {overdueConsolidatedPlans.length === 1 ? 'Plan' : 'Plans'} ({overduePlanEntriesCount} Deliveries)
                  </span>
                </div>
                <h4 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-white mt-1">
                  Attention: Pending loading plans have passed their target schedule date!
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                  Overdue destinations: <span className="font-bold text-slate-800 dark:text-slate-100">{overdueConsolidatedPlans.slice(0, 3).map(p => p.dest).join(', ')}{overdueConsolidatedPlans.length > 3 ? ` + ${overdueConsolidatedPlans.length - 3} more` : ''}</span>. Supervisors should review and initiate dock assignment immediately.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={() => {
                  setModalFilterOverdueOnly(true);
                  setShowPendingPlansModal(true);
                }}
                className="w-full md:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                View {overdueConsolidatedPlans.length} Overdue Plans
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          
          {/* Card 1: CONSOLIDATED LOADING VEHICLES CARD */}
          <div className="hidden md:flex widget-card bg-amber-50/80 dark:bg-[#1e2530] rounded-2xl border border-amber-300 dark:border-blue-500 shadow-sm transition hover:shadow-md flex-col justify-between h-full p-3 sm:p-4 space-y-3 max-w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 text-amber-950 dark:text-white pb-2.5 border-b border-amber-200/80 dark:border-slate-700 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs shrink-0">
                  <UploadCloud className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-950 dark:text-white truncate">
                      Loading Vehicles
                    </h3>
                    <span className="px-1.5 py-0.5 bg-amber-200/80 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0">
                      AIL & AHPL
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-amber-800/90 dark:text-slate-300 font-medium mt-0.5 truncate">
                    Consolidated Loading Operations
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-center text-left sm:text-right bg-amber-100/90 dark:bg-[#252f3f] px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-slate-700 shrink-0 max-w-full">
                <div className="text-base sm:text-lg font-black text-amber-950 dark:text-white leading-none font-mono">
                  {totalLoadingVehicles} <span className="text-[10px] font-bold font-sans">Veh</span>
                </div>
                <div className="text-[10px] font-extrabold text-amber-800 dark:text-amber-300 sm:mt-0.5 whitespace-nowrap">
                  {(totalLoadedCases || 0).toLocaleString()} Total C
                </div>
              </div>
            </div>

            {/* Performance Indicator: Comparison vs Previous Day */}
            <div className="bg-white/70 dark:bg-[#252f3f]/90 px-3 py-2 rounded-xl border border-amber-200/80 dark:border-slate-700 flex items-center justify-between text-xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-600 dark:text-slate-300 tracking-wider">
                vs Yesterday ({targetLoadingCasesInfo.prevDayTotal.toLocaleString()} C):
              </span>
              <div className={`flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-lg ${
                targetLoadingCasesInfo.trend === 'up' 
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800' 
                  : targetLoadingCasesInfo.trend === 'down'
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
              }`}>
                {targetLoadingCasesInfo.trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                {targetLoadingCasesInfo.trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
                {targetLoadingCasesInfo.trend === 'flat' && <Minus className="w-3.5 h-3.5 text-slate-500" />}
                <span>
                  {targetLoadingCasesInfo.diff > 0 ? `+${targetLoadingCasesInfo.diff.toLocaleString()} C (${targetLoadingCasesInfo.percentChange}%)` : targetLoadingCasesInfo.diff < 0 ? `${targetLoadingCasesInfo.diff.toLocaleString()} C (${targetLoadingCasesInfo.percentChange}%)` : '0 C (0%)'}
                </span>
              </div>
            </div>

            {/* Total Active vs Completed Overall Row */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/80 dark:bg-[#252f3f] p-2.5 rounded-xl border border-amber-200/80 dark:border-slate-700 flex justify-between items-center min-w-0">
                <span className="text-[10px] font-extrabold uppercase text-amber-900/90 dark:text-slate-200 tracking-wider truncate">Active Loading</span>
                <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm sm:text-base shrink-0 ml-1">{activeLoadingVehicles}</span>
              </div>
              <div className="bg-white/80 dark:bg-[#252f3f] p-2.5 rounded-xl border border-amber-200/80 dark:border-slate-700 flex justify-between items-center min-w-0">
                <span className="text-[10px] font-extrabold uppercase text-emerald-900/90 dark:text-slate-200 tracking-wider truncate">Loaded / Done</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm sm:text-base shrink-0 ml-1">{completedLoadingVehicles}</span>
              </div>
            </div>

            {/* Division Breakdown: AIL and AHPL inside Loading Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* AIL Division Box */}
              <div className="bg-white/50 dark:bg-[#252f3f]/80 p-2.5 rounded-xl border border-amber-200/80 dark:border-slate-700 space-y-1.5 min-w-0">
                <div className="flex justify-between items-center border-b border-amber-200/60 dark:border-slate-700 pb-1 min-w-0 gap-1">
                  <span className="font-black uppercase text-xs text-amber-950 dark:text-white tracking-wider truncate">
                    AIL
                  </span>
                  <span className="text-xs font-black text-amber-900 dark:text-amber-300 font-mono shrink-0">
                    {ailLoadingCount} Veh
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs min-w-0 gap-1">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold shrink-0">C:</span>
                  <span className="font-mono font-black text-amber-950 dark:text-white text-xs truncate">
                    {(ailLoadedCases || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] pt-1 border-t border-amber-200/50 dark:border-slate-700 font-semibold min-w-0 gap-1">
                  <span className="text-amber-800 dark:text-amber-400 truncate">Active: {ailActiveLoading}</span>
                  <span className="text-emerald-700 dark:text-emerald-400 truncate">Done: {ailCompletedLoading}</span>
                </div>
              </div>

              {/* AHPL Division Box */}
              <div className="bg-white/50 dark:bg-[#252f3f]/80 p-2.5 rounded-xl border border-amber-200/80 dark:border-slate-700 space-y-1.5 min-w-0">
                <div className="flex justify-between items-center border-b border-amber-200/60 dark:border-slate-700 pb-1 min-w-0 gap-1">
                  <span className="font-black uppercase text-xs text-amber-950 dark:text-white tracking-wider truncate">
                    AHPL
                  </span>
                  <span className="text-xs font-black text-amber-900 dark:text-amber-300 font-mono shrink-0">
                    {ahplLoadingCount} Veh
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs min-w-0 gap-1">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold shrink-0">C:</span>
                  <span className="font-mono font-black text-amber-950 dark:text-white text-xs truncate">
                    {(ahplLoadedCases || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] pt-1 border-t border-amber-200/50 dark:border-slate-700 font-semibold min-w-0 gap-1">
                  <span className="text-amber-800 dark:text-amber-400 truncate">Active: {ahplActiveLoading}</span>
                  <span className="text-emerald-700 dark:text-emerald-400 truncate">Done: {ahplCompletedLoading}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: UNIFIED RAIL & AIR DISPATCH CARD */}
          <div className="hidden md:flex widget-card bg-indigo-50/80 dark:bg-[#1e2530] rounded-2xl border border-indigo-300 dark:border-blue-500 shadow-sm transition hover:shadow-md flex-col justify-between h-full p-3 sm:p-4 space-y-3 max-w-full overflow-hidden">
            <div className="flex justify-between items-center gap-2 text-indigo-950 dark:text-white pb-2.5 border-b border-indigo-200/80 dark:border-slate-700 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs shrink-0 flex items-center gap-1">
                  <Train className="w-3.5 h-3.5" />
                  <Plane className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-indigo-950 dark:text-white truncate">
                      Rail & Air Dispatch
                    </h3>
                    <span className="px-1.5 py-0.5 bg-indigo-200/80 dark:bg-indigo-900/60 text-indigo-950 dark:text-indigo-200 rounded text-[9px] font-black uppercase tracking-wider shrink-0">
                      AIL & AHPL
                    </span>
                  </div>
                  <p className="text-[10px] text-indigo-800/90 dark:text-slate-300 font-medium truncate mt-0.5">
                    Synchronized Dispatch Hub
                  </p>
                </div>
              </div>

              <div className="bg-indigo-100/90 dark:bg-[#252f3f] px-2.5 py-1.5 rounded-xl border border-indigo-300 dark:border-slate-700 text-right shrink-0">
                <div className="text-sm sm:text-base font-black text-indigo-950 dark:text-white leading-none font-mono">
                  {(railMetrics.totalCases + airMetrics.totalCases).toLocaleString()} <span className="text-[10px] font-bold font-sans">C</span>
                </div>
                <div className="text-[10px] font-extrabold text-indigo-800 dark:text-indigo-300 mt-0.5">
                  {(railMetrics.totalLocations + airMetrics.totalLocations)} Locs
                </div>
              </div>
            </div>

            {/* Breakdown Grid for Rail & Air */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Rail Dispatch Box */}
              <div className="bg-white/80 dark:bg-[#252f3f] p-2.5 rounded-xl border border-indigo-200/80 dark:border-slate-700 space-y-1.5 flex flex-col justify-between">
                <div className="text-[10px] font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200 border-b border-indigo-100 dark:border-slate-700 pb-1 flex justify-between items-center">
                  <span>Rail Dispatch</span>
                  <span className="font-mono text-indigo-700 dark:text-indigo-400">{railMetrics.totalLocations} Locs</span>
                </div>
                <div className="space-y-1 pt-0.5">
                  <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">AIL:</span>
                    <span className="font-mono font-black text-emerald-950 dark:text-white text-xs">{railMetrics.ail.cases.toLocaleString()} C</span>
                  </div>
                  <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-900/60">
                    <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300">AHPL:</span>
                    <span className="font-mono font-black text-blue-950 dark:text-white text-xs">{railMetrics.ahpl.cases.toLocaleString()} C</span>
                  </div>
                </div>
              </div>

              {/* Air Dispatch Box */}
              <div className="bg-white/80 dark:bg-[#252f3f] p-2.5 rounded-xl border border-violet-200/80 dark:border-slate-700 space-y-1.5 flex flex-col justify-between">
                <div className="text-[10px] font-black uppercase tracking-wider text-violet-900 dark:text-violet-200 border-b border-violet-100 dark:border-slate-700 pb-1 flex justify-between items-center">
                  <span>Air Dispatch</span>
                  <span className="font-mono text-violet-700 dark:text-violet-400">{airMetrics.totalLocations} Locs</span>
                </div>
                <div className="space-y-1 pt-0.5">
                  <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">AIL:</span>
                    <span className="font-mono font-black text-emerald-950 dark:text-white text-xs">{airMetrics.ail.cases.toLocaleString()} C</span>
                  </div>
                  <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-900/60">
                    <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300">AHPL:</span>
                    <span className="font-mono font-black text-blue-950 dark:text-white text-xs">{airMetrics.ahpl.cases.toLocaleString()} C</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Combined Total Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-indigo-200/80 dark:border-slate-700 text-[10px] sm:text-xs font-bold text-indigo-950 dark:text-white">
              <span className="uppercase tracking-wider font-extrabold text-indigo-900 dark:text-slate-300">Total Rail & Air:</span>
              <span className="font-mono font-black text-indigo-900 dark:text-white text-xs sm:text-sm bg-indigo-100/80 dark:bg-[#252f3f] px-2 py-0.5 rounded-md border border-indigo-200 dark:border-slate-700">
                {(railMetrics.totalCases + airMetrics.totalCases).toLocaleString()} C ({(railMetrics.totalLocations + airMetrics.totalLocations)} Locs)
              </span>
            </div>
          </div>

          {/* Card 3: CONSOLIDATED UNLOADING VEHICLES CARD */}
          <div className="hidden md:flex widget-card bg-blue-50/80 dark:bg-[#1e2530] rounded-2xl border border-blue-300 dark:border-emerald-500 shadow-sm transition hover:shadow-md flex-col justify-between h-full p-3 sm:p-4 space-y-3 max-w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 text-blue-950 dark:text-white pb-2.5 border-b border-blue-200/80 dark:border-slate-700 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs shrink-0">
                  <DownloadCloud className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-blue-950 dark:text-white truncate">
                      Unloading Vehicles
                    </h3>
                    <span className="px-1.5 py-0.5 bg-blue-200/80 dark:bg-blue-900/60 text-blue-950 dark:text-blue-200 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0">
                      AIL & AHPL
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-blue-800/90 dark:text-slate-300 font-medium mt-0.5 truncate">
                    Consolidated Unloading Operations
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-center text-left sm:text-right bg-blue-100/90 dark:bg-[#252f3f] px-2.5 py-1.5 rounded-xl border border-blue-300 dark:border-slate-700 shrink-0 max-w-full">
                <div className="text-base sm:text-lg font-black text-blue-950 dark:text-white leading-none font-mono">
                  {totalUnloadingVehicles} <span className="text-[10px] font-bold font-sans">Veh</span>
                </div>
                <div className="text-[10px] font-extrabold text-blue-800 dark:text-blue-300 sm:mt-0.5 whitespace-nowrap">
                  {(totalUnloadedCases || 0).toLocaleString()} Total C
                </div>
              </div>
            </div>

            {/* Total Active vs Completed Overall Row */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/80 dark:bg-[#252f3f] p-2.5 rounded-xl border border-blue-200/80 dark:border-slate-700 flex justify-between items-center min-w-0">
                <span className="text-[10px] font-extrabold uppercase text-blue-900/90 dark:text-slate-200 tracking-wider truncate">Active Unloading</span>
                <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm sm:text-base shrink-0 ml-1">{activeUnloadingVehicles}</span>
              </div>
              <div className="bg-white/80 dark:bg-[#252f3f] p-2.5 rounded-xl border border-blue-200/80 dark:border-slate-700 flex justify-between items-center min-w-0">
                <span className="text-[10px] font-extrabold uppercase text-emerald-900/90 dark:text-slate-200 tracking-wider truncate">Unloaded / Done</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm sm:text-base shrink-0 ml-1">{completedUnloadingVehicles}</span>
              </div>
            </div>

            {/* Division Breakdown: AIL and AHPL inside Unloading Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* AIL Division Box */}
              <div className="bg-white/50 dark:bg-[#252f3f]/80 p-2.5 rounded-xl border border-blue-200/80 dark:border-slate-700 space-y-1.5 min-w-0">
                <div className="flex justify-between items-center border-b border-blue-200/60 dark:border-slate-700 pb-1 min-w-0 gap-1">
                  <span className="font-black uppercase text-xs text-blue-950 dark:text-white tracking-wider truncate">
                    AIL
                  </span>
                  <span className="text-xs font-black text-blue-900 dark:text-blue-300 font-mono shrink-0">
                    {ailUnloadingCount} Veh
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs min-w-0 gap-1">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold shrink-0">C:</span>
                  <span className="font-mono font-black text-blue-950 dark:text-white text-xs truncate">
                    {(ailUnloadedCases || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] pt-1 border-t border-blue-200/50 dark:border-slate-700 font-semibold min-w-0 gap-1">
                  <span className="text-blue-800 dark:text-blue-400 truncate">Active: {ailActiveUnloading}</span>
                  <span className="text-emerald-700 dark:text-emerald-400 truncate">Done: {ailCompletedUnloading}</span>
                </div>
              </div>

              {/* AHPL Division Box */}
              <div className="bg-white/50 dark:bg-[#252f3f]/80 p-2.5 rounded-xl border border-blue-200/80 dark:border-slate-700 space-y-1.5 min-w-0">
                <div className="flex justify-between items-center border-b border-blue-200/60 dark:border-slate-700 pb-1 min-w-0 gap-1">
                  <span className="font-black uppercase text-xs text-blue-950 dark:text-white tracking-wider truncate">
                    AHPL
                  </span>
                  <span className="text-xs font-black text-blue-900 dark:text-blue-300 font-mono shrink-0">
                    {ahplUnloadingCount} Veh
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs min-w-0 gap-1">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold shrink-0">C:</span>
                  <span className="font-mono font-black text-blue-950 dark:text-white text-xs truncate">
                    {(ahplUnloadedCases || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] pt-1 border-t border-blue-200/50 dark:border-slate-700 font-semibold min-w-0 gap-1">
                  <span className="text-blue-800 dark:text-blue-400 truncate">Active: {ahplActiveUnloading}</span>
                  <span className="text-emerald-700 dark:text-emerald-400 truncate">Done: {ahplCompletedUnloading}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      

      
      {/* Main Dashboard Interactive Reports Section */}
      <div className="bg-white dark:bg-[#242c3d] p-2.5 sm:p-4 rounded-xl border border-slate-200 dark:border-[#3e4859] shadow-xs space-y-3">
        
        {/* Top Header & Table Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-200 dark:border-[#3e4859]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 rounded-lg">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                Main Dashboard: Vehicle-Wise Loading & Unloading Report
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Live vehicle tracking &bull; Loading vs Unloading status &bull; Route & Case count details
              </p>
            </div>
          </div>

          {/* Toggle between Operations (Loading/Unloading) and Gate Inward + Export CSV */}
          <div className="flex flex-wrap items-center gap-2 bg-[#f3f4f6] dark:bg-slate-800/90 p-2 rounded-xl border border-slate-200 dark:border-[#3e4859] w-full sm:w-auto">
            <button
              onClick={() => setActiveReportTab('operations')}
              className={`flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 touch-manipulation whitespace-nowrap ${
                activeReportTab === 'operations'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span>Loading & Unloading Vehicles ({countUniqueVehicles(wmsData.filteredLoadEntries)})</span>
            </button>
            <button
              onClick={() => setActiveReportTab('gate')}
              className={`flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 touch-manipulation whitespace-nowrap ${
                activeReportTab === 'gate'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>Gate Inward Vehicles ({wmsData.filteredSecurityLogs.length})</span>
            </button>
            <button
              onClick={handleExportDashboardCSV}
              title="Export Dashboard Metrics & Vehicle Reports to CSV"
              className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 touch-manipulation bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-xs whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* OPERATIONS REPORT (VEHICLE-WISE LOADING & UNLOADING) */}
        {activeReportTab === 'operations' && (
          <div className="space-y-3">
            
            {/* Quick Status Count Summary Banner with 44px+ touch targets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              <div 
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (opTypeFilter === 'LOADING' && opStatusFilter === 'ALL') {
                    setOpTypeFilter('ALL');
                  } else {
                    setOpTypeFilter('LOADING');
                    setOpStatusFilter('ALL');
                  }
                }}
                className={`border min-h-[46px] p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-200 touch-manipulation ${
                  opTypeFilter === 'LOADING' && opStatusFilter !== 'COMPLETED'
                    ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-400 dark:border-amber-600 shadow-md ring-2 ring-amber-400/50 scale-[1.01] active-filter' 
                    : 'bg-amber-50 dark:bg-[#2d3748] border-amber-200 dark:border-amber-900/50 hover:bg-amber-100/50 dark:hover:bg-[#374151] hover:border-amber-300 hover:shadow-sm'
                }`}
                title="Click to filter by Loading"
              >
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-amber-600" />
                  <span className={`font-bold transition-colors ${opTypeFilter === 'LOADING' && opStatusFilter !== 'COMPLETED' ? 'text-amber-900 dark:text-amber-300' : 'text-slate-700 dark:text-slate-200'}`}>Loading Vehicles:</span>
                </div>
                <span className={`font-mono font-black ${opTypeFilter === 'LOADING' && opStatusFilter !== 'COMPLETED' ? 'text-amber-900 dark:text-amber-300' : 'text-amber-700 dark:text-amber-400'}`}>
                  {totalLoadingVehicles} <span className="text-[10px] font-normal opacity-75">({completedLoadingVehicles} Loaded)</span>
                </span>
              </div>

              <div 
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (opTypeFilter === 'UNLOADING' && opStatusFilter === 'ALL') {
                    setOpTypeFilter('ALL');
                  } else {
                    setOpTypeFilter('UNLOADING');
                    setOpStatusFilter('ALL');
                  }
                }}
                className={`border min-h-[46px] p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-200 touch-manipulation ${
                  opTypeFilter === 'UNLOADING' && opStatusFilter !== 'COMPLETED'
                    ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 shadow-md ring-2 ring-blue-400/50 scale-[1.01] active-filter' 
                    : 'bg-blue-50 dark:bg-[#2d3748] border-blue-200 dark:border-blue-900/50 hover:bg-blue-100/50 dark:hover:bg-[#374151] hover:border-blue-300 hover:shadow-sm'
                }`}
                title="Click to filter by Unloading"
              >
                <div className="flex items-center gap-2">
                  <DownloadCloud className="w-4 h-4 text-blue-600" />
                  <span className={`font-bold transition-colors ${opTypeFilter === 'UNLOADING' && opStatusFilter !== 'COMPLETED' ? 'text-blue-900 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>Unloading Vehicles:</span>
                </div>
                <span className={`font-mono font-black ${opTypeFilter === 'UNLOADING' && opStatusFilter !== 'COMPLETED' ? 'text-blue-900 dark:text-blue-300' : 'text-blue-700 dark:text-blue-400'}`}>
                  {totalUnloadingVehicles} <span className="text-[10px] font-normal opacity-75">({completedUnloadingVehicles} Unloaded)</span>
                </span>
              </div>

              <div 
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (opStatusFilter === 'COMPLETED' && opTypeFilter === 'ALL') {
                    setOpStatusFilter('ALL');
                  } else {
                    setOpTypeFilter('ALL');
                    setOpStatusFilter('COMPLETED');
                  }
                }}
                className={`border min-h-[46px] p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-200 touch-manipulation ${
                  opStatusFilter === 'COMPLETED'
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 dark:border-emerald-600 shadow-md ring-2 ring-emerald-400/50 scale-[1.01] active-filter' 
                    : 'bg-emerald-50 dark:bg-[#2d3748] border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100/50 dark:hover:bg-[#374151] hover:border-emerald-300 hover:shadow-sm'
                }`}
                title="Click to filter by Completed"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className={`font-bold transition-colors ${opStatusFilter === 'COMPLETED' ? 'text-emerald-900 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'}`}>Completed (Done):</span>
                </div>
                <span className={`font-mono font-black ${opStatusFilter === 'COMPLETED' ? 'text-emerald-900 dark:text-emerald-300' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {totalCompletedToday} Vehicles
                </span>
              </div>

              <div className="bg-purple-50 dark:bg-[#2d3748] border border-purple-200 dark:border-purple-900/50 min-h-[46px] p-3 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-purple-600" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">Total Cases Handled:</span>
                </div>
                <span className="font-mono font-black text-purple-700 dark:text-purple-400">
                  {((totalLoadedCases || 0) + (totalUnloadedCases || 0)).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Filter Toolbar with Accessible Inputs (Hidden on mobile as requested, visible on desktop/tablet md: 768px+) */}
            <div className="hidden md:grid dashboard-filters-container grid-cols-1 sm:grid-cols-12 gap-2.5 bg-[#f9fafb] dark:bg-[#2d3748]/60 p-2.5 rounded-xl border border-slate-200 dark:border-[#3e4859]">
              
              {/* Search input */}
              <div className="sm:col-span-4 relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Vehicle No, From/To, Transporter..."
                  value={opSearch}
                  onChange={(e) => setOpSearch(e.target.value)}
                  className="w-full pl-9 pr-3 min-h-[44px] py-2 text-xs rounded-lg border border-slate-300 dark:border-[#3e4859] bg-white dark:bg-[#242c3d] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              {/* Activity Type Filter (ALL / LOADING / UNLOADING) */}
              <div className="sm:col-span-3">
                <select
                  value={opTypeFilter}
                  onChange={(e) => setOpTypeFilter(e.target.value as any)}
                  className="w-full min-h-[44px] py-2 px-3 text-xs rounded-lg border border-slate-300 dark:border-[#3e4859] bg-white dark:bg-[#242c3d] text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                >
                  <option value="ALL">All Activity (Loading + Unloading)</option>
                  <option value="LOADING">Loading Vehicles Only ({totalLoadingVehicles})</option>
                  <option value="UNLOADING">Unloading Vehicles Only ({totalUnloadingVehicles})</option>
                  <option value="COURIER">Rail &amp; Air Couriers (Spark &bull; Star &bull; SD)</option>
                </select>
              </div>

              {/* Company Filter (ALL / AIL / AHPL) */}
              <div className="sm:col-span-2">
                <select
                  value={opCompanyFilter}
                  onChange={(e) => setOpCompanyFilter(e.target.value as any)}
                  className="w-full min-h-[44px] py-2 px-3 text-xs rounded-lg border border-slate-300 dark:border-[#3e4859] bg-white dark:bg-[#242c3d] text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                >
                  <option value="ALL">All Companies</option>
                  <option value="AIL">AIL</option>
                  <option value="AHPL">AHPL</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="sm:col-span-3">
                <select
                  value={opStatusFilter}
                  onChange={(e) => setOpStatusFilter(e.target.value as any)}
                  className="w-full min-h-[44px] py-2 px-3 text-xs rounded-lg border border-slate-300 dark:border-[#3e4859] bg-white dark:bg-[#242c3d] text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                >
                  <option value="ALL">All Status ({countUniqueVehicles(loadEntries)})</option>
                  <option value="IN-PROGRESS">Active In-Progress ({totalActiveOps})</option>
                  <option value="COMPLETED">Completed / Done ({totalCompletedToday})</option>
                </select>
              </div>
            </div>

            {/* SCROLLABLE VEHICLE-WISE OPERATIONS REPORT TABLE */}
            <div className="overflow-x-auto overflow-y-auto max-h-[500px] border border-slate-200 dark:border-[#3e4859] rounded-lg shadow-inner">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-[#2d3748] text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-[#3e4859]">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Vehicle Number</th>
                    <th className="py-2.5 px-3">Activity</th>
                    <th className="py-2.5 px-3">Assigned Dock</th>
                    <th className="py-2.5 px-3">Route (Origin &rarr; Destination)</th>
                    <th className="py-2.5 px-3">Transporter</th>
                    <th className="py-2.5 px-3">Vehicle Type</th>
                    <th className="py-2.5 px-3">Supervisor</th>
                    <th className="py-2.5 px-3 text-center">Cases Loaded / Unloaded</th>
                    <th className="py-2.5 px-3">Start & End Time</th>
                    <th className="py-2.5 px-3">TAT</th>
                    <th className="py-2.5 px-3">Live Status</th>
                    {onDeleteGateEntry && <th className="py-2.5 px-3 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#3e4859]/60 font-medium">
                  {filteredOperations.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-20 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Truck className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                          <span className="font-semibold text-xs">No loading/unloading vehicles match your filter.</span>
                          <span className="text-[10px] text-slate-400">Try switching filters or adjusting your search keyword.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredOperations.map((op) => {
                      const isUnload = op.opType === 'UNLOADING';
                      const isProgress = op.status?.includes('IN-PROGRESS');
                      const unitTag = (op.unit || 'AHPL').toUpperCase();

                      return (
                        <tr key={op.id} className="hover:bg-blue-50/50 dark:hover:bg-[#2d3748]/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">{op.entryDate || '-'}</td>
                          
                          {/* 1. Vehicle Number & Company */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400 tracking-wide">
                                {op.vehicleNo}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                  unitTag === 'AIL'
                                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                    : 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                                }`}
                              >
                                {unitTag}
                              </span>
                            </div>
                          </td>

                          {/* 2. Activity Badge (LOADING vs UNLOADING) */}
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                isUnload
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              }`}
                            >
                              {isUnload ? <DownloadCloud className="w-3 h-3" /> : <UploadCloud className="w-3 h-3" />}
                              {op.opType}
                            </span>
                          </td>

                          {/* 3. Dock / Bay */}
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 text-xs">
                              {op.bayNo}
                            </span>
                          </td>

                          {/* 4. Route */}
                          <td className="py-2.5 px-3">
                            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                              {isUnload ? (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  From: <b className="text-emerald-600 dark:text-emerald-400">{op.fromLoc}</b>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                  To: <b className="text-blue-600 dark:text-blue-400">{op.toLoc}</b>
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono pl-4">
                              {op.fromLoc} &rarr; {op.toLoc}
                            </div>
                          </td>

                          {/* 5. Transporter */}
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {op.transporter || '-'}
                          </td>

                          {/* 6. Vehicle Type */}
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-[10px]">
                              {op.vType || op.vehicleType || '-'}
                            </span>
                          </td>

                          {/* 6. Supervisor */}
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              <UserCheck className="w-3 h-3 text-slate-400" />
                              {op.operator || '-'}
                            </span>
                          </td>

                          {/* 7. Cases */}
                          <td className="py-2.5 px-3 text-center font-mono">
                            <span className="font-black text-sm text-blue-600 dark:text-blue-400">
                              {op.totalCases !== undefined && op.totalCases !== 'N/A' ? `${op.totalCases}` : '-'}
                            </span>
                            {Number(op.damagedCases) > 0 && (
                              <div className="text-[9px] font-bold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-0.5 mt-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> {op.damagedCases} damaged
                              </div>
                            )}
                          </td>

                          {/* 8. Start & End Time */}
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                            <div>Start: <b className="text-slate-800 dark:text-slate-100">{op.startTime}</b></div>
                            <div>End: <b className="text-slate-800 dark:text-slate-100">{op.endTime || 'In-Progress'}</b></div>
                          </td>

                          {/* 9. TAT */}
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            {op.duration || '-'}
                          </td>

                          {/* 10. Live Status */}
                          <td className="py-2.5 px-3">
                            <AnimatedStatusChip status={op.status || ''} size="sm" />
                          </td>

                          {/* 11. Action / Delete */}
                          {onDeleteGateEntry && (
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete operation for vehicle ${op.vehicleNo}?`)) {
                                    onDeleteGateEntry(op.id);
                                  }
                                }}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 dark:hover:bg-rose-900/80 rounded-md transition cursor-pointer"
                                title="Delete operation record permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Operations Footer Stats */}
            <div className="pt-2 border-t border-slate-200 dark:border-[#3e4859] flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2">
              <div className="flex items-center gap-3">
                <span>
                  Loading: <b className="text-amber-600 dark:text-amber-400">{totalLoadingVehicles} Vehicles</b> (AIL: {ailLoadingCount}, AHPL: {ahplLoadingCount})
                </span>
                &bull;
                <span>
                  Unloading: <b className="text-blue-600 dark:text-blue-400">{totalUnloadingVehicles} Vehicles</b> (AIL: {ailUnloadingCount}, AHPL: {ahplUnloadingCount})
                </span>
              </div>
              <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Showing {filteredOperations.length} of {loadEntries.length} Operations
              </span>
            </div>

          </div>
        )}

        {/* GATE SECURITY INWARD REPORT */}
        {activeReportTab === 'gate' && (
          <div className="space-y-3">
            
            {/* Filter Toolbar with Accessible Inputs (Hidden on mobile as requested, visible on desktop/tablet md: 768px+) */}
            <div className="hidden md:grid dashboard-filters-container grid-cols-1 sm:grid-cols-12 gap-2.5 bg-[#f9fafb] dark:bg-[#2d3748]/60 p-2.5 rounded-xl border border-slate-200 dark:border-[#3e4859]">
              {/* Gate Search */}
              <div className="sm:col-span-5 relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Vehicle No, From Origin, Transporter, Driver..."
                  value={gateSearch}
                  onChange={(e) => setGateSearch(e.target.value)}
                  className="w-full pl-9 pr-3 min-h-[44px] py-2 text-xs rounded-lg border border-slate-300 dark:border-[#3e4859] bg-white dark:bg-[#242c3d] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>

              {/* Company Filter */}
              <div className="sm:col-span-3">
                <select
                  value={gateCompanyFilter}
                  onChange={(e) => setGateCompanyFilter(e.target.value as any)}
                  className="w-full min-h-[44px] py-2 px-3 text-xs rounded-lg border border-slate-300 dark:border-[#3e4859] bg-white dark:bg-[#242c3d] text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
                >
                  <option value="ALL">All Companies</option>
                  <option value="AIL">AIL ({ailCount})</option>
                  <option value="AHPL">AHPL ({ahplCount})</option>
                </select>
              </div>

              {/* Purpose Filter */}
              <div className="sm:col-span-4">
                <select
                  value={gatePurposeFilter}
                  onChange={(e) => setGatePurposeFilter(e.target.value as any)}
                  className="w-full min-h-[44px] py-2 px-3 text-xs rounded-lg border border-slate-300 dark:border-[#3e4859] bg-white dark:bg-[#242c3d] text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
                >
                  <option value="ALL">All Purpose</option>
                  <option value="Loading">Loading</option>
                  <option value="Unloading">Unloading</option>
                  <option value="Parking / Transit">Parking / Transit</option>
                </select>
              </div>
            </div>

            {/* SCROLLABLE GATE TABLE */}
            <div className="overflow-x-auto overflow-y-auto max-h-[500px] border border-slate-200 dark:border-[#3e4859] rounded-lg shadow-inner">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-[#2d3748] text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-[#3e4859]">
                  <tr>
                    <th className="py-2.5 px-3">Vehicle Number & Unit</th>
                    <th className="py-2.5 px-3">Purpose</th>
                    <th className="py-2.5 px-3">From Location (Origin) & Destination</th>
                    <th className="py-2.5 px-3">Transporter & Type</th>
                    <th className="py-2.5 px-3">Driver Contact</th>
                    <th className="py-2.5 px-3">Gate In Date & Time</th>
                    <th className="py-2.5 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#3e4859]/60 font-medium">
                  {filteredSecurityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-20 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Truck className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                          <span className="font-semibold text-xs">No gate arrival records match your search.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSecurityLogs.map((g) => {
                      const isAil = (g.unit || '').toUpperCase().includes('AIL') || (!g.unit && Number(g.grNo) < 691 && Number(g.grNo) >= 616);
                      const isAhpl = (g.unit || '').toUpperCase().includes('AHPL') || (!g.unit && Number(g.grNo) >= 691);
                      const displayUnit = isAil ? 'AIL' : isAhpl ? 'AHPL' : (g.unit || '-');

                      return (
                        <tr key={g.id} className="hover:bg-blue-50/50 dark:hover:bg-[#2d3748]/60 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400 tracking-wide">
                                {g.vehicle}
                              </span>
                              {displayUnit !== '-' && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                    displayUnit === 'AIL'
                                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                      : 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                                  }`}
                                >
                                  {displayUnit}
                                </span>
                              )}
                            </div>
                            {g.grNo && (
                              <div className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                                GR No: <span className="text-purple-600 dark:text-purple-400 font-black">#{g.grNo}</span>
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                g.purpose === 'Loading'
                                  ? 'bg-amber-100/90 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                  : g.purpose === 'Unloading'
                                  ? 'bg-emerald-100/90 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {g.purpose}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="text-slate-500 dark:text-slate-400 text-[10px] font-semibold">From:</span>
                                <b className="text-emerald-600 dark:text-emerald-400 font-black">{g.fromLoc || 'INDORE HUB'}</b>
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 font-medium pl-4">
                              <span>To:</span>
                              <b className="text-blue-600 dark:text-blue-400 font-bold">{g.toLoc || 'INDORE HUB'}</b>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                              {g.transporter || '-'}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              Type: <span className="font-semibold text-slate-700 dark:text-slate-300">{g.vType || '32SXL'}</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              {g.mobile && g.mobile !== '-' ? (
                                <>
                                  <Phone className="w-3 h-3 text-blue-500" />
                                  {g.mobile}
                                </>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {g.dateTime}
                          </td>

                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-[130px] truncate" title={g.remarks}>
                            {g.remarks || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-[#3e4859] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                AIL Vehicles: <b className="text-emerald-600 dark:text-emerald-400">{ailCount}</b> &bull; AHPL Vehicles: <b className="text-blue-600 dark:text-blue-400">{ahplCount}</b>
              </span>
              <span className="font-mono text-[10px]">
                Showing {filteredSecurityLogs.length} of {wmsData.filteredSecurityLogs.length} Gate Records
              </span>
            </div>

          </div>
        )}

        {/* Modal for Detailed Consolidated Pending Loading Plans */}
        {showPendingPlansModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-purple-50/70 dark:bg-slate-900/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-200/80 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 flex items-center justify-center font-bold">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide">
                      Pending Consolidated Loading Plans
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Detailed Plan View consolidated entries currently in Pending status ({pendingPlansList.length} Total)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPendingPlansModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Search & Filter */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/50 flex flex-col md:flex-row gap-3 justify-between items-center">
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search destination, transporter, vehicle..."
                      value={planSearchQuery}
                      onChange={(e) => setPlanSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-hidden"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 dark:bg-slate-700/80 border border-slate-300 dark:border-slate-600 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setModalFilterOverdueOnly(false)}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition flex items-center justify-center gap-1.5 flex-1 sm:flex-none ${
                        !modalFilterOverdueOnly
                          ? 'bg-purple-700 text-white shadow-xs'
                          : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      All Pending ({pendingPlansList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalFilterOverdueOnly(true)}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition flex items-center justify-center gap-1.5 flex-1 sm:flex-none ${
                        modalFilterOverdueOnly
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Overdue Only ({overdueConsolidatedPlans.length})
                    </button>
                  </div>
                </div>

                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Showing {filteredPendingPlansList.length} of {pendingPlansList.length} Pending Plans
                </div>
              </div>

              {/* Modal Table Body */}
              <div className="p-4 overflow-y-auto flex-1">
                {filteredPendingPlansList.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-medium">
                    {modalFilterOverdueOnly
                      ? 'Great news! No overdue pending loading plans found.'
                      : 'No pending consolidated loading plans found for the selected date.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-black uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2.5">#</th>
                          <th className="px-3 py-2.5">Destination / Route</th>
                          <th className="px-3 py-2.5">Target Date</th>
                          <th className="px-3 py-2.5">Transporter</th>
                          <th className="px-3 py-2.5">Vehicle Type</th>
                          <th className="px-3 py-2.5">Company</th>
                          <th className="px-3 py-2.5 text-right">Orders</th>
                          <th className="px-3 py-2.5 text-right">Total Wt</th>
                          <th className="px-3 py-2.5 text-right">Total CFT</th>
                          <th className="px-3 py-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-medium">
                        {filteredPendingPlansList.map((plan: any, idx: number) => {
                          const isOverdue = isConsolidatedPlanOverdue(plan);
                          const targetDateStr = getPlanGroupTargetDate(plan);
                          return (
                            <tr
                              key={idx}
                              className={`transition ${
                                isOverdue
                                  ? 'bg-rose-50/80 dark:bg-rose-950/30 hover:bg-rose-100/80 dark:hover:bg-rose-900/40 border-l-4 border-l-rose-500'
                                  : 'hover:bg-purple-50/50 dark:hover:bg-slate-700/50'
                              }`}
                            >
                              <td className="px-3 py-2.5 font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-3 py-2.5 font-bold text-purple-950 dark:text-purple-200">
                                {plan.dest}
                                {plan.isMilkRoute && (
                                  <span className="ml-2 bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[9px] px-1.5 py-0.5 rounded font-extrabold">
                                    Milk Route
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-[11px]">
                                <span className={isOverdue ? 'text-rose-700 dark:text-rose-400 font-black flex items-center gap-1' : 'text-slate-600 dark:text-slate-300 font-semibold'}>
                                  {isOverdue && <Clock className="w-3 h-3 text-rose-500 shrink-0" />}
                                  {targetDateStr}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 font-bold text-slate-700 dark:text-slate-200">{plan.transporter || 'N/A'}</td>
                              <td className="px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">{plan.vType || 'N/A'}</td>
                              <td className="px-3 py-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                  (plan.unit || '').toUpperCase().includes('AIL')
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                }`}>
                                  {plan.unit || 'AHPL'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-700 dark:text-slate-200">{plan.count}</td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">{(plan.totalWeight || 0).toLocaleString()} kg</td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-purple-700 dark:text-purple-300">{(plan.totalCft || 0).toLocaleString()} CFT</td>
                              <td className="px-3 py-2.5 text-center">
                                {isOverdue ? (
                                  <span className="bg-rose-600 text-white px-2 py-0.5 rounded text-[10px] font-black shadow-2xs inline-flex items-center gap-1 animate-pulse">
                                    <AlertTriangle className="w-3 h-3 text-white" /> OVERDUE
                                  </span>
                                ) : (
                                  <span className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded text-[10px] font-extrabold border border-amber-300/50">
                                    {plan.status || 'Pending'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
