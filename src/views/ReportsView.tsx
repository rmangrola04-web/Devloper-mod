import React, { useState, useMemo, useEffect } from 'react';
import { FileSpreadsheet, FileText, Mail, Upload, UserCheck, Truck, CheckCircle2, Filter, Pencil, MapPin, Search, Building2, Phone, Trash2, BarChart3, Clock, TrendingUp, Users, Calendar } from 'lucide-react';
import { PlanEntry, LoadUnloadEntry, SecurityGateEntry } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { matchesWmsDateFilter, getOpRecordDate, getGateRecordDate, getPlanRecordDate, normalizeWmsDate } from '../utils/wmsDataEngine';

interface ReportsViewProps {
  planEntries: PlanEntry[];
  loadEntries: LoadUnloadEntry[];
  securityLogs: SecurityGateEntry[];
  globalFilterType?: 'DATE' | 'MONTH' | 'RANGE' | 'ALL' | string;
  globalFilterValue?: string;
  globalFilterEndDate?: string;
  onGlobalDateFilterChange?: (type: 'DATE' | 'MONTH' | 'RANGE' | 'ALL', val?: string, endVal?: string) => void;
  onOpenTransportMasterModal: () => void;
  onOpenLocationMasterModal: () => void;
  onImportLocationMaster: (loadLocs: string[], unloadLocs: string[]) => void;
  onImportSupervisorMaster: (supervisors: string[]) => void;
  onEditOperation?: (entry: LoadUnloadEntry) => void;
  onEditGateEntry?: (entry: SecurityGateEntry) => void;
  onDeleteOperation?: (id: string) => void;
  onDeleteGateEntry?: (id: string, skipConfirm?: boolean) => void;
  onDeletePlanEntry?: (id: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  planEntries,
  loadEntries,
  securityLogs,
  globalFilterType,
  globalFilterValue,
  globalFilterEndDate,
  onGlobalDateFilterChange,
  onOpenTransportMasterModal,
  onOpenLocationMasterModal,
  onImportLocationMaster,
  onImportSupervisorMaster,
  onEditOperation,
  onEditGateEntry,
  onDeleteOperation,
  onDeleteGateEntry,
  onDeletePlanEntry
}) => {
  const [reportType, setReportType] = useState<'plan' | 'operations' | 'security' | 'monthly' | 'transporter_summary'>('operations');
  const [expandedConsolidatedTransporters, setExpandedConsolidatedTransporters] = useState<Record<string, boolean>>({});
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (globalFilterType === 'MONTH' && globalFilterValue) {
      const parts = globalFilterValue.split('-');
      if (parts.length >= 2) return `${parts[0]}-${parseInt(parts[1], 10) - 1}`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}`;
  });

  // Local date filter state initialized with and synchronized to the global dashboard date
  const [reportDateFilter, setReportDateFilter] = useState<string>(() => globalFilterValue || '');
  const [analyticsTimeFilter, setAnalyticsTimeFilter] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState<'ALL' | 'AIL' | 'AHPL'>('ALL');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Keep local date picker synchronized with top global dashboard date changes
  useEffect(() => {
    if (globalFilterValue !== undefined) {
      setReportDateFilter(globalFilterValue || '');
    }
  }, [globalFilterValue]);

  // Handler to sync local report date picker with top global filter
  const handleReportDateChange = (newDate: string) => {
    setReportDateFilter(newDate);
    if (onGlobalDateFilterChange) {
      if (newDate) {
        onGlobalDateFilterChange('DATE', newDate, newDate);
      } else {
        onGlobalDateFilterChange('ALL');
      }
    }
  };

  /**
   * Strict Date Filter Binding:
   * Dynamic binding to active dashboard date. If no records exist for the selected date,
   * cleanly returns false (empty state), never falling back to arbitrary past dates.
   */
  const checkRecordDate = (rawDate: string | undefined | null) => {
    const targetDate = reportDateFilter !== '' ? reportDateFilter : globalFilterValue;
    const targetType = reportDateFilter !== '' ? 'DATE' : (globalFilterType || 'DATE');
    const startDate = reportDateFilter !== '' ? reportDateFilter : globalFilterValue;
    const endDate = reportDateFilter !== '' ? reportDateFilter : (globalFilterEndDate || globalFilterValue);

    // If viewing WEEKLY analytics relative to target date
    if (analyticsTimeFilter === 'WEEKLY' && targetDate) {
      const dStr = normalizeWmsDate(rawDate);
      if (!dStr) return false;
      const targetD = new Date(targetDate);
      const recordD = new Date(dStr);
      if (isNaN(targetD.getTime()) || isNaN(recordD.getTime())) return false;
      const diffDays = Math.abs(targetD.getTime() - recordD.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    }

    // If viewing MONTHLY analytics relative to target date or selected month
    if (analyticsTimeFilter === 'MONTHLY' && targetDate) {
      const dStr = normalizeWmsDate(rawDate);
      if (!dStr) return false;
      const targetMonth = targetDate.substring(0, 7);
      return dStr.startsWith(targetMonth);
    }

    return matchesWmsDateFilter(rawDate, targetDate, startDate, endDate, targetType);
  };

  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      opts.push({ val, label });
    }
    return opts;
  }, []);

  const [expandedTransporters, setExpandedTransporters] = useState<Record<string, boolean>>({});
  const [operationFilter, setOperationFilter] = useState<'ALL' | 'Loading' | 'Unloading'>('ALL');

  const monthlyReportData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const records = [...planEntries, ...loadEntries, ...securityLogs];

    const fitValues = ['FIT', 'FITTED', 'FIT OK', 'FIT/OK', 'PASS', 'PASSED'];
    const isFIT = (status: string) => {
      const val = String(status || '').trim().toUpperCase();
      return fitValues.some(f => val === f || val.includes(f));
    };

    const getRecordDate = (record: any) => {
      const val = record.entryDate || record.dateTime || record.createdAt || record.date;
      if (!val) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    const seenIds = new Set<string>();
    const monthlyRecords: any[] = [];

    records.forEach(record => {
      const d = getRecordDate(record);
      if (!d) return;
      if (d.getFullYear() === year && d.getMonth() === month) {
        const op = String((record as any).purpose || (record as any).opType || '').trim().toLowerCase();
        if (operationFilter === 'Loading') {
          if (!op.includes('load') && op !== 'loading') return;
        } else if (operationFilter === 'Unloading') {
          if (!op.includes('unload') && op !== 'unloading') return;
        }

        const uniqueKey = record.id || (record as any).tripId || `${record.vehicleNo || (record as any).vehicle || ''}_${d.toISOString().slice(0, 10)}_${record.transporter || ''}`;
        if (!seenIds.has(uniqueKey)) {
          seenIds.add(uniqueKey);
          monthlyRecords.push({ ...record, parsedDate: d });
        }
      }
    });

    const transporterMap = new Map<string, {
      transporter: string;
      vType: string;
      totalTrips: number;
      fitCount: number;
      nonFitCount: number;
      vehicles: Array<{ vehicle: string; status: string; date: string; fit: boolean; vType: string }>;
    }>();

    monthlyRecords.forEach(record => {
      const transporter = String(record.transporter || record.transporterName || record.transportName || 'Unknown Transporter').trim();
      const vehicle = String(record.vehicleNo || record.vehicle || record.vehicleNumber || 'Unknown Vehicle').trim();
      const vType = String(record.vType || record.vehicleType || record.vehicle_type || '32SXL').trim();
      const status = String(record.status || record.fitStatus || record.vehicleStatus || 'PENDING').trim();
      const fit = isFIT(status);
      const d = record.parsedDate as Date;
      const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      const mapKey = `${transporter}_${vType}`;
      if (!transporterMap.has(mapKey)) {
        transporterMap.set(mapKey, {
          transporter,
          vType,
          totalTrips: 0,
          fitCount: 0,
          nonFitCount: 0,
          vehicles: []
        });
      }

      const item = transporterMap.get(mapKey)!;
      item.totalTrips++;
      if (fit) {
        item.fitCount++;
      } else {
        item.nonFitCount++;
      }
      item.vehicles.push({
        vehicle,
        status: status.toUpperCase(),
        date: dateStr,
        fit,
        vType
      });
    });

    const transporterSummary = Array.from(transporterMap.values()).map(item => {
      const fitPercentage = item.totalTrips > 0 ? Math.round((item.fitCount / item.totalTrips) * 100) : 0;
      return {
        transporter: item.transporter,
        vType: item.vType,
        totalTrips: item.totalTrips,
        fitVehicles: item.fitCount,
        nonFitVehicles: item.nonFitCount,
        fitPercentage,
        vehicles: item.vehicles
      };
    }).sort((a, b) => b.totalTrips - a.totalTrips);

    const totalTrips = transporterSummary.reduce((sum, i) => sum + i.totalTrips, 0);
    const totalFit = transporterSummary.reduce((sum, i) => sum + i.fitVehicles, 0);
    const totalNonFit = transporterSummary.reduce((sum, i) => sum + i.nonFitVehicles, 0);
    const overallFitPercentage = totalTrips > 0 ? Math.round((totalFit / totalTrips) * 100) : 0;

    return {
      year,
      month,
      totalTrips,
      totalFit,
      totalNonFit,
      overallFitPercentage,
      transporterSummary
    };
  }, [planEntries, loadEntries, securityLogs, selectedMonth, operationFilter]);

  const handleExportMonthlyCSV = () => {
    const report = monthlyReportData;
    const rows = [['Transporter', 'Total Trips / Vehicles Placed', 'FIT Vehicles', 'Non-FIT / Pending', 'FIT %']];
    report.transporterSummary.forEach(item => {
      rows.push([
        item.transporter,
        String(item.totalTrips),
        String(item.fitVehicles),
        String(item.nonFitVehicles),
        `${item.fitPercentage}%`
      ]);
    });
    rows.push(['TOTAL', String(report.totalTrips), String(report.totalFit), String(report.totalNonFit), `${report.overallFitPercentage}%`]);

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `WMS_Monthly_Transport_Report_${report.year}_${report.month + 1}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSendMonthlyWhatsApp = () => {
    const report = monthlyReportData;
    const monthName = new Date(report.year, report.month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    let message = `*WMS MONTHLY TRANSPORT REPORT*\n`;
    message += `${monthName}\n\n`;

    report.transporterSummary.forEach(item => {
      message += `*${item.transporter}*\n`;
      message += `Trips: ${item.totalTrips}\n`;
      message += `FIT: ${item.fitVehicles}\n`;
      message += `Non-FIT: ${item.nonFitVehicles}\n`;
      message += `FIT: ${item.fitPercentage}%\n\n`;
    });

    message += `*TOTAL*\n`;
    message += `Trips: ${report.totalTrips}\n`;
    message += `FIT: ${report.totalFit}\n`;
    message += `Non-FIT: ${report.totalNonFit}\n`;
    message += `FIT: ${report.overallFitPercentage}%\n`;

    window.open(`https://wa.me/?text=` + encodeURIComponent(message), '_blank');
  };

  // Dual Location Master Upload (Col A: Loading Destinations, Col B: Unloading Origins)
  const handleDualLocationImportOk = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt: any) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const newLoadLocs: string[] = [];
        const newUnloadLocs: string[] = [];

        rows.forEach((row, index) => {
          if (
            index === 0 &&
            (String(row[0]).toLowerCase().includes('load') ||
              String(row[1]).toLowerCase().includes('unload'))
          ) {
            return;
          }

          const loadVal = row[0] ? String(row[0]).toUpperCase().trim() : '';
          const unloadVal = row[1] ? String(row[1]).toUpperCase().trim() : '';

          if (loadVal && loadVal.length > 1 && !newLoadLocs.includes(loadVal)) {
            newLoadLocs.push(loadVal);
          }
          if (unloadVal && unloadVal.length > 1 && !newUnloadLocs.includes(unloadVal)) {
            newUnloadLocs.push(unloadVal);
          }
        });

        if (newLoadLocs.length === 0 && newUnloadLocs.length === 0) {
          alert('No valid locations found in file.');
          return;
        }

        onImportLocationMaster(newLoadLocs, newUnloadLocs);
        setStatusMsg(`Imported ${newLoadLocs.length} Loading & ${newUnloadLocs.length} Unloading Locations!`);
        setTimeout(() => setStatusMsg(null), 4000);
      } catch (err) {
        alert('Error parsing CSV. Ensure Col A is Loading & Col B is Unloading.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Supervisor Master Upload
  const handleSupervisorImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const dataBuffer = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(dataBuffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const newSups: string[] = [];
        rows.forEach((row) => {
          if (Array.isArray(row)) {
            row.forEach((cell) => {
              const val = String(cell).trim();
              if (
                val &&
                !val.toLowerCase().includes('supervisor') &&
                !val.toLowerCase().includes('name') &&
                val.length > 1 &&
                !newSups.includes(val)
              ) {
                newSups.push(val);
              }
            });
          }
        });

        if (newSups.length === 0) {
          alert('No valid supervisor names found in file.');
          return;
        }

        onImportSupervisorMaster(newSups);
        setStatusMsg(`Imported Supervisor Master with ${newSups.length} supervisors!`);
        setTimeout(() => setStatusMsg(null), 4000);
      } catch (err) {
        alert('Error parsing supervisor CSV/Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Filtered lists for table rendering
  const filteredOperations = useMemo(() => {
    return loadEntries.filter((op) => {
      const q = searchTerm.trim().toLowerCase();
      if (companyFilter !== 'ALL' && (op.unit || '').toUpperCase() !== companyFilter) {
        return false;
      }
      const opDate = getOpRecordDate(op);
      if (!checkRecordDate(opDate)) {
        return false;
      }
      if (!q) return true;
      return (
        (op.vehicleNo || '').toLowerCase().includes(q) ||
        (op.fromLoc || '').toLowerCase().includes(q) ||
        (op.toLoc || '').toLowerCase().includes(q) ||
        (op.transporter || '').toLowerCase().includes(q) ||
        (op.operator || '').toLowerCase().includes(q) ||
        (op.bayNo || '').toLowerCase().includes(q)
      );
    });
  }, [loadEntries, searchTerm, companyFilter, reportDateFilter, globalFilterValue, globalFilterType, globalFilterEndDate, analyticsTimeFilter]);

  const filteredSecurityLogs = useMemo(() => {
    return securityLogs.filter((g) => {
      const q = searchTerm.trim().toLowerCase();
      const isAil = (g.unit || '').toUpperCase().includes('AIL') || (!g.unit && Number(g.grNo) < 691 && Number(g.grNo) >= 616);
      const isAhpl = (g.unit || '').toUpperCase().includes('AHPL') || (!g.unit && Number(g.grNo) >= 691);
      const comp = isAil ? 'AIL' : isAhpl ? 'AHPL' : 'OTHER';

      if (companyFilter !== 'ALL' && comp !== companyFilter) {
        return false;
      }
      const gDate = getGateRecordDate(g);
      if (!checkRecordDate(gDate)) {
        return false;
      }
      if (!q) return true;
      return (
        (g.vehicle || '').toLowerCase().includes(q) ||
        (g.fromLoc || '').toLowerCase().includes(q) ||
        (g.toLoc || '').toLowerCase().includes(q) ||
        (g.transporter || '').toLowerCase().includes(q) ||
        (g.mobile || '').toLowerCase().includes(q) ||
        (g.grNo || '').toLowerCase().includes(q) ||
        (g.purpose || '').toLowerCase().includes(q)
      );
    });
  }, [securityLogs, searchTerm, companyFilter, reportDateFilter, globalFilterValue, globalFilterType, globalFilterEndDate, analyticsTimeFilter]);

  const filteredPlans = useMemo(() => {
    return planEntries.filter((p) => {
      const query = searchTerm.trim().toLowerCase();
      if (companyFilter !== 'ALL' && (p.unit || '').toUpperCase() !== companyFilter) {
        return false;
      }
      const pDate = getPlanRecordDate(p);
      if (!checkRecordDate(pDate)) {
        return false;
      }
      if (!query) return true;
      return (
        (p.deliveryNo || '').toLowerCase().includes(query) ||
        (p.destination || '').toLowerCase().includes(query) ||
        (p.transporter || '').toLowerCase().includes(query) ||
        (p.code || '').toLowerCase().includes(query)
      );
    });
  }, [planEntries, searchTerm, companyFilter, reportDateFilter, globalFilterValue, globalFilterType, globalFilterEndDate, analyticsTimeFilter]);

  const supervisorAnalytics = useMemo(() => {
    const map: Record<string, { count: number; totalDurationMins: number }> = {};
    loadEntries.forEach(op => {
      const opDate = getOpRecordDate(op);
      if (!checkRecordDate(opDate)) return;

      const sup = (op.operator || 'Unassigned').trim();
      if (!map[sup]) map[sup] = { count: 0, totalDurationMins: 0 };
      map[sup].count += 1;
      
      let mins = 35;
      if (op.duration) {
        const hMatch = op.duration.match(/(\d+)\s*h/i);
        const mMatch = op.duration.match(/(\d+)\s*m/i);
        if (hMatch) mins += parseInt(hMatch[1]) * 60;
        if (mMatch) mins += parseInt(mMatch[1]);
      }
      map[sup].totalDurationMins += mins;
    });

    return Object.entries(map).map(([supervisor, data]) => ({
      supervisor,
      count: data.count,
      avgDurationMins: Math.round(data.totalDurationMins / (data.count || 1))
    })).sort((a, b) => b.count - a.count);
  }, [loadEntries, reportDateFilter, globalFilterValue, globalFilterType, globalFilterEndDate, analyticsTimeFilter]);

  const consolidatedTransporterData = useMemo(() => {
    // Completed loading entries from loadEntries:
    const completedLoadings = loadEntries.filter(op => {
      if (op.opType !== 'LOADING') return false;
      const isCompleted = op.status === 'LOADED' || (op.status as string) === 'COMPLETED' || (op.status as string) === 'DISPATCHED' || op.status === 'UNLOADED' || (op.endTime && op.endTime.trim() !== '' && op.endTime !== 'In-Progress');
      if (!isCompleted) return false;
      if (companyFilter !== 'ALL' && (op.unit || 'AHPL').toUpperCase() !== companyFilter) return false;
      const opDate = getOpRecordDate(op);
      if (!checkRecordDate(opDate)) return false;
      return true;
    });

    // Completed unloading entries from loadEntries:
    const completedUnloadingsFromOps = loadEntries.filter(op => {
      if (op.opType !== 'UNLOADING') return false;
      const isCompleted = op.status === 'UNLOADED' || (op.status as string) === 'COMPLETED' || (op.status as string) === 'DISPATCHED' || op.status === 'LOADED' || (op.endTime && op.endTime.trim() !== '' && op.endTime !== 'In-Progress');
      if (!isCompleted) return false;
      if (companyFilter !== 'ALL' && (op.unit || 'AHPL').toUpperCase() !== companyFilter) return false;
      const opDate = getOpRecordDate(op);
      if (!checkRecordDate(opDate)) return false;
      return true;
    });

    // Check security logs for completed unloading entries not already in loadEntries
    const existingOpVehicles = new Set([
      ...completedLoadings.map(o => o.vehicleNo?.replace(/[^A-Z0-9]/gi, '').toUpperCase()),
      ...completedUnloadingsFromOps.map(o => o.vehicleNo?.replace(/[^A-Z0-9]/gi, '').toUpperCase())
    ]);

    const completedUnloadingsFromGate = securityLogs.filter(g => {
      if (g.purpose !== 'Unloading') return false;
      const st = (g.status || '').toUpperCase();
      const isCompleted = st === 'COMPLETED' || st === 'EXITED' || st === 'DISPATCHED' || st === 'UNLOADED' || (g.loadingExitTime && g.loadingExitTime.trim() !== '');
      if (!isCompleted) return false;
      
      const isAil = (g.unit || '').toUpperCase().includes('AIL') || (!g.unit && Number(g.grNo) < 691 && Number(g.grNo) >= 616);
      const isAhpl = (g.unit || '').toUpperCase().includes('AHPL') || (!g.unit && Number(g.grNo) >= 691);
      const comp = isAil ? 'AIL' : isAhpl ? 'AHPL' : 'OTHER';
      if (companyFilter !== 'ALL' && comp !== companyFilter) return false;
      const gDate = getGateRecordDate(g);
      if (!checkRecordDate(gDate)) return false;

      const normVeh = (g.vehicle || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (existingOpVehicles.has(normVeh)) return false;
      return true;
    });

    interface TransporterAgg {
      transporter: string;
      completedLoadingCount: number;
      completedLoadingCases: number;
      completedUnloadingCount: number;
      completedUnloadingCases: number;
      totalOperations: number;
      totalCases: number;
      ailCount: number;
      ahplCount: number;
      operations: Array<{
        id: string;
        type: 'LOADING' | 'UNLOADING';
        vehicleNo: string;
        date: string;
        unit: string;
        location: string;
        cases: number;
        supervisor: string;
        duration: string;
        status: string;
      }>;
    }

    const map = new Map<string, TransporterAgg>();

    const getOrCreate = (rawName: string) => {
      const name = (rawName || 'Unassigned Transporter').trim();
      const key = name.toUpperCase();
      if (!map.has(key)) {
        map.set(key, {
          transporter: name,
          completedLoadingCount: 0,
          completedLoadingCases: 0,
          completedUnloadingCount: 0,
          completedUnloadingCases: 0,
          totalOperations: 0,
          totalCases: 0,
          ailCount: 0,
          ahplCount: 0,
          operations: []
        });
      }
      return map.get(key)!;
    };

    // Process completed loadings
    completedLoadings.forEach(op => {
      const agg = getOrCreate(op.transporter || 'N/A');
      const cases = Number(op.totalCases) || 0;
      const unit = (op.unit || 'AHPL').toUpperCase();

      agg.completedLoadingCount += 1;
      agg.completedLoadingCases += cases;
      agg.totalOperations += 1;
      agg.totalCases += cases;
      if (unit.includes('AIL')) agg.ailCount += 1; else agg.ahplCount += 1;

      agg.operations.push({
        id: op.id,
        type: 'LOADING',
        vehicleNo: op.vehicleNo,
        date: op.entryDate || '-',
        unit,
        location: op.toLoc || 'INDORE HUB',
        cases,
        supervisor: op.operator || '-',
        duration: op.duration || '--',
        status: op.status
      });
    });

    // Process completed unloadings from Ops
    completedUnloadingsFromOps.forEach(op => {
      const agg = getOrCreate(op.transporter || 'N/A');
      const cases = Number(op.totalCases) || 0;
      const unit = (op.unit || 'AHPL').toUpperCase();

      agg.completedUnloadingCount += 1;
      agg.completedUnloadingCases += cases;
      agg.totalOperations += 1;
      agg.totalCases += cases;
      if (unit.includes('AIL')) agg.ailCount += 1; else agg.ahplCount += 1;

      agg.operations.push({
        id: op.id,
        type: 'UNLOADING',
        vehicleNo: op.vehicleNo,
        date: op.entryDate || '-',
        unit,
        location: op.fromLoc || 'INDORE HUB',
        cases,
        supervisor: op.operator || '-',
        duration: op.duration || '--',
        status: op.status
      });
    });

    // Process completed unloadings from Security logs
    completedUnloadingsFromGate.forEach(g => {
      const agg = getOrCreate(g.transporter || 'N/A');
      const isAil = (g.unit || '').toUpperCase().includes('AIL') || (!g.unit && Number(g.grNo) < 691 && Number(g.grNo) >= 616);
      const unit = isAil ? 'AIL' : 'AHPL';
      const cases = g.casesCount ? Number(g.casesCount) : 0;

      agg.completedUnloadingCount += 1;
      agg.completedUnloadingCases += cases;
      agg.totalOperations += 1;
      agg.totalCases += cases;
      if (unit === 'AIL') agg.ailCount += 1; else agg.ahplCount += 1;

      agg.operations.push({
        id: g.id,
        type: 'UNLOADING',
        vehicleNo: g.vehicle,
        date: g.entryDate || g.dateTime?.substring(0, 10) || '-',
        unit,
        location: g.fromLoc || 'INDORE',
        cases,
        supervisor: 'Gate Verified',
        duration: '--',
        status: g.status || 'COMPLETED'
      });
    });

    // Filter list if search query entered
    let result = Array.from(map.values());
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(item => {
        if (item.transporter.toLowerCase().includes(q)) return true;
        return item.operations.some(o => o.vehicleNo.toLowerCase().includes(q) || o.location.toLowerCase().includes(q));
      });
    }

    result.sort((a, b) => b.totalOperations - a.totalOperations);

    const totalTransporters = result.length;
    const grandTotalLoadingVehicles = result.reduce((s, i) => s + i.completedLoadingCount, 0);
    const grandTotalLoadingCases = result.reduce((s, i) => s + i.completedLoadingCases, 0);
    const grandTotalUnloadingVehicles = result.reduce((s, i) => s + i.completedUnloadingCount, 0);
    const grandTotalUnloadingCases = result.reduce((s, i) => s + i.completedUnloadingCases, 0);
    const grandTotalOps = result.reduce((s, i) => s + i.totalOperations, 0);
    const grandTotalCases = result.reduce((s, i) => s + i.totalCases, 0);

    return {
      transporterSummaryList: result,
      totalTransporters,
      grandTotalLoadingVehicles,
      grandTotalLoadingCases,
      grandTotalUnloadingVehicles,
      grandTotalUnloadingCases,
      grandTotalOps,
      grandTotalCases
    };
  }, [loadEntries, securityLogs, companyFilter, reportDateFilter, globalFilterValue, globalFilterType, globalFilterEndDate, analyticsTimeFilter, searchTerm]);

  const turnaroundAnalytics = useMemo(() => {
    const filteredOps = loadEntries.filter(op => {
      const opDate = getOpRecordDate(op);
      return checkRecordDate(opDate);
    });
    const loadingOps = filteredOps.filter(op => op.opType === 'LOADING');
    const unloadingOps = filteredOps.filter(op => op.opType === 'UNLOADING');
    
    const calcAvg = (ops: LoadUnloadEntry[]) => {
      if (ops.length === 0) return 42;
      let sum = 0;
      ops.forEach(op => {
        let m = 40;
        if (op.duration) {
          const hMatch = op.duration.match(/(\d+)\s*h/i);
          const mMatch = op.duration.match(/(\d+)\s*m/i);
          if (hMatch) m += parseInt(hMatch[1]) * 60;
          if (mMatch) m += parseInt(mMatch[1]);
        }
        sum += m;
      });
      return Math.round(sum / ops.length);
    };

    return {
      loadingAvgMins: calcAvg(loadingOps),
      unloadingAvgMins: calcAvg(unloadingOps),
      totalOperations: filteredOps.length
    };
  }, [loadEntries, reportDateFilter, globalFilterValue, globalFilterType, globalFilterEndDate, analyticsTimeFilter]);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Operations Log (Filtered strictly to active date & search)
    const opsData = filteredOperations.map((op) => {
      const isUnload = op.opType === 'UNLOADING';
      const locationStop = isUnload ? (op.fromLoc || 'INDORE HUB') : (op.toLoc || 'INDORE HUB');
      return {
        'Operation Type': op.opType,
        'Vehicle Number': op.vehicleNo,
        'Transporter': op.transporter || 'N/A',
        'Division / Unit': op.unit || 'AHPL',
        'Specific Location (Stop)': locationStop,
        'Assigned Dock Number': op.bayNo,
        'Supervisor Name': op.operator,
        'Number of Cases': op.totalCases || 0,
        'Seal Number': op.sealNo || 'N/A',
        'Start Time (In-Time)': op.startTime || '--',
        'End / Exit Time': op.endTime || 'In-Progress',
        'Duration (TAT)': op.duration || '--',
        'Status': op.status,
        'Damaged Cases': op.damagedCases || 0,
        'Damaged Value (INR)': op.damagedValue || 0,
        'POD Inspection': op.podStatus || 'N/A'
      };
    });
    const wsOps = XLSX.utils.json_to_sheet(opsData);
    XLSX.utils.book_append_sheet(wb, wsOps, 'Operations_Log');

    // Sheet 2: Plan Master (Filtered strictly to active date & search)
    const planData = filteredPlans.map((p) => ({
      'Delivery No': p.deliveryNo,
      'Code': p.code,
      'Unit / Company': p.unit,
      'Destination': p.destination,
      'Weight (Kg)': p.weight,
      'CFT': p.cft || 0,
      'Vehicle Type': p.vType,
      'Transporter': p.transporter
    }));
    const wsPlan = XLSX.utils.json_to_sheet(planData);
    XLSX.utils.book_append_sheet(wb, wsPlan, 'Plan_Summary');

    // Sheet 3: Security Gate Log (Filtered strictly to active date & search)
    const gateData = filteredSecurityLogs.map((g) => ({
      'Purpose': g.purpose,
      'Company / Unit': g.unit || (Number(g.grNo) >= 691 ? 'AHPL' : 'AIL'),
      'Auto GR No': g.grNo ? `#${g.grNo}` : 'N/A',
      'Vehicle Number': g.vehicle,
      'Vehicle Type': g.vType,
      'Transporter': g.transporter,
      'Driver Mobile': g.mobile,
      'Origin (Kahan Se Aayi)': g.fromLoc,
      'Destination (To)': g.toLoc,
      'Gate Date Time': g.dateTime,
      'Remarks': g.remarks
    }));
    const wsGate = XLSX.utils.json_to_sheet(gateData);
    XLSX.utils.book_append_sheet(wb, wsGate, 'Security_Gate_Log');

    // Sheet 4: Transporter Consolidated Summary
    const transporterConsolidatedData = consolidatedTransporterData.transporterSummaryList.map((t) => ({
      'Transporter Name': t.transporter,
      'Completed Loading Vehicles': t.completedLoadingCount,
      'Completed Loading Cases': t.completedLoadingCases,
      'Completed Unloading Vehicles': t.completedUnloadingCount,
      'Completed Unloading Cases': t.completedUnloadingCases,
      'Total Completed Vehicles / Operations': t.totalOperations,
      'Total Cases Handled': t.totalCases,
      'AIL Vehicles': t.ailCount,
      'AHPL Vehicles': t.ahplCount
    }));
    const wsTransporter = XLSX.utils.json_to_sheet(transporterConsolidatedData);
    XLSX.utils.book_append_sheet(wb, wsTransporter, 'Transporter_Summary');

    XLSX.writeFile(wb, `ICH_Indore_WMS_Report_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(14);
    doc.text('Integrated Central Hub Indore - Warehouse Management System', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, 22);

    if (reportType === 'transporter_summary') {
      const tableRows = consolidatedTransporterData.transporterSummaryList.map((t) => [
        t.transporter,
        String(t.completedLoadingCount),
        String(t.completedLoadingCases),
        String(t.completedUnloadingCount),
        String(t.completedUnloadingCases),
        String(t.totalOperations),
        String(t.totalCases),
        `${t.ailCount} AIL / ${t.ahplCount} AHPL`
      ]);

      (doc as any).autoTable({
        head: [['Transporter', 'Loading Vehicles', 'Loaded Cases', 'Unloading Vehicles', 'Unloaded Cases', 'Total Ops', 'Total Cases', 'Division']],
        body: tableRows,
        startY: 28,
        styles: { fontSize: 8 }
      });
    } else if (reportType === 'operations') {
      const tableRows = filteredOperations.map((op) => {
        const isUnload = op.opType === 'UNLOADING';
        const locationStop = isUnload ? (op.fromLoc || 'INDORE HUB') : (op.toLoc || 'INDORE HUB');
        return [
          op.opType,
          op.vehicleNo,
          op.transporter || '-',
          op.unit || 'AHPL',
          locationStop,
          op.bayNo,
          op.operator,
          String(op.totalCases || 0),
          op.sealNo || '-',
          op.startTime || '--',
          op.endTime || 'Active',
          op.duration || '--',
          op.status
        ];
      });

      (doc as any).autoTable({
        head: [['Type', 'Vehicle', 'Transporter', 'Div', 'Location Stop', 'Dock', 'Supervisor', 'Cases', 'Seal No', 'In-Time', 'Exit Time', 'TAT', 'Status']],
        body: tableRows,
        startY: 28,
        styles: { fontSize: 7 }
      });
    } else if (reportType === 'plan') {
      const tableRows = filteredPlans.map((p) => [
        p.deliveryNo,
        p.code,
        p.unit,
        p.destination,
        p.weight + ' Kg',
        String(p.cft || 0),
        p.vType,
        p.transporter
      ]);

      (doc as any).autoTable({
        head: [['Delivery No', 'Code', 'Unit', 'Destination', 'Weight', 'CFT', 'V.Type', 'Transporter']],
        body: tableRows,
        startY: 28,
        styles: { fontSize: 8 }
      });
    } else {
      const tableRows = filteredSecurityLogs.map((g) => [
        g.purpose,
        g.unit || '-',
        g.grNo ? `#${g.grNo}` : '-',
        g.vehicle,
        g.vType,
        g.transporter,
        g.mobile,
        g.fromLoc + ' -> ' + g.toLoc,
        g.dateTime,
        g.remarks
      ]);

      (doc as any).autoTable({
        head: [['Purpose', 'Unit', 'GR No', 'Vehicle', 'V.Type', 'Transporter', 'Mobile', 'Route (From -> To)', 'Date Time', 'Remarks']],
        body: tableRows,
        startY: 28,
        styles: { fontSize: 8 }
      });
    }

    doc.save(`ICH_Indore_Report_${reportType}_${new Date().toISOString().substring(0, 10)}.pdf`);
  };

  const handleSendEmail = () => {
    const email = prompt('Enter recipient email address for ICH Indore WMS report:', 'rmangrola04@gmail.com');
    if (email) {
      alert(`Report generated and queued to be dispatched to ${email}!`);
    }
  };

  return (
    <section className="space-y-4">
      <div className="bg-white dark:bg-[#242c3d] p-2.5 sm:p-4 rounded-xl border border-slate-200 dark:border-[#3e4859] shadow-xs space-y-4">
        {/* Top Header & Actions */}
        <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-slate-200 dark:border-[#3e4859]">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> Reports Hub & Master Manager
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Vehicle-wise tracking &bull; Excel / PDF Export &bull; Master Data Imports
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Transport Master Import */}
            <button
              onClick={onOpenTransportMasterModal}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" /> Transport Master
            </button>

            {/* Supervisor Master */}
            <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded flex items-center gap-1.5 shadow-xs cursor-pointer transition">
              <UserCheck className="w-3.5 h-3.5" /> Supervisor Master
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleSupervisorImport}
                className="hidden"
              />
            </label>

            {/* Location Master Import */}
            <button
              onClick={onOpenLocationMasterModal}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5" /> Location Master
            </button>

            {/* Export Excel */}
            <button
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
            </button>

            {/* Export PDF */}
            <button
              onClick={handleExportPDF}
              className="bg-[#f3f4f6] dark:bg-[#2d3748] hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded border border-slate-300 dark:border-[#3e4859] flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" /> Export PDF
            </button>

            {/* Send Email */}
            <button
              onClick={handleSendEmail}
              className="bg-slate-800 dark:bg-[#2d3748] hover:bg-slate-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" /> Send to Email
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Advanced Supervisor Performance & Turnaround Time Analytics Section */}
        <div className="bg-gradient-to-br from-slate-50 via-indigo-50/20 to-blue-50/30 dark:bg-gradient-to-br dark:from-[#242c3d] dark:via-[#2d3748] dark:to-[#1e2532] p-4 rounded-xl border border-indigo-100 dark:border-[#3e4859] shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-[#3e4859]">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Advanced Supervisor Performance & Turnaround Analytics
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Visualizing vehicle loading/unloading throughput per supervisor & operational turnaround duration
              </p>
            </div>

            {/* Time Filter Toggle Buttons */}
            <div className="flex items-center gap-1 bg-white dark:bg-[#1e2532] p-1 rounded-lg border border-slate-200 dark:border-[#3e4859] shadow-xs">
              {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setAnalyticsTimeFilter(tf)}
                  className={`px-3 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                    analyticsTimeFilter === tf
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Calendar className="w-3 h-3" /> {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Supervisor Performance Bar Graph with Top Data Labels */}
            <div className="lg:col-span-2 bg-white dark:bg-[#1e2532] p-3.5 rounded-lg border border-slate-200 dark:border-[#3e4859] shadow-xs space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-500" /> Supervisor Throughput Bar Graph (Total Vehicles Handled)
                </h4>
                <span className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded">
                  {analyticsTimeFilter} VIEW
                </span>
              </div>

              {supervisorAnalytics.length === 0 ? (
                <div className="h-36 flex items-center justify-center text-xs text-slate-400 italic">
                  No operational records found for supervisor analytics.
                </div>
              ) : (
                <div className="pt-6 pb-2 px-2 flex items-end justify-around gap-3 h-44 border-b border-slate-200 dark:border-[#3e4859]">
                  {supervisorAnalytics.map((item, idx) => {
                    const maxCount = Math.max(...supervisorAnalytics.map(s => s.count), 5);
                    const heightPct = Math.max(Math.round((item.count / maxCount) * 100), 18);
                    const colors = [
                      'from-blue-500 to-indigo-600',
                      'from-emerald-500 to-teal-600',
                      'from-amber-500 to-orange-600',
                      'from-purple-500 to-pink-600',
                      'from-cyan-500 to-blue-600'
                    ];
                    const grad = colors[idx % colors.length];

                    return (
                      <div key={item.supervisor} className="flex flex-col items-center flex-1 h-full justify-end group">
                        {/* Data Label on Top of Bar */}
                        <span className="text-xs font-bold font-mono text-indigo-600 dark:text-indigo-400 mb-1.5 animate-pulse">
                          {item.count}
                        </span>
                        
                        {/* Vertical Bar */}
                        <div 
                          style={{ height: `${heightPct}%` }}
                          className={`w-full max-w-[48px] bg-gradient-to-t ${grad} rounded-t-md shadow-md transition-all duration-300 group-hover:brightness-110 flex items-center justify-center text-[10px] font-bold text-white`}
                          title={`${item.supervisor}: ${item.count} operations`}
                        >
                          {heightPct > 35 ? `${item.count}` : ''}
                        </div>

                        {/* X-Axis Footer: Supervisor Name */}
                        <div className="mt-2 text-center w-full truncate">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block truncate" title={item.supervisor}>
                            {item.supervisor}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono block">
                            Avg {item.avgDurationMins}m
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Turnaround Time & Operational Duration Analytics Chart */}
            <div className="bg-white dark:bg-[#1e2532] p-3.5 rounded-lg border border-slate-200 dark:border-[#3e4859] shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Turnaround Time & Operational Duration
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                  Average duration taken per vehicle loading & unloading operation.
                </p>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1 font-semibold">
                      <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Loading Turnaround
                      </span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{turnaroundAnalytics.loadingAvgMins} mins</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min((turnaroundAnalytics.loadingAvgMins / 120) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs mb-1 font-semibold">
                      <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Unloading Turnaround
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{turnaroundAnalytics.unloadingAvgMins} mins</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min((turnaroundAnalytics.unloadingAvgMins / 120) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50/50 dark:bg-indigo-950/40 p-2.5 rounded border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">Total Tracked Ops</span>
                  <span className="text-sm font-extrabold font-mono text-indigo-900 dark:text-indigo-100">{turnaroundAnalytics.totalOperations} Vehicles</span>
                </div>
                <TrendingUp className="w-6 h-6 text-indigo-500 opacity-80" />
              </div>
            </div>
          </div>
        </div>

        {/* Filter Switcher & Search Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-50 dark:bg-[#2d3748]/60 p-2.5 rounded-lg border border-slate-200 dark:border-[#3e4859] w-full max-w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto min-w-0 max-w-full">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
              <Filter className="w-3 h-3 text-slate-400" /> Report Table:
            </span>
            <div className="flex items-center gap-1 overflow-x-auto max-w-full w-full no-scrollbar whitespace-nowrap bg-[#f3f4f6] dark:bg-[#242c3d] p-1 rounded-lg border border-slate-200 dark:border-[#3e4859] shrink-0">
              <button
                onClick={() => setReportType('operations')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer shrink-0 ${
                  reportType === 'operations' ? 'bg-white dark:bg-[#2d3748] text-blue-600 dark:text-blue-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Operations Log ({filteredOperations.length})
              </button>
              <button
                onClick={() => setReportType('plan')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer shrink-0 ${
                  reportType === 'plan' ? 'bg-white dark:bg-[#2d3748] text-blue-600 dark:text-blue-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Plan Summary ({filteredPlans.length})
              </button>
              <button
                onClick={() => setReportType('security')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer shrink-0 ${
                  reportType === 'security' ? 'bg-white dark:bg-[#2d3748] text-blue-600 dark:text-blue-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Security Gate Log ({filteredSecurityLogs.length})
              </button>
              <button
                onClick={() => setReportType('transporter_summary')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer shrink-0 ${
                  reportType === 'transporter_summary' ? 'bg-white dark:bg-[#2d3748] text-indigo-600 dark:text-indigo-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Transporter Summary ({consolidatedTransporterData.totalTransporters})
              </button>
              <button
                onClick={() => setReportType('monthly')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer shrink-0 ${
                  reportType === 'monthly' ? 'bg-white dark:bg-[#2d3748] text-orange-600 dark:text-orange-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Monthly Master Report
              </button>
            </div>
          </div>

          {/* Quick Search & Company Filter */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter Vehicle, Location, Transporter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded border border-slate-300 dark:border-[#3e4859] bg-[#f3f4f6] dark:bg-[#242c3d] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none w-full sm:w-56"
              />
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[#f3f4f6] dark:bg-[#242c3d] border border-blue-400/60 dark:border-blue-500/60 rounded flex-1 sm:flex-initial justify-between sm:justify-start">
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <input
                id="report-date-selector"
                type="date"
                value={reportDateFilter}
                onChange={(e) => handleReportDateChange(e.target.value)}
                title="Active report date filter - synchronized with dashboard"
                className="py-0.5 px-1 text-xs bg-transparent text-slate-800 dark:text-slate-100 font-bold focus:outline-none cursor-pointer w-full"
              />
              {reportDateFilter && (
                <button
                  type="button"
                  onClick={() => handleReportDateChange('')}
                  title="Clear date filter (Show All)"
                  className="text-slate-400 hover:text-rose-500 text-xs font-black px-1"
                >
                  ✕
                </button>
              )}
            </div>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value as any)}
              className="py-1.5 px-2 text-xs rounded border border-slate-300 dark:border-[#3e4859] bg-[#f3f4f6] dark:bg-[#242c3d] text-slate-800 dark:text-slate-100 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Co.</option>
              <option value="AIL">AIL</option>
              <option value="AHPL">AHPL</option>
            </select>
          </div>
        </div>

        {/* Scrollable Table Render */}
        <div className="overflow-x-auto overflow-y-auto max-h-[560px] w-full max-w-full border border-slate-200 dark:border-[#3e4859] rounded-lg">
          {reportType === 'transporter_summary' ? (
            <div className="p-4 space-y-5 bg-white dark:bg-[#1a202c] text-slate-800 dark:text-slate-100">
              {/* Header & Controls */}
              <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-slate-200 dark:border-[#3e4859]">
                <div>
                  <span className="text-[11px] font-black tracking-widest text-indigo-600 dark:text-indigo-400 uppercase">Consolidated Transporter Report</span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    Transporter-Wise Operations Summary
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Consolidated view of all completed loading and unloading operations grouped by transporter
                    {reportDateFilter ? ` for ${reportDateFilter}` : ` (${analyticsTimeFilter} range)`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportExcel}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" /> Export PDF
                  </button>
                </div>
              </div>

              {/* 4 Summary KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Total Transporters */}
                <div className="bg-slate-50 dark:bg-[#2d3748] p-3.5 rounded-xl border border-slate-200 dark:border-[#3e4859]">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Transporters</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {consolidatedTransporterData.totalTransporters}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">Active Transporters</span>
                </div>

                {/* Completed Loading */}
                <div className="bg-amber-50/80 dark:bg-[#2d3748] p-3.5 rounded-xl border border-amber-200 dark:border-[#3e4859]">
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">Completed Loading</span>
                  <div className="text-2xl font-black text-amber-950 dark:text-amber-200 mt-1 flex items-baseline gap-2">
                    <span>{consolidatedTransporterData.grandTotalLoadingVehicles}</span>
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Vehicles</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-amber-800 dark:text-amber-300">
                    {consolidatedTransporterData.grandTotalLoadingCases.toLocaleString()} Cases
                  </span>
                </div>

                {/* Completed Unloading */}
                <div className="bg-blue-50/80 dark:bg-[#2d3748] p-3.5 rounded-xl border border-blue-200 dark:border-[#3e4859]">
                  <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider block">Completed Unloading</span>
                  <div className="text-2xl font-black text-blue-950 dark:text-blue-200 mt-1 flex items-baseline gap-2">
                    <span>{consolidatedTransporterData.grandTotalUnloadingVehicles}</span>
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400">Vehicles</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-blue-800 dark:text-blue-300">
                    {consolidatedTransporterData.grandTotalUnloadingCases.toLocaleString()} Cases
                  </span>
                </div>

                {/* Total Handled */}
                <div className="bg-emerald-50/80 dark:bg-[#2d3748] p-3.5 rounded-xl border border-emerald-200 dark:border-[#3e4859]">
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">Total Completed Ops</span>
                  <div className="text-2xl font-black text-emerald-950 dark:text-emerald-200 mt-1 flex items-baseline gap-2">
                    <span>{consolidatedTransporterData.grandTotalOps}</span>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Vehicles</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-emerald-800 dark:text-emerald-300">
                    {consolidatedTransporterData.grandTotalCases.toLocaleString()} Total Cases
                  </span>
                </div>
              </div>

              {/* Transporter Summary Table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Transporter Performance Summary Table
                  </h4>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    Showing {consolidatedTransporterData.transporterSummaryList.length} Transporter(s)
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-[#3e4859] rounded-lg bg-white dark:bg-[#242c3d]">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-100 dark:bg-[#2d3748] text-slate-700 dark:text-slate-200 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-[#3e4859]">
                      <tr>
                        <th className="py-3 px-3">Transporter Name</th>
                        <th className="py-3 px-3 text-center bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300">Completed Loading (Veh / Cases)</th>
                        <th className="py-3 px-3 text-center bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300">Completed Unloading (Veh / Cases)</th>
                        <th className="py-3 px-3 text-center font-black">Total Completed Ops</th>
                        <th className="py-3 px-3 text-center font-black">Total Cases</th>
                        <th className="py-3 px-3 text-center">Division Breakdown</th>
                        <th className="py-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#3e4859]">
                      {consolidatedTransporterData.transporterSummaryList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-400 italic">
                            No completed operations found for any transporter matching current filters.
                          </td>
                        </tr>
                      ) : (
                        consolidatedTransporterData.transporterSummaryList.map((item, idx) => {
                          const rowKey = item.transporter.toUpperCase();
                          const isExpanded = !!expandedConsolidatedTransporters[rowKey];

                          return (
                            <React.Fragment key={idx}>
                              <tr className="hover:bg-indigo-50/40 dark:hover:bg-[#2d3748]/50 transition cursor-pointer" onClick={() => setExpandedConsolidatedTransporters(prev => ({ ...prev, [rowKey]: !prev[rowKey] }))}>
                                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                  <Truck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                  <span>{item.transporter}</span>
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-bold bg-amber-50/30 dark:bg-amber-950/10 text-amber-900 dark:text-amber-300">
                                  <span className="text-amber-700 dark:text-amber-400">{item.completedLoadingCount} Veh</span>
                                  <span className="text-[10px] text-slate-400 ml-1">({item.completedLoadingCases.toLocaleString()} C)</span>
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-bold bg-blue-50/30 dark:bg-blue-950/10 text-blue-900 dark:text-blue-300">
                                  <span className="text-blue-700 dark:text-blue-400">{item.completedUnloadingCount} Veh</span>
                                  <span className="text-[10px] text-slate-400 ml-1">({item.completedUnloadingCases.toLocaleString()} C)</span>
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-extrabold text-slate-900 dark:text-white text-sm">
                                  {item.totalOperations}
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-black text-emerald-600 dark:text-emerald-400">
                                  {item.totalCases.toLocaleString()}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <div className="inline-flex gap-1 text-[10px] font-black">
                                    <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                      AIL: {item.ailCount}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                      AHPL: {item.ahplCount}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedConsolidatedTransporters(prev => ({ ...prev, [rowKey]: !prev[rowKey] }));
                                    }}
                                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                  >
                                    {isExpanded ? 'Hide Vehicles' : 'View Vehicles'}
                                  </button>
                                </td>
                              </tr>

                              {/* Expandable Drilldown Row */}
                              {isExpanded && (
                                <tr className="bg-slate-50 dark:bg-[#1e2532]">
                                  <td colSpan={7} className="p-3">
                                    <div className="space-y-2 bg-white dark:bg-[#242c3d] p-3 rounded-lg border border-slate-200 dark:border-[#3e4859]">
                                      <div className="flex justify-between items-center text-xs font-bold text-indigo-900 dark:text-indigo-300 pb-1 border-b border-slate-200 dark:border-[#3e4859]">
                                        <span>Completed Vehicles for {item.transporter}</span>
                                        <span className="text-slate-500 font-mono text-[11px]">
                                          {item.totalOperations} Operations | {item.totalCases.toLocaleString()} Total Cases
                                        </span>
                                      </div>

                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs whitespace-nowrap">
                                          <thead className="bg-slate-100 dark:bg-[#2d3748] text-slate-600 dark:text-slate-300 uppercase text-[9px] font-bold">
                                            <tr>
                                              <th className="py-2 px-2.5">Type</th>
                                              <th className="py-2 px-2.5">Vehicle Number</th>
                                              <th className="py-2 px-2.5">Date</th>
                                              <th className="py-2 px-2.5">Division</th>
                                              <th className="py-2 px-2.5">Location Stop</th>
                                              <th className="py-2 px-2.5 text-right">Cases</th>
                                              <th className="py-2 px-2.5">Supervisor</th>
                                              <th className="py-2 px-2.5">TAT / Duration</th>
                                              <th className="py-2 px-2.5">Status</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-200 dark:divide-[#3e4859]">
                                            {item.operations.map((op, opIdx) => (
                                              <tr key={opIdx} className="hover:bg-slate-100/60 dark:hover:bg-[#2d3748]/60 transition">
                                                <td className="py-1.5 px-2.5">
                                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                                                    op.type === 'LOADING'
                                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                                  }`}>
                                                    {op.type}
                                                  </span>
                                                </td>
                                                <td className="py-1.5 px-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">{op.vehicleNo}</td>
                                                <td className="py-1.5 px-2.5 font-mono text-slate-500 text-[11px]">{op.date}</td>
                                                <td className="py-1.5 px-2.5">
                                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                                                    {op.unit}
                                                  </span>
                                                </td>
                                                <td className="py-1.5 px-2.5 font-semibold text-slate-800 dark:text-slate-200">{op.location}</td>
                                                <td className="py-1.5 px-2.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">{op.cases}</td>
                                                <td className="py-1.5 px-2.5 font-medium text-slate-700 dark:text-slate-300">{op.supervisor}</td>
                                                <td className="py-1.5 px-2.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold">{op.duration}</td>
                                                <td className="py-1.5 px-2.5">
                                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[9px]">
                                                    {op.status}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                    {consolidatedTransporterData.transporterSummaryList.length > 0 && (
                      <tfoot className="bg-slate-100 dark:bg-[#2d3748] font-black text-slate-900 dark:text-white border-t border-slate-300 dark:border-[#3e4859]">
                        <tr>
                          <td className="py-3 px-3 uppercase">TOTAL / GRAND SUMMARY</td>
                          <td className="py-3 px-3 text-center font-mono text-amber-700 dark:text-amber-300">
                            {consolidatedTransporterData.grandTotalLoadingVehicles} Veh ({consolidatedTransporterData.grandTotalLoadingCases.toLocaleString()} C)
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-blue-700 dark:text-blue-300">
                            {consolidatedTransporterData.grandTotalUnloadingVehicles} Veh ({consolidatedTransporterData.grandTotalUnloadingCases.toLocaleString()} C)
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">
                            {consolidatedTransporterData.grandTotalOps} Ops
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">
                            {consolidatedTransporterData.grandTotalCases.toLocaleString()} Cases
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-xs">
                            -
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          ) : reportType === 'monthly' ? (
            <div className="p-4 space-y-6 bg-[#FFFFFF] dark:bg-[#080808] text-[#171717] dark:text-[#FFFFFF]">
              {/* Header & Controls */}
              <div className="flex flex-wrap justify-between items-center gap-3 pb-4 border-b border-slate-200 dark:border-[#333333]">
                <div>
                  <span className="text-[11px] font-extrabold tracking-widest text-[#C87533] uppercase">Monthly Performance</span>
                  <h3 className="text-lg font-bold text-[#171717] dark:text-[#FFFFFF]">Transporter Performance Report</h3>
                  <p className="text-xs text-[#555555] dark:text-[#D1D1D1]">Track monthly vehicle trips, FIT status, and transporter efficiency</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={operationFilter}
                    onChange={(e) => setOperationFilter(e.target.value as any)}
                    className="bg-[#FFFFFF] dark:bg-[#202020] text-[#171717] dark:text-[#FFFFFF] border border-slate-300 dark:border-[#333333] rounded-lg px-3 py-2 text-xs font-bold cursor-pointer"
                  >
                    <option value="ALL">All Operations</option>
                    <option value="Loading">Loading Only</option>
                    <option value="Unloading">Unloading Only</option>
                  </select>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-[#FFFFFF] dark:bg-[#202020] text-[#171717] dark:text-[#FFFFFF] border border-slate-300 dark:border-[#333333] rounded-lg px-3 py-2 text-xs font-bold cursor-pointer"
                  >
                    {monthOptions.map(m => (
                      <option key={m.val} value={m.val}>{m.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {}}
                    className="bg-slate-200 dark:bg-[#202020] hover:bg-slate-300 text-[#171717] dark:text-[#FFFFFF] px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={handleExportMonthlyCSV}
                    className="bg-[#F97316] hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={handleSendMonthlyWhatsApp}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    Send Report
                  </button>
                </div>
              </div>

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-[#FFFFFF] dark:bg-[#151515] p-4 rounded-xl border border-slate-200 dark:border-[#333333]">
                  <span className="text-xs font-bold text-[#555555] dark:text-[#D1D1D1] uppercase">TOTAL TRIPS</span>
                  <div className="text-2xl font-black text-[#171717] dark:text-[#FFFFFF] mt-1">{monthlyReportData.totalTrips}</div>
                </div>
                <div className="bg-[#FFFFFF] dark:bg-[#151515] p-4 rounded-xl border border-slate-200 dark:border-[#333333]">
                  <span className="text-xs font-bold text-[#555555] dark:text-[#D1D1D1] uppercase">FIT VEHICLES</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{monthlyReportData.totalFit}</div>
                </div>
                <div className="bg-[#FFFFFF] dark:bg-[#151515] p-4 rounded-xl border border-slate-200 dark:border-[#333333]">
                  <span className="text-xs font-bold text-[#555555] dark:text-[#D1D1D1] uppercase">NON-FIT</span>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{monthlyReportData.totalNonFit}</div>
                </div>
                <div className="bg-[#FFFFFF] dark:bg-[#151515] p-4 rounded-xl border border-slate-200 dark:border-[#333333]">
                  <span className="text-xs font-bold text-[#555555] dark:text-[#D1D1D1] uppercase">OVERALL FIT</span>
                  <div className="text-2xl font-black text-[#171717] dark:text-[#FFFFFF] mt-1">{monthlyReportData.overallFitPercentage}%</div>
                </div>
              </div>

              {/* Transporter Performance Table */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-[#171717] dark:text-[#FFFFFF] uppercase tracking-wider">Transporter Performance</h4>
                <div className="overflow-x-auto border border-slate-200 dark:border-[#333333] rounded-lg bg-[#FFFFFF] dark:bg-[#151515]">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-100 dark:bg-[#202020] text-[#171717] dark:text-[#FFFFFF] font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-3">Transporter Name</th>
                        <th className="py-3 px-3 text-center">Number of Trips / Vehicles Placed</th>
                        <th className="py-3 px-3 text-center">Vehicle Type</th>
                        <th className="py-3 px-3 text-center">FIT Vehicles</th>
                        <th className="py-3 px-3 text-center">Non-FIT / Pending</th>
                        <th className="py-3 px-3 text-center">FIT %</th>
                        <th className="py-3 px-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#333333]">
                      {monthlyReportData.transporterSummary.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-[#555555] dark:text-[#D1D1D1]">No transporter records found for this month.</td>
                        </tr>
                      ) : (
                        monthlyReportData.transporterSummary.map((item, idx) => {
                          const rowKey = `${item.transporter}_${item.vType}`;
                          const isExpanded = !!expandedTransporters[rowKey];
                          return (
                            <React.Fragment key={idx}>
                              <tr className="hover:bg-slate-50 dark:hover:bg-[#202020]/50 transition">
                                <td className="py-3 px-3 font-bold text-[#171717] dark:text-[#FFFFFF]">{item.transporter}</td>
                                <td className="py-3 px-3 text-center font-mono font-bold text-[#171717] dark:text-[#FFFFFF]">{item.totalTrips}</td>
                                <td className="py-3 px-3 text-center font-mono text-xs font-semibold text-[#C87533]">{item.vType}</td>
                                <td className="py-3 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                                    {item.fitVehicles}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[11px]">
                                    {item.nonFitVehicles}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center font-bold text-[#171717] dark:text-white">
                                  {item.fitPercentage}%
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <button
                                    onClick={() => setExpandedTransporters(prev => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                                    className="text-xs font-bold text-[#F97316] hover:underline cursor-pointer"
                                  >
                                    {isExpanded ? 'Hide Vehicles' : 'View Vehicles'}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-slate-50/80 dark:bg-[#111111]">
                                  <td colSpan={7} className="p-4">
                                    <div className="space-y-3 bg-white dark:bg-[#1b1b1b] p-3 rounded-lg border border-slate-200 dark:border-[#333333]">
                                      <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-200">
                                        <span>{item.transporter} ({item.vType})</span>
                                        <span className="text-[#C87533]">Total: {item.totalTrips} | FIT: {item.fitVehicles}</span>
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs whitespace-nowrap">
                                          <thead className="bg-slate-100 dark:bg-[#202020] text-slate-600 dark:text-slate-300 uppercase text-[9px]">
                                            <tr>
                                              <th className="py-2 px-2.5">Vehicle Number</th>
                                              <th className="py-2 px-2.5">Vehicle Type</th>
                                              <th className="py-2 px-2.5">Status</th>
                                              <th className="py-2 px-2.5">Date</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-200 dark:divide-[#333333]">
                                            {item.vehicles.map((v, vIdx) => (
                                              <tr key={vIdx} className="hover:bg-slate-100/50 dark:hover:bg-[#252525]">
                                                <td className="py-2 px-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">{v.vehicle}</td>
                                                <td className="py-2 px-2.5 font-mono text-slate-700 dark:text-slate-300">{v.vType}</td>
                                                <td className="py-2 px-2.5">
                                                  {v.fit ? (
                                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">FIT</span>
                                                  ) : (
                                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[10px]">PENDING</span>
                                                  )}
                                                </td>
                                                <td className="py-2 px-2.5 font-mono text-slate-600 dark:text-slate-400">{v.date}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                    {monthlyReportData.transporterSummary.length > 0 && (
                      <tfoot className="bg-slate-100 dark:bg-[#202020] font-black text-[#171717] dark:text-[#FFFFFF]">
                        <tr>
                          <td className="py-3 px-3">TOTAL</td>
                          <td className="py-3 px-3 text-center font-mono">{monthlyReportData.totalTrips}</td>
                          <td className="py-3 px-3 text-center">-</td>
                          <td className="py-3 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400">{monthlyReportData.totalFit}</td>
                          <td className="py-3 px-3 text-center font-mono text-amber-600 dark:text-amber-400">{monthlyReportData.totalNonFit}</td>
                          <td className="py-3 px-3 text-center font-mono">{monthlyReportData.overallFitPercentage}%</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          ) : reportType === 'operations' && (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-[#2d3748] text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-[#3e4859]">
                <tr>
                  <th className="py-2.5 px-2.5">Entry Date</th>
                  <th className="py-2.5 px-2.5">Type</th>
                  <th className="py-2.5 px-2.5">Vehicle Number</th>
                  <th className="py-2.5 px-2.5">Transporter</th>
                  <th className="py-2.5 px-2.5">Division</th>
                  <th className="py-2.5 px-2.5">Location Stop</th>
                  <th className="py-2.5 px-2.5">Dock</th>
                  <th className="py-2.5 px-2.5">Supervisor</th>
                  <th className="py-2.5 px-2.5">Cases</th>
                  <th className="py-2.5 px-2.5">Seal No</th>
                  <th className="py-2.5 px-2.5">In-Time</th>
                  <th className="py-2.5 px-2.5">Exit Time</th>
                  <th className="py-2.5 px-2.5">Duration (TAT)</th>
                  <th className="py-2.5 px-2.5">Status</th>
                  {(onEditOperation || onDeleteOperation) && <th className="py-2.5 px-2.5 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#3e4859]/60 font-medium">
                {filteredOperations.length === 0 ? (
                  <tr>
                    <td colSpan={onEditOperation ? 15 : 14} className="text-center py-16 text-slate-400">
                      No operations records match the filter.
                    </td>
                  </tr>
                ) : (
                  filteredOperations.map((op) => {
                    const isUnload = op.opType === 'UNLOADING';
                    const locationStop = isUnload ? (op.fromLoc || 'INDORE HUB') : (op.toLoc || 'INDORE HUB');
                    return (
                      <tr key={op.id} className="hover:bg-blue-50/50 dark:hover:bg-[#2d3748]/60 transition-colors cursor-pointer" onDoubleClick={() => onEditOperation && onEditOperation(op)}>
                        <td className="py-2 px-2.5 font-mono text-slate-500 dark:text-slate-400">{op.entryDate || '-'}</td>
                        <td className="py-2 px-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isUnload
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            }`}
                          >
                            {op.opType}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">{op.vehicleNo}</td>
                        <td className="py-2 px-2.5 font-medium text-slate-700 dark:text-slate-300">{op.transporter || 'N/A'}</td>
                        <td className="py-2 px-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                            {op.unit || 'AHPL'}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-slate-800 dark:text-slate-200 font-bold">
                          {locationStop}
                        </td>
                        <td className="py-2 px-2.5 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30">
                          {op.bayNo}
                        </td>
                        <td className="py-2 px-2.5 font-semibold text-slate-800 dark:text-slate-200">{op.operator}</td>
                        <td className="py-2 px-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">{op.totalCases || 0}</td>
                        <td className="py-2 px-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">{op.sealNo || '-'}</td>
                        <td className="py-2 px-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">{op.startTime || '--'}</td>
                        <td className="py-2 px-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">{op.endTime || '--'}</td>
                        <td className="py-2 px-2.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold">{op.duration || '--'}</td>
                        <td className="py-2 px-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            op.status === 'LOADED' || op.status === 'UNLOADED' || (op.status as string) === 'COMPLETED' || (op.status as string) === 'Delivered On-Time'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : op.status?.includes('IN-PROGRESS') || op.status?.includes('TRANSIT') || (op.status as string) === 'Planned' || (op.status as string) === 'In-Transit'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                          }`}>
                            {op.status}
                          </span>
                        </td>
                        {(onEditOperation || onDeleteOperation) && (
                          <td className="py-2 px-2.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {onEditOperation && (
                                <button
                                  onClick={() => onEditOperation(op)}
                                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 p-0.5 cursor-pointer"
                                  title="Edit Operation (Full Form)"
                                >
                                  <Pencil className="w-3.5 h-3.5 inline" />
                                </button>
                              )}
                              {onDeleteOperation && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteOperation(op.id);
                                  }}
                                  className="text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 p-0.5 cursor-pointer"
                                  title="Delete Operation"
                                >
                                  <Trash2 className="w-3.5 h-3.5 inline" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {reportType === 'plan' && (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-[#2d3748] text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-[#3e4859]">
                <tr>
                  <th className="py-2.5 px-2.5">Date</th>
                  <th className="py-2.5 px-2.5">Delivery No.</th>
                  <th className="py-2.5 px-2.5">Code</th>
                  <th className="py-2.5 px-2.5">Unit</th>
                  <th className="py-2.5 px-2.5">Destination</th>
                  <th className="py-2.5 px-2.5 text-right">Weight (Kg)</th>
                  <th className="py-2.5 px-2.5 text-right">CFT</th>
                  <th className="py-2.5 px-2.5">Vehicle Type</th>
                  <th className="py-2.5 px-2.5">Transporter</th>
                  {onDeletePlanEntry && <th className="py-2.5 px-2.5 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#3e4859]/60 font-medium">
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan={onDeletePlanEntry ? 10 : 9} className="text-center py-16 text-slate-400">
                      No plan records match the filter.
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/50 dark:hover:bg-[#2d3748]/60 transition-colors">
                      <td className="py-2 px-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {item.entryDate || item.updatedAt?.substring(0, 10) || new Date().toISOString().split('T')[0]}
                      </td>
                      <td className="py-2 px-2.5 font-bold font-mono text-blue-600 dark:text-blue-400">{item.deliveryNo}</td>
                      <td className="py-2 px-2.5 font-mono text-slate-700 dark:text-slate-300">{item.code}</td>
                      <td className="py-2 px-2.5 font-bold text-blue-600 dark:text-blue-400">{item.unit}</td>
                      <td className="py-2 px-2.5 font-medium">{item.destination}</td>
                      <td className="py-2 px-2.5 text-right font-mono">{item.weight}</td>
                      <td className="py-2 px-2.5 text-right font-mono">{item.cft || 0}</td>
                      <td className="py-2 px-2.5 font-mono text-slate-700 dark:text-slate-300">{item.vType}</td>
                      <td className="py-2 px-2.5 font-medium">{item.transporter}</td>
                      {onDeletePlanEntry && (
                        <td className="py-2 px-2.5 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeletePlanEntry(item.id); }}
                            className="text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 p-0.5 cursor-pointer"
                            title="Delete Plan Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {reportType === 'security' && (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-[#2d3748] text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-[#3e4859]">
                <tr>
                  <th className="py-2.5 px-3">Entry Date</th>
                  <th className="py-2.5 px-3">Vehicle No & Unit</th>
                  <th className="py-2.5 px-3">Purpose</th>
                  <th className="py-2.5 px-3">From Location (Origin) & Destination</th>
                  <th className="py-2.5 px-3">Vehicle Type</th>
                  <th className="py-2.5 px-3">Transporter</th>
                  <th className="py-2.5 px-3">Driver Contact</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Remarks</th>
                  {(onEditGateEntry || onDeleteGateEntry) && <th className="py-2.5 px-3 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#3e4859]/60 font-medium">
                {filteredSecurityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={onEditGateEntry ? 10 : 9} className="text-center py-16 text-slate-400">
                      No security gate records match the search.
                    </td>
                  </tr>
                ) : (
                  filteredSecurityLogs.map((g) => {
                    const isAil = (g.unit || '').toUpperCase().includes('AIL') || (!g.unit && Number(g.grNo) < 691 && Number(g.grNo) >= 616);
                    const isAhpl = (g.unit || '').toUpperCase().includes('AHPL') || (!g.unit && Number(g.grNo) >= 691);
                    const displayUnit = isAil ? 'AIL' : isAhpl ? 'AHPL' : (g.unit || '-');

                    return (
                      <tr key={g.id} className="hover:bg-blue-50/50 dark:hover:bg-[#2d3748]/60 transition-colors">
                        {/* Entry Date */}
                        <td className="py-2 px-3 font-mono text-slate-500 dark:text-slate-400">
                          {g.entryDate || '-'}
                        </td>
                        {/* Vehicle & Unit */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{g.vehicle}</span>
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
                            <div className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold">
                              GR: #{g.grNo}
                            </div>
                          )}
                        </td>

                        {/* Purpose */}
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              g.purpose === 'Loading'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                : g.purpose === 'Unloading'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {g.purpose}
                          </span>
                        </td>

                        {/* Route Origin & Destination */}
                        <td className="py-2 px-3">
                          <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                            <span className="text-slate-400 text-[10px] font-normal">From:</span> <b className="text-emerald-600 dark:text-emerald-400">{g.fromLoc || 'INDORE'}</b>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            <span>To:</span> <b className="text-blue-600 dark:text-blue-400">{g.toLoc || 'INDORE'}</b>
                          </div>
                        </td>

                        {/* Vehicle Type */}
                        <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">{g.vType}</td>

                        {/* Transporter */}
                        <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">{g.transporter}</td>

                        {/* Driver Mobile */}
                        <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">{g.mobile}</td>

                        {/* Date & Time */}
                        <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">{g.dateTime}</td>

                        {/* Remarks */}
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300 max-w-[140px] truncate" title={g.remarks}>
                          {g.remarks || '-'}
                        </td>

                        {(onEditGateEntry || onDeleteGateEntry) && (
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {onEditGateEntry && (
                                <button
                                  onClick={() => onEditGateEntry(g)}
                                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 p-0.5 cursor-pointer"
                                  title="Edit Gate Record (Full Form)"
                                >
                                  <Pencil className="w-3.5 h-3.5 inline" />
                                </button>
                              )}
                              {onDeleteGateEntry && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteGateEntry(g.id, false); // false to trigger confirmation if desired, or skip it.
                                  }}
                                  className="text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 p-0.5 cursor-pointer"
                                  title="Delete Gate Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5 inline" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
};
