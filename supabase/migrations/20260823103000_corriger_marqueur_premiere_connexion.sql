-- Le changement du secret est effectue par GoTrue dans auth.users. Le profil
-- applicatif doit cesser d'exiger le mot de passe uniquement apres cette
-- ecriture reelle, jamais sur une simple demande du navigateur.
CREATE OR REPLACE FUNCTION public.snp_consigner_changement_mot_de_passe_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $fn$
BEGIN
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    UPDATE public.user_profiles
    SET must_change_password = false,
        password_changed_at = now(),
        updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_consigner_changement_mot_de_passe_auth() FROM public;

DROP TRIGGER IF EXISTS trg_snp_changement_mot_de_passe ON auth.users;
CREATE TRIGGER trg_snp_changement_mot_de_passe
  AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.snp_consigner_changement_mot_de_passe_auth();

-- Repare uniquement les parcours deja termines pendant l'absence du trigger :
-- le facteur doit exister, etre TOTP et avoir ete verifie par GoTrue.
UPDATE public.user_profiles AS profil
SET must_change_password = false,
    password_changed_at = COALESCE(profil.password_changed_at, utilisateur.updated_at, now()),
    updated_at = now()
FROM auth.users AS utilisateur
WHERE profil.id = utilisateur.id
  AND COALESCE(profil.must_change_password, false)
  AND profil.mfa_enrolled_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM auth.mfa_factors AS facteur
    WHERE facteur.user_id = profil.id
      AND facteur.factor_type = 'totp'
      AND facteur.status = 'verified'
  );
