-- ==============================================================================
-- GLYPH MANIA - MIGRATION: Sigil Text IDs, Training Examples & Model Lineage
-- ==============================================================================

-- 1. Convert sigils.id from UUID to TEXT to allow semantic IDs (e.g. eff-fire, aug-position)
DO $$
BEGIN
    -- Drop foreign key constraint on schemas.center_slot if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'schemas_center_slot_fkey'
    ) THEN
        ALTER TABLE schemas DROP CONSTRAINT schemas_center_slot_fkey;
    END IF;

    -- Alter sigils.id to TEXT
    ALTER TABLE sigils ALTER COLUMN id TYPE TEXT;

    -- Alter schemas.center_slot to TEXT
    ALTER TABLE schemas ALTER COLUMN center_slot TYPE TEXT;

    -- Re-add foreign key constraint
    ALTER TABLE schemas ADD CONSTRAINT schemas_center_slot_fkey 
        FOREIGN KEY (center_slot) REFERENCES sigils(id) ON DELETE SET NULL;
END $$;

-- 2. SAVED MODELS TABLE (Checkpoints & trained weights metadata)
CREATE TABLE IF NOT EXISTS saved_models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    epochs INTEGER NOT NULL,
    batch_size INTEGER,
    final_loss REAL NOT NULL,
    final_accuracy REAL NOT NULL,
    total_examples_count INTEGER NOT NULL,
    class_labels TEXT[] NOT NULL,
    weights JSONB NOT NULL,
    history JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TRAINING EXAMPLES TABLE (Exemplars with Model Training Lineage)
CREATE TABLE IF NOT EXISTS training_examples (
    id TEXT PRIMARY KEY,
    sigil_id TEXT NOT NULL REFERENCES sigils(id) ON DELETE CASCADE,
    vec REAL[] NOT NULL,
    thumb TEXT NOT NULL,
    first_model_trained_id TEXT REFERENCES saved_models(id) ON DELETE SET NULL,
    last_model_trained_id TEXT REFERENCES saved_models(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_examples_sigil_id ON training_examples(sigil_id);
CREATE INDEX IF NOT EXISTS idx_training_examples_first_model ON training_examples(first_model_trained_id);
CREATE INDEX IF NOT EXISTS idx_training_examples_last_model ON training_examples(last_model_trained_id);

-- Optional Row Level Security (RLS)
ALTER TABLE saved_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on saved_models" 
    ON saved_models FOR SELECT USING (true);

CREATE POLICY "Allow public read access on training_examples" 
    ON training_examples FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert/update on saved_models" 
    ON saved_models FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert/update on training_examples" 
    ON training_examples FOR ALL TO authenticated USING (true);
