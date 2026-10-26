import React, { useState, useMemo } from 'react';
import { 
  Package, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  X, 
  Download, 
  Calendar, 
  Building2, 
  FileText, 
  Scale, 
  CheckCircle2, 
  Info,
  TrendingDown,
  Layers,
  History,
  Clock,
  ShieldCheck,
  RefreshCw,
  Lock,
  Search
} from 'lucide-react';
import {
  ThermocolProduct,
  ThermocolInward,
  ThermocolInvoice,
  StockWriteOff,
  PendingStockQueueItem,
  InvoiceAuditLog
} from './types';
import { formatDateDDMMYYYY, normalizeCompany } from './utils';

interface ProductHistoryModalProps {
  product: ThermocolProduct;
  inwards: ThermocolInward[];
  invoices: ThermocolInvoice[];
  pendingStockQueue?: PendingStockQueueItem[];
  audits?: InvoiceAuditLog[];
  onClose: () => void;
  onPreviewInvoice?: (invNo: string) => void;
  onLogWriteOff?: (inwardId: string, qty: number, reason: string) => void;
}

export interface MaterialMovementEntry {
  id: string;
  type: 'INWARD' | 'OUTWARD' | 'QUEUED' | 'RESTORED' | 'REFUND_CREDITED' | 'WRITE_OFF';
  typeLabel: string;
  date: string;
  timestamp: string;
  refNo: string;
  partyName: string;
  qtyChange: number; // positive or negative or zero
  runningBalance?: number;
  rate: number;
  totalValue: number;
  context: string;
  badgeBg: string;
  badgeText: string;
}

export const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({
  product,
  inwards,
  invoices,
  pendingStockQueue = [],
  audits = [],
  onClose,
  onPreviewInvoice,
  onLogWriteOff
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'inward' | 'outward' | 'queue' | 'writeoff'>('timeline');
  const [showWriteOffForm, setShowWriteOffForm] = useState<string | null>(null); // inward id
  const [writeOffQty, setWriteOffQty] = useState('');
  const [writeOffReason, setWriteOffReason] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const targetComp = normalizeCompany(product.company);

  // 1. Filter Inward Entries for this product
  const productInwards = useMemo(() => {
    return inwards.filter(i => 
      i.productName === product.name && 
      normalizeCompany(i.company) === targetComp
    );
  }, [inwards, product, targetComp]);

  // 2. Filter Outward Invoice Items for this product
  const productOutwards = useMemo(() => {
    const list: Array<{
      invNo: string;
      date: string;
      partyName: string;
      city?: string;
      qty: number;
      rate: number;
      totalValue: number;
      vehicleNo?: string;
      transName?: string;
      invoice: ThermocolInvoice;
    }> = [];

    invoices.forEach(inv => {
      const invComp = normalizeCompany(inv.company);
      if (invComp === targetComp && Array.isArray(inv.items)) {
        inv.items.forEach(it => {
          if (it.productName === product.name) {
            list.push({
              invNo: inv.invNo,
              date: inv.date,
              partyName: inv.partyName,
              city: inv.partyCity,
              qty: Number(it.qty) || 0,
              rate: Number(it.rate) || 0,
              totalValue: Number(it.totalValue) || 0,
              vehicleNo: inv.vehicleNo,
              transName: inv.transName,
              invoice: inv
            });
          }
        });
      }
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, product, targetComp]);

  // 3. Filter Pending Stock Queue Entries for this product
  const productQueue = useMemo(() => {
    const list: Array<{
      queueItem: PendingStockQueueItem;
      qty: number;
      status: string;
    }> = [];

    pendingStockQueue.forEach(q => {
      if (q.company === targetComp && Array.isArray(q.items)) {
        const line = q.items.find(it => it.productName === product.name);
        if (line) {
          list.push({
            queueItem: q,
            qty: Number(line.qty) || 0,
            status: q.status
          });
        }
      }
    });

    return list;
  }, [pendingStockQueue, product, targetComp]);

  // 4. Aggregate all write-offs across all inward lots of this product
  const allWriteOffs = useMemo(() => {
    const list: Array<StockWriteOff & { grNo: string; inwardInvNo: string }> = [];
    productInwards.forEach(inw => {
      if (Array.isArray(inw.writeOffs)) {
        inw.writeOffs.forEach(wo => {
          list.push({
            ...wo,
            grNo: inw.grNo || 'GR-INW',
            inwardInvNo: inw.invNo || '-'
          });
        });
      }
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [productInwards]);

  // 5. Build Unified SAP Chronological Material Movement Ledger (MB51 Style)
  const chronologicalMovements = useMemo(() => {
    const movements: MaterialMovementEntry[] = [];

    // Inward Receipts
    productInwards.forEach(inw => {
      const q = Number(inw.initialQty) || Number(inw.qty) || 0;
      const rate = Number(inw.price) || Number(inw.rate) || Number(product.price) || 0;
      movements.push({
        id: 'mv_inw_' + inw.id,
        type: 'INWARD',
        typeLabel: '+ INWARD RECEIPT',
        date: inw.receiveDate || inw.recdDate || inw.date || new Date().toISOString().split('T')[0],
        timestamp: inw.updatedAt || inw.recdDate || inw.date || '',
        refNo: inw.grNo || 'GRN',
        partyName: inw.supplyPlant || inw.supplierName || 'Supply Plant / Vendor',
        qtyChange: q,
        rate,
        totalValue: q * rate,
        context: `Received ${q} pcs into warehouse inventory (Inward Inv #${inw.invNo || '-'})`,
        badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        badgeText: 'text-emerald-700 font-extrabold'
      });
    });

    // Outward Dispatches
    productOutwards.forEach(out => {
      movements.push({
        id: 'mv_out_' + out.invNo,
        type: 'OUTWARD',
        typeLabel: '- OUTWARD DISPATCH',
        date: out.date || new Date().toISOString().split('T')[0],
        timestamp: out.date,
        refNo: out.invNo,
        partyName: out.partyName,
        qtyChange: -out.qty,
        rate: out.rate,
        totalValue: out.totalValue,
        context: `Dispatched ${out.qty} pcs to customer on Outward Tax Invoice #${out.invNo}`,
        badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
        badgeText: 'text-blue-700 font-extrabold'
      });
    });

    // Pending Inactive Queue items
    productQueue.forEach(q => {
      if (q.status === 'PENDING_STOCK_VERIFICATION') {
        movements.push({
          id: 'mv_q_' + q.queueItem.id,
          type: 'QUEUED',
          typeLabel: '⌛ PENDING INACTIVE QUEUE',
          date: q.queueItem.cancelledAt?.split(' ')[0] || new Date().toISOString().split('T')[0],
          timestamp: q.queueItem.cancelledAt,
          refNo: q.queueItem.invNo,
          partyName: q.queueItem.partyName,
          qtyChange: 0, // Held inactive; 0 active impact
          rate: Number(product.price) || 0,
          totalValue: q.qty * (Number(product.price) || 0),
          context: `Cancelled invoice #${q.queueItem.invNo}; ${q.qty} pcs routed to Pending Inactive Queue awaiting PIN verification`,
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
          badgeText: 'text-amber-800 font-bold'
        });
      } else if (q.status === 'STOCKS_CREDITED') {
        movements.push({
          id: 'mv_cred_' + q.queueItem.id,
          type: 'REFUND_CREDITED',
          typeLabel: '+ PIN REFUND CREDITED',
          date: q.queueItem.stockCreditedAt?.split(' ')[0] || new Date().toISOString().split('T')[0],
          timestamp: q.queueItem.stockCreditedAt || '',
          refNo: q.queueItem.invNo,
          partyName: q.queueItem.partyName,
          qtyChange: q.qty,
          rate: Number(product.price) || 0,
          totalValue: q.qty * (Number(product.price) || 0),
          context: `Explicit PIN stock refund verified; credited ${q.qty} returned pcs for #${q.queueItem.invNo} back to active stock`,
          badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
          badgeText: 'text-indigo-700 font-extrabold'
        });
      }
    });

    // Write-offs
    allWriteOffs.forEach(wo => {
      movements.push({
        id: 'mv_wo_' + wo.id,
        type: 'WRITE_OFF',
        typeLabel: '- WRITE-OFF / DAMAGE',
        date: wo.date?.split('T')[0] || new Date().toISOString().split('T')[0],
        timestamp: wo.date,
        refNo: wo.grNo || 'GRN-WO',
        partyName: `Reason: ${wo.reason}`,
        qtyChange: -wo.qty,
        rate: Number(product.price) || 0,
        totalValue: wo.qty * (Number(product.price) || 0),
        context: `Reduced ${wo.qty} pcs from GR #${wo.grNo} balance. Reason: "${wo.reason}"`,
        badgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
        badgeText: 'text-rose-700 font-extrabold'
      });
    });

    // Sort chronologically ascending to compute accurate running balance
    movements.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

    let running = 0;
    movements.forEach(m => {
      running += m.qtyChange;
      m.runningBalance = running;
    });

    // Return descending for display
    return movements.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [productInwards, productOutwards, productQueue, allWriteOffs, product.price]);

  // Filtered movements based on search query
  const filteredMovements = useMemo(() => {
    if (!searchFilter.trim()) return chronologicalMovements;
    const q = searchFilter.toLowerCase().trim();
    return chronologicalMovements.filter(m => 
      m.refNo?.toLowerCase().includes(q) ||
      m.partyName?.toLowerCase().includes(q) ||
      m.context?.toLowerCase().includes(q) ||
      m.typeLabel?.toLowerCase().includes(q)
    );
  }, [chronologicalMovements, searchFilter]);

  // KPI Summary Metrics
  const totalInwardReceived = useMemo(() => {
    return productInwards.reduce((sum, i) => sum + (Number(i.initialQty) || Number(i.qty) || 0), 0);
  }, [productInwards]);

  const totalOutwardDispatched = useMemo(() => {
    return productOutwards.reduce((sum, o) => sum + o.qty, 0);
  }, [productOutwards]);

  const totalPendingQueue = useMemo(() => {
    return productQueue
      .filter(q => q.status === 'PENDING_STOCK_VERIFICATION')
      .reduce((sum, q) => sum + q.qty, 0);
  }, [productQueue]);

  const totalWrittenOff = useMemo(() => {
    return allWriteOffs.reduce((sum, w) => sum + w.qty, 0);
  }, [allWriteOffs]);

  const currentAvailableStock = useMemo(() => {
    return productInwards.reduce((sum, i) => sum + (Number(i.availableQty) || 0), 0);
  }, [productInwards]);

  // Submit write-off form for an inward lot
  const handleWriteOffSubmit = (e: React.FormEvent, inwardId: string) => {
    e.preventDefault();
    const qty = parseFloat(writeOffQty);
    if (!qty || qty <= 0) {
      alert('Please enter a valid quantity to reduce / write off.');
      return;
    }
    if (!writeOffReason.trim()) {
      alert('Please enter a reason for this stock reduction.');
      return;
    }
    if (onLogWriteOff) {
      onLogWriteOff(inwardId, qty, writeOffReason.trim());
      setShowWriteOffForm(null);
      setWriteOffQty('');
      setWriteOffReason('');
    }
  };

  // Export Product Traceability Ledger to CSV
  const handleExportProductLedgerCsv = () => {
    const headers = [
      'Movement Type', 'Reference Document No', 'Date', 'Party / Context', 'Qty Change (Pcs)', 'Running Balance (Pcs)', 'Rate (INR)', 'Total Value (INR)'
    ];

    const rows = chronologicalMovements.map(m => [
      `"${m.typeLabel}"`,
      `"${m.refNo}"`,
      `"${formatDateDDMMYYYY(m.date)}"`,
      `"${m.partyName.replace(/"/g, '""')}"`,
      m.qtyChange,
      m.runningBalance || 0,
      m.rate,
      m.totalValue
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SAP_Material_Ledger_${product.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  {product.name}
                </h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black font-mono uppercase border ${
                  targetComp === 'HPL' ? 'bg-purple-900/60 text-purple-200 border-purple-400/40' : 'bg-blue-900/60 text-blue-200 border-blue-400/40'
                }`}>
                  {targetComp === 'HPL' ? 'AHPL' : 'AIL'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>SAP Anti-Duplication Engine Verified</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>HSN: <strong className="text-white">{product.hsnCode || '39239090'}</strong></span>
                <span>Pack: <strong className="text-white">{product.packSize || 'Box of 10'}</strong> ({product.packSizeMultiple || 10}/case)</span>
                <span>Rate: <strong className="text-amber-300">₹{Number(product.price || 0).toFixed(2)}</strong></span>
                <span>Weight: <strong className="text-slate-200">{product.weight || 0.15} kg</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportProductLedgerCsv}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Download SAP Material Movement Ledger CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export SAP Ledger CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 bg-slate-50">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Inward Received</span>
              <div className="text-base font-black font-mono text-emerald-700 mt-1 flex items-center gap-1">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{totalInwardReceived} Pcs</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{productInwards.length} Inward Lots</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Outward Dispatched</span>
              <div className="text-base font-black font-mono text-blue-700 mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{totalOutwardDispatched} Pcs</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{productOutwards.length} Active Invoices</span>
            </div>

            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-amber-800 block">Pending Inactive Queue</span>
              <div className="text-base font-black font-mono text-amber-900 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{totalPendingQueue} Pcs</span>
              </div>
              <span className="text-[10px] text-amber-700 font-semibold font-mono">Held Inactive (0 Active Impact)</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Written-Off / Damaged</span>
              <div className="text-base font-black font-mono text-rose-600 mt-1 flex items-center gap-1">
                <TrendingDown className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{totalWrittenOff} Pcs</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{allWriteOffs.length} Reductions</span>
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-300 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-emerald-900 block">Active Available Balance</span>
              <div className="text-base font-black font-mono text-emerald-950 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{currentAvailableStock} Pcs</span>
              </div>
              <span className="text-[10px] text-emerald-800 font-bold font-mono">
                (~{product.packSizeMultiple > 0 ? Math.floor(currentAvailableStock / product.packSizeMultiple) : currentAvailableStock} Cases)
              </span>
            </div>
          </div>

          {/* Sub-tabs Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'timeline'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>SAP Material Movement Ledger ({chronologicalMovements.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('inward')}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'inward'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Inward Lots ({productInwards.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('outward')}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'outward'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Outward Dispatches ({productOutwards.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('queue')}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'queue'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Pending Queue ({productQueue.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('writeoff')}
                className={`px-3 py-1.5 rounded-lg font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'writeoff'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Write-Offs ({allWriteOffs.length})</span>
              </button>
            </div>

            {/* Quick Search inside movements */}
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter movements..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* TAB 1: SAP MATERIAL MOVEMENT LEDGER (MB51 STYLE) */}
          {activeTab === 'timeline' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black uppercase tracking-wider">
                    SAP Material Movement Ledger (Strict Chronological Sequence)
                  </span>
                </div>
                <span className="text-xs text-slate-300 font-mono">
                  Showing {filteredMovements.length} material movements
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Movement Type</th>
                      <th className="py-2.5 px-3">Reference Doc / Inv No</th>
                      <th className="py-2.5 px-3">Party / Context & Operational Reason</th>
                      <th className="py-2.5 px-3 text-right">Qty Delta</th>
                      <th className="py-2.5 px-3 text-right">Running Stock Balance</th>
                      <th className="py-2.5 px-3 text-right">Rate</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMovements.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                          No material movement records found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredMovements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {formatDateDDMMYYYY(m.date)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${m.badgeBg}`}>
                              {m.typeLabel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {m.refNo}
                          </td>
                          <td className="py-2.5 px-3 max-w-xs">
                            <div className="font-bold text-slate-800 truncate" title={m.partyName}>
                              {m.partyName}
                            </div>
                            <div className="text-[10px] text-slate-500">{m.context}</div>
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono font-black ${
                            m.qtyChange > 0 ? 'text-emerald-700' : m.qtyChange < 0 ? 'text-rose-600' : 'text-amber-800'
                          }`}>
                            {m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange} Pcs
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 bg-slate-50/80">
                            {m.runningBalance !== undefined ? `${m.runningBalance} Pcs` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            ₹{m.rate.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {m.type === 'OUTWARD' && onPreviewInvoice && (
                              <button
                                onClick={() => onPreviewInvoice(m.refNo)}
                                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded text-[10px] font-bold cursor-pointer transition border border-blue-200"
                              >
                                View Inv
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: INWARD STOCK LOTS */}
          {activeTab === 'inward' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  Inward GRN Entries & Available Lot Balances
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Showing {productInwards.length} lots
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <th className="py-2.5 px-3">GR No</th>
                      <th className="py-2.5 px-3">Inward Inv No</th>
                      <th className="py-2.5 px-3">Recd Date</th>
                      <th className="py-2.5 px-3">Supply Plant / Vendor</th>
                      <th className="py-2.5 px-3 text-right">Initial Qty</th>
                      <th className="py-2.5 px-3 text-right">Current Available</th>
                      <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                      <th className="py-2.5 px-3 text-right">Taxable Value</th>
                      <th className="py-2.5 px-3 text-center">Write-Off Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productInwards.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-slate-400 italic">
                          No inward stock entries recorded for this product.
                        </td>
                      </tr>
                    ) : (
                      productInwards.map(inw => {
                        const isWritingOff = showWriteOffForm === inw.id;
                        const avail = Number(inw.availableQty) || 0;
                        return (
                          <React.Fragment key={inw.id}>
                            <tr className="hover:bg-slate-50/80 transition">
                              <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{inw.grNo}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">{inw.invNo || '-'}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">
                                {formatDateDDMMYYYY(inw.receiveDate || inw.recdDate || inw.date || '')}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">{inw.supplyPlant || 'Indore Hub'}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                                {inw.initialQty || inw.qty || 0} Pcs
                              </td>
                              <td className={`py-2.5 px-3 text-right font-mono font-extrabold ${
                                avail > 0 ? 'text-emerald-700' : 'text-slate-400'
                              }`}>
                                {avail} Pcs
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                ₹{Number(inw.price || inw.rate || 0).toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                ₹{Number(inw.taxable || ((inw.initialQty || inw.qty || 0) * (inw.price || inw.rate || 0))).toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {onLogWriteOff && avail > 0 && (
                                  <button
                                    onClick={() => {
                                      if (isWritingOff) {
                                        setShowWriteOffForm(null);
                                      } else {
                                        setShowWriteOffForm(inw.id);
                                        setWriteOffQty('');
                                        setWriteOffReason('');
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded text-[11px] font-bold cursor-pointer transition border border-rose-200"
                                  >
                                    Write-Off / Reduce
                                  </button>
                                )}
                              </td>
                            </tr>

                            {isWritingOff && (
                              <tr className="bg-rose-50/50">
                                <td colSpan={9} className="p-3">
                                  <form onSubmit={(e) => handleWriteOffSubmit(e, inw.id)} className="flex flex-col sm:flex-row items-center gap-3">
                                    <div className="text-xs font-bold text-rose-900 shrink-0">
                                      Write-off from GR #{inw.grNo} (Max: {avail} Pcs):
                                    </div>
                                    <input
                                      type="number"
                                      min="1"
                                      max={avail}
                                      placeholder="Qty to reduce"
                                      value={writeOffQty}
                                      onChange={(e) => setWriteOffQty(e.target.value)}
                                      className="w-28 bg-white border border-rose-300 rounded px-2.5 py-1 text-xs font-mono font-bold outline-none focus:border-rose-500"
                                      required
                                    />
                                    <input
                                      type="text"
                                      placeholder="Reason / Remark (e.g. Damaged in transit / Count adjustment)"
                                      value={writeOffReason}
                                      onChange={(e) => setWriteOffReason(e.target.value)}
                                      className="flex-1 bg-white border border-rose-300 rounded px-2.5 py-1 text-xs font-medium outline-none focus:border-rose-500"
                                      required
                                    />
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        type="submit"
                                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold cursor-pointer transition shadow-xs"
                                      >
                                        Submit Write-Off
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setShowWriteOffForm(null)}
                                        className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold cursor-pointer transition"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </form>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: OUTWARD DISPATCHES */}
          {activeTab === 'outward' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  Outward Tax Invoices & Customer Dispatches
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Showing {productOutwards.length} sales entries
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <th className="py-2.5 px-3">Outward Inv No</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Consignee / Customer</th>
                      <th className="py-2.5 px-3">Transporter / Vehicle</th>
                      <th className="py-2.5 px-3 text-right">Dispatched Qty</th>
                      <th className="py-2.5 px-3 text-right">Selling Rate (₹)</th>
                      <th className="py-2.5 px-3 text-right">Total Line Value</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productOutwards.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400 italic">
                          No outward sales or dispatches generated for this product.
                        </td>
                      </tr>
                    ) : (
                      productOutwards.map((out, idx) => (
                        <tr key={out.invNo + '_' + idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{out.invNo}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{formatDateDDMMYYYY(out.date)}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{out.partyName}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                            {out.transName || '-'} / {out.vehicleNo || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">{out.qty} Pcs</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">₹{out.rate.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-700">
                            ₹{out.totalValue.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {onPreviewInvoice && (
                              <button
                                onClick={() => onPreviewInvoice(out.invNo)}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded text-[11px] font-bold cursor-pointer transition border border-blue-200"
                              >
                                View Invoice
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PENDING INACTIVE QUEUE */}
          {activeTab === 'queue' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="p-3 bg-amber-50/80 border-b border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wide">
                    Pending Inactive Queue (Cancelled Unverified Stock)
                  </span>
                </div>
                <span className="text-xs text-amber-800 font-mono">
                  Total Held: {totalPendingQueue} Pcs (Zero Active Impact)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <th className="py-2.5 px-3">Cancelled Invoice No</th>
                      <th className="py-2.5 px-3">Cancelled Date</th>
                      <th className="py-2.5 px-3">Consignee</th>
                      <th className="py-2.5 px-3 text-right">Held Qty</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Reconciliation Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productQueue.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          No pending inactive queue items recorded for this product.
                        </td>
                      </tr>
                    ) : (
                      productQueue.map((q, idx) => (
                        <tr key={q.queueItem.id || idx} className="hover:bg-amber-50/40 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{q.queueItem.invNo}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{q.queueItem.cancelledAt}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{q.queueItem.partyName}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-900">{q.qty} Pcs</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                              {q.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600 text-[11px]">
                            PIN Verification ({q.queueItem.company === 'HPL' ? '1301' : '7308'}) Required in Cancellation Tab
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: WRITE-OFFS */}
          {activeTab === 'writeoff' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  Stock Write-Off & Damage Audit Log
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Showing {allWriteOffs.length} reduction logs
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">GR No / Lot Ref</th>
                      <th className="py-2.5 px-3 text-right font-bold text-rose-700">Written-Off Qty</th>
                      <th className="py-2.5 px-3">Mandatory Reason / Remark</th>
                      <th className="py-2.5 px-3">Logged By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allWriteOffs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                          No stock write-offs or reductions recorded for this product.
                        </td>
                      </tr>
                    ) : (
                      allWriteOffs.map((wo, idx) => (
                        <tr key={wo.id || idx} className="hover:bg-rose-50/40 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-600">{formatDateDDMMYYYY(wo.date)}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{wo.grNo}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-rose-600">
                            -{wo.qty} Pcs
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{wo.reason}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{wo.userName || 'Supervisor'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white p-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-mono">
            SAP-Style Product Lifecycle & Anti-Duplication Inventory Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
          >
            Close Traceability View
          </button>
        </div>
      </div>
    </div>
  );
};
