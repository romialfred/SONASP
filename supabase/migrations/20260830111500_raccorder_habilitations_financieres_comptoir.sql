-- Raccordement explicite des capacités financières Comptoir aux habilitations.
-- Aucun droit financier n'est attribué automatiquement aux comptes Comptoir.
BEGIN;
DO $preflight$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.snp_access_role_policies WHERE role='comptoir')
    OR to_regprocedure('public.snp_configurer_acces_compte(uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Référentiel Comptoir et socle IAM canonique requis.';
  END IF;
END;
$preflight$;

-- Les responsabilités historiques demeurent exclusives. Les quatre capacités
-- 4I peuvent aussi conserver leur attribution historique via un rôle (Admin).
-- Ce marqueur ne donne aucun droit : il préserve seulement cette compatibilité.
ALTER TABLE public.snp_responsibility_catalog
  ADD COLUMN IF NOT EXISTS requires_explicit_assignment boolean NOT NULL DEFAULT true;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON
  public.snp_responsibility_catalog,public.snp_role_responsibility_ceiling,public.snp_responsibility_conflicts
  FROM PUBLIC,anon,authenticated;
INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive)
VALUES
 ('comptoir.invoices.issue','comptoir','Facturation du comptoir','Émettre une facture du comptoir.',true),
 ('comptoir.payments.execute','comptoir','Paiements — exécution','Exécuter un paiement du comptoir.',true),
 ('comptoir.payments.reconcile','comptoir','Paiements — contrôle','Contrôler le paiement d’un autre acteur.',true),
 ('comptoir.tax.execute','comptoir','Reversements fiscaux','Exécuter un reversement du comptoir.',true)
ON CONFLICT(code) DO NOTHING;
INSERT INTO public.snp_responsibility_catalog(code,capability_code,label,description,requires_explicit_assignment)
SELECT code,code,label,description,false FROM public.snp_capability_catalog
WHERE code IN('comptoir.invoices.issue','comptoir.payments.execute','comptoir.payments.reconcile','comptoir.tax.execute')
ON CONFLICT(code) DO UPDATE SET requires_explicit_assignment=false;
INSERT INTO public.snp_role_responsibility_ceiling(role,responsibility_code,required)
SELECT 'comptoir',code,false FROM public.snp_responsibility_catalog
WHERE code IN('comptoir.invoices.issue','comptoir.payments.execute','comptoir.payments.reconcile','comptoir.tax.execute')
ON CONFLICT DO NOTHING;
INSERT INTO public.snp_responsibility_conflicts(left_code,right_code,reason)
VALUES('comptoir.payments.execute','comptoir.payments.reconcile','L’exécutant et le contrôleur du paiement doivent être distincts.')
ON CONFLICT DO NOTHING;
INSERT INTO public.snp_role_module_ceilings(role,access_domain,can_view,can_create,can_edit,can_delete,can_approve)
VALUES('comptoir','payments',true,true,true,false,true)
ON CONFLICT(role,access_domain) DO UPDATE SET can_approve=true;

CREATE OR REPLACE FUNCTION public.snp_actor_has_capability(p_capability_code text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
  WITH actor AS (
    SELECT id,role FROM public.user_profiles WHERE id=auth.uid() AND is_active
  ), catalog AS (
    SELECT code,sensitive FROM public.snp_capability_catalog WHERE code=p_capability_code
  ), responsibility AS (
    SELECT 1 FROM public.snp_user_responsibilities selected
    JOIN public.snp_role_responsibility_ceiling ceiling
      ON ceiling.role=(SELECT role FROM actor) AND ceiling.responsibility_code=selected.responsibility_code
    JOIN public.snp_responsibility_catalog definition
      ON definition.code=selected.responsibility_code AND definition.capability_code=p_capability_code
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
    WHEN EXISTS(SELECT 1 FROM responsibility) THEN true
    WHEN EXISTS(SELECT 1 FROM public.snp_responsibility_catalog
      WHERE capability_code=p_capability_code AND requires_explicit_assignment) THEN false
    WHEN EXISTS(SELECT 1 FROM explicit_override) THEN
      (SELECT allowed FROM explicit_override LIMIT 1) AND EXISTS(
        SELECT 1 FROM public.snp_role_capabilities WHERE role=(SELECT role FROM actor) AND capability_code=p_capability_code
      )
    ELSE EXISTS(
      SELECT 1 FROM public.snp_role_capabilities WHERE role=(SELECT role FROM actor) AND capability_code=p_capability_code
    )
  END;
$fn$;


CREATE OR REPLACE FUNCTION public.snp_user_permission_allowed(p_user_id uuid, p_module_id uuid, p_action text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
    WHEN target.role='comptoir' AND lower(p_action) IN('create','edit') THEN CASE
      WHEN target.access_domain='payments' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='comptoir.payments.execute')
      WHEN target.access_domain='tax' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='comptoir.tax.execute')
      ELSE EXISTS(SELECT 1 FROM selected WHERE responsibility_code='comptoir.manage') END
    WHEN target.role='comptoir' AND lower(p_action)='approve' AND target.access_domain='payments'
      THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='comptoir.payments.reconcile')
    WHEN target.role='collector' AND lower(p_action) IN('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='collector.operate')
    ELSE false END FROM target),false);
$function$;

CREATE OR REPLACE FUNCTION public.snp_configurer_acces_compte(
  p_user_id uuid,p_full_name text,p_phone text,p_role text,p_is_active boolean,
  p_mining_company_id uuid,p_organization_id uuid,p_collector_id uuid,
  p_responsibilities jsonb,p_permissions jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_actor_role text; v_target_role text; v_expected_org text; v_org_type text; v_effective_org uuid;
  v_status_context text;
  v_membership_changed_at timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('snp-account-administration',0));
  PERFORM 1 FROM public.user_profiles WHERE id IN(auth.uid(),p_user_id) ORDER BY id FOR UPDATE;
  IF NOT public.snp_peut_administrer_compte(p_user_id) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas administrer ce compte.' USING ERRCODE='42501';
  END IF;
  SELECT role INTO v_actor_role FROM public.user_profiles WHERE id=auth.uid() AND is_active;
  SELECT role INTO v_target_role FROM public.user_profiles WHERE id=p_user_id;
  IF p_role IS NULL OR NOT (
    p_role IN('owner','admin','management','dgmg','dgi','mine','comptoir','collector','customer')
    OR (p_role=v_target_role AND p_role IN('manager','factory','airport','refinery'))
  ) OR (v_actor_role<>'owner' AND public.snp_niveau_role(p_role)>=public.snp_niveau_role(v_actor_role)) THEN
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
  v_status_context:=current_setting('snp.account_status_rpc',true);
  PERFORM set_config('snp.account_status_rpc','on',true);
  UPDATE public.user_profiles SET
    full_name=trim(p_full_name),phone=nullif(trim(p_phone),''),role=p_role,
    is_active=coalesce(p_is_active,true),
    mining_company_id=CASE WHEN p_role='mine' THEN p_mining_company_id ELSE NULL END,
    updated_at=now()
  WHERE id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compte cible introuvable.' USING ERRCODE='P0002'; END IF;
  PERFORM set_config('snp.account_status_rpc',coalesce(v_status_context,''),true);
  v_membership_changed_at:=clock_timestamp();
  UPDATE public.snp_user_organization_memberships SET valid_until=v_membership_changed_at,is_primary=false
  WHERE user_id=p_user_id AND valid_until IS NULL;
  IF v_effective_org IS NOT NULL THEN
    INSERT INTO public.snp_user_organization_memberships(
      user_id,organization_id,membership_role,is_primary,reason,granted_by,valid_from
    ) VALUES(
      p_user_id,v_effective_org,CASE WHEN p_role IN('mine','comptoir') THEN 'manager' ELSE 'operator' END,
      true,'Configuration administrative du périmètre',auth.uid(),v_membership_changed_at
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
  WHERE catalog.requires_explicit_assignment OR EXISTS(
    SELECT 1 FROM public.snp_role_responsibility_ceiling ceiling
    WHERE ceiling.role=p_role AND ceiling.responsibility_code=catalog.code
  )
  ON CONFLICT(user_id,capability_code) DO UPDATE SET
    allowed=excluded.allowed,valid_from=now(),valid_until=NULL,
    reason=excluded.reason,granted_by=auth.uid(),granted_at=now();
  PERFORM public.snp_remplacer_habilitations_compte(p_user_id,CASE WHEN p_role='owner' THEN '[]'::jsonb ELSE p_permissions END);
  PERFORM public.snp_sessions_revoquer_toutes(p_user_id,false,'Révocation après modification des accès du compte');
  INSERT INTO public.snp_account_admin_audit(actor_id,target_id,action,new_values)
  VALUES(auth.uid(),p_user_id,'access_configuration',jsonb_build_object(
    'previous_role',v_target_role,'role',p_role,'organization_id',v_effective_org,'collector_id',p_collector_id
  ));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_definir_capacite_utilisateur(
  p_user_id uuid,p_capability_code text,p_allowed boolean,p_reason text,
  p_valid_until timestamptz DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_role text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('snp-account-administration',0));
  PERFORM 1 FROM public.user_profiles WHERE id IN(auth.uid(),p_user_id) ORDER BY id FOR UPDATE;
  IF NOT public.snp_peut_administrer_compte(p_user_id) THEN
    RAISE EXCEPTION 'Hiérarchie de compte refusée.' USING ERRCODE='42501';
  END IF;
  SELECT role INTO v_role FROM public.user_profiles WHERE id=p_user_id;
  IF v_role='owner' OR p_capability_code='accounts.manage' OR EXISTS(
    SELECT 1 FROM public.snp_responsibility_catalog catalog WHERE capability_code=p_capability_code
      AND (catalog.requires_explicit_assignment OR EXISTS(
        SELECT 1 FROM public.snp_role_responsibility_ceiling ceiling
        WHERE ceiling.role=v_role AND ceiling.responsibility_code=catalog.code
      ))
  ) THEN
    RAISE EXCEPTION 'Utilisez la configuration sécurisée du rôle et des responsabilités.' USING ERRCODE='42501';
  END IF;
  IF p_allowed IS NULL OR p_reason IS NULL OR length(trim(p_reason))<10
    OR (p_valid_until IS NOT NULL AND p_valid_until<=now()) THEN
    RAISE EXCEPTION 'Attribution, justification ou échéance invalide.' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.snp_capability_catalog WHERE code=p_capability_code)
    OR (p_allowed AND NOT EXISTS(
      SELECT 1 FROM public.snp_role_capabilities WHERE role=v_role AND capability_code=p_capability_code
    )) THEN
    RAISE EXCEPTION 'Capacité inconnue ou hors plafond du rôle.' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.snp_user_capabilities(user_id,capability_code,allowed,valid_from,valid_until,reason,granted_by,granted_at)
  VALUES(p_user_id,p_capability_code,p_allowed,now(),p_valid_until,trim(p_reason),auth.uid(),now())
  ON CONFLICT(user_id,capability_code) DO UPDATE SET
    allowed=EXCLUDED.allowed,valid_from=EXCLUDED.valid_from,valid_until=EXCLUDED.valid_until,
    reason=EXCLUDED.reason,granted_by=EXCLUDED.granted_by,granted_at=EXCLUDED.granted_at;
  PERFORM public.snp_sessions_revoquer_toutes(p_user_id,false,'Révocation après modification de capacité');
  PERFORM public.snp_record_workflow_event('account-capability',p_user_id,
    CASE WHEN p_allowed THEN 'capability-granted' ELSE 'capability-denied' END,
    NULL,p_capability_code,'accounts.manage',p_reason,
    jsonb_build_object('allowed',p_allowed,'valid_until',p_valid_until));
END;
$fn$;


-- Les ACL existantes des fonctions remplacées sont conservées.
DO $postflight$
BEGIN
  IF (SELECT count(*) FROM public.snp_role_responsibility_ceiling
      WHERE role='comptoir' AND responsibility_code IN(
        'comptoir.invoices.issue','comptoir.payments.execute','comptoir.payments.reconcile','comptoir.tax.execute'))<>4
    OR NOT EXISTS(SELECT 1 FROM public.snp_responsibility_conflicts
      WHERE left_code='comptoir.payments.execute' AND right_code='comptoir.payments.reconcile') THEN
    RAISE EXCEPTION 'Raccordement financier Comptoir incomplet.';
  END IF;
END;
$postflight$;
NOTIFY pgrst,'reload schema';
COMMIT;
