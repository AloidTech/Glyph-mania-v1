import React, { useState, useRef, useEffect } from 'react';

export interface SplitButtonOption {
  /** Unique key for the option */
  key: string;
  /** Display label */
  label: string;
  /** Optional icon rendered before the label */
  icon?: React.ReactNode;
  /** Callback when this option is selected */
  onClick: () => void;
  /** Optional description shown below the label */
  description?: string;
}

export interface SplitButtonProps {
  /** The primary (default) action — clicking the main button fires this */
  primaryLabel: string;
  primaryIcon?: React.ReactNode;
  onPrimaryClick: () => void;
  primaryTitle?: string;

  /** Dropdown options (shown when the chevron is clicked) */
  options: SplitButtonOption[];

  /** Visual size variant */
  size?: 'sm' | 'md';

  /** Accent color for the primary button background (defaults to #0088ff) */
  accentColor?: string;
  /** Text color for the primary button (defaults to #fff) */
  textColor?: string;

  /** Additional className on the wrapper */
  className?: string;
  /** Additional inline style on the wrapper */
  style?: React.CSSProperties;
}

/**
 * A split button with a primary action on the left and a dropdown chevron
 * on the right that reveals additional action options.
 *
 * Usage:
 * ```tsx
 * <SplitButton
 *   primaryLabel="Apply to All"
 *   primaryIcon={<SyncIcon size={16} />}
 *   onPrimaryClick={handleApplyAllSettings}
 *   options={[
 *     { key: 'settings', label: 'Apply All Settings', onClick: handleApplyAllSettings },
 *     { key: 'last', label: 'Apply Last Change', onClick: handleApplyLastChange },
 *   ]}
 * />
 * ```
 */
export const SplitButton: React.FC<SplitButtonProps> = ({
  primaryLabel,
  primaryIcon,
  onPrimaryClick,
  primaryTitle,
  options,
  size = 'md',
  accentColor = '#0088ff',
  textColor = '#fff',
  className,
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const isSm = size === 'sm';

  const basePadding = isSm ? '3px 8px' : '0.55rem 1rem';
  const fontSize = isSm ? '0.72rem' : '0.85rem';
  const chevronPadding = isSm ? '3px 5px' : '0.55rem 0.5rem';
  const borderRadius = isSm ? 4 : 6;

  // Derive a slightly darker shade for the divider & hover
  const darkenHex = (hex: string, amount: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, ((num >> 16) & 0xff) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  const hoverBg = darkenHex(accentColor, 30);
  const dividerColor = darkenHex(accentColor, 50);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        position: 'relative',
        display: 'inline-flex',
        ...style,
      }}
    >
      {/* Primary action button */}
      <button
        type="button"
        onClick={onPrimaryClick}
        title={primaryTitle}
        style={{
          padding: basePadding,
          display: 'inline-flex',
          alignItems: 'center',
          gap: isSm ? 4 : '0.45rem',
          fontSize,
          cursor: 'pointer',
          background: accentColor,
          border: 'none',
          borderRadius: `${borderRadius}px 0 0 ${borderRadius}px`,
          color: textColor,
          fontWeight: isSm ? 600 : 600,
          transition: 'background 0.15s ease',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
        onMouseLeave={(e) => (e.currentTarget.style.background = accentColor)}
      >
        {primaryIcon}
        {primaryLabel}
      </button>

      {/* Divider line */}
      <div
        style={{
          width: 1,
          alignSelf: 'stretch',
          background: dividerColor,
        }}
      />

      {/* Dropdown chevron button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          padding: chevronPadding,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: isOpen ? hoverBg : accentColor,
          border: 'none',
          borderRadius: `0 ${borderRadius}px ${borderRadius}px 0`,
          color: textColor,
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
        onMouseLeave={(e) => (e.currentTarget.style.background = isOpen ? hoverBg : accentColor)}
        title="More options"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {/* Inline SVG chevron — avoids an extra icon dependency */}
        <svg
          width={isSm ? 10 : 12}
          height={isSm ? 10 : 12}
          viewBox="0 0 12 12"
          fill="none"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            minWidth: isSm ? 180 : 220,
            background: '#161622',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65)',
            zIndex: 50,
            overflow: 'hidden',
            animation: 'splitbtn-fadein 0.12s ease',
          }}
        >
          <style>{`
            @keyframes splitbtn-fadein {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {options.map((opt, idx) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                opt.onClick();
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                gap: isSm ? 6 : 8,
                padding: isSm ? '6px 10px' : '8px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: idx < options.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                color: '#e0e0ff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.12s ease',
                fontSize: isSm ? '0.72rem' : '0.8rem',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 136, 255, 0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {opt.icon && (
                <span style={{ flexShrink: 0, marginTop: 1, color: accentColor }}>
                  {opt.icon}
                </span>
              )}
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{opt.label}</span>
                {opt.description && (
                  <span style={{ fontSize: isSm ? '0.62rem' : '0.7rem', color: '#8888aa', lineHeight: 1.3 }}>
                    {opt.description}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
