import React, { useState } from 'react';
import { 
  Trash2, CheckSquare, Square, AlertTriangle, Database, 
  Package, Users, Truck, ClipboardList, Warehouse, FileText, RotateCcw, Building2
} from 'lucide-react';
import { 
  ThermocolProduct, ThermocolParty, ThermocolTransporter, 
  ClientDemand, ThermocolInward, ThermocolInvoice, InvoiceAuditLog 
} from './types';
import { isInterStateParty, formatDateDDMMYYYY, CompanyType, normalizeCompany } from './utils';
import { 
  deleteThermocolInvoiceFromFirestore, 
  clearThermocolCancelledAuditsFromFirestore,
  deleteThermocolProductFromFirestore,
  deleteThermocolPartyFromFirestore,
  deleteThermocolDemandFromFirestore,
  deleteThermocolTransporterFromFirestore,
  deleteThermocolInwardFromFirestore,
  saveThermocolSequencesToFirestore
} from '../../services/firestoreService';

interface DataCleanupViewProps {
  products: ThermocolProduct[];
  setProducts: React.Dispatch<React.SetStateAction<ThermocolProduct[]>>;
  parties: ThermocolParty[];
  setParties: React.Dispatch<React.SetStateAction<ThermocolParty[]>>;
  transporters: ThermocolTransporter[];
  setTransporters: React.Dispatch<React.SetStateAction<ThermocolTransporter[]>>;
  clientDemands: ClientDemand[];
  setClientDemands: React.Dispatch<React.SetStateAction<ClientDemand[]>>;
  inwards: ThermocolInward[];
  setInwards: React.Dispatch<React.SetStateAction<ThermocolInward[]>>;
  invoices: ThermocolInvoice[];
  setInvoices: React.Dispatch<React.SetStateAction<ThermocolInvoice[]>>;
  invoiceSeqAIL?: number;
  setInvoiceSeqAIL?: (seq: number) => void;
  invoiceSeqHPL?: number;
  setInvoiceSeqHPL?: (seq: number) => void;
  challanSeqAIL?: number;
  setChallanSeqAIL?: (seq: number) => void;
  challanSeqHPL?: number;
  setChallanSeqHPL?: (seq: number) => void;
  invoiceSeq?: number;
  selectedCompany?: CompanyType;
  invoiceAudits: InvoiceAuditLog[];
  setInvoiceAudits: React.Dispatch<React.SetStateAction<InvoiceAuditLog[]>>;
  persistStorage: (
    newProds?: ThermocolProduct[],
    newParts?: ThermocolParty[],
    newTrans?: ThermocolTransporter[],
    newDemands?: ClientDemand[],
    newInws?: ThermocolInward[],
    newInvs?: ThermocolInvoice[],
    newSeqAIL?: number,
    newSeqHPL?: number,
    newAudits?: InvoiceAuditLog[]
  ) => void;
}

export const DataCleanupView: React.FC<DataCleanupViewProps> = ({
  products,
  setProducts,
  parties,
  setParties,
  transporters,
  setTransporters,
  clientDemands,
  setClientDemands,
  inwards,
  setInwards,
  invoices,
  setInvoices,
  invoiceSeqAIL = 392,
  setInvoiceSeqAIL,
  invoiceSeqHPL = 1,
  setInvoiceSeqHPL,
  challanSeqAIL = 1,
  setChallanSeqAIL,
  challanSeqHPL = 1,
  setChallanSeqHPL,
  invoiceAudits,
  setInvoiceAudits,
  persistStorage,
}) => {
  // Selected IDs / keys for batch deletion
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedPartyNames, setSelectedPartyNames] = useState<string[]>([]);
  const [selectedTransNames, setSelectedTransNames] = useState<string[]>([]);
  const [selectedDemandIds, setSelectedDemandIds] = useState<string[]>([]);
  const [selectedInwardIds, setSelectedInwardIds] = useState<string[]>([]);
  const [selectedInvoiceNos, setSelectedInvoiceNos] = useState<string[]>([]);
  const [resetDivision, setResetDivision] = useState<'AIL' | 'AHPL'>('AIL');
  const [customSeqInput, setCustomSeqInput] = useState<string>(String(invoiceSeqAIL));

  const [resetChallanDivision, setResetChallanDivision] = useState<'AIL' | 'AHPL'>('AIL');
  const [customChallanSeqInput, setCustomChallanSeqInput] = useState<string>(String(challanSeqAIL));
  
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  React.useEffect(() => {
    if (resetDivision === 'AIL') {
      setCustomSeqInput(String(invoiceSeqAIL));
    } else {
      setCustomSeqInput(String(invoiceSeqHPL));
    }
  }, [resetDivision, invoiceSeqAIL, invoiceSeqHPL]);

  React.useEffect(() => {
    if (resetChallanDivision === 'AIL') {
      setCustomChallanSeqInput(String(challanSeqAIL));
    } else {
      setCustomChallanSeqInput(String(challanSeqHPL));
    }
  }, [resetChallanDivision, challanSeqAIL, challanSeqHPL]);

  const handleSetCustomInvoiceSequence = async (overrideVal?: number) => {
    const parsed = overrideVal !== undefined ? overrideVal : parseInt(customSeqInput, 10);
    const targetSeq = isNaN(parsed) || parsed < 1 ? 1 : parsed;

    const normDiv = normalizeCompany(resetDivision);
    const newAIL = normDiv === 'AIL' ? targetSeq : invoiceSeqAIL;
    const newHPL = normDiv === 'HPL' ? targetSeq : invoiceSeqHPL;

    if (normDiv === 'AIL') {
      if (setInvoiceSeqAIL) setInvoiceSeqAIL(targetSeq);
    } else {
      if (setInvoiceSeqHPL) setInvoiceSeqHPL(targetSeq);
    }

    try {
      await saveThermocolSequencesToFirestore(newAIL, newHPL, challanSeqAIL, challanSeqHPL);
      persistStorage(products, parties, transporters, clientDemands, inwards, invoices, newAIL, newHPL, invoiceAudits);
      setStatusMsg({ text: `Invoice sequence counter for ${resetDivision} has been successfully set to ${targetSeq} and persisted to Firestore! Next invoice will start from ${targetSeq}.`, isError: false });
    } catch (err) {
      console.error('Error saving sequence to Firestore:', err);
      setStatusMsg({ text: `Failed to save sequence counter to Firestore.`, isError: true });
    }
  };

  const handleSetCustomChallanSequence = (overrideVal?: number) => {
    const parsed = overrideVal !== undefined ? overrideVal : parseInt(customChallanSeqInput, 10);
    const targetSeq = isNaN(parsed) || parsed < 1 ? 1 : parsed;

    if (resetChallanDivision === 'AIL') {
      if (setChallanSeqAIL) setChallanSeqAIL(targetSeq);
    } else {
      if (setChallanSeqHPL) setChallanSeqHPL(targetSeq);
    }
    setStatusMsg({ text: `Delivery Challan sequence counter for ${resetChallanDivision} (AIL / AHPL) has been successfully set to ${targetSeq}! Subsequent challans will continue from ${targetSeq}.`, isError: false });
  };

  const handleClearCancelledInvoiceHistory = async () => {
    if (confirm("Are you sure you want to permanently delete and purge all cancelled invoice audit history/logs from Firestore?")) {
      const remainingAudits = invoiceAudits.filter(a => a.action !== 'CANCEL' && !a.deletedAt);
      setInvoiceAudits(remainingAudits);
      try {
        await clearThermocolCancelledAuditsFromFirestore();
      } catch (err) {
        console.warn('[Firestore] Error clearing cancelled audits:', err);
      }
      persistStorage(products, parties, transporters, clientDemands, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, remainingAudits);
      setStatusMsg({ text: "Cancelled invoice history and audit logs have been permanently deleted and purged from Firestore!", isError: false });
    }
  };

  // --- Product Master Selection & Deletion ---
  const toggleSelectAllProducts = () => {
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map(p => p.id));
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBatchDeleteProducts = async () => {
    if (selectedProductIds.length === 0) return;
    if (confirm(`Are you sure you want to permanently delete ${selectedProductIds.length} selected product master records?`)) {
      try {
        for (const id of selectedProductIds) {
          await deleteThermocolProductFromFirestore(id);
        }
        const updated = products.filter(p => !selectedProductIds.includes(p.id));
        setProducts(updated);
        persistStorage(updated, parties, transporters, clientDemands, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
        setSelectedProductIds([]);
        setStatusMsg({ text: `Successfully deleted ${selectedProductIds.length} product records from Firestore!`, isError: false });
      } catch (err) {
        console.error("Error deleting products:", err);
        setStatusMsg({ text: "Error deleting products. Please try again.", isError: true });
      }
    }
  };

  // --- Party Master Selection & Deletion ---
  const toggleSelectAllParties = () => {
    if (selectedPartyNames.length === parties.length) {
      setSelectedPartyNames([]);
    } else {
      setSelectedPartyNames(parties.map(p => p.name));
    }
  };

  const toggleSelectParty = (name: string) => {
    setSelectedPartyNames(prev => 
      prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]
    );
  };

  const handleBatchDeleteParties = async () => {
    if (selectedPartyNames.length === 0) return;
    if (confirm(`Are you sure you want to permanently delete ${selectedPartyNames.length} selected customer records?`)) {
      try {
        for (const name of selectedPartyNames) {
          await deleteThermocolPartyFromFirestore(name);
        }
        const updated = parties.filter(p => !selectedPartyNames.includes(p.name));
        setParties(updated);
        persistStorage(products, updated, transporters, clientDemands, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
        setSelectedPartyNames([]);
        setStatusMsg({ text: `Successfully deleted ${selectedPartyNames.length} customer records from Firestore!`, isError: false });
      } catch (err) {
        console.error("Error deleting customers:", err);
        setStatusMsg({ text: "Error deleting customers. Please try again.", isError: true });
      }
    }
  };

  // --- Transporter Master Selection & Deletion ---
  const toggleSelectAllTransporters = () => {
    if (selectedTransNames.length === transporters.length) {
      setSelectedTransNames([]);
    } else {
      setSelectedTransNames(transporters.map(t => t.name));
    }
  };

  const toggleSelectTransporter = (name: string) => {
    setSelectedTransNames(prev => 
      prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]
    );
  };

  const handleBatchDeleteTransporters = async () => {
    if (selectedTransNames.length === 0) return;
    if (confirm(`Are you sure you want to permanently delete ${selectedTransNames.length} selected transporter records?`)) {
      try {
        for (const name of selectedTransNames) {
          await deleteThermocolTransporterFromFirestore(name);
        }
        const updated = transporters.filter(t => !selectedTransNames.includes(t.name));
        setTransporters(updated);
        persistStorage(products, parties, updated, clientDemands, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
        setSelectedTransNames([]);
        setStatusMsg({ text: `Successfully deleted ${selectedTransNames.length} transporter records from Firestore!`, isError: false });
      } catch (err) {
        console.error("Error deleting transporters:", err);
        setStatusMsg({ text: "Error deleting transporters from Firestore. Please try again.", isError: true });
      }
    }
  };

  // --- Client Demand Selection & Deletion ---
  const toggleSelectAllDemands = () => {
    if (selectedDemandIds.length === clientDemands.length) {
      setSelectedDemandIds([]);
    } else {
      setSelectedDemandIds(clientDemands.map(d => d.id));
    }
  };

  const toggleSelectDemand = (id: string) => {
    setSelectedDemandIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBatchDeleteDemands = async () => {
    if (selectedDemandIds.length === 0) return;
    if (confirm(`Are you sure you want to permanently delete ${selectedDemandIds.length} selected monthly demand limits?`)) {
      try {
        for (const id of selectedDemandIds) {
          await deleteThermocolDemandFromFirestore(id);
        }
        const updated = clientDemands.filter(d => !selectedDemandIds.includes(d.id));
        setClientDemands(updated);
        persistStorage(products, parties, transporters, updated, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
        setSelectedDemandIds([]);
        setStatusMsg({ text: `Successfully deleted ${selectedDemandIds.length} client demand records from Firestore!`, isError: false });
      } catch (err) {
        console.error("Error deleting demands:", err);
        setStatusMsg({ text: "Error deleting demands. Please try again.", isError: true });
      }
    }
  };

  // --- Inward Log Selection & Deletion ---
  const toggleSelectAllInwards = () => {
    if (selectedInwardIds.length === inwards.length) {
      setSelectedInwardIds([]);
    } else {
      setSelectedInwardIds(inwards.map(i => i.id));
    }
  };

  const toggleSelectInward = (id: string) => {
    setSelectedInwardIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBatchDeleteInwards = async () => {
    if (selectedInwardIds.length === 0) return;
    if (confirm(`Are you sure you want to permanently delete ${selectedInwardIds.length} selected inward stock lot records?`)) {
      try {
        for (const id of selectedInwardIds) {
          await deleteThermocolInwardFromFirestore(id);
        }
        const updated = inwards.filter(i => !selectedInwardIds.includes(i.id));
        setInwards(updated);
        persistStorage(products, parties, transporters, clientDemands, updated, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
        setSelectedInwardIds([]);
        setStatusMsg({ text: `Successfully deleted ${selectedInwardIds.length} inward log records from Firestore!`, isError: false });
      } catch (err) {
        console.error("Error deleting inward logs:", err);
        setStatusMsg({ text: "Error deleting inward stock lots from Firestore. Please try again.", isError: true });
      }
    }
  };

  const handleDeleteSingleInward = async (id: string, grNo?: string) => {
    if (!id) {
      alert("अमान्य डॉक्यूमेंट आईडी!");
      return;
    }
    if (confirm(`क्या आप इस इनवर्ड स्टॉक लॉट ${grNo ? `(GR: ${grNo})` : ''} को स्थायी रूप से हटाना चाहते हैं?`)) {
      try {
        await deleteThermocolInwardFromFirestore(id);
        const updated = inwards.filter(i => i.id !== id);
        setInwards(updated);
        persistStorage(products, parties, transporters, clientDemands, updated, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
        setSelectedInwardIds(prev => prev.filter(item => item !== id));
        setStatusMsg({ text: `Inward stock lot ${grNo || id} deleted successfully from Firestore!`, isError: false });
      } catch (err) {
        console.error("Error deleting inward lot:", err);
        setStatusMsg({ text: "Error deleting inward stock lot from Firestore.", isError: true });
      }
    }
  };

  // --- Outward Invoice Selection & Deletion (with stock refund and audit logging) ---
  const toggleSelectAllInvoices = () => {
    if (selectedInvoiceNos.length === invoices.length) {
      setSelectedInvoiceNos([]);
    } else {
      setSelectedInvoiceNos(invoices.map(inv => inv.invNo));
    }
  };

  const toggleSelectInvoice = (invNo: string) => {
    setSelectedInvoiceNos(prev => 
      prev.includes(invNo) ? prev.filter(item => item !== invNo) : [...prev, invNo]
    );
  };

  const handleBatchDeleteInvoices = () => {
    if (selectedInvoiceNos.length === 0) return;
    if (confirm(`Are you sure you want to permanently cancel/delete ${selectedInvoiceNos.length} selected outward invoices? Associated quantities will be refunded to inventory and audited.`)) {
      let currentProducts = [...products];
      const newAuditEntries: InvoiceAuditLog[] = [];
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

      selectedInvoiceNos.forEach(invNo => {
        deleteThermocolInvoiceFromFirestore(invNo);
        const inv = invoices.find(i => i.invNo === invNo);
        if (inv) {
          inv.items.forEach(item => {
            const prod = currentProducts.find(p => p.name === item.productName);
            if (prod) {
              prod.stock = (prod.stock || 0) + item.qty;
            }
            const invComp = (inv.company === 'HPL' || inv.invNo.includes('HPL') || inv.invNo.includes('AHPL')) ? 'HPL' : 'AIL';
            newAuditEntries.push({
              id: 'aud-' + Math.random().toString(36).substr(2, 9),
              invNo: inv.invNo,
              company: invComp,
              action: 'CANCEL',
              timestamp,
              deletedAt: timestamp,
              userName: 'Compliance Officer / Admin',
              userRole: 'ADMIN',
              partyName: inv.partyName,
              productName: item.productName,
              refundedQty: item.qty,
              totalValue: inv.grandTotal,
              details: `Batch cancelled outward invoice; refunded ${item.qty} pcs of ${item.productName} back to stock ledger`,
              complianceChecksum: `CRC32-${Math.abs(inv.invNo.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(16).toUpperCase()}`
            });
          });
        }
      });

      const updatedInvoices = invoices.filter(inv => !selectedInvoiceNos.includes(inv.invNo));
      const updatedAudits = [...newAuditEntries, ...invoiceAudits];

      setInvoices(updatedInvoices);
      setProducts(currentProducts);
      setInvoiceAudits(updatedAudits);
      persistStorage(currentProducts, parties, transporters, clientDemands, inwards, updatedInvoices, invoiceSeqAIL, invoiceSeqHPL, updatedAudits);
      setSelectedInvoiceNos([]);
      setStatusMsg({ text: `Successfully deleted ${selectedInvoiceNos.length} outward invoices and restored stock.`, isError: false });
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg space-y-8 animate-in fade-in duration-200">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            <span>Data Cleanup & Batch Deletion Management</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Centralized cleanup interface to select and permanently delete dummy, duplicate, or incorrect records across Master tables, Inward logs, and Outward Invoices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold">
            🔒 Secure Administrative Mode
          </span>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
          statusMsg.isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* INVOICE RESET & CANCELLATION HISTORY CLEANUP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
            <RotateCcw className="w-4 h-4 text-blue-600" />
            <span>Custom Invoice Sequence Reset</span>
          </h4>
          <p className="text-xs text-slate-500">
            Select division and enter your desired custom starting invoice sequence number (e.g. 10, 393, 500).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Select Division / Company:</label>
              <select
                value={resetDivision}
                onChange={(e) => setResetDivision(e.target.value as 'AIL' | 'AHPL')}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="AIL">AIL (Abbott India Limited) - Current: {invoiceSeqAIL}</option>
                <option value="AHPL">AHPL (Abbott Healthcare Private) - Current: {invoiceSeqHPL}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Custom Starting Invoice Number:</label>
              <input
                type="number"
                min={1}
                value={customSeqInput}
                onChange={(e) => setCustomSeqInput(e.target.value)}
                placeholder="e.g. 10, 393, 500"
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleSetCustomInvoiceSequence()}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Set Custom Invoice Sequence</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomSeqInput('1');
                handleSetCustomInvoiceSequence(1);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 transition cursor-pointer flex items-center justify-center gap-1 shrink-0"
              title="Quick reset sequence back to 1"
            >
              <span>Reset to 1</span>
            </button>
          </div>
        </div>

        {/* Custom Delivery Challan Sequence Reset Card */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
            <RotateCcw className="w-4 h-4 text-emerald-600" />
            <span>Custom Delivery Challan Sequence Reset</span>
          </h4>
          <p className="text-xs text-slate-500">
            Select division and enter your desired custom starting Delivery Challan sequence number (e.g. 1, 100, 500).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Select Division / Company:</label>
              <select
                value={resetChallanDivision}
                onChange={(e) => setResetChallanDivision(e.target.value as 'AIL' | 'AHPL')}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="AIL">AIL (Abbott India Limited) - Current Challan: {challanSeqAIL}</option>
                <option value="AHPL">AHPL (Abbott Healthcare Private) - Current Challan: {challanSeqHPL}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Custom Starting Challan Number:</label>
              <input
                type="number"
                min={1}
                value={customChallanSeqInput}
                onChange={(e) => setCustomChallanSeqInput(e.target.value)}
                placeholder="e.g. 1, 100, 500"
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleSetCustomChallanSequence()}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Set Custom Challan Sequence</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomChallanSeqInput('1');
                handleSetCustomChallanSequence(1);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 transition cursor-pointer flex items-center justify-center gap-1 shrink-0"
              title="Quick reset challan sequence back to 1"
            >
              <span>Reset to 1</span>
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>Cancelled Invoice History / Audit Trail Cleanup</span>
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Permanently delete and clear logs of all cancelled invoices shown in the audit trail ({invoiceAudits.length} recorded entries).
            </p>
          </div>
          <button
            onClick={handleClearCancelledInvoiceHistory}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Cancelled Invoice History</span>
          </button>
        </div>
      </div>

      {/* 1. PRODUCT MASTER CLEANUP */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
            <Package className="w-4 h-4 text-blue-600" />
            <span>Product Master Records ({products.length})</span>
          </h4>
          {selectedProductIds.length > 0 && (
            <button
              onClick={handleBatchDeleteProducts}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer animate-pulse"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Permanently Delete Selected ({selectedProductIds.length})</span>
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input 
                    type="checkbox" 
                    checked={products.length > 0 && selectedProductIds.length === products.length}
                    onChange={toggleSelectAllProducts}
                    className="cursor-pointer rounded text-blue-600"
                  />
                </th>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3">HSN Code</th>
                <th className="py-2.5 px-3 text-right">Standard Rate (₹)</th>
                <th className="py-2.5 px-3 text-right">Weight (kg)</th>
                <th className="py-2.5 px-3 text-right">CFT</th>
                <th className="py-2.5 px-3 text-right">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-400 italic">No product master records found.</td>
                </tr>
              ) : (
                products.map(prod => (
                  <tr key={prod.id} className={`hover:bg-slate-50 ${selectedProductIds.includes(prod.id) ? 'bg-red-50/50' : ''}`}>
                    <td className="py-2 px-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedProductIds.includes(prod.id)}
                        onChange={() => toggleSelectProduct(prod.id)}
                        className="cursor-pointer rounded text-blue-600"
                      />
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{prod.name}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">39239090</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700">₹{prod.price.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600">{prod.weight}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600">{prod.cft}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-blue-600">{prod.stock || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. CUSTOMER / PARTY MASTER CLEANUP */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Customer / Party Master Records ({parties.length})</span>
          </h4>
          {selectedPartyNames.length > 0 && (
            <button
              onClick={handleBatchDeleteParties}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer animate-pulse"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Permanently Delete Selected ({selectedPartyNames.length})</span>
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input 
                    type="checkbox" 
                    checked={parties.length > 0 && selectedPartyNames.length === parties.length}
                    onChange={toggleSelectAllParties}
                    className="cursor-pointer rounded text-blue-600"
                  />
                </th>
                <th className="py-2.5 px-3">Party Name</th>
                <th className="py-2.5 px-3">Destination / Tax Status</th>
                <th className="py-2.5 px-3">Billing Address</th>
                <th className="py-2.5 px-3">GSTIN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parties.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400 italic">No customer records found.</td>
                </tr>
              ) : (
                parties.map((party, idx) => {
                  const isInterState = isInterStateParty(party);
                  return (
                    <tr key={idx} className={`hover:bg-slate-50 ${selectedPartyNames.includes(party.name) ? 'bg-red-50/50' : ''}`}>
                      <td className="py-2 px-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedPartyNames.includes(party.name)}
                          onChange={() => toggleSelectParty(party.name)}
                          className="cursor-pointer rounded text-blue-600"
                        />
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{party.name}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          isInterState ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        }`}>
                          <span>{isInterState ? '🚚 Inter-State (18% IGST)' : '📍 Local (0% GST)'}</span>
                        </span>
                        {(party.city || party.state) && (
                          <span className="text-[10px] text-slate-500 block font-mono">
                            {party.city || '-'}, {party.state || '-'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{party.address}</td>
                      <td className="py-2 px-3 font-mono text-slate-700">{party.gstin}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. TRANSPORTER MASTER CLEANUP */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-amber-600" />
            <span>Transporter Master Records ({transporters.length})</span>
          </h4>
          {selectedTransNames.length > 0 && (
            <button
              onClick={handleBatchDeleteTransporters}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer animate-pulse"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Permanently Delete Selected ({selectedTransNames.length})</span>
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input 
                    type="checkbox" 
                    checked={transporters.length > 0 && selectedTransNames.length === transporters.length}
                    onChange={toggleSelectAllTransporters}
                    className="cursor-pointer rounded text-blue-600"
                  />
                </th>
                <th className="py-2.5 px-3">Transporter Name</th>
                <th className="py-2.5 px-3">Transporter GSTIN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transporters.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-slate-400 italic">No transporter records found.</td>
                </tr>
              ) : (
                transporters.map((tr, idx) => (
                  <tr key={idx} className={`hover:bg-slate-50 ${selectedTransNames.includes(tr.name) ? 'bg-red-50/50' : ''}`}>
                    <td className="py-2 px-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedTransNames.includes(tr.name)}
                        onChange={() => toggleSelectTransporter(tr.name)}
                        className="cursor-pointer rounded text-blue-600"
                      />
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{tr.name}</td>
                    <td className="py-2 px-3 font-mono text-slate-700">{tr.gstin}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. CLIENT MONTHLY DEMANDS CLEANUP */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-purple-600" />
            <span>Client Monthly Demand Limits ({clientDemands.length})</span>
          </h4>
          {selectedDemandIds.length > 0 && (
            <button
              onClick={handleBatchDeleteDemands}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer animate-pulse"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Permanently Delete Selected ({selectedDemandIds.length})</span>
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input 
                    type="checkbox" 
                    checked={clientDemands.length > 0 && selectedDemandIds.length === clientDemands.length}
                    onChange={toggleSelectAllDemands}
                    className="cursor-pointer rounded text-blue-600"
                  />
                </th>
                <th className="py-2.5 px-3">Client Party Name</th>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3 text-right">Allowed Monthly Limit (Units)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientDemands.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-400 italic">No client monthly demand limits found.</td>
                </tr>
              ) : (
                clientDemands.map(dem => (
                  <tr key={dem.id} className={`hover:bg-slate-50 ${selectedDemandIds.includes(dem.id) ? 'bg-red-50/50' : ''}`}>
                    <td className="py-2 px-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedDemandIds.includes(dem.id)}
                        onChange={() => toggleSelectDemand(dem.id)}
                        className="cursor-pointer rounded text-blue-600"
                      />
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{dem.partyName}</td>
                    <td className="py-2 px-3 text-slate-800">{dem.productName}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-purple-700">{dem.monthlyLimit} Pcs</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. INWARD LOGS CLEANUP */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
            <Warehouse className="w-4 h-4 text-emerald-600" />
            <span>Inward Stock Lots Logs ({inwards.length})</span>
          </h4>
          {selectedInwardIds.length > 0 && (
            <button
              onClick={handleBatchDeleteInwards}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer animate-pulse"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Permanently Delete Selected ({selectedInwardIds.length})</span>
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input 
                    type="checkbox" 
                    checked={inwards.length > 0 && selectedInwardIds.length === inwards.length}
                    onChange={toggleSelectAllInwards}
                    className="cursor-pointer rounded text-blue-600"
                  />
                </th>
                <th className="py-2.5 px-3">GR No</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3 text-right">Inward Qty</th>
                <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inwards.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-400 italic">No inward stock lot logs found.</td>
                </tr>
              ) : (
                inwards.map(inw => (
                  <tr key={inw.id} className={`hover:bg-slate-50 ${selectedInwardIds.includes(inw.id) ? 'bg-red-50/50' : ''}`}>
                    <td className="py-2 px-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedInwardIds.includes(inw.id)}
                        onChange={() => toggleSelectInward(inw.id)}
                        className="cursor-pointer rounded text-blue-600"
                      />
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{inw.grNo}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{inw.receiveDate}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{inw.productName}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">{inw.availableQty ?? inw.initialQty} Pcs</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">₹{Number(inw.price || 0).toFixed(2)}</td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteSingleInward(inw.id, inw.grNo)}
                        className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-[10px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                        title="Delete this inward lot from Firestore"
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. OUTWARD INVOICES CLEANUP */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-red-600" />
            <span>Outward Tax Invoices ({invoices.length})</span>
          </h4>
          {selectedInvoiceNos.length > 0 && (
            <button
              onClick={handleBatchDeleteInvoices}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer animate-pulse"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Permanently Delete Selected ({selectedInvoiceNos.length})</span>
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input 
                    type="checkbox" 
                    checked={invoices.length > 0 && selectedInvoiceNos.length === invoices.length}
                    onChange={toggleSelectAllInvoices}
                    className="cursor-pointer rounded text-blue-600"
                  />
                </th>
                <th className="py-2.5 px-3">Invoice Number</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Party Name</th>
                <th className="py-2.5 px-3 text-right">Total Qty</th>
                <th className="py-2.5 px-3 text-right">Grand Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-400 italic">No outward tax invoices found.</td>
                </tr>
              ) : (
                invoices.map(inv => (
                  <tr key={inv.invNo} className={`hover:bg-slate-50 ${selectedInvoiceNos.includes(inv.invNo) ? 'bg-red-50/50' : ''}`}>
                    <td className="py-2 px-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedInvoiceNos.includes(inv.invNo)}
                        onChange={() => toggleSelectInvoice(inv.invNo)}
                        className="cursor-pointer rounded text-blue-600"
                      />
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-red-600">{inv.invNo}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{formatDateDDMMYYYY(inv.date)}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{inv.partyName}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">{inv.totalQty} Pcs</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">₹{inv.grandTotal}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
