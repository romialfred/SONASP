-- Correctif ciblé : plafond d'attribution Admin != permissions effectivement accordées.
-- Aucun compte promu, aucun grant métier existant modifié, aucune session/MFA contournée.
-- Compatible avec le schéma publié observé le 30/08/2026 et le durcissement IAM local.
BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.snp_user_permission_allowed(uuid,uuid,text)') IS NULL
     OR to_regprocedure('public.snp_peut_administrer_compte(uuid)') IS NULL
     OR to_regclass('public.snp_role_module_ceilings') IS NULL THEN
    RAISE EXCEPTION 'Socle IAM et plafonds requis avant ce correctif.';
  END IF;
END;
$preflight$;

-- Plafond maximal configurable par l'Owner, PAS une attribution globale aux Admin.
INSERT INTO public.snp_role_module_ceilings(
  role,access_domain,can_view,can_create,can_edit,can_delete,can_approve
)
SELECT 'admin',domain,true,true,true,true,true FROM unnest(ARRAY[
  'users','settings','sites','artisans','production','purchases','sales','payments',
  'shipping','refining','inventory','reconciliation','tax','contracts','customers',
  'documents','reports','audit'
]) domain
ON CONFLICT(role,access_domain) DO UPDATE SET
  can_view=true,can_create=true,can_edit=true,can_delete=true,can_approve=true;

-- Ne remplacer que la branche fautive : préserver les règles des autres profils,
-- y compris les évolutions IAM déjà installées. Arrêter en cas de définition inattendue.
DO $ceiling$
DECLARE
  definition text := pg_get_functiondef('public.snp_user_permission_allowed(uuid,uuid,text)'::regprocedure);
  old_branch text := 'WHEN target.role=''admin'' THEN target.access_domain IN(''users'',''settings'')';
  new_branch text := 'WHEN target.role=''admin'' THEN true /* explicit module grant required by actor resolver */';
BEGIN
  IF strpos(definition,old_branch)>0 THEN
    EXECUTE replace(definition,old_branch,new_branch);
  ELSIF strpos(definition,new_branch)=0 THEN
    RAISE EXCEPTION 'Définition du plafond utilisateur inattendue : revue manuelle requise.';
  END IF;
END;
$ceiling$;

-- Les nouveaux modules ont un défaut conservateur pour Admin. Un plafond élargi
-- ne doit jamais écraser un refus explicite, ni accorder toutes les écritures.
CREATE OR REPLACE FUNCTION public.snp_grant_module_to_platform_accounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  INSERT INTO public.user_permissions(
    user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,
    can_read,can_write,field_permissions,granted_by
  )
  SELECT profile.id,NEW.id,true,
    profile.role='owner' OR NEW.access_domain IN('users','settings'),
    profile.role='owner' OR NEW.access_domain IN('users','settings'),
    profile.role='owner' OR NEW.access_domain IN('users','settings'),
    profile.role='owner',true,
    profile.role='owner' OR NEW.access_domain IN('users','settings'),'{}'::jsonb,profile.id
  FROM public.user_profiles profile
  WHERE profile.is_active AND (profile.role='owner' OR (
    profile.role='admin' AND TG_OP='INSERT' AND profile.mining_company_id IS NULL
    AND public.snp_permission_allowed('admin',NEW.id,'view')
  ))
  ON CONFLICT(user_id,module_id) DO UPDATE SET
    can_view=true,can_create=true,can_edit=true,can_delete=true,can_approve=true,
    can_read=true,can_write=true,updated_at=now()
  WHERE EXISTS(SELECT 1 FROM public.user_profiles owner_profile
    WHERE owner_profile.id=excluded.user_id AND owner_profile.role='owner' AND owner_profile.is_active);
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_grant_modules_to_platform_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  -- Une modification de coordonnées/statut ne doit pas restaurer des droits retirés.
  IF NEW.role='admin' AND TG_OP='UPDATE' AND OLD.role='admin' THEN RETURN NEW; END IF;
  IF NEW.role IN('owner','admin') AND NEW.is_active AND NEW.mining_company_id IS NULL THEN
    INSERT INTO public.user_permissions(
      user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,
      can_read,can_write,field_permissions,granted_by
    )
    SELECT NEW.id,module.id,true,
      NEW.role='owner' OR module.access_domain IN('users','settings'),
      NEW.role='owner' OR module.access_domain IN('users','settings'),
      NEW.role='owner' OR module.access_domain IN('users','settings'),
      NEW.role='owner',true,
      NEW.role='owner' OR module.access_domain IN('users','settings'),'{}'::jsonb,NEW.id
    FROM public.modules module
    WHERE NEW.role='owner' OR public.snp_permission_allowed('admin',module.id,'view')
    ON CONFLICT(user_id,module_id) DO UPDATE SET
      can_view=true,can_create=true,can_edit=true,can_delete=true,can_approve=true,
      can_read=true,can_write=true,updated_at=now()
    WHERE NEW.role='owner';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_grant_module_to_platform_accounts(),
  public.snp_grant_modules_to_platform_account() FROM PUBLIC,anon,authenticated;

-- Les mutations de droits restent exclusivement atomiques, hiérarchisées et auditées.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.user_permissions FROM PUBLIC,anon,authenticated;

COMMIT;
