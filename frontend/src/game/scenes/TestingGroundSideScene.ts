import Phaser from 'phaser';
import type { WorkshopGlyphItem } from '../../components/WorkshopCatalogMenu/GlyphCard';
import { STARTER_TESTING_GLYPHS } from '../../components/MageUi/GlyphHotbar';
import { useGameStore } from '../../lib/stores/store';
import { GameplayGlyph } from '../entities/GameplayGlyph';
import { executeGlyphActivation, resolveGlyphElement, ELEMENTAL_COLORS } from '../engine/glyph_activation';
import { SideTrainingDummy } from '../entities/SideTrainingDummy';
import { DamageEngine } from '../engine/damage_engine';

const GLYPH_COLORS = ELEMENTAL_COLORS;

export class TestingGroundSideScene extends Phaser.Scene {
  private height!: number;
  private width!: number;

  private activeGlyphIndex: number = 0;
  private selectedGlyphs: WorkshopGlyphItem[] = [];
  private placedGlyphs: GameplayGlyph[] = [];
  private placedGlyphColliders!: Phaser.Physics.Arcade.StaticGroup;

  // Active glyph interaction states
  private selectedPlacedGlyph: GameplayGlyph | null = null;

  // Combat training dummy for phenomena testing
  public dummy!: SideTrainingDummy;
  private unsubCombatText?: () => void;

  // Groups and objects
  public floorGroup!: Phaser.Physics.Arcade.StaticGroup;
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private placeGlyphKey!: Phaser.Input.Keyboard.Key;
  private holdGlyphKey!: Phaser.Input.Keyboard.Key;
  private aimKey!: Phaser.Input.Keyboard.Key;
  private pickupGlyphKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;

  private isAiming: boolean = false;
  private aimGraphic: Phaser.GameObjects.Graphics | null = null;




  private onGlyphSelect = (event: Event) => {
    const customEvt = event as CustomEvent;
    const { index, glyph } = customEvt.detail;
    this.activeGlyphIndex = index;
    if (glyph) {
      this.selectedGlyphs[index] = glyph;
    }
  };

  private onGlyphCast = (event: Event) => {
    const customEvt = event as CustomEvent;
    const { glyph } = customEvt.detail;
    if (!glyph) return;

    // Update active hotbar slot with drawn glyph
    this.selectedGlyphs[this.activeGlyphIndex] = glyph;

    // Cast projectile in the direction player is facing
    const isLeft = this.player ? this.player.flipX : false;
    const originX = this.player ? this.player.x + (isLeft ? -45 : 45) : 200;
    const originY = this.player ? this.player.y - 145 : 300;
    const targetX = this.player
      ? (isLeft ? this.player.x - 500 : this.player.x + 500)
      : 600;
    const targetY = originY;

    executeGlyphActivation({
      scene: this,
      glyph: glyph,
      state: 'held',
      origin: { x: originX, y: originY },
      target: { x: targetX, y: targetY },
      targets: this.dummy,
    });
  };

  constructor() {
    super({ key: 'TestingGroundSideScene' });
  }

  init(data: { glyphs: WorkshopGlyphItem[] }) {
    this.selectedGlyphs = (data && data.glyphs && data.glyphs.length > 0)
      ? data.glyphs
      : [...STARTER_TESTING_GLYPHS];

    // Listen for UI glyph selection and dynamic drawn spell casting
    window.addEventListener('glyph-hotbar-select', this.onGlyphSelect);
    window.addEventListener('glyph-cast', this.onGlyphCast);
  }

  preload() {
    this.load.image('side_wall', '/backgrounds/Dungeon_brick_wall_grey.png');
    this.load.image('placeholder_glyph', '/assets/Scroll_Tile_4.1.png');
    this.load.image('parchment_held', '/assets/parchment_held.png');
    this.load.atlas('sigils', '/sigils/atlas/sigils-atlas.png', '/sigils/atlas/sigils-atlas.json');
    this.load.spritesheet('player_idle', '/idle/alex_directional_spritesheet.png', {
      frameWidth: 256,
      frameHeight: 256,
      margin: 0,
      spacing: 0,
    });
    // Loading the walking/running sprite sheet (5888x256 -> 23 frames of 256x256)
    this.load.spritesheet('player_walk', '/sprites/alex_walking_spritesheet_v2.png', {
      frameWidth: 256,
      frameHeight: 256,
      margin: 0,
      spacing: 0,
    });
    this.load.spritesheet('player_jump', '/sprites/alex_jumping_spritesheet.png', {
      frameWidth: 256,
      frameHeight: 256,
      margin: 0,
      spacing: 0,
    });
    this.load.spritesheet('player_place_glyph', '/sprites/alex_place_spritesheet.png', {
      frameWidth: 256,
      frameHeight: 256,
      margin: 0,
      spacing: 0,
    });
    this.load.spritesheet('player_aim_glyph', '/sprites/alex_attack_spritesheet.png', {
      frameWidth: 256,
      frameHeight: 256,
      margin: 0,
      spacing: 0,
    });

  }

  generateTextures() {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Wall (only fallback if image asset wasn't loaded)
    if (!this.textures.exists('side_wall')) {
      g.fillStyle(0x555555);
      g.fillRect(0, 0, 128, 128);
      g.lineStyle(2, 0x333333);
      g.strokeRect(0, 0, 128, 128);
      g.beginPath(); g.moveTo(0, 64); g.lineTo(128, 64); g.strokePath();
      g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 64); g.strokePath();
      g.generateTexture('side_wall', 128, 128);
      g.clear();
    }

    // Floor - Normal Side-Scroller Flat Dungeon Platform
    if (!this.textures.exists('side_floor')) {
      const tileW = 96;

      // 1. Top Flat Ledge / Surface Border (y: 0 to 4)
      g.fillStyle(0x7e7e8c); // Top highlight rim
      g.fillRect(0, 0, tileW, 2);
      g.fillStyle(0x3a3a44); // Under-rim bevel shadow
      g.fillRect(0, 2, tileW, 2);

      // 2. Front Vertical Dungeon Stone Masonry (y: 4 to 128)
      g.fillStyle(0x42424c);
      g.fillRect(0, 4, tileW, 124);

      // Horizontal mortar lines
      g.fillStyle(0x222228);
      g.fillRect(0, 34, tileW, 2);
      g.fillRect(0, 66, tileW, 2);
      g.fillRect(0, 98, tileW, 2);

      // Staggered vertical brick seams (clean flat grid)
      // Row 1 (4 to 34)
      g.fillRect(0, 4, 2, 30);
      g.fillRect(48, 4, 2, 30);
      // Row 2 (34 to 66)
      g.fillRect(24, 34, 2, 32);
      g.fillRect(72, 34, 2, 32);
      // Row 3 (66 to 98)
      g.fillRect(0, 66, 2, 32);
      g.fillRect(48, 66, 2, 32);
      // Row 4 (98 to 128)
      g.fillRect(24, 98, 2, 30);
      g.fillRect(72, 98, 2, 30);

      // Subtle stone brick highlights
      g.fillStyle(0x565662, 0.45);
      g.fillRect(2, 6, 44, 1);
      g.fillRect(50, 6, 44, 1);
      g.fillRect(26, 36, 44, 1);
      g.fillRect(74, 36, 20, 1);

      g.generateTexture('side_floor', tileW, 128);
      g.clear();
    }

    if (!this.textures.exists('side_chest')) {
      // Chest
      g.fillStyle(0x8B4513);
      g.fillRect(0, 0, 64, 64);
      g.lineStyle(4, 0x5C4033);
      g.strokeRect(0, 0, 64, 64);
      g.generateTexture('side_chest', 64, 64);
      g.clear();
    }

    if (!this.textures.exists('side_torch')) {
      // Torch
      g.fillStyle(0xFFD700);
      g.fillRect(0, 0, 32, 64);
      g.generateTexture('side_torch', 32, 64);
    }
    g.destroy();
  }

  create() {
    // Enable gravity and prevent high-speed tunneling through ground
    this.physics.world.gravity.y = 800;
    this.physics.world.OVERLAP_BIAS = 24;

    // Turn on hitbox visualizer (debug graphics)
    this.physics.world.drawDebug = false;
    /*  if (!this.physics.world.debugGraphic) {
        this.physics.world.createDebugGraphic();
      }*/

    // Generate textures at runtime (fallbacks only)
    this.generateTextures();

    // Canvas dimensions are 1280x720 from config
    this.width = this.game.config.width as number;
    this.height = this.game.config.height as number;

    // 1. Draw Background Wall (render behind everything)
    const wall = this.add.image(0, 0, 'side_wall');
    wall.setDisplaySize(this.width, this.height);
    wall.setOrigin(0, 0);
    wall.setDepth(-10);

    // 2. Setup Physics Floor
    this.floorGroup = this.physics.add.staticGroup();

    // Individual visual tiles (96px wide, containing two 48px slabs matching Scroll_Tile.png)
    const tileW = 96;
    for (let x = 0; x < this.width + tileW; x += tileW) {
      const floorTile = this.add.image(x + tileW / 2, this.height - 64, 'side_floor');
      floorTile.setDisplaySize(tileW, 128);
      floorTile.setDepth(-1);
    }

    // Walking surface: Flat horizontal floor at top of platform tiles (height - 128)
    const walkingSurfaceY = this.height - 128;
    const solidFloor = this.add.rectangle(this.width / 2, walkingSurfaceY + 64, this.width, 128);
    this.physics.add.existing(solidFloor, true);
    this.floorGroup.add(solidFloor);

    // 3. Props
    const chest = this.add.image(1000, this.height - 128 - 32, 'side_chest');
    chest.setDisplaySize(64, 64);

    const torch1 = this.add.image(300, 300, 'side_torch');
    torch1.setDisplaySize(32, 64);
    const torch2 = this.add.image(900, 300, 'side_torch');
    torch2.setDisplaySize(32, 64);

    // 3.5. Spawn Side Training Dummy for Combat & Phenomena testing
    this.dummy = new SideTrainingDummy(this, {
      x: 880,
      y: walkingSurfaceY,
      maxHp: 1000,
      maxPoise: 100,
      armor: 4,
    });

    // 3.6. Register floating combat text listener
    this.unsubCombatText = DamageEngine.onCombatText((evt) => {
      const hexColor = '#' + evt.color.toString(16).padStart(6, '0');
      const text = this.add.text(evt.x, evt.y - 40, evt.text, {
        fontSize: '16px',
        fontStyle: 'bold',
        color: hexColor,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5, 0.5).setDepth(40);

      this.tweens.add({
        targets: text,
        y: text.y - 35,
        alpha: 0,
        duration: 800,
        ease: 'Cubic.easeOut',
        onComplete: () => text.destroy(),
      });
    });

    // 4. Character
    // Spawn in the air above the floor (floor surface is at walkingSurfaceY)
    this.player = this.physics.add.sprite(200, this.height - 260, 'player_idle', 2);
    // Align origin to bottom-center (feet anchored) so swapping animation frames never shifts vertical position
    this.player.setOrigin(0.5, 1);
    this.player.setCollideWorldBounds(true);

    // Synchronize physics body to stay consistent across idle and walking/running frames
    const syncHitbox = () => {
      if (!this.player || !this.player.body) return;

      const currentAnim = this.player.anims.currentAnim?.key;
      const isPlacing = currentAnim === 'player_place_glyph';
      const isAiming = currentAnim === 'player_aim_glyph';

      // Normal standing: 80x202. Placing/crouching: 105x130 (wider reach, lower ceiling). Aiming: 90x202
      const hitboxW = isPlacing ? 105 : (isAiming ? 90 : 80);
      const hitboxH = isPlacing ? 130 : 202;
      const bottomPadding = 28;

      // Center horizontally, anchor to baseline above bottom padding
      this.player.body.setSize(hitboxW, hitboxH);
      this.player.body.setOffset(
        (this.player.width - hitboxW) / 2,
        this.player.height - hitboxH - bottomPadding
      );
    };

    syncHitbox();
    this.player.on('animationstart', syncHitbox);

    this.physics.add.collider(this.player, this.floorGroup);

    // 5. Placed Glyph Colliders (Separate trigger zones)
    this.placedGlyphColliders = this.physics.add.staticGroup();
    this.physics.add.overlap(this.player, this.placedGlyphColliders, (_player, colliderObj) => {
      const glyph = (colliderObj as Phaser.GameObjects.Zone).getData('glyph') as GameplayGlyph | undefined;
      if (glyph && !glyph.isActivated) {
        // Can be triggered when stepped on or in proximity
      }
    });

    // Listen for direct clicks on gameplay glyphs to select and activate
    this.events.on('gameplay-glyph-clicked', (glyph: GameplayGlyph) => {
      if (this.selectedPlacedGlyph && this.selectedPlacedGlyph !== glyph) {
        this.selectedPlacedGlyph.select(false);
      }
      this.selectedPlacedGlyph = glyph;
      glyph.select(true);

      // Immediately attempt activation if player is within 1/2 tile (64px)
      this.handle_activation();
    });

    // Animations
    this.anims.create({
      key: 'player_idle',
      frames: [{ key: 'player_idle', frame: 2 }],
    });
    this.anims.create({
      key: 'player_jump',
      frames: this.anims.generateFrameNumbers('player_jump', { start: 0, end: 7 }),
      frameRate: 14,
      repeat: 0,
    });
    this.anims.create({
      key: 'player_walk',
      frames: this.anims.generateFrameNumbers('player_walk', { start: 0, end: 21 }),
      frameRate: 18,
      repeat: -1,
    });
    this.anims.create({
      key: 'player_pickup_glyph',
      frames: this.anims.generateFrameNumbers('player_place_glyph', { start: 0, end: 5 }).reverse(),
      frameRate: 8,
      repeat: 0,
    });
    this.anims.create({
      key: 'player_place_glyph',
      frames: this.anims.generateFrameNumbers('player_place_glyph', { start: 0, end: 8 }),
      frameRate: 8,
      repeat: 0,
    });
    this.anims.create({
      key: 'player_aim_glyph',
      frames: this.anims.generateFrameNumbers('player_aim_glyph', { start: 0, end: 10 }),
      frameRate: 12,
      repeat: 0,
    });


    // Inputs
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as any;
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.holdGlyphKey = this.input.keyboard!.addKey('F');
    this.aimKey = this.input.keyboard!.addKey('R');
    this.placeGlyphKey = this.input.keyboard!.addKey('G');
    this.pickupGlyphKey = this.input.keyboard!.addKey('E');

    // Input for casting spell / activating glyph
    this.input.on('pointerdown', this.handlePointerDown, this);

    //Setup Camera
    this.setupCamera();
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
  }

  update(time: number, delta: number) {
    if (!this.player) return;

    // 1. Tick combat dummy phenomena & status effects (burning, poise recovery, etc.)
    if (this.dummy) {
      this.dummy.tick(delta);
    }

    const speed = 200;
    let isMoving = false;

    const isPlacing = this.player.anims.currentAnim?.key === 'player_place_glyph' || this.player.anims.currentAnim?.key === 'player_pickup_glyph';
    const onGround = this.player.body!.touching.down || this.player.body!.blocked.down;

    // Cancel Aim Mode with F
    if (this.isAiming && Phaser.Input.Keyboard.JustDown(this.holdGlyphKey)) {
      this.exitAimState();
    }

    // Aim Facing & Trajectory Visualizer
    if (this.isAiming) {
      const pointer = this.input.activePointer;
      // Convert current screen mouse coordinates to exact camera world space
      const targetWorld = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.player.setFlipX(targetWorld.x < this.player.x);

      if (this.aimGraphic) {
        const isLeft = this.player.flipX;
        const startX = this.player.x + (isLeft ? -45 : 45);
        const startY = this.player.y - 145;

        // Tint reticle and trajectory line to match active glyph's element
        const activeGlyph = this.selectedGlyphs[this.activeGlyphIndex];
        const elemColor = activeGlyph ? resolveGlyphElement(activeGlyph).color : 0xff7733;

        this.aimGraphic.clear();
        this.aimGraphic.lineStyle(2, elemColor, 0.85);
        this.aimGraphic.lineBetween(startX, startY, targetWorld.x, targetWorld.y);
        this.aimGraphic.strokeCircle(targetWorld.x, targetWorld.y, 8);
        this.aimGraphic.fillStyle(elemColor, 0.6);
        this.aimGraphic.fillCircle(targetWorld.x, targetWorld.y, 3);
      }
    } else if (this.aimGraphic) {
      this.aimGraphic.clear();
    }

    // 2. Jump input: snappy, responsive platformer jump
    const jumpRequested = Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.wasd.W) ||
      Phaser.Input.Keyboard.JustDown(this.spaceKey);

    if (!this.isAiming && !isPlacing && jumpRequested && onGround) {
      this.player.setVelocityY(-450);
    }

    // 3. Horizontal movement (allowed when not aiming or placing)
    if (!this.isAiming && !isPlacing) {
      if (this.cursors.left.isDown || this.wasd.A.isDown) {
        this.player.setVelocityX(-speed);
        this.player.setFlipX(true);
        isMoving = true;
      } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
        this.player.setVelocityX(speed);
        this.player.setFlipX(false);
        isMoving = true;
      } else {
        this.player.setVelocityX(0);
      }
    } else {
      this.player.setVelocityX(0);
    }

    // 4. Action inputs (aim toggle, glyph pickup, glyph place)
    if (Phaser.Input.Keyboard.JustDown(this.aimKey)) {
      if (this.isAiming) {
        this.exitAimState();
      } else if (onGround && !isPlacing) {
        this.enterAimState();
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.pickupGlyphKey) && !this.isAiming && !isPlacing) {
      const pickedUp = this.pickupNearestGlyph();
      if (pickedUp) {
        this.player.setVelocityX(0);
        this.player.anims.play('player_pickup_glyph', true)
          .once('animationcomplete', () => {
            this.player.anims.play('player_idle', true);
          });
      }
    } else if (onGround && !this.isAiming && !isPlacing && (Phaser.Input.Keyboard.JustDown(this.placeGlyphKey) || Phaser.Input.Keyboard.JustDown(this.holdGlyphKey))) {
      this.triggerPlaceGlyph();
    }

    // 5. Animation state machine
    if (isPlacing) {
      // Placing or picking up animation in progress: do not override
      return;
    }

    if (this.isAiming) {
      if (this.player.anims.currentAnim?.key !== 'player_aim_glyph') {
        this.player.anims.play('player_aim_glyph', true);
      }
    } else if (!onGround) {
      // In mid-air (jumping or falling)
      if (this.player.anims.currentAnim?.key !== 'player_jump') {
        this.player.anims.play('player_jump', true);
      }
    } else if (isMoving) {
      // Walking on ground
      this.player.anims.play('player_walk', true);
    } else {
      // Standing idle on ground
      this.player.anims.play('player_idle', true);
    }
  }
  private setupCamera() {
    this.cameras.main.setBounds(0, 0, this.width, this.height);
    this.cameras.main.setZoom(1.25);
    this.cameras.main.centerOn(this.width / 2, this.height / 2 - 20);
  }

  private activeFeedbackPrompt: Phaser.GameObjects.Text | null = null;

  /**
   * Enters the aim state directly (aim with mouse & click to cast)
   */
  private enterAimState() {
    const activeGlyph = this.selectedGlyphs[this.activeGlyphIndex];
    if (!activeGlyph) {
      this.showFeedbackPrompt(this.player.x, this.player.y - 165, 'Select a glyph first!');
      return;
    }

    this.isAiming = true;
    if (this.player) {
      this.player.setVelocityX(0);
      this.player.anims.play('player_aim_glyph');
    }
    if (!this.aimGraphic) {
      this.aimGraphic = this.add.graphics();
      this.aimGraphic.setDepth(25);
    }

    this.showFeedbackPrompt(this.player.x, this.player.y - 165, 'Aim with mouse & Click to Cast! [F or R to Cancel]');
    useGameStore.getState().setGlyphHeldState('aim');
  }

  /**
   * Exits aim state
   */
  private exitAimState() {
    this.isAiming = false;
    if (this.aimGraphic) {
      this.aimGraphic.clear();
    }
    useGameStore.getState().setGlyphHeldState('none');
    if (this.player) {
      this.player.anims.play('player_idle', true);
    }
  }

  /**
   * Triggers the player kneel animation and places the active glyph on the floor
   */
  private triggerPlaceGlyph() {
    const activeGlyph = this.selectedGlyphs[this.activeGlyphIndex];
    if (!activeGlyph) {
      this.showFeedbackPrompt(this.player.x, this.player.y - 120, 'Select a glyph first!');
      return;
    }

    this.player.setVelocityX(0);
    this.exitAimState();
    useGameStore.getState().setGlyphHeldState('place');

    this.player.anims.play('player_place_glyph', true)
      .once('animationcomplete', () => {
        this.placeGlyph();
        this.player.anims.play('player_idle', true);
        useGameStore.getState().setGlyphHeldState('none');
      });
  }

  /**
   * Picks up the nearest placed glyph within generous range (96px horizontal, 64px vertical).
   */
  public pickupNearestGlyph(): boolean {
    const playerFeetY = this.player.body ? this.player.body.bottom : this.player.y;
    let nearestGlyph: GameplayGlyph | null = null;
    let minDistance = Infinity;

    for (const g of this.placedGlyphs) {
      if (g.state === 'placed' && !g.isActivated) {
        const dx = Math.abs(this.player.x - g.x);
        const dy = Math.abs(playerFeetY - g.y);
        if (dx <= 96 && dy <= 64) {
          const dist = dx + dy;
          if (dist < minDistance) {
            minDistance = dist;
            nearestGlyph = g;
          }
        }
      }
    }

    // If an explicitly selected placed glyph is within reach
    if (!nearestGlyph && this.selectedPlacedGlyph && !this.selectedPlacedGlyph.isActivated) {
      const dx = Math.abs(this.player.x - this.selectedPlacedGlyph.x);
      const dy = Math.abs(playerFeetY - this.selectedPlacedGlyph.y);
      if (dx <= 96 && dy <= 64) {
        nearestGlyph = this.selectedPlacedGlyph;
      }
    }

    if (nearestGlyph) {
      this.executePickup(nearestGlyph);
      return true;
    } else {
      this.showFeedbackPrompt(this.player.x, this.player.y - 120, 'No glyph nearby to pick up');
      return false;
    }

  }

  /**
   * Executes pickup: removes the placed glyph, plays sparkle feedback, and returns to inventory.
   */
  public executePickup(glyph: GameplayGlyph): void {
    // 1. Remove from placed array and colliders group
    this.placedGlyphs = this.placedGlyphs.filter((g) => g !== glyph);
    if (glyph.collider && this.placedGlyphColliders) {
      this.placedGlyphColliders.remove(glyph.collider);
    }
    if (this.selectedPlacedGlyph === glyph) {
      this.selectedPlacedGlyph = null;
    }
    glyph.select(false);

    // 2. Play subtle ground pickup sparkle
    const burst = this.add.circle(glyph.x, glyph.y, 8, glyph.color, 0.85);
    this.tweens.add({
      targets: burst,
      scale: 2.2,
      alpha: 0,
      duration: 250,
      ease: 'Quad.easeOut',
      onComplete: () => burst.destroy(),
    });

    // 3. Destroy glyph GameObject
    glyph.destroy();
    this.showFeedbackPrompt(this.player.x, this.player.y - 120, `Picked up ${glyph.glyphName}!`);

    // Dispatch window event so React UI / Hotbar can sync
    window.dispatchEvent(
      new CustomEvent('glyph-picked-up', {
        detail: { glyph: glyph.glyphData, uuid: glyph.uuid },
      })
    );
    useGameStore.getState().setGlyphHeldState('none');
  }

  /**
   * Activates a placed glyph selected by clicking if player is within reach
   */
  public handle_activation(): boolean {
    const halfTileDistance = 64; // 128px / 2 = 64px
    if (this.selectedPlacedGlyph && !this.selectedPlacedGlyph.isActivated) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.selectedPlacedGlyph.x,
        this.selectedPlacedGlyph.y
      );

      if (dist <= halfTileDistance) {
        console.log('[handle_activation] Activating selected placed glyph within 1/2 tile:', this.selectedPlacedGlyph.glyphName, 'dist:', dist.toFixed(1));
        const activated = this.selectedPlacedGlyph.activate(this.selectedPlacedGlyph.uuid);
        return activated;
      } else {
        console.log('[handle_activation] Player too far from selected glyph! Dist:', dist.toFixed(1), 'Required <=', halfTileDistance);
        this.showFeedbackPrompt(this.selectedPlacedGlyph.x, this.selectedPlacedGlyph.y - 24, 'Too far! (Walk closer)');
        return false;
      }
    }

    return false;
  }



  private showFeedbackPrompt(x: number, y: number, text: string) {
    if (this.activeFeedbackPrompt) {
      this.activeFeedbackPrompt.destroy();
      this.activeFeedbackPrompt = null;
    }

    const txt = this.add.text(x, y, text, {
      fontSize: '13px',
      color: '#ffdd55',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: { x: 8, y: 4 },
    });
    txt.setOrigin(0.5, 1);
    txt.setDepth(100);
    this.activeFeedbackPrompt = txt;

    this.tweens.add({
      targets: txt,
      y: y - 18,
      alpha: 0,
      duration: 1100,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (this.activeFeedbackPrompt === txt) {
          this.activeFeedbackPrompt = null;
        }
        txt.destroy();
      },
    });
  }

  private placeGlyph(x: number | null = null, y: number | null = null, direction: boolean | null = null, surface: "ground" | "air" = "ground") {

    const activeGlyph = this.selectedGlyphs[this.activeGlyphIndex];
    if (!activeGlyph) return;

    // 1. Compute placement coordinates relative to player feet
    const isFacingLeft = direction ?? this.player.flipX;
    const forwardOffset = 48; // Reaches right where Alex kneels down
    const placeX = x ?? (isFacingLeft ? this.player.x - forwardOffset : this.player.x + forwardOffset);

    // Floor walking surface is flat on top of tiles (height - 128)
    const floorY = this.player.body ? this.player.body.bottom : (this.height - 128);
    const placeY = y ?? (surface === 'ground' ? floorY - 2 : this.player.y - 30);

    // 2. Instantiate dedicated GameplayGlyph object in 'placed' state
    const placedGlyph = new GameplayGlyph(this, {
      x: placeX,
      y: placeY,
      direction: isFacingLeft,
      surface: surface,
      state: 'placed',
      glyphData: activeGlyph,
    });

    this.tweens.killTweensOf(placedGlyph);
    placedGlyph.setPosition(placeX, placeY);

    // 3. Register separate physics collider into the static colliders group
    if (this.placedGlyphColliders) {
      this.placedGlyphColliders.add(placedGlyph.collider);
    }

    // Record as a placed glyph
    this.placedGlyphs.push(placedGlyph);

    // Notify UI that holding has ended
    useGameStore.getState().setGlyphHeldState('none');
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    // 1. If currently aiming, execute spell casting via the activation engine!
    if (this.isAiming) {
      const activeGlyph = this.selectedGlyphs[this.activeGlyphIndex];
      if (activeGlyph) {
        const targetWorld = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const isLeft = targetWorld.x < this.player.x;
        this.player.setFlipX(isLeft);
        this.player.setVelocityX(0);

        // Hand/chest release position
        const armX = this.player.x + (isLeft ? -45 : 45);
        const armY = this.player.y - 145;

        // Delegate spell execution to the activation engine
        executeGlyphActivation({
          scene: this,
          glyph: activeGlyph,
          state: 'held',
          origin: { x: armX, y: armY },
          target: { x: targetWorld.x, y: targetWorld.y },
          targets: this.dummy,
        });
      }
      this.exitAimState();
      return;
    }

    // 2. Check if clicked on/near a placed glyph
    for (const g of this.placedGlyphs) {
      if (!g.isActivated && Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, g.x, g.y) <= 48) {
        if (this.selectedPlacedGlyph && this.selectedPlacedGlyph !== g) {
          this.selectedPlacedGlyph.select(false);
        }
        this.selectedPlacedGlyph = g;
        g.select(true);

        // Check if player is within 1/2 tile (64px) to activate
        this.handle_activation();
        return;
      }
    }

    // 3. If a placed glyph was selected, and player clicks while within 1/2 tile
    if (this.selectedPlacedGlyph && !this.selectedPlacedGlyph.isActivated) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.selectedPlacedGlyph.x, this.selectedPlacedGlyph.y);
      if (dist <= 64) {
        this.handle_activation();
        return;
      }
    }
  }


  shutdown() {
    window.removeEventListener('glyph-hotbar-select', this.onGlyphSelect);
    window.removeEventListener('glyph-cast', this.onGlyphCast);
    if (this.unsubCombatText) {
      this.unsubCombatText();
      this.unsubCombatText = undefined;
    }
    if (this.dummy) {
      this.dummy.destroy();
    }
  }
}
