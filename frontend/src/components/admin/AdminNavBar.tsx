import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  SparkleIcon,
  HouseIcon,
  CompassIcon,
  CrosshairIcon,
  DiamondsFourIcon,
  GridFourIcon,
  FilmStripIcon,
  FireIcon,
  LightningIcon,
} from '@phosphor-icons/react';

export const AdminNavBar: React.FC = () => {
  const location = useLocation();

  const isSigilsActive =
    location.pathname === '/admin_dashboard/sigils' ||
    (location.pathname.startsWith('/admin_dashboard/sigils') &&
      !location.pathname.includes('create'));

  const isGlyphsActive =
    location.pathname === '/admin_dashboard/glyphs' ||
    location.pathname === '/admin/glyph' ||
    location.pathname === '/admin/glyphs';

  const isElementsActive =
    location.pathname.startsWith('/admin/elements') ||
    location.pathname === '/admin_dashboard/elements';

  const isEffectsActive =
    location.pathname.startsWith('/admin/effects') ||
    location.pathname === '/admin_dashboard/effects';

  const isTestingActive =
    location.pathname === '/glyph/testing' ||
    location.pathname === '/admin/glyph/testing' ||
    location.pathname === '/admin_dashboard/glyphs/testing';

  const isSpritesActive =
    location.pathname === '/admin_dashboard/sprites' ||
    location.pathname === '/admin/sprites';

  const isFramePickerActive =
    location.pathname === '/admin_dashboard/frame_picker' ||
    location.pathname === '/admin/frame_picker';

  return (
    <nav className="admin-nav">
      <div className="admin-nav-inner">
        <Link to="/admin_dashboard/sigils" className="admin-brand">
          <span className="admin-brand-icon">
            <SparkleIcon size={20} weight="fill" />
          </span>
          <h1>
            GLYPH MANIA <span className="admin-brand-badge">Studio</span>
          </h1>
        </Link>

        <div className="admin-nav-links">
          <Link
            to="/admin_dashboard/sigils"
            className={`admin-nav-pill ${isSigilsActive ? 'active' : ''}`}
          >
            <CompassIcon size={14} weight={isSigilsActive ? 'fill' : 'regular'} />
            Sigils Catalog
          </Link>

          <Link
            to="/admin/elements"
            className={`admin-nav-pill ${isElementsActive ? 'active' : ''}`}
          >
            <FireIcon size={14} weight={isElementsActive ? 'fill' : 'regular'} />
            Elements
          </Link>

          <Link
            to="/admin/effects"
            className={`admin-nav-pill ${isEffectsActive ? 'active' : ''}`}
          >
            <LightningIcon size={14} weight={isEffectsActive ? 'fill' : 'regular'} />
            Effects
          </Link>

          <Link
            to="/admin_dashboard/glyphs"
            className={`admin-nav-pill ${isGlyphsActive ? 'active' : ''}`}
          >
            <DiamondsFourIcon size={14} weight={isGlyphsActive ? 'fill' : 'regular'} />
            Glyphs Catalog
          </Link>

          <Link
            to="/glyph/testing"
            className={`admin-nav-pill ${isTestingActive ? 'active' : ''}`}
          >
            <CrosshairIcon size={14} weight={isTestingActive ? 'bold' : 'regular'} />
            Glyph Testing
          </Link>

          <Link
            to="/admin_dashboard/sprites"
            className={`admin-nav-pill ${isSpritesActive ? 'active' : ''}`}
          >
            <GridFourIcon size={14} weight={isSpritesActive ? 'bold' : 'regular'} />
            Sprite Studio
          </Link>

          <Link
            to="/admin_dashboard/frame_picker"
            className={`admin-nav-pill ${isFramePickerActive ? 'active' : ''}`}
          >
            <FilmStripIcon size={14} weight={isFramePickerActive ? 'bold' : 'regular'} />
            Frame Picker
          </Link>

          <div className="admin-nav-divider" />

          {/* Icon-only Back to Game Button */}
          <Link
            to="/"
            className="admin-nav-pill admin-nav-pill-icon"
            title="Back to Game"
            aria-label="Back to Game"
          >
            <HouseIcon size={15} />
          </Link>
        </div>
      </div>
    </nav>
  );
};
