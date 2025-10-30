/*
  Script pour créer des batches de test pour la page Refining
  
  Ce script crée:
  - 3 batches avec différents statuts refinery
  - Quelques entrées d'historique pour le graphique mensuel
*/

-- Insérer 3 batches de test avec statuts refinery
DO $$
DECLARE
  batch1_id uuid;
  batch2_id uuid;
  batch3_id uuid;
  test_user_id uuid;
BEGIN
  -- Créer un batch validated_for_refinery
  INSERT INTO batches (
    batch_number,
    status,
    weight_grams,
    weight_ounces,
    metal_type,
    shipping_date,
    comments
  ) VALUES (
    'BATCH-TEST-001',
    'validated_for_refinery',
    5000.00,
    160.75,
    'gold',
    CURRENT_DATE,
    'Test batch for refinery dashboard'
  ) RETURNING id INTO batch1_id;
  
  RAISE NOTICE 'Batch 1 created: % (validated_for_refinery)', batch1_id;
  
  -- Créer un batch waiting_refinery_receipt
  INSERT INTO batches (
    batch_number,
    status,
    weight_grams,
    weight_ounces,
    metal_type,
    shipping_date,
    comments
  ) VALUES (
    'BATCH-TEST-002',
    'waiting_refinery_receipt',
    7500.00,
    241.13,
    'gold',
    CURRENT_DATE - INTERVAL '1 day',
    'Test batch awaiting refinery receipt'
  ) RETURNING id INTO batch2_id;
  
  RAISE NOTICE 'Batch 2 created: % (waiting_refinery_receipt)', batch2_id;
  
  -- Créer un batch received_at_refinery
  INSERT INTO batches (
    batch_number,
    status,
    weight_grams,
    weight_ounces,
    metal_type,
    shipping_date,
    refinery_received_weight_grams,
    comments
  ) VALUES (
    'BATCH-TEST-003',
    'received_at_refinery',
    6200.00,
    199.38,
    'gold',
    CURRENT_DATE - INTERVAL '2 days',
    6190.00,
    'Test batch received at refinery'
  ) RETURNING id INTO batch3_id;
  
  RAISE NOTICE 'Batch 3 created: % (received_at_refinery)', batch3_id;
  
  -- Créer quelques entrées d'historique pour le graphique
  -- Batch processed il y a 1 mois
  INSERT INTO batch_status_history (
    batch_id,
    status,
    previous_status,
    changed_at,
    comments
  ) VALUES (
    batch1_id,
    'processed',
    'processing',
    CURRENT_TIMESTAMP - INTERVAL '1 month',
    'Historical processed batch for chart'
  );
  
  -- Batch processed il y a 2 mois
  INSERT INTO batch_status_history (
    batch_id,
    status,
    previous_status,
    changed_at,
    comments
  ) VALUES (
    batch2_id,
    'processed',
    'processing',
    CURRENT_TIMESTAMP - INTERVAL '2 months',
    'Historical processed batch for chart'
  );
  
  -- Batch processed il y a 3 mois
  INSERT INTO batch_status_history (
    batch_id,
    status,
    previous_status,
    changed_at,
    comments
  ) VALUES (
    batch3_id,
    'processed',
    'processing',
    CURRENT_TIMESTAMP - INTERVAL '3 months',
    'Historical processed batch for chart'
  );
  
  RAISE NOTICE 'History records created for monthly chart';
  
END $$;

-- Vérifier les batches créés
SELECT 
  batch_number,
  status,
  weight_grams,
  shipping_date,
  comments
FROM batches
WHERE batch_number LIKE 'BATCH-TEST-%'
ORDER BY batch_number;

-- Vérifier l'historique
SELECT 
  status,
  changed_at::date as changed_date,
  comments
FROM batch_status_history
WHERE comments LIKE '%Historical%'
ORDER BY changed_at DESC;
