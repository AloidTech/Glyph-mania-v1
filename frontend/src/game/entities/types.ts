/**
 * @file types.ts
 * @description Types and interfaces for isometric game entities and player systems.
 */

import type { WorkshopGlyphItem } from '../../components/WorkshopCatalogMenu/GlyphCard';

export type IsoDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface IsoPoint {
  isoX: number;
  isoY: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface IsoEntityConfig {
  isoX: number;
  isoY: number;
  radius?: number;
  speed?: number;
  scale?: number;
  texture?: string;
  originX?: number;
  originY?: number;
  shadowWidth?: number;
  shadowHeight?: number;
  shadowAlpha?: number;

  // Combat Stats
  maxHp?: number;
  currentHp?: number;
  maxPoise?: number;
  armor?: number;
  isInvincible?: boolean;
  isInvisible?: boolean;
}

export interface PlayerConfig extends IsoEntityConfig {
  glyphs?: WorkshopGlyphItem[];
  initialFacing?: IsoDirection;
}
