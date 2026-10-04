/**
 * @file status_effect_manager.ts
 * @description Manages discrete 10Hz status effect ticking, DoT execution,
 * effect lifespan management, and deterministic recalculation of entity stats.
 */

import type { CombatEntity, StatusEffectPayload, ActiveStatusEffect } from '../../types/phenomenon_types';
import { DamageEngine } from './damage_engine';

export class StatusEffectManager {
  /**
   * Attaches a status effect payload to a combat entity.
   */
  public static attachEffect(entity: CombatEntity, payload: StatusEffectPayload): void {
    if (entity.stats.isDead) return;

    const existingIndex = entity.stats.activeEffects.findIndex(
      (e) => e.effectType === payload.effectType
    );

    if (existingIndex >= 0) {
      // Refresh duration and update magnitude/damage
      entity.stats.activeEffects[existingIndex].remainingTicks = payload.durationTicks;
      entity.stats.activeEffects[existingIndex].tickDamage = payload.tickDamage;
      entity.stats.activeEffects[existingIndex].intervalTicks = payload.intervalTicks;
      entity.stats.activeEffects[existingIndex].magnitude = payload.magnitude;
    } else {
      // Add new active effect
      const newActive: ActiveStatusEffect = {
        effectType: payload.effectType,
        tickDamage: payload.tickDamage,
        intervalTicks: payload.intervalTicks,
        durationTicks: payload.durationTicks,
        magnitude: payload.magnitude,
        remainingTicks: payload.durationTicks,
        ticksSinceLastTrigger: 0,
      };
      entity.stats.activeEffects.push(newActive);
    }

    this.recalculateStats(entity);
  }

  /**
   * Ticks all active status effects on an entity (runs at 10Hz / 100ms per tick).
   */
  public static tickEntityEffects(entity: CombatEntity): void {
    if (entity.stats.isDead || entity.stats.activeEffects.length === 0) {
      // Natural Poise recovery when not taking effects
      if (entity.stats.currentPoise < entity.stats.maxPoise && !entity.stats.isStaggered) {
        entity.stats.currentPoise = Math.min(
          entity.stats.maxPoise,
          entity.stats.currentPoise + entity.stats.maxPoise * 0.05
        );
      }
      return;
    }

    let statsChanged = false;

    for (let i = entity.stats.activeEffects.length - 1; i >= 0; i--) {
      const effect = entity.stats.activeEffects[i];
      effect.remainingTicks--;
      effect.ticksSinceLastTrigger++;

      // Periodic DoT trigger
      if (effect.ticksSinceLastTrigger >= effect.intervalTicks) {
        effect.ticksSinceLastTrigger = 0;
        if (effect.tickDamage > 0) {
          DamageEngine.processPeriodicDamage(entity, effect.tickDamage, effect.effectType);
        }
      }

      // Expired effect removal
      if (effect.remainingTicks <= 0) {
        entity.stats.activeEffects.splice(i, 1);
        statsChanged = true;
      }
    }

    if (statsChanged) {
      this.recalculateStats(entity);
    }
  }

  /**
   * Recalculates effective stats deterministically from base stats + active STAT_MOD payloads.
   */
  public static recalculateStats(entity: CombatEntity): void {
    let speedMult = 1.0;
    let flatArmorMod = 0;
    let armorMult = 1.0;

    for (const eff of entity.stats.activeEffects) {
      const mag = eff.magnitude ?? 0;

      switch (eff.effectType) {
        case 'SLOW':
        case 'CHILL':
        case 'VORTEX_PULL':
        case 'KNOCKBACK':
          // mag is negative (e.g. -0.35)
          speedMult *= Math.max(0, 1.0 + mag);
          break;

        case 'FREEZE':
        case 'FREEZE_LOCK':
        case 'PETRIFY':
        case 'PETRIFY_LOCK':
          // 100% slow / immobilize
          speedMult = 0;
          break;

        case 'HASTE':
          // Positive speed multiplier (e.g. +0.30)
          speedMult *= 1.0 + Math.max(0, mag);
          break;

        case 'MELT_ARMOR':
        case 'DRENCH':
          // Percent armor shred (e.g. -0.25)
          armorMult *= Math.max(0, 1.0 + mag);
          break;

        case 'CRUSH_ARMOR':
          // Flat armor reduction (e.g. -20)
          flatArmorMod += mag;
          break;

        case 'FORTIFY':
          // Flat bonus armor (e.g. +30)
          flatArmorMod += mag;
          break;

        default:
          break;
      }
    }

    entity.stats.speedMultiplier = Math.max(0, speedMult);
    entity.stats.effectiveSpeed = entity.stats.baseSpeed * entity.stats.speedMultiplier;
    entity.stats.effectiveArmor = Math.max(0, Math.round((entity.stats.armor + flatArmorMod) * armorMult));
  }
}
