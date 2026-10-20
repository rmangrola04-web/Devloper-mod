# Standalone Production Code & Architecture: Packing Material & Thermocol Portal

**Collections Synced:** `packing_inwards`, `packing_outwards`, `packing_master`, `packing_audits`, `thermocol_packing`  
**Firebase App ID:** `1:300004032729:web:ff8b48d345f8fa9189bec8`  
**Firebase Project:** `ich-indore-v3`  
**Version:** 4.0.0-PROD  

---

## 📋 Full Real-Time Sync Architecture

This application connects directly to **Firebase Firestore** using `onSnapshot` real-time listeners across all modules:

1. **Inward Management & Stock Balance (`packing_inwards` & `ich_th_inwards`)**:
   - Stock entries (GRN, receiving date, supplier, invoice, product, quantity, rate, GST%) persist instantly to Firestore.
   - Real-time `onSnapshot` listeners push live stock balance updates across all devices.

2. **Outward & Challan Generation (`packing_outwards` & `ich_th_invoices`)**:
   - Generated Delivery Challans / Tax Invoices write directly to Firestore.
   - Exact invoice numbers with slashes (`AILICH-392/26`, `AHPLICH-001/26`) are preserved across page refreshes.

3. **Invoice Audit Trail & Cancellation History (`packing_audits` & `ich_th_audits`)**:
   - Modifications, corrections, sequence overrides, and cancellations write to persistent Firestore collections.

4. **Master Sequences & Data Sync (`packing_master` & `ich_th_sequences`)**:
   - Custom starting sequence overrides (e.g. `10`, `393`, `500`) for AIL and AHPL divisions sync globally.

5. **239-Column SAP IRN Export**:
   - Standard SAP e-Invoicing exporter mapping Serial Numbers (`1, 2, 3...`) to the `Barcode` column and formatting Total Invoice Values into words.

---

## 1. Firebase Initialization (`src/firebase.ts`)

```typescript
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

export const indoreWmsV3Config = {
  apiKey: "AIzaSyB5OKNxpdv2mgRkCt0o1svM8MLoS2zKb8A",
  authDomain: "ich-indore-v3.firebaseapp.com",
  projectId: "ich-indore-v3",
  storageBucket: "ich-indore-v3.firebasestorage.app",
  messagingSenderId: "300004032729",
  appId: "1:300004032729:web:ff8b48d345f8fa9189bec8"
};

export const app = !getApps().length ? initializeApp(indoreWmsV3Config) : getApp();

const dbId = (firebaseConfig.firestoreDatabaseId && 
  firebaseConfig.firestoreDatabaseId !== '(default)' && 
  !firebaseConfig.firestoreDatabaseId.startsWith('ai-studio-')) 
  ? firebaseConfig.firestoreDatabaseId 
  : undefined;

export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);
export const auth = getAuth(app);

export {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch
};
```

---

## 2. Real-Time Subscribers & Mutators (`src/services/firestoreService.ts`)

```typescript
import { db, collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from '../firebase';

export const COLLECTIONS = {
  PACKING_INWARDS: 'packing_inwards',
  PACKING_OUTWARDS: 'packing_outwards',
  PACKING_MASTER: 'packing_master',
  PACKING_AUDITS: 'packing_audits',
  TH_INWARDS: 'ich_th_inwards',
  TH_INVOICES: 'ich_th_invoices',
  TH_PRODUCTS: 'ich_th_products',
  TH_PARTIES: 'ich_th_parties',
  TH_TRANSPORTERS: 'ich_th_transporters',
  TH_DEMANDS: 'ich_th_demands',
  TH_AUDITS: 'ich_th_audits',
  TH_SEQUENCES: 'ich_th_sequences',
  THERMOCOL_PACKING: 'thermocol_packing'
};

// Real-Time Listener for Inward Stock
export const subscribeToThermocolInwards = (callback: (data: any[]) => void) => {
  const colRefMain = collection(db, COLLECTIONS.PACKING_INWARDS);
  const colRefLegacy = collection(db, COLLECTIONS.TH_INWARDS);

  let mainItems: any[] = [];
  let legacyItems: any[] = [];

  const mergeAndEmit = () => {
    const map = new Map<string, any>();
    [...legacyItems, ...mainItems].forEach(item => {
      if (item.id) map.set(item.id, item);
    });
    callback(Array.from(map.values()));
  };

  const unsubMain = onSnapshot(colRefMain, (snapshot) => {
    mainItems = snapshot.docs.map(docSnap => {
      const d = docSnap.data();
      return { ...d, id: d.id || docSnap.id };
    });
    mergeAndEmit();
  });

  const unsubLegacy = onSnapshot(colRefLegacy, (snapshot) => {
    legacyItems = snapshot.docs.map(docSnap => {
      const d = docSnap.data();
      return { ...d, id: d.id || docSnap.id };
    });
    mergeAndEmit();
  });

  return () => {
    unsubMain();
    unsubLegacy();
  };
};

// Real-Time Listener for Outward Invoices
export const subscribeToThermocolInvoices = (callback: (data: any[]) => void) => {
  const colRefMain = collection(db, COLLECTIONS.PACKING_OUTWARDS);
  const colRefLegacy = collection(db, COLLECTIONS.TH_INVOICES);

  let mainInvoices: any[] = [];
  let legacyInvoices: any[] = [];

  const mergeAndEmit = () => {
    const map = new Map<string, any>();
    [...legacyInvoices, ...mainInvoices].forEach(item => {
      if (item.invNo) map.set(item.invNo, item);
    });
    callback(Array.from(map.values()));
  };

  const unsubMain = onSnapshot(colRefMain, (snapshot) => {
    mainInvoices = snapshot.docs.map(docSnap => {
      const d = docSnap.data();
      return { ...d, invNo: d.invNo || docSnap.id };
    });
    mergeAndEmit();
  });

  const unsubLegacy = onSnapshot(colRefLegacy, (snapshot) => {
    legacyInvoices = snapshot.docs.map(docSnap => {
      const d = docSnap.data();
      return { ...d, invNo: d.invNo || docSnap.id };
    });
    mergeAndEmit();
  });

  return () => {
    unsubMain();
    unsubLegacy();
  };
};

// Save Invoice Mutator
export const saveThermocolInvoiceToFirestore = async (invoice: any): Promise<string> => {
  const safeId = invoice.invNo.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanData = {
    ...invoice,
    updatedAt: new Date().toISOString()
  };

  const batch = writeBatch(db);
  batch.set(doc(db, COLLECTIONS.PACKING_OUTWARDS, safeId), cleanData, { merge: true });
  batch.set(doc(db, COLLECTIONS.TH_INVOICES, safeId), cleanData, { merge: true });
  await batch.commit();

  return safeId;
};
```

---

## 3. Firestore Security Rules (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /packing_inwards/{docId} { allow read, write: if true; }
    match /packing_outwards/{docId} { allow read, write: if true; }
    match /packing_master/{docId} { allow read, write: if true; }
    match /packing_audits/{docId} { allow read, write: if true; }
    match /ich_th_inwards/{docId} { allow read, write: if true; }
    match /ich_th_invoices/{docId} { allow read, write: if true; }
    match /ich_th_products/{docId} { allow read, write: if true; }
    match /ich_th_parties/{docId} { allow read, write: if true; }
    match /ich_th_transporters/{docId} { allow read, write: if true; }
    match /ich_th_demands/{docId} { allow read, write: if true; }
    match /ich_th_audits/{docId} { allow read, write: if true; }
    match /ich_th_sequences/{docId} { allow read, write: if true; }
    match /thermocol_packing/{docId} { allow read, write: if true; }
    match /{document=**} { allow read, write: if true; }
  }
}
```
