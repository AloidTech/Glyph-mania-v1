/**
 * @file Dummy.ts
 * @description Isometric Training Dummy entity.
 * By default has isInvincible = true, displays floating combat text,
 * logs incoming status effects, and can be used to test phenomena and spell combinations.
 */

import Phaser from 'phaser';
import { IsoEntity } from './IsoEntity';
import type { IsoEntityConfig } from './types';

export interface DummyConfig extends Partial<IsoEntityConfig> {
  isoX: number;
  isoY: number;
  label?: string;
}

export class Dummy extends IsoEntity {
  public labelText: Phaser.GameObjects.Text;
  public statusText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, config: DummyConfig) {
    super(scene, {
      isoX: config.isoX,
      isoY: config.isoY,
      radius: config.radius ?? 0.35,
      speed: 0, // Stationary
      scale: config.scale ?? 0.55,
      texture: config.texture ?? 'player_idle_S',
      maxHp: config.maxHp ?? 99999,
      currentHp: config.currentHp ?? 99999,
      maxPoise: config.maxPoise ?? 500,
      armor: config.armor ?? 0,
      isInvincible: config.isInvincible ?? true, // Invincible by default
      isInvisible: config.isInvisible ?? false,
    });

    const pos = this.getScreenPos();

    // Give dummy a distinct golden/stone hue
    this.sprite.setTint(0xd4af37);

    // Overhead Label
    this.labelText = scene.add.text(pos.x, pos.y - 75, config.label || 'TRAINING DUMMY', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5, 0.5);

    // Overhead Status/Effects summary
    this.statusText = scene.add.text(pos.x, pos.y - 60, this.stats.isInvincible ? '[IMMUNE]' : '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
    }).setOrigin(0.5, 0.5);

    this.syncVisuals();
  }

  public override syncVisuals(): void {
    super.syncVisuals();

    const pos = this.getScreenPos();
    const depth = (this.isoX + this.isoY) * 10 + 5;

    if (this.labelText) {
      this.labelText.setPosition(pos.x, pos.y - 75);
      this.labelText.setDepth(depth);
    }

    if (this.statusText) {
      this.statusText.setPosition(pos.x, pos.y - 60);
      this.statusText.setDepth(depth);

      // Update active status effects count
      const activeCount = this.stats.activeEffects.length;
      if (activeCount > 0) {
        const effectNames = this.stats.activeEffects.map((e) => e.effectType).join(', ');
        this.statusText.setText(`[${effectNames}]`);
        this.statusText.setColor('#f97316');
      } else {
        this.statusText.setText(this.stats.isInvincible ? '[IMMUNE]' : '');
        this.statusText.setColor('#ffffff');
      }
    }
  }

  public override updateStatusEffects(): void {
    super.updateStatusEffects();
    this.syncVisuals();
  }

  public override destroy(): void {
    if (this.labelText) this.labelText.destroy();
    if (this.statusText) this.statusText.destroy();
    super.destroy();
  }
}
