import Phaser from 'phaser';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';

// Exported Game Screen Size configuration
export const GAME_SIZE = {
  width: 1280,
  height: 720,
};

export const createPhaserGame = (parentContainerId: string) => {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: parentContainerId,
    width: GAME_SIZE.width,
    height: GAME_SIZE.height,
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [MainMenuScene, GameScene],
    fps: {
      target: 60,
    },
  };

  return new Phaser.Game(config);
};
