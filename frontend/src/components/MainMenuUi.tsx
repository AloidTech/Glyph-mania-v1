import React from 'react';
import { useGameStore } from '../lib/store';

// ─── Ambient Glyph Ring ────────────────────────────────────────────────────────
const AmbientGlyph: React.FC = () => {
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
        width: 'min(860px, 88vw)',
        height: 'min(860px, 88vw)',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: 0.055,
        color: 'var(--color-accent)',
        zIndex: 0,
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
          strokeWidth={i === 2 || i === 0 ? 0.9 : 0.4}
          strokeDasharray={i === 1 || i === 3 ? '3 7' : undefined}
        />
      ))}
      <circle cx="400" cy="400" r="4" fill="currentColor" />

      {/* 16 outer spokes */}
      {Array.from({ length: 16 }).map((_, i) => (
        <line key={`s${i}`} {...spoke(i, 16, 248, 338)} stroke="currentColor" strokeWidth="0.5" />
      ))}
      {/* 8 inner spokes */}
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={`is${i}`} {...spoke(i, 8, 88, 172)} stroke="currentColor" strokeWidth="0.4" />
      ))}

      {/* Octagram */}
      <polygon points={starPts(8, 200, 88)} fill="none" stroke="currentColor" strokeWidth="0.65" />

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
            strokeWidth="0.55"
          />
        );
      })}
    </svg>
  );
};

// ─── Corner Sigil ──────────────────────────────────────────────────────────────
const CornerSigil: React.FC<{ pos: 'tl' | 'tr' | 'bl' | 'br' }> = ({ pos }) => {
  const edgeStyle: Record<string, React.CSSProperties> = {
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
        width: 68,
        height: 68,
        opacity: 0.08,
        color: 'var(--color-accent)',
        transform: `rotate(${rot}deg)`,
        zIndex: 0,
      }}
    >
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2.5 4" />
      <line x1="50" y1="4" x2="50" y2="96" stroke="currentColor" strokeWidth="0.5" />
      <line x1="4" y1="50" x2="96" y2="50" stroke="currentColor" strokeWidth="0.5" />
      <line x1="17.6" y1="17.6" x2="82.4" y2="82.4" stroke="currentColor" strokeWidth="0.4" />
      <line x1="82.4" y1="17.6" x2="17.6" y2="82.4" stroke="currentColor" strokeWidth="0.4" />
      <polygon points="50,8 57,28 50,23 43,28" fill="currentColor" />
      <circle cx="50" cy="50" r="5.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="50" cy="50" r="2" fill="currentColor" />
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
            strokeWidth={i % 3 === 0 ? '1' : '0.5'}
          />
        );
      })}
    </svg>
  );
};

// ─── Ornamental Divider ────────────────────────────────────────────────────────
const RuneDivider: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(201, 162, 39, 0.22))' }} />
      <svg
        viewBox="0 0 20 20"
        width="11"
        height="11"
        aria-hidden="true"
        style={{ color: 'var(--color-accent)', opacity: 0.55, flexShrink: 0 }}
      >
        <polygon points="10,1.5 18.5,10 10,18.5 1.5,10" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="10" cy="10" r="2.8" fill="currentColor" />
      </svg>
      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, rgba(201, 162, 39, 0.22))' }} />
    </div>
  );
};

// ─── Main Menu Component ───────────────────────────────────────────────────────
export const MainMenuUi: React.FC = () => {
  const setScreen = useGameStore((state) => state.setScreen);
  const startNewGame = useGameStore((state) => state.startNewGame);

  return (
    <div className="main-menu-container interactive-ui">
      {/* Background ambient glyph */}
      <AmbientGlyph />

      {/* 4 Corner sigils */}
      <CornerSigil pos="tl" />
      <CornerSigil pos="tr" />
      <CornerSigil pos="bl" />
      <CornerSigil pos="br" />

      {/* Vignette depth & arcane purple bloom overlays */}
      <div className="menu-vignette" />
      <div className="menu-purple-bloom" />

      {/* Centered Main Menu Content Stack */}
      <div className="main-menu-content">
        <div className="main-menu-hero">
          {/* Header Top Ornament */}
          <svg
            viewBox="0 0 130 22"
            aria-hidden="true"
            style={{ width: 130, height: 22, color: 'var(--color-accent)', opacity: 0.1, marginBottom: 14 }}
          >
            <line x1="0" y1="11" x2="46" y2="11" stroke="currentColor" strokeWidth="0.6" />
            <polygon points="65,3 73,11 65,19 57,11" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="65" cy="11" r="2.5" fill="currentColor" />
            <line x1="84" y1="11" x2="130" y2="11" stroke="currentColor" strokeWidth="0.6" />
          </svg>

          {/* Main Title */}
          <h1 className="main-menu-title">GLYPH MANIA</h1>

          {/* Subtitle */}
          <p className="main-menu-subtitle">Inscribe the arcane. Command the unseen.</p>
        </div>

        {/* Ornamental Divider */}
        <div className="main-menu-divider">
          <RuneDivider />
        </div>

        {/* Action Buttons */}
        <div className="main-menu-actions">
          <button onClick={startNewGame} className="btn-arcane-primary">
            Enter Workshop
          </button>

          <button onClick={() => setScreen('SETTINGS')} className="btn-arcane-secondary">
            Settings
          </button>

          <button
            onClick={() => {
              if (window.confirm('Exit Glyph Mania?')) {
                window.close();
              }
            }}
            className="btn-arcane-ghost"
          >
            Exit
          </button>
        </div>

        {/* Version caption */}
        <p className="main-menu-version">v0.1.0 — EARLY ACCESS</p>
      </div>
    </div>
  );
};

export default MainMenuUi;
