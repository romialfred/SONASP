-- =============================================================================
-- Correctif IAM prospectif : restaure la source autoritative des responsabilités,
-- rend les habilitations de modules opposables et ferme les opérations
-- administratives sensibles qui avaient été élargies par une migration tardive.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.snp_access_role_policies (
  role text PRIMARY KEY,
  portal_code text NOT NULL,
  organization_type text,
  organization_required boolean NOT NULL DEFAULT false,
  can_administer_accounts boolean NOT NULL DEFAULT false,
  is_legacy boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.snp_access_role_policies
  (role,portal_code,organization_type,organization_required,can_administer_accounts,is_legacy)
VALUES
  ('owner','sonasp','sonasp',false,true,true),
  ('admin','sonasp','sonasp',false,true,false),
  ('management','sonasp','sonasp',false,false,false),
  ('dgmg','dgmg','dgmg',true,false,false),
  ('dgi','dgi','dgi',true,false,false),
  ('mine','operator','mine',true,false,false),
  ('comptoir','operator','comptoir',true,false,false),
  ('collector','collector','comptoir',true,false,false),
  ('customer','client','customer',false,false,false),
  ('manager','sonasp','sonasp',false,false,true),
  ('factory','operator','factory',true,false,true),
  ('airport','operator','airport',true,false,true),
  ('refinery','operator','refinery',true,false,true)
ON CONFLICT(role) DO UPDATE SET
  portal_code=excluded.portal_code,
  organization_type=excluded.organization_type,
  organization_required=excluded.organization_required,
  can_administer_accounts=excluded.can_administer_accounts,
  is_legacy=excluded.is_legacy,
  updated_at=now();

-- Normalise aussi les modules historiques qui précèdent le catalogue unifié.
-- Aucun module actif ne doit échapper au plafond de son domaine par une valeur
-- NULL/unknown ; la correspondance reste explicite et donc auditable.
UPDATE public.modules SET access_domain=mapping.access_domain,updated_at=now()
FROM (VALUES
  ('assay_certificates','documents'),('audit','audit'),
  ('budget_forecasts','production'),('customers','customers'),
  ('daily_production','production'),('depositors','customers'),
  ('export_licenses','shipping'),('freight_companies','shipping'),
  ('fx_rates','sales'),('gold_prices','sales'),
  ('gold_sales_settings','settings'),('invoice_consignment','sales'),
  ('mining_companies','sites'),('payments','payments'),('presales','sales'),
  ('production_in_safe','inventory'),('refinery_plants','refining'),
  ('refining_process','refining'),('shipping_preparation','shipping'),
  ('silver_inventory','inventory'),('status_manager','settings'),
  ('trade_space','sales'),('users','users'),('workflow','settings')
) AS mapping(name,access_domain)
WHERE public.modules.name=mapping.name
  AND public.modules.access_domain IS DISTINCT FROM mapping.access_domain;

INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive)
VALUES
  ('dgmg.supervise','dgmg','Supervision DGMG','Contrôler les sites, opérateurs et déclarations du secteur minier.',true),
  ('dgmg.production.validate','dgmg','Validation production DGMG','Valider les déclarations de production réglementaires.',true),
  ('dgi.fiscal.control','dgi','Contrôle fiscal DGI','Contrôler les assiettes, taxes et royalties.',true),
  ('dgi.fiscal.reconcile','dgi','Rapprochement fiscal DGI','Rapprocher les montants déclarés, appelés et payés.',true),
  ('mine.production.manage','mine','Gestion de production','Déclarer la production de la société rattachée.',true),
  ('refining.supervise','refining','Supervision du raffinage','Suivre les lots, résultats et réceptions autorisés.',true),
  ('reconciliation.manage','reconciliation','Gestion de la conciliation','Préparer et analyser les dossiers de conciliation.',true)
ON CONFLICT(code) DO UPDATE SET
  domain=excluded.domain,label=excluded.label,description=excluded.description,sensitive=excluded.sensitive;

CREATE TABLE IF NOT EXISTS public.snp_responsibility_catalog (
  code text PRIMARY KEY,
  capability_code text UNIQUE NOT NULL REFERENCES public.snp_capability_catalog(code) ON DELETE RESTRICT,
  label text NOT NULL,
  description text NOT NULL,
  sensitive boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.snp_role_responsibility_ceiling (
  role text NOT NULL REFERENCES public.snp_access_role_policies(role) ON DELETE CASCADE,
  responsibility_code text NOT NULL REFERENCES public.snp_responsibility_catalog(code) ON DELETE CASCADE,
  required boolean NOT NULL DEFAULT false,
  PRIMARY KEY(role,responsibility_code)
);
CREATE TABLE IF NOT EXISTS public.snp_responsibility_conflicts (
  left_code text NOT NULL REFERENCES public.snp_responsibility_catalog(code) ON DELETE CASCADE,
  right_code text NOT NULL REFERENCES public.snp_responsibility_catalog(code) ON DELETE CASCADE,
  reason text NOT NULL,
  PRIMARY KEY(left_code,right_code),
  CHECK(left_code<right_code)
);
CREATE TABLE IF NOT EXISTS public.snp_user_responsibilities (
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  responsibility_code text NOT NULL REFERENCES public.snp_responsibility_catalog(code) ON DELETE RESTRICT,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK(length(trim(reason))>=10),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,responsibility_code)
);

-- Le correctif doit rester autonome même lorsqu'une ancienne migration IAM a
-- été appliquée partiellement. Ce registre conserve les comptes legacy à
-- revoir sans leur accorder silencieusement un rôle plus puissant.
CREATE TABLE IF NOT EXISTS public.snp_access_migration_review (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  legacy_role text NOT NULL,
  proposed_role text,
  reason text NOT NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.snp_responsibility_catalog(code,capability_code,label,description)
VALUES
  ('sonasp.prepare','sonasp.prepare','SONASP Gestionnaire','Prépare les dossiers et les soumet au contrôle.'),
  ('sonasp.approve','sonasp.approve','SONASP Approbateur','Contrôle un dossier préparé par un autre acteur.'),
  ('sonasp.finance.execute','sonasp.finance.execute','Finance — exécution','Exécute les règlements et joint les preuves.'),
  ('sonasp.finance.reconcile','sonasp.finance.reconcile','Finance — rapprochement','Rapproche les opérations exécutées par un autre acteur.'),
  ('refining.supervise','refining.supervise','Raffinage','Suit les lots et résultats autorisés.'),
  ('reconciliation.manage','reconciliation.manage','Conciliation','Prépare et analyse les dossiers de conciliation.'),
  ('dgmg.supervise','dgmg.supervise','Supervision DGMG','Contrôle réglementaire du secteur.'),
  ('dgmg.production.validate','dgmg.production.validate','Validation production','Valide les déclarations réglementaires.'),
  ('mine.production.manage','mine.production.manage','Gestion de la production','Déclare la production du périmètre société.'),
  ('comptoir.manage','comptoir.manage','Gestion du comptoir','Gère les opérations du comptoir rattaché.'),
  ('collectors.manage','collectors.manage','Gestion des collecteurs','Gère les rattachements collecteurs-orpailleurs.'),
  ('dgi.fiscal.control','dgi.fiscal.control','Contrôle fiscal','Contrôle les assiettes, taxes et royalties.'),
  ('dgi.fiscal.reconcile','dgi.fiscal.reconcile','Rapprochement fiscal','Rapproche les montants fiscaux.'),
  ('collector.operate','collector.operate','Collecte terrain','Opère sur les seuls orpailleurs rattachés.')
ON CONFLICT(code) DO UPDATE SET
  capability_code=excluded.capability_code,label=excluded.label,description=excluded.description;

DELETE FROM public.snp_role_responsibility_ceiling;
INSERT INTO public.snp_role_responsibility_ceiling(role,responsibility_code,required)
VALUES
  ('management','sonasp.prepare',false),('management','sonasp.approve',false),
  ('management','sonasp.finance.execute',false),('management','sonasp.finance.reconcile',false),
  ('management','refining.supervise',false),('management','reconciliation.manage',false),
  ('management','collectors.manage',false),
  ('dgmg','dgmg.supervise',true),('dgmg','dgmg.production.validate',false),('dgmg','collectors.manage',false),
  ('dgi','dgi.fiscal.control',true),('dgi','dgi.fiscal.reconcile',false),
  ('mine','mine.production.manage',true),('mine','refining.supervise',false),
  ('comptoir','comptoir.manage',true),('comptoir','refining.supervise',false),('comptoir','collectors.manage',false),
  ('collector','collector.operate',true);

INSERT INTO public.snp_responsibility_conflicts(left_code,right_code,reason)
VALUES
  ('sonasp.approve','sonasp.prepare','Le préparateur ne peut pas approuver son propre flux.'),
  ('sonasp.finance.execute','sonasp.finance.reconcile','L’exécutant financier ne peut pas rapprocher son opération.')
ON CONFLICT DO NOTHING;

-- Continuité sûre : seules les responsabilités explicitement accordées sont
-- reprises. Les responsabilités obligatoires des rôles mono-fonction sont
-- ajoutées pour éviter de casser leur portail après la correction.
INSERT INTO public.snp_user_responsibilities(user_id,responsibility_code,granted_by,reason)
SELECT profile.id,ceiling.responsibility_code,NULL,'Migration corrective d’une responsabilité obligatoire'
FROM public.user_profiles profile
JOIN public.snp_role_responsibility_ceiling ceiling ON ceiling.role=profile.role AND ceiling.required
WHERE profile.is_active
ON CONFLICT DO NOTHING;

INSERT INTO public.snp_user_responsibilities(user_id,responsibility_code,granted_by,reason)
SELECT capability.user_id,catalog.code,capability.granted_by,'Migration corrective d’une responsabilité explicite'
FROM public.snp_user_capabilities capability
JOIN public.snp_responsibility_catalog catalog ON catalog.capability_code=capability.capability_code
JOIN public.user_profiles profile ON profile.id=capability.user_id AND profile.is_active
JOIN public.snp_role_responsibility_ceiling ceiling
  ON ceiling.role=profile.role AND ceiling.responsibility_code=catalog.code
WHERE capability.allowed
  AND capability.valid_from<=now()
  AND (capability.valid_until IS NULL OR capability.valid_until>now())
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.snp_actor_has_capability(p_capability_code text)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  WITH actor AS (
    SELECT id,role FROM public.user_profiles WHERE id=auth.uid() AND is_active
  ), catalog AS (
    SELECT code,sensitive FROM public.snp_capability_catalog WHERE code=p_capability_code
  ), responsibility AS (
    SELECT 1
    FROM public.snp_user_responsibilities selected
    JOIN public.snp_role_responsibility_ceiling ceiling
      ON ceiling.role=(SELECT role FROM actor)
     AND ceiling.responsibility_code=selected.responsibility_code
    JOIN public.snp_responsibility_catalog definition
      ON definition.code=selected.responsibility_code
     AND definition.capability_code=p_capability_code
    WHERE selected.user_id=auth.uid()
  ), explicit_override AS (
    SELECT allowed FROM public.snp_user_capabilities
    WHERE user_id=auth.uid() AND capability_code=p_capability_code
      AND valid_from<=clock_timestamp()
      AND (valid_until IS NULL OR valid_until>clock_timestamp())
  )
  SELECT CASE
    WHEN coalesce(auth.role(),'')='service_role' THEN true
    WHEN NOT EXISTS(SELECT 1 FROM actor) OR NOT EXISTS(SELECT 1 FROM catalog) THEN false
    WHEN coalesce(auth.role(),'')='authenticated' AND NOT public.snp_session_est_active() THEN false
    WHEN (SELECT sensitive FROM catalog) AND NOT public.snp_mfa_satisfaite() THEN false
    WHEN (SELECT role FROM actor)='owner' THEN true
    WHEN EXISTS(SELECT 1 FROM public.snp_responsibility_catalog WHERE capability_code=p_capability_code)
      THEN EXISTS(SELECT 1 FROM responsibility)
    WHEN EXISTS(SELECT 1 FROM explicit_override)
      THEN (SELECT allowed FROM explicit_override LIMIT 1)
       AND EXISTS(
         SELECT 1 FROM public.snp_role_capabilities
         WHERE role=(SELECT role FROM actor) AND capability_code=p_capability_code
       )
    ELSE EXISTS(
      SELECT 1 FROM public.snp_role_capabilities
      WHERE role=(SELECT role FROM actor) AND capability_code=p_capability_code
    )
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_validate_responsibilities(p_role text,p_responsibilities jsonb)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  IF p_responsibilities IS NULL OR jsonb_typeof(p_responsibilities)<>'object' THEN
    RAISE EXCEPTION 'Le format des responsabilités est invalide.' USING ERRCODE='22023';
  END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_each_text(p_responsibilities) item
    WHERE item.value::boolean AND NOT EXISTS(
      SELECT 1 FROM public.snp_role_responsibility_ceiling ceiling
      WHERE ceiling.role=p_role AND ceiling.responsibility_code=item.key
    )
  ) THEN RAISE EXCEPTION 'Une responsabilité dépasse le plafond du rôle.' USING ERRCODE='42501'; END IF;
  IF EXISTS(
    SELECT 1 FROM public.snp_role_responsibility_ceiling ceiling
    WHERE ceiling.role=p_role AND ceiling.required
      AND coalesce((p_responsibilities->>ceiling.responsibility_code)::boolean,false)=false
  ) THEN RAISE EXCEPTION 'Une responsabilité obligatoire est absente.' USING ERRCODE='22023'; END IF;
  IF EXISTS(
    SELECT 1 FROM public.snp_responsibility_conflicts conflict
    WHERE coalesce((p_responsibilities->>conflict.left_code)::boolean,false)
      AND coalesce((p_responsibilities->>conflict.right_code)::boolean,false)
  ) THEN RAISE EXCEPTION 'Séparation des fonctions : responsabilités incompatibles.' USING ERRCODE='42501'; END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_permission_allowed(p_role text,p_module_id uuid,p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT coalesce(CASE lower(p_action)
    WHEN 'view' THEN ceiling.can_view WHEN 'create' THEN ceiling.can_create
    WHEN 'edit' THEN ceiling.can_edit WHEN 'delete' THEN ceiling.can_delete
    WHEN 'approve' THEN ceiling.can_approve ELSE false END,false)
  FROM public.modules module
  LEFT JOIN public.snp_role_module_ceilings ceiling
    ON ceiling.role=p_role AND ceiling.access_domain=module.access_domain
  WHERE module.id=p_module_id AND coalesce(module.is_active,true);
$fn$;

CREATE OR REPLACE FUNCTION public.snp_user_permission_allowed(p_user_id uuid,p_module_id uuid,p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  WITH target AS (
    SELECT profile.role,module.access_domain
    FROM public.user_profiles profile CROSS JOIN public.modules module
    WHERE profile.id=p_user_id AND profile.is_active AND module.id=p_module_id AND coalesce(module.is_active,true)
  ), selected AS (
    SELECT responsibility_code FROM public.snp_user_responsibilities WHERE user_id=p_user_id
  )
  SELECT coalesce(CASE
    WHEN NOT public.snp_permission_allowed(target.role,p_module_id,p_action) THEN false
    WHEN lower(p_action)='view' THEN true
    WHEN target.role='owner' THEN true
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
    ELSE false END,false)
  FROM target;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_niveau_role(p_role text)
RETURNS integer LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT CASE lower(coalesce(p_role,''))
    WHEN 'owner' THEN 100 WHEN 'admin' THEN 80 WHEN 'management' THEN 60
    WHEN 'dgmg' THEN 50 WHEN 'dgi' THEN 50 WHEN 'manager' THEN 40
    WHEN 'mine' THEN 30 WHEN 'comptoir' THEN 30 WHEN 'factory' THEN 30
    WHEN 'airport' THEN 30 WHEN 'refinery' THEN 30 WHEN 'collector' THEN 20
    WHEN 'customer' THEN 10 ELSE -1 END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_peut_administrer_compte(p_target_id uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT public.snp_actor_has_capability('accounts.manage')
    AND p_target_id IS NOT NULL AND p_target_id<>auth.uid()
    AND EXISTS(
      SELECT 1 FROM public.user_profiles actor
      JOIN public.user_profiles target ON target.id=p_target_id
      WHERE actor.id=auth.uid() AND actor.is_active AND actor.mining_company_id IS NULL
        AND actor.role IN('owner','admin') AND target.role<>'owner'
        AND (actor.role='owner' OR public.snp_niveau_role(target.role)<public.snp_niveau_role(actor.role))
    );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_remplacer_habilitations_compte(p_user_id uuid,p_habilitations jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  IF NOT public.snp_peut_administrer_compte(p_user_id) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier les habilitations de ce compte.' USING ERRCODE='42501';
  END IF;
  IF p_habilitations IS NULL OR jsonb_typeof(p_habilitations)<>'array' OR jsonb_array_length(p_habilitations)>200 THEN
    RAISE EXCEPTION 'Le format des habilitations est invalide.' USING ERRCODE='22023';
  END IF;
  IF EXISTS(
    SELECT module_id FROM jsonb_to_recordset(p_habilitations) item(module_id uuid)
    GROUP BY module_id HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'Un module est présent plusieurs fois.' USING ERRCODE='22023'; END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_to_recordset(p_habilitations) item(
      module_id uuid,can_view boolean,can_create boolean,can_edit boolean,can_delete boolean,can_approve boolean
    ) LEFT JOIN public.modules module ON module.id=item.module_id AND coalesce(module.is_active,true)
    WHERE module.id IS NULL
      OR (coalesce(item.can_view,false) AND NOT public.snp_user_permission_allowed(p_user_id,item.module_id,'view'))
      OR (coalesce(item.can_create,false) AND NOT public.snp_user_permission_allowed(p_user_id,item.module_id,'create'))
      OR (coalesce(item.can_edit,false) AND NOT public.snp_user_permission_allowed(p_user_id,item.module_id,'edit'))
      OR (coalesce(item.can_delete,false) AND NOT public.snp_user_permission_allowed(p_user_id,item.module_id,'delete'))
      OR (coalesce(item.can_approve,false) AND NOT public.snp_user_permission_allowed(p_user_id,item.module_id,'approve'))
  ) THEN RAISE EXCEPTION 'Une habilitation est inconnue ou dépasse le plafond du rôle.' USING ERRCODE='42501'; END IF;
  DELETE FROM public.user_permissions WHERE user_id=p_user_id;
  INSERT INTO public.user_permissions(
    user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,
    can_read,can_write,field_permissions,granted_by
  ) SELECT p_user_id,item.module_id,coalesce(item.can_view,false),coalesce(item.can_create,false),
    coalesce(item.can_edit,false),coalesce(item.can_delete,false),coalesce(item.can_approve,false),
    coalesce(item.can_view,false),coalesce(item.can_edit,false),coalesce(item.field_permissions,'{}'::jsonb),auth.uid()
  FROM jsonb_to_recordset(p_habilitations) item(
    module_id uuid,can_view boolean,can_create boolean,can_edit boolean,can_delete boolean,can_approve boolean,field_permissions jsonb
  ) WHERE coalesce(item.can_view,false);
  INSERT INTO public.snp_account_admin_audit(actor_id,target_id,action,new_values)
  VALUES(auth.uid(),p_user_id,'permissions_replace',jsonb_build_object('count',jsonb_array_length(p_habilitations)));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_configurer_acces_compte(
  p_user_id uuid,p_full_name text,p_phone text,p_role text,p_is_active boolean,
  p_mining_company_id uuid,p_organization_id uuid,p_collector_id uuid,
  p_responsibilities jsonb,p_permissions jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_actor_role text; v_expected_org text; v_org_type text; v_effective_org uuid;
BEGIN
  IF NOT public.snp_peut_administrer_compte(p_user_id) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas administrer ce compte.' USING ERRCODE='42501';
  END IF;
  SELECT role INTO v_actor_role FROM public.user_profiles WHERE id=auth.uid() AND is_active;
  IF p_role NOT IN('admin','management','dgmg','dgi','mine','comptoir','collector','customer')
    OR public.snp_niveau_role(p_role)>=public.snp_niveau_role(v_actor_role) THEN
    RAISE EXCEPTION 'Rôle non attribuable par ce compte.' USING ERRCODE='42501';
  END IF;
  IF nullif(trim(p_full_name),'') IS NULL THEN RAISE EXCEPTION 'Le nom complet est obligatoire.' USING ERRCODE='22023'; END IF;
  PERFORM public.snp_validate_responsibilities(p_role,p_responsibilities);
  SELECT organization_type INTO v_expected_org FROM public.snp_access_role_policies WHERE role=p_role;
  IF p_role='collector' THEN v_expected_org:='comptoir'; END IF;
  v_effective_org:=p_organization_id;
  IF p_role='mine' THEN
    IF p_mining_company_id IS NULL THEN RAISE EXCEPTION 'La société minière est obligatoire.' USING ERRCODE='23502'; END IF;
    SELECT id INTO v_effective_org FROM public.snp_organizations
    WHERE mining_company_id=p_mining_company_id AND organization_type='mine' AND is_active LIMIT 1;
    IF v_effective_org IS NULL THEN RAISE EXCEPTION 'Organisation minière active introuvable.' USING ERRCODE='23503'; END IF;
  ELSIF p_role IN('owner','admin','management') THEN
    IF v_effective_org IS NOT NULL THEN
      SELECT organization_type INTO v_org_type FROM public.snp_organizations WHERE id=v_effective_org AND is_active;
      IF v_org_type IS DISTINCT FROM 'sonasp' THEN RAISE EXCEPTION 'Le compte national doit relever de la SONASP.' USING ERRCODE='42501'; END IF;
    END IF;
  ELSIF EXISTS(SELECT 1 FROM public.snp_access_role_policies WHERE role=p_role AND organization_required) THEN
    IF v_effective_org IS NULL THEN RAISE EXCEPTION 'Organisation obligatoire pour ce rôle.' USING ERRCODE='23502'; END IF;
    SELECT organization_type INTO v_org_type FROM public.snp_organizations WHERE id=v_effective_org AND is_active;
    IF v_org_type IS DISTINCT FROM v_expected_org THEN RAISE EXCEPTION 'Type d’organisation incompatible.' USING ERRCODE='42501'; END IF;
  ELSIF v_effective_org IS NOT NULL THEN
    RAISE EXCEPTION 'Ce rôle ne peut pas recevoir cette organisation.' USING ERRCODE='42501';
  END IF;
  IF p_role='collector' THEN
    IF p_collector_id IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.snp_artisans_miniers artisan
      WHERE artisan.id=p_collector_id AND artisan.type_artisan='collecteur' AND artisan.actif
    ) THEN RAISE EXCEPTION 'Profil collecteur actif obligatoire.' USING ERRCODE='42501'; END IF;
    IF EXISTS(
      SELECT 1 FROM public.snp_collector_accounts account
      WHERE account.collector_id=p_collector_id AND account.is_active AND account.user_id<>p_user_id
    ) THEN RAISE EXCEPTION 'Ce collecteur possède déjà un compte actif.' USING ERRCODE='23505'; END IF;
  END IF;
  UPDATE public.user_profiles SET
    full_name=trim(p_full_name),phone=nullif(trim(p_phone),''),role=p_role,
    is_active=coalesce(p_is_active,true),
    mining_company_id=CASE WHEN p_role='mine' THEN p_mining_company_id ELSE NULL END,
    updated_at=now()
  WHERE id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compte cible introuvable.' USING ERRCODE='P0002'; END IF;
  UPDATE public.snp_user_organization_memberships SET valid_until=now(),is_primary=false
  WHERE user_id=p_user_id AND valid_until IS NULL;
  IF v_effective_org IS NOT NULL THEN
    INSERT INTO public.snp_user_organization_memberships(
      user_id,organization_id,membership_role,is_primary,reason,granted_by
    ) VALUES(
      p_user_id,v_effective_org,CASE WHEN p_role IN('mine','comptoir') THEN 'manager' ELSE 'operator' END,
      true,'Configuration administrative du périmètre',auth.uid()
    );
  END IF;
  UPDATE public.snp_collector_accounts SET is_active=false,unlinked_at=now()
  WHERE user_id=p_user_id AND is_active;
  IF p_role='collector' THEN
    INSERT INTO public.snp_collector_accounts(user_id,collector_id,comptoir_organization_id,is_active,linked_by,reason)
    VALUES(p_user_id,p_collector_id,v_effective_org,true,auth.uid(),'Configuration administrative du collecteur');
  END IF;
  DELETE FROM public.snp_user_responsibilities WHERE user_id=p_user_id;
  INSERT INTO public.snp_user_responsibilities(user_id,responsibility_code,granted_by,reason)
  SELECT p_user_id,item.key,auth.uid(),'Configuration administrative des responsabilités'
  FROM jsonb_each_text(p_responsibilities) item WHERE item.value::boolean;
  INSERT INTO public.snp_user_capabilities(user_id,capability_code,allowed,reason,granted_by)
  SELECT p_user_id,catalog.capability_code,
    EXISTS(
      SELECT 1 FROM public.snp_user_responsibilities selected
      WHERE selected.user_id=p_user_id AND selected.responsibility_code=catalog.code
    ),
    'Synchronisation autoritative des responsabilités',auth.uid()
  FROM public.snp_responsibility_catalog catalog
  ON CONFLICT(user_id,capability_code) DO UPDATE SET
    allowed=excluded.allowed,valid_from=now(),valid_until=NULL,
    reason=excluded.reason,granted_by=auth.uid(),granted_at=now();
  PERFORM public.snp_remplacer_habilitations_compte(p_user_id,p_permissions);
  PERFORM public.snp_sessions_revoquer_toutes(p_user_id,false,'Révocation après modification des accès du compte');
  INSERT INTO public.snp_account_admin_audit(actor_id,target_id,action,new_values)
  VALUES(auth.uid(),p_user_id,'access_configuration',jsonb_build_object(
    'role',p_role,'organization_id',v_effective_org,'collector_id',p_collector_id
  ));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_actor_can_module_action(p_module_code text,p_action text)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  WITH actor AS (
    SELECT id,role FROM public.user_profiles WHERE id=auth.uid() AND is_active
  ), target AS (
    SELECT id FROM public.modules
    WHERE name=p_module_code AND coalesce(is_active,true)
  ), permission AS (
    SELECT grants.* FROM public.user_permissions grants
    JOIN target ON target.id=grants.module_id
    WHERE grants.user_id=auth.uid()
  )
  SELECT CASE
    WHEN coalesce(auth.role(),'')='service_role' THEN true
    WHEN NOT public.snp_session_est_active() OR NOT EXISTS(SELECT 1 FROM actor) OR NOT EXISTS(SELECT 1 FROM target) THEN false
    WHEN (SELECT role FROM actor)='owner' THEN true
    WHEN lower(p_action)<>'view' AND NOT public.snp_mfa_satisfaite() THEN false
    ELSE EXISTS(
      SELECT 1 FROM permission,target
      WHERE CASE lower(p_action)
        WHEN 'view' THEN permission.can_view WHEN 'create' THEN permission.can_create
        WHEN 'edit' THEN permission.can_edit WHEN 'delete' THEN permission.can_delete
        WHEN 'approve' THEN permission.can_approve ELSE false END
        AND public.snp_user_permission_allowed(auth.uid(),target.id,p_action)
    ) END;
$fn$;

-- Réduit immédiatement les droits historiques aux plafonds désormais effectifs.
UPDATE public.user_permissions permission SET
  can_view=public.snp_user_permission_allowed(permission.user_id,permission.module_id,'view'),
  can_create=permission.can_create AND public.snp_user_permission_allowed(permission.user_id,permission.module_id,'create'),
  can_edit=permission.can_edit AND public.snp_user_permission_allowed(permission.user_id,permission.module_id,'edit'),
  can_delete=permission.can_delete AND public.snp_user_permission_allowed(permission.user_id,permission.module_id,'delete'),
  can_approve=permission.can_approve AND public.snp_user_permission_allowed(permission.user_id,permission.module_id,'approve'),
  can_read=public.snp_user_permission_allowed(permission.user_id,permission.module_id,'view'),
  can_write=permission.can_edit AND public.snp_user_permission_allowed(permission.user_id,permission.module_id,'edit'),
  updated_at=now()
FROM public.user_profiles profile
WHERE profile.id=permission.user_id AND profile.role<>'owner';
DELETE FROM public.user_permissions permission
USING public.user_profiles profile
WHERE profile.id=permission.user_id AND profile.role<>'owner' AND NOT permission.can_view;

-- Owner : tous les modules canoniques actifs, sans dépendre d'une attribution
-- manuelle qui pourrait rendre le compte de reprise inutilisable.
INSERT INTO public.user_permissions(
  user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,
  can_read,can_write,field_permissions,granted_by
)
SELECT profile.id,module.id,true,true,true,true,true,true,true,'{}'::jsonb,profile.id
FROM public.user_profiles profile
JOIN public.modules module ON module.name=ANY(ARRAY[
  'dashboard','mining_sites','artisan-minier','artisan_gold_market','conciliation','production',
  'gold_purchases','shipping','refining','gold_inventory','international_markets','sales',
  'stakeholders','documents','settings','administration','sales_analytics','production_analytics','reports','analytics'
]::text[]) AND coalesce(module.is_active,true)
WHERE profile.role='owner' AND profile.is_active
ON CONFLICT(user_id,module_id) DO UPDATE SET
  can_view=true,can_create=true,can_edit=true,can_delete=true,can_approve=true,
  can_read=true,can_write=true,updated_at=now();

-- La MFA d'un autre compte est une opération d'administration de comptes, pas
-- une approbation métier.
CREATE OR REPLACE FUNCTION public.snp_reinitialiser_mfa(p_utilisateur_id uuid,p_motif text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','auth','pg_temp' AS $fn$
DECLARE v_supprimes integer;
BEGIN
  IF NOT public.snp_peut_administrer_compte(p_utilisateur_id) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas réinitialiser le second facteur de ce compte.' USING ERRCODE='42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif))<10 THEN
    RAISE EXCEPTION 'Un motif détaillé est obligatoire.' USING ERRCODE='22023';
  END IF;
  DELETE FROM auth.mfa_factors WHERE user_id=p_utilisateur_id;
  GET DIAGNOSTICS v_supprimes=ROW_COUNT;
  UPDATE public.user_profiles SET
    mfa_enrolled_at=NULL,two_factor_enabled=false,mfa_reset_at=now(),mfa_reset_by=auth.uid(),updated_at=now()
  WHERE id=p_utilisateur_id;
  PERFORM public.snp_sessions_revoquer_toutes(p_utilisateur_id,false,'Révocation après réinitialisation MFA');
  INSERT INTO public.snp_achats_audit(objet,objet_id,action,valeurs_apres,acteur_id)
  VALUES('user_profiles',p_utilisateur_id,'mfa_reinitialise',jsonb_build_object(
    'facteurs_supprimes',v_supprimes,'motif',trim(p_motif)
  ),auth.uid());
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_conformite_mfa()
RETURNS TABLE(
  utilisateur_id uuid,courriel text,nom text,role text,actif boolean,
  enrole_le timestamptz,facteurs_verifies integer,reinitialise_le timestamptz,protege boolean
) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','auth','pg_temp' AS $fn$
  SELECT profile.id,profile.email,profile.full_name,profile.role,profile.is_active,profile.mfa_enrolled_at,
    (SELECT count(*)::integer FROM auth.mfa_factors factor WHERE factor.user_id=profile.id AND factor.status='verified'),
    profile.mfa_reset_at,profile.mfa_enrolled_at IS NOT NULL
  FROM public.user_profiles profile
  JOIN auth.users account ON account.id=profile.id
  WHERE public.snp_actor_has_capability('accounts.manage')
  ORDER BY profile.mfa_enrolled_at NULLS FIRST,profile.full_name;
$fn$;

-- Le catalogue n'est plus modifiable par DML navigateur. Son RPC est durci par
-- la capacité sensible et journalise la mutation.
REVOKE INSERT,UPDATE,DELETE ON public.snp_modules FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.modules FROM authenticated;
CREATE OR REPLACE FUNCTION public.snp_update_module_catalog(
  p_module_id uuid,p_nom text DEFAULT NULL,p_description text DEFAULT NULL,p_route text DEFAULT NULL,
  p_ordre integer DEFAULT NULL,p_est_actif boolean DEFAULT NULL,p_est_visible_menu boolean DEFAULT NULL
) RETURNS public.snp_modules LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
DECLARE v_module public.snp_modules%ROWTYPE; v_result public.snp_modules%ROWTYPE;
BEGIN
  IF NOT public.snp_actor_has_capability('referentials.manage') THEN
    RAISE EXCEPTION 'Capacité referentials.manage et AAL2 requis.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_module FROM public.snp_modules WHERE id=p_module_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Module introuvable.' USING ERRCODE='P0002'; END IF;
  UPDATE public.snp_modules SET
    nom=coalesce(nullif(trim(p_nom),''),nom),
    description=CASE WHEN p_description IS NULL THEN description ELSE p_description END,
    route=CASE WHEN p_route IS NULL THEN route ELSE nullif(trim(p_route),'') END,
    ordre=coalesce(p_ordre,ordre),
    est_visible_menu=coalesce(p_est_visible_menu,est_visible_menu),updated_at=now()
  WHERE id=p_module_id;
  IF p_est_actif IS NOT NULL THEN
    WITH RECURSIVE descendants AS (
      SELECT id,code FROM public.snp_modules WHERE id=p_module_id
      UNION ALL SELECT child.id,child.code FROM public.snp_modules child
      JOIN descendants parent ON child.parent_id=parent.id
    ), updated_navigation AS (
      UPDATE public.snp_modules target SET est_actif=p_est_actif,updated_at=now()
      FROM descendants WHERE target.id=descendants.id RETURNING target.code
    )
    UPDATE public.modules permission SET is_active=p_est_actif,updated_at=now()
    WHERE permission.name IN(SELECT code FROM updated_navigation);
  END IF;
  UPDATE public.modules SET
    display_name=coalesce(nullif(trim(p_nom),''),display_name),
    description=CASE WHEN p_description IS NULL THEN description ELSE p_description END,
    sort_order=coalesce(p_ordre,sort_order),updated_at=now()
  WHERE name=v_module.code;
  INSERT INTO public.snp_account_admin_audit(actor_id,target_id,action,previous_values,new_values)
  VALUES(auth.uid(),auth.uid(),'module_catalog_update',to_jsonb(v_module),jsonb_build_object(
    'module_id',p_module_id,'active',p_est_actif,'visible',p_est_visible_menu
  ));
  SELECT * INTO v_result FROM public.snp_modules WHERE id=p_module_id;
  RETURN v_result;
END;
$fn$;

ALTER TABLE public.snp_access_role_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_responsibility_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_role_responsibility_ceiling ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_responsibility_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_user_responsibilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_role_module_ceilings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_access_migration_review ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snp_access_role_policies_read ON public.snp_access_role_policies;
CREATE POLICY snp_access_role_policies_read ON public.snp_access_role_policies FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS snp_responsibility_catalog_read ON public.snp_responsibility_catalog;
CREATE POLICY snp_responsibility_catalog_read ON public.snp_responsibility_catalog FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS snp_role_responsibility_ceiling_read ON public.snp_role_responsibility_ceiling;
CREATE POLICY snp_role_responsibility_ceiling_read ON public.snp_role_responsibility_ceiling FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS snp_responsibility_conflicts_read ON public.snp_responsibility_conflicts;
CREATE POLICY snp_responsibility_conflicts_read ON public.snp_responsibility_conflicts FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS snp_role_module_ceilings_read ON public.snp_role_module_ceilings;
CREATE POLICY snp_role_module_ceilings_read ON public.snp_role_module_ceilings FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS snp_user_responsibilities_read ON public.snp_user_responsibilities;
CREATE POLICY snp_user_responsibilities_read ON public.snp_user_responsibilities FOR SELECT TO authenticated
USING(user_id=auth.uid() OR public.snp_actor_has_capability('accounts.manage'));
DROP POLICY IF EXISTS snp_access_migration_review_read ON public.snp_access_migration_review;
CREATE POLICY snp_access_migration_review_read ON public.snp_access_migration_review FOR SELECT TO authenticated
USING(public.snp_actor_has_capability('accounts.manage'));

REVOKE INSERT,UPDATE,DELETE ON public.snp_access_role_policies,public.snp_responsibility_catalog,
  public.snp_role_responsibility_ceiling,public.snp_responsibility_conflicts,
  public.snp_user_responsibilities,public.snp_role_module_ceilings,
  public.snp_access_migration_review FROM authenticated;
GRANT SELECT ON public.snp_access_role_policies,public.snp_responsibility_catalog,
  public.snp_role_responsibility_ceiling,public.snp_responsibility_conflicts,
  public.snp_user_responsibilities,public.snp_role_module_ceilings,
  public.snp_access_migration_review TO authenticated;
REVOKE ALL ON FUNCTION public.snp_validate_responsibilities(text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_remplacer_habilitations_compte(uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_configurer_acces_compte(uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_actor_can_module_action(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_reinitialiser_mfa(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_conformite_mfa() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_update_module_catalog(uuid,text,text,text,integer,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snp_validate_responsibilities(text,jsonb),
  public.snp_remplacer_habilitations_compte(uuid,jsonb),
  public.snp_configurer_acces_compte(uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb),
  public.snp_actor_can_module_action(text,text),public.snp_reinitialiser_mfa(uuid,text),
  public.snp_conformite_mfa(),
  public.snp_update_module_catalog(uuid,text,text,text,integer,boolean,boolean) TO authenticated;

COMMIT;
