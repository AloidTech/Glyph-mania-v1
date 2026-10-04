import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon, SparkleIcon, UploadIcon, CheckIcon } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { useAdminSigilsStore } from '../../lib/stores/admin_sigils_store';
import { useTrainingStore } from '../../lib/ml/training_store';
import { DrawingCanvas, DrawingCanvasRef } from '../../components/DrawingCanvas';
import { embedDrawing, makeThumb } from '../../lib/ml/embedding_engine';
import { Element, FormType, AugmentorType, SigilType } from '../../types/glyph_types';
import { useElementsStore } from '../../lib/stores/elements_store';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { BackgroundRemoverModal } from '../../components/admin/BackgroundRemoverModal';
import { createSigilApi, saveSigilEffectOverrides } from '../../lib/apis/api';
import { generateSigilId } from '../../lib/glyph_helpers/sigils';
import { SigilEffectsModifier, EffectOverrideConfig } from '../../components/admin/SigilEffectsModifier';

export const SigilCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const addSigil = useAdminSigilsStore((state) => state.addSigil);
  const clearDraft = useAdminSigilsStore((state) => state.clearDraft);
  const loadRemoteSigils = useAdminSigilsStore((state) => state.loadRemoteSigils);
  const addExample = useTrainingStore((state) => state.addExample);
  const elements = useElementsStore((state) => state.elements);
  const drawingRef = useRef<DrawingCanvasRef>(null);

  const [label, setLabel] = useState('');
  const [sigilType, setSigilType] = useState<SigilType>('effector');
  const [type, setType] = useState<'effector' | 'augmentor'>('effector');
  const [element, setElement] = useState<Element>('fire');
  const [augmentorType, setAugmentorType] = useState<AugmentorType>('form');
  const [formType, setFormType] = useState<FormType>('dash');
  const [baseHitDamage, setBaseHitDamage] = useState<number>(100);
  const [tier, setTier] = useState<number>(1);
  const [description, setDescription] = useState('');
  const [coverAsset, setCoverAsset] = useState<string>('/sigils/svg/eff-fire.svg');
  const [customAssetPreview, setCustomAssetPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);
  const [rawUploadedAsset, setRawUploadedAsset] = useState<string | null>(null);
  const [effectOverrides, setEffectOverrides] = useState<Record<string, EffectOverrideConfig>>({});

  useEffect(() => {
    if (elements.length === 0) {
      useElementsStore.getState().loadElements();
    }
  }, [elements.length]);

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
        setCustomAssetPreview(result);
        setCoverAsset(result);
        toast.success('Vector SVG graphic applied.');
      } else {
        setRawUploadedAsset(result);
        setIsBgModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error('Please provide a name/label for the sigil.');
      return;
    }

    setIsSubmitting(true);

    try {
      const derivedType: 'effector' | 'augmentor' = sigilType === 'effector' ? 'effector' : 'augmentor';
      const derivedAugType: AugmentorType | undefined = sigilType === 'position' ? 'position' : sigilType === 'form' ? 'form' : undefined;

      const generatedId = generateSigilId(label.trim(), derivedType, derivedAugType);

      const newSigil = addSigil({
        id: generatedId,
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
      });

      // Attempt to save to database via Edge Function
      try {
        await createSigilApi({
          id: generatedId,
          label: label.trim(),
          description: description.trim(),
          tier,
          cover_asset: coverAsset || '/sigils/svg/eff-fire.svg',
          texture_key: label.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          type: derivedType,
          sigil_type: sigilType,
          element: sigilType === 'effector' ? element : undefined,
          element_id: sigilType === 'effector' ? element.toUpperCase() : undefined,
          base_hit_damage: sigilType === 'effector' ? baseHitDamage : undefined,
          augmentor_type: derivedAugType,
          form_type: sigilType === 'form' ? formType : undefined,
        });
        clearDraft(newSigil.id);
        await loadRemoteSigils();

        // Save effect overrides if effector sigil
        if (sigilType === 'effector') {
          const overridesList = Object.values(effectOverrides).map((ov) => ({
            sigilId: generatedId,
            effectType: ov.effectType,
            tickDamageMult: ov.tickDamageMult,
            durationTicksOverride: ov.durationTicksOverride,
            intervalTicksOverride: ov.intervalTicksOverride,
            isExcluded: ov.isExcluded,
          }));
          if (overridesList.length > 0) {
            try {
              await saveSigilEffectOverrides(overridesList);
            } catch (ovErr) {
              console.warn('Failed to save effect overrides:', ovErr);
            }
          }
        }

        toast.success(`Sigil "${label}" saved to Supabase!`);
      } catch (edgeErr: any) {
        console.warn('create-sigil edge function skipped or failed:', edgeErr);
        toast(`Saved "${label}" locally as draft (Sign in to sync to cloud)`, { icon: '📝' });
      }

      // If user drew on canvas, embed and add as first training example
      const canvasEl = drawingRef.current?.getCanvasElement();
      const isEmpty = drawingRef.current?.isEmpty() ?? true;

      if (canvasEl && !isEmpty) {
        const toastId = toast.loading('Generating neural embedding for drawing exemplar…');
        const vec = await embedDrawing(canvasEl);
        const thumb = makeThumb(canvasEl, 96);
        addExample(newSigil.id, { vec, thumb });
        toast.dismiss(toastId);
      }

      navigate(`/admin_dashboard/sigils/${newSigil.id}/training`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to create sigil: ${err.message || err}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
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

      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Register New Sigil</h2>
          <p className="admin-page-subtitle">
            Create an arcane sigil definition, configure its cover art, and draw an initial training exemplar.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1.1fr)', gap: '2rem' }}>
          {/* Left Column: Form Details */}
          <div className="admin-panel">
            <h3 style={{ fontFamily: 'var(--font-heading)', marginTop: 0, marginBottom: '1.25rem' }}>
              Sigil Metadata
            </h3>

            <div className="admin-form">
              <div className="admin-form-group">
                <label className="admin-label" htmlFor="sigil-label">
                  Sigil Label / Name *
                </label>
                <input
                  id="sigil-label"
                  type="text"
                  className="admin-input"
                  placeholder="e.g. Solar Flare, Nova, Frost Vortex"
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
                    <label className="admin-label" htmlFor="sigil-element">
                      Element Affinity
                    </label>
                    <AdminSelect
                      id="sigil-element"
                      value={element}
                      onChange={(val) => {
                        setElement(val as Element);
                        const matchedEl = elements.find((e) => e.id.toLowerCase() === (val as string).toLowerCase());
                        if (matchedEl?.baseHitDamage) {
                          setBaseHitDamage(matchedEl.baseHitDamage);
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
                    <label className="admin-label" htmlFor="sigil-damage">
                      Base Hit Damage
                    </label>
                    <input
                      id="sigil-damage"
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
                    disabled={isSubmitting}
                  />
                </>
              )}

              {sigilType === 'form' && (
                <div className="admin-form-group">
                  <label className="admin-label" htmlFor="sigil-form-type">
                    Form Geometry Type
                  </label>
                  <AdminSelect
                    id="sigil-form-type"
                    value={formType}
                    onChange={(val) => setFormType(val as FormType)}
                    options={[
                      { value: 'dash', label: 'Dash (Linear)' },
                      { value: 'whirl', label: 'Whirl (Rotational)' },
                      { value: 'condense', label: 'Condense (Burst)' },
                      { value: 'compress', label: 'Compress (Heavy Impact)' },
                    ]}
                  />
                </div>
              )}



              <div className="admin-form-group">
                <label className="admin-label" htmlFor="sigil-tier">
                  Tier Level (1-3)
                </label>
                <input
                  id="sigil-tier"
                  type="number"
                  min={1}
                  max={3}
                  className="admin-input"
                  value={tier}
                  onChange={(e) => setTier(Number(e.target.value))}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="sigil-desc">
                  Description / Lore
                </label>
                <textarea
                  id="sigil-desc"
                  className="admin-textarea"
                  placeholder="Describe the mystical effects and behavior of this sigil..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Cover Asset Selection / Upload */}
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

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <label
                        htmlFor="custom-asset-upload"
                        className="admin-btn admin-btn-secondary"
                        style={{ cursor: 'pointer', display: 'inline-flex', padding: '0.45rem 0.85rem' }}
                      >
                        <UploadIcon size={16} />
                        Upload Custom SVG / Image
                      </label>
                      {(customAssetPreview || rawUploadedAsset) && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          onClick={() => {
                            if (!rawUploadedAsset && customAssetPreview) {
                              setRawUploadedAsset(customAssetPreview);
                            }
                            setIsBgModalOpen(true);
                          }}
                          style={{ padding: '0.45rem 0.85rem', color: 'var(--admin-accent)' }}
                        >
                          <SparkleIcon size={16} weight="fill" />
                          Remove Background
                        </button>
                      )}
                    </div>
                    <input
                      id="custom-asset-upload"
                      type="file"
                      accept="image/svg+xml,image/png,image/jpeg"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-ink-muted)', marginTop: '0.35rem' }}>
                      PNG, JPG, or SVG accepted
                    </div>
                  </div>
                </div>

                {/* Quick select canonical presets */}
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-ink-secondary)', marginBottom: '0.35rem' }}>
                  Or select from existing SVG catalog:
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
                      onClick={() => {
                        setCoverAsset(preset.path);
                        setCustomAssetPreview(null);
                      }}
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
            </div>
          </div>

          {/* Right Column: Initial Drawing Canvas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="canvas-container-card">
              <div className="canvas-container-header">
                <div>
                  <h3>Initial Training Drawing</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--admin-ink-muted)' }}>
                    Draw this sigil now to provide the first recognition exemplar.
                  </div>
                </div>
              </div>

              <div className="canvas-aspect-box">
                <DrawingCanvas
                  ref={drawingRef}
                  showGuide={false}
                  showToolbar={true}
                  brushColor="var(--admin-brush)"
                  fixedBrushSize
                />
              </div>
            </div>



            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Link to="/admin_dashboard/sigils" className="admin-btn admin-btn-secondary">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="admin-btn admin-btn-primary"
                style={{ minWidth: 180 }}
              >
                <CheckIcon size={18} weight="bold" />
                {isSubmitting ? 'Registering...' : 'Register Sigil & Train'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Reusable Background Remover Modal */}
      {rawUploadedAsset && (
        <BackgroundRemoverModal
          isOpen={isBgModalOpen}
          imageSrc={rawUploadedAsset}
          onClose={() => setIsBgModalOpen(false)}
          onApply={(transparentDataUrl) => {
            setCustomAssetPreview(transparentDataUrl);
            setCoverAsset(transparentDataUrl);
            setIsBgModalOpen(false);
            toast.success('Clean transparent background applied!');
          }}
          title={`Clean Asset Background: ${label || 'New Sigil'}`}
        />
      )}
    </div>
  );
};
