-- Moteur de conciliation : dossiers, versions et ecarts.
--
-- OBJET
-- Rapprocher ce qui a ete declare a l'expedition de ce que l'acheteur reconnait
-- apres analyse, puis en tirer les consequences commerciales et fiscales.
--
-- CE QUI EST REUTILISE PLUTOT QUE RECREE
--   - snp_contrats fournit toutes les conditions : methode de prix, teneur de
--     reference et tolerance, laboratoire, delai de contestation, teneur faisant
--     foi. La conciliation les lit, ne les redemande jamais.
--   - assay_certificates porte le resultat de l'acheteur pour une vente export :
--     laboratoire, certificat, piece jointe, teneurs, finesse, purete.
--   - snp_analyses_teneur porte l'analyse de teneur amont, pour les achats.
--   - snp_numero_suivant produit la reference metier, ici REC-AAAA-NNNN.
--   - snp_grand_livre_commercial et snp_grand_livre_fiscal recevront les
--     ecritures a la validation.
--
-- SOURCE D'ANALYSE
-- Le dossier designe sa source par un couple type et identifiant : une vente
-- export s'appuie sur un certificat, un achat sur une analyse de teneur. Une
-- contrainte garantit qu'une seule des deux est renseignee, et qu'elle
-- correspond au type declare.
--
-- ETATS
-- Neuf etats, la situation de solde restant un attribut derive des livres et non
-- un etat : un dossier valide peut presenter simultanement un trop-percu
-- commercial et un reliquat fiscal, ce qu'un etat unique ne saurait representer.
--
-- RETOUR ARRIERE
--   DROP TABLE public.snp_conciliations_ecarts;
--   DROP TABLE public.snp_conciliations_versions;
--   DROP TABLE public.snp_conciliations;
--   DROP FUNCTION public.snp_numeroter_conciliation();

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Dossiers
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.snp_conciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  contrat_id uuid REFERENCES public.snp_contrats(id) ON DELETE RESTRICT,
  mining_company_id uuid REFERENCES public.mining_companies(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT,

  source_analyse_type text,
  assay_certificate_id uuid REFERENCES public.assay_certificates(id) ON DELETE RESTRICT,
  analyse_teneur_id uuid REFERENCES public.snp_analyses_teneur(id) ON DELETE RESTRICT,

  -- Valeurs provisoires, reprises de la vente a l'ouverture.
  poids_initial_g numeric,
  teneur_initiale_pct numeric,
  or_fin_initial_g numeric,
  prix_initial numeric,
  devise_initiale text,
  taux_change_initial numeric,
  ca_initial numeric,

  -- Valeurs definitives, issues de l'analyse et du contrat.
  poids_final_g numeric,
  teneur_finale_pct numeric,
  or_fin_final_g numeric,
  prix_final numeric,
  devise_finale text,
  taux_change_final numeric,
  date_fixing date,
  ca_final numeric,
  deductions_contractuelles numeric,

  statut text NOT NULL DEFAULT 'en_attente_analyse',
  motif_statut text,
  observations text,
  version integer NOT NULL DEFAULT 1,

  soumis_par uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  soumis_le timestamptz,
  valide_par uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  valide_le timestamptz,
  cloture_le timestamptz,

  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_conciliations_statut_check CHECK (statut IN (
    'en_attente_analyse', 'analyse_recue', 'calculee', 'ecart_a_verifier',
    'en_attente_validation', 'contestee', 'validee',
    'facture_definitive_generee', 'cloturee', 'annulee'
  )),
  CONSTRAINT snp_conciliations_source_type_check
    CHECK (source_analyse_type IS NULL OR source_analyse_type IN ('certificat_acheteur', 'analyse_teneur')),

  -- Une seule source d'analyse, et elle correspond au type declare.
  CONSTRAINT snp_conciliations_source_coherente_check CHECK (
    (source_analyse_type IS NULL AND assay_certificate_id IS NULL AND analyse_teneur_id IS NULL)
    OR (source_analyse_type = 'certificat_acheteur'
        AND assay_certificate_id IS NOT NULL AND analyse_teneur_id IS NULL)
    OR (source_analyse_type = 'analyse_teneur'
        AND analyse_teneur_id IS NOT NULL AND assay_certificate_id IS NULL)
  ),

  -- On ne quitte l'attente d'analyse qu'une fois la source rattachee.
  CONSTRAINT snp_conciliations_analyse_requise_check CHECK (
    statut IN ('en_attente_analyse', 'annulee') OR source_analyse_type IS NOT NULL
  ),

  -- Un dossier valide porte ses valeurs definitives et son validateur.
  CONSTRAINT snp_conciliations_validation_check CHECK (
    statut NOT IN ('validee', 'facture_definitive_generee', 'cloturee')
    OR (valide_par IS NOT NULL AND valide_le IS NOT NULL AND ca_final IS NOT NULL)
  ),

  -- Separation des taches : qui soumet ne valide pas.
  CONSTRAINT snp_conciliations_separation_check CHECK (
    valide_par IS NULL OR soumis_par IS NULL OR valide_par <> soumis_par
  ),

  CONSTRAINT snp_conciliations_teneurs_check CHECK (
    (teneur_initiale_pct IS NULL OR (teneur_initiale_pct > 0 AND teneur_initiale_pct <= 100))
    AND (teneur_finale_pct IS NULL OR (teneur_finale_pct > 0 AND teneur_finale_pct <= 100))
  ),
  CONSTRAINT snp_conciliations_montants_check CHECK (
    (ca_initial IS NULL OR ca_initial >= 0) AND (ca_final IS NULL OR ca_final >= 0)
  )
);

-- Une vente ne porte qu'une conciliation vivante. La contrainte est en base :
-- un controle applicatif laisserait passer deux ouvertures concurrentes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_conciliations_vente_vivante
  ON public.snp_conciliations (sale_id)
  WHERE statut <> 'annulee';

CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_conciliations_reference
  ON public.snp_conciliations (reference);
CREATE INDEX IF NOT EXISTS idx_snp_conciliations_file_travail
  ON public.snp_conciliations (statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snp_conciliations_societe
  ON public.snp_conciliations (mining_company_id, statut);

-- ---------------------------------------------------------------------------
-- 2. Numerotation
-- ---------------------------------------------------------------------------
-- snp_numero_suivant ne pose aucun verrou : deux ouvertures simultanees
-- obtiendraient la meme reference. Le verrou consultatif serialise l'attribution
-- pour l'annee consideree, comme le fait deja snp_creer_vente_export.

CREATE OR REPLACE FUNCTION public.snp_numeroter_conciliation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_annee integer := extract(year FROM coalesce(NEW.created_at, now()))::integer;
BEGIN
  IF NEW.reference IS NULL OR length(trim(NEW.reference)) = 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('SONASP:conciliations:' || v_annee::text));
    NEW.reference := public.snp_numero_suivant(
      'REC', v_annee, 'public.snp_conciliations'::regclass, 'reference'
    );
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_snp_conciliations_numero ON public.snp_conciliations;
CREATE TRIGGER trg_snp_conciliations_numero
  BEFORE INSERT ON public.snp_conciliations
  FOR EACH ROW EXECUTE FUNCTION public.snp_numeroter_conciliation();

DROP TRIGGER IF EXISTS trg_snp_conciliations_touch ON public.snp_conciliations;
CREATE TRIGGER trg_snp_conciliations_touch
  BEFORE UPDATE ON public.snp_conciliations
  FOR EACH ROW EXECUTE FUNCTION public.snp_touch_updated_at();

DROP TRIGGER IF EXISTS trg_snp_conciliations_audit ON public.snp_conciliations;
CREATE TRIGGER trg_snp_conciliations_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.snp_conciliations
  FOR EACH ROW EXECUTE FUNCTION public.snp_auditer();

-- ---------------------------------------------------------------------------
-- 3. Versions
-- ---------------------------------------------------------------------------
-- Un dossier valide ne se modifie pas. Toute correction produit une version
-- portant les valeurs anterieures, les nouvelles, son motif et son auteur.

CREATE TABLE IF NOT EXISTS public.snp_conciliations_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conciliation_id uuid NOT NULL REFERENCES public.snp_conciliations(id) ON DELETE RESTRICT,
  version integer NOT NULL,
  valeurs_avant jsonb NOT NULL,
  valeurs_apres jsonb NOT NULL,
  motif text NOT NULL,
  acteur_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  acteur_role text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_conciliations_versions_motif_check
    CHECK (length(trim(motif)) >= 10)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_conciliations_versions
  ON public.snp_conciliations_versions (conciliation_id, version);

DROP TRIGGER IF EXISTS snp_conciliations_versions_immuable ON public.snp_conciliations_versions;
CREATE TRIGGER snp_conciliations_versions_immuable
  BEFORE UPDATE OR DELETE ON public.snp_conciliations_versions
  FOR EACH ROW EXECUTE FUNCTION public.snp_refuser_alteration_ecriture();

-- ---------------------------------------------------------------------------
-- 4. Ecarts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.snp_conciliations_ecarts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conciliation_id uuid NOT NULL REFERENCES public.snp_conciliations(id) ON DELETE CASCADE,
  parametre text NOT NULL,
  code_taxe text,
  valeur_initiale numeric,
  valeur_definitive numeric,
  ecart_absolu numeric,
  ecart_relatif_pct numeric,
  seuil_contractuel_pct numeric,
  depasse_seuil boolean NOT NULL DEFAULT false,
  justification text,
  unite text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_conciliations_ecarts_parametre_check CHECK (parametre IN (
    'poids', 'teneur', 'or_fin', 'prix', 'ca_ht', 'taxe'
  )),
  -- Une ligne de taxe nomme la taxe concernee ; les autres non.
  CONSTRAINT snp_conciliations_ecarts_taxe_check CHECK (
    (parametre = 'taxe' AND code_taxe IS NOT NULL)
    OR (parametre <> 'taxe' AND code_taxe IS NULL)
  ),
  -- Un ecart au-dela du seuil contractuel exige sa justification.
  CONSTRAINT snp_conciliations_ecarts_justification_check CHECK (
    NOT depasse_seuil OR length(trim(coalesce(justification, ''))) >= 10
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_conciliations_ecarts
  ON public.snp_conciliations_ecarts (conciliation_id, parametre, coalesce(code_taxe, ''));
CREATE INDEX IF NOT EXISTS idx_snp_conciliations_ecarts_depassement
  ON public.snp_conciliations_ecarts (conciliation_id) WHERE depasse_seuil;

-- ---------------------------------------------------------------------------
-- 5. Ecriture reservee aux procedures de confiance
-- ---------------------------------------------------------------------------

ALTER TABLE public.snp_conciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_conciliations_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_conciliations_ecarts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snp_conciliations_lecture ON public.snp_conciliations;
CREATE POLICY snp_conciliations_lecture
  ON public.snp_conciliations
  FOR SELECT TO authenticated
  USING (
    public.snp_actor_has_capability('reconciliation.read')
    OR (mining_company_id IS NOT NULL
        AND mining_company_id = public.snp_societe_utilisateur())
  );

DROP POLICY IF EXISTS snp_conciliations_aucune_ecriture_directe ON public.snp_conciliations;
CREATE POLICY snp_conciliations_aucune_ecriture_directe
  ON public.snp_conciliations AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS snp_conciliations_versions_lecture ON public.snp_conciliations_versions;
CREATE POLICY snp_conciliations_versions_lecture
  ON public.snp_conciliations_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.snp_conciliations c
      WHERE c.id = conciliation_id
        AND (
          public.snp_actor_has_capability('reconciliation.read')
          OR (c.mining_company_id IS NOT NULL
              AND c.mining_company_id = public.snp_societe_utilisateur())
        )
    )
  );

DROP POLICY IF EXISTS snp_conciliations_versions_aucune_ecriture_directe ON public.snp_conciliations_versions;
CREATE POLICY snp_conciliations_versions_aucune_ecriture_directe
  ON public.snp_conciliations_versions AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS snp_conciliations_ecarts_lecture ON public.snp_conciliations_ecarts;
CREATE POLICY snp_conciliations_ecarts_lecture
  ON public.snp_conciliations_ecarts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.snp_conciliations c
      WHERE c.id = conciliation_id
        AND (
          public.snp_actor_has_capability('reconciliation.read')
          OR (c.mining_company_id IS NOT NULL
              AND c.mining_company_id = public.snp_societe_utilisateur())
        )
    )
  );

DROP POLICY IF EXISTS snp_conciliations_ecarts_aucune_ecriture_directe ON public.snp_conciliations_ecarts;
CREATE POLICY snp_conciliations_ecarts_aucune_ecriture_directe
  ON public.snp_conciliations_ecarts AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

REVOKE INSERT, UPDATE, DELETE ON public.snp_conciliations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.snp_conciliations_versions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.snp_conciliations_ecarts FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Postflight
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.snp_conciliations') IS NULL
     OR to_regclass('public.snp_conciliations_versions') IS NULL
     OR to_regclass('public.snp_conciliations_ecarts') IS NULL THEN
    RAISE EXCEPTION 'Postflight : les tables de conciliation sont absentes.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uq_snp_conciliations_vente_vivante'
  ) THEN
    RAISE EXCEPTION 'Postflight : l''unicite par vente n''est pas garantie.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'snp_conciliations_versions'
      AND t.tgname = 'snp_conciliations_versions_immuable' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Postflight : les versions ne sont pas immuables.';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
