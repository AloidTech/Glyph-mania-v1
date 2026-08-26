import React, { useState } from 'react';
import CatalogTypeRow from './CatalogTypeRow';
import TierGroup from './TierGroup';
import './WorkshopCatalogMenu.css';

// Types for the sigils – in a real app these would be fetched from an API or a static JSON file
export interface Sigil {
  id: string;
  name: string;
  svg: string; // path to SVG asset
  tier: number; // 1‑5
  type: 'Effectors' | 'PositionAugmentors' | 'FormAugmentors';
  description: string;
}

interface WorkshopCatalogMenuProps {
  sigils: Sigil[]; // all sigils available in the game
  onSelect: (sigil: Sigil) => void; // called when a sigil is dragged or clicked
}

const sigilTypes = ['Effectors', 'PositionAugmentors', 'FormAugmentors'] as const;

const WorkshopCatalogMenu: React.FC<WorkshopCatalogMenuProps> = ({ sigils, onSelect }) => {
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [expandedTier, setExpandedTier] = useState<number | null>(null);

  const handleTypeClick = (type: string) => {
    setExpandedType(expandedType === type ? null : type);
    setExpandedTier(null);
  };

  const handleTierClick = (tier: number) => {
    setExpandedTier(expandedTier === tier ? null : tier);
  };

  return (
    <nav className="WorkshopCatalogMenu">
      {sigilTypes.map((type) => (
        <div key={type}>
          <CatalogTypeRow
            type={type}
            expanded={expandedType === type}
            onClick={() => handleTypeClick(type)}
          />
          {expandedType === type && (
            <div className="TierContainer">
              {[1, 2, 3, 4, 5].map((tier) => (
                <TierGroup
                  key={tier}
                  tier={tier}
                  expanded={expandedTier === tier}
                  onClick={() => handleTierClick(tier)}
                  sigils={sigils.filter((s) => s.type === type && s.tier === tier)}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
};

export default WorkshopCatalogMenu;
