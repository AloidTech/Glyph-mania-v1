import React from 'react';

interface HeaderOrnamentProps {
  opacity?: number;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

export const HeaderOrnament: React.FC<HeaderOrnamentProps> = ({
  opacity = 0.9,
  width = 140,
  height = 24,
  style,
}) => {
  return (
    <svg
      viewBox="0 0 130 22"
      aria-hidden="true"
      style={{
        width,
        height,
        color: 'var(--color-accent)',
        opacity,
        marginBottom: 14,
        filter: 'drop-shadow(0 0 8px var(--color-accent-glow))',
        ...style,
      }}
    >
      <line x1="0" y1="11" x2="46" y2="11" stroke="currentColor" strokeWidth="0.8" />
      <polygon points="65,3 73,11 65,19 57,11" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="65" cy="11" r="2.8" fill="currentColor" />
      <line x1="84" y1="11" x2="130" y2="11" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
};

export default HeaderOrnament;
