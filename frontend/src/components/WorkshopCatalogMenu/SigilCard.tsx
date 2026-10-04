import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sigil } from '../../types/glyph_types';
import { UnsavedBadge } from '../UnsavedBadge';

interface SigilTooltipProps {
  sigil: Sigil & { isDraft?: boolean; isUnsaved?: boolean };
  children: React.ReactNode;
  isDraft?: boolean;
  isUnsaved?: boolean;
  onSync?: (e: React.MouseEvent) => void | Promise<any>;
}

export const SigilCard: React.FC<SigilTooltipProps> = ({ sigil, children, isDraft, isUnsaved, onSync }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: rect.top + rect.height / 2,
      left: rect.right + 14,
    });
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  useEffect(() => {
    if (!isHovered) return;
    const onScrollOrResize = () => {
      updatePosition();
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [isHovered]);

  return (
    <div
      ref={triggerRef}
      className="tooltip-wrapper"
      style={{ position: 'relative' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <UnsavedBadge
        isDraft={isDraft ?? sigil.isDraft}
        isUnsaved={isUnsaved ?? sigil.isUnsaved}
        className="status-icon-badge unsaved"
        size={9}
        onClick={onSync}
      />
      <div className="tooltip-children">{children}</div>

      {isHovered &&
        createPortal(
          <div
            className="tooltip-bubble sigil-tooltip-bubble sigil-tooltip-portal"
            role="tooltip"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: 'translateY(-50%)',
              zIndex: 99999,
              opacity: 1,
              visibility: 'visible',
              pointerEvents: 'none',
            }}
          >
            <div className="sigil-tooltip-preview">
              <img src={sigil.coverAsset} alt={sigil.label} />
            </div>
            <div className="sigil-tooltip-info">
              <span className="tooltip-name">{sigil.label}</span>
              <div className="tooltip-description">{sigil.description}</div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
