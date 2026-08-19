import React from 'react';
import { Pause, Play, Home } from 'lucide-react';
import { useGameStore } from '../lib/store';

export const GameSceneUi: React.FC = () => {
  const activeScreen = useGameStore((state) => state.activeScreen);
  const setScreen = useGameStore((state) => state.setScreen);
  const resetGameSession = useGameStore((state) => state.resetGameSession);

  const isPaused = activeScreen === 'PAUSED';

  return (
    <div className="ui-overlay-container flex flex-col justify-between p-6">
      {/* Top Header */}
      <header className="flex justify-between items-center w-full max-w-6xl mx-auto interactive-ui">
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl book-panel border border-[#a88344]/40">
          <div>
            <span className="font-cinzel font-bold text-sm text-[#f5e5ab]">GAME SCENE</span>
            <p className="text-[10px] text-[#b89f7d]">Canvas Arena</p>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={resetGameSession}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl book-panel border border-[#a88344]/50 hover:border-[#d4af37] text-[#e5c158] hover:text-[#ffffff] transition-all cursor-pointer font-cinzel font-bold text-xs"
          >
            <Home className="w-4 h-4" />
            Main Menu
          </button>
          <button
            onClick={() => setScreen(isPaused ? 'IN_GAME' : 'PAUSED')}
            className="p-3.5 rounded-2xl book-panel border border-[#a88344]/50 hover:border-[#d4af37] text-[#e5c158] hover:text-[#ffffff] transition-all cursor-pointer shadow-lg"
          >
            {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Pause Menu Overlay */}
      {isPaused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0604]/85 backdrop-blur-md interactive-ui animate-fadeIn">
          <div className="w-full max-w-md book-panel rounded-3xl p-8 border-2 border-[#a88344] text-center shadow-2xl space-y-6">
            <div>
              <h3 className="font-cinzel font-bold text-3xl text-[#f5e5ab]">GAME PAUSED</h3>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setScreen('IN_GAME')}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#8b1a1a] to-[#521010] hover:from-[#a82222] hover:to-[#6b1717] text-[#f5e5ab] font-cinzel font-bold text-sm border border-[#a88344]/50 shadow-lg cursor-pointer"
              >
                Resume Game
              </button>

              <button
                onClick={resetGameSession}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#140c07] border border-[#a88344]/30 hover:bg-[#211409] text-[#b89f7d] hover:text-[#f5e5ab] text-sm transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Return to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

