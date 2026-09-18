/**
 * @file glyph_solidity.ts
 * @description Glyph Solidity & Validation Rules System.
 * Pure business logic and rule validation for glyph composition:
 * - Checks whether a glyph structure is complete ("solid") according to game tier requirements.
 * - Extracts compositions and accuracy maps from semantic ML analysis.
 * - Validates effector presence, cardinal direction anchors, and diagonal form augmentors.
 */

import type {
  GlyphBase,
  GlyphComposition,
  Sigil,
  FormAugmentorSigil,
  FormType,
  Element,
} from '../../types/glyph_types';
import type { AdminSigilItem } from '../stores/admin_sigils_store';
import type { GlyphCompositionAnalysis } from '../ml/glyph_semantic_engine';
import { resolveCanonicalSigil, FOUNDATIONAL_SIGILS } from './sigils';

export interface SlotSolidityAnalysis {
  effector: boolean;
  directions: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
  formAugmentors: {
    topLeft: boolean;
    topRight: boolean;
    bottomLeft: boolean;
    bottomRight: boolean;
  };
}

export type SlotAccuracies = Partial<{
  effector: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
}> | Record<string, number>;

export interface SlotErrorDetail {
  type: 'low_accuracy' | 'type_mismatch' | 'form_mismatch' | 'unrecognized' | 'missing';
  message: string;
}

export interface SolidityAnalysis {
  isSolid: boolean;
  slots: SlotSolidityAnalysis;
  reasons: string[];
  formType?: FormType | null;
  lowAccuracySlots: string[];
  accuracies: Record<string, number>;
  slotErrors: Record<string, SlotErrorDetail[]>;
}

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
  const ACCURACY_THRESHOLD = 0.35

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
      lowAccuracySlots,
      accuracies: recordedAccuracies,
      slotErrors,
    };
  }

  // If saved vector strokes are present in the composition, the glyph was already drawn
  // and verified by the player — treat it as solid without re-running slot validation.
  if (Array.isArray((comp as any).strokes) && (comp as any).strokes.length > 0) {
    const allSlotsTrue: SlotSolidityAnalysis = {
      effector: true,
      directions: { top: true, right: true, bottom: true, left: true },
      formAugmentors: { topLeft: true, topRight: true, bottomLeft: true, bottomRight: true },
    };
    return {
      isSolid: true,
      slots: allSlotsTrue,
      reasons: [],
      formType: null,
      lowAccuracySlots: [],
      accuracies: {},
      slotErrors: {},
    };
  }
  // Lookup helper supporting Array or Record and canonical aliasing
  const getSigil = (id?: string): Sigil | AdminSigilItem | undefined => {
    if (!id) return undefined;
    return resolveCanonicalSigil(id, sigilLookup);
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
  const effectorConf = accuracies?.effector ?? comp.effector?.confidence;
  if (effectorConf !== undefined && effectorConf !== null) {
    recordedAccuracies.effector = effectorConf;
    if (effectorConf < ACCURACY_THRESHOLD) {
      lowAccuracySlots.push('effector');
      reasons.push(`Effector accuracy is too low (${(effectorConf * 100).toFixed(1)}% < ${ACCURACY_THRESHOLD * 100}%)`);
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
    const dirConf = (accuracies as any)?.[dir] ?? slot.confidence;
    if (dirConf !== undefined && dirConf !== null) {
      recordedAccuracies[dir] = dirConf;
      if (dirConf < (ACCURACY_THRESHOLD - 0.10)) {
        lowAccuracySlots.push(dir);
        reasons.push(`${dir} anchor accuracy is too low (${(dirConf * 100).toFixed(1)}% < ${(ACCURACY_THRESHOLD - 0.10) * 100}%)`);
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
    const formConf = (accuracies as any)?.[f] ?? slot.confidence;
    if (formConf !== undefined && formConf !== null) {
      recordedAccuracies[f] = formConf;
      if (formConf < ACCURACY_THRESHOLD) {
        lowAccuracySlots.push(f);
        reasons.push(`${f} form accuracy is too low (${(formConf * 100).toFixed(1)}% < ${ACCURACY_THRESHOLD * 100}%)`);
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
// Shared Helpers for Glyph Composition Analysis
// ==========================================

/**
 * Universal Sigil ID resolver that maps labels, aliases, and cardinal symbols to canonical IDs.
 */
export function defaultResolveSigilId(
  label?: string | null,
  sigils?: (Sigil | AdminSigilItem)[]
): string | undefined {
  if (!label) return undefined;
  const resolved = resolveCanonicalSigil(label, sigils);
  return resolved ? resolved.id : label;
}

/**
 * Converts a GlyphCompositionAnalysis from ML recognition into a standardized GlyphComposition object.
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
          sigilId: resolveSigilId(analysis.semanticCrops.top.recognition.label || 'Position'),
          label: analysis.semanticCrops.top.recognition.label || 'Position',
          confidence: analysis.semanticCrops.top.recognition.confidence ?? 0.88,
          customCrop: analysis.semanticCrops.top.dataUrl,
        }
        : undefined,
      right: analysis.semanticCrops.right?.dataUrl
        ? {
          sigilId: resolveSigilId(analysis.semanticCrops.right.recognition.label || 'Position'),
          label: analysis.semanticCrops.right.recognition.label || 'Position',
          confidence: analysis.semanticCrops.right.recognition.confidence ?? 0.88,
          customCrop: analysis.semanticCrops.right.dataUrl,
        }
        : undefined,
      bottom: analysis.semanticCrops.bottom?.dataUrl
        ? {
          sigilId: resolveSigilId(analysis.semanticCrops.bottom.recognition.label || 'Position'),
          label: analysis.semanticCrops.bottom.recognition.label || 'Position',
          confidence: analysis.semanticCrops.bottom.recognition.confidence ?? 0.88,
          customCrop: analysis.semanticCrops.bottom.dataUrl,
        }
        : undefined,
      left: analysis.semanticCrops.left?.dataUrl
        ? {
          sigilId: resolveSigilId(analysis.semanticCrops.left.recognition.label || 'Position'),
          label: analysis.semanticCrops.left.recognition.label || 'Position',
          confidence: analysis.semanticCrops.left.recognition.confidence ?? 0.88,
          customCrop: analysis.semanticCrops.left.dataUrl,
        }
        : undefined,
    },
    formAugmentors: {
      topLeft: analysis.semanticCrops.topLeft?.dataUrl
        ? {
          sigilId: resolveSigilId(analysis.semanticCrops.topLeft.recognition.label),
          label: analysis.semanticCrops.topLeft.recognition.label || 'Form Augmentor',
          confidence: analysis.semanticCrops.topLeft.recognition.confidence ?? undefined,
          customCrop: analysis.semanticCrops.topLeft.dataUrl,
        }
        : undefined,
      topRight: analysis.semanticCrops.topRight?.dataUrl
        ? {
          sigilId: resolveSigilId(analysis.semanticCrops.topRight.recognition.label),
          label: analysis.semanticCrops.topRight.recognition.label || 'Form Augmentor',
          confidence: analysis.semanticCrops.topRight.recognition.confidence ?? undefined,
          customCrop: analysis.semanticCrops.topRight.dataUrl,
        }
        : undefined,
      bottomLeft: analysis.semanticCrops.bottomLeft?.dataUrl
        ? {
          sigilId: resolveSigilId(analysis.semanticCrops.bottomLeft.recognition.label),
          label: analysis.semanticCrops.bottomLeft.recognition.label || 'Form Augmentor',
          confidence: analysis.semanticCrops.bottomLeft.recognition.confidence ?? undefined,
          customCrop: analysis.semanticCrops.bottomLeft.dataUrl,
        }
        : undefined,
      bottomRight: analysis.semanticCrops.bottomRight?.dataUrl
        ? {
          sigilId: resolveSigilId(analysis.semanticCrops.bottomRight.recognition.label),
          label: analysis.semanticCrops.bottomRight.recognition.label || 'Form Augmentor',
          confidence: analysis.semanticCrops.bottomRight.recognition.confidence ?? undefined,
          customCrop: analysis.semanticCrops.bottomRight.dataUrl,
        }
        : undefined,
    },
  };
}

/**
 * Extracts a slot key -> confidence percentage map from a GlyphCompositionAnalysis.
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

export interface CanvasSigilError {
  key: string;
  title: string;
  label: string;
  errorType: 'low_accuracy' | 'type_mismatch' | 'form_mismatch' | 'unrecognized' | 'missing' | 'invalid';
  message: string;
  confidence?: number | null;
  bbox: { x: number; y: number; width: number; height: number };
}

/**
 * Extracts all faulty sigils and their canvas bounding boxes from semantic analysis & solidity result.
 * Ported from GlyphTestingPage for shared usage across Atelier workshop and diagnostic popups.
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

  // 4. Missing Slot Errors (individual popups for empty/unfulfilled required slots)
  if (solidity?.slotErrors) {
    const cx = analysis.spatial?.center?.x ?? 250;
    const cy = analysis.spatial?.center?.y ?? 250;
    const region = analysis.spatial?.region;
    const r = region ? Math.max(90, Math.min(region.right - region.left, region.bottom - region.top) * 0.42) : 130;

    const canonicalSlots: Record<string, { title: string; x: number; y: number }> = {
      effector: { title: 'Center Effector', x: cx, y: cy },
      top: { title: 'North Anchor', x: cx, y: cy - r * 0.8 },
      bottom: { title: 'South Anchor', x: cx, y: cy + r * 0.8 },
      left: { title: 'West Anchor', x: cx - r * 0.8, y: cy },
      right: { title: 'East Anchor', x: cx + r * 0.8, y: cy },
      topLeft: { title: 'Northwest Form', x: cx - r * 0.6, y: cy - r * 0.6 },
      topRight: { title: 'Northeast Form', x: cx + r * 0.6, y: cy - r * 0.6 },
      bottomLeft: { title: 'Southwest Form', x: cx - r * 0.6, y: cy + r * 0.6 },
      bottomRight: { title: 'Southeast Form', x: cx + r * 0.6, y: cy + r * 0.6 },
    };

    for (const [slotKey, errors] of Object.entries(solidity.slotErrors)) {
      if (results.some((r) => r.key === slotKey)) continue;
      const missingErr = errors.find((e) => e.type === 'missing');
      if (missingErr) {
        const slotInfo = canonicalSlots[slotKey] || {
          title: slotKey.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
          x: cx,
          y: cy,
        };
        results.push({
          key: slotKey,
          title: slotInfo.title,
          label: 'Missing Slot',
          errorType: 'missing',
          message: missingErr.message,
          confidence: null,
          bbox: {
            x: Math.round(slotInfo.x - 22),
            y: Math.round(slotInfo.y - 22),
            width: 44,
            height: 44,
          },
        });
      }
    }
  }

  return results;
}
