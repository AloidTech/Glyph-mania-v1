export type EffectCategory = 'DOT' | 'STAT_MOD';
export type StatTarget = 'SPEED' | 'ARMOR' | 'POISE' | 'HEALTH_MAX';
export type ModifierType = 'FLAT' | 'PERCENT_MULT';

export interface EffectDefinition {
  id: string;                      // e.g. 'BURNING', 'SLOW', 'MELT_ARMOR'
  label: string;                   // 'Burning', 'Slow'
  category: EffectCategory;        // 'DOT' | 'STAT_MOD'
  targetStat?: StatTarget | null;
  modifierType?: ModifierType | null;
  defaultMagnitude?: number | null;
  baseTickDamage?: number | null;
  defaultIntervalTicks: number;
  defaultDurationTicks: number;
  description?: string;
  createdAt?: string;
}

export interface ElementVisualData {
  elementId: string;
  primaryColor: string;
  secondaryColor: string;
  particleVfxKey: string;
}

export interface StatusEffectPayload {
  effectType: string;
  tickDamage: number;
  intervalTicks: number;
  durationTicks: number;
  magnitude?: number | null;
}

export interface ActiveStatusEffect extends StatusEffectPayload {
  remainingTicks: number;
  ticksSinceLastTrigger: number;
}

export interface EntityStats {
  // Health
  currentHp: number;
  maxHp: number;

  // Poise / Stability
  currentPoise: number;
  maxPoise: number;
  isStaggered: boolean;

  // Armor & Speed
  armor: number;                   // Base flat armor
  effectiveArmor: number;          // Computed after STAT_MOD effects
  baseSpeed: number;               // Tile units per ms
  effectiveSpeed: number;          // Computed after STAT_MOD effects
  speedMultiplier: number;         // Multiplier from STAT_MOD effects (1.0 = 100%)

  // Special State Booleans
  isInvincible: boolean;           // Takes 0 damage / immune
  isInvisible: boolean;            // Alpha rendering / untargetable
  isDead: boolean;

  // Active status effects payload buffer
  activeEffects: ActiveStatusEffect[];
}

export interface DamageResult {
  damageDealt: number;
  isImmune: boolean;
  isDead: boolean;
  poiseBroken: boolean;
}

export interface CombatEntity {
  isoX: number;
  isoY: number;
  radius: number;
  stats: EntityStats;
  takeDamage(amount: number, elementId?: string): DamageResult;
  attachStatusEffect(payload: StatusEffectPayload): void;
  flashOnHit?(color?: number): void;
  onStagger?(): void;
  onDeath?(): void;
}

export interface MovementStateStationary {
  type: 'STATIONARY';
  anchorPoint: { x: number; y: number; z: number };
}

export interface MovementStateLinearProjectile {
  type: 'LINEAR_PROJECTILE';
  speed: number;
  directionVector: { x: number; y: number; z: number };
}

export type MovementState = MovementStateStationary | MovementStateLinearProjectile;

export interface ShapeConfiguration {
  shapeType: 'SPHERE' | 'RING_VORTEX' | 'LANCE_RAY';
  radius: number;
  penetrationCount: number;
}

export interface IPhenomenonBlueprint {
  name: string;
  movement: MovementState;
  shape: ShapeConfiguration;
  baseHitDamage: number;
  statusPayloads: StatusEffectPayload[];
  visual: ElementVisualData;
  lifetimeTicks: number;
}

export interface EffectorData {
  sigilId: string;
  label: string;
  elementId: string;
  baseHitDamage: number;
  statusPayloads: StatusEffectPayload[];
  elementVisualData: ElementVisualData;
}

export interface FormSigilData {
  sigilId: string;
  label: string;
  shapeType: 'SPHERE' | 'RING_VORTEX' | 'LANCE_RAY';
  radiusMeters: number;
  penetrationCount: number;
  hitDamageMultiplier?: number;
  tickDamageMultiplier?: number;
  intervalMultiplier?: number;
  durationMultiplier?: number;
  baseLifetimeSeconds?: number;
}

export interface PositionSigilData {
  sigilId: string;
  label: string;
  behaviorType: 'STATIONARY' | 'LINEAR_PROJECTILE';
  projectileSpeed?: number;
}

export type SigilType = 'effector' | 'form' | 'position';
