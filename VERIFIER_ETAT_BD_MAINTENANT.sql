/*
  ══════════════════════════════════════════════════════════════
  VÉRIFICATION RAPIDE DE L'ÉTAT DE LA BASE DE DONNÉES
  ══════════════════════════════════════════════════════════════

  Copiez-collez ce fichier COMPLET dans Supabase SQL Editor
  et cliquez "Run" pour voir l'état de vos migrations
*/

-- ═══════════════════════════════════════════════════════════════
-- PARTIE 1: VÉRIFICATION DES MIGRATIONS LICENSE (19-20)
-- ═══════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════════════' as "═════════════════════";
SELECT 'VÉRIFICATION MIGRATIONS LICENSE MANAGEMENT' as "TITRE";
SELECT '═══════════════════════════════════════════════' as "═════════════════════";

-- Migration 19: Système de License
SELECT
  '🔍 Migration 19' as "Migration",
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'licenses'
    )
    THEN '✅ APPLIQUÉE - Table licenses existe'
    ELSE '❌ NON APPLIQUÉE - Table licenses manquante'
  END as "Statut";

-- Migration 20: Données Échantillons
SELECT
  '🔍 Migration 20' as "Migration",
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'licenses'
    )
    THEN '⏸️  EN ATTENTE - Appliquer d''abord migration 19'
    WHEN EXISTS (
      SELECT 1 FROM licenses WHERE license_number LIKE 'LIC-2024-%'
    )
    THEN '✅ APPLIQUÉE - ' || (SELECT COUNT(*)::text FROM licenses WHERE license_number LIKE 'LIC-2024-%') || ' licenses échantillons trouvées'
    ELSE '❌ NON APPLIQUÉE - Aucune licence échantillon'
  END as "Statut";

-- ═══════════════════════════════════════════════════════════════
-- PARTIE 2: DÉTAILS DES TABLES LICENSE
-- ═══════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════════════' as "═════════════════════";
SELECT 'TABLES SYSTÈME LICENSE' as "TITRE";
SELECT '═══════════════════════════════════════════════' as "═════════════════════";

SELECT
  table_name as "Table",
  CASE
    WHEN table_name IN (
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    )
    THEN '✅ Existe'
    ELSE '❌ Manquante'
  END as "Statut"
FROM (
  VALUES
    ('licenses'),
    ('license_requests'),
    ('license_request_documents'),
    ('license_quota_transactions'),
    ('license_events'),
    ('license_kpi_thresholds')
) AS t(table_name);

-- ═══════════════════════════════════════════════════════════════
-- PARTIE 3: VÉRIFICATION ENUMS LICENSE
-- ═══════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════════════' as "═════════════════════";
SELECT 'ENUMS SYSTÈME LICENSE' as "TITRE";
SELECT '═══════════════════════════════════════════════' as "═════════════════════";

SELECT
  enum_name as "Enum",
  CASE
    WHEN enum_name IN (
      SELECT typname
      FROM pg_type
      WHERE typname IN ('license_status', 'license_request_status', 'license_event_type', 'quota_transaction_type')
    )
    THEN '✅ Existe'
    ELSE '❌ Manquant'
  END as "Statut"
FROM (
  VALUES
    ('license_status'),
    ('license_request_status'),
    ('license_event_type'),
    ('quota_transaction_type')
) AS e(enum_name);

-- ═══════════════════════════════════════════════════════════════
-- PARTIE 4: COLONNE license_id DANS BATCHES
-- ═══════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════════════' as "═════════════════════";
SELECT 'INTÉGRATION AVEC BATCHES' as "TITRE";
SELECT '═══════════════════════════════════════════════' as "═════════════════════";

SELECT
  'license_id dans batches' as "Colonne",
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'batches' AND column_name = 'license_id'
    )
    THEN '✅ Existe - Batches peuvent être liés aux licenses'
    ELSE '❌ Manquante - Migration 19 non appliquée'
  END as "Statut";

-- ═══════════════════════════════════════════════════════════════
-- PARTIE 5: COMPTAGE DES DONNÉES
-- ═══════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════════════' as "═════════════════════";
SELECT 'DONNÉES EXISTANTES' as "TITRE";
SELECT '═══════════════════════════════════════════════' as "═════════════════════";

-- Compter les licenses (si la table existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'licenses'
  ) THEN
    RAISE NOTICE '📊 Licenses totales: %', (SELECT COUNT(*) FROM licenses);
    RAISE NOTICE '📊 Licenses échantillons (LIC-2024-*): %', (SELECT COUNT(*) FROM licenses WHERE license_number LIKE 'LIC-2024-%');
    RAISE NOTICE '📊 License requests: %', (SELECT COUNT(*) FROM license_requests);
    RAISE NOTICE '📊 License events: %', (SELECT COUNT(*) FROM license_events);
    RAISE NOTICE '📊 Batches liés à licenses: %', (SELECT COUNT(*) FROM batches WHERE license_id IS NOT NULL);
  ELSE
    RAISE NOTICE '⚠️  Table licenses n''existe pas encore';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- PARTIE 6: AUTRES TABLES IMPORTANTES (Migrations 1-18)
-- ═══════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════════════' as "═════════════════════";
SELECT 'AUTRES TABLES (MIGRATIONS 1-18)' as "TITRE";
SELECT '═══════════════════════════════════════════════' as "═════════════════════";

SELECT
  table_name as "Table",
  CASE
    WHEN table_name IN (
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    )
    THEN '✅ Existe'
    ELSE '❌ Manquante'
  END as "Statut"
FROM (
  VALUES
    ('reports'),
    ('report_schedules'),
    ('sales'),
    ('payments'),
    ('customer_banks'),
    ('fx_rate_analysis'),
    ('pre_sales'),
    ('assay_certificates'),
    ('batch_documents'),
    ('user_activation_tokens')
) AS t(table_name)
ORDER BY table_name;

-- ═══════════════════════════════════════════════════════════════
-- PARTIE 7: RÉSUMÉ ET RECOMMANDATIONS
-- ═══════════════════════════════════════════════════════════════

SELECT '═══════════════════════════════════════════════' as "═════════════════════";
SELECT 'RÉSUMÉ ET ACTIONS RECOMMANDÉES' as "TITRE";
SELECT '═══════════════════════════════════════════════' as "═════════════════════";

DO $$
DECLARE
  licenses_exists BOOLEAN;
  sample_data_exists BOOLEAN;
  migration_19_status TEXT;
  migration_20_status TEXT;
  action_required TEXT;
BEGIN
  -- Vérifier si les tables licenses existent
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'licenses'
  ) INTO licenses_exists;

  -- Vérifier si les données échantillons existent
  IF licenses_exists THEN
    SELECT EXISTS (
      SELECT 1 FROM licenses WHERE license_number LIKE 'LIC-2024-%'
    ) INTO sample_data_exists;
  ELSE
    sample_data_exists := FALSE;
  END IF;

  -- Déterminer les statuts
  IF licenses_exists THEN
    migration_19_status := '✅ APPLIQUÉE';
  ELSE
    migration_19_status := '❌ NON APPLIQUÉE';
  END IF;

  IF sample_data_exists THEN
    migration_20_status := '✅ APPLIQUÉE';
  ELSIF NOT licenses_exists THEN
    migration_20_status := '⏸️  EN ATTENTE (appliquer d''abord migration 19)';
  ELSE
    migration_20_status := '❌ NON APPLIQUÉE';
  END IF;

  -- Déterminer les actions
  IF NOT licenses_exists THEN
    action_required := '
╔════════════════════════════════════════════════════════════╗
║  ACTION REQUISE: Appliquer Migration 19                   ║
╚════════════════════════════════════════════════════════════╝

📁 Fichier: supabase/migrations/20251108000000_create_export_license_system.sql

📋 Étapes:
   1. Ouvrir le fichier ci-dessus
   2. Copier TOUT le contenu (727 lignes)
   3. Coller dans Supabase SQL Editor
   4. Cliquer "Run"
   5. Attendre le message de succès

⚠️  IMPORTANT: Appliquer cette migration AVANT la migration 20!
    ';
  ELSIF NOT sample_data_exists THEN
    action_required := '
╔════════════════════════════════════════════════════════════╗
║  ACTION REQUISE: Appliquer Migration 20                   ║
╚════════════════════════════════════════════════════════════╝

📁 Fichier: supabase/migrations/20251108100000_seed_license_sample_data.sql

📋 Étapes:
   1. Ouvrir le fichier ci-dessus
   2. Copier TOUT le contenu (227 lignes)
   3. Coller dans Supabase SQL Editor
   4. Cliquer "Run"
   5. Attendre le message de succès

✅ La migration 19 est déjà appliquée, vous pouvez maintenant ajouter les données échantillons!
    ';
  ELSE
    action_required := '
╔════════════════════════════════════════════════════════════╗
║  ✅ TOUT EST EN ORDRE!                                     ║
╚════════════════════════════════════════════════════════════╝

🎉 Les deux migrations sont appliquées avec succès!

📊 Vous devriez avoir:
   • 10 licenses échantillons (LIC-2024-0001 à 0010)
   • Tables license complètes
   • Enums configurés
   • Intégration avec batches activée

🚀 Prochaines étapes:
   1. Accédez à votre application
   2. Cliquez sur "License Management" dans le menu
   3. Explorez les 10 licenses échantillons
   4. Cliquez sur une license pour voir l''onglet "Associated Batches"
    ';
  END IF;

  -- Afficher le résumé
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'RÉSUMÉ DES MIGRATIONS';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 19 (Système License):    %', migration_19_status;
  RAISE NOTICE 'Migration 20 (Données Échantillons): %', migration_20_status;
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '%', action_required;
  RAISE NOTICE '══════════════════════════════════════════════════════════════';

END $$;

-- ═══════════════════════════════════════════════════════════════
-- FIN DE LA VÉRIFICATION
-- ═══════════════════════════════════════════════════════════════

SELECT '✅ Vérification terminée! Consultez les messages ci-dessus.' as "Résultat";
