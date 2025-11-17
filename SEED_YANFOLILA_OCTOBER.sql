-- ========================================
-- SEED DATA YANFOLILA - OCTOBRE 2025
-- ========================================
--
-- Ce script cree les donnees de test pour verifier
-- que Production Browser affiche correctement les
-- valeurs actual depuis daily_production
--
-- A EXECUTER dans Supabase Dashboard > SQL Editor
--
-- ========================================

-- 1. Creer compagnie Yanfolila si elle n'existe pas
INSERT INTO mining_companies (name, country, is_active, created_at, updated_at)
VALUES ('Yanfolila', 'Mali', true, now(), now())
ON CONFLICT (name) DO NOTHING
RETURNING id, name;

-- 2. Recuperer l'ID de Yanfolila
DO $$
DECLARE
  yanfolila_id uuid;
BEGIN
  SELECT id INTO yanfolila_id
  FROM mining_companies
  WHERE name = 'Yanfolila';

  RAISE NOTICE 'Yanfolila ID: %', yanfolila_id;

  -- 3. Inserer 2 enregistrements pour octobre 2025
  INSERT INTO daily_production (
    production_date,
    total_weight_oz,
    gold_weight_oz,
    silver_weight_oz,
    mining_company_id,
    site_id,
    status,
    created_at,
    updated_at
  ) VALUES
    -- Record 1: 15 octobre 2025
    (
      '2025-10-15',
      1234.56,
      1200.00,
      34.56,
      yanfolila_id,
      'guinea',
      'prepared',
      now(),
      now()
    ),
    -- Record 2: 20 octobre 2025
    (
      '2025-10-20',
      2345.67,
      2300.00,
      45.67,
      yanfolila_id,
      'guinea',
      'prepared',
      now(),
      now()
    )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '2 enregistrements inseres pour octobre 2025';
END $$;

-- 4. Verification
SELECT
  production_date,
  total_weight_oz,
  gold_weight_oz,
  mining_company_id,
  site_id
FROM daily_production
WHERE mining_company_id = (SELECT id FROM mining_companies WHERE name = 'Yanfolila')
  AND production_date >= '2025-10-01'
  AND production_date <= '2025-10-31'
ORDER BY production_date;

-- 5. Calcul total octobre
SELECT
  'Octobre 2025' as mois,
  COUNT(*) as nombre_enregistrements,
  SUM(total_weight_oz) as total_oz
FROM daily_production
WHERE mining_company_id = (SELECT id FROM mining_companies WHERE name = 'Yanfolila')
  AND production_date >= '2025-10-01'
  AND production_date <= '2025-10-31';

-- ========================================
-- RESULTAT ATTENDU:
-- - Nombre: 2 enregistrements
-- - Total: 3580.23 oz (1234.56 + 2345.67)
--
-- CE TOTAL DOIT APPARAITRE DANS PRODUCTION BROWSER
-- pour Yanfolila, colonne Actual, ligne Octobre
-- ========================================
