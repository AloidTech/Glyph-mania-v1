-- Migration: Unify visual asset fields across sigils and glyphs
-- Renames svg_path to cover_asset on sigils, and adds cover_asset on glyphs.

DO $$ 
BEGIN 
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'sigils' AND column_name = 'svg_path'
  ) THEN 
    ALTER TABLE sigils RENAME COLUMN svg_path TO cover_asset;
  END IF;
END $$;

ALTER TABLE glyphs ADD COLUMN IF NOT EXISTS cover_asset TEXT;
