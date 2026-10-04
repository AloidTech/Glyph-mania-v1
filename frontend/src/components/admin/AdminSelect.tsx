import React, { useState } from 'react';
import { CaretDownIcon } from '@phosphor-icons/react';
import { ClickOutside } from '../Utils/ClickOutside';

export interface SelectOption {
  value: string;
  label: string;
}

interface AdminSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  id?: string;
}

export const AdminSelect: React.FC<AdminSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  id,
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((p) => !p);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = options.findIndex((o) => o.value === value);
      const next = options[Math.min(idx + 1, options.length - 1)];
      if (next) onChange(next.value);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = options.findIndex((o) => o.value === value);
      const prev = options[Math.max(idx - 1, 0)];
      if (prev) onChange(prev.value);
    }
  };

  return (
    <ClickOutside onClickOutside={() => setOpen(false)}>
      <div
        id={id}
        className={`admin-select-wrapper ${open ? 'open' : ''} ${className}`}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={() => setOpen((p) => !p)}
      >
        <span className="admin-select-value">
          {selected ? selected.label : <span className="admin-select-placeholder">{placeholder}</span>}
        </span>
        <CaretDownIcon size={14} className="admin-select-caret" />

        {open && (
          <ul className="admin-select-dropdown" role="listbox">
            {options.map((opt) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                className={`admin-select-option ${opt.value === value ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </ClickOutside>
  );
};
