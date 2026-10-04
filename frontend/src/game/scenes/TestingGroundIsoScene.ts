/**
 * @file TestingGroundIsoScene.ts
 * @description Previous isometric implementation of TestingGroundScene.
 * Preserved for reference and fallback.
 * Uses 2:1 isometric diamond projection math.
 */

import Phaser from 'phaser';
import type { WorkshopGlyphItem } from '../../components/WorkshopCatalogMenu/GlyphCard';
import { Player } from '../entities/Player';
import { STARTER_TESTING_GLYPHS } from '../../components/MageUi/GlyphHotbar';

export class TestingGroundIsoScene extends Phaser.Scene {
  private selectedGlyphs: WorkshopGlyphItem[] = [];

  // Kenney isometric assets are 256x512 with a 256x128 floor diamond (standard 2:1 ratio)
  private tileScale = 0.5;
  private TILE_W = 256 * this.tileScale; // 128px
  private TILE_H = 128 * this.tileScale; // 64px (2:1 isometric ratio)

  // Anchor for Kenney isometric 256x512 images: center of the base floor diamond (row 428 of 512)
  private readonly ISO_ORIGIN_Y = 428 / 512;

  // Kenney character foot anchor: row 456 of 512 puts feet directly on the tile surface
  private readonly CHARACTER_ORIGIN_Y = 450 / 512;

  // Circle-vs-box collision parameters in logical Tile Units (TU):
  // 0.28 TU radius = ~36px physical width on a 128px tile
  private readonly PLAYER_RADIUS = 0.28;
  // 0.4 TU half-size = 0.8 TU wall thickness (slimmer than full 1.0 tile to give player comfortable walking space)
  private readonly WALL_HALF_SIZE = 0.4;

  // Player entity instance with Glyph inventory and 8-direction controls
  public player!: Player;

  private collisionMap: Set<string> = new Set();

  // 8-direction mapping: Kenney directional indices 0 to 7 (used for preload & animation definitions)
  private readonly directions: Record<number, string> = {
    7: 'N', 0: 'NE', 1: 'E', 2: 'SE', 3: 'S', 4: 'SW', 5: 'W', 6: 'NW'
  };
  constructor() {
    super('TestingGroundIsoScene');
  }

  init(data: { glyphs?: WorkshopGlyphItem[] }) {
    this.selectedGlyphs = (data?.glyphs && data.glyphs.length > 0) ? data.glyphs : STARTER_TESTING_GLYPHS;
    console.log('[TestingGroundIsoScene] Initialized with selected glyphs:', this.selectedGlyphs);
  }

  preload() {
    this.load.image('parchment', '/assets/parchment.png');
    this.load.atlas('sigils', '/sigils/atlas/sigils-atlas.png', '/sigils/atlas/sigils-atlas.json');
    // Load all 8 directions of the Kenney character (Idle and 10-frame Run)
    for (let dir = 0; dir < 8; dir++) {
      const direction = this.directions[dir];
      this.load.image(`player_idle_${direction}`, `/kenny/Characters/Male/Male_${dir}_Idle0.png`);
      for (let step = 0; step < 10; step++) {
        this.load.image(`player_run_${direction}_${step}`, `/kenny/Characters/Male/Male_${dir}_Run${step}.png`);
      }
    }

    this.load.image('floor', '/kenny/Isometric/stone_N.png');
    this.load.image('wall', '/kenny/Isometric/stoneWallCorner_N.png');
    this.load.image('player', '/kenny/Characters/Male/Male_0_Idle0.png');
  }

  generateTextures() {
    // Floor Tile
    if (!this.textures.exists('floor')) {
      const floorCanvas = this.textures.createCanvas('floor', 32, 24);
      if (floorCanvas) {
        const ctx = floorCanvas.context;
        ctx.fillStyle = '#3a4466'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(32, 12); ctx.lineTo(16, 24); ctx.lineTo(0, 12); ctx.fill();
        ctx.fillStyle = '#262b44'; ctx.beginPath(); ctx.moveTo(16, 2); ctx.lineTo(30, 12); ctx.lineTo(16, 22); ctx.lineTo(2, 12); ctx.fill();
        floorCanvas.refresh();
      }
    }

    // Wall Tile (Extruded height)
    if (!this.textures.exists('wall')) {
      const wallCanvas = this.textures.createCanvas('wall', 32, 48);
      if (wallCanvas) {
        const ctx = wallCanvas.context;
        ctx.fillStyle = '#8b5444'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(32, 12); ctx.lineTo(16, 24); ctx.lineTo(0, 12); ctx.fill();
        ctx.fillStyle = '#6a3e31'; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(16, 24); ctx.lineTo(16, 48); ctx.lineTo(0, 36); ctx.fill();
        ctx.fillStyle = '#502c21'; ctx.beginPath(); ctx.moveTo(16, 24); ctx.lineTo(32, 12); ctx.lineTo(32, 36); ctx.lineTo(16, 48); ctx.fill();
        wallCanvas.refresh();
      }
    }

    // Player Sprite
    if (!this.textures.exists('player')) {
      const playerCanvas = this.textures.createCanvas('player', 16, 24);
      if (playerCanvas) {
        const ctx = playerCanvas.context;
        ctx.fillStyle = '#ff4157'; ctx.fillRect(2, 8, 12, 16);
        ctx.fillStyle = '#ffcca5'; ctx.fillRect(3, 0, 10, 10);
        playerCanvas.refresh();
      }
    }
  }

  create() {
    this.generateTextures();

    for (let i = 0; i < 8; i++) {
      const direction = this.directions[i];

      this.anims.create({
        key: `player_idle_${direction}`,
        frames: [{ key: `player_idle_${direction}` }],
        frameRate: 1,
        repeat: -1
      });

      this.anims.create({
        key: `player_run_${direction}`,
        frames: Array.from({ length: 10 }, (_, step) => ({
          key: `player_run_${direction}_${step}`
        })),
        frameRate: 14,
        repeat: -1
      });
    }

    this.collisionMap = new Set();

    // Build Floor Grid
    for (let x = -10; x < 10; x++) {
      for (let y = -10; y < 10; y++) {
        let pos = this.getScreenXY(x, y);
        let tile = this.add.image(pos.x, pos.y, 'floor');
        tile.setOrigin(0.5, this.ISO_ORIGIN_Y);
        tile.depth = pos.y - 1000;
        tile.setScale(this.tileScale);
      }
    }

    // Add Walls
    this.addWall(-2, -2);
    this.addWall(1, -3);
    this.addWall(1, -2);

    this.player = new Player(this, {
      isoX: 0,
      isoY: 0,
      radius: this.PLAYER_RADIUS,
      scale: this.tileScale,
      originY: this.CHARACTER_ORIGIN_Y,
      glyphs: this.selectedGlyphs,
      initialFacing: 'S',
    });

    this.cameras.main.setZoom(1.5);

    const onHotbarSelect = (e: Event) => {
      const customEvt = e as CustomEvent<{ index: number; glyph: any }>;
      if (this.player && customEvt.detail) {
        this.player.setActiveGlyphIndex(customEvt.detail.index);
        console.log('[TestingGroundIsoScene] Active glyph slot switched to:', customEvt.detail.index, customEvt.detail.glyph?.name);
      }
    };
    window.addEventListener('glyph-hotbar-select', onHotbarSelect);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('glyph-hotbar-select', onHotbarSelect);
    });
  }

  addWall(isoX: number, isoY: number) {
    let pos = this.getScreenXY(isoX, isoY);
    let wall = this.add.image(pos.x, pos.y, 'wall');
    wall.setOrigin(0.5, this.ISO_ORIGIN_Y);
    wall.depth = pos.y;
    wall.setScale(this.tileScale);
    this.collisionMap.add(`${isoX},${isoY}`);
  }

  getScreenXY(cartX: number, cartY: number) {
    return {
      x: (cartX - cartY) * (this.TILE_W / 2),
      y: (cartX + cartY) * (this.TILE_H / 2)
    };
  }

  canMoveTo(x: number, y: number, radius: number): boolean {
    const minX = Math.floor(x - radius - this.WALL_HALF_SIZE);
    const maxX = Math.ceil(x + radius + this.WALL_HALF_SIZE);
    const minY = Math.floor(y - radius - this.WALL_HALF_SIZE);
    const maxY = Math.ceil(y + radius + this.WALL_HALF_SIZE);

    for (let tx = minX; tx <= maxX; tx++) {
      for (let ty = minY; ty <= maxY; ty++) {
        if (this.collisionMap.has(`${tx},${ty}`)) {
          const closestX = Phaser.Math.Clamp(x, tx - this.WALL_HALF_SIZE, tx + this.WALL_HALF_SIZE);
          const closestY = Phaser.Math.Clamp(y, ty - this.WALL_HALF_SIZE, ty + this.WALL_HALF_SIZE);

          const distX = x - closestX;
          const distY = y - closestY;
          if (distX * distX + distY * distY < radius * radius) {
            return false;
          }
        }
      }
    }
    return true;
  }

  update(_time: number, delta: number) {
    if (!this.player) return;

    this.player.updatePlayer(delta, (x, y, r) => this.canMoveTo(x, y, r));

    const pos = this.player.getScreenPos();
    this.cameras.main.centerOn(pos.x, pos.y - 24);
  }
}
