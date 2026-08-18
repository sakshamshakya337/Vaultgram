import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker with automatic updates
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('New StreamVault content available, updating service worker...');
  },
  onOfflineReady() {
    console.log('StreamVault is ready for offline app shell use.');
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
