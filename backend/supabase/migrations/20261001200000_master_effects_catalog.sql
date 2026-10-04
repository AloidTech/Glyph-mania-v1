-- ==============================================================================
-- GLYPH MANIA - MIGRATION: Master Effects Catalog & Decoupling
-- ==============================================================================

-- 1. Create master effects table (DOT and STAT_MOD only)
CREATE TABLE IF NOT EXISTS effects (
    id VARCHAR(32) PRIMARY KEY,
    label VARCHAR(64) NOT NULL,
    category VARCHAR(16) NOT NULL CHECK (category IN ('DOT', 'STAT_MOD')),
    target_stat VARCHAR(32), -- 'SPEED', 'ARMOR', 'POISE', 'HEALTH_MAX' or NULL
    modifier_type VARCHAR(16), -- 'FLAT', 'PERCENT_MULT' or NULL
    default_magnitude NUMERIC(4,2) DEFAULT NULL,
    base_tick_damage INT DEFAULT 0,
    default_interval_ticks INT NOT NULL DEFAULT 5,
    default_duration_ticks INT NOT NULL DEFAULT 40,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed master effects catalog (including all elemental baselines)
INSERT INTO effects (id, label, category, target_stat, modifier_type, default_magnitude, base_tick_damage, default_interval_ticks, default_duration_ticks, description)
VALUES
    -- Core DOT Effects
    ('BURNING', 'Burning', 'DOT', NULL, NULL, NULL, 12, 5, 40, 'Deals periodic fire damage over time.'),
    ('IGNITE', 'Ignite', 'DOT', NULL, NULL, NULL, 25, 3, 15, 'Intense short-duration combustion damage.'),
    ('CRUSH', 'Crush Bleed', 'DOT', NULL, NULL, NULL, 18, 6, 24, 'Heavy physical crushing damage over time.'),
    ('BLEED_LACERATE', 'Lacerate Bleed', 'DOT', NULL, NULL, NULL, 10, 3, 30, 'Rapid bleeding slices from compressed air.'),
    ('TREMOR', 'Tremor Pulse', 'DOT', NULL, NULL, NULL, 8, 4, 20, 'Earth vibration shocks to the target.'),
    ('CHILL_DOT', 'Freezing Frost', 'DOT', NULL, NULL, NULL, 6, 8, 30, 'Cold damage over time.'),

    -- Core STAT_MOD Effects
    ('SLOW', 'Slow Movement', 'STAT_MOD', 'SPEED', 'PERCENT_MULT', -0.35, 0, 5, 30, 'Reduces entity movement speed by 35%.'),
    ('CHILL', 'Chilled', 'STAT_MOD', 'SPEED', 'PERCENT_MULT', -0.20, 0, 8, 30, 'Slows movement speed by 20%.'),
    ('FREEZE', 'Freeze', 'STAT_MOD', 'SPEED', 'PERCENT_MULT', -1.00, 0, 1, 20, 'Completely immobilizes entity movement (100% slow).'),
    ('PETRIFY', 'Petrify', 'STAT_MOD', 'SPEED', 'PERCENT_MULT', -1.00, 0, 1, 25, 'Turns target to stone, reducing speed by 100%.'),
    ('MELT_ARMOR', 'Melt Armor', 'STAT_MOD', 'ARMOR', 'PERCENT_MULT', -0.25, 0, 10, 60, 'Corrodes defense, reducing target armor by 25%.'),
    ('CRUSH_ARMOR', 'Armor Fracture', 'STAT_MOD', 'ARMOR', 'FLAT', -20.00, 0, 10, 50, 'Fractures defenses, subtracting 20 flat armor.'),
    ('POISE_BREAK', 'Poise Drain', 'STAT_MOD', 'POISE', 'PERCENT_MULT', -0.50, 0, 5, 20, 'Drains stability, reducing max poise by 50%.'),
    ('STAGGER', 'Stagger Interrupt', 'STAT_MOD', 'POISE', 'PERCENT_MULT', -0.80, 0, 1, 5, 'Heavy poise break that staggers the entity.'),
    ('DRENCH', 'Drenched', 'STAT_MOD', 'ARMOR', 'PERCENT_MULT', -0.15, 0, 10, 50, 'Soaks target, reducing armor and priming for freeze/shock.'),
    ('KNOCKBACK', 'Knockback Stun', 'STAT_MOD', 'SPEED', 'PERCENT_MULT', -0.60, 0, 1, 3, 'Momentary speed reduction during impulse displacement.'),
    ('VORTEX_PULL', 'Vortex Drag', 'STAT_MOD', 'SPEED', 'PERCENT_MULT', -0.40, 0, 2, 20, 'Drags target into vortex center with movement penalty.'),
    ('SILENCE_DISRUPT', 'Silence Disrupt', 'STAT_MOD', 'POISE', 'PERCENT_MULT', -0.50, 0, 1, 30, 'Disrupts spell concentration and poise.'),
    ('HASTE', 'Wind Haste', 'STAT_MOD', 'SPEED', 'PERCENT_MULT', 0.30, 0, 5, 40, 'Accelerates movement speed by +30%.'),
    ('FORTIFY', 'Stone Fortify', 'STAT_MOD', 'ARMOR', 'FLAT', 30.00, 0, 10, 60, 'Grants +30 flat bonus armor.')
ON CONFLICT (id) DO UPDATE SET
    label = EXCLUDED.label,
    category = EXCLUDED.category,
    target_stat = EXCLUDED.target_stat,
    modifier_type = EXCLUDED.modifier_type,
    default_magnitude = EXCLUDED.default_magnitude,
    base_tick_damage = EXCLUDED.base_tick_damage,
    default_interval_ticks = EXCLUDED.default_interval_ticks,
    default_duration_ticks = EXCLUDED.default_duration_ticks,
    description = EXCLUDED.description;

-- 2. Ensure element_effects references the effects table
ALTER TABLE element_effects DROP CONSTRAINT IF EXISTS fk_element_effects_effect;
ALTER TABLE element_effects 
    ADD CONSTRAINT fk_element_effects_effect 
    FOREIGN KEY (effect_type) REFERENCES effects(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Ensure sigil_effect_overrides references the effects table
ALTER TABLE sigil_effect_overrides DROP CONSTRAINT IF EXISTS fk_sigil_overrides_effect;
ALTER TABLE sigil_effect_overrides 
    ADD CONSTRAINT fk_sigil_overrides_effect 
    FOREIGN KEY (effect_type) REFERENCES effects(id) ON DELETE CASCADE ON UPDATE CASCADE;
