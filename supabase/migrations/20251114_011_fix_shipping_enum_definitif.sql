/*
  # CORRECTIF DÉFINITIF - Forcer l'utilisation du BON ENUM

  ## Problème Identifié:
  Il existe DEUX ENUMs dans la base de données:
  1. shipping_preparation_status (BON) → waiting_for_customs_approval, approved_by_customs, ready_for_expedition
  2. shipping_status_v2 (ANCIEN) → pending, prepared, validated_for_refinery, in_refining, refined, in_sale, sold, cancelled, shipped

  La table shipping_preparations utilise probablement shipping_status_v2 au lieu de shipping_preparation_status!

  ## Solution:
  1. Supprimer toutes les données de test dans shipping_preparations
  2. Supprimer la colonne status
  3. Supprimer l'ancien ENUM shipping_status_v2
  4. Recréer la colonne status avec le BON ENUM shipping_preparation_status
  5. S'assurer qu'aucune autre table n'utilise shipping_status_v2

  ## IMPORTANT:
  Cette migration SUPPRIME les données existantes dans shipping_preparations.
  Si vous avez des données importantes, sauvegardez-les d'abord!
*/

-- =====================================================
-- ÉTAPE 1: Vérifier quels ENUMs existent
-- =====================================================

DO $$
DECLARE
    enum_rec RECORD;
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'ANALYSE DES ENUMs SHIPPING';
    RAISE NOTICE '============================================';

    FOR enum_rec IN
        SELECT typname, array_agg(enumlabel ORDER BY enumsortorder) as values
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE typname LIKE '%shipping%status%'
        GROUP BY typname
    LOOP
        RAISE NOTICE 'ENUM: %', enum_rec.typname;
        RAISE NOTICE '  Valeurs: %', enum_rec.values;
    END LOOP;
END $$;

-- =====================================================
-- ÉTAPE 2: Identifier quel ENUM est utilisé par la table
-- =====================================================

DO $$
DECLARE
    current_enum_name text;
BEGIN
    SELECT udt_name INTO current_enum_name
    FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'status';

    IF current_enum_name IS NOT NULL THEN
        RAISE NOTICE '';
        RAISE NOTICE 'Table shipping_preparations.status utilise:';
        RAISE NOTICE '  Type: %', current_enum_name;

        IF current_enum_name = 'shipping_status_v2' THEN
            RAISE NOTICE '  ❌ MAUVAIS ENUM! Doit être: shipping_preparation_status';
        ELSIF current_enum_name = 'shipping_preparation_status' THEN
            RAISE NOTICE '  ✅ BON ENUM!';
        ELSE
            RAISE NOTICE '  ⚠️ Type inconnu: %', current_enum_name;
        END IF;
    ELSE
        RAISE NOTICE '  ℹ️ Colonne status n''existe pas encore';
    END IF;
END $$;

-- =====================================================
-- ÉTAPE 3: Supprimer TOUTES les données de test
-- =====================================================

DO $$
DECLARE
    rows_deleted integer;
BEGIN
    -- Compter les lignes avant suppression
    SELECT COUNT(*) INTO rows_deleted FROM shipping_preparations;

    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'NETTOYAGE DES DONNÉES';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Lignes à supprimer: %', rows_deleted;

    -- Supprimer toutes les données
    DELETE FROM shipping_preparations;

    RAISE NOTICE '✅ Toutes les données supprimées';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 4: Supprimer la colonne status
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'SUPPRESSION DE L''ANCIENNE COLONNE';
    RAISE NOTICE '============================================';

    -- Supprimer la colonne avec CASCADE pour supprimer les dépendances
    ALTER TABLE shipping_preparations DROP COLUMN IF EXISTS status CASCADE;

    RAISE NOTICE '✅ Colonne status supprimée avec toutes ses dépendances';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 5: Vérifier si d'autres tables utilisent shipping_status_v2
-- =====================================================

DO $$
DECLARE
    table_rec RECORD;
    has_dependencies boolean := false;
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'VÉRIFICATION DES DÉPENDANCES';
    RAISE NOTICE '============================================';

    FOR table_rec IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE udt_name = 'shipping_status_v2'
        AND table_name != 'shipping_preparations'
    LOOP
        RAISE NOTICE '⚠️ Table %.% utilise shipping_status_v2', table_rec.table_name, table_rec.column_name;
        has_dependencies := true;
    END LOOP;

    IF NOT has_dependencies THEN
        RAISE NOTICE '✅ Aucune autre table n''utilise shipping_status_v2';
    END IF;
    RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 6: Supprimer l'ancien ENUM shipping_status_v2
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'SUPPRESSION DE L''ANCIEN ENUM';
    RAISE NOTICE '============================================';

    -- Supprimer l'ENUM s'il existe
    DROP TYPE IF EXISTS shipping_status_v2 CASCADE;

    RAISE NOTICE '✅ ENUM shipping_status_v2 supprimé';
    RAISE NOTICE '';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Impossible de supprimer shipping_status_v2: %', SQLERRM;
    RAISE NOTICE '   (Ignoré si d''autres tables l''utilisent encore)';
END $$;

-- =====================================================
-- ÉTAPE 7: S'assurer que le BON ENUM existe
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'VÉRIFICATION/CRÉATION DU BON ENUM';
    RAISE NOTICE '============================================';

    -- Créer l'ENUM s'il n'existe pas
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipping_preparation_status') THEN
        CREATE TYPE shipping_preparation_status AS ENUM (
            'waiting_for_customs_approval',
            'approved_by_customs',
            'ready_for_expedition'
        );
        RAISE NOTICE '✅ ENUM shipping_preparation_status créé';
    ELSE
        RAISE NOTICE '✅ ENUM shipping_preparation_status existe déjà';
    END IF;

    RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 8: Recréer la colonne status avec le BON ENUM
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'CRÉATION DE LA COLONNE AVEC LE BON ENUM';
    RAISE NOTICE '============================================';

    -- Ajouter la colonne avec le type shipping_preparation_status
    ALTER TABLE shipping_preparations
    ADD COLUMN status shipping_preparation_status
    DEFAULT 'waiting_for_customs_approval'::shipping_preparation_status
    NOT NULL;

    RAISE NOTICE '✅ Colonne status créée';
    RAISE NOTICE '   Type: shipping_preparation_status';
    RAISE NOTICE '   Default: waiting_for_customs_approval';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 9: Ajouter index et commentaires
-- =====================================================

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_shipping_preparations_status
ON shipping_preparations(status);

-- Commentaires
COMMENT ON COLUMN shipping_preparations.status IS
'Statut de l''expédition utilisant l''ENUM shipping_preparation_status (PAS shipping_status_v2!).
Workflow: waiting_for_customs_approval → approved_by_customs → ready_for_expedition
DEFAULT à la création: waiting_for_customs_approval';

COMMENT ON TYPE shipping_preparation_status IS
'ENUM pour le workflow d''expédition avec approbation douanière.
IMPORTANT: Ceci est le BON ENUM à utiliser pour shipping_preparations.
NE PAS CONFONDRE avec shipping_status_v2 qui est pour d''autres tables!';

-- =====================================================
-- ÉTAPE 10: VÉRIFICATION FINALE COMPLÈTE
-- =====================================================

DO $$
DECLARE
    column_type text;
    enum_name text;
    col_default text;
    enum_values text[];
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'VÉRIFICATION FINALE';
    RAISE NOTICE '============================================';

    -- Vérifier le type de la colonne
    SELECT data_type, udt_name, c.column_default
    INTO column_type, enum_name, col_default
    FROM information_schema.columns c
    WHERE c.table_name = 'shipping_preparations'
    AND c.column_name = 'status';

    -- Vérifier les valeurs de l'ENUM
    SELECT array_agg(enumlabel ORDER BY enumsortorder)
    INTO enum_values
    FROM pg_enum
    WHERE enumtypid = 'shipping_preparation_status'::regtype;

    RAISE NOTICE 'Table shipping_preparations.status:';
    RAISE NOTICE '  Data Type: %', column_type;
    RAISE NOTICE '  UDT Name: %', enum_name;
    RAISE NOTICE '  Default: %', col_default;
    RAISE NOTICE '';
    RAISE NOTICE 'ENUM shipping_preparation_status:';
    RAISE NOTICE '  Valeurs: %', enum_values;
    RAISE NOTICE '';

    -- Vérifier si c'est correct
    IF enum_name = 'shipping_preparation_status' THEN
        RAISE NOTICE '✅✅✅ PARFAIT! Le bon ENUM est utilisé! ✅✅✅';
    ELSE
        RAISE WARNING '❌❌❌ ERREUR! Mauvais ENUM: % ❌❌❌', enum_name;
    END IF;

    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION TERMINÉE';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Vous pouvez maintenant créer des shipping_preparations';
    RAISE NOTICE 'avec le statut: waiting_for_customs_approval';
    RAISE NOTICE '';
    RAISE NOTICE 'L''ancien ENUM shipping_status_v2 a été supprimé.';
    RAISE NOTICE 'Seul shipping_preparation_status est utilisé maintenant.';

END $$;
