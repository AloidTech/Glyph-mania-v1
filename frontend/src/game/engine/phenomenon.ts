import { GAME_TICK_CONFIG } from './tick_engine';
import { IPhenomenonBlueprint, CombatEntity } from '../../types/phenomenon_types';
import { CollisionSystem } from './collision_system';

export abstract class BasePhenomenon {
  public blueprint: IPhenomenonBlueprint;
  public currentPosition: { x: number; y: number; z: number };
  public movementState: IPhenomenonBlueprint['movement'];
  public elapsedTicks: number;
  public remainingLifetimeTicks: number;
  public penetrationRemaining: number;
  public isDestroyed: boolean;

  constructor(blueprint: IPhenomenonBlueprint, startPosition: { x: number; y: number; z: number }) {
    this.blueprint = blueprint;
    this.currentPosition = { ...startPosition };
    this.movementState = blueprint.movement;
    this.elapsedTicks = 0;
    this.remainingLifetimeTicks = blueprint.lifetimeTicks;
    this.penetrationRemaining = blueprint.shape.penetrationCount;
    this.isDestroyed = false;

    // Register with Collision System
    CollisionSystem.registerPhenomenon(this);
  }

  public tick(): void {
    if (this.isDestroyed) return;

    this.elapsedTicks++;
    this.remainingLifetimeTicks--;

    if (this.remainingLifetimeTicks <= 0) {
      this.dissipate();
      return;
    }

    this.updateMovement();
    this.onTickPeriodic();
  }

  protected abstract updateMovement(): void;
  protected abstract onTickPeriodic(): void;

  public handleEntityOverlap(target: CombatEntity): void {
    if (this.isDestroyed) return;

    // Apply base damage and attach status effects via CombatEntity
    target.takeDamage(this.blueprint.baseHitDamage, this.blueprint.visual.elementId);

    for (const payload of this.blueprint.statusPayloads) {
      target.attachStatusEffect(payload);
    }

    // Handle penetration
    if (this.penetrationRemaining > 0) {
      this.penetrationRemaining--;
    }
    if (this.penetrationRemaining === 0) {
      this.dissipate();
    }
  }

  public dissipate(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    CollisionSystem.unregisterPhenomenon(this);
    this.onDissipate();
  }

  protected onDissipate(): void {
    // Override for specific destruction logic (e.g., spawn particles)
  }
}

export class StationaryZonePhenomenon extends BasePhenomenon {
  protected updateMovement(): void {
    // Stationary, does not move
  }

  protected onTickPeriodic(): void {
    // Implement pulse logic / area of effect checks here
  }
}

export class ProjectilePhenomenon extends BasePhenomenon {
  protected updateMovement(): void {
    if (this.movementState.type === 'LINEAR_PROJECTILE') {
      const speedPerTick = this.movementState.speed * GAME_TICK_CONFIG.TICK_DELTA_SEC;
      const dir = this.movementState.directionVector;
      
      this.currentPosition.x += dir.x * speedPerTick;
      this.currentPosition.y += dir.y * speedPerTick;
      this.currentPosition.z += dir.z * speedPerTick;
    }
  }

  protected onTickPeriodic(): void {
    // Projectile specific tick logic if any
  }
}
