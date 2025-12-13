-- ================================================================
-- ANALYSE DÉTAILLÉE - INCOHÉRENCES TABLE SALES
-- ================================================================
-- Comparaison DDL vs Code Frontend
-- Date: 2025-12-13
-- ================================================================

\echo '========================================'
\echo 'ANALYSE DES INCOHÉRENCES'
\echo '========================================'
\echo ''

-- ================================================================
-- INCOHÉRENCE #1: royalties vs royalty_amount
-- ================================================================
\echo '1. INCOHÉRENCE CRITIQUE: Nom de colonne'
\echo '----------------------------------------'
\echo 'Code utilise: royalty_amount'
\echo 'DB a: royalties'
\echo ''

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'sales' AND column_name = 'royalty_amount'
    ) THEN 'royalty_amount existe'
    ELSE 'royalty_amount MANQUANT (code va echouer!)'
  END as royalty_amount_check,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'sales' AND column_name = 'royalties'
    ) THEN 'royalties existe'
    ELSE 'royalties manquant'
  END as royalties_check;

-- ================================================================
-- INCOHÉRENCE #2: Types des colonnes d'approbation
-- ================================================================
\echo ''
\echo '2. TYPES DE COLONNES - Approbations'
\echo '----------------------------------------'

SELECT
  column_name,
  data_type,
  CASE
    WHEN column_name IN ('management_approved_by', 'management_rejected_by', 'customer_approved_by')
         AND data_type != 'uuid'
    THEN 'INCOHERENCE: devrait etre uuid'
    ELSE 'OK'
  END as status
FROM information_schema.columns
WHERE table_name = 'sales'
  AND (column_name LIKE '%approved_by%'
     OR column_name LIKE '%rejected_by%')
ORDER BY column_name;

-- ================================================================
-- STATISTIQUES ACTUELLES
-- ================================================================
\echo ''
\echo '3. STATISTIQUES VENTES ACTUELLES'
\echo '----------------------------------------'

SELECT
  COUNT(*) as total_sales,
  COUNT(DISTINCT status) as distinct_statuses,
  COUNT(DISTINCT customer_id) as distinct_customers,
  COUNT(DISTINCT seller_id) as distinct_sellers,
  ROUND(SUM(quantity_oz)::numeric, 2) as total_oz_sold,
  ROUND(SUM(total_amount)::numeric, 2) as total_revenue_usd,
  ROUND(SUM(royalties)::numeric, 2) as total_royalties
FROM sales;

\echo ''
\echo 'Distribution par statut:'
SELECT
  status,
  COUNT(*) as count
FROM sales
GROUP BY status
ORDER BY count DESC;

\echo ''
\echo '========================================'
\echo 'RESUME'
\echo '========================================'
