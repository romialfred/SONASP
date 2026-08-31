-- Accès de continuité Owner indépendant des bascules globales du catalogue.
-- Les autres rôles restent soumis à l'activation, aux droits et à la MFA.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.snp_account_admin_audit') IS NULL
     OR to_regprocedure('public.snp_update_module_catalog(uuid,text,text,text,integer,boolean,boolean)') IS NULL
     OR to_regprocedure('public.snp_actor_can_module_action(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Préflight Owner/modules : socle IAM incomplet.';
  END IF;
END;
$preflight$;

-- Les deux actions sont déjà produites par les RPC canoniques, mais la
-- contrainte historique les rejetait et annulait toute la transaction.
ALTER TABLE public.snp_account_admin_audit
  DROP CONSTRAINT IF EXISTS snp_account_admin_audit_action_check;
ALTER TABLE public.snp_account_admin_audit
  ADD CONSTRAINT snp_account_admin_audit_action_check CHECK (action IN (
    'profile_update', 'role_change', 'permissions_replace',
    'approver_grant', 'approver_revoke',
    'access_configuration', 'module_catalog_update'
  ));

CREATE OR REPLACE FUNCTION public.snp_permission_allowed(p_role text,p_module_id uuid,p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT coalesce((
    SELECT CASE
      WHEN lower(coalesce(p_action,'')) NOT IN ('view','create','edit','delete','approve') THEN false
      WHEN p_role='owner' THEN true
      WHEN NOT coalesce(module.is_active,true) THEN false
      ELSE coalesce(CASE lower(p_action)
        WHEN 'view' THEN ceiling.can_view WHEN 'create' THEN ceiling.can_create
        WHEN 'edit' THEN ceiling.can_edit WHEN 'delete' THEN ceiling.can_delete
        WHEN 'approve' THEN ceiling.can_approve ELSE false END,false)
      END
    FROM public.modules module
    LEFT JOIN public.snp_role_module_ceilings ceiling
      ON ceiling.role=p_role AND ceiling.access_domain=module.access_domain
    WHERE module.id=p_module_id
  ),false);
$fn$;

-- L'API de catalogue conserve ses contrôles inter-comptes et expose également
-- les modules masqués/désactivés lorsqu'elle décrit un Owner actif.
CREATE OR REPLACE FUNCTION public.get_user_modules(user_id uuid)
RETURNS TABLE(
  id uuid,code text,nom text,description text,icone text,route text,
  parent_id uuid,parent_nom text,ordre integer
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN
    IF auth.uid() IS NULL OR user_id IS NULL THEN
      RAISE EXCEPTION 'Authentification requise.' USING ERRCODE='42501';
    END IF;
    IF user_id<>auth.uid() THEN
      IF NOT public.snp_sec_aal2() OR NOT public.snp_actor_has_capability('accounts.manage') THEN
        RAISE EXCEPTION 'Consultation inter-compte interdite.' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  RETURN QUERY
  SELECT module.id,module.code,module.nom,module.description,module.icone,module.route,
    module.parent_id,parent.nom,module.ordre
  FROM public.snp_modules module
  LEFT JOIN public.snp_modules parent ON parent.id=module.parent_id
  WHERE (module.est_actif AND module.est_visible_menu) OR EXISTS(
    SELECT 1 FROM public.user_profiles profile
    WHERE profile.id=user_id AND profile.role='owner' AND profile.is_active
  )
  ORDER BY coalesce(parent.ordre,module.ordre),module.ordre;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_user_permission_allowed(p_user_id uuid,p_module_id uuid,p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  WITH target AS (
    SELECT profile.role,module.access_domain
    FROM public.user_profiles profile CROSS JOIN public.modules module
    WHERE profile.id=p_user_id AND profile.is_active AND module.id=p_module_id
  ), selected AS (
    SELECT responsibility_code FROM public.snp_user_responsibilities WHERE user_id=p_user_id
  )
  SELECT coalesce((SELECT CASE
    WHEN NOT public.snp_permission_allowed(target.role,p_module_id,p_action) THEN false
    WHEN target.role='owner' THEN true
    WHEN lower(p_action)='view' THEN true
    WHEN target.role='admin' THEN target.access_domain IN('users','settings')
    WHEN target.role='management' AND lower(p_action) IN('create','edit') THEN CASE
      WHEN target.access_domain='payments' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.finance.execute')
      WHEN target.access_domain='reconciliation' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='reconciliation.manage')
      ELSE EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.prepare') END
    WHEN target.role='management' AND lower(p_action)='approve' THEN CASE
      WHEN target.access_domain IN('payments','reconciliation') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.finance.reconcile')
      ELSE EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.approve') END
    WHEN target.role='dgmg' AND lower(p_action) IN('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgmg.supervise')
    WHEN target.role='dgmg' AND lower(p_action)='approve' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgmg.production.validate')
    WHEN target.role='dgi' AND lower(p_action)='edit' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgi.fiscal.control')
    WHEN target.role='dgi' AND lower(p_action)='approve' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgi.fiscal.reconcile')
    WHEN target.role='mine' AND lower(p_action) IN('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='mine.production.manage')
    WHEN target.role='comptoir' AND lower(p_action) IN('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='comptoir.manage')
    WHEN target.role='collector' AND lower(p_action) IN('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='collector.operate')
    ELSE false END FROM target),false);
$fn$;

CREATE OR REPLACE FUNCTION public.snp_actor_can_module_action(p_module_code text,p_action text)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  WITH actor AS (
    SELECT id,role FROM public.user_profiles WHERE id=auth.uid() AND is_active
  ), target AS (
    SELECT id,is_active FROM public.modules WHERE name=p_module_code
  ), permission AS (
    SELECT grants.* FROM public.user_permissions grants
    JOIN target ON target.id=grants.module_id
    WHERE grants.user_id=auth.uid()
  )
  SELECT CASE
    WHEN lower(coalesce(p_action,'')) NOT IN ('view','create','edit','delete','approve') THEN false
    WHEN NOT EXISTS(SELECT 1 FROM target) THEN false
    WHEN coalesce(auth.role(),'')='service_role' THEN true
    WHEN NOT public.snp_session_est_active() OR NOT EXISTS(SELECT 1 FROM actor) THEN false
    WHEN lower(p_action)<>'view' AND NOT public.snp_mfa_satisfaite() THEN false
    WHEN (SELECT role FROM actor)='owner' THEN true
    WHEN NOT coalesce((SELECT is_active FROM target),true) THEN false
    ELSE EXISTS(
      SELECT 1 FROM permission,target
      WHERE CASE lower(p_action)
        WHEN 'view' THEN permission.can_view WHEN 'create' THEN permission.can_create
        WHEN 'edit' THEN permission.can_edit WHEN 'delete' THEN permission.can_delete
        WHEN 'approve' THEN permission.can_approve ELSE false END
        AND public.snp_user_permission_allowed(auth.uid(),target.id,p_action)
    ) END;
$fn$;

-- L'attribution future et sa projection restent complètes pour chaque Owner,
-- y compris pour un module créé désactivé. Les attributions Admin sont inchangées.
CREATE OR REPLACE FUNCTION public.snp_grant_module_to_platform_accounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  INSERT INTO public.user_permissions(
    user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,
    can_read,can_write,field_permissions,granted_by
  )
  SELECT profile.id,NEW.id,true,
    profile.role='owner' OR ceiling.can_create,
    profile.role='owner' OR ceiling.can_edit,
    profile.role='owner' OR ceiling.can_delete,
    profile.role='owner' OR ceiling.can_approve,
    true,profile.role='owner' OR ceiling.can_edit,'{}'::jsonb,profile.id
  FROM public.user_profiles profile
  LEFT JOIN public.snp_role_module_ceilings ceiling
    ON ceiling.role=profile.role AND ceiling.access_domain=NEW.access_domain
  WHERE profile.is_active AND (
    profile.role='owner' OR (
      profile.role='admin' AND coalesce(NEW.is_active,true) AND ceiling.can_view
    )
  )
  ON CONFLICT(user_id,module_id) DO UPDATE SET
    can_view=EXCLUDED.can_view,can_create=EXCLUDED.can_create,can_edit=EXCLUDED.can_edit,
    can_delete=EXCLUDED.can_delete,can_approve=EXCLUDED.can_approve,
    can_read=EXCLUDED.can_read,can_write=EXCLUDED.can_write,updated_at=now();
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_grant_modules_to_platform_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF NEW.role IN ('owner','admin') AND NEW.is_active THEN
    INSERT INTO public.user_permissions(
      user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,
      can_read,can_write,field_permissions,granted_by
    )
    SELECT NEW.id,module.id,true,
      NEW.role='owner' OR ceiling.can_create,NEW.role='owner' OR ceiling.can_edit,
      NEW.role='owner' OR ceiling.can_delete,NEW.role='owner' OR ceiling.can_approve,
      true,NEW.role='owner' OR ceiling.can_edit,'{}'::jsonb,NEW.id
    FROM public.modules module
    LEFT JOIN public.snp_role_module_ceilings ceiling
      ON ceiling.role=NEW.role AND ceiling.access_domain=module.access_domain
    WHERE NEW.role='owner' OR (coalesce(module.is_active,true) AND ceiling.can_view)
    ON CONFLICT(user_id,module_id) DO UPDATE SET
      can_view=EXCLUDED.can_view,can_create=EXCLUDED.can_create,can_edit=EXCLUDED.can_edit,
      can_delete=EXCLUDED.can_delete,can_approve=EXCLUDED.can_approve,
      can_read=EXCLUDED.can_read,can_write=EXCLUDED.can_write,updated_at=now();
  END IF;
  RETURN NEW;
END;
$fn$;

INSERT INTO public.user_permissions(
  user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,
  can_read,can_write,field_permissions,granted_by
)
SELECT profile.id,module.id,true,true,true,true,true,true,true,'{}'::jsonb,profile.id
FROM public.user_profiles profile CROSS JOIN public.modules module
WHERE profile.role='owner' AND profile.is_active
ON CONFLICT(user_id,module_id) DO UPDATE SET
  can_view=true,can_create=true,can_edit=true,can_delete=true,can_approve=true,
  can_read=true,can_write=true,field_permissions='{}'::jsonb,updated_at=now();

REVOKE ALL ON FUNCTION public.snp_permission_allowed(text,uuid,text),
  public.snp_user_permission_allowed(uuid,uuid,text),
  public.snp_actor_can_module_action(text,text),public.get_user_modules(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_permission_allowed(text,uuid,text),
  public.snp_user_permission_allowed(uuid,uuid,text),
  public.snp_actor_can_module_action(text,text),public.get_user_modules(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.snp_grant_module_to_platform_accounts(),
  public.snp_grant_modules_to_platform_account() FROM PUBLIC,anon,authenticated;

DO $postflight$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.user_profiles profile CROSS JOIN public.modules module
    WHERE profile.role='owner' AND profile.is_active AND NOT EXISTS(
      SELECT 1 FROM public.user_permissions permission
      WHERE permission.user_id=profile.id AND permission.module_id=module.id
        AND permission.can_view AND permission.can_create AND permission.can_edit
        AND permission.can_delete AND permission.can_approve
    )
  ) THEN
    RAISE EXCEPTION 'Postflight Owner/modules : une attribution complète est absente.';
  END IF;
END;
$postflight$;

NOTIFY pgrst, 'reload schema';
COMMIT;
