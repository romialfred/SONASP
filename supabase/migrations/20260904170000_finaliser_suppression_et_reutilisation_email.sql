-- Suppression de compte : certifier la disparition Auth, purger les secrets et
-- rattachements techniques résiduels, puis seulement libérer l'adresse e-mail.

BEGIN;

DO $preflight$
DECLARE v_missing text;
BEGIN
  SELECT string_agg(required_name, ', ' ORDER BY required_name) INTO v_missing
  FROM (VALUES
    ('public.snp_account_lifecycle_audit', to_regclass('public.snp_account_lifecycle_audit') IS NOT NULL),
    ('public.user_profiles', to_regclass('public.user_profiles') IS NOT NULL),
    ('public.snp_account_creation_operations', to_regclass('public.snp_account_creation_operations') IS NOT NULL),
    ('public.snp_rpc_execution_allowlist', to_regclass('public.snp_rpc_execution_allowlist') IS NOT NULL),
    ('public.snp_admin_compte_finaliser_action(uuid,boolean,text)',
      to_regprocedure('public.snp_admin_compte_finaliser_action(uuid,boolean,text)') IS NOT NULL)
  ) required(required_name, present)
  WHERE NOT present;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Préflight finalisation suppression incomplet : %.', v_missing;
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.snp_admin_compte_finaliser_suppression(
  p_idempotency_key uuid,
  p_target_email text
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_action public.snp_account_lifecycle_audit%ROWTYPE;
  v_email text:=lower(trim(coalesce(p_target_email,'')));
  v_removed integer:=0;
  v_count integer:=0;
  v_entry record;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'Finalisation réservée au service Edge.' USING ERRCODE='42501';
  END IF;
  IF p_idempotency_key IS NULL
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR length(v_email)>254 THEN
    RAISE EXCEPTION 'Finalisation de suppression invalide.' USING ERRCODE='22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
  SELECT * INTO v_action
  FROM public.snp_account_lifecycle_audit
  WHERE idempotency_key=p_idempotency_key
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action introuvable.' USING ERRCODE='P0002';
  END IF;
  IF v_action.action<>'delete' OR v_action.status NOT IN ('db_completed','completed') THEN
    RAISE EXCEPTION 'Transition de suppression invalide.' USING ERRCODE='55000';
  END IF;

  -- L'e-mail n'est déclaré réutilisable que si GoTrue ne conserve ni la cible
  -- ni une autre identité portant la même adresse normalisée.
  IF EXISTS(
    SELECT 1 FROM auth.users utilisateur
    WHERE utilisateur.id=v_action.target_id
       OR lower(trim(coalesce(utilisateur.email,'')))=v_email
  ) THEN
    RAISE EXCEPTION 'L''identité Auth existe encore.' USING ERRCODE='55000';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.user_profiles profil
    WHERE profil.id=v_action.target_id OR lower(trim(profil.email))=v_email
  ) THEN
    RAISE EXCEPTION 'Le profil utilisateur existe encore.' USING ERRCODE='55000';
  END IF;

  -- Ces tables contiennent des secrets ou des rattachements d'accès, jamais
  -- une preuve métier. Les journaux d'audit sont volontairement conservés.
  FOR v_entry IN
    SELECT * FROM (VALUES
      ('snp_account_creation_operations','auth_user_id'),
      ('password_history','user_id'),
      ('user_2fa_setup','user_id'),
      ('user_activation_tokens','user_id'),
      ('user_capabilities','user_id'),
      ('user_capability_overrides','user_id'),
      ('user_permissions','user_id'),
      ('user_sessions','user_id'),
      ('user_site_assignments','user_id'),
      ('artisanal_site_assignments','user_id'),
      ('snp_user_capabilities','user_id'),
      ('snp_user_organization_memberships','user_id'),
      ('snp_notifications','destinataire_id'),
      ('snp_collector_accounts','user_id')
    ) AS entries(table_name,column_name)
  LOOP
    IF to_regclass(format('public.%I',v_entry.table_name)) IS NOT NULL
       AND EXISTS(
         SELECT 1 FROM pg_catalog.pg_attribute attribute
         WHERE attribute.attrelid=to_regclass(format('public.%I',v_entry.table_name))
           AND attribute.attname=v_entry.column_name
           AND attribute.attnum>0 AND NOT attribute.attisdropped
       ) THEN
      EXECUTE format('DELETE FROM public.%I WHERE %I=$1',
        v_entry.table_name,v_entry.column_name)
      USING v_action.target_id;
      GET DIAGNOSTICS v_count=ROW_COUNT;
      v_removed:=v_removed+v_count;
    END IF;
  END LOOP;

  IF to_regclass('public.user_invitations') IS NOT NULL THEN
    DELETE FROM public.user_invitations invitation
    WHERE lower(trim(invitation.email))=v_email;
    GET DIAGNOSTICS v_count=ROW_COUNT;
    v_removed:=v_removed+v_count;
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.snp_account_creation_operations operation
    WHERE operation.auth_user_id=v_action.target_id
  ) THEN
    RAISE EXCEPTION 'Une opération de création résiduelle bloque la recréation.' USING ERRCODE='55000';
  END IF;

  IF v_action.status='db_completed' THEN
    UPDATE public.snp_account_lifecycle_audit
    SET status='completed',external_success=true,external_error_code=NULL,
        finalized_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE id=v_action.id;
  END IF;

  RETURN jsonb_build_object(
    'action_id',v_action.id,
    'target_id',v_action.target_id,
    'status','completed',
    'replayed',v_action.status='completed',
    'email_reusable',true,
    'technical_records_removed',v_removed
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_admin_compte_finaliser_suppression(uuid,text)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.snp_admin_compte_finaliser_suppression(uuid,text)
TO service_role;

-- Cette fonction est appelée exclusivement par l'Edge Function avec la clé de
-- service. Elle ne doit pas intégrer l'allowlist des RPC exposées au navigateur,
-- dont la contrainte n'autorise volontairement que le rôle authenticated.
DELETE FROM public.snp_rpc_execution_allowlist
WHERE function_signature=
  'public.snp_admin_compte_finaliser_suppression(uuid,text)'::regprocedure::text;

DO $postflight$
DECLARE v_definition text;
BEGIN
  v_definition:=lower(pg_get_functiondef(
    'public.snp_admin_compte_finaliser_suppression(uuid,text)'::regprocedure
  ));
  IF has_function_privilege('anon',
       'public.snp_admin_compte_finaliser_suppression(uuid,text)','EXECUTE')
     OR has_function_privilege('authenticated',
       'public.snp_admin_compte_finaliser_suppression(uuid,text)','EXECUTE')
     OR NOT has_function_privilege('service_role',
       'public.snp_admin_compte_finaliser_suppression(uuid,text)','EXECUTE')
     OR position('from auth.users' IN v_definition)=0
     OR position('email_reusable' IN v_definition)=0
     OR EXISTS(
       SELECT 1 FROM public.snp_rpc_execution_allowlist
       WHERE function_signature=
         'public.snp_admin_compte_finaliser_suppression(uuid,text)'::regprocedure::text
     ) THEN
    RAISE EXCEPTION 'Postflight finalisation suppression incomplet.';
  END IF;
END;
$postflight$;

COMMIT;
