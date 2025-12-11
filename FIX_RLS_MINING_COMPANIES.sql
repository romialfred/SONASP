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
DROP POLICY IF EXISTS "authenticated_users_can_read_mining_companies" ON mining_companies;
DROP POLICY IF EXISTS "anon_users_can_read_mining_companies" ON mining_companies;

-- 3. Créer une politique de lecture pour tous les utilisateurs authentifiés
CREATE POLICY "authenticated_users_can_read_mining_companies"
  ON mining_companies
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Créer une politique de lecture pour les utilisateurs anonymes
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
    RAISE WARNING 'Aucune politique RLS trouvée!';
  ELSE
    FOR v_policy IN (
      SELECT policyname, cmd, roles::text
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

-- 7. Appliquer les politiques sur les autres tables SI ELLES EXISTENT
-- On vérifie d'abord si chaque table existe avant de créer les politiques

-- Daily Production
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_production') THEN
    DROP POLICY IF EXISTS "authenticated_read_daily_production" ON daily_production;
    DROP POLICY IF EXISTS "anon_read_daily_production" ON daily_production;

    CREATE POLICY "authenticated_read_daily_production"
      ON daily_production FOR SELECT TO authenticated USING (true);
    CREATE POLICY "anon_read_daily_production"
      ON daily_production FOR SELECT TO anon USING (true);

    RAISE NOTICE '✅ Politiques RLS créées pour daily_production';
  END IF;
END $$;

-- Freight Shipments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'freight_shipments') THEN
    DROP POLICY IF EXISTS "authenticated_read_freight_shipments" ON freight_shipments;
    DROP POLICY IF EXISTS "anon_read_freight_shipments" ON freight_shipments;

    CREATE POLICY "authenticated_read_freight_shipments"
      ON freight_shipments FOR SELECT TO authenticated USING (true);
    CREATE POLICY "anon_read_freight_shipments"
      ON freight_shipments FOR SELECT TO anon USING (true);

    RAISE NOTICE '✅ Politiques RLS créées pour freight_shipments';
  END IF;
END $$;

-- Gold Inventory
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gold_inventory') THEN
    DROP POLICY IF EXISTS "authenticated_read_gold_inventory" ON gold_inventory;
    DROP POLICY IF EXISTS "anon_read_gold_inventory" ON gold_inventory;

    CREATE POLICY "authenticated_read_gold_inventory"
      ON gold_inventory FOR SELECT TO authenticated USING (true);
    CREATE POLICY "anon_read_gold_inventory"
      ON gold_inventory FOR SELECT TO anon USING (true);

    RAISE NOTICE '✅ Politiques RLS créées pour gold_inventory';
  END IF;
END $$;

-- Shipping
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shipping') THEN
    DROP POLICY IF EXISTS "authenticated_read_shipping" ON shipping;
    DROP POLICY IF EXISTS "anon_read_shipping" ON shipping;

    CREATE POLICY "authenticated_read_shipping"
      ON shipping FOR SELECT TO authenticated USING (true);
    CREATE POLICY "anon_read_shipping"
      ON shipping FOR SELECT TO anon USING (true);

    RAISE NOTICE '✅ Politiques RLS créées pour shipping';
  END IF;
END $$;

-- 8. Message final
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ POLITIQUES RLS CRÉÉES!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 PROCHAINES ÉTAPES:';
  RAISE NOTICE '  1. Rafraîchir l''application (Ctrl+Shift+R)';
  RAISE NOTICE '  2. Aller sur Gold Trade Space';
  RAISE NOTICE '  3. Sélectionner KGM dans le dropdown';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 FIX TERMINÉ!';
END $$;
