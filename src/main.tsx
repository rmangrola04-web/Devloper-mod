import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[ServiceWorker] Registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('[ServiceWorker] Registration failed:', error);
      });
  });
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
