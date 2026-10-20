import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
}
if (typeof caches !== 'undefined') {
  caches.keys().then((keys) => {
    for (const key of keys) {
      caches.delete(key);
    }
  }).catch(() => {});
}

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && (event.reason.code === 'auth/network-request-failed' || String(event.reason).includes('network-request-failed') || String(event.reason?.message).includes('network-request-failed'))) {
    console.warn('[Firebase Auth] Offline / Network request glitch suppressed:', event.reason);
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
