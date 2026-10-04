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
    coverAsset: string;    // Standardized cover asset URL or data URL
    textureKey?: string;   // Phaser — atlas frame name (e.g. 'eff-fire')
}

// ===== Sigil =====
// Discriminated union — kept as a type since interfaces can't express unions directly.
// Each variant below is its own interface for clarity and reuse.

export type SigilType = 'effector' | 'form' | 'position';

export interface EffectorSigil extends SigilAssetRefs {
    id: string;
    label: string;
    type: 'effector';
    sigilType?: 'effector';
    element: Element;
    elementId?: string;
    baseHitDamage?: number;
    tier: number;
    description: string;
}

export interface PositionSigil extends SigilAssetRefs {
    id: string;
    label: string;
    type: 'augmentor';
    sigilType?: 'position';
    augmentorType: 'position';
    tier: number;
    description: string;
}

export interface FormSigil extends SigilAssetRefs {
    id: string;
    label: string;
    type: 'augmentor';
    sigilType?: 'form';
    augmentorType: 'form';
    formType?: FormType;
    tier: number;
    description: string;
}

export type PositionAugmentorSigil = PositionSigil;
export type FormAugmentorSigil = FormSigil;
export type Sigil = EffectorSigil | PositionSigil | FormSigil;

// ===== Stroke Data for custom drawn glyphs =====

export interface StrokePoint {
    x: number;
    y: number;
}

// ===== Tier =====

export interface Tier {
    id: string;
    level: number;
    positionSlotCount: number;   // 4 at tier 1 — up, down, left, right
    formSlotCount: number;        // 4 at tier 1 — NE, SE, SW, NW
}

// ===== Glyph =====

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
        topLeft?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number; formType?: FormType };
        topRight?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number; formType?: FormType };
        bottomLeft?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number; formType?: FormType };
        bottomRight?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number; formType?: FormType };
    };
    forms?: string[];
    /** Saved vector strokes for replay (Atrament StrokeData or raw StrokePoint arrays) */
    strokes?: unknown[];
}

/** Alias for backwards-compatibility with legacy references */
export type WorkshopGlyphComposition = GlyphComposition;

export interface GlyphBase {
    id: string;
    userId?: string;
    name?: string;
    description?: string;
    element?: Element | string;
    tier: number;
    isPublic?: boolean;
    schemaId?: string;
    /** Standardized asset reference URL (maps directly to Supabase cover_asset) */
    coverAsset?: string;
    composition: GlyphComposition;
}

/**
 * Canonical unified WorkshopGlyph representing a constructed, saved, or active spell glyph.
 * Used consistently across Workshop catalog, Hotbar, Phaser gameplay, and Supabase database.
 */
export interface WorkshopGlyph extends GlyphBase {
    name: string;
    description: string;
    element: Element | string;
    author?: string | null;
    createdAt?: string;
    savedAt?: string;
    confidenceScore?: number;
    ringClosed?: boolean;
    isDraft?: boolean;
    isUnsaved?: boolean;
}

/** Alias for backwards-compatibility with components importing WorkshopGlyphItem */
export type WorkshopGlyphItem = WorkshopGlyph;

export interface PvPGlyph extends GlyphBase {
    sourceGlyphId: string;   // traceability to the WorkshopGlyph it was copied from
    consumed: boolean;        // one-way; true once cast
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

export interface Stroke {
    id: string;
    points: StrokePoint[];
    tool: 'pen' | 'eraser';
    timestamp: number;
}