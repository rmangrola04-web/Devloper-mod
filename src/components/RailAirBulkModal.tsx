import React, { useState, useEffect } from 'react';
import {
  X,
  Train,
  Plane,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  MapPin,
  Building,
  User,
  Package,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Sliders,
  CheckSquare,
  Square
} from 'lucide-react';
import { SecurityGateEntry, LoadUnloadEntry } from '../types';
import { DOCK_CONFIG } from '../data/defaultData';
import { getGateTargetLocations } from '../utils/queueSync';

export interface BulkLocationRow {
  id: string;
  location: string;
  unit: string;
  bayNo: string;
  operator: string;
  totalCases: number | string;
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'LOADING IN-PROGRESS' | 'UNLOADING IN-PROGRESS' | 'LOADED' | 'UNLOADED';
  sealNo: string;
  damagedCases: number | string;
  remarks: string;
  isSelected: boolean;
  isExistingOp: boolean;
}

interface RailAirBulkModalProps {
  isOpen: boolean;
  gateEntry: SecurityGateEntry | null;
  loadEntries: LoadUnloadEntry[];
  onClose: () => void;
  onSaveBatch: (batchEntries: LoadUnloadEntry[]) => Promise<void> | void;
  supervisors?: string[];
  transporters?: string[];
}

export const RailAirBulkModal: React.FC<RailAirBulkModalProps> = ({
  isOpen,
  gateEntry,
  loadEntries,
  onClose,
  onSaveBatch,
  supervisors = ['Supervisor A', 'Supervisor B', 'Supervisor C'],
}) => {
  const [rows, setRows] = useState<BulkLocationRow[]>([]);
  const [batchDock, setBatchDock] = useState<string>('D-01');
  const [batchOperator, setBatchOperator] = useState<string>(supervisors[0] || 'Supervisor A');
  const [batchStatus, setBatchStatus] = useState<'LOADING IN-PROGRESS' | 'LOADED'>('LOADED');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const getCurrentTimeString = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!gateEntry) return;

    const allTargets = getGateTargetLocations(gateEntry);
    const nowTime = getCurrentTimeString();
    const isUnload = gateEntry.purpose === 'Unloading';

    // Find existing operations for this vehicle / gateId
    const vehNorm = (gateEntry.vehicle || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const relatedOps = loadEntries.filter((op) => {
      const gateMatch = Boolean(op.gateId && op.gateId === gateEntry.id);
      const vehClean = (op.vehicleNo || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const vehMatch = Boolean(vehNorm && vehClean && vehNorm === vehClean);
      return gateMatch || vehMatch;
    });

    const initializedRows: BulkLocationRow[] = allTargets.map((target, idx) => {
      const targetLocUpper = target.location.trim().toUpperCase();
      const existingOp = relatedOps.find((op) => {
        const opLocs = [op.toLoc, op.fromLoc, op.dest1, op.dest2]
          .filter(Boolean)
          .map((s) => s!.trim().toUpperCase());
        return opLocs.some((l) => l === targetLocUpper || l.includes(targetLocUpper) || targetLocUpper.includes(l));
      });

      if (existingOp) {
        return {
          id: existingOp.id,
          location: target.location,
          unit: existingOp.unit || target.unit || gateEntry.unit || 'AHPL',
          bayNo: existingOp.bayNo || existingOp.assignedDock || 'D-01',
          operator: existingOp.operator || supervisors[0] || 'Supervisor A',
          totalCases: existingOp.totalCases || '',
          startTime: existingOp.startTime || nowTime,
          endTime: existingOp.endTime || nowTime,
          status: existingOp.status as any || (isUnload ? 'UNLOADED' : 'LOADED'),
          sealNo: existingOp.sealNo || '',
          damagedCases: existingOp.damagedCases || '',
          remarks: existingOp.remarks || '',
          isSelected: true,
          isExistingOp: true
        };
      }

      return {
        id: `OP-RAILAIR-${Date.now()}-${idx + 1}`,
        location: target.location,
        unit: target.unit || gateEntry.unit || 'AHPL',
        bayNo: gateEntry.assignedDock && gateEntry.assignedDock !== 'Unassigned' ? gateEntry.assignedDock : 'D-01',
        operator: supervisors[0] || 'Supervisor A',
        totalCases: '',
        startTime: nowTime,
        endTime: nowTime,
        status: isUnload ? 'UNLOADED' : 'LOADED',
        sealNo: '',
        damagedCases: '',
        remarks: '',
        isSelected: true,
        isExistingOp: false
      };
    });

    setRows(initializedRows);
  }, [gateEntry, loadEntries, supervisors]);

  if (!isOpen || !gateEntry) return null;

  const isAir = (gateEntry.vType || '').toUpperCase().includes('AIR') || (gateEntry.transporter || '').toUpperCase().includes('AIR');
  const isUnload = gateEntry.purpose === 'Unloading';
  const defaultUnit = gateEntry.unit || 'AHPL';
  const availableDocks = DOCK_CONFIG[defaultUnit] || DOCK_CONFIG['AHPL'];

  const handleRowChange = (index: number, field: keyof BulkLocationRow, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, isSelected: checked })));
  };

  const applyBatchDock = () => {
    setRows((prev) =>
      prev.map((r) => (r.isSelected ? { ...r, bayNo: batchDock } : r))
    );
    showToast(`Applied Dock "${batchDock}" to selected locations.`);
  };

  const applyBatchOperator = () => {
    setRows((prev) =>
      prev.map((r) => (r.isSelected ? { ...r, operator: batchOperator } : r))
    );
    showToast(`Applied Operator "${batchOperator}" to selected locations.`);
  };

  const applyBatchStatus = () => {
    setRows((prev) =>
      prev.map((r) => (r.isSelected ? { ...r, status: batchStatus } : r))
    );
    showToast(`Marked selected locations as ${batchStatus}.`);
  };

  const applyBatchCurrentTime = () => {
    const now = getCurrentTimeString();
    setRows((prev) =>
      prev.map((r) => (r.isSelected ? { ...r, startTime: now, endTime: now } : r))
    );
    showToast(`Updated Start/End times to ${now} for selected locations.`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSubmitAll = async () => {
    const selectedRows = rows.filter((r) => r.isSelected);
    if (selectedRows.length === 0) {
      alert('Please select at least one location line item to save.');
      return;
    }

    setIsSubmitting(true);
    try {
      const batchEntries: LoadUnloadEntry[] = selectedRows.map((r) => {
        const opType: 'LOADING' | 'UNLOADING' = isUnload ? 'UNLOADING' : 'LOADING';
        const fromLoc = isUnload ? r.location : 'INDORE HUB';
        const toLoc = isUnload ? 'INDORE HUB' : r.location;

        let duration = '0h 30m';
        if (r.startTime && r.endTime) {
          const sParts = r.startTime.split(':');
          const eParts = r.endTime.split(':');
          if (sParts.length === 2 && eParts.length === 2) {
            let diff = (parseInt(eParts[0]) * 60 + parseInt(eParts[1])) - (parseInt(sParts[0]) * 60 + parseInt(sParts[1]));
            if (diff < 0) diff += 1440;
            duration = `${Math.floor(diff / 60)}h ${diff % 60}m`;
          }
        }

        return {
          id: r.id,
          gateId: gateEntry.id,
          opType,
          unit: r.unit || defaultUnit,
          bayNo: r.bayNo || 'D-01',
          assignedDock: r.bayNo || 'D-01',
          vehicleNo: gateEntry.vehicle,
          vType: gateEntry.vType,
          fromLoc,
          toLoc,
          transporter: gateEntry.transporter || 'N/A',
          operator: r.operator || supervisors[0] || 'Supervisor A',
          startTime: r.startTime,
          endTime: r.endTime,
          duration,
          status: r.status,
          totalCases: r.totalCases || 0,
          sealNo: r.sealNo || '',
          damagedCases: r.damagedCases || '',
          remarks: r.remarks || gateEntry.remarks || '',
          entryDate: gateEntry.entryDate || new Date().toISOString().split('T')[0]
        };
      });

      await onSaveBatch(batchEntries);
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error('Error submitting batch multi-drop entries:', err);
      setIsSubmitting(false);
      alert('Failed to save batch entries. Please try again.');
    }
  };

  const selectedCount = rows.filter((r) => r.isSelected).length;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[92vh] my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-amber-300 border border-white/20">
              {isAir ? <Plane className="w-6 h-6 animate-pulse" /> : <Train className="w-6 h-6 animate-pulse" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                  {isAir ? 'AIR SHIPMENT' : 'RAIL SHIPMENT'} BULK GRID
                </span>
                <span className="text-xs text-blue-200 font-medium">
                  Multi-Drop Batch Supervisor Entry
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
                <span>{gateEntry.vehicle}</span>
                <span className="text-sm font-normal text-blue-200">({gateEntry.transporter})</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-4 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 text-xs text-blue-100">
              <div>
                <span className="text-blue-300 font-bold block text-[10px] uppercase">Gate In</span>
                <span className="font-mono font-bold">{gateEntry.dateTime}</span>
              </div>
              <div className="h-6 w-px bg-white/20" />
              <div>
                <span className="text-blue-300 font-bold block text-[10px] uppercase">Total Stops</span>
                <span className="font-bold text-amber-300">{rows.length} Cities</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-between shrink-0 animate-in slide-in-from-top duration-200">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {toastMessage}
            </span>
            <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Batch Quick Action Bar */}
        <div className="bg-slate-100 dark:bg-slate-900/80 p-3 border-b border-slate-200 dark:border-slate-700 shrink-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectAll(rows.some((r) => !r.isSelected))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
              >
                {rows.every((r) => r.isSelected) ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Select All ({selectedCount}/{rows.length})</span>
              </button>
            </div>

            {/* Quick Fill Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-300 dark:border-slate-600">
                <select
                  value={batchDock}
                  onChange={(e) => setBatchDock(e.target.value)}
                  className="text-xs font-bold bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none px-1"
                >
                  {availableDocks.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={applyBatchDock}
                  className="px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-bold hover:bg-blue-700 cursor-pointer"
                >
                  Apply Dock
                </button>
              </div>

              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-300 dark:border-slate-600">
                <select
                  value={batchOperator}
                  onChange={(e) => setBatchOperator(e.target.value)}
                  className="text-xs font-bold bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none px-1"
                >
                  {supervisors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={applyBatchOperator}
                  className="px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-bold hover:bg-blue-700 cursor-pointer"
                >
                  Apply Operator
                </button>
              </div>

              <button
                type="button"
                onClick={applyBatchCurrentTime}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-900 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>Now All</span>
              </button>

              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-300 dark:border-slate-600">
                <select
                  value={batchStatus}
                  onChange={(e) => setBatchStatus(e.target.value as any)}
                  className="text-xs font-bold bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none px-1"
                >
                  <option value="LOADED">{isUnload ? 'UNLOADED' : 'LOADED'}</option>
                  <option value="LOADING IN-PROGRESS">{isUnload ? 'UNLOADING IN-PROGRESS' : 'LOADING IN-PROGRESS'}</option>
                </select>
                <button
                  type="button"
                  onClick={applyBatchStatus}
                  className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold hover:bg-emerald-700 cursor-pointer"
                >
                  Mark Selected
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid View */}
        <div className="overflow-x-auto overflow-y-auto flex-1 p-3 sm:p-4 space-y-3">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider font-extrabold border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                <th className="p-2.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every((r) => r.isSelected)}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="p-2.5 w-12 text-center">Stop</th>
                <th className="p-2.5 min-w-[140px]">Destination City</th>
                <th className="p-2.5 min-w-[100px]">Unit</th>
                <th className="p-2.5 min-w-[130px]">Dock / Bay</th>
                <th className="p-2.5 min-w-[130px]">Operator</th>
                <th className="p-2.5 min-w-[100px]">Cartons / Cases</th>
                <th className="p-2.5 min-w-[100px]">Start Time</th>
                <th className="p-2.5 min-w-[100px]">End Time</th>
                <th className="p-2.5 min-w-[130px]">Status</th>
                <th className="p-2.5 min-w-[110px]">Seal No</th>
                <th className="p-2.5 min-w-[120px]">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60 text-xs font-medium">
              {rows.map((row, idx) => (
                <tr
                  key={row.location + idx}
                  className={`transition-colors ${
                    row.isSelected
                      ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70'
                      : 'opacity-60 bg-slate-50/30 dark:bg-slate-900/20'
                  }`}
                >
                  {/* Select Checkbox */}
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.isSelected}
                      onChange={(e) => handleRowChange(idx, 'isSelected', e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                  </td>

                  {/* Stop Number */}
                  <td className="p-2 text-center font-bold font-mono text-slate-500">
                    #{idx + 1}
                  </td>

                  {/* Destination City */}
                  <td className="p-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>{row.location}</span>
                    </div>
                  </td>

                  {/* Unit Selection */}
                  <td className="p-2">
                    <select
                      value={row.unit}
                      onChange={(e) => handleRowChange(idx, 'unit', e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 font-bold text-slate-800 dark:text-slate-100"
                    >
                      <option value="AHPL">AHPL</option>
                      <option value="AIL">AIL</option>
                    </select>
                  </td>

                  {/* Dock / Bay */}
                  <td className="p-2">
                    <select
                      value={row.bayNo}
                      onChange={(e) => handleRowChange(idx, 'bayNo', e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 font-bold text-blue-600 dark:text-blue-400"
                    >
                      {availableDocks.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Operator */}
                  <td className="p-2">
                    <select
                      value={row.operator}
                      onChange={(e) => handleRowChange(idx, 'operator', e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 font-semibold text-slate-800 dark:text-slate-200"
                    >
                      {supervisors.map((sup) => (
                        <option key={sup} value={sup}>
                          {sup}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Total Cases / Cartons */}
                  <td className="p-2">
                    <input
                      type="number"
                      value={row.totalCases}
                      onChange={(e) => handleRowChange(idx, 'totalCases', e.target.value)}
                      placeholder="e.g. 250"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 font-bold font-mono text-slate-900 dark:text-slate-100 text-center"
                    />
                  </td>

                  {/* Start Time */}
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="time"
                        value={row.startTime}
                        onChange={(e) => handleRowChange(idx, 'startTime', e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 font-mono font-bold text-xs"
                      />
                    </div>
                  </td>

                  {/* End Time */}
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="time"
                        value={row.endTime}
                        onChange={(e) => handleRowChange(idx, 'endTime', e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 font-mono font-bold text-xs"
                      />
                    </div>
                  </td>

                  {/* Status */}
                  <td className="p-2">
                    <select
                      value={row.status}
                      onChange={(e) => handleRowChange(idx, 'status', e.target.value)}
                      className={`w-full border rounded p-1.5 font-bold text-xs ${
                        row.status === 'LOADED' || row.status === 'UNLOADED'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-700 dark:text-emerald-400'
                          : row.status.includes('IN-PROGRESS')
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-700 dark:text-amber-400'
                          : 'bg-white dark:bg-slate-800 border-slate-300 text-slate-700'
                      }`}
                    >
                      <option value={isUnload ? 'UNLOADED' : 'LOADED'}>{isUnload ? 'UNLOADED' : 'LOADED'}</option>
                      <option value={isUnload ? 'UNLOADING IN-PROGRESS' : 'LOADING IN-PROGRESS'}>
                        {isUnload ? 'UNLOADING IN-PROGRESS' : 'LOADING IN-PROGRESS'}
                      </option>
                      <option value="PENDING">PENDING</option>
                    </select>
                  </td>

                  {/* Seal No */}
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.sealNo}
                      onChange={(e) => handleRowChange(idx, 'sealNo', e.target.value)}
                      placeholder="SEAL-123"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-xs font-mono"
                    />
                  </td>

                  {/* Remarks */}
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.remarks}
                      onChange={(e) => handleRowChange(idx, 'remarks', e.target.value)}
                      placeholder="Optional notes"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-xs"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary & Submit */}
        <div className="bg-slate-100 dark:bg-slate-900 p-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {selectedCount} of {rows.length} location line items selected for submission.
            </span>
            <span className="block text-[11px] text-slate-500">
              Submitting will process these locations together under Vehicle <strong className="text-blue-600 dark:text-blue-400">{gateEntry.vehicle}</strong>.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmitAll}
              disabled={isSubmitting || selectedCount === 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'PROCESSING BATCH...' : `SUBMIT ALL ${selectedCount} LOCATIONS`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
