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
  enableNetwork,
  disableNetwork,
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

export { firebaseConfig };

console.log('[Firebase] Initializing Firebase app with Project:', firebaseConfig.projectId);
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const FIRESTORE_DATABASE_ID = 
  (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)')
    ? firebaseConfig.firestoreDatabaseId
    : "ai-studio-remixintegratedc-d62c8131-2611-40fe-b3ec-d9df328e477b";

console.log('[Firebase] Initializing Firestore for Project:', firebaseConfig.projectId, 'with Named Database ID:', FIRESTORE_DATABASE_ID);
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);
console.log('[Firebase] Firestore initialized successfully.');

export const auth = getAuth(app);
console.log('[Firebase] Firebase Auth initialized successfully.');

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Firebase Network] Browser online detected. Re-enabling Firestore network...');
    enableNetwork(db).catch(err => console.warn('[Firebase Network] Enable network error:', err));
  });
  enableNetwork(db).catch(() => {});
}

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
  runTransaction,
  enableNetwork,
  disableNetwork
};


