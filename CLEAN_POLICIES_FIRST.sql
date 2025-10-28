/*
  ÉTAPE 1 : NETTOYAGE COMPLET DES POLICIES PROBLÉMATIQUES

  Exécutez CE FICHIER EN PREMIER pour supprimer toutes les policies
  qui font référence à approver_id
*/

-- Désactiver temporairement RLS pour nettoyer
ALTER TABLE IF EXISTS batch_approvals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_parameters DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gold_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_transactions DISABLE ROW LEVEL SECURITY;

-- Supprimer TOUTES les policies existantes sur batch_approvals
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'batch_approvals')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON batch_approvals';
  END LOOP;
END $$;

-- Supprimer TOUTES les policies existantes sur system_parameters
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'system_parameters')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON system_parameters';
  END LOOP;
END $$;

-- Supprimer TOUTES les policies existantes sur gold_inventory
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'gold_inventory')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON gold_inventory';
  END LOOP;
END $$;

-- Supprimer TOUTES les policies existantes sur inventory_transactions
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'inventory_transactions')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON inventory_transactions';
  END LOOP;
END $$;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Toutes les policies ont été supprimées avec succès';
END $$;
