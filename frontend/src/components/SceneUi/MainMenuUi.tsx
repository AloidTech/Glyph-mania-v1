import React from 'react';
import { Link } from 'react-router-dom';
import { useGameStore } from '../../lib/stores/store';
import { AmbientGlyph } from '../BackgroundElements/AmbientGlyph';
import { CornerSigil } from '../BackgroundElements/CornerSigil';
import { RuneDivider } from '../BackgroundElements/RuneDivider';
import { HeaderOrnament } from '../BackgroundElements/HeaderOrnament';
import { CharacterRotatingStand } from './CharacterRotatingStand';
import { useAuth } from '../../lib/supabase/auth/useAuth';

export const MainMenuUi: React.FC = () => {
  const setScreen = useGameStore((state) => state.setScreen);
  const startNewGame = useGameStore((state) => state.startNewGame);
  const { isAdmin } = useAuth();

  return (
    <div className="main-menu-container interactive-ui">
      {/* Background ambient glyph */}
      <AmbientGlyph />

      {/* 4 Corner sigils */}
      <CornerSigil pos="tl" />
      <CornerSigil pos="tr" />
      <CornerSigil pos="bl" />
      <CornerSigil pos="br" />

      {/* Vignette depth & arcane purple bloom overlays */}
      <div className="menu-vignette" />
      <div className="menu-purple-bloom" />

      {/* Centered Main Menu Content Stack */}
      <div className="main-menu-content">
        <div className="main-menu-hero">
          {/* Header Top Ornament */}
          <HeaderOrnament />

          {/* Main Title */}
          <h1 className="main-menu-title">GLYPH MANIA</h1>

          {/* Subtitle */}
          <p className="main-menu-subtitle">Inscribe the arcane. Command the unseen.</p>
        </div>

        {/* Ornamental Divider */}
        <div className="main-menu-divider">
          <RuneDivider />
        </div>

        {/* Action Buttons */}
        <div className="main-menu-actions">
          <button onClick={startNewGame} className="btn-arcane-primary">
            Enter Workshop
          </button>
          <button onClick={() => setScreen('TESTING_GROUND')} className="btn-arcane-primary">
            Enter Testing Ground
          </button>

          {isAdmin && (
            <Link to="/admin_dashboard/sigils" className="btn-arcane-secondary" style={{ textDecoration: 'none', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>
              Admin Studio
            </Link>
          )}

          <button onClick={() => setScreen('SETTINGS')} className="btn-arcane-secondary">
            Settings
          </button>

          <button
            onClick={() => {
              if (window.confirm('Exit Glyph Mania?')) {
                window.close();
              }
            }}
            className="btn-arcane-ghost"
          >
            Exit
          </button>
        </div>

        {/* Version caption */}
        <p className="main-menu-version">v0.1.0 — EARLY ACCESS</p>
      </div>

      {/* Character Rotating Stand HUD (Replacing Profile Icon button) */}
      <CharacterRotatingStand />
    </div>
  );
};

export default MainMenuUi;
