import React from 'react';
import { Sigil } from './WorkshopCatalogMenu';

interface TierGroupProps {
  tier: number;
  expanded: boolean;
  onClick: () => void;
  sigils: Sigil[];
  onSelect: (sigil: Sigil) => void;
}

const TierGroup: React.FC<TierGroupProps> = ({ tier, expanded, onClick, sigils, onSelect }) => {
  return (
    <div className="TierGroup">
      <div className="TierHeader" onClick={onClick}>
        <span>Tier {tier}</span>
      </div>
      {expanded && (
        <div className="SigilGrid">
          {sigils.map((sigil) => (
            <div key={sigil.id} className="SigilItem" onClick={() => onSelect(sigil)}>
              <img src={sigil.svg} alt={sigil.name} />
              <span>{sigil.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TierGroup;
