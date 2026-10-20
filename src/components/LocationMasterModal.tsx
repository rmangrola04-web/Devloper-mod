import React, { useState, useMemo } from 'react';
import {
  MapPin,
  X,
  Upload,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Search,
  ClipboardList,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface LocationMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  loadLocations: string[];
  unloadLocations: string[];
  onUpdateLoadLocations: (loadLocs: string[]) => void;
  onUpdateUnloadLocations: (unloadLocs: string[]) => void;
}

export const LocationMasterModal: React.FC<LocationMasterModalProps> = ({
  isOpen,
  onClose,
  loadLocations,
  unloadLocations,
  onUpdateLoadLocations,
  onUpdateUnloadLocations
}) => {
  const [newLoadLoc, setNewLoadLoc] = useState('');
  const [newUnloadLoc, setNewUnloadLoc] = useState('');
  const [activeTab, setActiveTab] = useState<'import' | 'bulkpaste' | 'manual' | 'loadlocs' | 'unloadlocs'>('import');
  const [importMode, setImportMode] = useState<'both' | 'load' | 'unload'>('both');
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [searchLoad, setSearchLoad] = useState('');
  const [searchUnload, setSearchUnload] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkTarget, setBulkTarget] = useState<'load' | 'unload'>('load');
  const [manualLocName, setManualLocName] = useState('');
  const [manualCategory, setManualCategory] = useState<'load' | 'unload'>('load');

  // Filtered lists for quick search
  const filteredLoadLocs = useMemo(() => {
    if (!searchLoad.trim()) return loadLocations;
    const q = searchLoad.toLowerCase();
    return loadLocations.filter((l) => l.toLowerCase().includes(q));
  }, [loadLocations, searchLoad]);

  const filteredUnloadLocs = useMemo(() => {
    if (!searchUnload.trim()) return unloadLocations;
    const q = searchUnload.toLowerCase();
    return unloadLocations.filter((l) => l.toLowerCase().includes(q));
  }, [unloadLocations, searchUnload]);

  if (!isOpen) return null;

  // Download Sample CSV Templates
  const handleDownloadSample = (type: 'both' | 'load' | 'unload') => {
    let csvContent = '';
    let fileName = '';

    if (type === 'both') {
      csvContent = 'SrNo,LoadingDestination,UnloadingOrigin\n' + [
        '1,MUMBAI,DEWAS FACTORY',
        '2,PUNE,PITHAMPUR PLANT',
        '3,NAGPUR,DELHI CENTRAL',
        '4,AHMEDABAD,MUMBAI WAREHOUSE',
        '5,SURAT,BHIWANDI HUB',
        '6,RAIPUR,JAIPUR DEPOT',
        '7,JAIPUR,KOLKATA DC',
        '8,DELHI,CHENNAI PLANT',
        '9,BHOPAL,BANGALORE HUB',
        '10,JABALPUR,HYDERABAD WH'
      ].join('\n');
      fileName = 'location_master_loading_and_unloading.csv';
    } else if (type === 'load') {
      csvContent = 'LoadingDestination\n' + [
        'MUMBAI',
        'PUNE',
        'NAGPUR',
        'AHMEDABAD',
        'SURAT',
        'RAIPUR',
        'JAIPUR',
        'DELHI',
        'BHOPAL',
        'JABALPUR'
      ].join('\n');
      fileName = 'loading_destinations_master.csv';
    } else {
      csvContent = 'UnloadingOrigin\n' + [
        'DEWAS FACTORY',
        'PITHAMPUR PLANT',
        'DELHI CENTRAL',
        'MUMBAI WAREHOUSE',
        'BHIWANDI HUB',
        'JAIPUR DEPOT',
        'KOLKATA DC',
        'CHENNAI PLANT',
        'BANGALORE HUB',
        'HYDERABAD WH'
      ].join('\n');
      fileName = 'unloading_origins_master.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Smart Unlimited CSV / Excel File Importer
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          blankrows: false,
          defval: ''
        });

        if (!rows || rows.length === 0) {
          setImportStatus('File appears to be empty.');
          return;
        }

        let colLoadIdx = -1;
        let colUnloadIdx = -1;
        let startRowIdx = 0;

        const firstRow = rows[0] || [];
        const isHeaderRow = firstRow.some((cell: any) => {
          const str = String(cell || '').toLowerCase();
          return (
            str.includes('load') ||
            str.includes('dest') ||
            str.includes('to') ||
            str.includes('unload') ||
            str.includes('origin') ||
            str.includes('from') ||
            str.includes('loc') ||
            str.includes('city') ||
            str.includes('plant') ||
            str.includes('hub') ||
            str.includes('sr') ||
            str.includes('#')
          );
        });

        if (isHeaderRow) {
          startRowIdx = 1;
          firstRow.forEach((cell: any, idx: number) => {
            const str = String(cell || '').toLowerCase().trim();
            if (
              colLoadIdx === -1 &&
              (str.includes('load') || str.includes('dest') || str.includes('to loc') || str.includes('dispatch') || str.includes('outgoing'))
            ) {
              colLoadIdx = idx;
            }
            if (
              colUnloadIdx === -1 &&
              (str.includes('unload') || str.includes('origin') || str.includes('from loc') || str.includes('inward') || str.includes('source') || str.includes('incoming'))
            ) {
              colUnloadIdx = idx;
            }
          });
        }

        // Fallback column detection if headers were generic or not named
        if (colLoadIdx === -1 || (importMode === 'both' && colUnloadIdx === -1)) {
          let col0IsNumeric = 0;
          const sampleCount = Math.min(rows.length, 5);
          for (let i = startRowIdx; i < sampleCount; i++) {
            const val = String(rows[i]?.[0] || '').trim();
            if (/^\d+$/.test(val)) col0IsNumeric++;
          }

          if (col0IsNumeric >= Math.max(1, sampleCount - startRowIdx - 1)) {
            if (colLoadIdx === -1) colLoadIdx = 1;
            if (colUnloadIdx === -1) colUnloadIdx = 2;
          } else {
            if (colLoadIdx === -1) colLoadIdx = 0;
            if (colUnloadIdx === -1) colUnloadIdx = 1;
          }
        }

        const newLoadSet = new Set<string>(overwriteExisting ? [] : loadLocations.map((l) => l.toUpperCase().trim()));
        const newLoadList: string[] = overwriteExisting ? [] : [...loadLocations];

        const newUnloadSet = new Set<string>(overwriteExisting ? [] : unloadLocations.map((u) => u.toUpperCase().trim()));
        const newUnloadList: string[] = overwriteExisting ? [] : [...unloadLocations];

        let importedLoadCount = 0;
        let importedUnloadCount = 0;

        for (let i = startRowIdx; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !Array.isArray(row) || row.length === 0) continue;

          const getClean = (idx: number): string => {
            if (idx < 0 || idx >= row.length) return '';
            const raw = row[idx];
            if (raw === undefined || raw === null) return '';
            return String(raw).trim().toUpperCase();
          };

          if (importMode === 'both') {
            const lVal = getClean(colLoadIdx);
            const uVal = getClean(colUnloadIdx);

            if (lVal && lVal.length > 0 && !/^\d+$/.test(lVal)) {
              if (!newLoadSet.has(lVal)) {
                newLoadSet.add(lVal);
                newLoadList.push(lVal);
                importedLoadCount++;
              }
            }
            if (uVal && uVal.length > 0 && !/^\d+$/.test(uVal)) {
              if (!newUnloadSet.has(uVal)) {
                newUnloadSet.add(uVal);
                newUnloadList.push(uVal);
                importedUnloadCount++;
              }
            }
          } else if (importMode === 'load') {
            let lVal = getClean(colLoadIdx);
            if (!lVal || /^\d+$/.test(lVal)) {
              for (let c = 0; c < row.length; c++) {
                const cand = getClean(c);
                if (cand && !/^\d+$/.test(cand) && cand.length > 1) {
                  lVal = cand;
                  break;
                }
              }
            }

            if (lVal && lVal.length > 0) {
              if (!newLoadSet.has(lVal)) {
                newLoadSet.add(lVal);
                newLoadList.push(lVal);
                importedLoadCount++;
              }
            }
          } else if (importMode === 'unload') {
            let uVal = getClean(colUnloadIdx);
            if (!uVal || /^\d+$/.test(uVal)) {
              for (let c = 0; c < row.length; c++) {
                const cand = getClean(c);
                if (cand && !/^\d+$/.test(cand) && cand.length > 1) {
                  uVal = cand;
                  break;
                }
              }
            }

            if (uVal && uVal.length > 0) {
              if (!newUnloadSet.has(uVal)) {
                newUnloadSet.add(uVal);
                newUnloadList.push(uVal);
                importedUnloadCount++;
              }
            }
          }
        }

        // Apply Updates
        if (importMode === 'both' || importMode === 'load') {
          if (newLoadList.length > 0) {
            onUpdateLoadLocations(newLoadList);
          }
        }

        if (importMode === 'both' || importMode === 'unload') {
          if (newUnloadList.length > 0) {
            onUpdateUnloadLocations(newUnloadList);
          }
        }

        let summaryMsg = '';
        if (importMode === 'both') {
          summaryMsg = `✅ Successfully ${overwriteExisting ? 'Replaced & Imported' : 'Imported'} ${importedLoadCount} Loading & ${importedUnloadCount} Unloading Locations! (Total: ${newLoadList.length} Loading, ${newUnloadList.length} Unloading)`;
        } else if (importMode === 'load') {
          summaryMsg = `✅ Successfully ${overwriteExisting ? 'Replaced & Imported' : 'Imported'} ${importedLoadCount} Loading Destinations! (Total: ${newLoadList.length} in Master)`;
        } else {
          summaryMsg = `✅ Successfully ${overwriteExisting ? 'Replaced & Imported' : 'Imported'} ${importedUnloadCount} Unloading Origins! (Total: ${newUnloadList.length} in Master)`;
        }

        setImportStatus(summaryMsg);
      } catch (err) {
        console.error('Import location parse error:', err);
        setImportStatus('❌ Error parsing file. Please check file format and try again.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Bulk Text Paste Importer
  const handleBulkTextImport = () => {
    if (!bulkText.trim()) return;

    const lines = bulkText
      .split(/[\r\n,;]+/)
      .map((l) => l.trim().toUpperCase())
      .filter((l) => l.length > 0 && !/^\d+$/.test(l));

    if (lines.length === 0) {
      setImportStatus('No valid location names found.');
      return;
    }

    if (bulkTarget === 'load') {
      const set = new Set<string>(overwriteExisting ? [] : loadLocations.map((l) => l.toUpperCase()));
      const list = overwriteExisting ? [] : [...loadLocations];
      let count = 0;

      lines.forEach((item) => {
        if (!set.has(item)) {
          set.add(item);
          list.push(item);
          count++;
        }
      });

      onUpdateLoadLocations(list);
      setImportStatus(`✅ Imported ${count} Loading Destinations from pasted text! Total: ${list.length}`);
      setBulkText('');
    } else {
      const set = new Set<string>(overwriteExisting ? [] : unloadLocations.map((u) => u.toUpperCase()));
      const list = overwriteExisting ? [] : [...unloadLocations];
      let count = 0;

      lines.forEach((item) => {
        if (!set.has(item)) {
          set.add(item);
          list.push(item);
          count++;
        }
      });

      onUpdateUnloadLocations(list);
      setImportStatus(`✅ Imported ${count} Unloading Origins from pasted text! Total: ${list.length}`);
      setBulkText('');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = manualLocName.trim().toUpperCase();
    if (!val) return;

    if (manualCategory === 'load') {
      if (!loadLocations.includes(val)) {
        onUpdateLoadLocations([...loadLocations, val]);
        setImportStatus(`✅ Successfully added "${val}" to Loading Destinations!`);
      } else {
        setImportStatus(`ℹ️ "${val}" already exists in Loading Destinations.`);
      }
    } else {
      if (!unloadLocations.includes(val)) {
        onUpdateUnloadLocations([...unloadLocations, val]);
        setImportStatus(`✅ Successfully added "${val}" to Unloading Origins!`);
      } else {
        setImportStatus(`ℹ️ "${val}" already exists in Unloading Origins.`);
      }
    }
    setManualLocName('');
  };

  const handleAddLoadLoc = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newLoadLoc.trim().toUpperCase();
    if (!val) return;
    if (!loadLocations.includes(val)) {
      onUpdateLoadLocations([...loadLocations, val]);
      setNewLoadLoc('');
    }
  };

  const handleDeleteLoadLoc = (loc: string) => {
    onUpdateLoadLocations(loadLocations.filter((item) => item !== loc));
  };

  const handleClearAllLoadLocs = () => {
    if (confirm('Are you sure you want to remove all Loading Destinations from master?')) {
      onUpdateLoadLocations([]);
    }
  };

  const handleAddUnloadLoc = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newUnloadLoc.trim().toUpperCase();
    if (!val) return;
    if (!unloadLocations.includes(val)) {
      onUpdateUnloadLocations([...unloadLocations, val]);
      setNewUnloadLoc('');
    }
  };

  const handleDeleteUnloadLoc = (loc: string) => {
    onUpdateUnloadLocations(unloadLocations.filter((item) => item !== loc));
  };

  const handleClearAllUnloadLocs = () => {
    if (confirm('Are you sure you want to remove all Unloading Origins from master?')) {
      onUpdateUnloadLocations([]);
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
                <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Location Master (Loading & Unloading)
              </h3>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                ⚡ UNLIMITED / NO LIMIT
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Manage Loading Destinations & Unloading Origins with Excel/CSV Upload, Bulk Paste and Instant Search
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 min-w-[120px] py-1 rounded text-xs font-semibold transition ${
              activeTab === 'import' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1" /> Excel / CSV Upload
          </button>
          <button
            onClick={() => setActiveTab('bulkpaste')}
            className={`flex-1 min-w-[120px] py-1 rounded text-xs font-semibold transition ${
              activeTab === 'bulkpaste' ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 inline mr-1" /> Bulk Copy-Paste
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 min-w-[120px] py-1 rounded text-xs font-semibold transition ${
              activeTab === 'manual' ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5 inline mr-1" /> Manual Add
          </button>
          <button
            onClick={() => setActiveTab('loadlocs')}
            className={`flex-1 min-w-[120px] py-1 rounded text-xs font-semibold transition ${
              activeTab === 'loadlocs' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Loading Dests ({loadLocations.length})
          </button>
          <button
            onClick={() => setActiveTab('unloadlocs')}
            className={`flex-1 min-w-[120px] py-1 rounded text-xs font-semibold transition ${
              activeTab === 'unloadlocs' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Unloading Origins ({unloadLocations.length})
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
                      Upload Location Master File (No Entry Limit)
                    </h4>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Auto-Detects Col A/B & S.No.
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
                      Col A: Loading (Dest)<br />Col B: Unloading (Origin)
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('load')}
                      className={`p-1.5 rounded text-[11px] font-semibold border text-center transition ${
                        importMode === 'load'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Only Loading<br />(Destinations List)
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('unload')}
                      className={`p-1.5 rounded text-[11px] font-semibold border text-center transition ${
                        importMode === 'unload'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Only Unloading<br />(Origins List)
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
                            ? 'Existing location list will be replaced with new file items only.'
                            : 'New file items will be merged with the existing location list.'}
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
                    Loading Destinations ({loadLocations.length})
                  </span>
                  {loadLocations.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllLoadLocs}
                      className="text-[10px] text-rose-600 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {loadLocations.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">No loading locations added yet.</span>
                  ) : (
                    loadLocations.map((l) => (
                      <span
                        key={l}
                        className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-medium"
                      >
                        {l}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Unloading Origins ({unloadLocations.length})
                  </span>
                  {unloadLocations.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllUnloadLocs}
                      className="text-[10px] text-rose-600 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {unloadLocations.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">No unloading locations added yet.</span>
                  ) : (
                    unloadLocations.map((u) => (
                      <span
                        key={u}
                        className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-medium"
                      >
                        {u}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BULK COPY-PASTE */}
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
                    Paste 50, 100 or 500+ locations directly from Excel / Notepad (1 per line or comma separated)
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBulkTarget('load')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                      bulkTarget === 'load'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    Loading Dests
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkTarget('unload')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                      bulkTarget === 'unload'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    Unloading Origins
                  </button>
                </div>
              </div>

              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={6}
                placeholder={`Paste ${bulkTarget === 'load' ? 'Loading Destination' : 'Unloading Origin'} names here...\nMUMBAI\nPUNE\nDELHI CENTRAL\n...`}
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
              <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 font-semibold text-xs mt-3">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{importStatus}</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 2.5: MANUAL SINGLE ENTRY */}
        {activeTab === 'manual' && (
          <div className="space-y-4 pt-1 text-xs">
            <div className="p-4 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-4 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Add Single Location
              </h4>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Category</label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value as 'load' | 'unload')}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="load">Loading (Destination)</option>
                    <option value="unload">Unloading (Origin)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Location Name</label>
                  <input
                    type="text"
                    value={manualLocName}
                    onChange={(e) => setManualLocName(e.target.value)}
                    placeholder="e.g., SVP MEDICARE LLP"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs uppercase font-bold text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" /> Add Location
                  </button>
                </div>
              </form>
            </div>

            {importStatus && (
              <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{importStatus}</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LOADING DESTINATIONS LIST & ADD */}
        {activeTab === 'loadlocs' && (
          <div className="space-y-2.5 pt-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Total: <b>{loadLocations.length}</b> Loading Destinations in Master
              </span>
              {loadLocations.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllLoadLocs}
                  className="text-rose-600 hover:text-rose-700 font-semibold text-[11px] flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear All Loading Locations
                </button>
              )}
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleAddLoadLoc} className="flex gap-2">
              <input
                type="text"
                value={newLoadLoc}
                onChange={(e) => setNewLoadLoc(e.target.value)}
                placeholder="Enter Single Destination (e.g. MUMBAI / NAGPUR)"
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-bold text-slate-800 dark:text-slate-200"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            {/* Search Filter */}
            {loadLocations.length > 10 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchLoad}
                  onChange={(e) => setSearchLoad(e.target.value)}
                  placeholder={`Search in ${loadLocations.length} loading destinations...`}
                  className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded pl-8 pr-3 py-1.5 text-xs text-slate-700 dark:text-slate-300"
                />
              </div>
            )}

            {/* List */}
            <div className="max-h-60 overflow-y-auto rounded border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60">
              {loadLocations.length === 0 ? (
                <div className="p-6 text-center text-slate-400 italic">No loading locations found. Add one above or upload a file.</div>
              ) : filteredLoadLocs.length === 0 ? (
                <div className="p-4 text-center text-slate-400 italic">No match found for "{searchLoad}"</div>
              ) : (
                filteredLoadLocs.map((l, idx) => (
                  <div key={l + idx} className="flex justify-between items-center px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono w-6">{idx + 1}.</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{l}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteLoadLoc(l)}
                      className="text-rose-600 hover:text-rose-800 p-0.5"
                      title="Delete Location"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: UNLOADING ORIGINS LIST & ADD */}
        {activeTab === 'unloadlocs' && (
          <div className="space-y-2.5 pt-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Total: <b>{unloadLocations.length}</b> Unloading Origins in Master
              </span>
              {unloadLocations.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllUnloadLocs}
                  className="text-rose-600 hover:text-rose-700 font-semibold text-[11px] flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear All Unloading Locations
                </button>
              )}
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleAddUnloadLoc} className="flex gap-2">
              <input
                type="text"
                value={newUnloadLoc}
                onChange={(e) => setNewUnloadLoc(e.target.value)}
                placeholder="Enter Single Origin (e.g. DEWAS FACTORY / PITHAMPUR)"
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-bold text-slate-800 dark:text-slate-200"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            {/* Search Filter */}
            {unloadLocations.length > 10 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchUnload}
                  onChange={(e) => setSearchUnload(e.target.value)}
                  placeholder={`Search in ${unloadLocations.length} unloading origins...`}
                  className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded pl-8 pr-3 py-1.5 text-xs text-slate-700 dark:text-slate-300"
                />
              </div>
            )}

            {/* List */}
            <div className="max-h-60 overflow-y-auto rounded border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60">
              {unloadLocations.length === 0 ? (
                <div className="p-6 text-center text-slate-400 italic">No unloading origins found. Add one above or upload a file.</div>
              ) : filteredUnloadLocs.length === 0 ? (
                <div className="p-4 text-center text-slate-400 italic">No match found for "{searchUnload}"</div>
              ) : (
                filteredUnloadLocs.map((u, idx) => (
                  <div key={u + idx} className="flex justify-between items-center px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono w-6">{idx + 1}.</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{u}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteUnloadLoc(u)}
                      className="text-rose-600 hover:text-rose-800 p-0.5"
                      title="Delete Location"
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
            Location Master is synchronized in real-time across all supervisor and security forms.
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
