-- Maintenance exceptionnelle expressément autorisée par l'opérateur.
-- Exécutée avec l'identité d'administration Supabase, sans JWT utilisateur forgé,
-- sans désactiver les contraintes/triggers/RLS et sans modifier les autres comptes.
-- Le lanceur ajoute BEGIN SERIALIZABLE et ROLLBACK (répétition) ou COMMIT (autorisé).
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE deletion_result(result jsonb) ON COMMIT DROP;
DO $delete_exact_account$
DECLARE
 target constant uuid := 'c7570144-0075-4cb0-8a59-4713c1ebe07f';
 expected_email constant text := 'otingueri@gmail.com';
 operation_id constant uuid := 'a2988a04-1f35-4b98-b583-28ac9a08c118';
 profile public.user_profiles%ROWTYPE;
 auth_email text;
 other_profiles_before text;
 other_profiles_after text;
 other_auth_before text;
 other_auth_after text;
 workflow_ids bigint[];
 security_ids uuid[];
 retained_admin_audit text;
 retained_purchase_audit text;
 active_sessions integer;
 deleted_count integer;
BEGIN
 IF auth.uid() IS NOT NULL OR coalesce(auth.role(),'') IN ('anon','authenticated') THEN
   RAISE EXCEPTION 'Canal de maintenance administrateur requis.';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sonasp-delete-'||target::text,0));
 SELECT email INTO auth_email FROM auth.users WHERE id=target FOR UPDATE;
 SELECT * INTO profile FROM public.user_profiles WHERE id=target FOR UPDATE;
 IF NOT FOUND OR lower(auth_email) IS DISTINCT FROM expected_email
   OR lower(profile.email) IS DISTINCT FROM expected_email OR profile.role<>'admin'
   OR profile.mining_company_id IS NOT NULL THEN
   RAISE EXCEPTION 'Identité ou rôle inattendu : aucune suppression.';
 END IF;
 IF (SELECT count(*) FROM auth.users WHERE lower(email)=expected_email)<>1
   OR (SELECT count(*) FROM public.user_profiles WHERE lower(email)=expected_email)<>1 THEN
   RAISE EXCEPTION 'Identité ambiguë : aucune suppression.';
 END IF;
 IF public.snp_2m_account_business_activity(target)<>'[]'::jsonb THEN
   RAISE EXCEPTION 'Activité métier présente : aucune suppression.';
 END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE owner::text=target::text OR owner_id=target::text) THEN
   RAISE EXCEPTION 'Documents détenus par le compte : aucune suppression.';
 END IF;
 SELECT md5(coalesce(string_agg(to_jsonb(p)::text,'|' ORDER BY id),'')) INTO other_profiles_before
 FROM public.user_profiles p WHERE id<>target;
 SELECT md5(coalesce(string_agg(id::text,'|' ORDER BY id),'')) INTO other_auth_before
 FROM auth.users WHERE id<>target;
 SELECT array_agg(id ORDER BY id) INTO workflow_ids FROM public.snp_workflow_audit WHERE actor_id=target;
 SELECT array_agg(id ORDER BY id) INTO security_ids FROM public.security_events WHERE user_id=target;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY id)::text,'')) INTO retained_admin_audit
 FROM public.snp_account_admin_audit a WHERE actor_id=target OR target_id=target;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(a))::text,'')) INTO retained_purchase_audit
 FROM public.snp_achats_audit a WHERE acteur_id=target;

 -- Conserver l'attribution des événements avant que leurs FK SET NULL s'appliquent.
 INSERT INTO public.audit_trail(action,table_name,record_id,details)
 VALUES('account_deletion_authorized','user_profiles',target::text,jsonb_build_object(
   'operation_id',operation_id,'channel','supabase_management_api',
   'database_session_user',session_user,'database_current_user',current_user,
   'reason','Suppression définitive expressément demandée et confirmée pour recréation du compte.',
   'target_email',expected_email,'target_role',profile.role,
   'retained_workflow_event_ids',coalesce(to_jsonb(workflow_ids),'[]'),
   'retained_security_event_ids',coalesce(to_jsonb(security_ids),'[]')));
 UPDATE public.user_profiles SET is_active=false WHERE id=target AND is_active;
 UPDATE public.user_sessions SET is_active=false,revoked_at=clock_timestamp(),
   revocation_reason='Suppression définitive du compte autorisée par administration de la base.'
 WHERE user_id=target AND is_active AND revoked_at IS NULL;
 GET DIAGNOSTICS active_sessions=ROW_COUNT;

 -- Ces deux tables Auth n'ont pas de FK user_id vers auth.users.
 DELETE FROM auth.refresh_tokens WHERE user_id=target::text;
 DELETE FROM auth.flow_state WHERE user_id=target;
 DELETE FROM auth.users WHERE id=target AND lower(email)=expected_email;
 GET DIAGNOSTICS deleted_count=ROW_COUNT;
 IF deleted_count<>1 OR EXISTS(SELECT 1 FROM auth.users WHERE id=target OR lower(email)=expected_email)
   OR EXISTS(SELECT 1 FROM public.user_profiles WHERE id=target OR lower(email)=expected_email)
   OR EXISTS(SELECT 1 FROM public.user_permissions WHERE user_id=target)
   OR EXISTS(SELECT 1 FROM public.snp_user_capabilities WHERE user_id=target)
   OR EXISTS(SELECT 1 FROM public.user_sessions WHERE user_id=target)
   OR EXISTS(SELECT 1 FROM auth.sessions WHERE user_id=target)
   OR EXISTS(SELECT 1 FROM auth.identities WHERE user_id=target)
   OR EXISTS(SELECT 1 FROM auth.mfa_factors WHERE user_id=target)
   OR EXISTS(SELECT 1 FROM auth.refresh_tokens WHERE user_id=target::text)
   OR EXISTS(SELECT 1 FROM auth.flow_state WHERE user_id=target) THEN
   RAISE EXCEPTION 'Postconditions de suppression non satisfaites : annulation.';
 END IF;
 IF (SELECT count(*) FROM public.snp_workflow_audit WHERE id=ANY(workflow_ids))<>coalesce(cardinality(workflow_ids),0)
   OR (SELECT count(*) FROM public.security_events WHERE id=ANY(security_ids))<>coalesce(cardinality(security_ids),0)
   OR retained_admin_audit IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY id)::text,''))
     FROM public.snp_account_admin_audit a WHERE actor_id=target OR target_id=target)
   OR retained_purchase_audit IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(a))::text,''))
     FROM public.snp_achats_audit a WHERE acteur_id=target) THEN
   RAISE EXCEPTION 'Historique altéré : annulation.';
 END IF;
 SELECT md5(coalesce(string_agg(to_jsonb(p)::text,'|' ORDER BY id),'')) INTO other_profiles_after
 FROM public.user_profiles p WHERE id<>target;
 SELECT md5(coalesce(string_agg(id::text,'|' ORDER BY id),'')) INTO other_auth_after
 FROM auth.users WHERE id<>target;
 IF other_profiles_before IS DISTINCT FROM other_profiles_after OR other_auth_before IS DISTINCT FROM other_auth_after THEN
   RAISE EXCEPTION 'Un autre compte a changé : annulation.';
 END IF;
 INSERT INTO public.audit_trail(action,table_name,record_id,details)
 VALUES('account_deleted','user_profiles',target::text,jsonb_build_object(
   'operation_id',operation_id,'channel','supabase_management_api',
   'sessions_revoked',active_sessions,'hard_deleted',true,'other_accounts_unchanged',true));
 INSERT INTO deletion_result VALUES(jsonb_build_object(
   'operation_id',operation_id,'deleted_user_id',target,'email',expected_email,
   'hard_deleted',true,'other_accounts_unchanged',true,'business_activity',0,
   'workflow_audits_preserved',coalesce(cardinality(workflow_ids),0),
   'security_events_preserved',coalesce(cardinality(security_ids),0),'access_records_remaining',0));
END;
$delete_exact_account$;
SELECT result FROM deletion_result;
