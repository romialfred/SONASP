/*
  # Initialiser la numérotation BAR Reference pour HUMSMK
  
  Ce script permet de démarrer la numérotation à HUMSMK-1204 au lieu de HUMSMK-0001
  
  ## Méthode
  Nous insérons des productions "factices" ou mettons à jour des productions existantes
  pour que le système détecte HUMSMK-1203 comme dernière référence.
  Ainsi, la prochaine production générera automatiquement HUMSMK-1204.
*/

-- =====================================================
-- OPTION A: Mise à jour des productions existantes
-- =====================================================
-- Si vous avez des productions Kouroussa avec HUMKGM, les convertir en HUMSMK

DO $$
DECLARE
  v_kouroussa_id uuid;
  v_count int;
BEGIN
  -- Trouver l'ID de Kouroussa
  SELECT id INTO v_kouroussa_id 
  FROM mining_companies 
  WHERE name ILIKE '%kouroussa%' 
  LIMIT 1;
  
  IF v_kouroussa_id IS NULL THEN
    RAISE NOTICE '⚠️  Kouroussa mining company not found!';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Kouroussa ID: %', v_kouroussa_id;
  
  -- Compter les productions existantes avec HUMKGM
  SELECT COUNT(*) INTO v_count
  FROM daily_production
  WHERE mining_company_id = v_kouroussa_id
  AND bar_reference LIKE 'HUMKGM-%';
  
  RAISE NOTICE 'Productions avec HUMKGM trouvées: %', v_count;
  
  -- Mettre à jour HUMKGM -> HUMSMK pour Kouroussa
  IF v_count > 0 THEN
    UPDATE daily_production
    SET bar_reference = REPLACE(bar_reference, 'HUMKGM-', 'HUMSMK-')
    WHERE mining_company_id = v_kouroussa_id
    AND bar_reference LIKE 'HUMKGM-%';
    
    RAISE NOTICE '✅ % productions mises à jour: HUMKGM -> HUMSMK', v_count;
  END IF;
  
  -- Vérifier la plus haute référence actuelle
  SELECT MAX(bar_reference) INTO v_count
  FROM daily_production
  WHERE bar_reference LIKE 'HUMSMK-%';
  
  RAISE NOTICE 'Plus haute référence HUMSMK actuelle: %', v_count;
  
END $$;

-- =====================================================
-- OPTION B: Créer une production "placeholder" à 1203
-- =====================================================
-- Uniquement si vous n'avez PAS de production existante avec HUMSMK
-- Ceci forcera la prochaine production à être HUMSMK-1204

DO $$
DECLARE
  v_kouroussa_id uuid;
  v_max_ref text;
  v_current_num int;
BEGIN
  -- Trouver l'ID de Kouroussa
  SELECT id INTO v_kouroussa_id 
  FROM mining_companies 
  WHERE name ILIKE '%kouroussa%' 
  LIMIT 1;
  
  IF v_kouroussa_id IS NULL THEN
    RAISE NOTICE '⚠️  Kouroussa mining company not found!';
    RETURN;
  END IF;
  
  -- Vérifier la référence maximale actuelle pour HUMSMK
  SELECT bar_reference INTO v_max_ref
  FROM daily_production
  WHERE bar_reference LIKE 'HUMSMK-%'
  ORDER BY bar_reference DESC
  LIMIT 1;
  
  IF v_max_ref IS NOT NULL THEN
    -- Extraire le numéro actuel
    v_current_num := SUBSTRING(v_max_ref FROM 'HUMSMK-(\d+)')::int;
    RAISE NOTICE 'Référence HUMSMK maximale trouvée: % (numéro: %)', v_max_ref, v_current_num;
    
    IF v_current_num >= 1203 THEN
      RAISE NOTICE '✅ La numérotation est déjà à % ou plus. Aucune action nécessaire.', v_current_num;
      RETURN;
    END IF;
  END IF;
  
  -- Insérer une production "placeholder" avec HUMSMK-1203
  -- ATTENTION: Ajustez les valeurs selon vos besoins
  RAISE NOTICE '📝 Création d''une production placeholder HUMSMK-1203...';
  
  INSERT INTO daily_production (
    production_date,
    mining_company_id,
    bar_reference,
    bullion_grams,
    estimated_gold_pct,
    estimated_fineness_pct,
    pure_gold_grams,
    estimated_oz,
    notes,
    status
  ) VALUES (
    '2025-10-26'::date,  -- Un jour avant votre première vraie production
    v_kouroussa_id,
    'HUMSMK-1203',       -- Référence de base
    1000.00,             -- Valeur fictive (ajustez selon besoin)
    92.00,               -- Finesse fictive
    92.00,
    920.00,              -- Or pur calculé
    29.57,               -- Oz calculé
    'Production placeholder pour initialiser la numérotation à 1204',
    'prepared'           -- Statut initial
  );
  
  RAISE NOTICE '✅ Production placeholder HUMSMK-1203 créée!';
  RAISE NOTICE '🎯 La prochaine production Kouroussa sera automatiquement HUMSMK-1204';
  
END $$;

-- =====================================================
-- VÉRIFICATION FINALE
-- =====================================================

DO $$
DECLARE
  v_max_ref text;
  v_count int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'VÉRIFICATION FINALE';
  RAISE NOTICE '==============================================';
  
  -- Compter toutes les références HUMSMK
  SELECT COUNT(*) INTO v_count
  FROM daily_production
  WHERE bar_reference LIKE 'HUMSMK-%';
  
  RAISE NOTICE 'Total productions HUMSMK: %', v_count;
  
  -- Afficher la plus haute référence
  SELECT bar_reference INTO v_max_ref
  FROM daily_production
  WHERE bar_reference LIKE 'HUMSMK-%'
  ORDER BY bar_reference DESC
  LIMIT 1;
  
  IF v_max_ref IS NOT NULL THEN
    RAISE NOTICE 'Plus haute référence HUMSMK: %', v_max_ref;
    RAISE NOTICE '';
    RAISE NOTICE '🎯 La prochaine production générera: HUMSMK-%', 
                 (SUBSTRING(v_max_ref FROM 'HUMSMK-(\d+)')::int + 1)::text;
  ELSE
    RAISE NOTICE '⚠️  Aucune production HUMSMK trouvée';
    RAISE NOTICE '🎯 La prochaine production générera: HUMSMK-0001';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  
END $$;

-- =====================================================
-- LISTE DES RÉFÉRENCES HUMSMK
-- =====================================================

SELECT 
  production_date,
  bar_reference,
  bullion_grams,
  estimated_oz,
  status,
  notes
FROM daily_production
WHERE bar_reference LIKE 'HUMSMK-%'
ORDER BY bar_reference;
