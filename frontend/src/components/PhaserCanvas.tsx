import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createPhaserGame } from '../game/config';
import { useGameStore } from '../lib/store';

export const PhaserCanvas: React.FC = () => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeScreen = useGameStore((state) => state.activeScreen);

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

    if (activeScreen === 'IN_GAME' || activeScreen === 'PAUSED') {
      if (game.scene.isActive('MainMenuScene')) {
        game.scene.stop('MainMenuScene');
      }
      if (!game.scene.isActive('GameScene')) {
        game.scene.start('GameScene');
      }
      if (activeScreen === 'PAUSED') {
        game.scene.pause('GameScene');
      } else {
        game.scene.resume('GameScene');
      }
    } else {
      if (game.scene.isActive('GameScene')) {
        game.scene.stop('GameScene');
      }
      if (!game.scene.isActive('MainMenuScene')) {
        game.scene.start('MainMenuScene');
      }
    }
  }, [activeScreen]);

  return (
    <div
      id="game-container"
      ref={containerRef}
      className="fixed inset-0 w-full h-full z-0 bg-slate-950"
    />
  );
};
