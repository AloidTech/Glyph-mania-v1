import React, { useRef, useEffect } from 'react';

interface ClickOutsideProps {
  children: React.ReactNode;
  onClickOutside: () => void;
  className?: string;
}

export const ClickOutside: React.FC<ClickOutsideProps> = ({ children, onClickOutside, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClickOutside();
      }
    };
    
    // Use mousedown to prevent drag-select from triggering click outside
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClickOutside]);

  return (
    <div ref={ref} className={className} style={{ display: 'contents' }}>
      {children}
    </div>
  );
};
