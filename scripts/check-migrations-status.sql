-- Script de Vérification de l'État des Migrations
-- À exécuter pour vérifier quelles migrations ont été appliquées

-- =====================================================
-- 1. VÉRIFIER SI LA TABLE shipping_status_history EXISTE
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'shipping_status_history'
    ) THEN
        RAISE NOTICE '✅ Table shipping_status_history existe';
    ELSE
        RAISE NOTICE '❌ Table shipping_status_history N''EXISTE PAS - Migration 20251114_006 à exécuter';
    END IF;
END $$;

-- =====================================================
-- 2. VÉRIFIER LES INDEXES
-- =====================================================

SELECT
    CASE
        WHEN COUNT(*) >= 3 THEN '✅ Tous les indexes sont présents (' || COUNT(*) || ')'
        ELSE '⚠️  Il manque des indexes (' || COUNT(*) || '/3)'
    END AS index_status
FROM pg_indexes
WHERE tablename = 'shipping_status_history';

-- Détail des indexes
SELECT
    '   - ' || indexname AS index_detail
FROM pg_indexes
WHERE tablename = 'shipping_status_history'
ORDER BY indexname;

-- =====================================================
-- 3. VÉRIFIER LE TRIGGER
-- =====================================================

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '✅ Trigger shipping_status_change_trigger existe'
        ELSE '❌ Trigger shipping_status_change_trigger N''EXISTE PAS'
    END AS trigger_status
FROM information_schema.triggers
WHERE event_object_table = 'shipping_preparations'
AND trigger_name = 'shipping_status_change_trigger';

-- =====================================================
-- 4. VÉRIFIER LES RLS POLICIES
-- =====================================================

SELECT
    CASE
        WHEN COUNT(*) >= 2 THEN '✅ Toutes les RLS policies sont présentes (' || COUNT(*) || ')'
        ELSE '⚠️  Il manque des RLS policies (' || COUNT(*) || '/2)'
    END AS policy_status
FROM pg_policies
WHERE tablename = 'shipping_status_history';

-- Détail des policies
SELECT
    '   - ' || policyname || ' (FOR ' || cmd || ')' AS policy_detail
FROM pg_policies
WHERE tablename = 'shipping_status_history'
ORDER BY policyname;

-- =====================================================
-- 5. VÉRIFIER LA FONCTION
-- =====================================================

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '✅ Fonction create_shipping_status_history_on_update existe'
        ELSE '❌ Fonction create_shipping_status_history_on_update N''EXISTE PAS'
    END AS function_status
FROM pg_proc
WHERE proname = 'create_shipping_status_history_on_update';

-- =====================================================
-- 6. STATISTIQUES DE LA TABLE (si elle existe)
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'shipping_status_history'
    ) THEN
        RAISE NOTICE '';
        RAISE NOTICE '📊 STATISTIQUES:';
        EXECUTE '
            SELECT
                ''   Total entrées: '' || COUNT(*)::text
            FROM shipping_status_history
        ';

        EXECUTE '
            SELECT
                ''   Dernière entrée: '' ||
                COALESCE(TO_CHAR(MAX(changed_at), ''DD/MM/YYYY HH24:MI''), ''Aucune'')
            FROM shipping_status_history
        ';
    END IF;
END $$;

-- =====================================================
-- 7. RÉSUMÉ FINAL
-- =====================================================

SELECT
    '
    ═══════════════════════════════════════════════════════
    📋 RÉSUMÉ DE LA MIGRATION 20251114_006
    ═══════════════════════════════════════════════════════

    État: ' ||
    CASE
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shipping_status_history')
        AND EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'shipping_status_change_trigger')
        AND (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'shipping_status_history') >= 2
        AND (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'shipping_status_history') >= 3
        THEN '✅ MIGRATION COMPLÈTE ET FONCTIONNELLE'

        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shipping_status_history')
        THEN '⚠️  MIGRATION PARTIELLE - Vérifier les détails ci-dessus'

        ELSE '❌ MIGRATION NON EXÉCUTÉE

    Action requise:
    1. Exécuter le fichier: supabase/migrations/20251114_006_add_shipping_status_history.sql
    2. Relancer ce script pour vérifier
    3. Tester la page Shipping Details'
    END || '

    ═══════════════════════════════════════════════════════
    ' AS migration_summary;

-- =====================================================
-- 8. INFORMATIONS ADDITIONNELLES
-- =====================================================

-- Version PostgreSQL
SELECT
    '📌 Version PostgreSQL: ' || version() AS postgres_version;

-- Date actuelle du serveur
SELECT
    '📅 Date serveur: ' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI:SS TZ') AS server_date;
