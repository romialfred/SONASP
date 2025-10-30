-- Script pour vérifier l'état des ventes et préparer un test d'approbation client

-- 1. Ventes en attente d'approbation client
SELECT
  '=== VENTES EN ATTENTE D''APPROBATION CLIENT ===' as section;

SELECT
  s.id,
  s.sale_number,
  s.status,
  s.mechanism_type,
  s.quantity_oz,
  s.price_per_oz,
  s.final_proceeds,
  c.name as customer_name,
  c.email as customer_email,
  s.created_at
FROM sales s
LEFT JOIN customers c ON s.customer_id = c.id
WHERE s.status IN ('approved', 'customer_pending')
ORDER BY s.created_at DESC
LIMIT 5;

-- 2. Si aucune vente trouvée, vérifier tous les statuts possibles
SELECT
  '=== TOUTES LES VENTES (TOUS STATUTS) ===' as section;

SELECT
  s.sale_number,
  s.status,
  c.name as customer_name,
  c.email as customer_email,
  s.created_at
FROM sales s
LEFT JOIN customers c ON s.customer_id = c.id
ORDER BY s.created_at DESC
LIMIT 10;

-- 3. Vérifier les paiements existants
SELECT
  '=== PAIEMENTS EXISTANTS ===' as section;

SELECT
  p.id,
  p.reference_number,
  p.sale_id,
  COALESCE(p.is_virtual, false) as is_virtual,
  p.payment_type,
  p.status,
  p.amount,
  s.sale_number,
  p.created_at
FROM payments p
LEFT JOIN sales s ON p.sale_id = s.id
ORDER BY p.created_at DESC
LIMIT 10;

-- 4. Créer une vente de test SI NÉCESSAIRE (décommenter si besoin)
/*
DO $$
DECLARE
  v_customer_id UUID;
  v_sale_id UUID;
  v_sale_number TEXT;
BEGIN
  -- Trouver un client (Auramet ou StoneX)
  SELECT id INTO v_customer_id
  FROM customers
  WHERE name ILIKE '%auramet%' OR name ILIKE '%stonex%'
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE NOTICE 'No customer found. Please create a customer first.';
    RETURN;
  END IF;

  -- Générer numéro de vente
  v_sale_number := 'SL-' || TO_CHAR(NOW(), 'YYYY') || '-TEST-' || LPAD((RANDOM() * 999)::TEXT, 3, '0');

  -- Créer une vente de test
  INSERT INTO sales (
    sale_number,
    customer_id,
    sale_date,
    quantity_oz,
    price_per_oz,
    subtotal,
    freight_cost,
    gross_proceeds,
    net_royalty_rate,
    net_royalty_amount,
    final_proceeds,
    status,
    mechanism_type,
    notes,
    created_at
  ) VALUES (
    v_sale_number,
    v_customer_id,
    CURRENT_DATE,
    100.000,
    2500.00,
    250000.00,
    1000.00,
    249000.00,
    3.0,
    7470.00,
    241530.00,
    'approved',  -- Prêt pour approbation client
    'spot',
    'Test sale for customer approval workflow',
    NOW()
  )
  RETURNING id INTO v_sale_id;

  RAISE NOTICE 'Test sale created!';
  RAISE NOTICE '  Sale ID: %', v_sale_id;
  RAISE NOTICE '  Sale Number: %', v_sale_number;
  RAISE NOTICE '  Status: approved (ready for customer approval)';
  RAISE NOTICE '';
  RAISE NOTICE 'Approval URL: /sales/approve/%/%', v_sale_id, 'TOKEN_WOULD_BE_GENERATED';

END $$;
*/

-- 5. Instructions pour générer le lien d'approbation
SELECT
  '=== COMMENT TESTER L''APPROBATION CLIENT ===' as section;

SELECT
  'Instructions:' as step,
  '1. Vérifier qu''il existe une vente avec status=approved ci-dessus' as instruction
UNION ALL
SELECT
  '2. Copier le Sale ID' as step,
  '' as instruction
UNION ALL
SELECT
  '3. Accéder à l''URL:' as step,
  '/sales/approve/{SALE_ID}/{TOKEN}' as instruction
UNION ALL
SELECT
  '4. Cliquer "Approve Sale"' as step,
  '' as instruction
UNION ALL
SELECT
  '5. Vérifier dans Console (F12)' as step,
  'Chercher logs [customerApproveSale]' as instruction
UNION ALL
SELECT
  '6. Vérifier le résultat' as step,
  'Status devrait changer à waiting_for_payment ou customer_approved' as instruction;
