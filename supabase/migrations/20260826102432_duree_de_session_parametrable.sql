-- La duree d'inactivite avant expiration devient un parametre de plateforme.
--
-- CONSTAT
-- Dix minutes etaient ecrites en dur a deux endroits qui devaient s'accorder :
-- la constante SESSION_INACTIVITY_TIMEOUT_MS du navigateur, et
-- « interval '10 minutes' » dans snp_session_current_expiry(). Cette derniere
-- sert a la fois a l'enregistrement de la session et au battement d'activite :
-- c'est elle qui decide reellement. Un changement cote navigateur seul aurait
-- affiche vingt minutes tout en faisant expirer la session a dix.
--
-- CE QUI EST BORNE, ET POURQUOI
-- La valeur est ramenee dans [5, 120] minutes a la lecture, jamais seulement a
-- l'ecriture : une valeur aberrante deja presente en base ne peut donc pas
-- produire une session perpetuelle. En deca de cinq minutes la plateforme
-- devient inutilisable ; au-dela de deux heures, un poste laisse ouvert sur une
-- plateforme nationale reste une exposition reelle. L'echeance demeure par
-- ailleurs plafonnee par l'expiration du JWT, comme auparavant.
--
-- ECRITURE
-- La table system_parameters porte une politique d'ecriture reservee au role
-- 'management', qu'aucun compte ne detient aujourd'hui : le parametre serait
-- donc immodifiable. L'ecriture passe par une procedure de confiance, qui
-- verifie l'authentification forte et une capacite dediee, puis journalise.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Capacites
-- ---------------------------------------------------------------------------

INSERT INTO public.snp_capability_catalog (code, domain, label, description, sensitive)
VALUES
  ('platform.settings.read', 'administration', 'Consulter les paramètres de la plateforme',
   'Lire les paramètres généraux, dont la durée de session.', false),
  ('platform.settings.manage', 'administration', 'Administrer les paramètres de la plateforme',
   'Modifier les paramètres généraux, dont la durée de session.', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.snp_role_capabilities (role, capability_code)
VALUES
  ('management', 'platform.settings.read'),
  ('management', 'platform.settings.manage'),
  ('admin', 'platform.settings.read'),
  ('admin', 'platform.settings.manage'),
  ('manager', 'platform.settings.read')
ON CONFLICT (role, capability_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Le parametre lui-meme
-- ---------------------------------------------------------------------------

INSERT INTO public.system_parameters (
  parameter_key, parameter_value, parameter_type, category, description,
  display_order, is_active
) VALUES (
  'session_inactivity_timeout_minutes', '20', 'numeric', 'securite',
  'Durée d''inactivité avant déconnexion automatique, en minutes. Bornée à 5 minutes au minimum et 120 au maximum.',
  10, true
)
ON CONFLICT (parameter_key) DO UPDATE SET
  parameter_value = EXCLUDED.parameter_value,
  parameter_type = EXCLUDED.parameter_type,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. Lecture bornee
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.snp_session_timeout_minutes()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  SELECT greatest(5, least(120, coalesce(
    (
      SELECT floor(p.parameter_value::numeric)::integer
      FROM public.system_parameters p
      WHERE p.parameter_key = 'session_inactivity_timeout_minutes'
        AND p.is_active
        AND p.parameter_value ~ '^[0-9]+(\.[0-9]+)?$'
      LIMIT 1
    ),
    10
  )));
$function$;

COMMENT ON FUNCTION public.snp_session_timeout_minutes() IS
  'Durée d''inactivité retenue, bornée à [5, 120] minutes. Une valeur absente, non numérique ou aberrante retombe sur 10 minutes.';

-- ---------------------------------------------------------------------------
-- 4. L'echeance de session s'y adosse
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.snp_session_current_expiry()
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE v_exp_text text; v_jwt_exp timestamptz;
BEGIN
  v_exp_text:=auth.jwt()->>'exp';
  IF v_exp_text IS NULL OR v_exp_text !~ '^[0-9]{9,12}$' THEN
    RAISE EXCEPTION 'Claim JWT exp absent ou invalide.' USING ERRCODE='22023';
  END IF;
  v_jwt_exp:=to_timestamp(v_exp_text::double precision);
  IF v_jwt_exp<=clock_timestamp() THEN
    RAISE EXCEPTION 'JWT expiré.' USING ERRCODE='42501';
  END IF;
  RETURN least(
    v_jwt_exp,
    clock_timestamp() + make_interval(mins => public.snp_session_timeout_minutes())
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Lecture pour le navigateur
-- ---------------------------------------------------------------------------
-- Le minuteur local doit connaitre la meme borne que le serveur, sans quoi
-- l'ecran annoncerait une duree que la base ne respecte pas.

CREATE OR REPLACE FUNCTION public.snp_parametres_session_lire()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'inactivite_minutes', public.snp_session_timeout_minutes(),
    'minimum_minutes', 5,
    'maximum_minutes', 120
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Ecriture
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.snp_parametre_session_definir(p_minutes integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
  v_ancien integer;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Une authentification forte est requise.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.snp_actor_has_capability('platform.settings.manage') THEN
    RAISE EXCEPTION 'Vous n''êtes pas habilité à modifier les paramètres de la plateforme.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor FROM public.user_profiles WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil actif introuvable.' USING ERRCODE = '42501';
  END IF;

  IF p_minutes IS NULL OR p_minutes < 5 OR p_minutes > 120 THEN
    RAISE EXCEPTION
      'La durée d''inactivité doit être comprise entre 5 et 120 minutes (reçu : %).',
      coalesce(p_minutes::text, 'aucune valeur')
      USING ERRCODE = '22023';
  END IF;

  v_ancien := public.snp_session_timeout_minutes();

  UPDATE public.system_parameters
  SET parameter_value = p_minutes::text,
      updated_by = v_actor.id,
      updated_at = now(),
      is_active = true
  WHERE parameter_key = 'session_inactivity_timeout_minutes';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Le paramètre de durée de session est absent du référentiel.'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, action, module, details, status)
  VALUES (
    v_actor.id, v_actor.email, 'parametre_session_modifie', 'securite',
    format('Durée d''inactivité portée de %s à %s minutes.', v_ancien, p_minutes),
    'success'
  );

  RETURN jsonb_build_object(
    'inactivite_minutes', public.snp_session_timeout_minutes(),
    'ancienne_valeur_minutes', v_ancien
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Droits
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.snp_session_timeout_minutes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_parametres_session_lire() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_parametre_session_definir(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_session_timeout_minutes() FROM anon;
REVOKE ALL ON FUNCTION public.snp_parametres_session_lire() FROM anon;
REVOKE ALL ON FUNCTION public.snp_parametre_session_definir(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.snp_parametres_session_lire() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_parametre_session_definir(integer) TO authenticated;

-- La table conservait INSERT, UPDATE et DELETE pour anon. RLS l'en empechait,
-- mais le privilege n'a aucune raison d'exister : aucune vitrine publique
-- n'ecrit un parametre de plateforme.
REVOKE INSERT, UPDATE, DELETE ON public.system_parameters FROM anon;

-- ---------------------------------------------------------------------------
-- 8. Controles
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_minutes integer;
  v_anon_ecrit integer;
BEGIN
  v_minutes := public.snp_session_timeout_minutes();
  IF v_minutes <> 20 THEN
    RAISE EXCEPTION 'Postflight : la durée retenue est % minutes au lieu de 20.', v_minutes;
  END IF;

  SELECT count(*) INTO v_anon_ecrit
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'system_parameters'
    AND grantee = 'anon' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
  IF v_anon_ecrit > 0 THEN
    RAISE EXCEPTION 'Postflight : anon conserve % privilège(s) d''écriture.', v_anon_ecrit;
  END IF;

  IF pg_get_functiondef(
       (SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'snp_session_current_expiry')
     ) LIKE '%interval ''10 minutes''%' THEN
    RAISE EXCEPTION 'Postflight : l''échéance de session code encore dix minutes en dur.';
  END IF;
END;
$$;

COMMIT;
