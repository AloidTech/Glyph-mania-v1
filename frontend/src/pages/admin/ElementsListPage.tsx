import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SparkleIcon, FireIcon, PlusIcon, SlidersIcon, XIcon } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase/supabase';
import { useElementsStore } from '../../lib/stores/elements_store';

export const ElementsListPage: React.FC = () => {
  const { elements, loadElements, getEffectsForElement, isLoading } = useElementsStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Create Element Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newPrimaryColor, setNewPrimaryColor] = useState('#8b5cf6');
  const [newSecondaryColor, setNewSecondaryColor] = useState('#a78bfa');
  const [newVfxKey, setNewVfxKey] = useState('');
  const [newDamage, setNewDamage] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (elements.length === 0) {
      useElementsStore.getState().loadElements();
    }
  }, [elements.length]);

  const handleCreateElement = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newId.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const cleanLabel = newLabel.trim();

    if (!cleanId || !cleanLabel) {
      toast.error('Element ID and Name are required.');
      return;
    }

    if (elements.some((el) => el.id === cleanId)) {
      toast.error(`An element with ID "${cleanId}" already exists.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('elements').insert({
        id: cleanId,
        label: cleanLabel,
        primary_color: newPrimaryColor,
        secondary_color: newSecondaryColor,
        particle_vfx_key: newVfxKey.trim() || `${cleanId.toLowerCase()}_particles`,
        base_hit_damage: newDamage,
      });

      if (error) throw error;

      await loadElements();
      toast.success(`Element "${cleanLabel}" (${cleanId}) created successfully!`);
      setIsCreateModalOpen(false);
      setNewId('');
      setNewLabel('');
      setNewVfxKey('');
      setNewDamage(100);
    } catch (err: any) {
      console.error('Failed to create element:', err);
      toast.error(`Failed to create element: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredElements = elements.filter((el) => {
    return el.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
           el.id.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Elements Catalog</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              Manage game elements, their colors, base damages, and attached effects.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <PlusIcon size={18} weight="bold" />
          Create New Element
        </button>
      </div>

      <div
        className="admin-panel"
        style={{
          padding: '0.85rem 1.25rem',
          marginBottom: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div className="admin-filter-bar">
          <button type="button" className="admin-filter-pill active">
            All
            <span className="filter-count-badge">{elements.length}</span>
          </button>
        </div>

        <div style={{ flex: 1, maxWidth: 320 }}>
          <input
            type="text"
            className="admin-input"
            style={{ width: '100%', boxSizing: 'border-box' }}
            placeholder="Search elements by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading && elements.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <p>Loading elements...</p>
        </div>
      ) : filteredElements.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <SparkleIcon size={40} color="var(--admin-ink-muted)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--admin-ink)' }}>No Elements Found</h3>
          <p style={{ margin: '0 0 1.5rem', color: 'var(--admin-ink-muted)' }}>
            No elements match your search.
          </p>
        </div>
      ) : (
        <div className="sigils-grid">
          {filteredElements.map((el) => {
            const effects = getEffectsForElement(el.id);
            const effectCount = effects.length;
            
            return (
              <div key={el.id} className="sigil-card">
                <Link
                  to={`/admin/elements/${el.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="sigil-card-preview" style={{ background: `linear-gradient(135deg, ${el.primaryColor}, ${el.secondaryColor})` }}>
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{el.label.charAt(0)}</span>
                    </div>
                  </div>

                  <div className="sigil-card-content">
                    <div className="sigil-card-header-row">
                      <h3 className="sigil-card-title">{el.label}</h3>
                      <span className="sigil-type-badge effector">
                        {effectCount} {effectCount === 1 ? 'Effect' : 'Effects'}
                      </span>
                    </div>

                    <div className="sigil-card-meta-row">
                      <span className="sigil-tier-pill">
                        DMG: {el.baseHitDamage}
                      </span>
                    </div>

                    <p className="sigil-card-desc" style={{marginTop: '0.5rem'}}>
                      Colors: <span style={{display:'inline-block', width:12, height:12, background:el.primaryColor, borderRadius:3, marginRight:4}}/> 
                      <span style={{display:'inline-block', width:12, height:12, background:el.secondaryColor, borderRadius:3}}/>
                    </p>
                  </div>
                </Link>

                <div className="sigil-card-footer">
                  <Link
                    to={`/admin/elements/${el.id}`}
                    className="sigil-btn-edit"
                    title="Edit Details"
                  >
                    <SlidersIcon size={13} />
                    EDIT
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Element Modal */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) {
              setIsCreateModalOpen(false);
            }
          }}
        >
          <div
            className="admin-panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '1.75rem',
              boxShadow: 'var(--admin-modal-shadow, 0 20px 40px rgba(0,0,0,0.25))',
              position: 'relative',
              animation: 'exemplarModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
                borderBottom: '1px solid var(--admin-border)',
                paddingBottom: '0.75rem',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Create New Element</h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--admin-ink-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateElement} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Element ID <span style={{ color: 'var(--admin-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="admin-input"
                  style={{ width: '100%', boxSizing: 'border-box', textTransform: 'uppercase' }}
                  placeholder="e.g. LIGHTNING"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value.toUpperCase())}
                  required
                  disabled={isSubmitting}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--admin-ink-muted)' }}>
                  Unique uppercase identifier used in database and engine logic.
                </span>
              </div>

              <div>
                <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Element Name / Label <span style={{ color: 'var(--admin-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="admin-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="e.g. Lightning"
                  value={newLabel}
                  onChange={(e) => {
                    setNewLabel(e.target.value);
                    if (!newId || newId === newLabel.toUpperCase().replace(/[^A-Z0-9_]/g, '')) {
                      setNewId(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''));
                    }
                  }}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Primary Color
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="color"
                      value={newPrimaryColor}
                      onChange={(e) => setNewPrimaryColor(e.target.value)}
                      disabled={isSubmitting}
                      style={{ width: '38px', height: '38px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      className="admin-input"
                      value={newPrimaryColor}
                      onChange={(e) => setNewPrimaryColor(e.target.value)}
                      disabled={isSubmitting}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Secondary Color
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="color"
                      value={newSecondaryColor}
                      onChange={(e) => setNewSecondaryColor(e.target.value)}
                      disabled={isSubmitting}
                      style={{ width: '38px', height: '38px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      className="admin-input"
                      value={newSecondaryColor}
                      onChange={(e) => setNewSecondaryColor(e.target.value)}
                      disabled={isSubmitting}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Particle VFX Key
                  </label>
                  <input
                    type="text"
                    className="admin-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. lightning_sparks"
                    value={newVfxKey}
                    onChange={(e) => setNewVfxKey(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Base Damage
                  </label>
                  <input
                    type="number"
                    className="admin-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={newDamage}
                    min={0}
                    step={1}
                    onChange={(e) => setNewDamage(Number(e.target.value))}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Preview card swatch */}
              <div style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                background: 'var(--admin-bg)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '6px',
                    background: `linear-gradient(135deg, ${newPrimaryColor}, ${newSecondaryColor})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                  }}
                >
                  {newLabel ? newLabel.charAt(0).toUpperCase() : '?'}
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 600 }}>{newLabel || 'Element Preview'}</div>
                  <div style={{ color: 'var(--admin-ink-muted)' }}>ID: {newId || 'NONE'} &bull; Base DMG: {newDamage}</div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '1rem',
                  borderTop: '1px solid var(--admin-border)',
                  paddingTop: '1rem',
                }}
              >
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Element'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
