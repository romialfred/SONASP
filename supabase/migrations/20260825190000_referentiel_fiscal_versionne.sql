-- Referentiel fiscal versionne, generalise depuis snp_artisan_tax_policies.
--
-- POURQUOI GENERALISER PLUTOT QUE CREER
-- snp_artisan_tax_policies versionne deja par date d'effet (effective_from,
-- effective_until, source_note) et sert le circuit artisanal, aujourd'hui le seul
-- dont la fiscalite soit automatisee. Le principe est bon ; la forme ne porte que
-- trois taux figes en colonnes (vat_rate, withholding_rate, community_rate), sans
-- assiette ni tranche. Elle ne peut donc accueillir ni le FNDL ni un bareme de
-- redevances progressif sans migration de schema, ce que la mission proscrit.
--
-- Ouvrir une seconde table de taux ferait coexister deux verites fiscales. Le
-- referentiel ci-dessous englobe le cas artisanal sans le remplacer : la bascule
-- de ce circuit est differee jusqu'a ce qu'elle soit eprouvee, le rompre serait
-- une regression.
--
-- AUCUN TAUX N'EST LIVRE. Les baremes seront saisis par un acteur habilite, avec
-- leur reference reglementaire. Le FNDL n'a aujourd'hui aucune definition
-- disponible, ni dans le code ni dans le schema.
--
-- CONVENTION DE BORNES
-- Une tranche s'ecrit [seuil_min, seuil_max) : borne inferieure incluse, borne
-- superieure exclue. Cette convention unique remplace un couple de colonnes
-- d'inclusivite qui aurait complique la contrainte d'exclusion sans benefice :
-- deux baremes contigus se lisent 0-1000 puis 1000-1300 sans recouvrement ni
-- trou. Un seuil nul signifie « pas de borne ».
--
-- RETOUR ARRIERE
--   DROP TABLE public.snp_calculs_fiscaux;
--   DROP TABLE public.snp_regles_fiscales;
--   DELETE FROM public.snp_role_capabilities WHERE capability_code LIKE 'tax.rules.%';
--   DELETE FROM public.snp_capability_catalog WHERE code LIKE 'tax.rules.%';
-- L'extension btree_gist est conservee : d'autres objets peuvent en dependre.

BEGIN;

-- La contrainte de non-chevauchement combine egalite et intervalles ; elle exige
-- btree_gist. L'extension est installee hors de `public`, qui est expose par
-- PostgREST.
CREATE EXTENSION IF NOT EXISTS btree_gist SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 1. Regles fiscales
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.snp_regles_fiscales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_taxe text NOT NULL,
  libelle text NOT NULL,
  assiette text NOT NULL,
  mode_calcul text NOT NULL,
  taux numeric,
  montant_forfaitaire numeric,
  seuil_min numeric,
  seuil_max numeric,
  unite_seuil text,
  devise_seuil text,
  categorie_acheteur text NOT NULL DEFAULT 'standard',
  date_effet date NOT NULL,
  date_fin date,
  reference_reglementaire text,
  commentaire text,
  statut text NOT NULL DEFAULT 'projet',
  cree_par uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  approuve_par uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approuve_le timestamptz,
  abroge_par uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  abroge_le timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_regles_fiscales_code_check
    CHECK (code_taxe IN ('tva', 'royalties', 'fndl', 'retenue_source', 'taxe_communale')),
  CONSTRAINT snp_regles_fiscales_assiette_check
    CHECK (assiette IN ('ca_ht', 'produit_net', 'montant_brut', 'quantite_or_fin')),
  CONSTRAINT snp_regles_fiscales_mode_check
    CHECK (mode_calcul IN ('taux', 'tranche', 'forfait', 'exoneration')),
  CONSTRAINT snp_regles_fiscales_statut_check
    CHECK (statut IN ('projet', 'approuvee', 'abrogee')),
  CONSTRAINT snp_regles_fiscales_periode_check
    CHECK (date_fin IS NULL OR date_fin > date_effet),
  CONSTRAINT snp_regles_fiscales_seuils_check
    CHECK (seuil_max IS NULL OR seuil_min IS NULL OR seuil_max > seuil_min),

  -- Un taux est indispensable des lors qu'on en applique un ; un forfait exige
  -- son montant ; une exoneration n'a besoin ni de l'un ni de l'autre.
  CONSTRAINT snp_regles_fiscales_valeur_check CHECK (
    (mode_calcul IN ('taux', 'tranche') AND taux IS NOT NULL AND taux >= 0 AND taux < 1)
    OR (mode_calcul = 'forfait' AND montant_forfaitaire IS NOT NULL AND montant_forfaitaire >= 0)
    OR (mode_calcul = 'exoneration')
  ),

  -- Une tranche n'a de sens que bornee et rapportee a une unite mesurable.
  CONSTRAINT snp_regles_fiscales_tranche_check CHECK (
    mode_calcul <> 'tranche'
    OR (unite_seuil IS NOT NULL AND (seuil_min IS NOT NULL OR seuil_max IS NOT NULL))
  ),

  -- Une regle approuvee porte la trace de son approbation ; une regle abrogee
  -- celle de son abrogation.
  CONSTRAINT snp_regles_fiscales_approbation_check CHECK (
    statut <> 'approuvee' OR (approuve_par IS NOT NULL AND approuve_le IS NOT NULL)
  ),
  CONSTRAINT snp_regles_fiscales_abrogation_check CHECK (
    statut <> 'abrogee' OR (abroge_par IS NOT NULL AND abroge_le IS NOT NULL)
  ),

  -- Separation des taches : nul n'approuve sa propre regle.
  CONSTRAINT snp_regles_fiscales_auteur_distinct_check CHECK (
    approuve_par IS NULL OR cree_par IS NULL OR approuve_par <> cree_par
  )
);

-- Deux regles ne peuvent se disputer le meme montant : pour une meme taxe, une
-- meme categorie d'acheteur, des periodes qui se recouvrent et des tranches qui
-- se recouvrent, l'une des deux est de trop. Les regles abrogees sont exclues du
-- controle : elles temoignent du passe sans plus s'appliquer.
ALTER TABLE public.snp_regles_fiscales
  DROP CONSTRAINT IF EXISTS snp_regles_fiscales_pas_de_chevauchement;
ALTER TABLE public.snp_regles_fiscales
  ADD CONSTRAINT snp_regles_fiscales_pas_de_chevauchement
  EXCLUDE USING gist (
    code_taxe WITH =,
    categorie_acheteur WITH =,
    daterange(date_effet, date_fin, '[)') WITH &&,
    numrange(seuil_min, seuil_max, '[)') WITH &&
  ) WHERE (statut <> 'abrogee');

CREATE INDEX IF NOT EXISTS idx_snp_regles_fiscales_resolution
  ON public.snp_regles_fiscales (code_taxe, categorie_acheteur, date_effet DESC)
  WHERE statut = 'approuvee';

-- ---------------------------------------------------------------------------
-- 2. Instantanes de calcul
-- ---------------------------------------------------------------------------
-- Un montant fiscal doit pouvoir repondre, des annees plus tard : pourquoi ce
-- montant ? L'instantane fige la regle, l'assiette, le taux et la formule au
-- moment du calcul. Une modification du bareme en 2027 ne change donc rien a une
-- facture de 2026.

CREATE TABLE IF NOT EXISTS public.snp_calculs_fiscaux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regle_id uuid REFERENCES public.snp_regles_fiscales(id) ON DELETE RESTRICT,
  code_taxe text NOT NULL,
  assiette_retenue text NOT NULL,
  montant_assiette numeric NOT NULL,
  taux_applique numeric,
  formule text NOT NULL,
  montant_obtenu numeric NOT NULL,
  devise text NOT NULL DEFAULT 'XOF',
  regle_provisoire boolean NOT NULL DEFAULT false,
  contexte_type text NOT NULL,
  contexte_id uuid NOT NULL,
  mining_company_id uuid REFERENCES public.mining_companies(id) ON DELETE SET NULL,
  calcule_par uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  calcule_le timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_calculs_fiscaux_contexte_check
    CHECK (contexte_type IN ('vente', 'facture', 'conciliation', 'simulation')),
  CONSTRAINT snp_calculs_fiscaux_montant_check
    CHECK (montant_obtenu >= 0)
);

CREATE INDEX IF NOT EXISTS idx_snp_calculs_fiscaux_contexte
  ON public.snp_calculs_fiscaux (contexte_type, contexte_id, code_taxe);

-- ---------------------------------------------------------------------------
-- 3. Ecriture reservee aux procedures de confiance
-- ---------------------------------------------------------------------------

ALTER TABLE public.snp_regles_fiscales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_calculs_fiscaux ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snp_regles_fiscales_lecture ON public.snp_regles_fiscales;
CREATE POLICY snp_regles_fiscales_lecture
  ON public.snp_regles_fiscales
  FOR SELECT TO authenticated
  USING (public.snp_actor_has_capability('tax.rules.read'));

DROP POLICY IF EXISTS snp_regles_fiscales_aucune_ecriture_directe ON public.snp_regles_fiscales;
CREATE POLICY snp_regles_fiscales_aucune_ecriture_directe
  ON public.snp_regles_fiscales AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS snp_calculs_fiscaux_lecture ON public.snp_calculs_fiscaux;
CREATE POLICY snp_calculs_fiscaux_lecture
  ON public.snp_calculs_fiscaux
  FOR SELECT TO authenticated
  USING (public.snp_actor_has_capability('tax.rules.read'));

DROP POLICY IF EXISTS snp_calculs_fiscaux_aucune_ecriture_directe ON public.snp_calculs_fiscaux;
CREATE POLICY snp_calculs_fiscaux_aucune_ecriture_directe
  ON public.snp_calculs_fiscaux AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

REVOKE INSERT, UPDATE, DELETE ON public.snp_regles_fiscales FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.snp_calculs_fiscaux FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Capacites
-- ---------------------------------------------------------------------------

INSERT INTO public.snp_capability_catalog (code, domain, label, description, sensitive)
VALUES
  ('tax.rules.read', 'referentials', 'Consulter le référentiel fiscal',
   'Lire les règles fiscales et les instantanés de calcul.', false),
  ('tax.rules.manage', 'referentials', 'Administrer le référentiel fiscal',
   'Créer, approuver et abroger une règle fiscale. Nul n''approuve sa propre règle.', true)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Resolution de la regle applicable
-- ---------------------------------------------------------------------------
-- La regle retenue est celle qui etait en vigueur a la date consideree, jamais la
-- regle courante. C'est ce qui rend une operation ancienne recalculable.

CREATE OR REPLACE FUNCTION public.snp_resoudre_regle_fiscale(
  p_code_taxe text,
  p_date date,
  p_valeur_seuil numeric DEFAULT NULL,
  p_categorie_acheteur text DEFAULT 'standard'
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
  ORDER BY r.date_effet DESC
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.snp_resoudre_regle_fiscale(text, date, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_resoudre_regle_fiscale(text, date, numeric, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Postflight
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_manque text;
BEGIN
  IF to_regclass('public.snp_regles_fiscales') IS NULL
     OR to_regclass('public.snp_calculs_fiscaux') IS NULL THEN
    RAISE EXCEPTION 'Postflight : les tables du referentiel fiscal sont absentes.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'snp_regles_fiscales_pas_de_chevauchement'
  ) THEN
    RAISE EXCEPTION 'Postflight : la contrainte de non-chevauchement est absente.';
  END IF;

  SELECT string_agg(c.code, ', ') INTO v_manque
  FROM (VALUES ('tax.rules.read'), ('tax.rules.manage')) AS c(code)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.snp_capability_catalog cat WHERE cat.code = c.code
  );
  IF v_manque IS NOT NULL THEN
    RAISE EXCEPTION 'Postflight : capacites absentes du catalogue : %.', v_manque;
  END IF;

  IF to_regprocedure('public.snp_resoudre_regle_fiscale(text, date, numeric, text)') IS NULL THEN
    RAISE EXCEPTION 'Postflight : la fonction de resolution est absente.';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
