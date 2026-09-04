-- Restaure la gouvernance des sites artisanaux.
--
-- Contexte : la migration 20260823180000_capacites_et_separation_fonctions.sql a
-- redefini par erreur public.snp_peut_gerer_sites_artisanaux() avec le corps d'un
-- garde collecteur/comptoir (« collectors.manage OR comptoir.manage »). Depuis le
-- 23/08/2026, aucun agent SONASP (owner/admin/management) ne pouvait donc lire ni
-- ecrire les sites artisanaux : ecriture refusee (42501) et lecture vide, alors que
-- la table contient des donnees. Les sites artisanaux sont un referentiel national
-- gere par la SONASP, et non un perimetre collecteur/comptoir.
--
-- Correctif : retablir la logique documentee d'origine (20260817_002 puis
-- 20260823130000_installer_sites_artisanaux.sql) : responsables SONASP actifs, hors
-- perimetre societe miniere, apres validation AAL2. Migration additive et rejouable
-- (CREATE OR REPLACE). Aucune policy ni aucune migration historique n'est modifiee.

CREATE OR REPLACE FUNCTION public.snp_peut_gerer_sites_artisanaux()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND is_active
      AND mining_company_id IS NULL
      AND role IN ('owner', 'admin', 'management')
  );
$fn$;

COMMENT ON FUNCTION public.snp_peut_gerer_sites_artisanaux() IS
  'Reserve la gestion des sites artisanaux aux responsables SONASP actifs (owner/admin/management, hors societe miniere) apres validation AAL2.';

-- Les droits d'execution restent inchanges (deja accordes a authenticated et
-- inscrits dans l'allowlist rls-policy-helper). On les reaffirme par idempotence.
REVOKE ALL ON FUNCTION public.snp_peut_gerer_sites_artisanaux() FROM public;
GRANT EXECUTE ON FUNCTION public.snp_peut_gerer_sites_artisanaux() TO authenticated;

-- Postflight : refuser la migration si le corps corrompu subsiste.
DO $postflight$
DECLARE
  v_body text;
BEGIN
  SELECT prosrc INTO v_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'snp_peut_gerer_sites_artisanaux';

  IF v_body IS NULL THEN
    RAISE EXCEPTION 'snp_peut_gerer_sites_artisanaux introuvable apres restauration.';
  END IF;

  IF position('collectors.manage' IN v_body) > 0
     OR position('comptoir.manage' IN v_body) > 0 THEN
    RAISE EXCEPTION 'La gouvernance des sites artisanaux reference encore un garde collecteur/comptoir.';
  END IF;

  IF position('snp_mfa_satisfaite' IN v_body) = 0
     OR position('management' IN v_body) = 0 THEN
    RAISE EXCEPTION 'La restauration de la gouvernance des sites artisanaux est incomplete.';
  END IF;
END;
$postflight$;
