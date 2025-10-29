-- Script pour assigner la même mining company (site) aux 3 utilisateurs
-- Ce script utilise la table 'sites' car user_site_assignments.site_id référence 'sites'
-- Note: La table 'sites' contient les mining companies/locations

DO $$
DECLARE
  v_site_id uuid;
  v_user_ids uuid[];
  v_user_id uuid;
  v_site_name text;
BEGIN
  -- Trouver le premier site (mining company) actif
  SELECT id, name INTO v_site_id, v_site_name
  FROM sites
  WHERE is_active = true
  ORDER BY name
  LIMIT 1;

  IF v_site_id IS NULL THEN
    RAISE EXCEPTION 'Aucun site actif trouvé dans la table sites';
  END IF;

  RAISE NOTICE 'Site/Mining company sélectionné: % (ID: %)', v_site_name, v_site_id;

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

  -- Assigner le même site à tous les utilisateurs
  FOREACH v_user_id IN ARRAY v_user_ids
  LOOP
    INSERT INTO user_site_assignments (user_id, site_id, assigned_at, assigned_by)
    VALUES (
      v_user_id,
      v_site_id,
      NOW(),
      (SELECT id FROM user_profiles WHERE role = 'management' LIMIT 1)
    )
    ON CONFLICT (user_id, site_id) DO NOTHING;
    
    RAISE NOTICE 'Utilisateur % assigné au site %', v_user_id, v_site_name;
  END LOOP;

  RAISE NOTICE 'Assignations terminées avec succès!';

  -- Afficher le résumé
  RAISE NOTICE '--- RÉSUMÉ ---';
  RAISE NOTICE 'Site/Mining Company: %', v_site_name;
  RAISE NOTICE 'Utilisateurs assignés: %', array_length(v_user_ids, 1);
  
END $$;

-- Vérifier les assignations
SELECT 
  up.full_name,
  up.email,
  up.role,
  s.name as site_name,
  s.location as site_location,
  s.country as site_country
FROM user_profiles up
LEFT JOIN user_site_assignments usa ON usa.user_id = up.id
LEFT JOIN sites s ON s.id = usa.site_id
ORDER BY up.created_at
LIMIT 3;
