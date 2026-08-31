-- Réconciliation définitive du catalogue Administration et des habilitations.
-- Migration autonome : elle ne dépend pas des migrations IAM historiques qui
-- peuvent ne pas être présentes sur certains environnements déjà en service.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Les six écrans Administration existent, sont routés et visibles.
-- ---------------------------------------------------------------------------
WITH parent AS (
  SELECT id FROM public.snp_modules WHERE code = 'administration' LIMIT 1
), source(code, nom, description, icone, route, ordre) AS (
  VALUES
    ('admin-users', 'Utilisateurs', 'Gestion des comptes, rôles et habilitations individuelles.', 'Users', '/users', 1),
    ('admin-modules', 'Modules', 'Gestion du catalogue fonctionnel et de sa visibilité.', 'Layers', '/admin/modules', 2),
    ('admin-roles', 'Rôles & Permissions', 'Matrice des rôles et gestion des habilitations par compte.', 'KeyRound', '/admin/permissions', 3),
    ('admin-messaging', 'Messagerie', 'Paramètres de la messagerie transactionnelle.', 'Mail', '/admin/messagerie', 4),
    ('admin-settings', 'Paramètres Système', 'Configuration générale et référentiels de la plateforme.', 'SlidersHorizontal', '/admin/settings', 5),
    ('admin-audit', 'Journal d''Audit', 'Historique des actions sensibles et administratives.', 'ClipboardCheck', '/admin/audit', 6)
)
INSERT INTO public.snp_modules (
  code, nom, description, icone, route, parent_id, ordre,
  est_actif, est_visible_menu, permissions_requises
)
SELECT
  source.code, source.nom, source.description, source.icone, source.route,
  parent.id, source.ordre, true, true, '{}'::text[]
FROM source CROSS JOIN parent
ON CONFLICT (code) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description,
  icone = EXCLUDED.icone,
  route = EXCLUDED.route,
  parent_id = EXCLUDED.parent_id,
  ordre = EXCLUDED.ordre,
  est_actif = true,
  est_visible_menu = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. Plafond serveur unique, aligné sur le frontend.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.snp_role_module_ceilings (
  role text NOT NULL,
  access_domain text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role, access_domain)
);

INSERT INTO public.snp_role_module_ceilings
  (role, access_domain, can_view, can_create, can_edit, can_delete, can_approve)
VALUES
  ('admin','users',true,true,true,true,false), ('admin','settings',true,true,true,true,false),
  ('admin','sites',true,false,false,false,false), ('admin','artisans',true,false,false,false,false),
  ('admin','production',true,false,false,false,false), ('admin','purchases',true,false,false,false,false),
  ('admin','sales',true,false,false,false,false), ('admin','payments',true,false,false,false,false),
  ('admin','shipping',true,false,false,false,false), ('admin','refining',true,false,false,false,false),
  ('admin','inventory',true,false,false,false,false), ('admin','reconciliation',true,false,false,false,false),
  ('admin','tax',true,false,false,false,false), ('admin','contracts',true,false,false,false,false),
  ('admin','customers',true,false,false,false,false), ('admin','documents',true,false,false,false,false),
  ('admin','reports',true,false,false,false,false), ('admin','audit',true,false,false,false,false),
  ('management','sites',true,false,false,false,false), ('management','artisans',true,false,false,false,false),
  ('management','production',true,true,true,false,true), ('management','purchases',true,true,true,false,true),
  ('management','sales',true,true,true,false,true), ('management','payments',true,true,true,false,true),
  ('management','shipping',true,true,true,false,true), ('management','refining',true,true,true,false,true),
  ('management','inventory',true,true,true,false,false), ('management','reconciliation',true,true,true,false,true),
  ('management','tax',true,false,false,false,false), ('management','contracts',true,true,true,false,false),
  ('management','customers',true,true,true,false,false), ('management','documents',true,true,true,false,false),
  ('management','reports',true,false,false,false,false), ('management','audit',true,false,false,false,false),
  ('dgmg','sites',true,true,true,false,false), ('dgmg','artisans',true,true,true,false,false),
  ('dgmg','production',true,false,false,false,true), ('dgmg','documents',true,false,false,false,false),
  ('dgmg','reports',true,false,false,false,false), ('dgmg','audit',true,false,false,false,false),
  ('dgi','production',true,false,false,false,false), ('dgi','sales',true,false,false,false,false),
  ('dgi','payments',true,false,false,false,true), ('dgi','reconciliation',true,false,true,false,true),
  ('dgi','tax',true,false,true,false,false), ('dgi','documents',true,false,false,false,false),
  ('dgi','reports',true,false,false,false,false), ('dgi','audit',true,false,false,false,false),
  ('mine','production',true,true,true,false,false), ('mine','purchases',true,true,true,false,false),
  ('mine','sales',true,true,true,false,false), ('mine','payments',true,false,false,false,false),
  ('mine','shipping',true,true,true,false,false), ('mine','refining',true,false,false,false,false),
  ('mine','inventory',true,false,false,false,false), ('mine','contracts',true,true,true,false,false),
  ('mine','customers',true,false,false,false,false), ('mine','documents',true,true,true,false,false),
  ('mine','reports',true,false,false,false,false),
  ('comptoir','sites',true,false,false,false,false), ('comptoir','artisans',true,true,true,false,false),
  ('comptoir','production',true,true,true,false,false), ('comptoir','sales',true,true,true,false,false),
  ('comptoir','payments',true,true,true,false,false), ('comptoir','inventory',true,false,false,false,false),
  ('comptoir','tax',true,true,true,false,false), ('comptoir','documents',true,true,true,false,false),
  ('comptoir','reports',true,false,false,false,false),
  ('collector','sites',true,false,false,false,false), ('collector','artisans',true,true,true,false,false),
  ('collector','production',true,true,true,false,false), ('collector','documents',true,true,true,false,false),
  ('collector','reports',true,false,false,false,false),
  ('customer','sales',true,false,false,false,false), ('customer','payments',true,false,false,false,false),
  ('customer','documents',true,false,false,false,false), ('customer','reports',true,false,false,false,false)
ON CONFLICT (role, access_domain) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  can_approve = EXCLUDED.can_approve;

INSERT INTO public.snp_role_module_ceilings
  (role, access_domain, can_view, can_create, can_edit, can_delete, can_approve)
SELECT 'owner', domain, true, true, true, true, true
FROM unnest(ARRAY[
  'users','settings','sites','artisans','production','purchases','sales','payments',
  'shipping','refining','inventory','reconciliation','tax','contracts','customers',
  'documents','reports','audit'
]::text[]) AS domain
ON CONFLICT (role, access_domain) DO UPDATE SET
  can_view=true, can_create=true, can_edit=true, can_delete=true, can_approve=true;

CREATE OR REPLACE FUNCTION public.snp_niveau_role(p_role text)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE lower(coalesce(p_role,''))
    WHEN 'owner' THEN 100 WHEN 'admin' THEN 80 WHEN 'management' THEN 60
    WHEN 'dgmg' THEN 50 WHEN 'dgi' THEN 50 WHEN 'manager' THEN 40
    WHEN 'mine' THEN 30 WHEN 'comptoir' THEN 30 WHEN 'factory' THEN 30
    WHEN 'airport' THEN 30 WHEN 'refinery' THEN 30 WHEN 'collector' THEN 20
    WHEN 'customer' THEN 10 ELSE -1 END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_user_permission_allowed(
  p_user_id uuid, p_module_id uuid, p_action text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT coalesce((
    SELECT CASE lower(p_action)
      WHEN 'view' THEN ceiling.can_view
      WHEN 'create' THEN ceiling.can_create
      WHEN 'edit' THEN ceiling.can_edit
      WHEN 'delete' THEN ceiling.can_delete
      WHEN 'approve' THEN ceiling.can_approve
      ELSE false END
    FROM public.user_profiles profile
    JOIN public.modules module ON module.id = p_module_id AND coalesce(module.is_active,true)
    JOIN public.snp_role_module_ceilings ceiling
      ON ceiling.role = profile.role AND ceiling.access_domain = module.access_domain
    WHERE profile.id = p_user_id AND profile.is_active
    LIMIT 1
  ), false);
$fn$;

CREATE OR REPLACE FUNCTION public.snp_guard_user_permission_ceiling()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF (NEW.can_view AND NOT public.snp_user_permission_allowed(NEW.user_id, NEW.module_id, 'view'))
    OR (NEW.can_create AND NOT public.snp_user_permission_allowed(NEW.user_id, NEW.module_id, 'create'))
    OR (NEW.can_edit AND NOT public.snp_user_permission_allowed(NEW.user_id, NEW.module_id, 'edit'))
    OR (NEW.can_delete AND NOT public.snp_user_permission_allowed(NEW.user_id, NEW.module_id, 'delete'))
    OR (NEW.can_approve AND NOT public.snp_user_permission_allowed(NEW.user_id, NEW.module_id, 'approve')) THEN
    RAISE EXCEPTION 'Une habilitation dépasse le plafond du rôle.' USING ERRCODE='42501';
  END IF;
  IF (NEW.can_create OR NEW.can_edit OR NEW.can_delete OR NEW.can_approve) AND NOT NEW.can_view THEN
    RAISE EXCEPTION 'La consultation est requise pour tout droit dépendant.' USING ERRCODE='22023';
  END IF;
  NEW.can_read := NEW.can_view;
  NEW.can_write := NEW.can_edit;
  RETURN NEW;
END;
$fn$;

-- Normalisation des comptes de plateforme avant activation du garde-fou.
-- Les 24 anciens modules techniques sans domaine ne font partie ni de la
-- navigation ni du catalogue habilitable : ils sont retirés des comptes Admin
-- au lieu de créer des droits fantômes. Le Owner reste le compte de reprise.
DELETE FROM public.user_permissions permission
USING public.user_profiles profile, public.modules module
WHERE permission.user_id=profile.id AND permission.module_id=module.id
  AND profile.role='admin'
  AND coalesce(module.access_domain,'unknown')='unknown';

INSERT INTO public.user_permissions (
  user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,
  can_read,can_write,field_permissions,granted_by
)
SELECT
  profile.id, module.id, true,
  ceiling.can_create, ceiling.can_edit, ceiling.can_delete, ceiling.can_approve,
  true, ceiling.can_edit, '{}'::jsonb, profile.id
FROM public.user_profiles profile
JOIN public.modules module ON coalesce(module.is_active,true)
JOIN public.snp_role_module_ceilings ceiling
  ON ceiling.role=profile.role AND ceiling.access_domain=module.access_domain AND ceiling.can_view
WHERE profile.role IN ('owner','admin') AND profile.is_active
ON CONFLICT (user_id,module_id) DO UPDATE SET
  can_view=EXCLUDED.can_view,
  can_create=EXCLUDED.can_create,
  can_edit=EXCLUDED.can_edit,
  can_delete=EXCLUDED.can_delete,
  can_approve=EXCLUDED.can_approve,
  can_read=EXCLUDED.can_read,
  can_write=EXCLUDED.can_write,
  field_permissions=coalesce(public.user_permissions.field_permissions,'{}'::jsonb),
  updated_at=now();

DROP TRIGGER IF EXISTS snp_user_permission_ceiling ON public.user_permissions;
CREATE TRIGGER snp_user_permission_ceiling
BEFORE INSERT OR UPDATE ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_user_permission_ceiling();

-- ---------------------------------------------------------------------------
-- 3. Lecture et édition transactionnelle des comptes administrés.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_peut_administrer_compte(p_target_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite()
    AND p_target_id IS NOT NULL
    AND p_target_id <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles actor
      JOIN public.user_profiles target ON target.id=p_target_id
      WHERE actor.id=auth.uid() AND actor.is_active
        AND actor.mining_company_id IS NULL
        AND actor.role IN ('owner','admin')
        AND target.role <> 'owner'
        AND (
          actor.role='owner'
          OR public.snp_niveau_role(target.role) < public.snp_niveau_role(actor.role)
        )
    );
$fn$;

DROP POLICY IF EXISTS snp_habilitations_hierarchie_select ON public.user_permissions;
CREATE POLICY snp_habilitations_hierarchie_select
ON public.user_permissions FOR SELECT TO authenticated
USING (user_id=auth.uid() OR public.snp_peut_administrer_compte(user_id));

CREATE OR REPLACE FUNCTION public.snp_remplacer_habilitations_compte(
  p_user_id uuid, p_habilitations jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NOT public.snp_peut_administrer_compte(p_user_id) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier les habilitations de ce compte.' USING ERRCODE='42501';
  END IF;
  IF p_habilitations IS NULL OR jsonb_typeof(p_habilitations)<>'array'
    OR jsonb_array_length(p_habilitations)>200 THEN
    RAISE EXCEPTION 'Le format des habilitations est invalide.' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT module_id FROM jsonb_to_recordset(p_habilitations) x(module_id uuid)
    GROUP BY module_id HAVING count(*)>1
  ) THEN
    RAISE EXCEPTION 'Un module est présent plusieurs fois.' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_habilitations) x(
      module_id uuid,can_view boolean,can_create boolean,can_edit boolean,
      can_delete boolean,can_approve boolean
    ) LEFT JOIN public.modules module ON module.id=x.module_id AND coalesce(module.is_active,true)
    WHERE module.id IS NULL
      OR (coalesce(x.can_view,false) AND NOT public.snp_user_permission_allowed(p_user_id,x.module_id,'view'))
      OR (coalesce(x.can_create,false) AND NOT public.snp_user_permission_allowed(p_user_id,x.module_id,'create'))
      OR (coalesce(x.can_edit,false) AND NOT public.snp_user_permission_allowed(p_user_id,x.module_id,'edit'))
      OR (coalesce(x.can_delete,false) AND NOT public.snp_user_permission_allowed(p_user_id,x.module_id,'delete'))
      OR (coalesce(x.can_approve,false) AND NOT public.snp_user_permission_allowed(p_user_id,x.module_id,'approve'))
  ) THEN
    RAISE EXCEPTION 'Une habilitation est inconnue ou dépasse le plafond du rôle.' USING ERRCODE='42501';
  END IF;

  DELETE FROM public.user_permissions WHERE user_id=p_user_id;
  INSERT INTO public.user_permissions (
    user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,
    can_read,can_write,field_permissions,granted_by
  )
  SELECT
    p_user_id,x.module_id,coalesce(x.can_view,false),coalesce(x.can_create,false),
    coalesce(x.can_edit,false),coalesce(x.can_delete,false),coalesce(x.can_approve,false),
    coalesce(x.can_view,false),coalesce(x.can_edit,false),coalesce(x.field_permissions,'{}'::jsonb),auth.uid()
  FROM jsonb_to_recordset(p_habilitations) x(
    module_id uuid,can_view boolean,can_create boolean,can_edit boolean,
    can_delete boolean,can_approve boolean,field_permissions jsonb
  ) WHERE coalesce(x.can_view,false);

  INSERT INTO public.snp_account_admin_audit(actor_id,target_id,action,new_values)
  VALUES(auth.uid(),p_user_id,'permissions_replace',jsonb_build_object('count',jsonb_array_length(p_habilitations)));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_configurer_acces_compte(
  p_user_id uuid, p_full_name text, p_phone text, p_role text, p_is_active boolean,
  p_mining_company_id uuid, p_organization_id uuid, p_collector_id uuid,
  p_responsibilities jsonb, p_permissions jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor_role text;
  v_previous jsonb;
  v_expected_org text;
  v_org_type text;
BEGIN
  IF NOT public.snp_peut_administrer_compte(p_user_id) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas administrer ce compte.' USING ERRCODE='42501';
  END IF;
  SELECT role INTO v_actor_role FROM public.user_profiles WHERE id=auth.uid() AND is_active;
  IF p_role NOT IN ('admin','management','dgmg','dgi','mine','comptoir','collector','customer')
    OR public.snp_niveau_role(p_role)>=public.snp_niveau_role(v_actor_role) THEN
    RAISE EXCEPTION 'Rôle non attribuable par ce compte.' USING ERRCODE='42501';
  END IF;
  IF nullif(trim(p_full_name),'') IS NULL THEN
    RAISE EXCEPTION 'Le nom complet est obligatoire.' USING ERRCODE='22023';
  END IF;
  IF p_responsibilities IS NULL OR jsonb_typeof(p_responsibilities)<>'object' THEN
    RAISE EXCEPTION 'Le format des responsabilités est invalide.' USING ERRCODE='22023';
  END IF;

  SELECT to_jsonb(profile) INTO v_previous
  FROM public.user_profiles profile WHERE id=p_user_id FOR UPDATE;
  IF v_previous IS NULL THEN RAISE EXCEPTION 'Compte introuvable.' USING ERRCODE='P0002'; END IF;

  IF p_role='mine' AND p_mining_company_id IS NULL THEN
    RAISE EXCEPTION 'La société minière est obligatoire.' USING ERRCODE='22023';
  END IF;
  v_expected_org := CASE p_role
    WHEN 'dgmg' THEN 'dgmg' WHEN 'dgi' THEN 'dgi'
    WHEN 'comptoir' THEN 'comptoir' WHEN 'collector' THEN 'comptoir'
    ELSE NULL END;
  IF v_expected_org IS NOT NULL THEN
    SELECT organization_type INTO v_org_type FROM public.snp_organizations
    WHERE id=p_organization_id AND is_active;
    IF v_org_type IS DISTINCT FROM v_expected_org THEN
      RAISE EXCEPTION 'L’organisation sélectionnée est absente, inactive ou incompatible.' USING ERRCODE='22023';
    END IF;
  ELSIF p_organization_id IS NOT NULL AND p_role NOT IN ('management','admin') THEN
    RAISE EXCEPTION 'Ce rôle ne peut pas recevoir cette organisation.' USING ERRCODE='22023';
  END IF;

  UPDATE public.user_profiles SET
    full_name=trim(p_full_name), phone=nullif(trim(p_phone),''), role=p_role,
    is_active=coalesce(p_is_active,true),
    mining_company_id=CASE WHEN p_role='mine' THEN p_mining_company_id ELSE NULL END,
    updated_at=now()
  WHERE id=p_user_id;

  UPDATE public.snp_user_organization_memberships
  SET valid_until=now(),is_primary=false
  WHERE user_id=p_user_id AND valid_until IS NULL;
  IF p_organization_id IS NOT NULL THEN
    INSERT INTO public.snp_user_organization_memberships(
      user_id,organization_id,membership_role,is_primary,reason,granted_by
    ) VALUES(
      p_user_id,p_organization_id,p_role,true,
      'Configuration administrative du périmètre',auth.uid()
    );
  END IF;

  -- Nettoyage de toutes les responsabilités opérationnelles incompatibles,
  -- puis réinsertion de celles autorisées pour le nouveau rôle.
  DELETE FROM public.snp_user_capabilities
  WHERE user_id=p_user_id AND capability_code IN (
    'sonasp.prepare','sonasp.approve','sonasp.finance.execute','sonasp.finance.reconcile',
    'refining.supervise','reconciliation.manage','collectors.manage','dgmg.supervise',
    'dgmg.production.validate','dgi.fiscal.control','dgi.fiscal.reconcile',
    'mine.production.manage','comptoir.manage','collector.operate'
  );
  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_responsibilities) item
    WHERE item.value='true'::jsonb AND NOT (
      (p_role='management' AND item.key IN ('sonasp.prepare','sonasp.approve','sonasp.finance.execute','sonasp.finance.reconcile','refining.supervise','reconciliation.manage','collectors.manage'))
      OR (p_role='dgmg' AND item.key IN ('dgmg.supervise','dgmg.production.validate','collectors.manage'))
      OR (p_role='dgi' AND item.key IN ('dgi.fiscal.control','dgi.fiscal.reconcile'))
      OR (p_role='mine' AND item.key IN ('mine.production.manage','refining.supervise'))
      OR (p_role='comptoir' AND item.key IN ('comptoir.manage','refining.supervise','collectors.manage'))
      OR (p_role='collector' AND item.key='collector.operate')
    )
  ) THEN
    RAISE EXCEPTION 'Une responsabilité est incompatible avec le rôle.' USING ERRCODE='22023';
  END IF;
  IF (p_responsibilities->>'sonasp.prepare')::boolean IS TRUE
    AND (p_responsibilities->>'sonasp.approve')::boolean IS TRUE THEN
    RAISE EXCEPTION 'Séparation des fonctions : préparation et approbation sont incompatibles.' USING ERRCODE='22023';
  END IF;
  IF (p_responsibilities->>'sonasp.finance.execute')::boolean IS TRUE
    AND (p_responsibilities->>'sonasp.finance.reconcile')::boolean IS TRUE THEN
    RAISE EXCEPTION 'Séparation des fonctions : exécution et rapprochement sont incompatibles.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.snp_user_capabilities(user_id,capability_code,allowed,reason,granted_by)
  SELECT p_user_id,item.key,true,'Responsabilité attribuée depuis l’administration',auth.uid()
  FROM jsonb_each(p_responsibilities) item
  JOIN public.snp_capability_catalog catalog ON catalog.code=item.key
  WHERE item.value='true'::jsonb
  ON CONFLICT(user_id,capability_code) DO UPDATE SET
    allowed=true,valid_from=now(),valid_until=NULL,
    reason=EXCLUDED.reason,granted_by=auth.uid(),granted_at=now();

  PERFORM public.snp_remplacer_habilitations_compte(p_user_id,p_permissions);

  BEGIN
    PERFORM public.snp_sessions_revoquer_toutes(
      p_user_id,false,'Révocation après modification administrative des accès'
    );
  EXCEPTION WHEN undefined_function OR insufficient_privilege THEN
    NULL;
  END;

  INSERT INTO public.snp_account_admin_audit(actor_id,target_id,action,previous_values,new_values)
  VALUES(
    auth.uid(),p_user_id,'access_configuration',v_previous,
    jsonb_build_object('role',p_role,'organization_id',p_organization_id,'collector_id',p_collector_id)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_remplacer_habilitations_compte(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snp_remplacer_habilitations_compte(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.snp_configurer_acces_compte(uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snp_configurer_acces_compte(uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Toute création/réactivation future reste cohérente automatiquement.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_grant_module_to_platform_accounts()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF coalesce(NEW.is_active,true) THEN
    INSERT INTO public.user_permissions(
      user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,
      can_read,can_write,field_permissions,granted_by
    )
    SELECT profile.id,NEW.id,true,ceiling.can_create,ceiling.can_edit,
      ceiling.can_delete,ceiling.can_approve,true,ceiling.can_edit,'{}'::jsonb,profile.id
    FROM public.user_profiles profile
    JOIN public.snp_role_module_ceilings ceiling
      ON ceiling.role=profile.role AND ceiling.access_domain=NEW.access_domain AND ceiling.can_view
    WHERE profile.role IN ('owner','admin') AND profile.is_active
    ON CONFLICT(user_id,module_id) DO UPDATE SET
      can_view=EXCLUDED.can_view,can_create=EXCLUDED.can_create,can_edit=EXCLUDED.can_edit,
      can_delete=EXCLUDED.can_delete,can_approve=EXCLUDED.can_approve,
      can_read=EXCLUDED.can_read,can_write=EXCLUDED.can_write,updated_at=now();
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_snp_grant_module_to_platform_accounts ON public.modules;
CREATE TRIGGER trg_snp_grant_module_to_platform_accounts
AFTER INSERT OR UPDATE OF is_active,access_domain ON public.modules
FOR EACH ROW EXECUTE FUNCTION public.snp_grant_module_to_platform_accounts();

CREATE OR REPLACE FUNCTION public.snp_grant_modules_to_platform_account()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NEW.role IN ('owner','admin') AND NEW.is_active THEN
    INSERT INTO public.user_permissions(
      user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,
      can_read,can_write,field_permissions,granted_by
    )
    SELECT NEW.id,module.id,true,ceiling.can_create,ceiling.can_edit,
      ceiling.can_delete,ceiling.can_approve,true,ceiling.can_edit,'{}'::jsonb,NEW.id
    FROM public.modules module
    JOIN public.snp_role_module_ceilings ceiling
      ON ceiling.role=NEW.role AND ceiling.access_domain=module.access_domain AND ceiling.can_view
    WHERE coalesce(module.is_active,true)
    ON CONFLICT(user_id,module_id) DO UPDATE SET
      can_view=EXCLUDED.can_view,can_create=EXCLUDED.can_create,can_edit=EXCLUDED.can_edit,
      can_delete=EXCLUDED.can_delete,can_approve=EXCLUDED.can_approve,
      can_read=EXCLUDED.can_read,can_write=EXCLUDED.can_write,updated_at=now();
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_snp_grant_modules_to_platform_account ON public.user_profiles;
CREATE TRIGGER trg_snp_grant_modules_to_platform_account
AFTER INSERT OR UPDATE OF role,is_active ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.snp_grant_modules_to_platform_account();

COMMIT;
