-- Script de Vérification de la Structure de la Base de Données
-- À EXÉCUTER AVANT toute migration pour vérifier les dépendances

-- =====================================================
-- PARTIE 1: VÉRIFICATION DES TABLES REQUISES
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '🔍 VÉRIFICATION DES TABLES REQUISES';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;

-- Vérifier shipping_preparations
SELECT
    CASE
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipping_preparations')
        THEN '✅ Table shipping_preparations existe'
        ELSE '❌ Table shipping_preparations N''EXISTE PAS - Migration non possible'
    END AS check_result;

-- Vérifier auth.users (Supabase)
SELECT
    CASE
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users')
        THEN '✅ Table auth.users existe (Supabase)'
        ELSE '⚠️  Table auth.users n''existe pas'
    END AS check_result;

-- Vérifier public.users (custom)
SELECT
    CASE
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')
        THEN '✅ Table public.users existe (custom)'
        ELSE '⚠️  Table public.users n''existe pas'
    END AS check_result;

-- Vérifier user_profiles
SELECT
    CASE
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles')
        THEN '✅ Table user_profiles existe'
        ELSE '⚠️  Table user_profiles n''existe pas'
    END AS check_result;

-- =====================================================
-- PARTIE 2: STRUCTURE DE shipping_preparations
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '📋 STRUCTURE DE shipping_preparations';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'shipping_preparations'
ORDER BY ordinal_position;

-- =====================================================
-- PARTIE 3: COLONNES CRITIQUES
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '🎯 COLONNES CRITIQUES';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;

-- Vérifier colonne 'status'
SELECT
    CASE
        WHEN EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'shipping_preparations'
            AND column_name = 'status'
        )
        THEN '✅ Colonne status existe dans shipping_preparations'
        ELSE '❌ Colonne status N''EXISTE PAS - Migration impossible'
    END AS check_result;

-- Vérifier colonne 'id'
SELECT
    CASE
        WHEN EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'shipping_preparations'
            AND column_name = 'id'
        )
        THEN '✅ Colonne id existe dans shipping_preparations'
        ELSE '❌ Colonne id N''EXISTE PAS - Migration impossible'
    END AS check_result;

-- =====================================================
-- PARTIE 4: TABLES UTILISATEURS DISPONIBLES
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '👤 TABLES UTILISATEURS DISPONIBLES';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;

-- Lister toutes les tables users/profiles
SELECT
    table_schema,
    table_name,
    '→ ' || table_schema || '.' || table_name AS full_name
FROM information_schema.tables
WHERE table_name ILIKE '%user%'
OR table_name ILIKE '%profile%'
ORDER BY table_schema, table_name;

-- =====================================================
-- PARTIE 5: QUELLE TABLE UTILISER POUR changed_by?
-- =====================================================

DO $$
DECLARE
    recommendation TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '💡 RECOMMANDATION POUR changed_by';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '';

    -- Déterminer quelle table utiliser
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
        recommendation := '✅ RECOMMANDATION: Utiliser user_profiles';
        RAISE NOTICE '%', recommendation;
        RAISE NOTICE '   Foreign Key: REFERENCES user_profiles(id)';
    ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        recommendation := '✅ RECOMMANDATION: Utiliser public.users';
        RAISE NOTICE '%', recommendation;
        RAISE NOTICE '   Foreign Key: REFERENCES users(id)';
    ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        recommendation := '⚠️  OPTION: Utiliser auth.users (moins recommandé)';
        RAISE NOTICE '%', recommendation;
        RAISE NOTICE '   Foreign Key: REFERENCES auth.users(id)';
    ELSE
        recommendation := '❌ PROBLÈME: Aucune table utilisateur trouvée!';
        RAISE NOTICE '%', recommendation;
        RAISE NOTICE '   Solution: Rendre changed_by NULLABLE ou créer user_profiles';
    END IF;
END $$;

-- =====================================================
-- PARTIE 6: VÉRIFIER LES FOREIGN KEYS EXISTANTES
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '🔗 FOREIGN KEYS EXISTANTES DANS LE PROJET';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;

-- Trouver toutes les foreign keys qui référencent des tables users
SELECT
    tc.table_name AS from_table,
    kcu.column_name AS from_column,
    ccu.table_schema || '.' || ccu.table_name AS to_table,
    ccu.column_name AS to_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND (ccu.table_name ILIKE '%user%' OR ccu.table_name ILIKE '%profile%')
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- PARTIE 7: RÉSUMÉ ET DÉCISION
-- =====================================================

SELECT
    '
    ═══════════════════════════════════════════════════════
    📊 RÉSUMÉ DE LA VÉRIFICATION
    ═══════════════════════════════════════════════════════

    ' ||
    CASE
        WHEN NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shipping_preparations')
        THEN '❌ BLOQUANT: Table shipping_preparations manquante
    → Exécuter d''abord les migrations de création de shipping_preparations

    '
        WHEN NOT EXISTS (
            SELECT FROM information_schema.tables
            WHERE (table_name = 'user_profiles' OR table_name = 'users')
            AND table_schema = 'public'
        )
        THEN '⚠️  ATTENTION: Aucune table utilisateur custom trouvée

    OPTIONS:
    1. Rendre changed_by NULLABLE (pas de foreign key)
       → changed_by uuid (sans REFERENCES)

    2. Utiliser auth.users (moins recommandé)
       → changed_by uuid REFERENCES auth.users(id)

    3. Créer d''abord une table user_profiles
       → Créer migration pour user_profiles puis revenir à celle-ci

    '
        ELSE '✅ PRÊT: Toutes les dépendances sont satisfaites

    Vous pouvez exécuter la migration 20251114_006
    avec la foreign key appropriée identifiée ci-dessus.

    '
    END || '
    ═══════════════════════════════════════════════════════
    ' AS final_summary;

-- =====================================================
-- PARTIE 8: GÉNÉRER LA BONNE SYNTAXE
-- =====================================================

DO $$
DECLARE
    fk_syntax TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '📝 SYNTAXE CORRECTE POUR LA MIGRATION';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '';

    -- Générer la syntaxe correcte basée sur ce qui existe
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
        fk_syntax := 'changed_by uuid REFERENCES user_profiles(id)';
        RAISE NOTICE 'Option recommandée:';
        RAISE NOTICE '  %', fk_syntax;
    ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        fk_syntax := 'changed_by uuid REFERENCES users(id)';
        RAISE NOTICE 'Option recommandée:';
        RAISE NOTICE '  %', fk_syntax;
    ELSE
        fk_syntax := 'changed_by uuid  -- Pas de foreign key, peut contenir auth.uid()';
        RAISE NOTICE 'Option sans foreign key:';
        RAISE NOTICE '  %', fk_syntax;
        RAISE NOTICE '';
        RAISE NOTICE 'Alternative avec auth.users:';
        RAISE NOTICE '  changed_by uuid REFERENCES auth.users(id)';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE 'À copier dans la migration à la ligne du changed_by';
END $$;
