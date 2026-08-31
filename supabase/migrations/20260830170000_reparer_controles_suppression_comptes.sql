-- Correctif ciblé : ne désactive ni RLS, ni MFA, ni protection Owner/hiérarchie.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Inventaire explicitement relu. Une future dépendance non recensée doit toujours
-- bloquer la suppression : aucune synchronisation automatique à l'exécution.
WITH reviewed(table_name,column_name) AS (VALUES
 ('reserve_allocation_approvals','actor_id'),
 ('reserve_allocation_documents','uploaded_by'),
 ('reserve_allocation_events','actor_id'),
 ('reserve_allocations','created_by'),('reserve_allocations','updated_by'),
 ('snp_access_migration_review','resolved_by'),('snp_access_migration_review','user_id'),
 ('snp_artisan_infractions','created_by'),
 ('snp_avoirs_client','annule_par'),('snp_avoirs_client','created_by'),('snp_avoirs_client','rembourse_par'),
 ('snp_avoirs_imputations','impute_par'),('snp_calculs_fiscaux','calcule_par'),
 ('snp_conciliations','created_by'),('snp_conciliations','soumis_par'),
 ('snp_conciliations','updated_by'),('snp_conciliations','valide_par'),
 ('snp_conciliations_operation_ledger','actor_id'),('snp_conciliations_versions','acteur_id'),
 ('snp_decisions_approbation_audit','actor_id'),
 ('snp_grand_livre_commercial','created_by'),('snp_grand_livre_fiscal','created_by'),
 ('snp_regles_fiscales','abroge_par'),('snp_regles_fiscales','approuve_par'),('snp_regles_fiscales','cree_par'),
 ('snp_user_responsibilities','granted_by'),('snp_user_responsibilities','user_id'),
 ('snp_ventes_lots','released_by')
)
INSERT INTO public.snp_account_deletion_dependency_registry(
 schema_name,table_name,column_name,classification,constraint_name,
 referenced_schema_name,referenced_table_name,referenced_column_name,delete_action,source
)
SELECT i.schema_name,i.table_name,i.column_name,i.classification,i.constraint_name,
 i.referenced_schema_name,i.referenced_table_name,i.referenced_column_name,i.delete_action,i.source
FROM public.snp_2m_current_dependency_inventory() i
JOIN reviewed r USING(table_name,column_name) WHERE i.schema_name='public'
ON CONFLICT(schema_name,table_name,column_name) DO UPDATE SET
 classification=excluded.classification,constraint_name=excluded.constraint_name,
 referenced_schema_name=excluded.referenced_schema_name,
 referenced_table_name=excluded.referenced_table_name,
 referenced_column_name=excluded.referenced_column_name,
 delete_action=excluded.delete_action,source=excluded.source;

-- Une déconnexion personnelle n'est pas une opération métier. Seuls les deux
-- événements précis session.self sont exclus ; tout autre audit reste bloquant.
CREATE OR REPLACE FUNCTION public.snp_2m_account_business_activity(p_target_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v record; v_exists boolean; v_blockers jsonb:='[]'::jsonb;
BEGIN
 PERFORM public.snp_2m_assert_dependency_registry_complete();
 FOR v IN SELECT * FROM public.snp_account_deletion_dependency_registry
   WHERE classification IN ('blocking','mixed_audit') ORDER BY table_name,column_name
 LOOP
   IF to_regclass(format('%I.%I',v.schema_name,v.table_name)) IS NULL THEN
     RAISE EXCEPTION 'Dépendance enregistrée absente : %.%.',v.table_name,v.column_name USING ERRCODE='55000';
   END IF;
   IF v.classification='mixed_audit' AND v.table_name='snp_achats_audit' THEN
     EXECUTE format(
       'SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1 AND NOT (' ||
       'objet=''user_profiles'' AND action=ANY($2)) LIMIT 1)',
       v.schema_name,v.table_name,v.column_name
     ) INTO v_exists USING p_target_id,ARRAY[
       'compte_cree','compte_modifie','compte_desactive','compte_reactive',
       'mfa_enrole','mfa_reinitialise','mot_de_passe_modifie'];
   ELSIF v.schema_name='public' AND v.table_name='snp_workflow_audit' AND v.column_name='actor_id' THEN
     SELECT EXISTS(SELECT 1 FROM public.snp_workflow_audit w
       WHERE w.actor_id=p_target_id AND NOT coalesce(
         w.capability_code='session.self' AND (
           (w.aggregate_type='user-sessions' AND w.action='bulk-revoked' AND w.aggregate_id=p_target_id)
           OR (w.aggregate_type='user-session' AND w.action='revoked' AND EXISTS(
             SELECT 1 FROM public.user_sessions s WHERE s.id=w.aggregate_id AND s.user_id=p_target_id
           ))
         ),false)
     ) INTO v_exists;
   ELSE
     EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1 LIMIT 1)',
       v.schema_name,v.table_name,v.column_name) INTO v_exists USING p_target_id;
   END IF;
   IF v_exists THEN
     v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('table',v.table_name,'column',v.column_name));
     EXIT WHEN jsonb_array_length(v_blockers)>=20;
   END IF;
 END LOOP;
 RETURN v_blockers;
END;
$fn$;

-- Le trigger historique ciblait des colonnes qui n'existent plus. Conserver
-- la trace dans le vrai contrat audit_trail, sans désactiver le trigger.
CREATE OR REPLACE FUNCTION public.log_account_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
 IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
   INSERT INTO public.audit_trail(action,table_name,record_id,user_email,details)
   VALUES(CASE WHEN NEW.is_active THEN 'account_activated' ELSE 'account_deactivated' END,
     'user_profiles',NEW.id::text,
     (SELECT email FROM public.user_profiles WHERE id=auth.uid()),
     jsonb_build_object('actor_id',auth.uid(),
       'old_values',jsonb_build_object('is_active',OLD.is_active),
       'new_values',jsonb_build_object('is_active',NEW.is_active)));
 END IF;
 RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.log_account_status_change() FROM PUBLIC,anon,authenticated;

DO $postflight$
BEGIN
 PERFORM public.snp_2m_assert_dependency_registry_complete();
 IF has_function_privilege('anon','public.snp_admin_compte_preparer_suppression(uuid,bigint,text,uuid)','EXECUTE')
   OR has_function_privilege('service_role','public.snp_admin_compte_preparer_suppression(uuid,bigint,text,uuid)','EXECUTE')
   OR has_table_privilege('authenticated','public.snp_account_deletion_dependency_registry','UPDATE') THEN
   RAISE EXCEPTION 'Privilèges de suppression non conformes.';
 END IF;
END;
$postflight$;
COMMIT;
