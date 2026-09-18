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
    svgPath: string;       // React UI — path to canonical SVG (e.g. '/sigils/svg/eff-fire.svg')
    textureKey: string;    // Phaser — atlas frame name (e.g. 'eff-fire')
}

// ===== Sigil =====
// Discriminated union — kept as a type since interfaces can't express unions directly.
// Each variant below is its own interface for clarity and reuse.

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
    // direction comes from which cardinal slot it's placed in — not a sigil property
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
        topLeft?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number };
        topRight?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number };
        bottomLeft?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number };
        bottomRight?: { sigilId?: string; label?: string; customCrop?: string; confidence?: number };
    };
    strokes?: StrokePoint[] | any[];
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
    ringClosed: boolean;    // toggles freely — preview only, never destructive
    savedAt: string;
}

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