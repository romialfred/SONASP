-- IAM : administration Owner, protections anti-auto-élévation et mutations canoniques.
-- Schéma source vérifié en lecture seule le 30/08/2026. Aucune donnée métier modifiée.
BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.snp_configurer_acces_compte(uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb)') IS NULL
    OR to_regprocedure('public.snp_session_est_active()') IS NULL
    OR to_regclass('public.snp_account_admin_audit') IS NULL THEN
    RAISE EXCEPTION 'Socle IAM/session requis avant ce correctif.';
  END IF;
END;
$preflight$;

-- La contrainte publiée avait été ramenée aux anciens rôles : le formulaire
-- proposait Comptoir/DGI/DGMG/Collecteur mais PostgreSQL refusait leur création.
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (
  role IN('owner','admin','management','manager','dgmg','dgi','mine','comptoir','collector',
    'factory','airport','refinery','customer')
);

-- Restaurer uniquement les droits de lecture transversaux déjà définis par le
-- référentiel institutionnel, sans attribuer de responsabilité opérationnelle.
INSERT INTO public.snp_role_capabilities(role,capability_code)
SELECT expected.role,expected.capability FROM (VALUES
 ('dgmg','reports.read'),('dgi','reports.read'),('dgi','reconciliation.read'),('dgi','tax.rules.read')
) expected(role,capability) JOIN public.snp_capability_catalog catalog ON catalog.code=expected.capability
ON CONFLICT DO NOTHING;

-- Les privilèges de table historiques ouvraient encore les champs de sécurité.
-- Le titulaire conserve uniquement ses coordonnées/préférences personnelles.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.user_profiles FROM PUBLIC,anon,authenticated;
GRANT UPDATE(full_name,phone,language,email_notifications,approval_notifications,
  language_preference,timezone,profile_picture_url) ON public.user_profiles TO authenticated;
DROP POLICY IF EXISTS snp_profile_self_update_only ON public.user_profiles;
CREATE POLICY snp_profile_self_update_only ON public.user_profiles AS RESTRICTIVE
  FOR UPDATE TO authenticated USING(id=auth.uid() AND is_active) WITH CHECK(id=auth.uid() AND is_active);

REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON
  public.user_permissions,public.snp_user_capabilities,public.snp_user_responsibilities
  FROM PUBLIC,anon,authenticated;
DO $permissions_policies$
DECLARE item record;
BEGIN
  FOR item IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='user_permissions' AND cmd<>'SELECT'
  LOOP EXECUTE format('DROP POLICY %I ON public.user_permissions',item.policyname); END LOOP;
END;
$permissions_policies$;

-- Ne pas assimiler « pas encore enrôlé » à « MFA satisfaite ». L'enrôlement
-- personnel conserve ses RPC dédiées, sans ouvrir les opérations métier.
CREATE OR REPLACE FUNCTION public.snp_mfa_satisfaite()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT public.snp_aal()='aal2' AND EXISTS(
    SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active AND mfa_enrolled_at IS NOT NULL
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_peut_administrer_compte(p_target_id uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT public.snp_actor_has_capability('accounts.manage')
    AND public.snp_session_est_active() AND public.snp_mfa_satisfaite()
    AND p_target_id IS NOT NULL AND p_target_id<>auth.uid()
    AND EXISTS(
      SELECT 1 FROM public.user_profiles actor
      JOIN public.user_profiles target ON target.id=p_target_id
      WHERE actor.id=auth.uid() AND actor.is_active AND actor.mining_company_id IS NULL
        AND public.snp_niveau_role(target.role)>=0
        AND (actor.role='owner' OR (
          actor.role='admin' AND public.snp_niveau_role(target.role)<public.snp_niveau_role(actor.role)
        ))
    );
$fn$;

-- Le lecteur Owner doit également retrouver les comptes dans les listes liées.
DROP POLICY IF EXISTS snp_profiles_account_administration_read ON public.user_profiles;
CREATE POLICY snp_profiles_account_administration_read ON public.user_profiles FOR SELECT TO authenticated
  USING(public.snp_peut_administrer_compte(id));

UPDATE public.snp_access_role_policies SET is_legacy=false,updated_at=now() WHERE role='owner';

-- L'ancien trigger utilisait un autre format d'audit et annulait toute activation.
-- Conserver la trace dans le schéma réellement publié, sans désactiver le trigger.
CREATE OR REPLACE FUNCTION public.log_account_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    INSERT INTO public.audit_trail(action,table_name,record_id,user_email,details)
    VALUES(
      CASE WHEN NEW.is_active THEN 'account_activated' ELSE 'account_deactivated' END,
      'user_profiles',NEW.id::text,
      (SELECT email FROM public.user_profiles WHERE id=auth.uid()),
      jsonb_build_object('actor_id',auth.uid(),'old_values',jsonb_build_object('is_active',OLD.is_active),
        'new_values',jsonb_build_object('is_active',NEW.is_active))
    );
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.log_account_status_change() FROM PUBLIC,anon,authenticated;

-- INVOKER : current_user distingue une écriture REST d'un RPC SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.snp_verrouiller_owner_interactif()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF coalesce(auth.role(),'')<>'authenticated' THEN RETURN NEW; END IF;
  IF (TG_OP='INSERT' AND NEW.role='owner') OR (TG_OP='UPDATE' AND (
    (NEW.role IS DISTINCT FROM OLD.role AND (NEW.role='owner' OR OLD.role='owner'))
    OR (OLD.role='owner' AND NEW.is_active IS DISTINCT FROM OLD.is_active)
  )) THEN
    IF current_user IN('anon','authenticated') OR NEW.id=auth.uid()
      OR NOT public.snp_actor_has_capability('accounts.manage')
      OR NOT public.snp_mfa_satisfaite()
      OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='owner' AND is_active) THEN
      RAISE EXCEPTION 'Seul un autre Owner peut administrer ce rôle via le parcours sécurisé.' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

-- Un accès sessions.manage implicite ne permet pas à Admin de révoquer Owner.
CREATE OR REPLACE FUNCTION public.snp_session_require_access(p_user_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF coalesce(auth.role(),'')='service_role' THEN RETURN; END IF;
  PERFORM public.snp_session_require_active_actor();
  PERFORM public.snp_require_active_session();
  IF p_user_id=auth.uid() THEN
    IF NOT public.snp_mfa_satisfaite() THEN
      RAISE EXCEPTION 'AAL2 requis pour administrer les sessions.' USING ERRCODE='42501';
    END IF;
  ELSIF NOT public.snp_peut_administrer_compte(p_user_id) THEN
    RAISE EXCEPTION 'Hiérarchie de compte refusée pour les sessions.' USING ERRCODE='42501';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_remplacer_habilitations_compte(p_user_id uuid,p_habilitations jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('snp-account-administration',0));
  PERFORM 1 FROM public.user_profiles WHERE id IN(auth.uid(),p_user_id) ORDER BY id FOR UPDATE;
  IF NOT public.snp_peut_administrer_compte(p_user_id) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier les habilitations de ce compte.' USING ERRCODE='42501';
  END IF;
  IF p_habilitations IS NULL OR jsonb_typeof(p_habilitations)<>'array' OR jsonb_array_length(p_habilitations)>200 THEN
    RAISE EXCEPTION 'Le format des habilitations est invalide.' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.user_profiles WHERE id=p_user_id AND role='owner') THEN
    IF EXISTS(
      SELECT 1 FROM jsonb_to_recordset(p_habilitations) item(
        module_id uuid,can_view boolean,can_create boolean,can_edit boolean,can_delete boolean,can_approve boolean,field_permissions jsonb
      ) LEFT JOIN public.modules module ON module.id=item.module_id
      WHERE module.id IS NULL OR NOT (
        coalesce(item.can_view,false) AND coalesce(item.can_create,false) AND coalesce(item.can_edit,false)
        AND coalesce(item.can_delete,false) AND coalesce(item.can_approve,false)
      ) OR coalesce(item.field_permissions,'{}'::jsonb)<>'{}'::jsonb
    ) THEN RAISE EXCEPTION 'Les droits Owner sont complets et ne peuvent pas être restreints.' USING ERRCODE='42501'; END IF;
    INSERT INTO public.user_permissions(
      user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,can_read,can_write,field_permissions,granted_by
    ) SELECT p_user_id,id,true,true,true,true,true,true,true,'{}'::jsonb,auth.uid() FROM public.modules
    ON CONFLICT(user_id,module_id) DO UPDATE SET
      can_view=true,can_create=true,can_edit=true,can_delete=true,can_approve=true,
      can_read=true,can_write=true,field_permissions='{}'::jsonb,granted_by=auth.uid(),updated_at=now();
    INSERT INTO public.snp_account_admin_audit(actor_id,target_id,action,new_values)
    VALUES(auth.uid(),p_user_id,'permissions_replace',jsonb_build_object('owner_full_access',true));
    RETURN;
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
  PERFORM public.snp_sessions_revoquer_toutes(p_user_id,false,'Révocation après modification des habilitations');
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

-- Compatibilité du service historique : aucune dérogation inter-compte au-dessus
-- de l'acteur, ni responsabilité métier attribuée sans le parcours de configuration.
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
    SELECT 1 FROM public.snp_responsibility_catalog WHERE capability_code=p_capability_code
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
REVOKE ALL ON FUNCTION public.snp_definir_capacite_utilisateur(uuid,text,boolean,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_definir_capacite_utilisateur(uuid,text,boolean,text,timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.snp_peut_administrer_compte(uuid),
  public.snp_configurer_acces_compte(uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb),
  public.snp_remplacer_habilitations_compte(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_peut_administrer_compte(uuid),
  public.snp_configurer_acces_compte(uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb),
  public.snp_remplacer_habilitations_compte(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.snp_verrouiller_owner_interactif() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.snp_session_require_access(uuid) FROM PUBLIC,anon,authenticated;

-- Anciens points d'entrée non utilisés par les écrans actuels : ils contournaient
-- la hiérarchie ou la cohérence rôle/organisation. Toutes les mutations de ces
-- champs passent désormais par snp_configurer_acces_compte, transactionnel.
REVOKE ALL ON FUNCTION public.snp_configurer_compte_portail(uuid,text,text,text,boolean,uuid),
  public.snp_assign_user_organization(uuid,uuid,text,text,boolean),
  public.snp_link_collector_account(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON
  public.snp_user_organization_memberships,public.snp_collector_accounts,
  public.snp_role_capabilities,public.snp_role_module_ceilings,
  public.snp_access_role_policies FROM PUBLIC,anon,authenticated;

DO $postflight$
BEGIN
  IF has_table_privilege('authenticated','public.user_permissions','UPDATE')
    OR has_table_privilege('authenticated','public.user_permissions','DELETE')
    OR has_column_privilege('authenticated','public.user_profiles','mfa_enrolled_at','UPDATE')
    OR has_column_privilege('authenticated','public.user_profiles','role','UPDATE')
    OR has_table_privilege('authenticated','public.user_profiles','INSERT') THEN
    RAISE EXCEPTION 'Privilèges directs sensibles encore ouverts.';
  END IF;
END;
$postflight$;
NOTIFY pgrst,'reload schema';
COMMIT;
