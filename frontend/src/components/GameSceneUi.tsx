import React, { useMemo, useEffect } from 'react';
import { PauseIcon, PlayIcon, HouseIcon, Icon, PenIcon, EraserIcon, ArrowArcLeftIcon, ArrowArcRightIcon, ArrowElbowRightDownIcon } from '@phosphor-icons/react';
import { useGameStore, useWorkShopStore } from '../lib/store';
import { Sigil } from '../lib/types/glyph_types';
import { tier1Sigils } from '../lib/sigils';

interface toolBarItemRef {
  icon: Icon;
  name: string;
  position: number;
  keybind?: string;
}

const toolBar: Array<toolBarItemRef> = [
  { icon: PenIcon, name: "Pen", position: 1, keybind: "d" },
  { icon: EraserIcon, name: "Eraser", position: 2, keybind: "e" },
  { icon: ArrowArcLeftIcon, name: "Undo", position: 3, keybind: "ctrl+z" },
  { icon: ArrowArcLeftIcon, name: "Redo", position: 4, keybind: "ctrl+shift+z" },
];

interface TooltipProps {
  name: string;
  keybind?: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ name, keybind, children }) => {
  return (
    <div className="tooltip-wrapper">
      {children}
      <div className="tooltip-bubble" role="tooltip">
        <span className="tooltip-name">{name}</span>
        {keybind && <span className="tooltip-keybind">({keybind})</span>}
      </div>
    </div>
  );
};

const WorkshopCatelogMenu = ({ menuSigils }: { menuSigils: Record<string, Record<string, Sigil[]>> }) => {
  return (
    <div className="catelog-area">
      <div className="catelog-header">
        <h2 className='catelog-title'>Catelog</h2>
      </div>
      <div className="catelog-content">
        <h3 className='catelog-subtitle'>Sigils</h3>
        {Object.keys(menuSigils).map((type) =>
          <div key={type} className='catelog-entry'>
            <h3 className='catelog-entry-title'>{type}</h3>
            <div>
              {Object.keys(menuSigils[type]).map((tier) => (
                <div className='sigil-tier-group' key={tier}>
                  <h4>{tier}</h4>
                  <div className='sigil-catelog'>
                    {menuSigils[type][tier].map((sigil) => (
                      <div key={sigil.id} className='sigil-items'>
                        <img src={sigil.svgPath} alt={sigil.label} />
                      </div>
                    ))}</div>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export const GameSceneUi: React.FC = () => {
  const selectedTool = useWorkShopStore((state) => state.selectedTool);
  const setSelectedTool = useWorkShopStore((state) => state.setSelectedTool);
  const undo = useWorkShopStore((state) => state.undo);
  const redo = useWorkShopStore((state) => state.redo);
  const activeScreen = useGameStore((state) => state.activeScreen);
  const setScreen = useGameStore((state) => state.setScreen);
  const resetGameSession = useGameStore((state) => state.resetGameSession);

  const menuSigils = useMemo(() => {
    const grouped: Record<string, Record<string, Sigil[]>> = {};
    tier1Sigils.forEach((sigil: Sigil) => {
      const type = sigil.type;
      const tierKey = `tier-${sigil.tier ?? 1}`;
      if (!grouped[type]) {
        grouped[type] = {};
      }
      if (!grouped[type][tierKey]) {
        grouped[type][tierKey] = [];
      }
      grouped[type][tierKey].push(sigil);
    });
    return grouped;
  }, []);

  const isPaused = activeScreen === 'PAUSED';

  // Handle Tool & Action Clicks
  const handleToolChange = (toolName: string) => {
    const norm = toolName.toLowerCase();
    if (norm === 'undo') {
      undo();
    } else if (norm === 'redo') {
      redo();
    } else {
      setSelectedTool(norm);
    }
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (isCtrlOrCmd && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (isCtrlOrCmd && key === 'y') {
        e.preventDefault();
        redo();
      } else if (key === 'd') {
        setSelectedTool('pen');
      } else if (key === 'e') {
        setSelectedTool('eraser');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedTool, undo, redo]);

  return (
    <div className="game-scene-overlay">
      {/* Top Header */}
      <header className="game-header interactive-ui">
        <div className="game-header-info">
          <div>
            <h4 style={{ color: 'var(--color-text-primary)' }}>WORKSHOP</h4>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="game-header-actions">
          <button onClick={resetGameSession} className="btn btn-ghost btn-icon">
            <HouseIcon size={20} />
          </button>
          <button
            onClick={() => setScreen(isPaused ? 'IN_GAME' : 'PAUSED')}
            className="btn btn-ghost btn-icon"
          >
            {isPaused ? <PlayIcon size={20} weight="fill" /> : <PauseIcon size={20} />}
          </button>
        </div>
      </header>

      <div className='game-scene-content'>
        <WorkshopCatelogMenu menuSigils={menuSigils} />

        <div className='drawing-area'>
          <div className='tool-box'>
            {toolBar.map((tool) => {
              const isSelected = selectedTool.toLowerCase() === tool.name.toLowerCase();
              return (
                <Tooltip key={tool.name} name={tool.name} keybind={tool.keybind}>
                  <button
                    className={`tool-bar-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToolChange(tool.name)}
                    aria-label={`${tool.name} (${tool.keybind})`}
                  >
                    {tool.name == "Redo" ? <tool.icon size={20} transform="rotate(180)" /> : <tool.icon size={20} />}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pause Menu Overlay */}
      {isPaused && (
        <div className="modal-overlay">
          <div className="pause-modal">
            <h3>GAME PAUSED</h3>

            <div className="pause-modal-actions">
              <button
                onClick={() => setScreen('IN_GAME')}
                className="btn btn-primary"
              >
                Resume Game
              </button>

              <button
                onClick={resetGameSession}
                className="btn btn-secondary"
              >
                <HouseIcon size={16} />
                Return to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
