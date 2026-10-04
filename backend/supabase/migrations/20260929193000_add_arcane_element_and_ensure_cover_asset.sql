-- ==============================================================================
-- GLYPH MANIA - MIGRATION: Finalize cover_asset Standard
-- ==============================================================================

-- 1. Ensure cover_asset column exists on both sigils and glyphs
ALTER TABLE sigils ADD COLUMN IF NOT EXISTS cover_asset TEXT;
ALTER TABLE glyphs ADD COLUMN IF NOT EXISTS cover_asset TEXT;

-- 2. Safely migrate any lingering svg_path data to cover_asset and remove legacy column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'sigils' AND column_name = 'svg_path'
  ) THEN
    UPDATE sigils 
    SET cover_asset = svg_path 
    WHERE cover_asset IS NULL OR cover_asset = '';
    
    ALTER TABLE sigils DROP COLUMN svg_path;
  END IF;
END $$;
