import React, { useState, useEffect } from 'react';
import { useElementsStore } from '../../lib/stores/elements_store';
import { useEffectsStore } from '../../lib/stores/effects_store';
import {
  SlidersIcon,
  CheckIcon,
  XIcon,
  ArrowCounterClockwiseIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react';

export interface EffectOverrideConfig {
  effectType: string;
  isExcluded: boolean;
  tickDamageMult: number;
  intervalTicksOverride: number | null;
  durationTicksOverride: number | null;
}

interface SigilEffectsModifierProps {
  elementId: string; // e.g. 'FIRE', 'WATER'
  overrides: Record<string, EffectOverrideConfig>;
  onChange: (overrides: Record<string, EffectOverrideConfig>) => void;
  disabled?: boolean;
}

export const SigilEffectsModifier: React.FC<SigilEffectsModifierProps> = ({
  elementId,
  overrides,
  onChange,
  disabled = false,
}) => {
  const getEffectsForElement = useElementsStore((state) => state.getEffectsForElement);
  const baselineEffects = getEffectsForElement(elementId.toUpperCase());
  
  const masterEffects = useEffectsStore((state) => state.effects);
  const loadMasterEffects = useEffectsStore((state) => state.loadEffects);
  const [selectedEffectToAdd, setSelectedEffectToAdd] = useState<string>('');

  useEffect(() => {
    if (masterEffects.length === 0) {
      loadMasterEffects();
    }
  }, [masterEffects.length, loadMasterEffects]);

  const baselineMap = new Map(baselineEffects.map((e) => [e.effectType, e]));

  // All effect types to render = baseline effects + any custom added overrides
  const allEffectTypes = Array.from(
    new Set([...baselineEffects.map((e) => e.effectType), ...Object.keys(overrides)])
  );

  // Available effects to add from master catalog (not already active in list)
  const availableToAdd = masterEffects.filter(
    (me) => !allEffectTypes.includes(me.id)
  );

  const handleUpdate = (effectType: string, partial: Partial<EffectOverrideConfig>) => {
    const base = baselineMap.get(effectType);
    const master = masterEffects.find((m) => m.id === effectType);

    const existing = overrides[effectType] || {
      effectType,
      isExcluded: false,
      tickDamageMult: 1.0,
      intervalTicksOverride: base?.intervalTicks ?? master?.defaultIntervalTicks ?? null,
      durationTicksOverride: base?.durationTicks ?? master?.defaultDurationTicks ?? null,
    };

    onChange({
      ...overrides,
      [effectType]: {
        ...existing,
        ...partial,
      },
    });
  };

  const handleReset = (effectType: string) => {
    const next = { ...overrides };
    delete next[effectType];
    onChange(next);
  };

  const handleAddCustomEffect = () => {
    if (!selectedEffectToAdd) return;
    const master = masterEffects.find((m) => m.id === selectedEffectToAdd);
    if (!master) return;

    onChange({
      ...overrides,
      [master.id]: {
        effectType: master.id,
        isExcluded: false,
        tickDamageMult: 1.0,
        intervalTicksOverride: master.defaultIntervalTicks,
        durationTicksOverride: master.defaultDurationTicks,
      },
    });
    setSelectedEffectToAdd('');
  };

  const handleRemoveCustomEffect = (effectType: string) => {
    const next = { ...overrides };
    delete next[effectType];
    onChange(next);
  };

  return (
    <div className="admin-form-group" style={{ marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <label className="admin-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <SlidersIcon size={16} />
          Sigil Status Effects (Element & Custom)
        </label>
        <span style={{ fontSize: '0.75rem', color: 'var(--admin-ink-muted)' }}>
          1 tick = 100ms (10Hz)
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {allEffectTypes.map((effectType) => {
          const baseEf = baselineMap.get(effectType);
          const masterEf = masterEffects.find((m) => m.id === effectType);
          const isCustom = !baseEf;

          const cfg = overrides[effectType] || {
            effectType,
            isExcluded: false,
            tickDamageMult: 1.0,
            intervalTicksOverride: null,
            durationTicksOverride: null,
          };

          const defaultInterval = baseEf?.intervalTicks ?? masterEf?.defaultIntervalTicks ?? 5;
          const defaultDuration = baseEf?.durationTicks ?? masterEf?.defaultDurationTicks ?? 40;
          const defaultBaseDmg = baseEf?.baseTickDamage ?? masterEf?.baseTickDamage ?? 0;

          const isCustomized =
            isCustom ||
            cfg.isExcluded ||
            cfg.tickDamageMult !== 1.0 ||
            cfg.intervalTicksOverride !== null ||
            cfg.durationTicksOverride !== null;

          const effDamage = Math.round(defaultBaseDmg * cfg.tickDamageMult);
          const effInterval = cfg.intervalTicksOverride ?? defaultInterval;
          const effDuration = cfg.durationTicksOverride ?? defaultDuration;

          return (
            <div
              key={effectType}
              style={{
                background: cfg.isExcluded ? 'var(--admin-paper-muted)' : 'var(--admin-paper)',
                border: `1px solid ${isCustom ? 'var(--admin-accent)' : isCustomized ? 'var(--admin-border-strong)' : 'var(--admin-border)'}`,
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                opacity: cfg.isExcluded ? 0.65 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      letterSpacing: '0.04em',
                      color: cfg.isExcluded ? 'var(--admin-ink-muted)' : 'var(--admin-ink)',
                    }}
                  >
                    {effectType}
                  </span>

                  {masterEf?.category && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '1px 5px',
                        background: masterEf.category === 'DOT' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                        color: masterEf.category === 'DOT' ? '#dc2626' : '#2563eb',
                        borderRadius: '3px',
                        fontWeight: 600,
                      }}
                    >
                      {masterEf.category}
                    </span>
                  )}

                  {isCustom ? (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '1px 5px',
                        background: 'var(--admin-accent-badge)',
                        color: 'var(--admin-accent)',
                        borderRadius: '3px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      Custom Sigil Effect
                    </span>
                  ) : isCustomized ? (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: 'var(--admin-accent)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      Modified
                    </span>
                  ) : null}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isCustom ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleRemoveCustomEffect(effectType)}
                      className="admin-btn admin-btn-danger"
                      style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                      title="Remove Custom Effect"
                    >
                      <TrashIcon size={12} /> Remove
                    </button>
                  ) : (
                    <>
                      {isCustomized && !disabled && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}
                          onClick={() => handleReset(effectType)}
                          title="Reset to Element Baseline"
                        >
                          <ArrowCounterClockwiseIcon size={12} /> Reset
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleUpdate(effectType, { isExcluded: !cfg.isExcluded })}
                        style={{
                          padding: '0.2rem 0.55rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          borderRadius: '4px',
                          border: '1px solid var(--admin-border)',
                          background: cfg.isExcluded ? 'var(--admin-danger-paper)' : 'var(--admin-success-paper)',
                          color: cfg.isExcluded ? 'var(--admin-danger)' : 'var(--admin-success)',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        {cfg.isExcluded ? (
                          <>
                            <XIcon size={12} weight="bold" /> Excluded
                          </>
                        ) : (
                          <>
                            <CheckIcon size={12} weight="bold" /> Active
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!cfg.isExcluded && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.75rem',
                    marginTop: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid var(--admin-border)',
                    fontSize: '0.8rem',
                  }}
                >
                  {/* Tick Damage Multiplier */}
                  {masterEf?.category !== 'STAT_MOD' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--admin-ink-muted)', marginBottom: '0.2rem' }}>
                        Tick DMG ({effDamage} dmg)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <input
                          type="number"
                          className="admin-input"
                          style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem', width: '100%' }}
                          step={0.1}
                          min={0}
                          max={10}
                          value={cfg.tickDamageMult}
                          disabled={disabled}
                          onChange={(e) =>
                            handleUpdate(effectType, {
                              tickDamageMult: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--admin-ink-muted)' }}>x</span>
                      </div>
                    </div>
                  )}

                  {/* Interval Ticks Override */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--admin-ink-muted)', marginBottom: '0.2rem' }}>
                      Interval ({effInterval * 0.1}s)
                    </label>
                    <input
                      type="number"
                      className="admin-input"
                      style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem', width: '100%' }}
                      placeholder={`${defaultInterval}t`}
                      min={1}
                      value={cfg.intervalTicksOverride ?? ''}
                      disabled={disabled}
                      onChange={(e) =>
                        handleUpdate(effectType, {
                          intervalTicksOverride: e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
                        })
                      }
                    />
                  </div>

                  {/* Duration Ticks Override */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--admin-ink-muted)', marginBottom: '0.2rem' }}>
                      Duration ({effDuration * 0.1}s)
                    </label>
                    <input
                      type="number"
                      className="admin-input"
                      style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem', width: '100%' }}
                      placeholder={`${defaultDuration}t`}
                      min={1}
                      value={cfg.durationTicksOverride ?? ''}
                      disabled={disabled}
                      onChange={(e) =>
                        handleUpdate(effectType, {
                          durationTicksOverride: e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add Custom Effect Bar */}
        {availableToAdd.length > 0 && !disabled && (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              marginTop: '0.25rem',
              padding: '0.5rem 0.75rem',
              background: 'var(--admin-paper-muted)',
              borderRadius: '6px',
              border: '1px dashed var(--admin-border)',
            }}
          >
            <select
              className="admin-input"
              style={{ flex: 1, padding: '0.35rem 0.6rem', fontSize: '0.825rem' }}
              value={selectedEffectToAdd}
              onChange={(e) => setSelectedEffectToAdd(e.target.value)}
            >
              <option value="">-- Add effect from Master Catalog --</option>
              {availableToAdd.map((me) => (
                <option key={me.id} value={me.id}>
                  {me.label} ({me.id}) &bull; {me.category}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              onClick={handleAddCustomEffect}
              disabled={!selectedEffectToAdd}
            >
              <PlusIcon size={14} weight="bold" /> Add to Sigil
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
