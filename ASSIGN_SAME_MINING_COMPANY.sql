-- Script pour assigner la même mining company aux 3 utilisateurs
-- Ce script va:
-- 1. Trouver la première mining company active
-- 2. Assigner cette company aux 3 premiers utilisateurs

DO $$
DECLARE
  v_mining_company_id uuid;
  v_user_ids uuid[];
  v_user_id uuid;
BEGIN
  -- Trouver la première mining company active
  SELECT id INTO v_mining_company_id
  FROM mining_companies
  WHERE is_active = true
  ORDER BY name
  LIMIT 1;

  IF v_mining_company_id IS NULL THEN
    RAISE EXCEPTION 'Aucune mining company active trouvée';
  END IF;

  RAISE NOTICE 'Mining company sélectionnée: %', v_mining_company_id;

  -- Récupérer les 3 premiers utilisateurs
  SELECT ARRAY_AGG(id) INTO v_user_ids
  FROM (
    SELECT id
    FROM user_profiles
    ORDER BY created_at
    LIMIT 3
  ) AS users;

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Aucun utilisateur trouvé';
  END IF;

  RAISE NOTICE 'Nombre d''utilisateurs à assigner: %', array_length(v_user_ids, 1);

  -- Supprimer les anciennes assignations pour ces utilisateurs
  DELETE FROM user_site_assignments
  WHERE user_id = ANY(v_user_ids);

  RAISE NOTICE 'Anciennes assignations supprimées';

  -- Assigner la même mining company à tous les utilisateurs
  FOREACH v_user_id IN ARRAY v_user_ids
  LOOP
    INSERT INTO user_site_assignments (user_id, site_id, assigned_at, assigned_by)
    VALUES (
      v_user_id,
      v_mining_company_id,
      NOW(),
      (SELECT id FROM user_profiles WHERE role = 'management' LIMIT 1)
    );
    
    RAISE NOTICE 'Utilisateur % assigné à la mining company %', v_user_id, v_mining_company_id;
  END LOOP;

  RAISE NOTICE 'Assignations terminées avec succès!';

  -- Afficher le résumé
  RAISE NOTICE '--- RÉSUMÉ ---';
  RAISE NOTICE 'Mining Company: %', (SELECT name FROM mining_companies WHERE id = v_mining_company_id);
  RAISE NOTICE 'Utilisateurs assignés: %', array_length(v_user_ids, 1);
  
END $$;

-- Vérifier les assignations
SELECT 
  up.full_name,
  up.email,
  up.role,
  mc.name as mining_company,
  mc.code as company_code
FROM user_profiles up
LEFT JOIN user_site_assignments usa ON usa.user_id = up.id
LEFT JOIN mining_companies mc ON mc.id = usa.site_id
ORDER BY up.created_at
LIMIT 3;
