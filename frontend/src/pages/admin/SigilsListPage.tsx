import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, BrainIcon, SparkleIcon, SlidersIcon, LightbulbIcon } from '@phosphor-icons/react';
import { useAdminSigilsStore } from '../../lib/stores/admin_sigils_store';
import { useTrainingStore } from '../../lib/ml/training_store';
import { syncSigil } from '../../lib/admin_utils/sync_helpers';
import { UnsavedBadge } from '../../components/UnsavedBadge';
import { SigilsGridSkeleton, CircularSpinner } from '../../components/Common/CircularLoadingComponents';

export const SigilsListPage: React.FC = () => {
  const { sigils, drafts, remoteSigils, loadRemoteSigils, isLoadingRemote } = useAdminSigilsStore();
  const examples = useTrainingStore((state) => state.examples);
  const [filterType, setFilterType] = useState<'all' | 'effector' | 'form' | 'position'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadRemoteSigils();
    useTrainingStore.getState().loadRemoteExamples();
  }, [loadRemoteSigils]);

  const getSigilCategory = (s: typeof sigils[0]): 'effector' | 'form' | 'position' => {
    return s.sigilType || (s.type === 'effector' ? 'effector' : s.augmentorType === 'position' ? 'position' : 'form');
  };

  const filteredSigils = sigils.filter((s) => {
    const category = getSigilCategory(s);
    const matchesType = filterType === 'all' || category === filterType;
    const matchesSearch =
      s.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Arcane Sigils Catalog</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              Manage your registered sigils, cover graphics, definitions, and ML training exemplars.
            </p>
            {isLoadingRemote && sigils.length > 0 && (
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

        <Link to="/admin_dashboard/sigils/create" className="admin-btn admin-btn-primary">
          <PlusIcon size={18} weight="bold" />
          Create New Sigil
        </Link>
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
            className={`admin-filter-pill ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All
            <span className="filter-count-badge">{sigils.length}</span>
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${filterType === 'effector' ? 'active' : ''}`}
            onClick={() => setFilterType('effector')}
          >
            Effectors
            <span className="filter-count-badge">
              {sigils.filter((s) => getSigilCategory(s) === 'effector').length}
            </span>
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${filterType === 'form' ? 'active' : ''}`}
            onClick={() => setFilterType('form')}
          >
            Forms
            <span className="filter-count-badge">
              {sigils.filter((s) => getSigilCategory(s) === 'form').length}
            </span>
          </button>
          <button
            type="button"
            className={`admin-filter-pill ${filterType === 'position' ? 'active' : ''}`}
            onClick={() => setFilterType('position')}
          >
            Positions
            <span className="filter-count-badge">
              {sigils.filter((s) => getSigilCategory(s) === 'position').length}
            </span>
          </button>
        </div>

        <div style={{ flex: 1, maxWidth: 320 }}>
          <input
            type="text"
            className="admin-input"
            style={{ width: '100%', boxSizing: 'border-box' }}
            placeholder="Search sigils by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Sigils Grid */}
      {isLoadingRemote && sigils.length === 0 ? (
        <SigilsGridSkeleton count={6} />
      ) : filteredSigils.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <SparkleIcon size={40} color="var(--admin-ink-muted)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--admin-ink)' }}>No Sigils Found</h3>
          <p style={{ margin: '0 0 1.5rem', color: 'var(--admin-ink-muted)' }}>
            No sigils match your current filter criteria.
          </p>
          <Link to="/admin_dashboard/sigils/create" className="admin-btn admin-btn-primary">
            <PlusIcon size={18} weight="bold" />
            Create Sigil Now
          </Link>
        </div>
      ) : (
        <div className="sigils-grid">
          {filteredSigils.map((sigil) => {
            const exampleCount = (examples[sigil.id] || []).length;

            const hasDraft = Boolean(drafts[sigil.id]);
            const isExistingRemote = remoteSigils.some((r) => r.id === sigil.id);
            const isUnsaved = Boolean((sigil as any).isUnsaved || (hasDraft && isExistingRemote));
            const isDraft = Boolean((sigil as any).isDraft || (hasDraft && !isExistingRemote));

            return (
              <div key={sigil.id} className="sigil-card">
                <Link
                  to={`/admin_dashboard/sigils/${sigil.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="sigil-card-preview">
                    {/* Top-left: Examples Count Badge */}
                    <span className="sigil-examples-badge">
                      <LightbulbIcon size={12} weight="fill" />
                      {exampleCount} {exampleCount === 1 ? 'example' : 'examples'}
                    </span>

                    {/* Top-right: Unsaved / Draft Status Badge */}
                    <UnsavedBadge
                      isDraft={isDraft}
                      isUnsaved={isUnsaved}
                      onClick={() => syncSigil(sigil)}
                    />

                    {sigil.coverAsset ? (
                      <img src={sigil.coverAsset} alt={sigil.label} />
                    ) : (
                      <div className="sigil-card-no-asset">
                        No Asset
                      </div>
                    )}
                  </div>

                  <div className="sigil-card-content">
                    {/* Row 1: Title & Type/Role */}
                    <div className="sigil-card-header-row">
                      <h3 className="sigil-card-title">{sigil.label}</h3>
                      <span
                        className={`sigil-type-badge ${getSigilCategory(sigil) === 'effector' ? 'effector' : 'augmentor'}`}
                      >
                        {getSigilCategory(sigil) === 'effector' &&
                          `Effector · ${(sigil.elementId || sigil.element || 'core').charAt(0).toUpperCase() + (sigil.elementId || sigil.element || 'core').slice(1).toLowerCase()}`}
                        {getSigilCategory(sigil) === 'form' &&
                          `Form · ${(sigil.formType || 'dash').charAt(0).toUpperCase() + (sigil.formType || 'dash').slice(1)}`}
                        {getSigilCategory(sigil) === 'position' && 'Position · Anchor'}
                      </span>
                    </div>

                    {/* Row 2: Tier & Damage */}
                    <div className="sigil-card-meta-row" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span className="sigil-tier-pill">
                        TIER {sigil.tier || 1}
                      </span>
                      {getSigilCategory(sigil) === 'effector' && (
                        <span className="sigil-tier-pill" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                          DMG: {sigil.baseHitDamage ?? 100}
                        </span>
                      )}
                    </div>

                    {/* Row 3: Description */}
                    <p className="sigil-card-desc">
                      {sigil.description || 'No description provided.'}
                    </p>
                  </div>
                </Link>

                {/* Card Footer Actions */}
                <div className="sigil-card-footer">
                  <Link
                    to={`/admin_dashboard/sigils/${sigil.id}`}
                    className="sigil-btn-edit"
                    title="Edit Details"
                  >
                    <SlidersIcon size={13} />
                    EDIT
                  </Link>
                  <Link
                    to={`/admin_dashboard/sigils/${sigil.id}/training`}
                    className="sigil-btn-train"
                    title="Train Examples"
                  >
                    <BrainIcon size={13} weight="bold" />
                    TRAIN
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
