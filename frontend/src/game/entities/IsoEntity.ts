/**
 * @file IsoEntity.ts
 * @description Base class for all isometric entities in the game (Player, Enemies, Dummies, NPCs).
 * Implements CombatEntity interface with health, poise, armor, speed, invincibility,
 * status effect processing, and collision system registration.
 */

import Phaser from 'phaser';
import type { IsoEntityConfig, ScreenPoint } from './types';
import type { CombatEntity, EntityStats, DamageResult, StatusEffectPayload } from '../../types/phenomenon_types';
import { DamageEngine } from '../engine/damage_engine';
import { StatusEffectManager } from '../engine/status_effect_manager';
import { CollisionSystem } from '../engine/collision_system';

export class IsoEntity implements CombatEntity {
  public scene: Phaser.Scene;

  // Logical grid coordinates in Tile Units (TU)
  public isoX: number;
  public isoY: number;

  // Physical collision radius in Tile Units (TU)
  public radius: number;

  // Movement speed in Tile Units per millisecond
  public speed: number;

  // Display scale
  public scale: number;

  // Combat Stat Block
  public stats: EntityStats;

  // Visual GameObjects
  public sprite: Phaser.GameObjects.Sprite;
  public shadow: Phaser.GameObjects.Ellipse;

  // Foot anchor offset (row within Kenney 256x512 asset)
  protected originX: number;
  protected originY: number;

  constructor(scene: Phaser.Scene, config: IsoEntityConfig) {
    this.scene = scene;
    this.isoX = config.isoX;
    this.isoY = config.isoY;
    this.radius = config.radius ?? 0.28;
    this.speed = config.speed ?? 0.003;
    this.scale = config.scale ?? 0.5;

    this.originX = config.originX ?? 0.5;
    this.originY = config.originY ?? (450 / 512);

    // Initialize Combat Stats
    const maxHp = config.maxHp ?? 1000;
    const maxPoise = config.maxPoise ?? 100;
    const armor = config.armor ?? 10;

    this.stats = {
      currentHp: config.currentHp ?? maxHp,
      maxHp,
      currentPoise: maxPoise,
      maxPoise,
      isStaggered: false,
      armor,
      effectiveArmor: armor,
      baseSpeed: this.speed,
      effectiveSpeed: this.speed,
      speedMultiplier: 1.0,
      isInvincible: config.isInvincible ?? false,
      isInvisible: config.isInvisible ?? false,
      isDead: false,
      activeEffects: [],
    };

    const initialPos = this.getScreenPos();

    // Create isometric ground shadow
    const shadowW = config.shadowWidth ?? 26;
    const shadowH = config.shadowHeight ?? 12;
    const shadowAlpha = config.shadowAlpha ?? 0.35;
    this.shadow = scene.add.ellipse(initialPos.x, initialPos.y, shadowW, shadowH, 0x000000, shadowAlpha);

    // Create main entity sprite
    const textureKey = config.texture ?? 'player_idle_S';
    this.sprite = scene.add.sprite(initialPos.x, initialPos.y, textureKey);
    this.sprite.setOrigin(this.originX, this.originY);
    this.sprite.setScale(this.scale);

    if (this.stats.isInvisible) {
      this.sprite.setAlpha(0.35);
    }

    this.syncVisuals();

    // Register with Collision System
    CollisionSystem.registerEntity(this);
  }

  /**
   * Projects logical Tile Units (isoX, isoY) to 2.5D isometric screen pixels.
   */
  public getScreenPos(): ScreenPoint {
    const sceneAny = this.scene as unknown as {
      TILE_W?: number;
      TILE_H?: number;
      getScreenXY?: (isoX: number, isoY: number) => ScreenPoint;
    };

    if (typeof sceneAny.getScreenXY === 'function') {
      return sceneAny.getScreenXY(this.isoX, this.isoY);
    }

    const tileW = sceneAny.TILE_W ?? 128;
    const tileH = sceneAny.TILE_H ?? 64;
    const originX = this.scene.cameras.main.centerX;
    const originY = 120;

    return {
      x: originX + (this.isoX - this.isoY) * (tileW / 2),
      y: originY + (this.isoX + this.isoY) * (tileH / 2),
    };
  }

  /**
   * Syncs the screen positions and depth sorting for the sprite and shadow.
   */
  public syncVisuals(): void {
    const pos = this.getScreenPos();

    this.sprite.setPosition(pos.x, pos.y);
    this.shadow.setPosition(pos.x, pos.y);

    // Depth sorting based on isometric Y position
    const depth = (this.isoX + this.isoY) * 10;
    this.shadow.setDepth(depth);
    this.sprite.setDepth(depth + 1);
  }

  /**
   * Called every discrete tick to update status effects and recover poise.
   */
  public updateStatusEffects(): void {
    StatusEffectManager.tickEntityEffects(this);
    this.speed = this.stats.effectiveSpeed;
  }

  /**
   * Moves the entity along X and Y with axis-separated sliding collision.
   */
  public moveWithSliding(
    dx: number,
    dy: number,
    canMoveTo: (x: number, y: number, radius: number) => boolean
  ): void {
    // Try moving along X
    if (canMoveTo(this.isoX + dx, this.isoY, this.radius)) {
      this.isoX += dx;
    }
    // Try moving along Y
    if (canMoveTo(this.isoX, this.isoY + dy, this.radius)) {
      this.isoY += dy;
    }
  }

  // CombatEntity Interface Methods
  public takeDamage(amount: number, elementId?: string): DamageResult {
    return DamageEngine.processHit(this, amount, elementId);
  }

  public attachStatusEffect(payload: StatusEffectPayload): void {
    StatusEffectManager.attachEffect(this, payload);
  }

  public flashOnHit(color: number = 0xffffff): void {
    if (!this.sprite || !this.scene) return;
    this.sprite.setTint(color);
    this.scene.time.delayedCall(120, () => {
      if (this.sprite && this.sprite.active) {
        this.sprite.clearTint();
      }
    });
  }

  public onStagger(): void {
    this.flashOnHit(0xfbbf24);
    this.scene.time.delayedCall(800, () => {
      this.stats.isStaggered = false;
      this.stats.currentPoise = this.stats.maxPoise;
    });
  }

  public onDeath(): void {
    CollisionSystem.unregisterEntity(this);
    if (this.sprite) {
      this.scene.tweens.add({
        targets: [this.sprite, this.shadow],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.destroy();
        },
      });
    }
  }

  public destroy(): void {
    CollisionSystem.unregisterEntity(this);
    if (this.shadow) this.shadow.destroy();
    if (this.sprite) this.sprite.destroy();
  }
}
