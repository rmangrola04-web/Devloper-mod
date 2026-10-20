import React, { useState, useMemo } from 'react';
import {
  Truck,
  X,
  Upload,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
  Layers,
  Search,
  ClipboardList,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface TransportMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  transporters: string[];
  vehicleTypes: string[];
  onUpdateTransporters: (transporters: string[]) => void;
  onUpdateVehicleTypes: (vehicleTypes: string[]) => void;
}

export const TransportMasterModal: React.FC<TransportMasterModalProps> = ({
  isOpen,
  onClose,
  transporters,
  vehicleTypes,
  onUpdateTransporters,
  onUpdateVehicleTypes
}) => {
  const [newTransporter, setNewTransporter] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('');
  const [activeTab, setActiveTab] = useState<'import' | 'bulkpaste' | 'transporters' | 'vehicletypes'>('import');
  const [importMode, setImportMode] = useState<'both' | 'transporters' | 'vehicletypes'>('both');
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [searchTrans, setSearchTrans] = useState('');
  const [searchVeh, setSearchVeh] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkTarget, setBulkTarget] = useState<'transporters' | 'vehicletypes'>('transporters');

  // Filtered lists for fast search
  const filteredTransporters = useMemo(() => {
    if (!searchTrans.trim()) return transporters;
    const q = searchTrans.toLowerCase();
    return transporters.filter((t) => t.toLowerCase().includes(q));
  }, [transporters, searchTrans]);

  const filteredVehicleTypes = useMemo(() => {
    if (!searchVeh.trim()) return vehicleTypes;
    const q = searchVeh.toLowerCase();
    return vehicleTypes.filter((v) => v.toLowerCase().includes(q));
  }, [vehicleTypes, searchVeh]);

  if (!isOpen) return null;

  // Download Sample CSV
  const handleDownloadSample = (type: 'both' | 'transporters' | 'vehicletypes') => {
    let csvContent = '';
    let fileName = '';

    if (type === 'both') {
      csvContent = 'SrNo,Transporter,VehicleType\n' + [
        '1,DHTC,32SXL',
        '2,OPM,32MXL',
        '3,ICRL,32-15T',
        '4,MATA,32-18T',
        '5,MCM,24-9T',
        '6,FLY GREEN,PTL',
        '7,VARUNA,LCL',
        '8,TCI FREIGHT,20FT',
        '9,V-TRANS,14FT',
        '10,SAFEEXPRESS,32-20T'
      ].join('\n');
      fileName = 'transport_and_vehicletype_master.csv';
    } else if (type === 'transporters') {
      csvContent = 'Transporter\n' + [
        'DHTC',
        'OPM',
        'ICRL',
        'MATA',
        'MCM',
        'FLY GREEN',
        'VARUNA',
        'TCI FREIGHT',
        'V-TRANS',
        'SAFEEXPRESS'
      ].join('\n');
      fileName = 'transporters_master.csv';
    } else {
      csvContent = 'VehicleType\n' + [
        '32SXL',
        '32MXL',
        '32-15T',
        '32-18T',
        '32-20T',
        '24-9T',
        '20FT',
        '14FT',
        'PTL',
        'LCL'
      ].join('\n');
      fileName = 'vehicletypes_master.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Smart CSV / Excel File Importer with NO LIMITATION
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Scan active sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Read raw 2D array without limits
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          blankrows: false,
          defval: ''
        });

        if (!rows || rows.length === 0) {
          setImportStatus('File appears to be empty.');
          return;
        }

        // Detect column indexes from first row or data inspection
        let colTransIdx = -1;
        let colVehIdx = -1;
        let startRowIdx = 0;

        const firstRow = rows[0] || [];
        const isHeaderRow = firstRow.some((cell: any) => {
          const str = String(cell || '').toLowerCase();
          return (
            str.includes('transp') ||
            str.includes('vendor') ||
            str.includes('carrier') ||
            str.includes('party') ||
            str.includes('vehic') ||
            str.includes('type') ||
            str.includes('name') ||
            str.includes('sr') ||
            str.includes('sl') ||
            str.includes('s.no') ||
            str.includes('#')
          );
        });

        if (isHeaderRow) {
          startRowIdx = 1;
          firstRow.forEach((cell: any, idx: number) => {
            const str = String(cell || '').toLowerCase().trim();
            if (
              colTransIdx === -1 &&
              (str.includes('transp') || str.includes('vendor') || str.includes('carrier') || str.includes('party') || str.includes('name') || str.includes('company'))
            ) {
              colTransIdx = idx;
            }
            if (
              colVehIdx === -1 &&
              (str.includes('vehic') || str.includes('type') || str.includes('truck') || str.includes('vtype') || str.includes('size'))
            ) {
              colVehIdx = idx;
            }
          });
        }

        // Fallback column detection if headers were not named
        if (colTransIdx === -1 || (importMode === 'both' && colVehIdx === -1)) {
          // Check sample data rows (up to 5 rows)
          let col0IsNumeric = 0;
          const sampleCount = Math.min(rows.length, 5);
          for (let i = startRowIdx; i < sampleCount; i++) {
            const val = String(rows[i]?.[0] || '').trim();
            if (/^\d+$/.test(val)) col0IsNumeric++;
          }

          // If Column 0 is pure numbers (Serial No like 1, 2, 3.. 40..), shift columns
          if (col0IsNumeric >= Math.max(1, sampleCount - startRowIdx - 1)) {
            if (colTransIdx === -1) colTransIdx = 1;
            if (colVehIdx === -1) colVehIdx = 2;
          } else {
            if (colTransIdx === -1) colTransIdx = 0;
            if (colVehIdx === -1) colVehIdx = 1;
          }
        }

        // Build list with zero limit
        const newTransSet = new Set<string>(overwriteExisting ? [] : transporters.map((t) => t.toUpperCase().trim()));
        const newTransList: string[] = overwriteExisting ? [] : [...transporters];

        const newVehSet = new Set<string>(overwriteExisting ? [] : vehicleTypes.map((v) => v.toUpperCase().trim()));
        const newVehList: string[] = overwriteExisting ? [] : [...vehicleTypes];

        let importedTransCount = 0;
        let importedVehCount = 0;

        // Process ALL rows without any truncation or slice limit
        for (let i = startRowIdx; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !Array.isArray(row) || row.length === 0) continue;

          // Helper clean string
          const getClean = (idx: number): string => {
            if (idx < 0 || idx >= row.length) return '';
            const raw = row[idx];
            if (raw === undefined || raw === null) return '';
            return String(raw).trim().toUpperCase();
          };

          if (importMode === 'both') {
            const tVal = getClean(colTransIdx);
            const vVal = getClean(colVehIdx);

            if (tVal && tVal.length > 0 && !/^\d+$/.test(tVal)) {
              if (!newTransSet.has(tVal)) {
                newTransSet.add(tVal);
                newTransList.push(tVal);
                importedTransCount++;
              }
            }
            if (vVal && vVal.length > 0) {
              if (!newVehSet.has(vVal)) {
                newVehSet.add(vVal);
                newVehList.push(vVal);
                importedVehCount++;
              }
            }
          } else if (importMode === 'transporters') {
            // Find non-numeric cell from detected column or fallback across row
            let tVal = getClean(colTransIdx);
            if (!tVal || /^\d+$/.test(tVal)) {
              // find first valid text cell
              for (let c = 0; c < row.length; c++) {
                const cand = getClean(c);
                if (cand && !/^\d+$/.test(cand) && cand.length > 1) {
                  tVal = cand;
                  break;
                }
              }
            }

            if (tVal && tVal.length > 0) {
              if (!newTransSet.has(tVal)) {
                newTransSet.add(tVal);
                newTransList.push(tVal);
                importedTransCount++;
              }
            }
          } else if (importMode === 'vehicletypes') {
            let vVal = getClean(colVehIdx);
            if (!vVal) {
              for (let c = 0; c < row.length; c++) {
                const cand = getClean(c);
                if (cand && cand.length > 0) {
                  vVal = cand;
                  break;
                }
              }
            }

            if (vVal && vVal.length > 0) {
              if (!newVehSet.has(vVal)) {
                newVehSet.add(vVal);
                newVehList.push(vVal);
                importedVehCount++;
              }
            }
          }
        }

        // Apply Updates to state & database
        if (importMode === 'both' || importMode === 'transporters') {
          if (newTransList.length > 0) {
            onUpdateTransporters(newTransList);
          }
        }

        if (importMode === 'both' || importMode === 'vehicletypes') {
          if (newVehList.length > 0) {
            onUpdateVehicleTypes(newVehList);
          }
        }

        let summaryMsg = '';
        if (importMode === 'both') {
          summaryMsg = `✅ Successfully ${overwriteExisting ? 'Replaced & Imported' : 'Imported'} ${importedTransCount} Transporters & ${importedVehCount} Vehicle Types! (Total: ${newTransList.length} Transporters)`;
        } else if (importMode === 'transporters') {
          summaryMsg = `✅ Successfully ${overwriteExisting ? 'Replaced & Imported' : 'Imported'} ${importedTransCount} Transporters! (Total: ${newTransList.length} Transporters in Master)`;
        } else {
          summaryMsg = `✅ Successfully ${overwriteExisting ? 'Replaced & Imported' : 'Imported'} ${importedVehCount} Vehicle Types! (Total: ${newVehList.length} Types in Master)`;
        }

        setImportStatus(summaryMsg);
      } catch (err) {
        console.error('Import parse error:', err);
        setImportStatus('❌ Error parsing file. Please check file format and try again.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Bulk Text Paste Importer (Copy paste from Excel / WhatsApp / Email)
  const handleBulkTextImport = () => {
    if (!bulkText.trim()) return;

    const lines = bulkText
      .split(/[\r\n,;]+/)
      .map((l) => l.trim().toUpperCase())
      .filter((l) => l.length > 0 && !/^\d+$/.test(l));

    if (lines.length === 0) {
      setImportStatus('No valid text entries found.');
      return;
    }

    if (bulkTarget === 'transporters') {
      const set = new Set<string>(overwriteExisting ? [] : transporters.map((t) => t.toUpperCase()));
      const list = overwriteExisting ? [] : [...transporters];
      let count = 0;

      lines.forEach((item) => {
        if (!set.has(item)) {
          set.add(item);
          list.push(item);
          count++;
        }
      });

      onUpdateTransporters(list);
      setImportStatus(`✅ Imported ${count} Transporters from pasted text! Total: ${list.length}`);
      setBulkText('');
    } else {
      const set = new Set<string>(overwriteExisting ? [] : vehicleTypes.map((v) => v.toUpperCase()));
      const list = overwriteExisting ? [] : [...vehicleTypes];
      let count = 0;

      lines.forEach((item) => {
        if (!set.has(item)) {
          set.add(item);
          list.push(item);
          count++;
        }
      });

      onUpdateVehicleTypes(list);
      setImportStatus(`✅ Imported ${count} Vehicle Types from pasted text! Total: ${list.length}`);
      setBulkText('');
    }
  };

  const handleAddTransporter = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newTransporter.trim().toUpperCase();
    if (!val) return;
    if (!transporters.includes(val)) {
      onUpdateTransporters([...transporters, val]);
      setNewTransporter('');
    }
  };

  const handleDeleteTransporter = (t: string) => {
    onUpdateTransporters(transporters.filter((item) => item !== t));
  };

  const handleClearAllTransporters = () => {
    if (confirm('Are you sure you want to remove all transporters from master?')) {
      onUpdateTransporters([]);
    }
  };

  const handleAddVehicleType = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newVehicleType.trim().toUpperCase();
    if (!val) return;
    if (!vehicleTypes.includes(val)) {
      onUpdateVehicleTypes([...vehicleTypes, val]);
      setNewVehicleType('');
    }
  };

  const handleDeleteVehicleType = (v: string) => {
    onUpdateVehicleTypes(vehicleTypes.filter((item) => item !== v));
  };

  const handleClearAllVehicleTypes = () => {
    if (confirm('Are you sure you want to remove all vehicle types from master?')) {
      onUpdateVehicleTypes([]);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 max-w-2xl w-full p-4 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Transport & Vehicle Type Master
              </h3>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                ⚡ UNLIMITED / NO LIMIT
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Import 1 to 5,000+ entries via Excel/CSV or Copy-Paste with Auto-Replace and Full Search
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-1 rounded text-xs font-semibold transition ${
              activeTab === 'import' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1" /> Excel / CSV Upload
          </button>
          <button
            onClick={() => setActiveTab('bulkpaste')}
            className={`flex-1 py-1 rounded text-xs font-semibold transition ${
              activeTab === 'bulkpaste' ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 inline mr-1" /> Bulk Copy-Paste
          </button>
          <button
            onClick={() => setActiveTab('transporters')}
            className={`flex-1 py-1 rounded text-xs font-semibold transition ${
              activeTab === 'transporters' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Transporters ({transporters.length})
          </button>
          <button
            onClick={() => setActiveTab('vehicletypes')}
            className={`flex-1 py-1 rounded text-xs font-semibold transition ${
              activeTab === 'vehicletypes' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Vehicle Types ({vehicleTypes.length})
          </button>
        </div>

        {/* TAB 1: CSV / EXCEL IMPORT */}
        {activeTab === 'import' && (
          <div className="space-y-3 pt-1 text-xs">
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0 border border-blue-200 dark:border-blue-800">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="space-y-1.5 w-full">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                      Upload Master File (No Entry Limit)
                    </h4>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Auto-Detects Columns & S.No.
                    </span>
                  </div>
                  
                  {/* Mode Selector */}
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setImportMode('both')}
                      className={`p-1.5 rounded text-[11px] font-semibold border text-center transition ${
                        importMode === 'both'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Col A: Transporter<br />Col B: Vehicle Type
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('transporters')}
                      className={`p-1.5 rounded text-[11px] font-semibold border text-center transition ${
                        importMode === 'transporters'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Only Transporters<br />(Any Column / List)
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('vehicletypes')}
                      className={`p-1.5 rounded text-[11px] font-semibold border text-center transition ${
                        importMode === 'vehicletypes'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Only Vehicle Types<br />(Any Column / List)
                    </button>
                  </div>

                  {/* OVERWRITE TOGGLE */}
                  <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-amber-900 dark:text-amber-200">
                      <input
                        type="checkbox"
                        checked={overwriteExisting}
                        onChange={(e) => setOverwriteExisting(e.target.checked)}
                        className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                      />
                      <span>
                        <b>Replace old data (Overwrite Master List)</b>
                        <span className="block text-[10px] font-normal text-amber-700 dark:text-amber-300">
                          {overwriteExisting
                            ? 'Existing master list will be replaced with new file items only.'
                            : 'New file items will be merged with the existing master list.'}
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                <label className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition">
                  <Upload className="w-3.5 h-3.5" /> Upload File (.xlsx / .xls / .csv)
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => handleDownloadSample(importMode)}
                  className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold py-2 px-3 rounded text-xs flex items-center justify-center gap-1.5 border border-slate-300 dark:border-slate-600 transition"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" /> Download Sample Template
                </button>
              </div>

              {importStatus && (
                <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{importStatus}</span>
                </div>
              )}
            </div>

            {/* Quick Preview of Master Data */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Transporters Loaded ({transporters.length})
                  </span>
                  {transporters.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllTransporters}
                      className="text-[10px] text-rose-600 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {transporters.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">No transporters added yet.</span>
                  ) : (
                    transporters.map((t) => (
                      <span
                        key={t}
                        className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-medium"
                      >
                        {t}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Vehicle Types Loaded ({vehicleTypes.length})
                  </span>
                  {vehicleTypes.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllVehicleTypes}
                      className="text-[10px] text-rose-600 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {vehicleTypes.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">No vehicle types added yet.</span>
                  ) : (
                    vehicleTypes.map((v) => (
                      <span
                        key={v}
                        className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-medium font-mono"
                      >
                        {v}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BULK COPY-PASTE (NEW DIRECT TEXT INPUT) */}
        {activeTab === 'bulkpaste' && (
          <div className="space-y-3 pt-1 text-xs">
            <div className="p-3 rounded bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    Direct Bulk Copy-Paste
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Paste 50, 100 or 500+ items directly from Excel / Notepad (1 per line or comma separated)
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBulkTarget('transporters')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                      bulkTarget === 'transporters'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    Transporters
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkTarget('vehicletypes')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                      bulkTarget === 'vehicletypes'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    Vehicle Types
                  </button>
                </div>
              </div>

              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={6}
                placeholder={`Paste ${bulkTarget === 'transporters' ? 'Transporter' : 'Vehicle Type'} names here...\nDHTC\nSAFEEXPRESS\nFLY GREEN\nV-TRANS\n...`}
                className="w-full bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/80 rounded p-2.5 text-xs font-mono text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-purple-500 focus:outline-none"
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={overwriteExisting}
                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Replace existing master list (Overwrite)</span>
                </label>

                <button
                  type="button"
                  onClick={handleBulkTextImport}
                  disabled={!bulkText.trim()}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-1.5 px-4 rounded text-xs shadow-xs transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Import Pasted List
                </button>
              </div>
            </div>

            {importStatus && (
              <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{importStatus}</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TRANSPORTERS LIST & ADD & SEARCH */}
        {activeTab === 'transporters' && (
          <div className="space-y-2.5 pt-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Total: <b>{transporters.length}</b> Transporters in Master
              </span>
              {transporters.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllTransporters}
                  className="text-rose-600 hover:text-rose-700 font-semibold text-[11px] flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear All Transporters
                </button>
              )}
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleAddTransporter} className="flex gap-2">
              <input
                type="text"
                value={newTransporter}
                onChange={(e) => setNewTransporter(e.target.value)}
                placeholder="Enter Single Transporter Name (e.g. SAFEEXPRESS)"
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-bold text-slate-800 dark:text-slate-200"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            {/* Search Filter when many entries */}
            {transporters.length > 10 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchTrans}
                  onChange={(e) => setSearchTrans(e.target.value)}
                  placeholder={`Search in ${transporters.length} transporters...`}
                  className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded pl-8 pr-3 py-1.5 text-xs text-slate-700 dark:text-slate-300"
                />
              </div>
            )}

            {/* Transporters List */}
            <div className="max-h-60 overflow-y-auto rounded border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60">
              {transporters.length === 0 ? (
                <div className="p-6 text-center text-slate-400 italic">No transporters found. Add one above or import a file.</div>
              ) : filteredTransporters.length === 0 ? (
                <div className="p-4 text-center text-slate-400 italic">No match found for "{searchTrans}"</div>
              ) : (
                filteredTransporters.map((t, idx) => (
                  <div key={t + idx} className="flex justify-between items-center px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono w-6">{idx + 1}.</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{t}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteTransporter(t)}
                      className="text-rose-600 hover:text-rose-800 p-0.5"
                      title="Delete Transporter"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: VEHICLE TYPES LIST & ADD & SEARCH */}
        {activeTab === 'vehicletypes' && (
          <div className="space-y-2.5 pt-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Total: <b>{vehicleTypes.length}</b> Vehicle Types in Master
              </span>
              {vehicleTypes.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllVehicleTypes}
                  className="text-rose-600 hover:text-rose-700 font-semibold text-[11px] flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear All Vehicle Types
                </button>
              )}
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleAddVehicleType} className="flex gap-2">
              <input
                type="text"
                value={newVehicleType}
                onChange={(e) => setNewVehicleType(e.target.value)}
                placeholder="Enter Single Vehicle Type (e.g. 32-20T / 40FT)"
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-bold text-slate-800 dark:text-slate-200"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            {/* Search Filter when many entries */}
            {vehicleTypes.length > 10 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchVeh}
                  onChange={(e) => setSearchVeh(e.target.value)}
                  placeholder={`Search in ${vehicleTypes.length} vehicle types...`}
                  className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded pl-8 pr-3 py-1.5 text-xs text-slate-700 dark:text-slate-300"
                />
              </div>
            )}

            {/* Vehicle Types List */}
            <div className="max-h-60 overflow-y-auto rounded border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60">
              {vehicleTypes.length === 0 ? (
                <div className="p-6 text-center text-slate-400 italic">No vehicle types found. Add one above or import a file.</div>
              ) : filteredVehicleTypes.length === 0 ? (
                <div className="p-4 text-center text-slate-400 italic">No match found for "{searchVeh}"</div>
              ) : (
                filteredVehicleTypes.map((v, idx) => (
                  <div key={v + idx} className="flex justify-between items-center px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono w-6">{idx + 1}.</span>
                      <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">{v}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteVehicleType(v)}
                      className="text-rose-600 hover:text-rose-800 p-0.5"
                      title="Delete Vehicle Type"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div className="text-[11px] text-slate-400 font-medium">
            Master Data is synchronized in real-time across all users & devices.
          </div>
          <button
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-800 text-white font-semibold py-1.5 px-4 rounded text-xs transition shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
