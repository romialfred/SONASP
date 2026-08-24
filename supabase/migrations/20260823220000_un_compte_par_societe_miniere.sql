-- Une société minière correspond à un seul compte de portail, qu'il soit actif
-- ou désactivé. La désactivation ne libère donc jamais silencieusement la mine.

DO $block$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE role = 'mine' AND mining_company_id IS NOT NULL
    GROUP BY mining_company_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Des sociétés minières possèdent déjà plusieurs comptes. Corrigez ces doublons avant d''appliquer la contrainte.'
      USING ERRCODE = '23505';
  END IF;
END;
$block$;

-- L'ancien index ne couvrait que les comptes actifs : désactiver un compte
-- permettait d'en créer un second. Le nouvel index couvre toute la durée de vie
-- du rattachement et constitue la garantie finale face aux requêtes concurrentes.
DROP INDEX IF EXISTS public.idx_user_profiles_compte_mine_actif_unique;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_mining_company_account
  ON public.user_profiles (mining_company_id)
  WHERE role = 'mine' AND mining_company_id IS NOT NULL;

COMMENT ON INDEX public.uq_user_profiles_mining_company_account IS
  'Garantit un seul compte de portail, actif ou non, par société minière.';

CREATE OR REPLACE FUNCTION public.snp_verrouiller_compte_societe_miniere()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NEW.role = 'mine' THEN
    IF NEW.mining_company_id IS NULL THEN
      RAISE EXCEPTION 'Un compte Société minière doit être rattaché à une société.'
        USING ERRCODE = '23514';
    END IF;

    -- Une clé de verrou par mine sérialise deux créations simultanées. L'index
    -- unique demeure la seconde ligne de défense et protège tous les chemins SQL.
    PERFORM pg_advisory_xact_lock(
      hashtextextended('snp-mine-account:' || NEW.mining_company_id::text, 0)
    );

    IF NOT EXISTS (
      SELECT 1
      FROM public.mining_companies compagnie
      WHERE compagnie.id = NEW.mining_company_id
        AND compagnie.is_active
    ) THEN
      RAISE EXCEPTION 'La société minière sélectionnée est inactive ou introuvable.'
        USING ERRCODE = '23503';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.user_profiles compte
      WHERE compte.role = 'mine'
        AND compte.mining_company_id = NEW.mining_company_id
        AND compte.id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'Cette société minière possède déjà un compte.'
        USING
          ERRCODE = '23505',
          CONSTRAINT = 'uq_user_profiles_mining_company_account';
    END IF;
  ELSIF NEW.mining_company_id IS NOT NULL THEN
    RAISE EXCEPTION 'Seul un compte Société minière peut recevoir ce rattachement.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_verrouiller_compte_societe_miniere() FROM public;

DROP TRIGGER IF EXISTS snp_mine_account_insert_guard ON public.user_profiles;
CREATE TRIGGER snp_mine_account_insert_guard
BEFORE INSERT ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.snp_verrouiller_compte_societe_miniere();

DROP TRIGGER IF EXISTS snp_mine_account_update_guard ON public.user_profiles;
CREATE TRIGGER snp_mine_account_update_guard
BEFORE UPDATE OF role, mining_company_id ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.snp_verrouiller_compte_societe_miniere();
