/*
  ═══════════════════════════════════════════════════════════════════════════
  🚀 FIX LICENSE SYSTEM - DIAGNOSTIC & CORRECTION AUTOMATIQUE
  ═══════════════════════════════════════════════════════════════════════════

  Ce script:
  1. Diagnostique le problème
  2. Affiche les résultats
  3. Vous indique quelles migrations appliquer

  INSTRUCTIONS:
  1. Copier TOUT ce fichier
  2. Coller dans Supabase SQL Editor
  3. Cliquer "RUN"
  4. Lire les résultats
  5. Suivre les instructions affichées
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTIE 1: DIAGNOSTIC COMPLET
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  table_count INT;
  view_count INT;
  license_count INT;
  user_role TEXT;
  rls_enabled BOOLEAN;
  policy_count INT;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '🔍 DIAGNOSTIC LICENSE SYSTEM';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- 1. Vérifier tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('licenses', 'license_requests');

  RAISE NOTICE '1️⃣  TABLES EXISTANTES: %', table_count;
  IF table_count >= 2 THEN
    RAISE NOTICE '   ✅ Tables existent (licenses + license_requests)';
  ELSE
    RAISE NOTICE '   ❌ PROBLÈME: Tables manquantes!';
    RAISE NOTICE '   → SOLUTION: Appliquer migration 19';
    RAISE NOTICE '   → Fichier: 20251108000000_create_export_license_system.sql';
  END IF;
  RAISE NOTICE '';

  -- 2. Vérifier vue
  SELECT COUNT(*) INTO view_count
  FROM pg_views
  WHERE schemaname = 'public'
  AND viewname = 'licenses_with_computed_fields';

  RAISE NOTICE '2️⃣  VUE COMPUTED FIELDS: %', view_count;
  IF view_count = 1 THEN
    RAISE NOTICE '   ✅ Vue existe';
  ELSE
    RAISE NOTICE '   ❌ PROBLÈME: Vue manquante!';
    RAISE NOTICE '   → SOLUTION: Appliquer migration 19';
  END IF;
  RAISE NOTICE '';

  -- 3. Compter licenses
  IF table_count >= 2 THEN
    SELECT COUNT(*) INTO license_count FROM licenses;
    RAISE NOTICE '3️⃣  DONNÉES LICENSES: %', license_count;
    IF license_count > 0 THEN
      RAISE NOTICE '   ✅ Table contient % licenses', license_count;
    ELSE
      RAISE NOTICE '   ❌ PROBLÈME: Table vide!';
      RAISE NOTICE '   → SOLUTION: Appliquer migration 20';
      RAISE NOTICE '   → Fichier: 20251108100000_seed_license_sample_data.sql';
    END IF;
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '3️⃣  DONNÉES LICENSES: N/A (tables manquantes)';
    RAISE NOTICE '';
  END IF;

  -- 4. Vérifier RLS
  IF table_count >= 2 THEN
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = 'licenses' AND relnamespace = 'public'::regnamespace;

    RAISE NOTICE '4️⃣  RLS (ROW LEVEL SECURITY): %',
      CASE WHEN rls_enabled THEN 'ACTIVÉ' ELSE 'DÉSACTIVÉ' END;
    IF rls_enabled THEN
      RAISE NOTICE '   ✅ RLS activé';
    ELSE
      RAISE NOTICE '   ⚠️  RLS désactivé (peut causer des problèmes de sécurité)';
    END IF;
    RAISE NOTICE '';

    -- 5. Compter politiques
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'licenses';

    RAISE NOTICE '5️⃣  POLITIQUES RLS: %', policy_count;
    IF policy_count > 0 THEN
      RAISE NOTICE '   ✅ % politiques configurées', policy_count;
    ELSE
      RAISE NOTICE '   ❌ PROBLÈME: Aucune politique RLS!';
      RAISE NOTICE '   → SOLUTION: Appliquer migration 19 (inclut les politiques)';
    END IF;
    RAISE NOTICE '';
  END IF;

  -- 6. Vérifier rôle utilisateur
  BEGIN
    SELECT role INTO user_role
    FROM user_profiles
    WHERE id = auth.uid();

    RAISE NOTICE '6️⃣  VOTRE RÔLE: %', COALESCE(user_role, 'AUCUN');
    IF user_role IN ('management', 'factory') THEN
      RAISE NOTICE '   ✅ Rôle autorisé (%, peut voir les licenses)', user_role;
    ELSIF user_role IS NULL THEN
      RAISE NOTICE '   ❌ PROBLÈME: Pas de rôle défini!';
      RAISE NOTICE '   → SOLUTION: Exécuter commande de correction ci-dessous';
    ELSE
      RAISE NOTICE '   ⚠️  Rôle "%" peut avoir accès limité', user_role;
      RAISE NOTICE '   → Pour tester, mettre en "management"';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '6️⃣  VOTRE RÔLE: ERREUR (table user_profiles manquante?)';
  END;
  RAISE NOTICE '';

  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '📋 RÉSUMÉ';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';

  IF table_count < 2 THEN
    RAISE NOTICE '';
    RAISE NOTICE '🔴 ACTION REQUISE: Appliquer MIGRATION 19';
    RAISE NOTICE '';
    RAISE NOTICE 'Étapes:';
    RAISE NOTICE '1. Ouvrir: supabase/migrations/20251108000000_create_export_license_system.sql';
    RAISE NOTICE '2. Copier TOUT le contenu (CTRL+A, CTRL+C)';
    RAISE NOTICE '3. Ouvrir nouvel onglet SQL Editor';
    RAISE NOTICE '4. Coller (CTRL+V)';
    RAISE NOTICE '5. Cliquer "RUN"';
    RAISE NOTICE '6. Attendre ~5-10 secondes';
    RAISE NOTICE '7. Revenir ici et ré-exécuter ce diagnostic';
    RAISE NOTICE '';
  ELSIF license_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '🟡 ACTION REQUISE: Appliquer MIGRATION 20';
    RAISE NOTICE '';
    RAISE NOTICE 'Étapes:';
    RAISE NOTICE '1. Ouvrir: supabase/migrations/20251108100000_seed_license_sample_data.sql';
    RAISE NOTICE '2. Copier TOUT le contenu';
    RAISE NOTICE '3. Coller dans nouvel onglet SQL Editor';
    RAISE NOTICE '4. Cliquer "RUN"';
    RAISE NOTICE '5. Devrait voir "INSERT 0 10"';
    RAISE NOTICE '6. Recharger la page /licenses';
    RAISE NOTICE '';
  ELSIF user_role IS NULL OR user_role NOT IN ('management', 'factory') THEN
    RAISE NOTICE '';
    RAISE NOTICE '🟡 ACTION REQUISE: Corriger votre rôle';
    RAISE NOTICE '';
    RAISE NOTICE 'Exécuter dans SQL Editor:';
    RAISE NOTICE '';
    RAISE NOTICE 'UPDATE user_profiles';
    RAISE NOTICE 'SET role = ''management''';
    RAISE NOTICE 'WHERE id = auth.uid();';
    RAISE NOTICE '';
    RAISE NOTICE 'Puis recharger /licenses';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '🟢 TOUT EST OK!';
    RAISE NOTICE '';
    RAISE NOTICE 'Si la page /licenses est toujours vide:';
    RAISE NOTICE '1. Vérifier console navigateur (F12) pour erreurs';
    RAISE NOTICE '2. Tester requête directe ci-dessous';
    RAISE NOTICE '';
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTIE 2: TEST DE REQUÊTE DIRECTE
-- ═══════════════════════════════════════════════════════════════════════════

-- Si tables existent, tester requête directe
DO $$
DECLARE
  table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'licenses'
  ) INTO table_exists;

  IF table_exists THEN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '🧪 TEST REQUÊTE DIRECTE';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Exécuter cette requête dans un nouvel onglet SQL Editor:';
    RAISE NOTICE '';
    RAISE NOTICE 'SELECT';
    RAISE NOTICE '  license_number,';
    RAISE NOTICE '  applicant_company_name,';
    RAISE NOTICE '  status,';
    RAISE NOTICE '  is_active,';
    RAISE NOTICE '  days_to_expiry,';
    RAISE NOTICE '  remaining_percentage';
    RAISE NOTICE 'FROM licenses_with_computed_fields';
    RAISE NOTICE 'LIMIT 3;';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Si retourne des données → Problème dans frontend/service';
    RAISE NOTICE '❌ Si retourne 0 ligne → Problème RLS ou table vide';
    RAISE NOTICE '❌ Si erreur → Vue ou table manquante';
    RAISE NOTICE '';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTIE 3: COMMANDES DE CORRECTION RAPIDE
-- ═══════════════════════════════════════════════════════════════════════════

-- Décommenter et exécuter si nécessaire:

-- CORRECTION 1: Mettre votre rôle en management
-- UPDATE user_profiles SET role = 'management' WHERE id = auth.uid();

-- CORRECTION 2: Vérifier nombre de licenses
-- SELECT COUNT(*) as total_licenses FROM licenses;

-- CORRECTION 3: Voir exemples de licenses
-- SELECT license_number, status, remaining_percentage FROM licenses LIMIT 3;

-- CORRECTION 4: Tester la vue directement
-- SELECT COUNT(*) FROM licenses_with_computed_fields;
