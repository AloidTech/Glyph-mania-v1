import React, { useMemo, useState } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  CaretDownIcon,
  CaretRightIcon,
  UserIcon,
  GlobeIcon,
  FireIcon,
  DropIcon,
  WindIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { Sigil } from '../../types/glyph_types';
import { SigilCard } from './SigilCard';
import { GlyphCard, WorkshopGlyphItem } from './GlyphCard';
import { syncSigil, syncGlyph } from '../../lib/admin_utils/sync_helpers';
import { WorkshopCatalogSkeleton } from '../Common/CircularLoadingComponents';

export interface WorkshopCatalogProps {
  menuSigils: Record<string, Record<string, Sigil[]>>;
  myGlyphs: WorkshopGlyphItem[];
  publicGlyphs: WorkshopGlyphItem[];
  workshopDraft?: WorkshopGlyphItem | null;
  activeGlyphId?: string | null;
  isLoading?: boolean;
  selectedGlyphs?: WorkshopGlyphItem[];
  onToggleSelectGlyph?: (glyph: WorkshopGlyphItem) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onDeleteSelected?: () => void;
  onEnterTestingGround?: () => void;
  onOpenGlyphDetails?: (glyph: WorkshopGlyphItem) => void;
}

export const WorkshopCatalog: React.FC<WorkshopCatalogProps> = ({
  menuSigils,
  myGlyphs,
  publicGlyphs,
  workshopDraft = null,
  activeGlyphId,
  isLoading = false,
  selectedGlyphs = [],
  onToggleSelectGlyph,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  onEnterTestingGround,
  onOpenGlyphDetails,
}) => {
  const [activeTab, setActiveTab] = useState<'sigils' | 'glyphs'>('sigils');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterElement, setFilterElement] = useState<'all' | 'fire' | 'water' | 'earth' | 'air'>('all');
  const [isMyGlyphsOpen, setIsMyGlyphsOpen] = useState(true);
  const [isPublicGlyphsOpen, setIsPublicGlyphsOpen] = useState(true);

  // Filter glyph items by search query and element (and exclude active drawn glyph)
  const filterGlyphs = (items: WorkshopGlyphItem[]) => {
    return items.filter((g) => {
      if (activeGlyphId && (g.id === activeGlyphId || g.id === 'active-workshop-glyph')) {
        return false;
      }
      if (g.id === 'active-workshop-glyph') {
        return false;
      }
      const matchElem = filterElement === 'all' || g.element === filterElement;
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        (g.author?.toLowerCase().includes(q) ?? false) ||
        g.element.toLowerCase().includes(q) ||
        (Array.isArray(g.composition?.forms) && g.composition.forms.some((f: string) => f.toLowerCase().includes(q))) ||
        (Array.isArray(g.composition?.directions) && g.composition.directions.some((d: string) => d.toLowerCase().includes(q))) ||
        (g.composition?.directions && typeof g.composition.directions === 'object' && Object.values(g.composition.directions).some((d: any) => (d?.label || d?.sigilId || '').toLowerCase().includes(q)));
      return matchElem && matchQuery;
    });
  };

  const filteredMyGlyphs = useMemo(() => filterGlyphs(myGlyphs), [myGlyphs, filterElement, searchQuery]);
  const filteredPublicGlyphs = useMemo(() => filterGlyphs(publicGlyphs), [publicGlyphs, filterElement, searchQuery]);

  return (
    <div className="catelog-area">
      {/* Two-Sided Tab Switcher: Sigils vs Glyphs */}
      <div className="catelog-header">
        <div className="catelog-tabs">
          <button
            type="button"
            className={`catelog-tab ${activeTab === 'sigils' ? 'active' : ''}`}
            onClick={() => setActiveTab('sigils')}
          >
            Sigils
          </button>
          <button
            type="button"
            className={`catelog-tab ${activeTab === 'glyphs' ? 'active' : ''}`}
            onClick={() => setActiveTab('glyphs')}
          >
            Glyphs
          </button>
        </div>
      </div>

      {/* ── SIDE 1: SIGILS CATALOG ── */}
      {activeTab === 'sigils' && (
        <div className="catelog-content scroll-outer">
          <h3 className="catelog-subtitle">Arcane Sigils</h3>
          {isLoading && Object.keys(menuSigils).length === 0 ? (
            <WorkshopCatalogSkeleton label="Loading Sigils..." />
          ) : Object.keys(menuSigils).length === 0 ? (
            <div className="glyph-empty-notice">
              No sigils available.
            </div>
          ) : (
            Object.keys(menuSigils).map((type) => (
              <div key={type} className="catelog-entry">
                <h3 className="catelog-entry-title">{type}</h3>
                <div>
                  {Object.keys(menuSigils[type]).map((tier) => (
                    <div className="sigil-tier-group" key={tier}>
                      <h4>{tier}</h4>
                      <div className="sigil-catelog">
                        {menuSigils[type][tier].map((sigil: any) => (
                          <SigilCard
                            key={sigil.id}
                            sigil={sigil}
                            isDraft={sigil.isDraft}
                            onSync={() => syncSigil(sigil)}
                          >
                            <div className="sigil-items">
                              <img src={sigil.coverAsset} alt={sigil.label} />
                            </div>
                          </SigilCard>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )))}
        </div>
      )}

      {/* ── SIDE 2: GLYPHS CATALOG ── */}
      {activeTab === 'glyphs' && (
        <div className="glyphs-scrollable-content scroll-outer">
          {/* Search Bar with Filter Icon Inside (at right end) */}
          <div className="glyph-search-wrap">
            <MagnifyingGlassIcon size={15} className="glyph-search-icon" />
            <input
              type="text"
              className="glyph-search-input"
              placeholder="Search glyphs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              type="button"
              className={`glyph-filter-btn ${isFilterOpen || filterElement !== 'all' ? 'active' : ''}`}
              onClick={() => setIsFilterOpen((prev) => !prev)}
              title={isFilterOpen ? 'Close filter' : 'Filter by element'}
              aria-label="Filter by element"
            >
              <FunnelIcon size={14} weight={filterElement !== 'all' ? 'fill' : 'bold'} />
            </button>
          </div>

          {/* Filter Pills Bar (Toggled by the inside Filter Icon) */}
          {isFilterOpen && (
            <div className="glyph-filter-pills scroll-inner">
              {(['all', 'fire', 'water', 'earth', 'air'] as const).map((el) => (
                <button
                  key={el}
                  type="button"
                  className={`glyph-filter-pill ${filterElement === el ? 'active' : ''}`}
                  onClick={() => setFilterElement(el)}
                >
                  {el === 'all' && 'All'}
                  {el === 'fire' && <><FireIcon size={11} weight="fill" className="glyph-badge-fire" /> Fire</>}
                  {el === 'water' && <><DropIcon size={11} weight="fill" className="glyph-badge-water" /> Water</>}
                  {el === 'earth' && <><GlobeIcon size={11} weight="fill" className="glyph-badge-earth" /> Earth</>}
                  {el === 'air' && <><WindIcon size={11} className="glyph-badge-air" /> Air</>}
                </button>
              ))}
            </div>
          )}

          {/* Selection Toolbar Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.35rem 0.75rem',
              background: 'rgba(0, 0, 0, 0.02)',
              borderBottom: '1px solid var(--color-border, #e0d8cb)',
              fontSize: '0.74rem',
            }}
          >
            <span style={{ color: 'var(--color-text-muted, #7c7267)', fontWeight: 500 }}>
              {selectedGlyphs.length > 0 ? (
                <strong style={{ color: 'var(--color-text-primary, #2a2421)' }}>{selectedGlyphs.length} selected</strong>
              ) : (
                'Select glyphs to test'
              )}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {onSelectAll && (
                <button
                  type="button"
                  onClick={onSelectAll}
                  style={{
                    background: 'var(--color-surface, #fdfbf7)',
                    border: '1px solid var(--color-border, #c8bead)',
                    borderRadius: '9999px',
                    padding: '2px 9px',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--color-text-primary, #2a2421)',
                    transition: 'all 0.15s ease',
                  }}
                  title="Select all available glyphs"
                >
                  Select All
                </button>
              )}
              {selectedGlyphs.length > 0 && onClearSelection && (
                <button
                  type="button"
                  onClick={onClearSelection}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--color-border, #d8d0c2)',
                    borderRadius: '9999px',
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted, #7c7267)',
                    transition: 'all 0.15s ease',
                  }}
                  title="Clear all selections"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* 1. "My Glyphs v" Dropdown Accordion */}
          <div className="glyph-accordion-section">
            <button
              type="button"
              className="glyph-accordion-header"
              onClick={() => setIsMyGlyphsOpen((prev) => !prev)}
              aria-expanded={isMyGlyphsOpen}
            >
              <div className="glyph-accordion-title">
                <UserIcon size={15} weight="bold" />
                <span>My Glyphs</span>
                <span className="glyph-accordion-badge">{filteredMyGlyphs.length}</span>
              </div>
              {isMyGlyphsOpen ? (
                <CaretDownIcon size={15} weight="bold" />
              ) : (
                <CaretRightIcon size={15} weight="bold" />
              )}
            </button>

              {isMyGlyphsOpen && (
                <div className="glyph-accordion-body scroll-inner">
                  {/* Workshop Draft — always shown first if present */}
                  {workshopDraft && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '2px 8px 4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: 'var(--color-text-muted)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}>
                        <span style={{
                          display: 'inline-block',
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#d97706',
                          flexShrink: 0,
                        }} />
                        Workshop Draft
                      </div>
                      <div style={{
                        border: '1.5px dashed rgba(217, 119, 6, 0.5)',
                        borderRadius: '8px',
                        background: 'rgba(254, 243, 199, 0.18)',
                        overflow: 'hidden',
                      }}>
                        <GlyphCard
                          glyph={{ ...workshopDraft, isDraft: true }}
                          isSelected={selectedGlyphs.some((g) => g.id === workshopDraft.id)}
                          onToggleSelect={onToggleSelectGlyph}
                          onClick={onOpenGlyphDetails}
                          onSync={() => syncGlyph(workshopDraft as any)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Saved Private Glyphs */}
                  {isLoading && myGlyphs.length === 0 ? (
                    <WorkshopCatalogSkeleton label="Loading Glyphs..." />
                  ) : filteredMyGlyphs.length === 0 && !workshopDraft ? (
                    <div className="glyph-empty-notice">
                      {searchQuery || filterElement !== 'all'
                        ? 'No saved glyphs match your filter.'
                        : 'No saved glyphs yet. Click the save icon on the pad to craft one!'}
                    </div>
                  ) : filteredMyGlyphs.length === 0 ? null : (
                    filteredMyGlyphs.map((glyph) => (
                      <GlyphCard
                        key={glyph.id}
                        glyph={glyph}
                        isSelected={selectedGlyphs.some((g) => g.id === glyph.id)}
                        onToggleSelect={onToggleSelectGlyph}
                        onClick={onOpenGlyphDetails}
                        onSync={() => syncGlyph(glyph as any)}
                      />
                    ))
                  )}
                </div>
              )}
          </div>

          {/* 2. "Public Glyphs v" Dropdown Accordion */}
          <div className="glyph-accordion-section">
            <button
              type="button"
              className="glyph-accordion-header"
              onClick={() => setIsPublicGlyphsOpen((prev) => !prev)}
              aria-expanded={isPublicGlyphsOpen}
            >
              <div className="glyph-accordion-title">
                <GlobeIcon size={15} weight="bold" />
                <span>Public Glyphs</span>
                <span className="glyph-accordion-badge">{filteredPublicGlyphs.length}</span>
              </div>
              {isPublicGlyphsOpen ? (
                <CaretDownIcon size={15} weight="bold" />
              ) : (
                <CaretRightIcon size={15} weight="bold" />
              )}
            </button>

            {isPublicGlyphsOpen && (
              <div className="glyph-accordion-body scroll-inner">
                {filteredPublicGlyphs.length === 0 ? (
                  <div className="glyph-empty-notice">
                    No public glyphs match your search.
                  </div>
                ) : (
                  filteredPublicGlyphs.map((glyph) => (
                    <GlyphCard
                      key={glyph.id}
                      glyph={glyph}
                      isSelected={selectedGlyphs.some((g) => g.id === glyph.id)}
                      onToggleSelect={onToggleSelectGlyph}
                      onClick={onOpenGlyphDetails}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Glyphs Action Bar for Testing Ground — Fully Rounded Floating Pill */}
          {selectedGlyphs.length > 0 && (
            <div
              style={{
                marginTop: 'auto',
                margin: '0.65rem 0.5rem 0.5rem 0.5rem',
                padding: '0.35rem 0.5rem 0.35rem 0.85rem',
                background: 'var(--color-surface-raised, #fdfbf7)',
                border: '1.5px solid var(--color-border-strong, #c8bead)',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.4rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                boxSizing: 'border-box',
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary, #2a2421)', whiteSpace: 'nowrap' }}>
                  {selectedGlyphs.length} selected
                </span>
                {onClearSelection && (
                  <button
                    type="button"
                    onClick={onClearSelection}
                    className="selection-pill-action"
                    title="Cancel selection"
                  >
                    Clear
                  </button>
                )}
                {onSelectAll && (
                  <button
                    type="button"
                    onClick={onSelectAll}
                    className="selection-pill-action"
                    title="Select all"
                  >
                    All
                  </button>
                )}
                {onDeleteSelected && (
                  <button
                    type="button"
                    onClick={onDeleteSelected}
                    className="selection-pill-action selection-pill-delete"
                    style={{
                      color: '#b91c1c',
                      borderColor: 'rgba(185, 28, 28, 0.35)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                    title="Delete selected glyphs"
                  >
                    <TrashIcon size={12} weight="bold" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkshopCatalog;
