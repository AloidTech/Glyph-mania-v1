import type {
  GlyphBase,
  Sigil,
  FormAugmentorSigil,
  ActiveGlyphInstance,
  SceneGlyphInventory,
  Transform,
  Direction,
  FormType,
} from './types/glyph_types';

// ===== Pure Business Logic =====

/**
 * A glyph is "solid" when:
 *  1. All 4 cardinal position slots are filled.
 *  2. All 4 diagonal form slots are filled with one uniform FormType.
 */
export function isSolid(
  glyph: GlyphBase,
  sigilLookup: Record<string, Sigil>
): boolean {
  // Check all position slots filled
  const positionsFilled = glyph.positionSlots.every((id) => id !== null);
  if (!positionsFilled) return false;

  // Check all form slots filled
  const formIds = glyph.formSlots;
  if (!formIds.every((id) => id !== null)) return false;

  // Check uniform form type
  const formTypes = formIds.map((id) => {
    const sigil = sigilLookup[id!];
    if (!sigil || sigil.type !== 'augmentor') return null;
    if (sigil.augmentorType !== 'form') return null;
    return (sigil as FormAugmentorSigil).formType;
  });

  const firstForm = formTypes[0];
  if (firstForm === null) return false;

  return formTypes.every((ft): ft is FormType => ft === firstForm);
}

/**
 * Returns the cast direction for an active glyph instance.
 * Currently a passthrough to the transform direction.
 * (Position augmentors have no directional offset yet.)
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
