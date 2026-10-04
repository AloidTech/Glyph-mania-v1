import React from 'react';

export type SigilPosition = 'tl' | 'tr' | 'bl' | 'br';

interface CornerSigilProps {
  pos: SigilPosition;
  opacity?: number;
  size?: number;
  style?: React.CSSProperties;
}

export const CornerSigil: React.FC<CornerSigilProps> = ({
  pos,
  opacity = 0.45,
  size = 68,
  style,
}) => {
  const edgeStyle: Record<SigilPosition, React.CSSProperties> = {
    tl: { top: 20, left: 20 },
    tr: { top: 20, right: 20 },
    bl: { bottom: 20, left: 20 },
    br: { bottom: 20, right: 20 },
  };
  const rot = { tl: 0, tr: 90, bl: 270, br: 180 }[pos];

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{
        ...edgeStyle[pos],
        position: 'absolute',
        pointerEvents: 'none',
        userSelect: 'none',
        width: size,
        height: size,
        opacity,
        color: 'var(--color-accent)',
        transform: `rotate(${rot}deg)`,
        filter: 'drop-shadow(0 0 8px var(--color-accent-glow))',
        zIndex: 0,
        ...style,
      }}
    >
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 4" />
      <line x1="50" y1="4" x2="50" y2="96" stroke="currentColor" strokeWidth="0.8" />
      <line x1="4" y1="50" x2="96" y2="50" stroke="currentColor" strokeWidth="0.8" />
      <line x1="17.6" y1="17.6" x2="82.4" y2="82.4" stroke="currentColor" strokeWidth="0.6" />
      <line x1="82.4" y1="17.6" x2="17.6" y2="82.4" stroke="currentColor" strokeWidth="0.6" />
      <polygon points="50,8 57,28 50,23 43,28" fill="currentColor" />
      <circle cx="50" cy="50" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="2.5" fill="currentColor" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
        const r1 = i % 3 === 0 ? 37 : 41;
        return (
          <line
            key={i}
            x1={50 + r1 * Math.cos(a)}
            y1={50 + r1 * Math.sin(a)}
            x2={50 + 46 * Math.cos(a)}
            y2={50 + 46 * Math.sin(a)}
            stroke="currentColor"
            strokeWidth={i % 3 === 0 ? '1.2' : '0.7'}
          />
        );
      })}
    </svg>
  );
};

export default CornerSigil;
