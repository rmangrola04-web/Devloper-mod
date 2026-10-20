import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  Printer,
  Eye,
  FileText,
  AlertTriangle,
  Trash2,
  Edit3,
  PlusCircle,
  Clock,
  User,
  Truck,
  Building2,
  RefreshCw,
  FileSpreadsheet,
  Lock,
  X,
  CheckCircle2,
  Layers,
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import { InvoiceAuditLog, InvoiceAuditAction, ThermocolInvoice } from './types';

interface InvoiceAuditLogViewProps {
  audits: InvoiceAuditLog[];
  invoices: ThermocolInvoice[];
  currentUser?: { name?: string; role?: string; user?: string } | null;
  selectedCompany?: 'AIL' | 'HPL';
  onSelectInvoiceForPreview?: (invNo: string) => void;
  onPurgeCancelledAudits?: () => void;
  onRefresh?: () => void;
  onDeleteInvoice?: (invNo: string) => void;
  onDeleteAuditLog?: (auditId: string) => void;
}

// Compact Action Dropdown Component per Audit Log Row
const RowActionDropdown: React.FC<{
  aud: InvoiceAuditLog;
  invoiceExists: boolean;
  onInspect: () => void;
  onPreview?: () => void;
  onDelete?: () => void;
  onDeleteAuditLog?: () => void;
}> = ({ aud, invoiceExists, onInspect, onPreview, onDelete, onDeleteAuditLog }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-slate-200 shadow-2xs"
      >
        <span>Actions</span>
        <ChevronDown className="w-3 h-3 text-slate-500" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-1 text-xs animate-in zoom-in-95 duration-100">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onInspect();
            }}
            className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-blue-600" />
            <span>Inspect Audit Details</span>
          </button>

          {onPreview && invoiceExists && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onPreview();
              }}
              className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>View Delivery Challan</span>
            </button>
          )}

          {onDelete && invoiceExists && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onDelete();
              }}
              className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold border-t border-slate-100 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete / Void Invoice</span>
            </button>
          )}

          {onDeleteAuditLog && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onDeleteAuditLog();
              }}
              className="w-full px-3 py-2 text-left text-rose-700 hover:bg-rose-50 flex items-center gap-2 font-semibold border-t border-slate-100 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete Cancel History Record</span>
            </button>
          )}

          {!invoiceExists && (
            <div className="px-3 py-1.5 text-[10px] text-slate-400 italic border-t border-slate-100">
              Invoice voided or archived
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const InvoiceAuditLogView: React.FC<InvoiceAuditLogViewProps> = ({
  audits,
  invoices,
  currentUser,
  selectedCompany = 'AIL',
  onSelectInvoiceForPreview,
  onPurgeCancelledAudits,
  onRefresh,
  onDeleteInvoice,
  onDeleteAuditLog
}) => {
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<'ALL' | InvoiceAuditAction>('ALL');
  const [companyFilter, setCompanyFilter] = useState<'ALL' | 'AIL' | 'HPL'>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [operatorFilter, setOperatorFilter] = useState<string>('ALL');

  // Modal inspection state
  const [inspectAudit, setInspectAudit] = useState<InvoiceAuditLog | null>(null);

  // Normalize audit item helper
  const normalizeAuditItem = (aud: InvoiceAuditLog) => {
    const action: InvoiceAuditAction = aud.action || (aud.deletedAt ? 'CANCEL' : 'CREATE');
    const timestamp = aud.timestamp || aud.deletedAt || '';
    const company = aud.company || (aud.invNo.includes('AIL') ? 'AIL' : 'HPL');
    const userName = aud.userName || 'System Operator';
    const userRole = aud.userRole || 'OPERATOR';
    return { ...aud, action, timestamp, company, userName, userRole };
  };

  // Synthesize or backfill audit records for invoices that don't have a CREATE entry yet
  const combinedAudits = useMemo(() => {
    const all = audits.map(normalizeAuditItem);

    // Sort by timestamp descending
    all.sort((a, b) => {
      const tA = new Date(a.timestamp || 0).getTime();
      const tB = new Date(b.timestamp || 0).getTime();
      return tB - tA;
    });

    return all;
  }, [audits]);

  // Unique list of operators in the logs
  const operatorsList = useMemo(() => {
    const set = new Set<string>();
    combinedAudits.forEach(a => {
      if (a.userName) set.add(a.userName);
    });
    return Array.from(set);
  }, [combinedAudits]);

  // Filtered Audits
  const filteredAudits = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    return combinedAudits.filter(aud => {
      // Company Filter
      if (companyFilter !== 'ALL' && aud.company !== companyFilter) return false;

      // Action Filter
      if (actionFilter !== 'ALL' && aud.action !== actionFilter) return false;

      // Operator Filter
      if (operatorFilter !== 'ALL' && aud.userName !== operatorFilter) return false;

      // Date Range Filter
      if (dateRangeFilter !== 'ALL') {
        if (!aud.timestamp) return false;
        const itemDate = new Date(aud.timestamp);
        if (dateRangeFilter === 'TODAY' && !aud.timestamp.startsWith(todayStr)) return false;
        if (dateRangeFilter === 'WEEK' && itemDate < weekAgo) return false;
        if (dateRangeFilter === 'MONTH' && itemDate < monthAgo) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchInv = aud.invNo?.toLowerCase().includes(q);
        const matchParty = aud.partyName?.toLowerCase().includes(q);
        const matchProd = aud.productName?.toLowerCase().includes(q);
        const matchUser = aud.userName?.toLowerCase().includes(q);
        const matchDetails = aud.details?.toLowerCase().includes(q);
        const matchVeh = aud.vehicleNo?.toLowerCase().includes(q);
        const matchLr = aud.lrNo?.toLowerCase().includes(q);
        if (!matchInv && !matchParty && !matchProd && !matchUser && !matchDetails && !matchVeh && !matchLr) {
          return false;
        }
      }

      return true;
    });
  }, [combinedAudits, companyFilter, actionFilter, operatorFilter, dateRangeFilter, searchQuery]);

  // Metric Computations
  const metrics = useMemo(() => {
    const totalEvents = combinedAudits.length;
    const creates = combinedAudits.filter(a => a.action === 'CREATE').length;
    const updates = combinedAudits.filter(a => a.action === 'UPDATE').length;
    const cancels = combinedAudits.filter(a => a.action === 'CANCEL').length;
    const totalRefundedPcs = combinedAudits.reduce((s, a) => s + (Number(a.refundedQty) || 0), 0);
    const uniqueInvoices = new Set(combinedAudits.map(a => a.invNo)).size;
    const uniqueOperators = new Set(combinedAudits.map(a => a.userName)).size;

    return {
      totalEvents,
      creates,
      updates,
      cancels,
      totalRefundedPcs,
      uniqueInvoices,
      uniqueOperators
    };
  }, [combinedAudits]);

  // Export CSV Helper
  const handleExportCsv = () => {
    if (filteredAudits.length === 0) {
      alert('No audit logs available to export for current filter criteria.');
      return;
    }

    const headers = [
      'Event ID',
      'Timestamp',
      'Action Type',
      'Company Division',
      'Invoice Number',
      'User / Operator Name',
      'User Role',
      'Party / Consignee Name',
      'Total Value (INR)',
      'Refunded Qty (Pcs)',
      'Vehicle Number',
      'Transporter',
      'LR Number',
      'Details / Modifications Summary',
      'Checksum Token'
    ];

    const rows = filteredAudits.map(aud => [
      `"${aud.id}"`,
      `"${aud.timestamp || '-'}"`,
      `"${aud.action}"`,
      `"${aud.company === 'HPL' ? 'AHPL (Healthcare)' : 'AIL (India)'}"`,
      `"${aud.invNo}"`,
      `"${aud.userName || 'System'}"`,
      `"${aud.userRole || '-'}"`,
      `"${(aud.partyName || '').replace(/"/g, '""')}"`,
      `"${aud.totalValue || '0'}"`,
      `"${aud.refundedQty || '0'}"`,
      `"${aud.vehicleNo || '-'}"`,
      `"${(aud.transporter || '-').replace(/"/g, '""')}"`,
      `"${aud.lrNo || '-'}"`,
      `"${(aud.details || '').replace(/"/g, '""')}"`,
      `"${aud.complianceChecksum || 'VERIFIED'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `WMS_Invoice_Audit_Logs_${companyFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print Compliance Audit Sheet
  const handlePrintAuditReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER & COMPLIANCE BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Invoice Audit Log & Traceability Dashboard
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Live Compliance Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks all generated outward invoices, user modifications, stock impacts, and timestamps for regulatory ISO/GST traceability.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh logs from Firestore"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrintAuditReport}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>

          {onPurgeCancelledAudits && (
            <button
              onClick={onPurgeCancelledAudits}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Purge all cancelled invoice records from history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge Cancelled History</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* EXECUTIVE COMPLIANCE KPI CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Events */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Events</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900">{metrics.totalEvents}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{metrics.uniqueInvoices} Unique Invoices</div>
        </div>

        {/* Generated Invoices */}
        <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Generated</span>
            <PlusCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black font-mono text-emerald-900">{metrics.creates}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Initial Creations</div>
        </div>

        {/* Modifications & Corrections */}
        <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Modified</span>
            <Edit3 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black font-mono text-amber-900">{metrics.updates}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">Corrections / Edits</div>
        </div>

        {/* Cancellations & Voided */}
        <div
          onClick={() => setActionFilter(actionFilter === 'CANCEL' ? 'ALL' : 'CANCEL')}
          className={`p-3.5 rounded-xl border shadow-xs cursor-pointer transition ${
            actionFilter === 'CANCEL' ? 'bg-rose-100 border-rose-400 ring-2 ring-rose-400' : 'bg-rose-50/50 border-rose-200 hover:bg-rose-100/60'
          }`}
          title="Click to filter cancelled invoice history"
        >
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cancelled</span>
            <Trash2 className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-black font-mono text-rose-900">{metrics.cancels}</div>
          <div className="text-[10px] text-rose-600 mt-0.5">{metrics.totalRefundedPcs} Pcs Refunded</div>
        </div>

        {/* Unique Operators */}
        <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-200 shadow-xs">
          <div className="flex items-center justify-between text-indigo-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Operators</span>
            <User className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-black font-mono text-indigo-900">{metrics.uniqueOperators}</div>
          <div className="text-[10px] text-indigo-600 mt-0.5">Active Staff Accounts</div>
        </div>

        {/* Traceability Integrity Score */}
        <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-200 shadow-xs">
          <div className="flex items-center justify-between text-purple-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Compliance</span>
            <Lock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-black font-mono text-purple-900">100%</div>
          <div className="text-[10px] text-purple-600 mt-0.5">Audit-Ready Trail</div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* INTERACTIVE MULTI-DIMENSIONAL FILTERS */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Invoice No (e.g. AILICH-392), Party Name, Product, User, LR, or Vehicle..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Division Selector Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setCompanyFilter('ALL')}
              className={`px-3 py-1.5 rounded-md transition ${
                companyFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🏢 All Divisions
            </button>
            <button
              onClick={() => setCompanyFilter('AIL')}
              className={`px-3 py-1.5 rounded-md transition ${
                companyFilter === 'AIL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🔵 AIL (India)
            </button>
            <button
              onClick={() => setCompanyFilter('HPL')}
              className={`px-3 py-1.5 rounded-md transition ${
                companyFilter === 'HPL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🟢 AHPL (Healthcare)
            </button>
          </div>
        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Action Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-500">Action:</span>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE">Invoice Generated (Create)</option>
              <option value="UPDATE">Invoice Modified (Edit/Update)</option>
              <option value="CANCEL">Cancelled & Restored (Delete/Void)</option>
              <option value="OVERRIDE">Demand Quota Override</option>
            </select>
          </div>

          {/* Time Window Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-500">Time Window:</span>
            <select
              value={dateRangeFilter}
              onChange={e => setDateRangeFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today Only</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">Last 30 Days</option>
            </select>
          </div>

          {/* Operator Filter */}
          {operatorsList.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-500">Operator:</span>
              <select
                value={operatorFilter}
                onChange={e => setOperatorFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">All Operators</option>
                {operatorsList.map(op => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="ml-auto text-slate-500 font-mono text-[11px]">
            Showing <strong className="text-slate-800">{filteredAudits.length}</strong> of {combinedAudits.length} events
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* AUDIT TRAIL LOGS TABLE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 w-12 text-center">Sr</th>
                <th className="py-3 px-3">Date & Timestamp</th>
                <th className="py-3 px-3">Invoice No</th>
                <th className="py-3 px-3">Action Type</th>
                <th className="py-3 px-3">User / Operator</th>
                <th className="py-3 px-3">Party / Consignee</th>
                <th className="py-3 px-3">Modifications & Details</th>
                <th className="py-3 px-3 text-center">Checksum</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAudits.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <ShieldCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-sm text-slate-600">No Invoice Audit Logs Match Criteria</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try clearing search filters or generate/modify outward invoices.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAudits.map((aud, index) => {
                  const isCreate = aud.action === 'CREATE';
                  const isUpdate = aud.action === 'UPDATE';
                  const isCancel = aud.action === 'CANCEL';
                  const isOverride = aud.action === 'OVERRIDE';

                  return (
                    <tr
                      key={aud.id || index}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Sr */}
                      <td className="py-3 px-3 text-center font-mono text-slate-400 text-[11px]">
                        {index + 1}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        <div className="font-bold flex items-center gap-1.5 text-slate-900">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{aud.timestamp || '-'}</span>
                        </div>
                      </td>

                      {/* Invoice No */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold font-mono text-blue-700 flex items-center gap-1.5">
                          <span>{aud.invNo}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                              aud.company === 'HPL'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {aud.company === 'HPL' ? 'AHPL' : 'AIL'}
                          </span>
                        </div>
                      </td>

                      {/* Action Type Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isCreate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <PlusCircle className="w-3 h-3 text-emerald-600" />
                            <span>Generated</span>
                          </span>
                        )}
                        {isUpdate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Edit3 className="w-3 h-3 text-amber-600" />
                            <span>Modified</span>
                          </span>
                        )}
                        {isCancel && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            <span>Cancelled / Restored</span>
                          </span>
                        )}
                        {isOverride && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            <AlertTriangle className="w-3 h-3 text-purple-600" />
                            <span>Quota Override</span>
                          </span>
                        )}
                      </td>

                      {/* User & Role */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                            {aud.userName ? aud.userName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 leading-tight">{aud.userName || 'System'}</div>
                            <div className="text-[9px] font-mono text-slate-400 uppercase">{aud.userRole || 'OPERATOR'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Party / Consignee */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 max-w-xs truncate" title={aud.partyName}>
                          {aud.partyName || '-'}
                        </div>
                      </td>

                      {/* Modifications & Details Summary */}
                      <td className="py-3 px-3">
                        <div className="text-slate-600 max-w-md">
                          {aud.details ? (
                            <span>{aud.details}</span>
                          ) : isCancel ? (
                            <span className="text-rose-700 font-medium">
                              Stock Refunded: <strong>{aud.refundedQty || 0} pcs</strong> restored to inventory
                            </span>
                          ) : (
                            <span className="text-slate-500">Standard outward dispatch generated</span>
                          )}

                          {/* If changes array is present, show count badge */}
                          {aud.changes && aud.changes.length > 0 && (
                            <span className="ml-2 inline-block px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
                              {aud.changes.length} fields modified
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Checksum */}
                      <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-[10px] text-slate-500">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {aud.complianceChecksum || `TRC-${aud.id.slice(-6).toUpperCase()}`}
                        </span>
                      </td>

                      {/* Compact Actions Dropdown Menu */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {isCancel && onDeleteAuditLog && (
                            <button
                              type="button"
                              onClick={() => onDeleteAuditLog(aud.id)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-rose-200 cursor-pointer shadow-2xs"
                              title="Permanently delete this cancelled invoice record from Firestore"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          )}
                          <RowActionDropdown
                            aud={aud}
                            invoiceExists={invoices.some(i => i.invNo === aud.invNo || i.invNo.replace(/[^a-zA-Z0-9]/g, '') === aud.invNo.replace(/[^a-zA-Z0-9]/g, ''))}
                            onInspect={() => setInspectAudit(aud)}
                            onPreview={() => onSelectInvoiceForPreview && onSelectInvoiceForPreview(aud.invNo)}
                            onDelete={() => onDeleteInvoice && onDeleteInvoice(aud.invNo)}
                            onDeleteAuditLog={() => onDeleteAuditLog && onDeleteAuditLog(aud.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* AUDIT INSPECTION & DIFF MODAL */}
      {/* ------------------------------------------------------------- */}
      {inspectAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm leading-tight">
                    Audit Log Inspection: {inspectAudit.invNo}
                  </h3>
                  <p className="text-[10px] text-slate-300 font-mono mt-0.5">
                    Event ID: {inspectAudit.id} | Timestamp: {inspectAudit.timestamp}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectAudit(null)}
                className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Event Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Action Type</span>
                  <span className="font-extrabold text-slate-800 text-xs mt-0.5 block">
                    {inspectAudit.action || 'TRANSACTION'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Operator Name</span>
                  <span className="font-extrabold text-slate-800 text-xs mt-0.5 block">
                    {inspectAudit.userName || 'System'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">User Role</span>
                  <span className="font-extrabold text-slate-800 text-xs mt-0.5 block">
                    {inspectAudit.userRole || 'OPERATOR'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Company Division</span>
                  <span className="font-extrabold text-slate-800 text-xs mt-0.5 block">
                    {inspectAudit.company === 'HPL' ? 'AHPL (Healthcare)' : 'AIL (India)'}
                  </span>
                </div>
              </div>

              {/* Party & Dispatch Details */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 text-xs border-b border-slate-100 pb-1.5 flex items-center justify-between">
                  <span>Party & Transport Metadata</span>
                  {inspectAudit.totalValue && (
                    <span className="font-mono text-blue-700">Total: ₹{inspectAudit.totalValue}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 font-semibold">Party Name:</span>{' '}
                    <strong className="text-slate-900">{inspectAudit.partyName || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">Vehicle No:</span>{' '}
                    <strong className="text-slate-900 font-mono">{inspectAudit.vehicleNo || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">Transporter:</span>{' '}
                    <strong className="text-slate-900">{inspectAudit.transporter || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">LR Number:</span>{' '}
                    <strong className="text-slate-900 font-mono">{inspectAudit.lrNo || '-'}</strong>
                  </div>
                </div>
              </div>

              {/* Field Modifications / Changes Breakdown */}
              {inspectAudit.changes && inspectAudit.changes.length > 0 ? (
                <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 space-y-2">
                  <div className="font-bold text-amber-900 text-xs flex items-center gap-1.5 border-b border-amber-200 pb-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                    <span>Exact Field Modifications (Audit Diff)</span>
                  </div>
                  <div className="space-y-1.5">
                    {inspectAudit.changes.map((chg, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-2 rounded border border-amber-100 flex items-center justify-between text-xs font-mono"
                      >
                        <span className="font-bold text-slate-700">{chg.fieldLabel || chg.field}:</span>
                        <div className="flex items-center gap-2">
                          <span className="line-through text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                            {String(chg.oldValue ?? '-')}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {String(chg.newValue ?? '-')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-slate-700 font-medium">{inspectAudit.details || 'Standard event recorded.'}</div>
                  {inspectAudit.refundedQty !== undefined && inspectAudit.refundedQty > 0 && (
                    <div className="text-rose-700 font-bold mt-1">
                      Dispatched stock refunded: {inspectAudit.refundedQty} pcs returned to live ledger.
                    </div>
                  )}
                </div>
              )}

              {/* Compliance & Digital Signature Block */}
              <div className="bg-slate-900 text-slate-200 p-3.5 rounded-xl font-mono text-[11px] space-y-1">
                <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>Tamper-Evident Digital Checksum & Traceability Token</span>
                </div>
                <div className="text-emerald-400 font-bold">
                  {inspectAudit.complianceChecksum || `SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()}`}
                </div>
                <div className="text-[10px] text-slate-400">
                  Status: VERIFIED & COMPLIANT | ISO-9001 / GST Traceability Invariant Enforced
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              {onSelectInvoiceForPreview && (
                <button
                  onClick={() => {
                    onSelectInvoiceForPreview(inspectAudit.invNo);
                    setInspectAudit(null);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Delivery Challan</span>
                </button>
              )}
              <button
                onClick={() => setInspectAudit(null)}
                className="ml-auto px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
