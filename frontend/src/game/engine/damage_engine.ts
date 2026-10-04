/**
 * @file damage_engine.ts
 * @description Single source of truth for damage calculations, armor mitigation,
 * invincibility checks, poise damage, stagger triggers, and floating combat text.
 */

import type { CombatEntity, DamageResult, StatusEffectPayload } from '../../types/phenomenon_types';
import { StatusEffectManager } from './status_effect_manager';

export interface CombatTextEvent {
  x: number;
  y: number;
  text: string;
  color: number;
}

export type CombatTextListener = (event: CombatTextEvent) => void;

export class DamageEngine {
  private static listeners: CombatTextListener[] = [];

  public static onCombatText(listener: CombatTextListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public static emitCombatText(entity: CombatEntity, text: string, color: number = 0xffffff): void {
    const x = entity.isoX ?? (entity as any).x ?? 0;
    const y = entity.isoY ?? (entity as any).y ?? 0;
    const event: CombatTextEvent = {
      x,
      y,
      text,
      color,
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[DamageEngine] CombatText listener error:', err);
      }
    }
  }

  /**
   * Processes a direct hit on a combat entity from a phenomenon or direct attack.
   */
  public static processHit(
    target: CombatEntity,
    rawDamage: number,
    elementId?: string,
    statusPayloads?: StatusEffectPayload[]
  ): DamageResult {
    // 1. Invincibility Check (e.g. Training Dummy)
    if (target.stats.isInvincible) {
      this.emitCombatText(target, 'IMMUNE', 0xf59e0b);
      target.flashOnHit?.(0xf59e0b);

      // Still attach status effects if any (for testing & visuals)
      if (statusPayloads && statusPayloads.length > 0) {
        for (const payload of statusPayloads) {
          StatusEffectManager.attachEffect(target, payload);
        }
      }

      return {
        damageDealt: 0,
        isImmune: true,
        isDead: false,
        poiseBroken: false,
      };
    }

    if (target.stats.isDead) {
      return {
        damageDealt: 0,
        isImmune: false,
        isDead: true,
        poiseBroken: false,
      };
    }

    // 2. Armor & Defense Mitigation
    const effectiveArmor = Math.max(0, target.stats.effectiveArmor);
    const postArmorDamage = Math.max(1, Math.round(rawDamage - effectiveArmor));

    // 3. Apply Damage to HP
    target.stats.currentHp = Math.max(0, target.stats.currentHp - postArmorDamage);

    // 4. Poise Damage & Stagger Check
    const poiseDamage = Math.max(5, Math.round(rawDamage * 0.4));
    let poiseBroken = false;

    if (!target.stats.isStaggered && target.stats.maxPoise > 0) {
      target.stats.currentPoise = Math.max(0, target.stats.currentPoise - poiseDamage);
      if (target.stats.currentPoise <= 0) {
        target.stats.isStaggered = true;
        poiseBroken = true;
        this.emitCombatText(target, 'STAGGERED!', 0xfbbf24);
        target.onStagger?.();
      }
    }

    // 5. Visual Feedback & Floating Numbers
    this.emitCombatText(target, `-${postArmorDamage}`, 0xef4444);
    target.flashOnHit?.(0xef4444);

    // 6. Attach Status Effect Payloads
    if (statusPayloads && statusPayloads.length > 0) {
      for (const payload of statusPayloads) {
        StatusEffectManager.attachEffect(target, payload);
      }
    }

    // 7. Death Check
    const isDead = target.stats.currentHp <= 0;
    if (isDead && !target.stats.isDead) {
      target.stats.isDead = true;
      this.emitCombatText(target, 'DEFEATED', 0x991b1b);
      target.onDeath?.();
    }

    return {
      damageDealt: postArmorDamage,
      isImmune: false,
      isDead,
      poiseBroken,
    };
  }

  /**
   * Processes periodic DoT tick damage (bypasses poise damage).
   */
  public static processPeriodicDamage(
    target: CombatEntity,
    tickDamage: number,
    effectType: string
  ): void {
    if (target.stats.isInvincible) {
      this.emitCombatText(target, 'IMMUNE', 0xf59e0b);
      return;
    }

    if (target.stats.isDead) return;

    const damage = Math.max(1, Math.round(tickDamage));
    target.stats.currentHp = Math.max(0, target.stats.currentHp - damage);

    this.emitCombatText(target, `-${damage}`, 0xf97316); // Orange for DoT
    target.flashOnHit?.(0xf97316);

    if (target.stats.currentHp <= 0 && !target.stats.isDead) {
      target.stats.isDead = true;
      this.emitCombatText(target, 'DEFEATED', 0x991b1b);
      target.onDeath?.();
    }
  }
}
