-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECTION DÉFINITIVE: Erreur "batch_id does not exist"
-- ═══════════════════════════════════════════════════════════════════════════
--
-- INSTRUCTIONS:
-- 1. Allez sur: https://boolqagzdqbahqnpawpb.supabase.co
-- 2. Cliquez sur "SQL Editor" dans le menu de gauche
-- 3. Cliquez sur "New Query"
-- 4. Copiez TOUT ce fichier et collez-le dans l'éditeur
-- 5. Cliquez sur "Run" (ou appuyez sur Ctrl/Cmd + Enter)
-- 6. Attendez le message de confirmation
--
-- Temps d'exécution: ~5 secondes
-- ═══════════════════════════════════════════════════════════════════════════

-- Étape 1: Supprimer la contrainte de clé étrangère
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'inventory_transactions_batch_id_fkey'
    AND table_name = 'inventory_transactions'
  ) THEN
    ALTER TABLE inventory_transactions DROP CONSTRAINT inventory_transactions_batch_id_fkey;
    RAISE NOTICE '✓ Contrainte batch_id_fkey supprimée';
  ELSE
    RAISE NOTICE 'ℹ Contrainte batch_id_fkey déjà absente';
  END IF;
END $$;

-- Étape 2: Supprimer la colonne batch_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
    AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE inventory_transactions DROP COLUMN batch_id;
    RAISE NOTICE '✓ Colonne batch_id supprimée';
  ELSE
    RAISE NOTICE 'ℹ Colonne batch_id déjà absente';
  END IF;
END $$;

-- Étape 3: Vérifier que freight_shipment_id existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
    AND column_name = 'freight_shipment_id'
  ) THEN
    ALTER TABLE inventory_transactions
    ADD COLUMN freight_shipment_id UUID REFERENCES freight_shipments(id) ON DELETE SET NULL;
    RAISE NOTICE '✓ Colonne freight_shipment_id ajoutée';
  ELSE
    RAISE NOTICE 'ℹ Colonne freight_shipment_id existe déjà';
  END IF;
END $$;

-- Étape 4: Recréer la fonction trigger sans batch_id
CREATE OR REPLACE FUNCTION create_inventory_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_balance_before_oz numeric;
  v_balance_after_oz numeric;
  v_transaction_type text;
BEGIN
  -- Calculer le solde avant cette transaction
  SELECT COALESCE(SUM(quantity_oz), 0)
  INTO v_balance_before_oz
  FROM inventory_transactions
  WHERE inventory_id = NEW.id;

  -- Déterminer le type de transaction et calculer le nouveau solde
  IF NEW.transaction_type = 'entry' THEN
    v_transaction_type := 'entry';
    v_balance_after_oz := v_balance_before_oz + COALESCE(NEW.final_fine_oz, 0);
  ELSE
    v_transaction_type := 'exit';
    v_balance_after_oz := v_balance_before_oz - COALESCE(NEW.final_fine_oz, 0);
  END IF;

  -- Insérer la transaction SANS batch_id
  INSERT INTO inventory_transactions (
    transaction_date,
    transaction_type,
    inventory_id,
    freight_shipment_id,
    sale_id,
    quantity_oz,
    quantity_grams,
    balance_before_oz,
    balance_after_oz,
    notes,
    created_by
  ) VALUES (
    COALESCE(NEW.entry_date, CURRENT_DATE),
    v_transaction_type,
    NEW.id,
    NEW.freight_shipment_id,
    NEW.sale_id,
    COALESCE(NEW.final_fine_oz, 0),
    COALESCE(NEW.final_fine_grams, 0),
    v_balance_before_oz,
    v_balance_after_oz,
    NEW.notes,
    NEW.created_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 5: Recréer le trigger
DROP TRIGGER IF EXISTS trigger_create_inventory_transaction ON gold_inventory;

CREATE TRIGGER trigger_create_inventory_transaction
  AFTER INSERT ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_transaction();

-- Message de confirmation finale
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '✅ CORRECTION TERMINÉE AVEC SUCCÈS';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Modifications appliquées:';
  RAISE NOTICE '  ✓ Contrainte batch_id_fkey supprimée';
  RAISE NOTICE '  ✓ Colonne batch_id supprimée de inventory_transactions';
  RAISE NOTICE '  ✓ Colonne freight_shipment_id vérifiée/ajoutée';
  RAISE NOTICE '  ✓ Fonction create_inventory_transaction() mise à jour';
  RAISE NOTICE '  ✓ Trigger recréé sans batch_id';
  RAISE NOTICE '';
  RAISE NOTICE 'VOUS POUVEZ MAINTENANT AJOUTER DES ENTRÉES D''INVENTAIRE';
  RAISE NOTICE '';
  RAISE NOTICE 'L''erreur "batch_id does not exist" ne se produira plus.';
  RAISE NOTICE '';
END $$;

-- Vérification finale: Afficher la structure de la table
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'inventory_transactions'
ORDER BY ordinal_position;
