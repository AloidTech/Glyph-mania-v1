/**
 * @file ElementalBallSpell.ts
 * @description Dedicated GameObject entity for elemental ball projectiles.
 * Features customizable per-element visuals:
 * - Earth: Rich earthy brown ball with warm amber aura, brown smaller less particles.
 * - Wind (Air): Blue close to white ball, glowing white core, pale blue-white particles.
 * - Water: All ocean blue ball, ocean blue aura, and ocean blue core and particles.
 * - Fire/Arcane: Fiery crimson/amber ball with radiant gold core.
 * Includes Arcade physics with buoyant arc, floor collision detection,
 * and world boundary collision detection (left/right walls, ceiling, bounds).
 */

import Phaser from 'phaser';
import type { BasePhenomenon } from '../engine/phenomenon';
import type { CombatEntity } from '../../types/phenomenon_types';

export interface ElementalBallSpellConfig {
  x: number;
  y: number;
  element: string;
  color: number;
  vx: number;
  vy: number;
  floorGroup?: Phaser.Physics.Arcade.StaticGroup;
  lifespan?: number;
  radius?: number;
  targets?: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[] | Phaser.Physics.Arcade.Group | any;
  phenomenon?: BasePhenomenon;
  onHitEntity?: (target: any) => void;
}

interface ElementVisualConfig {
  ballColor: number;
  auraColor: number;
  auraAlpha: number;
  coreColor: number;
  coreAlpha: number;
  particleTint: number;
  particleScale: { start: number; end: number };
  particleSpeed: number;
  particleLifespan: number;
  particleFrequency: number;
  burstCount: number;
  burstScale: { start: number; end: number };
}

function getElementVisuals(element: string, baseColor: number): ElementVisualConfig {
  const norm = (element || '').toLowerCase();

  if (norm === 'earth') {
    // Earth: brown ball and brown smaller less particles
    return {
      ballColor: 0x784421, // Earth brown
      auraColor: 0x8b5a2b, // Warm earthen aura
      auraAlpha: 0.35,
      coreColor: 0xa0673b, // Soft sand/stone brown core
      coreAlpha: 0.85,
      particleTint: 0x784421, // Brown particles
      particleScale: { start: 0.20, end: 0 }, // Smaller particles
      particleSpeed: 24,
      particleLifespan: 180,
      particleFrequency: 55, // Less particles
      burstCount: 6, // Fewer burst particles
      burstScale: { start: 0.25, end: 0 },
    };
  }

  if (norm === 'air' || norm === 'wind') {
    // Wind: blue close to white ball and particles
    return {
      ballColor: 0xcfe9ff, // Pale sky blue close to white
      auraColor: 0xe0f2fe, // Luminous pale ice-white-blue
      auraAlpha: 0.55,
      coreColor: 0xffffff, // Pure white core
      coreAlpha: 0.95,
      particleTint: 0xd8efff, // Blue close to white particles
      particleScale: { start: 0.45, end: 0 },
      particleSpeed: 52,
      particleLifespan: 280,
      particleFrequency: 20,
      burstCount: 14,
      burstScale: { start: 0.5, end: 0 },
    };
  }

  if (norm === 'water') {
    // Water: all ocean blue
    return {
      ballColor: 0x0077be, // Ocean blue
      auraColor: 0x0066aa, // Ocean blue aura
      auraAlpha: 0.5,
      coreColor: 0x0284c7, // Ocean blue core (all ocean blue!)
      coreAlpha: 0.9,
      particleTint: 0x0077be, // Ocean blue particles
      particleScale: { start: 0.45, end: 0 },
      particleSpeed: 40,
      particleLifespan: 260,
      particleFrequency: 22,
      burstCount: 12,
      burstScale: { start: 0.55, end: 0 },
    };
  }

  // Fire / Default Arcane
  return {
    ballColor: baseColor || 0xef4444,
    auraColor: 0xf97316,
    auraAlpha: 0.45,
    coreColor: 0xffeedd,
    coreAlpha: 0.9,
    particleTint: baseColor || 0xef4444,
    particleScale: { start: 0.5, end: 0 },
    particleSpeed: 42,
    particleLifespan: 260,
    particleFrequency: 20,
    burstCount: 12,
    burstScale: { start: 0.6, end: 0 },
  };
}

export class ElementalBallSpell extends Phaser.GameObjects.Container {
  public readonly element: string;
  public readonly color: number;
  public readonly phenomenon?: BasePhenomenon;
  private visuals: ElementVisualConfig;
  private particles?: Phaser.GameObjects.Particles.ParticleEmitter;
  private collider?: Phaser.Physics.Arcade.Collider;
  private targetCollider?: Phaser.Physics.Arcade.Collider;
  private isDestroyed: boolean = false;
  private onWorldBoundsListener?: (hitBody: Phaser.Physics.Arcade.Body) => void;

  constructor(scene: Phaser.Scene, config: ElementalBallSpellConfig) {
    super(scene, config.x, config.y);
    this.element = config.element;
    this.color = config.color;
    this.phenomenon = config.phenomenon;
    this.visuals = getElementVisuals(config.element, config.color);

    const radius = config.radius ?? 14;

    // 1. Visuals: Outer Aura + Main Ball + Inner Core
    const outerAura = scene.add.circle(0, 0, radius + 5, this.visuals.auraColor, this.visuals.auraAlpha);
    outerAura.setBlendMode(Phaser.BlendModes.ADD);

    const mainBall = scene.add.circle(0, 0, radius, this.visuals.ballColor, 0.95);

    const innerCore = scene.add.circle(0, 0, radius * 0.45, this.visuals.coreColor, this.visuals.coreAlpha);
    innerCore.setBlendMode(Phaser.BlendModes.ADD);

    this.add([outerAura, mainBall, innerCore]);
    this.setDepth(20);

    // Pulsing animation for outer aura
    scene.tweens.add({
      targets: outerAura,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: this.visuals.auraAlpha * 0.5,
      duration: 280,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    scene.add.existing(this);

    // 2. Physics Arcade Body with World Bounds Collision
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCircle(radius, -radius, -radius);
      // Reduce gravity so the ball flies in a gentle, buoyant arc rather than plummeting
      // World gravity in scene is 800, setting gravity.y to -620 leaves net gravity ~180
      body.setGravityY(-620);
      body.setVelocity(config.vx, config.vy);

      // Enable world boundary collision (left, right, top ceiling, bottom bounds)
      body.setCollideWorldBounds(true);
      body.onWorldBounds = true;

      this.onWorldBoundsListener = (hitBody: Phaser.Physics.Arcade.Body) => {
        if (hitBody === body && !this.isDestroyed) {
          this.explode();
        }
      };
      scene.physics.world.on('worldbounds', this.onWorldBoundsListener);
    }

    // 3. Particle Trail
    if (scene.textures.exists('side_torch')) {
      this.particles = scene.add.particles(0, 0, 'side_torch', {
        speed: this.visuals.particleSpeed,
        scale: this.visuals.particleScale,
        frequency: this.visuals.particleFrequency,
        blendMode: 'ADD',
        tint: this.visuals.particleTint,
        lifespan: this.visuals.particleLifespan,
      });
      this.particles.startFollow(this);
      this.particles.setDepth(19);
    }

    // 4. Floor / Platform Collision
    if (config.floorGroup && body) {
      this.collider = scene.physics.add.collider(this, config.floorGroup, () => {
        this.explode();
      });
    }

    // 5. Target Overlaps (e.g. Training Dummy, Enemies)
    if (config.targets && body) {
      this.targetCollider = scene.physics.add.overlap(this, config.targets, (_ball, targetObj) => {
        this.hitEntity(targetObj as any, config.onHitEntity);
      });
    }

    // 6. Lifespan timeout (e.g. 2.5 seconds)
    scene.time.delayedCall(config.lifespan ?? 2500, () => {
      if (!this.isDestroyed) {
        this.explode();
      }
    });
  }

  /**
   * Processes hit on an entity: applies phenomenon damage and status effects, then explodes
   */
  private hitEntity(targetObj: any, onHitEntity?: (target: any) => void): void {
    if (this.isDestroyed) return;

    // Check if targetObj implements CombatEntity or has combat entity attached
    const combatEntity: CombatEntity | undefined =
      (targetObj && typeof targetObj.takeDamage === 'function')
        ? targetObj
        : (targetObj?.getData && targetObj.getData('combatEntity'));

    if (combatEntity) {
      if (this.phenomenon) {
        this.phenomenon.handleEntityOverlap(combatEntity);
      } else {
        combatEntity.takeDamage(25, this.element);
      }
    }

    onHitEntity?.(targetObj);
    this.explode();
  }

  /**
   * Spawns collision impact visuals and camera micro-shake before destroying
   */
  public explode(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    const scene = this.scene;
    if (!scene) return;

    const hitX = this.x;
    const hitY = this.y;
    const v = this.visuals;

    // Impact shockwave ring
    const ring = scene.add.circle(hitX, hitY, 10);
    ring.setStrokeStyle(3, v.ballColor, 0.9);
    ring.setDepth(22);

    scene.tweens.add({
      targets: ring,
      scaleX: 3.5,
      scaleY: 1.8, // Slightly flattened along impact plane
      alpha: 0,
      duration: 250,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    // Impact flash
    const flash = scene.add.circle(hitX, hitY, 18, v.coreColor, 0.85);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setDepth(22);
    scene.tweens.add({
      targets: flash,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    // Particle burst
    if (scene.textures.exists('side_torch')) {
      const burstEmitter = scene.add.particles(hitX, hitY, 'side_torch', {
        speed: { min: 60, max: 160 },
        angle: { min: 0, max: 360 },
        scale: v.burstScale,
        blendMode: 'ADD',
        tint: v.particleTint,
        lifespan: v.particleLifespan,
        quantity: v.burstCount,
        emitting: false,
      });
      burstEmitter.setDepth(21);
      burstEmitter.explode(v.burstCount);
      scene.time.delayedCall(300, () => burstEmitter.destroy());
    }

    // Camera shake
    if (scene.cameras?.main) {
      scene.cameras.main.shake(120, 0.004);
    }

    // Clean up
    if (this.onWorldBoundsListener && scene.physics?.world) {
      scene.physics.world.off('worldbounds', this.onWorldBoundsListener);
      this.onWorldBoundsListener = undefined;
    }
    if (this.collider && scene.physics?.world) {
      scene.physics.world.removeCollider(this.collider);
      this.collider = undefined;
    }
    if (this.particles) {
      this.particles.stop();
      scene.time.delayedCall(300, () => this.particles?.destroy());
    }

    this.destroy();
  }

  destroy(fromScene?: boolean): void {
    if (this.onWorldBoundsListener && this.scene?.physics?.world) {
      this.scene.physics.world.off('worldbounds', this.onWorldBoundsListener);
      this.onWorldBoundsListener = undefined;
    }
    if (this.collider && this.scene?.physics?.world) {
      this.scene.physics.world.removeCollider(this.collider);
      this.collider = undefined;
    }
    if (this.targetCollider && this.scene?.physics?.world) {
      this.scene.physics.world.removeCollider(this.targetCollider);
      this.targetCollider = undefined;
    }
    if (this.particles) {
      this.particles.destroy();
      this.particles = undefined;
    }
    super.destroy(fromScene);
  }
}
