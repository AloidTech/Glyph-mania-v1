-- ==============================================================================
-- GLYPH MANIA - MIGRATION: Convert Training Example Model Tracking to Array
-- ==============================================================================
-- Replaces scalar columns (first_model_trained_id, last_model_trained_id)
-- with an array column (model_ids TEXT[]) to support multi-model training lineage.

DO $$
BEGIN
    -- 1. Add model_ids column if it does not already exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'training_examples' AND column_name = 'model_ids'
    ) THEN
        ALTER TABLE training_examples ADD COLUMN model_ids TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
    END IF;

    -- 2. Migrate existing scalar IDs into model_ids array if old columns exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'training_examples' AND column_name = 'first_model_trained_id'
    ) THEN
        -- Collect distinct non-null model IDs into the array
        UPDATE training_examples
        SET model_ids = ARRAY_REMOVE(ARRAY[first_model_trained_id, last_model_trained_id], NULL)
        WHERE (first_model_trained_id IS NOT NULL OR last_model_trained_id IS NOT NULL)
          AND (model_ids IS NULL OR model_ids = '{}'::TEXT[]);

        -- Drop foreign key constraints on the old columns
        ALTER TABLE training_examples DROP CONSTRAINT IF EXISTS training_examples_first_model_trained_id_fkey;
        ALTER TABLE training_examples DROP CONSTRAINT IF EXISTS training_examples_last_model_trained_id_fkey;

        -- Drop old scalar indexes
        DROP INDEX IF EXISTS idx_training_examples_first_model;
        DROP INDEX IF EXISTS idx_training_examples_last_model;

        -- Drop old scalar columns
        ALTER TABLE training_examples DROP COLUMN IF EXISTS first_model_trained_id;
        ALTER TABLE training_examples DROP COLUMN IF EXISTS last_model_trained_id;
    END IF;
END $$;

-- 3. Create GIN index on model_ids for fast array containment queries (e.g. model_ids @> ARRAY['model-123'])
CREATE INDEX IF NOT EXISTS idx_training_examples_model_ids ON training_examples USING GIN (model_ids);
