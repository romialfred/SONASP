/*
  ⚡ Script Rapide: Créer données pour page Refining
  
  Ce script crée le MINIMUM nécessaire:
  - 1 mining company
  - 3 batches avec statuts refinery
  - 3 entrées d'historique pour le graphique
  
  Exécutez ce script dans Supabase Dashboard → SQL Editor
*/

-- 1️⃣ Créer une mining company
INSERT INTO mining_companies (
  name,
  country,
  status,
  contact_email,
  contact_phone
) VALUES (
  'Test Mining Company',
  'Guinea',
  'active',
  'contact@testmining.com',
  '+224 123 456 789'
) ON CONFLICT DO NOTHING;

RAISE NOTICE '✅ Mining company créée';

-- 2️⃣ Créer 3 batches avec statuts refinery
DO $$
DECLARE
  batch1_id uuid;
  batch2_id uuid;
  batch3_id uuid;
BEGIN
  -- Batch 1: validated_for_refinery
  INSERT INTO batches (
    batch_number,
    status,
    weight_grams,
    weight_ounces,
    metal_type,
    shipping_date,
    comments
  ) VALUES (
    'REF-TEST-001',
    'validated_for_refinery',
    5000.00,
    160.75,
    'gold',
    CURRENT_DATE,
    'Test batch - Validated for refinery'
  ) RETURNING id INTO batch1_id;
  
  RAISE NOTICE '✅ Batch 1: % (validated_for_refinery)', batch1_id;
  
  -- Batch 2: waiting_refinery_receipt
  INSERT INTO batches (
    batch_number,
    status,
    weight_grams,
    weight_ounces,
    metal_type,
    shipping_date,
    comments
  ) VALUES (
    'REF-TEST-002',
    'waiting_refinery_receipt',
    7500.00,
    241.13,
    'gold',
    CURRENT_DATE - INTERVAL '1 day',
    'Test batch - Waiting refinery receipt'
  ) RETURNING id INTO batch2_id;
  
  RAISE NOTICE '✅ Batch 2: % (waiting_refinery_receipt)', batch2_id;
  
  -- Batch 3: received_at_refinery
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
    'REF-TEST-003',
    'received_at_refinery',
    6200.00,
    199.38,
    'gold',
    CURRENT_DATE - INTERVAL '2 days',
    6195.00,
    'Test batch - Received at refinery'
  ) RETURNING id INTO batch3_id;
  
  RAISE NOTICE '✅ Batch 3: % (received_at_refinery)', batch3_id;
  
  -- 3️⃣ Créer entrées d'historique pour graphique mensuel
  RAISE NOTICE '📊 Création historique pour graphique...';
  
  -- Processed il y a 1 mois
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
    'Historical data for monthly chart'
  );
  
  -- Processed il y a 2 mois
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
    'Historical data for monthly chart'
  );
  
  -- Processed il y a 3 mois (avec un autre batch)
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
    'Historical data for monthly chart'
  );
  
  -- Processed il y a 4 mois (plus de données)
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
    CURRENT_TIMESTAMP - INTERVAL '4 months',
    'Historical data for monthly chart'
  );
  
  RAISE NOTICE '✅ Historique créé (4 entrées sur 4 mois)';
  
END $$;

-- ✅ Vérification: Afficher les batches créés
SELECT 
  '📦 BATCHES CRÉÉS' as info,
  batch_number,
  status,
  weight_grams,
  TO_CHAR(shipping_date, 'YYYY-MM-DD') as date
FROM batches
WHERE batch_number LIKE 'REF-TEST-%'
ORDER BY batch_number;

-- ✅ Vérification: Afficher l'historique
SELECT 
  '📅 HISTORIQUE CRÉÉ' as info,
  status,
  TO_CHAR(changed_at, 'YYYY-MM') as mois,
  comments
FROM batch_status_history
WHERE comments LIKE '%Historical%'
ORDER BY changed_at DESC;

-- ✅ Vérification: Compter par statut
SELECT 
  '📊 COMPTAGE PAR STATUT' as info,
  status,
  COUNT(*) as nombre
FROM batches
GROUP BY status
ORDER BY nombre DESC;

/*
  🎉 TERMINÉ!
  
  Maintenant:
  1. Rafraîchir la page /refining dans l'application
  2. Vous devriez voir 3 batches affichés
  3. Si vous marquez tous les batches comme "in_inventory",
     le graphique mensuel s'affichera avec 4 mois de données
  
  Pour tester le graphique:
  
  UPDATE batches 
  SET status = 'in_inventory' 
  WHERE batch_number LIKE 'REF-TEST-%';
  
  Puis rafraîchir la page /refining
*/
