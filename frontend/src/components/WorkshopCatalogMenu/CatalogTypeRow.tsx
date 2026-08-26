import React from 'react';

interface CatalogTypeRowProps {
  type: string;
  expanded: boolean;
  onClick: () => void;
}

const CatalogTypeRow: React.FC<CatalogTypeRowProps> = ({ type, expanded, onClick }) => {
  return (
    <div className={`CatalogTypeRow ${expanded ? 'expanded' : ''}`} onClick={onClick}>
      <span>{type}</span>
    </div>
  );
};

export default CatalogTypeRow;
