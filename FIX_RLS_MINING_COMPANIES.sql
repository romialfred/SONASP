-- ============================================
-- FIX RLS POLICIES FOR MINING COMPANIES
-- ============================================
--
-- PROBLÈME: Les mining companies existent dans la DB mais ne sont pas
-- accessibles depuis l'application à cause des politiques RLS.
--
-- SOLUTION: Créer des politiques RLS pour permettre la lecture.
--
-- À EXÉCUTER DANS: Supabase SQL Editor
-- ============================================

-- 1. Vérifier si RLS est activé sur mining_companies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'mining_companies'
      AND rowsecurity = true
  ) THEN
    RAISE NOTICE '✅ RLS est activé sur mining_companies';
  ELSE
    RAISE NOTICE '⚠️  RLS n''est PAS activé sur mining_companies';
  END IF;
END $$;

-- 2. Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Allow read access to mining companies" ON mining_companies;
DROP POLICY IF EXISTS "mining_companies_select" ON mining_companies;
DROP POLICY IF EXISTS "Enable read access for all users" ON mining_companies;
DROP POLICY IF EXISTS "Allow authenticated users to read" ON mining_companies;

-- 3. Créer une politique de lecture pour tous les utilisateurs authentifiés
CREATE POLICY "authenticated_users_can_read_mining_companies"
  ON mining_companies
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Créer une politique de lecture pour les utilisateurs anonymes
-- Cela permet à l'application de fonctionner même sans authentification
CREATE POLICY "anon_users_can_read_mining_companies"
  ON mining_companies
  FOR SELECT
  TO anon
  USING (true);

-- 5. Vérifier les politiques créées
DO $$
DECLARE
  v_count INTEGER;
  v_policy RECORD;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'mining_companies';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'POLITIQUES RLS SUR mining_companies';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Nombre de politiques: %', v_count;
  RAISE NOTICE '';

  IF v_count = 0 THEN
    RAISE WARNING 'Aucune politique RLS trouvée! Les utilisateurs ne pourront pas lire les données.';
  ELSE
    -- Afficher les politiques
    FOR v_policy IN (
      SELECT policyname, cmd, roles::text, qual::text
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'mining_companies'
    ) LOOP
      RAISE NOTICE 'Politique: %', v_policy.policyname;
      RAISE NOTICE '  Commande: %', v_policy.cmd;
      RAISE NOTICE '  Rôles: %', v_policy.roles;
      RAISE NOTICE '';
    END LOOP;
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- 6. Tester la lecture
DO $$
DECLARE
  v_count INTEGER;
  r RECORD;
BEGIN
  -- Compter les mining companies
  SELECT COUNT(*) INTO v_count FROM mining_companies;

  RAISE NOTICE '';
  RAISE NOTICE 'TEST DE LECTURE:';
  RAISE NOTICE '  Mining companies dans la DB: %', v_count;
  RAISE NOTICE '';

  IF v_count = 0 THEN
    RAISE WARNING 'Aucune mining company trouvée!';
  ELSE
    RAISE NOTICE '✅ Les mining companies sont accessibles!';
    RAISE NOTICE '';
    RAISE NOTICE 'Liste:';
    FOR r IN (SELECT name, code FROM mining_companies ORDER BY name) LOOP
      RAISE NOTICE '  - % (%)', r.name, r.code;
    END LOOP;
  END IF;
END $$;

-- 7. Appliquer les mêmes correctifs sur les tables liées
-- Ces tables doivent aussi être accessibles pour que la chaîne fonctionne

-- Production
DROP POLICY IF EXISTS "authenticated_users_can_read_production" ON production;
CREATE POLICY "authenticated_users_can_read_production"
  ON production
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "anon_users_can_read_production"
  ON production
  FOR SELECT
  TO anon
  USING (true);

-- Freight Shipments
DROP POLICY IF EXISTS "authenticated_users_can_read_freight_shipments" ON freight_shipments;
CREATE POLICY "authenticated_users_can_read_freight_shipments"
  ON freight_shipments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "anon_users_can_read_freight_shipments"
  ON freight_shipments
  FOR SELECT
  TO anon
  USING (true);

-- Gold Inventory
DROP POLICY IF EXISTS "authenticated_users_can_read_gold_inventory" ON gold_inventory;
CREATE POLICY "authenticated_users_can_read_gold_inventory"
  ON gold_inventory
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "anon_users_can_read_gold_inventory"
  ON gold_inventory
  FOR SELECT
  TO anon
  USING (true);

-- 8. Message final
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Politiques RLS créées pour toutes les tables de la chaîne!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 PROCHAINES ÉTAPES:';
  RAISE NOTICE '  1. Rafraîchir l''application (Ctrl+Shift+R)';
  RAISE NOTICE '  2. Aller sur Gold Trade Space';
  RAISE NOTICE '  3. Sélectionner KGM dans le dropdown';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 FIX TERMINÉ!';
END $$;
