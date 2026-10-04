import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          fontFamily: 'var(--font-body)',
          fontSize: '0.9rem',
          background: '#fff',
          color: '#1b1f23',
          border: '1px solid #e2dcd2',
          borderRadius: '9999px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          padding: '0.65rem 1.25rem',
        },
        success: {
          iconTheme: { primary: '#2f855a', secondary: '#fff' },
        },
        error: {
          iconTheme: { primary: '#c53030', secondary: '#fff' },
        },
      }}
    />
  </React.StrictMode>
);
