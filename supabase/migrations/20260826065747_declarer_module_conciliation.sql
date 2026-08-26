-- Declare la conciliation au referentiel des modules, faute de quoi elle
-- n'apparait pas dans l'ecran d'activation et reste invisible a l'administration.

WITH parent AS (
  INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu, permissions_requises)
  VALUES (
    'conciliation', 'Conciliation',
    'Rapprochement des valeurs declarees a l''expedition et de celles reconnues par l''acheteur, avec leurs consequences commerciales et fiscales.',
    'Scale', NULL, NULL, 9, true, true, ARRAY['reconciliation.read']
  )
  ON CONFLICT (code) DO UPDATE SET
    nom = EXCLUDED.nom,
    description = EXCLUDED.description,
    icone = EXCLUDED.icone,
    est_actif = true,
    est_visible_menu = true,
    updated_at = now()
  RETURNING id
)
INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu, permissions_requises)
SELECT
  'conciliation-regles-fiscales', 'Règles fiscales',
  'Taux, assiettes et baremes appliques aux ventes, versionnes par date d''effet. Aucun taux n''est ecrit dans le code.',
  'Scale', '/conciliation/regles-fiscales', parent.id, 1, true, true, ARRAY['tax.rules.read']
FROM parent
ON CONFLICT (code) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description,
  route = EXCLUDED.route,
  est_actif = true,
  est_visible_menu = true,
  updated_at = now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.snp_modules WHERE code = 'conciliation' AND est_actif) THEN
    RAISE EXCEPTION 'Postflight : le module de conciliation est absent ou inactif.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_modules
    WHERE code = 'conciliation-regles-fiscales' AND route = '/conciliation/regles-fiscales'
  ) THEN
    RAISE EXCEPTION 'Postflight : le sous-module des regles fiscales est absent.';
  END IF;
END;
$$;
