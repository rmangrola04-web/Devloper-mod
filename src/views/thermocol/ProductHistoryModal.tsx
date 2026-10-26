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
  History
} from 'lucide-react';
import { ThermocolProduct, ThermocolInward, ThermocolInvoice, StockWriteOff } from './types';
import { formatDateDDMMYYYY, normalizeCompany } from './utils';

interface ProductHistoryModalProps {
  product: ThermocolProduct;
  inwards: ThermocolInward[];
  invoices: ThermocolInvoice[];
  onClose: () => void;
  onPreviewInvoice?: (invNo: string) => void;
  onLogWriteOff?: (inwardId: string, qty: number, reason: string) => void;
}

export const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({
  product,
  inwards,
  invoices,
  onClose,
  onPreviewInvoice,
  onLogWriteOff
}) => {
  const [activeTab, setActiveTab] = useState<'inward' | 'outward' | 'writeoff'>('inward');
  const [showWriteOffForm, setShowWriteOffForm] = useState<string | null>(null); // inward id
  const [writeOffQty, setWriteOffQty] = useState('');
  const [writeOffReason, setWriteOffReason] = useState('');

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

  // 3. Aggregate all write-offs across all inward lots of this product
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

  // 4. Calculate Summary KPI Metrics
  const totalInwardReceived = useMemo(() => {
    return productInwards.reduce((sum, i) => sum + (Number(i.initialQty) || Number(i.qty) || 0), 0);
  }, [productInwards]);

  const totalOutwardDispatched = useMemo(() => {
    return productOutwards.reduce((sum, o) => sum + o.qty, 0);
  }, [productOutwards]);

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
      'Type', 'Reference No', 'Date', 'Party / Source / Reason', 'Quantity (Pcs)', 'Rate (INR)', 'Total Value (INR)'
    ];

    const rows: string[] = [];

    // Inwards
    productInwards.forEach(inw => {
      rows.push([
        '"INWARD (GRN)"',
        `"${inw.grNo}"`,
        `"${formatDateDDMMYYYY(inw.receiveDate || inw.recdDate || inw.date || '')}"`,
        `"${inw.supplyPlant || 'Supply Plant'}"`,
        inw.initialQty || inw.qty || 0,
        inw.price || inw.rate || 0,
        inw.totalAmount || inw.invoiceValue || 0
      ].join(','));
    });

    // Outwards
    productOutwards.forEach(out => {
      rows.push([
        '"OUTWARD (DISPATCH)"',
        `"${out.invNo}"`,
        `"${formatDateDDMMYYYY(out.date)}"`,
        `"${out.partyName}"`,
        out.qty,
        out.rate,
        out.totalValue
      ].join(','));
    });

    // Write-offs
    allWriteOffs.forEach(wo => {
      rows.push([
        '"WRITE-OFF / REDUCTION"',
        `"${wo.grNo}"`,
        `"${formatDateDDMMYYYY(wo.date)}"`,
        `"${wo.reason}"`,
        `-${wo.qty}`,
        0,
        0
      ].join(','));
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Traceability_Ledger_${product.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto overflow-hidden flex flex-col max-h-[90vh]">
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
              title="Download Product Lifecycle CSV Ledger"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Ledger CSV</span>
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
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 bg-slate-50">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Total Received (Inward)</span>
              <div className="text-base sm:text-lg font-black font-mono text-emerald-700 mt-1 flex items-center gap-1">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{totalInwardReceived} Pcs</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{productInwards.length} Stock Lots</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Total Dispatched (Outward)</span>
              <div className="text-base sm:text-lg font-black font-mono text-blue-700 mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{totalOutwardDispatched} Pcs</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{productOutwards.length} Invoices</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Written-Off / Adjusted</span>
              <div className="text-base sm:text-lg font-black font-mono text-red-600 mt-1 flex items-center gap-1">
                <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />
                <span>{totalWrittenOff} Pcs</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{allWriteOffs.length} Write-Off Entries</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/40 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-emerald-800 block">Current Available Balance</span>
              <div className="text-base sm:text-lg font-black font-mono text-emerald-900 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{currentAvailableStock} Pcs</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-bold font-mono">
                (~{product.packSizeMultiple > 0 ? Math.floor(currentAvailableStock / product.packSizeMultiple) : currentAvailableStock} Cases)
              </span>
            </div>
          </div>

          {/* Sub-tabs Selector */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab('inward')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'outward'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Outward Dispatches ({productOutwards.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('writeoff')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'writeoff'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Write-Off History ({allWriteOffs.length})</span>
            </button>
          </div>

          {/* Tab 1: Inward Stock History */}
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
                                    className="px-2.5 py-1 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 rounded text-[11px] font-bold cursor-pointer transition border border-red-200"
                                  >
                                    Write-Off / Reduce
                                  </button>
                                )}
                              </td>
                            </tr>

                            {/* Write-Off Inline Form Row */}
                            {isWritingOff && (
                              <tr className="bg-red-50/50">
                                <td colSpan={9} className="p-3">
                                  <form onSubmit={(e) => handleWriteOffSubmit(e, inw.id)} className="flex flex-col sm:flex-row items-center gap-3">
                                    <div className="text-xs font-bold text-red-900 shrink-0">
                                      Write-off from GR #{inw.grNo} (Max: {avail} Pcs):
                                    </div>
                                    <input
                                      type="number"
                                      min="1"
                                      max={avail}
                                      placeholder="Qty to reduce"
                                      value={writeOffQty}
                                      onChange={(e) => setWriteOffQty(e.target.value)}
                                      className="w-28 bg-white border border-red-300 rounded px-2.5 py-1 text-xs font-mono font-bold outline-none focus:border-red-500"
                                      required
                                    />
                                    <input
                                      type="text"
                                      placeholder="Reason / Remark (e.g. Damaged in transit / Count adjustment)"
                                      value={writeOffReason}
                                      onChange={(e) => setWriteOffReason(e.target.value)}
                                      className="flex-1 bg-white border border-red-300 rounded px-2.5 py-1 text-xs font-medium outline-none focus:border-red-500"
                                      required
                                    />
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        type="submit"
                                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold cursor-pointer transition shadow-xs"
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

          {/* Tab 2: Outward Sales & Dispatches */}
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

          {/* Tab 3: Write-Offs & Reductions Log */}
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
                      <th className="py-2.5 px-3 text-right font-bold text-red-700">Written-Off Qty</th>
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
                        <tr key={wo.id || idx} className="hover:bg-red-50/40 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-600">{formatDateDDMMYYYY(wo.date)}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{wo.grNo}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-red-600">
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
            WMS Product Lifecycle & Traceability Audit Engine
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
