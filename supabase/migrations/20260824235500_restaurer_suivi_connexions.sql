-- Restaure uniquement le suivi serveur de la dernière connexion.
--
-- Une ancienne migration de sécurisation contient déjà cette fonction mais
-- n'a pas été appliquée sur l'instance de production. Cette migration ciblée,
-- idempotente et sans modification de données rétablit l'API utilisée après
-- authentification sans réexécuter les migrations historiques non alignées.

CREATE OR REPLACE FUNCTION public.snp_enregistrer_connexion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Aucune session authentifiée.' USING ERRCODE = '28000';
  END IF;

  UPDATE public.user_profiles
  SET last_login_at = now(),
      failed_login_attempts = 0,
      updated_at = now()
  WHERE id = auth.uid();
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_enregistrer_connexion() FROM public;
GRANT EXECUTE ON FUNCTION public.snp_enregistrer_connexion() TO authenticated;
