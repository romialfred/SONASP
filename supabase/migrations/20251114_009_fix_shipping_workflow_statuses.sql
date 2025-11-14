/*
  # Fix Shipping Preparation Workflow - Statuses Corrects

  ## Problème Identifié:
  Le code essaie d'utiliser 'prepared' mais l'ENUM shipping_preparation_status ne contient pas cette valeur.

  ## Nouveau Workflow Requis:
  1. waiting_for_customs_approval (Statut initial à la création)
     - Expédition créée, en attente d'approbation douanière
     - Peut durer plusieurs jours

  2. approved_by_customs (Après approbation manuelle)
     - Approbation douanière obtenue
     - Transition manuelle via bouton "Customs Approved"

  3. ready_for_expedition (Prêt pour expédition finale)
     - Autorisé à être expédié
     - Statut final du module shipping

  ## ENUM Mis à Jour:
  - waiting_for_customs_approval (NEW - statut initial)
  - approved_by_customs (maintenu)
  - ready_for_expedition (maintenu)

  ## Notes:
  - 'ready_for_customs' SUPPRIMÉ (source de confusion)
  - 'prepared' N'EXISTE PAS et ne doit JAMAIS être utilisé
  - DEFAULT: 'waiting_for_customs_approval'
*/

-- =====================================================
-- ÉTAPE 1: Recréer l'ENUM avec les bonnes valeurs
-- =====================================================

DO $$
BEGIN
  -- Supprimer l'ancien enum
  DROP TYPE IF EXISTS shipping_preparation_status CASCADE;

  -- Créer le nouveau avec le workflow correct
  CREATE TYPE shipping_preparation_status AS ENUM (
    'waiting_for_customs_approval',  -- EN ATTENTE APPROBATION DOUANE (Initial)
    'approved_by_customs',            -- APPROUVÉ PAR LA DOUANE
    'ready_for_expedition'            -- PRÊT POUR EXPÉDITION (Final)
  );

  RAISE NOTICE '✅ ENUM shipping_preparation_status recréé avec workflow correct';
  RAISE NOTICE '   1. waiting_for_customs_approval (initial)';
  RAISE NOTICE '   2. approved_by_customs';
  RAISE NOTICE '   3. ready_for_expedition (final)';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Erreur lors de la recréation de l''ENUM: %', SQLERRM;
END $$;

-- =====================================================
-- ÉTAPE 2: Réappliquer l'ENUM à la table shipping_preparations
-- =====================================================

DO $$
DECLARE
  v_has_status boolean;
BEGIN
  -- Vérifier si la colonne status existe
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'status'
  ) INTO v_has_status;

  IF v_has_status THEN
    -- Supprimer la colonne existante
    ALTER TABLE shipping_preparations DROP COLUMN status CASCADE;
    RAISE NOTICE '✅ Ancienne colonne status supprimée';
  END IF;

  -- Ajouter la colonne avec le nouveau type et DEFAULT correct
  ALTER TABLE shipping_preparations
    ADD COLUMN status shipping_preparation_status DEFAULT 'waiting_for_customs_approval' NOT NULL;

  RAISE NOTICE '✅ Colonne status ajoutée avec DEFAULT: waiting_for_customs_approval';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Erreur lors de la modification de la table: %', SQLERRM;
END $$;

-- =====================================================
-- ÉTAPE 3: Ajouter un commentaire documentant le workflow
-- =====================================================

COMMENT ON TYPE shipping_preparation_status IS
'Workflow d''expédition avec approbation douanière:
1. waiting_for_customs_approval → En attente approbation douane (INITIAL)
2. approved_by_customs → Douane approuvée (via bouton manuel)
3. ready_for_expedition → Prêt pour expédition (FINAL)';

COMMENT ON COLUMN shipping_preparations.status IS
'Statut de l''expédition.
IMPORTANT:
- Création = waiting_for_customs_approval (automatique)
- Transition manuelle via bouton "Customs Approved"
- Peut rester en waiting_for_customs_approval plusieurs jours';

-- =====================================================
-- ÉTAPE 4: Vérification finale
-- =====================================================

DO $$
DECLARE
  v_enum_values text[];
  v_default_value text;
BEGIN
  -- Vérifier les valeurs de l'ENUM
  SELECT array_agg(enumlabel ORDER BY enumsortorder)
  INTO v_enum_values
  FROM pg_enum
  WHERE enumtypid = 'shipping_preparation_status'::regtype;

  -- Vérifier la valeur DEFAULT
  SELECT column_default
  INTO v_default_value
  FROM information_schema.columns
  WHERE table_name = 'shipping_preparations'
  AND column_name = 'status';

  RAISE NOTICE '====================================';
  RAISE NOTICE 'VÉRIFICATION FINALE';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'ENUM shipping_preparation_status:';
  RAISE NOTICE '  Valeurs: %', v_enum_values;
  RAISE NOTICE 'Table shipping_preparations:';
  RAISE NOTICE '  DEFAULT: %', v_default_value;
  RAISE NOTICE '====================================';
  RAISE NOTICE '✅ Migration terminée avec succès';
  RAISE NOTICE '====================================';

END $$;
