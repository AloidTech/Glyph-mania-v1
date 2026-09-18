/**
 * @file glyph_logic.ts
 * @description Shared Glyph Solidity, Validation Rules, and In-Game Runtime Execution for backend/src.
 * Fully synchronized with frontend glyph_solidity.ts and glyph_runtime.ts.
 */

import type {
  GlyphBase,
  GlyphComposition,
  Sigil,
  FormAugmentorSigil,
  ActiveGlyphInstance,
  SceneGlyphInventory,
  Transform,
  Direction,
  FormType,
  Element,
  AdminSigilItem,
  SlotSolidityAnalysis,
  SlotAccuracies,
  SlotErrorDetail,
  SolidityAnalysis,
  GlyphCompositionAnalysis,
  CanvasSigilError,
} from '../types/index.js';

// Re-export analysis types for convenience
export type {
  SlotSolidityAnalysis,
  SlotAccuracies,
  SlotErrorDetail,
  SolidityAnalysis,
  CanvasSigilError,
};

// ==========================================
// 1. Pure Solidity & Composition Validation
// ==========================================

/**
 * Detailed analysis of glyph solidity.
 * A glyph is "solid" when:
 *  1. Central effector slot is filled and accuracy >= 80%.
 *  2. All 4 cardinal position slots are filled and accuracy >= 80%.
 *  3. All 4 diagonal form slots are filled with one uniform FormType and accuracy >= 80%.
 */
export function analyzeSolidity(
  glyph: GlyphBase,
  sigilLookup: Record<string, Sigil | AdminSigilItem> | (Sigil | AdminSigilItem)[],
  accuracies?: SlotAccuracies
): SolidityAnalysis {
  const comp = glyph.composition;
  const reasons: string[] = [];
  const lowAccuracySlots: string[] = [];
  const recordedAccuracies: Record<string, number> = {};
  const slotErrors: Record<string, SlotErrorDetail[]> = {};

  const addSlotError = (slotKey: string, type: SlotErrorDetail['type'], message: string) => {
    if (!slotErrors[slotKey]) slotErrors[slotKey] = [];
    slotErrors[slotKey].push({ type, message });
  };

  const slots: SlotSolidityAnalysis = {
    effector: false,
    directions: {
      top: false,
      right: false,
      bottom: false,
      left: false,
    },
    formAugmentors: {
      topLeft: false,
      topRight: false,
      bottomLeft: false,
      bottomRight: false,
    },
  };

  if (!comp) {
    return {
      isSolid: false,
      slots,
      reasons: ['No composition provided'],
      formType: null,
      lowAccuracySlots,
      accuracies: recordedAccuracies,
      slotErrors,
    };
  }

  // Lookup helper supporting Array or Record, exact ID, labels, and aliases
  const getSigil = (id?: string): Sigil | AdminSigilItem | any => {
    if (!id) return undefined;
    const list: any[] = Array.isArray(sigilLookup) ? sigilLookup : Object.values(sigilLookup || {});
    const query = id.trim().toLowerCase();

    // 1. Exact ID match
    let found = list.find((s) => s.id === id || s.id?.toLowerCase() === query);
    if (found) return found;

    // 2. Label match
    found = list.find((s) => s.label && s.label.toLowerCase() === query);
    if (found) return found;

    // 3. Position aliases
    if (query === 'position' || query === 'aug-position' || query === 'top' || query === 'bottom' || query === 'left' || query === 'right' || query.includes('anchor') || query.includes('direction')) {
      found = list.find((s) => s.type === 'augmentor' && (s.augmentorType === 'position' || s.augmentor_type === 'position'));
      if (found) return found;
    }

    // 4. Effector aliases
    if (query === 'fire' || query === 'eff-fire') {
      found = list.find((s) => s.type === 'effector' && s.element === 'fire');
      if (found) return found;
    }
    if (query === 'water' || query === 'eff-water') {
      found = list.find((s) => s.type === 'effector' && s.element === 'water');
      if (found) return found;
    }
    if (query === 'earth' || query === 'eff-earth') {
      found = list.find((s) => s.type === 'effector' && s.element === 'earth');
      if (found) return found;
    }
    if (query === 'air' || query === 'eff-air') {
      found = list.find((s) => s.type === 'effector' && s.element === 'air');
      if (found) return found;
    }

    // 5. Form aliases
    if (query === 'dash' || query === 'aug-form-dash') {
      found = list.find((s) => s.type === 'augmentor' && (s.formType === 'dash' || s.form_type === 'dash'));
      if (found) return found;
    }
    if (query === 'whirl' || query === 'aug-form-whirl') {
      found = list.find((s) => s.type === 'augmentor' && (s.formType === 'whirl' || s.form_type === 'whirl'));
      if (found) return found;
    }
    if (query === 'condense' || query === 'aug-form-condense') {
      found = list.find((s) => s.type === 'augmentor' && (s.formType === 'condense' || s.form_type === 'condense'));
      if (found) return found;
    }
    if (query === 'compress' || query === 'aug-form-compress') {
      found = list.find((s) => s.type === 'augmentor' && (s.formType === 'compress' || s.form_type === 'compress'));
      if (found) return found;
    }

    return undefined;
  };

  // Helper to normalize confidence to 0..1 range (handling both 0.85 and 85%)
  const normalizeConf = (conf?: number | null): number | undefined => {
    if (conf === undefined || conf === null || isNaN(conf)) return undefined;
    return conf > 1 ? conf / 100 : conf;
  };

  // 1. Validate Central Effector
  if (!comp.effector || !comp.effector.sigilId) {
    reasons.push('Missing central Effector');
    addSlotError('effector', 'missing', 'Missing central Effector');
  } else {
    const effectorSigil = getSigil(comp.effector.sigilId);
    if (!effectorSigil) {
      reasons.push(`Unknown effector sigil: ${comp.effector.sigilId}`);
      addSlotError('effector', 'type_mismatch', `Unknown effector sigil: ${comp.effector.sigilId}`);
    } else if (effectorSigil.type !== 'effector') {
      reasons.push(`Sigil in center is not an effector (type: ${effectorSigil.type})`);
      addSlotError(
        'effector',
        'type_mismatch',
        `Center requires an Effector sigil, but found ${effectorSigil.type}.`
      );
    } else {
      slots.effector = true;
    }
  }

  // Check Effector Accuracy
  const rawEffConf = accuracies?.effector ?? comp.effector?.confidence;
  const effectorConf = normalizeConf(rawEffConf);
  if (effectorConf !== undefined) {
    recordedAccuracies.effector = effectorConf;
    if (effectorConf < 0.8) {
      lowAccuracySlots.push('effector');
      reasons.push(`Effector accuracy is too low (${(effectorConf * 100).toFixed(1)}% < 80%)`);
      addSlotError(
        'effector',
        'low_accuracy',
        `Effector recognition accuracy is low (${(effectorConf * 100).toFixed(0)}%). Refine strokes.`
      );
    }
  }

  // 2. Validate Cardinal Directions (top, right, bottom, left)
  const dirKeys = ['top', 'right', 'bottom', 'left'] as const;
  for (const dir of dirKeys) {
    const slot = comp.directions?.[dir];
    if (!slot || !slot.sigilId) {
      reasons.push(`Missing cardinal anchor: ${dir}`);
      addSlotError(dir, 'missing', `Missing cardinal anchor: ${dir}`);
      continue;
    }

    const sigil = getSigil(slot.sigilId);
    if (!sigil) {
      reasons.push(`Unknown sigil for direction ${dir}: ${slot.sigilId}`);
      addSlotError(dir, 'type_mismatch', `Unknown sigil: ${slot.sigilId}`);
      continue;
    }

    if (sigil.type !== 'augmentor' || sigil.augmentorType !== 'position') {
      reasons.push(`Sigil in ${dir} is not a position augmentor`);
      addSlotError(
        dir,
        'type_mismatch',
        `Position anchor requires a Direction sigil, but found ${sigil.type}.`
      );
      continue;
    }

    slots.directions[dir] = true;

    // Check Direction Accuracy
    const rawDirConf = (accuracies as any)?.[dir] ?? slot.confidence;
    const dirConf = normalizeConf(rawDirConf);
    if (dirConf !== undefined) {
      recordedAccuracies[dir] = dirConf;
      if (dirConf < 0.8) {
        lowAccuracySlots.push(dir);
        reasons.push(`${dir} anchor accuracy is too low (${(dirConf * 100).toFixed(1)}% < 80%)`);
        addSlotError(
          dir,
          'low_accuracy',
          `${dir.charAt(0).toUpperCase() + dir.slice(1)} anchor accuracy is low (${(
            dirConf * 100
          ).toFixed(0)}%).`
        );
      }
    }
  }

  // 3. Validate Diagonal Form Augmentors (topLeft, topRight, bottomLeft, bottomRight)
  const formKeys = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;
  let targetFormType: FormType | null = null;

  for (const f of formKeys) {
    const slot = comp.formAugmentors?.[f];
    if (!slot || !slot.sigilId) {
      reasons.push(`Missing diagonal form augmentor: ${f}`);
      addSlotError(f, 'missing', `Missing form augmentor: ${f}`);
      continue;
    }

    const sigil = getSigil(slot.sigilId);
    if (!sigil) {
      reasons.push(`Unknown sigil for form slot ${f}: ${slot.sigilId}`);
      addSlotError(f, 'type_mismatch', `Unknown sigil: ${slot.sigilId}`);
      continue;
    }

    if (sigil.type !== 'augmentor' || sigil.augmentorType !== 'form') {
      reasons.push(`Sigil in ${f} is not a form augmentor`);
      addSlotError(f, 'type_mismatch', `Form slot requires a Form augmentor, but found ${sigil.type}.`);
      continue;
    }

    const formSigil = sigil as FormAugmentorSigil;
    if (!formSigil.formType) {
      reasons.push(`Form augmentor in ${f} has no formType specified`);
      addSlotError(f, 'form_mismatch', `Form sigil has no valid formType.`);
      continue;
    }

    if (!targetFormType) {
      targetFormType = formSigil.formType;
    } else if (targetFormType !== formSigil.formType) {
      reasons.push(
        `Form mismatch: slot ${f} has ${formSigil.formType}, but expected uniform ${targetFormType}`
      );
      addSlotError(
        f,
        'form_mismatch',
        `Mixed form types detected. Expected uniform "${targetFormType}" form across all corners.`
      );
      continue;
    }

    slots.formAugmentors[f] = true;

    // Check Form Accuracy
    const rawFormConf = (accuracies as any)?.[f] ?? slot.confidence;
    const formConf = normalizeConf(rawFormConf);
    if (formConf !== undefined) {
      recordedAccuracies[f] = formConf;
      if (formConf < 0.8) {
        lowAccuracySlots.push(f);
        reasons.push(`${f} form accuracy is too low (${(formConf * 100).toFixed(1)}% < 80%)`);
        addSlotError(
          f,
          'low_accuracy',
          `Corner form accuracy is low (${(formConf * 100).toFixed(0)}%).`
        );
      }
    }
  }

  // Solidity Verdict: all slots must pass and no slot can be under 80% accuracy
  const isSolid =
    slots.effector &&
    Object.values(slots.directions).every(Boolean) &&
    Object.values(slots.formAugmentors).every(Boolean) &&
    lowAccuracySlots.length === 0 &&
    reasons.length === 0;

  return {
    isSolid,
    slots,
    reasons,
    formType: targetFormType,
    lowAccuracySlots,
    accuracies: recordedAccuracies,
    slotErrors,
  };
}

/**
 * Returns full SolidityAnalysis for a glyph.
 */
export function isSolid(
  glyph: GlyphBase,
  sigilLookup: Record<string, Sigil | AdminSigilItem> | (Sigil | AdminSigilItem)[],
  accuracies?: SlotAccuracies
): SolidityAnalysis {
  return analyzeSolidity(glyph, sigilLookup, accuracies);
}

// ==========================================
// 2. Composition & Analysis Helpers
// ==========================================

/**
 * Converts a GlyphCompositionAnalysis into a standardized GlyphComposition object.
 */
export function buildCompositionFromAnalysis(
  analysis: GlyphCompositionAnalysis,
  resolveSigilId: (label?: string | null) => string | undefined,
  element?: Element
): GlyphComposition {
  return {
    effector: {
      sigilId: resolveSigilId(analysis.semanticCrops.effector?.recognition.label),
      label: analysis.semanticCrops.effector?.recognition.label || undefined,
      element,
      confidence: analysis.semanticCrops.effector?.recognition.confidence ?? undefined,
      customCrop: analysis.semanticCrops.effector?.dataUrl || undefined,
    },
    directions: {
      top: analysis.semanticCrops.top?.dataUrl
        ? {
            sigilId: resolveSigilId(analysis.semanticCrops.top.recognition.label),
            label: analysis.semanticCrops.top.recognition.label || 'North Anchor',
            confidence: analysis.semanticCrops.top.recognition.confidence ?? undefined,
            customCrop: analysis.semanticCrops.top.dataUrl,
          }
        : undefined,
      right: analysis.semanticCrops.right?.dataUrl
        ? {
            sigilId: resolveSigilId(analysis.semanticCrops.right.recognition.label),
            label: analysis.semanticCrops.right.recognition.label || 'East Anchor',
            confidence: analysis.semanticCrops.right.recognition.confidence ?? undefined,
            customCrop: analysis.semanticCrops.right.dataUrl,
          }
        : undefined,
      bottom: analysis.semanticCrops.bottom?.dataUrl
        ? {
            sigilId: resolveSigilId(analysis.semanticCrops.bottom.recognition.label),
            label: analysis.semanticCrops.bottom.recognition.label || 'South Anchor',
            confidence: analysis.semanticCrops.bottom.recognition.confidence ?? undefined,
            customCrop: analysis.semanticCrops.bottom.dataUrl,
          }
        : undefined,
      left: analysis.semanticCrops.left?.dataUrl
        ? {
            sigilId: resolveSigilId(analysis.semanticCrops.left.recognition.label),
            label: analysis.semanticCrops.left.recognition.label || 'West Anchor',
            confidence: analysis.semanticCrops.left.recognition.confidence ?? undefined,
            customCrop: analysis.semanticCrops.left.dataUrl,
          }
        : undefined,
    },
    formAugmentors: {
      topLeft: analysis.semanticCrops.topLeft?.dataUrl
        ? {
            sigilId: resolveSigilId(analysis.semanticCrops.topLeft.recognition.label),
            label: analysis.semanticCrops.topLeft.recognition.label || 'Top-Left Augmentor',
            confidence: analysis.semanticCrops.topLeft.recognition.confidence ?? undefined,
            customCrop: analysis.semanticCrops.topLeft.dataUrl,
          }
        : undefined,
      topRight: analysis.semanticCrops.topRight?.dataUrl
        ? {
            sigilId: resolveSigilId(analysis.semanticCrops.topRight.recognition.label),
            label: analysis.semanticCrops.topRight.recognition.label || 'Top-Right Augmentor',
            confidence: analysis.semanticCrops.topRight.recognition.confidence ?? undefined,
            customCrop: analysis.semanticCrops.topRight.dataUrl,
          }
        : undefined,
      bottomLeft: analysis.semanticCrops.bottomLeft?.dataUrl
        ? {
            sigilId: resolveSigilId(analysis.semanticCrops.bottomLeft.recognition.label),
            label: analysis.semanticCrops.bottomLeft.recognition.label || 'Bottom-Left Augmentor',
            confidence: analysis.semanticCrops.bottomLeft.recognition.confidence ?? undefined,
            customCrop: analysis.semanticCrops.bottomLeft.dataUrl,
          }
        : undefined,
      bottomRight: analysis.semanticCrops.bottomRight?.dataUrl
        ? {
            sigilId: resolveSigilId(analysis.semanticCrops.bottomRight.recognition.label),
            label: analysis.semanticCrops.bottomRight.recognition.label || 'Bottom-Right Augmentor',
            confidence: analysis.semanticCrops.bottomRight.recognition.confidence ?? undefined,
            customCrop: analysis.semanticCrops.bottomRight.dataUrl,
          }
        : undefined,
    },
  };
}

/**
 * Extracts a slot key -> confidence map from a GlyphCompositionAnalysis.
 */
export function buildAccuraciesFromAnalysis(
  analysis: GlyphCompositionAnalysis
): Record<string, number> {
  const accuracies: Record<string, number> = {};

  if (analysis.semanticCrops.effector?.recognition.confidence != null) {
    accuracies.effector = analysis.semanticCrops.effector.recognition.confidence;
  }

  const dirKeys = ['top', 'right', 'bottom', 'left'] as const;
  for (const key of dirKeys) {
    const conf = analysis.semanticCrops[key]?.recognition.confidence;
    if (conf != null) accuracies[key] = conf;
  }

  const formKeys = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;
  for (const key of formKeys) {
    const conf = analysis.semanticCrops[key]?.recognition.confidence;
    if (conf != null) accuracies[key] = conf;
  }

  return accuracies;
}

/**
 * All-in-one helper: builds composition and accuracy map, then analyzes solidity.
 */
export function checkSolidityFromAnalysis(
  analysis: GlyphCompositionAnalysis,
  sigils: (Sigil | AdminSigilItem)[],
  resolveSigilId: (label?: string | null) => string | undefined,
  opts?: { tier?: number; element?: Element }
): SolidityAnalysis {
  const comp = buildCompositionFromAnalysis(analysis, resolveSigilId, opts?.element);
  const accuracies = buildAccuraciesFromAnalysis(analysis);
  return isSolid(
    {
      id: 'preview',
      tier: opts?.tier ?? 1,
      composition: comp,
    },
    sigils,
    accuracies
  );
}

/**
 * Extracts all faulty sigils and their canvas bounding boxes from semantic analysis & solidity result.
 */
export function getCanvasSigilErrors(
  analysis: GlyphCompositionAnalysis | null | undefined,
  solidity: SolidityAnalysis | null | undefined
): CanvasSigilError[] {
  if (!analysis) return [];
  const results: CanvasSigilError[] = [];

  const unionBBox = (bboxes: { x: number; y: number; width: number; height: number }[]) => {
    if (bboxes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    const minX = Math.min(...bboxes.map((b) => b.x));
    const minY = Math.min(...bboxes.map((b) => b.y));
    const maxX = Math.max(...bboxes.map((b) => b.x + b.width));
    const maxY = Math.max(...bboxes.map((b) => b.y + b.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const getSlotError = (slotKey: string, slotCrop: any, fallbackTitle: string): CanvasSigilError | null => {
    const slotErrors = solidity?.slotErrors?.[slotKey] || [];
    const nonMissingError = slotErrors.find((e) => e.type !== 'missing');

    const label = slotCrop?.recognition?.label;
    const conf = slotCrop?.recognition?.confidence;

    if (nonMissingError) {
      return {
        key: slotKey,
        title: fallbackTitle,
        label: label || 'Sigil',
        errorType: nonMissingError.type,
        message: nonMissingError.message,
        confidence: conf,
        bbox: { x: 0, y: 0, width: 0, height: 0 },
      };
    }

    // Check if user drew a symbol in this slot, but it was unrecognized by ML
    if (!label && slotCrop?.dataUrl) {
      return {
        key: slotKey,
        title: fallbackTitle,
        label: 'Unrecognized',
        errorType: 'unrecognized',
        message: `Unrecognized symbol in ${fallbackTitle.toLowerCase()}.`,
        confidence: null,
        bbox: { x: 0, y: 0, width: 0, height: 0 },
      };
    }

    return null;
  };

  // 1. Effector
  if (analysis.spatial?.effectorComponents && analysis.spatial.effectorComponents.length > 0) {
    const err = getSlotError('effector', analysis.semanticCrops?.effector, 'Effector');
    if (err) {
      err.bbox = unionBBox(analysis.spatial.effectorComponents.map((c) => c.bbox));
      results.push(err);
    }
  }

  // 2. Directions
  const dirKeys = ['top', 'right', 'bottom', 'left'] as const;
  for (const d of dirKeys) {
    const crop = analysis.spatial?.directions?.[d];
    if (crop) {
      const title = d.charAt(0).toUpperCase() + d.slice(1) + ' Anchor';
      const err = getSlotError(d, analysis.semanticCrops?.[d], title);
      if (err) {
        err.bbox = crop.bbox;
        results.push(err);
      }
    }
  }

  // 3. Forms
  const formKeys = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;
  for (const f of formKeys) {
    const comps = analysis.spatial?.forms?.[f];
    if (comps && comps.length > 0) {
      const title = f.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      const err = getSlotError(f, analysis.semanticCrops?.[f], title);
      if (err) {
        err.bbox = unionBBox(comps.map((c) => c.bbox));
        results.push(err);
      }
    }
  }

  return results;
}

// ==========================================
// 3. In-Game Glyph Runtime Execution
// ==========================================

/**
 * Returns the cast direction for an active glyph instance.
 * Currently a passthrough to the transform direction.
 */
export function getCastDirection(instance: ActiveGlyphInstance): Direction {
  return instance.transform.direction;
}

/**
 * Place a glyph into the scene inventory in the 'placed' state.
 * Returns a new inventory (immutable).
 */
export function placeOrActivate(
  inventory: SceneGlyphInventory,
  glyphId: string,
  transform: Transform
): SceneGlyphInventory {
  const newInstance: ActiveGlyphInstance = {
    id: `inst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    glyphId,
    transform,
    state: 'placed',
  };

  return {
    ...inventory,
    instances: [...inventory.instances, newInstance],
  };
}

/**
 * Transition inventory to 'replay' mode and reset all instances.
 */
export function replay(inventory: SceneGlyphInventory): SceneGlyphInventory {
  return {
    mode: 'replay',
    instances: inventory.instances.map((inst) => ({
      ...inst,
      state: 'placed' as const,
    })),
  };
}

/**
 * Exit preview scene — transition back to 'edit' mode and clear active instances.
 */
export function exitPreviewScene(
  inventory: SceneGlyphInventory
): SceneGlyphInventory {
  return {
    mode: 'edit',
    instances: [],
  };
}

/**
 * Activate a placed instance — transition from 'placed' to 'activated'
 * with the given cast direction.
 * Returns a new instance (immutable).
 */
export function activate(
  instance: ActiveGlyphInstance,
  direction: Direction
): ActiveGlyphInstance {
  return {
    ...instance,
    state: 'activated',
    transform: {
      ...instance.transform,
      direction,
    },
  };
}
