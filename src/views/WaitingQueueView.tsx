import React, { useState, useMemo } from 'react';
import {
  Clock,
  Truck,
  MapPin,
  Search,
  Filter,
  LayoutGrid,
  Table as TableIcon,
  UploadCloud,
  DownloadCloud,
  Phone,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Pencil,
  X,
  Calendar,
  Zap
} from 'lucide-react';
import { LoadUnloadEntry, SecurityGateEntry, WaitingQueueItem } from '../types';
import { computeWaitingQueueItems, isPendingGateEntry } from '../utils/queueSync';
import { matchesWmsDateFilter, getGateRecordDate } from '../utils/wmsDataEngine';

interface WaitingQueueViewProps {
  loadEntries: LoadUnloadEntry[];
  securityLogs: SecurityGateEntry[];
  transporters?: string[];
  vehicleTypes?: string[];
  loadLocations?: string[];
  unloadLocations?: string[];
  globalFilterType?: 'DATE' | 'MONTH' | 'RANGE' | 'ALL' | string;
  globalFilterValue?: string;
  globalFilterEndDate?: string;
  onGlobalDateFilterChange?: (type: 'DATE' | 'MONTH' | 'RANGE' | 'ALL', val: string, endVal?: string) => void;
  onSelectVehicle: (gateId: string, dest?: { location: string; unit?: string }) => void;
  onDeleteGateEntry?: (id: string, skipConfirm?: boolean, destToRemove?: { location: string; unit?: string }) => void;
  onAddGateEntry?: (entry: SecurityGateEntry) => void;
  onEditGateEntry?: (entry: SecurityGateEntry) => void;
}

export const WaitingQueueView: React.FC<WaitingQueueViewProps> = ({
  loadEntries,
  securityLogs,
  transporters = [],
  vehicleTypes = [],
  loadLocations = [],
  unloadLocations = [],
  globalFilterType,
  globalFilterValue,
  globalFilterEndDate,
  onGlobalDateFilterChange,
  onSelectVehicle,
  onDeleteGateEntry,
  onAddGateEntry,
  onEditGateEntry
}) => {
  // View mode toggle for PC: Grid Cards vs Dense Table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [purposeFilter, setPurposeFilter] = useState<'ALL' | 'Loading' | 'Unloading'>('ALL');
  const [divisionFilter, setDivisionFilter] = useState<'ALL' | 'AIL' | 'AHPL' | 'One Abbott'>('ALL');
  const [routeFilter, setRouteFilter] = useState<'ALL' | 'Single Drop' | 'Milk Route'>('ALL');
  const [durationFilter, setDurationFilter] = useState<'ALL' | '<1h' | '1-2h' | '>2h'>('ALL');

  // Date Filter Local States
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

  const activeMode = globalFilterType || filterMode;
  const activeSelDate = globalFilterValue || selectedDate;
  const activeStartDate = globalFilterValue || startDate;
  const activeEndDate = globalFilterEndDate || endDate;

  // Deletion & Add/Edit Modal States
  const [deletingItem, setDeletingItem] = useState<SecurityGateEntry | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SecurityGateEntry | null>(null);

  const getCurrentDate = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Form states for Add / Edit
  const [formPurpose, setFormPurpose] = useState<'Loading' | 'Unloading'>('Loading');
  const [formEntryDate, setFormEntryDate] = useState(getCurrentDate());
  const [formUnit, setFormUnit] = useState('AHPL');
  const [formVehicle, setFormVehicle] = useState('');
  const [formVType, setFormVType] = useState('32FT MXL');
  const [formTransporter, setFormTransporter] = useState('DHTC');
  const [formRouteType, setFormRouteType] = useState('Single Drop');
  const [formLocation, setFormLocation] = useState('INDORE HUB');
  const [formMobile, setFormMobile] = useState('');
  const [formRemarks, setFormRemarks] = useState('');

  const handleStartEdit = (item: SecurityGateEntry) => {
    setEditingItem(item);
    setFormPurpose(item.purpose === 'Unloading' ? 'Unloading' : 'Loading');
    setFormEntryDate(item.entryDate || getCurrentDate());
    setFormUnit(item.unit || 'AHPL');
    setFormVehicle(item.vehicle || '');
    setFormVType(item.vType || '');
    setFormTransporter(item.transporter || '');
    setFormRouteType(item.routeType || 'Single Drop');
    setFormLocation(item.purpose === 'Unloading' ? item.fromLoc || '' : item.toLoc || '');
    setFormMobile(item.mobile || '');
    setFormRemarks(item.remarks || '');
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormPurpose('Loading');
    setFormEntryDate(getCurrentDate());
    setFormUnit('AHPL');
    setFormVehicle('');
    setFormVType(vehicleTypes[0] || '32FT MXL');
    setFormTransporter(transporters[0] || 'DHTC');
    setFormRouteType('Single Drop');
    setFormLocation(loadLocations[0] || 'INDORE HUB');
    setFormMobile('');
    setFormRemarks('');
    setIsAddModalOpen(true);
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVehicle.trim()) return;

    const cleanVehicle = formVehicle.trim().toUpperCase().replace(/\s+/g, '');
    const now = new Date();
    const formattedDateTime = `${now.toISOString().split('T')[0]} ${now.toTimeString().substring(0, 5)}`;

    if (editingItem && onEditGateEntry) {
      const updated: SecurityGateEntry = {
        ...editingItem,
        purpose: formPurpose,
        entryDate: formEntryDate,
        unit: formUnit,
        vehicle: cleanVehicle,
        vType: formVType,
        transporter: formTransporter,
        routeType: formRouteType,
        fromLoc: formPurpose === 'Unloading' ? formLocation : 'WAREHOUSE',
        toLoc: formPurpose === 'Loading' ? formLocation : 'WAREHOUSE',
        mobile: formMobile || 'N/A',
        remarks: formRemarks,
      };
      onEditGateEntry(updated);
      setEditingItem(null);
    } else if (onAddGateEntry) {
      const newEntry: SecurityGateEntry = {
        id: `GATE-${Date.now()}`,
        purpose: formPurpose,
        entryDate: formEntryDate,
        unit: formUnit,
        vehicle: cleanVehicle,
        vType: formVType || '32FT MXL',
        transporter: formTransporter || 'N/A',
        routeType: formRouteType,
        fromLoc: formPurpose === 'Unloading' ? formLocation : 'WAREHOUSE',
        toLoc: formPurpose === 'Loading' ? formLocation : 'WAREHOUSE',
        mobile: formMobile || 'N/A',
        remarks: formRemarks,
        dateTime: formattedDateTime,
      };
      onAddGateEntry(newEntry);
      setIsAddModalOpen(false);
    }
  };

  // Set of dismissed queue item keys for direct instant deletion (0ms latency, optimistic UI)
  const [dismissedQueueKeys, setDismissedQueueKeys] = useState<Set<string>>(new Set());

  // Direct instant deletion handler that immediately removes the item from the queue array and triggers UI re-render
  const handleDirectDelete = (item: WaitingQueueItem) => {
    // 1. Immediately remove from local state set
    setDismissedQueueKeys((prev) => {
      const next = new Set(prev);
      next.add(item.queueKey);
      if (item.gateIds && item.gateIds.length > 0) {
        item.gateIds.forEach(id => next.add(id));
      } else {
        next.add(item.gateId);
      }
      return next;
    });

    // 2. Persist removal to Firestore without blocking modal
    if (onDeleteGateEntry) {
      if (item.gateIds && item.gateIds.length > 0) {
        item.gateIds.forEach(id => onDeleteGateEntry(id, true));
      } else {
        onDeleteGateEntry(item.gateId, true);
      }
    }
  };

  // Date-filtered security logs for active view (strictly matching the active filter date, no stale carryover)
  const dateFilteredSecurityLogs = useMemo(() => {
    return securityLogs.filter(s => {
      const sDate = getGateRecordDate(s);
      return matchesWmsDateFilter(sDate, activeSelDate, activeStartDate, activeEndDate, activeMode as any);
    });
  }, [securityLogs, activeSelDate, activeStartDate, activeEndDate, activeMode]);

  const dateFilteredLoadEntries = useMemo(() => {
    return loadEntries.filter(l => {
      const lDate = l.date || l.entryDate || l.dateTime || (l as any).createdAt || l.startTime;
      return matchesWmsDateFilter(lDate, activeSelDate, activeStartDate, activeEndDate, activeMode as any);
    });
  }, [loadEntries, activeSelDate, activeStartDate, activeEndDate, activeMode]);

  // Pending gate arrivals that haven't been assigned or started
  const usedGateIds = useMemo(() => new Set(dateFilteredLoadEntries.map((l) => l.gateId).filter(Boolean)), [dateFilteredLoadEntries]);
  const activeOps = useMemo(() => dateFilteredLoadEntries.filter(l => l.status !== 'LOADED' && l.status !== 'UNLOADED'), [dateFilteredLoadEntries]);
  const activeVehicleNos = useMemo(() => new Set(activeOps.map((l) => l.vehicleNo)), [activeOps]);
  const allUsedVehicleNos = useMemo(() => new Set(dateFilteredLoadEntries.map((l) => l.vehicleNo)), [dateFilteredLoadEntries]);

  // Split-queue calculation: Synchronized authoritative waiting queue computation
  const waitingQueueItems = useMemo(() => {
    return computeWaitingQueueItems(dateFilteredSecurityLogs, loadEntries, dismissedQueueKeys);
  }, [dateFilteredSecurityLogs, loadEntries, dismissedQueueKeys]);

  // Helper to compute color-coded wait status and duration badge
  const getWaitStatusInfo = (dateTimeStr?: string) => {
    if (!dateTimeStr) {
      return {
        label: 'Waiting Queue',
        durationText: 'N/A',
        category: 'unknown' as const,
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        dotClass: 'bg-slate-400',
        borderClass: 'border-slate-200 dark:border-slate-700',
        textClass: 'text-slate-600 dark:text-slate-300',
      };
    }
    try {
      const parsed = new Date(dateTimeStr.replace(' ', 'T'));
      if (isNaN(parsed.getTime())) {
        return {
          label: 'Waiting Queue',
          durationText: 'N/A',
          category: 'unknown' as const,
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
          dotClass: 'bg-slate-400',
          borderClass: 'border-slate-200 dark:border-slate-700',
          textClass: 'text-slate-600 dark:text-slate-300',
        };
      }
      const diffMs = Date.now() - parsed.getTime();
      if (diffMs < 0) {
        return {
          label: 'Waiting < 1h',
          durationText: 'Just in',
          category: 'under1h' as const,
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/80',
          dotClass: 'bg-emerald-500',
          borderClass: 'border-emerald-300 dark:border-emerald-800',
          textClass: 'text-emerald-700 dark:text-emerald-300',
        };
      }
      const diffMins = Math.floor(diffMs / 60000);
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      const durationText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

      if (diffMins < 60) {
        return {
          label: 'Waiting < 1h',
          durationText,
          category: 'under1h' as const,
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/80',
          dotClass: 'bg-emerald-500',
          borderClass: 'border-emerald-300 dark:border-emerald-800',
          textClass: 'text-emerald-700 dark:text-emerald-300',
        };
      } else if (diffMins < 120) {
        return {
          label: 'Waiting 1-2h',
          durationText,
          category: '1to2h' as const,
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/80',
          dotClass: 'bg-amber-500',
          borderClass: 'border-amber-300 dark:border-amber-800',
          textClass: 'text-amber-700 dark:text-amber-300',
        };
      } else {
        return {
          label: 'Waiting > 2h',
          durationText,
          category: 'over2h' as const,
          badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/80',
          dotClass: 'bg-rose-500 animate-pulse',
          borderClass: 'border-rose-300 dark:border-rose-800',
          textClass: 'text-rose-700 dark:text-rose-300',
        };
      }
    } catch {
      return {
        label: 'Waiting Queue',
        durationText: 'N/A',
        category: 'unknown' as const,
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        dotClass: 'bg-slate-400',
        borderClass: 'border-slate-200 dark:border-slate-700',
        textClass: 'text-slate-600 dark:text-slate-300',
      };
    }
  };

  // Filtered list based on search, purpose, division, route type, and wait duration
  const filteredQueue = useMemo(() => {
    return waitingQueueItems.filter((item) => {
      const q = searchQuery.trim().toLowerCase();

      // Purpose filter
      if (purposeFilter !== 'ALL' && item.purpose !== purposeFilter) {
        return false;
      }

      // Division filter
      const unitsInItem = (item.divisionSections || []).map(s => s.unit.toUpperCase());
      const mainUnit = (item.unit || '').toUpperCase();
      if (divisionFilter === 'AIL' && !unitsInItem.some(u => u.includes('AIL')) && !mainUnit.includes('AIL')) return false;
      if (divisionFilter === 'AHPL' && !unitsInItem.some(u => u.includes('AHPL')) && !mainUnit.includes('AHPL')) return false;
      if (divisionFilter === 'One Abbott' && !(unitsInItem.includes('AIL') && unitsInItem.includes('AHPL')) && !mainUnit.includes('&') && !mainUnit.includes('ONE ABBOTT')) return false;

      // Route type filter
      if (routeFilter === 'Milk Route' && item.routeType !== 'Milk Route') return false;
      if (routeFilter === 'Single Drop' && item.routeType === 'Milk Route') return false;

      // Wait duration filter
      if (durationFilter !== 'ALL') {
        const cat = getWaitStatusInfo(item.dateTime).category;
        if (durationFilter === '<1h' && cat !== 'under1h') return false;
        if (durationFilter === '1-2h' && cat !== '1to2h') return false;
        if (durationFilter === '>2h' && cat !== 'over2h') return false;
      }

      if (!q) return true;

      const vMatch = (item.vehicle || '').toLowerCase().includes(q);
      const transMatch = (item.transporter || '').toLowerCase().includes(q);
      const locMatch = (item.location || '').toLowerCase().includes(q) ||
        (item.allPendingDrops || []).some(d => d.location.toLowerCase().includes(q)) ||
        (item.allTargets || []).some(t => t.location.toLowerCase().includes(q));
      const mobileMatch = (item.mobile || '').toLowerCase().includes(q);
      const grMatch = (item.grNo || '').toLowerCase().includes(q);
      const unitMatch = (item.unit || '').toLowerCase().includes(q) ||
        (item.divisionSections || []).some(s => s.unit.toLowerCase().includes(q));

      return vMatch || transMatch || locMatch || mobileMatch || grMatch || unitMatch;
    });
  }, [waitingQueueItems, searchQuery, purposeFilter, divisionFilter, routeFilter, durationFilter]);

  // Summary Metrics: based on unique vehicles and their division presence
  const totalWaiting = waitingQueueItems.length;
  const loadingWaiting = waitingQueueItems.filter(v => v.purpose === 'Loading');
  const unloadingWaiting = waitingQueueItems.filter(v => v.purpose === 'Unloading');
  const milkRouteCount = waitingQueueItems.filter(v => v.routeType === 'Milk Route' || v.isSplit).length;

  const under1hCount = waitingQueueItems.filter(v => getWaitStatusInfo(v.dateTime).category === 'under1h').length;
  const oneToTwoHCount = waitingQueueItems.filter(v => getWaitStatusInfo(v.dateTime).category === '1to2h').length;
  const over2hCount = waitingQueueItems.filter(v => getWaitStatusInfo(v.dateTime).category === 'over2h').length;

  const ailCount = waitingQueueItems.filter(v => 
    (v.divisionSections || []).some(s => s.unit === 'AIL') || (v.unit || '').toUpperCase().includes('AIL')
  ).length;
  const ahplCount = waitingQueueItems.filter(v => 
    (v.divisionSections || []).some(s => s.unit === 'AHPL') || (v.unit || '').toUpperCase().includes('AHPL')
  ).length;

  const loadingAilCount = loadingWaiting.filter(v => 
    (v.divisionSections || []).some(s => s.unit === 'AIL') || (v.unit || '').toUpperCase().includes('AIL')
  ).length;
  const loadingAhplCount = loadingWaiting.filter(v => 
    (v.divisionSections || []).some(s => s.unit === 'AHPL') || (v.unit || '').toUpperCase().includes('AHPL')
  ).length;

  const unloadingAilCount = unloadingWaiting.filter(v => 
    (v.divisionSections || []).some(s => s.unit === 'AIL') || (v.unit || '').toUpperCase().includes('AIL')
  ).length;
  const unloadingAhplCount = unloadingWaiting.filter(v => 
    (v.divisionSections || []).some(s => s.unit === 'AHPL') || (v.unit || '').toUpperCase().includes('AHPL')
  ).length;

  const getElapsedWaitTime = (dateTimeStr?: string) => {
    return getWaitStatusInfo(dateTimeStr).durationText;
  };

  return (
    <div className="flex flex-col space-y-5">
      {/* PC Mode Top Breadcrumb & Title Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 p-2.5 sm:p-4 md:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-2xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  Waiting for Loading / Unloading
                </h1>
                <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300/50">
                  PC WMS Queue
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Vehicles arrived at Security Gate &bull; Click any vehicle or destination to assign dock and start operations.
              </p>
            </div>
          </div>

          {/* View Mode Toggle (Grid Cards vs Table) & Queue Counter */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            {/* Date Filter Control */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
              <input
                type="date"
                value={activeSelDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedDate(val);
                  setFilterMode('single');
                  if (onGlobalDateFilterChange) onGlobalDateFilterChange('DATE', val);
                }}
                className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold px-2 py-1 rounded border border-slate-200 dark:border-slate-700 outline-hidden"
              />
              <button
                type="button"
                onClick={() => {
                  setFilterMode('all');
                  if (onGlobalDateFilterChange) onGlobalDateFilterChange('ALL', '');
                }}
                className={`px-2 py-1 text-xs font-extrabold rounded ${
                  activeMode === 'ALL' || activeMode === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                All
              </button>
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Card Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Card Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Dense Table View"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Data Table</span>
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 px-3 py-1.5 rounded-lg text-amber-800 dark:text-amber-300 flex items-center gap-2 text-xs font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>{totalWaiting} In Queue</span>
            </div>

            {onAddGateEntry && (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Vehicle</span>
              </button>
            )}
          </div>
        </div>

        {/* 5 PC KPI Metric Summary Cards (Hidden on mobile, visible on desktop/tablets md: 768px+) */}
        <div className="hidden md:grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/80">
          {/* Card 1: Total Waiting */}
          <div className="hidden md:block bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Total Waiting</span>
              <Truck className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-xl font-black font-mono text-slate-900 dark:text-white">{totalWaiting}</div>
              <span className="text-[10px] text-slate-500 font-semibold">{milkRouteCount} Milk Route</span>
            </div>
          </div>

          {/* Card 2: Waiting for Loading */}
          <div
            onClick={() => setPurposeFilter(purposeFilter === 'Loading' ? 'ALL' : 'Loading')}
            className={`hidden md:flex p-3 rounded-lg border cursor-pointer transition flex-col justify-between ${
              purposeFilter === 'Loading'
                ? 'bg-amber-100/70 dark:bg-amber-950/70 border-amber-400 dark:border-amber-600 shadow-2xs'
                : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100/50'
            }`}
          >
            <div className="flex justify-between items-center text-amber-800 dark:text-amber-300 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Waiting For Loading</span>
              <UploadCloud className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-xl font-black font-mono text-amber-900 dark:text-amber-200">
                {loadingWaiting.length}
              </div>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                Click to filter
              </span>
            </div>
            <div className="mt-2 pt-1.5 border-t border-amber-200/80 dark:border-amber-800/60 flex justify-between text-[10px] font-mono font-black text-amber-900 dark:text-amber-300">
              <span className="bg-white/80 dark:bg-amber-900/50 px-1.5 py-0.5 rounded border border-amber-300/60 dark:border-amber-700">AIL: {loadingAilCount}</span>
              <span className="bg-white/80 dark:bg-amber-900/50 px-1.5 py-0.5 rounded border border-amber-300/60 dark:border-amber-700">AHPL: {loadingAhplCount}</span>
            </div>
          </div>

          {/* Card 3: Waiting for Unloading */}
          <div
            onClick={() => setPurposeFilter(purposeFilter === 'Unloading' ? 'ALL' : 'Unloading')}
            className={`hidden md:flex p-3 rounded-lg border cursor-pointer transition flex-col justify-between ${
              purposeFilter === 'Unloading'
                ? 'bg-blue-100/70 dark:bg-blue-950/70 border-blue-400 dark:border-blue-600 shadow-2xs'
                : 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60 hover:bg-blue-100/50'
            }`}
          >
            <div className="flex justify-between items-center text-blue-800 dark:text-blue-300 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Waiting For Unloading</span>
              <DownloadCloud className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-xl font-black font-mono text-blue-900 dark:text-blue-200">
                {unloadingWaiting.length}
              </div>
              <span className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold">
                Click to filter
              </span>
            </div>
            <div className="mt-2 pt-1.5 border-t border-blue-200/80 dark:border-blue-800/60 flex justify-between text-[10px] font-mono font-black text-blue-900 dark:text-blue-300">
              <span className="bg-white/80 dark:bg-blue-900/50 px-1.5 py-0.5 rounded border border-blue-300/60 dark:border-blue-700">AIL: {unloadingAilCount}</span>
              <span className="bg-white/80 dark:bg-blue-900/50 px-1.5 py-0.5 rounded border border-blue-300/60 dark:border-blue-700">AHPL: {unloadingAhplCount}</span>
            </div>
          </div>

          {/* Card 4: Wait Duration SLA Breakdown */}
          <div className="hidden md:block bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Wait Duration SLA</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="flex items-center gap-1.5 mt-1 font-mono font-bold text-xs">
              <button
                type="button"
                onClick={() => setDurationFilter(durationFilter === '<1h' ? 'ALL' : '<1h')}
                className={`px-1.5 py-0.5 rounded transition ${
                  durationFilter === '<1h'
                    ? 'bg-emerald-600 text-white ring-1 ring-emerald-600'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-200'
                }`}
                title="Filter Waiting < 1h"
              >
                &lt;1h: {under1hCount}
              </button>
              <button
                type="button"
                onClick={() => setDurationFilter(durationFilter === '1-2h' ? 'ALL' : '1-2h')}
                className={`px-1.5 py-0.5 rounded transition ${
                  durationFilter === '1-2h'
                    ? 'bg-amber-600 text-white ring-1 ring-amber-600'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200'
                }`}
                title="Filter Waiting 1-2h"
              >
                1-2h: {oneToTwoHCount}
              </button>
              <button
                type="button"
                onClick={() => setDurationFilter(durationFilter === '>2h' ? 'ALL' : '>2h')}
                className={`px-1.5 py-0.5 rounded transition ${
                  durationFilter === '>2h'
                    ? 'bg-rose-600 text-white ring-1 ring-rose-600 animate-pulse'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 hover:bg-rose-200'
                }`}
                title="Filter Waiting > 2h"
              >
                &gt;2h: {over2hCount}
              </button>
            </div>
          </div>

          {/* Card 5: Division Split */}
          <div className="hidden md:block bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Division Split</span>
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="flex items-center gap-2 font-mono font-bold text-xs mt-1">
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                AIL: {ailCount}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                AHPL: {ahplCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PC Mode Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Vehicle No, Transporter, Destination, Mobile, GR No..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Filter Badges & Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Purpose Filter Pills */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setPurposeFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                purposeFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              All Types ({totalWaiting})
            </button>
            <button
              onClick={() => setPurposeFilter('Loading')}
              className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                purposeFilter === 'Loading'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-700 dark:text-amber-400 hover:text-amber-900'
              }`}
            >
              <UploadCloud className="w-3 h-3" />
              Loading ({loadingWaiting.length})
            </button>
            <button
              onClick={() => setPurposeFilter('Unloading')}
              className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                purposeFilter === 'Unloading'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-blue-700 dark:text-blue-400 hover:text-blue-900'
              }`}
            >
              <DownloadCloud className="w-3 h-3" />
              Unloading ({unloadingWaiting.length})
            </button>
          </div>

          {/* Wait Duration Selector */}
          <select
            value={durationFilter}
            onChange={(e) => setDurationFilter(e.target.value as 'ALL' | '<1h' | '1-2h' | '>2h')}
            className={`border rounded-lg px-2.5 py-1 text-xs font-semibold outline-none cursor-pointer transition ${
              durationFilter !== 'ALL'
                ? 'bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-950/60 dark:border-blue-600 dark:text-blue-300 font-bold'
                : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
            }`}
          >
            <option value="ALL">Wait: All Durations</option>
            <option value="<1h">Waiting &lt; 1h ({under1hCount})</option>
            <option value="1-2h">Waiting 1-2h ({oneToTwoHCount})</option>
            <option value=">2h">Waiting &gt; 2h ({over2hCount})</option>
          </select>

          {/* Division Selector */}
          <select
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value as 'ALL' | 'AIL' | 'AHPL' | 'One Abbott')}
            className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="ALL">Division: All</option>
            <option value="AIL">Division: AIL</option>
            <option value="AHPL">Division: AHPL</option>
            <option value="One Abbott">Division: One Abbott</option>
          </select>

          {/* Route Type Selector */}
          <select
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value as 'ALL' | 'Single Drop' | 'Milk Route')}
            className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="ALL">Route: All</option>
            <option value="Single Drop">Single Drop</option>
            <option value="Milk Route">Milk Route</option>
          </select>

          {(searchQuery || purposeFilter !== 'ALL' || divisionFilter !== 'ALL' || routeFilter !== 'ALL' || durationFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setPurposeFilter('ALL');
                setDivisionFilter('ALL');
                setRouteFilter('ALL');
                setDurationFilter('ALL');
              }}
              className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {filteredQueue.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 shadow-xs text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4 text-slate-400 dark:text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
            {waitingQueueItems.length === 0 ? 'Queue is Clean & Empty' : 'No Vehicles Match Filter'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            {waitingQueueItems.length === 0
              ? 'All arrived vehicles have been successfully allocated docks or processed.'
              : 'Try clearing your search query or adjusting the filters above.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Unified PC Card Grid View - Consolidated by Vehicle Number across Divisions */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredQueue.map((item) => {
            const vehicle = item;
            const isLoad = item.purpose === 'Loading';
            const waitInfo = getWaitStatusInfo(item.dateTime);
            const purposeColor = isLoad
              ? 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700'
              : 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700';

            const sections = item.divisionSections || [];
            const hasMultipleDivisions = sections.length > 1;

            return (
              <div
                key={item.queueKey}
                className={`group bg-white dark:bg-slate-800 rounded-xl p-3 border transition-all relative flex flex-col justify-between ${
                  waitInfo.category === 'over2h'
                    ? 'border-rose-300 dark:border-rose-800/80 shadow-rose-500/5 hover:border-rose-500 hover:shadow-md'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md'
                }`}
              >
                {/* Left vertical indicator bar */}
                <div
                  className={`absolute top-0 left-0 w-1.5 h-full rounded-l-xl ${
                    waitInfo.category === 'over2h'
                      ? 'bg-rose-500'
                      : isLoad
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />

                <div>
                  {/* Vehicle Header & Multi-Division Badges */}
                  <div 
                    onClick={() => onSelectVehicle(item.gateId)}
                    className="flex justify-between items-start mb-1.5 pl-1 cursor-pointer group-hover:opacity-95"
                    title="Click to Open Supervisor Form"
                  >
                    <div>
                      <span className="font-mono font-black text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block leading-tight">
                        {item.vehicle}
                      </span>
                      <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">
                        {item.transporter || 'Transporter N/A'} {item.vType ? `• ${item.vType}` : ''}
                      </span>
                    </div>

                    {/* Consolidated Division Pills */}
                    <div className="flex items-center gap-1 shrink-0">
                      {sections.length > 0 ? (
                        sections.map((sec) => {
                          const isAil = sec.unit.toUpperCase().includes('AIL');
                          return (
                            <span
                              key={sec.unit}
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border shadow-2xs ${
                                isAil
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              }`}
                            >
                              {sec.unit}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs">
                          {item.unit || 'AIL'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Purpose & Wait Status Badge Row */}
                  <div className="flex items-center justify-between gap-1 mb-2 pl-1">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border inline-flex items-center gap-1 ${purposeColor}`}
                    >
                      {isLoad ? <UploadCloud className="w-2.5 h-2.5" /> : <DownloadCloud className="w-2.5 h-2.5" />}
                      {isLoad ? 'WAITING FOR LOADING' : 'WAITING FOR UNLOADING'}
                    </span>

                    {/* Color-coded Visual Status Badge indicating waiting duration */}
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold shadow-2xs ${waitInfo.badgeClass}`}
                      title={`Gate In: ${item.dateTime || 'Unknown'} • Elapsed wait: ${waitInfo.durationText}`}
                    >
                      <span className={`w-1 h-1 rounded-full shrink-0 ${waitInfo.dotClass}`} />
                      <span className="font-black">{waitInfo.label}</span>
                      <span className="font-mono text-[8px] opacity-75">({waitInfo.durationText})</span>
                    </span>
                  </div>

                  {/* Render Open Bulk Form button only when transport mode is Rail or Air */}
                  {(vehicle.transportMode === 'Rail' || vehicle.transportMode === 'Air') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVehicle(vehicle.gateId);
                      }}
                      className="open-bulk-btn w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[11px] font-bold shadow-xs cursor-pointer transition mb-2"
                      title="Open Bulk Submit Form for all destinations"
                    >
                      ⚡ ⚡ Open Bulk Form ({vehicle.allTargets?.length || 2} Stops)
                    </button>
                  )}

                  {/* UNIFIED MULTI-DIVISION & INDEPENDENT ROUTE SECTIONS */}
                  <div className="space-y-2 mb-2 pl-1">
                    {sections.length > 0 ? (
                      sections.map((sec) => {
                        const isAil = sec.unit.toUpperCase().includes('AIL');
                        const cardBg = isAil
                          ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60'
                          : 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60';
                        const badgeStyle = isAil
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-300/80'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-300/80';

                        return (
                          <div key={sec.unit} className={`rounded-lg border p-2 ${cardBg} space-y-1.5`}>
                            {/* Division Section Header */}
                            <div className="flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${badgeStyle}`}>
                                  {sec.unit} Division
                                </span>
                                <span className="font-bold text-[9px] text-slate-500">
                                  {sec.pendingDrops.length} Pending Stop{sec.pendingDrops.length > 1 ? 's' : ''}
                                </span>
                              </div>
                              {sec.completedDrops && sec.completedDrops.length > 0 && (
                                <span className="text-[8px] font-extrabold text-emerald-600 dark:text-emerald-400">
                                  ✓ {sec.completedDrops.length} Active / Assigned
                                </span>
                              )}
                            </div>

                            {/* Pending Independent Drop Locations */}
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {sec.pendingDrops.map((drop, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectVehicle(drop.gateId || sec.gateId, { location: drop.location, unit: sec.unit });
                                  }}
                                  className="flex-1 min-w-[120px] inline-flex justify-between items-center gap-1.5 px-2 py-1.5 rounded-md bg-white hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer group/btn transition"
                                  title={`Assign Dock for ${drop.location} (${sec.unit})`}
                                >
                                  <div className="flex items-center gap-1 overflow-hidden">
                                    <MapPin className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                                    <span className="text-[10px] font-black text-slate-800 dark:text-slate-100 truncate group-hover/btn:text-blue-600">
                                      {drop.location}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[8px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded border border-blue-200">
                                      Assign Dock
                                    </span>
                                    <ArrowRight className="w-2.5 h-2.5 text-slate-400 group-hover/btn:text-blue-600" />
                                  </div>
                                </button>
                              ))}
                            </div>

                            {/* Already Assigned / Active Drops for this division */}
                            {sec.completedDrops && sec.completedDrops.length > 0 && (
                              <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap gap-1">
                                {sec.completedDrops.map((c, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className="inline-flex items-center gap-1 text-[8px] font-extrabold text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700"
                                  >
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                    <span>{c.location}: {c.bayNo || c.status || 'Assigned'}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      /* Fallback for single location entry */
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            <span>{item.location} ({item.unit || 'AIL'})</span>
                          </span>
                          <span className="font-bold text-[8px] text-slate-400">{item.routeType || 'Single Drop'}</span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {(item.allTargets || [{ location: item.location, unit: item.unit }]).map((m, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectVehicle(item.gateId, { location: m.location, unit: m.unit });
                              }}
                              className="flex-1 inline-flex justify-between items-center gap-2 px-2 py-1.5 rounded-md bg-white hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-blue-200 dark:border-blue-700/50 shadow-xs cursor-pointer group/btn transition-colors"
                              title={`Assign Dock for ${m.location}`}
                            >
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 group-hover/btn:text-blue-600">{m.location}</span>
                                <span className="text-[8px] font-bold text-slate-500">({m.unit})</span>
                              </div>
                              <ArrowRight className="w-3 h-3 text-slate-400 group-hover/btn:text-blue-600" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Driver Contact & Gate In Time */}
                  <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 px-1 mb-2">
                    <span className="flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5 text-slate-400" />
                      {item.mobile ? <a href={`tel:${item.mobile}`} className="hover:underline font-mono">{item.mobile}</a> : 'No Contact'}
                    </span>
                    <span className="font-mono text-[8px]">{item.dateTime ? item.dateTime.substring(11, 16) : ''}</span>
                  </div>
                </div>

                {/* Action Buttons: Assign Dock, Edit, and Direct Delete */}
                <div className="flex items-center gap-1.5 mt-auto">
                  {onEditGateEntry && (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(item.originalGateEntry)}
                      title="Edit Vehicle Arrival"
                      className="flex-1 flex justify-center items-center gap-1.5 p-1.5 text-[10px] font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 hover:border-blue-300 rounded-md transition-colors cursor-pointer bg-slate-50/50 dark:bg-slate-800"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>EDIT VEHICLE</span>
                    </button>
                  )}

                  {onDeleteGateEntry && (
                    <button
                      type="button"
                      onClick={() => handleDirectDelete(item)}
                      title="Remove Vehicle from Waiting Queue"
                      className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 border border-rose-200 dark:border-rose-900/50 hover:border-rose-600 rounded-md transition-colors cursor-pointer bg-rose-50/50 dark:bg-rose-950/20"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* PC Dense Data Table View - Consolidated by Vehicle */
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Vehicle</th>
                  <th className="py-2.5 px-3">Purpose</th>
                  <th className="py-2.5 px-3">Divisions</th>
                  <th className="py-2.5 px-3">Transporter &amp; Type</th>
                  <th className="py-2.5 px-3">Location Stops (By Division)</th>
                  <th className="py-2.5 px-3">Gate In Time</th>
                  <th className="py-2.5 px-3">Wait Duration</th>
                  <th className="py-2.5 px-3">Driver Contact</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 font-medium">
                {filteredQueue.map((item) => {
                  const vehicle = item;
                  const isLoad = item.purpose === 'Loading';
                  const waitInfo = getWaitStatusInfo(item.dateTime);
                  const sections = item.divisionSections || [];

                  return (
                    <tr
                      key={item.queueKey}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {item.entryDate || (item.dateTime ? item.dateTime.substring(0, 10) : '-')}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                          {item.vehicle}
                        </span>
                        {item.grNo && (
                          <span className="block text-[9px] text-slate-400 font-mono">GR: {item.grNo}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                            isLoad
                              ? 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700'
                              : 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700'
                          }`}
                        >
                          {isLoad ? <UploadCloud className="w-3 h-3" /> : <DownloadCloud className="w-3 h-3" />}
                          {isLoad ? 'WAITING FOR LOADING' : 'WAITING FOR UNLOADING'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {sections.length > 0 ? (
                            sections.map((sec) => (
                              <span
                                key={sec.unit}
                                className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                  sec.unit.toUpperCase().includes('AIL')
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                }`}
                              >
                                {sec.unit}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {item.unit || 'AIL'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.transporter || '-'}
                        </div>
                        <div className="text-[10px] text-slate-400">{item.vType || 'Standard'}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        {sections.length > 0 ? (
                          <div className="space-y-1.5">
                            {sections.map((sec) => (
                              <div key={sec.unit} className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${
                                  sec.unit.toUpperCase().includes('AIL')
                                    ? 'bg-blue-100/70 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-300'
                                    : 'bg-emerald-100/70 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-300'
                                }`}>
                                  {sec.unit}:
                                </span>
                                {sec.pendingDrops.map((drop, dIdx) => (
                                  <button
                                    key={dIdx}
                                    type="button"
                                    onClick={() => onSelectVehicle(drop.gateId || sec.gateId, { location: drop.location, unit: sec.unit })}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-blue-100 text-slate-800 hover:text-blue-700 border border-slate-200 transition cursor-pointer"
                                    title={`Assign Dock for ${drop.location}`}
                                  >
                                    <MapPin className="w-2.5 h-2.5 text-blue-500" />
                                    <span>{drop.location}</span>
                                    <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                  </button>
                                ))}
                                {sec.completedDrops && sec.completedDrops.map((c, cIdx) => (
                                  <span key={cIdx} className="text-[8px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    ✓ {c.location} ({c.bayNo || 'Assigned'})
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="font-bold text-slate-900 dark:text-white">
                              {item.location} ({item.unit || 'AIL'})
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {item.dateTime || '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold shadow-2xs ${waitInfo.badgeClass}`}
                          title={`Gate In: ${item.dateTime || 'Unknown'} • Elapsed wait: ${waitInfo.durationText}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${waitInfo.dotClass}`} />
                          <span className="font-black">{waitInfo.label}</span>
                          <span className="font-mono text-[9px] opacity-75">({waitInfo.durationText})</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {item.mobile ? <a href={`tel:${item.mobile}`} className="hover:underline">{item.mobile}</a> : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Render Open Bulk Form button only when transport mode is Rail or Air */}
                          {(vehicle.transportMode === 'Rail' || vehicle.transportMode === 'Air') && (
                            <button
                              type="button"
                              onClick={() => onSelectVehicle(vehicle.gateId)}
                              className="open-bulk-btn bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1.5 rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1 cursor-pointer"
                              title="Open Bulk Form for all destinations"
                            >
                              ⚡ ⚡ Open Bulk Form ({vehicle.allTargets?.length || 2} Stops)
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const firstDrop = item.allPendingDrops?.[0];
                              onSelectVehicle(firstDrop?.gateId || item.gateId, firstDrop ? { location: firstDrop.location, unit: firstDrop.unit } : undefined);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Assign Dock</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>

                          {onEditGateEntry && (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(item.originalGateEntry)}
                              title="Edit Vehicle Arrival"
                              className="p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 hover:border-blue-300 rounded-lg transition-colors cursor-pointer bg-slate-50/50 dark:bg-slate-800"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {onDeleteGateEntry && (
                            <button
                              type="button"
                              onClick={() => handleDirectDelete(item)}
                              title="Remove Vehicle from Waiting Queue"
                              className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 border border-rose-200 dark:border-rose-900/50 hover:border-rose-600 rounded-lg transition-colors cursor-pointer bg-rose-50/50 dark:bg-rose-950/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-950/70 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Delete From Waiting Queue
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Are you sure you want to remove this vehicle arrival?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 mb-5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Vehicle:</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-200">{deletingItem.vehicle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Purpose / Division:</span>
                <span className="font-bold">{deletingItem.purpose} &bull; {deletingItem.unit || 'AHPL'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transporter:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{deletingItem.transporter || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gate In Time:</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">{deletingItem.dateTime || 'N/A'}</span>
              </div>
            </div>

            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mb-5">
              Warning: This will permanently delete the gate arrival record from Firestore.
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteGateEntry && deletingItem) {
                    onDeleteGateEntry(deletingItem.id, true);
                  }
                  setDeletingItem(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition shadow-xs cursor-pointer"
              >
                Yes, Delete Vehicle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Gate Arrival Modal */}
      {(isAddModalOpen || editingItem) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-5 border border-slate-200 dark:border-slate-700 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    {editingItem ? 'Edit Waiting Vehicle' : 'Add Vehicle to Waiting Queue'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {editingItem ? 'Update arrival record' : 'Register new gate arrival for loading/unloading'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingItem(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-3.5 text-xs">
              {/* Entry Date */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Entry Date *
                </label>
                <input
                  type="date"
                  value={formEntryDate}
                  onChange={(e) => setFormEntryDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold"
                  required
                />
              </div>

              {/* Purpose & Division */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Purpose *
                  </label>
                  <select
                    value={formPurpose}
                    onChange={(e) => setFormPurpose(e.target.value as 'Loading' | 'Unloading')}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold"
                  >
                    <option value="Loading">Loading</option>
                    <option value="Unloading">Unloading</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Division *
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold"
                  >
                    <option value="AHPL">Abbott Healthcare (AHPL)</option>
                    <option value="AIL">Abbott India (AIL)</option>
                    <option value="One Abbott">One Abbott</option>
                  </select>
                </div>
              </div>

              {/* Vehicle Number & Vehicle Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Vehicle Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MP09GH1234"
                    value={formVehicle}
                    onChange={(e) => setFormVehicle(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Vehicle Type
                  </label>
                  <input
                    type="text"
                    list="vtype-suggestions"
                    placeholder="e.g. 32FT MXL"
                    value={formVType}
                    onChange={(e) => setFormVType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium"
                  />
                  <datalist id="vtype-suggestions">
                    {vehicleTypes.map((vt) => (
                      <option key={vt} value={vt} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Transporter */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Transporter
                </label>
                <input
                  type="text"
                  list="transporter-suggestions"
                  placeholder="e.g. DHTC / V-TRANS"
                  value={formTransporter}
                  onChange={(e) => setFormTransporter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium"
                />
                <datalist id="transporter-suggestions">
                  {transporters.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>

              {/* Route Type & Destination */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Route Type
                  </label>
                  <select
                    value={formRouteType}
                    onChange={(e) => setFormRouteType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium"
                  >
                    <option value="Single Drop">Single Drop</option>
                    <option value="Milk Route">Milk Route</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    {formPurpose === 'Loading' ? 'Destination Location' : 'Origin Location'}
                  </label>
                  <input
                    type="text"
                    list="loc-suggestions"
                    placeholder="e.g. MUMBAI / INDORE"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-medium"
                  />
                  <datalist id="loc-suggestions">
                    {(formPurpose === 'Loading' ? loadLocations : unloadLocations).map((loc) => (
                      <option key={loc} value={loc} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Driver Mobile & Remarks */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Driver Mobile
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Remarks / Driver Name
                  </label>
                  <input
                    type="text"
                    placeholder="Optional remarks"
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingItem ? 'Save Changes' : 'Add to Queue'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
