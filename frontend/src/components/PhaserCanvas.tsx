import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createPhaserGame } from '../game/config';
import { useGameStore } from '../lib/stores/store';

export const PhaserCanvas: React.FC = () => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeScreen = useGameStore((state) => state.activeScreen);
  const selectedTestingGlyphs = useGameStore((state) => state.selectedTestingGlyphs);
  const testingGroundMode = useGameStore((state) => state.testingGroundMode);

  useEffect(() => {
    if (!gameRef.current && containerRef.current) {
      gameRef.current = createPhaserGame(containerRef.current.id);
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!gameRef.current) return;
    const game = gameRef.current;

    if (activeScreen === 'TESTING_GROUND') {
      if (game.scene.isActive('MainMenuScene')) game.scene.stop('MainMenuScene');
      if (game.scene.isActive('GameScene')) game.scene.stop('GameScene');

      const targetScene = 
        testingGroundMode === 'ISOMETRIC' ? 'TestingGroundIsoScene' :
        testingGroundMode === 'SIDE_VIEW' ? 'TestingGroundSideScene' :
        'TestingGroundScene';

      const otherTestingScenes = ['TestingGroundIsoScene', 'TestingGroundScene', 'TestingGroundSideScene'].filter(s => s !== targetScene);
      otherTestingScenes.forEach(sceneKey => {
        if (game.scene.isActive(sceneKey)) game.scene.stop(sceneKey);
      });

      if (!game.scene.isActive(targetScene)) {
        game.scene.start(targetScene, { glyphs: selectedTestingGlyphs });
      }
    } else if (activeScreen === 'IN_GAME' || activeScreen === 'PAUSED') {
      if (game.scene.isActive('MainMenuScene')) game.scene.stop('MainMenuScene');
      ['TestingGroundIsoScene', 'TestingGroundScene', 'TestingGroundSideScene'].forEach(sceneKey => {
        if (game.scene.isActive(sceneKey)) game.scene.stop(sceneKey);
      });
      
      if (!game.scene.isActive('GameScene')) {
        game.scene.start('GameScene');
      }
      if (activeScreen === 'PAUSED') {
        game.scene.pause('GameScene');
      } else {
        game.scene.resume('GameScene');
      }
    } else {
      if (game.scene.isActive('GameScene')) game.scene.stop('GameScene');
      ['TestingGroundIsoScene', 'TestingGroundScene', 'TestingGroundSideScene'].forEach(sceneKey => {
        if (game.scene.isActive(sceneKey)) game.scene.stop(sceneKey);
      });

      if (!game.scene.isActive('MainMenuScene')) {
        game.scene.start('MainMenuScene');
      }
    }
  }, [activeScreen, selectedTestingGlyphs, testingGroundMode]);

  return (
    <div
      id="game-container"
      ref={containerRef}
      className="game-canvas-container"
    />
  );
};
