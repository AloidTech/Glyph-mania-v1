import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { FloppyDiskIcon, XIcon, SignInIcon, UserCircleIcon, TrashIcon } from '@phosphor-icons/react';
import { Element } from '../types/glyph_types';

export interface SaveGlyphData {
  name: string;
  description: string;
  element: Element;
  tier: number;
  isPublic: boolean;
}

interface SaveGlyphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SaveGlyphData) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  previewImage?: string | null;
  defaultName?: string;
  defaultDescription?: string;
  defaultElement?: Element;
  defaultTier?: number;
  defaultIsPublic?: boolean;
  // Optional summary details to show next to preview
  detectedComponentsCount?: number;
  identifiedCenterLabel?: string;
  isWorkshop?: boolean; // Changes styling to match game UI vs admin UI
  user?: User | null; // Optional user object for login guarding
  isSolid?: boolean; // Whether the glyph is fully solid
}

export const SaveGlyphModal: React.FC<SaveGlyphModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  previewImage,
  defaultName = '',
  defaultDescription = '',
  defaultElement = 'fire',
  defaultTier = 1,
  defaultIsPublic = false,
  detectedComponentsCount,
  identifiedCenterLabel,
  isWorkshop = false,
  user,
  isSolid = true,
}) => {
  const navigate = useNavigate();
  const [allowLocalDraftSave, setAllowLocalDraftSave] = useState(false);
  const [name, setName] = useState<string>(defaultName);
  const [description, setDescription] = useState(defaultDescription);
  const [element, setElement] = useState<Element>(defaultElement);
  const [tier, setTier] = useState<number>(defaultTier);
  const [isPublic, setIsPublic] = useState(defaultIsPublic);
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setDescription(defaultDescription);
      setElement(defaultElement);
      setTier(defaultTier);
      // Force public off if not solid
      setIsPublic(isSolid ? defaultIsPublic : false);
      setIsSaving(false);
      setAllowLocalDraftSave(false);
    }
  }, [isOpen, defaultName, defaultDescription, defaultElement, defaultTier, defaultIsPublic, isSolid]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({ name, description, element, tier, isPublic });
    } catch (err) {
      console.error('Error saving glyph:', err);
    } finally {
      setIsSaving(false);
      onClose();
    }
  };

  // Determine styles based on context
  const overlayStyle: React.CSSProperties = isWorkshop
    ? { zIndex: 100 } // Uses Workshop modal-overlay class
    : { zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' };

  const panelStyle: React.CSSProperties = isWorkshop
    ? { width: '450px', maxWidth: '90vw' } // Uses pause-modal class
    : {
      width: 480,
      maxWidth: '92vw',
      padding: '1.75rem',
      background: 'var(--admin-paper)',
      borderRadius: 14,
      boxShadow: 'var(--admin-modal-shadow)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
    };

  return (
    <div
      className={isWorkshop ? "modal-overlay" : "modal-overlay"}
      style={overlayStyle}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      {/* Click outside to close (simple implementation) */}
      {!isWorkshop && (
        <div
          style={{ position: 'absolute', inset: 0, zIndex: -1 }}
          onClick={onClose}
        />
      )}

      <div
        className={isWorkshop ? "pause-modal" : "admin-panel"}
        style={panelStyle as any}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isWorkshop ? '1rem' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {!isWorkshop && <FloppyDiskIcon size={22} color="var(--admin-accent)" weight="fill" />}
            <h3 style={{
              margin: 0,
              fontFamily: isWorkshop ? 'var(--font-display)' : 'var(--font-heading)',
              fontSize: isWorkshop ? '1.5rem' : '1.25rem',
              color: isWorkshop ? 'var(--color-primary)' : 'var(--admin-ink)',
              letterSpacing: isWorkshop ? '0.1em' : 'normal'
            }}>
              {isWorkshop ? 'SAVE GLYPH' : 'Save Glyph Formation'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isWorkshop ? 'var(--color-text-muted)' : 'var(--admin-ink-muted)',
              padding: 4
            }}
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Glyph Snapshot Preview */}
        {previewImage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '0.75rem',
              background: isWorkshop ? 'rgba(0,0,0,0.03)' : 'var(--admin-paper-muted)',
              borderRadius: 10,
              marginBottom: isWorkshop ? '1rem' : 0
            }}
          >
            <img
              src={previewImage}
              alt="Glyph Drawing"
              style={{
                width: 64,
                height: 64,
                objectFit: 'contain',
                background: isWorkshop ? 'var(--color-surface-raised)' : 'var(--admin-crop-preview-bg)',
                borderRadius: 8,
                border: `1px solid ${isWorkshop ? 'var(--color-border)' : 'var(--admin-border)'}`,
              }}
            />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isWorkshop ? 'var(--color-text-primary)' : 'var(--admin-ink)' }}>
                {detectedComponentsCount !== undefined ? `${detectedComponentsCount} Detected Components` : 'Drawn Composite Glyph'}
              </div>
              <div style={{ fontSize: '0.75rem', color: isWorkshop ? 'var(--color-text-muted)' : 'var(--admin-ink-muted)', marginTop: 2 }}>
                {identifiedCenterLabel
                  ? `Identified Center: ${identifiedCenterLabel}`
                  : 'Ready to register into the Glyphs Catalog'}
              </div>
            </div>
          </div>
        )}

        {user === null && !allowLocalDraftSave ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center', padding: '0.75rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <UserCircleIcon size={52} weight="duotone" color={isWorkshop ? 'var(--color-primary)' : 'var(--admin-accent)'} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem', color: isWorkshop ? 'var(--color-text-primary)' : 'var(--admin-ink)' }}>
                Sign In Required
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: isWorkshop ? 'var(--color-text-muted)' : 'var(--admin-ink-muted)', lineHeight: 1.4 }}>
                Please sign in or create an account to save your crafted glyph formations to the cloud and share them with the atelier.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/auth');
                }}
                className={isWorkshop ? "btn btn-primary" : "admin-btn admin-btn-primary"}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem' }}
              >
                <SignInIcon size={18} weight="bold" />
                Login / Sign Up First
              </button>

              <button
                type="button"
                onClick={() => setAllowLocalDraftSave(true)}
                className={isWorkshop ? "btn btn-secondary" : "admin-btn admin-btn-secondary"}
                style={{ padding: '0.65rem', fontSize: '0.82rem' }}
              >
                Save Locally as Draft Instead
              </button>

              <button
                type="button"
                onClick={onClose}
                className={isWorkshop ? "btn btn-secondary" : "admin-btn admin-btn-secondary"}
                style={{ padding: '0.55rem', fontSize: '0.8rem', opacity: 0.75 }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={isWorkshop ? "" : "admin-form"} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={isWorkshop ? "" : "admin-form-group"}>
              <label className={isWorkshop ? "" : "admin-label"} htmlFor="glyph-name-input" style={isWorkshop ? { display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' } : {}}>
                Glyph Name *
              </label>
              <input
                id="glyph-name-input"
                type="text"
                className={isWorkshop ? "" : "admin-input"}
                placeholder="e.g. Inferno Vortex Glyph"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
                required
                autoFocus
                style={isWorkshop ? {
                  width: '100%',
                  padding: '0.5rem',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                  color: 'var(--color-text-primary)'
                } : {}}
              />
            </div>

            <div className={isWorkshop ? "" : "admin-form-group"}>
              <label className={isWorkshop ? "" : "admin-label"} htmlFor="glyph-desc-input" style={isWorkshop ? { display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' } : {}}>
                Description
              </label>
              <textarea
                id="glyph-desc-input"
                className={isWorkshop ? "" : "admin-textarea"}
                placeholder="Describe the function, layout, or lore of this composite glyph formation..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
                rows={3}
                style={isWorkshop ? {
                  width: '100%',
                  padding: '0.5rem',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  color: 'var(--color-text-primary)'
                } : {}}
              />
            </div>

            {/* Element & Tier Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
              <div className={isWorkshop ? "" : "admin-form-group"}>
                <label className={isWorkshop ? "" : "admin-label"} style={isWorkshop ? { display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' } : {}}>Element Alignment</label>
                <select
                  className={isWorkshop ? "" : "admin-input"}
                  value={element}
                  onChange={(e) => setElement(e.target.value as any)}
                  style={isWorkshop ? {
                    width: '100%',
                    padding: '0.5rem',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    fontFamily: 'inherit',
                    color: 'var(--color-text-primary)'
                  } : {}}
                >
                  <option value="fire">Fire</option>
                  <option value="water">Water</option>
                  <option value="earth">Earth</option>
                  <option value="air">Air</option>
                </select>
              </div>

              <div className={isWorkshop ? "" : "admin-form-group"}>
                <label className={isWorkshop ? "" : "admin-label"} style={isWorkshop ? { display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' } : {}}>Tier Level</label>
                <select
                  className={isWorkshop ? "" : "admin-input"}
                  value={tier}
                  onChange={(e) => setTier(Number(e.target.value))}
                  style={isWorkshop ? {
                    width: '100%',
                    padding: '0.5rem',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    fontFamily: 'inherit',
                    color: 'var(--color-text-primary)'
                  } : {}}
                >
                  <option value={1}>Tier 1 (Core)</option>
                  <option value={2}>Tier 2 (Advanced)</option>
                  <option value={3}>Tier 3 (Master)</option>
                </select>
              </div>
            </div>

            {/* Public / Private Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', background: isWorkshop ? 'transparent' : 'var(--admin-paper-muted)', padding: isWorkshop ? 0 : '0.75rem', borderRadius: 8 }}>
              <span style={{ fontSize: '0.9rem', color: isPublic ? (isWorkshop ? 'var(--color-text-muted)' : 'var(--admin-ink-muted)') : (isWorkshop ? 'var(--color-text-primary)' : 'var(--admin-ink)'), fontWeight: !isPublic ? 600 : 400 }}>Private</span>

              {/* Toggle Slider */}
              <div
                onClick={() => {
                  if (isSolid) setIsPublic(!isPublic);
                }}
                style={{
                  width: '40px',
                  height: '20px',
                  borderRadius: '10px',
                  background: isPublic ? (isWorkshop ? 'var(--color-primary)' : 'var(--admin-accent)') : (isWorkshop ? 'var(--color-border-strong)' : 'var(--admin-border-strong)'),
                  position: 'relative',
                  cursor: isSolid ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s ease',
                  opacity: isSolid ? 1 : 0.5
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  left: isPublic ? '22px' : '2px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </div>

              <span style={{ fontSize: '0.9rem', color: isPublic ? (isWorkshop ? 'var(--color-text-primary)' : 'var(--admin-ink)') : (isWorkshop ? 'var(--color-text-muted)' : 'var(--admin-ink-muted)'), fontWeight: isPublic ? 600 : 400, opacity: isSolid ? 1 : 0.5 }}>Public</span>

              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: isWorkshop ? (isSolid ? 'var(--color-text-muted)' : 'var(--color-destructive, #b91c1c)') : 'var(--admin-ink-muted)', fontStyle: 'italic' }}>
                {!isSolid ? "Glyph must be solid to save publicly" : (isPublic ? "Anyone can use this glyph" : "Only you can see this")}
              </span>
            </div>

            <div className={isWorkshop ? "pause-modal-actions" : ""} style={isWorkshop ? { marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.65rem' } : { display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              {onDelete && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(`Are you sure you want to delete "${name || 'this glyph'}"? This action cannot be undone.`)) {
                      await onDelete();
                      onClose();
                    }
                  }}
                  disabled={isSaving}
                  className={isWorkshop ? "btn btn-secondary" : "admin-btn admin-btn-secondary"}
                  style={{
                    ...(isWorkshop ? {} : { padding: '0.55rem 1rem' }),
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: 'var(--color-destructive, #b91c1c)',
                    borderColor: 'rgba(185, 28, 28, 0.4)',
                    marginRight: 'auto',
                    cursor: 'pointer',
                  }}
                  title="Delete this glyph"
                >
                  <TrashIcon size={16} weight="bold" />
                  <span>Delete</span>
                </button>
              )}

              <button
                type="submit"
                disabled={isSaving || !name.trim()}
                className={isWorkshop ? "btn btn-primary" : "admin-btn admin-btn-primary"}
                style={{
                  ...(isWorkshop ? {} : { padding: '0.55rem 1.25rem' }),
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  opacity: (isSaving || !name.trim()) ? 0.65 : 1,
                  cursor: isSaving ? 'wait' : (!name.trim() ? 'not-allowed' : 'pointer'),
                }}
              >
                {isSaving ? (
                  <>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 14,
                        height: 14,
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#ffffff',
                        borderRadius: '50%',
                        animation: 'spin 0.7s linear infinite',
                      }}
                    />
                    <span>Saving…</span>
                  </>
                ) : (
                  'Save Glyph'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className={isWorkshop ? "btn btn-secondary" : "admin-btn admin-btn-secondary"}
                style={isWorkshop ? {} : { padding: '0.55rem 1.25rem' }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
