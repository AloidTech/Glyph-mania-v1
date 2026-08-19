import Phaser from 'phaser';
import { GAME_SIZE } from '../config';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create() {
    const width = GAME_SIZE.width;
    const height = GAME_SIZE.height;

    // Clean Backdrop
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1a0f08, 0x1a0f08, 0x090503, 0x090503, 1);
    graphics.fillRect(0, 0, width, height);

    this.scale.on('resize', this.handleResize, this);
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
  }

  update() {
    // Ready for custom main menu Phaser objects/animations
  }
}

