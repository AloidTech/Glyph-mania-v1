/**
 * @file collision_system.ts
 * @description Centralized spatial collision manager.
 * Detects geometric overlaps between active Phenomena and registered CombatEntities,
 * enforces per-entity hit cooldowns (preventing multi-hit frame bugs),
 * manages projectile penetration counts, and routes hits to the DamageEngine.
 */

import type { CombatEntity } from '../../types/phenomenon_types';
import { BasePhenomenon } from './phenomenon';
import { DamageEngine } from './damage_engine';

interface HitRecord {
  entity: CombatEntity;
  lastHitTick: number;
}

export class CollisionSystem {
  private static entities: CombatEntity[] = [];
  private static phenomena: BasePhenomenon[] = [];
  private static hitHistory: Map<string, HitRecord[]> = new Map(); // phenomenonId -> HitRecord[]

  public static registerEntity(entity: CombatEntity): void {
    if (!this.entities.includes(entity)) {
      this.entities.push(entity);
    }
  }

  public static unregisterEntity(entity: CombatEntity): void {
    this.entities = this.entities.filter((e) => e !== entity);
  }

  public static registerPhenomenon(phenomenon: BasePhenomenon): void {
    if (!this.phenomena.includes(phenomenon)) {
      this.phenomena.push(phenomenon);
    }
  }

  public static unregisterPhenomenon(phenomenon: BasePhenomenon): void {
    this.phenomena = this.phenomena.filter((p) => p !== phenomenon);
  }

  public static clear(): void {
    this.entities = [];
    this.phenomena = [];
    this.hitHistory.clear();
  }

  /**
   * Evaluates spatial circle-circle intersections between all active phenomena and combat entities.
   * Called on every game update / tick.
   */
  public static updateCollisions(currentTick: number): void {
    // Purge destroyed phenomena
    this.phenomena = this.phenomena.filter((p) => !p.isDestroyed);

    for (const pheno of this.phenomena) {
      if (pheno.isDestroyed) continue;

      const phenoId = `${pheno.blueprint.name}_${pheno.elapsedTicks}`;
      let records = this.hitHistory.get(phenoId);
      if (!records) {
        records = [];
        this.hitHistory.set(phenoId, records);
      }

      for (const entity of this.entities) {
        if (entity.stats.isDead) continue;

        // Check if on hit cooldown for this specific phenomenon
        const hitRec = records.find((r) => r.entity === entity);
        const cooldownTicks = pheno.movementState.type === 'STATIONARY' ? 5 : 999; // Projectiles hit once; zones pulse every 0.5s

        if (hitRec && currentTick - hitRec.lastHitTick < cooldownTicks) {
          continue;
        }

        // Distance check in isometric Tile Units
        const dx = pheno.currentPosition.x - entity.isoX;
        const dy = pheno.currentPosition.y - entity.isoY;
        const distSq = dx * dx + dy * dy;
        const hitRadius = (pheno.blueprint.shape.radius || 1.0) + (entity.radius || 0.3);

        if (distSq <= hitRadius * hitRadius) {
          // Record hit
          if (hitRec) {
            hitRec.lastHitTick = currentTick;
          } else {
            records.push({ entity, lastHitTick: currentTick });
          }

          // Process Hit via DamageEngine
          DamageEngine.processHit(
            entity,
            pheno.blueprint.baseHitDamage,
            pheno.blueprint.visual.elementId,
            pheno.blueprint.statusPayloads
          );

          // Handle Penetration
          if (pheno.penetrationRemaining > 0) {
            pheno.penetrationRemaining--;
            if (pheno.penetrationRemaining === 0) {
              pheno.dissipate();
              break;
            }
          }
        }
      }
    }
  }
}
