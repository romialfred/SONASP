/*
  DIAGNOSTIC: Pourquoi la page Refinery est vide?

  EXÉCUTEZ CE SCRIPT DANS SUPABASE DASHBOARD SQL EDITOR
*/

-- 1. MINING COMPANIES
SELECT '=== MINING COMPANIES ===' as info;
SELECT name, country, status FROM mining_companies;

-- 2. TOUS LES BATCHES
SELECT '=== TOUS LES BATCHES ===' as info;
SELECT 
  batch_number,
  status,
  weight_grams,
  metal_type,
  shipping_date
FROM batches
ORDER BY created_at DESC;

-- 3. COMPTAGE PAR STATUT
SELECT '=== COMPTAGE PAR STATUT ===' as info;
SELECT status, COUNT(*) as nombre
FROM batches
GROUP BY status;

-- 4. STATUTS EXACTS (avec guillemets pour voir espaces)
SELECT '=== STATUTS EXACTS ===' as info;
SELECT DISTINCT '"' || status || '"' as statut_avec_guillemets
FROM batches;

-- 5. BATCHES QUI DEVRAIENT ÊTRE VISIBLES SUR /refining
SELECT '=== VISIBILITÉ PAGE REFINERY ===' as info;
SELECT 
  batch_number,
  status,
  CASE
    WHEN status IN (
      'validated_for_refinery',
      'waiting_refinery_receipt',
      'received_at_refinery',
      'validated_for_processing',
      'processing',
      'processed'
    ) THEN 'VISIBLE'
    ELSE 'NON VISIBLE'
  END as visible_sur_refining
FROM batches
ORDER BY visible_sur_refining;

-- 6. SI AUCUN BATCH VISIBLE, SCRIPT POUR CORRIGER
-- Décommentez et modifiez selon vos besoins:
-- UPDATE batches SET status = 'processing' WHERE batch_number = 'VOTRE-BATCH-XXX';
