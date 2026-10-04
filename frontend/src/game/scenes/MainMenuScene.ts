import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create() {
    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.handleResize, this);
    });
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    if (this.cameras && this.cameras.main) {
      this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
    }
  }

  update() {
    // Ready for custom main menu Phaser objects/animations
  }
}


