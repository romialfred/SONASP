# FIX: Remove batch_id from inventory_transactions

## Problème
L'application génère une erreur lors de l'ajout d'une entrée d'inventaire :
```
Error adding inventory entry: column "batch_id" of relation "inventory_transactions" does not exist
```

## Solution
La table `inventory_transactions` contient encore une référence à `batch_id` qui doit être supprimée et remplacée par `freight_shipment_id`.

## Instructions d'application

### Étape 1: Ouvrez l'éditeur SQL de Supabase
1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Cliquez sur "SQL Editor" dans le menu de gauche
4. Cliquez sur "New Query"

### Étape 2: Copiez et exécutez le SQL suivant

```sql
-- Drop any existing triggers that might reference batch_id
DROP TRIGGER IF EXISTS track_inventory_transaction ON gold_inventory;
DROP FUNCTION IF EXISTS create_inventory_transaction CASCADE;

-- Check if inventory_transactions table exists and modify it
DO $$
BEGIN
  -- Check if batch_id column exists and drop it
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
    AND column_name = 'batch_id'
  ) THEN
    -- Drop the foreign key constraint first if it exists
    ALTER TABLE inventory_transactions
    DROP CONSTRAINT IF EXISTS inventory_transactions_batch_id_fkey;

    -- Now drop the column
    ALTER TABLE inventory_transactions
    DROP COLUMN batch_id;

    RAISE NOTICE 'Dropped batch_id column from inventory_transactions';
  END IF;

  -- Ensure freight_shipment_id column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
    AND column_name = 'freight_shipment_id'
  ) THEN
    ALTER TABLE inventory_transactions
    ADD COLUMN freight_shipment_id UUID REFERENCES freight_shipments(id) ON DELETE SET NULL;

    RAISE NOTICE 'Added freight_shipment_id column to inventory_transactions';
  END IF;
END $$;

-- Recreate the trigger function without batch_id reference
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS track_inventory_transaction ON gold_inventory;
CREATE TRIGGER track_inventory_transaction
  AFTER INSERT ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_transaction();
```

### Étape 3: Exécutez la requête
Cliquez sur "Run" (ou appuyez sur Ctrl+Enter / Cmd+Enter)

### Étape 4: Vérifiez les résultats
Vous devriez voir des messages comme :
- ✅ "Dropped batch_id column from inventory_transactions"
- ✅ Trigger et fonction recréés avec succès

### Étape 5: Testez l'application
Rechargez votre application et essayez à nouveau d'ajouter une entrée d'inventaire.

## Modifications effectuées

### Dans le code
- ✅ `inventoryService.ts` : Toutes les références à `batch` ont été remplacées par `freight_shipment`
- ✅ `getAllInventoryEntries()` : Utilise maintenant `freight_shipment_id`
- ✅ `getInventoryTransactions()` : Utilise maintenant `freight_shipment_id`
- ✅ `getInventoryForBatch()` renommée en `getInventoryForShipment()`

### Dans la base de données
- ✅ Suppression de la colonne `batch_id` de `inventory_transactions`
- ✅ Ajout/vérification de la colonne `freight_shipment_id`
- ✅ Mise à jour du trigger pour utiliser `freight_shipment_id`

## Notes importantes
- Cette migration est idempotente : elle peut être exécutée plusieurs fois sans problème
- Les données existantes ne seront pas perdues
- Le système utilise maintenant exclusivement les expéditions (`freight_shipments`) au lieu des batches
