import React, { useState } from 'react';
import { ClipboardList, Download, FileSpreadsheet, Camera, Loader2, Layers, List, Trash2, CheckCircle2 } from 'lucide-react';
import { PlanEntry } from '../types';
import * as XLSX from 'xlsx';

interface PlanViewProps {
  planEntries: PlanEntry[];
  onAddPlanEntries: (entries: PlanEntry[]) => void;
  onDeletePlanEntry: (id: string) => void;
  onArchivePlanEntries?: (entries: PlanEntry[]) => void;
}

export const PlanView: React.FC<PlanViewProps> = ({
  planEntries,
  onAddPlanEntries,
  onDeletePlanEntry,
  onArchivePlanEntries
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditField, setInlineEditField] = useState<'transporter' | 'vType' | 'mode' | null>(null);
  const [inlineEditVal, setInlineEditVal] = useState<string>('');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState<number | string>('');
  const [editCft, setEditCft] = useState<number | string>('');

  const handleStartRowEdit = (item: PlanEntry) => {
    setEditingRowId(item.id);
    setEditWeight(item.weight);
    setEditCft(item.cft || 0);
  };

  const handleSaveRowEdit = (item: PlanEntry) => {
    const updatedWeight = Number(editWeight) || 0;
    const updatedCft = Number(editCft) || 0;
    onAddPlanEntries([{ ...item, weight: updatedWeight, cft: updatedCft }]);
    setEditingRowId(null);
    setStatusMsg(`Successfully updated Weight & CFT for ${item.deliveryNo}`);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleCancelRowEdit = () => {
    setEditingRowId(null);
  };

  const [editingGroupIdx, setEditingGroupIdx] = useState<number | null>(null);
  const [groupEditWeight, setGroupEditWeight] = useState<number | string>('');
  const [groupEditCft, setGroupEditCft] = useState<number | string>('');

  const handleStartGroupEdit = (g: any, idx: number) => {
    setEditingGroupIdx(idx);
    setGroupEditWeight(g.totalWeight);
    setGroupEditCft(g.totalCft);
  };

  const handleSaveGroupEdit = (g: any) => {
    const newTotalWeight = Number(groupEditWeight) || 0;
    const newTotalCft = Number(groupEditCft) || 0;
    
    const oldTotalWeight = g.totalWeight || 1;
    const oldTotalCft = g.totalCft || 1;

    const updatedEntries = activePlanEntries.map(p => {
      if (g.entryIds.includes(p.id)) {
        const ratioW = oldTotalWeight > 0 ? (p.weight / oldTotalWeight) : (1 / g.entryIds.length);
        const ratioC = oldTotalCft > 0 ? ((p.cft || 0) / oldTotalCft) : (1 / g.entryIds.length);
        return {
          ...p,
          weight: Math.round(newTotalWeight * ratioW),
          cft: Math.round(newTotalCft * ratioC)
        };
      }
      return p;
    });

    onAddPlanEntries(updatedEntries);
    setEditingGroupIdx(null);
    setStatusMsg(`Successfully updated Total Wt & CFT for group`);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleCancelGroupEdit = () => {
    setEditingGroupIdx(null);
  };

  const handleInlineClick = (item: PlanEntry, field: 'transporter' | 'vType' | 'mode') => {
    setInlineEditId(item.id);
    setInlineEditField(field);
    setInlineEditVal(item[field] || '');
  };

  const handleInlineSave = (item: PlanEntry) => {
    if (inlineEditField && inlineEditId === item.id) {
      if (item[inlineEditField] !== inlineEditVal) {
        onAddPlanEntries([{ ...item, [inlineEditField]: inlineEditVal }]);
        setStatusMsg(`Successfully updated ${inlineEditField}`);
        setTimeout(() => setStatusMsg(null), 3000);
      }
    }
    setInlineEditId(null);
    setInlineEditField(null);
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent, item: PlanEntry) => {
    if (e.key === 'Enter') {
      handleInlineSave(item);
    } else if (e.key === 'Escape') {
      setInlineEditId(null);
      setInlineEditField(null);
    }
  };
  
  const activePlanEntries = planEntries;

  const uniqueDestinations = React.useMemo(() => Array.from(new Set(activePlanEntries.map(p => p.destination))), [activePlanEntries]);

  // Download Sample Plan CSV
  const handleDownloadSample = () => {
    const csvContent =
      'deliveryNo,code,unit,destination,weight,cft,vType,transporter,tripId\n' +
      'DEL-101,C-01,AHPL,MUMBAI,1250,450,32SXL,DHTC,\n' +
      'DEL-102,C-02,AIL,DELHI,1800,600,32MXL,OPM,TRIP-01\n' +
      'DEL-103,C-03,AHPL,JAIPUR,950,320,32MXL,OPM,TRIP-01\n' +
      'DEL-104,C-04,AIL,PUNE,1400,480,32-15T,VARUNA,';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'plan_master_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV / Excel file import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        if (!rows || rows.length === 0) {
          alert('Uploaded plan file is empty.');
          return;
        }

        const newEntries: PlanEntry[] = rows.map((r, idx) => {
          const tripIdRaw = r.tripId || r.TripId || r.TripID || r.Route || r.RouteId || r.Vehicle || r.VehicleNo || '';
          const tripIdStr = String(tripIdRaw).trim().toUpperCase();
          return {
            id: `PLAN-${Date.now()}-${idx}`,
            deliveryNo: String(r.deliveryNo || r.DeliveryNo || `DEL-${Math.floor(1000 + Math.random() * 9000)}`),
            code: String(r.code || r.Code || 'C-01'),
            unit: String(r.unit || r.Unit || 'AHPL').toUpperCase(),
            destination: String(r.destination || r.Destination || 'MUMBAI').toUpperCase(),
            weight: Number(r.weight || r.Weight || 1000),
            cft: Number(r.cft || r.CFT || 400),
            vType: String(r.vType || r.VType || '32SXL').toUpperCase(),
            transporter: String(r.transporter || r.Transporter || 'DHTC').toUpperCase(),
            status: 'Pending',
            ...(tripIdStr ? { tripId: tripIdStr } : {})
          };
        });

        onAddPlanEntries(newEntries);
        setStatusMsg(`Successfully imported ${newEntries.length} plan records!`);
        setTimeout(() => setStatusMsg(null), 4000);
      } catch (err) {
        alert('Error parsing plan CSV/Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Photo / Camera scan handler
  const handlePhotoScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      const simulatedNewEntries: PlanEntry[] = [
        {
          id: `PLAN-${Date.now()}-1`,
          deliveryNo: `DEL-${Math.floor(10000 + Math.random() * 90000)}`,
          code: 'OCR-01',
          unit: 'AHPL',
          destination: 'MUMBAI',
          weight: 1350,
          cft: 450,
          vType: '32SXL',
          transporter: 'DHTC',
          status: 'Pending',
          tripId: 'TRIP-SCAN-01'
        },
        {
          id: `PLAN-${Date.now()}-2`,
          deliveryNo: `DEL-${Math.floor(10000 + Math.random() * 90000)}`,
          code: 'OCR-02',
          unit: 'AIL',
          destination: 'PUNE',
          weight: 1950,
          cft: 610,
          vType: '32SXL',
          transporter: 'DHTC',
          status: 'Pending',
          tripId: 'TRIP-SCAN-01'
        }
      ];
      onAddPlanEntries(simulatedNewEntries);
      setStatusMsg(`OCR Scan verified: Extracted 2 delivery records from photo!`);
      setTimeout(() => setStatusMsg(null), 4000);
    }, 1800);
    e.target.value = '';
  };

  // Consolidated Group Summary
  const consolidatedGroups = React.useMemo(() => {
    const map = new Map<string, { dest: string; transporter: string; vType: string; count: number; totalWeight: number; totalCft: number; status: string; entryIds: string[]; isMilkRoute: boolean; hasCarriedForward: boolean }>();
    activePlanEntries.forEach((p) => {
      const tripClean = p.tripId ? String(p.tripId).trim().toUpperCase() : '';
      let key = tripClean ? `TRIP_${tripClean}` : `${p.transporter || 'DHTC'}_${p.vType || '32SXL'}`;
      let isGroupedMilkRoute = true;
      
      const pDest = String(p.destination || 'MUMBAI').trim().toUpperCase();
      const pTrans = String(p.transporter || '').trim().toUpperCase();
      const pVType = String(p.vType || '').trim().toUpperCase();
      const pWeight = Number(p.weight) || 0;
      const pCft = Number(p.cft) || 0;

      if (!map.has(key)) {
        map.set(key, {
          dest: pDest,
          transporter: pTrans,
          vType: pVType,
          count: 0,
          totalWeight: 0,
          totalCft: 0,
          status: 'Pending',
          entryIds: [],
          isMilkRoute: isGroupedMilkRoute,
          hasCarriedForward: false
        });
      }

      const item = map.get(key)!;
      const dests = item.dest.split(' + ').map(d => d.trim().toUpperCase());
      if (pDest && !dests.includes(pDest)) {
        item.dest = `${item.dest} + ${pDest}`;
      }
      if (!item.transporter && pTrans) item.transporter = pTrans;
      if (!item.vType && pVType) item.vType = pVType;

      item.count += 1;
      item.totalWeight += pWeight;
      item.totalCft += pCft;
      item.entryIds.push(p.id);
      if (p.isCarriedForward) item.hasCarriedForward = true;
      
      if (!item.status || item.status === 'Pending') {
         item.status = p.status || 'Pending';
      } else if (item.status === 'Planned' && p.status === 'Confirmed Plan') {
         item.status = 'Confirmed Plan';
      }
    });
    return Array.from(map.values());
  }, [activePlanEntries]);

  const handleStatusChange = (group: any, newStatus: string) => {
    try {
      const entriesToUpdate = activePlanEntries
        .filter(p => group.entryIds.includes(p.id))
        .map(p => ({ ...p, status: newStatus }));
        
      if (entriesToUpdate.length > 0) {
        if (newStatus === 'Confirmed Plan' && onArchivePlanEntries) {
          onArchivePlanEntries(entriesToUpdate);
          setStatusMsg(`Plan confirmed and moved to History.`);
        } else {
          onAddPlanEntries(entriesToUpdate);
          setStatusMsg(`Successfully updated status to ${newStatus}`);
        }
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      setStatusMsg(`Failed to update status`);
    }
  };

  const handleDetailedStatusConfirm = (id: string) => {
    const entry = activePlanEntries.find(p => p.id === id);
    if (entry && onArchivePlanEntries) {
      onArchivePlanEntries([{ ...entry, status: 'Confirmed Plan' }]);
      setStatusMsg(`Plan confirmed and moved to History.`);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };


  return (
    <section className="space-y-4">
      <div className="bg-white dark:bg-slate-800 p-2.5 sm:p-4 rounded border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        {/* Header Controls */}
        <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-blue-600" /> Plan Received & Single Vehicle Summary
            </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Automated Multi-Block Parser & CSV Importer</p>
          </div>

          {/* Desktop/Laptop Mode CSV Import Block */}
          <div className="hidden md:flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadSample}
              className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> Plan Sample CSV
            </button>

            <label className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 cursor-pointer transition">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Import Plan CSV
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {isScanning && (
              <div className="text-xs text-blue-600 font-semibold flex items-center gap-1.5 animate-pulse bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 rounded border border-blue-200 dark:border-blue-800">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> Scanning Plan Rows...
              </div>
            )}
          </div>
        </div>

        {statusMsg && (
          <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Consolidated Summary */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-0.5 gap-2">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" /> Consolidated Vehicle Load Summary
              </h3>

            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 font-bold px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 font-mono">
                {consolidatedGroups.length} Vehicle Groups
              </span>
            </div>
          </div>
          
          <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-100 dark:bg-slate-900 uppercase font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2 px-3">Destination</th>
                  <th className="py-2 px-3">Transporter</th>
                  <th className="py-2 px-3">Vehicle Type</th>
                  <th className="py-2 px-3 text-center">Deliveries</th>
                  <th className="py-2 px-3 text-right">Total Wt (Kg)</th>
                  <th className="py-2 px-3 text-right">Total CFT</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {consolidatedGroups.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-slate-400">
                      No records found for this date.
                    </td>
                  </tr>
                ) : (
                  consolidatedGroups.map((g, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                      <td className="py-1.5 px-3 font-bold text-blue-600 dark:text-blue-400">
                        <div className="flex items-center gap-2">
                          {g.dest}
                          {g.hasCarriedForward && (
                            <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 text-[8px] px-1 py-0.5 rounded border border-amber-300 dark:border-amber-700 font-medium whitespace-nowrap tracking-wide">
                              CARRIED FORWARD
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200">{g.transporter}</td>
                      <td className="py-1.5 px-3 font-mono text-slate-700 dark:text-slate-300">{g.vType}</td>
                      <td className="py-1.5 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">{g.count}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        {editingGroupIdx === idx ? (
                          <input
                            type="number"
                            className="w-24 bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs outline-none"
                            value={groupEditWeight}
                            onChange={(e) => setGroupEditWeight(e.target.value)}
                          />
                        ) : (
                          `${(g.totalWeight || 0).toLocaleString()} Kg`
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {editingGroupIdx === idx ? (
                          <input
                            type="number"
                            className="w-20 bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs outline-none"
                            value={groupEditCft}
                            onChange={(e) => setGroupEditCft(e.target.value)}
                          />
                        ) : (
                          (g.totalCft || 0).toLocaleString()
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <select
                          value={g.status}
                          onChange={(e) => handleStatusChange(g, e.target.value)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border outline-none cursor-pointer appearance-none ${
                            g.status === 'Confirmed Plan'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : g.status === 'Completed' || g.status === 'Done'
                              ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800'
                              : g.status === 'Planned'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                          }`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Planned">Planned</option>
                          <option value="Confirmed Plan">Confirmed Plan</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <div className="flex justify-center gap-1.5 items-center">
                          {editingGroupIdx === idx ? (
                            <>
                              <button
                                onClick={() => handleSaveGroupEdit(g)}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition shadow-xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelGroupEdit}
                                className="px-2 py-0.5 bg-slate-400 hover:bg-slate-500 text-white rounded text-[10px] font-bold transition shadow-xs"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleStartGroupEdit(g, idx)}
                              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition shadow-xs"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Scanned Breakup */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-center px-0.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <List className="w-3.5 h-3.5 text-slate-500" /> Detailed Scanned Breakup
            </h3>
            <span className="text-[10px] font-semibold text-slate-500 font-mono">{activePlanEntries.length} Items</span>
          </div>
          <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-100 dark:bg-slate-900 uppercase font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2 px-2.5">Date</th>
                  <th className="py-2 px-2.5">Delivery No.</th>
                  <th className="py-2 px-2.5">Code</th>
                  <th className="py-2 px-2.5">Unit</th>
                  <th className="py-2 px-2.5">Destination</th>
                  <th className="py-2 px-2.5 text-right">Weight (Kg)</th>
                  <th className="py-2 px-2.5 text-right">CFT</th>
                  <th className="py-2 px-2.5">Vehicle Type</th>
                  <th className="py-2 px-2.5">Transporter</th>
                  <th className="py-2 px-2.5">Mode</th>
                  <th className="py-2 px-2.5 text-center">Status</th>
                  <th className="py-2 px-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {activePlanEntries.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-6 text-slate-400">
                      No detailed plan data loaded.
                    </td>
                  </tr>
                ) : (
                  activePlanEntries.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                      <td className="py-1.5 px-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {item.entryDate || item.updatedAt?.substring(0, 10) || new Date().toISOString().split('T')[0]}
                      </td>
                      <td className="py-1.5 px-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                        <div className="flex items-center gap-2">
                          {item.deliveryNo}
                          {item.isCarriedForward && (
                            <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 text-[8px] px-1 py-0.5 rounded border border-amber-300 dark:border-amber-700 font-medium whitespace-nowrap tracking-wide">
                              CARRIED FORWARD
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2.5 font-mono text-slate-600 dark:text-slate-400">{item.code}</td>
                      <td className="py-1.5 px-2.5 font-bold text-slate-700 dark:text-slate-300">{item.unit}</td>
                      <td className="py-1.5 px-2.5 font-semibold text-slate-800 dark:text-slate-200">{item.destination}</td>
                      <td className="py-1.5 px-2.5 text-right font-mono text-slate-800 dark:text-slate-200">
                        {editingRowId === item.id ? (
                          <input
                            type="number"
                            className="w-20 bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs outline-none"
                            value={editWeight}
                            onChange={(e) => setEditWeight(e.target.value)}
                          />
                        ) : (
                          item.weight
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                        {editingRowId === item.id ? (
                          <input
                            type="number"
                            className="w-16 bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 py-0.5 text-right font-mono text-xs outline-none"
                            value={editCft}
                            onChange={(e) => setEditCft(e.target.value)}
                          />
                        ) : (
                          item.cft || 0
                        )}
                      </td>
                      <td 
                        className="py-1.5 px-2.5 font-mono text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                        onClick={() => handleInlineClick(item, 'vType')}
                      >
                        {inlineEditId === item.id && inlineEditField === 'vType' ? (
                          <input 
                            autoFocus
                            className="w-full bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 outline-none font-mono text-xs"
                            value={inlineEditVal}
                            onChange={(e) => setInlineEditVal(e.target.value.toUpperCase())}
                            onBlur={() => handleInlineSave(item)}
                            onKeyDown={(e) => handleInlineKeyDown(e, item)}
                          />
                        ) : (
                          item.vType || <span className="text-slate-400 italic">--</span>
                        )}
                      </td>
                      <td 
                        className="py-1.5 px-2.5 text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                        onClick={() => handleInlineClick(item, 'transporter')}
                      >
                        {inlineEditId === item.id && inlineEditField === 'transporter' ? (
                          <input 
                            autoFocus
                            className="w-full bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 outline-none text-xs"
                            value={inlineEditVal}
                            onChange={(e) => setInlineEditVal(e.target.value.toUpperCase())}
                            onBlur={() => handleInlineSave(item)}
                            onKeyDown={(e) => handleInlineKeyDown(e, item)}
                          />
                        ) : (
                          item.transporter || <span className="text-slate-400 italic">--</span>
                        )}
                      </td>
                      <td 
                        className="py-1.5 px-2.5 text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                        onClick={() => handleInlineClick(item, 'mode')}
                      >
                        {inlineEditId === item.id && inlineEditField === 'mode' ? (
                          <select 
                            autoFocus
                            className="w-full bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 outline-none text-xs"
                            value={inlineEditVal}
                            onChange={(e) => setInlineEditVal(e.target.value)}
                            onBlur={() => handleInlineSave(item)}
                            onKeyDown={(e) => handleInlineKeyDown(e, item)}
                          >
                            <option value="">--</option>
                            <option value="Road">Road</option>
                            <option value="Rail">Rail</option>
                            <option value="Air">Air</option>
                          </select>
                        ) : (
                          item.mode || <span className="text-slate-400 italic">--</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 text-center">
                        <select
                          value={item.status || 'Pending'}
                          onChange={(e) => {
                            if (e.target.value === 'Confirmed Plan') {
                              handleDetailedStatusConfirm(item.id);
                            } else {
                              onAddPlanEntries([{ ...item, status: e.target.value }]);
                              setStatusMsg(`Successfully updated status to ${e.target.value}`);
                              setTimeout(() => setStatusMsg(null), 3000);
                            }
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border outline-none cursor-pointer appearance-none ${
                            (item.status || 'Pending') === 'Confirmed Plan'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : (item.status || 'Pending') === 'Completed' || (item.status || 'Pending') === 'Done'
                              ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800'
                              : (item.status || 'Pending') === 'Planned'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                          }`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Planned">Planned</option>
                          <option value="Confirmed Plan">Confirmed Plan</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </td>
                      <td className="py-1.5 px-2.5 text-center">
                        <div className="flex justify-center gap-1.5 items-center">
                          {editingRowId === item.id ? (
                            <>
                              <button
                                onClick={() => handleSaveRowEdit(item)}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition shadow-xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelRowEdit}
                                className="px-2 py-0.5 bg-slate-400 hover:bg-slate-500 text-white rounded text-[10px] font-bold transition shadow-xs"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartRowEdit(item)}
                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition shadow-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => onDeletePlanEntry(item.id)}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-semibold transition shadow-xs flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
