import Phaser from 'phaser';
import { GAME_SIZE } from '../config';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const width = GAME_SIZE.width;
    const height = GAME_SIZE.height;

    // Aged Parchment Empty Scene Backdrop
    const bgGraphics = this.add.graphics();
    bgGraphics.fillGradientStyle(0x1a0f08, 0x1a0f08, 0x090503, 0x090503, 1);
    bgGraphics.fillRect(0, 0, width, height);

    // Subtle Arcane Grid
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0xc5a059, 0.08);

    const gridSize = 80;
    for (let x = 0; x < width; x += gridSize) gridGraphics.lineBetween(x, 0, x, height);
    for (let y = 0; y < height; y += gridSize) gridGraphics.lineBetween(0, y, width, height);
  }

  update(_time: number, _delta: number) {
    // Empty New Game Scene - ready for custom gameplay logic!
  }
}
