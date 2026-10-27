import React, { Component, useState, useMemo, useEffect, ReactNode } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { saveThermocolInvoiceToFirestore, withTimeout } from '../../services/firestoreService';
import { 
  FileText, Calendar, Building2, Package, Truck, 
  CheckCircle2, AlertCircle, Plus, Trash2, Scale, 
  ArrowRight, ShieldCheck, Box, Info, Lock,
  X, KeyRound, AlertTriangle, Check, MapPin, RotateCcw, Sparkles,
  Loader2, Printer, Eye, BarChart3
} from 'lucide-react';
import { 
  ThermocolProduct, 
  ThermocolParty, 
  ThermocolTransporter, 
  ClientDemand, 
  ThermocolInward, 
  ThermocolInvoice, 
  SenderConfig,
  InvoiceLineItem
} from './types';
import { 
  numberToWords, 
  isInterStateParty, 
  isIndoreDestination, 
  getTaxRuleInfo, 
  formatDateDDMMYYYY,
  sanitizePartyRecord,
  CompanyType,
  COMPANY_CONFIGS,
  formatInvNoForCompany,
  formatDeliveryChallanNoForCompany,
  normalizeCompany,
  DEFAULT_SENDER,
  DEFAULT_HPL_SENDER
} from './utils';

import { SearchableSelect } from '../../components/SearchableSelect';

// Safe Default Fallbacks to prevent any undefined crashes
export const SAFE_DEFAULT_PRODUCT: ThermocolProduct = {
  id: '',
  name: '',
  hsnCode: '39239090',
  packSize: '',
  packSizeMultiple: 1,
  price: 0,
  weight: 0,
  cft: 0
};

export const SAFE_DEFAULT_PARTY: ThermocolParty = {
  name: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  gstin: ''
};

// React Error Boundary Component to guarantee zero blank white screens
interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class OrderFormErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Outward Order Entry Form caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-md space-y-4 text-center my-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900">
              Outward Order Entry Form Encountered an Issue
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              The form safely intercepted a rendering exception ({this.state.error?.message || 'Unknown error'}). Click below to reset the form state safely.
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Reset Order Form
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface OutwardOrderEntryFormProps {
  products: ThermocolProduct[];
  parties: ThermocolParty[];
  transporters: ThermocolTransporter[];
  clientDemands: ClientDemand[];
  inwards: ThermocolInward[];
  invoices: ThermocolInvoice[];
  invoiceSeq: number;
  challanSeq: number;
  sender: SenderConfig;
  company?: CompanyType;
  onSaveInvoice: (
    newInvoice: ThermocolInvoice, 
    updatedInwards: ThermocolInward[], 
    updatedDemands: ClientDemand[], 
    nextSeq: number,
    isChallan: boolean
  ) => void;
  onNavigateToInward?: () => void;
  onNavigateToMasters?: () => void;
  onNavigateToPreview?: (invNo: string) => void;
  onResetForm?: () => void;
}

interface DraftLineItem {
  id: string;
  productId: string;
  productName?: string;
  cases: number | '';
  qty: number | '';
  batch?: string;
  exp?: string;
}

export interface DemandAuthorizationState {
  isAuthorized: boolean;
  authorizedBy: string;
  reason: string;
  notes?: string;
  authorizedAt: string;
}

export const OutwardOrderEntryFormContent: React.FC<OutwardOrderEntryFormProps> = ({
  products,
  parties,
  transporters,
  clientDemands,
  inwards,
  invoices,
  invoiceSeq,
  challanSeq,
  sender,
  company = 'AIL',
  onSaveInvoice,
  onNavigateToInward,
  onNavigateToMasters,
  onNavigateToPreview,
  onResetForm
}) => {
  // Format Invoice Number using strict Company Series logic:
  // AIL: AILICH-392/26, AILICH-393/26, etc.
  // HPL: AHPLICH-001/26, AHPLICH-002/26, etc.
  const targetCompany: CompanyType = normalizeCompany(company);

  // Strict multi-company segregation & deduplication
  const companyParties = useMemo(() => {
    const map = new Map<string, ThermocolParty>();
    (parties || []).forEach(p => {
      if (normalizeCompany(p.company) === targetCompany && p.name && p.name.trim()) {
        const key = p.name.trim().toLowerCase();
        if (!map.has(key)) map.set(key, p);
      }
    });
    return Array.from(map.values());
  }, [parties, targetCompany]);

  const companyProducts = useMemo(() => {
    const map = new Map<string, ThermocolProduct>();
    (products || []).forEach(p => {
      if (normalizeCompany(p.company) === targetCompany && p.name && p.name.trim()) {
        const key = p.name.trim().toLowerCase();
        if (!map.has(key)) map.set(key, p);
      }
    });
    return Array.from(map.values());
  }, [products, targetCompany]);

  const companyInwards = useMemo(() => {
    return (inwards || []).filter(i => normalizeCompany(i.company) === targetCompany);
  }, [inwards, targetCompany]);

  const companyDemands = useMemo(() => {
    const map = new Map<string, ClientDemand>();
    (clientDemands || []).forEach(d => {
      if (normalizeCompany(d.company) === targetCompany && d.partyName && d.productName) {
        const key = `${d.partyName.trim().toLowerCase()}_${d.productName.trim().toLowerCase()}`;
        if (!map.has(key)) map.set(key, d);
      }
    });
    return Array.from(map.values());
  }, [clientDemands, targetCompany]);

  const companyTransporters = useMemo(() => {
    const map = new Map<string, ThermocolTransporter>();
    (transporters || []).forEach(t => {
      if ((!t.company || normalizeCompany(t.company) === targetCompany) && t.name && t.name.trim()) {
        const key = t.name.trim().toLowerCase();
        if (!map.has(key)) map.set(key, t);
      }
    });
    return Array.from(map.values());
  }, [transporters, targetCompany]);

  // 1. Invoice Number & Date State
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Helper to extract clean city name from a party object
  const getPartyCity = (p: ThermocolParty): string => {
    if (p.city && p.city.trim()) return p.city.trim();
    if (p.address) {
      const addr = p.address.toLowerCase();
      if (addr.includes('indore')) return 'Indore';
      if (addr.includes('dewas')) return 'Dewas';
      if (addr.includes('pithampur')) return 'Pithampur';
      if (addr.includes('sanwer')) return 'Sanwer';
      if (addr.includes('pune')) return 'Pune';
      if (addr.includes('mumbai')) return 'Mumbai';
      if (addr.includes('ahmedabad')) return 'Ahmedabad';
      if (addr.includes('bhopal')) return 'Bhopal';
      if (addr.includes('ujjain')) return 'Ujjain';
      if (addr.includes('surat')) return 'Surat';
      if (addr.includes('delhi')) return 'Delhi';
      if (addr.includes('vadodara')) return 'Vadodara';
      if (addr.includes('jaipur')) return 'Jaipur';
      if (addr.includes('bangalore') || addr.includes('bengaluru')) return 'Bengaluru';
      if (addr.includes('hyderabad')) return 'Hyderabad';
      if (addr.includes('chennai')) return 'Chennai';
      if (addr.includes('kolkata')) return 'Kolkata';
    }
    return p.state ? p.state.trim() : 'Indore';
  };

  // Distinct cities dynamically sourced from Customer / Party Master strictly for this company
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    companyParties.forEach(p => {
      const c = getPartyCity(p);
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [companyParties]);

  // Preceding City Filter state (default 'ALL' or specific city)
  const [selectedCity, setSelectedCity] = useState<string>('ALL');

  // Dynamically filtered parties based on selected City strictly for this company
  const filteredParties = useMemo(() => {
    if (!selectedCity || selectedCity === 'ALL') {
      return companyParties;
    }
    const target = selectedCity.trim().toLowerCase();
    return companyParties.filter(p => {
      const c = getPartyCity(p).toLowerCase();
      if (c === target) return true;
      if (p.city && p.city.trim().toLowerCase() === target) return true;
      if (p.address && p.address.toLowerCase().includes(target)) return true;
      return false;
    });
  }, [companyParties, selectedCity]);

  // 2. Client Selection State (Completely blank by default on New Outward Invoice)
  const [selectedPartyName, setSelectedPartyName] = useState<string>('');

  // Handle City Filter change with Smart City-to-Party Auto-Selection
  const handleCityChange = (newCity: string) => {
    setSelectedCity(newCity);
    setDemandAuth(null);
    if (newCity && newCity !== 'ALL') {
      const target = newCity.trim().toLowerCase();
      const matching = companyParties.filter(p => {
        const c = getPartyCity(p).toLowerCase();
        if (c === target) return true;
        if (p.city && p.city.trim().toLowerCase() === target) return true;
        if (p.address && p.address.toLowerCase().includes(target)) return true;
        return false;
      });

      const uniqueNames = Array.from(new Set(matching.map(p => p.name)));
      // If there is ONLY ONE customer in that city, instantly auto-select that customer!
      if (uniqueNames.length === 1) {
        setSelectedPartyName(uniqueNames[0]);
      } else if (selectedPartyName && !matching.some(p => p.name === selectedPartyName)) {
        // If multiple or 0, clear if current selection is not valid in this city
        setSelectedPartyName('');
      }
    }
  };

  // Keep single customer auto-selected whenever filteredParties resolves to 1 in a specific city
  useEffect(() => {
    if (selectedCity && selectedCity !== 'ALL' && filteredParties.length === 1) {
      if (selectedPartyName !== filteredParties[0].name) {
        setSelectedPartyName(filteredParties[0].name);
      }
    }
  }, [selectedCity, filteredParties, selectedPartyName]);

  // Calculate live available stock per product strictly within active company
  const getProductStock = (prod: ThermocolProduct): number => {
    if (!prod || !prod.name) return 0;
    return companyInwards
      .filter(i => i && i.productName === prod.name)
      .reduce((sum, i) => sum + (Number(i.availableQty) || 0), 0);
  };

  // 3. In-Stock Product Selection: Strictly filter active company products where stock > 0
  const inStockProducts = useMemo(() => {
    if (!companyProducts || companyProducts.length === 0) return [];
    return companyProducts.filter(p => getProductStock(p) > 0);
  }, [companyProducts, companyInwards]);

  // Line items state (Completely blank row by default, no pre-selected product or pre-filled values)
  const [orderLines, setOrderLines] = useState<DraftLineItem[]>(() => [
    {
      id: 'line_' + Date.now(),
      productId: '',
      cases: '',
      qty: '',
      batch: '',
      exp: ''
    }
  ]);

  // 4. Transport & Dispatch Details State (Completely blank by default)
  const [transName, setTransName] = useState<string>('');
  const [lrNo, setLrNo] = useState<string>('');
  const [lrDate, setLrDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [vehicleNo, setVehicleNo] = useState<string>('');

  // 5. Explicit Location, Destination & Pin Code State for active invoice (starts blank)
  const [destinationCity, setDestinationCity] = useState<string>('');
  const [destinationState, setDestinationState] = useState<string>('');
  const [pinCode, setPinCode] = useState<string>('');

  // Status message & Submission States
  const [formMsg, setFormMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [justCreatedInvoice, setJustCreatedInvoice] = useState<ThermocolInvoice | null>(null);

  // Demand Authorization State
  const [demandAuth, setDemandAuth] = useState<DemandAuthorizationState | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  // Admin Modal Form fields
  const [authManagerName, setAuthManagerName] = useState<string>('Operations Manager / Plant Head');
  const [authReason, setAuthReason] = useState<string>('Urgent Customer Breakdown Exception');
  const [authNotes, setAuthNotes] = useState<string>('Approved as operational exception to prevent production downtime.');
  const [authConfirmed, setAuthConfirmed] = useState<boolean>(false);

  // Party & Location Demand & Dispatch Summary Pop-Up State
  const [showDemandSummaryModal, setShowDemandSummaryModal] = useState<boolean>(false);
  const [autoTriggeredKey, setAutoTriggeredKey] = useState<string>('');

  // Auto-fetch FIFO / Lowest Rate from available inward stock batches
  // "If a product has multiple inward entries with different rates/MRPs, the system must automatically prioritize and select the lowest rate/MRP stock first (FIFO principle)"
  const getProductBatches = (prod: ThermocolProduct) => {
    if (!prod || !prod.name) return [];
    return companyInwards
      .filter(i => i && i.productName === prod.name && i.availableQty > 0)
      .sort((a, b) => (Number(a.price) - Number(b.price)) || (new Date(a.receiveDate || 0).getTime() - new Date(b.receiveDate || 0).getTime()));
  };

  const getFifoRate = (prod: ThermocolProduct): number => {
    try {
      if (!prod || !prod.name) return 15;
      const batches = getProductBatches(prod);
      if (batches.length === 0) return prod.price || 15;
      
      // Select lowest rate among available batches (sorted ascending)
      const lowestRate = Number(batches[0].price);
      return lowestRate > 0 ? lowestRate : (prod.price || 15);
    } catch {
      return prod?.price || 15;
    }
  };

  // Add order line (Multiple line items support)
  const handleAddLine = () => {
    if (inStockProducts.length === 0) {
      setFormMsg({ 
        text: 'Cannot add line: No products currently have available stock greater than 0. Please record an inward stock entry first.', 
        isError: true 
      });
      return;
    }
    setOrderLines(prev => [
      ...prev,
      {
        id: 'line_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        productId: '',
        cases: '',
        qty: '',
        batch: '',
        exp: ''
      }
    ]);
  };

  // Remove order line (resets to single blank row if last row is removed)
  const handleRemoveLine = (id: string) => {
    if (orderLines.length <= 1) {
      setOrderLines([
        {
          id: 'line_' + Date.now(),
          productId: '',
          cases: '',
          qty: '',
          batch: '',
          exp: ''
        }
      ]);
      return;
    }
    setOrderLines(prev => prev.filter(l => l.id !== id));
  };

  // Resolve active client object (null if no client is selected)
  const activeParty = useMemo(() => {
    if (!companyParties || companyParties.length === 0 || !selectedPartyName) return null;
    const found = filteredParties.find(p => p.name === selectedPartyName) || 
                  companyParties.find(p => p.name === selectedPartyName);
    return found ? sanitizePartyRecord(found, targetCompany) : null;
  }, [companyParties, filteredParties, selectedPartyName, targetCompany]);

  // Sync client location & pin code whenever active party changes
  useEffect(() => {
    if (activeParty) {
      setDestinationCity(activeParty.city || '');
      setDestinationState(activeParty.state || '');
      const rawPin = activeParty.pincode || (activeParty.address?.match(/\b([1-9][0-9]{5})\b/)?.[1] || '');
      setPinCode(rawPin);
    } else {
      setDestinationCity('');
      setDestinationState('');
      setPinCode('');
    }
  }, [activeParty]);

  // Real-Time Party & Location Demand & Dispatch Calculation Engine
  const partyDemandSummary = useMemo(() => {
    if (!selectedPartyName) {
      return {
        partyName: '',
        location: '',
        items: [],
        totalDemandQty: 0,
        totalDispatchedQty: 0,
        totalPendingQty: 0,
        totalDraftQty: 0,
        hasDemandRecords: false
      };
    }

    const currentLoc = destinationCity.trim() || selectedCity || (activeParty?.city ? activeParty.city : 'Indore');
    const partyDemandsList = companyDemands.filter(
      d => d.partyName.trim().toLowerCase() === selectedPartyName.trim().toLowerCase()
    );

    // Map of product names to demand limit
    const demandMap = new Map<string, number>();
    partyDemandsList.forEach(d => {
      demandMap.set(d.productName.trim().toLowerCase(), d.monthlyLimit);
    });

    // Map of product names to historical dispatches (non-cancelled)
    const dispatchedMap = new Map<string, number>();
    invoices.forEach(inv => {
      if (
        !inv.isCancelled && 
        normalizeCompany(inv.company) === targetCompany && 
        inv.partyName.trim().toLowerCase() === selectedPartyName.trim().toLowerCase()
      ) {
        inv.items?.forEach(it => {
          if (it.productName) {
            const k = it.productName.trim().toLowerCase();
            dispatchedMap.set(k, (dispatchedMap.get(k) || 0) + (Number(it.qty) || 0));
          }
        });
      }
    });

    // Map of product names to current draft order lines
    const draftMap = new Map<string, number>();
    orderLines.forEach(l => {
      const prod = companyProducts.find(p => p.id === l.productId) || 
                   companyProducts.find(p => p.name === l.productId) || 
                   SAFE_DEFAULT_PRODUCT;
      if (prod && prod.name) {
        const k = prod.name.trim().toLowerCase();
        draftMap.set(k, (draftMap.get(k) || 0) + (Number(l.qty) || 0));
      }
    });

    // Collect all relevant product keys
    const allProductKeys = new Set<string>();
    demandMap.forEach((_, k) => allProductKeys.add(k));
    dispatchedMap.forEach((_, k) => allProductKeys.add(k));
    draftMap.forEach((_, k) => allProductKeys.add(k));

    if (allProductKeys.size === 0) {
      companyProducts.forEach(p => {
        if (p.name) allProductKeys.add(p.name.trim().toLowerCase());
      });
    }

    let totalDemandQty = 0;
    let totalDispatchedQty = 0;
    let totalPendingQty = 0;
    let totalDraftQty = 0;

    const items = Array.from(allProductKeys).map(pKey => {
      const prodObj = companyProducts.find(p => p.name.trim().toLowerCase() === pKey);
      const displayName = prodObj ? prodObj.name : (pKey.charAt(0).toUpperCase() + pKey.slice(1));
      
      const totalDemand = demandMap.get(pKey) || 0;
      const alreadyDispatched = dispatchedMap.get(pKey) || 0;
      const pendingQty = Math.max(0, totalDemand - alreadyDispatched);
      const currentDraftQty = draftMap.get(pKey) || 0;
      const remAfterDraft = pendingQty - currentDraftQty;

      totalDemandQty += totalDemand;
      totalDispatchedQty += alreadyDispatched;
      totalPendingQty += pendingQty;
      totalDraftQty += currentDraftQty;

      let statusLabel = 'PENDING';
      let statusColor = 'bg-amber-100 text-amber-800 border-amber-300';

      if (totalDemand === 0) {
        statusLabel = 'NO DEMAND LIMIT';
        statusColor = 'bg-slate-100 text-slate-700 border-slate-300';
      } else if (alreadyDispatched >= totalDemand) {
        statusLabel = 'FULFILLED (100%)';
        statusColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      } else if (alreadyDispatched + currentDraftQty > totalDemand) {
        statusLabel = 'EXCEEDS LIMIT';
        statusColor = 'bg-rose-100 text-rose-800 border-rose-300';
      } else if (alreadyDispatched > 0) {
        statusLabel = 'PARTIALLY DISPATCHED';
        statusColor = 'bg-blue-100 text-blue-800 border-blue-300';
      }

      return {
        productName: displayName,
        totalDemand,
        alreadyDispatched,
        pendingQty,
        currentDraftQty,
        remAfterDraft,
        statusLabel,
        statusColor
      };
    }).sort((a, b) => b.totalDemand - a.totalDemand || a.productName.localeCompare(b.productName));

    return {
      partyName: selectedPartyName,
      location: currentLoc,
      items,
      totalDemandQty,
      totalDispatchedQty,
      totalPendingQty,
      totalDraftQty,
      hasDemandRecords: partyDemandsList.length > 0
    };
  }, [selectedPartyName, destinationCity, selectedCity, activeParty, companyDemands, invoices, targetCompany, orderLines, companyProducts]);

  // Trigger modal pop-up automatically upon selecting a party or party + location
  useEffect(() => {
    if (selectedPartyName) {
      const currentLoc = destinationCity.trim() || selectedCity || (activeParty?.city ? activeParty.city : 'Indore');
      const triggerKey = `${selectedPartyName}_${currentLoc}_${targetCompany}`;
      if (autoTriggeredKey !== triggerKey) {
        setAutoTriggeredKey(triggerKey);
        setShowDemandSummaryModal(true);
      }
    }
  }, [selectedPartyName, destinationCity, selectedCity, activeParty, targetCompany, autoTriggeredKey]);

  // Dynamic Tax Rule: Indore Destination (0% GST / Delivery Challan) vs Other States (18% IGST / Tax Invoice)
  const autoIsInterState = useMemo(() => {
    if (!activeParty) return false;
    return !isIndoreDestination(activeParty);
  }, [activeParty]);

  const [taxModeOverride, setTaxModeOverride] = useState<'AUTO' | 'LOCAL' | 'INTER_STATE'>('AUTO');

  const effectiveIsInterState = useMemo(() => {
    if (taxModeOverride === 'LOCAL') return false;
    if (taxModeOverride === 'INTER_STATE') return true;
    return autoIsInterState;
  }, [taxModeOverride, autoIsInterState]);

  const taxRule = useMemo(() => getTaxRuleInfo(effectiveIsInterState), [effectiveIsInterState]);

  const isChallan = !effectiveIsInterState;
  const currentInvNo = isChallan
    ? formatDeliveryChallanNoForCompany(targetCompany, challanSeq)
    : formatInvNoForCompany(targetCompany, invoiceSeq);

  // Wipe all inputs clean and reset form completely blank
  const handleResetForm = () => {
    setSelectedPartyName('');
    setSelectedCity('ALL');
    setDestinationCity('');
    setDestinationState('');
    setPinCode('');
    setTransName('');
    setLrNo('');
    setVehicleNo('');
    setLrDate(new Date().toISOString().split('T')[0]);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setTaxModeOverride('AUTO');
    setDemandAuth(null);
    setFormMsg(null);
    setOrderLines([
      {
        id: 'line_' + Date.now(),
        productId: '',
        cases: '',
        qty: '',
        batch: '',
        exp: ''
      }
    ]);
    if (onResetForm) {
      onResetForm();
    }
  };

  // Real-time Monthly Demand Validation & Quota Check
  const demandCheck = useMemo(() => {
    const currentMonthPrefix = invoiceDate ? invoiceDate.substring(0, 7) : new Date().toISOString().substring(0, 7);
    const issues: { 
      productName: string; 
      message: string; 
      limit: number;
      dispatched: number;
      remainingQuota: number;
      requested: number;
      excess: number;
    }[] = [];
    const clientDemandDetails: { 
      productName: string; 
      limit: number; 
      dispatched: number; 
      remaining: number;
      currentRequest: number;
      exceeds: boolean;
    }[] = [];

    if (!selectedPartyName) {
      return { hasWarning: false, issues, clientDemandDetails, warningSummary: '' };
    }

    // Group requested quantities by product
    const productRequestMap = new Map<string, number>();
    orderLines.forEach(l => {
      const prod = companyProducts.find(p => p.id === l.productId) || 
                   companyProducts.find(p => p.name === l.productId) || 
                   SAFE_DEFAULT_PRODUCT;
      const current = productRequestMap.get(prod.name) || 0;
      productRequestMap.set(prod.name, current + (Number(l.qty) || 0));
    });

    productRequestMap.forEach((requestedQty, prodName) => {
      const demandRule = companyDemands.find(
        d => d.partyName === selectedPartyName && d.productName === prodName
      );

      if (!demandRule) return;

      // Calculate dispatches already recorded in current month for this client & product
      let dispatchedThisMonth = 0;
      invoices.forEach(inv => {
        if (inv.partyName === selectedPartyName && inv.date && inv.date.startsWith(currentMonthPrefix)) {
          inv.items?.forEach(it => {
            if (it.productName === prodName) {
              dispatchedThisMonth += (Number(it.qty) || 0);
            }
          });
        }
      });

      const remainingQuota = Math.max(0, demandRule.monthlyLimit - dispatchedThisMonth);
      const exceeds = (dispatchedThisMonth + requestedQty) > demandRule.monthlyLimit;

      clientDemandDetails.push({
        productName: prodName,
        limit: demandRule.monthlyLimit,
        dispatched: dispatchedThisMonth,
        remaining: remainingQuota,
        currentRequest: requestedQty,
        exceeds
      });

      if (exceeds) {
        const excess = (dispatchedThisMonth + requestedQty) - demandRule.monthlyLimit;
        issues.push({
          productName: prodName,
          message: `Monthly demand for "${prodName}" is ${demandRule.monthlyLimit} units. ${dispatchedThisMonth} units already dispatched this month. Requested ${requestedQty} units exceeds remaining limit (${remainingQuota}) by ${excess} units!`,
          limit: demandRule.monthlyLimit,
          dispatched: dispatchedThisMonth,
          remainingQuota,
          requested: requestedQty,
          excess
        });
      }
    });

    return {
      hasWarning: issues.length > 0,
      issues,
      clientDemandDetails,
      warningSummary: issues.map(i => i.message).join(' ')
    };
  }, [orderLines, selectedPartyName, invoiceDate, companyDemands, invoices, companyProducts]);

  // FIFO Stock Allocation & Multi-Rate Invoice Line Splitting Calculation
  const calculations = useMemo(() => {
    let totalTaxable = 0;
    let totalGst = 0;
    let grandTotal = 0;
    let totalQty = 0;
    let totalCases = 0;
    let totalWeight = 0;
    let totalCft = 0;
    let hasPackSizeError = false;
    let packSizeErrorMessage = '';

    const lines = orderLines.flatMap((l) => {
      if (!l.productId && !l.productName) {
        return [{
          id: l.id,
          parentLineId: l.id,
          productId: '',
          productName: '',
          hsnCode: '-',
          packSize: '-',
          packSizeMultiple: 1,
          cases: 0,
          qty: 0,
          batch: '',
          exp: '',
          rate: 0,
          batchesCount: 0,
          hasMultipleBatches: false,
          isSplit: false,
          weight: 0,
          cft: 0,
          taxableValue: 0,
          gstRate: 0,
          gstValue: 0,
          totalValue: 0,
          isInvalidMultiple: false
        }];
      }

      const prod = companyProducts.find(p => p.id === l.productId || p.name === l.productId || p.name === l.productName || p.id === l.productName) || 
                   SAFE_DEFAULT_PRODUCT;

      const q = Number(l.qty) || 0;
      const multiple = prod.packSizeMultiple || 1;

      // Pack-size multiple validation
      const isInvalidMultiple = q > 0 && q % multiple !== 0;
      if (isInvalidMultiple) {
        hasPackSizeError = true;
        packSizeErrorMessage = `Invalid quantity for "${prod.name}": Entered quantity (${q}) must be a strict multiple of pack size multiple ${multiple} (${prod.packSize})!`;
      }

      if (q <= 0) {
        return [{
          id: l.id,
          parentLineId: l.id,
          productId: prod.id || l.productId || prod.name || '',
          productName: prod.name || l.productName || '',
          hsnCode: prod.hsnCode || '39239090',
          packSize: prod.packSize || 'Standard Box',
          packSizeMultiple: multiple,
          cases: 0,
          qty: 0,
          batch: l.batch?.trim() || '',
          exp: l.exp?.trim() || '',
          rate: prod.price || 15,
          batchesCount: 0,
          hasMultipleBatches: false,
          isSplit: false,
          weight: 0,
          cft: 0,
          taxableValue: 0,
          gstRate: 0,
          gstValue: 0,
          totalValue: 0,
          isInvalidMultiple
        }];
      }

      // FIFO STOCK ALLOCATION ENGINE:
      // Fetch available inward stock lots for this product in targetCompany
      const availableLots = companyInwards
        .filter(i => i && i.productName === prod.name && i.availableQty > 0 && (i.company || 'AIL') === targetCompany)
        .sort((a, b) => {
          const timeA = new Date(a.receiveDate || a.date || 0).getTime();
          const timeB = new Date(b.receiveDate || b.date || 0).getTime();
          if (timeA !== timeB) return timeA - timeB; // FIFO: Oldest lot first
          return (Number(a.price || 0) - Number(b.price || 0)); // Lowest price
        });

      // Split requested quantity across FIFO lots
      let rem = q;
      const splitRows: Array<{
        qty: number;
        rate: number;
        batch: string;
        exp?: string;
      }> = [];

      if (availableLots.length === 0) {
        splitRows.push({
          qty: q,
          rate: Number(prod.price) || 15,
          batch: l.batch?.trim() || 'N/A',
          exp: l.exp?.trim() || ''
        });
      } else {
        for (const lot of availableLots) {
          if (rem <= 0) break;
          const lotAvail = Number(lot.availableQty) || 0;
          if (lotAvail <= 0) continue;

          const take = Math.min(rem, lotAvail);
          const lotRate = Number(lot.price) > 0 ? Number(lot.price) : (Number(prod.price) || 15);
          const lotBatch = (l.batch && l.batch !== 'N/A') ? l.batch.trim() : (lot.grNo || (lot as any).batch || 'N/A');
          const lotExp = l.exp?.trim() || (lot as any).exp || '';

          splitRows.push({
            qty: take,
            rate: lotRate,
            batch: lotBatch,
            exp: lotExp
          });

          rem -= take;
        }

        // If requested quantity exceeds total available stock across all lots
        if (rem > 0) {
          const lastLot = availableLots[availableLots.length - 1];
          const fallbackRate = Number(lastLot?.price) > 0 ? Number(lastLot.price) : (Number(prod.price) || 15);
          const fallbackBatch = (l.batch && l.batch !== 'N/A') ? l.batch.trim() : (lastLot?.grNo || 'N/A');
          splitRows.push({
            qty: rem,
            rate: fallbackRate,
            batch: fallbackBatch,
            exp: l.exp?.trim() || ''
          });
        }
      }

      // Convert each split into an independent invoice line item row
      return splitRows.map((split, subIdx) => {
        const subQty = split.qty;
        const lineCases = multiple > 0 ? (subQty % multiple === 0 ? subQty / multiple : Math.ceil(subQty / multiple)) : 0;
        const taxable = Number((subQty * split.rate).toFixed(2));
        const gstRate = effectiveIsInterState ? 18 : 0;
        const gst = effectiveIsInterState ? Number((taxable * 0.18).toFixed(2)) : 0;
        const total = Number((taxable + gst).toFixed(2));
        const lineWeight = subQty * (prod.weight || 0.1);
        const lineCft = subQty * (prod.cft || 0.01);

        totalTaxable += taxable;
        totalGst += gst;
        grandTotal += total;
        totalQty += subQty;
        totalCases += lineCases;
        totalWeight += lineWeight;
        totalCft += lineCft;

        return {
          id: splitRows.length > 1 ? `${l.id}_split_${subIdx}` : l.id,
          parentLineId: l.id,
          productId: prod.id || l.productId || prod.name || '',
          productName: prod.name || l.productName || '',
          hsnCode: prod.hsnCode || '39239090',
          packSize: prod.packSize || 'Standard Box',
          packSizeMultiple: multiple,
          cases: lineCases,
          qty: subQty,
          batch: split.batch,
          exp: split.exp,
          rate: split.rate,
          batchesCount: availableLots.length,
          hasMultipleBatches: availableLots.length > 1,
          isSplit: splitRows.length > 1,
          splitIndex: subIdx,
          totalSplits: splitRows.length,
          weight: Number(lineWeight.toFixed(2)),
          cft: Number(lineCft.toFixed(2)),
          taxableValue: taxable,
          gstRate,
          gstValue: gst,
          totalValue: total,
          isInvalidMultiple
        };
      });
    });

    return {
      lines,
      totalTaxable: totalTaxable.toFixed(2),
      totalGst: totalGst.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      totalQty,
      totalCases,
      totalWeightKg: totalWeight.toFixed(2),
      totalWeightMt: (totalWeight / 1000).toFixed(3),
      totalCft: totalCft.toFixed(2),
      hasPackSizeError,
      packSizeErrorMessage,
      amountInWords: numberToWords(grandTotal)
    };
  }, [orderLines, companyProducts, companyInwards, targetCompany, effectiveIsInterState]);

  // Reset input form fields cleanly without touching master lists or wiping out success messages
  const resetFormFieldsAfterSave = () => {
    setSelectedPartyName('');
    setSelectedCity('ALL');
    setDestinationCity('');
    setDestinationState('');
    setPinCode('');
    setTransName('');
    setLrNo('');
    setVehicleNo('');
    setLrDate(new Date().toISOString().split('T')[0]);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setTaxModeOverride('AUTO');
    setDemandAuth(null);
    setOrderLines([
      {
        id: 'line_' + Date.now(),
        productId: '',
        cases: '',
        qty: '',
        batch: '',
        exp: ''
      }
    ]);
  };

  // Form Submission & Inventory Stock Deduction
  const handleSubmitInvoice = async () => {
    let safetyTimer: any;
    try {
      setIsSubmitting(true);
      // Failsafe auto-unlock timer (max 2.5s) to guarantee spinner NEVER hangs indefinitely
      safetyTimer = setTimeout(() => {
        setIsSubmitting(false);
      }, 2500);

      // 1. Client & Mandatory Fields Validation
      if (!selectedPartyName || !selectedPartyName.trim()) {
        setFormMsg({ text: 'Please select a Sold To Party (Client) before generating invoice!', isError: true });
        return;
      }
      if (!transName || !transName.trim() || !lrNo || !lrNo.trim() || !vehicleNo || !vehicleNo.trim()) {
        setFormMsg({ text: 'Please fill in all mandatory fields: Transporter Name, LR/GR Number, and Vehicle Number before generating the invoice.', isError: true });
        return;
      }

      // 2. Quantity & Pack-Size Validation
      const validLines = calculations.lines.filter(l => (l.productId || l.productName) && Number(l.qty) > 0);
      if (validLines.length === 0) {
        setFormMsg({ text: 'Please select at least one product with positive dispatch quantity (cases/units)!', isError: true });
        return;
      }

      if (calculations.hasPackSizeError) {
        setFormMsg({ text: calculations.packSizeErrorMessage, isError: true });
        return;
      }

      if (calculations.totalQty <= 0) {
        setFormMsg({ text: 'Please specify valid positive dispatch quantities for items!', isError: true });
        return;
      }

      // 3. Monthly Demand Exceeded Validation (Blocked unless Admin Authorization Granted)
      if (demandCheck.hasWarning && !demandAuth?.isAuthorized) {
        setFormMsg({ 
          text: `Cannot generate invoice: Client monthly demand quota exceeded! Admin Authorization is required before dispatching excess quantity.`, 
          isError: true 
        });
        setShowAuthModal(true);
        return;
      }

      // 4. Inward Stock Verification & Lot Deduction (FIFO & Lowest Rate first strictly within active company)
      const updatedInwards = [...inwards];
      for (const item of validLines) {
        const prod = companyProducts.find(p => (p.id && p.id === item.productId) || p.name === item.productName);
        const availableStock = prod ? getProductStock(prod) : 0;

        if (availableStock <= 0) {
          setFormMsg({ 
            text: `Product "${item.productName}" has 0 available inventory for ${targetCompany === 'HPL' ? 'AHPL' : 'AIL'} and cannot be dispatched!`, 
            isError: true 
          });
          return;
        }

        if (availableStock < item.qty) {
          setFormMsg({ 
            text: `Insufficient stock for "${item.productName}"! Required: ${item.qty}, Available: ${availableStock}`, 
            isError: true 
          });
          return;
        }

        // Deduct from available lots belonging strictly to targetCompany
        let needed = item.qty;
        const lots = updatedInwards
          .filter(i => (i.company || 'AIL') === targetCompany && i.productName === item.productName && i.availableQty > 0)
          .sort((a, b) => (Number(a.price) - Number(b.price)) || (new Date(a.receiveDate || 0).getTime() - new Date(b.receiveDate || 0).getTime()));

        for (const lot of lots) {
          if (needed <= 0) break;
          const deduct = Math.min(lot.availableQty, needed);
          lot.availableQty -= deduct;
          needed -= deduct;
        }
      }

      // 5. Build New Tax Invoice Document
      const rawParty = companyParties.find(p => p.name === selectedPartyName) || SAFE_DEFAULT_PARTY;
      const partyObj = sanitizePartyRecord(rawParty, targetCompany);
      const transObj = companyTransporters.find(t => t.name === transName);

      const invoiceItems: InvoiceLineItem[] = validLines.map(l => {
        const prod = companyProducts.find(p => (p.id && p.id === l.productId) || p.name === l.productName);
        const isCoolantProd = prod && (prod.name.toLowerCase().includes('coolant pack') || prod.name.toLowerCase().includes('coolant'));
        return {
          id: l.id,
          productId: l.productId || prod?.id || '',
          productName: l.productName || prod?.name || '',
          hsnCode: l.hsnCode,
          packSize: l.packSize,
          packSizeMultiple: l.packSizeMultiple,
          cases: l.cases,
          qty: l.qty,
          batch: isCoolantProd ? (l.batch?.trim() || 'N/A') : 'N/A',
          exp: l.exp?.trim() || undefined,
          rate: l.rate,
          weight: l.weight,
          cft: l.cft,
          taxableValue: l.taxableValue,
          gstValue: l.gstValue,
          totalValue: l.totalValue
        };
      });

      // Origin / Consignor (Sender) Details dynamic per Active Company (AIL vs HPL)
      const compConfig = targetCompany === 'HPL' ? COMPANY_CONFIGS.HPL : COMPANY_CONFIGS.AIL;
      const resolvedSender = sender?.name ? sender : compConfig.defaultSender;

      const resolvedCity = destinationCity.trim() || partyObj.city;
      const resolvedState = destinationState.trim() || partyObj.state;
      const resolvedPincode = pinCode.trim() || partyObj.pincode || (partyObj.address?.match(/\b([1-9][0-9]{5})\b/)?.[1] || '');

      const newInvoice: ThermocolInvoice = {
        invNo: currentInvNo,
        company: targetCompany,
        date: invoiceDate,
        partyName: selectedPartyName,
        partyAddress: partyObj.address || 'Industrial Area, Dewas, MP',
        partyGstin: partyObj.gstin || '23UNREGISTERED',
        partyCity: resolvedCity,
        partyState: resolvedState,
        partyPincode: resolvedPincode,
        isInterState: effectiveIsInterState,
        taxType: effectiveIsInterState ? 'INTER_STATE_IGST' : 'LOCAL_EXEMPT',
        senderName: resolvedSender.name,
        senderAddress: resolvedSender.address,
        senderGstin: resolvedSender.gstin,
        senderPan: resolvedSender.pan || (targetCompany === 'HPL' ? 'AABCA4612J' : 'AAACA0231P'),
        senderCin: resolvedSender.cin || (targetCompany === 'HPL' ? 'U24239MH1997PTC109594' : 'L24239MH1944PLC007330'),
        senderLogoUrl: resolvedSender.logoUrl || undefined,
        senderContact: resolvedSender.contact || '+91 9285061000',
        senderEmail: resolvedSender.email || 'Indore.hub@abbott.in',
        transName: transName || 'Direct Dispatch',
        transGstin: transObj ? transObj.gstin : '',
        lrNo: lrNo.trim() || 'LR-PENDING',
        lrDate: lrDate,
        vehicleNo: vehicleNo.trim() || 'MP09-AB-1234',
        totalTaxable: calculations.totalTaxable,
        totalGst: calculations.totalGst,
        grandTotal: calculations.grandTotal,
        totalQty: calculations.totalQty,
        totalCases: calculations.totalCases,
        totalWeight: calculations.totalWeightKg,
        totalCft: calculations.totalCft,
        items: invoiceItems,
        demandOverride: demandAuth?.isAuthorized ? {
          isOverride: true,
          authorizedBy: demandAuth.authorizedBy,
          reason: demandAuth.reason + (demandAuth.notes ? ` - ${demandAuth.notes}` : ''),
          authorizedAt: demandAuth.authorizedAt
        } : undefined
      };

      // 6. Deduct Monthly Demand Limit in Database across multiple line items
      const updatedDemands = clientDemands.map(dem => {
        if (dem.partyName === selectedPartyName) {
          const totalOrderedForProduct = validLines
            .filter(l => l.productName === dem.productName)
            .reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

          if (totalOrderedForProduct > 0) {
            const reducedLimit = Math.max(0, dem.monthlyLimit - totalOrderedForProduct);
            return { ...dem, monthlyLimit: reducedLimit };
          }
        }
        return dem;
      });

      const nextSeq = isChallan ? challanSeq + 1 : invoiceSeq + 1;

      // 1. Instant local state synchronization across parent UI components (stock deducted, demand quota updated, sequence advanced)
      // Note: handleSaveInvoiceFromForm already calls incrementInvoiceSequenceAndSave which handles the Firestore write atomically.
      onSaveInvoice(newInvoice, updatedInwards, updatedDemands, 0, isChallan);
      resetFormFieldsAfterSave();
      
      // 2. Instant success feedback with generated Invoice Number
      setJustCreatedInvoice(newInvoice);
      setFormMsg({ text: `Invoice ${newInvoice.invNo} generated successfully!`, isError: false });

      // REMOVED: Redundant secondary background save to prevent dual invoice creation.
      // withTimeout(saveThermocolInvoiceToFirestore(newInvoice), 2500, newInvoice.invNo)
      //   .then(() => console.log(`[Firestore Success] Saved invoice ${newInvoice.invNo} to ich_operations successfully!`))
      //   .catch((firestoreErr) => console.warn('[Firestore Notice] Background invoice save notice:', firestoreErr));
    } catch (err: any) {
      console.error('Invoice Generation Error:', err);
      setFormMsg({ text: `Failed to generate invoice: ${err.message || 'Unknown error occurred'}`, isError: true });
    } finally {
      if (safetyTimer) clearTimeout(safetyTimer);
      setIsSubmitting(false);
    }
  };

  const isSaveBlockedByDemand = demandCheck.hasWarning && !demandAuth?.isAuthorized;
  const hasValidLines = calculations.lines.some(l => (l.productId || l.productName) && Number(l.qty) > 0);

  const isSaveDisabled = 
    isSubmitting ||
    calculations.hasPackSizeError || 
    isSaveBlockedByDemand || 
    calculations.totalQty <= 0 ||
    inStockProducts.length === 0 ||
    !selectedPartyName ||
    !hasValidLines ||
    !transName.trim() ||
    !lrNo.trim() ||
    !vehicleNo.trim();

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden text-slate-800">
      {/* Form Header Banner */}
      <div className="bg-slate-900 text-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800">
        <div>
          <span className="text-[11px] font-mono tracking-wider uppercase text-blue-400 font-bold block">
            Outward Dispatch & Logistics
          </span>
          <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <span>New Outward Invoice & Dispatch Entry Form</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Auto-sequence invoice generation with live FIFO / lowest rate fetching, pack-size verification, demand quota check, and instant stock deduction.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 border ${
            company === 'HPL' 
              ? 'bg-purple-950/80 text-purple-200 border-purple-700' 
              : 'bg-blue-950/80 text-blue-200 border-blue-700'
          }`}>
            <Building2 className="w-3.5 h-3.5" />
            <span>{company === 'HPL' ? 'AHPL' : 'AIL'} Series</span>
          </div>

          <button
            type="button"
            onClick={handleResetForm}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            title="Reset form completely blank"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Reset / Blank Form</span>
          </button>
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-[11px] text-slate-400">Current Series:</span>
            <span className="font-mono font-black text-emerald-400 text-xs">{currentInvNo}</span>
          </div>
        </div>
      </div>

      <div className="p-5 md:p-6 space-y-6">
        {/* ==========================================================
            ZERO-STOCK & EMPTY MASTER ADVISORIES
            ========================================================== */}
        {companyParties.length === 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold">No Client / Customer Records Found for {targetCompany === 'HPL' ? 'AHPL' : 'AIL'}</p>
                <p className="text-amber-700 text-[11px]">
                  Please add or import client records in the Customer Master to generate {targetCompany === 'HPL' ? 'AHPL' : 'AIL'} invoices.
                </p>
              </div>
            </div>
            {onNavigateToMasters && (
              <button
                onClick={onNavigateToMasters}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer shadow-xs transition"
              >
                Go to Masters & CSV
              </button>
            )}
          </div>
        )}

        {companyProducts.length === 0 && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3 text-xs text-blue-900">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="font-bold">No Products in {targetCompany === 'HPL' ? 'AHPL' : 'AIL'} Product Master</p>
                <p className="text-blue-700 text-[11px]">
                  Please add or import products into {targetCompany === 'HPL' ? 'AHPL' : 'AIL'} Master directory first.
                </p>
              </div>
            </div>
            {onNavigateToMasters && (
              <button
                onClick={onNavigateToMasters}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer shadow-xs transition"
              >
                Go to Masters & CSV
              </button>
            )}
          </div>
        )}

        {inStockProducts.length === 0 && companyProducts.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold">All {targetCompany === 'HPL' ? 'AHPL' : 'AIL'} Products Have Zero Available Stock</p>
                <p className="text-amber-700 text-[11px]">
                  Available stock is 0 for all {targetCompany === 'HPL' ? 'AHPL' : 'AIL'} products. Inward goods must be recorded first before outward dispatch.
                </p>
              </div>
            </div>
            {onNavigateToInward && (
              <button
                onClick={onNavigateToInward}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer shadow-xs transition"
              >
                Go to Inward Management
              </button>
            )}
          </div>
        )}

        {/* ==========================================================
            STEP 1 & 2: INVOICE NUMBER, DATE, CITY FILTER & CLIENT SELECTION
            ========================================================== */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
              <span>Invoice Series, City Filter & Sold To Party (Client)</span>
            </div>
            {selectedPartyName && (
              <button
                type="button"
                onClick={() => setShowDemandSummaryModal(true)}
                className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="View Party & Location Demand & Dispatch Summary"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>Demand & Dispatch Summary Pop-Up</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Step 1.1: Invoice Number */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Invoice Number (Auto-Generated)</span>
              </label>
              <input
                type="text"
                readOnly
                value={currentInvNo}
                className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3.5 py-2.5 font-mono font-bold text-blue-900 text-xs cursor-not-allowed shadow-inner"
              />
              <span className="text-[10px] text-slate-400 block font-mono">Strict FY 26-27 Sequence Continuity</span>
            </div>

            {/* Step 1.2: Invoice Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Invoice Date *</span>
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => {
                  setInvoiceDate(e.target.value);
                  setDemandAuth(null); // Reset authorization if date changes
                }}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
              <span className="text-[10px] text-blue-700 font-bold block font-mono">Format: DD-MM-YYYY ({formatDateDDMMYYYY(invoiceDate)})</span>
            </div>

            {/* Step 1.3: Preceding City Filter */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>City Filter *</span>
                </span>
                <span className="text-[10px] text-blue-600 font-semibold font-mono">
                  {selectedCity === 'ALL' ? 'All Cities' : selectedCity}
                </span>
              </label>
              <SearchableSelect
                options={[
                  { label: 'All Cities', value: 'ALL' },
                  ...availableCities.map(city => ({ label: city, value: city }))
                ]}
                value={selectedCity}
                onChange={(val) => handleCityChange(val || 'ALL')}
                placeholder="-- All Cities --"
              />
              <span className="text-[10px] text-slate-400 block">Sourced dynamically from Customer Master (Type to search city)</span>
            </div>

            {/* Step 1.4: Client Selection (Sold To Party) - Restricted by City Filter */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Sold To Party (Client) *</span>
                </span>
                <span className={`text-[10px] font-mono ${filteredParties.length === 1 && selectedCity !== 'ALL' ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                  {filteredParties.length === 1 && selectedCity !== 'ALL' ? 'Auto-Selected (1 Client)' : `${filteredParties.length} available`}
                </span>
              </label>
              <SearchableSelect
                options={filteredParties.map(p => ({
                  label: p.name,
                  value: p.name
                }))}
                value={selectedPartyName}
                onChange={(val) => {
                  setSelectedPartyName(val);
                  setDemandAuth(null);
                }}
                placeholder={filteredParties.length === 0 ? '-- No Clients in this Location --' : '-- Select Sold To Party (Client) * --'}
              />
              <span className="text-[10px] text-slate-400 block">
                {filteredParties.length === 1 && selectedCity !== 'ALL'
                  ? '✨ Single customer for this city auto-selected instantly'
                  : 'Select client from dropdown'}
              </span>
            </div>
          </div>

          {/* Auto-Loaded Client Billing Address & Conditional Tax Status Card */}
          {activeParty ? (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                    Auto-Loaded Client Billing Address:
                  </span>
                  <p className="font-extrabold text-slate-900 text-xs">{activeParty.name}</p>
                  <p className="text-slate-600 text-[11px] leading-relaxed max-w-lg">{activeParty.address}</p>
                  {(activeParty.city || activeParty.state) && (
                    <p className="text-slate-500 text-[10px] font-medium pt-0.5">
                      Destination: <b>{activeParty.city ? activeParty.city.toUpperCase() : 'INDORE'}{activeParty.pincode ? ` - ${activeParty.pincode}` : ''}</b> | State: <b>{activeParty.state || 'Madhya Pradesh'}</b>
                    </p>
                  )}
                </div>
                <div className="text-left sm:text-right font-mono bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-2xs shrink-0">
                  <span className="text-[10px] text-slate-400 block font-sans">GSTIN / UIN</span>
                  <span className="font-bold text-blue-900 text-xs">{activeParty.gstin || '23UNREGISTERED'}</span>
                </div>
              </div>

              {/* Conditional Tax Rule Display & Dynamic Jurisdiction Toggle */}
              <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-700">Tax Jurisdiction:</span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${taxRule.badgeClass}`}>
                    <span>{effectiveIsInterState ? '🚚' : '📍'}</span>
                    <span>{taxRule.label} — {taxRule.gstPercentLabel}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-500 font-medium">Tax Rule Override:</span>
                  <select
                    value={taxModeOverride}
                    onChange={(e) => setTaxModeOverride(e.target.value as any)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="AUTO">Auto-Detect ({autoIsInterState ? 'Inter-State 18%' : 'Local 0%'})</option>
                    <option value="LOCAL">Force Local (Indore/MP) - 0% GST</option>
                    <option value="INTER_STATE">Force Inter-State (Outside MP) - 18% IGST</option>
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                {taxRule.description}
              </p>
            </div>
          ) : (
            <div className="bg-slate-50/70 border border-dashed border-slate-300 rounded-xl p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Select a Sold To Party (Client) from the dropdown above to load billing address and tax jurisdiction.</span>
            </div>
          )}

          {/* Real-time Monthly Demand Quota Tracker Card */}
          {selectedPartyName && demandCheck.clientDemandDetails.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Real-Time Client Monthly Demand Quota Tracker</span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Cycle: {invoiceDate.substring(0, 7)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {demandCheck.clientDemandDetails.map((d, i) => (
                  <div 
                    key={i} 
                    className={`p-3 rounded-lg border text-xs space-y-1.5 transition ${
                      d.exceeds 
                        ? 'bg-rose-50 border-rose-300 text-rose-900' 
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-extrabold truncate text-slate-900" title={d.productName}>
                        {d.productName}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 font-mono ${
                        d.exceeds 
                          ? 'bg-rose-600 text-white' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {d.exceeds ? 'Limit Exceeded' : 'Within Quota'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">Monthly Limit</span>
                        <span className="font-bold">{d.limit}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">Dispatched</span>
                        <span className="font-semibold text-slate-600">{d.dispatched}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">Remaining</span>
                        <span className={`font-bold ${d.remaining === 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {d.remaining}
                        </span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Current Order:</span>
                      <span className={`font-mono font-black ${d.exceeds ? 'text-rose-700' : 'text-blue-900'}`}>
                        {d.currentRequest} Pcs
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ==========================================================
            STEP 3 & 4: IN-STOCK PRODUCT SELECTION & QUANTITY VALIDATION
            ========================================================== */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-1 border-b border-slate-200">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
              <span>In-Stock Product Selection & Multiple Line Items</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-mono font-bold">
                Zero-Stock Products Filtered Out
              </span>
              <button
                type="button"
                onClick={handleAddLine}
                disabled={inStockProducts.length === 0}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  inStockProducts.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer active:scale-95'
                }`}
                title="Add another product row to this outward invoice"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Line Item / Add Row</span>
              </button>
            </div>
          </div>

          {/* Monthly Demand Warning Banner & Authorization Button */}
          {demandCheck.hasWarning && (
            <div className={`p-4 rounded-xl text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border ${
              demandAuth?.isAuthorized 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}>
              <div className="flex items-start gap-2.5">
                {demandAuth?.isAuthorized ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <p className="font-extrabold text-sm">
                    {demandAuth?.isAuthorized ? (
                      <span className="text-emerald-800">
                        Admin Demand Override Authorized by {demandAuth.authorizedBy}
                      </span>
                    ) : (
                      <span className="text-rose-900">
                        Monthly Client Demand Limit Exceeded! (Dispatch Blocked)
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] leading-relaxed opacity-90 max-w-2xl">
                    {demandAuth?.isAuthorized 
                      ? `Reason: ${demandAuth.reason}. Excess quantity dispatch has been approved by management at ${demandAuth.authorizedAt}.`
                      : demandCheck.warningSummary
                    }
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {demandAuth?.isAuthorized ? (
                  <button
                    type="button"
                    onClick={() => setDemandAuth(null)}
                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Revoke Authorization
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer animate-pulse"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Request / Grant Admin Authorization</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Line Items Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                  <th className="py-3 px-3">Product Description (In-Stock Only)</th>
                  <th className="py-3 px-3">HSN Code</th>
                  <th className="py-3 px-3">Batch Number (बैच नंबर)</th>
                  <th className="py-3 px-3 text-right">Locked Rate (FIFO)</th>
                  <th className="py-3 px-3 text-right text-indigo-900">Cases</th>
                  <th className="py-3 px-3 text-right">Quantity (Pcs)</th>
                  <th className="py-3 px-3 text-right">Weight (kg)</th>
                  <th className="py-3 px-3 text-right">CFT</th>
                  <th className="py-3 px-3 text-right">Taxable (₹)</th>
                  <th className="py-3 px-3 text-right">
                    {effectiveIsInterState ? 'IGST (18%)' : 'Tax (0% Local)'}
                  </th>
                  <th className="py-3 px-3 text-right font-extrabold">Total (₹)</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {orderLines.map((line, idx) => {
                  const lineCalcs = calculations.lines.filter(c => c.id === line.id || c.parentLineId === line.id);
                  const calc = lineCalcs[0];
                  const isMultiSplit = lineCalcs.length > 1;

                  const lineTaxableSum = lineCalcs.reduce((acc, c) => acc + (c.taxableValue || 0), 0);
                  const lineGstSum = lineCalcs.reduce((acc, c) => acc + (c.gstValue || 0), 0);
                  const lineTotalSum = lineCalcs.reduce((acc, c) => acc + (c.totalValue || 0), 0);
                  const lineWeightSum = lineCalcs.reduce((acc, c) => acc + (c.weight || 0), 0);
                  const lineCftSum = lineCalcs.reduce((acc, c) => acc + (c.cft || 0), 0);

                  const prod = line.productId ? (companyProducts.find(p => p.id === line.productId) || companyProducts.find(p => p.name === line.productId) || null) : null;
                  const availableStock = prod ? getProductStock(prod) : 0;
                  const multiple = prod?.packSizeMultiple || 1;

                  return (
                    <tr key={line.id || idx} className={calc?.isInvalidMultiple ? 'bg-red-50/40' : 'hover:bg-slate-50/70'}>
                      {/* Product Selector (Only stock > 0 items displayed) */}
                      <td className="py-2.5 px-3 min-w-[240px]">
                        <SearchableSelect
                          options={inStockProducts.map(p => ({
                            label: p.name,
                            value: p.id
                          }))}
                          value={line.productId || ''}
                          onChange={(newId) => {
                            const newP = companyProducts.find(p => p.id === newId) || null;
                            const isCoolantNew = newP && (newP.name.toLowerCase().includes('coolant pack') || newP.name.toLowerCase().includes('coolant'));
                            const newMultiple = newP?.packSizeMultiple || 1;
                            const currentCases = line.cases !== undefined && line.cases !== '' ? Number(line.cases) : '';
                            const computedQty = currentCases !== '' ? Number(currentCases) * newMultiple : '';
                            setOrderLines(prev => prev.map(l => l.id === line.id ? {
                              ...l,
                              productId: newId,
                              cases: currentCases,
                              qty: computedQty,
                              batch: isCoolantNew ? (l.batch === 'N/A' ? '' : l.batch) : 'N/A'
                            } : l));
                            setDemandAuth(null);
                          }}
                          placeholder="-- Select In-Stock Product * --"
                        />
                        {prod ? (
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                            <span>Pack: <b>{prod.packSize}</b></span>
                            <span>·</span>
                            <span>Multiple: <b>×{multiple}</b></span>
                            <span>·</span>
                            <span className="text-emerald-700 font-bold">Stock: {availableStock} Pcs</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 block mt-1">Please select an in-stock product</span>
                        )}

                        {/* FIFO Multi-Lot Split Callout */}
                        {isMultiSplit && (
                          <div className="mt-2 p-2 bg-amber-50/90 border border-amber-300 rounded-lg text-[10px] text-amber-950 font-mono space-y-1">
                            <div className="font-extrabold flex items-center gap-1 text-amber-900 border-b border-amber-200 pb-0.5">
                              <span>⚡ Auto FIFO Stock Split ({lineCalcs.length} Line Rows):</span>
                            </div>
                            {lineCalcs.map((sc, sidx) => (
                              <div key={sidx} className="flex justify-between items-center gap-2 font-semibold">
                                <span>Row {sidx + 1}: <b>{sc.qty} Pcs</b> @ ₹{sc.rate.toFixed(2)} ({sc.batch})</span>
                                <span className="font-bold text-amber-900">₹{sc.taxableValue.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* HSN Code */}
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {prod?.hsnCode || '-'}
                      </td>

                      {/* Batch Number Input (Conditional: locked to N/A unless Coolant Pack) */}
                      <td className="py-2.5 px-3">
                        {(() => {
                          const isCoolant = prod && (prod.name.toLowerCase().includes('coolant pack') || prod.name.toLowerCase().includes('coolant'));
                          if (!isCoolant) {
                            return (
                              <input
                                type="text"
                                disabled
                                value="N/A"
                                className="w-28 border border-slate-200 bg-slate-100 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-400 cursor-not-allowed select-none"
                                title="Batch number is locked to N/A for regular products. Only unlocked for Coolant Pack items."
                              />
                            );
                          }
                          return (
                            <input
                              type="text"
                              value={line.batch === 'N/A' ? '' : (line.batch || '')}
                              onChange={(e) => {
                                const val = e.target.value;
                                setOrderLines(prev => prev.map(l => l.id === line.id ? { ...l, batch: val } : l));
                              }}
                              placeholder="Enter Batch No."
                              className="w-28 border border-indigo-300 bg-white rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-bold"
                              title="Required for Coolant Pack items"
                            />
                          );
                        })()}
                      </td>

                      {/* Locked Rate (FIFO Priority) */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono font-bold text-slate-800">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>₹{calc?.rate ? calc.rate.toFixed(2) : '0.00'}</span>
                        </div>
                        {calc && calc.rate > 0 && (
                          <span className="text-[9px] text-emerald-700 font-bold block mt-0.5">
                            {isMultiSplit ? `Multi-Rate FIFO (${lineCalcs.length} Lots)` : 'Lowest Rate (FIFO)'}
                          </span>
                        )}
                        {calc?.hasMultipleBatches && (
                          <span className="text-[9px] text-indigo-600 font-mono block">
                            {calc.batchesCount} inward batches
                          </span>
                        )}
                      </td>

                      {/* Cases Input with Automated Pack-Size Multiplier Logic */}
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={line.cases}
                          disabled={!line.productId}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                            const computedQty = val === '' ? '' : Math.round(Number(val) * multiple);
                            setOrderLines(prev => prev.map(l => l.id === line.id ? { 
                              ...l, 
                              cases: val, 
                              qty: computedQty 
                            } : l));
                            setDemandAuth(null);
                          }}
                          placeholder="Cases"
                          className="w-20 text-right border border-indigo-300 bg-indigo-50/60 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 rounded-lg px-2.5 py-1.5 font-mono font-bold text-xs text-indigo-950 focus:border-indigo-500 focus:bg-white outline-none transition"
                          title="Enter number of cases. Automatically multiplies by pack size to calculate units"
                        />
                        {prod && (
                          <span className="text-[9px] text-indigo-700 block mt-0.5 font-mono font-bold">
                            ×{multiple} / case
                          </span>
                        )}
                      </td>

                      {/* Quantity Input with Pack-Size Enforcement */}
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min={multiple}
                          step={multiple}
                          value={line.qty}
                          disabled={!line.productId}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                            const computedCases = val === '' ? '' : (multiple > 0 ? (val % multiple === 0 ? val / multiple : Math.ceil(val / multiple)) : val);
                            setOrderLines(prev => prev.map(l => l.id === line.id ? { 
                              ...l, 
                              qty: val,
                              cases: computedCases
                            } : l));
                            setDemandAuth(null); // Re-validate if quantity changes
                          }}
                          placeholder="Qty (Pcs)"
                          className={`w-24 text-right border rounded-lg px-2.5 py-1.5 font-mono font-bold text-xs outline-none transition ${
                            calc?.isInvalidMultiple 
                              ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-300' 
                              : 'border-slate-300 bg-white disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 text-slate-900 focus:border-blue-500'
                          }`}
                        />
                        {calc?.isInvalidMultiple && (
                          <div className="mt-1 space-y-1 text-left">
                            <span className="text-[10px] text-red-600 font-bold block font-mono">
                              Must be multiple of {multiple}!
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const q = Number(line.qty) || 0;
                                  const roundedUp = Math.ceil(q / multiple) * multiple;
                                  const c = roundedUp / multiple;
                                  setOrderLines(prev => prev.map(l => l.id === line.id ? { ...l, qty: roundedUp, cases: c } : l));
                                }}
                                className="px-1.5 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 rounded text-[9px] font-bold"
                              >
                                Fix: {Math.ceil((Number(line.qty) || 0) / multiple) * multiple}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Weight */}
                      <td className="py-2.5 px-3 text-right font-mono text-blue-700 font-semibold">
                        {lineWeightSum.toFixed(2)} kg
                      </td>

                      {/* CFT */}
                      <td className="py-2.5 px-3 text-right font-mono text-purple-700 font-semibold">
                        {lineCftSum.toFixed(2)}
                      </td>

                      {/* Taxable Value */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800 font-semibold">
                        ₹{lineTaxableSum.toFixed(2)}
                      </td>

                      {/* Tax (0% Local or 18% IGST) */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {effectiveIsInterState ? `₹${lineGstSum.toFixed(2)} (18%)` : '₹0.00 (0%)'}
                      </td>

                      {/* Line Total */}
                      <td className="py-2.5 px-3 text-right font-mono font-black text-blue-900">
                        ₹{lineTotalSum.toFixed(2)}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition cursor-pointer"
                          title="Remove item line"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t border-slate-300 text-slate-900">
                  <td colSpan={3} className="py-3 px-3 font-extrabold text-xs">Cumulative Invoice Totals</td>
                  <td className="py-3 px-3 text-right font-mono text-indigo-900 font-black">{calculations.totalCases} Cases</td>
                  <td className="py-3 px-3 text-right font-mono text-blue-900 font-black">{calculations.totalQty} Pcs</td>
                  <td className="py-3 px-3 text-right font-mono text-blue-700">{calculations.totalWeightKg} kg</td>
                  <td className="py-3 px-3 text-right font-mono text-purple-700">{calculations.totalCft} CFT</td>
                  <td className="py-3 px-3 text-right font-mono font-bold">₹{calculations.totalTaxable}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold">₹{calculations.totalGst}</td>
                  <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 text-sm">
                    ₹{calculations.grandTotal}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            {/* Quick Action to Dynamically Add Another Line Item */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50 p-3 rounded-b-xl border-t border-slate-200">
              <span className="text-xs text-slate-600 font-medium">
                Multiple line items configured: <strong className="text-blue-900 font-bold">{orderLines.length}</strong> {orderLines.length === 1 ? 'row' : 'rows'}
              </span>
              <button
                type="button"
                onClick={handleAddLine}
                disabled={inStockProducts.length === 0}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-xs ${
                  inStockProducts.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-95'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Line Item / Add Row</span>
              </button>
            </div>
          </div>
        </div>

        {/* ==========================================================
            STEP 5: TRANSPORT & DISPATCH DETAILS (NO E-WAY BILL)
            ========================================================== */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-200">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">3</span>
            <span>Transport & Logistics Credentials (No E-way Bill)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            {/* Transport Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Transport Name:</label>
              <SearchableSelect
                options={[
                  'Direct Dispatch / Self',
                  ...companyTransporters.map(t => ({
                    label: t.name,
                    value: t.name
                  }))
                ]}
                value={transName}
                onChange={(val) => setTransName(val)}
                placeholder="-- Select Transporter / Dispatch Mode --"
              />
            </div>

            {/* LR Number */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">LR Number:</label>
              <input
                type="text"
                value={lrNo}
                onChange={(e) => setLrNo(e.target.value)}
                placeholder="e.g. LR-78901"
                className={`w-full rounded-lg px-3 py-2 text-xs font-mono font-bold outline-none transition ${
                  !lrNo.trim() 
                    ? 'bg-red-50/20 border border-red-400 text-slate-900 focus:ring-1 focus:ring-red-500' 
                    : 'bg-white border border-slate-300 text-slate-900 focus:ring-1 focus:ring-blue-500'
                }`}
              />
            </div>

            {/* LR Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">LR Date:</label>
              <input
                type="date"
                value={lrDate}
                onChange={(e) => setLrDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Vehicle Number */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Vehicle Number:</label>
              <input
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="e.g. MP09-AB-1234"
                className={`w-full rounded-lg px-3 py-2 text-xs font-mono font-bold uppercase outline-none transition ${
                  !vehicleNo.trim() 
                    ? 'bg-red-50/20 border border-red-400 text-slate-900 focus:ring-1 focus:ring-red-500' 
                    : 'bg-white border border-slate-300 text-slate-900 focus:ring-1 focus:ring-blue-500'
                }`}
              />
            </div>
          </div>
        </div>

        {/* ==========================================================
            STEP 6: SUMMARY BREAKDOWN & AMOUNT IN WORDS
            ========================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Total Metrics Box */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-blue-600" />
              <span>Consignment Specifications</span>
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-sans">Total Dispatched Weight</span>
                <span className="font-mono font-bold text-blue-800 text-sm">{calculations.totalWeightKg} kg</span>
                <span className="text-[10px] text-slate-500 font-mono block">({calculations.totalWeightMt} MT)</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-sans">Total Dispatched Volume</span>
                <span className="font-mono font-bold text-purple-800 text-sm">{calculations.totalCft} CFT</span>
                <span className="text-[10px] text-slate-500 font-mono block">Cubic Feet Vol</span>
              </div>
            </div>
          </div>

          {/* Amount in Words Box */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Grand Total in Words (INR):
            </span>
            <div className="bg-white p-3 rounded-lg border border-slate-200 my-1">
              <p className="font-extrabold text-slate-900 italic text-xs leading-relaxed">
                {calculations.amountInWords}
              </p>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono pt-1">
              <span>Taxable: ₹{calculations.totalTaxable}</span>
              <span>+ {effectiveIsInterState ? `IGST (18%): ₹${calculations.totalGst}` : '0% GST (Exempt): ₹0.00'}</span>
              <span className="font-bold text-emerald-700">Total: ₹{calculations.grandTotal}</span>
            </div>
          </div>
        </div>

        {/* Success Confirmation Banner with newly generated Invoice Number */}
        {justCreatedInvoice && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl shadow-sm space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                      Invoice Generated Successfully!
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md font-mono text-xs font-black bg-white text-emerald-950 border border-emerald-300 shadow-2xs">
                      {justCreatedInvoice.invNo}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      justCreatedInvoice.isInterState 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {justCreatedInvoice.isInterState ? 'Tax Invoice (18% IGST)' : 'Delivery Challan (0% GST)'}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-1">
                    Party: <strong className="text-emerald-950">{justCreatedInvoice.partyName}</strong> • {justCreatedInvoice.totalCases} Cases ({justCreatedInvoice.totalQty} Units) • Total Value: <strong className="text-emerald-950">₹{justCreatedInvoice.grandTotal}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
                {onNavigateToPreview && (
                  <button
                    type="button"
                    onClick={() => onNavigateToPreview(justCreatedInvoice.invNo)}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                    title="View and print newly generated invoice"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>View / Print Invoice</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setJustCreatedInvoice(null)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  ✕ Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Message */}
        {formMsg && !justCreatedInvoice && (
          <div className={`p-4 rounded-xl flex items-center gap-3 text-xs font-bold ${
            formMsg.isError 
              ? 'bg-red-50 text-red-800 border border-red-200' 
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}>
            {formMsg.isError ? (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <span>{formMsg.text}</span>
          </div>
        )}

        {/* ==========================================================
            SUBMIT / GENERATE INVOICE BUTTON
            ========================================================== */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSubmitInvoice}
            disabled={isSaveDisabled}
            className={`w-full py-4 rounded-xl text-sm font-black flex items-center justify-center gap-2.5 transition shadow-sm cursor-pointer ${
              isSaveDisabled
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 hover:shadow-md active:scale-[0.99]'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                <span>Generating & Persisting Outward Invoice ({currentInvNo})...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Generate & Save Outward {effectiveIsInterState ? 'Tax Invoice' : 'Delivery Challan'} ({currentInvNo}) & Deduct Inventory Stock</span>
              </>
            )}
          </button>
          {isSaveDisabled && !isSubmitting && (
            <p className="text-center text-[11px] text-red-500 font-bold mt-2">
              {!selectedPartyName
                ? 'Please select a Sold To Party (Client) from the dropdown to proceed.'
                : !hasValidLines || calculations.totalQty <= 0
                ? 'Please select product(s) and specify positive dispatch quantities (cases/units).'
                : !transName.trim() || !lrNo.trim() || !vehicleNo.trim()
                ? 'Please fill in all mandatory fields: Transporter Name, LR/GR Number, and Vehicle Number before generating the invoice.'
                : calculations.hasPackSizeError 
                ? 'Fix pack-size multiple error before proceeding.'
                : isSaveBlockedByDemand
                ? 'Requested quantity exceeds monthly demand quota. Click "Request / Grant Admin Authorization" above to approve excess dispatch.'
                : inStockProducts.length === 0
                ? 'No products with available inventory stock > 0.'
                : 'Complete all required client and item fields to generate invoice.'}
            </p>
          )}
        </div>
      </div>

      {/* ==========================================================
          ADMIN DEMAND AUTHORIZATION POP-UP / MODAL
          ========================================================== */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Manager / Admin Authorization Pop-up
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Monthly Client Demand Quota Override Verification
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                <p className="font-extrabold text-rose-950 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Demand Quota Exceeded for {selectedPartyName}</span>
                </p>
                <p className="text-rose-800 text-[11px]">
                  The dispatch requested on invoice {currentInvNo} exceeds the client&apos;s contractual monthly limit. Normal order entry is blocked until management approval is formally recorded.
                </p>
              </div>

              {/* Excess Details Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <th className="py-2 px-3">Product Name</th>
                      <th className="py-2 px-3 text-right">Monthly Quota</th>
                      <th className="py-2 px-3 text-right">Dispatched</th>
                      <th className="py-2 px-3 text-right">Requested</th>
                      <th className="py-2 px-3 text-right font-extrabold text-rose-700">Excess Over Limit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {demandCheck.issues.map((iss, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-sans font-bold text-slate-900">{iss.productName}</td>
                        <td className="py-2 px-3 text-right">{iss.limit}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{iss.dispatched}</td>
                        <td className="py-2 px-3 text-right font-bold text-blue-900">{iss.requested}</td>
                        <td className="py-2 px-3 text-right font-black text-rose-700 bg-rose-50/50">+{iss.excess} Pcs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Authorization Form Fields */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Approving Manager / Supervisor Name: *
                    </label>
                    <input
                      type="text"
                      value={authManagerName}
                      onChange={(e) => setAuthManagerName(e.target.value)}
                      placeholder="e.g. Operations Manager / Plant Head"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Authorization Reason Category: *
                    </label>
                    <select
                      value={authReason}
                      onChange={(e) => setAuthReason(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="Urgent Customer Breakdown Exception">Urgent Customer Breakdown Exception</option>
                      <option value="Special Approval by Regional Sales Head">Special Approval by Regional Sales Head</option>
                      <option value="Emergency Production Run">Emergency Production Run</option>
                      <option value="Advance Allocation against Next Month Quota">Advance Allocation against Next Month Quota</option>
                      <option value="Management Approved Written Exception">Management Approved Written Exception</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Approval Notes / Approval Reference:
                  </label>
                  <input
                    type="text"
                    value={authNotes}
                    onChange={(e) => setAuthNotes(e.target.value)}
                    placeholder="e.g. Email confirmation from Sales Head dated 2026-04-02"
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={authConfirmed}
                    onChange={(e) => setAuthConfirmed(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-700 font-medium">
                    I confirm that I have reviewed the client demand quota and formally authorize this excess dispatch order as an approved operational exception.
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel / Reject Excess
                </button>
                <button
                  type="button"
                  disabled={!authManagerName.trim() || !authConfirmed}
                  onClick={() => {
                    setDemandAuth({
                      isAuthorized: true,
                      authorizedBy: authManagerName.trim(),
                      reason: authReason,
                      notes: authNotes.trim(),
                      authorizedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    });
                    setShowAuthModal(false);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm ${
                    !authManagerName.trim() || !authConfirmed
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Approve & Authorize Excess Dispatch</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          PARTY & LOCATION DEMAND & DISPATCH SUMMARY POP-UP MODAL
          ========================================================== */}
      {showDemandSummaryModal && selectedPartyName && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-white">
                      Party & Location Demand & Dispatch Summary
                    </h3>
                    <span className="text-[10px] bg-blue-900 text-blue-200 border border-blue-700 px-2 py-0.5 rounded font-mono font-bold">
                      {targetCompany === 'HPL' ? 'AHPL' : 'AIL'} Series
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Real-time demand tracking, historical dispatches, and pending stock reconciliation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDemandSummaryModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                title="Close summary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Party & Location Metadata Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Sold To Party (Client)</span>
                  <p className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{partyDemandSummary.partyName}</span>
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Dispatch Destination Location</span>
                  <p className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{partyDemandSummary.location}</span>
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">GSTIN / UIN</span>
                  <p className="font-mono font-bold text-blue-900 text-xs">
                    {activeParty?.gstin || '23UNREGISTERED'}
                  </p>
                </div>
              </div>

              {/* Demand & Dispatch Quick KPI Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-center space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-blue-700 block">Total Demand Limit</span>
                  <span className="text-lg font-black font-mono text-blue-950">{partyDemandSummary.totalDemandQty} Pcs</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-600 block">Already Dispatched</span>
                  <span className="text-lg font-black font-mono text-slate-900">{partyDemandSummary.totalDispatchedQty} Pcs</span>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-center space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 block">Pending to Dispatch</span>
                  <span className="text-lg font-black font-mono text-emerald-900">{partyDemandSummary.totalPendingQty} Pcs</span>
                </div>
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 text-center space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 block">Current Invoice Draft</span>
                  <span className="text-lg font-black font-mono text-indigo-900">{partyDemandSummary.totalDraftQty} Pcs</span>
                </div>
              </div>

              {/* SKU-Wise Demand & Dispatch Ledgers Table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span>SKU-Wise Demand & Dispatch Real-Time Breakdown</span>
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {partyDemandSummary.items.length} SKUs Listed
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                        <th className="py-2.5 px-3">SKU / Product Description</th>
                        <th className="py-2.5 px-3 text-right">Total Demand</th>
                        <th className="py-2.5 px-3 text-right text-slate-600">Already Dispatched</th>
                        <th className="py-2.5 px-3 text-right text-emerald-700 font-extrabold">Pending Qty</th>
                        <th className="py-2.5 px-3 text-right text-indigo-900">Current Draft</th>
                        <th className="py-2.5 px-3 text-right font-bold">Balance After Draft</th>
                        <th className="py-2.5 px-3 text-center">Quota Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                      {partyDemandSummary.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-sans font-bold text-slate-900">{it.productName}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">{it.totalDemand} Pcs</td>
                          <td className="py-2.5 px-3 text-right text-slate-600">{it.alreadyDispatched} Pcs</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700 bg-emerald-50/30">
                            {it.pendingQty} Pcs
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-indigo-900">{it.currentDraftQty} Pcs</td>
                          <td className={`py-2.5 px-3 text-right font-black ${
                            it.remAfterDraft < 0 ? 'text-rose-600 bg-rose-50/50' : 'text-slate-800'
                          }`}>
                            {it.remAfterDraft} Pcs
                          </td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${it.statusColor}`}>
                              {it.statusLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Information Note */}
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <b>Real-Time Demand Reconciliation:</b> Historical dispatches are calculated dynamically from non-cancelled invoice ledgers. Pending quantity represents unfulfilled contractual demand. If current order exceeds pending balance, manager authorization will be prompted upon generation.
                </p>
              </div>

              {/* Action Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDemandSummaryModal(false)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer active:scale-95 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Acknowledge & Proceed to Invoice Entry</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Wrapped export with Error Boundary to guarantee zero white screen crashes
export const OutwardOrderEntryForm: React.FC<OutwardOrderEntryFormProps> = (props) => {
  return (
    <OrderFormErrorBoundary>
      <OutwardOrderEntryFormContent {...props} />
    </OrderFormErrorBoundary>
  );
};
