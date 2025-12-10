# 🔧 Correction Définitive de l'Erreur batch_id

## Instructions d'Application

Pour corriger définitivement l'erreur `batch_id` dans `inventory_transactions`, suivez ces étapes :

### Étape 1 : Accéder à l'Éditeur SQL de Supabase

1. Connectez-vous à votre projet Supabase : https://boolqagzdqbahqnpawpb.supabase.co
2. Dans le menu latéral, cliquez sur **SQL Editor**
3. Cliquez sur **New Query** pour créer une nouvelle requête

### Étape 2 : Copier et Exécuter le SQL

Copiez **tout** le contenu ci-dessous et collez-le dans l'éditeur SQL :

```sql
-- ============================================================================
-- FIX DÉFINITIF: Suppression de batch_id de inventory_transactions
-- Date: 2025-12-10
-- Description: Supprime la colonne batch_id obsolète et met à jour les triggers
-- ============================================================================

-- 1. Supprimer la contrainte de clé étrangère si elle existe
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
    RAISE NOTICE 'ℹ Contrainte batch_id_fkey n''existe pas';
  END IF;
END $$;

-- 2. Supprimer la colonne batch_id si elle existe
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
    RAISE NOTICE 'ℹ Colonne batch_id n''existe pas';
  END IF;
END $$;

-- 3. S'assurer que freight_shipment_id existe
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

-- 4. Recréer la fonction trigger SANS batch_id
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

-- 5. Recréer le trigger
DROP TRIGGER IF EXISTS trigger_create_inventory_transaction ON gold_inventory;
CREATE TRIGGER trigger_create_inventory_transaction
  AFTER INSERT ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_transaction();

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION TERMINÉE AVEC SUCCÈS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Modifications appliquées:';
  RAISE NOTICE '  ✓ Contrainte batch_id_fkey supprimée';
  RAISE NOTICE '  ✓ Colonne batch_id supprimée';
  RAISE NOTICE '  ✓ Colonne freight_shipment_id vérifiée';
  RAISE NOTICE '  ✓ Fonction create_inventory_transaction() mise à jour';
  RAISE NOTICE '  ✓ Trigger recréé sans référence à batch_id';
  RAISE NOTICE '';
  RAISE NOTICE 'L''erreur "batch_id does not exist" ne devrait plus apparaître.';
  RAISE NOTICE '';
END $$;
```

### Étape 3 : Exécuter la Requête

1. Cliquez sur le bouton **Run** (ou appuyez sur `Ctrl/Cmd + Enter`)
2. Attendez que l'exécution se termine (quelques secondes)
3. Vérifiez les messages dans la section **Results** :
   - Vous devriez voir des messages `✓` confirmant chaque étape
   - Le message final confirme que la migration est terminée

### Étape 4 : Vérification

Après avoir exécuté le script, vous pouvez vérifier que tout fonctionne :

```sql
-- Vérifier la structure de inventory_transactions
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'inventory_transactions'
ORDER BY ordinal_position;
```

La colonne `batch_id` ne devrait **PAS** apparaître dans les résultats.

## Résolution des Problèmes

### Si vous obtenez une erreur de permissions

Assurez-vous d'être connecté avec un compte administrateur qui a les droits nécessaires pour :
- Modifier la structure des tables
- Créer/modifier des fonctions
- Créer/modifier des triggers

### Si l'erreur persiste après l'exécution

1. Rafraîchissez la page de votre application (Ctrl/Cmd + Shift + R)
2. Videz le cache de votre navigateur
3. Réessayez d'ajouter une entrée d'inventaire

## Résultat Attendu

Après avoir appliqué cette migration, l'erreur suivante ne devrait **plus jamais** apparaître :

```
Error adding inventory entry: column "batch_id" of relation
"inventory_transactions" does not exist
```

Toutes les nouvelles entrées d'inventaire utiliseront `freight_shipment_id` à la place de `batch_id`.
