import React, { useState } from 'react';
import { EyeIcon, EyeClosedIcon, CopyIcon, CheckIcon } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export interface MaskedIdBadgeProps {
  id: string;
  label?: string;
  compact?: boolean;
  style?: React.CSSProperties;
  className?: string;
  allowCopy?: boolean;
}

export const MaskedIdBadge: React.FC<MaskedIdBadgeProps> = ({
  id,
  label,
  compact = false,
  style,
  className = '',
  allowCopy = true,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const toggleVisibility = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRevealed((prev) => !prev);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setHasCopied(true);
      toast.success('ID copied to clipboard!', { duration: 1800, id: 'masked-id-copy' });
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error('Failed to copy ID to clipboard');
    }
  };

  // Masked string representation resembling a password
  const maskedDisplay = '••••••••••••';

  return (
    <div
      className={`masked-id-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '0.35rem' : '0.5rem',
        padding: compact ? '1px 6px' : '3px 8px',
        background: 'var(--admin-paper-warm, #fbf9f4)',
        border: '1px solid var(--admin-border, #ede8df)',
        borderRadius: '5px',
        fontSize: compact ? '0.74rem' : '0.8rem',
        color: 'var(--admin-ink-secondary, #475569)',
        fontFamily: 'var(--font-mono, monospace)',
        lineHeight: 1.2,
        userSelect: isRevealed ? 'text' : 'none',
        maxWidth: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
      onClick={(e) => {
        // Prevent parent links from navigating if clicked inside badge
        e.stopPropagation();
      }}
    >
      {label && (
        <span
          style={{
            fontFamily: 'var(--font-heading, sans-serif)',
            fontSize: compact ? '0.68rem' : '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'var(--admin-ink-muted, #94a3b8)',
            textTransform: 'uppercase',
            userSelect: 'none',
          }}
        >
          {label}
        </span>
      )}

      <span
        style={{
          letterSpacing: isRevealed ? '0.01em' : '0.12em',
          color: isRevealed ? 'var(--admin-ink, #1a1614)' : 'var(--admin-ink-muted, #94a3b8)',
          fontWeight: isRevealed ? 500 : 700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: compact ? (isRevealed ? 180 : 100) : (isRevealed ? 280 : 120),
          transition: 'color 0.15s ease',
        }}
        title={isRevealed ? id : 'Click the eye to reveal ID'}
      >
        {isRevealed ? id : maskedDisplay}
      </span>

      {/* Eye Toggle Button */}
      <button
        type="button"
        onClick={toggleVisibility}
        title={isRevealed ? 'Hide ID' : 'Reveal ID'}
        aria-label={isRevealed ? 'Hide ID' : 'Reveal ID'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          padding: '2px',
          margin: 0,
          cursor: 'pointer',
          color: isRevealed ? 'var(--admin-accent, #c59b27)' : 'var(--admin-ink-muted, #94a3b8)',
          borderRadius: '3px',
          transition: 'color 0.15s ease, background-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = 'var(--admin-accent, #c59b27)';
        }}
        onMouseLeave={(e) => {
          if (!isRevealed) {
            (e.currentTarget as HTMLElement).style.color = 'var(--admin-ink-muted, #94a3b8)';
          }
        }}
      >
        {isRevealed ? (
          <EyeClosedIcon size={compact ? 13 : 15} weight="bold" />
        ) : (
          <EyeIcon size={compact ? 13 : 15} weight="bold" />
        )}
      </button>

      {/* Copy Button */}
      {allowCopy && (
        <button
          type="button"
          onClick={handleCopy}
          title={hasCopied ? 'Copied!' : 'Copy full ID'}
          aria-label="Copy ID"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            padding: '2px',
            margin: 0,
            cursor: 'pointer',
            color: hasCopied ? 'var(--admin-success, #2f855a)' : 'var(--admin-ink-muted, #94a3b8)',
            borderRadius: '3px',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!hasCopied) {
              (e.currentTarget as HTMLElement).style.color = 'var(--admin-ink, #1a1614)';
            }
          }}
          onMouseLeave={(e) => {
            if (!hasCopied) {
              (e.currentTarget as HTMLElement).style.color = 'var(--admin-ink-muted, #94a3b8)';
            }
          }}
        >
          {hasCopied ? (
            <CheckIcon size={compact ? 12 : 14} weight="bold" />
          ) : (
            <CopyIcon size={compact ? 12 : 14} />
          )}
        </button>
      )}
    </div>
  );
};
