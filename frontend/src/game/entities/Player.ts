/**
 * @file Player.ts
 * @description Player entity class representing the wizard in the Testing Ground arena.
 * Extends IsoEntity with 8-directional movement, keyboard input controls (WASD & Arrow keys),
 * Kenney animation switching (run/idle across 8 directions), and glyph inventory management.
 */

import Phaser from 'phaser';
import { IsoEntity } from './IsoEntity';
import type { PlayerConfig, IsoDirection } from './types';
import type { WorkshopGlyphItem } from '../../components/WorkshopCatalogMenu/GlyphCard';

export class Player extends IsoEntity {
  public currentlyFacing: IsoDirection = 'S';
  public glyphs: WorkshopGlyphItem[] = [];
  public selectedGlyphIndex: number = 0;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene, config: PlayerConfig) {
    super(scene, config);

    this.glyphs = config.glyphs || [];
    this.currentlyFacing = config.initialFacing || 'S';

    // Register keyboard inputs if keyboard plugin is enabled
    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasdKeys = scene.input.keyboard.addKeys({
        W: Phaser.Input.Keyboard.KeyCodes.W,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        S: Phaser.Input.Keyboard.KeyCodes.S,
        D: Phaser.Input.Keyboard.KeyCodes.D,
      }) as {
        W: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
      };

      // Crucial: remove captures and disable preventDefault on all WASD and cursor keys.
      // Otherwise, Phaser calls event.preventDefault() on window keydown, completely
      // preventing user keystrokes for 'W', 'A', 'S', 'D', space, and arrows inside text inputs.
      const keyboard = scene.input.keyboard as any;
      if (keyboard) {
        if (typeof keyboard.removeCapture === 'function') {
          keyboard.removeCapture([
            Phaser.Input.Keyboard.KeyCodes.W,
            Phaser.Input.Keyboard.KeyCodes.A,
            Phaser.Input.Keyboard.KeyCodes.S,
            Phaser.Input.Keyboard.KeyCodes.D,
            Phaser.Input.Keyboard.KeyCodes.SPACE,
            Phaser.Input.Keyboard.KeyCodes.UP,
            Phaser.Input.Keyboard.KeyCodes.DOWN,
            Phaser.Input.Keyboard.KeyCodes.LEFT,
            Phaser.Input.Keyboard.KeyCodes.RIGHT,
          ]);
        }
        keyboard.preventDefault = false;
      }
      if (this.wasdKeys.W) (this.wasdKeys.W as any).preventDefault = false;
      if (this.wasdKeys.A) (this.wasdKeys.A as any).preventDefault = false;
      if (this.wasdKeys.S) (this.wasdKeys.S as any).preventDefault = false;
      if (this.wasdKeys.D) (this.wasdKeys.D as any).preventDefault = false;
      if (this.cursors.space) (this.cursors.space as any).preventDefault = false;
      if (this.cursors.left) (this.cursors.left as any).preventDefault = false;
      if (this.cursors.right) (this.cursors.right as any).preventDefault = false;
      if (this.cursors.up) (this.cursors.up as any).preventDefault = false;
      if (this.cursors.down) (this.cursors.down as any).preventDefault = false;
    }
  }

  /**
   * Returns the currently active/selected glyph from the player's equipped testing inventory.
   */
  public getActiveGlyph(): WorkshopGlyphItem | undefined {
    return this.glyphs[this.selectedGlyphIndex];
  }

  /**
   * Sets the active glyph inventory index.
   */
  public setActiveGlyphIndex(index: number): void {
    if (index >= 0) {
      this.selectedGlyphIndex = index;
    }
  }

  /**
   * Returns the active glyph index.
   */
  public getActiveGlyphIndex(): number {
    return this.selectedGlyphIndex;
  }

  /**
   * Sets the active glyph inventory list.
   */
  public setGlyphs(glyphs: WorkshopGlyphItem[]): void {
    this.glyphs = glyphs;
    if (this.selectedGlyphIndex >= glyphs.length) {
      this.selectedGlyphIndex = 0;
    }
  }

  /**
   * Updates player movement, 8-directional sprite animations, and isometric collision sliding.
   */
  public updatePlayer(
    delta: number,
    canMoveTo: (x: number, y: number, radius: number) => boolean
  ): void {
    // Process status effects and recalculate stats
    this.updateStatusEffects();

    if (this.stats.isDead || this.stats.isStaggered) {
      if (this.sprite && this.sprite.anims) {
        this.sprite.play(`player_idle_${this.currentlyFacing}`, true);
      }
      this.syncVisuals();
      return;
    }

    // If user is currently typing in an input, textarea, or editable field, pause movement
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    if (
      activeEl instanceof HTMLInputElement ||
      activeEl instanceof HTMLTextAreaElement ||
      activeEl?.getAttribute('contenteditable') === 'true'
    ) {
      if (this.sprite && this.sprite.anims) {
        this.sprite.play(`player_idle_${this.currentlyFacing}`, true);
      }
      this.syncVisuals();
      return;
    }

    let screenX = 0;
    let screenY = 0;

    // Read directional inputs
    if (this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown) screenX -= 1;
    if (this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown) screenX += 1;
    if (this.cursors?.up?.isDown || this.wasdKeys?.W?.isDown) screenY -= 1;
    if (this.cursors?.down?.isDown || this.wasdKeys?.S?.isDown) screenY += 1;

    const isMoving = screenX !== 0 || screenY !== 0;

    if (isMoving) {
      // 1. Determine 8-directional facing based on screen motion vector
      if (screenX > 0 && screenY < 0) this.currentlyFacing = 'NE';
      else if (screenX > 0 && screenY > 0) this.currentlyFacing = 'SE';
      else if (screenX < 0 && screenY < 0) this.currentlyFacing = 'NW';
      else if (screenX < 0 && screenY > 0) this.currentlyFacing = 'SW';
      else if (screenX > 0) this.currentlyFacing = 'E';
      else if (screenX < 0) this.currentlyFacing = 'W';
      else if (screenY < 0) this.currentlyFacing = 'N';
      else if (screenY > 0) this.currentlyFacing = 'S';

      // 2. Play 8-directional running animation
      this.sprite.play(`player_run_${this.currentlyFacing}`, true);

      // 3. Convert screen direction vector to isometric grid dx, dy:
      // Screen X = (isoX - isoY), Screen Y = (isoX + isoY)
      let dx = screenX + screenY;
      let dy = screenY - screenX;
      const length = Math.hypot(dx, dy);
      if (length > 0) {
        const step = this.speed * delta;
        dx = (dx / length) * step;
        dy = (dy / length) * step;
        // 4. Move with axis-separated circle-vs-box sliding
        this.moveWithSliding(dx, dy, canMoveTo);
      }
    } else {
      // Idle animation facing last direction moved
      this.sprite.play(`player_idle_${this.currentlyFacing}`, true);
    }

    // Synchronize sprite, shadow, and depth
    this.syncVisuals();
  }
}
