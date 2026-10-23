import {
  db,
  auth,
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  writeBatch
} from '../firebase';
import { getDoc, getDocFromServer, runTransaction } from 'firebase/firestore';
import {
  UserAccount,
  PlanEntry,
  LoadUnloadEntry,
  SecurityGateEntry,
  TrackingRecord
} from '../types';
import {
  ThermocolInward,
  ThermocolInvoice,
  ThermocolProduct,
  ThermocolParty,
  ThermocolTransporter,
  ClientDemand,
  InvoiceAuditLog
} from '../views/thermocol/types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export const isQuotaOrNetworkError = (err: any): boolean => {
  if (!err) return false;
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    msg.includes('quota') ||
    msg.includes('exceeded') ||
    msg.includes('offline') ||
    msg.includes('network')
  );
};

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Error Info: ', JSON.stringify(errInfo));
}

/**
 * Executes a Promise with a timeout limit.
 * If the promise does not resolve within ms milliseconds, it resolves with fallback
 * preventing infinite hangs or blocking loaders during Firestore network delays or quota limits.
 */
export const withTimeout = <T>(promise: Promise<T>, ms = 2500, fallback: T): Promise<T> => {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[Firestore Safe Timeout] Operation exceeded ${ms}ms limit. Proceeding with fallback.`);
      resolve(fallback);
    }, ms);
  });

  return Promise.race([
    promise.then((res) => {
      if (timer) clearTimeout(timer);
      return res;
    }).catch((err) => {
      if (timer) clearTimeout(timer);
      console.warn('[Firestore Operation Catch]:', err);
      return fallback;
    }),
    timeoutPromise
  ]);
};

// Connection test on boot & cleanup of obsolete monolithic documents exceeding Firestore 1MB limit
export const cleanupObsoleteMonolithicDocs = async (): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'thermocol_packing', 'invoices'));
    console.log('[Firestore Cleanup] Purged obsolete bloated monolithic invoices document');
  } catch (e) {
    // Non-blocking
  }
  try {
    await deleteDoc(doc(db, 'thermocol_packing', 'inwards'));
    console.log('[Firestore Cleanup] Purged obsolete bloated monolithic inwards document');
  } catch (e) {
    // Non-blocking
  }
};

export async function testFirestoreConnection() {
  try {
    console.log('[Firestore] Testing connection to Firestore database...');
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firestore] Connection test successful. Database is online and synchronized.');
  } catch (error) {
    console.log('[Firestore] Connection test reachability checked.');
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("[Firestore Warning] Please check your Firebase configuration: client is offline.");
    }
  }

  // Purge obsolete monolithic documents that cause 1MB quota errors
  cleanupObsoleteMonolithicDocs().catch(() => {});
}
testFirestoreConnection();

// Collection Names in Firestore
export const COLLECTIONS = {
  OPERATIONS: 'ich_operations',
  SECURITY_LOGS: 'ich_security_logs',
  PLAN_ENTRIES: 'ich_plan_entries',
  TRACKING_RECORDS: 'ich_tracking_records',
  USERS: 'ich_users',
  MASTER_TRANSPORTERS: 'ich_master_transporters',
  MASTER_VEHICLE_TYPES: 'ich_master_vehicle_types',
  MASTER_LOAD_LOCATIONS: 'ich_master_load_locations',
  MASTER_UNLOAD_LOCATIONS: 'ich_master_unload_locations',
  MASTER_SUPERVISORS: 'ich_master_supervisors',
  ARCHIVED_PLAN_ENTRIES: 'ich_archived_plan_entries',
  PACKING_INWARDS: 'packing_inwards',
  PACKING_OUTWARDS: 'packing_outwards',
  PACKING_CUSTOMERS: 'packing_customers',
  PACKING_TRANSPORTERS: 'packing_transporters',
  PACKING_MASTER: 'packing_master',
  TH_INWARDS: 'ich_th_inwards',
  TH_INVOICES: 'ich_th_invoices',
  TH_PRODUCTS: 'ich_th_products',
  TH_PARTIES: 'ich_th_parties',
  TH_TRANSPORTERS: 'ich_th_transporters',
  TH_DEMANDS: 'ich_th_demands',
  TH_AUDITS: 'ich_th_audits',
  TH_SEQUENCES: 'ich_th_sequences',
  THERMOCOL_PACKING: 'thermocol_packing',

  // Active Canonical Collections matching user schema
  CUSTOMERS: 'customers',
  PRODUCTS: 'products',
  INWARD_STOCK: 'inwardStock',
  TRANSPORT_MASTER: 'transportMaster'
};

// ==========================================
// REAL-TIME LISTENERS (onSnapshot)
// ==========================================

// Helper function to normalize any raw date string/number/timestamp into YYYY-MM-DD local format
function normalizeDateToYmd(val: any): string {
  if (!val) return '';
  const str = String(val).trim();
  
  // 1. YYYY-MM-DD
  const ymd = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }

  // 2. DD/MM/YYYY (Assuming Indian/International format)
  const slash = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slash) {
    const day = slash[1].padStart(2, '0');
    const month = slash[2].padStart(2, '0');
    const year = slash[3];
    return `${year}-${month}-${day}`;
  }

  // 3. Fallback to Date object parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return '';
}

export const subscribeToOperations = (
  callback: (data: LoadUnloadEntry[]) => void,
  onError?: (err: any) => void
) => {
  console.log(`[Firestore Sub] Connecting to collection: ${COLLECTIONS.OPERATIONS}`);
  const colRef = collection(db, COLLECTIONS.OPERATIONS);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: LoadUnloadEntry[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as any;
        if (!item) return;
        const isInvoice = item.type === 'INVOICE' || item.type === 'CHALLAN' || item.invNo || (item.grandTotal !== undefined && item.partyName) || (item.invNo && (item.invNo.startsWith('AIL') || item.invNo.startsWith('AHPL'))) || item.items;
        if (isInvoice) return;
        if (item.operationType || item.gateId || item.bayNo || item.driverName || (item.vehicleNo && !item.invNo && item.type !== 'INVOICE' && item.type !== 'CHALLAN')) {
          list.push({ ...item, id: docSnap.id });
        }
      });
      console.log(`[Firestore Sync] ${COLLECTIONS.OPERATIONS} snapshot received: ${list.length} docs (fromCache: ${snapshot.metadata.fromCache})`);
      callback(list);
    },
    (err) => {
      if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
        console.warn(`[Firestore Quota Exceeded] ${COLLECTIONS.OPERATIONS} quota limit reached. Falling back to local cache.`);
      } else if (err?.code === 'unavailable') {
        console.warn('Firestore Operations offline; serving from local cache.');
      } else {
        console.error(`[Firestore Error] ${COLLECTIONS.OPERATIONS} sync error:`, err?.code, err?.message);
        handleFirestoreError(err, OperationType.GET, COLLECTIONS.OPERATIONS);
      }
      if (onError) onError(err);
    }
  );
};

export const subscribeToAllIchOperations = (
  onData: (data: {
    inwards?: ThermocolInward[];
    invoices?: ThermocolInvoice[];
    audits?: InvoiceAuditLog[];
    products?: ThermocolProduct[];
    parties?: ThermocolParty[];
    transporters?: ThermocolTransporter[];
    demands?: ClientDemand[];
    operations?: LoadUnloadEntry[];
  }) => void
) => {
  console.log(`[Firestore Sub] Subscribing to ALL documents in ${COLLECTIONS.OPERATIONS}...`);
  const colRef = collection(db, COLLECTIONS.OPERATIONS);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const inwardsMap = new Map<string, ThermocolInward>();
      const invoicesMap = new Map<string, ThermocolInvoice>();
      const auditsMap = new Map<string, InvoiceAuditLog>();
      const productsMap = new Map<string, ThermocolProduct>();
      const partiesMap = new Map<string, ThermocolParty>();
      const transportersMap = new Map<string, ThermocolTransporter>();
      const demandsMap = new Map<string, ClientDemand>();
      const operationsList: LoadUnloadEntry[] = [];

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const id = docSnap.id;
        if (!d) return;

        const isInvoice = d.type === 'INVOICE' || d.type === 'CHALLAN' || d.invNo || (d.grandTotal !== undefined && d.partyName) || (d.invNo && (d.invNo.startsWith('AIL') || d.invNo.startsWith('AHPL'))) || d.items;
        if (isInvoice && d.type !== 'INWARD' && d.invNo !== 'Opening stock') {
          let invNo = d.invNo || id;
          if (!invNo.includes('/') && invNo.includes('_26')) {
            invNo = invNo.replace(/_26$/, '/26');
          }
          invoicesMap.set(invNo, { ...d as ThermocolInvoice, invNo });
          return;
        }

        if (d.type === 'INWARD' || d.grNo || (d.initialQty !== undefined && d.availableQty !== undefined)) {
          const inwId = d.id || id;
          inwardsMap.set(inwId, { ...d as ThermocolInward, id: inwId });
        } else if (d.type === 'AUDIT' || (d.action && d.complianceChecksum)) {
          const audId = d.id || id;
          auditsMap.set(audId, { ...d as InvoiceAuditLog, id: audId });
        } else if (d.type === 'PRODUCT' || (d.name && d.packSize)) {
          const prodKey = `${d.company || 'AIL'}_${String(d.name).trim().toLowerCase()}`;
          productsMap.set(prodKey, { ...d as ThermocolProduct, id: d.id || id });
        } else if (d.type === 'PARTY' || (d.name && d.gstin !== undefined)) {
          const partyKey = `${d.company || 'AIL'}_${String(d.name).trim().toLowerCase()}`;
          partiesMap.set(partyKey, { ...d as ThermocolParty, id: d.id || id });
        } else if (d.type === 'TRANSPORTER' || (d.name && d.transporterCode)) {
          const transKey = `${d.company || 'AIL'}_${String(d.name).trim().toLowerCase()}`;
          transportersMap.set(transKey, { ...d as ThermocolTransporter, id: d.id || id });
        } else if (d.type === 'DEMAND' || (d.partyName && d.monthlyLimit !== undefined)) {
          const demKey = `${d.company || 'AIL'}_${String(d.partyName).trim().toLowerCase()}_${String(d.productName || '').trim().toLowerCase()}`;
          demandsMap.set(demKey, { ...d as ClientDemand, id: d.id || id });
        } else if (d.operationType || d.gateId || d.bayNo || d.driverName) {
          operationsList.push({ ...d as LoadUnloadEntry, id });
        }
      });

      console.log(`[Firestore Sync] ich_operations full snapshot fetched: ${snapshot.size} total docs`);

      onData({
        inwards: Array.from(inwardsMap.values()),
        invoices: Array.from(invoicesMap.values()),
        audits: Array.from(auditsMap.values()),
        products: productsMap.size > 0 ? Array.from(productsMap.values()) : undefined,
        parties: partiesMap.size > 0 ? Array.from(partiesMap.values()) : undefined,
        transporters: transportersMap.size > 0 ? Array.from(transportersMap.values()) : undefined,
        demands: demandsMap.size > 0 ? Array.from(demandsMap.values()) : undefined,
        operations: operationsList
      });
    },
    (err) => {
      console.warn(`[Firestore Error] ich_operations full sync warning:`, err?.code, err?.message);
    }
  );
};

// ==========================================
// DEEP SANITIZER FOR FIRESTORE (Removes all undefined fields recursively)
// ==========================================
export const deepSanitizeForFirestore = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => deepSanitizeForFirestore(item));
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = deepSanitizeForFirestore(value);
    }
  }
  return clean;
};

// ==========================================
// DIRECT FIRESTORE QUERY FOR INVOICES ('ich_operations')
// ==========================================
export const fetchInvoicesFromIchOperations = async (): Promise<ThermocolInvoice[]> => {
  try {
    console.log(`[Firestore Direct] Querying all invoices from collection: ${COLLECTIONS.OPERATIONS}`);
    const colRef = collection(db, COLLECTIONS.OPERATIONS);
    const snapshot = await getDocs(colRef);
    const invoicesMap = new Map<string, ThermocolInvoice>();

    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      const id = docSnap.id;
      if (!d) return;

      const isInvoice = (d.type === 'INVOICE' || (d.invNo && d.grandTotal !== undefined && d.partyName)) && d.type !== 'INWARD' && d.invNo !== 'Opening stock';
      if (isInvoice) {
        let invNo = d.invNo || id;
        // Ignore plain number doc IDs or unformatted plain numbers (e.g. '3' or '4')
        if (/^\d{1,4}$/.test(invNo.trim())) {
          return;
        }
        if (!invNo.includes('/') && invNo.includes('_26')) {
          invNo = invNo.replace(/_26$/, '/26');
        }
        const company = d.company || (invNo.startsWith('AHPL') ? 'HPL' : 'AIL');
        invoicesMap.set(invNo, {
          ...d as any,
          invNo,
          company,
          items: Array.isArray(d.items) ? d.items : [],
          totalTaxable: String(d.totalTaxable || '0'),
          totalGst: String(d.totalGst || '0'),
          grandTotal: String(d.grandTotal || '0'),
          totalQty: Number(d.totalQty) || 0,
          totalCases: Number(d.totalCases) || 0,
          date: d.date || (d.createdAt ? d.createdAt.split('T')[0] : new Date().toISOString().split('T')[0])
        });
      }
    });

    // Secondary fallback to packing_outwards if ich_operations yielded 0 invoices
    if (invoicesMap.size === 0) {
      try {
        const snapOut = await getDocs(collection(db, COLLECTIONS.PACKING_OUTWARDS));
        snapOut.forEach((docSnap) => {
          const d = docSnap.data();
          if (d && (d.invNo || d.items)) {
            let invNo = d.invNo || docSnap.id;
            invoicesMap.set(invNo, { ...d as any, invNo, items: Array.isArray(d.items) ? d.items : [] });
          }
        });
      } catch (e) {
        // non-blocking
      }
    }

    const result = Array.from(invoicesMap.values()).sort((a, b) => {
      const timeA = new Date(a.date || a.createdAt || 0).getTime();
      const timeB = new Date(b.date || b.createdAt || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return b.invNo.localeCompare(a.invNo);
    });

    console.log(`[Firestore Direct] Successfully retrieved ${result.length} invoices from ich_operations`);
    return result;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded') || String(err).includes('Quota exceeded')) {
      console.warn('[Firestore Direct Quota Warning] Quota exceeded fetching invoices from ich_operations. Serving from local storage cache.');
    } else {
      console.warn('[Firestore Direct] Warning fetching invoices from ich_operations:', err);
    }
    return [];
  }
};

// ==========================================
// EXPLICIT getDocs DATA LOADER FOR ich_operations (APP STARTUP & REFRESH)
// ==========================================
export const fetchIchOperationsWithGetDocs = async (): Promise<{
  operations: LoadUnloadEntry[];
  inwards: ThermocolInward[];
  invoices: ThermocolInvoice[];
  audits: InvoiceAuditLog[];
  products: ThermocolProduct[];
  parties: ThermocolParty[];
  transporters: ThermocolTransporter[];
  demands: ClientDemand[];
}> => {
  try {
    console.log(`[Firestore getDocs] Explicitly fetching all documents from collection: ${COLLECTIONS.OPERATIONS}`);
    const colRef = collection(db, COLLECTIONS.OPERATIONS);
    const snapshot = await getDocs(colRef);
    console.log(`[Firestore getDocs] Retrieved ${snapshot.size} documents from ${COLLECTIONS.OPERATIONS}`);

  const inwardsMap = new Map<string, ThermocolInward>();
  const invoicesMap = new Map<string, ThermocolInvoice>();
  const auditsMap = new Map<string, InvoiceAuditLog>();
  const productsMap = new Map<string, ThermocolProduct>();
  const partiesMap = new Map<string, ThermocolParty>();
  const transportersMap = new Map<string, ThermocolTransporter>();
  const demandsMap = new Map<string, ClientDemand>();
  const operationsList: LoadUnloadEntry[] = [];

  snapshot.forEach((docSnap) => {
    const d = docSnap.data();
    const id = docSnap.id;
    if (!d) return;

    const isInvoice = d.type === 'INVOICE' || d.type === 'CHALLAN' || d.invNo || (d.grandTotal !== undefined && d.partyName) || (d.invNo && (d.invNo.startsWith('AIL') || d.invNo.startsWith('AHPL'))) || d.items;
    if (isInvoice && d.type !== 'INWARD' && d.invNo !== 'Opening stock') {
      let invNo = d.invNo || id;
      if (!invNo.includes('/') && invNo.includes('_26')) {
        invNo = invNo.replace(/_26$/, '/26');
      }
      const company = d.company || (invNo.startsWith('AHPL') ? 'HPL' : 'AIL');
      invoicesMap.set(invNo, {
        ...d as any,
        invNo,
        company,
        items: Array.isArray(d.items) ? d.items : [],
        totalTaxable: String(d.totalTaxable || '0'),
        totalGst: String(d.totalGst || '0'),
        grandTotal: String(d.grandTotal || '0'),
        totalQty: Number(d.totalQty) || 0,
        totalCases: Number(d.totalCases) || 0,
        date: d.date || (d.createdAt ? d.createdAt.split('T')[0] : new Date().toISOString().split('T')[0])
      });
      return;
    }

    if (d.type === 'INWARD' || d.grNo || (d.initialQty !== undefined && d.availableQty !== undefined)) {
      const inwId = d.id || id;
      inwardsMap.set(inwId, { ...d as ThermocolInward, id: inwId });
    } else if (d.type === 'AUDIT' || (d.action && d.complianceChecksum)) {
      const audId = d.id || id;
      auditsMap.set(audId, { ...d as InvoiceAuditLog, id: audId });
    } else if (d.type === 'PRODUCT' || (d.name && d.packSize)) {
      const prodKey = `${d.company || 'AIL'}_${String(d.name).trim().toLowerCase()}`;
      productsMap.set(prodKey, { ...d as ThermocolProduct, id: d.id || id });
    } else if (d.type === 'PARTY' || (d.name && d.gstin !== undefined)) {
      const partyKey = `${d.company || 'AIL'}_${String(d.name).trim().toLowerCase()}`;
      partiesMap.set(partyKey, { ...d as ThermocolParty, id: d.id || id });
    } else if (d.type === 'TRANSPORTER' || (d.name && d.transporterCode)) {
      const transKey = `${d.company || 'AIL'}_${String(d.name).trim().toLowerCase()}`;
      transportersMap.set(transKey, { ...d as ThermocolTransporter, id: d.id || id });
    } else if (d.type === 'DEMAND' || (d.partyName && d.monthlyLimit !== undefined)) {
      const demKey = `${d.company || 'AIL'}_${String(d.partyName).trim().toLowerCase()}_${String(d.productName || '').trim().toLowerCase()}`;
      demandsMap.set(demKey, { ...d as ClientDemand, id: d.id || id });
    } else if (d.operationType || d.gateId || d.bayNo || d.driverName) {
      operationsList.push({ ...d as LoadUnloadEntry, id });
    }
  });

    return {
      operations: operationsList,
      inwards: Array.from(inwardsMap.values()),
      invoices: Array.from(invoicesMap.values()),
      audits: Array.from(auditsMap.values()),
      products: Array.from(productsMap.values()),
      parties: Array.from(partiesMap.values()),
      transporters: Array.from(transportersMap.values()),
      demands: Array.from(demandsMap.values())
    };
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded') || String(err).includes('Quota exceeded')) {
      console.warn('[Firestore getDocs Quota Warning] Quota limit reached for ich_operations. Serving from local cache.');
    } else {
      console.warn('[Firestore getDocs Warning] Failed to fetch ich_operations with getDocs:', err);
    }
    return {
      operations: [],
      inwards: [],
      invoices: [],
      audits: [],
      products: [],
      parties: [],
      transporters: [],
      demands: []
    };
  }
};

export const addOperationWithAddDoc = async (data: any): Promise<string> => {
  const colRef = collection(db, COLLECTIONS.OPERATIONS);
  const cleanData: Record<string, any> = {
    ...data,
    entryDate: data.entryDate || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  Object.keys(cleanData).forEach(key => {
    if (cleanData[key] === undefined) delete cleanData[key];
  });
  const res = await addDoc(colRef, cleanData);
  return res.id;
};

export const subscribeToSecurityLogs = (
  callback: (data: SecurityGateEntry[]) => void,
  onError?: (err: any) => void
) => {
  console.log(`[Firestore Sub] Connecting to collection: ${COLLECTIONS.SECURITY_LOGS}`);
  const colRef = collection(db, COLLECTIONS.SECURITY_LOGS);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: SecurityGateEntry[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as SecurityGateEntry;
        list.push({ ...item, id: docSnap.id });
      });
      console.log(`[Firestore Sync] ${COLLECTIONS.SECURITY_LOGS} snapshot received: ${list.length} docs (fromCache: ${snapshot.metadata.fromCache})`);
      callback(list);
    },
    (err) => {
      if (isQuotaOrNetworkError(err)) {
        console.warn(`[Firestore Quota/Network Error] ${COLLECTIONS.SECURITY_LOGS} sync issues. Serving from local cache.`);
      } else {
        console.error(`[Firestore Error] ${COLLECTIONS.SECURITY_LOGS} sync error:`, err?.code, err?.message);
        handleFirestoreError(err, OperationType.GET, COLLECTIONS.SECURITY_LOGS);
      }
      if (onError) onError(err);
    }
  );
};

export const subscribeToPlanEntries = (
  callback: (data: PlanEntry[]) => void,
  onError?: (err: any) => void,
  startDateIso?: string,
  endDateIso?: string
) => {
  console.log(`[Firestore Sub] Connecting to collection: ${COLLECTIONS.PLAN_ENTRIES}`);
  const colRef = collection(db, COLLECTIONS.PLAN_ENTRIES);
  
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: PlanEntry[] = [];
      snapshot.forEach((docSnap) => {
        const item = { ...(docSnap.data() as PlanEntry), id: docSnap.id };
        if (startDateIso && endDateIso) {
          const itemRaw = item.date || item.planDate || item.targetDate || item.entryDate || item.createdAt || item.updatedAt || '';
          
          // Use normalizeDateToYmd to ensure YYYY-MM-DD
          const itemYmd = normalizeDateToYmd(itemRaw);
          const startYmd = startDateIso.slice(0, 10);
          const endYmd = endDateIso.slice(0, 10);
          
          if (!itemYmd || itemYmd < startYmd || itemYmd > endYmd) {
            return;
          }
        }
        list.push(item);
      });

      list.sort((a, b) => {
        const aTime = a.updatedAt || a.date || a.createdAt ? new Date(a.updatedAt || a.date || a.createdAt || '').getTime() : 0;
        const bTime = b.updatedAt || b.date || b.createdAt ? new Date(b.updatedAt || b.date || b.createdAt || '').getTime() : 0;
        return bTime - aTime;
      });

      console.log(`[Firestore Sync] ${COLLECTIONS.PLAN_ENTRIES} snapshot received: ${list.length} docs matching filter (fromCache: ${snapshot.metadata.fromCache})`);
      callback(list);
    },
    (err) => {
      if (isQuotaOrNetworkError(err)) {
        console.warn(`[Firestore Quota/Network Error] ${COLLECTIONS.PLAN_ENTRIES} sync issues. Serving from local cache.`);
      } else {
        console.error(`[Firestore Error] ${COLLECTIONS.PLAN_ENTRIES} sync error:`, err?.code, err?.message);
        handleFirestoreError(err, OperationType.GET, COLLECTIONS.PLAN_ENTRIES);
      }
      if (onError) onError(err);
    }
  );
};

export const subscribeToTrackingRecords = (
  callback: (data: TrackingRecord[]) => void,
  onError?: (err: any) => void,
  startDateIso?: string,
  endDateIso?: string
) => {
  console.log(`[Firestore Sub] Connecting to collection: ${COLLECTIONS.TRACKING_RECORDS}`);
  const colRef = collection(db, COLLECTIONS.TRACKING_RECORDS);
  let q: any = colRef;
  if (startDateIso && endDateIso) {
    q = query(colRef, where('updatedAt', '>=', startDateIso), where('updatedAt', '<=', endDateIso));
  }
  return onSnapshot(
    q,
    (snapshot) => {
      const list: TrackingRecord[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as TrackingRecord;
        list.push({ ...item, id: docSnap.id });
      });
      console.log(`[Firestore Sync] ${COLLECTIONS.TRACKING_RECORDS} snapshot received: ${list.length} docs (fromCache: ${snapshot.metadata.fromCache})`);
      callback(list);
    },
    (err) => {
      if (isQuotaOrNetworkError(err)) {
        console.warn(`[Firestore Quota/Network Error] ${COLLECTIONS.TRACKING_RECORDS} sync issues. Serving from local cache.`);
      } else {
        console.error(`[Firestore Error] ${COLLECTIONS.TRACKING_RECORDS} sync error:`, err?.code, err?.message);
        handleFirestoreError(err, OperationType.GET, COLLECTIONS.TRACKING_RECORDS);
      }
      if (onError) onError(err);
    }
  );
};

export const subscribeToUsers = (
  callback: (data: UserAccount[]) => void,
  onError?: (err: any) => void
) => {
  console.log(`[Firestore Sub] Connecting to collection: ${COLLECTIONS.USERS}`);
  const colRef = collection(db, COLLECTIONS.USERS);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: UserAccount[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as UserAccount;
        list.push({ ...item, user: docSnap.id });
      });
      console.log(`[Firestore Sync] ${COLLECTIONS.USERS} snapshot received: ${list.length} docs (fromCache: ${snapshot.metadata.fromCache})`);
      callback(list);
    },
    (err) => {
      if (isQuotaOrNetworkError(err)) {
        console.warn(`[Firestore Quota/Network Error] ${COLLECTIONS.USERS} sync issues. Serving from local cache.`);
      } else {
        console.error(`[Firestore Error] ${COLLECTIONS.USERS} sync error:`, err?.code, err?.message);
        handleFirestoreError(err, OperationType.GET, COLLECTIONS.USERS);
      }
      if (onError) onError(err);
    }
  );
};

export const subscribeToMasterList = (
  collectionName: string,
  callback: (data: string[]) => void,
  onError?: (err: any) => void
) => {
  console.log(`[Firestore Sub] Connecting to master collection: ${collectionName}`);
  const colRef = collection(db, collectionName);

  if (collectionName === COLLECTIONS.MASTER_TRANSPORTERS) {
    let list1: string[] = [];
    let list2: string[] = [];

    const emitMerged = () => {
      const set = new Set<string>();
      [...list1, ...list2].forEach(name => {
        if (name && name.trim()) set.add(name.trim());
      });
      callback(Array.from(set));
    };

    const unsub1 = onSnapshot(
      colRef,
      (snapshot) => {
        const docsData: { name: string; order?: number }[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const val = data?.name || docSnap.id;
          if (val) {
            docsData.push({
              name: String(val).trim(),
              order: typeof data?.order === 'number' ? data.order : 999999
            });
          }
        });
        docsData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        list1 = docsData.map((d) => d.name);
        emitMerged();
      },
      (err) => {
        if (isQuotaOrNetworkError(err)) {
          console.warn(`[Firestore Quota/Network Error] Master ${collectionName} sync issues.`);
        } else {
          console.error(`[Firestore Sub] Error in ${collectionName}:`, err);
        }
        if (onError) onError(err);
      }
    );

    const unsub2 = onSnapshot(
      collection(db, COLLECTIONS.TRANSPORT_MASTER),
      (snapshot) => {
        const directList: string[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const val = data?.name || data?.transporter || docSnap.id;
          if (val) directList.push(String(val).trim());
        });
        list2 = directList;
        emitMerged();
      },
      (err) => {
        console.warn('TransportMaster fallback sync notice:', err);
      }
    );

    return () => {
      unsub1();
      unsub2();
    };
  }

  return onSnapshot(
    colRef,
    (snapshot) => {
      const docsData: { name: string; order?: number }[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const val = data?.name || docSnap.id;
        if (val) {
          docsData.push({
            name: String(val).trim(),
            order: typeof data?.order === 'number' ? data.order : 999999
          });
        }
      });
      docsData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const list = docsData.map((d) => d.name);
      console.log(`[Firestore Sync] Master collection ${collectionName} snapshot received: ${list.length} items.`);
      callback(list);
    },
    (err) => {
      if (isQuotaOrNetworkError(err)) {
        console.warn(`[Firestore Quota/Network Error] Master ${collectionName} sync issues.`);
      } else {
        console.error(`[Firestore Sub] Error in ${collectionName}:`, err);
      }
      if (onError) onError(err);
    }
  );
};

// ==========================================

// ==========================================
// FIRESTORE CRUD OPERATIONS (addDoc, setDoc, deleteDoc)
// ==========================================

// Operations (Loading / Unloading)
export const saveOperationToFirestore = async (op: LoadUnloadEntry): Promise<string> => {
  const cleanData: Record<string, any> = {
    ...op,
    entryDate: op.entryDate || new Date().toISOString().split('T')[0],
    totalCases: op.totalCases !== undefined && op.totalCases !== ('' as any) ? Number(op.totalCases) : 0,
    damagedCases: op.damagedCases !== undefined && op.damagedCases !== ('' as any) ? Number(op.damagedCases) : 0,
    damagedValue: op.damagedValue !== undefined && op.damagedValue !== ('' as any) ? Number(op.damagedValue) : 0,
    updatedAt: new Date().toISOString()
  };

  // Remove undefined values
  Object.keys(cleanData).forEach(key => {
    if (cleanData[key] === undefined) {
      delete cleanData[key];
    }
  });

  try {
    if (op.id && !op.id.startsWith('temp-')) {
      const docRef = doc(db, COLLECTIONS.OPERATIONS, op.id);
      await setDoc(docRef, cleanData, { merge: true });
      return op.id;
    } else {
      const colRef = collection(db, COLLECTIONS.OPERATIONS);
      const res = await addDoc(colRef, cleanData);
      return res.id;
    }
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.OPERATIONS);
    throw err;
  }
};

export const deleteOperationFromFirestore = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.OPERATIONS, id);
    await deleteDoc(docRef);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.OPERATIONS);
    throw err;
  }
};

// Security Gate Logs
export const saveSecurityEntryToFirestore = async (entry: SecurityGateEntry): Promise<string> => {
  const cleanData: Record<string, any> = {
    ...entry,
    entryDate: entry.entryDate || new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString()
  };
  Object.keys(cleanData).forEach(key => {
    if (cleanData[key] === undefined) delete cleanData[key];
  });

  try {
    if (entry.id && !entry.id.startsWith('temp-')) {
      const docRef = doc(db, COLLECTIONS.SECURITY_LOGS, entry.id);
      await setDoc(docRef, cleanData, { merge: true });
      return entry.id;
    } else {
      const colRef = collection(db, COLLECTIONS.SECURITY_LOGS);
      const res = await addDoc(colRef, cleanData);
      return res.id;
    }
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.SECURITY_LOGS);
    throw err;
  }
};

export const deleteSecurityEntryFromFirestore = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.SECURITY_LOGS, id);
    await deleteDoc(docRef);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.SECURITY_LOGS);
    throw err;
  }
};

// Plan Entries
export const savePlanEntriesToFirestore = async (entries: PlanEntry[]): Promise<void> => {
  const todayIso = new Date().toISOString().split('T')[0];
  try {
    for (const entry of entries) {
      const cleanData: Record<string, any> = {
        ...entry,
        date: entry.date || entry.planDate || entry.targetDate || entry.entryDate || todayIso,
        updatedAt: new Date().toISOString()
      };
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === undefined) delete cleanData[key];
      });
      if (entry.id && !entry.id.startsWith('temp-')) {
        const docRef = doc(db, COLLECTIONS.PLAN_ENTRIES, entry.id);
        await setDoc(docRef, cleanData, { merge: true });
      } else {
        const colRef = collection(db, COLLECTIONS.PLAN_ENTRIES);
        await addDoc(colRef, cleanData);
      }
    }
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.PLAN_ENTRIES);
    throw err;
  }
};

export const deletePlanEntryFromFirestore = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.PLAN_ENTRIES, id);
    await deleteDoc(docRef);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.PLAN_ENTRIES);
    throw err;
  }
};

// Tracking Records
export const saveTrackingRecordsToFirestore = async (records: TrackingRecord[]): Promise<void> => {
  try {
    for (const rec of records) {
      const cleanData: Record<string, any> = {
        ...rec,
        updatedAt: new Date().toISOString()
      };
      if (rec.id && !rec.id.startsWith('temp-')) {
        const docRef = doc(db, COLLECTIONS.TRACKING_RECORDS, rec.id);
        await setDoc(docRef, cleanData, { merge: true });
      } else {
        const colRef = collection(db, COLLECTIONS.TRACKING_RECORDS);
        await addDoc(colRef, cleanData);
      }
    }
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.TRACKING_RECORDS);
    throw err;
  }
};

export const deleteTrackingRecordFromFirestore = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.TRACKING_RECORDS, id);
    await deleteDoc(docRef);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.TRACKING_RECORDS);
    throw err;
  }
};

// User Accounts
export const saveUserToFirestore = async (user: UserAccount): Promise<void> => {
  const docRef = doc(db, COLLECTIONS.USERS, user.user.toLowerCase().trim());
  await setDoc(docRef, {
    user: user.user.toLowerCase().trim(),
    pass: user.pass,
    role: user.role,
    name: user.name || user.user,
    updatedAt: new Date().toISOString()
  });
};

// Master Lists Bulk Sync & Reconciliation (Replaces and cleans old items with no limitation)
export const syncMasterListToFirestore = async (collectionName: string, items: string[]): Promise<void> => {
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);
    
    // Create clean unique list of items
    const seen = new Set<string>();
    const validItems: string[] = [];
    for (const raw of items) {
      if (raw !== undefined && raw !== null) {
        const clean = String(raw).trim();
        if (clean.length > 0 && !seen.has(clean.toUpperCase())) {
          seen.add(clean.toUpperCase());
          validItems.push(clean);
        }
      }
    }

    // 1. Delete existing documents in chunks of 400 using writeBatch
    const existingDocIds: string[] = [];
    snapshot.forEach((docSnap) => {
      existingDocIds.push(docSnap.id);
    });

    for (let i = 0; i < existingDocIds.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = existingDocIds.slice(i, i + 400);
      chunk.forEach((id) => {
        batch.delete(doc(db, collectionName, id));
      });
      await batch.commit();
    }

    // 2. Insert all items in chunks of 400 using writeBatch with safe doc IDs
    const getDocId = (name: string, index: number) => {
      const clean = name.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase().slice(0, 80);
      return clean.length > 0 ? `${clean}_${index}` : `ITEM_${index}`;
    };

    for (let i = 0; i < validItems.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = validItems.slice(i, i + 400);
      chunk.forEach((item, chunkIdx) => {
        const itemIdx = i + chunkIdx;
        const docId = getDocId(item, itemIdx);
        batch.set(doc(db, collectionName, docId), {
          name: item,
          order: itemIdx,
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
    }
  } catch (error) {
    console.error(`Error syncing master list for ${collectionName}:`, error);
  }
};

export const archivePlanEntriesToFirestore = async (entries: PlanEntry[]): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    entries.forEach((entry) => {
      // Add to archived collection
      const archivedRef = doc(db, COLLECTIONS.ARCHIVED_PLAN_ENTRIES, entry.id);
      batch.set(archivedRef, {
        ...entry,
        status: 'Confirmed Plan',
        archivedAt: (entry as any).archivedAt || nowIso,
        updatedAt: nowIso
      });
      
      // Delete from active collection
      const activeRef = doc(db, COLLECTIONS.PLAN_ENTRIES, entry.id);
      batch.delete(activeRef);
    });
    await batch.commit();
  } catch (error) {
    console.error('Error archiving plan entries:', error);
    throw error;
  }
};

export const subscribeToArchivedPlanEntries = (
  callback: (data: PlanEntry[]) => void,
  startDate?: string,
  endDate?: string
) => {
  const colRef = collection(db, COLLECTIONS.ARCHIVED_PLAN_ENTRIES);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: PlanEntry[] = [];
      snapshot.forEach((docSnap) => {
        const item = { ...(docSnap.data() as PlanEntry), id: docSnap.id };
        if (startDate && endDate) {
          const itemRaw = (item as any).archivedAt || item.date || item.planDate || item.targetDate || item.entryDate || item.updatedAt || item.createdAt || '';
          let dateStr = itemRaw;
          if (!dateStr && item.id.startsWith('PLAN-')) {
            const m = item.id.match(/PLAN-(\d{12,14})/);
            if (m) dateStr = new Date(Number(m[1])).toISOString();
          }
          if (dateStr) {
            const itemYmd = dateStr.slice(0, 10);
            const startYmd = startDate.slice(0, 10);
            const endYmd = endDate.slice(0, 10);
            if (itemYmd < startYmd || itemYmd > endYmd) {
              return;
            }
          } else {
            return;
          }
        }
        list.push(item);
      });

      list.sort((a, b) => {
        const aTime = (a as any).archivedAt || a.updatedAt ? new Date((a as any).archivedAt || a.updatedAt || '').getTime() : 0;
        const bTime = (b as any).archivedAt || b.updatedAt ? new Date((b as any).archivedAt || b.updatedAt || '').getTime() : 0;
        return bTime - aTime;
      });

      callback(list);
    },
    (err) => {
      if (err?.code === 'unavailable') {
        console.warn('Firestore Archived Plan Entries offline; serving from local cache.');
      } else {
        handleFirestoreError(err, OperationType.GET, COLLECTIONS.ARCHIVED_PLAN_ENTRIES);
      }
    }
  );
};

// ==========================================
// THERMOCOL & PACKING MATERIAL FIRESTORE SYNC
// ==========================================

export const subscribeToThermocolInwards = (
  callback: (data: ThermocolInward[]) => void,
  onError?: (err: any) => void
) => {
  const colRefMain = collection(db, COLLECTIONS.PACKING_INWARDS);
  const colRefLegacy = collection(db, COLLECTIONS.TH_INWARDS);
  const colRefDirect = collection(db, COLLECTIONS.INWARD_STOCK);
  const colRefOps = collection(db, COLLECTIONS.OPERATIONS);

  let mainItems: ThermocolInward[] = [];
  let legacyItems: ThermocolInward[] = [];
  let directItems: ThermocolInward[] = [];
  let opsItems: ThermocolInward[] = [];

  const mergeAndEmit = () => {
    const map = new Map<string, ThermocolInward>();
    [...legacyItems, ...directItems, ...opsItems, ...mainItems].forEach(item => {
      const id = item.id;
      if (id && (item.grNo || item.productName || (item as any).type === 'INWARD' || item.receiveDate)) {
        map.set(id, { ...item, id });
      }
    });
    const combined = Array.from(map.values());
    console.log(`[Firestore Sync] Real-time Packing Inwards snapshot merged: ${combined.length} records`);
    callback(combined);
  };

  const unsubMain = onSnapshot(
    colRefMain,
    (snapshot) => {
      const list: ThermocolInward[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as ThermocolInward;
        list.push({ ...d, id: d.id || docSnap.id });
      });
      mainItems = list;
      mergeAndEmit();
    },
    (err) => {
      console.warn('Packing Inwards sync error:', err);
      if (onError) onError(err);
    }
  );

  const unsubDirect = onSnapshot(
    colRefDirect,
    (snapshot) => {
      const list: ThermocolInward[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as ThermocolInward;
        list.push({ ...d, id: d.id || docSnap.id });
      });
      directItems = list;
      mergeAndEmit();
    },
    (err) => {
      console.warn('InwardStock direct collection sync notice:', err);
    }
  );

  const unsubOps = onSnapshot(
    colRefOps,
    (snapshot) => {
      const list: ThermocolInward[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && (d.type === 'INWARD' || d.grNo || d.productName) && (d.initialQty !== undefined || d.availableQty !== undefined)) {
          list.push({ ...d as ThermocolInward, id: d.id || docSnap.id });
        }
      });
      opsItems = list;
      mergeAndEmit();
    },
    (err) => {
      console.warn('ich_operations inwards sync error:', err);
    }
  );

  const unsubLegacy = onSnapshot(
    colRefLegacy,
    (snapshot) => {
      const list: ThermocolInward[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as ThermocolInward;
        list.push({ ...d, id: d.id || docSnap.id });
      });
      legacyItems = list;
      mergeAndEmit();
    },
    (err) => {
      console.warn('TH Inwards sync error:', err);
    }
  );

  return () => {
    unsubMain();
    unsubDirect();
    unsubOps();
    unsubLegacy();
  };
};

export const subscribeToThermocolInvoices = (
  callback: (data: ThermocolInvoice[]) => void,
  onError?: (err: any) => void
) => {
  const colRefMain = collection(db, COLLECTIONS.PACKING_OUTWARDS);
  const colRefLegacy = collection(db, COLLECTIONS.TH_INVOICES);
  const colRefOps = collection(db, COLLECTIONS.OPERATIONS);

  let mainInvoices: ThermocolInvoice[] = [];
  let legacyInvoices: ThermocolInvoice[] = [];
  let opsInvoices: ThermocolInvoice[] = [];

  const mergeAndEmit = () => {
    const map = new Map<string, ThermocolInvoice>();

    // Process legacy, ops, main so latest/main overrides
    [...legacyInvoices, ...opsInvoices, ...mainInvoices].forEach(item => {
      const rawInvNo = item.invNo || (item as any).id;
      if (rawInvNo && (item.items || (item as any).type === 'INVOICE') && (item as any).type !== 'INWARD') {
        let normalizedInvNo = String(rawInvNo).trim();
        // Exclude unformatted plain numbers like '3' or '4'
        if (/^\d{1,4}$/.test(normalizedInvNo)) {
          return;
        }
        if (!normalizedInvNo.includes('/') && normalizedInvNo.includes('_26')) {
          normalizedInvNo = normalizedInvNo.replace(/_26$/, '/26');
        }
        const company = item.company || (normalizedInvNo.startsWith('AHPL') ? 'HPL' : 'AIL');
        map.set(normalizedInvNo, {
          ...item,
          invNo: normalizedInvNo,
          company
        });
      }
    });

    const combined = Array.from(map.values());
    combined.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return b.invNo.localeCompare(a.invNo);
    });

    console.log(`[Firestore Sync] Real-time Packing Outwards / Delivery Challans snapshot merged: ${combined.length} invoices`);
    callback(combined);
  };

  const unsubMain = onSnapshot(
    colRefMain,
    (snapshot) => {
      const list: ThermocolInvoice[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as ThermocolInvoice;
        let invNo = d.invNo || docSnap.id;
        if (/^\d{1,4}$/.test(String(invNo).trim())) return;
        if (!invNo.includes('/') && invNo.includes('_26')) {
          invNo = invNo.replace(/_26$/, '/26');
        }
        list.push({ ...d, invNo });
      });
      mainInvoices = list;
      mergeAndEmit();
    },
    (err) => {
      console.warn('Packing Outwards sync error:', err);
      if (onError) onError(err);
    }
  );

  const unsubOps = onSnapshot(
    colRefOps,
    (snapshot) => {
      const list: ThermocolInvoice[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && (d.invNo || d.type === 'INVOICE') && d.type !== 'INWARD' && d.items) {
          let invNo = d.invNo || docSnap.id;
          if (/^\d{1,4}$/.test(String(invNo).trim())) return;
          if (!invNo.includes('/') && invNo.includes('_26')) {
            invNo = invNo.replace(/_26$/, '/26');
          }
          list.push({ ...d as ThermocolInvoice, invNo });
        }
      });
      opsInvoices = list;
      mergeAndEmit();
    },
    (err) => {
      console.warn('ich_operations invoices sync error:', err);
    }
  );

  const unsubLegacy = onSnapshot(
    colRefLegacy,
    (snapshot) => {
      const list: ThermocolInvoice[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as ThermocolInvoice;
        let invNo = d.invNo || docSnap.id;
        if (!invNo.includes('/') && invNo.includes('_26')) {
          invNo = invNo.replace(/_26$/, '/26');
        }
        list.push({ ...d, invNo });
      });
      legacyInvoices = list;
      mergeAndEmit();
    },
    (err) => {
      console.warn('TH Invoices sync error:', err);
    }
  );

  return () => {
    unsubMain();
    unsubOps();
    unsubLegacy();
  };
};

export const subscribeToThermocolProducts = (
  callback: (data: ThermocolProduct[]) => void,
  onError?: (err: any) => void
) => {
  const colRefPacking = collection(db, COLLECTIONS.PACKING_MASTER);
  const colRefLegacy = collection(db, COLLECTIONS.TH_PRODUCTS);
  const colRefDirect = collection(db, COLLECTIONS.PRODUCTS);
  let packingList: ThermocolProduct[] = [];
  let legacyList: ThermocolProduct[] = [];
  let directList: ThermocolProduct[] = [];

  const emitMerged = () => {
    const map = new Map<string, ThermocolProduct>();
    [...packingList, ...legacyList, ...directList].forEach((p) => {
      if (p && p.name && p.name.trim()) {
        const comp = p.company || 'AIL';
        const key = `${comp}_${p.name.trim().toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, p);
        }
      }
    });
    callback(Array.from(map.values()));
  };

  const unsubPacking = onSnapshot(
    colRefPacking,
    (snapshot) => {
      const list: ThermocolProduct[] = [];
      snapshot.forEach((docSnap) => {
        const p = docSnap.data() as ThermocolProduct;
        if (p && p.name && p.name.trim()) {
          list.push({ ...p, id: p.id || docSnap.id });
        }
      });
      packingList = list;
      emitMerged();
    },
    (err) => {
      console.warn('Packing Master product sync notice:', err);
    }
  );

  const unsubLegacy = onSnapshot(
    colRefLegacy,
    (snapshot) => {
      const list: ThermocolProduct[] = [];
      snapshot.forEach((docSnap) => {
        const p = docSnap.data() as ThermocolProduct;
        if (p && p.name && p.name.trim()) {
          list.push({ ...p, id: p.id || docSnap.id });
        }
      });
      legacyList = list;
      emitMerged();
    },
    (err) => {
      console.warn('Thermocol Products legacy sync error:', err);
      if (onError) onError(err);
    }
  );

  const unsubDirect = onSnapshot(
    colRefDirect,
    (snapshot) => {
      const list: ThermocolProduct[] = [];
      snapshot.forEach((docSnap) => {
        const p = docSnap.data() as ThermocolProduct;
        if (p && p.name && p.name.trim()) {
          list.push({ ...p, id: p.id || docSnap.id });
        }
      });
      directList = list;
      emitMerged();
    },
    (err) => {
      console.warn('Products direct sync notice:', err);
    }
  );

  return () => {
    unsubPacking();
    unsubLegacy();
    unsubDirect();
  };
};

export const subscribeToThermocolParties = (
  callback: (data: ThermocolParty[]) => void,
  onError?: (err: any) => void
) => {
  const colRefLegacy = collection(db, COLLECTIONS.TH_PARTIES);
  const colRefDirect = collection(db, COLLECTIONS.CUSTOMERS);
  const colRefPacking = collection(db, COLLECTIONS.PACKING_CUSTOMERS);

  let legacyList: ThermocolParty[] = [];
  let directList: ThermocolParty[] = [];
  let packingList: ThermocolParty[] = [];

  const emitMerged = () => {
    const map = new Map<string, ThermocolParty>();
    [...legacyList, ...packingList, ...directList].forEach((p) => {
      if (p && p.name && p.name.trim()) {
        const comp = p.company || 'AIL';
        const key = `${comp}_${p.name.trim().toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, p);
        }
      }
    });
    callback(Array.from(map.values()));
  };

  const unsubLegacy = onSnapshot(
    colRefLegacy,
    (snapshot) => {
      const list: ThermocolParty[] = [];
      snapshot.forEach((docSnap) => {
        const p = docSnap.data() as ThermocolParty;
        if (p && p.name && p.name.trim()) list.push({ ...p, id: p.id || docSnap.id });
      });
      legacyList = list;
      emitMerged();
    },
    (err) => {
      console.warn('Thermocol Parties legacy sync error:', err);
      if (onError) onError(err);
    }
  );

  const unsubDirect = onSnapshot(
    colRefDirect,
    (snapshot) => {
      const list: ThermocolParty[] = [];
      snapshot.forEach((docSnap) => {
        const p = docSnap.data() as ThermocolParty;
        if (p && p.name && p.name.trim()) list.push({ ...p, id: p.id || docSnap.id });
      });
      directList = list;
      emitMerged();
    },
    (err) => {
      console.warn('Customers direct sync notice:', err);
    }
  );

  const unsubPacking = onSnapshot(
    colRefPacking,
    (snapshot) => {
      const list: ThermocolParty[] = [];
      snapshot.forEach((docSnap) => {
        const p = docSnap.data() as ThermocolParty;
        if (p && p.name && p.name.trim()) list.push({ ...p, id: p.id || docSnap.id });
      });
      packingList = list;
      emitMerged();
    },
    (err) => {
      console.warn('Packing customers sync notice:', err);
    }
  );

  return () => {
    unsubLegacy();
    unsubDirect();
    unsubPacking();
  };
};

export const subscribeToThermocolTransporters = (
  callback: (data: ThermocolTransporter[]) => void,
  onError?: (err: any) => void
) => {
  const colRefLegacy = collection(db, COLLECTIONS.TH_TRANSPORTERS);
  const colRefDirect = collection(db, COLLECTIONS.TRANSPORT_MASTER);
  const colRefPacking = collection(db, COLLECTIONS.PACKING_TRANSPORTERS);

  let legacyList: ThermocolTransporter[] = [];
  let directList: ThermocolTransporter[] = [];
  let packingList: ThermocolTransporter[] = [];

  const emitMerged = () => {
    const map = new Map<string, ThermocolTransporter>();
    [...legacyList, ...packingList, ...directList].forEach((t) => {
      if (t && t.name && t.name.trim()) {
        const comp = t.company || 'AIL';
        const key = `${comp}_${t.name.trim().toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, t);
        }
      }
    });
    callback(Array.from(map.values()));
  };

  const unsubLegacy = onSnapshot(
    colRefLegacy,
    (snapshot) => {
      const list: ThermocolTransporter[] = [];
      snapshot.forEach((docSnap) => {
        const t = docSnap.data() as ThermocolTransporter;
        if (t && t.name && t.name.trim()) list.push({ ...t, id: t.id || docSnap.id });
      });
      legacyList = list;
      emitMerged();
    },
    (err) => {
      console.warn('Thermocol Transporters legacy sync error:', err);
      if (onError) onError(err);
    }
  );

  const unsubDirect = onSnapshot(
    colRefDirect,
    (snapshot) => {
      const list: ThermocolTransporter[] = [];
      snapshot.forEach((docSnap) => {
        const t = docSnap.data() as ThermocolTransporter;
        if (t && t.name && t.name.trim()) list.push({ ...t, id: t.id || docSnap.id });
      });
      directList = list;
      emitMerged();
    },
    (err) => {
      console.warn('TransportMaster direct sync notice:', err);
    }
  );

  const unsubPacking = onSnapshot(
    colRefPacking,
    (snapshot) => {
      const list: ThermocolTransporter[] = [];
      snapshot.forEach((docSnap) => {
        const t = docSnap.data() as ThermocolTransporter;
        if (t && t.name && t.name.trim()) list.push({ ...t, id: t.id || docSnap.id });
      });
      packingList = list;
      emitMerged();
    },
    (err) => {
      console.warn('Packing transporters sync notice:', err);
    }
  );

  return () => {
    unsubLegacy();
    unsubDirect();
    unsubPacking();
  };
};

export const subscribeToThermocolDemands = (
  callback: (data: ClientDemand[]) => void,
  onError?: (err: any) => void
) => {
  const colRef = collection(db, COLLECTIONS.TH_DEMANDS);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const map = new Map<string, ClientDemand>();
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as ClientDemand;
        if (d && d.partyName && d.productName) {
          const comp = d.company || 'AIL';
          const key = `${comp}_${d.partyName.trim().toLowerCase()}_${d.productName.trim().toLowerCase()}`;
          if (!map.has(key)) {
            map.set(key, { ...d, id: docSnap.id });
          }
        }
      });
      callback(Array.from(map.values()));
    },
    (err) => {
      console.warn('Thermocol Demands sync error:', err);
      if (onError) onError(err);
    }
  );
};

export const subscribeToThermocolAudits = (
  callback: (data: InvoiceAuditLog[]) => void,
  onError?: (err: any) => void
) => {
  const colRefMain = collection(db, 'packing_audits');
  const colRefLegacy = collection(db, COLLECTIONS.TH_AUDITS);
  const docRefStore = doc(db, COLLECTIONS.THERMOCOL_PACKING, 'audits');

  let mainAudits: InvoiceAuditLog[] = [];
  let legacyAudits: InvoiceAuditLog[] = [];
  let storeAudits: InvoiceAuditLog[] = [];

  const mergeAndEmit = () => {
    const map = new Map<string, InvoiceAuditLog>();
    [...legacyAudits, ...storeAudits, ...mainAudits].forEach(item => {
      if (item.id) map.set(item.id, item);
    });
    const combined = Array.from(map.values());
    combined.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    callback(combined);
  };

  const unsubMain = onSnapshot(
    colRefMain,
    (snapshot) => {
      const list: InvoiceAuditLog[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as InvoiceAuditLog;
        list.push({ ...d, id: d.id || docSnap.id });
      });
      mainAudits = list;
      mergeAndEmit();
    },
    (err) => {
      console.warn('packing_audits sync error:', err);
      if (onError) onError(err);
    }
  );

  const unsubLegacy = onSnapshot(
    colRefLegacy,
    (snapshot) => {
      const list: InvoiceAuditLog[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as InvoiceAuditLog;
        list.push({ ...d, id: d.id || docSnap.id });
      });
      legacyAudits = list;
      mergeAndEmit();
    },
    (err) => {
      console.warn('TH Audits sync error:', err);
    }
  );

  const unsubStore = onSnapshot(
    docRefStore,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.items)) {
          storeAudits = data.items;
          mergeAndEmit();
        }
      }
    },
    (err) => {
      console.warn('Thermocol Store Audits sync error:', err);
    }
  );

  return () => {
    unsubMain();
    unsubLegacy();
    unsubStore();
  };
};

export const saveCompanyConfigToFirestore = async (senderAIL: any, senderHPL: any): Promise<void> => {
  const docRef = doc(db, COLLECTIONS.TH_SEQUENCES, 'company_config');
  await setDoc(docRef, {
    senderAIL,
    senderHPL,
    updatedAt: new Date().toISOString()
  }, { merge: true });
};

export const subscribeToCompanyConfig = (
  callback: (config: { senderAIL?: any; senderHPL?: any }) => void
) => {
  const docRef = doc(db, COLLECTIONS.TH_SEQUENCES, 'company_config');
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          senderAIL: data.senderAIL,
          senderHPL: data.senderHPL
        });
      }
    },
    (err) => {
      console.warn('Company Config sync error:', err);
    }
  );
};

export const subscribeToThermocolSequences = (
  callback: (seq: { seqAIL: number; seqHPL: number; challanSeqAIL: number; challanSeqHPL: number }) => void
) => {
  const docRef = doc(db, COLLECTIONS.TH_SEQUENCES, 'current_counters');
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          seqAIL: Number(data.seqAIL) || 392,
          seqHPL: Number(data.seqHPL) || 1,
          challanSeqAIL: Number(data.challanSeqAIL) || 1,
          challanSeqHPL: Number(data.challanSeqHPL) || 1
        });
      }
    },
    (err) => {
      console.warn('Thermocol Sequences sync error:', err);
    }
  );
};

// CRUD / Batch Sync Mutators for Thermocol Collections

export const saveThermocolInwardToFirestore = async (inward: ThermocolInward): Promise<string> => {
  const docId = inward.id || `inw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const cleanData = {
    ...inward,
    type: 'INWARD',
    id: docId,
    updatedAt: new Date().toISOString()
  };

  // Write to packing_inwards, ich_th_inwards, inwardStock, and ich_operations
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, COLLECTIONS.PACKING_INWARDS, docId), cleanData, { merge: true });
    batch.set(doc(db, COLLECTIONS.TH_INWARDS, docId), cleanData, { merge: true });
    batch.set(doc(db, COLLECTIONS.INWARD_STOCK, docId), cleanData, { merge: true });
    batch.set(doc(db, COLLECTIONS.OPERATIONS, docId), cleanData, { merge: true });
    await batch.commit();
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.PACKING_INWARDS);
    throw err;
  }

  return docId;
};

export const saveThermocolInwardsBatchToFirestore = async (inwards: ThermocolInward[]): Promise<void> => {
  try {
    for (let i = 0; i < inwards.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = inwards.slice(i, i + 400);
      chunk.forEach((inw) => {
        const docId = inw.id || `inw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const cleanData = { ...inw, type: 'INWARD', id: docId, updatedAt: new Date().toISOString() };
        batch.set(doc(db, COLLECTIONS.PACKING_INWARDS, docId), cleanData, { merge: true });
        batch.set(doc(db, COLLECTIONS.TH_INWARDS, docId), cleanData, { merge: true });
        batch.set(doc(db, COLLECTIONS.INWARD_STOCK, docId), cleanData, { merge: true });
        batch.set(doc(db, COLLECTIONS.OPERATIONS, docId), cleanData, { merge: true });
      });
      await batch.commit();
    }
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.PACKING_INWARDS);
    throw err;
  }
};

export const saveThermocolInvoiceToFirestore = async (invoice: ThermocolInvoice): Promise<string> => {
  if (!invoice || !invoice.invNo) {
    throw new Error('Cannot save invoice without valid invNo');
  }

  const safeId = invoice.invNo.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Sanitize line items to ensure numbers, strings, and no undefined properties
  const sanitizedItems = (invoice.items || []).map((it, idx) => ({
    id: it.id || `item_${idx}_${Date.now()}`,
    productId: it.productId || '',
    productName: it.productName || '',
    hsnCode: it.hsnCode || '3923',
    packSize: it.packSize || '',
    packSizeMultiple: Number(it.packSizeMultiple) || 1,
    cases: Number(it.cases) || 1,
    qty: Number(it.qty) || 0,
    rate: Number(it.rate) || 0,
    weight: Number(it.weight) || 0,
    cft: Number(it.cft) || 0,
    taxableValue: it.taxableValue !== undefined ? String(it.taxableValue) : '0',
    gstValue: it.gstValue !== undefined ? String(it.gstValue) : '0',
    totalValue: it.totalValue !== undefined ? String(it.totalValue) : '0',
    batch: it.batch ? String(it.batch).trim() : '',
    exp: it.exp ? String(it.exp).trim() : ''
  }));

  const cleanPayload = deepSanitizeForFirestore({
    ...invoice,
    items: sanitizedItems,
    type: 'INVOICE',
    invNo: invoice.invNo,
    company: invoice.company || (invoice.invNo.startsWith('AHPL') ? 'HPL' : 'AIL'),
    date: invoice.date || new Date().toISOString().split('T')[0],
    partyName: invoice.partyName || '',
    partyAddress: invoice.partyAddress || '',
    partyGstin: invoice.partyGstin || '',
    partyCity: invoice.partyCity || '',
    partyState: invoice.partyState || '',
    partyPincode: invoice.partyPincode || '',
    totalTaxable: String(invoice.totalTaxable || '0'),
    totalGst: String(invoice.totalGst || '0'),
    grandTotal: String(invoice.grandTotal || '0'),
    totalQty: Number(invoice.totalQty) || 0,
    totalCases: Number(invoice.totalCases) || 0,
    totalWeight: Number(invoice.totalWeight) || 0,
    totalCft: Number(invoice.totalCft) || 0,
    senderName: invoice.senderName || '',
    senderAddress: invoice.senderAddress || '',
    senderGstin: invoice.senderGstin || '',
    senderPan: invoice.senderPan || '',
    senderCin: invoice.senderCin || '',
    senderContact: invoice.senderContact || '',
    senderEmail: invoice.senderEmail || '',
    transName: invoice.transName || '',
    transGstin: invoice.transGstin || '',
    lrNo: invoice.lrNo || '',
    lrDate: invoice.lrDate || '',
    vehicleNo: invoice.vehicleNo || '',
    taxType: invoice.taxType || (invoice.isInterState ? 'INTER_STATE_IGST' : 'LOCAL_EXEMPT'),
    isInterState: Boolean(invoice.isInterState),
    createdAt: invoice.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 1. Mandatory Primary Save to 'ich_operations'
  const opsDocRef = doc(db, COLLECTIONS.OPERATIONS, safeId);
  try {
    await setDoc(opsDocRef, cleanPayload, { merge: true });
    console.log(`[Firestore Success] Saved invoice ${invoice.invNo} to ${COLLECTIONS.OPERATIONS} (doc: ${safeId})`);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.OPERATIONS);
    throw err;
  }

  // 2. Non-blocking secondary multi-collection synchronization
  try {
    const outwardsRef = doc(db, COLLECTIONS.PACKING_OUTWARDS, safeId);
    const legacyRef = doc(db, COLLECTIONS.TH_INVOICES, safeId);
    await setDoc(outwardsRef, cleanPayload, { merge: true });
    await setDoc(legacyRef, cleanPayload, { merge: true });
  } catch (secErr) {
    console.warn('[Firestore Notice] Secondary outwards sync notice:', secErr);
  }

  return safeId;
};

export const deleteThermocolInvoiceFromFirestore = async (invNo: string): Promise<void> => {
  const safeId = invNo.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.PACKING_OUTWARDS, safeId));
    batch.delete(doc(db, COLLECTIONS.PACKING_OUTWARDS, invNo));
    batch.delete(doc(db, COLLECTIONS.TH_INVOICES, safeId));
    batch.delete(doc(db, COLLECTIONS.TH_INVOICES, invNo));
    batch.delete(doc(db, COLLECTIONS.OPERATIONS, safeId));
    batch.delete(doc(db, COLLECTIONS.OPERATIONS, invNo));
    await batch.commit();
  } catch (err: any) {
    console.warn('[Firestore Notice] Batch delete notice in deleteThermocolInvoiceFromFirestore:', err?.message);
  }

  try {
    for (const colName of [COLLECTIONS.PACKING_OUTWARDS, COLLECTIONS.TH_INVOICES, COLLECTIONS.OPERATIONS]) {
      const q1 = query(collection(db, colName), where("invNo", "==", invNo));
      const snap1 = await getDocs(q1);
      for (const d of snap1.docs) {
        await deleteDoc(d.ref).catch(() => {});
      }

      if (safeId !== invNo) {
        const q2 = query(collection(db, colName), where("invNo", "==", safeId));
        const snap2 = await getDocs(q2);
        for (const d of snap2.docs) {
          await deleteDoc(d.ref).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('[Firestore] Error deleting invNo query docs:', err);
  }

  // Purge obsolete monolithic invoices doc
  try {
    await deleteDoc(doc(db, COLLECTIONS.THERMOCOL_PACKING, 'invoices')).catch(() => {});
  } catch (err) {
    console.warn('[Firestore] Error purging monolithic invoices doc:', err);
  }
};

export const deleteThermocolInwardFromFirestore = async (inwardId: string): Promise<void> => {
  if (!inwardId) return;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.PACKING_INWARDS, inwardId));
    batch.delete(doc(db, COLLECTIONS.TH_INWARDS, inwardId));
    batch.delete(doc(db, COLLECTIONS.INWARD_STOCK, inwardId));
    batch.delete(doc(db, COLLECTIONS.OPERATIONS, inwardId));
    await batch.commit();
  } catch (err: any) {
    console.warn('[Firestore Notice] Inward batch delete notice:', err?.message);
  }

  try {
    for (const colName of [COLLECTIONS.PACKING_INWARDS, COLLECTIONS.TH_INWARDS, COLLECTIONS.INWARD_STOCK, COLLECTIONS.OPERATIONS]) {
      const q = query(collection(db, colName), where("id", "==", inwardId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[Firestore] Error query deleting inward:', err);
  }

  // Purge obsolete monolithic inwards doc
  try {
    await deleteDoc(doc(db, COLLECTIONS.THERMOCOL_PACKING, 'inwards')).catch(() => {});
  } catch (_) {}
};

export const deleteThermocolProductFromFirestore = async (productId: string, name?: string, company?: string): Promise<void> => {
  const comp = company || 'AIL';
  const safeId = name ? `${comp}_${name}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80) : productId;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.PACKING_MASTER, safeId));
    batch.delete(doc(db, COLLECTIONS.PACKING_MASTER, productId));
    batch.delete(doc(db, COLLECTIONS.TH_PRODUCTS, safeId));
    batch.delete(doc(db, COLLECTIONS.TH_PRODUCTS, productId));
    batch.delete(doc(db, COLLECTIONS.PRODUCTS, safeId));
    batch.delete(doc(db, COLLECTIONS.PRODUCTS, productId));
    await batch.commit();
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.TH_PRODUCTS);
    throw err;
  }

  if (name) {
    try {
      const q0 = query(collection(db, COLLECTIONS.PACKING_MASTER), where("name", "==", name));
      const snap0 = await getDocs(q0);
      for (const d of snap0.docs) {
        await deleteDoc(d.ref);
      }
      const q = query(collection(db, COLLECTIONS.TH_PRODUCTS), where("name", "==", name));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
      const q2 = query(collection(db, COLLECTIONS.PRODUCTS), where("name", "==", name));
      const snap2 = await getDocs(q2);
      for (const d of snap2.docs) {
        await deleteDoc(d.ref);
      }
    } catch (err) {
      console.warn('[Firestore] Error query deleting product:', err);
    }
  }
};

export const deleteThermocolPartyFromFirestore = async (partyName: string, company?: string): Promise<void> => {
  const comp = company || 'AIL';
  const safeId = `${comp}_${partyName}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.TH_PARTIES, safeId));
    batch.delete(doc(db, COLLECTIONS.PACKING_CUSTOMERS, safeId));
    batch.delete(doc(db, COLLECTIONS.CUSTOMERS, safeId));
    await batch.commit();
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.TH_PARTIES);
    throw err;
  }

  try {
    const q1 = query(collection(db, COLLECTIONS.PACKING_CUSTOMERS), where("name", "==", partyName));
    const snap1 = await getDocs(q1);
    for (const d of snap1.docs) {
      await deleteDoc(d.ref);
    }
    const q2 = query(collection(db, COLLECTIONS.TH_PARTIES), where("name", "==", partyName));
    const snap2 = await getDocs(q2);
    for (const d of snap2.docs) {
      await deleteDoc(d.ref);
    }
    const q3 = query(collection(db, COLLECTIONS.CUSTOMERS), where("name", "==", partyName));
    const snap3 = await getDocs(q3);
    for (const d of snap3.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('[Firestore] Error query deleting customer:', err);
  }
};

export const deleteThermocolTransporterFromFirestore = async (transName: string, company?: string): Promise<void> => {
  const comp = company || 'AIL';
  const safeId = `${comp}_${transName}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.TH_TRANSPORTERS, safeId));
    batch.delete(doc(db, COLLECTIONS.PACKING_TRANSPORTERS, safeId));
    batch.delete(doc(db, COLLECTIONS.TRANSPORT_MASTER, safeId));
    batch.delete(doc(db, COLLECTIONS.MASTER_TRANSPORTERS, safeId));
    await batch.commit();
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.TH_TRANSPORTERS);
    throw err;
  }

  try {
    for (const colName of [COLLECTIONS.TH_TRANSPORTERS, COLLECTIONS.PACKING_TRANSPORTERS, COLLECTIONS.TRANSPORT_MASTER, COLLECTIONS.MASTER_TRANSPORTERS]) {
      const q = query(collection(db, colName), where("name", "==", transName));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    }
  } catch (err) {
    console.warn('[Firestore] Error query deleting transporter:', err);
  }
};

export const deleteThermocolDemandFromFirestore = async (demandId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.TH_DEMANDS, demandId));
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.TH_DEMANDS);
    throw err;
  }
};

export const saveThermocolProductToFirestore = async (prod: ThermocolProduct): Promise<void> => {
  const comp = prod.company || 'AIL';
  const safeId = `${comp}_${prod.name}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    const cleanProd = { ...prod, id: prod.id || safeId, updatedAt: nowIso };

    batch.set(doc(db, COLLECTIONS.PACKING_MASTER, safeId), cleanProd, { merge: true });
    batch.set(doc(db, COLLECTIONS.TH_PRODUCTS, safeId), cleanProd, { merge: true });
    batch.set(doc(db, COLLECTIONS.PRODUCTS, safeId), cleanProd, { merge: true });

    if (prod.id && prod.id !== safeId) {
      batch.set(doc(db, COLLECTIONS.PACKING_MASTER, prod.id), cleanProd, { merge: true });
      batch.set(doc(db, COLLECTIONS.TH_PRODUCTS, prod.id), cleanProd, { merge: true });
      batch.set(doc(db, COLLECTIONS.PRODUCTS, prod.id), cleanProd, { merge: true });
    }

    await batch.commit();
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.TH_PRODUCTS);
    throw err;
  }
};

export const saveThermocolProductsToFirestore = async (products: ThermocolProduct[]): Promise<void> => {
  const map = new Map<string, ThermocolProduct>();
  products.forEach(p => {
    if (p.name && p.name.trim()) {
      const comp = p.company || 'AIL';
      const key = `${comp}_${p.name.trim().toLowerCase()}`;
      map.set(key, p);
    }
  });
  const uniqueProducts = Array.from(map.values());

  try {
    for (let i = 0; i < uniqueProducts.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = uniqueProducts.slice(i, i + 400);
      chunk.forEach((prod) => {
        const comp = prod.company || 'AIL';
        const safeId = `${comp}_${prod.name}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
        const nowIso = new Date().toISOString();
        const cleanProd = { ...prod, id: prod.id || safeId, updatedAt: nowIso };

        batch.set(doc(db, COLLECTIONS.TH_PRODUCTS, safeId), cleanProd, { merge: true });
        batch.set(doc(db, COLLECTIONS.PRODUCTS, safeId), cleanProd, { merge: true });

        if (prod.id && prod.id !== safeId) {
          batch.set(doc(db, COLLECTIONS.TH_PRODUCTS, prod.id), cleanProd, { merge: true });
          batch.set(doc(db, COLLECTIONS.PRODUCTS, prod.id), cleanProd, { merge: true });
        }
      });
      await batch.commit();
    }
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.TH_PRODUCTS);
    throw err;
  }
};

export const saveThermocolPartyToFirestore = async (party: ThermocolParty): Promise<void> => {
  const comp = party.company || 'AIL';
  const safeId = `${comp}_${party.name}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    const cleanParty = { ...party, updatedAt: nowIso };

    batch.set(doc(db, COLLECTIONS.TH_PARTIES, safeId), cleanParty, { merge: true });
    batch.set(doc(db, COLLECTIONS.CUSTOMERS, safeId), cleanParty, { merge: true });
    batch.set(doc(db, COLLECTIONS.PACKING_CUSTOMERS, safeId), cleanParty, { merge: true });

    if (party.id && party.id !== safeId) {
      batch.set(doc(db, COLLECTIONS.TH_PARTIES, party.id), cleanParty, { merge: true });
      batch.set(doc(db, COLLECTIONS.CUSTOMERS, party.id), cleanParty, { merge: true });
      batch.set(doc(db, COLLECTIONS.PACKING_CUSTOMERS, party.id), cleanParty, { merge: true });
    }

    await batch.commit();
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.TH_PARTIES);
    throw err;
  }
};

export const saveThermocolPartiesToFirestore = async (parties: ThermocolParty[]): Promise<void> => {
  const map = new Map<string, ThermocolParty>();
  parties.forEach(p => {
    if (p.name && p.name.trim()) {
      const comp = p.company || 'AIL';
      const key = `${comp}_${p.name.trim().toLowerCase()}`;
      map.set(key, p);
    }
  });
  const uniqueParties = Array.from(map.values());

  try {
    for (let i = 0; i < uniqueParties.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = uniqueParties.slice(i, i + 400);
      chunk.forEach((party) => {
        const comp = party.company || 'AIL';
        const safeId = `${comp}_${party.name}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
        const nowIso = new Date().toISOString();
        const cleanParty = { ...party, updatedAt: nowIso };

        batch.set(doc(db, COLLECTIONS.TH_PARTIES, safeId), cleanParty, { merge: true });
        batch.set(doc(db, COLLECTIONS.CUSTOMERS, safeId), cleanParty, { merge: true });
        batch.set(doc(db, COLLECTIONS.PACKING_CUSTOMERS, safeId), cleanParty, { merge: true });

        if (party.id && party.id !== safeId) {
          batch.set(doc(db, COLLECTIONS.TH_PARTIES, party.id), cleanParty, { merge: true });
          batch.set(doc(db, COLLECTIONS.CUSTOMERS, party.id), cleanParty, { merge: true });
          batch.set(doc(db, COLLECTIONS.PACKING_CUSTOMERS, party.id), cleanParty, { merge: true });
        }
      });
      await batch.commit();
    }
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.TH_PARTIES);
    throw err;
  }
};

export const saveThermocolTransporterToFirestore = async (trans: ThermocolTransporter): Promise<void> => {
  const comp = trans.company || 'AIL';
  const safeId = `${comp}_${trans.name}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    const cleanTrans = { ...trans, updatedAt: nowIso };

    batch.set(doc(db, COLLECTIONS.TH_TRANSPORTERS, safeId), cleanTrans, { merge: true });
    batch.set(doc(db, COLLECTIONS.PACKING_TRANSPORTERS, safeId), cleanTrans, { merge: true });
    batch.set(doc(db, COLLECTIONS.TRANSPORT_MASTER, safeId), cleanTrans, { merge: true });
    batch.set(doc(db, COLLECTIONS.MASTER_TRANSPORTERS, safeId), cleanTrans, { merge: true });

    await batch.commit();
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.TH_TRANSPORTERS);
    throw err;
  }
};

export const saveThermocolTransportersToFirestore = async (transporters: ThermocolTransporter[]): Promise<void> => {
  // Purging logic removed.
  const map = new Map<string, ThermocolTransporter>();
  transporters.forEach(t => {
    if (t.name && t.name.trim()) {
      const comp = t.company || 'AIL';
      const key = `${comp}_${t.name.trim().toLowerCase()}`;
      map.set(key, t);
    }
  });
  const uniqueTransporters = Array.from(map.values());

  try {
    for (let i = 0; i < uniqueTransporters.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = uniqueTransporters.slice(i, i + 400);
      chunk.forEach((trans) => {
        const comp = trans.company || 'AIL';
        const safeId = `${comp}_${trans.name}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
        const nowIso = new Date().toISOString();
        const cleanTrans = { ...trans, updatedAt: nowIso };

        batch.set(doc(db, COLLECTIONS.TH_TRANSPORTERS, safeId), cleanTrans, { merge: true });
        batch.set(doc(db, COLLECTIONS.PACKING_TRANSPORTERS, safeId), cleanTrans, { merge: true });
        batch.set(doc(db, COLLECTIONS.TRANSPORT_MASTER, safeId), cleanTrans, { merge: true });
        batch.set(doc(db, COLLECTIONS.MASTER_TRANSPORTERS, safeId), cleanTrans, { merge: true });
      });
      await batch.commit();
    }
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.TH_TRANSPORTERS);
    throw err;
  }
};

export const saveThermocolDemandsToFirestore = async (demands: ClientDemand[]): Promise<void> => {
  // Purging logic removed.
  const map = new Map<string, ClientDemand>();
  demands.forEach(d => {
    if (d.partyName && d.productName) {
      const comp = d.company || 'AIL';
      const key = `${comp}_${d.partyName.trim().toLowerCase()}_${d.productName.trim().toLowerCase()}`;
      map.set(key, d);
    }
  });
  const uniqueDemands = Array.from(map.values());

  for (let i = 0; i < uniqueDemands.length; i += 400) {
    const batch = writeBatch(db);
    const chunk = uniqueDemands.slice(i, i + 400);
    chunk.forEach((d) => {
      const comp = d.company || 'AIL';
      const safeId = `${comp}_${d.partyName}_${d.productName}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
      const docRef = doc(db, COLLECTIONS.TH_DEMANDS, safeId);
      batch.set(docRef, { ...d, id: safeId, updatedAt: new Date().toISOString() }, { merge: true });
    });
    await batch.commit();
  }
};

export const addThermocolAuditLog = async (log: InvoiceAuditLog): Promise<string> => {
  const docId = log.id || `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const cleanData = {
    ...log,
    id: docId,
    updatedAt: new Date().toISOString()
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, COLLECTIONS.TH_AUDITS, docId), cleanData, { merge: true });
    batch.set(doc(db, 'packing_audits', docId), cleanData, { merge: true });
    await batch.commit();
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.TH_AUDITS);
    throw err;
  }

  try {
    await addDoc(collection(db, 'packing_audits'), cleanData);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, 'packing_audits');
    throw err;
  }

  return docId;
};

export const saveThermocolAuditsToFirestore = async (audits: InvoiceAuditLog[]): Promise<void> => {
  for (let i = 0; i < audits.length; i += 400) {
    try {
      const batch = writeBatch(db);
      const chunk = audits.slice(i, i + 400);
      chunk.forEach((aud) => {
        const docId = aud.id || `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const cleanData = { ...aud, id: docId, updatedAt: new Date().toISOString() };
        batch.set(doc(db, COLLECTIONS.TH_AUDITS, docId), cleanData, { merge: true });
        batch.set(doc(db, 'packing_audits', docId), cleanData, { merge: true });
      });
      await batch.commit();
    } catch (err: any) {
      if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
        console.warn('[Firestore Quota Exceeded] Batch save audits quota reached.');
        break;
      } else {
        console.warn('[Firestore Notice] Batch save audits error:', err);
      }
    }
  }
};

export const deleteThermocolAuditLogFromFirestore = async (auditId: string): Promise<void> => {
  if (!auditId) return;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.TH_AUDITS, auditId));
    batch.delete(doc(db, 'packing_audits', auditId));
    await batch.commit();
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.TH_AUDITS);
    throw err;
  }

  try {
    const q1 = query(collection(db, 'packing_audits'), where("id", "==", auditId));
    const snap1 = await getDocs(q1);
    for (const d of snap1.docs) {
      await deleteDoc(d.ref);
    }
    const q2 = query(collection(db, COLLECTIONS.TH_AUDITS), where("id", "==", auditId));
    const snap2 = await getDocs(q2);
    for (const d of snap2.docs) {
      await deleteDoc(d.ref);
    }

    // Also match by invNo if auditId happened to be invoice number
    const q3 = query(collection(db, 'packing_audits'), where("invNo", "==", auditId));
    const snap3 = await getDocs(q3);
    for (const d of snap3.docs) {
      if (d.data().action === 'CANCEL') {
        await deleteDoc(d.ref);
      }
    }
    const q4 = query(collection(db, COLLECTIONS.TH_AUDITS), where("invNo", "==", auditId));
    const snap4 = await getDocs(q4);
    for (const d of snap4.docs) {
      if (d.data().action === 'CANCEL') {
        await deleteDoc(d.ref);
      }
    }
  } catch (err) {
    console.warn('[Firestore] Error query deleting audit record:', err);
  }

  // Also clean up from thermocol_packing/audits document store if present
  try {
    const storeRef = doc(db, COLLECTIONS.THERMOCOL_PACKING, 'audits');
    const storeSnap = await getDoc(storeRef);
    if (storeSnap.exists()) {
      const data = storeSnap.data();
      if (Array.isArray(data.items)) {
        const filtered = data.items.filter((item: any) => item.id !== auditId && !(item.invNo === auditId && item.action === 'CANCEL'));
        await setDoc(storeRef, { items: filtered, updatedAt: new Date().toISOString() });
      }
    }
  } catch (err) {
    console.warn('[Firestore] Error filtering store audits:', err);
  }
};

export const clearThermocolCancelledAuditsFromFirestore = async (): Promise<void> => {
  try {
    const q1 = query(collection(db, 'packing_audits'), where("action", "==", "CANCEL"));
    const snap1 = await getDocs(q1);
    for (const d of snap1.docs) {
      await deleteDoc(d.ref);
    }
    const q2 = query(collection(db, COLLECTIONS.TH_AUDITS), where("action", "==", "CANCEL"));
    const snap2 = await getDocs(q2);
    for (const d of snap2.docs) {
      await deleteDoc(d.ref);
    }

    // Also check all packing_audits for any with deletedAt
    const allAuditsSnap = await getDocs(collection(db, 'packing_audits'));
    for (const d of allAuditsSnap.docs) {
      const data = d.data();
      if (data.action === 'CANCEL' || data.deletedAt) {
        await deleteDoc(d.ref);
      }
    }

    const allThAuditsSnap = await getDocs(collection(db, COLLECTIONS.TH_AUDITS));
    for (const d of allThAuditsSnap.docs) {
      const data = d.data();
      if (data.action === 'CANCEL' || data.deletedAt) {
        await deleteDoc(d.ref);
      }
    }
  } catch (err) {
    console.warn('[Firestore] Error clearing cancelled audit records:', err);
  }

  // Clean up from thermocol_packing/audits document store
  try {
    const storeRef = doc(db, COLLECTIONS.THERMOCOL_PACKING, 'audits');
    const storeSnap = await getDoc(storeRef);
    if (storeSnap.exists()) {
      const data = storeSnap.data();
      if (Array.isArray(data.items)) {
        const filtered = data.items.filter((item: any) => item.action !== 'CANCEL' && !item.deletedAt);
        await setDoc(storeRef, { items: filtered, updatedAt: new Date().toISOString() });
      }
    }
  } catch (err) {
    console.warn('[Firestore] Error filtering store audits on purge:', err);
  }
};

export const saveThermocolSequencesToFirestore = async (
  seqAIL: number, 
  seqHPL: number, 
  challanSeqAIL: number = 1, 
  challanSeqHPL: number = 1
): Promise<void> => {
  const docRef = doc(db, COLLECTIONS.TH_SEQUENCES, 'current_counters');
  await setDoc(docRef, {
    seqAIL,
    seqHPL,
    challanSeqAIL,
    challanSeqHPL,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  try {
    const pmRef = doc(db, COLLECTIONS.PACKING_MASTER, 'sequences');
    await setDoc(pmRef, { seqAIL, seqHPL, challanSeqAIL, challanSeqHPL, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn('packing_master sequence sync error:', err);
  }

  // Sync to thermocol_packing collection
  try {
    const tpRef = doc(db, COLLECTIONS.THERMOCOL_PACKING, 'sequences');
    await setDoc(tpRef, { seqAIL, seqHPL, challanSeqAIL, challanSeqHPL, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn('thermocol_packing sequence sync error:', err);
  }
};

// =======================================================
// INDEPENDENT THERMOCOL_PACKING FIRESTORE COLLECTION SYNC
// =======================================================

export const subscribeToThermocolPackingStore = (
  callback: (storeData: {
    inwards?: ThermocolInward[];
    invoices?: ThermocolInvoice[];
    products?: ThermocolProduct[];
    parties?: ThermocolParty[];
    transporters?: ThermocolTransporter[];
    demands?: ClientDemand[];
    audits?: InvoiceAuditLog[];
    sequences?: { seqAIL: number; seqHPL: number };
  }) => void,
  onError?: (err: any) => void
) => {
  const colRef = collection(db, COLLECTIONS.THERMOCOL_PACKING);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const result: any = {};
      snapshot.forEach((docSnap) => {
        const id = docSnap.id;
        const data = docSnap.data();
        if (id === 'inwards') result.inwards = data.items || [];
        else if (id === 'invoices') result.invoices = data.items || [];
        else if (id === 'products') result.products = data.items || [];
        else if (id === 'parties') result.parties = data.items || [];
        else if (id === 'transporters') result.transporters = data.items || [];
        else if (id === 'demands') result.demands = data.items || [];
        else if (id === 'audits') result.audits = data.items || [];
        else if (id === 'sequences') result.sequences = { seqAIL: data.seqAIL || 392, seqHPL: data.seqHPL || 1 };
      });
      callback(result);
    },
    (err) => {
      console.warn('thermocol_packing collection subscription error:', err);
      if (onError) onError(err);
    }
  );
};

export const syncThermocolPackingStateToFirestore = async (payload: {
  products?: ThermocolProduct[];
  parties?: ThermocolParty[];
  transporters?: ThermocolTransporter[];
  demands?: ClientDemand[];
  inwards?: ThermocolInward[];
  invoices?: ThermocolInvoice[];
  audits?: InvoiceAuditLog[];
}): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();

    if (payload.products) {
      batch.set(doc(db, COLLECTIONS.THERMOCOL_PACKING, 'products'), { items: payload.products, updatedAt: nowIso });
    }
    if (payload.parties) {
      batch.set(doc(db, COLLECTIONS.THERMOCOL_PACKING, 'parties'), { items: payload.parties, updatedAt: nowIso });
    }
    if (payload.transporters) {
      batch.set(doc(db, COLLECTIONS.THERMOCOL_PACKING, 'transporters'), { items: payload.transporters, updatedAt: nowIso });
    }
    if (payload.demands) {
      batch.set(doc(db, COLLECTIONS.THERMOCOL_PACKING, 'demands'), { items: payload.demands, updatedAt: nowIso });
    }
    // Note: Invoices and Inwards are persistently and safely stored as individual documents
    // in their dedicated collections (packing_outwards, packing_inwards, ich_operations),
    // strictly avoiding storing all entries inside a single monolithic document (>1MB limit).

    if (payload.audits) {
      const cappedAudits = payload.audits.slice(0, 30);
      batch.set(doc(db, COLLECTIONS.THERMOCOL_PACKING, 'audits'), { items: cappedAudits, updatedAt: nowIso });
    }

    await batch.commit();
    console.log('[Firestore Sync] Synced lightweight packing material master data to thermocol_packing collection.');
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.THERMOCOL_PACKING);
    throw error;
  }
};



// ==========================================
// ATOMIC INVOICE SEQUENCE & SAVE
// ==========================================

export const incrementInvoiceSequenceAndSave = async (
  invoice: ThermocolInvoice,
  isChallan: boolean,
  company: 'AIL' | 'HPL'
): Promise<{ success: boolean; sequence: number; invNo: string }> => {
  const counterDocRef = doc(db, COLLECTIONS.TH_SEQUENCES, 'current_counters');
  // Replicating logic for safeId


  try {
    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterDocRef);
      if (!counterDoc.exists()) {
        throw new Error("Counter document does not exist!");
      }

      const data = counterDoc.data();
      const currentSeq = isChallan
        ? (company === 'HPL' ? (data.challanSeqHPL || 1) : (data.challanSeqAIL || 1))
        : (company === 'HPL' ? (data.seqHPL || 7) : (data.seqAIL || 406));

      const newSeq = currentSeq;
      const nextSeq = currentSeq + 1;
      
      // Correct formatting logic for Unified Sequence (AIL vs HPL, Invoice vs Challan)
      let newInvNo = '';
      if (isChallan) {
        const numStr = String(newSeq).padStart(2, '0');
        newInvNo = (company === 'HPL') ? `ICHAHPL-DL${numStr}/26` : `ICHAIL-DL${numStr}/26`;
      } else {
        newInvNo = (company === 'HPL') 
          ? `AHPL-${String(newSeq).padStart(3, '0')}/26-27` 
          : `AILICH-${newSeq}/26`;
      }

      const newSafeId = newInvNo.replace(/[^a-zA-Z0-9_-]/g, '_');
      const newInvoiceDocRef = doc(db, COLLECTIONS.OPERATIONS, newSafeId);

      // Update counter
      const updateData: any = {};
      if (isChallan) {
        if (company === 'HPL') updateData.challanSeqHPL = nextSeq;
        else updateData.challanSeqAIL = nextSeq;
      } else {
        if (company === 'HPL') updateData.seqHPL = nextSeq;
        else updateData.seqAIL = nextSeq;
      }
      transaction.update(counterDocRef, updateData);

      // Save Invoice
      const sanitizedItems = (invoice.items || []).map((it, idx) => ({
        id: it.id || `item_${idx}_${Date.now()}`,
        productId: it.productId || '',
        productName: it.productName || '',
        hsnCode: it.hsnCode || '3923',
        packSize: it.packSize || '',
        packSizeMultiple: Number(it.packSizeMultiple) || 1,
        cases: Number(it.cases) || 1,
        qty: Number(it.qty) || 0,
        rate: Number(it.rate) || 0,
        weight: Number(it.weight) || 0,
        cft: Number(it.cft) || 0,
        taxableValue: it.taxableValue !== undefined ? String(it.taxableValue) : '0',
        gstValue: it.gstValue !== undefined ? String(it.gstValue) : '0',
        totalValue: it.totalValue !== undefined ? String(it.totalValue) : '0',
        batch: it.batch ? String(it.batch).trim() : '',
        exp: it.exp ? String(it.exp).trim() : ''
      }));

      const cleanPayload = deepSanitizeForFirestore({
        ...invoice,
        invNo: newInvNo,
        items: sanitizedItems,
        updatedAt: new Date().toISOString()
      });

      transaction.set(newInvoiceDocRef, cleanPayload, { merge: true });

      return { success: true, sequence: newSeq, invNo: newInvNo };
    });
  } catch (err) {
    console.error("Transaction failed:", err);
    return { success: false, sequence: -1, invNo: invoice.invNo };
  }
};
