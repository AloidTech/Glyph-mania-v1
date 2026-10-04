/**
 * @file TestingGroundUi.tsx
 * @description React UI Overlay for the Glyph Testing Ground.
 * Displays the arena top header bar with navigation controls matching the Workshop UI.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  HouseIcon,
  ArrowLeftIcon,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import type { StrokeData } from 'atrament';
import { useGameStore } from '../../lib/stores/store';
import { useAdminSigilsStore } from '../../lib/stores/admin_sigils_store';
import { useMiniPadDraftStore } from '../../lib/stores/minipad_draft_store';
import { GlyphHotbar, STARTER_TESTING_GLYPHS } from '../MageUi/GlyphHotbar';
import { MiniDrawingPad } from '../MageUi/MiniDrawingPad';
import type { Element, WorkshopGlyph } from '../../types/glyph_types';
import { defaultResolveSigilId, buildCompositionFromAnalysis } from '../../lib/glyph_helpers/glyph_solidity';
import { getSigilElement } from '../../lib/glyph_helpers/sigils';
import { useGlyphDiagnostics } from '../../lib/hooks/useGlyphDiagnostics';
import { removeImageBackground } from '../../lib/admin_utils/background_remover';
import '../../styles/gameplayScene.css';

export const TestingGroundUi: React.FC = () => {
  const setScreen = useGameStore((state) => state.setScreen);
  const resetGameSession = useGameStore((state) => state.resetGameSession);
  const testingGroundMode = useGameStore((state) => state.testingGroundMode);
  const setTestingGroundMode = useGameStore((state) => state.setTestingGroundMode);

  const sigils = useAdminSigilsStore((state) => state.sigils);
  const loadRemoteSigils = useAdminSigilsStore((state) => state.loadRemoteSigils);

  useEffect(() => {
    loadRemoteSigils().catch((err) => {
      console.warn('Failed to load remote sigils on Testing Ground mount:', err);
    });
  }, [loadRemoteSigils]);

  const resolveSigilId = useCallback(
    (label?: string | null) => defaultResolveSigilId(label, sigils),
    [sigils]
  );

  const [isProcessingRune, setIsProcessingRune] = useState<boolean>(false);
  const {
    canvasSigilErrors,
    dismissedErrors,
    dismissError,
    sessionId: diagSessionId,
    analyzeCanvas,
    clearDiagnostics,
  } = useGlyphDiagnostics();

  const handleSelectGlyph = useCallback((glyph: WorkshopGlyph | null, index: number) => {
    // Notify Phaser TestingGroundScene of active slot change
    window.dispatchEvent(
      new CustomEvent('glyph-hotbar-select', {
        detail: { index, glyph },
      })
    );
  }, []);

  // Track and recognize runes drawn on MiniDrawingPad, validating solidity and casting to scenes
  const handleCastRune = useCallback(async (canvas: HTMLCanvasElement, strokes: StrokeData[], trimmedSnapshot?: string) => {
    if (!canvas || strokes.length === 0) {
      toast.error('Draw a glyph on the scroll first.', { icon: '📜' });
      return;
    }

    setIsProcessingRune(true);
    try {
      // 1. Run spatial and neural recognition & solidity validation via decoupled hook
      const { analysis: result, solidity } = await analyzeCanvas(canvas, sigils, resolveSigilId);

      // 2. Error Popups / Diagnostics Logic
      if (!solidity.isSolid) {
        if (result.rawCrops.length === 0) {
          toast.error('No distinct symbols detected on scrollpad.', { icon: '❓' });
        } else if (solidity.reasons.length > 0) {
          toast.error(`Glyph not solid: ${solidity.reasons[0]}`, {
            duration: 4000,
            icon: '⚠️',
          });
        } else {
          toast.error('Unrecognized or incomplete glyph formation.', { icon: '⚠️' });
        }
        return;
      }

      clearDiagnostics();

      // 3. Success: Identify effector element and construct dynamic glyph spell
      const effLabel = (result.semanticCrops?.effector?.recognition?.label || '').toLowerCase();
      const effectorSigilId = result.semanticCrops?.effector?.recognition?.sigilId;
      const sigilElement = getSigilElement(effectorSigilId, sigils);
      let detectedElement: Element = sigilElement || 'fire';
      if (!sigilElement) {
        if (effLabel.includes('water')) {
          detectedElement = 'water';
        } else if (effLabel.includes('earth')) {
          detectedElement = 'earth';
        } else if (effLabel.includes('air')) {
          detectedElement = 'air';
        }
      }
      let spellName = 'Flame Rune';
      if (detectedElement === 'water') {
        spellName = 'Frost Wave';
      } else if (detectedElement === 'earth') {
        spellName = 'Stone Shard';
      } else if (detectedElement === 'air') {
        spellName = 'Gale Burst';
      }

      toast.success(`Cast ${spellName}!`, { icon: '✨' });

      // Use trimmed background-removed snapshot from MiniDrawingPad, or compute fallback
      let previewUrl = trimmedSnapshot;
      if (!previewUrl) {
        previewUrl = canvas.toDataURL('image/png');
        try {
          previewUrl = await removeImageBackground(previewUrl, { autoTrim: true, removeHalo: false, contiguousOnly: false, tolerance: 0 });
        } catch (err) {
          console.warn('Failed to trim preview canvas in TestingGroundUi', err);
        }
      }

      const drawnGlyph: WorkshopGlyph = {
        id: `drawn-${Date.now()}`,
        name: spellName,
        description: 'Dynamically cast from the Mage scrollpad',
        element: detectedElement,
        tier: 1,
        author: 'Player',
        isPublic: false,
        createdAt: 'Now',
        confidenceScore: 0.92,
        coverAsset: previewUrl,
        composition: {
          ...buildCompositionFromAnalysis(result, resolveSigilId, detectedElement),
          strokes,
        },
      };

      // Add drawn glyph into persistent minipad draft and hotbar stores
      useMiniPadDraftStore.getState().setActiveGlyph(drawnGlyph);
      const raw = useGameStore.getState().selectedTestingGlyphs;
      const current = (raw && raw.length > 0) ? [...raw] : [...STARTER_TESTING_GLYPHS];
      const updated = [drawnGlyph, ...current.filter((g) => g.id !== drawnGlyph.id)].slice(0, 9);
      useGameStore.getState().setSelectedTestingGlyphs(updated);

      // Select newly added glyph in slot 0 immediately
      handleSelectGlyph(drawnGlyph, 0);

    } catch (err: any) {
      console.error('Glyph recognition error in Testing Ground:', err);
      toast.error('Recognition error: ' + (err.message || 'Symbol error'));
    } finally {
      setIsProcessingRune(false);
    }
  }, [sigils, resolveSigilId]);

  return (
    <div className="game-scene-overlay">
      {/* Top Header */}
      <header className="game-header interactive-ui">
        <div className="game-header-brand">
          <div className="game-header-titles">
            <h2 className="game-header-title">TESTING GROUNDS</h2>
            <span className="game-header-subtitle">Live Spellcasting & Target Practice</span>
            <div style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Scene View:</label>
              <select
                value={testingGroundMode}
                onChange={(e) => setTestingGroundMode(e.target.value as 'ISOMETRIC' | 'OBLIQUE' | 'SIDE_VIEW')}
                style={{ background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '2px 4px', fontSize: '12px' }}
              >
                <option value="ISOMETRIC">Isometric</option>
                <option value="OBLIQUE">Oblique</option>
                <option value="SIDE_VIEW">Side-View</option>
              </select>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="game-header-actions">
          <button
            onClick={() => setScreen('IN_GAME')}
            className="header-action-btn"
            title="Return to Workshop"
            aria-label="Return to Workshop"
          >
            <ArrowLeftIcon size={17} weight="bold" />
            <span className="header-btn-label">Workshop</span>
          </button>
          <button
            onClick={resetGameSession}
            className="header-action-btn"
            title="Return to Main Sanctuary"
            aria-label="Return to Main Sanctuary"
          >
            <HouseIcon size={17} weight="bold" />
          </button>
        </div>
      </header>

      {/* Mini Drawing Pad at Right-Hand Side */}
      <MiniDrawingPad
        width={420}
        height={300}
        onCastRune={handleCastRune}
        isProcessing={isProcessingRune}
        errors={canvasSigilErrors}
        dismissedErrors={dismissedErrors}
        onDismissError={dismissError}
        sessionId={diagSessionId}
        onStrokesChange={(strokes) => {
          if (strokes.length === 0) {
            clearDiagnostics();
          }
        }}
      />

      {/* Bottom Glyph Inventory Hotbar Selector */}
      <GlyphHotbar onSelectGlyph={handleSelectGlyph} />
    </div>
  );
};

export default TestingGroundUi;
