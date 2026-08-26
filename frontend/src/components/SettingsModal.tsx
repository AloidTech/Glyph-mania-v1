import React from 'react';
import {
  XIcon,
  SpeakerHighIcon,
  SpeakerSimpleXIcon,
  MusicNoteIcon,
  FadersIcon,
  DesktopIcon,
} from '@phosphor-icons/react';
import { useGameStore } from '../lib/store';

export const SettingsModal: React.FC = () => {
  const setScreen = useGameStore((state) => state.setScreen);
  const settings = useGameStore((state) => state.settings);
  const updateSettings = useGameStore((state) => state.updateSettings);

  const onClose = () => setScreen('MAIN_MENU');

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
    <div className="modal-overlay" onClick={onClose}>
      {/* Modal Glass Panel */}
      <div
        className="glass-panel animate-fadeIn"
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 12px 60px rgba(0,0,0,0.75), 0 0 80px rgba(50,20,100,0.2), 0 0 0 1px rgba(201,162,39,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-md) var(--space-lg)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            {/* Diamond Mark */}
            <svg
              viewBox="0 0 20 20"
              width="13"
              height="13"
              aria-hidden="true"
              style={{ color: 'var(--color-accent)', opacity: 0.8 }}
            >
              <polygon points="10,1.5 18.5,10 10,18.5 1.5,10" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="10" cy="10" r="2.5" fill="currentColor" />
            </svg>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.82rem',
                fontWeight: 600,
                letterSpacing: '0.2em',
                color: 'var(--color-accent)',
                textShadow: '0 0 20px rgba(201,162,39,0.35)',
              }}
            >
              SETTINGS
            </h2>
          </div>

          <button
            onClick={onClose}
            className="btn-icon-ghost"
            aria-label="Close settings"
          >
            <XIcon size={16} weight="bold" />
          </button>
        </div>

        {/* Setting rows */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-sm)',
            padding: 'var(--space-md) var(--space-lg) var(--space-lg)',
          }}
        >
          {/* Master Volume */}
          <div className="glass-card">
            <div className="glass-card-header">
              <div className="glass-card-title">
                <span style={{ color: 'var(--color-accent)', display: 'flex' }}>
                  <MusicNoteIcon size={18} weight="duotone" />
                </span>
                <span>Master Volume</span>
              </div>
              <span className="glass-card-value">{Math.round(settings.masterVolume)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.masterVolume}
              onChange={(e) => updateSettings({ masterVolume: Number(e.target.value) })}
              style={{
                background: `linear-gradient(to right, rgba(201,162,39,0.85) 0%, rgba(201,162,39,0.85) ${settings.masterVolume}%, rgba(255,255,255,0.1) ${settings.masterVolume}%, rgba(255,255,255,0.1) 100%)`,
              }}
            />
          </div>

          {/* SFX Volume */}
          <div className="glass-card">
            <div className="glass-card-header">
              <div className="glass-card-title">
                <span style={{ color: 'var(--color-accent)', display: 'flex' }}>
                  <FadersIcon size={18} weight="duotone" />
                </span>
                <span>SFX Volume</span>
              </div>
              <span className="glass-card-value">{Math.round(settings.sfxVolume)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.sfxVolume}
              onChange={(e) => updateSettings({ sfxVolume: Number(e.target.value) })}
              style={{
                background: `linear-gradient(to right, rgba(201,162,39,0.85) 0%, rgba(201,162,39,0.85) ${settings.sfxVolume}%, rgba(255,255,255,0.1) ${settings.sfxVolume}%, rgba(255,255,255,0.1) 100%)`,
              }}
            />
          </div>

          {/* SFX Enabled Toggle */}
          <div className="glass-card">
            <div className="glass-card-header">
              <div className="glass-card-title">
                <span
                  style={{
                    color: settings.sfxEnabled ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    display: 'flex',
                    transition: 'color 0.25s',
                  }}
                >
                  {settings.sfxEnabled ? (
                    <SpeakerHighIcon size={18} weight="duotone" />
                  ) : (
                    <SpeakerSimpleXIcon size={18} weight="duotone" />
                  )}
                </span>
                <span>SFX Enabled</span>
              </div>

              {/* Toggle Pill */}
              <button
                onClick={() => updateSettings({ sfxEnabled: !settings.sfxEnabled })}
                className={`switch-pill ${settings.sfxEnabled ? 'active' : ''}`}
                aria-label="Toggle SFX"
              >
                <span className="switch-pill-knob" />
              </button>
            </div>
          </div>

          {/* Display Mode (Fullscreen) */}
          <div className="glass-card">
            <div className="glass-card-header">
              <div className="glass-card-title">
                <span style={{ color: 'var(--color-accent)', display: 'flex' }}>
                  <DesktopIcon size={18} weight="duotone" />
                </span>
                <span>Fullscreen</span>
              </div>

              <button onClick={toggleFullscreen} className="btn-arcane-ghost" style={{ padding: '0.4rem 1rem', width: 'auto' }}>
                Toggle
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
