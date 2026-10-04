import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/WorkShopScene';
import { TestingGroundScene } from './scenes/TestingGroundScene';
import { TestingGroundIsoScene } from './scenes/TestingGroundIsoScene';
import { TestingGroundSideScene } from './scenes/TestingGroundSideScene';

export const createPhaserGame = (parentContainerId: string) => {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: parentContainerId,
    width: 1280,
    height: 720,
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
    scene: [MainMenuScene, GameScene, TestingGroundScene, TestingGroundIsoScene, TestingGroundSideScene],
    fps: {
      target: 60,
    },
  };

  return new Phaser.Game(config);
};

