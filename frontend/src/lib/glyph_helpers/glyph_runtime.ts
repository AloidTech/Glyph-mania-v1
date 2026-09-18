/**
 * @file glyph_runtime.ts
 * @description In-Game Glyph Runtime & Scene Inventory Execution.
 * Manages active placed/activated glyph instances during gameplay preview, replay,
 * and execution modes in Phaser scenes.
 */

import type {
  ActiveGlyphInstance,
  SceneGlyphInventory,
  Transform,
  Direction,
} from '../../types/glyph_types';

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
export function exitPreviewScene(inventory: SceneGlyphInventory): SceneGlyphInventory {
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
