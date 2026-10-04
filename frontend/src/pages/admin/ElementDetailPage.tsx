import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  FloppyDiskIcon,
  SparkleIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase/supabase';
import { useElementsStore } from '../../lib/stores/elements_store';

export interface EditableEffect {
  id?: number;
  effectType: string;
  baseTickDamage: number;
  intervalTicks: number;
  durationTicks: number;
  baseMagnitude: number | null;
}

export const ElementDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { elements, getEffectsForElement, loadElements } = useElementsStore();
  
  const element = id ? elements.find((e) => e.id === id) : undefined;
  const initialEffects = id ? getEffectsForElement(id) : [];

  const [label, setLabel] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [secondaryColor, setSecondaryColor] = useState('#000000');
  const [particleVfxKey, setParticleVfxKey] = useState('');
  const [baseHitDamage, setBaseHitDamage] = useState<number>(100);
  
  const [effects, setEffects] = useState<EditableEffect[]>([]);
  const [deletedEffectIds, setDeletedEffectIds] = useState<number[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (elements.length === 0) {
      loadElements();
    }
  }, [elements.length, loadElements]);

  useEffect(() => {
    if (element) {
      setLabel(element.label || '');
      setPrimaryColor(element.primaryColor || '#000000');
      setSecondaryColor(element.secondaryColor || '#000000');
      setParticleVfxKey(element.particleVfxKey || '');
      setBaseHitDamage(element.baseHitDamage ?? 100);
      
      setEffects(
        initialEffects.map((ef) => ({
          id: ef.id,
          effectType: ef.effectType,
          baseTickDamage: ef.baseTickDamage,
          intervalTicks: ef.intervalTicks,
          durationTicks: ef.durationTicks,
          baseMagnitude: ef.baseMagnitude,
        }))
      );
      setDeletedEffectIds([]);
    }
  }, [element, initialEffects.length]);

  const hasChanges = useMemo(() => {
    if (!element) return false;
    if (label !== element.label) return true;
    if (primaryColor !== element.primaryColor) return true;
    if (secondaryColor !== element.secondaryColor) return true;
    if (particleVfxKey !== element.particleVfxKey) return true;
    if (baseHitDamage !== element.baseHitDamage) return true;
    if (deletedEffectIds.length > 0) return true;
    
    if (JSON.stringify(effects) !== JSON.stringify(initialEffects)) return true;

    return false;
  }, [element, label, primaryColor, secondaryColor, particleVfxKey, baseHitDamage, effects, initialEffects, deletedEffectIds]);

  if (!element || !id) {
    return (
      <div className="admin-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <SparkleIcon size={40} color="var(--admin-ink-muted)" style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ margin: '0 0 0.5rem' }}>Element Not Found</h3>
        <Link to="/admin/elements" className="admin-btn admin-btn-primary">
          <ArrowLeftIcon size={16} /> Back to Catalog
        </Link>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || isSaving) return;
    
    setIsSaving(true);
    try {
      const { error: elError } = await supabase
        .from('elements')
        .update({
          label: label.trim(),
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          particle_vfx_key: particleVfxKey.trim(),
          base_hit_damage: baseHitDamage,
        })
        .eq('id', id);

      if (elError) throw elError;

      if (deletedEffectIds.length > 0) {
        const { error: delError } = await supabase
          .from('element_effects')
          .delete()
          .in('id', deletedEffectIds);
        if (delError) console.warn('Failed to delete removed effects:', delError);
      }

      if (effects.length > 0) {
        const payload = effects.map((ef) => ({
          ...(ef.id ? { id: ef.id } : {}),
          element_id: id,
          effect_type: ef.effectType.trim().toUpperCase(),
          base_tick_damage: Number(ef.baseTickDamage) || 0,
          interval_ticks: Math.max(1, Number(ef.intervalTicks) || 5),
          duration_ticks: Math.max(1, Number(ef.durationTicks) || 40),
          base_magnitude: ef.baseMagnitude !== null && !isNaN(Number(ef.baseMagnitude)) ? Number(ef.baseMagnitude) : null,
        }));

        const { error: efError } = await supabase
          .from('element_effects')
          .upsert(payload, { onConflict: 'element_id,effect_type' });
           
        if (efError) throw efError;
      }
      
      await loadElements();
      setDeletedEffectIds([]);
      toast.success('Element saved successfully!');
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(`Failed to save: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEffectChange = (index: number, field: keyof EditableEffect, value: any) => {
    const newEffects = [...effects];
    newEffects[index] = { ...newEffects[index], [field]: value };
    setEffects(newEffects);
  };
  
  const addEffect = () => {
    setEffects([
      ...effects,
      {
        effectType: 'BURNING',
        baseTickDamage: 10,
        intervalTicks: 5,
        durationTicks: 40,
        baseMagnitude: null,
      },
    ]);
  };
  
  const removeEffect = (index: number) => {
    const target = effects[index];
    if (target.id) {
      setDeletedEffectIds((prev) => [...prev, target.id!]);
    }
    const newEffects = [...effects];
    newEffects.splice(index, 1);
    setEffects(newEffects);
  };

  return (
    <div>
      <div style={{ marginBottom: '0.65rem' }}>
        <Link
          to="/admin/elements"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--admin-ink-muted)',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <ArrowLeftIcon size={16} />
          Back to Elements Catalog
        </Link>
      </div>

      <div className="admin-page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <h2 className="admin-page-title" style={{ margin: 0 }}>{element.label} Element</h2>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        <form onSubmit={handleSave} className="admin-panel">
          <h3 style={{ fontFamily: 'var(--font-heading)', marginTop: 0, marginBottom: '1.25rem' }}>
            Edit Element Details
          </h3>

          <div className="admin-form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="admin-form-group">
              <label className="admin-label">Label</label>
              <input
                type="text"
                className="admin-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>
            
            <div className="admin-form-group">
              <label className="admin-label">Base Hit Damage</label>
              <input
                type="number"
                className="admin-input"
                value={baseHitDamage}
                onChange={(e) => setBaseHitDamage(Number(e.target.value))}
                required
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label">Primary Color</label>
              <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{width: '40px', height: '40px', padding: '0', border: 'none'}}
                />
                <input type="text" className="admin-input" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{flex: 1}}/>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-label">Secondary Color</label>
              <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  style={{width: '40px', height: '40px', padding: '0', border: 'none'}}
                />
                <input type="text" className="admin-input" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} style={{flex: 1}}/>
              </div>
            </div>

            <div className="admin-form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="admin-label">Particle VFX Key</label>
              <input
                type="text"
                className="admin-input"
                value={particleVfxKey}
                onChange={(e) => setParticleVfxKey(e.target.value)}
              />
            </div>
          </div>
          
          <h3 style={{ fontFamily: 'var(--font-heading)', marginTop: '2rem', marginBottom: '1rem' }}>
            Element Effects
          </h3>
          
          <div style={{overflowX: 'auto'}}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--admin-border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem', fontSize: '0.85rem', color: 'var(--admin-ink-muted)' }}>Type</th>
                  <th style={{ padding: '0.5rem', fontSize: '0.85rem', color: 'var(--admin-ink-muted)' }}>Tick DMG</th>
                  <th style={{ padding: '0.5rem', fontSize: '0.85rem', color: 'var(--admin-ink-muted)' }}>Interval</th>
                  <th style={{ padding: '0.5rem', fontSize: '0.85rem', color: 'var(--admin-ink-muted)' }}>Duration</th>
                  <th style={{ padding: '0.5rem', fontSize: '0.85rem', color: 'var(--admin-ink-muted)' }}>Magnitude</th>
                  <th style={{ padding: '0.5rem', fontSize: '0.85rem', color: 'var(--admin-ink-muted)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {effects.map((ef, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                    <td style={{ padding: '0.5rem' }}>
                      <input
                        type="text"
                        className="admin-input"
                        style={{ padding: '0.25rem', textTransform: 'uppercase' }}
                        value={ef.effectType}
                        onChange={(e) => handleEffectChange(idx, 'effectType', e.target.value.toUpperCase())}
                      />
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <input
                        type="number"
                        className="admin-input"
                        style={{ padding: '0.25rem', width: '80px' }}
                        value={ef.baseTickDamage}
                        min={0}
                        onChange={(e) => handleEffectChange(idx, 'baseTickDamage', Number(e.target.value))}
                      />
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <input
                        type="number"
                        className="admin-input"
                        style={{ padding: '0.25rem', width: '80px' }}
                        value={ef.intervalTicks}
                        min={1}
                        onChange={(e) => handleEffectChange(idx, 'intervalTicks', Number(e.target.value))}
                      />
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <input
                        type="number"
                        className="admin-input"
                        style={{ padding: '0.25rem', width: '80px' }}
                        value={ef.durationTicks}
                        min={1}
                        onChange={(e) => handleEffectChange(idx, 'durationTicks', Number(e.target.value))}
                      />
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <input
                        type="number"
                        className="admin-input"
                        style={{ padding: '0.25rem', width: '80px' }}
                        placeholder="null"
                        step={0.05}
                        value={ef.baseMagnitude ?? ''}
                        onChange={(e) =>
                          handleEffectChange(
                            idx,
                            'baseMagnitude',
                            e.target.value === '' ? null : Number(e.target.value)
                          )
                        }
                      />
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => removeEffect(idx)}
                        className="admin-btn admin-btn-danger"
                        style={{ padding: '0.25rem 0.5rem' }}
                        title="Remove effect"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <button type="button" onClick={addEffect} className="admin-btn admin-btn-secondary">
               <PlusIcon size={14} /> Add Effect
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', alignItems: 'center', borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem' }}>
            <button
              type="submit"
              disabled={!hasChanges || isSaving}
              className="admin-btn admin-btn-primary"
              style={{
                minWidth: 160,
                opacity: !hasChanges && !isSaving ? 0.65 : 1,
                cursor: !hasChanges && !isSaving ? 'not-allowed' : isSaving ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {isSaving ? (
                <span>Saving Changes…</span>
              ) : !hasChanges ? (
                <>
                  <CheckIcon size={18} weight="bold" />
                  <span>No Changes</span>
                </>
              ) : (
                <>
                  <FloppyDiskIcon size={18} weight="bold" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
            {!hasChanges && (
              <span style={{ fontSize: '0.8rem', color: 'var(--admin-ink-muted)' }}>
                All changes saved
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
