-- Interdit a un compte de modifier lui-meme son role ou sa societe de
-- rattachement.
--
-- CONSTAT
-- La politique `users_update_own_profile` autorise un compte a mettre a jour
-- sa propre ligne de user_profiles. Son WITH CHECK ne fige que `is_active` :
--   (auth.uid() = id) AND is_active = (SELECT is_active FROM user_profiles
--                                       WHERE id = auth.uid())
-- Ni `role` ni `mining_company_id` n'y sont contraints, et `authenticated`
-- detient bien le droit UPDATE sur ces colonnes.
--
-- Le declencheur snp_2m_versionner_profil_securite detecte pourtant les trois
-- changements, mais ne leve d'exception que pour `is_active` ; pour `role` et
-- `mining_company_id` il se borne a incrementer `version`. Le changement est
-- donc trace, jamais empeche.
--
-- Consequences, par simple appel PATCH /rest/v1/user_profiles?id=eq.<soi> :
--   - passage a `owner` ou `management`, ce qui annule la separation des
--     taches et ouvre l'approbation et l'execution financiere ;
--   - changement de `mining_company_id`, ce qui fait franchir la frontiere
--     entre societes minieres et ruine le cloisonnement multi-tenant.
--
-- PARTI PRIS
-- Le controle est place dans le declencheur plutot que dans la politique :
-- il couvre ainsi toutes les voies d'ecriture, y compris celles qui ne
-- passent pas par PostgREST, et il echoue en fermeture. Le motif retenu est
-- celui deja employe pour `is_active` : la mutation n'est acceptee que
-- lorsqu'elle emane du RPC canonique, signale par un parametre de session.
-- Les traitements de confiance, qui ne s'executent pas sous le role
-- `authenticated`, ne sont pas affectes.
--
-- RETOUR ARRIERE : restaurer la definition precedente de la fonction, dont le
-- corps est reproduit ci-dessous a l'identique pour reference.
--   BEGIN
--     IF NEW.role IS DISTINCT FROM OLD.role
--        OR NEW.is_active IS DISTINCT FROM OLD.is_active
--        OR NEW.mining_company_id IS DISTINCT FROM OLD.mining_company_id THEN
--       IF NEW.is_active IS DISTINCT FROM OLD.is_active
--          AND coalesce(auth.role(),'')='authenticated'
--          AND coalesce(current_setting('snp.account_status_rpc',true),'')<>'on' THEN
--         RAISE EXCEPTION 'Le statut du compte se modifie uniquement via le RPC canonique.'
--           USING ERRCODE='42501';
--       END IF;
--       NEW.version:=OLD.version+1;
--     ELSE
--       NEW.version:=OLD.version;
--     END IF;
--     RETURN NEW;
--   END;

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NULL THEN
    RAISE EXCEPTION 'Table user_profiles absente : migration inapplicable.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.snp_2m_versionner_profil_securite()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_par_authenticated boolean := coalesce(auth.role(), '') = 'authenticated';
  v_rpc_canonique boolean := coalesce(current_setting('snp.account_status_rpc', true), '') = 'on';
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.mining_company_id IS DISTINCT FROM OLD.mining_company_id THEN

    IF NEW.is_active IS DISTINCT FROM OLD.is_active
       AND v_par_authenticated
       AND NOT v_rpc_canonique THEN
      RAISE EXCEPTION 'Le statut du compte se modifie uniquement via le RPC canonique.'
        USING ERRCODE = '42501';
    END IF;

    -- Le role commande les capacites : il ne peut pas etre choisi par le
    -- titulaire du compte, sous peine d'elevation de privilege.
    IF NEW.role IS DISTINCT FROM OLD.role
       AND v_par_authenticated
       AND NOT v_rpc_canonique THEN
      RAISE EXCEPTION 'Le role se modifie uniquement via le RPC canonique.'
        USING ERRCODE = '42501';
    END IF;

    -- La societe de rattachement porte le cloisonnement entre organisations :
    -- la changer soi-meme reviendrait a franchir la frontiere multi-tenant.
    IF NEW.mining_company_id IS DISTINCT FROM OLD.mining_company_id
       AND v_par_authenticated
       AND NOT v_rpc_canonique THEN
      RAISE EXCEPTION 'La societe de rattachement se modifie uniquement via le RPC canonique.'
        USING ERRCODE = '42501';
    END IF;

    NEW.version := OLD.version + 1;
  ELSE
    NEW.version := OLD.version;
  END IF;

  RETURN NEW;
END;
$$;

-- Postflight : la fonction doit desormais refuser role et tenant.
DO $$
DECLARE
  v_source text;
BEGIN
  SELECT p.prosrc INTO v_source
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'snp_2m_versionner_profil_securite';

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'Postflight : fonction de versionnement introuvable.';
  END IF;

  IF v_source NOT LIKE '%Le role se modifie uniquement%'
     OR v_source NOT LIKE '%La societe de rattachement se modifie uniquement%' THEN
    RAISE EXCEPTION 'Postflight : les gardes role et tenant ne sont pas en place.';
  END IF;
END;
$$;

COMMIT;
