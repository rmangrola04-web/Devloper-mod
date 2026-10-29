import React, { useState, useMemo, useRef } from 'react';
import { 
  ClipboardList, 
  MapPin, 
  Plus, 
  Truck, 
  Box, 
  Scale, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Search, 
  Trash2, 
  Edit3, 
  Edit2,
  ArrowRight, 
  FileText, 
  Building2, 
  ShieldCheck, 
  RotateCcw,
  Sparkles,
  Info,
  Calendar,
  Check,
  ChevronRight,
  Send,
  Eye,
  Download,
  Upload,
  FileSpreadsheet,
  X
} from 'lucide-react';
import { 
  ThermocolProduct, 
  ThermocolParty, 
  ThermocolTransporter, 
  ClientDemand, 
  ThermocolInward, 
  ThermocolInvoice, 
  DispatchPickList, 
  PickListItem, 
  PickListStatus,
  SenderConfig
} from './types';
import { 
  CompanyType, 
  normalizeCompany, 
  formatDateDDMMYYYY, 
  sanitizePartyRecord,
  DEFAULT_SENDER,
  DEFAULT_HPL_SENDER
} from './utils';
import { PickListDocModal, downloadPickListHtmlHelper } from './PickListDocModal';
import { saveThermocolPickListToFirestore, deleteThermocolPickListFromFirestore } from '../../services/firestoreService';

interface DispatchPickListViewProps {
  products: ThermocolProduct[];
  parties: ThermocolParty[];
  transporters: ThermocolTransporter[];
  clientDemands: ClientDemand[];
  inwards: ThermocolInward[];
  invoices: ThermocolInvoice[];
  pickLists: DispatchPickList[];
  company?: CompanyType;
  sender?: SenderConfig;
  onSavePickList: (pickList: DispatchPickList) => void;
  onUpdatePickListStatus: (id: string, status: PickListStatus, loadedItems?: PickListItem[]) => void;
  onDeletePickList: (id: string) => void;
  onGenerateInvoiceFromPickList: (pickList: DispatchPickList) => void;
  onRequestDeletePin: (title: string, itemDesc: string, company: CompanyType, action: () => void) => void;
  onUpdateDemand?: (partyName: string, productName: string, newLimit: number) => void;
  onUploadDemandCsv?: (file: File) => void;
  onDownloadSampleDemandCsv?: () => void;
}

export const DispatchPickListView: React.FC<DispatchPickListViewProps> = ({
  products,
  parties,
  transporters,
  clientDemands,
  inwards,
  invoices,
  pickLists,
  company = 'AIL',
  sender,
  onSavePickList,
  onUpdatePickListStatus,
  onDeletePickList,
  onGenerateInvoiceFromPickList,
  onRequestDeletePin,
  onUpdateDemand,
  onUploadDemandCsv,
  onDownloadSampleDemandCsv
}) => {
  const targetCompany: CompanyType = normalizeCompany(company);

  // Active Tab: 'createPlanning' vs 'pickListQueue'
  const [activeSubTab, setActiveSubTab] = useState<'createPlanning' | 'pickListQueue'>('createPlanning');

  // Filter Company Master Data with resilient fallbacks
  const companyParties = useMemo(() => {
    const filtered = (parties || []).filter(p => !p.company || normalizeCompany(p.company) === targetCompany);
    return filtered.length > 0 ? filtered : (parties || []);
  }, [parties, targetCompany]);

  const companyProducts = useMemo(() => {
    const filtered = (products || []).filter(p => !p.company || normalizeCompany(p.company) === targetCompany);
    return filtered.length > 0 ? filtered : (products || []);
  }, [products, targetCompany]);

  const companyInwards = useMemo(() => {
    const filtered = (inwards || []).filter(i => !i.company || normalizeCompany(i.company) === targetCompany);
    return filtered.length > 0 ? filtered : (inwards || []);
  }, [inwards, targetCompany]);

  const companyDemands = useMemo(() => {
    const filtered = (clientDemands || []).filter(d => !d.company || normalizeCompany(d.company) === targetCompany);
    return filtered.length > 0 ? filtered : (clientDemands || []);
  }, [clientDemands, targetCompany]);

  const companyTransporters = useMemo(() => {
    const filtered = (transporters || []).filter(t => !t.company || normalizeCompany(t.company) === targetCompany);
    return filtered.length > 0 ? filtered : (transporters || []);
  }, [transporters, targetCompany]);

  const companyPickLists = useMemo(() => {
    return (pickLists || []).filter(pl => !pl.company || normalizeCompany(pl.company) === targetCompany);
  }, [pickLists, targetCompany]);

  // Available Destination Cities from Customer Master
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    companyParties.forEach(p => {
      let city = p.city?.trim();
      if (!city && p.address) {
        const addr = p.address.toLowerCase();
        if (addr.includes('indore')) city = 'Indore';
        else if (addr.includes('dewas')) city = 'Dewas';
        else if (addr.includes('pithampur')) city = 'Pithampur';
        else if (addr.includes('sanwer')) city = 'Sanwer';
        else if (addr.includes('bhopal')) city = 'Bhopal';
        else if (addr.includes('pune')) city = 'Pune';
        else if (addr.includes('mumbai')) city = 'Mumbai';
        else if (addr.includes('ahmedabad')) city = 'Ahmedabad';
      }
      if (city) set.add(city);
    });
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return ['ALL', ...sorted];
  }, [companyParties]);

  // Planning Form State
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [planningDate, setPlanningDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [assignedTransporter, setAssignedTransporter] = useState<string>('');
  const [assignedVehicleNo, setAssignedVehicleNo] = useState<string>('');
  const [assignedDriverName, setAssignedDriverName] = useState<string>('');
  const [planningRemarks, setPlanningRemarks] = useState<string>('');

  // Draft Planned Quantities state per line: key = `${partyName}_${productName}`
  const [plannedCasesMap, setPlannedCasesMap] = useState<Record<string, number>>({});

  // Demand editing modal / inline state
  const [editDemandTarget, setEditDemandTarget] = useState<{
    partyName: string;
    productName: string;
    currentDemand: number;
  } | null>(null);
  const [newDemandValue, setNewDemandValue] = useState<string>('');

  // Quick Add / Update Demand Modal state
  const [showAddDemandModal, setShowAddDemandModal] = useState<boolean>(false);
  const [addDemandParty, setAddDemandParty] = useState<string>('');
  const [addDemandProduct, setAddDemandProduct] = useState<string>('');
  const [addDemandQty, setAddDemandQty] = useState<string>('');

  // CSV File Input Reference
  const csvDemandFileRef = useRef<HTMLInputElement>(null);

  // Helper: Live Available Stock per product (MRP-wise aggregated)
  const getProductStock = (prodName: string): number => {
    return companyInwards
      .filter(i => i.productName === prodName)
      .reduce((sum, i) => sum + (Number(i.availableQty) || 0), 0);
  };

  // Sourced Demand Rows for Selected City / ALL
  const cityPlanningRows = useMemo(() => {
    const isAll = !selectedCity || selectedCity === 'ALL';
    const targetCityLower = (selectedCity || '').trim().toLowerCase();
    
    // Find parties in this city or ALL
    const cityParties = isAll
      ? companyParties
      : companyParties.filter(p => {
          if (p.city && p.city.trim().toLowerCase() === targetCityLower) return true;
          if (p.address && p.address.toLowerCase().includes(targetCityLower)) return true;
          return false;
        });

    // Also include any partyName present in companyDemands if isAll
    const partyMap = new Map<string, ThermocolParty>();
    cityParties.forEach(p => partyMap.set(p.name.trim().toLowerCase(), p));

    if (isAll) {
      companyDemands.forEach(d => {
        if (d.partyName && !partyMap.has(d.partyName.trim().toLowerCase())) {
          partyMap.set(d.partyName.trim().toLowerCase(), {
            name: d.partyName,
            company: targetCompany,
            address: 'Industrial Area',
            gstin: '23UNREGISTERED',
            city: 'Indore'
          });
        }
      });
    }

    const targetPartiesList = Array.from(partyMap.values());

    // Calculate historical dispatches for non-cancelled invoices
    const dispatchedMap = new Map<string, number>(); // key: `${partyName}_${productName}` -> qty
    invoices.forEach(inv => {
      if (!inv.isCancelled && normalizeCompany(inv.company) === targetCompany) {
        const pName = inv.partyName;
        inv.items?.forEach(it => {
          if (it.productName) {
            const key = `${pName.trim().toLowerCase()}_${it.productName.trim().toLowerCase()}`;
            dispatchedMap.set(key, (dispatchedMap.get(key) || 0) + (Number(it.qty) || 0));
          }
        });
      }
    });

    const result: Array<{
      partyName: string;
      productId: string;
      productName: string;
      packSize: string;
      packSizeMultiple: number;
      totalDemand: number;
      alreadyDispatched: number;
      pendingDemand: number;
      availableStock: number;
      mrp: number;
      weightUnit: number;
      cftUnit: number;
      key: string;
    }> = [];

    targetPartiesList.forEach(party => {
      // Find client demands for this party
      const partyDemands = companyDemands.filter(
        d => d.partyName.trim().toLowerCase() === party.name.trim().toLowerCase()
      );

      // Collect all company products so user can punch pre-planned quantities for any SKU
      const targetProds = companyProducts.length > 0 ? companyProducts : (products || []);

      targetProds.forEach(prod => {
        const demandObj = partyDemands.find(d => d.productName.trim().toLowerCase() === prod.name.trim().toLowerCase());
        const totalDemand = demandObj ? demandObj.monthlyLimit : 0;

        const dispKey = `${party.name.trim().toLowerCase()}_${prod.name.trim().toLowerCase()}`;
        const alreadyDispatched = dispatchedMap.get(dispKey) || 0;
        const pendingDemand = Math.max(0, totalDemand - alreadyDispatched);
        const availableStock = getProductStock(prod.name);

        result.push({
          partyName: party.name,
          productId: prod.id,
          productName: prod.name,
          packSize: prod.packSize || 'Standard Box',
          packSizeMultiple: prod.packSizeMultiple || 1,
          totalDemand,
          alreadyDispatched,
          pendingDemand,
          availableStock,
          mrp: prod.price || 15,
          weightUnit: prod.weight || 0.15,
          cftUnit: prod.cft || 0.02,
          key: `${party.name}_${prod.name}`
        });
      });
    });

    return result;
  }, [selectedCity, companyParties, companyDemands, companyProducts, invoices, companyInwards, targetCompany]);

  // Quick Search & Real-Time Filter for Active Client Demand Matrix
  const [matrixSearchQuery, setMatrixSearchQuery] = useState<string>('');

  const filteredPlanningRows = useMemo(() => {
    if (!matrixSearchQuery.trim()) return cityPlanningRows;
    const q = matrixSearchQuery.trim().toLowerCase();
    return cityPlanningRows.filter(row => 
      row.partyName.toLowerCase().includes(q) ||
      row.productName.toLowerCase().includes(q) ||
      (row.packSize && row.packSize.toLowerCase().includes(q))
    );
  }, [cityPlanningRows, matrixSearchQuery]);

  // Handle quantity change in cases
  const handleCaseChange = (key: string, casesVal: string) => {
    const cases = Math.max(0, parseInt(casesVal, 10) || 0);
    setPlannedCasesMap(prev => ({
      ...prev,
      [key]: cases
    }));
  };

  // Calculate live plan summary metrics
  const planCalculations = useMemo(() => {
    let totalPlannedCases = 0;
    let totalPlannedQty = 0;
    let totalWeightKg = 0;
    let totalCft = 0;
    const activeItemsCount = Object.values(plannedCasesMap).filter(v => v > 0).length;

    cityPlanningRows.forEach(row => {
      const cases = plannedCasesMap[row.key] || 0;
      if (cases > 0) {
        const qty = cases * row.packSizeMultiple;
        totalPlannedCases += cases;
        totalPlannedQty += qty;
        totalWeightKg += qty * row.weightUnit;
        totalCft += qty * row.cftUnit;
      }
    });

    return {
      activeItemsCount,
      totalPlannedCases,
      totalPlannedQty,
      totalWeightKg: Number(totalWeightKg.toFixed(2)),
      totalCft: Number(totalCft.toFixed(2))
    };
  }, [plannedCasesMap, cityPlanningRows]);

  // Notification state
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Submit and Save Pre-Planned Pick List directly to Firebase Real-Time Cloud
  const handleCreatePickList = async () => {
    if (planCalculations.totalPlannedQty <= 0) {
      setStatusMsg({ text: 'Please enter a positive planned quantity for at least one item before generating a pick list.', isError: true });
      return;
    }

    const items: PickListItem[] = [];
    cityPlanningRows.forEach(row => {
      const cases = plannedCasesMap[row.key] || 0;
      if (cases > 0) {
        const qty = cases * row.packSizeMultiple;
        items.push({
          id: 'pli_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          partyName: row.partyName,
          productId: row.productId,
          productName: row.productName,
          hsnCode: '39239090',
          packSize: row.packSize,
          packSizeMultiple: row.packSizeMultiple,
          totalDemand: row.totalDemand,
          alreadyDispatched: row.alreadyDispatched,
          pendingDemand: row.pendingDemand,
          availableStock: row.availableStock,
          plannedCases: cases,
          plannedQty: qty,
          weight: Number((qty * row.weightUnit).toFixed(2)),
          cft: Number((qty * row.cftUnit).toFixed(2)),
          mrp: row.mrp,
          batch: 'DEFAULT'
        });
      }
    });

    const cityShort = (selectedCity === 'ALL' ? 'ALL' : selectedCity.substring(0, 3)).toUpperCase();
    const plCount = companyPickLists.length + 1;
    const pickListNo = `PL-${targetCompany === 'HPL' ? 'AHPL' : 'AIL'}-${cityShort}-${String(plCount).padStart(3, '0')}`;

    const newPickList: DispatchPickList = {
      id: 'pl_' + Date.now(),
      pickListNo,
      company: targetCompany,
      city: selectedCity === 'ALL' ? 'Multi-City / ALL' : selectedCity,
      date: planningDate,
      status: 'PLANNED',
      transporterName: assignedTransporter || 'Direct Dispatch',
      vehicleNo: assignedVehicleNo || 'TBD',
      driverName: assignedDriverName || '',
      totalPlannedQty: planCalculations.totalPlannedQty,
      totalLoadedQty: 0,
      totalWeightKg: planCalculations.totalWeightKg,
      totalCft: planCalculations.totalCft,
      items,
      createdAt: new Date().toISOString(),
      remarks: planningRemarks
    };

    try {
      await saveThermocolPickListToFirestore(newPickList);
      await onSavePickList(newPickList);
      console.log(`[Firebase Success] Direct write for Pick List ${pickListNo} executed successfully!`);
      setStatusMsg({ text: `Pre-Planned Pick List ${pickListNo} generated & saved directly to cloud successfully!`, isError: false });
      setPlannedCasesMap({});
      setPlanningRemarks('');
      setActiveSubTab('pickListQueue');
    } catch (err: any) {
      console.error('Error saving pick list directly to Firebase:', err);
      setStatusMsg({ text: `Failed to save Pick List ${pickListNo} to Firebase: ${err?.message || 'Permission or network error'}`, isError: true });
    }
  };

  // Handle single demand save
  const handleSaveEditDemand = () => {
    if (!editDemandTarget || !onUpdateDemand) return;
    const newLim = Math.max(0, parseInt(newDemandValue, 10) || 0);
    onUpdateDemand(editDemandTarget.partyName, editDemandTarget.productName, newLim);
    setEditDemandTarget(null);
    setNewDemandValue('');
    setStatusMsg({ text: `Updated Total Demand Qty to ${newLim} pcs for ${editDemandTarget.partyName} (${editDemandTarget.productName})`, isError: false });
  };

  // Handle Quick Add / Update Demand Modal
  const handleSaveQuickAddDemand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addDemandParty || !addDemandProduct || !onUpdateDemand) return;
    const lim = Math.max(0, parseInt(addDemandQty, 10) || 0);
    onUpdateDemand(addDemandParty.trim(), addDemandProduct.trim(), lim);
    setShowAddDemandModal(false);
    setAddDemandParty('');
    setAddDemandProduct('');
    setAddDemandQty('');
    setStatusMsg({ text: `Added/Updated demand limit of ${lim} pcs for ${addDemandParty} (${addDemandProduct})`, isError: false });
  };

  // Handle Demand CSV Upload Event
  const handleCsvDemandFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadDemandCsv) {
      onUploadDemandCsv(file);
      if (csvDemandFileRef.current) csvDemandFileRef.current.value = '';
    }
  };

  // Preview Document Modal state
  const [docModalPickList, setDocModalPickList] = useState<DispatchPickList | null>(null);

  // Go-Down Loaded Quantity Verification Modal State
  const [verifyingPickList, setVerifyingPickList] = useState<DispatchPickList | null>(null);
  const [loadedInputs, setLoadedInputs] = useState<Record<string, number>>({});

  const handleOpenVerification = (pl: DispatchPickList) => {
    setVerifyingPickList(pl);
    const initialMap: Record<string, number> = {};
    pl.items.forEach(it => {
      initialMap[it.id] = it.loadedQty !== undefined ? it.loadedQty : it.plannedQty;
    });
    setLoadedInputs(initialMap);
  };

  const handleSaveGoDownLoading = () => {
    if (!verifyingPickList) return;

    const updatedItems = verifyingPickList.items.map(it => {
      const loadedQ = loadedInputs[it.id] !== undefined ? loadedInputs[it.id] : it.plannedQty;
      const mult = it.packSizeMultiple || 1;
      const loadedC = mult > 0 ? Math.ceil(loadedQ / mult) : 0;
      return {
        ...it,
        loadedQty: loadedQ,
        loadedCases: loadedC
      };
    });

    onUpdatePickListStatus(verifyingPickList.id, 'LOADED_VERIFIED', updatedItems);
    setVerifyingPickList(null);
    setStatusMsg({ text: `Pick List ${verifyingPickList.pickListNo} verified and loaded quantities recorded!`, isError: false });
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600/30 rounded-xl text-blue-400 border border-blue-500/30">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                Dispatch Pre-Planning & Pick List Engine
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {targetCompany === 'HPL' ? 'AHPL Entity' : 'AIL Entity'}
                </span>
              </h1>
              <p className="text-xs text-slate-300">
                City-wise demand aggregation, dynamic pending demand calculation, total CFT/Weight pre-allocation & verified pick lists
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60">
          <button
            onClick={() => setActiveSubTab('createPlanning')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'createPlanning'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Plus className="w-4 h-4" />
            Create Pre-Planned Dispatch
          </button>
          <button
            onClick={() => setActiveSubTab('pickListQueue')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'pickListQueue'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            Pick List Queue ({companyPickLists.length})
          </button>
        </div>
      </div>

      {/* Alert / Notification Feedback */}
      {statusMsg && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold ${
          statusMsg.isError ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center space-x-2">
            {statusMsg.isError ? <AlertCircle className="w-4 h-4 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* SUB-TAB 1: CREATE PRE-PLANNED DISPATCH */}
      {activeSubTab === 'createPlanning' && (
        <div className="space-y-6">
          
          {/* Controls Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Select Destination City & Dispatch Schedule Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Destination City / Hub *
                </label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  {availableCities.map(city => (
                    <option key={city} value={city}>
                      {city === 'ALL' ? '🌐 ALL Cities & Destinations' : city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Planning Date *
                </label>
                <input
                  type="date"
                  value={planningDate}
                  onChange={(e) => setPlanningDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assigned Transporter
                </label>
                <select
                  value={assignedTransporter}
                  onChange={(e) => setAssignedTransporter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Direct Loading / Unassigned --</option>
                  {companyTransporters.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. MP09-AB-1234"
                  value={assignedVehicleNo}
                  onChange={(e) => setAssignedVehicleNo(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sticky Summary Bar with Weight & CFT (Locks at top when scrolling down) */}
          <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md text-white p-3.5 px-5 rounded-2xl shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 transition-all">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-blue-600/30 rounded-xl text-blue-400 border border-blue-500/30 shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-extrabold text-slate-400 block tracking-wider">
                  Live Pre-Planned Summary Totals
                </span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono pt-0.5">
                  <span>Active SKUs: <strong className="text-blue-300 font-bold">{planCalculations.activeItemsCount}</strong></span>
                  <span>Cases: <strong className="text-white font-bold">{planCalculations.totalPlannedCases} cs</strong></span>
                  <span>Planned Qty: <strong className="text-indigo-300 font-bold">{planCalculations.totalPlannedQty} pcs</strong></span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 font-bold">
                    Est. Weight: <strong>{planCalculations.totalWeightKg} kg</strong>
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 font-bold">
                    Est. Volume: <strong>{planCalculations.totalCft} CFT</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {planCalculations.totalPlannedQty > 0 && (
                <button
                  type="button"
                  onClick={() => setPlannedCasesMap({})}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-slate-700"
                  title="Reset all planned case quantities to 0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleCreatePickList}
                disabled={planCalculations.totalPlannedQty <= 0}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg ${
                  planCalculations.totalPlannedQty > 0 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30 active:scale-95' 
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Generate Pick List ({planCalculations.totalPlannedQty} pcs)</span>
              </button>
            </div>
          </div>

          {/* Planning Matrix Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Box className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider">
                  Active Client Demand Matrix {selectedCity !== 'ALL' && <span>for <span className="text-blue-300">{selectedCity}</span></span>}
                </h3>
              </div>

              {/* Demand Quick Actions Bar */}
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  ref={csvDemandFileRef}
                  accept=".csv"
                  onChange={handleCsvDemandFileChange}
                  className="hidden"
                />

                {onDownloadSampleDemandCsv && (
                  <button
                    type="button"
                    onClick={onDownloadSampleDemandCsv}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Download sample CSV format: Customer_Name, SKU_Description, Total_Demand_Qty"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    <span>Sample CSV</span>
                  </button>
                )}

                {onUploadDemandCsv && (
                  <button
                    type="button"
                    onClick={() => csvDemandFileRef.current?.click()}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                    title="Upload demands CSV with columns: Customer_Name, SKU_Description, Total_Demand_Qty"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Demands CSV</span>
                  </button>
                )}

                {onUpdateDemand && (
                  <button
                    type="button"
                    onClick={() => setShowAddDemandModal(true)}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Set Demand</span>
                  </button>
                )}

                <span className="text-[11px] text-slate-300 font-mono pl-2 border-l border-slate-700">
                  {cityPlanningRows.length} Requirements
                </span>
              </div>
            </div>

            {/* Quick Search & Real-Time Filter Option */}
            <div className="p-3 bg-slate-800 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Quick search by Customer Name, Product / SKU Description, or Pack Size..."
                  value={matrixSearchQuery}
                  onChange={(e) => setMatrixSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:bg-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                {matrixSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMatrixSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition cursor-pointer"
                    title="Clear Search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="text-[11px] text-slate-300 font-mono flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-1 bg-slate-900 rounded-lg border border-slate-700">
                  Showing <strong>{filteredPlanningRows.length}</strong> of <strong>{cityPlanningRows.length}</strong> Requirements
                </span>
              </div>
            </div>

            {cityPlanningRows.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Info className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-600">
                  No registered clients or active inventory demands found for destination city "{selectedCity}".
                </p>
                <p className="text-[11px] text-slate-400">
                  Select a different city or click "+ Set Demand" above to define total demand limits.
                </p>
              </div>
            ) : filteredPlanningRows.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Search className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-600">
                  No requirements found matching "{matrixSearchQuery}".
                </p>
                <button
                  type="button"
                  onClick={() => setMatrixSearchQuery('')}
                  className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  Clear search filter
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4 min-w-[150px]">Customer / Party Name</th>
                      <th className="py-3 px-4 min-w-[160px]">Product / SKU Description</th>
                      <th className="py-3 px-4 text-center min-w-[120px]">Total Demand</th>
                      <th className="py-3 px-4 text-center min-w-[110px]">Already Dispatched</th>
                      <th className="py-3 px-4 text-center min-w-[120px] bg-amber-50/80 text-amber-950 font-black">
                        Pending Demand <span className="block text-[9px] font-normal text-amber-800">(Demand - Dispatched)</span>
                      </th>
                      <th className="py-3 px-4 text-center min-w-[120px] bg-emerald-50 text-emerald-900">Available Stock</th>
                      <th className="py-3 px-4 text-right min-w-[130px] bg-blue-50 text-blue-900">Planned Cases</th>
                      <th className="py-3 px-4 text-right min-w-[110px]">Planned Qty</th>
                      <th className="py-3 px-4 text-right min-w-[120px]">Est. Weight / Vol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                    {filteredPlanningRows.map((row) => {
                      const cases = plannedCasesMap[row.key] || 0;
                      const plannedQty = cases * row.packSizeMultiple;
                      const estWeight = (plannedQty * row.weightUnit).toFixed(1);
                      const estCft = (plannedQty * row.cftUnit).toFixed(1);

                      return (
                        <tr key={row.key} className={cases > 0 ? 'bg-blue-50/50' : 'hover:bg-slate-50'}>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {row.partyName}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{row.productName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">Pack: {row.packSize}</div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-700">
                            <div className="flex items-center justify-center space-x-1">
                              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold">
                                {row.totalDemand > 0 ? `${row.totalDemand} pcs` : 'NO LIMIT'}
                              </span>
                              {onUpdateDemand && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditDemandTarget({
                                      partyName: row.partyName,
                                      productName: row.productName,
                                      currentDemand: row.totalDemand
                                    });
                                    setNewDemandValue(String(row.totalDemand));
                                  }}
                                  className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition cursor-pointer"
                                  title="Edit Total Demand Quantity"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-blue-800">
                            <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 font-semibold">
                              {row.alreadyDispatched} pcs
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-black text-amber-900 bg-amber-50/40">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-black border ${
                              row.totalDemand === 0 
                                ? 'bg-slate-100 text-slate-600 border-slate-200' 
                                : row.pendingDemand > 0
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}>
                              {row.totalDemand > 0 ? `${row.pendingDemand} pcs` : '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-black text-emerald-900 bg-emerald-50/40">
                            <span className={`px-2 py-0.5 rounded ${
                              row.availableStock > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {row.availableStock} pcs
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right bg-blue-50/40">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={cases || ''}
                              onChange={(e) => handleCaseChange(row.key, e.target.value)}
                              className="w-20 text-right bg-white border border-blue-300 rounded px-2 py-1 font-mono font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <span className="text-[10px] text-slate-500 ml-1 font-mono">cs</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-blue-950">
                            {plannedQty > 0 ? `${plannedQty} pcs` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            {plannedQty > 0 ? `${estWeight}kg / ${estCft}cft` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Summary & Generation Footer */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-6 border border-slate-800">
            <div className="flex items-center space-x-6">
              <div className="p-3 bg-blue-600/30 rounded-xl text-blue-400 border border-blue-500/30">
                <Scale className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Pre-Planned Schedule Estimates
                </span>
                <div className="flex items-center space-x-6 pt-1 font-mono text-sm">
                  <div>
                    <span className="text-slate-400 text-xs">SKUs: </span>
                    <span className="font-extrabold text-blue-300">{planCalculations.activeItemsCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Cases: </span>
                    <span className="font-extrabold text-white">{planCalculations.totalPlannedCases}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Qty: </span>
                    <span className="font-extrabold text-emerald-300">{planCalculations.totalPlannedQty} pcs</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Weight: </span>
                    <span className="font-extrabold text-amber-300">{planCalculations.totalWeightKg} kg</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Volume: </span>
                    <span className="font-extrabold text-blue-200">{planCalculations.totalCft} CFT</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleCreatePickList}
              disabled={planCalculations.totalPlannedQty <= 0}
              className={`px-6 py-3 rounded-xl font-extrabold text-xs transition flex items-center gap-2 cursor-pointer shadow-lg ${
                planCalculations.totalPlannedQty > 0
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
              Generate & Save Pick List
            </button>
          </div>

        </div>
      )}

      {/* SUB-TAB 2: PICK LIST QUEUE & GO-DOWN HANDOVER */}
      {activeSubTab === 'pickListQueue' && (
        <div className="space-y-6">
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider">
                  Pre-Planned Pick Lists & Go-Down Handover Queue
                </h3>
              </div>
              <span className="text-[11px] text-slate-300 font-mono">
                {companyPickLists.length} Pick Lists on File
              </span>
            </div>

            {companyPickLists.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <ClipboardList className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-600">
                  No pre-planned pick lists found for {targetCompany === 'HPL' ? 'AHPL' : 'AIL'}.
                </p>
                <p className="text-[11px] text-slate-400">
                  Switch to "Create Pre-Planned Dispatch" tab to generate a new pick list schedule.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">Pick List No</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">City / Destination</th>
                      <th className="py-3 px-4">Transporter & Vehicle</th>
                      <th className="py-3 px-4 text-right">Planned Qty</th>
                      <th className="py-3 px-4 text-right">Loaded Qty</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center min-w-[220px]">Go-Down & Invoice Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                    {companyPickLists.map((pl) => {
                      const totalLoaded = pl.items.reduce((s, i) => s + (i.loadedQty ?? i.plannedQty), 0);

                      return (
                        <tr key={pl.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {pl.pickListNo}
                            {pl.generatedInvoiceNo && (
                              <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                                <CheckCircle2 className="w-3 h-3" />
                                Inv: {pl.generatedInvoiceNo}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-mono">
                            {pl.date}
                          </td>
                          <td className="py-3 px-4 font-bold text-blue-900 uppercase">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-blue-600" />
                              {pl.city}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{pl.transporterName || 'Direct'}</div>
                            <div className="text-[10px] font-mono text-slate-500">{pl.vehicleNo || 'TBD'}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-blue-900">
                            {pl.totalPlannedQty} pcs
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-emerald-900">
                            {pl.status === 'LOADED_VERIFIED' || pl.status === 'INVOICED' ? `${totalLoaded} pcs` : '[ Pending ]'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              pl.status === 'INVOICED'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : pl.status === 'LOADED_VERIFIED'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {pl.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              
                              {/* Download HTML Button */}
                              <button
                                onClick={() => downloadPickListHtmlHelper(pl, sender)}
                                title="Download Standalone HTML Document"
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition cursor-pointer border border-blue-200 flex items-center gap-1 text-[11px] font-bold"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">HTML</span>
                              </button>

                              {/* Print Pick List Button */}
                              <button
                                onClick={() => setDocModalPickList(pl)}
                                title="Print Formal Pick List Document"
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Print</span>
                              </button>

                              {/* Go-Down Verify Loaded Quantities */}
                              {pl.status !== 'INVOICED' && (
                                <button
                                  onClick={() => handleOpenVerification(pl)}
                                  title="Update Actual Loaded Quantities from Go-Down"
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  Verify Loading
                                </button>
                              )}

                              {/* Generate Final Invoice */}
                              {pl.status !== 'INVOICED' && (
                                <button
                                  onClick={() => onGenerateInvoiceFromPickList(pl)}
                                  title="Generate Outward Invoice from Verified Pick List"
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Generate Invoice
                                </button>
                              )}

                              {/* PIN Protected Deletion */}
                              <button
                                onClick={() => {
                                  onRequestDeletePin(
                                    `Delete Pick List ${pl.pickListNo}`,
                                    `Pick List ${pl.pickListNo} (${pl.city})`,
                                    targetCompany,
                                    () => onDeletePickList(pl.id)
                                  );
                                }}
                                title="Delete Pick List (PIN Required)"
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>

                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Edit Single Demand Modal */}
      {editDemandTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                Update Customer Demand Limit
              </h3>
              <button
                onClick={() => setEditDemandTarget(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-bold block uppercase text-[10px]">Customer Name</span>
                <span className="font-extrabold text-slate-900">{editDemandTarget.partyName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block uppercase text-[10px]">Product Description</span>
                <span className="font-bold text-slate-800">{editDemandTarget.productName}</span>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">
                  Total Demand Quantity (Monthly Limit in Pcs) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={newDemandValue}
                  onChange={(e) => setNewDemandValue(e.target.value)}
                  placeholder="Enter total demand limit"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setEditDemandTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditDemand}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-extrabold text-xs cursor-pointer transition shadow-xs"
              >
                Save Updated Demand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add / Update Demand Modal */}
      {showAddDemandModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                Add / Set Customer Monthly Demand
              </h3>
              <button
                onClick={() => setShowAddDemandModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveQuickAddDemand} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Customer / Party *</label>
                <select
                  value={addDemandParty}
                  onChange={(e) => setAddDemandParty(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Select Customer --</option>
                  {companyParties.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Product / SKU *</label>
                <select
                  value={addDemandProduct}
                  onChange={(e) => setAddDemandProduct(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Select Product / SKU --</option>
                  {companyProducts.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Total Demand Quantity (Monthly Limit in Pcs) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 1500"
                  value={addDemandQty}
                  onChange={(e) => setAddDemandQty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddDemandModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-extrabold text-xs cursor-pointer transition shadow-xs"
                >
                  Save Demand Limit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Pick List Document Modal */}
      {docModalPickList && (
        <PickListDocModal
          pickList={docModalPickList}
          sender={sender}
          onClose={() => setDocModalPickList(null)}
        />
      )}

      {/* Go-Down Physical Loaded Quantities Verification Modal */}
      {verifyingPickList && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-600/30 rounded-lg text-blue-400">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold flex items-center gap-2">
                    Verify Go-Down Loaded Quantities
                    <span className="font-mono text-xs text-blue-300">({verifyingPickList.pickListNo})</span>
                  </h3>
                  <p className="text-xs text-slate-400">Update actual verified physical loaded counts before issuing invoice</p>
                </div>
              </div>
              <button
                onClick={() => setVerifyingPickList(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 uppercase text-slate-700 font-bold text-[10px]">
                    <th className="py-2 px-3">Party Name</th>
                    <th className="py-2 px-3">Product Description</th>
                    <th className="py-2 px-3 text-right">Planned Qty</th>
                    <th className="py-2 px-3 text-right min-w-[140px] bg-emerald-50 text-emerald-900">Actual Loaded Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {verifyingPickList.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3 font-bold text-slate-900">{it.partyName}</td>
                      <td className="py-2 px-3">{it.productName}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-blue-900">{it.plannedQty} pcs</td>
                      <td className="py-2 px-3 text-right bg-emerald-50/40">
                        <input
                          type="number"
                          min="0"
                          value={loadedInputs[it.id] !== undefined ? loadedInputs[it.id] : it.plannedQty}
                          onChange={(e) => setLoadedInputs({
                            ...loadedInputs,
                            [it.id]: Math.max(0, parseInt(e.target.value, 10) || 0)
                          })}
                          className="w-24 text-right bg-white border border-emerald-400 rounded px-2 py-1 font-mono font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500 ml-1 font-mono">pcs</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
              <button
                onClick={() => setVerifyingPickList(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGoDownLoading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-extrabold transition flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                Save Verified Loaded Quantities
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
