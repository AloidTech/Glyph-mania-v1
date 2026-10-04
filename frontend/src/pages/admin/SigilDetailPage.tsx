import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BrainIcon,
  FloppyDiskIcon,
  TrashIcon,
  UploadIcon,
  SparkleIcon,
  CheckIcon,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { useAdminSigilsStore } from '../../lib/stores/admin_sigils_store';
import { useTrainingStore } from '../../lib/ml/training_store';
import { useElementsStore } from '../../lib/stores/elements_store';
import { Element, FormType, AugmentorType, SigilType } from '../../types/glyph_types';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { BackgroundRemoverModal } from '../../components/admin/BackgroundRemoverModal';
import { syncSigil } from '../../lib/admin_utils/sync_helpers';
import { fetchResolvedEffects, fetchSigilEffectOverrides, saveSigilEffectOverrides } from '../../lib/apis/api';
import { UnsavedBadge } from '../../components/UnsavedBadge';
import { MaskedIdBadge } from '../../components/admin/MaskedIdBadge';
import { SigilDetailPageSkeleton } from '../../components/Common/CircularLoadingComponents';
import { SigilEffectsModifier, EffectOverrideConfig } from '../../components/admin/SigilEffectsModifier';

const EMPTY_EXAMPLES: any[] = [];

export const SigilDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const sigils = useAdminSigilsStore((state) => state.sigils);
  const drafts = useAdminSigilsStore((state) => state.drafts);
  const loadRemoteSigils = useAdminSigilsStore((state) => state.loadRemoteSigils);
  const isLoadingRemote = useAdminSigilsStore((state) => state.isLoadingRemote);
  const sigil = id ? sigils.find((s) => s.id === id) : undefined;
  const updateSigil = useAdminSigilsStore((state) => state.updateSigil);
  const deleteSigil = useAdminSigilsStore((state) => state.deleteSigil);

  useEffect(() => {
    loadRemoteSigils();
    useTrainingStore.getState().loadRemoteExamples();
  }, [loadRemoteSigils]);

  const rawExamples = useTrainingStore((state) => (id ? state.examples[id] : undefined));
  const examples = rawExamples || EMPTY_EXAMPLES;
  const clearExamplesForSigil = useTrainingStore((state) => state.clearExamplesForSigil);
  const elements = useElementsStore((state) => state.elements);

  const [label, setLabel] = useState('');
  const [sigilType, setSigilType] = useState<SigilType>('effector');
  const [type, setType] = useState<'effector' | 'augmentor'>('effector');
  const [element, setElement] = useState<Element>('fire');
  const [augmentorType, setAugmentorType] = useState<AugmentorType>('form');
  const [formType, setFormType] = useState<FormType>('dash');
  const [baseHitDamage, setBaseHitDamage] = useState<number>(100);
  const [tier, setTier] = useState<number>(1);
  const [description, setDescription] = useState('');
  const [coverAsset, setCoverAsset] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);
  const [rawUploadedAsset, setRawUploadedAsset] = useState<string | null>(null);
  const [resolvedEffects, setResolvedEffects] = useState<any[]>([]);
  const [effectOverrides, setEffectOverrides] = useState<Record<string, EffectOverrideConfig>>({});
  const [initialOverrides, setInitialOverrides] = useState<Record<string, EffectOverrideConfig>>({});

  useEffect(() => {
    if (sigil) {
      setLabel(sigil.label);
      const st: SigilType = sigil.sigilType || (sigil.type === 'effector' ? 'effector' : sigil.augmentorType === 'position' ? 'position' : 'form');
      setSigilType(st);
      setType(sigil.type);
      setElement(sigil.element || 'fire');
      setAugmentorType(sigil.augmentorType || 'form');
      setFormType(sigil.formType || 'dash');
      setBaseHitDamage(sigil.baseHitDamage ?? 100);
      setTier(sigil.tier || 1);
      setDescription(sigil.description || '');
      setCoverAsset(sigil.coverAsset || '');

      if (st === 'effector') {
        fetchSigilEffectOverrides(sigil.id).then((ovs) => {
          const mapped: Record<string, EffectOverrideConfig> = {};
          ovs.forEach((o) => {
            mapped[o.effectType] = {
              effectType: o.effectType,
              isExcluded: o.isExcluded,
              tickDamageMult: o.tickDamageMult,
              intervalTicksOverride: o.intervalTicksOverride,
              durationTicksOverride: o.durationTicksOverride,
            };
          });
          setEffectOverrides(mapped);
          setInitialOverrides(mapped);
        });

        fetchResolvedEffects(sigil.id)
          .then((data) => setResolvedEffects(Array.isArray(data) ? data : []))
          .catch(() => setResolvedEffects([]));
      } else {
        setResolvedEffects([]);
        setEffectOverrides({});
        setInitialOverrides({});
      }
    }
  }, [sigil]);

  const hasChanges = useMemo(() => {
    if (!sigil) return false;
    const currentLabel = label.trim();
    const origLabel = (sigil.label || '').trim();
    if (currentLabel !== origLabel) return true;

    const currentSigilType = sigil.sigilType || (sigil.type === 'effector' ? 'effector' : sigil.augmentorType === 'position' ? 'position' : 'form');
    if (sigilType !== currentSigilType) return true;

    if (sigilType === 'effector') {
      if (element !== (sigil.element || 'fire')) return true;
      if (baseHitDamage !== (sigil.baseHitDamage ?? 100)) return true;
      if (JSON.stringify(effectOverrides) !== JSON.stringify(initialOverrides)) return true;
    } else if (sigilType === 'form') {
      if (formType !== (sigil.formType || 'dash')) return true;
    }

    if (tier !== (sigil.tier || 1)) return true;

    const currentDesc = description.trim();
    const origDesc = (sigil.description || '').trim();
    if (currentDesc !== origDesc) return true;

    const currentCover = (coverAsset || '').trim();
    const origCover = (sigil.coverAsset || '').trim();
    if (currentCover !== origCover) return true;

    return false;
  }, [sigil, label, sigilType, element, baseHitDamage, formType, tier, description, coverAsset, effectOverrides, initialOverrides]);

  if (isLoadingRemote && !sigil) {
    return <SigilDetailPageSkeleton />;
  }

  if (!sigil || !id) {
    return (
      <div className="admin-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <SparkleIcon size={40} color="var(--admin-ink-muted)" style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ margin: '0 0 0.5rem' }}>Sigil Not Found</h3>
        <div style={{ margin: '0 0 1.5rem', color: 'var(--admin-ink-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <span>No registered sigil exists with</span>
          <MaskedIdBadge id={id || 'unknown'} label="ID:" />
        </div>
        <Link to="/admin_dashboard/sigils" className="admin-btn admin-btn-primary">
          <ArrowLeftIcon size={16} /> Back to Catalog
        </Link>
      </div>
    );
  }

  const sampleSvgs = [
    { label: 'Fire Effector', path: '/sigils/svg/eff-fire.svg' },
    { label: 'Water Effector', path: '/sigils/svg/eff-water.svg' },
    { label: 'Earth Effector', path: '/sigils/svg/eff-earth.svg' },
    { label: 'Air Effector', path: '/sigils/svg/eff-air.svg' },
    { label: 'Position Augmentor', path: '/sigils/svg/aug-position.svg' },
    { label: 'Dash Form', path: '/sigils/svg/aug-form-dash.svg' },
    { label: 'Whirl Form', path: '/sigils/svg/aug-form-whirl.svg' },
    { label: 'Condense Form', path: '/sigils/svg/aug-form-condense.svg' },
    { label: 'Compress Form', path: '/sigils/svg/aug-form-compress.svg' },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result as string;
      if (isSvg) {
        setCoverAsset(result);
        toast.success('Vector SVG graphic applied.');
      } else {
        // Open the background remover modal for raster images
        setRawUploadedAsset(result);
        setIsBgModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || isSaving) return;

    if (!label.trim()) {
      toast.error('Sigil label cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const derivedType: 'effector' | 'augmentor' = sigilType === 'effector' ? 'effector' : 'augmentor';
      const derivedAugType: AugmentorType | undefined = sigilType === 'position' ? 'position' : sigilType === 'form' ? 'form' : undefined;

      const updated = {
        id,
        label: label.trim(),
        type: derivedType,
        sigilType,
        element: sigilType === 'effector' ? element : undefined,
        elementId: sigilType === 'effector' ? element.toUpperCase() : undefined,
        augmentorType: derivedAugType,
        formType: sigilType === 'form' ? formType : undefined,
        baseHitDamage: sigilType === 'effector' ? baseHitDamage : undefined,
        tier,
        description: description.trim(),
        coverAsset: coverAsset || '/sigils/svg/eff-fire.svg',
        svgPath: coverAsset || '/sigils/svg/eff-fire.svg',
        textureKey: label.trim().toLowerCase().replace(/[^a-z0-9]/g, '-'),
      };

      // 1. Always save locally first
      updateSigil(id, updated);

      // 2. Save effect overrides if effector
      if (sigilType === 'effector') {
        const overridesList = Object.values(effectOverrides).map((ov) => ({
          sigilId: id,
          effectType: ov.effectType,
          tickDamageMult: ov.tickDamageMult,
          durationTicksOverride: ov.durationTicksOverride,
          intervalTicksOverride: ov.intervalTicksOverride,
          isExcluded: ov.isExcluded,
        }));
        try {
          await saveSigilEffectOverrides(overridesList);
          setInitialOverrides(JSON.parse(JSON.stringify(effectOverrides)));

          const res = await fetchResolvedEffects(id);
          setResolvedEffects(Array.isArray(res) ? res : []);
        } catch (ovErr) {
          console.warn('Failed to save effect overrides:', ovErr);
        }
      }

      // 3. Attempt to sync to remote (non-blocking — if it fails, syncSigil shows a gentle toast)
      await syncSigil(updated);
    } catch (err: any) {
      console.error('Unexpected save error:', err);
      toast.error(`Failed to save: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    toast(
      (t) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>Delete <b>{sigil.label}</b> and its {examples.length} training examples?</span>
          <button
            className="admin-btn admin-btn-danger"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
            onClick={() => {
              clearExamplesForSigil(id);
              deleteSigil(id);
              navigate('/admin_dashboard/sigils');
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
      { duration: 6000 }
    );
  };

  return (
    <div>
      <div style={{ marginBottom: '0.65rem' }}>
        <Link
          to="/admin_dashboard/sigils"
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
          Back to Sigils Catalog
        </Link>
      </div>

      <div className="admin-page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <h2 className="admin-page-title" style={{ margin: 0 }}>{sigil.label}</h2>
            <span
              className={`admin-badge ${sigil.type === 'effector' ? 'admin-badge-effector' : 'admin-badge-augmentor'}`}
            >
              {sigil.type}
            </span>
            {Boolean(drafts[id]) && (
              <UnsavedBadge
                isUnsaved={true}
                onClick={() => syncSigil(sigil)}
                style={{ position: 'relative', top: 0, right: 0 }}
              />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
            <span className="sigil-tier-pill">Tier {sigil.tier}</span>
            <MaskedIdBadge id={sigil.id} label="ID:" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link
            to={`/admin_dashboard/sigils/${id}/training`}
            className="admin-btn admin-btn-primary"
            style={{ boxShadow: '0 4px 14px var(--admin-accent-glow)' }}
          >
            <BrainIcon size={18} weight="fill" />
            Open Training Studio ({examples.length})
          </Link>
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(280px, 0.8fr)', gap: '2rem' }}>
        {/* Left Column: Edit Form */}
        <form onSubmit={handleSave} className="admin-panel">
          <h3 style={{ fontFamily: 'var(--font-heading)', marginTop: 0, marginBottom: '1.25rem' }}>
            Edit Sigil Configuration
          </h3>

          <div className="admin-form">
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="edit-label">
                Label / Display Name
              </label>
              <input
                id="edit-label"
                type="text"
                className="admin-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label">Sigil Type</label>
              <div className="admin-segmented">
                <button
                  type="button"
                  className={`admin-segmented-btn ${sigilType === 'effector' ? 'active' : ''}`}
                  onClick={() => {
                    setSigilType('effector');
                    setType('effector');
                  }}
                >
                  Effector
                </button>
                <button
                  type="button"
                  className={`admin-segmented-btn ${sigilType === 'form' ? 'active' : ''}`}
                  onClick={() => {
                    setSigilType('form');
                    setType('augmentor');
                    setAugmentorType('form');
                  }}
                >
                  Form
                </button>
                <button
                  type="button"
                  className={`admin-segmented-btn ${sigilType === 'position' ? 'active' : ''}`}
                  onClick={() => {
                    setSigilType('position');
                    setType('augmentor');
                    setAugmentorType('position');
                  }}
                >
                  Position
                </button>
              </div>
            </div>

            {sigilType === 'effector' && (
              <>
                <div className="admin-form-group">
                  <label className="admin-label" htmlFor="edit-element">
                    Element Affinity
                  </label>
                  <AdminSelect
                    id="edit-element"
                    value={element}
                    onChange={(val) => {
                      setElement(val as Element);
                      const matched = elements.find((e) => e.id.toLowerCase() === (val as string).toLowerCase());
                      if (matched?.baseHitDamage) {
                        setBaseHitDamage(matched.baseHitDamage);
                      }
                    }}
                    options={
                      elements.length > 0
                        ? elements.map((el) => ({ value: el.id.toLowerCase(), label: el.label }))
                        : [
                            { value: 'fire', label: 'Fire' },
                            { value: 'water', label: 'Water' },
                            { value: 'earth', label: 'Earth' },
                            { value: 'air', label: 'Air' },
                          ]
                    }
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-label" htmlFor="edit-damage">
                    Base Hit Damage
                  </label>
                  <input
                    id="edit-damage"
                    type="number"
                    className="admin-input"
                    value={baseHitDamage}
                    onChange={(e) => setBaseHitDamage(parseInt(e.target.value) || 0)}
                    min={0}
                  />
                </div>

                <SigilEffectsModifier
                  elementId={element}
                  overrides={effectOverrides}
                  onChange={setEffectOverrides}
                  disabled={isSaving}
                />
              </>
            )}

            {sigilType === 'form' && (
              <div className="admin-form-group">
                <label className="admin-label" htmlFor="edit-form-type">
                  Form Type
                </label>
                <AdminSelect
                  id="edit-form-type"
                  value={formType}
                  onChange={(val) => setFormType(val as FormType)}
                  options={[
                    { value: 'dash', label: 'Dash' },
                    { value: 'whirl', label: 'Whirl' },
                    { value: 'condense', label: 'Condense' },
                    { value: 'compress', label: 'Compress' },
                  ]}
                />
              </div>
            )}

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="edit-tier">
                Tier Level
              </label>
              <input
                id="edit-tier"
                type="number"
                min={1}
                max={3}
                className="admin-input"
                value={tier}
                onChange={(e) => setTier(Number(e.target.value))}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="edit-desc">
                Description / Lore
              </label>
              <textarea
                id="edit-desc"
                className="admin-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Cover Asset Selection */}
            <div className="admin-form-group">
              <label className="admin-label">Cover Artwork / SVG</label>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--admin-paper-muted)',
                    border: '1px solid var(--admin-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {coverAsset ? (
                    <img
                      src={coverAsset}
                      alt="Preview"
                      style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }}
                    />
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: 'var(--admin-ink-muted)' }}>No Asset</span>
                  )}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <label
                      htmlFor="edit-custom-asset-upload"
                      className="admin-btn admin-btn-secondary"
                      style={{ cursor: 'pointer', display: 'inline-flex', padding: '0.45rem 0.85rem' }}
                    >
                      <UploadIcon size={16} />
                      Upload New Image / SVG
                    </label>
                    {coverAsset && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        style={{ display: 'inline-flex', padding: '0.45rem 0.85rem', gap: '0.35rem' }}
                        onClick={() => {
                          setRawUploadedAsset(coverAsset);
                          setIsBgModalOpen(true);
                        }}
                        title="Remove background from current graphic"
                      >
                        <SparkleIcon size={15} color="var(--admin-accent)" weight="fill" />
                        Remove Background
                      </button>
                    )}
                  </div>
                  <input
                    id="edit-custom-asset-upload"
                    type="file"
                    accept="image/svg+xml,image/png,image/jpeg"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--admin-ink-muted)' }}>
                    PNG, JPG, or SVG accepted (auto-cleans white background)
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-ink-secondary)', marginBottom: '0.35rem' }}>
                Choose preset SVG:
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))',
                  gap: '0.4rem',
                }}
              >
                {sampleSvgs.map((preset) => (
                  <button
                    key={preset.path}
                    type="button"
                    onClick={() => setCoverAsset(preset.path)}
                    title={preset.label}
                    style={{
                      padding: '4px',
                      background: coverAsset === preset.path ? 'var(--admin-accent-subtle)' : 'var(--admin-paper)',
                      border: `1.5px solid ${coverAsset === preset.path ? 'var(--admin-accent)' : 'var(--admin-border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      aspectRatio: '1 / 1',
                    }}
                  >
                    <img
                      src={preset.path}
                      alt={preset.label}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
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
                  transition: 'all 0.2s ease',
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
                    <span>Saving Changes…</span>
                  </>
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
          </div>
        </form>

        {/* Right Column: Training Quick-Card & Danger Zone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Training Studio Quick Banner */}
          <div className="admin-panel" style={{ border: '1.5px solid var(--admin-accent)', background: 'var(--admin-accent-paper)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <BrainIcon size={28} color="var(--admin-accent)" weight="fill" />
              <div>
                <h4 style={{ margin: 0, fontFamily: 'var(--font-heading)', color: 'var(--admin-ink)' }}>
                  ML Recognition Training
                </h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--admin-ink-secondary)' }}>
                  {examples.length} {examples.length === 1 ? 'example' : 'examples'} recorded
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--admin-ink-secondary)', margin: '0 0 1rem', lineHeight: 1.5 }}>
              Train the QuickDraw neural embedding model to recognize hand-drawn strokes for this specific sigil.
            </p>

            <Link
              to={`/admin_dashboard/sigils/${id}/training`}
              className="admin-btn admin-btn-primary"
              style={{ width: '100%', boxSizing: 'border-box' }}
            >
              <BrainIcon size={18} />
              Open Training Studio
            </Link>
          </div>

          {/* Danger Zone */}
          <div className="admin-panel" style={{ border: '1px solid var(--admin-danger-border)', background: 'var(--admin-danger-paper)' }}>
            <h4 style={{ margin: '0 0 0.5rem', color: 'var(--admin-danger)', fontFamily: 'var(--font-heading)' }}>
              Danger Zone
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--admin-ink-secondary)', margin: '0 0 1rem' }}>
              Permanently delete this sigil and all its associated training exemplars.
            </p>
            <button
              type="button"
              onClick={handleDelete}
              className="admin-btn admin-btn-danger"
              style={{ width: '100%' }}
            >
              <TrashIcon size={16} />
              Delete Sigil
            </button>
          </div>
        </div>
      </div>

      {/* Detached Background Remover Modal */}
      <BackgroundRemoverModal
        isOpen={isBgModalOpen}
        imageSrc={rawUploadedAsset}
        onClose={() => setIsBgModalOpen(false)}
        onApply={(transparentDataUrl) => {
          setCoverAsset(transparentDataUrl);
          setIsBgModalOpen(false);
          toast.success('Transparent asset applied successfully!');
        }}
        title={`Clean Asset Background: ${label || 'Sigil'}`}
      />
    </div>
  );
};
