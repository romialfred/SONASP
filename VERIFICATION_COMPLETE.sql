-- ================================================================
-- VÉRIFICATION COMPLÈTE DU FIX
-- Exécutez ceci pour voir l'état actuel de votre base de données
-- ================================================================

-- 1. Vérifier les politiques sur user_profiles (devrait être 0)
SELECT 
  '1️⃣ POLITIQUES SUR user_profiles' as verification,
  COUNT(*) as nombre_politiques,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ CORRECT - Aucune politique (pas de récursion)'
    ELSE '❌ PROBLÈME - Il reste ' || COUNT(*) || ' politique(s)'
  END as statut
FROM pg_policies
WHERE tablename = 'user_profiles';

-- 2. Vérifier le statut RLS (devrait être désactivé)
SELECT 
  '2️⃣ STATUT RLS' as verification,
  rowsecurity as rls_active,
  CASE 
    WHEN rowsecurity = false THEN '✅ CORRECT - RLS désactivé'
    ELSE '❌ PROBLÈME - RLS encore activé'
  END as statut
FROM pg_tables
WHERE tablename = 'user_profiles';

-- 3. Vérifier la fonction helper (devrait exister)
SELECT 
  '3️⃣ FONCTION HELPER' as verification,
  COUNT(*) as nombre_fonctions,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ CORRECT - Fonction existe'
    ELSE '❌ PROBLÈME - Fonction manquante'
  END as statut
FROM pg_proc
WHERE proname = 'is_management_user';

-- 4. Vérifier les permissions sur user_profiles
SELECT 
  '4️⃣ PERMISSIONS' as verification,
  grantee as pour_qui,
  string_agg(privilege_type, ', ') as permissions
FROM information_schema.table_privileges
WHERE table_name = 'user_profiles'
AND grantee IN ('service_role', 'authenticated')
GROUP BY grantee;

-- 5. Lister les politiques qui existent encore (si présentes)
SELECT 
  '5️⃣ POLITIQUES RESTANTES (devrait être vide)' as verification,
  policyname as nom_politique,
  cmd as operation
FROM pg_policies
WHERE tablename = 'user_profiles';

-- RÉSUMÉ FINAL
DO $$
DECLARE
  v_policies_count int;
  v_rls_enabled boolean;
  v_function_exists boolean;
BEGIN
  -- Compter les politiques
  SELECT COUNT(*) INTO v_policies_count
  FROM pg_policies
  WHERE tablename = 'user_profiles';
  
  -- Vérifier RLS
  SELECT rowsecurity INTO v_rls_enabled
  FROM pg_tables
  WHERE tablename = 'user_profiles';
  
  -- Vérifier fonction
  SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'is_management_user')
  INTO v_function_exists;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE '           RÉSUMÉ DE VÉRIFICATION          ';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE '';
  
  IF v_policies_count = 0 THEN
    RAISE NOTICE '✅ Politiques: % (CORRECT)', v_policies_count;
  ELSE
    RAISE NOTICE '❌ Politiques: % (PROBLÈME - devrait être 0)', v_policies_count;
  END IF;
  
  IF v_rls_enabled = false THEN
    RAISE NOTICE '✅ RLS: Désactivé (CORRECT)';
  ELSE
    RAISE NOTICE '❌ RLS: Activé (PROBLÈME - devrait être désactivé)';
  END IF;
  
  IF v_function_exists THEN
    RAISE NOTICE '✅ Fonction helper: Existe (CORRECT)';
  ELSE
    RAISE NOTICE '❌ Fonction helper: Manquante (PROBLÈME)';
  END IF;
  
  RAISE NOTICE '';
  
  IF v_policies_count = 0 AND v_rls_enabled = false AND v_function_exists THEN
    RAISE NOTICE '╔═══════════════════════════════════════════╗';
    RAISE NOTICE '║   🎉 FIX COMPLÈTEMENT APPLIQUÉ! 🎉        ║';
    RAISE NOTICE '╚═══════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE 'PROCHAINES ÉTAPES:';
    RAISE NOTICE '1. Rafraîchir votre application (Ctrl+Shift+R)';
    RAISE NOTICE '2. Aller à Administration → User Management';
    RAISE NOTICE '3. La page devrait charger sans erreurs';
    RAISE NOTICE '4. Tester la création d''utilisateur';
  ELSE
    RAISE NOTICE '╔═══════════════════════════════════════════╗';
    RAISE NOTICE '║   ⚠️  FIX INCOMPLET - ACTION REQUISE     ║';
    RAISE NOTICE '╚═══════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE 'Vous devez réexécuter TOUT le contenu de:';
    RAISE NOTICE 'COPY_THIS_SQL.txt';
    RAISE NOTICE '';
    RAISE NOTICE 'Sélectionnez TOUT (Ctrl+A) et exécutez d''un coup!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════';
END $$;
