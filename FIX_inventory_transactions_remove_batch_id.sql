-- =====================================================
-- FIX: Remove batch_id from inventory_transactions
-- Date: 2025-12-10
-- Description: Supprime la colonne batch_id obsolète
--              et assure que freight_shipment_id existe
-- =====================================================

-- Étape 1: Supprimer les triggers et fonctions existants
DROP TRIGGER IF EXISTS track_inventory_transaction ON gold_inventory;
DROP FUNCTION IF EXISTS create_inventory_transaction CASCADE;

-- Étape 2: Modifier la table inventory_transactions
DO $$
BEGIN
  -- Supprimer batch_id si elle existe
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
    AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE inventory_transactions
    DROP CONSTRAINT IF EXISTS inventory_transactions_batch_id_fkey;

    ALTER TABLE inventory_transactions
    DROP COLUMN batch_id;

    RAISE NOTICE 'Colonne batch_id supprimée de inventory_transactions';
  END IF;

  -- Ajouter freight_shipment_id si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
    AND column_name = 'freight_shipment_id'
  ) THEN
    ALTER TABLE inventory_transactions
    ADD COLUMN freight_shipment_id UUID REFERENCES freight_shipments(id) ON DELETE SET NULL;

    RAISE NOTICE 'Colonne freight_shipment_id ajoutée à inventory_transactions';
  END IF;
END $$;

-- Étape 3: Recréer la fonction de trigger sans référence à batch_id
CREATE OR REPLACE FUNCTION create_inventory_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.transaction_type = 'entry' THEN
    INSERT INTO inventory_transactions (
      transaction_date,
      transaction_type,
      inventory_id,
      freight_shipment_id,
      quantity_oz,
      quantity_grams,
      balance_before_oz,
      balance_after_oz,
      transaction_reference,
      notes,
      created_by
    ) VALUES (
      NEW.entry_date,
      'entry',
      NEW.id,
      NEW.freight_shipment_id,
      NEW.final_fine_oz,
      NEW.final_fine_grams,
      0,
      NEW.quantity_available_oz,
      NEW.certificate_number,
      NEW.notes,
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 4: Recréer le trigger
CREATE TRIGGER track_inventory_transaction
  AFTER INSERT ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_transaction();

-- Confirmation
RAISE NOTICE '✅ Migration terminée: batch_id supprimé, freight_shipment_id utilisé';
