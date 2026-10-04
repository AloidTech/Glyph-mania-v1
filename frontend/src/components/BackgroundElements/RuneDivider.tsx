import React from 'react';

interface RuneDividerProps {
  opacity?: number;
  style?: React.CSSProperties;
}

export const RuneDivider: React.FC<RuneDividerProps> = ({ opacity = 0.85, style }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        width: '100%',
        opacity,
        ...style,
      }}
    >
      <div
        style={{
          flex: 1,
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(201, 162, 39, 0.5))',
        }}
      />
      <svg
        viewBox="0 0 20 20"
        width="13"
        height="13"
        aria-hidden="true"
        style={{
          color: 'var(--color-accent)',
          filter: 'drop-shadow(0 0 6px var(--color-accent-glow))',
          flexShrink: 0,
        }}
      >
        <polygon points="10,1.5 18.5,10 10,18.5 1.5,10" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="10" cy="10" r="3" fill="currentColor" />
      </svg>
      <div
        style={{
          flex: 1,
          height: '1px',
          background: 'linear-gradient(to left, transparent, rgba(201, 162, 39, 0.5))',
        }}
      />
    </div>
  );
};

export default RuneDivider;
