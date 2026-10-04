import React, { useState } from 'react';
import { FloppyDisk, CircleNotch } from '@phosphor-icons/react';

export interface UnsavedBadgeProps {
  isDraft?: boolean;
  isUnsaved?: boolean;
  onClick?: (e: React.MouseEvent) => void | Promise<any>;
  className?: string;
  style?: React.CSSProperties;
  size?: number;
  title?: string;
}

export const UnsavedBadge: React.FC<UnsavedBadgeProps> = ({
  isDraft,
  isUnsaved,
  onClick,
  className = 'admin-card-status-badge unsaved',
  style,
  size = 12,
  title,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);

  // If neither isDraft nor isUnsaved is truthy, don't render anything
  if (!isDraft && !isUnsaved) return null;

  const isClickable = Boolean(onClick);

  const defaultTitle = isClickable
    ? isDraft
      ? 'Unsaved Draft · Click to sync with database'
      : 'Unsaved Changes · Click to sync with database'
    : isDraft
    ? 'Unsaved Draft'
    : 'Unsaved Changes';

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSyncing || !onClick) return;

    try {
      setIsSyncing(true);
      await onClick(e);
    } catch (err) {
      console.error('Error during sync:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.stopPropagation();
      handleClick(e as unknown as React.MouseEvent);
    }
  };

  return (
    <span
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={`${className} ${isClickable ? 'clickable' : ''}`}
      style={{
        cursor: isClickable ? (isSyncing ? 'wait' : 'pointer') : 'help',
        ...style,
      }}
      title={isSyncing ? 'Syncing to database…' : title || defaultTitle}
      aria-label={title || defaultTitle}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {isSyncing ? (
        <CircleNotch size={size} className="badge-spin" weight="bold" />
      ) : (
        <FloppyDisk size={size} weight="fill" />
      )}
    </span>
  );
};
