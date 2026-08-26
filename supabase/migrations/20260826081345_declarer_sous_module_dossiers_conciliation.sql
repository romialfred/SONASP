-- Le module parent portait deja la route des dossiers ; le sous-module la rend
-- visible en propre dans le menu, a cote des regles fiscales.

INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu, permissions_requises)
SELECT
  'conciliation-dossiers', 'Dossiers de conciliation',
  'File de travail des ventes a concilier, saisie du resultat acheteur et validation des valeurs definitives.',
  'Scale', '/conciliation', p.id, 0, true, true, ARRAY['reconciliation.read']
FROM public.snp_modules p
WHERE p.code = 'conciliation'
ON CONFLICT (code) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description,
  route = EXCLUDED.route,
  est_actif = true,
  est_visible_menu = true,
  updated_at = now();

UPDATE public.snp_modules SET route = '/conciliation' WHERE code = 'conciliation';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_modules
    WHERE code = 'conciliation-dossiers' AND route = '/conciliation' AND est_actif
  ) THEN
    RAISE EXCEPTION 'Postflight : le sous-module des dossiers est absent.';
  END IF;
END;
$$;
