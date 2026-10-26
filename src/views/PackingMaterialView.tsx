import React, { useState, useEffect, useMemo, useRef, Component, ReactNode } from 'react';
import { 
  ArrowUpRight, 
  ClipboardList, 
  Warehouse, 
  FileSpreadsheet, 
  Edit3, 
  Edit2,
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Download, 
  Lock, 
  FileText,
  Scale,
  Box,
  Truck,
  Layers,
  Users,
  Database,
  BarChart3,
  Maximize2,
  Building2,
  ShieldCheck,
  Printer,
  Package,
  Calendar,
  History,
  X,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase';
import { 
  SenderConfig, 
  ThermocolProduct, 
  ThermocolParty, 
  ThermocolTransporter, 
  ThermocolInvoice, 
  ThermocolInward, 
  InwardGridRow,
  InvoiceLineItem,
  ClientDemand,
  InvoiceAuditLog,
  InvoiceFieldChange,
  StockWriteOff,
  PendingStockQueueItem,
  QueueStatus
} from './thermocol/types';
import { 
  DEFAULT_SENDER, 
  DEFAULT_HPL_SENDER,
  CompanyType,
  COMPANY_CONFIGS,
  formatInvNoForCompany,
  getInvoiceCompany,
  normalizeCompany,
  exportSapDispatchCsvHelper,
  DEFAULT_PRODUCTS, 
  DEFAULT_PARTIES, 
  DEFAULT_TRANSPORTERS, 
  DEFAULT_INWARDS,
  DEFAULT_DEMANDS,
  numberToWords,
  isInterStateParty,
  isIndoreDestination,
  getTaxRuleInfo,
  formatDateDDMMYYYY,
  parseCsvLine,
  normalizeIndianState,
  formatCityAndPin,
  sanitizePartyRecord,
  cleanStateOnly
} from './thermocol/utils';
import { OriginConfigHeader } from './thermocol/OriginConfigHeader';
import { TaxInvoiceModal, TaxInvoiceModalOverlay } from './thermocol/TaxInvoiceModal';
import { DataCleanupView } from './thermocol/DataCleanupView';
import { OutwardOrderEntryForm } from './thermocol/OutwardOrderEntryForm';
import { InvoiceAuditLogView } from './thermocol/InvoiceAuditLogView';
import { ProductHistoryModal } from './thermocol/ProductHistoryModal';
import { InvoiceCancellationQueueView } from './thermocol/InvoiceCancellationQueueView';
import { DeletePinModal } from './thermocol/DeletePinModal';

import { SynchronizedTableScroll } from '../components/SynchronizedTableScroll';
import { normalizeWmsDate } from '../utils/wmsDataEngine';
import {
  subscribeToAllIchOperations,
  subscribeToThermocolInwards,
  subscribeToThermocolInvoices,
  subscribeToThermocolProducts,
  subscribeToThermocolParties,
  subscribeToThermocolTransporters,
  subscribeToThermocolDemands,
  subscribeToThermocolAudits,
  subscribeToThermocolSequences,
  saveCompanyConfigToFirestore,
  subscribeToCompanyConfig,
  saveThermocolInwardsBatchToFirestore,
  saveThermocolInwardToFirestore,
  saveThermocolInvoiceToFirestore,
  addThermocolAuditLog,
  deleteThermocolInvoiceFromFirestore,
  deleteThermocolInwardFromFirestore,
  deleteThermocolProductFromFirestore,
  deleteThermocolPartyFromFirestore,
  deleteThermocolTransporterFromFirestore,
  deleteThermocolAuditLogFromFirestore,
  clearThermocolCancelledAuditsFromFirestore,
  saveThermocolProductsToFirestore,
  saveThermocolProductToFirestore,
  saveThermocolPartiesToFirestore,
  saveThermocolPartyToFirestore,
  saveThermocolTransportersToFirestore,
  saveThermocolTransporterToFirestore,
  saveThermocolDemandsToFirestore,
  saveThermocolAuditsToFirestore,
  saveThermocolSequencesToFirestore,
  incrementInvoiceSequenceAndSave,
  subscribeToThermocolPackingStore,
  syncThermocolPackingStateToFirestore,
  fetchIchOperationsWithGetDocs,
  fetchInvoicesFromIchOperations,
  withTimeout,
  COLLECTIONS
} from '../services/firestoreService';

interface PackingMaterialViewProps {
  currentUser?: { name?: string; role?: string; user?: string } | null;
}

export const PackingMaterialView: React.FC<PackingMaterialViewProps> = ({ currentUser }) => {
  // Navigation Tabs: Dedicated and cleanly separated
  const [activeTab, setActiveTab] = useState<
    'orderTab' | 'previewPrintTab' | 'editInvoiceTab' | 'cancellationQueueTab' | 'auditLogTab' | 'reportTab' | 'inwardTab' | 'masterTab'
  >('orderTab');

  // Pending Stock Queue state for PIN-gated cancellation stock reconciliation
  const [pendingStockQueue, setPendingStockQueue] = useState<PendingStockQueueItem[]>([]);

  // Global Delete PIN Modal State
  const [activeDeleteModal, setActiveDeleteModal] = useState<{
    title: string;
    itemDescription: string;
    company: CompanyType;
    action: () => Promise<void> | void;
  } | null>(null);


  // Modal overlay preview state
  const [modalPreviewInvoice, setModalPreviewInvoice] = useState<ThermocolInvoice | null>(null);

  // Sub-tab for Reports & Stock Status
  const [reportSubTab, setReportSubTab] = useState<'billing' | 'demandSupply' | 'stock' | 'auditLogs'>('billing');
  const [stockViewMode, setStockViewMode] = useState<'mrpWise' | 'consolidated'>('mrpWise');

  // Sub-tab for Masters & Data Cleanup
  const [masterSubTab, setMasterSubTab] = useState<'templates' | 'cleanup'>('templates');

  // Active Company Selection (AIL vs HPL / AHPL)
  // Active Company Selection (AIL vs HPL / AHPL)
  const [selectedCompany, setSelectedCompany] = useState<CompanyType>('AIL');

  // Consignor / Sender Origin Config for AIL (Abbott India Limited)
  const [senderAIL, setSenderAIL] = useState<SenderConfig>(DEFAULT_SENDER);

  // Consignor / Sender Origin Config for HPL (Abbott Healthcare Private Limited)
  const [senderHPL, setSenderHPL] = useState<SenderConfig>(DEFAULT_HPL_SENDER);

  const activeSender = selectedCompany === 'HPL' ? senderHPL : senderAIL;

  const handleUpdateSender = async (updated: SenderConfig) => {
    let newAIL = senderAIL;
    let newHPL = senderHPL;
    if (selectedCompany === 'HPL') {
      newHPL = updated;
      setSenderHPL(updated);
    } else {
      newAIL = updated;
      setSenderAIL(updated);
    }
    try {
      await saveCompanyConfigToFirestore(newAIL, newHPL);
      console.log('[Firestore Success] Saved company config / logo to Firestore permanently!');
    } catch (err) {
      console.warn('[Firestore Error] Failed saving company config:', err);
    }
  };

  const handleSelectCompany = (comp: CompanyType) => {
    const normalized = normalizeCompany(comp);
    setSelectedCompany(normalized);
    setReportCompanyFilter(normalized);
    setInwardCompanyFilter(normalized);
  };

  // Masters State - Real-time synced from Firestore
  const [products, setProducts] = useState<ThermocolProduct[]>([]);
  const [parties, setParties] = useState<ThermocolParty[]>([]);
  const [transporters, setTransporters] = useState<ThermocolTransporter[]>([]);
  const [clientDemands, setClientDemands] = useState<ClientDemand[]>([]);
  const [inwards, setInwards] = useState<ThermocolInward[]>([]);
  const [invoices, setInvoices] = useState<ThermocolInvoice[]>([]);
  const [invoiceSeqAIL, setInvoiceSeqAIL] = useState<number>(406);
  const [invoiceSeqHPL, setInvoiceSeqHPL] = useState<number>(7);
  const [challanSeqAIL, setChallanSeqAIL] = useState<number>(1);
  const [challanSeqHPL, setChallanSeqHPL] = useState<number>(1);
  const [editInward, setEditInward] = useState<ThermocolInward | null>(null);
  const [inwardEditQty, setInwardEditQty] = useState('');
  const [inwardEditAvailQty, setInwardEditAvailQty] = useState('');
  const [inwardEditRate, setInwardEditRate] = useState('');
  const [inwardEditReason, setInwardEditReason] = useState('');

  // New state for Available Stock & Product Details Edit
  const [editProd, setEditProd] = useState<ThermocolProduct | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editHsn, setEditHsn] = useState('39239090');
  const [editPackSize, setEditPackSize] = useState('Box of 10');
  const [editPackMultiple, setEditPackMultiple] = useState('10');
  const [editWeight, setEditWeight] = useState('0.15');
  const [editCft, setEditCft] = useState('0.02');

  const handleOpenEditProduct = (prod: ThermocolProduct) => {
    setEditProd(prod);
    setEditRate(String(prod.price || 0));
    setEditQty(String(getProductStock(prod)));
    setEditHsn(prod.hsnCode || '39239090');
    setEditPackSize(prod.packSize || 'Box of 10');
    setEditPackMultiple(String(prod.packSizeMultiple || 10));
    setEditWeight(String(prod.weight || 0.15));
    setEditCft(String(prod.cft || 0.02));
  };

  // Product Lifecycle & History Drill-down Modal State
  const [historyProduct, setHistoryProduct] = useState<ThermocolProduct | null>(null);

  const handleLogWriteOff = async (inwardId: string, qty: number, reason: string) => {
    const inwardIndex = inwards.findIndex(i => i.id === inwardId);
    if (inwardIndex === -1) return;

    const targetInw = inwards[inwardIndex];
    const newAvailQty = Math.max(0, (targetInw.availableQty || 0) - qty);
    const newWriteOff: StockWriteOff = {
      id: 'wo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      date: new Date().toISOString(),
      qty,
      reason,
      userName: currentUser?.name || 'Supervisor',
      grNo: targetInw.grNo,
      inwardInvNo: targetInw.invNo
    };

    const updatedWriteOffs = [...(targetInw.writeOffs || []), newWriteOff];
    const updatedInward: ThermocolInward = {
      ...targetInw,
      availableQty: newAvailQty,
      writeOffs: updatedWriteOffs,
      updatedAt: new Date().toISOString()
    };

    const newInwards = [...inwards];
    newInwards[inwardIndex] = updatedInward;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const inwComp = normalizeCompany(targetInw.company);
    const writeOffAudit: InvoiceAuditLog = {
      id: 'aud_wo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      invNo: targetInw.grNo || 'STOCK-WRITEOFF',
      company: inwComp,
      action: 'STOCK_ADJUSTMENT',
      timestamp,
      userName: currentUser?.name || 'Supervisor',
      userRole: currentUser?.role || 'SUPERVISOR',
      partyName: targetInw.supplyPlant || 'Inward Stock Ledger',
      productName: targetInw.productName,
      details: `Logged stock reduction/write-off of ${qty} pcs for product "${targetInw.productName}" (GR #${targetInw.grNo}). Reason: ${reason}. Remaining balance: ${newAvailQty} pcs`,
      reason,
      complianceChecksum: `CRC32-${Math.abs((targetInw.grNo || 'WO').split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(16).toUpperCase()}`
    };

    const updatedAudits = [writeOffAudit, ...invoiceAudits];
    setInwards(newInwards);
    setInvoiceAudits(updatedAudits);

    persistStorage(products, parties, transporters, clientDemands, newInwards, invoices, invoiceSeqAIL, invoiceSeqHPL, updatedAudits);

    try {
      await saveThermocolInwardToFirestore(updatedInward);
      await addThermocolAuditLog(writeOffAudit);
      setCsvStatusMsg({ text: `Recorded stock write-off of ${qty} pcs for GR #${targetInw.grNo} successfully!`, isError: false });
    } catch (e) {
      console.warn('Error syncing stock write-off to Firestore:', e);
    }
  };

  const activeInvoiceSeq = selectedCompany === 'HPL' ? invoiceSeqHPL : invoiceSeqAIL;
  const activeChallanSeq = selectedCompany === 'HPL' ? challanSeqHPL : challanSeqAIL;
  const currentSeriesDisplay = formatInvNoForCompany(selectedCompany, activeInvoiceSeq);

  const [invoiceAudits, setInvoiceAudits] = useState<InvoiceAuditLog[]>([]);

  // ----------------------------------------------------
  // REAL-TIME FIRESTORE COLLECTIONS SYNCHRONIZATION (getDocs on load + onSnapshot)
  // ----------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    // Immediate startup fetch from ich_operations using getDocs for instant data restoration
    const fetchExistingIchOperations = async () => {
      try {
        console.log('[Firestore Startup] Explicit getDocs fetching ich_operations in PackingMaterialView...');
        const [res, directInvoices] = await Promise.all([
          fetchIchOperationsWithGetDocs(),
          fetchInvoicesFromIchOperations()
        ]);
        if (!isMounted) return;

        if (res.inwards && res.inwards.length > 0) {
          setInwards(res.inwards.map(i => ({ ...i, company: normalizeCompany(i.company) })));
        }

        // Merge invoices from both parsers for maximum resilience
        const invoiceMap = new Map<string, ThermocolInvoice>();
        (res.invoices || []).forEach(inv => invoiceMap.set(inv.invNo, inv));
        (directInvoices || []).forEach(inv => invoiceMap.set(inv.invNo, inv));

        if (invoiceMap.size > 0) {
          const mergedInvoices = Array.from(invoiceMap.values()).map(inv => ({
            ...inv,
            senderName: (!inv.senderName || inv.senderName.includes('ICH Indore') || inv.senderName.includes('Posh Enterprises')) ? DEFAULT_SENDER.name : inv.senderName
          }));
          setInvoices(mergedInvoices);
          if (mergedInvoices.length > 0) {
            setSelectedPreviewInv(prev => prev || mergedInvoices[0].invNo);
          }
        }

        if (res.audits && res.audits.length > 0) {
          setInvoiceAudits(res.audits);
        }
        if (res.products && res.products.length > 0) {
          setProducts(res.products);
        }
        if (res.parties && res.parties.length > 0) {
          setParties(res.parties.map(p => {
            const sanitized = sanitizePartyRecord(p, normalizeCompany(p.company));
            return { ...sanitized, company: normalizeCompany(p.company || sanitized.company) };
          }));
        }
        if (res.transporters && res.transporters.length > 0) {
          setTransporters(res.transporters);
        }
        if (res.demands && res.demands.length > 0) {
          setClientDemands(res.demands);
        }
      } catch (err) {
        console.warn('[Firestore Startup] Error fetching ich_operations via getDocs in PackingMaterialView:', err);
      }
    };
    fetchExistingIchOperations();

    // 1. Primary Full-Collection Listener for ich_operations
    const unsubAllOps = subscribeToAllIchOperations((opsData) => {
      if (opsData.inwards && opsData.inwards.length > 0) {
        setInwards(opsData.inwards.map(i => ({ ...i, company: normalizeCompany(i.company) })));
      }
      if (opsData.invoices && opsData.invoices.length > 0) {
        setInvoices(opsData.invoices.map(inv => ({
          ...inv,
          senderName: (!inv.senderName || inv.senderName.includes('ICH Indore') || inv.senderName.includes('Posh Enterprises')) ? DEFAULT_SENDER.name : inv.senderName
        })));
      }
      if (opsData.audits && opsData.audits.length > 0) {
        setInvoiceAudits(opsData.audits);
      }
      // Master collections (products, parties, transporters, demands) are authoritatively
      // maintained by their own dedicated collection listeners below to prevent any state wipes.
    });

    // 2. Specific Sub-Collection Real-time Sync Listeners
    const unsubInwards = subscribeToThermocolInwards((data) => {
      if (data) {
        setInwards(data.map(i => ({ ...i, company: normalizeCompany(i.company) })));
      }
    });

    const unsubInvoices = subscribeToThermocolInvoices((data) => {
      if (data) {
        setInvoices(data.map(inv => ({
          ...inv,
          senderName: (!inv.senderName || inv.senderName.includes('ICH Indore') || inv.senderName.includes('Posh Enterprises')) ? DEFAULT_SENDER.name : inv.senderName
        })));
      }
    });

    const unsubProds = subscribeToThermocolProducts((data) => {
      if (data) {
        setProducts(data.map(p => ({ ...p, company: normalizeCompany(p.company) })));
      }
    });

    const unsubParties = subscribeToThermocolParties((data) => {
      if (data) {
        setParties(data.map(p => {
          const sanitized = sanitizePartyRecord(p, normalizeCompany(p.company));
          return { ...sanitized, company: normalizeCompany(p.company || sanitized.company) };
        }));
      }
    });

    const unsubTrans = subscribeToThermocolTransporters((data) => {
      if (data) {
        setTransporters(data.map(t => ({ ...t, company: normalizeCompany(t.company) })));
      }
    });

    const unsubDemands = subscribeToThermocolDemands((data) => {
      if (data) {
        setClientDemands(data.map(d => ({ ...d, company: normalizeCompany(d.company) })));
      }
    });

    const unsubAudits = subscribeToThermocolAudits((data) => {
      if (data) {
        setInvoiceAudits(data);
      }
    });

    const unsubSeqs = subscribeToThermocolSequences((seq) => {
      if (seq) {
        if (seq.seqAIL !== undefined) setInvoiceSeqAIL(seq.seqAIL);
        if (seq.seqHPL !== undefined) setInvoiceSeqHPL(seq.seqHPL);
        if (seq.challanSeqAIL !== undefined) setChallanSeqAIL(seq.challanSeqAIL);
        if (seq.challanSeqHPL !== undefined) setChallanSeqHPL(seq.challanSeqHPL);
      }
    });

    const unsubCompanyConfig = subscribeToCompanyConfig((config) => {
      if (config.senderAIL) setSenderAIL(config.senderAIL);
      if (config.senderHPL) setSenderHPL(config.senderHPL);
    });

    return () => {
      unsubAllOps();
      unsubInwards();
      unsubInvoices();
      unsubProds();
      unsubParties();
      unsubTrans();
      unsubDemands();
      unsubAudits();
      unsubSeqs();
      unsubCompanyConfig();
    };
  }, []);

  const persistStorage = async (
    newProds = products,
    newParts = parties,
    newTrans = transporters,
    newDemands = clientDemands,
    newInws = inwards,
    newInvs = invoices,
    _newSeqAIL?: number,
    _newSeqHPL?: number,
    newAudits = invoiceAudits,
    _newChallanSeqAIL?: number,
    _newChallanSeqHPL?: number
  ) => {
    try {
      const finalProds = (newProds && newProds.length > 0) ? newProds : products;
      const finalParts = (newParts && newParts.length > 0) ? newParts : parties;
      const finalTrans = (newTrans && newTrans.length > 0) ? newTrans : transporters;

      // Sync the single consolidated state document to conserve daily write quota
      await syncThermocolPackingStateToFirestore({
        products: finalProds,
        parties: finalParts,
        transporters: finalTrans,
        demands: newDemands,
        inwards: newInws,
        invoices: newInvs,
        audits: newAudits
      });
    } catch (err: any) {
      if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
        console.warn('[Firestore Sync] Quota limit reached in persistStorage. State preserved locally.');
      } else {
        console.warn('[Firestore Sync] Error in persistStorage:', err);
      }
    }
  };

  // Segregated & Deduplicated active master datasets
  const activeProducts = useMemo(() => {
    const map = new Map<string, ThermocolProduct>();
    products.forEach(p => {
      if (normalizeCompany(p.company) === selectedCompany && p.name && p.name.trim()) {
        const key = p.name.trim().toLowerCase();
        if (!map.has(key)) map.set(key, p);
      }
    });
    return Array.from(map.values());
  }, [products, selectedCompany]);

  const activeParties = useMemo(() => {
    const map = new Map<string, ThermocolParty>();
    parties.forEach(p => {
      if (normalizeCompany(p.company) === selectedCompany && p.name && p.name.trim()) {
        const key = p.name.trim().toLowerCase();
        if (!map.has(key)) map.set(key, p);
      }
    });
    return Array.from(map.values());
  }, [parties, selectedCompany]);

  const activeTransporters = useMemo(() => {
    const map = new Map<string, ThermocolTransporter>();
    transporters.forEach(t => {
      if ((!t.company || normalizeCompany(t.company) === selectedCompany) && t.name && t.name.trim()) {
        const key = t.name.trim().toLowerCase();
        if (!map.has(key)) map.set(key, t);
      }
    });
    return Array.from(map.values());
  }, [transporters, selectedCompany]);

  const activeClientDemands = useMemo(() => {
    const map = new Map<string, ClientDemand>();
    clientDemands.forEach(d => {
      if (normalizeCompany(d.company) === selectedCompany && d.partyName && d.productName) {
        const key = `${d.partyName.trim().toLowerCase()}_${d.productName.trim().toLowerCase()}`;
        if (!map.has(key)) map.set(key, d);
      }
    });
    return Array.from(map.values());
  }, [clientDemands, selectedCompany]);

  const activeInwards = useMemo(() => {
    return inwards.filter(i => normalizeCompany(i.company) === selectedCompany);
  }, [inwards, selectedCompany]);

  const activeInvoices = useMemo(() => {
    return invoices.filter(i => getInvoiceCompany(i) === selectedCompany);
  }, [invoices, selectedCompany]);

  // Helper to compute available stock for a specific product strictly for its company
  const getProductStock = (prod: ThermocolProduct) => {
    const prodComp = normalizeCompany(prod.company);
    return inwards
      .filter(i => i.productName === prod.name && normalizeCompany(i.company) === prodComp)
      .reduce((sum, i) => sum + (Number(i.availableQty) || 0), 0);
  };

  // Preview & Print Selection State
  const [selectedPreviewInv, setSelectedPreviewInv] = useState<string>(() => {
    return invoices.length > 0 ? invoices[0].invNo : '';
  });

  useEffect(() => {
    if (invoices.length > 0 && !invoices.some(i => i.invNo === selectedPreviewInv || i.invNo.replace(/[^a-zA-Z0-9]/g, '') === selectedPreviewInv.replace(/[^a-zA-Z0-9]/g, ''))) {
      setSelectedPreviewInv(invoices[0].invNo);
    }
  }, [invoices, selectedPreviewInv]);

  const activePreviewInvoice = useMemo(() => {
    if (!selectedPreviewInv && invoices.length > 0) return invoices[0];
    const exact = invoices.find(inv => inv.invNo === selectedPreviewInv);
    if (exact) return exact;
    const targetKey = selectedPreviewInv.replace(/[^a-zA-Z0-9]/g, '');
    return invoices.find(inv => (inv.invNo || '').replace(/[^a-zA-Z0-9]/g, '') === targetKey) || invoices[0] || null;
  }, [invoices, selectedPreviewInv]);

  // Outward Invoice form reset key and creation success notification
  const [newInvoiceFormKey, setNewInvoiceFormKey] = useState<number>(0);
  const [createdInvoiceSuccess, setCreatedInvoiceSuccess] = useState<ThermocolInvoice | null>(null);

  const handleOpenNewOutwardInvoice = () => {
    setNewInvoiceFormKey(prev => prev + 1);
    setCreatedInvoiceSuccess(null);
    setActiveTab('orderTab');
  };

  // Handle invoice submission from OutwardOrderEntryForm
  const handleSaveInvoiceFromForm = async (
    newInvoice: ThermocolInvoice,
    updatedInwards: ThermocolInward[],
    updatedDemands: ClientDemand[],
    _nextSeq: number, // Deprecated, now handled atomically
    isChallan: boolean = false
  ) => {
    const invComp = getInvoiceCompany(newInvoice);
    setSelectedCompany(invComp);
    setReportCompanyFilter(invComp);

    // 1. Atomically save invoice and get new sequence
    const result = await incrementInvoiceSequenceAndSave(newInvoice, isChallan, invComp);
    if (!result.success) {
      console.error('[Invoice Save Error] Atomic transaction failed.');
      alert("Failed to generate invoice. Please try again.");
      return;
    }

    // Update the invoice object with the final atomically-assigned invoice number
    const finalInvNo = result.invNo;
    const finalInvoice = { ...newInvoice, invNo: finalInvNo };

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const totQty = finalInvoice.items?.reduce((s, it) => s + (Number(it.qty) || 0), 0) || finalInvoice.totalQty || 0;
    const newCreateAudit: InvoiceAuditLog = {
      id: 'aud_gen_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      invNo: finalInvNo,
      company: invComp,
      action: 'CREATE',
      timestamp,
      userName: currentUser?.name || 'Authorized Supervisor',
      userRole: currentUser?.role || 'SUPERVISOR',
      partyName: finalInvoice.partyName || 'Customer / Consignee',
      totalValue: finalInvoice.grandTotal || '0',
      itemsCount: finalInvoice.items?.length || 1,
      vehicleNo: finalInvoice.vehicleNo || '-',
      transporter: finalInvoice.transName || '-',
      lrNo: finalInvoice.lrNo || '-',
      details: `Generated outward challan with ${finalInvoice.items?.length || 0} items (${totQty} pcs), Grand Total: ₹${finalInvoice.grandTotal}`,
      complianceChecksum: `CRC32-${Math.abs(finalInvNo.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(16).toUpperCase()}`
    };

    // 2. Persist audit logs and inwards batch to Firestore
    try {
      await addThermocolAuditLog(newCreateAudit);
      await saveThermocolInwardsBatchToFirestore(updatedInwards);
      await saveThermocolDemandsToFirestore(updatedDemands);
      
      // Update UI state after successful writes
      setSelectedPreviewInv(finalInvNo);
      setCreatedInvoiceSuccess(finalInvoice);
      console.log(`[Invoice Save Success] Invoice ${finalInvNo} successfully saved and persisted!`);
    } catch (saveErr) {
      console.error('[Invoice Save Error] Secondary persistence failed:', saveErr);
      alert("Invoice generated, but some secondary data failed to sync. Please refresh.");
    }
  };

  // DIRECT FIRESTORE INVOICES QUERY ON TAB CHANGE (Print Preview & Reports)
  useEffect(() => {
    if ((activeTab === 'previewPrintTab' || activeTab === 'reportTab') && invoices.length === 0) {
      console.log(`[Firestore Tab Sync] Direct query for invoices in ${activeTab}...`);
      fetchInvoicesFromIchOperations().then(loadedInvoices => {
        if (loadedInvoices && loadedInvoices.length > 0) {
          setInvoices(prev => {
            const map = new Map<string, ThermocolInvoice>();
            loadedInvoices.forEach(inv => map.set(inv.invNo, inv));
            prev.forEach(inv => {
              if (!map.has(inv.invNo)) map.set(inv.invNo, inv);
            });
            const merged = Array.from(map.values());
            if (!selectedPreviewInv && merged.length > 0) {
              setSelectedPreviewInv(merged[0].invNo);
            }
            return merged;
          });
        }
      }).catch(err => {
        console.warn('[Firestore Tab Sync] Error loading invoices directly:', err);
      });
    }
  }, [activeTab, invoices.length]);

  // Error Boundary for Edit Invoices tab to prevent white screen crashes
  class EditInvoiceErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
    state = { hasError: false, error: null };
    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }
    componentDidCatch(error: Error, errorInfo: any) {
      console.error('Edit Invoices component caught error:', error, errorInfo);
    }
    render() {
      if (this.state.hasError) {
        return (
          <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-md space-y-4 text-center my-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-base">Unable to Load Invoice Editor</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto font-mono">
              {this.state.error?.message || 'An unexpected rendering error occurred while loading invoice details.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
            >
              Retry / Reset Editor
            </button>
          </div>
        );
      }
      return this.props.children;
    }
  }

  // ----------------------------------------------------
  // Module D: Invoice Correction & Deletion with Stock Refund
  // ----------------------------------------------------
  const sanitizeInvoiceForEdit = (inv: ThermocolInvoice): ThermocolInvoice => {
    try {
      const items = Array.isArray(inv.items) ? inv.items.map(it => ({
        ...it,
        qty: Number(it.qty || 0),
        rate: Number(it.rate || 0),
        taxableValue: Number(it.taxableValue || (Number(it.qty || 0) * Number(it.rate || 0))),
        gstValue: Number(it.gstValue || 0),
        totalValue: Number(it.totalValue || (Number(it.taxableValue || 0) + Number(it.gstValue || 0))),
        packSize: it.packSize || '-',
        productName: it.productName || 'Unknown Product'
      })) : [];

      return {
        ...inv,
        items,
        partyName: inv.partyName || '',
        transName: inv.transName || '',
        vehicleNo: inv.vehicleNo || '',
        totalQty: Number(inv.totalQty || items.reduce((s, i) => s + i.qty, 0)),
        totalTaxable: String(inv.totalTaxable || items.reduce((s, i) => s + i.taxableValue, 0).toFixed(2)),
        totalGst: String(inv.totalGst || items.reduce((s, i) => s + i.gstValue, 0).toFixed(2)),
        grandTotal: String(inv.grandTotal || items.reduce((s, i) => s + i.totalValue, 0).toFixed(2)),
      };
    } catch (e) {
      console.error('Error sanitizing invoice for edit:', e);
      return inv;
    }
  };

  const [editInvNo, setEditInvNo] = useState<string>(() => {
    return invoices.length > 0 ? invoices[0].invNo : '';
  });
  const [editForm, setEditForm] = useState<ThermocolInvoice | null>(null);
  const [editMsg, setEditMsg] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    try {
      const inv = invoices.find(i => i.invNo === editInvNo);
      if (inv) {
        setEditForm(sanitizeInvoiceForEdit(JSON.parse(JSON.stringify(inv))));
      } else if (invoices.length > 0) {
        setEditInvNo(invoices[0].invNo);
        setEditForm(sanitizeInvoiceForEdit(JSON.parse(JSON.stringify(invoices[0]))));
      } else {
        setEditForm(null);
      }
    } catch (err) {
      console.error('Error setting edit form:', err);
      setEditForm(null);
    }
  }, [editInvNo, invoices]);

  const updateEditItem = (itemId: string, field: 'qty' | 'rate', value: string) => {
    if (!editForm) return;
    const num = Math.max(0, parseFloat(value) || 0);

    // Determine whether this invoice is Inter-State or Indore Local
    const isIndore = isIndoreDestination(editForm);
    const isInterState = !isIndore;

    const updatedItems = editForm.items.map(it => {
      if (it.id === itemId) {
        const q = field === 'qty' ? num : it.qty;
        const r = field === 'rate' ? num : it.rate;
        const taxable = q * r;
        const gst = isInterState ? taxable * 0.18 : 0;
        const total = taxable + gst;
        const prod = activeProducts.find(p => p.name === it.productName) || products.find(p => p.name === it.productName && normalizeCompany(p.company) === selectedCompany) || null;

        return {
          ...it,
          qty: q,
          rate: r,
          weight: Number((q * (prod?.weight || 0.1)).toFixed(2)),
          cft: Number((q * (prod?.cft || 0.01)).toFixed(2)),
          taxableValue: Number(taxable.toFixed(2)),
          gstRate: isInterState ? 18 : 0,
          gstValue: Number(gst.toFixed(2)),
          totalValue: Number(total.toFixed(2))
        };
      }
      return it;
    });

    const totTax = updatedItems.reduce((s, it) => s + it.taxableValue, 0);
    const totGst = updatedItems.reduce((s, it) => s + it.gstValue, 0);
    const totGrand = updatedItems.reduce((s, it) => s + it.totalValue, 0);
    const totQty = updatedItems.reduce((s, it) => s + it.qty, 0);
    const totWt = updatedItems.reduce((s, it) => s + it.weight, 0);
    const totCft = updatedItems.reduce((s, it) => s + it.cft, 0);

    setEditForm({
      ...editForm,
      isInterState,
      taxType: isInterState ? 'INTER_STATE_IGST' : 'LOCAL_EXEMPT',
      items: updatedItems,
      totalTaxable: totTax.toFixed(2),
      totalGst: totGst.toFixed(2),
      grandTotal: totGrand.toFixed(2),
      totalQty: totQty,
      totalWeight: totWt.toFixed(2),
      totalCft: totCft.toFixed(2)
    });
  };

  const handleSaveInvoiceCorrection = () => {
    if (!editForm) return;
    const oldInv = invoices.find(inv => inv.invNo === editForm.invNo);
    const updated = invoices.map(inv => (inv.invNo === editForm.invNo ? editForm : inv));

    // Compute exact field differences for audit compliance trail
    const changes: InvoiceFieldChange[] = [];
    if (oldInv) {
      if (oldInv.grandTotal !== editForm.grandTotal) {
        changes.push({ field: 'grandTotal', fieldLabel: 'Grand Total', oldValue: `₹${oldInv.grandTotal}`, newValue: `₹${editForm.grandTotal}` });
      }
      if (oldInv.totalQty !== editForm.totalQty) {
        changes.push({ field: 'totalQty', fieldLabel: 'Total Quantity', oldValue: oldInv.totalQty, newValue: editForm.totalQty });
      }
      if (oldInv.partyName !== editForm.partyName) {
        changes.push({ field: 'partyName', fieldLabel: 'Party Name', oldValue: oldInv.partyName, newValue: editForm.partyName });
      }
      if (oldInv.vehicleNo !== editForm.vehicleNo) {
        changes.push({ field: 'vehicleNo', fieldLabel: 'Vehicle Number', oldValue: oldInv.vehicleNo || '-', newValue: editForm.vehicleNo || '-' });
      }
      if (oldInv.transName !== editForm.transName) {
        changes.push({ field: 'transName', fieldLabel: 'Transporter', oldValue: oldInv.transName || '-', newValue: editForm.transName || '-' });
      }
      if (oldInv.lrNo !== editForm.lrNo) {
        changes.push({ field: 'lrNo', fieldLabel: 'LR Number', oldValue: oldInv.lrNo || '-', newValue: editForm.lrNo || '-' });
      }
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const invoiceCompany = getInvoiceCompany(editForm);
    const modificationAudit: InvoiceAuditLog = {
      id: 'aud_mod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      invNo: editForm.invNo,
      company: invoiceCompany,
      action: 'UPDATE',
      timestamp,
      userName: currentUser?.name || 'Authorized Supervisor',
      userRole: currentUser?.role || 'SUPERVISOR',
      partyName: editForm.partyName,
      totalValue: editForm.grandTotal,
      itemsCount: editForm.items?.length || 1,
      vehicleNo: editForm.vehicleNo || '-',
      transporter: editForm.transName || '-',
      lrNo: editForm.lrNo || '-',
      details: changes.length > 0 
        ? `Modified: ${changes.map(c => `${c.fieldLabel} (${c.oldValue} → ${c.newValue})`).join('; ')}`
        : `Invoice ${editForm.invNo} recalculated and saved by supervisor`,
      changes,
      complianceChecksum: `CRC32-${Math.abs(editForm.invNo.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(16).toUpperCase()}`
    };

    const updatedAudits = [modificationAudit, ...invoiceAudits];
    setInvoices(updated);
    setInvoiceAudits(updatedAudits);
    persistStorage(products, parties, transporters, clientDemands, inwards, updated, invoiceSeqAIL, invoiceSeqHPL, updatedAudits);
    saveThermocolInvoiceToFirestore(editForm);
    addThermocolAuditLog(modificationAudit);

    setEditMsg({ text: `Invoice ${editForm.invNo} successfully corrected and audit log recorded!`, isError: false });
    setTimeout(() => setEditMsg(null), 4000);
  };

  // PIN-Protected Invoice Cancellation & Restoration State
  const [pinModalInvoice, setPinModalInvoice] = useState<ThermocolInvoice | null>(null);
  const [cancelPinInput, setCancelPinInput] = useState('');
  const [cancelPinError, setCancelPinError] = useState('');

  // 1. Trigger PIN verification modal when user clicks to cancel/delete invoice
  const handleDeleteInvoice = async (invNo: string) => {
    const invToDelete = invoices.find(i => i.invNo === invNo);
    if (!invToDelete) {
      setEditMsg({ text: `Invoice ${invNo} was not found or has already been voided.`, isError: true });
      return;
    }
    setPinModalInvoice(invToDelete);
    setCancelPinInput('');
    setCancelPinError('');
  };

  // 2. Validate PIN and execute invoice cancellation (Routes stock to Pending Stock Queue)
  const handleConfirmPinCancellation = async () => {
    if (!pinModalInvoice) return;
    const invComp = getInvoiceCompany(pinModalInvoice);
    const expectedPin = invComp === 'HPL' ? '1301' : '7308';
    const compNameDisplay = invComp === 'HPL' ? 'AHPL (Abbott Healthcare)' : 'AIL (Abbott India)';

    if (cancelPinInput.trim() !== expectedPin) {
      setCancelPinError(`Security PIN incorrect for ${compNameDisplay}! Required PIN is ${expectedPin}. Cancellation blocked.`);
      return;
    }

    const invToDelete = pinModalInvoice;
    const invNo = invToDelete.invNo;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const totQty = invToDelete.items?.reduce((s, it) => s + (Number(it.qty) || 0), 0) || invToDelete.totalQty || 0;

    // Route stock to Pending Stock Queue (Do NOT merge back into active inwards automatically)
    const newQueueItem: PendingStockQueueItem = {
      id: 'psq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      invNo: invToDelete.invNo,
      company: invComp,
      cancelledAt: timestamp,
      cancelledBy: currentUser?.name || 'Authorized Supervisor',
      userRole: currentUser?.role || 'SUPERVISOR',
      partyName: invToDelete.partyName,
      vehicleNo: invToDelete.vehicleNo || '-',
      transporter: invToDelete.transName || '-',
      lrNo: invToDelete.lrNo || '-',
      totalQty: totQty,
      totalValue: invToDelete.grandTotal,
      items: JSON.parse(JSON.stringify(invToDelete.items || [])),
      status: 'PENDING_STOCK_VERIFICATION',
      invoiceSnapshot: JSON.parse(JSON.stringify(invToDelete)),
      pinVerified: true
    };

    const cancelAudit: InvoiceAuditLog = {
      id: 'aud_del_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      invNo: invToDelete.invNo,
      company: invComp,
      action: 'CANCEL',
      timestamp,
      deletedAt: timestamp,
      userName: currentUser?.name || 'Authorized Supervisor',
      userRole: currentUser?.role || 'SUPERVISOR',
      partyName: invToDelete.partyName,
      productName: invToDelete.items && invToDelete.items.length > 0 ? invToDelete.items.map(i => i.productName).join(', ') : 'EPS Products',
      refundedQty: totQty,
      totalValue: invToDelete.grandTotal,
      itemsCount: invToDelete.items?.length || 1,
      vehicleNo: invToDelete.vehicleNo || '-',
      transporter: invToDelete.transName || '-',
      lrNo: invToDelete.lrNo || '-',
      details: `Cancelled invoice ${invToDelete.invNo} with authorized PIN validation (${expectedPin}); routed ${totQty} pcs across ${invToDelete.items?.length || 0} line items to Pending Stock Queue`,
      snapshotBefore: JSON.parse(JSON.stringify(invToDelete)),
      complianceChecksum: `CRC32-${Math.abs(invToDelete.invNo.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(16).toUpperCase()}`
    };

    const updatedInvoices = invoices.filter(i => i.invNo !== invNo);
    const updatedAudits = [cancelAudit, ...invoiceAudits];
    const updatedQueue = [newQueueItem, ...pendingStockQueue];

    setInvoices(updatedInvoices);
    setPendingStockQueue(updatedQueue);
    setInvoiceAudits(updatedAudits);
    setEditForm(null);
    setEditInvNo(updatedInvoices.length > 0 ? updatedInvoices[0].invNo : '');
    setPinModalInvoice(null);
    setCancelPinInput('');
    setCancelPinError('');

    persistStorage(products, parties, transporters, clientDemands, inwards, updatedInvoices, invoiceSeqAIL, invoiceSeqHPL, updatedAudits);

    try {
      await deleteThermocolInvoiceFromFirestore(invNo);
      await addThermocolAuditLog(cancelAudit);
      setEditMsg({ text: `Invoice ${invNo} cancelled with PIN authorization (${compNameDisplay}). ${totQty} pcs routed to Pending Stock Queue.`, isError: false });
      setCsvStatusMsg({ text: `Invoice ${invNo} cancelled & routed to Pending Stock Queue.`, isError: false });
    } catch (err: any) {
      console.warn('[Firestore] Error during invoice deletion sync:', err);
      setEditMsg({ text: `Error cancelling invoice ${invNo}: ${err?.message || err}`, isError: true });
    }
  };

  // Handler for PIN-Protected Stock Verification & Crediting
  const handleVerifyAndCreditStock = async (queueItemId: string, pin: string) => {
    const targetItem = pendingStockQueue.find(i => i.id === queueItemId);
    if (!targetItem) return { success: false, error: 'Queue record not found.' };

    const expectedPin = targetItem.company === 'HPL' ? '1301' : '7308';
    if (pin.trim() !== expectedPin) {
      return { success: false, error: `Invalid PIN for ${targetItem.company === 'HPL' ? 'AHPL' : 'AIL'}. Required PIN is ${expectedPin}.` };
    }

    // Credit stock to active inwards inventory
    const updatedInwards = [...inwards];
    if (Array.isArray(targetItem.items)) {
      targetItem.items.forEach(it => {
        let qtyToCredit = Number(it.qty) || 0;
        for (const inw of updatedInwards) {
          if (inw.productName === it.productName && normalizeCompany(inw.company) === targetItem.company) {
            inw.availableQty = (inw.availableQty || 0) + qtyToCredit;
            qtyToCredit = 0;
            break;
          }
        }
        if (qtyToCredit > 0 && updatedInwards.length > 0) {
          const fallbackInw = updatedInwards.find(i => normalizeCompany(i.company) === targetItem.company) || updatedInwards[0];
          fallbackInw.availableQty = (fallbackInw.availableQty || 0) + qtyToCredit;
        }
      });
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const updatedQueue = pendingStockQueue.map(i => {
      if (i.id === queueItemId) {
        return {
          ...i,
          status: 'STOCKS_CREDITED' as QueueStatus,
          stockCreditedAt: timestamp,
          stockCreditedBy: currentUser?.name || 'Authorized Supervisor'
        };
      }
      return i;
    });

    const stockAudit: InvoiceAuditLog = {
      id: 'aud_stk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      invNo: targetItem.invNo,
      company: targetItem.company,
      action: 'STOCK_ADJUSTMENT',
      timestamp,
      userName: currentUser?.name || 'Authorized Supervisor',
      userRole: currentUser?.role || 'SUPERVISOR',
      partyName: targetItem.partyName,
      refundedQty: targetItem.totalQty,
      totalValue: targetItem.totalValue,
      details: `PIN verified (${expectedPin}) & credited ${targetItem.totalQty} returned pcs for invoice ${targetItem.invNo} back to active inventory stock`,
      complianceChecksum: `CRC32-${Math.abs(targetItem.invNo.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(16).toUpperCase()}`
    };

    const updatedAudits = [stockAudit, ...invoiceAudits];
    setInwards(updatedInwards);
    setPendingStockQueue(updatedQueue);
    setInvoiceAudits(updatedAudits);

    persistStorage(products, parties, transporters, clientDemands, updatedInwards, invoices, invoiceSeqAIL, invoiceSeqHPL, updatedAudits);

    try {
      await saveThermocolInwardsBatchToFirestore(updatedInwards);
      await addThermocolAuditLog(stockAudit);
      return { success: true };
    } catch (err: any) {
      console.warn('Error syncing verified stock:', err);
      return { success: true };
    }
  };

  // Handler for PIN-Protected Invoice Restoration from Queue
  const handleRestoreInvoiceFromQueue = async (queueItemId: string, pin: string) => {
    const targetItem = pendingStockQueue.find(i => i.id === queueItemId);
    if (!targetItem) return { success: false, error: 'Queue record not found.' };

    const expectedPin = targetItem.company === 'HPL' ? '1301' : '7308';
    if (pin.trim() !== expectedPin) {
      return { success: false, error: `Invalid PIN for ${targetItem.company === 'HPL' ? 'AHPL' : 'AIL'}. Required PIN is ${expectedPin}.` };
    }

    const invToRestore = targetItem.invoiceSnapshot;
    if (!invToRestore) {
      return { success: false, error: 'Original invoice snapshot not found.' };
    }

    const invNoKey = invToRestore.invNo.trim().replace(/[^a-zA-Z0-9]/g, '');
    const alreadyActive = invoices.some(i => (i.invNo || '').trim().replace(/[^a-zA-Z0-9]/g, '') === invNoKey);
    if (alreadyActive) {
      return { success: false, error: `Invoice ${invToRestore.invNo} is already active in system!` };
    }

    // If stock was credited earlier, re-deduct it from inwards
    const updatedInwards = [...inwards];
    if (targetItem.status === 'STOCKS_CREDITED' && Array.isArray(invToRestore.items)) {
      invToRestore.items.forEach(it => {
        let qtyToDeduct = Number(it.qty) || 0;
        for (const inw of updatedInwards) {
          if (inw.productName === it.productName && normalizeCompany(inw.company) === targetItem.company) {
            inw.availableQty = Math.max(0, (inw.availableQty || 0) - qtyToDeduct);
            qtyToDeduct = 0;
            break;
          }
        }
      });
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const updatedQueue = pendingStockQueue.map(i => {
      if (i.id === queueItemId) {
        return {
          ...i,
          status: 'RESTORED' as QueueStatus,
          restoredAt: timestamp,
          restoredBy: currentUser?.name || 'Authorized Supervisor'
        };
      }
      return i;
    });

    const restoreAudit: InvoiceAuditLog = {
      id: 'aud_res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      invNo: invToRestore.invNo,
      company: targetItem.company,
      action: 'CREATE',
      timestamp,
      userName: currentUser?.name || 'Authorized Supervisor',
      userRole: currentUser?.role || 'SUPERVISOR',
      partyName: invToRestore.partyName,
      totalValue: invToRestore.grandTotal,
      itemsCount: invToRestore.items?.length || 1,
      vehicleNo: invToRestore.vehicleNo || '-',
      transporter: invToRestore.transName || '-',
      lrNo: invToRestore.lrNo || '-',
      details: `Regenerated and restored cancelled invoice ${invToRestore.invNo} (${invToRestore.items?.length || 0} items) to ACTIVE status with PIN verification (${expectedPin})`,
      complianceChecksum: `CRC32-${Math.abs(invToRestore.invNo.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(16).toUpperCase()}`
    };

    const updatedInvoices = [invToRestore, ...invoices];
    const updatedAudits = [restoreAudit, ...invoiceAudits];

    setInvoices(updatedInvoices);
    setInwards(updatedInwards);
    setPendingStockQueue(updatedQueue);
    setInvoiceAudits(updatedAudits);
    setSelectedPreviewInv(invToRestore.invNo);

    persistStorage(products, parties, transporters, clientDemands, updatedInwards, updatedInvoices, invoiceSeqAIL, invoiceSeqHPL, updatedAudits);

    try {
      await saveThermocolInvoiceToFirestore(invToRestore);
      await saveThermocolInwardsBatchToFirestore(updatedInwards);
      await addThermocolAuditLog(restoreAudit);
      return { success: true };
    } catch (err: any) {
      console.warn('Error syncing restored invoice:', err);
      return { success: true };
    }
  };

  const handlePurgeQueueItem = async (queueItemId: string, pin: string) => {
    const targetItem = pendingStockQueue.find(i => i.id === queueItemId);
    if (!targetItem) return { success: false, error: 'Queue record not found.' };

    const expectedPin = targetItem.company === 'HPL' ? '1301' : '7308';
    if (pin.trim() !== expectedPin) {
      return { success: false, error: `Invalid PIN for ${targetItem.company === 'HPL' ? 'AHPL' : 'AIL'}. Required PIN is ${expectedPin}.` };
    }

    const updatedQueue = pendingStockQueue.filter(i => i.id !== queueItemId);
    setPendingStockQueue(updatedQueue);

    persistStorage(products, parties, transporters, clientDemands, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
    return { success: true };
  };

  // 3. Invoice Regeneration / Restoration Handler
  const handleRestoreInvoice = async (invNo: string, auditRecord?: InvoiceAuditLog) => {
    const targetKey = invNo.trim().replace(/[^a-zA-Z0-9]/g, '');
    const alreadyActive = invoices.find(i => (i.invNo || '').trim().replace(/[^a-zA-Z0-9]/g, '') === targetKey);
    if (alreadyActive) {
      alert(`Invoice ${invNo} is already active in the system!`);
      return;
    }

    let invToRestore: ThermocolInvoice | null = null;

    // 1st Preference: Retrieve snapshotBefore directly from auditRecord or invoiceAudits history
    if (auditRecord?.snapshotBefore && Array.isArray(auditRecord.snapshotBefore.items) && auditRecord.snapshotBefore.items.length > 0) {
      invToRestore = JSON.parse(JSON.stringify(auditRecord.snapshotBefore));
    } else {
      const matchAudit = invoiceAudits.find(a => 
        a.snapshotBefore && 
        Array.isArray(a.snapshotBefore.items) &&
        a.snapshotBefore.items.length > 0 &&
        ((a.invNo || '').trim().replace(/[^a-zA-Z0-9]/g, '') === targetKey)
      );
      if (matchAudit && matchAudit.snapshotBefore) {
        invToRestore = JSON.parse(JSON.stringify(matchAudit.snapshotBefore));
      }
    }

    // 2nd Preference: Reconstruct invoice with ALL items if snapshot is not directly stored
    if (!invToRestore) {
      const matchingAudits = invoiceAudits.filter(a => 
        ((a.invNo || '').trim().replace(/[^a-zA-Z0-9]/g, '') === targetKey)
      );
      const primaryAudit = auditRecord || matchingAudits[0];

      if (primaryAudit) {
        const comp = primaryAudit.company || (invNo.includes('AHPL') || invNo.includes('HPL') ? 'HPL' : 'AIL');
        const sender = comp === 'HPL' ? senderHPL : senderAIL;

        // Collect all items from matching audit logs or snapshotBefore properties
        const restoredItems: InvoiceLineItem[] = [];

        matchingAudits.forEach(a => {
          if (a.snapshotBefore && Array.isArray(a.snapshotBefore.items)) {
            a.snapshotBefore.items.forEach(it => {
              if (!restoredItems.some(existing => existing.productName === it.productName || existing.id === it.id)) {
                restoredItems.push(JSON.parse(JSON.stringify(it)));
              }
            });
          }
        });

        if (restoredItems.length === 0) {
          matchingAudits.forEach((aud, idx) => {
            if (aud.productName) {
              const prodName = aud.productName;
              const qty = Number(aud.refundedQty) || 10;
              const prodMaster = products.find(p => p.name === prodName) || null;
              const rate = prodMaster?.price || 15.5;
              const taxableValue = Number((qty * rate).toFixed(2));
              const gstRate = 0;
              const gstValue = 0;
              const totalValue = taxableValue;

              if (!restoredItems.some(it => it.productName === prodName)) {
                restoredItems.push({
                  id: `it_res_${Date.now()}_${idx}`,
                  productName: prodName,
                  hsnCode: prodMaster?.hsnCode || '39239090',
                  packSize: prodMaster?.packSize || 'Box of 10',
                  packSizeMultiple: prodMaster?.packSizeMultiple || 10,
                  cases: Math.ceil(qty / (prodMaster?.packSizeMultiple || 10)),
                  qty: qty,
                  rate: rate,
                  weight: Number((qty * (prodMaster?.weight || 0.15)).toFixed(2)),
                  cft: Number((qty * (prodMaster?.cft || 0.02)).toFixed(2)),
                  taxableValue: taxableValue,
                  gstRate: gstRate,
                  gstValue: gstValue,
                  totalValue: totalValue
                });
              }
            }
          });
        }

        if (restoredItems.length === 0) {
          const totalValNum = Number(primaryAudit.totalValue || 0);
          restoredItems.push({
            id: 'it_res_' + Date.now(),
            productName: primaryAudit.productName || 'EPS Corner Guard',
            hsnCode: '39239090',
            packSize: 'Box of 10',
            packSizeMultiple: 10,
            cases: 1,
            qty: primaryAudit.refundedQty || 10,
            rate: primaryAudit.refundedQty ? Number((totalValNum / primaryAudit.refundedQty).toFixed(2)) : 15.5,
            weight: 1.5,
            cft: 0.2,
            taxableValue: totalValNum,
            gstRate: 0,
            gstValue: 0,
            totalValue: totalValNum
          });
        }

        const totTaxableNum = restoredItems.reduce((s, it) => s + (Number(it.taxableValue) || 0), 0);
        const totGstNum = restoredItems.reduce((s, it) => s + (Number(it.gstValue) || 0), 0);
        const grandTotalNum = restoredItems.reduce((s, it) => s + (Number(it.totalValue) || 0), 0);
        const totQtyNum = restoredItems.reduce((s, it) => s + (Number(it.qty) || 0), 0);
        const totCasesNum = restoredItems.reduce((s, it) => s + (Number(it.cases) || 1), 0);
        const totWeightNum = restoredItems.reduce((s, it) => s + (Number(it.weight) || 0), 0);
        const totCftNum = restoredItems.reduce((s, it) => s + (Number(it.cft) || 0), 0);

        invToRestore = {
          invNo: primaryAudit.invNo || invNo,
          company: comp,
          date: primaryAudit.timestamp?.split(' ')[0] || new Date().toISOString().split('T')[0],
          partyName: primaryAudit.partyName || 'Restored Customer',
          partyAddress: 'Indore, Madhya Pradesh - 452001',
          partyGstin: '23UNREGISTERED',
          partyCity: 'Indore',
          partyState: 'Madhya Pradesh',
          partyPincode: '452001',
          isInterState: false,
          taxType: 'LOCAL_EXEMPT',
          senderName: sender.name,
          senderAddress: sender.address,
          senderGstin: sender.gstin,
          senderPan: sender.pan,
          senderCin: sender.cin,
          senderLogoUrl: sender.logoUrl,
          logo: sender.logoUrl,
          transName: primaryAudit.transporter || 'Direct Logistics',
          transGstin: '23UNREGISTERED',
          lrNo: primaryAudit.lrNo || 'LR-RESTORE',
          lrDate: new Date().toISOString().split('T')[0],
          vehicleNo: primaryAudit.vehicleNo || 'MP09-RESTORE',
          totalTaxable: totTaxableNum.toFixed(2),
          totalGst: totGstNum.toFixed(2),
          grandTotal: (primaryAudit.totalValue && Number(primaryAudit.totalValue) > 0 ? Number(primaryAudit.totalValue).toFixed(2) : grandTotalNum.toFixed(2)),
          totalQty: totQtyNum,
          totalCases: totCasesNum,
          totalWeight: totWeightNum.toFixed(2),
          totalCft: totCftNum.toFixed(2),
          items: restoredItems
        };
      }
    }

    if (!invToRestore) {
      alert(`Could not find original invoice data for ${invNo}.`);
      return;
    }

    // Ensure invToRestore has valid totals matching items array
    if (Array.isArray(invToRestore.items) && invToRestore.items.length > 0) {
      const totQtyNum = invToRestore.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
      const totTaxableNum = invToRestore.items.reduce((s, it) => s + (Number(it.taxableValue) || 0), 0);
      const totGstNum = invToRestore.items.reduce((s, it) => s + (Number(it.gstValue) || 0), 0);
      const grandTotalNum = invToRestore.items.reduce((s, it) => s + (Number(it.totalValue) || 0), 0);

      invToRestore.totalQty = totQtyNum;
      invToRestore.totalTaxable = totTaxableNum.toFixed(2);
      invToRestore.totalGst = totGstNum.toFixed(2);
      invToRestore.grandTotal = grandTotalNum.toFixed(2);
    }

    const invComp = getInvoiceCompany(invToRestore);
    const compNameDisplay = invComp === 'HPL' ? 'AHPL (Abbott Healthcare)' : 'AIL (Abbott India)';
    const confirmRestore = window.confirm(
      `Re-activate and restore cancelled invoice ${invNo} (${compNameDisplay}) with ${invToRestore.items?.length || 0} line items (${invToRestore.totalQty} pcs total) back to ACTIVE status using the exact same invoice number?\n\nThis will re-deduct required stock items from the inward stock ledger.`
    );
    if (!confirmRestore) return;

    // Deduct stock for restored items from inwards ledger
    const updatedInwards = [...inwards];
    if (Array.isArray(invToRestore.items)) {
      invToRestore.items.forEach(it => {
        let qtyToDeduct = Number(it.qty) || 0;
        for (const inw of updatedInwards) {
          if (inw.productName === it.productName && normalizeCompany(inw.company) === invComp) {
            inw.availableQty = Math.max(0, (inw.availableQty || 0) - qtyToDeduct);
            qtyToDeduct = 0;
            break;
          }
        }
      });
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const restoreAudit: InvoiceAuditLog = {
      id: 'aud_res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      invNo: invToRestore.invNo,
      company: invComp,
      action: 'CREATE',
      timestamp,
      userName: currentUser?.name || 'Authorized Supervisor',
      userRole: currentUser?.role || 'SUPERVISOR',
      partyName: invToRestore.partyName,
      totalValue: invToRestore.grandTotal,
      itemsCount: invToRestore.items?.length || 1,
      vehicleNo: invToRestore.vehicleNo || '-',
      transporter: invToRestore.transName || '-',
      lrNo: invToRestore.lrNo || '-',
      details: `Regenerated and restored cancelled invoice ${invToRestore.invNo} with ${invToRestore.items?.length || 0} line items (${invToRestore.totalQty} pcs) to ACTIVE status with exact original invoice number; re-deducted inventory stock`,
      complianceChecksum: `CRC32-${Math.abs(invToRestore.invNo.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(16).toUpperCase()}`
    };

    // Reactivate invoice in state
    const updatedInvoices = [invToRestore, ...invoices];
    const updatedAudits = [restoreAudit, ...invoiceAudits];

    setInvoices(updatedInvoices);
    setInwards(updatedInwards);
    setInvoiceAudits(updatedAudits);
    setSelectedPreviewInv(invToRestore.invNo);
    setEditInvNo(invToRestore.invNo);

    persistStorage(products, parties, transporters, clientDemands, updatedInwards, updatedInvoices, invoiceSeqAIL, invoiceSeqHPL, updatedAudits);

    try {
      await saveThermocolInvoiceToFirestore(invToRestore);
      await saveThermocolInwardsBatchToFirestore(updatedInwards);
      await addThermocolAuditLog(restoreAudit);
      setEditMsg({ text: `Invoice ${invToRestore.invNo} (${invToRestore.items?.length || 0} items) successfully regenerated & restored to Active status!`, isError: false });
      setCsvStatusMsg({ text: `Invoice ${invToRestore.invNo} restored in cloud database.`, isError: false });
      setTimeout(() => setEditMsg(null), 4000);
    } catch (err: any) {
      console.warn('[Firestore] Error during invoice restore sync:', err);
    }
  };

  // Permanent Delete an Individual Audit / Cancel History Record from Firestore
  const handleDeleteAuditLog = (id: string) => {
    const aud = invoiceAudits.find(a => a.id === id || a.invNo === id);
    const identifier = aud?.invNo || id;
    const targetId = aud?.id || id;
    const comp = aud?.company || (aud?.invNo?.includes('AHPL') || aud?.invNo?.includes('HPL') ? 'HPL' : selectedCompany);

    setActiveDeleteModal({
      title: 'Delete Invoice Audit Trail Record',
      itemDescription: `Audit Record ID: ${targetId} | Invoice No: ${identifier} (${comp === 'HPL' ? 'AHPL' : 'AIL'})`,
      company: comp,
      action: async () => {
        setInvoiceAudits(prev => prev.filter(a => a.id !== targetId && a.invNo !== identifier));
        try {
          await deleteThermocolAuditLogFromFirestore(targetId);
          if (aud?.invNo && aud.invNo !== targetId) {
            await deleteThermocolAuditLogFromFirestore(aud.invNo);
          }
          setCsvStatusMsg({ text: `Audit record for invoice ${identifier} deleted from Firestore with PIN authorization.`, isError: false });
        } catch (err: any) {
          console.error('[Firestore] Error deleting audit log:', err);
          setCsvStatusMsg({ text: `Error deleting audit record: ${err?.message || err}`, isError: true });
        }
      }
    });
  };

  // Purge All Cancelled Invoice Records from Firestore
  const handlePurgeCancelledAudits = () => {
    const cancelledCount = invoiceAudits.filter(a => a.action === 'CANCEL' || a.deletedAt).length;
    if (cancelledCount === 0) {
      setCsvStatusMsg({ text: 'No cancelled invoice history records to purge.', isError: false });
      return;
    }

    setActiveDeleteModal({
      title: 'Purge All Cancelled Audit Logs',
      itemDescription: `Purge ${cancelledCount} cancelled invoice audit history records from database for ${selectedCompany === 'HPL' ? 'AHPL' : 'AIL'}`,
      company: selectedCompany,
      action: async () => {
        setInvoiceAudits(prev => prev.filter(a => a.action !== 'CANCEL' && !a.deletedAt));
        try {
          await clearThermocolCancelledAuditsFromFirestore();
          setCsvStatusMsg({ text: `Purged ${cancelledCount} cancelled invoice records from Firestore with PIN authorization.`, isError: false });
        } catch (err: any) {
          console.error('[Firestore] Error purging cancelled audits:', err);
          setCsvStatusMsg({ text: `Failed to purge records: ${err?.message || err}`, isError: true });
        }
      }
    });
  };

  // ----------------------------------------------------
  // Module E: Reports & Stock Status Calculations (Company-Wise Segregation)
  // ----------------------------------------------------
  const [reportCompanyFilter, setReportCompanyFilter] = useState<'AIL' | 'HPL' | 'ALL'>(() => selectedCompany);
  const [reportDateFilter, setReportDateFilter] = useState('');
  const [reportView, setReportView] = useState<'summary' | 'detailed'>('summary');

  // Sync reportCompanyFilter whenever active company changes in top switcher
  useEffect(() => {
    setReportCompanyFilter(selectedCompany);
  }, [selectedCompany]);

  // Filtered invoices segregated by active company filter and date filter
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const comp = getInvoiceCompany(inv);
      if (reportCompanyFilter !== 'ALL' && comp !== reportCompanyFilter) {
        return false;
      }
      if (!reportDateFilter) return true;
      const invNorm = normalizeWmsDate(inv.date);
      return invNorm === reportDateFilter || (inv.date && inv.date.includes(reportDateFilter));
    });
  }, [invoices, reportCompanyFilter, reportDateFilter]);

  // Aggregate Summary KPI Metrics for the filtered report invoices
  const reportMetrics = useMemo(() => {
    const count = filteredInvoices.length;
    const totalTaxable = filteredInvoices.reduce((s, inv) => s + (parseFloat(inv.totalTaxable) || 0), 0);
    const totalTax = filteredInvoices.reduce((s, inv) => {
      const isIndore = isIndoreDestination(inv);
      return s + (isIndore ? 0 : (parseFloat(inv.totalGst) || 0));
    }, 0);
    const grandTotal = filteredInvoices.reduce((s, inv) => s + (parseFloat(inv.grandTotal) || 0), 0);
    const totalCases = filteredInvoices.reduce((s, inv) => {
      const c = inv.totalCases ?? inv.items.reduce((acc, it) => acc + (it.cases ?? (it.packSizeMultiple > 0 ? Math.ceil(it.qty / it.packSizeMultiple) : 1)), 0);
      return s + Number(c);
    }, 0);

    return {
      count,
      totalTaxable: totalTaxable.toFixed(2),
      totalTax: totalTax.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      totalCases
    };
  }, [filteredInvoices]);

  const exportSummaryCsv = () => {
    if (filteredInvoices.length === 0) {
      alert("No invoices available to export for selected company filter.");
      return;
    }
    const headers = [
      "Company", "Invoice No", "Date", "Client Name", "Destination / Tax Jurisdiction", "Tax Rule", 
      "Client GSTIN", "Transporter", "LR No", "Vehicle No", "Total Cases", "Total Qty", 
      "Weight (kg)", "CFT", "Taxable Value (INR)", "Tax (INR)", "Grand Total (INR)"
    ];
    const rows = filteredInvoices.map(inv => {
      const isIndore = isIndoreDestination(inv);
      const isInterState = !isIndore;
      const taxRuleStr = isInterState ? "Inter-State (18% IGST)" : "Indore Destination (0% GST - Delivery Challan)";
      const taxTypeStr = isInterState ? "Inter-State" : "Indore (MP)";
      const compCode = getInvoiceCompany(inv);

      return [
        `"${compCode === 'HPL' ? 'AHPL (Abbott Healthcare)' : 'AIL (Abbott India)'}"`,
        `"${inv.invNo}"`,
        `"${formatDateDDMMYYYY(inv.date)}"`,
        `"${inv.partyName}"`,
        `"${taxTypeStr}"`,
        `"${taxRuleStr}"`,
        `"${inv.partyGstin}"`,
        `"${inv.transName}"`,
        `"${inv.lrNo}"`,
        `"${inv.vehicleNo}"`,
        inv.totalCases ?? 0,
        inv.totalQty,
        inv.totalWeight,
        inv.totalCft,
        inv.totalTaxable,
        isInterState ? inv.totalGst : "0.00",
        inv.grandTotal
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Thermocol_Billing_Summary_${reportCompanyFilter}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportDetailedCsv = () => {
    if (filteredInvoices.length === 0) {
      alert("No invoices available to export for selected company filter.");
      return;
    }
    const headers = [
      "Company", "Invoice No", "Date", "Client Name", "Tax Rule", "Product Name", 
      "HSN Code", "Pack Size", "Cases", "Quantity", "Rate", "Weight (kg)", "CFT", 
      "Taxable (INR)", "Tax (INR)", "Total (INR)"
    ];
    const rows: string[] = [];

    filteredInvoices.forEach(inv => {
      const isIndore = isIndoreDestination(inv);
      const isInterState = !isIndore;
      const taxRuleStr = isInterState ? "18% IGST (Inter-State)" : "0% GST (Delivery Challan)";
      const compCode = getInvoiceCompany(inv);

      inv.items.forEach(it => {
        rows.push([
          `"${compCode === 'HPL' ? 'AHPL' : 'AIL'}"`,
          `"${inv.invNo}"`,
          `"${formatDateDDMMYYYY(inv.date)}"`,
          `"${inv.partyName}"`,
          `"${taxRuleStr}"`,
          `"${it.productName}"`,
          `"${it.hsnCode || '39239090'}"`,
          `"${it.packSize}"`,
          it.cases ?? (it.packSizeMultiple > 0 ? Math.ceil(it.qty / it.packSizeMultiple) : 1),
          it.qty,
          it.rate,
          it.weight,
          it.cft,
          it.taxableValue,
          isInterState ? it.gstValue : 0,
          it.totalValue
        ].join(","));
      });
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Thermocol_Detailed_Dispatch_Report_${reportCompanyFilter}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Demand vs. Supply Analytics (Segregated by Company)
  const demandVsSupplyData = useMemo(() => {
    const list: Array<{
      partyName: string;
      productName: string;
      company: CompanyType;
      monthlyLimit: number;
      dispatched: number;
      remaining: number;
      status: 'Within Limit' | 'Exceeded';
    }> = [];

    const targetDemands = reportCompanyFilter === 'ALL'
      ? clientDemands
      : clientDemands.filter(d => (d.company || 'AIL') === reportCompanyFilter);

    const targetInvoices = reportCompanyFilter === 'ALL'
      ? invoices
      : invoices.filter(inv => getInvoiceCompany(inv) === reportCompanyFilter);

    targetDemands.forEach(dem => {
      let dispatched = 0;
      targetInvoices.forEach(inv => {
        if (inv.partyName === dem.partyName) {
          inv.items.forEach(it => {
            if (it.productName === dem.productName) {
              dispatched += it.qty;
            }
          });
        }
      });

      const remaining = dem.monthlyLimit - dispatched;
      list.push({
        partyName: dem.partyName,
        productName: dem.productName,
        company: dem.company || 'AIL',
        monthlyLimit: dem.monthlyLimit,
        dispatched,
        remaining,
        status: remaining < 0 ? 'Exceeded' : 'Within Limit'
      });
    });

    return list;
  }, [clientDemands, invoices, reportCompanyFilter]);

  // Available stock master products filtered strictly by company
  const reportProducts = useMemo(() => {
    if (reportCompanyFilter === 'ALL') return products;
    return products.filter(p => normalizeCompany(p.company) === reportCompanyFilter);
  }, [products, reportCompanyFilter]);

  // Inward stock records filtered strictly by company
  const reportInwards = useMemo(() => {
    if (reportCompanyFilter === 'ALL') return inwards;
    return inwards.filter(i => normalizeCompany(i.company) === reportCompanyFilter);
  }, [inwards, reportCompanyFilter]);

  // MRP-Wise Stock Variant Grouping Engine (Segregated by SKU + Company + MRP Variant)
  const mrpStockVariants = useMemo(() => {
    const filteredInwards = inwards.filter(i => {
      if (reportCompanyFilter === 'ALL') return true;
      return normalizeCompany(i.company) === reportCompanyFilter;
    });

    const variantMap = new Map<string, {
      id: string;
      company: CompanyType;
      productName: string;
      hsnCode: string;
      mrp: number;
      packSize: string;
      packSizeMultiple: number;
      weight: number;
      cft: number;
      availableStock: number;
      inwardGrNos: string[];
      productRef?: ThermocolProduct;
      inwardLots: ThermocolInward[];
    }>();

    filteredInwards.forEach(inw => {
      const comp = normalizeCompany(inw.company);
      const prodName = (inw.productName || '').trim();
      const mrp = Number(inw.mrp || inw.price || inw.rate || 0);
      const key = `${comp}_${prodName.toLowerCase()}_MRP_${mrp.toFixed(2)}`;

      const prodRef = products.find(p => p.name.trim().toLowerCase() === prodName.toLowerCase() && normalizeCompany(p.company) === comp);

      const hsnCode = prodRef?.hsnCode || inw.hsnCode || '39239090';
      const packSize = prodRef?.packSize || inw.packSize || 'Box of 10';
      const packSizeMultiple = prodRef?.packSizeMultiple || 10;
      const weight = prodRef?.weight || inw.weight || 0.15;
      const cft = prodRef?.cft || inw.cft || 0.02;

      if (!variantMap.has(key)) {
        variantMap.set(key, {
          id: key,
          company: comp,
          productName: prodName,
          hsnCode,
          mrp,
          packSize,
          packSizeMultiple,
          weight,
          cft,
          availableStock: 0,
          inwardGrNos: [],
          productRef: prodRef,
          inwardLots: []
        });
      }

      const item = variantMap.get(key)!;
      item.availableStock += Number(inw.availableQty || 0);
      item.inwardLots.push(inw);
      if (inw.grNo && !item.inwardGrNos.includes(inw.grNo)) {
        item.inwardGrNos.push(inw.grNo);
      }
    });

    // Also include master products that have no inward lots yet so they aren't hidden
    const filteredMasterProducts = products.filter(p => {
      if (reportCompanyFilter === 'ALL') return true;
      return normalizeCompany(p.company) === reportCompanyFilter;
    });

    filteredMasterProducts.forEach(prod => {
      const comp = normalizeCompany(prod.company);
      const prodName = prod.name.trim();
      const mrp = Number(prod.price || 0);
      const key = `${comp}_${prodName.toLowerCase()}_MRP_${mrp.toFixed(2)}`;

      if (!variantMap.has(key)) {
        const hasAnyInward = filteredInwards.some(i => i.productName.trim().toLowerCase() === prodName.toLowerCase() && normalizeCompany(i.company) === comp);
        if (!hasAnyInward) {
          variantMap.set(key, {
            id: key,
            company: comp,
            productName: prodName,
            hsnCode: prod.hsnCode || '39239090',
            mrp,
            packSize: prod.packSize || 'Box of 10',
            packSizeMultiple: prod.packSizeMultiple || 10,
            weight: prod.weight || 0.15,
            cft: prod.cft || 0.02,
            availableStock: 0,
            inwardGrNos: [],
            productRef: prod,
            inwardLots: []
          });
        }
      }
    });

    return Array.from(variantMap.values()).sort((a, b) => {
      if (a.company !== b.company) return a.company.localeCompare(b.company);
      if (a.productName !== b.productName) return a.productName.localeCompare(b.productName);
      return b.mrp - a.mrp;
    });
  }, [inwards, products, reportCompanyFilter]);

  const exportDemandSupplyCsv = () => {
    if (demandVsSupplyData.length === 0) {
      alert("No client demands configured to export.");
      return;
    }
    const headers = ["Company", "Client Name", "Product Name", "Monthly Allowed Quota", "Total Dispatched Qty", "Remaining Demand", "Status"];
    const rows = demandVsSupplyData.map(d => [
      `"${d.company === 'HPL' ? 'AHPL (Abbott Healthcare)' : 'AIL (Abbott India)'}"`,
      `"${d.partyName}"`,
      `"${d.productName}"`,
      d.monthlyLimit,
      d.dispatched,
      d.remaining,
      `"${d.status}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Client_Demand_vs_Supply_${reportCompanyFilter}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportStockReportCsv = () => {
    if (stockViewMode === 'mrpWise') {
      if (mrpStockVariants.length === 0) {
        alert("No MRP stock variants found for selected company filter.");
        return;
      }
      const headers = [
        "Company", "Product SKU Name", "MRP (INR)", "HSN Code", "Pack Size", 
        "Pack Multiple", "Available Stock (Pcs)", "Available Stock (Cases)", 
        "Inward Reference GR Nos", "Weight Per Unit (kg)", "Total Weight (kg)", 
        "Total Weight (MT)", "Total Volume (CFT)"
      ];
      const rows = mrpStockVariants.map(variant => {
        const currentStock = variant.availableStock;
        const totalWeightKg = (currentStock * variant.weight).toFixed(2);
        const totalWeightMt = (Number(totalWeightKg) / 1000).toFixed(3);
        const totalCft = (currentStock * variant.cft).toFixed(2);
        const compName = variant.company === 'HPL' ? 'AHPL' : 'AIL';
        const cases = variant.packSizeMultiple > 0 
          ? (currentStock % variant.packSizeMultiple === 0 
              ? currentStock / variant.packSizeMultiple 
              : Number((currentStock / variant.packSizeMultiple).toFixed(1))) 
          : currentStock;
        const grRefs = variant.inwardGrNos.length > 0 ? variant.inwardGrNos.join("; ") : "N/A";

        return `"${compName}","${variant.productName}",${variant.mrp.toFixed(2)},"${variant.hsnCode}","${variant.packSize}",${variant.packSizeMultiple},${currentStock},${cases},"${grRefs}",${variant.weight},${totalWeightKg},${totalWeightMt},${totalCft}`;
      });

      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Thermocol_MRP_Wise_Stock_Report_${reportCompanyFilter}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } else {
      const targetProds = reportProducts;

      if (targetProds.length === 0) {
        alert("No products found in the Product Master for selected company filter.");
        return;
      }
      const headers = ["Company", "Product Name", "HSN Code", "Selling Rate (INR)", "Pack Size", "Pack Multiple", "Available Stock (Pcs)", "Weight Per Unit (kg)", "Total Weight (kg)", "Total Weight (MT)", "Total Volume (CFT)"];
      const rows = targetProds.map(prod => {
        const currentStock = getProductStock(prod);
        const totalWeightKg = (currentStock * prod.weight).toFixed(2);
        const totalWeightMt = (Number(totalWeightKg) / 1000).toFixed(3);
        const totalCft = (currentStock * prod.cft).toFixed(2);
        const compName = prod.company === 'HPL' ? 'AHPL' : 'AIL';
        return `"${compName}","${prod.name}","${prod.hsnCode || '39239090'}",${prod.price},"${prod.packSize}",${prod.packSizeMultiple},${currentStock},${prod.weight},${totalWeightKg},${totalWeightMt},${totalCft}`;
      });

      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Thermocol_Consolidated_Stock_Report_${reportCompanyFilter}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    }
  };

  // Filtered transaction & audit logs segregated by active company filter
  const filteredAudits = useMemo(() => {
    return invoiceAudits.filter(aud => {
      const comp = aud.company || (aud.invNo?.startsWith('AHPL') ? 'HPL' : 'AIL');
      if (reportCompanyFilter !== 'ALL' && comp !== reportCompanyFilter) {
        return false;
      }
      if (!reportDateFilter) return true;
      const audNorm = normalizeWmsDate(aud.deletedAt || '');
      return audNorm === reportDateFilter || (aud.deletedAt && aud.deletedAt.includes(reportDateFilter));
    });
  }, [invoiceAudits, reportCompanyFilter, reportDateFilter]);

  const exportAuditCsv = () => {
    if (filteredAudits.length === 0) {
      alert("No transaction & audit logs available to export for selected company filter.");
      return;
    }
    const headers = [
      "Company", "Invoice No", "Deleted At (UTC)", "Client Name", "Product Name", "Refunded Qty (Pcs)", "Status"
    ];
    const rows = filteredAudits.map(aud => {
      const comp = aud.company || (aud.invNo?.startsWith('AHPL') ? 'HPL' : 'AIL');
      return [
        `"${comp === 'HPL' ? 'AHPL (Abbott Healthcare)' : 'AIL (Abbott India)'}"`,
        `"${aud.invNo}"`,
        `"${aud.deletedAt}"`,
        `"${aud.partyName}"`,
        `"${aud.productName}"`,
        aud.refundedQty,
        `"Stock Refunded"`
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Thermocol_Transaction_Audit_Logs_${reportCompanyFilter}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportInwardReportCsv = () => {
    const targetInw = inwardCompanyFilter === 'ALL'
      ? inwards
      : inwards.filter(i => (i.company || 'AIL') === inwardCompanyFilter);

    if (targetInw.length === 0) {
      alert("No inward records available to export for selected company filter.");
      return;
    }
    const headers = [
      "Company", "GR No.", "Recd Date", "Supply Plant", "Invoice No.", "Date", 
      "Product Description", "Qty", "Rate", "Taxable", "Gst 18%", 
      "Invoice Value", "Pack", "Case", "Available Stock"
    ];
    const rows = targetInw.map(i => {
      const q = i.qty ?? i.initialQty;
      const rt = i.rate ?? i.price;
      const tax = i.taxable ?? Number((q * rt).toFixed(2));
      const gst = i.gst18 ?? Number((tax * 0.18).toFixed(2));
      const invVal = i.invoiceValue ?? i.totalAmount ?? Number((tax + gst).toFixed(2));
      const compName = (i.company || 'AIL') === 'HPL' ? 'AHPL' : 'AIL';

      return [
        `"${compName}"`,
        `"${i.grNo}"`,
        `"${i.recdDate || i.receiveDate}"`,
        `"${i.supplyPlant || 'Peer Karadiya Plant'}"`,
        `"${i.invNo}"`,
        `"${i.date || i.recdDate || i.receiveDate}"`,
        `"${i.productDescription || i.productName}"`,
        q,
        rt,
        tax,
        gst,
        invVal,
        `"${i.pack || i.packSize || 'Box of 10'}"`,
        `"${i.caseCount || '10 Cases'}"`,
        i.availableQty
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Thermocol_Inward_Stock_Ledger_${inwardCompanyFilter}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ----------------------------------------------------
  // Module F: Inward Management Dual-Mode State (Manual Form + CSV Bulk Upload)
  // Exact 13-Column Schema:
  // GR No., Recd Date, Supply Plant, Invoice No., Date, Product Description, Qty, Rate, Taxable, Gst 18%, Invoice Value, Pack, Case
  // ----------------------------------------------------
  const [inwardSubTab, setInwardSubTab] = useState<'detail' | 'manual' | 'csvUpload'>('detail');
  const [inwardCompanyFilter, setInwardCompanyFilter] = useState<'AIL' | 'HPL' | 'ALL'>(() => selectedCompany);
  const [inwardDateFilter, setInwardDateFilter] = useState<string>('');
  const [inwardStateFilter, setInwardStateFilter] = useState<string>('ALL');

  useEffect(() => {
    setInwardCompanyFilter(selectedCompany);
  }, [selectedCompany]);

  const filteredInwards = useMemo(() => {
    return inwards.filter(i => {
      if (inwardCompanyFilter !== 'ALL' && normalizeCompany(i.company) !== inwardCompanyFilter) {
        return false;
      }
      if (inwardDateFilter) {
        const itemDate = (i.recdDate || i.receiveDate || i.date || '').split('T')[0];
        if (itemDate !== inwardDateFilter) {
          return false;
        }
      }
      if (inwardStateFilter !== 'ALL') {
        const plant = (i.supplyPlant || '').toUpperCase();
        if (!plant.includes(inwardStateFilter.toUpperCase())) {
          return false;
        }
      }
      return true;
    });
  }, [inwards, inwardCompanyFilter, inwardDateFilter, inwardStateFilter]);

  const createDefaultInwardRow = (index = 0): InwardGridRow => {
    const today = new Date().toISOString().split('T')[0];

    return {
      id: 'inw_row_' + Date.now() + '_' + index,
      grNo: '',
      recdDate: today,
      supplyPlant: '',
      invNo: '',
      date: today,
      productDescription: '',
      qty: 0,
      rate: 0,
      taxable: 0,
      gst18: 0,
      invoiceValue: 0,
      pack: '',
      caseCount: '',
      productName: '',
      receiveDate: today,
      price: 0,
      hsnCode: '39239090',
      packSize: '',
      gstPercent: 18,
      transName: '',
      lrNo: '',
      lrDate: today
    };
  };

  const [inwardGridRows, setInwardGridRows] = useState<InwardGridRow[]>([
    createDefaultInwardRow(0)
  ]);

  const addInwardRow = () => {
    setInwardGridRows(prev => [...prev, createDefaultInwardRow(prev.length)]);
  };

  const removeInwardRow = (id: string) => {
    if (inwardGridRows.length <= 1) {
      alert("At least one inward row is required in the entry form.");
      return;
    }
    setInwardGridRows(prev => prev.filter(r => r.id !== id));
  };

  // Real-time automatic computation: Taxable = Qty * Rate, Gst 18% = Taxable * 0.18, Invoice Value = Taxable + Gst 18%, Cases = Qty / Pack Size Multiple
  const updateInwardRow = (id: string, updates: Partial<InwardGridRow>) => {
    setInwardGridRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const merged = { ...r, ...updates };
      const q = merged.qty === '' ? 0 : Number(merged.qty);
      const rt = merged.rate === '' ? 0 : Number(merged.rate);
      const taxable = Number((q * rt).toFixed(2));
      const gst18 = Number((taxable * 0.18).toFixed(2));
      const invoiceValue = Number((taxable + gst18).toFixed(2));

      let hsn = merged.hsnCode;
      let pack = merged.pack;
      let multiple = 1;
      const pDesc = merged.productDescription;
      if (pDesc) {
        const matchedProd = activeProducts.find(p => p.name === pDesc) || products.find(p => p.name === pDesc && normalizeCompany(p.company) === selectedCompany);
        if (matchedProd) {
          hsn = matchedProd.hsnCode || '39239090';
          pack = matchedProd.packSize || pack;
          multiple = matchedProd.packSizeMultiple || 1;
        }
      }
      const casesCountNum = multiple > 0 ? (q % multiple === 0 ? q / multiple : Number((q / multiple).toFixed(1))) : 0;
      const caseCountStr = q > 0 ? `${casesCountNum} Cases` : '';

      return {
        ...merged,
        hsnCode: hsn,
        pack,
        packSize: pack,
        price: rt,
        productName: merged.productDescription,
        taxable,
        gst18,
        invoiceValue,
        caseCount: caseCountStr
      };
    }));
  };

  const handleSaveInwardGrid = async () => {
    const validRows = inwardGridRows.filter(r => (r.productDescription || r.productName) && Number(r.qty) > 0);
    if (validRows.length === 0) {
      alert("Please enter at least one valid inward row with quantity!");
      return;
    }

    const newInwards: ThermocolInward[] = validRows.map((r, idx) => {
      const q = Number(r.qty) || 0;
      const rt = Number(r.rate ?? r.price) || 0;
      const taxable = Number((q * rt).toFixed(2));
      const gst18 = Number((taxable * 0.18).toFixed(2));
      const total = Number((taxable + gst18).toFixed(2));
      const pDesc = r.productDescription || r.productName || 'Standard Product';
      const prod = activeProducts.find(p => p.name === pDesc) || products.find(p => p.name === pDesc && normalizeCompany(p.company) === selectedCompany);

      return {
        id: 'inw_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 5),
        company: selectedCompany,
        grNo: r.grNo || 'GR-AUTO',
        recdDate: r.recdDate || r.receiveDate || new Date().toISOString().split('T')[0],
        supplyPlant: r.supplyPlant || 'Peer Karadiya Plant',
        invNo: r.invNo || 'INV-SUP',
        date: r.date || r.recdDate || new Date().toISOString().split('T')[0],
        productDescription: pDesc,
        qty: q,
        rate: rt,
        taxable,
        gst18,
        invoiceValue: total,
        pack: r.pack || r.packSize || prod?.packSize || 'Box of 10',
        caseCount: r.caseCount || '10 Cases',
        productName: pDesc,
        receiveDate: r.recdDate || r.receiveDate || new Date().toISOString().split('T')[0],
        initialQty: q,
        availableQty: q,
        price: rt,
        gstPercent: 18,
        totalAmount: total,
        hsnCode: r.hsnCode || prod?.hsnCode || '39239090',
        packSize: r.pack || r.packSize || prod?.packSize || 'Box of 10',
        transName: r.transName || 'Direct Logistics',
        lrNo: r.lrNo || 'LR-N/A',
        lrDate: r.lrDate || r.recdDate || new Date().toISOString().split('T')[0]
      };
    });

    // 1. Explicitly await batch Firestore operation for all new inward rows
    try {
      await saveThermocolInwardsBatchToFirestore(newInwards);
      console.log(`[Inventory Success] Explicitly synced ${newInwards.length} inward stock lot(s) to Firestore.`);
    } catch (err) {
      console.error('[Firestore Error] Inward sync failed:', err);
      alert('Failed to save data to cloud. Check internet and try again.');
      return;
    }

    // 2. Only update local state AFTER successful cloud sync
    const updated = [...newInwards, ...inwards];
    setInwards(updated);
    
    // 3. Fallback sync for the consolidated packing material state
    persistStorage(products, parties, transporters, clientDemands, updated, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
    
    setInwardSubTab('detail');
  };

  // Option B: Dedicated CSV Bulk Upload in Inward Module State
  const [inwardCsvRows, setInwardCsvRows] = useState<ThermocolInward[]>([]);
  const [inwardCsvMsg, setInwardCsvMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const inwardFileInputRef = useRef<HTMLInputElement>(null);

  const handleInwardCsvFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) {
          setInwardCsvMsg({ text: 'CSV file contains no data rows!', isError: true });
          return;
        }

        const dataRows = lines.slice(1);
        const parsedRows: ThermocolInward[] = [];

        dataRows.forEach((l, idx) => {
          const cols = l.split(',');
          if (cols.length >= 6) {
            let grNo = `GR-${Date.now()}-${idx + 1}`;
            let recdDate = new Date().toISOString().split('T')[0];
            let supplyPlant = 'Peer Karadiya Plant';
            let invNo = `INV-SUP-${idx + 1}`;
            let invDate = recdDate;
            let pDesc = 'Standard EPS Corner Guard';
            let q = 100;
            let rt = 15.5;
            let pack = 'Box of 10';
            let cases = '10 Cases';

            if (cols.length >= 8) {
              // 13-column schema: GR No., Recd Date, Supply Plant, Invoice No., Date, Product Description, Qty, Rate, Taxable, Gst 18%, Invoice Value, Pack, Case
              grNo = cols[0]?.replace(/"/g, '').trim() || grNo;
              recdDate = cols[1]?.replace(/"/g, '').trim() || recdDate;
              supplyPlant = cols[2]?.replace(/"/g, '').trim() || supplyPlant;
              invNo = cols[3]?.replace(/"/g, '').trim() || invNo;
              invDate = cols[4]?.replace(/"/g, '').trim() || invDate;
              pDesc = cols[5]?.replace(/"/g, '').trim() || pDesc;
              q = parseInt(cols[6]) || 100;
              rt = parseFloat(cols[7]) || 15.5;
              if (cols[11]) pack = cols[11]?.replace(/"/g, '').trim();
              if (cols[12]) cases = cols[12]?.replace(/"/g, '').trim();
            } else {
              // Fallback format
              grNo = cols[0]?.replace(/"/g, '').trim() || grNo;
              recdDate = cols[1]?.replace(/"/g, '').trim() || recdDate;
              invNo = cols[2]?.replace(/"/g, '').trim() || invNo;
              pDesc = cols[3]?.replace(/"/g, '').trim() || pDesc;
              pack = cols[4]?.replace(/"/g, '').trim() || pack;
              q = parseInt(cols[5]) || 100;
              rt = parseFloat(cols[6]) || 15.5;
            }

            const taxable = Number((q * rt).toFixed(2));
            const gst18 = Number((taxable * 0.18).toFixed(2));
            const invVal = Number((taxable + gst18).toFixed(2));
            const prod = products.find(p => p.name === pDesc);

            parsedRows.push({
              id: 'inw_csv_' + Date.now() + '_' + idx + Math.random().toString(36).substring(2, 5),
              company: selectedCompany,
              grNo,
              recdDate,
              receiveDate: recdDate,
              supplyPlant,
              invNo,
              date: invDate,
              productDescription: pDesc,
              productName: pDesc,
              qty: q,
              initialQty: q,
              availableQty: q,
              rate: rt,
              price: rt,
              taxable,
              gst18,
              invoiceValue: invVal,
              totalAmount: invVal,
              pack,
              packSize: pack,
              caseCount: cases,
              gstPercent: 18,
              hsnCode: prod?.hsnCode || '39239090',
              transName: 'Direct Logistics',
              lrNo: 'LR-' + grNo,
              lrDate: recdDate
            });
          }
        });

        if (parsedRows.length === 0) {
          setInwardCsvMsg({ text: 'No valid inward rows could be parsed from the CSV file.', isError: true });
          return;
        }

        setInwardCsvRows(parsedRows);
        setInwardCsvMsg({ 
          text: `Parsed ${parsedRows.length} inward stock rows matching the 13-column schema! Review preview below and click Confirm & Ingest.`, 
          isError: false 
        });
      } catch (err: any) {
        setInwardCsvMsg({ text: 'Error parsing inward CSV file: ' + (err?.message || 'Invalid format'), isError: true });
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmIngestInwardCsv = async () => {
    if (inwardCsvRows.length === 0) {
      alert("No parsed CSV inward rows to ingest!");
      return;
    }

    try {
      // 1. Await direct Firestore batch upload for permanent record storage
      await saveThermocolInwardsBatchToFirestore(inwardCsvRows);
      
      const updated = [...inwardCsvRows, ...inwards];
      setInwards(updated);
      
      // 2. Fallback sync
      persistStorage(products, parties, transporters, clientDemands, updated, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
      
      alert(`Successfully ingested ${inwardCsvRows.length} bulk inward stock lots into inventory ledger!`);
      setInwardCsvRows([]);
      setInwardCsvMsg(null);
      if (inwardFileInputRef.current) inwardFileInputRef.current.value = '';
      setInwardSubTab('detail');
    } catch (err) {
      console.error('[Firestore Error] CSV Ingestion failed:', err);
      alert('Failed to ingest CSV data to cloud. Check internet and try again.');
    }
  };

  // ----------------------------------------------------
  // Module G: Masters Management & CSV Templates
  // ----------------------------------------------------
  const [csvType, setCsvType] = useState<'product' | 'party' | 'transporter' | 'demand' | 'outward' | 'inward'>('product');
  const [csvStatusMsg, setCsvStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);

  // Quick Add Customer / Party Master State
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyCity, setNewPartyCity] = useState('Indore');
  const [newPartyState, setNewPartyState] = useState('Madhya Pradesh');
  const [newPartyPincode, setNewPartyPincode] = useState('');
  const [newPartyAddress, setNewPartyAddress] = useState('');
  const [newPartyGstin, setNewPartyGstin] = useState('');

  // Quick Add Product Master State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdHsn, setNewProdHsn] = useState('39239090');
  const [newProdPrice, setNewProdPrice] = useState('15.5');
  const [newProdPackSize, setNewProdPackSize] = useState('Box of 10');
  const [newProdMultiple, setNewProdMultiple] = useState('10');
  const [newProdWeight, setNewProdWeight] = useState('0.15');
  const [newProdCft, setNewProdCft] = useState('0.02');

  const handleQuickAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      alert("Please enter product name!");
      return;
    }
    const newProd: ThermocolProduct = {
      id: 'prod_' + Date.now() + Math.random().toString(36).substring(2, 5),
      company: selectedCompany,
      name: newProdName.trim(),
      hsnCode: newProdHsn.trim() || '39239090',
      price: parseFloat(newProdPrice) || 15.5,
      packSize: newProdPackSize.trim() || 'Box of 10',
      packSizeMultiple: parseInt(newProdMultiple) || 10,
      weight: parseFloat(newProdWeight) || 0.15,
      cft: parseFloat(newProdCft) || 0.02
    };

    try {
      // 1. Await explicit individual Firestore setDoc for the Master product
      await saveThermocolProductToFirestore(newProd);
      
      const updated = [newProd, ...products];
      setProducts(updated);
      persistStorage(updated, parties, transporters, clientDemands, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
      
      setNewProdName('');
      setShowAddProductModal(false);
      setCsvStatusMsg({
        text: `Product "${newProd.name}" added successfully to ${selectedCompany === 'HPL' ? 'AHPL' : 'AIL'} Product Master Directory!`,
        isError: false
      });
    } catch (err) {
      console.error('[Firestore Error] Failed to add product:', err);
      alert('Failed to save product to cloud. Please try again.');
    }
  };

  const handleDeleteProduct = (id: string) => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    const comp = normalizeCompany(prod.company);
    setActiveDeleteModal({
      title: 'Delete Product Master Record',
      itemDescription: `Product Name: ${prod.name} | HSN Code: ${prod.hsnCode || '39239090'} | Company: ${comp === 'HPL' ? 'AHPL' : 'AIL'}`,
      company: comp,
      action: async () => {
        try {
          await deleteThermocolProductFromFirestore(id, prod.name, prod.company);
          const updated = products.filter(p => p.id !== id);
          setProducts(updated);
          persistStorage(updated, parties, transporters, clientDemands, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
          setCsvStatusMsg({
            text: `Product "${prod.name}" removed from ${comp === 'HPL' ? 'AHPL' : 'AIL'} Master successfully with PIN authorization!`,
            isError: false
          });
        } catch (e) {
          console.error('Error deleting product from firestore:', e);
          alert('Failed to delete product from database.');
        }
      }
    });
  };

  const handleDeleteParty = (name: string) => {
    const party = parties.find(p => p.name === name);
    const comp = party ? normalizeCompany(party.company) : selectedCompany;
    setActiveDeleteModal({
      title: 'Delete Customer Master Record',
      itemDescription: `Customer Name: ${name} | Company: ${comp === 'HPL' ? 'AHPL' : 'AIL'}`,
      company: comp,
      action: async () => {
        try {
          await deleteThermocolPartyFromFirestore(name, comp);
          const updated = parties.filter(p => !(p.name === name && normalizeCompany(p.company) === comp));
          setParties(updated);
          persistStorage(products, updated, transporters, clientDemands, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
          setCsvStatusMsg({
            text: `Customer "${name}" removed from ${comp === 'HPL' ? 'AHPL' : 'AIL'} Master successfully with PIN authorization!`,
            isError: false
          });
        } catch (e) {
          console.error('Error deleting party from firestore:', e);
          alert('Failed to delete party from database.');
        }
      }
    });
  };

  const handleDeleteInward = (id: string) => deleteInwardStockRow(id);

  const handleSaveEdit = async () => {
    if (!editInward) return;
    if (!inwardEditReason.trim()) {
      alert("Please provide a mandatory reason / remark for this stock adjustment or write-off!");
      return;
    }

    const newQty = Number(inwardEditQty) || 0;
    const newAvail = Number(inwardEditAvailQty) || 0;
    const rate = Number(inwardEditRate) || Number(editInward.price) || 15;

    const oldQty = Number(editInward.qty) || 0;
    const oldAvail = editInward.availableQty !== undefined ? Number(editInward.availableQty) : oldQty;

    const diffQty = newQty - oldQty;
    const diffAvail = newAvail - oldAvail;

    const taxable = Number((newQty * rate).toFixed(2));
    const gst18 = Number((taxable * 0.18).toFixed(2));
    const totalAmount = Number((taxable + gst18).toFixed(2));

    const updatedInward: ThermocolInward = {
      ...editInward,
      qty: newQty,
      availableQty: newAvail,
      rate,
      price: rate,
      taxable,
      gst18,
      invoiceValue: totalAmount,
      totalAmount,
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Save updated inward stock lot to all Firestore collections
      await saveThermocolInwardToFirestore(updatedInward);

      // 2. Create Audit Trail Log in packing_audits
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const auditLog: InvoiceAuditLog = {
        id: 'aud_adj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        invNo: `INW-ADJ-${editInward.grNo || 'LOT'}`,
        company: editInward.company || selectedCompany,
        action: 'STOCK_ADJUSTMENT',
        timestamp,
        userName: currentUser?.name || 'Authorized Supervisor',
        userRole: currentUser?.role || 'SUPERVISOR',
        partyName: editInward.productName || 'Inward Stock Adjustment',
        totalValue: String(taxable),
        itemsCount: 1,
        vehicleNo: editInward.vehicleNo || '-',
        transporter: editInward.supplierName || editInward.transporter || '-',
        lrNo: editInward.grNo || '-',
        details: `Inward Stock Write-Off/Adjustment for ${editInward.productName} (GR: ${editInward.grNo}): Total Qty ${oldQty} ➔ ${newQty} (${diffQty >= 0 ? '+' : ''}${diffQty}), Available Balance ${oldAvail} ➔ ${newAvail} (${diffAvail >= 0 ? '+' : ''}${diffAvail}). Reason: "${inwardEditReason.trim()}"`,
        complianceChecksum: `CRC32-ADJ-${Math.abs((editInward.grNo || '').split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(16).toUpperCase()}`
      };

      await addThermocolAuditLog(auditLog);

      // 3. Update Local State
      setInwards(prev => prev.map(i => i.id === editInward.id ? updatedInward : i));
      setEditInward(null);
      setInwardEditReason('');
      setCsvStatusMsg({ 
        text: `Inward stock lot ${editInward.grNo} (${editInward.productName}) adjusted & written off successfully. Audit log created.`, 
        isError: false 
      });
    } catch (e) {
      console.error('Error saving inward adjustment:', e);
      alert('Failed to save stock adjustment to cloud database.');
    }
  };

  const handleDeleteProductStock = (prod: ThermocolProduct) => {
    const prodComp = normalizeCompany(prod.company);
    setActiveDeleteModal({
      title: 'Delete Product Inward Entries',
      itemDescription: `Product Name: ${prod.name} | Company: ${prodComp === 'HPL' ? 'AHPL' : 'AIL'} (Delete all associated inward entries)`,
      company: prodComp,
      action: async () => {
        const targetInwards = inwards.filter(i => i.productName === prod.name && normalizeCompany(i.company) === prodComp);
        for (const inw of targetInwards) {
          await deleteThermocolInwardFromFirestore(inw.id);
        }
        const updatedInwards = inwards.filter(i => !(i.productName === prod.name && normalizeCompany(i.company) === prodComp));
        setInwards(updatedInwards);
        persistStorage(products, parties, transporters, clientDemands, updatedInwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
        setCsvStatusMsg({ text: `Deleted inward entries for ${prod.name} with PIN authorization.`, isError: false });
      }
    });
  };

  // User-defined real-time inward stock row deletion handler
  const deleteInwardStockRow = (docId: string) => {
    if (!docId) return;
    const inw = inwards.find(i => i.id === docId);
    const comp = inw ? normalizeCompany(inw.company) : selectedCompany;
    const desc = inw ? `Inward GR #${inw.grNo} - ${inw.productName} (${inw.qty} pcs, Inv: ${inw.invNo})` : `Inward Stock Lot ID: ${docId}`;

    setActiveDeleteModal({
      title: 'Delete Inward Stock Lot Record',
      itemDescription: desc,
      company: comp,
      action: async () => {
        try {
          await deleteDoc(doc(db, 'packing_inwards', docId));
          await deleteThermocolInwardFromFirestore(docId).catch(() => {});

          setInwards(prev => {
            const updated = prev.filter(item => item.id !== docId);
            persistStorage(products, parties, transporters, clientDemands, updated, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
            return updated;
          });

          setCsvStatusMsg({
            text: `Inward stock lot (${docId}) permanently deleted from Firestore with PIN authorization!`,
            isError: false
          });
        } catch (err: any) {
          console.error("Error deleting inward record:", err);
          setCsvStatusMsg({
            text: "Error deleting inward record: " + (err?.message || String(err)),
            isError: true
          });
        }
      }
    });
  };

  const deleteInwardEntry = deleteInwardStockRow;

  useEffect(() => {
    (window as any).deleteInwardStockRow = deleteInwardStockRow;
    (window as any).deleteInwardEntry = deleteInwardStockRow;
  }, [inwards, products, parties, transporters, clientDemands, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits]);

  const handleSaveStockEdit = async () => {
    if (!editProd) return;
    try {
      const updatedProd: ThermocolProduct = {
        ...editProd,
        company: editProd.company || selectedCompany,
        hsnCode: editHsn.trim() || '39239090',
        price: Number(editRate) || 0,
        packSize: editPackSize.trim() || 'Box of 10',
        packSizeMultiple: Number(editPackMultiple) || 10,
        weight: Number(editWeight) || 0.15,
        cft: Number(editCft) || 0.02,
      };

      await saveThermocolProductToFirestore(updatedProd);

      const targetComp = normalizeCompany(editProd.company || selectedCompany);
      const updatedProds = products.map(p => 
        (p.name === editProd.name && normalizeCompany(p.company) === targetComp) ? updatedProd : p
      );
      setProducts(updatedProds);
      persistStorage(updatedProds, parties, transporters, clientDemands, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);

      const currentStock = getProductStock(editProd);
      const diff = Number(editQty) - currentStock;
      if (diff !== 0) {
        await addDoc(collection(db, COLLECTIONS.TH_INWARDS), {
          productName: editProd.name,
          company: editProd.company || selectedCompany,
          availableQty: diff,
          grNo: 'ADJ-' + Date.now(),
          date: new Date().toISOString(),
        });
      }
      setEditProd(null);
      setCsvStatusMsg({
        text: `Product "${updatedProd.name}" updated successfully in Firebase Firestore!`,
        isError: false
      });
    } catch (e) {
      console.error('Error saving product edits to Firestore:', e);
      alert('Failed to update product details in cloud database.');
    }
  };


  // Editing existing Customer Master Record
  const [editingPartyIndex, setEditingPartyIndex] = useState<number | null>(null);
  const [editPartyForm, setEditPartyForm] = useState<ThermocolParty | null>(null);

  const newPartyIsInterState = useMemo(() => {
    return isInterStateParty({
      name: newPartyName,
      city: newPartyCity,
      state: newPartyState,
      address: newPartyAddress,
      gstin: newPartyGstin
    });
  }, [newPartyName, newPartyCity, newPartyState, newPartyAddress, newPartyGstin]);

  const handleQuickAddParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyName.trim()) {
      alert("Please enter customer name!");
      return;
    }
    const isInterState = newPartyIsInterState;
    const pin = newPartyPincode.trim();
    const newP: ThermocolParty = {
      name: newPartyName.trim(),
      company: selectedCompany,
      city: newPartyCity.trim(),
      state: newPartyState.trim(),
      pincode: pin || (newPartyAddress.match(/\b([1-9][0-9]{5})\b/)?.[1] || ''),
      address: newPartyAddress.trim() || `${newPartyCity.trim()}, ${newPartyState.trim()}${pin ? ` - ${pin}` : ''}`,
      gstin: newPartyGstin.trim() || '23UNREGISTERED',
      isInterState
    };

    try {
      // 1. Await explicit individual Firestore setDoc for the Master customer
      await saveThermocolPartyToFirestore(newP);
      
      const updated = [newP, ...parties];
      setParties(updated);
      persistStorage(products, updated, transporters, clientDemands, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
      
      setNewPartyName('');
      setNewPartyPincode('');
      setNewPartyAddress('');
      setNewPartyGstin('');
      setShowAddPartyModal(false);
      setCsvStatusMsg({
        text: `Customer "${newP.name}" added successfully (${isInterState ? 'Inter-State: 18% IGST' : 'Local: 0% GST Tax Exempt'})!`,
        isError: false
      });
    } catch (err) {
      console.error('[Firestore Error] Failed to add customer:', err);
      alert('Failed to save customer to cloud. Please try again.');
    }
  };

  const handleSaveEditParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPartyIndex === null || !editPartyForm) return;

    const isInterState = isInterStateParty(editPartyForm);
    const updatedParty: ThermocolParty = {
      ...editPartyForm,
      company: editPartyForm.company || selectedCompany,
      isInterState,
      pincode: editPartyForm.pincode?.trim() || (editPartyForm.address?.match(/\b([1-9][0-9]{5})\b/)?.[1] || '')
    };

    try {
      await saveThermocolPartyToFirestore(updatedParty);

      const targetComp = normalizeCompany(editPartyForm.company || selectedCompany);
      const updated = parties.map(p => 
        (p.name === editPartyForm.name && normalizeCompany(p.company) === targetComp) ? updatedParty : p
      );
      setParties(updated);
      persistStorage(products, updated, transporters, clientDemands, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
      setEditingPartyIndex(null);
      setEditPartyForm(null);
      setCsvStatusMsg({
        text: `Customer "${updatedParty.name}" updated successfully in Firebase Firestore!`,
        isError: false
      });
    } catch (err) {
      console.error('[Firestore Error] Failed to update customer:', err);
      alert('Failed to save customer updates to cloud database. Please try again.');
    }
  };

  const downloadSampleTemplate = (type: 'product' | 'party' | 'transporter' | 'demand' | 'outward' | 'inward') => {
    let filename = '';
    let content = '';

    if (type === 'product') {
      filename = 'Sample_Product_Master.csv';
      content = 'Product Name,HSN Code,Selling Rate,Pack Size,Pack Multiple,Weight (kg),CFT\n"Standard EPS Corner Guard","39239090",15.50,"Box of 10",10,0.12,0.015\n"Heavy Duty EPS Cushion","39239090",28.00,"Pack of 5",5,0.35,0.045\n"Thermocol Sheet 25mm","39239090",42.00,"Bundle of 10",10,0.50,0.080';
    } else if (type === 'party') {
      filename = 'Sample_Customer_Master.csv';
      content = 'Customer Name,Destination (City),State,Pin Code,Customer Address (Billing / Delivery),GSTIN / UIN\n"Abbott Healthcare Depot","Hyderabad","Telangana","501401","Plot 24, Medchal Industrial Park, Hyderabad, Telangana - 501401","36AAACA0231P1Z5"\n"Bajaj Packaging Pvt Ltd","Indore","Madhya Pradesh","452010","Industrial Area, Sector 3, Pithampur, Indore, MP - 452010","23AAACB1234D1Z2"\n"TVS Logistics Hub","Indore","Madhya Pradesh","453771","Sector C, Sanwer Road, Indore, MP - 453771","23AABCT5678E1Z9"\n"Mahindra Auto Components","Pune","Maharashtra","410501","Chakan MIDC Industrial Area, Pune, Maharashtra - 410501","27AABCM8899K1Z4"\n"Reliance Retail Dist","Ahmedabad","Gujarat","382210","Sarkhej Industrial Hub, Ahmedabad, Gujarat - 382210","24AABCR1122P1Z0"';
    } else if (type === 'transporter') {
      filename = 'Sample_Transporter_Master.csv';
      content = 'Transporter Name,GSTIN\n"VRL Logistics Ltd","29AABCV1234E1Z4"\n"TCI Freight Logistics","23AABCT9988K1Z5"\n"Gati KWE Express","27AAACG5544J1Z8"';
    } else if (type === 'demand') {
      filename = 'Sample_Client_Demands_Master.csv';
      content = 'Party Name,Product Name,Monthly Demand Limit\n"Bajaj Packaging Pvt Ltd","Standard EPS Corner Guard",5000\n"TVS Logistics Hub","Heavy Duty EPS Cushion",3000\n"Godrej Appliance Plant","Thermocol Sheet 25mm",2000';
    } else if (type === 'outward') {
      filename = 'Sample_Outward_Invoices.csv';
      content = 'Invoice No,Date,Party Name,Product Name,Quantity,Rate,Transporter,Vehicle No\n"ICHIND/26-27/001","2026-04-02","Bajaj Packaging Pvt Ltd","Standard EPS Corner Guard",200,15.50,"VRL Logistics Ltd","MP09-AB-1234"';
    } else if (type === 'inward') {
      filename = 'Sample_Inward_13_Column_Template.csv';
      content = 'GR No.,Recd Date,Supply Plant,Invoice No.,Date,Product Description,Qty,Rate,Taxable,Gst 18%,Invoice Value,Pack,Case\n"GR-2026-01","2026-04-01","Peer Karadiya Plant, Indore","INV-SUP-901","2026-03-31","Standard EPS Corner Guard",1000,15.50,15500.00,2790.00,18290.00,"Box of 10","100 Cases"\n"GR-2026-02","2026-04-01","Indore Hub Plant","INV-SUP-902","2026-03-31","Heavy Duty EPS Cushion",500,28.00,14000.00,2520.00,16520.00,"Pack of 5","100 Cases"\n"GR-2026-03","2026-04-02","Sanwer Production Facility","INV-SUP-903","2026-04-01","Thermocol Sheet 25mm",300,42.00,12600.00,2268.00,14868.00,"Bundle of 10","30 Bundles"';
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  const handleUploadCsv = () => {
    const file = csvFileRef.current?.files?.[0];
    if (!file) {
      setCsvStatusMsg({ text: 'Please select a valid CSV file to upload!', isError: true });
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setCsvStatusMsg({ text: 'Failed to read CSV file. Please ensure the file is accessible and try again.', isError: true });
    };
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || text.trim().length === 0) {
          setCsvStatusMsg({ text: 'CSV file is empty!', isError: true });
          return;
        }

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) {
          setCsvStatusMsg({ text: 'CSV file contains no data rows (only header or blank)!', isError: true });
          return;
        }

        const dataRows = lines.slice(1);
        let count = 0;

        if (csvType === 'product') {
          const addedProds: ThermocolProduct[] = [];
          for (const l of dataRows) {
            const cols = l.split(',');
            if (cols.length >= 4) {
              const name = cols[0]?.replace(/"/g, '').trim();
              const hsn = cols[1]?.replace(/"/g, '').trim() || '39239090';
              const price = parseFloat(cols[2]) || 15;
              const packSize = cols[3]?.replace(/"/g, '').trim() || 'Box of 10';
              const multiple = parseInt(cols[4]) || 10;
              const wt = parseFloat(cols[5]) || 0.15;
              const cft = parseFloat(cols[6]) || 0.02;

              if (name) {
                addedProds.push({
                  id: 'prod_' + Date.now() + Math.random().toString(36).substring(2, 5),
                  company: selectedCompany,
                  name,
                  hsnCode: hsn,
                  price,
                  packSize,
                  packSizeMultiple: multiple,
                  weight: wt,
                  cft: cft
                });
                count++;
              }
            }
          }
          const uniqueMap = new Map<string, ThermocolProduct>();
          addedProds.forEach(p => {
            if (p.name && p.name.trim()) {
              const key = p.name.trim().toLowerCase();
              if (!uniqueMap.has(key)) uniqueMap.set(key, p);
            }
          });
          const uniqueAdded = Array.from(uniqueMap.values());
          
          // 1. Await direct Firestore bulk save for Master Products
          await saveThermocolProductsToFirestore(uniqueAdded);

          const remainingOtherCompanies = products.filter(p => normalizeCompany(p.company) !== selectedCompany);
          const updated = [...uniqueAdded, ...remainingOtherCompanies];
          setProducts(updated);
          persistStorage(updated, parties, transporters, clientDemands, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
          setCsvStatusMsg({ text: `Imported & synced ${uniqueAdded.length} unique Products for ${selectedCompany === 'HPL' ? 'AHPL' : 'AIL'} Master successfully!`, isError: false });
        } else if (csvType === 'party' || (csvType as string) === 'customer') {
          const addedParties: ThermocolParty[] = [];
          const rawHeaders = parseCsvLine(lines[0]);
          const cleanHeaders = rawHeaders.map(h =>
            h.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
          );

          let nameIdx = cleanHeaders.findIndex(h =>
            h === 'customer name' || h === 'party name' || h === 'client name' || h === 'company name' || h === 'customer' || h === 'party' || h === 'client' || h === 'name'
          );
          if (nameIdx === -1) {
            nameIdx = cleanHeaders.findIndex(h =>
              (h.includes('customer') || h.includes('party') || h.includes('client') || h.includes('name')) &&
              !h.includes('address') && !h.includes('billing') && !h.includes('delivery') && !h.includes('city') && !h.includes('dest') && !h.includes('gstin') && !h.includes('gst')
            );
          }

          let destIdx = cleanHeaders.findIndex(h =>
            h === 'destination city' || h === 'destination' || h === 'city' || h === 'location' || h === 'town' || h === 'dest'
          );
          if (destIdx === -1) {
            destIdx = cleanHeaders.findIndex(h =>
              (h.includes('destination') || h.includes('city') || h.includes('location') || h.includes('town')) &&
              !h.includes('address') && !h.includes('state') && !h.includes('pin')
            );
          }

          let stateIdx = cleanHeaders.findIndex(h =>
            h === 'state' || h === 'state name' || h === 'province'
          );
          if (stateIdx === -1) {
            stateIdx = cleanHeaders.findIndex(h =>
              (h.includes('state') || h.includes('province')) &&
              !h.includes('address') && !h.includes('city') && !h.includes('pin') && !h.includes('code')
            );
          }

          let pinIdx = cleanHeaders.findIndex(h =>
            h === 'pin code' || h === 'pincode' || h === 'pin' || h === 'postal code' || h === 'postal' || h === 'zip code' || h === 'zip'
          );
          if (pinIdx === -1) {
            pinIdx = cleanHeaders.findIndex(h =>
              (h.includes('pin') || h.includes('postal') || h.includes('zip')) &&
              !h.includes('address') && !h.includes('city') && !h.includes('state')
            );
          }

          let addrIdx = cleanHeaders.findIndex(h =>
            h === 'customer address billing delivery' || h === 'customer address' || h === 'billing address' || h === 'delivery address' || h === 'address' || h === 'full address' || h === 'street'
          );
          if (addrIdx === -1) {
            addrIdx = cleanHeaders.findIndex(h =>
              (h.includes('address') || h.includes('street') || h.includes('billing') || h.includes('delivery')) &&
              !h.includes('city') && !h.includes('destination')
            );
          }

          let gstinIdx = cleanHeaders.findIndex(h =>
            h === 'gstin uin' || h === 'gstin' || h === 'gst in' || h === 'gst no' || h === 'gst' || h === 'uin' || h === 'tax no'
          );
          if (gstinIdx === -1) {
            gstinIdx = cleanHeaders.findIndex(h =>
              (h.includes('gstin') || h.includes('gst') || h.includes('uin')) &&
              !h.includes('address') && !h.includes('name')
            );
          }

          const hasMatchedHeaders = nameIdx !== -1 || destIdx !== -1 || stateIdx !== -1 || addrIdx !== -1 || pinIdx !== -1 || gstinIdx !== -1;

          for (const l of dataRows) {
            const cols = parseCsvLine(l);
            if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

            let name = '';
            let city = '';
            let state = '';
            let pincode = '';
            let address = '';
            let gstin = '';

            if (hasMatchedHeaders) {
              name = (nameIdx !== -1 && cols[nameIdx] !== undefined) ? cols[nameIdx] : '';
              city = (destIdx !== -1 && cols[destIdx] !== undefined) ? cols[destIdx] : '';
              state = (stateIdx !== -1 && cols[stateIdx] !== undefined) ? cols[stateIdx] : '';
              pincode = (pinIdx !== -1 && cols[pinIdx] !== undefined) ? cols[pinIdx] : '';
              address = (addrIdx !== -1 && cols[addrIdx] !== undefined) ? cols[addrIdx] : '';
              gstin = (gstinIdx !== -1 && cols[gstinIdx] !== undefined) ? cols[gstinIdx] : '';
            } else {
              name = cols[0] || '';
              if (cols.length >= 6) {
                if (cols[1].length > 30 || cols[1].includes(',') || /plot|survey|sector|road|industrial/i.test(cols[1])) {
                  address = cols[1];
                  state = cols[2];
                  city = cols[3];
                  pincode = cols[4];
                  gstin = cols[5];
                } else {
                  city = cols[1];
                  state = cols[2];
                  pincode = cols[3];
                  address = cols[4];
                  gstin = cols[5];
                }
              } else if (cols.length === 5) {
                if (/^\d{6}$/.test(cols[3]?.trim())) {
                  city = cols[1];
                  state = cols[2];
                  pincode = cols[3];
                  address = cols[4];
                } else if (/^\d{6}$/.test(cols[4]?.trim())) {
                  address = cols[1];
                  state = cols[2];
                  city = cols[3];
                  pincode = cols[4];
                } else {
                  city = cols[1];
                  state = cols[2];
                  address = cols[3];
                  gstin = cols[4];
                }
              } else if (cols.length === 4) {
                city = cols[1];
                state = cols[2];
                address = cols[3];
              } else if (cols.length === 3) {
                city = cols[1];
                address = cols[2];
              } else if (cols.length === 2) {
                address = cols[1];
              }
            }

            const sanitized = sanitizePartyRecord({
              name,
              company: selectedCompany,
              city,
              state,
              pincode,
              address,
              gstin
            }, selectedCompany);

            if (sanitized.name) {
              addedParties.push(sanitized);
              count++;
            }
          }

          if (count === 0) {
            setCsvStatusMsg({ text: 'No valid customer rows could be parsed from the CSV file. Please verify CSV columns.', isError: true });
          } else {
            const uniqueMap = new Map<string, ThermocolParty>();
            addedParties.forEach(p => {
              if (p.name && p.name.trim()) {
                const key = p.name.trim().toLowerCase();
                if (!uniqueMap.has(key)) uniqueMap.set(key, p);
              }
            });
            const uniqueAdded = Array.from(uniqueMap.values());
            
            // 2. Await direct Firestore bulk save for Master Customers
            await saveThermocolPartiesToFirestore(uniqueAdded);

            const remainingOtherCompanies = parties.filter(p => normalizeCompany(p.company) !== selectedCompany);
            const updated = [...uniqueAdded, ...remainingOtherCompanies];
            setParties(updated);
            persistStorage(products, updated, transporters, clientDemands, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
            setCsvStatusMsg({ 
              text: `Imported & synced ${uniqueAdded.length} unique Customer records for ${selectedCompany === 'HPL' ? 'AHPL' : 'AIL'} successfully!`, 
              isError: false 
            });
          }
        } else if (csvType === 'transporter') {
          const addedTrans: ThermocolTransporter[] = [];
          for (const l of dataRows) {
            const cols = l.split(',');
            if (cols.length >= 1) {
              const name = cols[0]?.replace(/"/g, '').trim();
              const gstin = cols[1]?.replace(/"/g, '').trim() || '';
              if (name) {
                addedTrans.push({ name, gstin, company: selectedCompany });
                count++;
              }
            }
          }
          const uniqueMap = new Map<string, ThermocolTransporter>();
          addedTrans.forEach(t => {
            if (t.name && t.name.trim()) {
              const key = t.name.trim().toLowerCase();
              if (!uniqueMap.has(key)) uniqueMap.set(key, t);
            }
          });
          const uniqueAdded = Array.from(uniqueMap.values());
          
          // 3. Await direct Firestore bulk save for Transporters
          await saveThermocolTransportersToFirestore(uniqueAdded);

          const remainingOtherCompanies = transporters.filter(t => t.company && normalizeCompany(t.company) !== selectedCompany);
          const updated = [...uniqueAdded, ...remainingOtherCompanies];
          setTransporters(updated);
          persistStorage(products, parties, updated, clientDemands, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
          setCsvStatusMsg({ text: `Imported & synced ${uniqueAdded.length} unique Transporters from CSV successfully!`, isError: false });
        } else if (csvType === 'demand') {
          const addedDemands: ClientDemand[] = [];
          for (const l of dataRows) {
            const cols = l.split(',');
            if (cols.length >= 3) {
              const partyName = cols[0]?.replace(/"/g, '').trim();
              const productName = cols[1]?.replace(/"/g, '').trim();
              const limit = parseInt(cols[2]) || 1000;
              if (partyName && productName) {
                addedDemands.push({
                  id: 'dem_' + Date.now() + Math.random().toString(36).substring(2, 5),
                  company: selectedCompany,
                  partyName,
                  productName,
                  monthlyLimit: limit
                });
                count++;
              }
            }
          }
          const uniqueMap = new Map<string, ClientDemand>();
          addedDemands.forEach(d => {
            if (d.partyName && d.productName) {
              const key = `${d.partyName.trim().toLowerCase()}_${d.productName.trim().toLowerCase()}`;
              if (!uniqueMap.has(key)) uniqueMap.set(key, d);
            }
          });
          const uniqueAdded = Array.from(uniqueMap.values());
          
          // 4. Await direct Firestore bulk save for Demands
          await saveThermocolDemandsToFirestore(uniqueAdded);

          const remainingOtherCompanies = clientDemands.filter(d => normalizeCompany(d.company) !== selectedCompany);
          const updated = [...uniqueAdded, ...remainingOtherCompanies];
          setClientDemands(updated);
          persistStorage(products, parties, transporters, updated, inwards, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
          setCsvStatusMsg({ text: `Imported & synced ${uniqueAdded.length} unique Client Demands successfully!`, isError: false });
        } else if (csvType === 'inward') {
          const addedInw: ThermocolInward[] = [];
          for (const l of dataRows) {
            const cols = l.split(',');
            if (cols.length >= 6) {
              let grNo = 'GR-CSV';
              let recdDate = new Date().toISOString().split('T')[0];
              let supplyPlant = 'Peer Karadiya Plant';
              let invNo = 'INV-SUP-CSV';
              let invDate = recdDate;
              let pDesc = 'Standard EPS Corner Guard';
              let q = 100;
              let rt = 15.5;
              let pack = 'Box of 10';
              let cases = '10 Cases';

              if (cols.length >= 8) {
                grNo = cols[0]?.replace(/"/g, '').trim() || grNo;
                recdDate = cols[1]?.replace(/"/g, '').trim() || recdDate;
                supplyPlant = cols[2]?.replace(/"/g, '').trim() || supplyPlant;
                invNo = cols[3]?.replace(/"/g, '').trim() || invNo;
                invDate = cols[4]?.replace(/"/g, '').trim() || invDate;
                pDesc = cols[5]?.replace(/"/g, '').trim() || pDesc;
                q = parseInt(cols[6]) || 100;
                rt = parseFloat(cols[7]) || 15.5;
                if (cols[11]) pack = cols[11]?.replace(/"/g, '').trim();
                if (cols[12]) cases = cols[12]?.replace(/"/g, '').trim();
              } else {
                grNo = cols[0]?.replace(/"/g, '').trim() || grNo;
                recdDate = cols[1]?.replace(/"/g, '').trim() || recdDate;
                invNo = cols[2]?.replace(/"/g, '').trim() || invNo;
                pDesc = cols[3]?.replace(/"/g, '').trim() || pDesc;
                pack = cols[4]?.replace(/"/g, '').trim() || pack;
                q = parseInt(cols[5]) || 100;
                rt = parseFloat(cols[6]) || 15.5;
              }

              const taxable = Number((q * rt).toFixed(2));
              const gst18 = Number((taxable * 0.18).toFixed(2));
              const invVal = Number((taxable + gst18).toFixed(2));
              const prod = products.find(p => p.name === pDesc);

              addedInw.push({
                id: 'inw_' + Date.now() + Math.random().toString(36).substring(2, 5),
                company: selectedCompany,
                grNo,
                recdDate,
                receiveDate: recdDate,
                supplyPlant,
                invNo,
                date: invDate,
                productDescription: pDesc,
                productName: pDesc,
                qty: q,
                initialQty: q,
                availableQty: q,
                rate: rt,
                price: rt,
                taxable,
                gst18,
                invoiceValue: invVal,
                totalAmount: invVal,
                pack,
                packSize: pack,
                caseCount: cases,
                gstPercent: 18,
                hsnCode: prod?.hsnCode || '39239090',
                transName: 'Direct Logistics',
                lrNo: 'LR-' + grNo,
                lrDate: recdDate
              });
              count++;
            }
          }
          
          // 5. Await direct Firestore bulk save for Inwards
          await saveThermocolInwardsBatchToFirestore(addedInw);

          const updated = [...addedInw, ...inwards];
          setInwards(updated);
          persistStorage(products, parties, transporters, clientDemands, updated, invoices, invoiceSeqAIL, invoiceSeqHPL, invoiceAudits);
          setCsvStatusMsg({ text: `Imported & synced ${count} Inward Stock Lots successfully!`, isError: false });
        }
      } catch (err: any) {
        console.error('Error during CSV upload & ingestion:', err);
        setCsvStatusMsg({ 
          text: `Error processing CSV upload: ${err?.message || 'Please check file format and columns.'}`, 
          isError: true 
        });
      } finally {
        if (csvFileRef.current) csvFileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full min-h-screen bg-slate-100 p-3 sm:p-5 font-sans">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Module A: Consignor / Origin Location Configuration Header */}
        <OriginConfigHeader 
          sender={activeSender} 
          onUpdateSender={handleUpdateSender}
          selectedCompany={selectedCompany}
          onSelectCompany={handleSelectCompany}
          currentSeriesText={currentSeriesDisplay}
        />

        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
          <button
            onClick={handleOpenNewOutwardInvoice}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'orderTab' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            <span>📤 New Outward Invoice</span>
          </button>

          <button
            onClick={() => setActiveTab('previewPrintTab')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'previewPrintTab' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-300" />
            <span>📄 Tax Invoice Preview</span>
          </button>

          <button
            onClick={() => setActiveTab('editInvoiceTab')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'editInvoiceTab' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Edit3 className="w-4 h-4 text-cyan-300" />
            <span>✏️ Edit & Delete Invoices</span>
          </button>

          <button
            onClick={() => setActiveTab('auditLogTab')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'auditLogTab' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>🛡️ Invoice Audit Log</span>
            {invoiceAudits.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-emerald-600 text-white text-[10px] rounded-full font-mono font-bold">
                {invoiceAudits.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('cancellationQueueTab')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'cancellationQueueTab' ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-amber-300" />
            <span>🚫 Invoice Cancellation Queue</span>
            {pendingStockQueue.filter(i => i.status === 'PENDING_STOCK_VERIFICATION').length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-amber-950 text-[10px] rounded-full font-mono font-bold animate-pulse">
                {pendingStockQueue.filter(i => i.status === 'PENDING_STOCK_VERIFICATION').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('reportTab')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'reportTab' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-purple-300" />
            <span>📊 Reports & Stock</span>
          </button>

          <button
            onClick={() => setActiveTab('inwardTab')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'inwardTab' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Warehouse className="w-4 h-4 text-emerald-300" />
            <span>📥 Inward Management & Stock</span>
          </button>

          <button
            onClick={() => setActiveTab('masterTab')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'masterTab' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Database className="w-4 h-4 text-indigo-300" />
            <span>📦 Masters, CSV & Data Cleanup</span>
          </button>
        </div>

        {/* ========================================================
            MODULE B: REBUILT CRASH-FREE OUTWARD ORDER ENTRY FORM
            ======================================================== */}
        {activeTab === 'orderTab' && (
          <OutwardOrderEntryForm
            key={newInvoiceFormKey + '_' + selectedCompany}
            products={activeProducts}
            parties={activeParties}
            transporters={transporters}
            clientDemands={activeClientDemands}
            inwards={activeInwards}
            invoices={activeInvoices}
            invoiceSeq={activeInvoiceSeq}
            challanSeq={activeChallanSeq}
            sender={activeSender}
            company={selectedCompany}
            onSaveInvoice={handleSaveInvoiceFromForm}
            onNavigateToInward={() => setActiveTab('inwardTab')}
            onNavigateToMasters={() => setActiveTab('masterTab')}
            onNavigateToPreview={(invNo) => {
              setSelectedPreviewInv(invNo);
              setActiveTab('previewPrintTab');
            }}
            onResetForm={handleOpenNewOutwardInvoice}
          />
        )}

        {/* ========================================================
            MODULE C: TAX INVOICE PREVIEW & PRINT
            ======================================================== */}
        {activeTab === 'previewPrintTab' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Select Invoice to Preview:</span>
                <select
                  value={selectedPreviewInv}
                  onChange={(e) => setSelectedPreviewInv(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-mono font-bold text-blue-700 outline-none cursor-pointer"
                >
                  {invoices.length === 0 ? (
                    <option value="">-- No Invoices Generated Yet --</option>
                  ) : (
                    invoices.map((inv) => (
                      <option key={inv.invNo} value={inv.invNo}>
                        {inv.invNo} - {inv.partyName} (₹{inv.grandTotal})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-mono">
                  Total Generated Invoices: {invoices.length}
                </span>
                {activePreviewInvoice && (
                  <button
                    onClick={() => setModalPreviewInvoice(activePreviewInvoice)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title="Open professional A4 modal overlay preview"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Open Modal Overlay</span>
                  </button>
                )}
              </div>
            </div>

            {activePreviewInvoice ? (
              <TaxInvoiceModal invoice={activePreviewInvoice} isInline={true} />
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-slate-800 text-sm">No Invoice Selected</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Generate your first outward tax invoice using the form to preview or download HTML.
                </p>
                <button
                  onClick={handleOpenNewOutwardInvoice}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>Go to New Outward Invoice</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            MODULE D: INVOICE CORRECTION, EDITING & DELETION
            ======================================================== */}
        {activeTab === 'editInvoiceTab' && (
          <EditInvoiceErrorBoundary>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Select Invoice to Correct or Delete:</span>
                  <select
                    value={editInvNo}
                    onChange={(e) => setEditInvNo(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-mono font-bold text-blue-700 outline-none cursor-pointer"
                  >
                    {invoices.length === 0 ? (
                      <option value="">-- No Invoices in System --</option>
                    ) : (
                      invoices.map((inv) => (
                        <option key={inv.invNo} value={inv.invNo}>
                          {inv.invNo} - {inv.partyName}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">Strict FY 26-27 Series Continuity Active</span>
                  {editForm && (
                    <button
                      onClick={() => handleDeleteInvoice(editForm.invNo)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                      title="Delete entire invoice and restore inventory levels"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Entire Invoice</span>
                    </button>
                  )}
                </div>
              </div>

              {editForm ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Client Name:</label>
                      <input
                        type="text"
                        value={editForm.partyName}
                        onChange={(e) => setEditForm({ ...editForm, partyName: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Transporter:</label>
                      <input
                        type="text"
                        value={editForm.transName}
                        onChange={(e) => setEditForm({ ...editForm, transName: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Vehicle Number:</label>
                      <input
                        type="text"
                        value={editForm.vehicleNo}
                        onChange={(e) => setEditForm({ ...editForm, vehicleNo: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono uppercase font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                          <th className="py-2 px-3">Product Description</th>
                          <th className="py-2 px-3">Pack Size</th>
                          <th className="py-2 px-3 text-right">Quantity</th>
                          <th className="py-2 px-3 text-right">Rate (₹)</th>
                          <th className="py-2 px-3 text-right">Taxable (₹)</th>
                          <th className="py-2 px-3 text-right">
                            {editForm.isInterState ? 'IGST (18%)' : 'Tax (0% Local)'}
                          </th>
                          <th className="py-2 px-3 text-right font-bold">Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {editForm.items.map(it => (
                          <tr key={it.id}>
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {it.productName}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{it.packSize}</td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="1"
                                value={it.qty}
                                onChange={(e) => updateEditItem(it.id, 'qty', e.target.value)}
                                className="w-20 text-right border border-slate-300 rounded px-2 py-1 font-mono font-bold text-slate-900"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={it.rate}
                                onChange={(e) => updateEditItem(it.id, 'rate', e.target.value)}
                                className="w-20 text-right border border-slate-300 rounded px-2 py-1 font-mono text-slate-900"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono">₹{it.taxableValue.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-mono">
                              {editForm.isInterState ? `₹${it.gstValue.toFixed(2)} (18%)` : '₹0.00 (0%)'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-blue-700">₹{it.totalValue.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 font-bold border-t border-slate-200">
                          <td colSpan={2} className="py-2 px-3">Recalculated Grand Total</td>
                          <td className="py-2 px-3 text-right font-mono text-blue-700">{editForm.totalQty} Pcs</td>
                          <td></td>
                          <td className="py-2 px-3 text-right font-mono">₹{editForm.totalTaxable}</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {editForm.isInterState ? `₹${editForm.totalGst}` : '₹0.00 (Exempt)'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-700 font-extrabold">₹{editForm.grandTotal}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {editMsg && (
                    <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                      editMsg.isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editMsg.text}</span>
                    </div>
                  )}

                  <button
                    onClick={handleSaveInvoiceCorrection}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
                  >
                    Save & Update Invoice Corrections
                  </button>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 italic">
                  No invoices found in the system to edit.
                </div>
              )}

              {/* Audit History Log Section */}
              <div className="mt-8 pt-6 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <span>Invoice Cancellation & Stock Refund Audit Trail</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-500">Total Log Entries: {invoiceAudits.length}</span>
                    {invoiceAudits.some(a => a.action === 'CANCEL' || a.deletedAt) && (
                      <button
                        type="button"
                        onClick={handlePurgeCancelledAudits}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded text-xs font-bold transition flex items-center gap-1 border border-rose-200 cursor-pointer shadow-2xs"
                        title="Permanently purge all cancelled invoice records from Firestore"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear Cancelled History</span>
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Transparent cancellation and refund log showing deleted invoice numbers, timestamps, refunded quantities, and inventory stock restorations.
                </p>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                        <th className="py-2.5 px-3">Deleted At (UTC)</th>
                        <th className="py-2.5 px-3">Invoice Number</th>
                        <th className="py-2.5 px-3">Client Name</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3 text-right">Refunded Qty</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoiceAudits.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-400 italic">
                            No invoice cancellations or stock refunds recorded yet.
                          </td>
                        </tr>
                      ) : (
                        invoiceAudits.map(aud => (
                          <tr key={aud.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono text-slate-600">{aud.deletedAt}</td>
                            <td className="py-2 px-3 font-mono font-bold text-red-600">{aud.invNo}</td>
                            <td className="py-2 px-3 font-semibold text-slate-900">{aud.partyName}</td>
                            <td className="py-2 px-3 text-slate-800">{aud.productName}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">+{aud.refundedQty} Pcs</td>
                            <td className="py-2 px-3 text-center">
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                                Stock Refunded
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteAuditLog(aud.id)}
                                className="p-1 text-rose-600 hover:bg-rose-100 rounded transition cursor-pointer"
                                title="Permanently delete this cancel record from Firestore"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </EditInvoiceErrorBoundary>
        )}

        {/* ========================================================
            MODULE: INVOICE AUDIT LOG & COMPLIANCE DASHBOARD
            ======================================================== */}
        {activeTab === 'auditLogTab' && (
          <InvoiceAuditLogView
            audits={invoiceAudits}
            invoices={invoices}
            currentUser={currentUser}
            selectedCompany={selectedCompany}
            onSelectInvoiceForPreview={(invNo) => {
              setSelectedPreviewInv(invNo);
              setActiveTab('previewPrintTab');
            }}
            onDeleteInvoice={handleDeleteInvoice}
            onDeleteAuditLog={handleDeleteAuditLog}
            onPurgeCancelledAudits={handlePurgeCancelledAudits}
            onRestoreInvoice={handleRestoreInvoice}
            onRefresh={() => {
              console.log('[Firestore Sync] Manual refresh requested for audit logs.');
            }}
          />
        )}

        {/* ========================================================
            MODULE: INVOICE CANCELLATION & PENDING STOCK QUEUE
            ======================================================== */}
        {activeTab === 'cancellationQueueTab' && (
          <InvoiceCancellationQueueView
            queueItems={pendingStockQueue}
            currentUser={currentUser}
            selectedCompany={selectedCompany}
            onVerifyAndCreditStock={handleVerifyAndCreditStock}
            onRestoreInvoiceFromQueue={handleRestoreInvoiceFromQueue}
            onPurgeQueueItem={handlePurgeQueueItem}
          />
        )}

        {/* ========================================================
            MODULE E: REPORTS & STOCK STATUS (Billing, Demand vs Supply, Stock Grid)
            ======================================================== */}
        {activeTab === 'reportTab' && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            {/* Sub-Tabs Selector */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
              <button
                onClick={() => setReportSubTab('billing')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  reportSubTab === 'billing' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Billing & Dispatch Reports</span>
              </button>

              <button
                onClick={() => setReportSubTab('demandSupply')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  reportSubTab === 'demandSupply' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Demand vs. Supply Report</span>
              </button>

              <button
                onClick={() => setReportSubTab('stock')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  reportSubTab === 'stock' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel-Style Available Stock Status</span>
              </button>

              <button
                onClick={() => setReportSubTab('auditLogs')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  reportSubTab === 'auditLogs' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Invoice Audit & Cancel History</span>
              </button>
            </div>

            {/* Dedicated Company-Wise Filter Bar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Company Report View:</span>
                </span>
                
                {/* Direct Dropdown Switcher */}
                <select
                  value={reportCompanyFilter}
                  onChange={(e) => setReportCompanyFilter(e.target.value as 'AIL' | 'HPL' | 'ALL')}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="AIL">AIL (Abbott India Limited)</option>
                  <option value="HPL">AHPL (Abbott Healthcare Private Limited)</option>
                  <option value="ALL">🌐 All Companies (Segregated)</option>
                </select>

                <div className="hidden sm:inline-flex items-center rounded-lg bg-slate-200/80 p-0.5">
                  <button
                    type="button"
                    onClick={() => setReportCompanyFilter('AIL')}
                    className={`px-3 py-1.5 rounded-md text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                      reportCompanyFilter === 'AIL'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/50'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>AIL (Abbott India Limited)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportCompanyFilter('HPL')}
                    className={`px-3 py-1.5 rounded-md text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                      reportCompanyFilter === 'HPL'
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/50'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>AHPL (Abbott Healthcare)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportCompanyFilter('ALL')}
                    className={`px-3 py-1.5 rounded-md text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                      reportCompanyFilter === 'ALL'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/50'
                    }`}
                  >
                    <span>🌐 All Companies</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Segregated Active Dataset:</span>
                <span className={`px-2.5 py-1 rounded-md font-extrabold text-[11px] border ${
                  reportCompanyFilter === 'HPL'
                    ? 'bg-purple-50 text-purple-900 border-purple-200'
                    : reportCompanyFilter === 'AIL'
                    ? 'bg-blue-50 text-blue-900 border-blue-200'
                    : 'bg-slate-100 text-slate-800 border-slate-300'
                }`}>
                  {reportCompanyFilter === 'HPL' ? 'AHPL (Abbott Healthcare Private Limited)' : reportCompanyFilter === 'AIL' ? 'AIL (Abbott India Limited)' : 'Consolidated (All Companies)'}
                </span>
              </div>
            </div>

            {/* Sub-View 1: Billing & Dispatch Report */}
            {reportSubTab === 'billing' && (
              <div className="space-y-4">
                {/* 5 KPI Summary Metric Cards for Filtered Invoices */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Invoices</span>
                    <span className="text-base font-extrabold font-mono text-slate-900">{reportMetrics.count}</span>
                  </div>
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase block">Total Cases</span>
                    <span className="text-base font-extrabold font-mono text-indigo-900">{reportMetrics.totalCases}</span>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <span className="text-[10px] font-bold text-blue-700 uppercase block">Taxable Goods Value</span>
                    <span className="text-base font-extrabold font-mono text-blue-900">₹{reportMetrics.totalTaxable}</span>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-[10px] font-bold text-amber-700 uppercase block">Total IGST (Tax)</span>
                    <span className="text-base font-extrabold font-mono text-amber-900">₹{reportMetrics.totalTax}</span>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Grand Total Value</span>
                    <span className="text-base font-extrabold font-mono text-emerald-900">₹{reportMetrics.grandTotal}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setReportView('summary')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        reportView === 'summary' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      Summary Report
                    </button>
                    <button
                      onClick={() => setReportView('detailed')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        reportView === 'detailed' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      Detailed Item-Level Report
                    </button>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-xs font-bold text-slate-700">तारीख चुनें:</span>
                      <input
                        type="date"
                        value={reportDateFilter}
                        onChange={(e) => setReportDateFilter(e.target.value)}
                        className="bg-transparent text-xs outline-none font-medium text-slate-800 cursor-pointer"
                      />
                      {reportDateFilter && (
                        <button
                          onClick={() => setReportDateFilter('')}
                          className="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer ml-1"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <button
                      onClick={reportView === 'summary' ? exportSummaryCsv : exportDetailedCsv}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      onClick={() => exportSapDispatchCsvHelper(filteredInvoices, `SAP_IRN_Dispatch_${reportCompanyFilter}`)}
                      className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
                      title="Export SAP / IRN Dispatch CSV pre-filled with Consignor, Customer, HSN, Tax & Transport attributes"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-200" />
                      <span>Export SAP Dispatch CSV</span>
                    </button>
                  </div>
                </div>

                {reportView === 'summary' ? (
                  <SynchronizedTableScroll className="rounded-lg border border-slate-200">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                          <th className="py-2.5 px-3">Company</th>
                          <th className="py-2.5 px-3">Invoice No</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Client Name</th>
                          <th className="py-2.5 px-3">Destination / Tax Rule</th>
                          <th className="py-2.5 px-3">Transporter</th>
                          <th className="py-2.5 px-3">LR / Vehicle</th>
                          <th className="py-2.5 px-3 text-right">Taxable (₹)</th>
                          <th className="py-2.5 px-3 text-right">Tax (₹)</th>
                          <th className="py-2.5 px-3 text-right font-extrabold">Total Value (₹)</th>
                          <th className="py-2.5 px-3 text-center">Actions / Export</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="py-6 text-center text-slate-400 italic">
                              No outward invoices match your query for {reportCompanyFilter === 'ALL' ? 'any company' : reportCompanyFilter}.
                            </td>
                          </tr>
                        ) : (
                          filteredInvoices.map(inv => {
                            const isIndore = isIndoreDestination(inv);
                            const isInterState = !isIndore;
                            const invComp = getInvoiceCompany(inv);

                            return (
                              <tr key={inv.invNo} className="hover:bg-slate-50 transition">
                                <td className="py-2 px-3">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black font-mono border ${
                                    invComp === 'HPL'
                                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                                      : 'bg-blue-50 text-blue-800 border-blue-200'
                                  }`}>
                                    {invComp === 'HPL' ? 'AHPL' : 'AIL'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-mono font-bold text-blue-700">{inv.invNo}</td>
                                <td className="py-2 px-3 font-mono text-slate-600 font-semibold">{formatDateDDMMYYYY(inv.date)}</td>
                                <td className="py-2 px-3 font-bold text-slate-900">{inv.partyName}</td>
                                <td className="py-2 px-3">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                    isIndore ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-amber-50 text-amber-900 border-amber-300'
                                  }`}>
                                    <span>{isIndore ? '📍 Indore (0% GST - Challan)' : '🚚 Inter-State (18% IGST)'}</span>
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-700">{inv.transName}</td>
                                <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">
                                  {inv.lrNo} / {inv.vehicleNo}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">₹{inv.totalTaxable}</td>
                                <td className="py-2 px-3 text-right font-mono">
                                  {isInterState ? `₹${inv.totalGst}` : '₹0.00'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-700">
                                  ₹{inv.grandTotal}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        setSelectedPreviewInv(inv.invNo);
                                        setModalPreviewInvoice(inv);
                                      }}
                                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition border border-blue-200 hover:border-transparent shadow-2xs"
                                      title="Open A4 modal preview"
                                    >
                                      <FileText className="w-3 h-3" />
                                      <span>Preview</span>
                                    </button>
                                    <button
                                      onClick={() => exportSapDispatchCsvHelper([inv], `SAP_IRN_${inv.invNo.replace(/[/]/g, '_')}`)}
                                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-700 hover:text-white text-indigo-700 rounded font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition border border-indigo-200 hover:border-transparent shadow-2xs"
                                      title="Export single invoice SAP / IRN Dispatch CSV"
                                    >
                                      <FileSpreadsheet className="w-3 h-3" />
                                      <span>SAP CSV</span>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteInvoice(inv.invNo)}
                                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition border border-rose-200 hover:border-transparent shadow-2xs"
                                      title="Cancel / Void invoice and refund stock to inventory"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Cancel / Delete</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </SynchronizedTableScroll>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                          <th className="py-2.5 px-3">Sr No</th>
                          <th className="py-2.5 px-3">Challan/Inv No</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Party Name</th>
                          <th className="py-2.5 px-3">Supply Type</th>
                          <th className="py-2.5 px-3">Doc Category</th>
                          <th className="py-2.5 px-3">Doc Type</th>
                          <th className="py-2.5 px-3">Tax Scheme</th>
                          <th className="py-2.5 px-3">Rev Charge</th>
                          <th className="py-2.5 px-3">Product</th>
                          <th className="py-2.5 px-3">Batch</th>
                          <th className="py-2.5 px-3">HSN</th>
                          <th className="py-2.5 px-3 text-right">Qty</th>
                          <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                          <th className="py-2.5 px-3 text-right font-bold">Total Value (₹)</th>
                          <th className="py-2.5 px-3">Vehicle No</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={17} className="py-6 text-center text-slate-400 italic">
                              No outward items recorded for {reportCompanyFilter === 'ALL' ? 'any company' : reportCompanyFilter}.
                            </td>
                          </tr>
                        ) : (
                          (() => {
                            let srCounter = 1;
                            try {
                              return filteredInvoices.flatMap(inv => {
                                if (!inv) return [];
                                const isIndore = isIndoreDestination(inv);
                                const items = Array.isArray(inv.items) ? inv.items : [];

                                return items.map(it => {
                                  if (!it) return null;
                                  const currentSr = srCounter++;
                                  const rateNum = Number(it.rate) || 0;
                                  const totalValNum = Number(it.totalValue) || 0;
                                  const lineTotalWords = numberToWords(totalValNum);
                                  return (
                                    <tr key={(inv.invNo || 'inv') + '_' + (it.id || Math.random())} className="hover:bg-slate-50">
                                      <td className="py-2 px-3 font-mono font-bold text-slate-700">{currentSr}</td>
                                      <td className="py-2 px-3 font-mono text-blue-700 font-bold">{inv.invNo || '-'}</td>
                                      <td className="py-2 px-3 font-mono">{inv.date ? new Date(inv.date).toLocaleDateString('en-IN') : '-'}</td>
                                      <td className="py-2 px-3 font-semibold text-slate-900">{inv.partyName || '-'}</td>
                                      <td className="py-2 px-3 font-mono font-bold text-slate-700">TAX</td>
                                      <td className="py-2 px-3 font-mono text-slate-600">REG</td>
                                      <td className="py-2 px-3 font-mono text-slate-600">{isIndore ? 'OTH' : 'INV'}</td>
                                      <td className="py-2 px-3 font-mono text-slate-600">GST</td>
                                      <td className="py-2 px-3 font-mono text-slate-600">N</td>
                                      <td className="py-2 px-3">{it.productName || 'Product'} ({it.packSize || '-'})</td>
                                      <td className="py-2 px-3 font-mono font-bold text-slate-800">{it.batch || '-'}</td>
                                      <td className="py-2 px-3 font-mono text-slate-600">{it.hsnCode || '39239090'}</td>
                                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{it.qty ?? 0}</td>
                                      <td className="py-2 px-3 text-right font-mono">₹{rateNum.toFixed(2)}</td>
                                      <td className="py-2 px-3 text-right">
                                        <div className="font-mono font-bold text-blue-700">₹{totalValNum.toFixed(2)}</div>
                                        <div className="text-[10px] text-slate-500 font-sans italic">{lineTotalWords}</div>
                                      </td>
                                      <td className="py-2 px-3 font-mono font-bold text-slate-800">{inv.vehicleNo || '-'}</td>
                                      <td className="py-2 px-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          <button
                                            onClick={() => {
                                              if (inv.invNo) {
                                                setSelectedPreviewInv(inv.invNo);
                                                setModalPreviewInvoice(inv);
                                              }
                                            }}
                                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition cursor-pointer"
                                            title="Invoice Preview"
                                          >
                                            <FileText className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => inv.invNo && handleDeleteInvoice(inv.invNo)}
                                            className="p-1 text-rose-600 hover:bg-rose-100 rounded transition cursor-pointer"
                                            title="Cancel / Void Invoice and Refund Stock"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }).filter(Boolean);
                              });
                            } catch (err) {
                              console.error('[Detailed Report Render Error]:', err);
                              return (
                                <tr>
                                  <td colSpan={17} className="py-6 text-center text-rose-500 italic">
                                    Error rendering detailed report items. Please check console.
                                  </td>
                                </tr>
                              );
                            }
                          })()
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Sub-View 2: Demand vs Supply Report */}
            {reportSubTab === 'demandSupply' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-orange-600" />
                      <span>Client Monthly Demand Quota vs. Actual Dispatched Supply</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Monitoring client-wise quotas against actual dispatches with real-time Red/Green visual threshold status indicators.
                    </p>
                  </div>

                  <button
                    onClick={exportDemandSupplyCsv}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Demand vs. Supply CSV</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                        <th className="py-2.5 px-3">Company</th>
                        <th className="py-2.5 px-3">Client Name</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3 text-right">Allotted Monthly Demand</th>
                        <th className="py-2.5 px-3 text-right">Total Dispatched Qty</th>
                        <th className="py-2.5 px-3 text-right">Remaining Demand</th>
                        <th className="py-2.5 px-3 text-center">Status / Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {demandVsSupplyData.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                            No client monthly demand limits configured for {reportCompanyFilter === 'ALL' ? 'any company' : reportCompanyFilter}. Import via CSV or configure in Masters.
                          </td>
                        </tr>
                      ) : (
                        demandVsSupplyData.map((row, idx) => {
                          const isExceeded = row.status === 'Exceeded';
                          return (
                            <tr key={idx} className={isExceeded ? 'bg-red-50/40' : 'hover:bg-slate-50'}>
                              <td className="py-2.5 px-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black font-mono border ${
                                  row.company === 'HPL'
                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}>
                                  {row.company === 'HPL' ? 'AHPL' : 'AIL'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">{row.partyName}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">{row.productName}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">{row.monthlyLimit} Pcs</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">{row.dispatched} Pcs</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">{row.remaining} Pcs</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold font-mono ${
                                  isExceeded ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {isExceeded ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                                  <span>{row.status}</span>
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-View 3: Excel-Style Available Stock Status */}
            {reportSubTab === 'stock' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Excel-Style Available Stock Status</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Structured inventory spreadsheet showing live available stock, HSN codes, locked rates, weight shifting, and CFT volume.
                    </p>
                  </div>

                  <button
                    onClick={exportStockReportCsv}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Stock Status CSV</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold border-b border-slate-700 text-[11px]">
                        <th className="py-3 px-3">Company</th>
                        <th className="py-3 px-3">Product Name</th>
                        <th className="py-3 px-3">HSN Code</th>
                        <th className="py-3 px-3 text-right">Locked Rate (₹)</th>
                        <th className="py-3 px-3">Pack Size</th>
                        <th className="py-3 px-3 text-right">Available Stock</th>
                        <th className="py-3 px-3 text-right">Weight / Unit</th>
                        <th className="py-3 px-3 text-right">Total Weight Shifting</th>
                        <th className="py-3 px-3 text-right">Total Volume (CFT)</th>
                        <th className="py-3 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {reportProducts.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-6 text-center text-slate-400 italic">
                            No products found in master for {reportCompanyFilter === 'ALL' ? 'any company' : reportCompanyFilter}. Please import products in the Masters tab.
                          </td>
                        </tr>
                      ) : (
                        reportProducts.map(prod => {
                          const currentStock = getProductStock(prod);
                          const totalWtKg = (currentStock * prod.weight).toFixed(2);
                          const totalWtMt = (Number(totalWtKg) / 1000).toFixed(3);
                          const totalCftVol = (currentStock * prod.cft).toFixed(2);
                          const compName = prod.company === 'HPL' ? 'AHPL' : 'AIL';

                          return (
                            <tr key={prod.id || prod.name} className="hover:bg-blue-50/40 transition">
                              <td className="py-2.5 px-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black font-mono border ${
                                  compName === 'AHPL'
                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}>
                                  {compName}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-extrabold text-slate-900">
                                <button
                                  type="button"
                                  onClick={() => setHistoryProduct(prod)}
                                  className="hover:underline text-blue-700 font-extrabold flex items-center gap-1.5 cursor-pointer text-left group"
                                  title="Click to view complete product lifecycle and history drill-down"
                                >
                                  <span>{prod.name}</span>
                                  <History className="w-3.5 h-3.5 text-blue-500 opacity-60 group-hover:opacity-100 transition shrink-0" />
                                </button>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">{prod.hsnCode || '39239090'}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">₹{prod.price.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-slate-600">{prod.packSize} (Mult: {prod.packSizeMultiple})</td>
                              <td className={`py-2.5 px-3 text-right font-mono font-extrabold text-sm ${
                                currentStock > 0 ? 'text-emerald-700' : 'text-red-600'
                              }`}>
                                <div>{currentStock} Pcs</div>
                                {currentStock > 0 && (
                                  <div className="text-[11px] text-indigo-700 font-bold mt-0.5">
                                    ({prod.packSizeMultiple > 0 ? (currentStock % prod.packSizeMultiple === 0 ? currentStock / prod.packSizeMultiple : Number((currentStock / prod.packSizeMultiple).toFixed(1))) : currentStock} Cases)
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700">{prod.weight} kg</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                                {totalWtKg} kg <span className="text-[10px] text-slate-500 font-normal">({totalWtMt} MT)</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-extrabold text-purple-700">{totalCftVol} CFT</td>
                              <td className="py-2.5 px-3 text-center flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setHistoryProduct(prod)}
                                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition border border-indigo-200"
                                  title="Traceability & History Drill-down"
                                >
                                  <History className="w-3 h-3" />
                                  <span>History</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditProd(prod);
                                    setEditQty(currentStock.toString());
                                    setEditRate(prod.price.toString());
                                  }}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded font-bold text-[11px] cursor-pointer transition border border-blue-200"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProductStock(prod)}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded font-bold text-[11px] cursor-pointer transition border border-rose-200"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-View 4: Company-Wise Transaction Logs & Audit Trail */}
            {reportSubTab === 'auditLogs' && (
              <InvoiceAuditLogView
                audits={invoiceAudits}
                invoices={invoices}
                currentUser={currentUser}
                selectedCompany={selectedCompany}
                onSelectInvoiceForPreview={(invNo) => {
                  setSelectedPreviewInv(invNo);
                  setActiveTab('previewPrintTab');
                }}
                onDeleteInvoice={handleDeleteInvoice}
                onDeleteAuditLog={handleDeleteAuditLog}
                onPurgeCancelledAudits={handlePurgeCancelledAudits}
                onRestoreInvoice={handleRestoreInvoice}
                onRefresh={() => {
                  console.log('[Firestore Sync] Manual refresh requested for audit logs.');
                }}
              />
            )}
          </div>
        )}

        {/* ========================================================
            MODULE F: DUAL-MODE INWARD MANAGEMENT & STOCK LOTS
            Exact 13-Column Schema:
            1. GR No., 2. Recd Date, 3. Supply Plant, 4. Invoice No., 5. Date,
            6. Product Description, 7. Qty, 8. Rate, 9. Taxable, 10. Gst 18%,
            11. Invoice Value, 12. Pack, 13. Case
            ======================================================== */}
        {activeTab === 'inwardTab' && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
            {editInward && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                      <Edit2 className="w-4 h-4 text-blue-600" />
                      <span>Stock Write-Off & Adjustment: {editInward.grNo}</span>
                    </h3>
                    <button onClick={() => setEditInward(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="font-bold text-slate-800">{editInward.productName}</div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      GR No: {editInward.grNo} | Plant: {editInward.supplyPlant || 'Indore Hub'} | Date: {editInward.receiveDate || editInward.date}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Total Lot Qty (Pcs):</label>
                      <input 
                        type="number" 
                        min="0"
                        value={inwardEditQty} 
                        onChange={e => setInwardEditQty(e.target.value)} 
                        className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:border-blue-500 outline-none" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Available Balance (Pcs):</label>
                      <input 
                        type="number" 
                        min="0"
                        value={inwardEditAvailQty} 
                        onChange={e => setInwardEditAvailQty(e.target.value)} 
                        className="w-full border border-emerald-400 bg-emerald-50/50 rounded-lg p-2 font-mono font-bold text-emerald-950 focus:border-emerald-600 outline-none" 
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="font-bold text-slate-700 block">Purchase Rate / Price (₹):</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="0.01" 
                      value={inwardEditRate} 
                      onChange={e => setInwardEditRate(e.target.value)} 
                      className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:border-blue-500 outline-none" 
                    />
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="font-bold text-slate-800 block text-red-700">
                      Mandatory Reason / Remark for Adjustment / Write-Off *
                    </label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Damaged in transit / Physical count correction / Stock write-off" 
                      value={inwardEditReason} 
                      onChange={e => setInwardEditReason(e.target.value)} 
                      className="w-full border border-red-300 bg-red-50/30 rounded-lg p-2 font-medium text-slate-900 focus:border-red-500 outline-none" 
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button 
                      type="button"
                      onClick={() => setEditInward(null)} 
                      className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button"
                      onClick={handleSaveEdit} 
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-xs"
                    >
                      Save Adjustment & Log Audit
                    </button>
                  </div>
                </div>
              </div>
            )}
            {editProd && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      <span>Edit Product Details & Stock: {editProd.name}</span>
                    </h3>
                    <button onClick={() => setEditProd(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700">HSN Code</label>
                      <input 
                        type="text" 
                        value={editHsn} 
                        onChange={e => setEditHsn(e.target.value)} 
                        className="w-full border border-slate-300 rounded p-2 text-xs font-mono font-bold mt-1" 
                        placeholder="39239090"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700">Selling Rate (₹)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={editRate} 
                        onChange={e => setEditRate(e.target.value)} 
                        className="w-full border border-slate-300 rounded p-2 text-xs font-mono font-bold text-blue-700 mt-1" 
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="text-[11px] font-bold text-slate-700">Pack Size Description</label>
                    <input 
                      type="text" 
                      value={editPackSize} 
                      onChange={e => setEditPackSize(e.target.value)} 
                      className="w-full border border-slate-300 rounded p-2 text-xs mt-1" 
                      placeholder="e.g. Box of 10"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600">Pack Multiple</label>
                      <input 
                        type="number" 
                        value={editPackMultiple} 
                        onChange={e => setEditPackMultiple(e.target.value)} 
                        className="w-full border border-slate-300 rounded p-1.5 text-xs font-mono font-bold mt-1" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600">Weight (kg)</label>
                      <input 
                        type="number" 
                        step="0.001" 
                        value={editWeight} 
                        onChange={e => setEditWeight(e.target.value)} 
                        className="w-full border border-slate-300 rounded p-1.5 text-xs font-mono font-bold mt-1" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600">CFT Volume</label>
                      <input 
                        type="number" 
                        step="0.001" 
                        value={editCft} 
                        onChange={e => setEditCft(e.target.value)} 
                        className="w-full border border-slate-300 rounded p-1.5 text-xs font-mono font-bold mt-1" 
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <label className="text-[11px] font-extrabold text-slate-800">Adjust Available Live Stock (Pcs)</label>
                    <input 
                      type="number" 
                      value={editQty} 
                      onChange={e => setEditQty(e.target.value)} 
                      className="w-full border border-slate-300 rounded p-2 text-xs font-mono font-extrabold text-emerald-700 mt-1 bg-white" 
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Changes are synced instantly to Firestore cloud database.</p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setEditProd(null)} className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded text-xs font-bold cursor-pointer">Cancel</button>
                    <button onClick={handleSaveStockEdit} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold cursor-pointer shadow-xs">Save to Firestore</button>
                  </div>
                </div>
              </div>
            )}

            {/* Header & Sub-Tab Navigation */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
                  <Warehouse className="w-4 h-4 text-cyan-600" />
                  <span>Dual-Mode Inward Stock Ingestion (13-Column Schema)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Log incoming warehouse stock batches using either Option A (Manual Interactive Form with auto-computed Taxable, GST 18%, and Invoice Value) or Option B (13-Column CSV Bulk Upload).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInwardSubTab('detail')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    inwardSubTab === 'detail' 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>📋 Inward Stock Ledger</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInwardSubTab('manual')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    inwardSubTab === 'manual' 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>📝 Option A: Manual Entry Form</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInwardSubTab('csvUpload')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    inwardSubTab === 'csvUpload' 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>📤 Option B: CSV Bulk Upload</span>
                </button>
              </div>
            </div>

            {/* ========================================================
                SUB-VIEW 1: INWARD STOCK LEDGER (HISTORY)
                ======================================================== */}
            {inwardSubTab === 'detail' && (
              <div className="space-y-4">
                {/* Company Filter Bar for Inward Ledger */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Inward Stock View:</span>
                    </span>
                    
                    <select
                      value={inwardCompanyFilter}
                      onChange={(e) => setInwardCompanyFilter(e.target.value as 'AIL' | 'HPL' | 'ALL')}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="AIL">AIL (Abbott India Limited)</option>
                      <option value="HPL">AHPL (Abbott Healthcare Private Limited)</option>
                      <option value="ALL">🌐 All Companies</option>
                    </select>

                    <div className="hidden sm:inline-flex items-center rounded-lg bg-slate-200/80 p-0.5">
                      <button
                        type="button"
                        onClick={() => setInwardCompanyFilter('AIL')}
                        className={`px-3 py-1 rounded-md text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                          inwardCompanyFilter === 'AIL'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/50'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>AIL</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInwardCompanyFilter('HPL')}
                        className={`px-3 py-1 rounded-md text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                          inwardCompanyFilter === 'HPL'
                            ? 'bg-purple-700 text-white shadow-xs'
                            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/50'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>AHPL</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInwardCompanyFilter('ALL')}
                        className={`px-3 py-1 rounded-md text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                          inwardCompanyFilter === 'ALL'
                            ? 'bg-slate-800 text-white shadow-xs'
                            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/50'
                        }`}
                      >
                        <span>All</span>
                      </button>
                    </div>

                    {/* Date Picker Filter */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs">
                      <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <input
                        type="date"
                        value={inwardDateFilter}
                        onChange={(e) => setInwardDateFilter(e.target.value)}
                        className="bg-transparent outline-none cursor-pointer font-mono text-xs text-slate-800"
                        title="Filter inward stock lots by receiving date"
                      />
                      {inwardDateFilter && (
                        <button
                          type="button"
                          onClick={() => setInwardDateFilter('')}
                          className="text-slate-400 hover:text-slate-600 font-bold ml-1 cursor-pointer"
                          title="Clear date filter"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* State / Supply Plant Dropdown Filter */}
                    <select
                      value={inwardStateFilter}
                      onChange={(e) => setInwardStateFilter(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="ALL">📍 All Plants / Locations</option>
                      <option value="Indore">Indore Hub</option>
                      <option value="Peer Karadiya">Peer Karadiya Plant</option>
                      <option value="Baddi">Baddi Plant</option>
                      <option value="Goa">Goa Plant</option>
                    </select>
                  </div>

                  <span className={`px-2.5 py-1 rounded-md font-extrabold text-[11px] border ${
                    inwardCompanyFilter === 'HPL'
                      ? 'bg-purple-50 text-purple-900 border-purple-200'
                      : inwardCompanyFilter === 'AIL'
                      ? 'bg-blue-50 text-blue-900 border-blue-200'
                      : 'bg-slate-100 text-slate-800 border-slate-300'
                  }`}>
                    {inwardCompanyFilter === 'HPL' ? 'AHPL (Abbott Healthcare)' : inwardCompanyFilter === 'AIL' ? 'AIL (Abbott India Limited)' : 'All Companies'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full sm:w-auto">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Lots</span>
                      <span className="text-sm font-extrabold font-mono text-slate-800">{filteredInwards.length} Lots</span>
                    </div>
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                      <span className="text-[10px] text-blue-700 uppercase font-bold block">Total Inward Qty</span>
                      <span className="text-sm font-extrabold font-mono text-blue-900">
                        {filteredInwards.reduce((sum, i) => sum + (Number(i.qty ?? i.initialQty) || 0), 0)} Pcs
                      </span>
                    </div>
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <span className="text-[10px] text-emerald-700 uppercase font-bold block">Live Available Stock</span>
                      <span className="text-sm font-extrabold font-mono text-emerald-900">
                        {filteredInwards.reduce((sum, i) => sum + (Number(i.availableQty) || 0), 0)} Pcs
                      </span>
                    </div>
                    <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                      <span className="text-[10px] text-purple-700 uppercase font-bold block">Inward Valuation</span>
                      <span className="text-sm font-extrabold font-mono text-purple-900">
                        ₹{filteredInwards.reduce((sum, i) => sum + (Number(i.invoiceValue ?? i.totalAmount) || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={exportInwardReportCsv}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Inward Ledger CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInwardSubTab('manual')}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ New Inward Entry</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold border-b border-slate-700 text-[11px]">
                        <th className="py-2.5 px-2.5">Company</th>
                        <th className="py-2.5 px-2.5">1. GR No.</th>
                        <th className="py-2.5 px-2.5">2. Recd Date</th>
                        <th className="py-2.5 px-2.5">3. Supply Plant</th>
                        <th className="py-2.5 px-2.5">4. Inv No.</th>
                        <th className="py-2.5 px-2.5">5. Date</th>
                        <th className="py-2.5 px-2.5">6. Product Description</th>
                        <th className="py-2.5 px-2.5 text-right">7. Qty</th>
                        <th className="py-2.5 px-2.5 text-right font-bold text-emerald-300">Available Stock</th>
                        <th className="py-2.5 px-2.5 text-right">8. Rate (₹)</th>
                        <th className="py-2.5 px-2.5 text-right">9. Taxable (₹)</th>
                        <th className="py-2.5 px-2.5 text-right">10. GST 18% (₹)</th>
                        <th className="py-2.5 px-2.5 text-right font-bold text-amber-300">11. Inv Value (₹)</th>
                        <th className="py-2.5 px-2.5">12. Pack</th>
                        <th className="py-2.5 px-2.5">13. Case</th>
                        <th className="py-2.5 px-2.5 text-center">Actions / Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInwards.length === 0 ? (
                        <tr>
                          <td colSpan={16} className="py-8 text-center text-slate-400 italic">
                            No incoming stock logged for {inwardCompanyFilter === 'ALL' ? 'any company' : inwardCompanyFilter}. Use "Option A: Manual Entry Form" or "Option B: CSV Bulk Upload" above to ingest goods.
                          </td>
                        </tr>
                      ) : (
                        filteredInwards.map(inw => {
                          const q = Number(inw.qty ?? inw.initialQty) || 0;
                          const rt = Number(inw.rate ?? inw.price) || 0;
                          const taxable = Number(inw.taxable ?? (q * rt).toFixed(2));
                          const gst18 = Number(inw.gst18 ?? (taxable * 0.18).toFixed(2));
                          const invVal = Number(inw.invoiceValue ?? inw.totalAmount ?? (taxable + gst18).toFixed(2));
                          const inwComp = (inw.company || 'AIL') === 'HPL' ? 'AHPL' : 'AIL';

                          return (
                            <tr key={inw.id} className="hover:bg-slate-50 transition">
                              <td className="py-2 px-2.5">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black font-mono border ${
                                  inwComp === 'AHPL'
                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}>
                                  {inwComp}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 font-mono font-bold text-blue-700">{inw.grNo}</td>
                              <td className="py-2 px-2.5 font-mono text-slate-600 font-semibold">{formatDateDDMMYYYY(inw.recdDate || inw.receiveDate)}</td>
                              <td className="py-2 px-2.5 text-slate-700 font-semibold">{inw.supplyPlant || 'Peer Karadiya Plant'}</td>
                              <td className="py-2 px-2.5 font-mono text-slate-700 font-bold">{inw.invNo}</td>
                              <td className="py-2 px-2.5 font-mono text-slate-600 font-semibold">{formatDateDDMMYYYY(inw.date || inw.recdDate || inw.receiveDate)}</td>
                              <td className="py-2 px-2.5 font-bold text-slate-900">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const pName = inw.productDescription || inw.productName;
                                    const matched = activeProducts.find(p => p.name === pName) || products.find(p => p.name === pName) || {
                                      id: 'prod_' + inw.id,
                                      name: pName,
                                      company: inw.company,
                                      hsnCode: inw.hsnCode || '39239090',
                                      packSize: inw.pack || inw.packSize || 'Box of 10',
                                      packSizeMultiple: 10,
                                      price: inw.rate || inw.price || 0,
                                      weight: 0.15,
                                      cft: 0.02
                                    };
                                    setHistoryProduct(matched);
                                  }}
                                  className="hover:underline text-blue-700 font-extrabold flex items-center gap-1.5 cursor-pointer text-left group"
                                  title="Click to view complete product lifecycle and history drill-down"
                                >
                                  <span>{inw.productDescription || inw.productName}</span>
                                  <History className="w-3.5 h-3.5 text-blue-500 opacity-60 group-hover:opacity-100 transition shrink-0" />
                                </button>
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-700">{q}</td>
                              <td className="py-2 px-2.5 text-right font-mono">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold ${
                                  inw.availableQty > 0 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-slate-100 text-slate-500 line-through'
                                }`}>
                                  {inw.availableQty} Pcs
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono">₹{rt.toFixed(2)}</td>
                              <td className="py-2 px-2.5 text-right font-mono text-slate-700">₹{taxable.toFixed(2)}</td>
                              <td className="py-2 px-2.5 text-right font-mono text-purple-700">₹{gst18.toFixed(2)}</td>
                              <td className="py-2 px-2.5 text-right font-mono font-bold text-blue-700">₹{invVal.toFixed(2)}</td>
                              <td className="py-2 px-2.5 text-slate-600">{inw.pack || inw.packSize || 'Box of 10'}</td>
                              <td className="py-2 px-2.5 text-slate-600 font-mono">{inw.caseCount || '10 Cases'}</td>
                              <td className="py-2 px-2.5 text-center flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditInward(inw);
                                    setInwardEditQty(String(q));
                                    setInwardEditAvailQty(String(inw.availableQty !== undefined ? inw.availableQty : q));
                                    setInwardEditRate(String(rt));
                                    setInwardEditReason('');
                                  }}
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-extrabold flex items-center gap-1 transition cursor-pointer"
                                  title="Write-Off or adjust stock quantity"
                                >
                                  <Edit2 className="w-3 h-3 text-amber-700" />
                                  <span>Write-Off</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => (window as any).deleteInwardEntry(inw.id)}
                                  className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 border border-red-200 rounded text-[10px] font-extrabold flex items-center gap-1 transition cursor-pointer"
                                  title="स्थायी रूप से हटाएं (Permanently Delete from Firestore)"
                                >
                                  <Trash2 className="w-3 h-3 text-red-600" />
                                  <span>Delete</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ========================================================
                SUB-VIEW 2: OPTION A - MANUAL ENTRY FORM (13 COLUMNS)
                Real-time Auto-Calculations:
                Taxable = Qty * Rate
                Gst 18% = Taxable * 0.18
                Invoice Value = Taxable + Gst 18%
                ======================================================== */}
            {inwardSubTab === 'manual' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-emerald-950 block text-sm">
                      Option A: Interactive 13-Column Manual Inward Entry Form
                    </span>
                    <span className="text-emerald-800">
                      As you input <strong>Qty</strong> and <strong>Rate</strong>, the system automatically computes <strong>Taxable (= Qty * Rate)</strong>, <strong>Gst 18% (= Taxable * 0.18)</strong>, and <strong>Invoice Value (= Taxable + Gst)</strong> in real time.
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={addInwardRow}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Row</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInwardSubTab('csvUpload')}
                      className="px-3 py-1.5 bg-white text-indigo-700 border border-indigo-300 hover:bg-indigo-50 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>Switch to CSV Upload</span>
                    </button>
                  </div>
                </div>

                {/* 13-Column Editable Inward Table */}
                <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                        <th className="py-2.5 px-2">1. GR No.</th>
                        <th className="py-2.5 px-2">2. Recd Date</th>
                        <th className="py-2.5 px-2">3. Supply Plant</th>
                        <th className="py-2.5 px-2">4. Invoice No.</th>
                        <th className="py-2.5 px-2">5. Date</th>
                        <th className="py-2.5 px-2">6. Product Description</th>
                        <th className="py-2.5 px-2 text-right">7. Qty *</th>
                        <th className="py-2.5 px-2 text-right">8. Rate (₹) *</th>
                        <th className="py-2.5 px-2 text-right bg-blue-50/70 text-blue-900 font-extrabold">9. Taxable (₹)</th>
                        <th className="py-2.5 px-2 text-right bg-purple-50/70 text-purple-900 font-extrabold">10. Gst 18% (₹)</th>
                        <th className="py-2.5 px-2 text-right bg-emerald-50/70 text-emerald-900 font-extrabold">11. Inv Value (₹)</th>
                        <th className="py-2.5 px-2">12. Pack</th>
                        <th className="py-2.5 px-2">13. Case</th>
                        <th className="py-2.5 px-2 text-center">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inwardGridRows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          {/* 1. GR No. */}
                          <td className="p-1.5">
                            <input
                              type="text"
                              required
                              value={row.grNo}
                              onChange={(e) => updateInwardRow(row.id, { grNo: e.target.value })}
                              placeholder="GR-2026-01"
                              className="border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-blue-700 w-24 bg-white"
                            />
                          </td>

                          {/* 2. Recd Date */}
                          <td className="p-1.5">
                            <input
                              type="date"
                              required
                              value={row.recdDate}
                              onChange={(e) => updateInwardRow(row.id, { recdDate: e.target.value })}
                              className="border border-slate-300 rounded px-2 py-1 text-xs w-28 bg-white"
                            />
                            {row.recdDate && (
                              <span className="block text-[9px] font-mono text-slate-500 mt-0.5">
                                {formatDateDDMMYYYY(row.recdDate)}
                              </span>
                            )}
                          </td>

                          {/* 3. Supply Plant */}
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.supplyPlant}
                              onChange={(e) => updateInwardRow(row.id, { supplyPlant: e.target.value })}
                              placeholder="Peer Karadiya Plant"
                              className="border border-slate-300 rounded px-2 py-1 text-xs w-36 bg-white font-medium"
                            />
                          </td>

                          {/* 4. Invoice No. */}
                          <td className="p-1.5">
                            <input
                              type="text"
                              required
                              value={row.invNo}
                              onChange={(e) => updateInwardRow(row.id, { invNo: e.target.value })}
                              placeholder="SUP-INV-8901"
                              className="border border-slate-300 rounded px-2 py-1 text-xs font-mono w-28 bg-white font-bold text-blue-700"
                            />
                          </td>

                          {/* 5. Date */}
                          <td className="p-1.5">
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => updateInwardRow(row.id, { date: e.target.value })}
                              className="border border-slate-300 rounded px-2 py-1 text-xs w-28 bg-white"
                            />
                            {row.date && (
                              <span className="block text-[9px] font-mono text-slate-500 mt-0.5">
                                {formatDateDDMMYYYY(row.date)}
                              </span>
                            )}
                          </td>

                          {/* 6. Product Description */}
                          <td className="p-1.5">
                            <div className="flex items-center gap-1">
                              <select
                                value={row.productDescription}
                                onChange={(e) => updateInwardRow(row.id, { productDescription: e.target.value })}
                                className="border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 bg-white max-w-[170px]"
                              >
                                {activeProducts.length === 0 ? (
                                  <option value={row.productDescription || 'Standard EPS Corner Guard'}>
                                    {row.productDescription || 'Standard EPS Corner Guard'}
                                  </option>
                                ) : (
                                  Array.from(new Set(activeProducts.map(p => p.name))).map((pName, idx) => (
                                    <option key={idx} value={pName}>{pName}</option>
                                  ))
                                )}
                              </select>
                            </div>
                          </td>

                          {/* 7. Qty */}
                          <td className="p-1.5 text-right">
                            <input
                              type="number"
                              min="1"
                              required
                              value={row.qty}
                              onChange={(e) => updateInwardRow(row.id, { qty: e.target.value === '' ? '' : Number(e.target.value) })}
                              placeholder="Qty"
                              className="border border-slate-300 rounded px-2 py-1 text-xs text-right font-mono font-bold text-emerald-800 w-20 bg-white"
                            />
                          </td>

                          {/* 8. Rate */}
                          <td className="p-1.5 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={row.rate}
                              onChange={(e) => updateInwardRow(row.id, { rate: e.target.value === '' ? '' : Number(e.target.value) })}
                              placeholder="Rate"
                              className="border border-slate-300 rounded px-2 py-1 text-xs text-right font-mono w-20 bg-white"
                            />
                          </td>

                          {/* 9. Taxable (= Qty * Rate) - Auto Computed */}
                          <td className="p-1.5 text-right bg-blue-50/50 font-mono font-bold text-blue-900">
                            ₹{row.taxable.toFixed(2)}
                          </td>

                          {/* 10. Gst 18% (= Taxable * 0.18) - Auto Computed */}
                          <td className="p-1.5 text-right bg-purple-50/50 font-mono font-bold text-purple-900">
                            ₹{row.gst18.toFixed(2)}
                          </td>

                          {/* 11. Invoice Value (= Taxable + Gst) - Auto Computed */}
                          <td className="p-1.5 text-right bg-emerald-50/50 font-mono font-extrabold text-emerald-950">
                            ₹{row.invoiceValue.toFixed(2)}
                          </td>

                          {/* 12. Pack */}
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.pack}
                              onChange={(e) => updateInwardRow(row.id, { pack: e.target.value })}
                              placeholder="Box of 10"
                              className="border border-slate-300 rounded px-2 py-1 text-xs w-24 bg-white"
                            />
                          </td>

                          {/* 13. Case (Auto-calculated) */}
                          <td className="p-1.5">
                            <input
                              type="text"
                              readOnly
                              value={row.caseCount}
                              placeholder="Auto Cases"
                              className="border border-slate-200 rounded px-2 py-1 text-xs w-24 bg-slate-100 text-slate-700 font-mono font-bold cursor-not-allowed select-none"
                              title="Auto-calculated: Qty / Pack Size Multiple"
                            />
                          </td>

                          {/* Delete Action */}
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeInwardRow(row.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                              title="Delete this inward entry row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Real-time Summary Cards & Submit Bar */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Inward Qty</span>
                      <span className="font-mono font-extrabold text-slate-800 text-sm">
                        {inwardGridRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0)} Pcs
                      </span>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                      <span className="text-[10px] text-blue-700 uppercase font-bold block">Total Taxable Value</span>
                      <span className="font-mono font-extrabold text-blue-950 text-sm">
                        ₹{inwardGridRows.reduce((sum, r) => sum + r.taxable, 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg">
                      <span className="text-[10px] text-purple-700 uppercase font-bold block">Total GST (18%)</span>
                      <span className="font-mono font-extrabold text-purple-950 text-sm">
                        ₹{inwardGridRows.reduce((sum, r) => sum + r.gst18, 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-lg">
                      <span className="text-[10px] text-emerald-800 uppercase font-bold block">Grand Inward Value</span>
                      <span className="font-mono font-extrabold text-emerald-950 text-base">
                        ₹{inwardGridRows.reduce((sum, r) => sum + r.invoiceValue, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <button
                      type="button"
                      onClick={addInwardRow}
                      className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Row</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveInwardGrid}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save & Ingest Inward Stock</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================
                SUB-VIEW 3: OPTION B - CSV BULK UPLOAD & TEMPLATE (13 COLUMNS)
                ======================================================== */}
            {inwardSubTab === 'csvUpload' && (
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 text-xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-extrabold text-indigo-950 uppercase flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-indigo-700" />
                        <span>Option B: 13-Column CSV Bulk Inward Ingestion</span>
                      </h4>
                      <p className="text-xs text-indigo-800 mt-0.5">
                        Upload bulk inward inventory matching the exact 13-column schema. If <strong>Taxable</strong>, <strong>Gst 18%</strong>, or <strong>Invoice Value</strong> are omitted, they will be automatically calculated as <strong>Qty * Rate</strong>, <strong>Taxable * 0.18</strong>, and <strong>Taxable + Gst</strong>.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => downloadSampleTemplate('inward')}
                      className="px-3.5 py-1.5 bg-white text-indigo-700 border border-indigo-300 hover:bg-indigo-50 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>📥 Download 13-Column Sample Template</span>
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-indigo-200/80 space-y-2">
                    <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                      Required 13-Column CSV Header Order:
                    </span>
                    <div className="font-mono text-[11px] text-indigo-900 bg-indigo-50/50 p-2 rounded border border-indigo-100 overflow-x-auto whitespace-nowrap">
                      GR No., Recd Date, Supply Plant, Invoice No., Date, Product Description, Qty, Rate, Taxable, Gst 18%, Invoice Value, Pack, Case
                    </div>
                  </div>

                  {/* File Upload Box */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
                    <input
                      type="file"
                      ref={inwardFileInputRef}
                      accept=".csv"
                      onChange={handleInwardCsvFileSelected}
                      className="text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                    />

                    {inwardCsvRows.length > 0 && (
                      <button
                        type="button"
                        onClick={handleConfirmIngestInwardCsv}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm & Ingest {inwardCsvRows.length} Lots into Inventory</span>
                      </button>
                    )}
                  </div>

                  {inwardCsvMsg && (
                    <div className={`p-3 rounded-lg text-xs font-semibold ${
                      inwardCsvMsg.isError 
                        ? 'bg-rose-50 text-rose-800 border border-rose-200' 
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}>
                      {inwardCsvMsg.text}
                    </div>
                  )}
                </div>

                {/* Parsed CSV Preview Table */}
                {inwardCsvRows.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Parsed Bulk Inward Stock Preview ({inwardCsvRows.length} Rows)</span>
                      </span>

                      <button
                        type="button"
                        onClick={handleConfirmIngestInwardCsv}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <span>Confirm Ingest Stock</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-xs max-h-96">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-800 text-white font-bold text-[11px]">
                          <tr>
                            <th className="py-2.5 px-2.5">GR No.</th>
                            <th className="py-2.5 px-2.5">Recd Date</th>
                            <th className="py-2.5 px-2.5">Supply Plant</th>
                            <th className="py-2.5 px-2.5">Invoice No.</th>
                            <th className="py-2.5 px-2.5">Date</th>
                            <th className="py-2.5 px-2.5">Product Description</th>
                            <th className="py-2.5 px-2.5 text-right">Qty</th>
                            <th className="py-2.5 px-2.5 text-right">Rate (₹)</th>
                            <th className="py-2.5 px-2.5 text-right">Taxable (₹)</th>
                            <th className="py-2.5 px-2.5 text-right">GST 18% (₹)</th>
                            <th className="py-2.5 px-2.5 text-right font-bold text-amber-300">Invoice Value (₹)</th>
                            <th className="py-2.5 px-2.5">Pack</th>
                            <th className="py-2.5 px-2.5">Case</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {inwardCsvRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 font-mono">
                              <td className="py-2 px-2.5 font-bold text-blue-700">{row.grNo}</td>
                              <td className="py-2 px-2.5 text-slate-600 font-semibold">{formatDateDDMMYYYY(row.recdDate)}</td>
                              <td className="py-2 px-2.5 font-sans font-medium text-slate-700">{row.supplyPlant}</td>
                              <td className="py-2 px-2.5 text-slate-700 font-bold">{row.invNo}</td>
                              <td className="py-2 px-2.5 text-slate-600 font-semibold">{formatDateDDMMYYYY(row.date)}</td>
                              <td className="py-2 px-2.5 font-sans font-bold text-slate-900">{row.productDescription}</td>
                              <td className="py-2 px-2.5 text-right font-bold text-emerald-700">{row.qty}</td>
                              <td className="py-2 px-2.5 text-right">₹{row.rate.toFixed(2)}</td>
                              <td className="py-2 px-2.5 text-right text-slate-700">₹{row.taxable.toFixed(2)}</td>
                              <td className="py-2 px-2.5 text-right text-purple-700">₹{row.gst18.toFixed(2)}</td>
                              <td className="py-2 px-2.5 text-right font-bold text-blue-700">₹{row.invoiceValue.toFixed(2)}</td>
                              <td className="py-2 px-2.5 font-sans text-slate-600">{row.pack}</td>
                              <td className="py-2 px-2.5 text-slate-600">{row.caseCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            MODULE G: MASTERS, CSV INGESTION & DATA CLEANUP
            ======================================================== */}
        {activeTab === 'masterTab' && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
            {/* Sub-Tabs: CSV Templates & Bulk Ingestion VS Data Cleanup */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <button
                onClick={() => setMasterSubTab('templates')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  masterSubTab === 'templates' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Master Data & CSV Bulk Ingestion</span>
              </button>

              <button
                onClick={() => setMasterSubTab('cleanup')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  masterSubTab === 'cleanup' ? 'bg-red-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>🧹 Data Cleanup & Deletion</span>
              </button>
            </div>

            {masterSubTab === 'templates' ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <span>Master Data Management & CSV Bulk Templates</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Download sample CSV templates and upload populated bulk files for all core business masters:
                    Product Master (with HSN Code), Customer / Party Master, Transporter Master, and Client Monthly Demands.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => downloadSampleTemplate('product')}
                    className="p-3 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-between transition cursor-pointer border border-slate-200"
                  >
                    <span>1. Product Master (with HSN)</span>
                    <Download className="w-4 h-4 text-indigo-600" />
                  </button>
                  <button
                    onClick={() => downloadSampleTemplate('party')}
                    className="p-3 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-between transition cursor-pointer border border-slate-200"
                  >
                    <span>2. Customer Master (with State/City)</span>
                    <Download className="w-4 h-4 text-indigo-600" />
                  </button>
                  <button
                    onClick={() => downloadSampleTemplate('transporter')}
                    className="p-3 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-between transition cursor-pointer border border-slate-200"
                  >
                    <span>3. Transporter Master</span>
                    <Download className="w-4 h-4 text-indigo-600" />
                  </button>
                  <button
                    onClick={() => downloadSampleTemplate('demand')}
                    className="p-3 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-between transition cursor-pointer border border-slate-200"
                  >
                    <span>4. Client Monthly Demand</span>
                    <Download className="w-4 h-4 text-indigo-600" />
                  </button>
                </div>

                {/* Additional Sample Templates */}
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-slate-500 font-semibold">Transaction Log Templates:</span>
                  <button
                    onClick={() => downloadSampleTemplate('inward')}
                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Inward Logs Template</span>
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    onClick={() => downloadSampleTemplate('outward')}
                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Outward Invoices Template</span>
                  </button>
                </div>

                {/* Bulk CSV Upload Box */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-700">Select Master / Ingestion Type:</span>
                      <select
                        value={csvType}
                        onChange={(e) => setCsvType(e.target.value as any)}
                        className="bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-semibold outline-none cursor-pointer"
                      >
                        <option value="product">Product Master CSV (with HSN Code)</option>
                        <option value="party">Customer / Party Master CSV (with State & City)</option>
                        <option value="transporter">Transporter Master CSV</option>
                        <option value="demand">Client Monthly Demands CSV</option>
                        <option value="inward">Inward Logs CSV</option>
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddProductModal(true)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Quick Add Product ({selectedCompany === 'HPL' ? 'AHPL' : 'AIL'})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddPartyModal(true)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Quick Add Customer ({selectedCompany === 'HPL' ? 'AHPL' : 'AIL'})</span>
                      </button>
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={csvFileRef}
                    accept=".csv"
                    className="text-xs block"
                  />

                  <button
                    onClick={handleUploadCsv}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Upload & Ingest Master CSV Data
                  </button>
                </div>

                {csvStatusMsg && (
                  <div className={`p-3 rounded-lg text-xs font-semibold ${
                    csvStatusMsg.isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {csvStatusMsg.text}
                  </div>
                )}

                {/* Quick Add Customer Modal / Dialog */}
                {showAddPartyModal && (
                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-700" />
                        <h4 className="text-xs font-extrabold text-indigo-950 uppercase">
                          Add New Customer / Party (with Tax Location)
                        </h4>
                      </div>
                      <button
                        onClick={() => setShowAddPartyModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <form onSubmit={handleQuickAddParty} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Customer Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Abbott Healthcare Depot"
                            value={newPartyName}
                            onChange={(e) => setNewPartyName(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Destination (City) *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Hyderabad, Indore, Pune"
                            value={newPartyCity}
                            onChange={(e) => setNewPartyCity(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-semibold uppercase"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">State *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Telangana, Madhya Pradesh"
                            value={newPartyState}
                            onChange={(e) => setNewPartyState(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-semibold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Pin Code *</label>
                          <input
                            type="text"
                            placeholder="e.g. 501401"
                            value={newPartyPincode}
                            onChange={(e) => setNewPartyPincode(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="sm:col-span-2">
                          <label className="font-bold text-slate-700 block mb-1">Customer Address (Billing / Delivery) *</label>
                          <input
                            type="text"
                            placeholder="e.g. Plot 24, Medchal Industrial Park, Hyderabad, Telangana - 501401"
                            value={newPartyAddress}
                            onChange={(e) => setNewPartyAddress(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">GSTIN / UIN</label>
                          <input
                            type="text"
                            placeholder="e.g. 36AAACA0231P1Z5"
                            value={newPartyGstin}
                            onChange={(e) => setNewPartyGstin(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-mono uppercase"
                          />
                        </div>
                      </div>

                      {/* Live Tax Rule Determination Preview */}
                      <div className="p-3 bg-white rounded-lg border border-indigo-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Live Conditional Tax Calculation:</span>
                          <p className="font-extrabold text-slate-800">
                            {newPartyIsInterState ? (
                              <span className="text-amber-800">🚚 Inter-State Supply (Outside MP) → 18% IGST Applied</span>
                            ) : (
                              <span className="text-emerald-800">📍 Local Supply (Indore, Madhya Pradesh) → 0% GST (Tax Exempt)</span>
                            )}
                          </p>
                        </div>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs transition"
                        >
                          Save Customer to Master
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Quick Add Product Modal */}
                {showAddProductModal && (
                  <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl space-y-4 shadow-sm animate-in fade-in duration-150">
                    <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-blue-700" />
                        <h4 className="text-xs font-extrabold text-blue-950 uppercase">
                          + Add New Product to {selectedCompany === 'HPL' ? 'AHPL' : 'AIL'} Master
                        </h4>
                      </div>
                      <button
                        onClick={() => setShowAddProductModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <form onSubmit={handleQuickAddProduct} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Product Description / Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Standard EPS Box 10kg"
                            value={newProdName}
                            onChange={(e) => setNewProdName(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">HSN Code *</label>
                          <input
                            type="text"
                            required
                            value={newProdHsn}
                            onChange={(e) => setNewProdHsn(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Selling Rate (₹) *</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={newProdPrice}
                            onChange={(e) => setNewProdPrice(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Pack Size Description *</label>
                          <input
                            type="text"
                            required
                            value={newProdPackSize}
                            onChange={(e) => setNewProdPackSize(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Pack Size Multiple (Units/Case) *</label>
                          <input
                            type="number"
                            required
                            value={newProdMultiple}
                            onChange={(e) => setNewProdMultiple(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Weight per Unit (kg) *</label>
                          <input
                            type="number"
                            step="0.001"
                            required
                            value={newProdWeight}
                            onChange={(e) => setNewProdWeight(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">CFT Volume per Unit *</label>
                          <input
                            type="number"
                            step="0.001"
                            required
                            value={newProdCft}
                            onChange={(e) => setNewProdCft(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddProductModal(false)}
                          className="px-3.5 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                        >
                          Save Product to {selectedCompany === 'HPL' ? 'AHPL' : 'AIL'} Master
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Edit Existing Customer Form Modal */}
                {editingPartyIndex !== null && editPartyForm && (
                  <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-xl space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <div className="flex items-center gap-2">
                        <Edit2 className="w-4 h-4 text-amber-700" />
                        <h4 className="text-xs font-extrabold text-amber-950 uppercase">
                          Update Customer Details, Location & Pin Code
                        </h4>
                      </div>
                      <button
                        onClick={() => {
                          setEditingPartyIndex(null);
                          setEditPartyForm(null);
                        }}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <form onSubmit={handleSaveEditParty} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Customer Name *</label>
                          <input
                            type="text"
                            required
                            value={editPartyForm.name}
                            onChange={(e) => setEditPartyForm({ ...editPartyForm, name: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Destination (City) *</label>
                          <input
                            type="text"
                            required
                            value={editPartyForm.city || ''}
                            onChange={(e) => setEditPartyForm({ ...editPartyForm, city: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-semibold uppercase"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">State *</label>
                          <input
                            type="text"
                            required
                            value={editPartyForm.state || ''}
                            onChange={(e) => setEditPartyForm({ ...editPartyForm, state: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-semibold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Pin Code *</label>
                          <input
                            type="text"
                            value={editPartyForm.pincode || ''}
                            onChange={(e) => setEditPartyForm({ ...editPartyForm, pincode: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-mono"
                            placeholder="e.g. 501401"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="sm:col-span-2">
                          <label className="font-bold text-slate-700 block mb-1">Customer Address (Billing / Delivery) *</label>
                          <input
                            type="text"
                            value={editPartyForm.address}
                            onChange={(e) => setEditPartyForm({ ...editPartyForm, address: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">GSTIN / UIN</label>
                          <input
                            type="text"
                            value={editPartyForm.gstin}
                            onChange={(e) => setEditPartyForm({ ...editPartyForm, gstin: e.target.value.toUpperCase() })}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-mono uppercase"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPartyIndex(null);
                            setEditPartyForm(null);
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                        >
                          Save &amp; Update Customer Record
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Product Master Directory strictly filtered for active company */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
                      <Box className="w-4 h-4 text-blue-600" />
                      <span>Active Product Master Directory — {selectedCompany === 'HPL' ? 'AHPL (Abbott Healthcare)' : 'AIL (Abbott India)'} ({activeProducts.length})</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Isolated master catalog strictly for {selectedCompany === 'HPL' ? 'AHPL' : 'AIL'}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                          <th className="py-2.5 px-3">Company</th>
                          <th className="py-2.5 px-3">Product Description / Name</th>
                          <th className="py-2.5 px-3">HSN Code</th>
                          <th className="py-2.5 px-3 text-right">Selling Rate (₹)</th>
                          <th className="py-2.5 px-3">Pack Size &amp; Multiple</th>
                          <th className="py-2.5 px-3 text-right">Weight (kg)</th>
                          <th className="py-2.5 px-3 text-right">CFT</th>
                          <th className="py-2.5 px-3 text-right">Live Stock</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {activeProducts.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-6 text-center text-slate-400 italic">
                              No product records in {selectedCompany === 'HPL' ? 'AHPL' : 'AIL'} master. Click "+ Quick Add Product" or upload CSV above.
                            </td>
                          </tr>
                        ) : (
                          activeProducts.map((prod) => {
                            const stock = getProductStock(prod);
                            return (
                              <tr key={prod.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black font-mono border ${
                                    selectedCompany === 'HPL'
                                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                                      : 'bg-blue-50 text-blue-800 border-blue-200'
                                  }`}>
                                    {selectedCompany === 'HPL' ? 'AHPL' : 'AIL'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-900">{prod.name}</td>
                                <td className="py-2 px-3 font-mono text-slate-600">{prod.hsnCode || '39239090'}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-blue-700">₹{prod.price.toFixed(2)}</td>
                                <td className="py-2 px-3 text-slate-600">{prod.packSize} (×{prod.packSizeMultiple})</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-700">{prod.weight}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-700">{prod.cft}</td>
                                <td className={`py-2 px-3 text-right font-mono font-extrabold ${
                                  stock > 0 ? 'text-emerald-700' : 'text-slate-400'
                                }`}>
                                  {stock} Pcs
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenEditProduct(prod)}
                                      className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                                      title="Edit product details & stock"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteProduct(prod.id)}
                                      className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition cursor-pointer"
                                      title="Delete product from master"
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

                {/* Customer Master Directory with Location & Tax Status */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span>Active Customer Master Directory — {selectedCompany === 'HPL' ? 'AHPL (Abbott Healthcare)' : 'AIL (Abbott India)'} ({activeParties.length})</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Locations determine 0% Local GST vs. 18% Inter-State IGST
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                          <th className="py-2.5 px-3">Company</th>
                          <th className="py-2.5 px-3">Customer Name</th>
                          <th className="py-2.5 px-3">Destination (City)</th>
                          <th className="py-2.5 px-3">State</th>
                          <th className="py-2.5 px-3">Pin Code</th>
                          <th className="py-2.5 px-3">Customer Address (Billing / Delivery)</th>
                          <th className="py-2.5 px-3">GSTIN / UIN</th>
                          <th className="py-2.5 px-3">Tax Rule</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {activeParties.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-6 text-center text-slate-400 italic">
                              No customer records in {selectedCompany === 'HPL' ? 'AHPL' : 'AIL'} master. Download sample CSV above or click "+ Quick Add Customer".
                            </td>
                          </tr>
                        ) : (
                          activeParties.map((p, idx) => {
                            const isInterState = isInterStateParty(p);
                            const displayPin = p.pincode || (p.address?.match(/\b([1-9][0-9]{5})\b/)?.[1] || '-');
                            return (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-2 px-3">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black font-mono border ${
                                    selectedCompany === 'HPL'
                                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                                      : 'bg-blue-50 text-blue-800 border-blue-200'
                                  }`}>
                                    {selectedCompany === 'HPL' ? 'AHPL' : 'AIL'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-900">{p.name}</td>
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  {p.city || '-'}
                                </td>
                                <td className="py-2 px-3 font-medium text-slate-700">
                                  {p.state || '-'}
                                </td>
                                <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                                  {displayPin}
                                </td>
                                <td className="py-2 px-3 text-slate-600 text-[11px] max-w-xs truncate" title={p.address}>
                                  {p.address}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-700 font-semibold">{p.gstin || '23UNREGISTERED'}</td>
                                <td className="py-2 px-3">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                    isInterState ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                  }`}>
                                    <span>{isInterState ? '🚚 18% IGST' : '📍 0% Local'}</span>
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => {
                                        setEditingPartyIndex(idx);
                                        setEditPartyForm({
                                          ...p,
                                          pincode: p.pincode || (p.address?.match(/\b([1-9][0-9]{5})\b/)?.[1] || '')
                                        });
                                      }}
                                      className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteParty(p.name)}
                                      className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition cursor-pointer"
                                      title="Delete customer from master"
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
              </div>
            ) : (
              <DataCleanupView
                products={products}
                setProducts={setProducts}
                parties={parties}
                setParties={setParties}
                transporters={transporters}
                setTransporters={setTransporters}
                clientDemands={clientDemands}
                setClientDemands={setClientDemands}
                inwards={inwards}
                setInwards={setInwards}
                invoices={invoices}
                setInvoices={setInvoices}
                invoiceSeqAIL={invoiceSeqAIL}
                setInvoiceSeqAIL={setInvoiceSeqAIL}
                invoiceSeqHPL={invoiceSeqHPL}
                setInvoiceSeqHPL={setInvoiceSeqHPL}
                challanSeqAIL={challanSeqAIL}
                setChallanSeqAIL={setChallanSeqAIL}
                challanSeqHPL={challanSeqHPL}
                setChallanSeqHPL={setChallanSeqHPL}
                invoiceAudits={invoiceAudits}
                setInvoiceAudits={setInvoiceAudits}
                persistStorage={persistStorage}
              />
            )}
          </div>
        )}
      </div>

      {/* Standalone A4 Tax Invoice Modal Overlay Preview */}
      {modalPreviewInvoice && (
        <TaxInvoiceModalOverlay
          invoice={modalPreviewInvoice}
          isOpen={!!modalPreviewInvoice}
          onClose={() => setModalPreviewInvoice(null)}
        />
      )}

      {/* ========================================================
          NEW INVOICE GENERATION SUCCESS CONFIRMATION POPUP / MODAL
          ======================================================== */}
      {createdInvoiceSuccess && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header with Green Gradient */}
            <div className="bg-linear-to-r from-emerald-600 to-teal-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-white">
                    Invoice Generated Successfully!
                  </h3>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    Stock deducted via FIFO and monthly quota updated
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreatedInvoiceSuccess(null)}
                className="w-8 h-8 rounded-lg bg-black/10 hover:bg-black/20 text-white/80 hover:text-white flex items-center justify-center transition cursor-pointer text-sm font-bold"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Highlight Box for newly generated Invoice Number */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-center space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                  Newly Generated Invoice Number
                </span>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-emerald-300 rounded-lg shadow-2xs">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span className="font-mono text-xl font-black text-emerald-950 tracking-wide">
                    {createdInvoiceSuccess.invNo}
                  </span>
                </div>
                <div className="pt-0.5">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    createdInvoiceSuccess.isInterState
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {createdInvoiceSuccess.isInterState ? 'TAX INVOICE (STOCK TRANSFER NOTE)' : 'DELIVERY CHALLAN (0% GST)'}
                  </span>
                </div>
              </div>

              {/* Invoice Summary Details Card */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-start pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Sold To Party:</span>
                  <span className="font-extrabold text-slate-900 text-right max-w-[240px] truncate" title={createdInvoiceSuccess.partyName}>
                    {createdInvoiceSuccess.partyName}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Destination / Place of Supply:</span>
                  <span className="font-bold text-slate-900">
                    {createdInvoiceSuccess.partyCity ? createdInvoiceSuccess.partyCity.toUpperCase() : 'INDORE'} ({createdInvoiceSuccess.partyState || 'Madhya Pradesh'})
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Invoice Date:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formatDateDDMMYYYY(createdInvoiceSuccess.date)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Total Cases & Units:</span>
                  <span className="font-bold text-indigo-900">
                    {createdInvoiceSuccess.totalCases} Cases ({createdInvoiceSuccess.totalQty} Pcs)
                  </span>
                </div>
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-700 font-bold">Grand Total Value:</span>
                  <span className="font-mono text-sm font-black text-emerald-700">
                    ₹{createdInvoiceSuccess.grandTotal}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const inv = createdInvoiceSuccess;
                    setCreatedInvoiceSuccess(null);
                    setSelectedPreviewInv(inv.invNo);
                    setModalPreviewInvoice(inv);
                    setActiveTab('previewPrintTab');
                  }}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
                >
                  <FileText className="w-4 h-4 text-amber-300" />
                  <span>📄 View Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const inv = createdInvoiceSuccess;
                    setCreatedInvoiceSuccess(null);
                    setSelectedPreviewInv(inv.invNo);
                    setModalPreviewInvoice(inv);
                    setActiveTab('previewPrintTab');
                    setTimeout(() => {
                      window.print();
                    }, 400);
                  }}
                  className="flex-1 py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4 text-purple-200" />
                  <span>🖨️ Print Invoice</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCreatedInvoiceSuccess(null);
                    handleOpenNewOutwardInvoice();
                  }}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>➕ New Outward</span>
                </button>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setCreatedInvoiceSuccess(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer underline"
                >
                  Close Notification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Traceability & History Drill-down Modal */}
      {historyProduct && (
        <ProductHistoryModal
          product={historyProduct}
          inwards={inwards}
          invoices={invoices}
          pendingStockQueue={pendingStockQueue}
          audits={invoiceAudits}
          onClose={() => setHistoryProduct(null)}
          onPreviewInvoice={(invNo) => {
            setSelectedPreviewInv(invNo);
            const inv = invoices.find(i => i.invNo === invNo);
            if (inv) setModalPreviewInvoice(inv);
            setActiveTab('previewPrintTab');
          }}
          onLogWriteOff={handleLogWriteOff}
        />
      )}

      {/* Security PIN-Protected Invoice Cancellation Modal */}
      {pinModalInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                    PIN-Protected Invoice Cancellation
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Authorized Security Check Required
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPinModalInvoice(null);
                  setCancelPinInput('');
                  setCancelPinError('');
                }}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoice & Division Context Card */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Invoice Number:</span>
                <span className="font-mono font-black text-blue-700 text-sm">{pinModalInvoice.invNo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Entity / Company Division:</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-black font-mono border ${
                  getInvoiceCompany(pinModalInvoice) === 'HPL'
                    ? 'bg-purple-100 text-purple-900 border-purple-300'
                    : 'bg-blue-100 text-blue-900 border-blue-300'
                }`}>
                  {getInvoiceCompany(pinModalInvoice) === 'HPL' ? 'AHPL (Abbott Healthcare)' : 'AIL (Abbott India)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Customer:</span>
                <span className="font-bold text-slate-900 truncate max-w-[200px]">{pinModalInvoice.partyName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Grand Total Value:</span>
                <span className="font-mono font-extrabold text-emerald-700">₹{pinModalInvoice.grandTotal}</span>
              </div>
            </div>

            {/* Security PIN Entry Field */}
            <div className="space-y-2 text-xs">
              <label className="font-extrabold text-slate-800 block flex items-center justify-between">
                <span>Enter 4-Digit Security PIN *</span>
                <span className="text-[10px] text-blue-600 font-mono font-bold">
                  ({getInvoiceCompany(pinModalInvoice) === 'HPL' ? 'AHPL PIN: 1301' : 'AIL PIN: 7308'})
                </span>
              </label>
              <input
                type="password"
                maxLength={6}
                autoFocus
                placeholder="••••"
                value={cancelPinInput}
                onChange={(e) => {
                  setCancelPinInput(e.target.value);
                  setCancelPinError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmPinCancellation();
                  }
                }}
                className="w-full text-center text-xl tracking-[0.5em] font-mono font-black border border-slate-300 bg-slate-50 focus:bg-white focus:border-red-500 rounded-xl py-2.5 outline-none text-slate-900 transition"
              />
              {cancelPinError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{cancelPinError}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPinModalInvoice(null);
                  setCancelPinInput('');
                  setCancelPinError('');
                }}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Abort / Keep Invoice
              </button>
              <button
                type="button"
                onClick={handleConfirmPinCancellation}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-extrabold cursor-pointer transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Confirm PIN Cancellation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Delete PIN Verification Modal */}
      {activeDeleteModal && (
        <DeletePinModal
          isOpen={!!activeDeleteModal}
          title={activeDeleteModal.title}
          itemDescription={activeDeleteModal.itemDescription}
          company={activeDeleteModal.company}
          onConfirm={activeDeleteModal.action}
          onClose={() => setActiveDeleteModal(null)}
        />
      )}
    </div>
  );
};
