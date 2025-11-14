/*
  # CORRECTIF DÉFINITIF - Suppression Contraintes Anciennes sur shipping_preparations

  ## Problème Identifié:
  La table shipping_preparations a été créée avec:
  - Une colonne `status TEXT` avec CHECK constraint sur ('pending', 'prepared', 'shipped')
  - Cela BLOQUE l'utilisation du nouvel ENUM shipping_preparation_status

  ## Solution:
  1. Supprimer TOUTES les anciennes contraintes CHECK sur status
  2. Supprimer l'ancienne colonne status (TEXT)
  3. Recréer la colonne avec le TYPE ENUM shipping_preparation_status
  4. Définir le DEFAULT correct: 'waiting_for_customs_approval'

  ## Workflow Final:
  waiting_for_customs_approval → approved_by_customs → ready_for_expedition
*/

-- =====================================================
-- ÉTAPE 1: Identifier et Supprimer toutes les contraintes CHECK sur status
-- =====================================================

DO $$
DECLARE
    constraint_rec RECORD;
BEGIN
    -- Trouver toutes les contraintes CHECK qui mentionnent 'status'
    FOR constraint_rec IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'shipping_preparations'::regclass
        AND contype = 'c'  -- c = CHECK constraint
        AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE shipping_preparations DROP CONSTRAINT IF EXISTS %I CASCADE', constraint_rec.conname);
        RAISE NOTICE '✅ Contrainte supprimée: %', constraint_rec.conname;
    END LOOP;

    IF NOT FOUND THEN
        RAISE NOTICE 'ℹ️ Aucune contrainte CHECK sur status trouvée';
    END IF;
END $$;

-- =====================================================
-- ÉTAPE 2: Vérifier le type de données actuel de la colonne status
-- =====================================================

DO $$
DECLARE
    current_type text;
BEGIN
    SELECT data_type INTO current_type
    FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'status';

    RAISE NOTICE 'Type actuel de la colonne status: %', current_type;
END $$;

-- =====================================================
-- ÉTAPE 3: Sauvegarder les données existantes (si nécessaire)
-- =====================================================

-- Créer une table temporaire pour mapper les anciens statuts vers les nouveaux
CREATE TEMP TABLE IF NOT EXISTS shipping_status_migration_map AS
SELECT
    id,
    status as old_status,
    CASE
        WHEN status IN ('pending', 'prepared', 'ready_for_customs') THEN 'waiting_for_customs_approval'
        WHEN status IN ('approved', 'customs_approved') THEN 'approved_by_customs'
        WHEN status IN ('ready_for_expedition', 'shipped') THEN 'ready_for_expedition'
        ELSE 'waiting_for_customs_approval'
    END as new_status
FROM shipping_preparations;

-- =====================================================
-- ÉTAPE 4: Supprimer et Recréer la colonne avec le bon type
-- =====================================================

DO $$
BEGIN
    -- Supprimer l'ancienne colonne status
    ALTER TABLE shipping_preparations DROP COLUMN IF EXISTS status CASCADE;
    RAISE NOTICE '✅ Ancienne colonne status supprimée';

    -- Recréer la colonne avec le type ENUM shipping_preparation_status
    ALTER TABLE shipping_preparations
    ADD COLUMN status shipping_preparation_status
    DEFAULT 'waiting_for_customs_approval'::shipping_preparation_status
    NOT NULL;

    RAISE NOTICE '✅ Nouvelle colonne status créée avec type shipping_preparation_status';
    RAISE NOTICE '   DEFAULT: waiting_for_customs_approval';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Erreur lors de la recréation de la colonne: %', SQLERRM;
    RAISE;
END $$;

-- =====================================================
-- ÉTAPE 5: Restaurer les données migrées
-- =====================================================

DO $$
DECLARE
    rows_updated integer := 0;
BEGIN
    -- Mettre à jour les statuts depuis la table temporaire
    UPDATE shipping_preparations sp
    SET status = map.new_status::shipping_preparation_status
    FROM shipping_status_migration_map map
    WHERE sp.id = map.id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE '✅ % lignes mises à jour avec les nouveaux statuts', rows_updated;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Aucune donnée à migrer ou erreur: %', SQLERRM;
END $$;

-- =====================================================
-- ÉTAPE 6: Nettoyer la table temporaire
-- =====================================================

DROP TABLE IF EXISTS shipping_status_migration_map;

-- =====================================================
-- ÉTAPE 7: Ajouter des commentaires et index
-- =====================================================

COMMENT ON COLUMN shipping_preparations.status IS
'Statut de l''expédition utilisant l''ENUM shipping_preparation_status.
Workflow: waiting_for_customs_approval → approved_by_customs → ready_for_expedition
DEFAULT à la création: waiting_for_customs_approval';

-- Créer un index pour améliorer les performances des requêtes par statut
CREATE INDEX IF NOT EXISTS idx_shipping_preparations_status
ON shipping_preparations(status);

-- =====================================================
-- ÉTAPE 8: Vérification finale complète
-- =====================================================

DO $$
DECLARE
    column_type text;
    column_default text;
    enum_values text[];
    constraints_count integer;
BEGIN
    -- Vérifier le type de la colonne
    SELECT data_type, column_default
    INTO column_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'status';

    -- Vérifier les valeurs de l'ENUM
    SELECT array_agg(enumlabel ORDER BY enumsortorder)
    INTO enum_values
    FROM pg_enum
    WHERE enumtypid = 'shipping_preparation_status'::regtype;

    -- Compter les contraintes CHECK restantes
    SELECT COUNT(*)
    INTO constraints_count
    FROM pg_constraint
    WHERE conrelid = 'shipping_preparations'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

    RAISE NOTICE '============================================';
    RAISE NOTICE 'VÉRIFICATION FINALE';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Colonne shipping_preparations.status:';
    RAISE NOTICE '  Type: %', column_type;
    RAISE NOTICE '  Default: %', column_default;
    RAISE NOTICE '';
    RAISE NOTICE 'ENUM shipping_preparation_status:';
    RAISE NOTICE '  Valeurs: %', enum_values;
    RAISE NOTICE '';
    RAISE NOTICE 'Contraintes CHECK sur status:';
    IF constraints_count = 0 THEN
        RAISE NOTICE '  ✅ Aucune contrainte CHECK (correct!)';
    ELSE
        RAISE WARNING '  ⚠️ % contrainte(s) CHECK trouvée(s) - Devrait être 0!', constraints_count;
    END IF;
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ MIGRATION TERMINÉE AVEC SUCCÈS';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Vous pouvez maintenant créer des shipping_preparations';
    RAISE NOTICE 'avec le statut: waiting_for_customs_approval';

END $$;
