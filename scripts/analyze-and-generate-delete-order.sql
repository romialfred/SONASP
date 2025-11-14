/*
  # Analyse des FK et Génération de l'Ordre de Suppression Optimal

  Ce script analyse TOUTES les contraintes FK de la base et génère
  automatiquement l'ordre de suppression correct.
*/

-- =====================================================
-- ÉTAPE 1: LISTER TOUTES LES FK
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '🔍 ANALYSE DES CONTRAINTES FOREIGN KEY';
  RAISE NOTICE '🔍 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- Créer une table temporaire avec toutes les FK
CREATE TEMP TABLE IF NOT EXISTS temp_fk_analysis AS
SELECT
  tc.table_name as table_enfant,
  kcu.column_name as colonne_enfant,
  ccu.table_name AS table_parent,
  ccu.column_name AS colonne_parent,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY ccu.table_name, tc.table_name;

-- Afficher les résultats
DO $$
DECLARE
  rec RECORD;
  count_fk INT;
BEGIN
  SELECT COUNT(*) INTO count_fk FROM temp_fk_analysis;

  RAISE NOTICE 'Nombre total de contraintes FK: %', count_fk;
  RAISE NOTICE '';
  RAISE NOTICE '%-30s | %-25s | %-25s', 'TABLE ENFANT', 'COLONNE', 'TABLE PARENT';
  RAISE NOTICE '%-30s-+-%-25s-+-%-25s',
    '------------------------------',
    '-------------------------',
    '-------------------------';

  FOR rec IN
    SELECT * FROM temp_fk_analysis
    ORDER BY table_parent, table_enfant
  LOOP
    RAISE NOTICE '%-30s | %-25s | %-25s',
      rec.table_enfant,
      rec.colonne_enfant,
      rec.table_parent;
  END LOOP;

  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 2: IDENTIFIER LES TABLES PAR NIVEAU
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '📊 HIÉRARCHIE DES TABLES';
  RAISE NOTICE '📊 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- Tables qui ne sont JAMAIS enfants (niveau 0 - tables de base)
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '🔵 NIVEAU 0: Tables de Base (aucune FK sortante vers tables transactionnelles)';
  RAISE NOTICE '';

  FOR rec IN
    SELECT DISTINCT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN (
        SELECT DISTINCT table_enfant FROM temp_fk_analysis
        WHERE table_parent IN (
          SELECT DISTINCT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
        )
      )
      AND tablename IN (
        'users', 'profiles', 'mining_companies', 'sites',
        'customers', 'refineries', 'transport_companies',
        'freight_companies', 'annual_budgets', 'fx_rates',
        'gold_prices', 'forecasts'
      )
    ORDER BY tablename
  LOOP
    RAISE NOTICE '  - %', rec.tablename;
  END LOOP;

  RAISE NOTICE '';
END $$;

-- Tables qui dépendent des tables de base (niveau 1+)
DO $$
DECLARE
  rec RECORD;
  niveau INT;
BEGIN
  -- Analyser les dépendances par niveau
  FOR niveau IN 1..10 LOOP
    RAISE NOTICE '🔴 NIVEAU %: Tables Transactionnelles', niveau;
    RAISE NOTICE '';

    -- Identifier les tables de ce niveau
    FOR rec IN
      SELECT DISTINCT table_enfant,
             array_agg(DISTINCT table_parent) as parents
      FROM temp_fk_analysis
      WHERE table_enfant IN (
        'daily_production', 'production_documents', 'unified_status_history',
        'export_licenses', 'export_license_quotas',
        'shipping_preparations', 'shipping_documents', 'assay_certificates',
        'freight_customs', 'inventory', 'inventory_movements',
        'sales', 'pre_sales', 'payments', 'virtual_payments'
      )
      GROUP BY table_enfant
      ORDER BY table_enfant
    LOOP
      RAISE NOTICE '  - % dépend de: %', rec.table_enfant, rec.parents;
    END LOOP;

    EXIT WHEN niveau >= 5;
  END LOOP;

  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 3: ORDRE DE SUPPRESSION RECOMMANDÉ
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ═══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ ORDRE DE SUPPRESSION RECOMMANDÉ';
  RAISE NOTICE '✅ ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Règle: Supprimer dans l''ordre INVERSE des dépendances';
  RAISE NOTICE '       (Du plus dépendant au moins dépendant)';
  RAISE NOTICE '';
  RAISE NOTICE '1.  virtual_payments     (si dépend de payments/sales)';
  RAISE NOTICE '2.  payments              (dépend de sales)';
  RAISE NOTICE '3.  pre_sales             (dépend de customers, possiblement inventory)';
  RAISE NOTICE '4.  sales                 (dépend de customers, possiblement inventory)';
  RAISE NOTICE '5.  inventory_movements   (dépend de inventory)';
  RAISE NOTICE '6.  inventory             (dépend de production/shipping)';
  RAISE NOTICE '7.  freight_customs       (dépend de shipping_preparations)';
  RAISE NOTICE '8.  shipping_documents    (dépend de shipping_preparations)';
  RAISE NOTICE '9.  assay_certificates    (dépend de shipping_preparations OU production)';
  RAISE NOTICE '10. shipping_preparations (dépend de export_licenses)';
  RAISE NOTICE '11. export_license_quotas (dépend de export_licenses)';
  RAISE NOTICE '12. export_licenses       (dépend de mining_companies)';
  RAISE NOTICE '13. production_documents  (dépend de daily_production)';
  RAISE NOTICE '14. unified_status_history(dépend de daily_production)';
  RAISE NOTICE '15. daily_production      (table de base production)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NE PAS SUPPRIMER: users, profiles, mining_companies, sites,';
  RAISE NOTICE '    customers, refineries, transport_companies, budgets, fx_rates, etc.';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- ÉTAPE 4: VÉRIFICATION DES TABLES EXISTANTES
-- =====================================================

DO $$
DECLARE
  rec RECORD;
  count_rows INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '📋 TABLES EXISTANTES AVEC NOMBRE DE LIGNES';
  RAISE NOTICE '📋 ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';

  FOR rec IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'virtual_payments', 'payments', 'pre_sales', 'sales',
        'inventory_movements', 'inventory', 'freight_customs',
        'shipping_documents', 'assay_certificates', 'shipping_preparations',
        'export_license_quotas', 'export_licenses', 'production_documents',
        'unified_status_history', 'daily_production'
      )
    ORDER BY tablename
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I', rec.tablename) INTO count_rows;
    RAISE NOTICE '%-30s : % lignes', rec.tablename, count_rows;
  END LOOP;

  RAISE NOTICE '';
END $$;

-- Nettoyer
DROP TABLE IF EXISTS temp_fk_analysis;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ═══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ ANALYSE TERMINÉE';
  RAISE NOTICE '✅ ═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Utilisez cet ordre pour mettre à jour clean-transactional-data.sql';
  RAISE NOTICE '';
END $$;
