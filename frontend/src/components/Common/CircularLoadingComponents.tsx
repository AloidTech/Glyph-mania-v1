import React from 'react';

// ==============================================================================
// 1. Reusable Circular Spinner Component
// ==============================================================================
export interface CircularSpinnerProps {
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}

export const CircularSpinner: React.FC<CircularSpinnerProps> = ({
  size = 32,
  strokeWidth = 3,
  color = 'var(--admin-accent, #c9a227)',
  trackColor = 'rgba(201, 162, 39, 0.15)',
  className = '',
  style,
  label,
}) => {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  return (
    <div
      className={`circular-spinner-container ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.45rem',
        ...style,
      }}
    >
      <svg
        className="circular-spinner-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: 'visible' }}
      >
        {/* Background Track Circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Animated Progress Circle */}
        <circle
          className="circular-spinner-circle"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
        />
      </svg>
      {label && (
        <span
          style={{
            fontFamily: 'var(--font-heading, sans-serif)',
            fontSize: '0.72rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--admin-ink-muted, #718096)',
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};

// ==============================================================================
// 2. Sigils Grid Skeleton (3 per row desktop, 1 mobile)
// ==============================================================================
export const SigilsGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="sigils-grid" aria-busy="true" aria-label="Loading sigils">
      {Array.from({ length: count }).map((_, index) => (
        <div key={`sigil-skeleton-${index}`} className="skeleton-card">
          {/* Card Preview with centered Circular Loading Component */}
          <div className="skeleton-card-preview">
            {/* Top-left placeholder badge */}
            <div
              className="skeleton-shimmer"
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                width: 75,
                height: 20,
                borderRadius: 6,
              }}
            />

            {/* Circular Loading Spinner inside preview */}
            <CircularSpinner
              size={42}
              strokeWidth={3.5}
              label="Syncing..."
            />
          </div>

          {/* Card Content Skeleton */}
          <div className="skeleton-card-content">
            {/* Header row: title + type badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                className="skeleton-shimmer"
                style={{ width: '45%', height: 22, borderRadius: 4 }}
              />
              <div
                className="skeleton-shimmer"
                style={{ width: '30%', height: 18, borderRadius: 4 }}
              />
            </div>

            {/* Meta row: Tier pill + Masked ID placeholder */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
              <div
                className="skeleton-shimmer"
                style={{ width: 50, height: 16, borderRadius: 4 }}
              />
              <div
                className="skeleton-shimmer"
                style={{ width: 90, height: 16, borderRadius: 4 }}
              />
            </div>

            {/* Description lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
              <div
                className="skeleton-shimmer"
                style={{ width: '100%', height: 13, borderRadius: 3 }}
              />
              <div
                className="skeleton-shimmer"
                style={{ width: '75%', height: 13, borderRadius: 3 }}
              />
            </div>
          </div>

          {/* Footer Action Buttons Skeleton */}
          <div className="skeleton-card-footer">
            <div
              className="skeleton-shimmer"
              style={{ width: 68, height: 28, borderRadius: 4 }}
            />
            <div
              className="skeleton-shimmer"
              style={{ width: 78, height: 28, borderRadius: 4 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ==============================================================================
// 3. Glyphs Grid Skeleton
// ==============================================================================
export const GlyphsGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="sigils-grid" aria-busy="true" aria-label="Loading glyphs">
      {Array.from({ length: count }).map((_, index) => (
        <div key={`glyph-skeleton-${index}`} className="skeleton-card">
          <div className="skeleton-card-preview">
            <div
              className="skeleton-shimmer"
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                width: 85,
                height: 20,
                borderRadius: 4,
              }}
            />
            <CircularSpinner
              size={42}
              strokeWidth={3.5}
              label="Resolving..."
            />
          </div>

          <div className="skeleton-card-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div
                className="skeleton-shimmer"
                style={{ width: '50%', height: 20, borderRadius: 4 }}
              />
              <div
                className="skeleton-shimmer"
                style={{ width: '35%', height: 18, borderRadius: 4 }}
              />
            </div>

            <div style={{ marginTop: '0.3rem' }}>
              <div
                className="skeleton-shimmer"
                style={{ width: 110, height: 18, borderRadius: 4 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.2rem' }}>
              <div
                className="skeleton-shimmer"
                style={{ width: '100%', height: 13, borderRadius: 3 }}
              />
              <div
                className="skeleton-shimmer"
                style={{ width: '80%', height: 13, borderRadius: 3 }}
              />
            </div>

            {/* Chips row */}
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <div className="skeleton-shimmer" style={{ width: 75, height: 18, borderRadius: 6 }} />
              <div className="skeleton-shimmer" style={{ width: 85, height: 18, borderRadius: 6 }} />
              <div className="skeleton-shimmer" style={{ width: 80, height: 18, borderRadius: 6 }} />
            </div>
          </div>

          <div className="skeleton-card-footer">
            <div className="skeleton-shimmer" style={{ width: 38, height: 32, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ flex: 1, height: 32, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ==============================================================================
// 4. Sigil Detail Page Skeleton
// ==============================================================================
export const SigilDetailPageSkeleton: React.FC = () => {
  return (
    <div aria-busy="true" aria-label="Loading sigil details">
      {/* Top back link placeholder */}
      <div style={{ marginBottom: '0.65rem' }}>
        <div className="skeleton-shimmer" style={{ width: 160, height: 18, borderRadius: 4 }} />
      </div>

      {/* Header section placeholder */}
      <div
        className="admin-page-header"
        style={{
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="skeleton-shimmer" style={{ width: 180, height: 32, borderRadius: 6 }} />
            <div className="skeleton-shimmer" style={{ width: 70, height: 22, borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div className="skeleton-shimmer" style={{ width: 55, height: 18, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: 120, height: 18, borderRadius: 4 }} />
          </div>
        </div>

        <div className="skeleton-shimmer" style={{ width: 210, height: 38, borderRadius: 9999 }} />
      </div>

      {/* 2-Column Main Layout Skeleton */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(280px, 0.8fr)',
          gap: '2rem',
        }}
      >
        {/* Left Form Skeleton */}
        <div className="admin-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="skeleton-shimmer" style={{ width: '40%', height: 24, borderRadius: 4 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div className="skeleton-shimmer" style={{ width: 80, height: 14 }} />
            <div className="skeleton-shimmer" style={{ width: '100%', height: 38 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div className="skeleton-shimmer" style={{ width: 90, height: 14 }} />
            <div className="skeleton-shimmer" style={{ width: '100%', height: 38 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div className="skeleton-shimmer" style={{ width: 100, height: 14 }} />
            <div className="skeleton-shimmer" style={{ width: '100%', height: 80 }} />
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <div className="skeleton-shimmer" style={{ width: 120, height: 38, borderRadius: 9999 }} />
            <div className="skeleton-shimmer" style={{ width: 100, height: 38, borderRadius: 9999 }} />
          </div>
        </div>

        {/* Right Artwork Box Skeleton with Center Circular Loader */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div
            className="admin-panel"
            style={{
              height: 320,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--admin-paper-warm, #fbf9f4)',
              border: '1px solid var(--admin-border, #ede8df)',
            }}
          >
            <CircularSpinner
              size={56}
              strokeWidth={4}
              label="Loading Sigil Asset..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ==============================================================================
// 5. Workshop Catalog Skeleton (with Circular Loader)
// ==============================================================================
export const WorkshopCatalogSkeleton: React.FC<{ label?: string }> = ({
  label = 'Loading Catalog...',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1rem',
        gap: '1.25rem',
        width: '100%',
      }}
      aria-busy="true"
      aria-label={label}
    >
      <CircularSpinner size={42} strokeWidth={3.5} label={label} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', maxWidth: 220 }}>
        <div className="skeleton-shimmer" style={{ width: '60%', height: 14, borderRadius: 4 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`catalog-skel-item-${i}`}
              className="skeleton-shimmer"
              style={{ aspectRatio: '1 / 1', borderRadius: 'var(--radius-md)' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

