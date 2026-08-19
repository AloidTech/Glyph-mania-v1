import React, { useState } from 'react';
import { Settings as SettingsIcon, ArrowLeft, Volume2, VolumeX, Monitor } from 'lucide-react';
import { useGameStore } from '../lib/store';

export const SettingsModal: React.FC = () => {
  const setScreen = useGameStore((state) => state.setScreen);
  const settings = useGameStore((state) => state.settings);
  const updateSettings = useGameStore((state) => state.updateSettings);

  const [activeTab, setActiveTab] = useState<'audio' | 'graphics'>('audio');

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div className="ui-overlay-container flex items-center justify-center p-4 sm:p-6 bg-[#0a0604]/85 backdrop-blur-md">
      <div className="w-full max-w-2xl book-panel rounded-3xl p-6 sm:p-8 border-2 border-[#a88344] shadow-2xl interactive-ui animate-fadeIn max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-[#a88344]/30 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-[#211409] border border-[#a88344]/50 text-[#e5c158]">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-cinzel font-bold text-2xl text-[#f5e5ab]">SETTINGS</h2>
              <p className="text-xs text-[#b89f7d]">Audio & Display Preferences</p>
            </div>
          </div>

          <button
            onClick={() => setScreen('MAIN_MENU')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2b1b11] hover:bg-[#3d2719] text-[#e5c158] text-sm font-cinzel font-semibold border border-[#a88344]/40 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#a88344]/30 mb-6 gap-2 font-cinzel text-xs sm:text-sm">
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'audio'
                ? 'bg-[#2b1810] text-[#f5e5ab] border-b-2 border-[#d4af37] font-bold'
                : 'text-[#b89f7d] hover:text-[#f5e5ab]'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            Sound
          </button>
          <button
            onClick={() => setActiveTab('graphics')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'graphics'
                ? 'bg-[#2b1810] text-[#f5e5ab] border-b-2 border-[#d4af37] font-bold'
                : 'text-[#b89f7d] hover:text-[#f5e5ab]'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Display
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-6 mb-6">
          {activeTab === 'audio' && (
            <div className="space-y-6">
              {/* Sound FX Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[#1c1109]/80 border border-[#a88344]/30">
                <div className="flex items-center gap-3">
                  {settings.sfxEnabled ? <Volume2 className="w-5 h-5 text-[#e5c158]" /> : <VolumeX className="w-5 h-5 text-[#8c7457]" />}
                  <div>
                    <h4 className="font-cinzel font-semibold text-sm text-[#f5e5ab]">Sound Effects</h4>
                    <p className="text-xs text-[#b89f7d]">Enable or disable audio effects</p>
                  </div>
                </div>
                <button
                  onClick={() => updateSettings({ sfxEnabled: !settings.sfxEnabled })}
                  className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                    settings.sfxEnabled ? 'bg-[#8b1a1a]' : 'bg-[#211409]'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-[#f5e5ab] transition-transform ${settings.sfxEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Master Volume */}
              <div className="p-4 rounded-2xl bg-[#1c1109]/80 border border-[#a88344]/30 space-y-3">
                <div className="flex justify-between items-center text-sm font-cinzel font-semibold">
                  <span className="text-[#f5e5ab]">Master Volume</span>
                  <span className="font-mono text-[#e5c158]">{settings.masterVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.masterVolume}
                  onChange={(e) => updateSettings({ masterVolume: Number(e.target.value) })}
                  className="w-full h-2 bg-[#2b1810] rounded-lg appearance-none cursor-pointer accent-[#d4af37]"
                />
              </div>
            </div>
          )}

          {activeTab === 'graphics' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[#1c1109]/80 border border-[#a88344]/30">
                <div>
                  <h4 className="font-cinzel font-semibold text-sm text-[#f5e5ab]">Display Mode</h4>
                  <p className="text-xs text-[#b89f7d]">Toggle fullscreen view</p>
                </div>
                <button
                  onClick={toggleFullscreen}
                  className="px-4 py-2 rounded-xl bg-[#2b1810] hover:bg-[#3d2719] text-xs font-cinzel font-bold text-[#e5c158] border border-[#a88344]/40 cursor-pointer"
                >
                  Fullscreen
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#a88344]/30 flex justify-end">
          <button
            onClick={() => setScreen('MAIN_MENU')}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#8b1a1a] to-[#521010] hover:from-[#a82222] hover:to-[#6b1717] text-[#f5e5ab] font-cinzel font-bold text-xs border border-[#a88344]/50 cursor-pointer shadow-lg"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

