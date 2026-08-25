-- Grands livres commercial et fiscal.
--
-- PRINCIPE
-- Un solde ne se stocke pas dans un champ que l'on ecrase : il se reconstruit a
-- partir d'ecritures. Aucune ecriture n'est modifiee ni supprimee. Une erreur se
-- corrige par contrepassation, jamais par effacement.
--
-- FORME REPRISE, NON INVENTEE
-- snp_artisanal_stock_ledger porte deja exactement ce modele : direction,
-- type de mouvement, source, cle d'idempotence, et reverses_entry_id qui
-- materialise la contrepassation. Les deux livres ci-dessous la reprennent
-- plutot que d'ouvrir un modele concurrent.
--
-- A NE PAS CONFONDRE
-- snp_artisan_finance_operation_ledger et snp_payment_operation_ledger portent
-- « ledger » dans leur nom mais sont des journaux d'idempotence d'operations :
-- ils ne portent aucun solde. Les prendre pour des livres comptables aurait
-- conduit a batir les soldes sur des tables qui n'en contiennent pas.
--
-- IMMUABILITE
-- La modification et la suppression sont refusees par declencheur, pour tous les
-- roles y compris les procedures de confiance. Seule l'insertion est possible.
-- C'est le seul moyen de garantir qu'un solde reconstruit soit fidele.
--
-- RETOUR ARRIERE
--   DROP TABLE public.snp_grand_livre_fiscal;
--   DROP TABLE public.snp_grand_livre_commercial;
--   DROP FUNCTION public.snp_refuser_alteration_ecriture();

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Immuabilite
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.snp_refuser_alteration_ecriture()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $fn$
BEGIN
  RAISE EXCEPTION
    'Une ecriture comptable ne se modifie ni ne se supprime : contrepassez-la.'
    USING ERRCODE = '42501';
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Grand livre commercial
-- ---------------------------------------------------------------------------
-- Le compte courant entre deux parties : mine, SONASP, client international,
-- comptoir. Un solde crediteur constate une creance, un solde debiteur un
-- trop-percu.

CREATE TABLE IF NOT EXISTS public.snp_grand_livre_commercial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrepartie_type text NOT NULL,
  contrepartie_id uuid NOT NULL,
  mining_company_id uuid REFERENCES public.mining_companies(id) ON DELETE RESTRICT,
  sens text NOT NULL,
  montant numeric NOT NULL,
  devise text NOT NULL DEFAULT 'XOF',
  montant_xof numeric,
  taux_change numeric,
  source_taux text,
  taux_horodate timestamptz,
  type_mouvement text NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE RESTRICT,
  conciliation_id uuid,
  reverses_entry_id uuid REFERENCES public.snp_grand_livre_commercial(id) ON DELETE RESTRICT,
  motif text,
  idempotency_key text NOT NULL,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_glc_sens_check CHECK (sens IN ('debit', 'credit')),
  CONSTRAINT snp_glc_montant_check CHECK (montant > 0),
  CONSTRAINT snp_glc_contrepartie_check
    CHECK (contrepartie_type IN ('customer', 'mining_company', 'comptoir', 'sonasp')),
  CONSTRAINT snp_glc_mouvement_check CHECK (type_mouvement IN (
    'facture_provisoire', 'facture_definitive', 'paiement', 'acompte',
    'avoir', 'imputation_avoir', 'ajustement_conciliation', 'contrepassation'
  )),
  -- Une contrepassation dit toujours pourquoi.
  CONSTRAINT snp_glc_contrepassation_motif_check
    CHECK (reverses_entry_id IS NULL OR nullif(trim(coalesce(motif, '')), '') IS NOT NULL),
  -- Une operation en devise etrangere conserve la trace de sa conversion : une
  -- ecriture ancienne ne doit jamais etre reevaluee au taux courant.
  CONSTRAINT snp_glc_conversion_check CHECK (
    devise = 'XOF'
    OR (montant_xof IS NOT NULL AND taux_change IS NOT NULL AND taux_horodate IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_glc_idempotence
  ON public.snp_grand_livre_commercial (idempotency_key);
-- Une ecriture ne peut etre contrepassee qu'une fois.
CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_glc_contrepassation_unique
  ON public.snp_grand_livre_commercial (reverses_entry_id)
  WHERE reverses_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_snp_glc_contrepartie
  ON public.snp_grand_livre_commercial (contrepartie_type, contrepartie_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snp_glc_sale
  ON public.snp_grand_livre_commercial (sale_id) WHERE sale_id IS NOT NULL;

DROP TRIGGER IF EXISTS snp_glc_immuable ON public.snp_grand_livre_commercial;
CREATE TRIGGER snp_glc_immuable
  BEFORE UPDATE OR DELETE ON public.snp_grand_livre_commercial
  FOR EACH ROW EXECUTE FUNCTION public.snp_refuser_alteration_ecriture();

-- ---------------------------------------------------------------------------
-- 3. Grand livre fiscal
-- ---------------------------------------------------------------------------
-- Un sous-compte par mine et par taxe. Un solde crediteur constate un
-- trop-verse ; il ne devient compensable qu'apres approbation explicite.

CREATE TABLE IF NOT EXISTS public.snp_grand_livre_fiscal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mining_company_id uuid NOT NULL REFERENCES public.mining_companies(id) ON DELETE RESTRICT,
  code_taxe text NOT NULL,
  periode text,
  exercice text,
  sens text NOT NULL,
  montant numeric NOT NULL,
  devise text NOT NULL DEFAULT 'XOF',
  type_mouvement text NOT NULL,
  statut_credit text,
  sale_id uuid REFERENCES public.sales(id) ON DELETE RESTRICT,
  facture_id uuid,
  conciliation_id uuid,
  regle_id uuid REFERENCES public.snp_regles_fiscales(id) ON DELETE RESTRICT,
  calcul_id uuid REFERENCES public.snp_calculs_fiscaux(id) ON DELETE RESTRICT,
  reverses_entry_id uuid REFERENCES public.snp_grand_livre_fiscal(id) ON DELETE RESTRICT,
  motif text,
  idempotency_key text NOT NULL,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_glf_sens_check CHECK (sens IN ('debit', 'credit')),
  CONSTRAINT snp_glf_montant_check CHECK (montant > 0),
  CONSTRAINT snp_glf_code_check
    CHECK (code_taxe IN ('tva', 'royalties', 'fndl', 'retenue_source', 'taxe_communale')),
  CONSTRAINT snp_glf_mouvement_check CHECK (type_mouvement IN (
    'taxe_provisoire', 'ajustement_conciliation', 'reversement',
    'compensation', 'remboursement', 'contrepassation'
  )),
  -- Un trop-verse n'est pas compensable du seul fait d'exister : il progresse
  -- de constate a approuve par une decision habilitee.
  CONSTRAINT snp_glf_statut_credit_check CHECK (
    statut_credit IS NULL
    OR statut_credit IN ('constate', 'disponible', 'approuve', 'utilise', 'rembourse')
  ),
  CONSTRAINT snp_glf_contrepassation_motif_check
    CHECK (reverses_entry_id IS NULL OR nullif(trim(coalesce(motif, '')), '') IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_glf_idempotence
  ON public.snp_grand_livre_fiscal (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_glf_contrepassation_unique
  ON public.snp_grand_livre_fiscal (reverses_entry_id)
  WHERE reverses_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_snp_glf_compte
  ON public.snp_grand_livre_fiscal (mining_company_id, code_taxe, created_at DESC);

DROP TRIGGER IF EXISTS snp_glf_immuable ON public.snp_grand_livre_fiscal;
CREATE TRIGGER snp_glf_immuable
  BEFORE UPDATE OR DELETE ON public.snp_grand_livre_fiscal
  FOR EACH ROW EXECUTE FUNCTION public.snp_refuser_alteration_ecriture();

-- ---------------------------------------------------------------------------
-- 4. Reconstruction des soldes
-- ---------------------------------------------------------------------------
-- Le solde n'est jamais lu dans un champ : il est toujours recalcule. Une
-- ecriture contrepassee et sa contrepassation s'annulent d'elles-memes, la
-- seconde portant le sens oppose.

CREATE OR REPLACE FUNCTION public.snp_solde_commercial(
  p_contrepartie_type text,
  p_contrepartie_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $fn$
  SELECT coalesce(sum(
    CASE WHEN sens = 'credit' THEN montant ELSE -montant END
  ), 0)
  FROM public.snp_grand_livre_commercial
  WHERE contrepartie_type = p_contrepartie_type
    AND contrepartie_id = p_contrepartie_id;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_solde_fiscal(
  p_mining_company_id uuid,
  p_code_taxe text
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $fn$
  SELECT coalesce(sum(
    CASE WHEN sens = 'credit' THEN montant ELSE -montant END
  ), 0)
  FROM public.snp_grand_livre_fiscal
  WHERE mining_company_id = p_mining_company_id
    AND code_taxe = p_code_taxe;
$fn$;

REVOKE ALL ON FUNCTION public.snp_solde_commercial(text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.snp_solde_fiscal(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_solde_commercial(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_solde_fiscal(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Ecriture reservee aux procedures de confiance
-- ---------------------------------------------------------------------------

ALTER TABLE public.snp_grand_livre_commercial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_grand_livre_fiscal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snp_glc_lecture ON public.snp_grand_livre_commercial;
CREATE POLICY snp_glc_lecture
  ON public.snp_grand_livre_commercial
  FOR SELECT TO authenticated
  USING (
    public.snp_actor_has_capability('reconciliation.read')
    OR (
      mining_company_id IS NOT NULL
      AND mining_company_id = public.snp_societe_utilisateur()
    )
  );

DROP POLICY IF EXISTS snp_glc_aucune_ecriture_directe ON public.snp_grand_livre_commercial;
CREATE POLICY snp_glc_aucune_ecriture_directe
  ON public.snp_grand_livre_commercial AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS snp_glf_lecture ON public.snp_grand_livre_fiscal;
CREATE POLICY snp_glf_lecture
  ON public.snp_grand_livre_fiscal
  FOR SELECT TO authenticated
  USING (
    public.snp_actor_has_capability('reconciliation.read')
    OR mining_company_id = public.snp_societe_utilisateur()
  );

DROP POLICY IF EXISTS snp_glf_aucune_ecriture_directe ON public.snp_grand_livre_fiscal;
CREATE POLICY snp_glf_aucune_ecriture_directe
  ON public.snp_grand_livre_fiscal AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

REVOKE INSERT, UPDATE, DELETE ON public.snp_grand_livre_commercial FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.snp_grand_livre_fiscal FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Capacites de conciliation
-- ---------------------------------------------------------------------------

INSERT INTO public.snp_capability_catalog (code, domain, label, description, sensitive)
VALUES
  ('reconciliation.read', 'sonasp', 'Consulter les conciliations',
   'Lire les dossiers de conciliation et les grands livres de son périmètre.', false),
  ('reconciliation.create', 'sonasp', 'Ouvrir une conciliation',
   'Créer un dossier de conciliation sur une opération éligible.', true),
  ('reconciliation.edit', 'sonasp', 'Saisir les résultats acheteur',
   'Renseigner poids, teneur, prix et pièces justificatives.', true),
  ('reconciliation.submit', 'sonasp', 'Soumettre une conciliation',
   'Soumettre un dossier à validation. Distincte de la validation.', true),
  ('reconciliation.approve', 'sonasp', 'Valider une conciliation',
   'Arrêter les valeurs définitives. Interdite à l''auteur de la soumission.', true),
  ('reconciliation.reject', 'sonasp', 'Rejeter une conciliation',
   'Refuser une soumission avec motif.', true),
  ('reconciliation.dispute', 'sonasp', 'Contester un résultat acheteur',
   'Ouvrir une contestation et déclencher une contre-analyse.', true),
  ('reconciliation.close', 'sonasp', 'Clore une conciliation',
   'Clore un dossier dont le solde est réglé ou compensé.', true),
  ('reconciliation.export', 'sonasp', 'Exporter les conciliations',
   'Exporter les dossiers et leurs écarts.', false),
  ('reconciliation.tax.adjust', 'sonasp', 'Ajuster une écriture fiscale',
   'Passer un ajustement au grand livre fiscal.', true),
  ('reconciliation.credit.apply', 'sonasp', 'Imputer un avoir',
   'Imputer un avoir sur une opération. Distincte de la validation.', true)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Postflight
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_capacites integer;
BEGIN
  IF to_regclass('public.snp_grand_livre_commercial') IS NULL
     OR to_regclass('public.snp_grand_livre_fiscal') IS NULL THEN
    RAISE EXCEPTION 'Postflight : les grands livres sont absents.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'snp_grand_livre_commercial'
      AND t.tgname = 'snp_glc_immuable' AND NOT t.tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'snp_grand_livre_fiscal'
      AND t.tgname = 'snp_glf_immuable' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Postflight : l''immuabilite n''est pas garantie.';
  END IF;

  SELECT count(*) INTO v_capacites
  FROM public.snp_capability_catalog WHERE code LIKE 'reconciliation.%';
  IF v_capacites <> 11 THEN
    RAISE EXCEPTION 'Postflight : % capacites de conciliation au lieu de 11.', v_capacites;
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
