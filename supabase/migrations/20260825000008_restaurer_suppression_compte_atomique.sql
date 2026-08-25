-- Restaure la suppression en une action sans relâcher les contrôles du lot 2M.
-- L'absence d'activité est vérifiée avant toute mutation ; la désactivation et
-- la révocation des sessions sont ensuite réalisées dans la même transaction.

DO $preflight$
BEGIN
  IF to_regprocedure(
    'public.snp_admin_compte_preparer_suppression(uuid,bigint,text,uuid)'
  ) IS NULL OR to_regprocedure(
    'public.snp_2m_account_business_activity(uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'Préflight suppression atomique : lot 2M absent.';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.snp_admin_compte_preparer_suppression(
  p_target_id uuid,p_expected_version bigint,p_reason text,p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_actor uuid:=auth.uid(); v_actor_role text; v_target public.user_profiles%ROWTYPE;
  v_payload jsonb; v_hash bytea; v_existing public.snp_account_lifecycle_audit%ROWTYPE;
  v_action_id uuid; v_revoked integer:=0; v_blockers jsonb;
  v_result_version bigint; v_previous_status_guc text;
BEGIN
  v_actor_role:=public.snp_2m_require_account_admin();
  IF p_idempotency_key IS NULL OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Paramètres de suppression invalides.' USING ERRCODE='22023';
  END IF;
  v_payload:=jsonb_build_object('target_id',p_target_id,'expected_version',p_expected_version,
    'reason',trim(p_reason));
  v_hash:=extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256');
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
  SELECT * INTO v_existing FROM public.snp_account_lifecycle_audit
  WHERE idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.actor_id<>v_actor OR v_existing.target_id<>p_target_id
       OR v_existing.action<>'delete' OR v_existing.payload_hash<>v_hash THEN
      RAISE EXCEPTION 'Clé d''idempotence réutilisée avec un autre payload.' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('action_id',v_existing.id,'target_id',v_existing.target_id,
      'target_version',v_existing.previous_version,'status',v_existing.status,'replayed',true);
  END IF;

  -- La hiérarchie, le compte courant et le propriétaire restent protégés.
  -- La cible peut être active : elle ne sera désactivée qu'après ce contrôle
  -- métier autoritatif, dans la transaction qui prépare sa suppression.
  v_target:=public.snp_2m_assert_target(p_target_id,p_expected_version,v_actor_role,false);
  v_blockers:=public.snp_2m_account_business_activity(p_target_id);
  IF jsonb_array_length(v_blockers)>0 THEN
    RAISE EXCEPTION 'Le compte possède une activité métier.' USING ERRCODE='23503';
  END IF;

  INSERT INTO public.snp_account_lifecycle_audit(
    idempotency_key,actor_id,target_id,action,status,request_payload,payload_hash,reason,
    previous_version,previous_active,result_version,result_active
  ) VALUES(p_idempotency_key,v_actor,p_target_id,'delete','authorized',v_payload,v_hash,
    trim(p_reason),v_target.version,v_target.is_active,v_target.version,v_target.is_active)
  RETURNING id INTO v_action_id;

  IF v_target.is_active THEN
    v_previous_status_guc:=current_setting('snp.account_status_rpc',true);
    PERFORM set_config('snp.account_status_rpc','on',true);
    BEGIN
      UPDATE public.user_profiles
      SET is_active=false,updated_at=clock_timestamp()
      WHERE id=p_target_id
      RETURNING version INTO v_result_version;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('snp.account_status_rpc',coalesce(v_previous_status_guc,''),true);
      RAISE;
    END;
    PERFORM set_config('snp.account_status_rpc',coalesce(v_previous_status_guc,''),true);

    INSERT INTO public.snp_comptes_audit(
      acteur_id,cible_id,action,ancien_etat,nouvel_etat,motif
    ) VALUES(v_actor,p_target_id,'desactivation',true,false,trim(p_reason));
  ELSE
    v_result_version:=v_target.version;
  END IF;

  v_revoked:=public.snp_sessions_revoquer_toutes(p_target_id,false,trim(p_reason));
  UPDATE public.snp_account_lifecycle_audit SET status='db_completed',
    result_version=v_result_version,result_active=false,
    application_sessions_revoked=v_revoked,db_completed_at=clock_timestamp(),updated_at=clock_timestamp()
  WHERE id=v_action_id;
  RETURN jsonb_build_object('action_id',v_action_id,'target_id',p_target_id,
    'target_version',v_target.version,'result_version',v_result_version,
    'status','db_completed','replayed',false,'target_deactivated',v_target.is_active,
    'application_sessions_revoked',v_revoked);
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_admin_compte_preparer_suppression(uuid,bigint,text,uuid)
FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.snp_admin_compte_preparer_suppression(uuid,bigint,text,uuid)
TO authenticated;

DO $postflight$
DECLARE v_definition text;
BEGIN
  v_definition:=regexp_replace(lower(pg_get_functiondef(
    'public.snp_admin_compte_preparer_suppression(uuid,bigint,text,uuid)'::regprocedure
  )),'\s+','','g');
  IF position('snp_2m_assert_target(p_target_id,p_expected_version,v_actor_role,false)'
    IN v_definition)=0 OR position('updatepublic.user_profilessetis_active=false' IN v_definition)=0 THEN
    RAISE EXCEPTION 'Postflight suppression atomique : contrat de cible invalide.';
  END IF;
END;
$postflight$;
