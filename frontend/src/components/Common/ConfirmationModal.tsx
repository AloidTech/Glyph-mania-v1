/**
 * @file ConfirmationModal.tsx
 * @description Reusable confirmation and warning dialog modal for destructive,
 * replacing, or overwriting actions across the Atelier and workshop.
 */

import React from 'react';
import { WarningCircleIcon } from '@phosphor-icons/react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(18, 15, 12, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.18s ease forwards',
        pointerEvents: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="confirmation-modal-dialog"
        style={{
          position: 'relative',
          width: '90%',
          maxWidth: '430px',
          background: 'var(--color-surface, #fdfbf7)',
          border: '1.5px solid var(--color-border-strong, #c8bead)',
          borderRadius: 'var(--radius-lg, 16px)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.28)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.1rem',
          boxSizing: 'border-box',
          animation: 'speechBubblePopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: isDanger ? 'rgba(239, 68, 68, 0.12)' : 'rgba(217, 119, 6, 0.12)',
              color: isDanger ? '#dc2626' : '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <WarningCircleIcon size={26} weight="fill" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0, flex: 1 }}>
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--font-heading)',
                fontSize: '1.1rem',
                fontWeight: 700,
                letterSpacing: '0.03em',
                color: 'var(--color-text-primary, #2a2421)',
              }}
            >
              {title}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: '0.86rem',
                lineHeight: 1.45,
                color: 'var(--color-text-secondary, #5c5249)',
              }}
            >
              {message}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.65rem',
            marginTop: '0.4rem',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            style={{
              padding: '0.5rem 1.1rem',
              fontSize: '0.8rem',
              borderRadius: '999px',
            }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={`btn ${isDanger ? 'btn-primary' : 'btn-primary'}`}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.8rem',
              borderRadius: '999px',
              background: isDanger
                ? 'linear-gradient(135deg, #b91c1c, #991b1b)'
                : undefined,
              borderColor: isDanger ? '#ef4444' : undefined,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
