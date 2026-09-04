-- Complète l'audit des accès avec un référentiel serveur des acteurs observés.
-- La liste est calculée depuis les journaux existants : aucune identité fictive
-- et aucune lecture directe des tables sensibles n'est exposée au navigateur.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.snp_access_audit_log') IS NULL
    OR to_regclass('public.snp_account_admin_audit') IS NULL
    OR to_regclass('public.audit_logs') IS NULL
    OR to_regprocedure('public.snp_access_admin_authorized(boolean,boolean)') IS NULL
    OR to_regprocedure('public.snp_actor_has_capability(text)') IS NULL
  THEN
    RAISE EXCEPTION 'Préflight filtre acteurs de l’audit : socle IAM incomplet.';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.snp_access_audit_actors()
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  event_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF NOT public.snp_access_admin_authorized(false,false)
    OR NOT public.snp_actor_has_capability('reports.read') THEN
    RAISE EXCEPTION 'Consultation des acteurs de l’audit non autorisée.' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  WITH observed AS (
    SELECT audit.actor_id, audit.actor_email
    FROM public.snp_access_audit_log audit
    WHERE audit.actor_id IS NOT NULL
    UNION ALL
    SELECT account.actor_id, actor.email
    FROM public.snp_account_admin_audit account
    LEFT JOIN public.user_profiles actor ON actor.id=account.actor_id
    WHERE account.actor_id IS NOT NULL
    UNION ALL
    SELECT legacy.user_id, legacy.user_email
    FROM public.audit_logs legacy
    WHERE legacy.user_id IS NOT NULL
  ), aggregated AS (
    SELECT observed.actor_id,
      max(nullif(trim(observed.actor_email),'')) AS observed_email,
      count(*)::bigint AS event_count
    FROM observed
    GROUP BY observed.actor_id
  )
  SELECT aggregated.actor_id,
    coalesce(profile.email,aggregated.observed_email),
    profile.full_name,
    aggregated.event_count
  FROM aggregated
  LEFT JOIN public.user_profiles profile ON profile.id=aggregated.actor_id
  ORDER BY coalesce(nullif(trim(profile.full_name),''),profile.email,aggregated.observed_email,aggregated.actor_id::text);
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_access_audit_actors() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_access_audit_actors() TO authenticated;

COMMENT ON FUNCTION public.snp_access_audit_actors() IS
  'Liste les acteurs présents dans les journaux pour alimenter le filtre exact de l’audit des accès.';

DO $postflight$
BEGIN
  IF to_regprocedure('public.snp_access_audit_actors()') IS NULL
    OR has_function_privilege('anon','public.snp_access_audit_actors()','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.snp_access_audit_actors()','EXECUTE')
  THEN
    RAISE EXCEPTION 'Postflight filtre acteurs de l’audit : contrat incomplet.';
  END IF;
END;
$postflight$;

COMMIT;
