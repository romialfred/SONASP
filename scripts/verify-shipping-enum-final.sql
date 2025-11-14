-- =====================================================
-- SCRIPT DE VÉRIFICATION FINALE - Shipping ENUMs
-- =====================================================
-- Ce script vérifie que la migration 011 a été appliquée correctement
-- et que le système utilise le bon ENUM

-- =====================================================
-- 1. Lister TOUS les ENUMs shipping
-- =====================================================

SELECT '=== TOUS LES ENUMs SHIPPING ===' as section;

SELECT
    typname as enum_name,
    array_agg(enumlabel ORDER BY enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname LIKE '%shipping%status%'
GROUP BY typname
ORDER BY typname;

-- =====================================================
-- 2. Vérifier le type de la colonne shipping_preparations.status
-- =====================================================

SELECT '=== TYPE DE LA COLONNE STATUS ===' as section;

SELECT
    table_name,
    column_name,
    data_type,
    udt_name as enum_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_preparations'
AND column_name = 'status';

-- =====================================================
-- 3. Vérifier les contraintes CHECK
-- =====================================================

SELECT '=== CONTRAINTES CHECK SUR STATUS ===' as section;

SELECT
    conname as constraint_name,
    contype as type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'shipping_preparations'::regclass
AND contype = 'c'
AND pg_get_constraintdef(oid) ILIKE '%status%';

-- =====================================================
-- 4. Compter les lignes dans shipping_preparations
-- =====================================================

SELECT '=== DONNÉES EXISTANTES ===' as section;

SELECT COUNT(*) as total_rows FROM shipping_preparations;

-- =====================================================
-- 5. Test d'insertion avec le nouveau statut
-- =====================================================

SELECT '=== TEST D''INSERTION ===' as section;

DO $$
DECLARE
    test_id uuid;
    test_success boolean := false;
BEGIN
    -- Essayer d'insérer un enregistrement de test
    BEGIN
        INSERT INTO shipping_preparations (
            mining_company_id,
            status
        ) VALUES (
            gen_random_uuid(), -- UUID temporaire
            'waiting_for_customs_approval'::shipping_preparation_status
        )
        RETURNING id INTO test_id;

        test_success := true;

        -- Supprimer l'enregistrement de test
        DELETE FROM shipping_preparations WHERE id = test_id;

        RAISE NOTICE '✅ TEST D''INSERTION RÉUSSI!';
        RAISE NOTICE '   Le statut waiting_for_customs_approval est accepté';

    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ TEST D''INSERTION ÉCHOUÉ: %', SQLERRM;
        test_success := false;
    END;

    IF test_success THEN
        RAISE NOTICE '';
        RAISE NOTICE '============================================';
        RAISE NOTICE '✅✅✅ SYSTÈME OPÉRATIONNEL ✅✅✅';
        RAISE NOTICE '============================================';
        RAISE NOTICE 'La table shipping_preparations utilise le bon ENUM';
        RAISE NOTICE 'Vous pouvez créer des expéditions dans l''application';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '============================================';
        RAISE NOTICE '❌❌❌ PROBLÈME DÉTECTÉ ❌❌❌';
        RAISE NOTICE '============================================';
        RAISE NOTICE 'La migration 011 n''a pas été appliquée correctement';
        RAISE NOTICE 'Vérifiez les erreurs ci-dessus';
    END IF;
END $$;

-- =====================================================
-- 6. RÉSUMÉ FINAL
-- =====================================================

SELECT '=== RÉSUMÉ FINAL ===' as section;

DO $$
DECLARE
    enum_type text;
    has_shipping_status_v2 boolean;
    has_shipping_prep_status boolean;
BEGIN
    -- Vérifier quel ENUM est utilisé
    SELECT udt_name INTO enum_type
    FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'status';

    -- Vérifier l'existence des ENUMs
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'shipping_status_v2'
    ) INTO has_shipping_status_v2;

    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'shipping_preparation_status'
    ) INTO has_shipping_prep_status;

    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════╗';
    RAISE NOTICE '║         ÉTAT DU SYSTÈME                    ║';
    RAISE NOTICE '╚════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE 'ENUM shipping_preparation_status: %',
        CASE WHEN has_shipping_prep_status THEN '✅ Existe' ELSE '❌ N''existe pas' END;
    RAISE NOTICE 'ENUM shipping_status_v2: %',
        CASE WHEN has_shipping_status_v2 THEN '⚠️ Existe encore (devrait être supprimé)' ELSE '✅ Supprimé' END;
    RAISE NOTICE '';
    RAISE NOTICE 'Table shipping_preparations.status utilise: %', COALESCE(enum_type, 'AUCUN');
    RAISE NOTICE '';

    IF enum_type = 'shipping_preparation_status' AND NOT has_shipping_status_v2 THEN
        RAISE NOTICE '╔════════════════════════════════════════════╗';
        RAISE NOTICE '║  ✅✅✅ PARFAIT - TOUT EST CORRECT ✅✅✅  ║';
        RAISE NOTICE '╚════════════════════════════════════════════╝';
        RAISE NOTICE '';
        RAISE NOTICE 'Le système utilise le bon ENUM';
        RAISE NOTICE 'L''ancien ENUM a été supprimé';
        RAISE NOTICE 'Vous pouvez maintenant créer des expéditions';
    ELSIF enum_type = 'shipping_preparation_status' AND has_shipping_status_v2 THEN
        RAISE NOTICE '╔════════════════════════════════════════════╗';
        RAISE NOTICE '║  ⚠️ BON ENUM MAIS ANCIEN EXISTE ENCORE ⚠️  ║';
        RAISE NOTICE '╚════════════════════════════════════════════╝';
        RAISE NOTICE '';
        RAISE NOTICE 'Le système utilise le bon ENUM';
        RAISE NOTICE 'Mais l''ancien ENUM shipping_status_v2 existe encore';
        RAISE NOTICE 'Ce n''est pas critique mais devrait être nettoyé';
    ELSE
        RAISE NOTICE '╔════════════════════════════════════════════╗';
        RAISE NOTICE '║    ❌❌❌ PROBLÈME - APPLIQUER 011 ❌❌❌    ║';
        RAISE NOTICE '╚════════════════════════════════════════════╝';
        RAISE NOTICE '';
        RAISE NOTICE 'La migration 011 n''a pas été appliquée';
        RAISE NOTICE 'Appliquez 20251114_011_fix_shipping_enum_definitif.sql';
    END IF;
END $$;
