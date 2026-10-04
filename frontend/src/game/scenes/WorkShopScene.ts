import Phaser from 'phaser';
import { Stroke, StrokePoint } from '../../types/glyph_types';
import { useWorkShopStore } from '../../lib/stores/store';

export class GameScene extends Phaser.Scene {
  private drawSurface!: Phaser.GameObjects.RenderTexture;
  private parchmentBg!: Phaser.GameObjects.Image;
  private lastPoint: { x: number; y: number } | null = null;
  private currentStrokePoints: StrokePoint[] = [];
  private selectedTool: string = 'pen';
  private penRadius: number = 8;
  private eraserRadius: number = 24;
  private cachedBounds: { x: number; y: number; width: number; height: number } | null = null;
  private unsubscribeStore: (() => void) | null = null;

  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.atlas(
      'sigils',
      '/sigils/atlas/sigils-atlas.png',
      '/sigils/atlas/sigils-atlas.json'
    );
    this.load.image('parchment', '/assets/parchment.png');
  }

  create() {



  }

  update(_time: number, _delta: number) {
    // Zero layout thrashing: update loop is clean and fast!
  }

}
