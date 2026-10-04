/**
 * @file glyph_activation.ts
 * @description Glyph Activation Engine.
 * Single source of truth for spell resolution, execution, and casting physics.
 * Determines spell type (currently ElementalBallSpell for all elements),
 * calculates firing trajectories based on activation state (placed vs held),
 * and configures floor collisions, particle trails, and impact effects.
 */

import Phaser from 'phaser';
import type { Element, GlyphComposition, WorkshopGlyphItem } from '../../types/glyph_types';
import type {
  EffectorData,
  FormSigilData,
  PositionSigilData,
  StatusEffectPayload,
} from '../../types/phenomenon_types';
import { PhenomenonAssembler } from './phenomenon_assembler';
import type { BasePhenomenon } from './phenomenon';
import { ElementalBallSpell } from '../entities/ElementalBallSpell';

export type ActivationState = 'placed' | 'held';
export type CardinalDirection = 'north' | 'south' | 'east' | 'west';

/**
 * Calculates the cardinal direction a placed glyph faces.
 * A placed glyph ALWAYS faces opposite (away from) the surface it was placed on:
 * - ground / floor (bottom) -> faces away (up)    -> 'north'
 * - ceiling (top)           -> faces away (down)  -> 'south'
 * - wall_left (left side)   -> faces away (right) -> 'east'
 * - wall_right (right side) -> faces away (left)  -> 'west'
 */
export function getPlacedFacingDirection(surface?: string): CardinalDirection {
  switch (surface?.toLowerCase()) {
    case 'ground':
    case 'floor':
    case 'bottom':
      return 'north';
    case 'ceiling':
    case 'top':
    case 'roof':
      return 'south';
    case 'wall_left':
    case 'left_wall':
    case 'left':
      return 'east';
    case 'wall_right':
    case 'right_wall':
    case 'right':
      return 'west';
    default:
      // Default ground surface faces north (upwards away from ground)
      return 'north';
  }
}

export interface InEngineGameplayGlyph {
  uuid?: string;
  glyphId?: string;
  glyphName?: string;
  element?: string;
  tier?: number;
  color?: number;
  composition?: Record<string, any>;
  surface?: string;
  state?: 'held' | 'placed';
  x?: number;
  y?: number;
  facingDirection?: CardinalDirection;
  glyphData?: WorkshopGlyphItem;
}

export interface BaseActivationParams {
  scene: Phaser.Scene & { floorGroup?: Phaser.Physics.Arcade.StaticGroup; dummy?: any };
  glyph: WorkshopGlyphItem | InEngineGameplayGlyph | any;
  targets?: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[] | Phaser.Physics.Arcade.Group | any;
}

export interface PlacedActivationParams extends BaseActivationParams {
  state: 'placed';
  origin: { x: number; y: number };
  direction: CardinalDirection;
}

export interface HeldActivationParams extends BaseActivationParams {
  state: 'held';
  origin: { x: number; y: number };
  target: { x: number; y: number };
}

export type ActivationParams = PlacedActivationParams | HeldActivationParams;

export interface ActivationResult {
  success: boolean;
  element: string;
  spellType: string;
  spellObject?: ElementalBallSpell;
  phenomenon?: BasePhenomenon;
  state: ActivationState;
}

import { useElementsStore } from '../../lib/stores/elements_store';

export const ELEMENTAL_COLORS: Record<string, number> = {
  Fire: 0xef4444,
  Water: 0x0077be, // All Ocean Blue
  Earth: 0x784421, // Earth Brown
  Air: 0xd8efff,   // Blue close to white
};

/**
 * Resolves standard elemental type string and numeric color hex from glyph metadata
 */
export function resolveGlyphElement(glyph: WorkshopGlyphItem | InEngineGameplayGlyph): { element: Element; color: number } {
  const rawElement = glyph.element ?? '';
  const element = (typeof rawElement === 'string' ? rawElement.toLowerCase() : '') as Element;

  let color = ELEMENTAL_COLORS.Fire;

  if (element === 'fire') {
    color = ELEMENTAL_COLORS.Fire;
  } else if (element === 'water') {
    color = ELEMENTAL_COLORS.Water;
  } else if (element === 'earth') {
    color = ELEMENTAL_COLORS.Earth;
  } else if (element === 'air') {
    color = ELEMENTAL_COLORS.Air;
  }

  // Dynamically override from elements store if present in database
  const storedElement = useElementsStore.getState().getElementById(element.toUpperCase());
  if (storedElement?.primaryColor) {
    const parsed = parseInt(storedElement.primaryColor.replace('#', ''), 16);
    if (!isNaN(parsed)) {
      color = parsed;
    }
  }

  return { element, color };
}

/**
 * Assembles a concrete BasePhenomenon from the glyph composition, element, and aim trajectory.
 */
export function assemblePhenomenonFromGlyph(
  glyph: WorkshopGlyphItem | InEngineGameplayGlyph,
  origin: { x: number; y: number },
  directionVector: { x: number; y: number },
  element: Element,
  color: number
): BasePhenomenon {
  const composition = ('composition' in glyph) ? glyph.composition as GlyphComposition | undefined : undefined;
  const hexColor = '#' + color.toString(16).padStart(6, '0');

  // 1. Determine elemental status payloads
  let statusPayloads: StatusEffectPayload[] = [];
  const baseHitDamage = 28 + ((glyph.tier ?? 1) * 6);

  if (element === 'fire') {
    statusPayloads = [{ effectType: 'BURNING', tickDamage: 8, intervalTicks: 10, durationTicks: 40 }];
  } else if (element === 'water') {
    statusPayloads = [{ effectType: 'SLOW', tickDamage: 0, intervalTicks: 10, durationTicks: 50, magnitude: 0.5 }];
  } else if (element === 'earth') {
    statusPayloads = [{ effectType: 'MELT_ARMOR', tickDamage: 0, intervalTicks: 10, durationTicks: 60, magnitude: 5 }];
  } else if (element === 'air') {
    statusPayloads = [{ effectType: 'VULNERABLE', tickDamage: 4, intervalTicks: 10, durationTicks: 30 }];
  } else {
    statusPayloads = [{ effectType: 'BURNING', tickDamage: 6, intervalTicks: 10, durationTicks: 30 }];
  }

  // 2. Build EffectorData
  const effector: EffectorData = {
    sigilId: composition?.effector?.sigilId ?? `eff-${element}`,
    label: composition?.effector?.label ?? `${element.toUpperCase()} Burst`,
    elementId: element,
    baseHitDamage,
    statusPayloads,
    elementVisualData: {
      elementId: element,
      primaryColor: hexColor,
      secondaryColor: '#ffffff',
      particleVfxKey: 'side_torch',
    },
  };

  // 3. Build FormSigilData
  const form: FormSigilData = {
    sigilId: 'form-sphere',
    label: 'Orb Form',
    shapeType: 'SPHERE',
    radiusMeters: 1.2,
    penetrationCount: 1,
    hitDamageMultiplier: 1.0,
    tickDamageMultiplier: 1.0,
    intervalMultiplier: 1.0,
    durationMultiplier: 1.0,
    baseLifetimeSeconds: 3.5,
  };

  // 4. Build PositionSigilData
  const position: PositionSigilData = {
    sigilId: 'pos-projectile',
    label: 'Linear Projectile',
    behaviorType: 'LINEAR_PROJECTILE',
    projectileSpeed: 14,
  };

  // 5. Assemble Phenomenon via PhenomenonAssembler
  return PhenomenonAssembler.assemble(
    effector,
    form,
    position,
    { x: origin.x, y: origin.y, z: 0 },
    { x: directionVector.x, y: directionVector.y, z: 0 }
  );
}

/**
 * Executes the full activation pipeline for a glyph.
 * Determines the spell to cast (currently ElementalBallSpell) and fires according
 * to activation state:
 * - 'placed': Fired toward placement facing direction (away from placement surface)
 * - 'held': Fired directly toward the provided scene target (mouse pointer)
 */
export function executeGlyphActivation(params: ActivationParams): ActivationResult {
  const { scene, state } = params;

  // Extract the inner WorkshopGlyphItem if wrapped in an InEngineGameplayGlyph
  const rawGlyph = params.glyph;
  const glyph: WorkshopGlyphItem | InEngineGameplayGlyph =
    ('glyphData' in rawGlyph && rawGlyph.glyphData) ? rawGlyph.glyphData : rawGlyph;

  // DEBUG: Log glyph activation details
  console.log('🔍 Glyph Activation:', {
    element: glyph.element,
    state,
    origin: params.origin,
    target: 'target' in params ? params.target : undefined,
    direction: 'direction' in params ? params.direction : undefined,
    id: ('glyphId' in glyph ? glyph.glyphId : undefined) ?? ('id' in glyph ? glyph.id : null),
  });

  const { element, color } = resolveGlyphElement(glyph);

  // For now, the activation engine always resolves to the elemental ball spell
  const spellType = 'elemental_ball';
  const speed = 700;

  let spawnX = params.origin.x;
  let spawnY = params.origin.y;
  let vx = 0;
  let vy = 0;

  if (state === 'placed') {
    // 1. Placed Activation: Fired opposite (away from) the placement surface
    const facingDir: CardinalDirection = params.direction || 'north';

    // Calculate spawn offset and velocity based on cardinal direction away from surface
    switch (facingDir) {
      case 'north': // Facing away from ground/floor (upwards)
        spawnY -= 22;
        vx = 0;
        vy = -speed;
        break;
      case 'south': // Facing away from ceiling (downwards)
        spawnY += 22;
        vx = 0;
        vy = speed;
        break;
      case 'east': // Facing away from left wall (rightwards)
        spawnX += 28;
        spawnY -= 12;
        vx = speed;
        vy = -60;
        break;
      case 'west': // Facing away from right wall (leftwards)
        spawnX -= 28;
        spawnY -= 12;
        vx = -speed;
        vy = -60;
        break;
      default:
        spawnY -= 22;
        vx = 0;
        vy = -speed;
        break;
    }

    // Ground activation burst ring at the placed glyph location
    spawnGroundActivationRing(scene, params.origin.x, params.origin.y, color);
  } else {
    // 2. Held Activation: Fired directly toward the provided target (mouse world pos)
    const dx = params.target.x - spawnX;
    const dy = params.target.y - spawnY;
    const angle = Math.atan2(dy, dx);

    vx = Math.cos(angle) * speed;
    vy = Math.sin(angle) * speed;

    // Small cast flash at hand/origin position
    spawnCastFlash(scene, spawnX, spawnY, color);
  }

  // 3. Normalize firing direction vector and assemble phenomenon
  const mag = Math.hypot(vx, vy) || 1;
  const dirVec = { x: vx / mag, y: vy / mag };
  const phenomenon = assemblePhenomenonFromGlyph(glyph, { x: spawnX, y: spawnY }, dirVec, element, color);

  // 4. Resolve combat targets (from params, or scene dummy/targets)
  const targets = params.targets ?? (scene as any).dummy ?? (scene as any).combatTargets;

  // 5. Summon dedicated ElementalBallSpell object wired with phenomenon and target collision
  const spellObject = new ElementalBallSpell(scene, {
    x: spawnX,
    y: spawnY,
    element,
    color,
    vx,
    vy,
    floorGroup: scene.floorGroup,
    targets,
    phenomenon,
    lifespan: 2500,
  });

  // 6. Subtle camera kick
  if (scene.cameras?.main) {
    scene.cameras.main.shake(140, 0.0035);
  }

  // 7. Global event dispatch for UI / Audio / HUD
  const glyphId = ('uuid' in glyph ? glyph.uuid : undefined) ?? ('id' in glyph ? glyph.id : undefined);
  const glyphName = ('name' in glyph ? glyph.name : undefined) ?? ('glyphName' in glyph ? glyph.glyphName : undefined);

  window.dispatchEvent(
    new CustomEvent('glyph-activated', {
      detail: {
        uuid: glyphId,
        glyphName,
        element,
        state,
        spellType,
        x: spawnX,
        y: spawnY,
      },
    })
  );

  return {
    success: true,
    element,
    spellType,
    spellObject,
    phenomenon,
    state,
  };
}

// ================= Ground & Cast Visuals =================

function spawnGroundActivationRing(scene: Phaser.Scene, x: number, y: number, color: number): void {
  const ring = scene.add.ellipse(x, y - 4, 48, 18);
  ring.setStrokeStyle(3, color, 0.95);
  ring.setDepth(15);

  scene.tweens.add({
    targets: ring,
    scaleX: 2.8,
    scaleY: 2.4,
    alpha: 0,
    duration: 380,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });
}

function spawnCastFlash(scene: Phaser.Scene, x: number, y: number, color: number): void {
  const flash = scene.add.circle(x, y, 16, color, 0.85);
  flash.setBlendMode(Phaser.BlendModes.ADD);
  flash.setDepth(22);

  scene.tweens.add({
    targets: flash,
    scaleX: 2.0,
    scaleY: 2.0,
    alpha: 0,
    duration: 200,
    ease: 'Quad.easeOut',
    onComplete: () => flash.destroy(),
  });
}
