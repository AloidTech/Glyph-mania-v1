import React, { useEffect, useState } from 'react';

/**
 * Displays a modal overlay when the device is in portrait orientation,
 * prompting the user to rotate to landscape for optimal experience.
 */
const MobileOrientationWarning: React.FC = () => {
  const [show, setShow] = useState(() => window.matchMedia('(orientation: portrait)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const handler = (e: MediaQueryListEvent) => setShow(e.matches);
    mq.addEventListener('change', handler);
    // Ensure correct state on mount
    setShow(mq.matches);
    return () => {
      mq.removeEventListener('change', handler);
    };
  }, []);

  if (!show) return null;

  return (
    <div style={overlayStyle} onClick={() => setShow(false)}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Rotate your device</h2>
        <p>Please switch to landscape orientation for the best experience.</p>
        <button onClick={() => setShow(false)} style={buttonStyle}>OK</button>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
};

const modalStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '8px',
  padding: '1.5rem',
  maxWidth: '90%',
  textAlign: 'center',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
};

const buttonStyle: React.CSSProperties = {
  marginTop: '1rem',
  padding: '0.5rem 1rem',
  background: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
};

export default MobileOrientationWarning;
