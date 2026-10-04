import React from 'react';

interface AmbientGlyphProps {
  opacity?: number;
  size?: string;
  style?: React.CSSProperties;
}

export const AmbientGlyph: React.FC<AmbientGlyphProps> = ({
  opacity = 0.38,
  size = 'min(860px, 88vw)',
  style,
}) => {
  const spoke = (i: number, total: number, r1: number, r2: number) => {
    const a = (i / total) * 2 * Math.PI - Math.PI / 2;
    return {
      x1: 400 + r1 * Math.cos(a),
      y1: 400 + r1 * Math.sin(a),
      x2: 400 + r2 * Math.cos(a),
      y2: 400 + r2 * Math.sin(a),
    };
  };

  const starPts = (n: number, rOut: number, rIn: number) =>
    Array.from({ length: n * 2 })
      .map((_, i) => {
        const a = (i / (n * 2)) * 2 * Math.PI - Math.PI / 2;
        const r = i % 2 === 0 ? rOut : rIn;
        return `${400 + r * Math.cos(a)},${400 + r * Math.sin(a)}`;
      })
      .join(' ');

  return (
    <svg
      viewBox="0 0 800 800"
      aria-hidden="true"
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        userSelect: 'none',
        width: size,
        height: size,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        opacity,
        color: 'var(--color-accent)',
        filter: 'drop-shadow(0 0 12px var(--color-accent-glow))',
        zIndex: 0,
        ...style,
      }}
    >
      {/* Rings */}
      {[390, 365, 338, 292, 248, 172, 88, 14].map((r, i) => (
        <circle
          key={r}
          cx="400"
          cy="400"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={i === 2 || i === 0 ? 1.2 : 0.6}
          strokeDasharray={i === 1 || i === 3 ? '4 8' : undefined}
        />
      ))}
      <circle cx="400" cy="400" r="5" fill="currentColor" />

      {/* 16 outer spokes */}
      {Array.from({ length: 16 }).map((_, i) => (
        <line key={`s${i}`} {...spoke(i, 16, 248, 338)} stroke="currentColor" strokeWidth="0.75" />
      ))}
      {/* 8 inner spokes */}
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={`is${i}`} {...spoke(i, 8, 88, 172)} stroke="currentColor" strokeWidth="0.6" />
      ))}

      {/* Octagram */}
      <polygon points={starPts(8, 200, 88)} fill="none" stroke="currentColor" strokeWidth="0.9" />

      {/* Diamond tick marks at outer ring */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * 2 * Math.PI - Math.PI / 2;
        const cx = 400 + 338 * Math.cos(a);
        const cy = 400 + 338 * Math.sin(a);
        const s = 6.5;
        return (
          <polygon
            key={`d${i}`}
            points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`}
            fill="currentColor"
          />
        );
      })}

      {/* Half-tick marks between spokes */}
      {Array.from({ length: 32 }).map((_, i) => {
        if (i % 2 === 0) return null;
        const a = (i / 32) * 2 * Math.PI - Math.PI / 2;
        return (
          <line
            key={`t${i}`}
            x1={400 + 334 * Math.cos(a)}
            y1={400 + 334 * Math.sin(a)}
            x2={400 + 342 * Math.cos(a)}
            y2={400 + 342 * Math.sin(a)}
            stroke="currentColor"
            strokeWidth="0.8"
          />
        );
      })}
    </svg>
  );
};

export default AmbientGlyph;
