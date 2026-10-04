import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  SparkleIcon,
  SlidersIcon,
  EyeIcon,
  CompassIcon,
  CrosshairIcon,
  FireIcon,
  DropIcon,
  GlobeIcon,
  WindIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useAdminGlyphsStore, AdminGlyphItem } from '../../lib/stores/admin_glyphs_store';
import { syncGlyph } from '../../lib/admin_utils/sync_helpers';
import { UnsavedBadge } from '../../components/UnsavedBadge';
import { GlyphsGridSkeleton, CircularSpinner } from '../../components/Common/CircularLoadingComponents';
import toast from 'react-hot-toast';

export const GlyphsListPage: React.FC = () => {
  const { glyphs, drafts, remoteGlyphs, deleteGlyph, loadRemoteGlyphs, isLoadingRemote } = useAdminGlyphsStore();
  const [filterElement, setFilterElement] = useState<'all' | 'fire' | 'water' | 'earth' | 'air'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadRemoteGlyphs();
  }, [loadRemoteGlyphs]);

  const filteredGlyphs = glyphs.filter((g) => {
    const matchesElement = filterElement === 'all' || g.element === filterElement;
    const matchesSearch =
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.tags && g.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())));
    return matchesElement && matchesSearch;
  });

  const handleDelete = (glyph: AdminGlyphItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${glyph.name}"?`)) {
      deleteGlyph(glyph.id);
      toast.success(`Deleted "${glyph.name}"`);
    }
  };

  const getElementBadgeIcon = (el?: string) => {
    switch (el?.toLowerCase()) {
      case 'fire':
        return <FireIcon size={13} weight="fill" color="var(--element-fire)" />;
      case 'water':
        return <DropIcon size={13} weight="fill" color="var(--element-water)" />;
      case 'earth':
        return <GlobeIcon size={13} weight="fill" color="var(--element-earth)" />;
      case 'air':
        return <WindIcon size={13} weight="fill" color="var(--element-air)" />;
      default:
        return <SparkleIcon size={13} weight="fill" color="var(--admin-accent)" />;
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Arcane Glyphs Catalog</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              Manage composite glyph structures, semantic slot layouts, and test complex multi-symbol drawings.
            </p>
            {isLoadingRemote && glyphs.length > 0 && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  color: 'var(--admin-accent)',
                  fontWeight: 600,
                  background: 'var(--admin-accent-subtle)',
                  padding: '2px 8px',
                  borderRadius: 9999,
                }}
              >
                <CircularSpinner size={12} strokeWidth={2.5} />
                <span>Syncing Cloud...</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link
            to="/glyph/testing"
            className="admin-btn admin-btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <CrosshairIcon size={18} weight="bold" />
            Glyph Testing Pad
          </Link>
          <Link
            to="/admin/glyph/testing"
            className="admin-btn admin-btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <PlusIcon size={18} weight="bold" />
            New Glyph Session
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
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
          <button
            type="button"
            className={`admin-filter-pill ${filterElement === 'all' ? 'active' : ''}`}
            onClick={() => setFilterElement('all')}
          >
            All
            <span className="filter-count-badge">{glyphs.length}</span>
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${filterElement === 'fire' ? 'active' : ''}`}
            onClick={() => setFilterElement('fire')}
          >
            Fire
            <span className="filter-count-badge">
              {glyphs.filter((g) => g.element === 'fire').length}
            </span>
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${filterElement === 'water' ? 'active' : ''}`}
            onClick={() => setFilterElement('water')}
          >
            Water
            <span className="filter-count-badge">
              {glyphs.filter((g) => g.element === 'water').length}
            </span>
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${filterElement === 'earth' ? 'active' : ''}`}
            onClick={() => setFilterElement('earth')}
          >
            Earth
            <span className="filter-count-badge">
              {glyphs.filter((g) => g.element === 'earth').length}
            </span>
          </button>
        </div>

        <div style={{ flex: 1, maxWidth: 320 }}>
          <input
            type="text"
            className="admin-input"
            style={{ width: '100%', boxSizing: 'border-box' }}
            placeholder="Search glyphs by name, tags, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Glyphs Grid */}
      {isLoadingRemote && glyphs.length === 0 ? (
        <GlyphsGridSkeleton count={6} />
      ) : filteredGlyphs.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <CompassIcon size={44} color="var(--admin-ink-muted)" style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--admin-ink)' }}>No Saved Glyphs Found</h3>
          <p style={{ margin: '0 0 1.5rem', color: 'var(--admin-ink-muted)', maxWidth: 460, marginInline: 'auto' }}>
            No glyphs match your current filter. Open the Glyph Testing Studio to draw and recognize new composite formations.
          </p>
          <Link to="/glyph/testing" className="admin-btn admin-btn-primary">
            <CrosshairIcon size={18} weight="bold" />
            Open Glyph Testing Studio
          </Link>
        </div>
      ) : (
        <div className="sigils-grid">
          {filteredGlyphs.map((glyph) => {
            const hasDraft = Boolean(drafts[glyph.id]);
            const isExistingRemote = remoteGlyphs.some((r) => r.id === glyph.id);
            const isUnsaved = Boolean((glyph as any).isUnsaved || (hasDraft && isExistingRemote));
            const isDraft = Boolean((glyph as any).isDraft || (hasDraft && !isExistingRemote));

            return (
              <div key={glyph.id} className="sigil-card">
                <div style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="sigil-card-preview" style={{ background: 'radial-gradient(circle at 50% 50%, var(--admin-accent-subtle), transparent 70%), var(--admin-paper-warm)' }}>
                    {/* Top-left Badges Container */}
                    <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 10 }}>
                      {/* Floating Confidence Badge */}
                      {glyph.confidenceScore && (
                        <span
                          className="admin-badge sigil-card-badge admin-badge-success"
                          style={{ position: 'relative', top: 0, left: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <SparkleIcon size={12} weight="fill" />
                          {Math.round(glyph.confidenceScore * 100)}% Match
                        </span>
                      )}
                    </div>

                    {/* Top-right Status Badge (Clickable Sync Trigger) */}
                    <UnsavedBadge
                      isDraft={isDraft}
                      isUnsaved={isUnsaved}
                      onClick={() => syncGlyph(glyph)}
                    />

                    {glyph.coverAsset ? (
                      <div
                        style={{
                          width: 88,
                          height: 88,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--admin-crop-preview-bg)',
                          border: '1px solid var(--admin-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.4rem',
                          boxShadow: 'var(--admin-diagram-node-shadow)',
                        }}
                      >
                        <img
                          src={glyph.coverAsset}
                          alt={glyph.name}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 84,
                          height: 84,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--admin-paper-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--admin-ink-muted)',
                          border: '1px dashed var(--admin-border)',
                        }}
                      >
                        <CompassIcon size={32} />
                      </div>
                    )}
                  </div>

                  <div className="sigil-card-content">
                    <div className="sigil-card-header">
                      <h3 className="sigil-card-title">{glyph.name}</h3>
                      <span
                        className="admin-badge"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          background: 'var(--admin-accent-subtle)',
                          color: 'var(--admin-ink)',
                          fontWeight: 600,
                        }}
                      >
                        {getElementBadgeIcon(glyph.element)}
                        Tier {glyph.tier} · {glyph.element ? glyph.element.toUpperCase() : 'GLYPH'}
                      </span>
                    </div>

                    <p className="sigil-card-desc" style={{ marginTop: '0.45rem' }}>{glyph.description || 'No description provided.'}</p>
                  </div>
                </div>

                <div className="sigil-card-footer">
                  <button
                    type="button"
                    onClick={(e) => handleDelete(glyph, e)}
                    className="admin-btn admin-btn-danger sigil-card-action-btn"
                    title="Delete Glyph"
                    style={{ flex: '0 0 38px', padding: '0.5rem' }}
                  >
                    <TrashIcon size={15} />
                  </button>
                  <Link
                    to="/glyph/testing"
                    className="admin-btn admin-btn-primary sigil-card-action-btn"
                    title="Test Glyph Drawing"
                    style={{ flex: 1 }}
                  >
                    <EyeIcon size={15} weight="bold" />
                    Test in Drawpad
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
