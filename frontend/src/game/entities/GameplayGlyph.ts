/**
 * @file GameplayGlyph.ts
 * @description Gameplay GameObject representing an active glyph entity in either 'held' or 'placed' state.
 * Features a unique Phaser UUID, extended active glyph information, decoupled physics collider,
 * interactive selection, and integrated activation pipeline via glyph_activation.ts.
 */

import Phaser from 'phaser';
import type { WorkshopGlyphItem } from '../../components/WorkshopCatalogMenu/GlyphCard';
import { executeGlyphActivation, getPlacedFacingDirection, type CardinalDirection } from '../engine/glyph_activation';

export type GlyphState = 'held' | 'placed';
export type { CardinalDirection };

export interface GameplayGlyphConfig {
  x: number;
  y: number;
  direction?: boolean; // true = facing left, false = facing right
  surface?: string;
  facingDirection?: CardinalDirection;
  state?: GlyphState;
  glyphData: WorkshopGlyphItem;
}

export class GameplayGlyph extends Phaser.GameObjects.Container {
  /** Unique Phaser UUID for this instance */
  public readonly uuid: string;

  /** Extended active glyph metadata */
  public readonly glyphData: WorkshopGlyphItem;
  public readonly glyphId: string;
  public readonly glyphName: string;
  public readonly element: string;
  public readonly tier: number;
  public readonly color: number;
  public surface: string;
  public isFacingLeft: boolean;
  public readonly placedAt: number;

  /**
   * The cardinal direction this placed glyph is facing ('north', 'south', 'east', or 'west').
   * Glyphs always face directly opposite (away from) the surface they are placed on:
   * - ground / floor (bottom) -> faces away (up)    -> 'north'
   * - ceiling (top)           -> faces away (down)  -> 'south'
   * - wall_left (left side)   -> faces away (right) -> 'east'
   * - wall_right (right side) -> faces away (left)  -> 'west'
   */
  public facingDirection: CardinalDirection;

  /** Current state: held (floating in front of chest) or placed (on the floor) */
  public state: GlyphState;

  /** Status flags */
  public isActivated: boolean = false;
  public isSelected: boolean = false;

  /** Separate physics collider zone (completely decoupled from visual container) */
  public readonly collider: Phaser.GameObjects.Zone;

  /** Visual sub-elements */
  public readonly runeRing: Phaser.GameObjects.Ellipse;
  public readonly scrollSprite: Phaser.GameObjects.Image;
  public readonly sigilSprite: Phaser.GameObjects.Image;
  public readonly coreLight: Phaser.GameObjects.Arc;
  public readonly selectionRing: Phaser.GameObjects.Ellipse;

  private projectedTextureKey?: string;
  private normalTextureKey?: string;
  private pulseTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, config: GameplayGlyphConfig) {
    super(scene, config.x, config.y);

    // 1. Unique Phaser UUID
    this.uuid = Phaser.Utils.String.UUID();

    // 2. Extended Glyph Info
    this.glyphData = config.glyphData;
    this.glyphId = config.glyphData.id;
    this.glyphName = config.glyphData.name;
    this.tier = config.glyphData.tier ?? 1;
    this.surface = config.surface || 'ground';
    this.facingDirection = config.facingDirection || getPlacedFacingDirection(this.surface);
    this.isFacingLeft = config.direction ?? false;
    this.state = config.state || 'placed';
    this.placedAt = Date.now();

    // 3. Determine element and theme color
    const elem = (this.glyphData.element || this.glyphData.name || 'fire').toLowerCase();
    this.element = elem;
    if (elem.includes('water') || elem.includes('frost')) {
      this.color = 0x00a2ff;
    } else if (elem.includes('earth') || elem.includes('stone')) {
      this.color = 0x22c55e;
    } else if (elem.includes('air') || elem.includes('gale')) {
      this.color = 0x38bdf8;
    } else if (elem.includes('fire')) {
      this.color = 0xff4400;
    } else {
      this.color = 0xa855f7; // arcane violet
    }

    // Depth: above floor tiles and background
    this.setDepth(10);

    // 4. Visual Components (local (0, 0) inside Container)
    // Glowing magical rune ring
    this.runeRing = scene.add.ellipse(0, 0, 62, 18);
    this.runeRing.setStrokeStyle(1, this.color, 0.9);
    this.runeRing.setOrigin(0.5, 0.5);

    // Generate simple line texture if not already present
    if (!scene.textures.exists('glyph_line_texture')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x3e2815, 1); // Dark parchment border
      g.fillRect(0, 0, 48, 5);
      g.fillStyle(0xd5b376, 1); // Warm parchment line core
      g.fillRect(1, 1, 46, 3);
      g.fillStyle(0x201408, 0.9); // Center inscribed ink line
      g.fillRect(4, 2, 40, 1);
      g.generateTexture('glyph_line_texture', 48, 5);
      g.destroy();
    }

    // Visual line sprite (parchment line)
    this.scrollSprite = scene.add.image(0, 0, 'glyph_line_texture');
    this.scrollSprite.setOrigin(0.5, 0.5);

    // Sigil image drawn on top of the parchment line
    this.sigilSprite = scene.add.image(0, 0, 'glyph_line_texture');
    this.sigilSprite.setOrigin(0.5, 0.5);
    this.sigilSprite.setVisible(false);

    // Center sigil light point
    this.coreLight = scene.add.circle(0, 0, 3, this.color, 0.65);

    // Interactive Selection Outline Ring (visible when selected by click)
    this.selectionRing = scene.add.ellipse(0, 0, 72, 24);
    this.selectionRing.setStrokeStyle(2, 0xffffff, 0.9);
    this.selectionRing.setOrigin(0.5, 0.5);
    this.selectionRing.setVisible(false);

    this.add([this.selectionRing, this.runeRing, this.scrollSprite, this.sigilSprite, this.coreLight]);

    // 5. Breathing pulse animation (uniform scaling on both axes)
    this.pulseTween = scene.tweens.add({
      targets: [this.runeRing, this.coreLight],
      alpha: { from: 0.45, to: 1.0 },
      scaleX: { from: 0.95, to: 1.05 },
      scaleY: { from: 0.95, to: 1.05 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 6. Make visual container interactive for clicking
    this.setSize(64, 28);
    this.setInteractive({ cursor: 'pointer' });
    this.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.scene.events.emit('gameplay-glyph-clicked', this);
    });

    // Add this visual container to scene display list
    scene.add.existing(this as any);

    // 7. SEPARATE Physics Collider (Zone) - detached from container transforms
    this.collider = scene.add.zone(config.x, config.y, 58, 16);
    scene.physics.add.existing(this.collider, true); // StaticBody: immovable, zero gravity

    // Reference back to this GameplayGlyph instance
    this.collider.setData('glyph', this);
    this.collider.setData('uuid', this.uuid);

    // 8. Generate and apply projected glyph sigil texture on top of parchment
    this.loadAndProjectSigil();

    // Apply initial state styling
    this.updateStateVisuals();
  }

  /**
   * Loads the glyph's preview image and generates both:
   * 1. A normal upright texture for held mode (with vertical parchment)
   * 2. An obliquely projected texture for placed floor mode (matching Scroll_Tile.png 1.5 slant)
   */
  private loadAndProjectSigil(): void {
    const cacheKey = `glyph_sigil_${this.glyphId || this.element}`;
    this.projectedTextureKey = `${cacheKey}_projected`;
    this.normalTextureKey = `${cacheKey}_normal`;

    if (this.scene.textures.exists(this.projectedTextureKey) && this.scene.textures.exists(this.normalTextureKey)) {
      this.updateStateVisuals();
      return;
    }

    const buildCanvasesFromSource = (source: CanvasImageSource) => {
      if (!this.scene || !this.scene.textures) return;

      // 1. Normal upright 64x64 texture for held mode (centered ink sigil)
      const normCanvas = document.createElement('canvas');
      normCanvas.width = 64;
      normCanvas.height = 64;
      const nCtx = normCanvas.getContext('2d');
      if (nCtx) {
        nCtx.imageSmoothingEnabled = false;
        nCtx.drawImage(source, 0, 0, 64, 64);
      }
      if (this.scene.textures.exists(this.normalTextureKey!)) {
        this.scene.textures.remove(this.normalTextureKey!);
      }
      this.scene.textures.addCanvas(this.normalTextureKey!, normCanvas);

      // 2. Obliquely projected 57x8 texture for placed floor mode (matching Scroll_Tile.png 1.5 slant)
      const canvasW = 57;
      const canvasH = 8;
      const targetW = 28;
      const targetH = 5;

      const projCanvas = document.createElement('canvas');
      projCanvas.width = canvasW;
      projCanvas.height = canvasH;
      const pCtx = projCanvas.getContext('2d');

      if (pCtx) {
        pCtx.imageSmoothingEnabled = false;
        pCtx.beginPath();
        pCtx.rect(0, 0, canvasW, canvasH);
        pCtx.clip();

        const scaleX = targetW / 64;
        const scaleY = targetH / 64;
        const skewX = 1.5 * scaleY; // Exact 1.5 slant ratio from Scroll_Tile.png

        // Centered inside parchment usable region
        const tx = (canvasW - targetW) / 2 + 1;
        const ty = 1.5;

        // Apply affine shear [scaleX, 0, skewX, scaleY, tx, ty]
        pCtx.setTransform(scaleX, 0, skewX, scaleY, tx, ty);
        pCtx.drawImage(source, 0, 0, 64, 64);
      }
      if (this.scene.textures.exists(this.projectedTextureKey!)) {
        this.scene.textures.remove(this.projectedTextureKey!);
      }
      this.scene.textures.addCanvas(this.projectedTextureKey!, projCanvas);

      this.updateStateVisuals();
    };

    // Pathway A: Use preloaded 'sigils' atlas frame if available (instant, synchronous, zero-lag)
    const rawEff = this.glyphData.composition?.effector;
    const effCandidate = (typeof rawEff === 'string' ? rawEff : rawEff?.sigilId) || `eff-${this.element}`;
    if (this.scene.textures.exists('sigils')) {
      const sigilAtlas = this.scene.textures.get('sigils');
      if (sigilAtlas && sigilAtlas.has(effCandidate)) {
        const frame = sigilAtlas.get(effCandidate);
        const sourceImg = frame.source.image as HTMLImageElement | HTMLCanvasElement;
        if (sourceImg) {
          const sCanvas = document.createElement('canvas');
          sCanvas.width = 64;
          sCanvas.height = 64;
          const sCtx = sCanvas.getContext('2d');
          if (sCtx) {
            sCtx.drawImage(
              sourceImg,
              frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
              0, 0, 64, 64
            );
            buildCanvasesFromSource(sCanvas);
            return;
          }
        }
      }
    }

    // Pathway B: Data URL or custom PNG preview URL
    const rawUrl = this.glyphData.coverAsset || `/sigils/svg/eff-${this.element}.svg`;
    if (rawUrl.startsWith('data:image/')) {
      const img = new Image();
      img.onload = () => {
        const sCanvas = document.createElement('canvas');
        sCanvas.width = 64;
        sCanvas.height = 64;
        const sCtx = sCanvas.getContext('2d');
        if (sCtx) {
          sCtx.drawImage(img, 0, 0, 64, 64);
          buildCanvasesFromSource(sCanvas);
        }
      };
      img.src = rawUrl;
      return;
    }

    // Pathway C: SVG fetch with explicit dimensions and ink styling (eliminates black WebGL square)
    fetch(rawUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch SVG');
        return res.text();
      })
      .then((svgText) => {
        // Ensure explicit width & height on root svg
        let sanitized = svgText;
        if (!sanitized.includes('width=')) {
          sanitized = sanitized.replace('<svg', '<svg width="64" height="64"');
        }
        // Replace currentColor with authentic deep rune ink
        sanitized = sanitized.replace(/currentColor/g, '#1a1008');

        const blob = new Blob([sanitized], { type: 'image/svg+xml' });
        const blobUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(blobUrl);
          const sCanvas = document.createElement('canvas');
          sCanvas.width = 64;
          sCanvas.height = 64;
          const sCtx = sCanvas.getContext('2d');
          if (sCtx) {
            sCtx.drawImage(img, 0, 0, 64, 64);
            buildCanvasesFromSource(sCanvas);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          fallbackRune();
        };
        img.src = blobUrl;
      })
      .catch(() => {
        fallbackRune();
      });

    // Pathway D: Procedural fallback rune drawing (guarantees a valid texture under any circumstance)
    const fallbackRune = () => {
      const fCanvas = document.createElement('canvas');
      fCanvas.width = 64;
      fCanvas.height = 64;
      const ctx = fCanvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#1a1008';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (this.element === 'fire') {
          ctx.beginPath();
          ctx.moveTo(32, 14);
          ctx.quadraticCurveTo(24, 28, 34, 38);
          ctx.quadraticCurveTo(38, 46, 30, 52);
          ctx.moveTo(20, 26);
          ctx.quadraticCurveTo(14, 36, 20, 44);
          ctx.moveTo(44, 26);
          ctx.quadraticCurveTo(50, 36, 44, 44);
          ctx.stroke();
        } else if (this.element === 'water') {
          for (let row = 0; row < 3; row++) {
            const y = 22 + row * 12;
            ctx.beginPath();
            ctx.moveTo(14, y);
            ctx.bezierCurveTo(22, y - 6, 28, y + 6, 36, y);
            ctx.bezierCurveTo(42, y - 6, 48, y + 6, 54, y);
            ctx.stroke();
          }
        } else if (this.element === 'earth') {
          ctx.strokeRect(18, 18, 28, 28);
          ctx.beginPath();
          ctx.moveTo(18, 32);
          ctx.lineTo(46, 32);
          ctx.moveTo(32, 18);
          ctx.lineTo(32, 46);
          ctx.stroke();
        } else {
          // Air / Arcane: spiral / diamond rune
          ctx.beginPath();
          ctx.arc(32, 32, 18, 0, Math.PI * 1.5);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(32, 12);
          ctx.lineTo(32, 52);
          ctx.moveTo(12, 32);
          ctx.lineTo(52, 32);
          ctx.stroke();
        }
      }
      buildCanvasesFromSource(fCanvas);
    };
  }

  /**
   * Switches state between 'held' and 'placed'
   */
  public setGlyphState(newState: GlyphState): this {
    this.state = newState;
    this.updateStateVisuals();
    return this;
  }

  /**
   * Updates facing direction
   */
  public setFacing(isLeft: boolean): void {
    this.isFacingLeft = isLeft;
    if (this.state === 'held') {
      this.scrollSprite.setFlipX(isLeft);
      this.sigilSprite.setFlipX(isLeft);
    }
  }

  private updateStateVisuals(): void {
    if (this.state === 'held') {
      // 1. Held glyph: line texture rotated vertically (90 deg)
      if (this.scene.textures.exists('glyph_line_texture')) {
        this.scrollSprite.setTexture('glyph_line_texture');
      }
      this.scrollSprite.setVisible(true);
      this.scrollSprite.setAngle(90); // Vertically oriented in held mode
      this.scrollSprite.setFlipX(this.isFacingLeft);
      this.scrollSprite.setDisplaySize(48, 5);
      this.scrollSprite.setOrigin(0.5, 0.5);

      // 2. Sigil placed upright centered
      if (this.normalTextureKey && this.scene.textures.exists(this.normalTextureKey)) {
        this.sigilSprite.setTexture(this.normalTextureKey);
        this.sigilSprite.setDisplaySize(18, 18);
        this.sigilSprite.setOrigin(0.5, 0.5);
        this.sigilSprite.setAngle(0);
        this.sigilSprite.setFlipX(this.isFacingLeft);
        this.sigilSprite.setVisible(true);
      } else {
        this.sigilSprite.setVisible(false);
      }

      // 3. In held mode: no outer rune ring, ONLY the center core light
      this.runeRing.setVisible(false);
      this.coreLight.setVisible(true);
      this.coreLight.setPosition(0, 0);

      // 4. Hitbox changes to vertical (14x48) matching held line
      this.setSize(14, 48);
      if (this.collider) {
        this.collider.setSize(14, 48);
        const body = this.collider.body as Phaser.Physics.Arcade.StaticBody;
        if (body) {
          body.setSize(14, 48);
          body.reset(this.x, this.y);
        }
      }
      this.selectionRing.setSize(20, 54);
      this.selectionRing.setOrigin(0.5, 0.5);

      this.setDepth(20); // In front of player chest
    } else {
      // 1. Placed on floor: simple horizontal line generated texture
      if (this.scene.textures.exists('glyph_line_texture')) {
        this.scrollSprite.setTexture('glyph_line_texture');
      }
      this.scrollSprite.setVisible(true);
      this.scrollSprite.setAngle(0); // Flat horizontal line on floor
      this.scrollSprite.setFlipX(false);
      this.scrollSprite.setDisplaySize(48, 5);
      this.scrollSprite.setOrigin(0.5, 0.5);

      // 2. Sigil placed on top
      if (this.normalTextureKey && this.scene.textures.exists(this.normalTextureKey)) {
        this.sigilSprite.setTexture(this.normalTextureKey);
        this.sigilSprite.setDisplaySize(18, 18);
        this.sigilSprite.setOrigin(0.5, 0.5);
        this.sigilSprite.setAngle(0);
        this.sigilSprite.setFlipX(false);
        this.sigilSprite.setVisible(true);
      } else {
        this.sigilSprite.setVisible(false);
      }

      // 3. Placed floor ring (only visible if NOT already used/activated)
      const showRing = !this.isActivated;
      this.runeRing.setVisible(showRing);
      this.runeRing.setSize(54, 16);
      this.runeRing.setOrigin(0.5, 0.5);
      this.coreLight.setVisible(showRing);
      this.coreLight.setPosition(0, 0);

      // 4. Horizontal floor hitbox (48x14)
      this.setSize(48, 14);
      if (this.collider) {
        this.collider.setSize(48, 14);
        const body = this.collider.body as Phaser.Physics.Arcade.StaticBody;
        if (body) {
          body.setSize(48, 14);
          body.reset(this.x, this.y);
        }
      }
      this.selectionRing.setSize(54, 20);
      this.selectionRing.setOrigin(0.5, 0.5);

      this.setDepth(10); // Floor level
    }
  }


  /**
   * Sets selection state and toggles the selection ring highlight.
   */
  public select(selected: boolean): void {
    this.isSelected = selected;
    this.selectionRing.setVisible(selected);
  }

  /**
   * Activates this glyph. If glyphObjectId is supplied, verifies ID matches.
   * Sets isActivated to true and triggers the activation engine.
   */
  public activate(glyphObjectId?: string): boolean {
    if (glyphObjectId && glyphObjectId !== this.uuid && glyphObjectId !== this.glyphId) {
      return false;
    }
    if (this.isActivated) {
      return false;
    }

    this.isActivated = true;

    // Permanently turn off breathing pulse and magical rune rings for used glyph
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = undefined;
    }
    this.runeRing.setVisible(false);
    this.coreLight.setVisible(false);

    // Trigger activation engine pipeline using concrete cardinal facing direction value
    executeGlyphActivation({
      scene: this.scene as Phaser.Scene & { floorGroup?: Phaser.Physics.Arcade.StaticGroup },
      glyph: this.glyphData,
      state: 'placed',
      origin: { x: this.x, y: this.y },
      direction: this.facingDirection,

    });

    // Visual activation feedback
    this.scene.tweens.add({
      targets: [this.runeRing, this.coreLight, this.selectionRing],
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 0,
      duration: 350,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        // If held or consumed on trigger, can hide or despawn
        if (this.state === 'held') {
          this.destroy();
        }
      },
    });

    return true;
  }

  /**
   * Repositions the glyph (and updates its separate collider)
   */
  public setGlyphPosition(x: number, y: number): void {
    this.setPosition(x, y);
    if (this.collider) {
      this.collider.setPosition(x, y);
      const body = this.collider.body as Phaser.Physics.Arcade.StaticBody;
      if (body) {
        body.reset(x, y);
      }
    }
  }

  public override destroy(fromScene?: boolean): void {
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = undefined;
    }
    if (this.collider) {
      this.collider.destroy();
    }
    super.destroy(fromScene);
  }
}
