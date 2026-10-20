import React, { useState, useEffect } from 'react';
import { Truck, ShieldCheck, CheckCircle, Pencil, Trash2, Sparkles, Hash, Clock, Phone, MapPin, Building2, Route, Plus, X, Calendar, Filter, Eye, EyeOff, Search, RotateCcw, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { SecurityGateEntry, LoadUnloadEntry, ShuttleStep, PlanEntry } from '../types';
import { DOCK_CONFIG } from '../data/defaultData';
import { matchesWmsDateFilter } from '../utils/wmsDataEngine';
import { handleFormSubmission, filterValidLocations, mapGateEntryData } from '../utils/activitySync';

interface GateSecurityViewProps {
  activeOperations: LoadUnloadEntry[];
  onAddOperation: (op: LoadUnloadEntry) => void;
  securityLogs: SecurityGateEntry[];
  transporters: string[];
  vehicleTypes: string[];
  loadLocations: string[];
  unloadLocations: string[];
  onAddGateEntry: (entry: SecurityGateEntry) => void;
  onEditGateEntry: (entry: SecurityGateEntry) => void;
  onDeleteGateEntry: (id: string) => void;
  planEntries: PlanEntry[];
  globalFilterType?: 'DATE' | 'MONTH' | 'RANGE' | 'ALL' | string;
  globalFilterValue?: string;
  globalFilterEndDate?: string;
  onGlobalDateFilterChange?: (type: 'DATE' | 'MONTH' | 'RANGE' | 'ALL', val: string, endVal?: string) => void;
}

// LocalStorage Keys for Counters
const STORAGE_KEY_AIL_COUNTER = 'wms_gate_counter_AIL';
const STORAGE_KEY_AHPL_COUNTER = 'wms_gate_counter_AHPL';

const INITIAL_AIL_START = 623;
const INITIAL_AHPL_START = 703;

export const COMPANY_OPTIONS = [
  { value: 'AIL', label: 'Abbott India Limited (AIL)', startNum: INITIAL_AIL_START },
  { value: 'AHPL', label: 'Abbott Healthcare Private Limited (AHPL)', startNum: INITIAL_AHPL_START }
] as const;

type CompanyCode = 'AIL' | 'AHPL';

// Helper to compute next GR Number from existing logs and localStorage
export const getNextGrNumber = (company: CompanyCode, logs: SecurityGateEntry[]): number => {
  const startNum = company === 'AIL' ? INITIAL_AIL_START : INITIAL_AHPL_START;
  let maxFound = startNum - 1;

  // 1. Check existing logs
  logs.forEach((log) => {
    const logUnit = (log.unit || '').toUpperCase();
    const isTarget = company === 'AIL'
      ? logUnit.includes('AIL') || (!logUnit && Number(log.grNo) < 703 && Number(log.grNo) >= 616)
      : logUnit.includes('AHPL') || (!logUnit && Number(log.grNo) >= 703);

    if (isTarget && log.grNo) {
      const parsed = parseInt(String(log.grNo).replace(/\D/g, ''), 10);
      if (!isNaN(parsed) && parsed >= startNum && parsed > maxFound) {
        maxFound = parsed;
      }
    }
  });

  // 2. Check localStorage counter
  try {
    const storageKey = company === 'AIL' ? STORAGE_KEY_AIL_COUNTER : STORAGE_KEY_AHPL_COUNTER;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsedStored = parseInt(saved, 10);
      if (!isNaN(parsedStored) && parsedStored > maxFound) {
        maxFound = parsedStored - 1;
      }
    }
  } catch {
    // ignore
  }

  return maxFound + 1;
};

export const GateSecurityView: React.FC<GateSecurityViewProps> = ({
  activeOperations,
  onAddOperation,
  securityLogs,
  transporters,
  vehicleTypes,
  loadLocations,
  unloadLocations,
  onAddGateEntry,
  onEditGateEntry,
  onDeleteGateEntry,
  planEntries,
  globalFilterType,
  globalFilterValue,
  globalFilterEndDate,
  onGlobalDateFilterChange
}) => {
  // Filter Engine Hide / Unhide State & Search
  const [showFilterCard, setShowFilterCard] = useState<boolean>(true);
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));

  // Date Filter Local States (Default to current date)
  const [filterMode, setFilterMode] = useState<'DATE' | 'MONTH' | 'RANGE' | 'ALL'>('DATE');
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
  const activeSelDate = activeMode === 'MONTH' ? selectedMonth : (globalFilterValue || selectedDate);
  const activeStartDate = globalFilterValue || startDate;
  const activeEndDate = globalFilterEndDate || endDate;

  // Filter security logs date-wise according to active date filter (defaults to current date) & search query
  const displayedSecurityLogs = React.useMemo(() => {
    return securityLogs.filter(s => {
      const sDate = s.entryDate || (s as any).dateTime || (s as any).date || (s as any).createdAt;
      const matchesDate = matchesWmsDateFilter(sDate, activeSelDate, activeStartDate, activeEndDate, activeMode as any);
      if (!matchesDate) return false;

      if (!logSearchQuery.trim()) return true;
      const q = logSearchQuery.toLowerCase().trim();
      return (
        (s.vehicle || '').toLowerCase().includes(q) ||
        (s.grNo || '').toString().toLowerCase().includes(q) ||
        (s.transporter || '').toLowerCase().includes(q) ||
        (s.purpose || '').toLowerCase().includes(q) ||
        (s.unit || '').toLowerCase().includes(q) ||
        (s.remarks || '').toLowerCase().includes(q) ||
        (s.fromLoc || '').toLowerCase().includes(q) ||
        (s.toLoc || '').toLowerCase().includes(q)
      );
    });
  }, [securityLogs, activeSelDate, activeStartDate, activeEndDate, activeMode, logSearchQuery]);

  // 11-Parameter Strict Tracking Form State
  const [purpose, setPurpose] = useState<'Loading' | 'Unloading'>('Loading');
  const [vehicleNo, setVehicleNo] = useState('');
  const [vType, setVType] = useState(vehicleTypes[0] || '32SXL');
  const [loadDivision, setLoadDivision] = useState('AIL');
  const [routeType, setRouteType] = useState<'Single Drop' | 'Milk Route'>('Single Drop');
  
  // Helper to format current Indian timestamp
  const getCurrentFormattedDateTime = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  };
  
  const getCurrentDate = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  
  const [dateTime, setDateTime] = useState(getCurrentFormattedDateTime());
  const [entryDate, setEntryDate] = useState(getCurrentDate());
  
  const [transporter, setTransporter] = useState(transporters[0] || 'V-Trans');
  
  // Conditional Drop Location Source (Loading vs Unloading)
  const isRailAirOrCourier = Boolean(vType && (
    vType.toUpperCase().includes('RAIL') || 
    vType.toUpperCase().includes('AIR') || 
    vType.toUpperCase().includes('COURIER')
  ));

  const isCourierOrSpecialTransporter = Boolean(transporter && (
    transporter.toUpperCase().includes('SPARK TIME') ||
    transporter.toUpperCase().includes('SD CARGO') ||
    transporter.toUpperCase().includes('STAR LINE') ||
    transporter.toUpperCase().includes('COURIER') ||
    transporter.toUpperCase().includes('AIR') ||
    transporter.toUpperCase().includes('RAIL')
  ));

  const availableLocations = React.useMemo(() => {
    const isSpecialCourierOrMode = isRailAirOrCourier || isCourierOrSpecialTransporter;

    // 2. UNLOADING LOCATION SOURCE:
    if (purpose === 'Unloading') {
      const validUnloads = filterValidLocations(unloadLocations || [], 'UNLOADING') as string[];
      if (isSpecialCourierOrMode) {
        return validUnloads.length > 0 ? validUnloads : ['CFC', 'MUMBAI', 'DELHI', 'BANGALORE', 'CHENNAI', 'KOLKATA', 'HYDERABAD', 'PUNE', 'AHMEDABAD', 'JAIPUR', 'LUCKNOW', 'GUWAHATI', 'PATNA'];
      }
      return validUnloads.length > 0 ? validUnloads : [];
    }

    const validLoads = filterValidLocations(loadLocations || [], 'LOADING') as string[];

    // 1. LOADING LOCATION SOURCE (CONDITIONAL):
    if (isSpecialCourierOrMode) {
      return validLoads.length > 0 ? validLoads : ['CFC', 'MUMBAI', 'DELHI', 'BANGALORE', 'CHENNAI', 'KOLKATA', 'HYDERABAD', 'PUNE', 'AHMEDABAD', 'JAIPUR', 'LUCKNOW', 'GUWAHATI', 'PATNA'];
    }

    // For standard loading tasks: locations must be picked directly from Consolidated Loading Plans (Pending Plans Only).
    const activePlans = planEntries.filter(p => {
      const st = (p.status || 'Pending').trim().toUpperCase();
      return st === 'PENDING' || st === 'PLANNED' || (!st.includes('CONFIRMED') && st !== 'COMPLETED' && st !== 'DONE' && st !== 'DISPATCHED');
    });
    let matchedPlans = activePlans;

    if (loadDivision !== 'BOTH') {
      matchedPlans = matchedPlans.filter(p => (p.unit || '').toUpperCase() === loadDivision.toUpperCase());
    }
    if (transporter && transporter !== 'N/A' && transporters.length > 0) {
      matchedPlans = matchedPlans.filter(p => {
        const pTrans = (p.transporter || '').toUpperCase();
        const selTrans = transporter.toUpperCase();
        return pTrans === selTrans || pTrans.includes(selTrans) || selTrans.includes(pTrans);
      });
    }
    if (vType) {
      matchedPlans = matchedPlans.filter(p => {
        const pv = (p.vType || '').toUpperCase();
        const sv = vType.toUpperCase();
        return pv === sv || pv.includes(sv) || sv.includes(pv);
      });
    }
    const plannedLocs = Array.from(new Set(matchedPlans.map(p => p.destination).filter(Boolean))).sort();
    if (plannedLocs.length > 0) return filterValidLocations(plannedLocs, 'LOADING') as string[];

    const divisionPlans = activePlans.filter(p => loadDivision === 'BOTH' || (p.unit || '').toUpperCase() === loadDivision.toUpperCase());
    const divLocs = Array.from(new Set(divisionPlans.map(p => p.destination).filter(Boolean))).sort();
    if (divLocs.length > 0) return filterValidLocations(divLocs, 'LOADING') as string[];

    const allPlanned = Array.from(new Set(activePlans.map(p => p.destination).filter(Boolean))).sort();
    if (allPlanned.length > 0) return filterValidLocations(allPlanned, 'LOADING') as string[];

    // Fallback to designated loadLocations master
    return validLoads.length > 0 ? validLoads : [];
  }, [purpose, planEntries, loadDivision, transporter, vType, transporters, unloadLocations, loadLocations, isRailAirOrCourier, isCourierOrSpecialTransporter]);

  const [destination, setDestination] = useState(availableLocations[0] || 'JAIPUR');
  const [loadingStartInTime, setLoadingStartInTime] = useState('');
  const [loadingExitTime, setLoadingExitTime] = useState('');
  const [totalCases, setTotalCases] = useState<number | ''>('');
  const [supervisorNameRemarks, setSupervisorNameRemarks] = useState('');

  // Milk Route States & Multi-Select Rail/Air/Courier States
  const [milkRouteDestinations, setMilkRouteDestinations] = useState<{location: string, unit: string}[]>([]);
  const [selectedMilkLocation, setSelectedMilkLocation] = useState(availableLocations[0] || 'JAIPUR');
  const [selectedMultiDestinations, setSelectedMultiDestinations] = useState<string[]>([]);

  // Sync initial state if availableLocations changes
  useEffect(() => {
    const isCourier = vType && vType.toUpperCase().includes('COURIER');
    if (isCourier) {
      setDestination('CFC');
      setSelectedMilkLocation('CFC');
      return;
    }
    if (availableLocations.length > 0) {
      if (!destination || !availableLocations.includes(destination)) {
        setDestination(availableLocations[0]);
      }
      if (!selectedMilkLocation || !availableLocations.includes(selectedMilkLocation)) {
        setSelectedMilkLocation(availableLocations[0]);
      }
    }
  }, [availableLocations, destination, selectedMilkLocation, vType]);
  const [selectedMilkUnit, setSelectedMilkUnit] = useState('AHPL');
  
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const addMilkDestination = () => {
    const loc = selectedMilkLocation.trim().toUpperCase();
    if (!loc) return;

    if (selectedMilkUnit === 'BOTH') {
      const toAdd: { location: string; unit: string }[] = [];
      if (!milkRouteDestinations.some(m => m.location.toUpperCase() === loc && m.unit === 'AHPL')) {
        toAdd.push({ location: loc, unit: 'AHPL' });
      }
      if (!milkRouteDestinations.some(m => m.location.toUpperCase() === loc && m.unit === 'AIL')) {
        toAdd.push({ location: loc, unit: 'AIL' });
      }
      if (toAdd.length > 0) {
        setMilkRouteDestinations(prev => [...prev, ...toAdd]);
      }
    } else {
      if (!milkRouteDestinations.some(m => m.location.toUpperCase() === loc && m.unit === selectedMilkUnit)) {
        setMilkRouteDestinations(prev => [...prev, { location: loc, unit: selectedMilkUnit }]);
      }
    }
  };

  const removeMilkDestination = (indexToRemove: number) => {
    setMilkRouteDestinations(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNo || !vType) {
      alert("Please fill all required fields.");
      return;
    }

    const cleanVehicle = vehicleNo.replace(/\s+/g, '').toUpperCase();

    // Cross-Portal Validation & Mapping Fix (AIL & AHPL Activity Sync)
    const syncResult = handleFormSubmission(loadDivision, {
      activity_type: purpose,
      vehicle_no: cleanVehicle
    });

    if (!syncResult.success) {
      alert(syncResult.message || "अमान्य गतिविधि। कृपया Loading या Unloading चुनें।");
      return;
    }

    const authoritativePurpose: 'Loading' | 'Unloading' = syncResult.syncedData?.activity_type === 'UNLOADING' ? 'Unloading' : 'Loading';
    
    // Auto-assigned Dedicated Dock logic removed
    let autoAssignedDock = 'Unassigned';
    
    // Resolve combined destination for Milk Route or Multi-Select Rail/Air/Courier
    const isMultiDest = isRailAirOrCourier || isCourierOrSpecialTransporter || routeType === 'Milk Route';
    const combinedDestination = isMultiDest && milkRouteDestinations.length > 0
      ? milkRouteDestinations.map(m => `${m.location} [${m.unit}]`).join(' / ')
      : destination;

    // 1. Guard Form Submission / Data Saving Logic: Exact purpose and actual target location
    const mapped = mapGateEntryData({
      vehicle_number: cleanVehicle,
      transporter: transporter || 'N/A',
      company_division: loadDivision,
      purpose: purpose,
      target_location_destination: combinedDestination || destination,
      warehouse_name: combinedDestination || destination
    });

    let transportMode: 'Rail' | 'Air' | 'Road' = 'Road';
    const tUp = (mapped.transporter || transporter || '').toUpperCase();
    const vUp = (vType || '').toUpperCase();
    if (vUp.includes('RAIL') || tUp.includes('RAIL') || tUp.includes('SPARK TIME') || tUp.includes('SPARK')) {
      transportMode = 'Rail';
    } else if (vUp.includes('AIR') || tUp.includes('AIR') || tUp.includes('STAR LINE') || tUp.includes('SD CARGO') || tUp.includes('STARLINE')) {
      transportMode = 'Air';
    }

    const newLog: SecurityGateEntry = {
      id: `GATE-${Date.now()}`,
      purpose: mapped.purpose,
      vehicle: mapped.vehicle_number,
      vType: vType,
      mobile: 'N/A',
      transporter: mapped.transporter,
      transportMode,
      fromLoc: mapped.purpose === 'Unloading' ? mapped.target_location : 'WAREHOUSE',
      toLoc: mapped.purpose === 'Loading' ? mapped.target_location : 'WAREHOUSE',
      destination: mapped.target_location,
      target_location: mapped.target_location,
      dateTime: dateTime || getCurrentFormattedDateTime(),
      entryDate: entryDate || getCurrentDate(),
      remarks: supervisorNameRemarks,
      unit: mapped.division,
      grNo: '', 
      routeType: isMultiDest && milkRouteDestinations.length > 1 ? 'Milk Route' : routeType,
      milkRouteDestinations: (isMultiDest || milkRouteDestinations.length > 0) ? milkRouteDestinations : [],
      assignedDock: autoAssignedDock,
      loadingStartInTime: loadingStartInTime,
      loadingExitTime: loadingExitTime,
      totalCases: totalCases,
      supervisorNameRemarks: supervisorNameRemarks,
      multiDestinations: milkRouteDestinations.length > 0 ? milkRouteDestinations.map(m => m.location) : (selectedMultiDestinations.length > 0 ? selectedMultiDestinations : []),
      status: 'PENDING_QUEUE'
    };

    onAddGateEntry(newLog);



    setVehicleNo('');
    
    setDateTime(getCurrentFormattedDateTime());
    setMilkRouteDestinations([]);
    setSelectedMultiDestinations([]);
    setSuccessToast(`Entry Saved: [${authoritativePurpose}] | Vehicle: ${cleanVehicle}`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/50 dark:bg-[#1a202c]">
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-xl font-bold flex items-center gap-2 animate-in slide-in-from-top-2 fade-in duration-300">
          <CheckCircle className="w-5 h-5" />
          {successToast}
        </div>
      )}

      <div className="flex-1 p-2 sm:p-4 lg:p-6 flex justify-center items-start overflow-y-auto custom-scrollbar">
        
        {/* CENTERED COLUMN: STRICT 11-FIELD SECURITY GUARD GATE ENTRY FORM */}
        <div className="w-full max-w-2xl space-y-4">
          <div className="bg-white dark:bg-[#1e2430] border border-blue-200/60 dark:border-slate-700/80 rounded-xl shadow-xs overflow-hidden">
            
            <div className="px-4 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 border-b border-blue-700 flex justify-between items-center shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/10 rounded-md">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-white drop-shadow-sm">
                    Gate Register
                  </h2>
                  <p className="text-[10px] text-blue-100/80">Gate Entry Tracking</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
              
              {/* 1 & 2. Purpose & Transporter */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Purpose *
                  </label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value as 'Loading' | 'Unloading')}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Loading">Loading</option>
                    <option value="Unloading">Unloading</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Transporter *
                  </label>
                  <select
                    value={transporter}
                    onChange={(e) => setTransporter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    {transporters.length === 0 ? <option value="N/A">N/A</option> : null}
                    {transporters.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* 3 & 4. Vehicle Number & Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Vehicle Number (Strict 10) *
                  </label>
                  <input
                    type="text"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                    maxLength={10}
                    placeholder="MH12AB1234"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Master Vehicle Type *
                  </label>
                  <select
                    value={vType}
                    onChange={(e) => setVType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    {vehicleTypes.length === 0 ? <option value="32SXL">32SXL</option> : null}
                    {vehicleTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4 & 5. Company Division & Route Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Company Division *
                  </label>
                  <select
                    value={loadDivision}
                    onChange={(e) => setLoadDivision(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="AIL">AIL</option>
                    <option value="AHPL">AHPL</option>
                    
                    <option value="BOTH">BOTH</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Route Type *
                  </label>
                  <select
                    value={routeType}
                    onChange={(e) => setRouteType(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Single Drop">Single Drop</option>
                    <option value="Milk Route">Milk Route</option>
                  </select>
                </div>
              </div>

              {/* 5b. Entry Date */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Entry Date *
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* 6. Gate Entry Timestamp */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Gate Entry Timestamp *
                  </label>
                  <button
                    type="button"
                    onClick={() => setDateTime(getCurrentFormattedDateTime())}
                    className="text-[10px] text-blue-600 font-bold hover:underline"
                  >
                    Auto Pick Current
                  </button>
                </div>
                <input
                  type="text"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  placeholder="DD/MM/YYYY, HH:MM:SS"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* 7. Target Drop Location / Destinations */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Target Drop Location / Destination Stops *
                </label>
                {routeType === 'Milk Route' ? (
                  <div className="space-y-2 p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg">
                    <div className="flex gap-2">
                      <select
                        value={selectedMilkUnit}
                        onChange={(e) => setSelectedMilkUnit(e.target.value)}
                        className="w-1/3 bg-white dark:bg-slate-800 border border-blue-300 dark:border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      >
                        <option value="AHPL">AHPL</option>
                        <option value="AIL">AIL</option>
                        <option value="BOTH">BOTH</option>
                      </select>
                      <select
                        value={selectedMilkLocation}
                        onChange={(e) => setSelectedMilkLocation(e.target.value)}
                        className="flex-1 bg-white dark:bg-slate-800 border border-blue-300 dark:border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      >
                        {availableLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={addMilkDestination}
                        className="px-3 bg-blue-600 text-white font-bold rounded-lg text-xs hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                    {milkRouteDestinations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {milkRouteDestinations.map((dest, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold shadow-2xs">
                            <span>{dest.location}</span>
                            <span className="px-1 py-0.2 rounded bg-blue-800 text-[8px] font-black">{dest.unit}</span>
                            <button type="button" onClick={() => removeMilkDestination(idx)} className="hover:bg-blue-700 rounded p-0.5"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (isRailAirOrCourier || isCourierOrSpecialTransporter) ? (
                  <div className="space-y-2 p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                        Air / Rail / Courier Multi-Locations ({milkRouteDestinations.length} stops)
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMultiDestinations([...availableLocations]);
                            setMilkRouteDestinations(availableLocations.map(loc => ({ location: loc, unit: loadDivision })));
                          }}
                          className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMultiDestinations([]);
                            setMilkRouteDestinations([]);
                          }}
                          className="text-[10px] text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    <div className="max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                      {availableLocations.map(loc => {
                        const isSelected = selectedMultiDestinations.includes(loc) || milkRouteDestinations.some(m => m.location === loc);
                        return (
                          <label
                            key={loc}
                            className={`flex items-center gap-1.5 p-1.5 rounded cursor-pointer text-xs font-semibold transition ${
                              isSelected
                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMultiDestinations(prev => [...prev, loc]);
                                  if (!milkRouteDestinations.some(m => m.location === loc)) {
                                    setMilkRouteDestinations(prev => [...prev, { location: loc, unit: loadDivision }]);
                                  }
                                } else {
                                  setSelectedMultiDestinations(prev => prev.filter(l => l !== loc));
                                  setMilkRouteDestinations(prev => prev.filter(m => m.location !== loc));
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                            />
                            <span className="truncate">{loc}</span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Custom Stop Input for Courier or Specialized Route */}
                    <div className="flex gap-1.5 pt-1">
                      <input
                        type="text"
                        placeholder="+ Type extra destination name..."
                        id="custom-guard-dest-input"
                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 uppercase font-mono font-bold"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = (e.currentTarget.value || '').trim().toUpperCase();
                            if (val && !milkRouteDestinations.some(m => m.location === val)) {
                              setMilkRouteDestinations(prev => [...prev, { location: val, unit: loadDivision }]);
                              setSelectedMultiDestinations(prev => [...prev, val]);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('custom-guard-dest-input') as HTMLInputElement;
                          if (input && input.value.trim()) {
                            const val = input.value.trim().toUpperCase();
                            if (!milkRouteDestinations.some(m => m.location === val)) {
                              setMilkRouteDestinations(prev => [...prev, { location: val, unit: loadDivision }]);
                              setSelectedMultiDestinations(prev => [...prev, val]);
                              input.value = '';
                            }
                          }
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        + Add Stop
                      </button>
                    </div>

                    {milkRouteDestinations.length > 0 && (
                      <div className="space-y-1.5 pt-1 max-h-36 overflow-y-auto">
                        {milkRouteDestinations.map((mItem, mIdx) => (
                          <div key={`${mItem.location}-${mIdx}`} className="flex items-center justify-between bg-white dark:bg-slate-800 p-1.5 rounded border border-blue-200 dark:border-blue-800 text-xs">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {mIdx + 1}. {mItem.location}
                            </span>
                            <div className="flex items-center gap-2">
                              <select
                                value={mItem.unit}
                                onChange={(e) => {
                                  const newUnit = e.target.value;
                                  setMilkRouteDestinations(prev => prev.map((item, idx) => idx === mIdx ? { ...item, unit: newUnit } : item));
                                }}
                                className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-[10px] font-bold outline-none"
                              >
                                <option value="AHPL">AHPL</option>
                                <option value="AIL">AIL</option>
                                <option value="BOTH">BOTH</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  setMilkRouteDestinations(prev => prev.filter((_, idx) => idx !== mIdx));
                                  setSelectedMultiDestinations(prev => prev.filter(l => l !== mItem.location));
                                }}
                                className="text-rose-600 hover:text-rose-800 p-0.5 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    {availableLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                )}
              </div>



              {/* 9 & 10. Loading Start / Exit Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    {purpose} Start In-Time
                  </label>
                  <input
                    type="time"
                    value={loadingStartInTime}
                    onChange={(e) => setLoadingStartInTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    {purpose} Exit-Time
                  </label>
                  <input
                    type="time"
                    value={loadingExitTime}
                    onChange={(e) => setLoadingExitTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* 11 & 12. Total Cases & Supervisor Remarks */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Total Cases / Cartons
                  </label>
                  <input
                    type="number"
                    value={totalCases}
                    onChange={(e) => setTotalCases(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Supervisor Name & Remarks
                  </label>
                  <input
                    type="text"
                    value={supervisorNameRemarks}
                    onChange={(e) => setSupervisorNameRemarks(e.target.value)}
                    placeholder="Remarks / Sign off..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-sm transition flex items-center justify-center gap-2 mt-2"
              >
                <CheckCircle className="w-4 h-4" />
                Submit Tracking Log
              </button>
            </form>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: LIVE SECURITY GATE MOVEMENT LOG TABLE (REMOVED/HIDDEN) */}
        {/* ========================================================================= */}
        <div className="hidden">
          <div className="hidden">
            
            {/* Log Header */}
            <div className="px-4 py-3 bg-slate-50/90 dark:bg-[#252e3e]/80 border-b border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Security Gate Movement Log
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Hide / Unhide Filter Engine Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowFilterCard(!showFilterCard)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-black rounded-lg transition border ${
                    showFilterCard
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{showFilterCard ? 'Hide Filter Engine' : 'Filter Engine'}</span>
                  {showFilterCard ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                <span className="text-[11px] bg-slate-200/80 dark:bg-[#2d3748] px-2.5 py-1 rounded-full font-mono font-bold text-slate-700 dark:text-slate-300">
                  {displayedSecurityLogs.length} Records
                </span>
              </div>
            </div>

            {/* Collapsible Data Filter Engine Card */}
            {showFilterCard && (
              <div className="p-3.5 bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-slate-800/80 dark:to-slate-900/80 border-b border-slate-200 dark:border-slate-700/80 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                      Gate Data Filter Engine
                    </span>
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md font-extrabold uppercase">
                      {activeMode} MODE
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setSelectedDate(today);
                        setFilterMode('DATE');
                        setLogSearchQuery('');
                        if (onGlobalDateFilterChange) onGlobalDateFilterChange('DATE', today);
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFilterCard(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                      title="Hide Filter Engine"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Filter Controls Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* Mode Buttons */}
                  <div className="flex bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setFilterMode('DATE');
                        if (onGlobalDateFilterChange) onGlobalDateFilterChange('DATE', selectedDate);
                      }}
                      className={`flex-1 py-1 text-[11px] font-bold rounded ${activeMode === 'DATE' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      Date
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterMode('RANGE');
                        if (onGlobalDateFilterChange) onGlobalDateFilterChange('RANGE', startDate, endDate);
                      }}
                      className={`flex-1 py-1 text-[11px] font-bold rounded ${activeMode === 'RANGE' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      Range
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterMode('MONTH');
                        if (onGlobalDateFilterChange) onGlobalDateFilterChange('MONTH', selectedMonth);
                      }}
                      className={`flex-1 py-1 text-[11px] font-bold rounded ${activeMode === 'MONTH' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      Month
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterMode('ALL');
                        if (onGlobalDateFilterChange) onGlobalDateFilterChange('ALL', '');
                      }}
                      className={`flex-1 py-1 text-[11px] font-bold rounded ${activeMode === 'ALL' || activeMode === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      All
                    </button>
                  </div>

                  {/* Dynamic Input Based on Active Mode */}
                  <div className="sm:col-span-2 flex items-center gap-2">
                    {activeMode === 'DATE' && (
                      <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-900 p-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedDate(val);
                            setFilterMode('DATE');
                            if (onGlobalDateFilterChange) onGlobalDateFilterChange('DATE', val);
                          }}
                          className="w-full bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            setSelectedDate(today);
                            setFilterMode('DATE');
                            if (onGlobalDateFilterChange) onGlobalDateFilterChange('DATE', today);
                          }}
                          className="px-2 py-0.5 text-[10px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 rounded"
                        >
                          Today
                        </button>
                      </div>
                    )}

                    {activeMode === 'RANGE' && (
                      <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-900 p-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700">
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStartDate(val);
                            if (onGlobalDateFilterChange) onGlobalDateFilterChange('RANGE', val, endDate);
                          }}
                          className="w-full bg-transparent text-[11px] font-bold text-slate-800 dark:text-slate-100 outline-none"
                        />
                        <span className="text-slate-400 text-[10px] font-bold">to</span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEndDate(val);
                            if (onGlobalDateFilterChange) onGlobalDateFilterChange('RANGE', startDate, val);
                          }}
                          className="w-full bg-transparent text-[11px] font-bold text-slate-800 dark:text-slate-100 outline-none"
                        />
                      </div>
                    )}

                    {activeMode === 'MONTH' && (
                      <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-900 p-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="month"
                          value={selectedMonth}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedMonth(val);
                            if (onGlobalDateFilterChange) onGlobalDateFilterChange('MONTH', val);
                          }}
                          className="w-full bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                        />
                      </div>
                    )}

                    {(activeMode === 'ALL' || activeMode === 'all') && (
                      <div className="flex-1 bg-white dark:bg-slate-900 p-1 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 font-bold flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Showing all historic records (No Date Limit)</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter vehicle, GR#, transporter..."
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                    />
                    {logSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setLogSearchQuery('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Table View */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-[#252e3e]/60 text-slate-500 dark:text-slate-400 text-[10px] font-extrabold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700/80">
                  <tr>
                    <th className="py-2.5 px-3">Company & GR</th>
                    <th className="py-2.5 px-3">Purpose</th>
                    <th className="py-2.5 px-3">Vehicle No</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Driver</th>
                    <th className="py-2.5 px-3">Transporter</th>
                    <th className="py-2.5 px-3">Route</th>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Remarks</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                  {displayedSecurityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-slate-400 font-medium">
                        No security gate movements recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    displayedSecurityLogs.map((item) => {
                      const isAil = (item.unit || '').includes('AIL') || (!item.unit && Number(item.grNo) < 703 && Number(item.grNo) >= 616);
                      const isAhpl = (item.unit || '').includes('AHPL') || (!item.unit && Number(item.grNo) >= 703);
                      const displayUnit = isAil ? 'AIL' : isAhpl ? 'AHPL' : (item.unit || '-');

                      return (
                        <tr key={item.id} className="hover:bg-blue-50/40 dark:hover:bg-[#252e3e]/50 transition-colors">
                          
                          {/* Company & GR No */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              {displayUnit !== '-' && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                    displayUnit === 'AIL'
                                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                      : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                  }`}
                                >
                                  {displayUnit}
                                </span>
                              )}
                              {item.grNo ? (
                                <span className="font-mono font-black text-slate-900 dark:text-slate-100">
                                  #{item.grNo}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </td>

                          {/* Purpose */}
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.purpose === 'Loading'
                                  ? 'bg-amber-100/80 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                  : item.purpose === 'Unloading'
                                  ? 'bg-blue-100/80 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                                  : 'bg-slate-100 dark:bg-[#2d3748] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {item.purpose}
                            </span>
                          </td>

                          {/* Vehicle No */}
                          <td className="py-2 px-3 font-mono font-black text-blue-600 dark:text-blue-400">
                            {item.vehicle}
                          </td>

                          {/* Vehicle Type */}
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {item.vType || '32SXL'}
                          </td>

                          {/* Driver Mobile */}
                          <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">
                            {item.mobile}
                          </td>

                          {/* Transporter */}
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {item.transporter}
                          </td>

                          {/* Route */}
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                            <span className="font-semibold">{item.fromLoc}</span> &rarr; <span className="font-semibold">{item.toLoc}</span>
                          </td>

                          {/* Date & Time */}
                          <td className="py-2 px-3 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                            {item.dateTime}
                          </td>

                          {/* Remarks */}
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300 max-w-[140px] truncate" title={item.remarks}>
                            {item.remarks || '-'}
                          </td>

                          {/* Action */}
                          <td className="py-2 px-3 text-center space-x-1.5">
                            <button
                              onClick={() => onEditGateEntry(item)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-slate-700"
                              title="Edit Record"
                            >
                              <Pencil className="w-3.5 h-3.5 inline" />
                            </button>
                            <button
                              onClick={() => onDeleteGateEntry(item.id)}
                              className="text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 p-1 rounded hover:bg-rose-50 dark:hover:bg-slate-700"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
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
        </div>
      </div>
    </div>
  );
};
