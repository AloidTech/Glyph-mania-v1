/**
 * @file TestingGroundScene.ts
 * @description Oblique Pixel-Art Dungeon Scene for Glyph Testing Ground.
 * Built following the Kenney "Angle" oblique projection guide:
 * - Rectangular panel tiling (baked ~35° elevation perspective, not 2:1 isometric diamonds)
 * - Exact alpha-trimmed content box metrics:
 *     * Wall panel content: y = 148 to 377 (h = 229, w = 256)
 *     * Floor panel content: y = 308 to 512 (h = 204, w = 256)
 *     * Wall-to-first-floor offset: firstFloorRowY = wallScreenY + 377 - 308 (69px)
 * - Ascending row depth sorting with floor texture variation (stoneTile_S, stone_S, stoneUneven_S)
 * - Decorative props (stairs, columns, chests, barrels, tables) with bottom-anchored origins
 * - Fully controllable player wizard with 8-directional movement, spellcasting, and Glyph hotbar sync
 */

import Phaser from 'phaser';
import type { WorkshopGlyphItem } from '../../components/WorkshopCatalogMenu/GlyphCard';
import { STARTER_TESTING_GLYPHS } from '../../components/MageUi/GlyphHotbar';

export class TestingGroundScene extends Phaser.Scene {
  // Selected glyphs passed from Workshop Scene / Store
  private selectedGlyphs: WorkshopGlyphItem[] = [];
  private activeGlyphIndex: number = 0;

  // Oblique Kenney Asset Metrics (256x512 canvas per sprite)
  private readonly PANEL_W = 256;
  private readonly WALL_CONTENT_TOP = 148;
  private readonly WALL_CONTENT_BOTTOM = 377; // Wall content height = 229
  private readonly FLOOR_CONTENT_TOP = 308;
  private readonly FLOOR_CONTENT_BOTTOM = 512;
  private readonly FLOOR_ROW_HEIGHT = 204; // 512 - 308

  // Layout configuration
  private readonly COLS = 6; // 6 * 256 = 1536px room width
  private readonly ROWS = 3; // 3 floor rows deep
  private readonly WALL_Y = 20; // Top margin for back wall panels
  private firstFloorRowY = 0;

  // Player state
  private playerSprite!: Phaser.GameObjects.Sprite;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private playerX = 768; // Center of room
  private playerY = 620; // Standing comfortably on floor row 1
  private playerSpeed = 260; // Pixels per second
  private playerFacing = 'S';
  private isPlayerMoving = false;

  // Input keys
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private spaceKey?: Phaser.Input.Keyboard.Key;

  // 8-direction mapping for Kenney Character sprites (0: NE, 1: E, 2: SE, 3: S, 4: SW, 5: W, 6: NW, 7: N)
  private readonly directions: Record<number, string> = {
    7: 'N', 0: 'NE', 1: 'E', 2: 'SE', 3: 'S', 4: 'SW', 5: 'W', 6: 'NW'
  };

  // Dungeon Prop definitions for interactive props
  private props: Array<{
    key: string;
    x: number;
    y: number;
    originX?: number;
    originY?: number;
    depthOffset?: number;
    scale?: number;
    flipX?: boolean;
  }> = [];

  constructor() {
    super('TestingGroundScene');
  }

  init(data: { glyphs?: WorkshopGlyphItem[] }) {
    this.selectedGlyphs = (data?.glyphs && data.glyphs.length > 0) ? data.glyphs : STARTER_TESTING_GLYPHS;
    this.activeGlyphIndex = 0;
    console.log('[TestingGroundScene] Initialized with oblique setup & glyphs:', this.selectedGlyphs);
  }

  preload() {
    // ------------------------------------------------------------------------
    // 1. Load Kenney "Angle" Sprite Assets (_S oblique projection)
    // ------------------------------------------------------------------------
    // Floor variations (solves single-tile repetition limitation)
    this.load.image('angle_floor_tile', '/kenny/Angle/stoneTile_S.png');
    this.load.image('angle_floor_plain', '/kenny/Angle/stone_S.png');
    this.load.image('angle_floor_uneven', '/kenny/Angle/stoneUneven_S.png');

    // Wall panels
    this.load.image('angle_wall', '/kenny/Angle/stoneWall_S.png');
    this.load.image('angle_wall_door', '/kenny/Angle/stoneWallDoor_S.png');
    this.load.image('angle_wall_window', '/kenny/Angle/stoneWallWindow_S.png');
    this.load.image('angle_wall_corner', '/kenny/Angle/stoneWallCorner_S.png');

    // Props
    this.load.image('angle_column', '/kenny/Angle/stoneColumn_S.png');
    this.load.image('angle_barrel', '/kenny/Angle/barrel_S.png');
    this.load.image('angle_barrels_stacked', '/kenny/Angle/barrelsStacked_S.png');
    this.load.image('angle_chest', '/kenny/Angle/chestClosed_S.png');
    this.load.image('angle_chest_open', '/kenny/Angle/chestOpen_S.png');
    this.load.image('angle_table', '/kenny/Angle/tableRound_S.png');
    this.load.image('angle_stairs', '/kenny/Angle/stairs_S.png');

    // ------------------------------------------------------------------------
    // 2. Load 8-Direction Character Animation Frames
    // ------------------------------------------------------------------------
    for (let dir = 0; dir < 8; dir++) {
      const direction = this.directions[dir];
      this.load.image(`player_idle_${direction}`, `/kenny/Characters/Male/Male_${dir}_Idle0.png`);
      for (let step = 0; step < 10; step++) {
        this.load.image(`player_run_${direction}_${step}`, `/kenny/Characters/Male/Male_${dir}_Run${step}.png`);
      }
    }
  }

  create() {
    // 1. Build Animations
    this.createCharacterAnimations();

    // 2. Compute Wall-to-Floor Junction
    // firstFloorRowY = wallScreenY + 377 - 308 (closes gap cleanly)
    this.firstFloorRowY = this.WALL_Y + (this.WALL_CONTENT_BOTTOM - this.FLOOR_CONTENT_TOP);

    // 3. Build Dungeon Architecture
    this.buildWalls();
    this.buildFloorGrid();
    this.placeDungeonProps();

    // 4. Create Controllable Player Entity
    this.createPlayer();

    // 5. Ambient Lighting & Dungeon Atmosphere
    this.setupAtmosphere();

    // 6. Setup Controls & Input Capture
    this.setupInputs();

    // 7. Setup Camera
    this.setupCamera();

    // 8. Event Listeners for UI Hotbar Integration
    this.setupUiSync();
  }

  /**
   * Constructs animations for all 8 Kenney facing directions.
   */
  private createCharacterAnimations() {
    for (let i = 0; i < 8; i++) {
      const direction = this.directions[i];

      if (!this.anims.exists(`player_idle_${direction}`)) {
        this.anims.create({
          key: `player_idle_${direction}`,
          frames: [{ key: `player_idle_${direction}` }],
          frameRate: 1,
          repeat: -1
        });
      }

      if (!this.anims.exists(`player_run_${direction}`)) {
        this.anims.create({
          key: `player_run_${direction}`,
          frames: Array.from({ length: 10 }, (_, step) => ({
            key: `player_run_${direction}_${step}`
          })),
          frameRate: 14,
          repeat: -1
        });
      }
    }
  }

  /**
   * Lays out back wall panels horizontally side-by-side:
   * x += 256 each step, with door, windows, and corner panels.
   */
  private buildWalls() {
    // Walls occupy the lowest depth layer (10)
    const wallDepth = 10;

    // Pattern across 6 columns: Corner, Window, Door, Wall, Window, Corner
    const wallKeys = [
      'angle_wall_corner',
      'angle_wall_window',
      'angle_wall_door',
      'angle_wall',
      'angle_wall_window',
      'angle_wall_corner'
    ];

    for (let col = 0; col < this.COLS; col++) {
      const x = col * this.PANEL_W;
      const key = wallKeys[col] || 'angle_wall';

      const wall = this.add.image(x, this.WALL_Y, key);
      wall.setOrigin(0, 0);
      wall.depth = wallDepth;

      // Flip right corner for symmetry
      if (col === this.COLS - 1) {
        wall.setFlipX(true);
      }
    }
  }

  /**
   * Lays out floor rows:
   * Horizontally: x += 256
   * Vertically: Stacked by content height (204px) to overlap cleanly without gaps.
   * Alternates floor textures to eliminate predictable repetition of the loose stone detail.
   */
  private buildFloorGrid() {
    // Floor variations available in pack
    const floorTileTypes = ['angle_floor_plain', 'angle_floor_tile', 'angle_floor_uneven'];

    for (let row = 0; row < this.ROWS; row++) {
      const rowY = this.firstFloorRowY + (row * this.FLOOR_ROW_HEIGHT);
      // Floor rows depth-sorted in ascending order: farther rows behind nearer ones
      const rowDepth = 20 + (row * 20);

      for (let col = 0; col < this.COLS; col++) {
        const colX = col * this.PANEL_W;

        // Pseudo-random deterministic choice of floor variant
        const variantIndex = (row * 3 + col * 2 + (row % 2)) % floorTileTypes.length;
        const tileKey = floorTileTypes[variantIndex];

        const floorTile = this.add.image(colX, rowY, tileKey);
        floorTile.setOrigin(0, 0);
        floorTile.depth = rowDepth;
      }
    }
  }

  /**
   * Places decorative props positioned on floor rows.
   * Origins set to (0.5, 1) bottom-center so props visually stand firmly on the ground plane.
   */
  private placeDungeonProps() {
    // Ground Y positions correspond to floor row bases:
    // Row 0 base: firstFloorRowY + 512
    // Row 1 base: firstFloorRowY + 204 + 512
    // Row 2 base: firstFloorRowY + 408 + 512
    const row0Base = this.firstFloorRowY + 512;
    const row1Base = this.firstFloorRowY + this.FLOOR_ROW_HEIGHT + 512;
    const row2Base = this.firstFloorRowY + (this.FLOOR_ROW_HEIGHT * 2) + 512;

    const propList = [
      // Left dungeon stairs descending from upper floor
      { key: 'angle_stairs', x: 130, y: row0Base - 70, depth: 32, scale: 0.95 },

      // Columns framing back walls & corners
      { key: 'angle_column', x: 260, y: row0Base - 15, depth: 34 },
      { key: 'angle_column', x: 1280, y: row0Base - 15, depth: 34 },

      // Alchemy / study table in the right alcove
      { key: 'angle_table', x: 1150, y: row1Base - 60, depth: 55, scale: 1.0 },

      // Treasure chests
      { key: 'angle_chest', x: 1270, y: row1Base - 40, depth: 56, scale: 0.95 },
      { key: 'angle_chest_open', x: 180, y: row2Base - 50, depth: 75, scale: 0.9 },

      // Stacked and single barrels
      { key: 'angle_barrels_stacked', x: 420, y: row0Base - 10, depth: 35, scale: 0.95 },
      { key: 'angle_barrel', x: 370, y: row0Base + 5, depth: 36, scale: 0.9 },
      { key: 'angle_barrel', x: 1360, y: row2Base - 30, depth: 76, scale: 0.95 },
      { key: 'angle_barrel', x: 1410, y: row2Base - 50, depth: 74, scale: 0.9 },
    ];

    for (const prop of propList) {
      const sprite = this.add.image(prop.x, prop.y, prop.key);
      sprite.setOrigin(0.5, 1);
      sprite.depth = prop.depth;
      if (prop.scale) sprite.setScale(prop.scale);
    }
  }

  /**
   * Instantiates the wizard player with soft shadow, initial idle animation,
   * and bottom-anchor alignment.
   */
  private createPlayer() {
    // Soft ground shadow beneath character's feet
    this.playerShadow = this.add.ellipse(this.playerX, this.playerY - 4, 38, 16, 0x000000, 0.35);

    // Character sprite (origin row 450 of 512 puts feet directly on the ground)
    this.playerSprite = this.add.sprite(this.playerX, this.playerY, 'player_idle_S');
    this.playerSprite.setOrigin(0.5, 450 / 512);
    this.playerSprite.setScale(0.85);

    this.updatePlayerDepth();
  }

  /**
   * Sets up subtle arcane atmosphere, ambient torchlight glow, and ground sigil runes.
   */
  private setupAtmosphere() {
    // Arcane testing glyph circle in center of the arena
    const runeX = 768;
    const runeY = this.firstFloorRowY + this.FLOOR_ROW_HEIGHT + 390;

    const outerRune = this.add.ellipse(runeX, runeY, 210, 80);
    outerRune.setStrokeStyle(2, 0xd4af37, 0.4);
    outerRune.depth = 41;

    const innerRune = this.add.ellipse(runeX, runeY, 140, 52);
    innerRune.setStrokeStyle(1.5, 0x5eead4, 0.5);
    innerRune.depth = 42;

    // Subtle pulsing animation on the arcane circle
    this.tweens.add({
      targets: [outerRune, innerRune],
      alpha: { from: 0.3, to: 0.75 },
      scaleX: { from: 0.98, to: 1.02 },
      scaleY: { from: 0.98, to: 1.02 },
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Ambient torchlight / glow effects near windows and columns
    const torchGlow1 = this.add.ellipse(256 + 128, this.WALL_Y + 230, 80, 80, 0xffd580, 0.12);
    torchGlow1.depth = 15;
    const torchGlow2 = this.add.ellipse(1024 + 128, this.WALL_Y + 230, 80, 80, 0xffd580, 0.12);
    torchGlow2.depth = 15;
  }

  /**
   * Configures camera zoom and boundary constraints so the room is framed attractively.
   */
  private setupCamera() {
    const totalRoomWidth = this.COLS * this.PANEL_W; // 1536
    const totalRoomHeight = this.firstFloorRowY + (this.ROWS * this.FLOOR_ROW_HEIGHT) + (512 - this.FLOOR_CONTENT_BOTTOM) + 120;

    this.cameras.main.setBounds(0, 0, totalRoomWidth, totalRoomHeight);
    this.cameras.main.setZoom(0.92);
    this.cameras.main.centerOn(totalRoomWidth / 2, totalRoomHeight / 2 - 20);
  }

  /**
   * Binds WASD, cursor keys, Space (cast spell), and pointer clicks.
   */
  private setupInputs() {
    if (!this.input.keyboard) return;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasdKeys = this.input.keyboard.addKeys({
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
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Prevent default capture lock so user typing in inputs isn't blocked
    const keyboard = this.input.keyboard as any;
    if (keyboard?.removeCapture) {
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

    // Pointer click in arena triggers arcane cast towards click position
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.castSpell(pointer.worldX, pointer.worldY);
    });
  }

  /**
   * Synchronizes hotbar selection events with this scene.
   */
  private setupUiSync() {
    const onHotbarSelect = (e: Event) => {
      const customEvt = e as CustomEvent<{ index: number; glyph: WorkshopGlyphItem }>;
      if (customEvt.detail) {
        this.activeGlyphIndex = customEvt.detail.index;
        console.log('[TestingGroundScene] Active glyph slot changed to:', this.activeGlyphIndex, customEvt.detail.glyph?.name);
      }
    };

    window.addEventListener('glyph-hotbar-select', onHotbarSelect);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('glyph-hotbar-select', onHotbarSelect);
    });
  }

  /**
   * Launches an elemental spell projectile and particle bursts towards a target coordinate.
   */
  private castSpell(targetX: number, targetY: number) {
    const currentGlyph = this.selectedGlyphs[this.activeGlyphIndex] || this.selectedGlyphs[0];
    const elementColors: Record<string, string> = {
      fire: '#f97316',
      water: '#38bdf8',
      earth: '#a3e635',
      air: '#e2e8f0',
    };
    const glyphColorHex = elementColors[currentGlyph?.element || 'fire'] || '#38bdf8';
    const colorInt = Phaser.Display.Color.HexStringToColor(glyphColorHex).color;

    // Origin point: player's staff hand
    const startX = this.playerX + (this.playerFacing.includes('W') ? -16 : 16);
    const startY = this.playerY - 32;

    // Spell projectile orb
    const projectile = this.add.circle(startX, startY, 8, colorInt, 0.95);
    projectile.setStrokeStyle(2, 0xffffff, 0.8);
    projectile.depth = this.playerSprite.depth + 10;

    // Trailing trail
    const angle = Phaser.Math.Angle.Between(startX, startY, targetX, targetY);
    const distance = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
    const duration = Math.min(650, Math.max(220, (distance / 450) * 500));

    this.tweens.add({
      targets: projectile,
      x: targetX,
      y: targetY,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => {
        projectile.destroy();
        this.createImpactBurst(targetX, targetY, colorInt);
      }
    });
  }

  /**
   * Arcane explosion particle effect upon spell contact.
   */
  private createImpactBurst(x: number, y: number, colorInt: number) {
    // Expanding flash ring
    const ring = this.add.circle(x, y, 6, colorInt, 0.8);
    ring.setStrokeStyle(3, 0xffffff, 0.9);
    ring.depth = 95;

    this.tweens.add({
      targets: ring,
      scale: 3.5,
      alpha: 0,
      duration: 350,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy()
    });

    // Particle sparks
    for (let i = 0; i < 12; i++) {
      const sparkAngle = (i / 12) * Math.PI * 2 + (Math.random() * 0.4);
      const speed = Phaser.Math.Between(40, 110);
      const spark = this.add.circle(x, y, Phaser.Math.Between(2, 4), colorInt, 0.9);
      spark.depth = 96;

      this.tweens.add({
        targets: spark,
        x: x + Math.cos(sparkAngle) * speed,
        y: y + Math.sin(sparkAngle) * speed,
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(250, 480),
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy()
      });
    }
  }

  /**
   * Dynamically depth-sorts the player and shadow based on vertical screen Y position.
   */
  private updatePlayerDepth() {
    // Floor row 0: 20-39, row 1: 40-59, row 2: 60-79.
    // We map player's y continuously to an appropriate depth layer:
    const baseFloorY = this.firstFloorRowY + 308;
    const normalizedY = Phaser.Math.Clamp((this.playerY - baseFloorY) / (this.ROWS * this.FLOOR_ROW_HEIGHT), 0, 1);
    const dynamicDepth = 25 + (normalizedY * 60);

    this.playerShadow.depth = dynamicDepth - 0.5;
    this.playerSprite.depth = dynamicDepth;
  }

  /**
   * Update loop: handles smooth player movement, bounds checking on the dungeon floor,
   * 8-directional animation transitions, and camera centering.
   */
  override update(_time: number, delta: number) {
    if (!this.playerSprite) return;

    // Check if user is typing in a text field
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const isTyping = activeEl instanceof HTMLInputElement ||
      activeEl instanceof HTMLTextAreaElement ||
      activeEl?.getAttribute('contenteditable') === 'true';

    let moveX = 0;
    let moveY = 0;

    if (!isTyping) {
      if (this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown) moveX -= 1;
      if (this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown) moveX += 1;
      if (this.cursors?.up?.isDown || this.wasdKeys?.W?.isDown) moveY -= 1;
      if (this.cursors?.down?.isDown || this.wasdKeys?.S?.isDown) moveY += 1;

      // Space key cast spell straight ahead
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey!)) {
        const castOffset = 180;
        let targetX = this.playerX;
        let targetY = this.playerY;
        if (this.playerFacing.includes('N')) targetY -= castOffset;
        if (this.playerFacing.includes('S')) targetY += castOffset;
        if (this.playerFacing.includes('E')) targetX += castOffset;
        if (this.playerFacing.includes('W')) targetX -= castOffset;
        this.castSpell(targetX, targetY);
      }
    }

    const isMoving = moveX !== 0 || moveY !== 0;

    if (isMoving) {
      // 1. Determine 8-directional facing
      if (moveX > 0 && moveY < 0) this.playerFacing = 'NE';
      else if (moveX > 0 && moveY > 0) this.playerFacing = 'SE';
      else if (moveX < 0 && moveY < 0) this.playerFacing = 'NW';
      else if (moveX < 0 && moveY > 0) this.playerFacing = 'SW';
      else if (moveX > 0) this.playerFacing = 'E';
      else if (moveX < 0) this.playerFacing = 'W';
      else if (moveY < 0) this.playerFacing = 'N';
      else if (moveY > 0) this.playerFacing = 'S';

      // 2. Play running animation
      this.playerSprite.play(`player_run_${this.playerFacing}`, true);

      // 3. Move player with normalized speed vector
      const length = Math.hypot(moveX, moveY);
      const step = (this.playerSpeed * delta) / 1000;
      const dx = (moveX / length) * step;
      const dy = (moveY / length) * step;

      // 4. Clamped boundaries within the walkable dungeon room floor
      const minX = 70;
      const maxX = (this.COLS * this.PANEL_W) - 70;
      // Floor begins below back walls: firstFloorRowY + 308 (ground surface)
      const minY = this.firstFloorRowY + 325;
      const maxY = this.firstFloorRowY + (this.ROWS * this.FLOOR_ROW_HEIGHT) + 260;

      this.playerX = Phaser.Math.Clamp(this.playerX + dx, minX, maxX);
      this.playerY = Phaser.Math.Clamp(this.playerY + dy, minY, maxY);

      this.isPlayerMoving = true;
    } else {
      if (this.isPlayerMoving) {
        this.playerSprite.play(`player_idle_${this.playerFacing}`, true);
        this.isPlayerMoving = false;
      }
    }

    // Sync visual positions
    this.playerSprite.x = this.playerX;
    this.playerSprite.y = this.playerY;
    this.playerShadow.x = this.playerX;
    this.playerShadow.y = this.playerY - 2;

    this.updatePlayerDepth();

    // Smooth camera tracking
    this.cameras.main.pan(
      this.playerX,
      this.playerY - 40,
      250,
      'Linear',
      true
    );
  }
}
