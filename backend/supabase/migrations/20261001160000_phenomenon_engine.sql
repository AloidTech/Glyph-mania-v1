-- 1. Create elements table
CREATE TABLE IF NOT EXISTS elements (
    id VARCHAR(32) PRIMARY KEY,
    label VARCHAR(64) NOT NULL,
    primary_color VARCHAR(9),
    secondary_color VARCHAR(9),
    particle_vfx_key VARCHAR(64),
    base_hit_damage INT NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed elements
INSERT INTO elements (id, label, primary_color, secondary_color, particle_vfx_key, base_hit_damage)
VALUES 
    ('FIRE', 'Fire', '#ef4444', '#f97316', 'fire_particles', 100),
    ('WATER', 'Water', '#0077be', '#0066aa', 'water_particles', 80),
    ('EARTH', 'Earth', '#784421', '#8b5a2b', 'earth_particles', 120),
    ('AIR', 'Air', '#d8efff', '#e0f2fe', 'air_particles', 60)
ON CONFLICT (id) DO UPDATE SET
    label = EXCLUDED.label,
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    particle_vfx_key = EXCLUDED.particle_vfx_key,
    base_hit_damage = EXCLUDED.base_hit_damage;

-- 2. Create element_effects table
CREATE TABLE IF NOT EXISTS element_effects (
    id SERIAL PRIMARY KEY,
    element_id VARCHAR(32) REFERENCES elements(id) ON DELETE CASCADE,
    effect_type VARCHAR(32),
    base_tick_damage INT DEFAULT 10,
    interval_ticks INT DEFAULT 5,
    duration_ticks INT DEFAULT 40,
    base_magnitude NUMERIC(4,2) DEFAULT NULL,
    UNIQUE(element_id, effect_type)
);

-- Seed element_effects
INSERT INTO element_effects (element_id, effect_type, base_tick_damage, interval_ticks, duration_ticks, base_magnitude)
VALUES 
    -- FIRE: Damage-over-time, burst combustion, armor melting
    ('FIRE', 'BURNING', 12, 5, 40, NULL),
    ('FIRE', 'IGNITE', 25, 3, 15, NULL),
    ('FIRE', 'MELT_ARMOR', 0, 10, 60, 0.20),

    -- WATER: Slows, chills, drench amplification, freeze immobilization
    ('WATER', 'SLOW', 0, 5, 30, 0.35),
    ('WATER', 'CHILL', 6, 8, 30, 0.15),
    ('WATER', 'DRENCH', 0, 10, 50, 0.25),
    ('WATER', 'FREEZE', 0, 1, 20, 1.00),

    -- EARTH: Stagger interrupt, armor-crushing dot, petrify, tremor pulse
    ('EARTH', 'STAGGER', 0, 1, 5, 0.80),
    ('EARTH', 'CRUSH', 18, 6, 24, NULL),
    ('EARTH', 'PETRIFY', 0, 1, 25, 1.00),
    ('EARTH', 'TREMOR', 5, 4, 20, 0.20),

    -- AIR: Knockback impulse, razor lacerations, vortex pull, silence
    ('AIR', 'KNOCKBACK', 0, 1, 3, 0.60),
    ('AIR', 'BLEED_LACERATE', 10, 3, 30, NULL),
    ('AIR', 'VORTEX_PULL', 0, 2, 20, 0.40),
    ('AIR', 'SILENCE_DISRUPT', 0, 5, 20, NULL)
ON CONFLICT (element_id, effect_type) DO UPDATE SET
    base_tick_damage = EXCLUDED.base_tick_damage,
    interval_ticks = EXCLUDED.interval_ticks,
    duration_ticks = EXCLUDED.duration_ticks,
    base_magnitude = EXCLUDED.base_magnitude;

-- 3. Evolve sigils table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sigils' AND column_name = 'sigil_type') THEN
        ALTER TABLE sigils ADD COLUMN sigil_type VARCHAR(16);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sigils' AND column_name = 'element_id') THEN
        ALTER TABLE sigils ADD COLUMN element_id VARCHAR(32) REFERENCES elements(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sigils' AND column_name = 'base_hit_damage') THEN
        ALTER TABLE sigils ADD COLUMN base_hit_damage INT NOT NULL DEFAULT 100;
    END IF;
END $$;

-- Migrate sigils data
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sigils' AND column_name = 'type') THEN
        UPDATE sigils SET sigil_type = 'effector' WHERE type::text = 'effector';
        UPDATE sigils SET sigil_type = 'form' WHERE type::text = 'augmentor' AND augmentor_type::text = 'form';
        UPDATE sigils SET sigil_type = 'position' WHERE type::text = 'augmentor' AND augmentor_type::text = 'position';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sigils' AND column_name = 'element') THEN
        UPDATE sigils SET element_id = UPPER(element::text) WHERE element IS NOT NULL AND element_id IS NULL;
    END IF;
END $$;

-- Make sigil_type NOT NULL after migration
DO $$
BEGIN
    UPDATE sigils SET sigil_type = 'effector' WHERE sigil_type IS NULL;
    ALTER TABLE sigils ALTER COLUMN sigil_type SET NOT NULL;
END $$;

-- Add comments for deprecated columns
COMMENT ON COLUMN sigils.type IS '@deprecated Use sigil_type instead';
COMMENT ON COLUMN sigils.augmentor_type IS '@deprecated Use sigil_type instead';
COMMENT ON COLUMN sigils.form_type IS '@deprecated Refactored to generic sigil system';
COMMENT ON COLUMN sigils.element IS '@deprecated Use element_id instead';

-- 4. Evolve tiers table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tiers' AND column_name = 'id' AND data_type = 'uuid'
    ) THEN
        -- Add temp column to tiers
        ALTER TABLE tiers ADD COLUMN new_id VARCHAR;
        UPDATE tiers SET new_id = level::text;
        
        -- Handle glyphs table
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'glyphs' AND column_name = 'tier_id') THEN
            ALTER TABLE glyphs ADD COLUMN new_tier_id VARCHAR;
            UPDATE glyphs SET new_tier_id = (SELECT new_id FROM tiers WHERE tiers.id = glyphs.tier_id);
            ALTER TABLE glyphs DROP CONSTRAINT IF EXISTS glyphs_tier_id_fkey;
        END IF;

        -- Handle schemas table
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schemas' AND column_name = 'tier_id') THEN
            ALTER TABLE schemas ADD COLUMN new_tier_id VARCHAR;
            UPDATE schemas SET new_tier_id = (SELECT new_id FROM tiers WHERE tiers.id = schemas.tier_id);
            ALTER TABLE schemas DROP CONSTRAINT IF EXISTS schemas_tier_id_fkey;
        END IF;

        -- Drop PK and replace tiers.id
        ALTER TABLE tiers DROP CONSTRAINT IF EXISTS tiers_pkey CASCADE;
        ALTER TABLE tiers DROP COLUMN id;
        ALTER TABLE tiers RENAME COLUMN new_id TO id;
        ALTER TABLE tiers ADD PRIMARY KEY (id);

        -- Replace glyphs.tier_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'glyphs' AND column_name = 'new_tier_id') THEN
            ALTER TABLE glyphs DROP COLUMN tier_id;
            ALTER TABLE glyphs RENAME COLUMN new_tier_id TO tier_id;
            ALTER TABLE glyphs ADD CONSTRAINT glyphs_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES tiers(id);
        END IF;

        -- Replace schemas.tier_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schemas' AND column_name = 'new_tier_id') THEN
            ALTER TABLE schemas DROP COLUMN tier_id;
            ALTER TABLE schemas RENAME COLUMN new_tier_id TO tier_id;
            ALTER TABLE schemas ADD CONSTRAINT schemas_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES tiers(id);
        END IF;
    END IF;
END $$;

-- 5. Create sigil_effect_overrides table
CREATE TABLE IF NOT EXISTS sigil_effect_overrides (
    sigil_id TEXT REFERENCES sigils(id) ON DELETE CASCADE,
    effect_type VARCHAR(32),
    tick_damage_mult NUMERIC(4,2) DEFAULT 1.0,
    duration_ticks_override INT DEFAULT NULL,
    interval_ticks_override INT DEFAULT NULL,
    is_excluded BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (sigil_id, effect_type)
);

-- 6. Create resolve_sigil_effects Postgres function
CREATE OR REPLACE FUNCTION resolve_sigil_effects(p_sigil_id TEXT)
RETURNS TABLE (
    effect_type VARCHAR(32),
    tick_damage INT,
    interval_ticks INT,
    duration_ticks INT,
    magnitude NUMERIC(4,2)
) AS $func$
BEGIN
    RETURN QUERY
    SELECT 
        ee.effect_type,
        (ee.base_tick_damage * COALESCE(seo.tick_damage_mult, 1.0))::INT as tick_damage,
        COALESCE(seo.interval_ticks_override, ee.interval_ticks) as interval_ticks,
        COALESCE(seo.duration_ticks_override, ee.duration_ticks) as duration_ticks,
        ee.base_magnitude as magnitude
    FROM sigils s
    JOIN element_effects ee ON s.element_id = ee.element_id
    LEFT JOIN sigil_effect_overrides seo ON s.id = seo.sigil_id AND ee.effect_type = seo.effect_type
    WHERE s.id = p_sigil_id
      AND (seo.is_excluded IS NULL OR seo.is_excluded = FALSE);
END;
$func$ LANGUAGE plpgsql STABLE;

-- 7. Enable RLS and add policies
ALTER TABLE elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE element_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sigil_effect_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- elements
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read elements') THEN
        CREATE POLICY "Public read elements" ON elements FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated write elements') THEN
        CREATE POLICY "Authenticated write elements" ON elements FOR ALL USING (auth.role() = 'authenticated');
    END IF;

    -- element_effects
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read element_effects') THEN
        CREATE POLICY "Public read element_effects" ON element_effects FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated write element_effects') THEN
        CREATE POLICY "Authenticated write element_effects" ON element_effects FOR ALL USING (auth.role() = 'authenticated');
    END IF;

    -- sigil_effect_overrides
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read sigil_effect_overrides') THEN
        CREATE POLICY "Public read sigil_effect_overrides" ON sigil_effect_overrides FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated write sigil_effect_overrides') THEN
        CREATE POLICY "Authenticated write sigil_effect_overrides" ON sigil_effect_overrides FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;
