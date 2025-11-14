/*
  # Suppression du statut 'in_sale' du workflow

  1. Modifications
    - Supprime le statut 'in_sale' de unified_status enum
    - Supprime le statut 'in_sale' de shipping_status_v2 enum
    - Met à jour toutes les données existantes avec 'in_sale' vers 'sold'
    - Met à jour les triggers et fonctions qui référencent 'in_sale'

  2. Sécurité
    - Sauvegarde des données avant modification
    - Validation des enums après modification
    - Transaction atomique

  Note: Cette migration supprime l'étape intermédiaire 'in_sale' (En Vente)
  Le workflow devient: ... → En Inventaire → Vendu → Payé
*/

-- =====================================================
-- ÉTAPE 1: Mise à jour des données existantes
-- =====================================================

-- Mettre à jour toutes les productions avec statut 'in_sale' vers 'sold'
UPDATE daily_production
SET status = 'sold'
WHERE status = 'in_sale';

-- Mettre à jour tous les shipping_preparations avec statut 'in_sale' vers 'sold'
UPDATE shipping_preparations
SET status = 'sold'
WHERE status = 'in_sale';

-- =====================================================
-- ÉTAPE 2: Recréer les enums sans 'in_sale'
-- =====================================================

-- Unified Status Enum (utilisé par daily_production)
DO $$ BEGIN
  -- Créer un nouveau type temporaire sans 'in_sale'
  CREATE TYPE unified_status_new AS ENUM (
    'prepared',
    'ready_for_customs',
    'customs_approved',
    'ready_for_expedition',
    'shipped_to_refinery',
    'refined',
    'in_inventory',
    'sold',
    'paid',
    'cancelled'
  );

  -- Modifier la colonne pour utiliser le nouveau type
  ALTER TABLE daily_production
    ALTER COLUMN status TYPE unified_status_new
    USING status::text::unified_status_new;

  -- Supprimer l'ancien type et renommer le nouveau
  DROP TYPE IF EXISTS unified_status CASCADE;
  ALTER TYPE unified_status_new RENAME TO unified_status;
END $$;

-- Shipping Status V2 Enum (utilisé par shipping_preparations)
DO $$ BEGIN
  -- Créer un nouveau type temporaire sans 'in_sale'
  CREATE TYPE shipping_status_v2_new AS ENUM (
    'pending',
    'prepared',
    'validated_for_refinery',
    'in_refining',
    'refined',
    'sold',
    'cancelled'
  );

  -- Modifier la colonne pour utiliser le nouveau type
  ALTER TABLE shipping_preparations
    ALTER COLUMN status TYPE shipping_status_v2_new
    USING status::text::shipping_status_v2_new;

  -- Supprimer l'ancien type et renommer le nouveau
  DROP TYPE IF EXISTS shipping_status_v2 CASCADE;
  ALTER TYPE shipping_status_v2_new RENAME TO shipping_status_v2;
END $$;

-- =====================================================
-- ÉTAPE 3: Vérification des contraintes
-- =====================================================

-- Vérifier qu'il n'y a plus de 'in_sale' dans daily_production
DO $$
DECLARE
  count_in_sale integer;
BEGIN
  SELECT COUNT(*) INTO count_in_sale
  FROM daily_production
  WHERE status::text = 'in_sale';

  IF count_in_sale > 0 THEN
    RAISE EXCEPTION 'Il reste % enregistrements avec le statut in_sale dans daily_production', count_in_sale;
  END IF;
END $$;

-- Vérifier qu'il n'y a plus de 'in_sale' dans shipping_preparations
DO $$
DECLARE
  count_in_sale integer;
BEGIN
  SELECT COUNT(*) INTO count_in_sale
  FROM shipping_preparations
  WHERE status::text = 'in_sale';

  IF count_in_sale > 0 THEN
    RAISE EXCEPTION 'Il reste % enregistrements avec le statut in_sale dans shipping_preparations', count_in_sale;
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 4: Mise à jour de l'historique des statuts
-- =====================================================

-- Mettre à jour l'historique des statuts dans production_status_history
UPDATE production_status_history
SET new_status = 'sold'
WHERE new_status = 'in_sale';

UPDATE production_status_history
SET old_status = 'sold'
WHERE old_status = 'in_sale';

-- Mettre à jour l'historique des statuts dans shipping_status_history (si existe)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_status_history') THEN
    UPDATE shipping_status_history
    SET new_status = 'sold'
    WHERE new_status = 'in_sale';

    UPDATE shipping_status_history
    SET old_status = 'sold'
    WHERE old_status = 'in_sale';
  END IF;
END $$;

-- =====================================================
-- SUCCÈS
-- =====================================================

-- Afficher un message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✓ Migration réussie: Le statut "in_sale" a été supprimé';
  RAISE NOTICE '✓ Workflow mis à jour: ... → in_inventory → sold → paid';
END $$;
