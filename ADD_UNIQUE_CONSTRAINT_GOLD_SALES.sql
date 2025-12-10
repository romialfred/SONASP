/*
  # Ajout de contrainte d'unicité pour gold_sales_settings

  ## À APPLIQUER DANS SUPABASE SQL EDITOR

  1. Modifications
    - Ajout d'une contrainte unique sur (mining_company_id, customer_id)
    - Empêche la création de doublons pour la même combinaison Mine-Client
    - Vérifie d'abord s'il n'y a pas de doublons existants
    - Nettoie les doublons s'il y en a (garde le plus récent)

  2. Sécurité
    - Opération idempotente (peut être exécutée plusieurs fois)
    - Préserve les données existantes
    - RLS existant reste inchangé

  ## INSTRUCTIONS
  1. Ouvrir Supabase Dashboard → SQL Editor
  2. Copier-coller ce script complet
  3. Exécuter (Run)
  4. Vérifier les messages dans les logs
*/

-- Vérifier et supprimer les doublons existants (garde le plus récent)
DO $$
DECLARE
  duplicate_record RECORD;
  deleted_count INTEGER := 0;
BEGIN
  FOR duplicate_record IN
    SELECT
      mining_company_id,
      customer_id,
      COUNT(*) as count,
      ARRAY_AGG(id ORDER BY created_at DESC) as ids
    FROM gold_sales_settings
    GROUP BY mining_company_id, customer_id
    HAVING COUNT(*) > 1
  LOOP
    -- Supprimer tous les doublons sauf le plus récent (premier dans le tableau)
    DELETE FROM gold_sales_settings
    WHERE id = ANY(duplicate_record.ids[2:]);

    deleted_count := deleted_count + (duplicate_record.count - 1);

    RAISE NOTICE 'Doublons supprimés pour mining_company_id=%, customer_id=%. Gardé: %',
      duplicate_record.mining_company_id,
      duplicate_record.customer_id,
      duplicate_record.ids[1];
  END LOOP;

  IF deleted_count > 0 THEN
    RAISE NOTICE '✅ Total de % doublons supprimés', deleted_count;
  ELSE
    RAISE NOTICE '✅ Aucun doublon trouvé';
  END IF;
END $$;

-- Ajouter la contrainte unique si elle n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gold_sales_settings_mining_company_customer_unique'
  ) THEN
    ALTER TABLE gold_sales_settings
    ADD CONSTRAINT gold_sales_settings_mining_company_customer_unique
    UNIQUE (mining_company_id, customer_id);

    RAISE NOTICE '✅ Contrainte unique ajoutée: gold_sales_settings_mining_company_customer_unique';
  ELSE
    RAISE NOTICE 'ℹ️  Contrainte unique existe déjà: gold_sales_settings_mining_company_customer_unique';
  END IF;
END $$;

-- Créer un index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_gold_sales_settings_mining_customer
ON gold_sales_settings(mining_company_id, customer_id);

-- Commentaire sur la contrainte
COMMENT ON CONSTRAINT gold_sales_settings_mining_company_customer_unique
ON gold_sales_settings IS
'Empêche la création de plusieurs paramètres de vente pour la même combinaison Mine-Client. Une seule configuration est autorisée par couple.';

-- Vérification finale
DO $$
DECLARE
  constraint_exists BOOLEAN;
  index_exists BOOLEAN;
BEGIN
  -- Vérifier la contrainte
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gold_sales_settings_mining_company_customer_unique'
  ) INTO constraint_exists;

  -- Vérifier l'index
  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_gold_sales_settings_mining_customer'
  ) INTO index_exists;

  IF constraint_exists AND index_exists THEN
    RAISE NOTICE '✅ ✅ MIGRATION RÉUSSIE - Contrainte unique et index créés';
  ELSE
    RAISE WARNING '⚠️  Problème détecté - Contrainte: %, Index: %', constraint_exists, index_exists;
  END IF;
END $$;
