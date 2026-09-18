// ===== Literal Types =====

export type Element = 'fire' | 'water' | 'earth' | 'air';
export type FormType = 'dash' | 'whirl' | 'condense' | 'compress';
export type SigilKind = 'effector' | 'augmentor';
export type AugmentorType = 'position' | 'form';
export type PlacementState = 'placed' | 'activated';
export type ExecutionMode = 'edit' | 'preview' | 'replay';
export type GlyphSourceKind = 'workshop' | 'pvp';
export type Direction = 'up' | 'down' | 'left' | 'right';

// ===== Sigil Asset References =====

export interface SigilAssetRefs {
  svgPath: string; // React UI — path to canonical SVG (e.g. '/sigils/svg/eff-fire.svg')
  textureKey: string; // Phaser — atlas frame name (e.g. 'eff-fire')
}

// ===== Sigil =====

export interface EffectorSigil extends SigilAssetRefs {
  id: string;
  label: string;
  type: 'effector';
  element: Element;
  tier: number;
  description: string;
}

export interface PositionAugmentorSigil extends SigilAssetRefs {
  id: string;
  label: string;
  type: 'augmentor';
  augmentorType: 'position';
  tier: number;
  description: string;
}

export interface FormAugmentorSigil extends SigilAssetRefs {
  id: string;
  label: string;
  type: 'augmentor';
  augmentorType: 'form';
  formType?: FormType;
  tier: number;
  description: string;
}

export type Sigil = EffectorSigil | PositionAugmentorSigil | FormAugmentorSigil;

// ===== Tier =====

export interface Tier {
  id: string;
  level: number;
  positionSlotCount: number; // 4 at tier 1 — up, down, left, right
  formSlotCount: number;     // 4 at tier 1 — NE, SE, SW, NW
}

// ===== Glyph Composition =====

export interface GlyphComposition {
  effector?: {
    sigilId?: string;
    label?: string;
    element?: Element;
    customCrop?: string; // Data URL or asset path
    confidence?: number;
  };
  directions: {
    top?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number };
    right?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number };
    bottom?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number };
    left?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number };
  };
  formAugmentors: {
    topLeft?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number };
    topRight?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number };
    bottomLeft?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number };
    bottomRight?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number };
  };
}

export interface GlyphBase {
  id: string;
  userId?: string;
  name?: string;
  description?: string;
  element?: Element;
  tier: number;
  isPublic?: boolean;
  schemaId?: string;
  composition: GlyphComposition;

}

export interface WorkshopGlyph extends GlyphBase {
  ringClosed: boolean; // toggles freely — preview only, never destructive
  savedAt: string;
}

export interface PvPGlyph extends GlyphBase {
  sourceGlyphId: string; // traceability to the WorkshopGlyph it was copied from
  consumed: boolean;     // one-way; true once cast
}

// ===== Schema (reusable template) =====

export interface Schema {
  id: string;
  label: string;
  tierId: string;
  positionSlots: (string | null)[];
  formSlots: (string | null)[];
  centerSlot: string | null;
}

// ===== Transform & Active Instance =====

export interface Transform {
  position: { x: number; y: number };
  direction: Direction;
}

export interface ActiveGlyphInstance {
  id: string;
  glyphId: string;
  transform: Transform;
  state: PlacementState;
}

// ===== Scene Glyph Inventory =====

export interface SceneGlyphInventory {
  mode: ExecutionMode;
  instances: ActiveGlyphInstance[];
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: StrokePoint[];
  tool: 'pen' | 'eraser';
  timestamp: number;
}

export interface AdminSigilItem {
  id: string;
  label: string;
  type: SigilKind;
  tier: number;
  description: string;
  svgPath: string;
  element?: Element;
  augmentorType?: AugmentorType;
  formType?: FormType;
}

// ===== Solidity Analysis & Diagnostics =====

export interface SlotSolidityAnalysis {
  effector: boolean;
  directions: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
  formAugmentors: {
    topLeft: boolean;
    topRight: boolean;
    bottomLeft: boolean;
    bottomRight: boolean;
  };
}

export type SlotAccuracies = Partial<{
  effector: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
}> | Record<string, number>;

export interface SlotErrorDetail {
  type: 'low_accuracy' | 'type_mismatch' | 'form_mismatch' | 'unrecognized' | 'missing';
  message: string;
}

export interface SolidityAnalysis {
  isSolid: boolean;
  slots: SlotSolidityAnalysis;
  reasons: string[];
  formType?: FormType | null;
  lowAccuracySlots: string[];
  accuracies: Record<string, number>;
  slotErrors: Record<string, SlotErrorDetail[]>;
}

// ===== Spatial & Canvas Diagnostic Types =====

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SemanticCropItem {
  key?: string;
  dataUrl?: string;
  recognition: {
    label?: string | null;
    confidence?: number | null;
  };
}

export interface GlyphCompositionAnalysis {
  rawCrops?: any[];
  spatial?: {
    effectorComponents?: { bbox: BoundingBox }[];
    directions?: Record<string, { bbox: BoundingBox }>;
    forms?: Record<string, { bbox: BoundingBox }[]>;
  };
  semanticCrops: Record<string, SemanticCropItem>;
  summary?: {
    effectorCount: number;
    directionsCount: number;
    formsCount: number;
    totalComponents: number;
  };
}

export interface CanvasSigilError {
  key: string;
  title: string;
  label: string;
  errorType: 'low_accuracy' | 'type_mismatch' | 'form_mismatch' | 'unrecognized' | 'missing' | 'invalid';
  message: string;
  confidence?: number | null;
  bbox: BoundingBox;
}