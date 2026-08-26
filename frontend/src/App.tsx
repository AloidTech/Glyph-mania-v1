import React from 'react';
import { PhaserCanvas } from './components/PhaserCanvas';
import { MainMenuUi } from './components/MainMenuUi';
import { SettingsModal } from './components/SettingsModal';
import { GameSceneUi } from './components/GameSceneUi';
import { useGameStore } from './lib/store';

export const App: React.FC = () => {
  const activeScreen = useGameStore((state) => state.activeScreen);

  return (
    <div className="app-container">
      {/* Transparent Phaser 3 Canvas Background */}
      <PhaserCanvas />

      {/* React UI Floating Overlays */}
      {activeScreen === 'MAIN_MENU' && <MainMenuUi />}
      {activeScreen === 'SETTINGS' && <SettingsModal />}
      {(activeScreen === 'IN_GAME' || activeScreen === 'PAUSED') && <GameSceneUi />}
    </div>
  );
};

export default App;
