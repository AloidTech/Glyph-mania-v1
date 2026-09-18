-- ==============================================================================
-- GLYPH MANIA - DATABASE SCHEMA
-- Generated from backend/src/types/glyph_types.ts
-- ==============================================================================

-- 1. ENUMS (Based on literal types)
-- ------------------------------------------------------------------------------
CREATE TYPE element_type AS ENUM ('fire', 'water', 'earth', 'air');

CREATE TYPE form_type AS ENUM ('dash', 'whirl', 'condense', 'compress');

CREATE TYPE sigil_kind AS ENUM ('effector', 'augmentor');

CREATE TYPE augmentor_kind AS ENUM ('position', 'form');

-- 2. TIERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    level INTEGER NOT NULL UNIQUE,
    position_slot_count INTEGER NOT NULL DEFAULT 4,
    form_slot_count INTEGER NOT NULL DEFAULT 4
);

-- Insert default tier 1
INSERT INTO
    tiers (
        level,
        position_slot_count,
        form_slot_count
    )
VALUES (1, 4, 4) ON CONFLICT (level) DO NOTHING;

-- 3. SIGILS TABLE (Single Table Inheritance for the Discriminated Union)
-- ------------------------------------------------------------------------------
CREATE TABLE sigils (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    tier INTEGER NOT NULL DEFAULT 1,

-- SigilAssetRefs
svg_path TEXT NOT NULL, texture_key TEXT NOT NULL,

-- Discriminated Union Type
type sigil_kind NOT NULL,

-- Effector-specific fields
element element_type,

-- Augmentor-specific fields
augmentor_type augmentor_kind, form_type form_type,

-- Data Integrity Constraints
CONSTRAINT check_effector_fields CHECK (
        (type != 'effector') OR 
        (element IS NOT NULL AND augmentor_type IS NULL AND form_type IS NULL)
    ),
    CONSTRAINT check_position_augmentor_fields CHECK (
        (type != 'augmentor' OR augmentor_type != 'position') OR 
        (element IS NULL AND form_type IS NULL)
    ),
    CONSTRAINT check_form_augmentor_fields CHECK (
        (type != 'augmentor' OR augmentor_type != 'form') OR 
        (element IS NULL) -- form_type is optional in the TS interface
    )
);

-- 4. SCHEMAS TABLE (Reusable templates)
-- ------------------------------------------------------------------------------
CREATE TABLE schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    tier_id UUID NOT NULL REFERENCES tiers(id) ON DELETE CASCADE,

-- Stored as JSON arrays of strings (sigil IDs) or nulls
position_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    form_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    center_slot UUID REFERENCES sigils(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. GLYPHS TABLE
-- ------------------------------------------------------------------------------
-- Combines GlyphBase, WorkshopGlyph, and PvPGlyph into a single table
CREATE TABLE glyphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- Assuming Supabase Auth: REFERENCES auth.users(id)

-- Foreign Keys
tier_id UUID NOT NULL REFERENCES tiers (id) ON DELETE RESTRICT,
schema_id UUID REFERENCES schemas (id) ON DELETE SET NULL,

-- The full nested composition object is best stored as JSONB
-- Shape matches GlyphComposition: { effector: {}, directions: {}, formAugmentors: {} }
composition JSONB NOT NULL DEFAULT '{}'::jsonb,

-- WorkshopGlyph fields
ring_closed BOOLEAN NOT NULL DEFAULT false,
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

-- PvPGlyph fields
is_pvp BOOLEAN NOT NULL DEFAULT false,
source_glyph_id UUID REFERENCES glyphs (id) ON DELETE SET NULL,
consumed BOOLEAN NOT NULL DEFAULT false,

-- Metadata (Not in types but usually needed)
name TEXT,
description TEXT,
element element_type,
is_public BOOLEAN NOT NULL DEFAULT false,

-- Data Integrity Constraints
CONSTRAINT check_pvp_fields CHECK (
        (is_pvp = false) OR 
        (source_glyph_id IS NOT NULL)
    )
);

-- Index for querying a user's glyphs quickly
CREATE INDEX idx_glyphs_user_id ON glyphs (user_id);

CREATE INDEX idx_glyphs_is_pvp ON glyphs (is_pvp);

CREATE INDEX idx_glyphs_is_public ON glyphs (is_public);