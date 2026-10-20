import React, { useState, useMemo } from 'react';
import {
  Zap,
  Clock,
  User,
  MapPin,
  Plus,
  Trash2,
  RotateCcw,
  Calculator,
  CheckCircle2,
  Truck,
  ArrowRight,
  Shield,
  Layers,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';
import { SecurityGateEntry } from '../types';
import { DOCK_CONFIG } from '../data/defaultData';

export interface BulkDestItem {
  id: string;
  location: string;
  unit: string;
  cases: number | '';
}

export function calculateDurationText(startTime?: string, endTime?: string): string {
  if (!startTime || !endTime) return '-- In Progress --';
  const parseMins = (t: string) => {
    const parts = t.split(':').map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    return null;
  };
  const s = parseMins(startTime);
  const e = parseMins(endTime);
  if (s === null || e === null) return '-- In Progress --';
  let diff = e - s;
  if (diff < 0) diff += 24 * 60; // crossed midnight
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

interface SupervisorBulkCourierFormProps {
  vehicleNo: string;
  setVehicleNo: (v: string) => void;
  isVehicleLocked: boolean;
  selectedGateId: string;
  opType: 'LOADING' | 'UNLOADING';
  unit: string;
  setUnit: (v: string) => void;
  bayNo: string;
  setBayNo: (v: string) => void;
  transporter: string;
  setTransporter: (v: string) => void;
  vType: string;
  setVType: (v: string) => void;
  sealNumber: string;
  setSealNumber: (v: string) => void;
  entryDate: string;
  supervisors: string[];
  transporters: string[];
  loadLocations: string[];
  unloadLocations: string[];
  occupiedDocks: Map<string, string>;
  bulkDestinations: BulkDestItem[];
  setBulkDestinations: React.Dispatch<React.SetStateAction<BulkDestItem[]>>;
  masterStartTime: string;
  setMasterStartTime: (v: string) => void;
  masterEndTime: string;
  setMasterEndTime: (v: string) => void;
  masterOperator: string;
  setMasterOperator: (v: string) => void;
  onBulkSubmit: (e: React.FormEvent) => Promise<void>;
  onSwitchToSingle: () => void;
  pendingGateLogs: SecurityGateEntry[];
  handleGateSelect: (gateId: string) => void;
}

export const SupervisorBulkCourierForm: React.FC<SupervisorBulkCourierFormProps> = ({
  vehicleNo,
  setVehicleNo,
  isVehicleLocked,
  selectedGateId,
  opType,
  unit,
  setUnit,
  bayNo,
  setBayNo,
  transporter,
  setTransporter,
  vType,
  setVType,
  sealNumber,
  setSealNumber,
  entryDate,
  supervisors,
  transporters,
  loadLocations,
  unloadLocations,
  occupiedDocks,
  bulkDestinations,
  setBulkDestinations,
  masterStartTime,
  setMasterStartTime,
  masterEndTime,
  setMasterEndTime,
  masterOperator,
  setMasterOperator,
  onBulkSubmit,
  onSwitchToSingle,
  pendingGateLogs,
  handleGateSelect
}) => {
  // Carton distribution inputs
  const [totalCasesInput, setTotalCasesInput] = useState<string>('');
  const [perStopCasesInput, setPerStopCasesInput] = useState<string>('');

  // Add extra custom stop
  const [newStopLocation, setNewStopLocation] = useState<string>('');
  const [newStopUnit, setNewStopUnit] = useState<string>('AHPL');

  const totalCalculatedCases = useMemo(() => {
    return bulkDestinations.reduce((acc, curr) => acc + (Number(curr.cases) || 0), 0);
  }, [bulkDestinations]);

  const durationText = useMemo(() => {
    return calculateDurationText(masterStartTime, masterEndTime);
  }, [masterStartTime, masterEndTime]);

  // Handler: Distribute total evenly
  const handleDistributeEvenly = () => {
    const total = Number(totalCasesInput);
    if (!total || total <= 0 || bulkDestinations.length === 0) return;
    const count = bulkDestinations.length;
    const base = Math.floor(total / count);
    let remainder = total % count;
    const updated = bulkDestinations.map(() => {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder--;
      return base + extra;
    });
    setBulkDestinations(prev =>
      prev.map((d, i) => ({ ...d, cases: updated[i] || 0 }))
    );
  };

  // Handler: Set uniform count across all stops
  const handleSetAllStops = () => {
    const per = Number(perStopCasesInput);
    if (isNaN(per) || per < 0 || bulkDestinations.length === 0) return;
    setBulkDestinations(prev => prev.map(d => ({ ...d, cases: per })));
    setTotalCasesInput(String(per * bulkDestinations.length));
  };

  // Handler: Clear all cartons
  const handleClearCases = () => {
    setBulkDestinations(prev => prev.map(d => ({ ...d, cases: '' })));
    setTotalCasesInput('');
    setPerStopCasesInput('');
  };

  // Handler: Add custom stop
  const handleAddStop = () => {
    const loc = newStopLocation.trim().toUpperCase();
    if (!loc) return;
    const newItem: BulkDestItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      location: loc,
      unit: newStopUnit || 'AHPL',
      cases: ''
    };
    setBulkDestinations(prev => [...prev, newItem]);
    setNewStopLocation('');
  };

  // Handler: Remove stop
  const handleRemoveStop = (id: string) => {
    setBulkDestinations(prev => prev.filter(d => d.id !== id));
  };

  // Quick now for start time
  const handleNowStartTime = () => {
    setMasterStartTime(new Date().toTimeString().substring(0, 5));
  };

  // Quick now for out time
  const handleNowEndTime = () => {
    setMasterEndTime(new Date().toTimeString().substring(0, 5));
  };

  const isUnloading = opType === 'UNLOADING';

  return (
    <form onSubmit={onBulkSubmit} className="space-y-5">
      {/* Banner indicating Courier Bulk Mode */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-4 rounded-xl border border-indigo-700/50 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/40 text-amber-300">
              <Zap className="w-5 h-5 fill-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm uppercase tracking-wide">
                  Air &amp; Rail Courier Bulk Submit Form
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-500/40 border border-indigo-400/40 text-amber-200">
                  {opType}
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Single master entry for Start Time, Out Time, and Supervisor with granular destination reporting.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSwitchToSingle}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition self-start sm:self-auto cursor-pointer"
          >
            Switch to Single Mode
          </button>
        </div>
      </div>

      {/* Select Vehicle from Waiting Queue */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Select Arrived Vehicle from Gate Queue</span>
          </label>
          <span className="text-[10px] text-slate-500 font-semibold">
            {pendingGateLogs.length} vehicles waiting
          </span>
        </div>
        <select
          value={selectedGateId}
          onChange={(e) => handleGateSelect(e.target.value)}
          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">-- Choose Arrived Vehicle or Enter Below --</option>
          {pendingGateLogs.map((log) => {
            const stopsCount = (log.milkRouteDestinations?.length || 0) + ((log as any).multiDestinations?.length || 0);
            return (
              <option key={log.id} value={log.id}>
                {log.vehicle} • {log.transporter || 'N/A'} • {log.purpose?.toUpperCase()} {stopsCount > 1 ? `(${stopsCount} Stops)` : `(${log.destination || 'Indore'})`}
              </option>
            );
          })}
        </select>
      </div>

      {/* MASTER FIELDS SECTION (Single Entry for All Destinations) */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border-2 border-indigo-200 dark:border-indigo-900/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/50 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
              <Shield className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                Master Operational Details (Applies to All Stops)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Supervisor and Time entries apply uniformly across every line item in this shipment.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200">
            Master Sync Active
          </span>
        </div>

        {/* Row 1: Activity, Supervisor, Dock */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Operation Activity (Strictly Gate Value) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Operation Activity (From Gate)
            </label>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-black text-xs ${
              isUnloading
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
            }`}>
              {isUnloading ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
              <span>{opType}</span>
            </div>
          </div>

          {/* Master Supervisor Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>Master Supervisor Name</span>
              </span>
              <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold">Single for all</span>
            </label>
            <select
              value={masterOperator}
              onChange={(e) => setMasterOperator(e.target.value)}
              required
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {supervisors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Master Assigned Dock */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Assigned Dock
            </label>
            <select
              value={bayNo}
              onChange={(e) => setBayNo(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {(DOCK_CONFIG[unit] || DOCK_CONFIG['AHPL']).map((dock) => {
                const occ = occupiedDocks.get(dock);
                return (
                  <option key={dock} value={dock}>
                    {dock} {occ ? `(⚠️ ${occ})` : '(Available)'}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Row 2: Master Start Time, Out Time, and Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          {/* Master Start Time */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Single Start Time</span>
              </span>
              <button
                type="button"
                onClick={handleNowStartTime}
                className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer"
              >
                Now
              </button>
            </label>
            <input
              type="text"
              value={masterStartTime}
              onChange={(e) => setMasterStartTime(e.target.value)}
              placeholder="HH:MM"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
          </div>

          {/* Master Out / Exit Time */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Single Out Time</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleNowEndTime}
                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
                >
                  Now
                </button>
                {masterEndTime && (
                  <button
                    type="button"
                    onClick={() => setMasterEndTime('')}
                    className="text-[10px] text-rose-500 font-bold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </label>
            <input
              type="text"
              value={masterEndTime}
              onChange={(e) => setMasterEndTime(e.target.value)}
              placeholder="HH:MM (Optional)"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* TAT / Status Output */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Calculated Status / TAT
            </label>
            <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs">
              <div className="font-mono font-black text-slate-800 dark:text-slate-200">
                {durationText}
              </div>
              <div className="text-[10px] font-semibold text-slate-500">
                {masterEndTime ? (isUnloading ? 'Marked UNLOADED' : 'Marked LOADED') : 'Marked IN-PROGRESS'}
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Vehicle No, Transporter, Seal No */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Vehicle Number
            </label>
            <input
              type="text"
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
              readOnly={isVehicleLocked}
              placeholder="e.g. MP09GH1234"
              className={`w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-black text-slate-900 dark:text-white outline-none ${
                isVehicleLocked ? 'bg-slate-100 dark:bg-slate-900 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500'
              }`}
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Transporter / Courier
            </label>
            <select
              value={transporter}
              onChange={(e) => setTransporter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {transporters.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Seal Number (Optional)
            </label>
            <input
              type="text"
              value={sealNumber}
              onChange={(e) => setSealNumber(e.target.value.toUpperCase())}
              placeholder="e.g. SL-88921"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* CARTON DISTRIBUTION & DESTINATIONS LIST */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        {/* Header with live totals */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Destination Breakdown &amp; Carton Allocation</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Each stop will generate a separate entry in the database and reports with its specified cartons.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
              {bulkDestinations.length} Stops
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 font-mono">
              Total: {totalCalculatedCases.toLocaleString()} Cartons
            </span>
          </div>
        </div>

        {/* Quick Carton Distribution Tools */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5 text-indigo-600" />
            <span>Fast Carton Distribution Tools</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tool 1: Total Distribute Evenly */}
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={totalCasesInput}
                onChange={(e) => setTotalCasesInput(e.target.value)}
                placeholder="Total Shipment Boxes"
                className="w-32 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleDistributeEvenly}
                disabled={bulkDestinations.length === 0}
                className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Distribute Evenly
              </button>
            </div>

            {/* Tool 2: Set Same Count */}
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={perStopCasesInput}
                onChange={(e) => setPerStopCasesInput(e.target.value)}
                placeholder="Per-Stop Boxes"
                className="w-28 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleSetAllStops}
                disabled={bulkDestinations.length === 0}
                className="flex-1 py-1.5 px-3 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Set All Stops
              </button>
              <button
                type="button"
                onClick={handleClearCases}
                title="Reset Carton Counts"
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-rose-600 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Table of Destinations */}
        {bulkDestinations.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <MapPin className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
              No destinations currently loaded.
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Select an arrived vehicle above or add stops manually below.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Destination / Route Stop</th>
                  <th className="py-2.5 px-3 w-28">Division</th>
                  <th className="py-2.5 px-3 w-40">Carton Quantity</th>
                  <th className="py-2.5 px-3 w-14 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bulkDestinations.map((dest, idx) => (
                  <tr key={dest.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                          {dest.location}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={dest.unit}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBulkDestinations(prev =>
                            prev.map(d => (d.id === dest.id ? { ...d, unit: val } : d))
                          );
                        }}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300"
                      >
                        <option value="AHPL">AHPL</option>
                        <option value="AIL">AIL</option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={dest.cases}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setBulkDestinations(prev =>
                              prev.map(d => (d.id === dest.id ? { ...d, cases: val } : d))
                            );
                          }}
                          placeholder="Boxes"
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] text-slate-400 font-semibold">ctn</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveStop(dest.id)}
                        title="Remove this destination stop"
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Extra Destination Toolbar */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          <input
            type="text"
            value={newStopLocation}
            onChange={(e) => setNewStopLocation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddStop();
              }
            }}
            placeholder="Add another stop location (e.g. GUWAHATI HUB)..."
            className="w-full sm:flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <select
            value={newStopUnit}
            onChange={(e) => setNewStopUnit(e.target.value)}
            className="w-full sm:w-28 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white outline-none"
          >
            <option value="AHPL">AHPL</option>
            <option value="AIL">AIL</option>
          </select>
          <button
            type="button"
            onClick={handleAddStop}
            className="w-full sm:w-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stop</span>
          </button>
        </div>
      </div>

      {/* Summary Footer & Primary Bulk Submit Action */}
      <div className="space-y-3 pt-2">
        <button
          type="submit"
          disabled={bulkDestinations.length === 0 || !vehicleNo.trim()}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 text-white text-sm font-black uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer transition"
        >
          <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
          <span>
            Bulk Submit All ({bulkDestinations.length} Destinations) • {totalCalculatedCases.toLocaleString()} Cartons
          </span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>

        <p className="text-center text-[11px] text-slate-400 font-medium">
          Note: This will save {bulkDestinations.length} distinct operations sharing the Master Start/Out times and Supervisor, with accurate individual line-items visible in Reports.
        </p>
      </div>
    </form>
  );
};
