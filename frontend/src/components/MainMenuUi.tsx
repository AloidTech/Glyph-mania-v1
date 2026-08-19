import React from 'react';
import { Play, Settings as SettingsIcon, ChevronRight } from 'lucide-react';
import { useGameStore } from '../lib/store';

export const MainMenuUi: React.FC = () => {
  const setScreen = useGameStore((state) => state.setScreen);
  const startNewGame = useGameStore((state) => state.startNewGame);

  return (
    <div className="ui-overlay-container flex flex-col justify-between p-8 sm:p-12">
      {/* Header Branding */}
      <header className="flex justify-between items-start">
        <div>
          <h2 className="font-cinzel font-bold text-sm tracking-widest text-[#e5c158] uppercase">
            GLYPH MANIA
          </h2>
          <p className="text-xs text-[#b89f7d]">Phaser 3 + React Template</p>
        </div>
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-xl mx-auto my-auto flex flex-col items-center text-center">
        <h1 className="font-cinzel font-black text-5xl sm:text-7xl tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-[#f5e5ab] via-[#d4af37] to-[#8b6b23] mb-3">
          GLYPH MANIA
        </h1>
        <p className="text-[#d8c2a3] text-lg sm:text-xl tracking-widest uppercase mb-10 max-w-md">
          Main Menu
        </p>

        {/* Menu Actions */}
        <div className="w-full max-w-md space-y-4 interactive-ui">
          <button
            onClick={startNewGame}
            className="w-full group relative flex items-center justify-between px-6 py-4 rounded-2xl book-panel-interactive text-white font-cinzel font-bold text-lg overflow-hidden cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#8b1a1a] to-[#521010] text-[#f5e5ab] border border-[#a88344]/50 shadow-md group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 fill-current" />
              </div>
              <div className="text-left">
                <span className="block text-[#f5e5ab] group-hover:text-[#ffffff] transition-colors">START GAME</span>
                <span className="block text-xs text-[#b89f7d] font-normal">Enter the game scene</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#a88344] group-hover:text-[#f5e5ab] group-hover:translate-x-1 transition-all" />
          </button>

          <button
            onClick={() => setScreen('SETTINGS')}
            className="w-full group relative flex items-center justify-between px-6 py-4 rounded-2xl book-panel-interactive text-white font-cinzel font-bold text-lg overflow-hidden cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#2b1b11] to-[#140c07] text-[#c5a059] border border-[#a88344]/40 shadow-md group-hover:scale-110 transition-transform">
                <SettingsIcon className="w-6 h-6" />
              </div>
              <div className="text-left">
                <span className="block text-[#c5a059] group-hover:text-[#e5c158] transition-colors">SETTINGS</span>
                <span className="block text-xs text-[#b89f7d] font-normal">Configure game preferences</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#a88344] group-hover:text-[#c5a059] group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex flex-col sm:flex-row items-center justify-between text-xs text-[#8c7457] gap-2">
        <p>Ready for custom game implementation</p>
      </footer>
    </div>
  );
};

