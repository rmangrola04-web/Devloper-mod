import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  runTransaction,
  setLogLevel
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Silence Firestore internal log noise and background backoff warnings
try {
  setLogLevel('silent');
} catch (e) {
  // Ignore in environments where setLogLevel is restricted
}

// Intercept Firestore internal resource-exhausted retry errors to prevent unhandled console errors
if (typeof window !== 'undefined' || typeof console !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const messageStr = args
      .map(arg => (typeof arg === 'object' && arg !== null ? (arg.message || arg.stack || JSON.stringify(arg)) : String(arg)))
      .join(' ');

    if (
      messageStr.includes('resource-exhausted') ||
      messageStr.includes('Quota limit exceeded') ||
      messageStr.includes('maximum backoff delay') ||
      messageStr.includes('Free daily write units')
    ) {
      console.warn('[Firestore Notice - Free Daily Write Quota Active, continuing with local state]', ...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

// User's Provided wms-packing-mat Web App Configuration
export const wmsPackingMatConfig = {
  apiKey: "AIzaSyCx5256wp4LodJ7XnMS03MKE9rzyBWRGHc",
  authDomain: "wms-packing-mat.firebaseapp.com",
  projectId: "wms-packing-mat",
  storageBucket: "wms-packing-mat.firebasestorage.app",
  messagingSenderId: "381614472439",
  appId: "1:381614472439:web:1fb0a65fd998c9510a67f2"
};

const activeConfig = {
  ...wmsPackingMatConfig,
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey || wmsPackingMatConfig.apiKey,
  authDomain: firebaseConfig.authDomain || wmsPackingMatConfig.authDomain,
  projectId: firebaseConfig.projectId || wmsPackingMatConfig.projectId,
  storageBucket: firebaseConfig.storageBucket || wmsPackingMatConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId || wmsPackingMatConfig.messagingSenderId,
  appId: firebaseConfig.appId || wmsPackingMatConfig.appId,
};

export { firebaseConfig };

// Initialize Firebase App singleton
console.log('[Firebase] Initializing Firebase app for Indore wmsv3 with Project:', activeConfig.projectId);
export const app = !getApps().length ? initializeApp(activeConfig) : getApp();

// Explicit Named Database Initialization
// The Firestore database is a named database in GCP/Firebase, NOT the default one.
// Passes the exact database ID explicitly: getFirestore(app, FIRESTORE_DATABASE_ID)
export const FIRESTORE_DATABASE_ID = 
  (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)')
    ? firebaseConfig.firestoreDatabaseId
    : "ai-studio-remixintegratedc-4a466f00-a820-40b2-bd33-33a6a6ff89a9";

console.log('[Firebase] Initializing Firestore for Project:', activeConfig.projectId, 'with Named Database ID:', FIRESTORE_DATABASE_ID);
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);
console.log('[Firebase] Firestore initialized successfully.');

// Compat helper on db to support v8 / compat syntax like db.collection('packing_inwards').doc(docId).delete()
if (!(db as any).collection) {
  (db as any).collection = (collName: string) => {
    const coll = collection(db, collName);
    return {
      doc: (docId: string) => {
        const docRef = doc(db, collName, docId);
        return {
          id: docId,
          ref: docRef,
          get: () => getDoc(docRef),
          set: (data: any, options?: any) => setDoc(docRef, data, options),
          update: (data: any) => updateDoc(docRef, data),
          delete: () => deleteDoc(docRef),
        };
      },
      add: (data: any) => addDoc(coll, data),
    };
  };
}

export const auth = getAuth(app);
console.log('[Firebase] Firebase Auth initialized successfully.');

export {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  runTransaction
};


