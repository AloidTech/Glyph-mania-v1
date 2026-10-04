/**
 * @file SideTrainingDummy.ts
 * @description Interactive 2D Training Dummy entity for side-scrolling training grounds.
 * Implements CombatEntity, receives spell hits, calculates damage and status effects,
 * displays animated recoil wobbles, floating damage numbers, and overhead health/poise bars.
 */

import Phaser from 'phaser';
import type {
  CombatEntity,
  DamageResult,
  EntityStats,
  StatusEffectPayload,
} from '../../types/phenomenon_types';
import { DamageEngine } from '../engine/damage_engine';
import { StatusEffectManager } from '../engine/status_effect_manager';
import { CollisionSystem } from '../engine/collision_system';

export interface SideTrainingDummyConfig {
  x: number;
  y: number; // Floor baseline anchor
  maxHp?: number;
  armor?: number;
  maxPoise?: number;
}

export class SideTrainingDummy extends Phaser.GameObjects.Container implements CombatEntity {
  public radius: number = 32;
  public stats: EntityStats;

  // Visual sub-elements
  private bodyGraphics: Phaser.GameObjects.Graphics;
  private flashOverlay: Phaser.GameObjects.Graphics;
  private hpBarBg: Phaser.GameObjects.Graphics;
  private hpBarFill: Phaser.GameObjects.Graphics;
  private poiseBarFill: Phaser.GameObjects.Graphics;
  private statusBadgesText: Phaser.GameObjects.Text;
  private nameLabel: Phaser.GameObjects.Text;

  // Hit wobble tween
  private wobbleTween?: Phaser.Tweens.Tween;
  private isRecovering: boolean = false;
  private tickAccumulator: number = 0;

  constructor(scene: Phaser.Scene, config: SideTrainingDummyConfig) {
    super(scene, config.x, config.y);

    const maxHp = config.maxHp ?? 1000;
    const maxPoise = config.maxPoise ?? 100;
    const baseArmor = config.armor ?? 4;

    this.stats = {
      currentHp: maxHp,
      maxHp: maxHp,
      currentPoise: maxPoise,
      maxPoise: maxPoise,
      isStaggered: false,
      armor: baseArmor,
      effectiveArmor: baseArmor,
      baseSpeed: 0,
      effectiveSpeed: 0,
      speedMultiplier: 1.0,
      isInvincible: false,
      isInvisible: false,
      isDead: false,
      activeEffects: [],
    };

    this.setDepth(15);

    // 1. Draw procedural training dummy
    this.bodyGraphics = scene.make.graphics({ x: 0, y: 0 });
    this.drawDummyVisuals();
    this.add(this.bodyGraphics);

    this.flashOverlay = scene.make.graphics({ x: 0, y: 0 });
    this.flashOverlay.setVisible(false);
    this.add(this.flashOverlay);

    // 2. Health & Poise UI above head
    this.nameLabel = scene.add.text(0, -172, 'TRAINING DUMMY', {
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#facc15',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5);

    this.hpBarBg = scene.make.graphics({ x: 0, y: 0 });
    this.hpBarFill = scene.make.graphics({ x: 0, y: 0 });
    this.poiseBarFill = scene.make.graphics({ x: 0, y: 0 });

    this.statusBadgesText = scene.add.text(0, -145, '', {
      fontSize: '13px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    this.add([this.nameLabel, this.hpBarBg, this.hpBarFill, this.poiseBarFill, this.statusBadgesText]);
    this.updateStatusBars();

    scene.add.existing(this);

    // 3. Arcade Physics body for spell collisions/overlaps
    scene.physics.add.existing(this, true); // true = StaticBody (immovable)
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    if (body) {
      // 64px wide by 140px tall hitbox covering torso and head
      body.setSize(64, 140);
      body.setOffset(-32, -140);
    }

    // 4. Register with central collision system
    CollisionSystem.registerEntity(this);
  }

  // CombatEntity coordinate compatibility
  public get isoX(): number {
    return this.x;
  }
  public set isoX(val: number) {
    this.x = val;
  }
  public get isoY(): number {
    return this.y - 70;
  }
  public set isoY(val: number) {
    this.y = val + 70;
  }

  /**
   * Procedural hand-crafted visuals for the dummy
   */
  private drawDummyVisuals(): void {
    const g = this.bodyGraphics;
    g.clear();

    // Floor Base: Stone stand
    g.fillStyle(0x3b3a42, 1);
    g.fillRoundedRect(-30, -12, 60, 12, 4);
    g.fillStyle(0x232228, 1);
    g.fillRect(-28, -6, 56, 4);

    // Main Wooden Post (trunk)
    g.fillStyle(0x4a2e18, 1);
    g.fillRect(-7, -135, 14, 125);
    g.fillStyle(0x321e0f, 1);
    g.fillRect(3, -135, 4, 125); // Shadow side

    // Horizontal Wooden Crossbar (arms)
    g.fillStyle(0x5a381e, 1);
    g.fillRoundedRect(-42, -96, 84, 12, 3);
    g.fillStyle(0x3a2210, 1);
    g.fillRect(-42, -88, 84, 4);

    // Arm bindings & straw tufts at ends
    g.fillStyle(0xdfb072, 1);
    g.fillTriangle(-42, -94, -54, -86, -42, -82);
    g.fillTriangle(42, -94, 54, -86, 42, -82);

    // Torso: Padded Burlap Sack Body
    g.fillStyle(0xbc8a5f, 1);
    g.fillRoundedRect(-24, -112, 48, 68, 16);
    // Torso highlight & shading
    g.fillStyle(0xd5a377, 0.4);
    g.fillRoundedRect(-22, -110, 44, 12, 6);
    g.fillStyle(0x8a5833, 0.35);
    g.fillRoundedRect(-22, -60, 44, 14, 6);

    // Rope Waist Tie
    g.fillStyle(0x563821, 1);
    g.fillRoundedRect(-25, -52, 50, 7, 3);
    g.fillStyle(0x3e2614, 1);
    g.fillRect(-23, -48, 46, 2);

    // Target Bullseye on Torso
    // Outer Red Ring
    g.lineStyle(3, 0xd9383a, 0.95);
    g.strokeCircle(0, -78, 16);
    // Middle White Ring
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeCircle(0, -78, 10);
    // Inner Bullseye Core
    g.fillStyle(0xd9383a, 1);
    g.fillCircle(0, -78, 4);

    // Stitched X marks on chest shoulders
    g.lineStyle(2, 0x5e371b, 0.85);
    g.beginPath();
    // Left stitch
    g.moveTo(-16, -104); g.lineTo(-10, -98);
    g.moveTo(-10, -104); g.lineTo(-16, -98);
    // Right stitch
    g.moveTo(10, -104); g.lineTo(16, -98);
    g.moveTo(16, -104); g.lineTo(10, -98);
    g.strokePath();

    // Rope Neck Tie
    g.fillStyle(0x563821, 1);
    g.fillRoundedRect(-14, -118, 28, 8, 3);

    // Head: Straw Sack Bundle
    g.fillStyle(0xc8976b, 1);
    g.fillCircle(0, -135, 17);
    g.fillStyle(0xdfaf80, 0.4);
    g.fillCircle(-4, -139, 9);

    // Straw topknot tuft
    g.fillStyle(0xdfb072, 1);
    g.fillTriangle(-6, -152, 0, -162, 6, -152);

    // Head Stitched Eyes ('x' and 'x')
    g.lineStyle(2, 0x3d2010, 0.95);
    g.beginPath();
    // Left eye
    g.moveTo(-9, -138); g.lineTo(-3, -132);
    g.moveTo(-3, -138); g.lineTo(-9, -132);
    // Right eye
    g.moveTo(3, -138); g.lineTo(9, -132);
    g.moveTo(9, -138); g.lineTo(3, -132);
    g.strokePath();
  }

  /**
   * Updates overhead health bar and poise bar
   */
  private updateStatusBars(): void {
    const barW = 72;
    const hpBarH = 7;
    const poiseBarH = 4;
    const barX = -barW / 2;
    const barY = -162;

    // Background
    const bg = this.hpBarBg;
    bg.clear();
    bg.fillStyle(0x0f172a, 0.85); // Slate 900
    bg.fillRoundedRect(barX - 2, barY - 2, barW + 4, hpBarH + poiseBarH + 5, 3);
    bg.lineStyle(1, 0x334155, 0.9);
    bg.strokeRoundedRect(barX - 2, barY - 2, barW + 4, hpBarH + poiseBarH + 5, 3);

    // HP Fill
    const hpFill = this.hpBarFill;
    hpFill.clear();
    const hpRatio = Math.max(0, Math.min(1, this.stats.currentHp / this.stats.maxHp));
    const fillW = Math.round(barW * hpRatio);

    let hpColor = 0x10b981; // Emerald green
    if (hpRatio < 0.25) {
      hpColor = 0xef4444; // Red
    } else if (hpRatio < 0.5) {
      hpColor = 0xf59e0b; // Amber
    }

    if (fillW > 0) {
      hpFill.fillStyle(hpColor, 1);
      hpFill.fillRoundedRect(barX, barY, fillW, hpBarH, 2);
    }

    // Poise Fill (under HP bar)
    const poiseFill = this.poiseBarFill;
    poiseFill.clear();
    const poiseRatio = Math.max(0, Math.min(1, this.stats.currentPoise / this.stats.maxPoise));
    const poiseW = Math.round(barW * poiseRatio);
    const poiseY = barY + hpBarH + 2;

    const poiseColor = this.stats.isStaggered ? 0xef4444 : 0xfacc15; // Red when broken, yellow when stable
    if (poiseW > 0) {
      poiseFill.fillStyle(poiseColor, 0.9);
      poiseFill.fillRoundedRect(barX, poiseY, poiseW, poiseBarH, 1);
    }

    // Status effect badges
    if (this.stats.activeEffects.length > 0) {
      const icons = this.stats.activeEffects
        .map((eff) => {
          switch (eff.effectType.toUpperCase()) {
            case 'BURNING':
              return '🔥';
            case 'SLOW':
            case 'CHILL':
              return '❄️';
            case 'MELT_ARMOR':
              return '🛡️';
            case 'VULNERABLE':
              return '⚡';
            default:
              return '✨';
          }
        })
        .join(' ');
      this.statusBadgesText.setText(icons);
    } else {
      this.statusBadgesText.setText('');
    }
  }

  // CombatEntity interface methods
  public takeDamage(amount: number, elementId?: string): DamageResult {
    const result = DamageEngine.processHit(this, amount, elementId);
    this.updateStatusBars();
    return result;
  }

  public attachStatusEffect(payload: StatusEffectPayload): void {
    StatusEffectManager.attachEffect(this, payload);
    this.updateStatusBars();
  }

  public flashOnHit(color: number = 0xffffff): void {
    // 1. Color flash via luminous overlay
    this.flashOverlay.clear();
    this.flashOverlay.fillStyle(color, 0.6);
    this.flashOverlay.fillRoundedRect(-28, -155, 56, 145, 10);
    this.flashOverlay.setBlendMode(Phaser.BlendModes.ADD);
    this.flashOverlay.setAlpha(0.7);
    this.flashOverlay.setVisible(true);

    this.scene.tweens.add({
      targets: this.flashOverlay,
      alpha: 0,
      duration: 160,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.flashOverlay.setVisible(false);
      },
    });

    // 2. Play physics recoil wobble
    if (this.wobbleTween) {
      this.wobbleTween.stop();
    }

    const wobbleAngle = Phaser.Math.Between(0, 1) === 0 ? 8 : -8;
    this.wobbleTween = this.scene.tweens.add({
      targets: this,
      angle: { from: wobbleAngle, to: 0 },
      scaleY: { from: 0.94, to: 1.0 },
      duration: 260,
      ease: 'Elastic.easeOut',
      easeParams: [1.2, 0.4],
      onComplete: () => {
        this.setAngle(0);
        this.setScale(1, 1);
        this.wobbleTween = undefined;
      },
    });
  }

  public onStagger(): void {
    this.flashOnHit(0xfbbf24);

    // Stagger dizzy wobble
    this.scene.tweens.add({
      targets: this,
      angle: 12,
      duration: 100,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.setAngle(0);
      },
    });

    // Recover poise after 1.5s
    this.scene.time.delayedCall(1500, () => {
      this.stats.isStaggered = false;
      this.stats.currentPoise = this.stats.maxPoise;
      this.updateStatusBars();
    });
  }

  public onDeath(): void {
    if (this.isRecovering) return;
    this.isRecovering = true;

    // Topple over animation
    this.scene.tweens.add({
      targets: this,
      angle: -45,
      alpha: 0.55,
      duration: 400,
      ease: 'Quad.easeOut',
    });

    // Respawn after 1.2s
    this.scene.time.delayedCall(1200, () => {
      this.stats.isDead = false;
      this.stats.currentHp = this.stats.maxHp;
      this.stats.currentPoise = this.stats.maxPoise;
      this.stats.isStaggered = false;
      this.stats.activeEffects = [];
      this.isRecovering = false;

      // Spring back up
      this.scene.tweens.add({
        targets: this,
        angle: 0,
        alpha: 1,
        scaleY: { from: 0.8, to: 1 },
        duration: 350,
        ease: 'Back.easeOut',
        onComplete: () => {
          DamageEngine.emitCombatText(this, 'READY!', 0x10b981);
          this.updateStatusBars();
        },
      });
    });
  }

  /**
   * Ticks status effects and updates overhead status bars
   */
  public tick(deltaMs: number): void {
    this.tickAccumulator += deltaMs;

    // Run status effect tick at 10Hz (every 100ms)
    while (this.tickAccumulator >= 100) {
      this.tickAccumulator -= 100;
      StatusEffectManager.tickEntityEffects(this);
      this.updateStatusBars();
    }
  }

  public override destroy(fromScene?: boolean): void {
    CollisionSystem.unregisterEntity(this);
    if (this.wobbleTween) {
      this.wobbleTween.stop();
      this.wobbleTween = undefined;
    }
    super.destroy(fromScene);
  }
}
