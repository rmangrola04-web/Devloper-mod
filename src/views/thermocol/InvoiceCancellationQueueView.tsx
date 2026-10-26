import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Lock,
  X,
  Eye,
  AlertTriangle,
  Clock,
  Box,
  Truck,
  Building2,
  Download,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  PendingStockQueueItem,
  QueueStatus,
  ThermocolInvoice,
  ThermocolInward,
  InvoiceAuditLog
} from './types';

interface InvoiceCancellationQueueViewProps {
  queueItems: PendingStockQueueItem[];
  currentUser?: { name?: string; role?: string; user?: string } | null;
  selectedCompany?: 'AIL' | 'HPL';
  onVerifyAndCreditStock: (queueItemId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  onRestoreInvoiceFromQueue: (queueItemId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  onPurgeQueueItem: (queueItemId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
}

export const InvoiceCancellationQueueView: React.FC<InvoiceCancellationQueueViewProps> = ({
  queueItems,
  currentUser,
  selectedCompany = 'AIL',
  onVerifyAndCreditStock,
  onRestoreInvoiceFromQueue,
  onPurgeQueueItem
}) => {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | QueueStatus>('ALL');
  const [companyFilter, setCompanyFilter] = useState<'ALL' | 'AIL' | 'HPL'>('ALL');

  // Inspection modal
  const [inspectQueueItem, setInspectQueueItem] = useState<PendingStockQueueItem | null>(null);

  // PIN modal state
  const [pinAction, setPinAction] = useState<{
    type: 'VERIFY_STOCK' | 'RESTORE_INVOICE' | 'PURGE_RECORD';
    queueItem: PendingStockQueueItem;
  } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter queue items
  const filteredQueue = useMemo(() => {
    return queueItems.filter(item => {
      // Company Filter
      if (companyFilter !== 'ALL' && item.company !== companyFilter) return false;

      // Status Filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchInv = item.invNo?.toLowerCase().includes(q);
        const matchParty = item.partyName?.toLowerCase().includes(q);
        const matchUser = item.cancelledBy?.toLowerCase().includes(q);
        const matchVeh = item.vehicleNo?.toLowerCase().includes(q);
        const matchLr = item.lrNo?.toLowerCase().includes(q);
        const matchItem = item.items?.some(it => it.productName?.toLowerCase().includes(q));

        if (!matchInv && !matchParty && !matchUser && !matchVeh && !matchLr && !matchItem) {
          return false;
        }
      }

      return true;
    });
  }, [queueItems, companyFilter, statusFilter, searchQuery]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const totalCancelled = queueItems.length;
    const pendingVerification = queueItems.filter(i => i.status === 'PENDING_STOCK_VERIFICATION').length;
    const stocksCredited = queueItems.filter(i => i.status === 'STOCKS_CREDITED').length;
    const restored = queueItems.filter(i => i.status === 'RESTORED').length;
    const pendingPcs = queueItems
      .filter(i => i.status === 'PENDING_STOCK_VERIFICATION')
      .reduce((s, i) => s + (Number(i.totalQty) || 0), 0);

    return {
      totalCancelled,
      pendingVerification,
      stocksCredited,
      restored,
      pendingPcs
    };
  }, [queueItems]);

  const handleOpenPinModal = (
    type: 'VERIFY_STOCK' | 'RESTORE_INVOICE' | 'PURGE_RECORD',
    item: PendingStockQueueItem
  ) => {
    setPinAction({ type, queueItem: item });
    setPinInput('');
    setPinError('');
  };

  const handleConfirmPinSubmit = async () => {
    if (!pinAction) return;
    const { type, queueItem } = pinAction;
    const expectedPin = queueItem.company === 'HPL' ? '1301' : '7308';
    const compName = queueItem.company === 'HPL' ? 'AHPL (Healthcare)' : 'AIL (India)';

    if (pinInput.trim() !== expectedPin) {
      setPinError(`Incorrect PIN for ${compName}! Required PIN is ${expectedPin}.`);
      return;
    }

    setIsSubmitting(true);
    setPinError('');

    try {
      let res: { success: boolean; error?: string } = { success: false };
      if (type === 'VERIFY_STOCK') {
        res = await onVerifyAndCreditStock(queueItem.id, pinInput.trim());
      } else if (type === 'RESTORE_INVOICE') {
        res = await onRestoreInvoiceFromQueue(queueItem.id, pinInput.trim());
      } else if (type === 'PURGE_RECORD') {
        res = await onPurgeQueueItem(queueItem.id, pinInput.trim());
      }

      if (res.success) {
        setPinAction(null);
        setPinInput('');
      } else {
        setPinError(res.error || 'Operation failed. Please check PIN and try again.');
      }
    } catch (err: any) {
      setPinError(err?.message || 'Error processing request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER & DASHBOARD BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-600 flex items-center justify-center text-white shadow-md">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Invoice Cancellation & Pending Stock Reconciliation Queue
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                PIN Verification Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict PIN-gated workflow: Cancelled invoice stock is held in queue until supervisor verifies physical returns or approves invoice restoration.
            </p>
          </div>
        </div>

        {/* Division Selector Pills */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setCompanyFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              companyFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏢 All Divisions
          </button>
          <button
            onClick={() => setCompanyFilter('AIL')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              companyFilter === 'AIL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🔵 AIL (PIN: 7308)
          </button>
          <button
            onClick={() => setCompanyFilter('HPL')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              companyFilter === 'HPL'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🟢 AHPL (PIN: 1301)
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SUMMARY KPI CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Cancelled */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Cancelled</span>
            <Layers className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">{metrics.totalCancelled}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Total Cancelled Invoices</div>
        </div>

        {/* Pending Verification */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'PENDING_STOCK_VERIFICATION' ? 'ALL' : 'PENDING_STOCK_VERIFICATION')}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition ${
            statusFilter === 'PENDING_STOCK_VERIFICATION'
              ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400'
              : 'bg-amber-50/60 border-amber-200 hover:bg-amber-100/70'
          }`}
        >
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Queue</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-900">{metrics.pendingVerification}</div>
          <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
            {metrics.pendingPcs} pcs awaiting PIN stock refund
          </div>
        </div>

        {/* Stocks Credited */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'STOCKS_CREDITED' ? 'ALL' : 'STOCKS_CREDITED')}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition ${
            statusFilter === 'STOCKS_CREDITED'
              ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-400'
              : 'bg-blue-50/50 border-blue-200 hover:bg-blue-100/70'
          }`}
        >
          <div className="flex items-center justify-between text-blue-800 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Stocks Credited</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black font-mono text-blue-900">{metrics.stocksCredited}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">PIN verified & added to stock</div>
        </div>

        {/* Restored */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'RESTORED' ? 'ALL' : 'RESTORED')}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition ${
            statusFilter === 'RESTORED'
              ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-400'
              : 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100/70'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Restored Invoices</span>
            <RefreshCw className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-900">{metrics.restored}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Re-activated with exact Inv No</div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SEARCH & STATUS FILTER ROW */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search queue by Invoice No, Consignee, Item Name, Vehicle, or LR..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto text-xs">
          <span className="font-bold text-slate-500">Queue Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_STOCK_VERIFICATION">⏳ Pending Verification</option>
            <option value="STOCKS_CREDITED">✅ Stocks Credited to Inventory</option>
            <option value="RESTORED">🔄 Restored to Active Invoices</option>
          </select>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CANCELLATION QUEUE DASHBOARD TABLE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 w-12 text-center">Sr</th>
                <th className="py-3 px-3">Cancelled Date & Time</th>
                <th className="py-3 px-3">Invoice No & Entity</th>
                <th className="py-3 px-3">Consignee / Party</th>
                <th className="py-3 px-3">Returned Line Items</th>
                <th className="py-3 px-3 text-right">Total Value</th>
                <th className="py-3 px-3 text-center">Lifecycle Status</th>
                <th className="py-3 px-3 text-center">PIN Reconciliation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-sm text-slate-600">No Invoices in Cancellation Queue</p>
                    <p className="text-xs text-slate-400 mt-1">
                      All cancelled invoice stock items are reconciled or no entries match filter criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item, index) => {
                  const isPending = item.status === 'PENDING_STOCK_VERIFICATION';
                  const isCredited = item.status === 'STOCKS_CREDITED';
                  const isRestored = item.status === 'RESTORED';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Sr */}
                      <td className="py-3 px-3 text-center font-mono text-slate-400 text-[11px]">
                        {index + 1}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.cancelledAt || '-'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">By: {item.cancelledBy || 'Supervisor'}</div>
                      </td>

                      {/* Invoice No */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold font-mono text-blue-700 flex items-center gap-1.5">
                          <span>{item.invNo}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                              item.company === 'HPL'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {item.company === 'HPL' ? 'AHPL' : 'AIL'}
                          </span>
                        </div>
                      </td>

                      {/* Party */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 max-w-xs truncate" title={item.partyName}>
                          {item.partyName || '-'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Veh: {item.vehicleNo || '-'} | LR: {item.lrNo || '-'}
                        </div>
                      </td>

                      {/* Returned Items */}
                      <td className="py-3 px-3">
                        <div className="text-slate-700 font-medium max-w-md">
                          {item.items && item.items.length > 0 ? (
                            <div className="space-y-0.5">
                              {item.items.slice(0, 2).map((it, idx) => (
                                <div key={idx} className="flex items-center justify-between text-[11px]">
                                  <span className="font-semibold text-slate-800 truncate max-w-[180px]">{it.productName}</span>
                                  <span className="font-mono text-rose-700 font-bold bg-rose-50 px-1 rounded ml-2">{it.qty} pcs</span>
                                </div>
                              ))}
                              {item.items.length > 2 && (
                                <span className="text-[10px] text-slate-400 italic">
                                  + {item.items.length - 2} more item(s)...
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">{item.totalQty} pcs EPS Material</span>
                          )}
                        </div>
                      </td>

                      {/* Total Value */}
                      <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                        ₹{item.totalValue || '0.00'}
                      </td>

                      {/* Lifecycle Status Badge */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
                            <span>⏳ Pending Verification</span>
                          </span>
                        )}
                        {isCredited && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>✅ Stock Credited</span>
                          </span>
                        )}
                        {isRestored && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                            <span>🔄 Invoice Restored</span>
                          </span>
                        )}
                      </td>

                      {/* PIN Reconciliation Actions */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {isPending && (
                            <button
                              onClick={() => handleOpenPinModal('VERIFY_STOCK', item)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              title={`Verify returns & credit ${item.totalQty} pcs to active stock (Requires PIN ${item.company === 'HPL' ? '1301' : '7308'})`}
                            >
                              <Lock className="w-3 h-3" />
                              <span>Verify & Credit Stock</span>
                            </button>
                          )}

                          {!isRestored && (
                            <button
                              onClick={() => handleOpenPinModal('RESTORE_INVOICE', item)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-800 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-indigo-200 cursor-pointer shadow-2xs"
                              title={`Restore invoice ${item.invNo} to active status (Requires PIN ${item.company === 'HPL' ? '1301' : '7308'})`}
                            >
                              <RefreshCw className="w-3 h-3 text-indigo-600" />
                              <span>Restore Inv</span>
                            </button>
                          )}

                          <button
                            onClick={() => setInspectQueueItem(item)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer border border-slate-200"
                            title="Inspect returned line items & audit log"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenPinModal('PURGE_RECORD', item)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 rounded-lg transition cursor-pointer border border-rose-200"
                            title="Delete queue record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
      {/* PIN VERIFICATION & RECONCILIATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {pinAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">
                  {pinAction.type === 'VERIFY_STOCK' && 'Verify Stock & Credit to Inventory'}
                  {pinAction.type === 'RESTORE_INVOICE' && 'Restore / Regenerate Invoice'}
                  {pinAction.type === 'PURGE_RECORD' && 'Delete Cancellation Queue Record'}
                </h3>
              </div>
              <button
                onClick={() => setPinAction(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>Invoice No: {pinAction.queueItem.invNo}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-extrabold ${
                      pinAction.queueItem.company === 'HPL'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {pinAction.queueItem.company === 'HPL' ? 'AHPL (Healthcare)' : 'AIL (India)'}
                  </span>
                </div>
                <p className="text-slate-600">Party: {pinAction.queueItem.partyName}</p>
                <p className="text-slate-600">
                  Quantity: <strong>{pinAction.queueItem.totalQty} pcs</strong> across {pinAction.queueItem.items?.length || 1} item(s)
                </p>
              </div>

              {pinAction.type === 'VERIFY_STOCK' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                  <p className="font-bold">Stock Reconciliation Notice:</p>
                  <p className="mt-0.5">
                    Entering the PIN will formally credit <strong>{pinAction.queueItem.totalQty} pcs</strong> back into active available inventory.
                  </p>
                </div>
              )}

              {pinAction.type === 'RESTORE_INVOICE' && (
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-indigo-900 text-xs">
                  <p className="font-bold">Invoice Restoration Notice:</p>
                  <p className="mt-0.5">
                    Entering the PIN will re-activate invoice <strong>{pinAction.queueItem.invNo}</strong> back into active delivery challans with all original line items.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Enter Security PIN ({pinAction.queueItem.company === 'HPL' ? 'AHPL: 1301' : 'AIL: 7308'}):
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Enter 4-digit PIN..."
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConfirmPinSubmit()}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
                  autoFocus
                />
              </div>

              {pinError && (
                <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-lg text-rose-800 text-xs font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setPinAction(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPinSubmit}
                disabled={isSubmitting || !pinInput.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                <span>Authorize & Execute</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ITEM INSPECTION MODAL */}
      {/* ------------------------------------------------------------- */}
      {inspectQueueItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  Inspection Details: Invoice #{inspectQueueItem.invNo}
                </h3>
                <p className="text-[10px] text-slate-300 font-mono mt-0.5">
                  Queue ID: {inspectQueueItem.id} | Cancelled At: {inspectQueueItem.cancelledAt}
                </p>
              </div>
              <button
                onClick={() => setInspectQueueItem(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Entity Division</span>
                  <span className="font-bold text-slate-800">{inspectQueueItem.company === 'HPL' ? 'AHPL (Healthcare)' : 'AIL (India)'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Consignee Name</span>
                  <span className="font-bold text-slate-800">{inspectQueueItem.partyName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Vehicle No</span>
                  <span className="font-mono text-slate-800">{inspectQueueItem.vehicleNo || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">LR Number</span>
                  <span className="font-mono text-slate-800">{inspectQueueItem.lrNo || '-'}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>Returned Line Items Breakdown</span>
                  <span className="font-mono text-blue-700 font-bold">Total: {inspectQueueItem.totalQty} pcs</span>
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase">
                      <tr>
                        <th className="p-2">Item Description</th>
                        <th className="p-2">HSN</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Rate</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inspectQueueItem.items?.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-semibold text-slate-800">{it.productName}</td>
                          <td className="p-2 font-mono text-slate-500">{it.hsnCode || '39239090'}</td>
                          <td className="p-2 text-right font-mono font-bold text-rose-700">{it.qty} pcs</td>
                          <td className="p-2 text-right font-mono text-slate-700">₹{it.rate}</td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">₹{it.totalValue || (it.qty * it.rate).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setInspectQueueItem(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
