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

const env = (import.meta as any).env || {};
const runtimeConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  firestoreDatabaseId: env.VITE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId
};

export { firebaseConfig };

let app: any;
let db: any;
let auth: any;

try {
  console.log('[Firebase] Initializing Firebase app with Project:', runtimeConfig.projectId);
  app = !getApps().length ? initializeApp(runtimeConfig) : getApp();
} catch (error) {
  console.error('[Firebase Initialization Error] Failed to initialize Firebase App:', error);
}

export const FIRESTORE_DATABASE_ID = 
  (runtimeConfig.firestoreDatabaseId && runtimeConfig.firestoreDatabaseId !== '(default)')
    ? runtimeConfig.firestoreDatabaseId
    : "ai-studio-remixintegratedc-d62c8131-2611-40fe-b3ec-d9df328e477b";

try {
  console.log('[Firebase] Initializing Firestore with Named Database ID:', FIRESTORE_DATABASE_ID);
  db = getFirestore(app, FIRESTORE_DATABASE_ID);
  console.log('[Firebase] Firestore initialized successfully.');
} catch (error) {
  console.error('[Firestore Initialization Error] Failed to initialize Firestore:', error);
}

try {
  auth = getAuth(app);
  console.log('[Firebase] Firebase Auth initialized successfully.');
} catch (error) {
  console.error('[Firebase Auth Initialization Error] Failed to initialize Firebase Auth:', error);
}

export { app, db, auth };

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


