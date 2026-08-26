-- Referentiel fiscal : profil du vendeur, et ecriture par procedures de confiance.
--
-- CONSTAT
-- Deux defauts empechaient le referentiel de servir.
--
-- 1. L'ecran « Regles fiscales » propose d'enregistrer une regle, mais la table
--    n'accorde que SELECT a `authenticated` et porte une politique restrictive
--    qui refuse INSERT et UPDATE. Le bouton « Enregistrer en projet », comme
--    « Approuver » et « Abroger », renvoyait donc un refus. La fonctionnalite
--    etait livree sans chemin d'ecriture.
--
-- 2. Le bareme burkinabe distingue le vendeur : un comptoir d'achat qui cede a
--    la SONASP ou a l'international n'acquitte pas la meme TVA qu'une mine
--    industrielle. Le modele ne portait que `categorie_acheteur`. Deux regles de
--    TVA pour la meme periode se heurtaient donc a la contrainte de
--    non-chevauchement, et il etait impossible d'exprimer le bareme reel.
--
-- PARTI PRIS
-- `profil_vendeur` est une dimension distincte de `categorie_acheteur` : l'une
-- decrit qui vend, l'autre a qui. Les deux entrent dans la contrainte de
-- non-chevauchement. La valeur 'tous' vaut regle generale ; une regle nommant un
-- profil precis l'emporte sur elle a la resolution. Les regles existantes
-- prennent 'tous', ce qui preserve leur portee.
--
-- L'ecriture passe par trois procedures SECURITY DEFINER qui exigent une
-- authentification forte et la capacite tax.rules.manage. La separation des
-- taches reste celle de la base : nul n'approuve sa propre regle. Abroger ne
-- supprime pas.
--
-- RETOUR ARRIERE
--   DROP FUNCTION public.snp_regle_fiscale_abroger(uuid);
--   DROP FUNCTION public.snp_regle_fiscale_approuver(uuid);
--   DROP FUNCTION public.snp_regle_fiscale_creer(text, text, text, text, numeric,
--     numeric, numeric, numeric, text, text, text, text, date, text, text);
--   DROP FUNCTION public.snp_regle_fiscale_garde();
--   ALTER TABLE public.snp_regles_fiscales DROP CONSTRAINT snp_regles_fiscales_pas_de_chevauchement;
--   ALTER TABLE public.snp_regles_fiscales DROP COLUMN profil_vendeur;
--   -- puis restaurer la contrainte et la fonction de resolution de 20260825185908.

BEGIN;

SET LOCAL search_path TO public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- 1. Profil du vendeur
-- ---------------------------------------------------------------------------

ALTER TABLE public.snp_regles_fiscales
  ADD COLUMN IF NOT EXISTS profil_vendeur text NOT NULL DEFAULT 'tous';

ALTER TABLE public.snp_regles_fiscales
  DROP CONSTRAINT IF EXISTS snp_regles_fiscales_profil_vendeur_check;
ALTER TABLE public.snp_regles_fiscales
  ADD CONSTRAINT snp_regles_fiscales_profil_vendeur_check
  CHECK (profil_vendeur IN (
    'tous', 'comptoir', 'mine_industrielle', 'mine_semi_mecanisee', 'artisan'
  ));

COMMENT ON COLUMN public.snp_regles_fiscales.profil_vendeur IS
  'Profil de l''acteur qui vend. ''tous'' vaut regle generale ; un profil nomme l''emporte a la resolution.';
COMMENT ON COLUMN public.snp_regles_fiscales.categorie_acheteur IS
  'Categorie de la contrepartie qui achete. Distincte de profil_vendeur.';

-- La contrainte de non-chevauchement doit connaitre la nouvelle dimension, sans
-- quoi deux regles de TVA visant des vendeurs differents se refuseraient l'une
-- l'autre.
ALTER TABLE public.snp_regles_fiscales
  DROP CONSTRAINT IF EXISTS snp_regles_fiscales_pas_de_chevauchement;
ALTER TABLE public.snp_regles_fiscales
  ADD CONSTRAINT snp_regles_fiscales_pas_de_chevauchement
  EXCLUDE USING gist (
    code_taxe WITH =,
    profil_vendeur WITH =,
    categorie_acheteur WITH =,
    daterange(date_effet, date_fin, '[)') WITH &&,
    numrange(seuil_min, seuil_max, '[)') WITH &&
  ) WHERE (statut <> 'abrogee');

DROP INDEX IF EXISTS public.idx_snp_regles_fiscales_resolution;
CREATE INDEX IF NOT EXISTS idx_snp_regles_fiscales_resolution
  ON public.snp_regles_fiscales (code_taxe, profil_vendeur, categorie_acheteur, date_effet DESC)
  WHERE statut = 'approuvee';

-- ---------------------------------------------------------------------------
-- 2. Resolution : la regle la plus specifique, a la date consideree
-- ---------------------------------------------------------------------------
-- L'ancienne signature disparait au profit d'une signature elargie dont les
-- parametres ajoutes portent une valeur par defaut : les appels a trois ou
-- quatre arguments deja ecrits continuent de fonctionner.

DROP FUNCTION IF EXISTS public.snp_resoudre_regle_fiscale(text, date, numeric, text);

CREATE OR REPLACE FUNCTION public.snp_resoudre_regle_fiscale(
  p_code_taxe text,
  p_date date,
  p_valeur_seuil numeric DEFAULT NULL,
  p_categorie_acheteur text DEFAULT 'standard',
  p_profil_vendeur text DEFAULT 'tous'
)
RETURNS public.snp_regles_fiscales
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $fn$
  SELECT r.*
  FROM public.snp_regles_fiscales r
  WHERE r.code_taxe = p_code_taxe
    AND r.categorie_acheteur = p_categorie_acheteur
    AND r.profil_vendeur IN (coalesce(p_profil_vendeur, 'tous'), 'tous')
    AND r.statut = 'approuvee'
    AND r.date_effet <= p_date
    AND (r.date_fin IS NULL OR r.date_fin > p_date)
    AND (
      r.mode_calcul <> 'tranche'
      OR (
        p_valeur_seuil IS NOT NULL
        AND (r.seuil_min IS NULL OR p_valeur_seuil >= r.seuil_min)
        AND (r.seuil_max IS NULL OR p_valeur_seuil < r.seuil_max)
      )
    )
  ORDER BY (r.profil_vendeur = coalesce(p_profil_vendeur, 'tous')) DESC,
           r.date_effet DESC
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.snp_resoudre_regle_fiscale(text, date, numeric, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_resoudre_regle_fiscale(text, date, numeric, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Ecriture reservee aux procedures de confiance
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.snp_regle_fiscale_garde()
RETURNS public.user_profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Une authentification forte est requise.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.snp_actor_has_capability('tax.rules.manage') THEN
    RAISE EXCEPTION 'Vous n''êtes pas habilité à administrer le référentiel fiscal.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor FROM public.user_profiles WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil actif introuvable.' USING ERRCODE = '42501';
  END IF;

  RETURN v_actor;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_regle_fiscale_garde() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.snp_regle_fiscale_creer(
  p_code_taxe text,
  p_libelle text,
  p_assiette text,
  p_mode_calcul text,
  p_taux numeric DEFAULT NULL,
  p_montant_forfaitaire numeric DEFAULT NULL,
  p_seuil_min numeric DEFAULT NULL,
  p_seuil_max numeric DEFAULT NULL,
  p_unite_seuil text DEFAULT NULL,
  p_devise_seuil text DEFAULT NULL,
  p_profil_vendeur text DEFAULT 'tous',
  p_categorie_acheteur text DEFAULT 'standard',
  p_date_effet date DEFAULT current_date,
  p_reference_reglementaire text DEFAULT NULL,
  p_commentaire text DEFAULT NULL
)
RETURNS public.snp_regles_fiscales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $fn$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
  v_regle public.snp_regles_fiscales%ROWTYPE;
BEGIN
  v_actor := public.snp_regle_fiscale_garde();

  IF coalesce(btrim(p_libelle), '') = '' THEN
    RAISE EXCEPTION 'Un intitulé est nécessaire pour identifier la règle.'
      USING ERRCODE = '22023';
  END IF;
  IF p_date_effet IS NULL THEN
    RAISE EXCEPTION 'Une date d''effet est nécessaire.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.snp_regles_fiscales (
      code_taxe, libelle, assiette, mode_calcul, taux, montant_forfaitaire,
      seuil_min, seuil_max, unite_seuil, devise_seuil,
      profil_vendeur, categorie_acheteur, date_effet,
      reference_reglementaire, commentaire, statut, cree_par
    ) VALUES (
      p_code_taxe, btrim(p_libelle), p_assiette, p_mode_calcul,
      CASE WHEN p_mode_calcul IN ('taux', 'tranche') THEN p_taux END,
      CASE WHEN p_mode_calcul = 'forfait' THEN p_montant_forfaitaire END,
      CASE WHEN p_mode_calcul = 'tranche' THEN p_seuil_min END,
      CASE WHEN p_mode_calcul = 'tranche' THEN p_seuil_max END,
      CASE WHEN p_mode_calcul = 'tranche'
        THEN nullif(btrim(coalesce(p_unite_seuil, '')), '') END,
      nullif(btrim(coalesce(p_devise_seuil, '')), ''),
      coalesce(nullif(btrim(coalesce(p_profil_vendeur, '')), ''), 'tous'),
      coalesce(nullif(btrim(coalesce(p_categorie_acheteur, '')), ''), 'standard'),
      p_date_effet,
      nullif(btrim(coalesce(p_reference_reglementaire, '')), ''),
      nullif(btrim(coalesce(p_commentaire, '')), ''),
      'projet', v_actor.id
    ) RETURNING * INTO v_regle;
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE EXCEPTION
        'Une règle couvre déjà cette taxe pour ce profil, cette période et cette tranche.'
        USING ERRCODE = '23505';
  END;

  RETURN v_regle;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_regle_fiscale_approuver(p_id uuid)
RETURNS public.snp_regles_fiscales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $fn$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
  v_regle public.snp_regles_fiscales%ROWTYPE;
BEGIN
  v_actor := public.snp_regle_fiscale_garde();

  SELECT * INTO v_regle FROM public.snp_regles_fiscales WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Règle introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_regle.statut <> 'projet' THEN
    RAISE EXCEPTION 'Seule une règle en projet peut être approuvée.' USING ERRCODE = '22023';
  END IF;
  -- Separation des taches : nul n'approuve sa propre regle.
  IF v_regle.cree_par IS NOT NULL AND v_regle.cree_par = v_actor.id THEN
    RAISE EXCEPTION 'L''approbation revient à un autre acteur que l''auteur de la règle.'
      USING ERRCODE = '42501';
  END IF;

  BEGIN
    UPDATE public.snp_regles_fiscales
       SET statut = 'approuvee',
           approuve_par = v_actor.id,
           approuve_le = now(),
           updated_at = now()
     WHERE id = p_id
    RETURNING * INTO v_regle;
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE EXCEPTION
        'Une règle en vigueur couvre déjà cette taxe pour ce profil, cette période et cette tranche.'
        USING ERRCODE = '23505';
  END;

  RETURN v_regle;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_regle_fiscale_abroger(p_id uuid)
RETURNS public.snp_regles_fiscales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $fn$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
  v_regle public.snp_regles_fiscales%ROWTYPE;
BEGIN
  v_actor := public.snp_regle_fiscale_garde();

  SELECT * INTO v_regle FROM public.snp_regles_fiscales WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Règle introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_regle.statut = 'abrogee' THEN
    RETURN v_regle;
  END IF;

  -- Abroger ne supprime pas : la regle reste opposable aux operations qu'elle a
  -- servi a calculer.
  UPDATE public.snp_regles_fiscales
     SET statut = 'abrogee',
         abroge_par = v_actor.id,
         abroge_le = now(),
         updated_at = now()
   WHERE id = p_id
  RETURNING * INTO v_regle;

  RETURN v_regle;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_regle_fiscale_creer(text, text, text, text, numeric, numeric, numeric, numeric, text, text, text, text, date, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.snp_regle_fiscale_approuver(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.snp_regle_fiscale_abroger(uuid) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.snp_regle_fiscale_creer(text, text, text, text, numeric, numeric, numeric, numeric, text, text, text, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_regle_fiscale_approuver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_regle_fiscale_abroger(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Postflight
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_manque text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'snp_regles_fiscales'
      AND column_name = 'profil_vendeur'
  ) THEN
    RAISE EXCEPTION 'Postflight : la colonne profil_vendeur est absente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'snp_regles_fiscales_pas_de_chevauchement'
      AND pg_get_constraintdef(oid) LIKE '%profil_vendeur%'
  ) THEN
    RAISE EXCEPTION 'Postflight : la contrainte de non-chevauchement ignore profil_vendeur.';
  END IF;

  SELECT string_agg(f.signature, ', ') INTO v_manque
  FROM (VALUES
    ('public.snp_regle_fiscale_creer(text, text, text, text, numeric, numeric, numeric, numeric, text, text, text, text, date, text, text)'),
    ('public.snp_regle_fiscale_approuver(uuid)'),
    ('public.snp_regle_fiscale_abroger(uuid)'),
    ('public.snp_resoudre_regle_fiscale(text, date, numeric, text, text)')
  ) AS f(signature)
  WHERE to_regprocedure(f.signature) IS NULL;
  IF v_manque IS NOT NULL THEN
    RAISE EXCEPTION 'Postflight : procédures absentes : %.', v_manque;
  END IF;

  -- L'ecriture directe reste fermee : seules les procedures ecrivent.
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'snp_regles_fiscales'
      AND grantee IN ('anon', 'authenticated')
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'Postflight : l''écriture directe a été rouverte.';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
