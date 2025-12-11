-- ============================================
-- SEED MINING COMPANIES - À EXÉCUTER DANS SUPABASE SQL EDITOR
-- ============================================
--
-- INSTRUCTIONS:
-- 1. Ouvrir Supabase Dashboard
-- 2. Aller dans SQL Editor
-- 3. Copier-coller ce script complet
-- 4. Cliquer sur "RUN" ou "Execute"
-- 5. Vérifier les messages de succès
--
-- ============================================

-- Vérifier la structure de la table mining_companies
DO $$
DECLARE
    v_columns TEXT;
BEGIN
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    INTO v_columns
    FROM information_schema.columns
    WHERE table_name = 'mining_companies'
      AND table_schema = 'public';

    RAISE NOTICE 'Colonnes de mining_companies: %', v_columns;
END $$;

-- Insérer les mining companies (en utilisant uniquement les colonnes qui existent)
DO $$
DECLARE
    v_kgm_id UUID;
    v_dgb_id UUID;
    v_yan_id UUID;
BEGIN
    -- KGM/Kourousa
    IF NOT EXISTS (SELECT 1 FROM mining_companies WHERE abbreviation = 'KGM') THEN
        INSERT INTO mining_companies (
            name,
            abbreviation,
            code,
            country,
            is_active
        ) VALUES (
            'Kourousa',
            'KGM',
            'KGM',
            'Guinea',
            true
        ) RETURNING id INTO v_kgm_id;

        RAISE NOTICE '✅ KGM/Kourousa créé avec ID: %', v_kgm_id;
    ELSE
        SELECT id INTO v_kgm_id FROM mining_companies WHERE abbreviation = 'KGM';
        RAISE NOTICE '⏭️  KGM/Kourousa existe déjà avec ID: %', v_kgm_id;
    END IF;

    -- DGB/Dugbe
    IF NOT EXISTS (SELECT 1 FROM mining_companies WHERE abbreviation = 'DGB') THEN
        INSERT INTO mining_companies (
            name,
            abbreviation,
            code,
            country,
            is_active
        ) VALUES (
            'Dugbe',
            'DGB',
            'DGB',
            'Liberia',
            true
        ) RETURNING id INTO v_dgb_id;

        RAISE NOTICE '✅ DGB/Dugbe créé avec ID: %', v_dgb_id;
    ELSE
        SELECT id INTO v_dgb_id FROM mining_companies WHERE abbreviation = 'DGB';
        RAISE NOTICE '⏭️  DGB/Dugbe existe déjà avec ID: %', v_dgb_id;
    END IF;

    -- YAN/Yanfolila
    IF NOT EXISTS (SELECT 1 FROM mining_companies WHERE abbreviation = 'YAN') THEN
        INSERT INTO mining_companies (
            name,
            abbreviation,
            code,
            country,
            is_active
        ) VALUES (
            'Yanfolila',
            'YAN',
            'YAN',
            'Mali',
            true
        ) RETURNING id INTO v_yan_id;

        RAISE NOTICE '✅ YAN/Yanfolila créé avec ID: %', v_yan_id;
    ELSE
        SELECT id INTO v_yan_id FROM mining_companies WHERE abbreviation = 'YAN';
        RAISE NOTICE '⏭️  YAN/Yanfolila existe déjà avec ID: %', v_yan_id;
    END IF;
END $$;

-- Vérifier les résultats
DO $$
DECLARE
    v_count INTEGER;
    r RECORD;
BEGIN
    SELECT COUNT(*) INTO v_count FROM mining_companies;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RÉSULTATS DU SEED';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total Mining Companies: %', v_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Liste des companies:';

    FOR r IN (SELECT id, name, abbreviation, country FROM mining_companies ORDER BY name)
    LOOP
        RAISE NOTICE '  - % (%) - % [ID: %]', r.name, r.abbreviation, r.country, r.id;
    END LOOP;

    RAISE NOTICE '========================================';
END $$;

-- Créer des indexes pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_mining_companies_abbreviation
    ON mining_companies(abbreviation);

CREATE INDEX IF NOT EXISTS idx_mining_companies_is_active
    ON mining_companies(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_production_mining_company
    ON production(mining_company_id) WHERE mining_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_freight_shipments_production
    ON freight_shipments(production_id) WHERE production_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gold_inventory_freight_shipment
    ON gold_inventory(freight_shipment_id) WHERE freight_shipment_id IS NOT NULL;

RAISE NOTICE '';
RAISE NOTICE '✅ Indexes créés avec succès';
RAISE NOTICE '';
RAISE NOTICE '🎉 SEED TERMINÉ AVEC SUCCÈS!';
RAISE NOTICE '';
RAISE NOTICE 'Vous pouvez maintenant rafraîchir la page Gold Trade Space';
RAISE NOTICE 'et sélectionner une mining company dans le dropdown.';
