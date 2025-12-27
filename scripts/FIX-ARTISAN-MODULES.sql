/*
  # Correction du Module Artisan Minier

  1. Corrections apportées
    - Correction de la route du tableau de bord artisan (devrait pointer vers /artisan-minier)
    - Changement du nom "Tableau de Bord" en "Gestion des Artisans"
    - Ajout du sous-module "Ventes d'Or" pour les artisans miniers

  2. Sécurité
    - Utilise DO $$ blocks pour éviter les erreurs
    - Vérifie l'existence avant création
*/

-- ============================================================================
-- 1. Correction de la route du sous-module dashboard artisan
-- ============================================================================

UPDATE snp_modules
SET
  nom = 'Gestion des Artisans',
  description = 'Vue d''ensemble et gestion des artisans',
  route = '/artisan-minier'
WHERE code = 'artisan-dashboard';

-- ============================================================================
-- 2. Ajout du module "Ventes d'Or des Artisans" si n'existe pas
-- ============================================================================

DO $$
DECLARE
  artisan_parent_id uuid;
BEGIN
  -- Récupérer l'ID du module parent artisan-minier
  SELECT id INTO artisan_parent_id FROM snp_modules WHERE code = 'artisan-minier';

  -- Insérer le sous-module des ventes d'or si non existant
  IF NOT EXISTS (SELECT 1 FROM snp_modules WHERE code = 'artisan-ventes-or') THEN
    INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    VALUES (
      'artisan-ventes-or',
      'Ventes d''Or',
      'Collecte et ventes d''or des artisans',
      'Coins',
      '/artisan-minier/ventes-or',
      artisan_parent_id,
      6,
      true,
      true
    );

    RAISE NOTICE 'Module "Ventes d''Or" créé avec succès';
  ELSE
    RAISE NOTICE 'Module "Ventes d''Or" existe déjà';
  END IF;
END $$;

-- ============================================================================
-- 3. Vérification des modules artisan-minier
-- ============================================================================

-- Afficher tous les modules artisan avec leur hiérarchie
SELECT
  m.code,
  m.nom,
  m.route,
  m.ordre,
  m.est_actif,
  m.est_visible_menu
FROM snp_modules m
WHERE m.code LIKE 'artisan-%'
  OR m.parent_id = (SELECT id FROM snp_modules WHERE code = 'artisan-minier')
ORDER BY m.ordre;
