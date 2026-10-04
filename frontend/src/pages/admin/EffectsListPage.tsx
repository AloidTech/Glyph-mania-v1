import React, { useEffect, useState } from 'react';
import {
  SparkleIcon,
  PlusIcon,
  SlidersIcon,
  TrashIcon,
  XIcon,
  PencilSimpleIcon,
  ClockIcon,
  HeartbeatIcon,
  LightningIcon
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { useEffectsStore } from '../../lib/stores/effects_store';
import { saveMasterEffect, deleteMasterEffect } from '../../lib/apis/api';
import type { EffectDefinition, EffectCategory, StatTarget, ModifierType } from '../../types/phenomenon_types';

export const EffectsListPage: React.FC = () => {
  const { effects, loadEffects, isLoading } = useEffectsStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'DOT' | 'STAT_MOD'>('ALL');

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEffect, setEditingEffect] = useState<EffectDefinition | null>(null);

  // Form fields
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<EffectCategory>('DOT');
  const [targetStat, setTargetStat] = useState<StatTarget>('SPEED');
  const [modifierType, setModifierType] = useState<ModifierType>('PERCENT_MULT');
  const [magnitude, setMagnitude] = useState<number>(-0.30);
  const [baseTickDamage, setBaseTickDamage] = useState<number>(10);
  const [intervalTicks, setIntervalTicks] = useState<number>(5);
  const [durationTicks, setDurationTicks] = useState<number>(40);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (effects.length === 0) {
      loadEffects();
    }
  }, [effects.length, loadEffects]);

  const openCreateModal = () => {
    setEditingEffect(null);
    setId('');
    setLabel('');
    setCategory('DOT');
    setTargetStat('SPEED');
    setModifierType('PERCENT_MULT');
    setMagnitude(-0.30);
    setBaseTickDamage(10);
    setIntervalTicks(5);
    setDurationTicks(40);
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (ef: EffectDefinition) => {
    setEditingEffect(ef);
    setId(ef.id);
    setLabel(ef.label);
    setCategory(ef.category);
    setTargetStat(ef.targetStat || 'SPEED');
    setModifierType(ef.modifierType || 'PERCENT_MULT');
    setMagnitude(ef.defaultMagnitude ?? -0.30);
    setBaseTickDamage(ef.baseTickDamage ?? 0);
    setIntervalTicks(ef.defaultIntervalTicks);
    setDurationTicks(ef.defaultDurationTicks);
    setDescription(ef.description || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = id.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const cleanLabel = label.trim();

    if (!cleanId || !cleanLabel) {
      toast.error('Effect ID and Label are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: EffectDefinition = {
        id: cleanId,
        label: cleanLabel,
        category,
        targetStat: category === 'STAT_MOD' ? targetStat : null,
        modifierType: category === 'STAT_MOD' ? modifierType : null,
        defaultMagnitude: category === 'STAT_MOD' ? magnitude : null,
        baseTickDamage: category === 'DOT' ? baseTickDamage : 0,
        defaultIntervalTicks: Math.max(1, intervalTicks),
        defaultDurationTicks: Math.max(1, durationTicks),
        description: description.trim(),
      };

      await saveMasterEffect(payload);
      await loadEffects();
      toast.success(`Effect "${cleanLabel}" (${cleanId}) saved successfully!`);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Save effect error:', err);
      toast.error(`Failed to save effect: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (ef: EffectDefinition) => {
    toast(
      (t) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>Delete effect <b>{ef.label}</b>?</span>
          <button
            className="admin-btn admin-btn-danger"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
            onClick={async () => {
              try {
                await deleteMasterEffect(ef.id);
                await loadEffects();
                toast.success(`Deleted ${ef.label}`);
              } catch (err: any) {
                toast.error(`Failed to delete: ${err.message || err}`);
              }
              toast.dismiss(t.id);
            }}
          >
            Delete
          </button>
          <button
            className="admin-btn admin-btn-ghost"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
        </span>
      ),
      { duration: 5000 }
    );
  };

  const filteredEffects = effects.filter((ef) => {
    const matchesCategory = selectedCategory === 'ALL' || ef.category === selectedCategory;
    const matchesSearch =
      ef.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ef.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ef.description && ef.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Master Effects Registry</h2>
          <p className="admin-page-subtitle" style={{ margin: 0 }}>
            Universal catalog of standalone status effects (Damage-Over-Time and Stat Modifiers) referenced by Elements and Sigils.
          </p>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={openCreateModal}
        >
          <PlusIcon size={18} weight="bold" />
          Create New Effect
        </button>
      </div>

      {/* Filter and Search Toolbar */}
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
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="admin-segmented">
            <button
              type="button"
              className={`admin-segmented-btn ${selectedCategory === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('ALL')}
            >
              All ({effects.length})
            </button>
            <button
              type="button"
              className={`admin-segmented-btn ${selectedCategory === 'DOT' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('DOT')}
            >
              DoT ({effects.filter((e) => e.category === 'DOT').length})
            </button>
            <button
              type="button"
              className={`admin-segmented-btn ${selectedCategory === 'STAT_MOD' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('STAT_MOD')}
            >
              Stat Mod ({effects.filter((e) => e.category === 'STAT_MOD').length})
            </button>
          </div>
        </div>

        <div style={{ flex: 1, maxWidth: 320 }}>
          <input
            type="text"
            className="admin-input"
            style={{ width: '100%', boxSizing: 'border-box' }}
            placeholder="Search effects by ID or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid of Effects */}
      {isLoading && effects.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <p>Loading master effects...</p>
        </div>
      ) : filteredEffects.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <SparkleIcon size={40} color="var(--admin-ink-muted)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--admin-ink)' }}>No Effects Found</h3>
          <p style={{ margin: '0 0 1.5rem', color: 'var(--admin-ink-muted)' }}>
            No status effects match the current filter.
          </p>
        </div>
      ) : (
        <div className="sigils-grid">
          {filteredEffects.map((ef) => {
            const isDot = ef.category === 'DOT';
            return (
              <div key={ef.id} className="sigil-card">
                <div
                  className="sigil-card-preview"
                  style={{
                    background: isDot
                      ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
                      : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  {isDot ? <HeartbeatIcon size={36} weight="bold" /> : <LightningIcon size={36} weight="bold" />}
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, marginTop: '4px', letterSpacing: '0.05em' }}>
                    {ef.category}
                  </span>
                </div>

                <div className="sigil-card-content">
                  <div className="sigil-card-header-row">
                    <h3 className="sigil-card-title">{ef.label}</h3>
                    <span
                      className="sigil-type-badge"
                      style={{
                        background: isDot ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                        color: isDot ? '#dc2626' : '#2563eb',
                      }}
                    >
                      {ef.category}
                    </span>
                  </div>

                  <div className="sigil-card-meta-row" style={{ marginTop: '0.25rem' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--admin-ink-muted)' }}>
                      ID: {ef.id}
                    </span>
                  </div>

                  {isDot ? (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.825rem', color: 'var(--admin-ink)' }}>
                      <strong>Tick DMG:</strong> {ef.baseTickDamage} &bull; <strong>Interval:</strong> {ef.defaultIntervalTicks}t ({ef.defaultIntervalTicks * 0.1}s)
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.825rem', color: 'var(--admin-ink)' }}>
                      <strong>Target:</strong> {ef.targetStat} ({ef.modifierType}) &bull;{' '}
                      <strong>Mod:</strong>{' '}
                      {ef.modifierType === 'PERCENT_MULT'
                        ? `${(ef.defaultMagnitude ?? 0) > 0 ? '+' : ''}${Math.round((ef.defaultMagnitude ?? 0) * 100)}%`
                        : `${(ef.defaultMagnitude ?? 0) > 0 ? '+' : ''}${ef.defaultMagnitude}`}
                    </div>
                  )}

                  <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--admin-ink-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <ClockIcon size={14} /> Duration: {ef.defaultDurationTicks}t ({ef.defaultDurationTicks * 0.1}s)
                  </div>

                  {ef.description && (
                    <p className="sigil-card-desc" style={{ marginTop: '0.5rem' }}>
                      {ef.description}
                    </p>
                  )}
                </div>

                <div className="sigil-card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="sigil-btn-edit"
                    onClick={() => openEditModal(ef)}
                    title="Edit Effect"
                  >
                    <PencilSimpleIcon size={13} />
                    EDIT
                  </button>
                  <button
                    type="button"
                    className="sigil-btn-edit"
                    style={{ color: 'var(--admin-danger)' }}
                    onClick={() => handleDelete(ef)}
                    title="Delete Effect"
                  >
                    <TrashIcon size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Effect Modal */}
      {isModalOpen && (
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
              setIsModalOpen(false);
            }
          }}
        >
          <div
            className="admin-panel"
            style={{
              width: '100%',
              maxWidth: '560px',
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
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                {editingEffect ? `Edit Effect (${editingEffect.id})` : 'Create Master Effect'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Effect ID <span style={{ color: 'var(--admin-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="admin-input"
                    style={{ width: '100%', boxSizing: 'border-box', textTransform: 'uppercase' }}
                    placeholder="e.g. CORROSION"
                    value={id}
                    disabled={!!editingEffect || isSubmitting}
                    onChange={(e) => setId(e.target.value.toUpperCase())}
                    required
                  />
                </div>

                <div>
                  <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Label / Display Name <span style={{ color: 'var(--admin-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="admin-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g. Acid Corrosion"
                    value={label}
                    onChange={(e) => {
                      setLabel(e.target.value);
                      if (!editingEffect && (!id || id === label.toUpperCase().replace(/[^A-Z0-9_]/g, ''))) {
                        setId(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''));
                      }
                    }}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Category Segmented */}
              <div>
                <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Category
                </label>
                <div className="admin-segmented">
                  <button
                    type="button"
                    className={`admin-segmented-btn ${category === 'DOT' ? 'active' : ''}`}
                    onClick={() => setCategory('DOT')}
                    disabled={isSubmitting}
                  >
                    DOT (Damage Over Time)
                  </button>
                  <button
                    type="button"
                    className={`admin-segmented-btn ${category === 'STAT_MOD' ? 'active' : ''}`}
                    onClick={() => setCategory('STAT_MOD')}
                    disabled={isSubmitting}
                  >
                    STAT_MOD (Entity Stat Modifier)
                  </button>
                </div>
              </div>

              {category === 'DOT' ? (
                <div>
                  <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Base Damage Per Tick
                  </label>
                  <input
                    type="number"
                    className="admin-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={baseTickDamage}
                    min={0}
                    onChange={(e) => setBaseTickDamage(Number(e.target.value))}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Target Stat
                    </label>
                    <select
                      className="admin-input"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      value={targetStat}
                      onChange={(e) => setTargetStat(e.target.value as StatTarget)}
                      disabled={isSubmitting}
                    >
                      <option value="SPEED">SPEED</option>
                      <option value="ARMOR">ARMOR</option>
                      <option value="POISE">POISE</option>
                      <option value="HEALTH_MAX">HEALTH_MAX</option>
                    </select>
                  </div>

                  <div>
                    <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Modifier Type
                    </label>
                    <select
                      className="admin-input"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      value={modifierType}
                      onChange={(e) => setModifierType(e.target.value as ModifierType)}
                      disabled={isSubmitting}
                    >
                      <option value="PERCENT_MULT">PERCENT_MULT (e.g. -35%)</option>
                      <option value="FLAT">FLAT (e.g. -20 Armor)</option>
                    </select>
                  </div>

                  <div>
                    <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Magnitude
                    </label>
                    <input
                      type="number"
                      step={modifierType === 'PERCENT_MULT' ? 0.05 : 1}
                      className="admin-input"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      value={magnitude}
                      onChange={(e) => setMagnitude(Number(e.target.value))}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Timing Ticks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Default Interval ({intervalTicks * 0.1}s)
                  </label>
                  <input
                    type="number"
                    className="admin-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={intervalTicks}
                    min={1}
                    onChange={(e) => setIntervalTicks(Number(e.target.value))}
                    disabled={isSubmitting}
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--admin-ink-muted)' }}>
                    10Hz ticks between periodic actions
                  </span>
                </div>

                <div>
                  <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Default Duration ({durationTicks * 0.1}s)
                  </label>
                  <input
                    type="number"
                    className="admin-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={durationTicks}
                    min={1}
                    onChange={(e) => setDurationTicks(Number(e.target.value))}
                    disabled={isSubmitting}
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--admin-ink-muted)' }}>
                    Total lifespan before effect expires
                  </span>
                </div>
              </div>

              <div>
                <label className="admin-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Description / Lore
                </label>
                <textarea
                  className="admin-textarea"
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: '60px' }}
                  placeholder="Describe what this effect does to an entity..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '0.5rem',
                  borderTop: '1px solid var(--admin-border)',
                  paddingTop: '1rem',
                }}
              >
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : editingEffect ? 'Save Changes' : 'Create Effect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
