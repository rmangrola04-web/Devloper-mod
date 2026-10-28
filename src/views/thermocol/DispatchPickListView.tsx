import React, { useState, useMemo } from 'react';
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
  Eye
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
import { PickListDocModal } from './PickListDocModal';

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
  onRequestDeletePin
}) => {
  const targetCompany: CompanyType = normalizeCompany(company);

  // Active Tab: 'createPlanning' vs 'pickListQueue'
  const [activeSubTab, setActiveSubTab] = useState<'createPlanning' | 'pickListQueue'>('createPlanning');

  // Filter Company Master Data
  const companyParties = useMemo(() => {
    return (parties || []).filter(p => normalizeCompany(p.company) === targetCompany);
  }, [parties, targetCompany]);

  const companyProducts = useMemo(() => {
    return (products || []).filter(p => normalizeCompany(p.company) === targetCompany);
  }, [products, targetCompany]);

  const companyInwards = useMemo(() => {
    return (inwards || []).filter(i => normalizeCompany(i.company) === targetCompany);
  }, [inwards, targetCompany]);

  const companyDemands = useMemo(() => {
    return (clientDemands || []).filter(d => normalizeCompany(d.company) === targetCompany);
  }, [clientDemands, targetCompany]);

  const companyTransporters = useMemo(() => {
    return (transporters || []).filter(t => !t.company || normalizeCompany(t.company) === targetCompany);
  }, [transporters, targetCompany]);

  const companyPickLists = useMemo(() => {
    return (pickLists || []).filter(pl => normalizeCompany(pl.company) === targetCompany);
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
    if (set.size === 0) {
      set.add('Indore');
      set.add('Dewas');
      set.add('Pithampur');
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [companyParties]);

  // Planning Form State
  const [selectedCity, setSelectedCity] = useState<string>(availableCities[0] || 'Indore');
  const [planningDate, setPlanningDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [assignedTransporter, setAssignedTransporter] = useState<string>('');
  const [assignedVehicleNo, setAssignedVehicleNo] = useState<string>('');
  const [assignedDriverName, setAssignedDriverName] = useState<string>('');
  const [planningRemarks, setPlanningRemarks] = useState<string>('');

  // Draft Planned Quantities state per line: key = `${partyName}_${productName}`
  // value: number of cases
  const [plannedCasesMap, setPlannedCasesMap] = useState<Record<string, number>>({});

  // Helper: Live Available Stock per product (MRP-wise aggregated)
  const getProductStock = (prodName: string): number => {
    return companyInwards
      .filter(i => i.productName === prodName)
      .reduce((sum, i) => sum + (Number(i.availableQty) || 0), 0);
  };

  // Sourced Demand Rows for Selected City
  const cityPlanningRows = useMemo(() => {
    if (!selectedCity) return [];

    const targetCityLower = selectedCity.trim().toLowerCase();
    
    // Find parties in this city
    const cityParties = companyParties.filter(p => {
      if (p.city && p.city.trim().toLowerCase() === targetCityLower) return true;
      if (p.address && p.address.toLowerCase().includes(targetCityLower)) return true;
      return false;
    });

    const partyNamesSet = new Set(cityParties.map(p => p.name));

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

    // Build planning line items for each party & product with active demands or stock
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

    cityParties.forEach(party => {
      // Find client demands for this party
      const partyDemands = companyDemands.filter(
        d => d.partyName.trim().toLowerCase() === party.name.trim().toLowerCase()
      );

      // Collect products to show (either with explicit demand or all company products)
      const targetProds = companyProducts.filter(prod => {
        const hasStock = getProductStock(prod.name) > 0;
        const hasDemand = partyDemands.some(d => d.productName.trim().toLowerCase() === prod.name.trim().toLowerCase());
        return hasStock || hasDemand;
      });

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

  // Submit and Save Pre-Planned Pick List
  const handleCreatePickList = () => {
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

    const cityShort = selectedCity.substring(0, 3).toUpperCase();
    const plCount = companyPickLists.length + 1;
    const pickListNo = `PL-${targetCompany === 'HPL' ? 'AHPL' : 'AIL'}-${cityShort}-${String(plCount).padStart(3, '0')}`;

    const newPickList: DispatchPickList = {
      id: 'pl_' + Date.now(),
      pickListNo,
      company: targetCompany,
      city: selectedCity,
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

    onSavePickList(newPickList);
    setPlannedCasesMap({});
    setPlanningRemarks('');
    setStatusMsg({ text: `Pre-Planned Pick List ${pickListNo} generated successfully for ${selectedCity}!`, isError: false });
    setActiveSubTab('pickListQueue');
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
                City-wise demand aggregation, total CFT/Weight pre-allocation, go-down pick list handover & verified invoice auto-generation
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {availableCities.map(city => (
                    <option key={city} value={city}>{city}</option>
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
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

          {/* Planning Matrix Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Box className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider">
                  Active Client Demand Matrix for <span className="text-blue-300">{selectedCity}</span>
                </h3>
              </div>
              <span className="text-[11px] text-slate-300 font-mono">
                {cityPlanningRows.length} active item requirements found
              </span>
            </div>

            {cityPlanningRows.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Info className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-600">
                  No registered clients or active inventory demands found for destination city "{selectedCity}".
                </p>
                <p className="text-[11px] text-slate-400">
                  Select a different city or add client demands in the Master Templates tab.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4 min-w-[150px]">Customer / Party Name</th>
                      <th className="py-3 px-4 min-w-[160px]">Product / SKU Description</th>
                      <th className="py-3 px-4 text-center min-w-[110px]">Total Demand</th>
                      <th className="py-3 px-4 text-center min-w-[110px]">Already Dispatched</th>
                      <th className="py-3 px-4 text-center min-w-[110px]">Pending Demand</th>
                      <th className="py-3 px-4 text-center min-w-[120px] bg-emerald-50 text-emerald-900">Available Stock</th>
                      <th className="py-3 px-4 text-right min-w-[130px] bg-blue-50 text-blue-900">Planned Cases</th>
                      <th className="py-3 px-4 text-right min-w-[110px]">Planned Qty</th>
                      <th className="py-3 px-4 text-right min-w-[120px]">Est. Weight / Vol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                    {cityPlanningRows.map((row) => {
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
                          <td className="py-3 px-4 text-center font-mono text-slate-600">
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                              {row.totalDemand > 0 ? `${row.totalDemand} pcs` : 'NO LIMIT'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-blue-800">
                            <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                              {row.alreadyDispatched} pcs
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-amber-800">
                            <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                              {row.pendingDemand} pcs
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
                              
                              {/* Print Pick List Button */}
                              <button
                                onClick={() => setDocModalPickList(pl)}
                                title="Print Formal Pick List Document"
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                              >
                                <Printer className="w-4 h-4" />
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
