-- Avoirs client et imputations.
--
-- POURQUOI UNE NOUVELLE TABLE PLUTOT QUE L'EXTENSION DE snp_avoirs_achat
-- snp_avoirs_achat existe mais couvre un autre flux : elle se rattache a
-- snp_factures_achat par facture_id, porte mining_company_id sans customer_id,
-- et ne connait que deux etats, applique ou annule. C'est l'avoir consenti dans
-- un achat, non celui du au client apres conciliation. Y greffer une
-- contrepartie client et un cycle de vie complet melerait deux flux distincts.
--
-- L'avoir client nait d'un trop-percu : la valeur definitive de la vente est
-- inferieure a ce que le client a deja regle. Il devient une dette du vendeur,
-- remboursable ou imputable sur une vente ulterieure.
--
-- CONCURRENCE
-- Le cahier des charges exige que deux utilisateurs ne puissent jamais consommer
-- le meme avoir. Le controle ne peut pas etre applicatif : deux transactions
-- simultanees liraient le meme solde. La procedure d'imputation verrouille donc
-- la ligne d'avoir, et un declencheur refuse toute imputation qui porterait le
-- cumul au-dela du montant initial.
--
-- RETOUR ARRIERE
--   DROP TABLE public.snp_avoirs_imputations;
--   DROP TABLE public.snp_avoirs_client;
--   DROP FUNCTION public.snp_avoir_imputer(uuid, uuid, numeric, uuid);
--   DROP FUNCTION public.snp_avoir_solde(uuid);
--   DROP FUNCTION public.snp_avoirs_verifier_cumul();

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Avoirs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.snp_avoirs_client (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  mining_company_id uuid REFERENCES public.mining_companies(id) ON DELETE RESTRICT,
  conciliation_id uuid REFERENCES public.snp_conciliations(id) ON DELETE RESTRICT,
  sale_id_origine uuid REFERENCES public.sales(id) ON DELETE RESTRICT,
  montant_initial numeric NOT NULL,
  devise text NOT NULL DEFAULT 'XOF',
  motif text NOT NULL,
  statut text NOT NULL DEFAULT 'disponible',
  rembourse_le timestamptz,
  rembourse_par uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  annule_le timestamptz,
  annule_par uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_avoirs_client_montant_check CHECK (montant_initial > 0),
  CONSTRAINT snp_avoirs_client_motif_check CHECK (length(trim(motif)) >= 10),
  CONSTRAINT snp_avoirs_client_statut_check CHECK (statut IN (
    'disponible', 'partiellement_utilise', 'utilise', 'rembourse', 'annule'
  )),
  CONSTRAINT snp_avoirs_client_remboursement_check CHECK (
    statut <> 'rembourse' OR (rembourse_le IS NOT NULL AND rembourse_par IS NOT NULL)
  ),
  CONSTRAINT snp_avoirs_client_annulation_check CHECK (
    statut <> 'annule' OR (annule_le IS NOT NULL AND annule_par IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_avoirs_client_reference
  ON public.snp_avoirs_client (reference);
CREATE INDEX IF NOT EXISTS idx_snp_avoirs_client_disponibles
  ON public.snp_avoirs_client (customer_id, statut)
  WHERE statut IN ('disponible', 'partiellement_utilise');

-- ---------------------------------------------------------------------------
-- 2. Imputations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.snp_avoirs_imputations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avoir_id uuid NOT NULL REFERENCES public.snp_avoirs_client(id) ON DELETE RESTRICT,
  sale_id uuid REFERENCES public.sales(id) ON DELETE RESTRICT,
  conciliation_id uuid REFERENCES public.snp_conciliations(id) ON DELETE RESTRICT,
  montant_impute numeric NOT NULL,
  motif text,
  idempotency_key text NOT NULL,
  impute_par uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_avoirs_imputations_montant_check CHECK (montant_impute > 0),
  -- Une imputation vise toujours une operation.
  CONSTRAINT snp_avoirs_imputations_cible_check
    CHECK (sale_id IS NOT NULL OR conciliation_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_avoirs_imputations_idempotence
  ON public.snp_avoirs_imputations (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_snp_avoirs_imputations_avoir
  ON public.snp_avoirs_imputations (avoir_id);

-- Une imputation ne se modifie ni ne se supprime : elle se corrige par une
-- ecriture inverse, comme au grand livre.
DROP TRIGGER IF EXISTS snp_avoirs_imputations_immuable ON public.snp_avoirs_imputations;
CREATE TRIGGER snp_avoirs_imputations_immuable
  BEFORE UPDATE OR DELETE ON public.snp_avoirs_imputations
  FOR EACH ROW EXECUTE FUNCTION public.snp_refuser_alteration_ecriture();

-- ---------------------------------------------------------------------------
-- 3. Le cumul ne depasse jamais le montant initial
-- ---------------------------------------------------------------------------
-- Un controle applicatif ne suffirait pas : deux transactions simultanees
-- liraient le meme solde avant d'ecrire. La verification est donc portee par un
-- declencheur, et l'imputation verrouille la ligne d'avoir au prealable.

CREATE OR REPLACE FUNCTION public.snp_avoirs_verifier_cumul()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_montant_initial numeric;
  v_cumul numeric;
BEGIN
  SELECT montant_initial INTO v_montant_initial
  FROM public.snp_avoirs_client WHERE id = NEW.avoir_id;

  IF v_montant_initial IS NULL THEN
    RAISE EXCEPTION 'Avoir introuvable.' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(sum(montant_impute), 0) INTO v_cumul
  FROM public.snp_avoirs_imputations WHERE avoir_id = NEW.avoir_id;

  IF v_cumul + NEW.montant_impute > v_montant_initial + 0.001 THEN
    RAISE EXCEPTION
      'Imputation refusée : le cumul (%) dépasserait le montant de l''avoir (%).',
      v_cumul + NEW.montant_impute, v_montant_initial
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_avoirs_imputations_cumul ON public.snp_avoirs_imputations;
CREATE TRIGGER snp_avoirs_imputations_cumul
  BEFORE INSERT ON public.snp_avoirs_imputations
  FOR EACH ROW EXECUTE FUNCTION public.snp_avoirs_verifier_cumul();

-- ---------------------------------------------------------------------------
-- 4. Solde
-- ---------------------------------------------------------------------------
-- Le solde n'est pas stocke : il se deduit des imputations.

CREATE OR REPLACE FUNCTION public.snp_avoir_solde(p_avoir_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $fn$
  SELECT a.montant_initial - coalesce((
    SELECT sum(i.montant_impute)
    FROM public.snp_avoirs_imputations i WHERE i.avoir_id = a.id
  ), 0)
  FROM public.snp_avoirs_client a WHERE a.id = p_avoir_id;
$fn$;

REVOKE ALL ON FUNCTION public.snp_avoir_solde(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_avoir_solde(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Numerotation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.snp_numeroter_avoir()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_annee integer := extract(year FROM coalesce(NEW.created_at, now()))::integer;
BEGIN
  IF NEW.reference IS NULL OR length(trim(NEW.reference)) = 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('SONASP:avoirs:' || v_annee::text));
    NEW.reference := public.snp_numero_suivant(
      'AVO', v_annee, 'public.snp_avoirs_client'::regclass, 'reference'
    );
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_snp_avoirs_client_numero ON public.snp_avoirs_client;
CREATE TRIGGER trg_snp_avoirs_client_numero
  BEFORE INSERT ON public.snp_avoirs_client
  FOR EACH ROW EXECUTE FUNCTION public.snp_numeroter_avoir();

DROP TRIGGER IF EXISTS trg_snp_avoirs_client_touch ON public.snp_avoirs_client;
CREATE TRIGGER trg_snp_avoirs_client_touch
  BEFORE UPDATE ON public.snp_avoirs_client
  FOR EACH ROW EXECUTE FUNCTION public.snp_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Imputation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.snp_avoir_imputer(
  p_avoir_id uuid,
  p_sale_id uuid,
  p_montant numeric,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $fn$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
  v_avoir public.snp_avoirs_client%ROWTYPE;
  v_solde numeric;
  v_nouveau_solde numeric;
  v_statut text;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Une authentification forte est requise.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.snp_actor_has_capability('reconciliation.credit.apply') THEN
    RAISE EXCEPTION 'Vous n''êtes pas habilité à imputer un avoir.' USING ERRCODE = '42501';
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant imputé doit être positif.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_actor FROM public.user_profiles WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil actif introuvable.' USING ERRCODE = '42501';
  END IF;

  -- Le verrou serialise les imputations concurrentes du meme avoir.
  SELECT * INTO v_avoir
  FROM public.snp_avoirs_client WHERE id = p_avoir_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avoir introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_avoir.statut NOT IN ('disponible', 'partiellement_utilise') THEN
    RAISE EXCEPTION 'L''avoir % n''est plus imputable (statut %).',
      v_avoir.reference, v_avoir.statut USING ERRCODE = '22023';
  END IF;

  v_solde := public.snp_avoir_solde(p_avoir_id);
  IF p_montant > v_solde + 0.001 THEN
    RAISE EXCEPTION
      'Imputation refusée : % demandé pour un solde de % sur l''avoir %.',
      p_montant, v_solde, v_avoir.reference
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.snp_avoirs_imputations (
    avoir_id, sale_id, montant_impute, idempotency_key, impute_par
  ) VALUES (
    p_avoir_id, p_sale_id, p_montant, p_idempotency_key::text, v_actor.id
  );

  v_nouveau_solde := public.snp_avoir_solde(p_avoir_id);
  v_statut := CASE
    WHEN v_nouveau_solde <= 0.001 THEN 'utilise'
    ELSE 'partiellement_utilise'
  END;

  UPDATE public.snp_avoirs_client SET statut = v_statut WHERE id = p_avoir_id;

  -- L'imputation se lit aussi au grand livre commercial.
  INSERT INTO public.snp_grand_livre_commercial (
    contrepartie_type, contrepartie_id, mining_company_id, sens, montant,
    type_mouvement, source_type, source_id, sale_id, idempotency_key, created_by
  ) VALUES (
    'customer', v_avoir.customer_id, v_avoir.mining_company_id, 'credit', p_montant,
    'imputation_avoir', 'avoir', p_avoir_id, p_sale_id,
    'imput-' || p_idempotency_key::text, v_actor.id
  );

  RETURN jsonb_build_object(
    'avoir_id', p_avoir_id,
    'reference', v_avoir.reference,
    'montant_impute', p_montant,
    'solde_restant', v_nouveau_solde,
    'statut', v_statut
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_avoir_imputer(uuid, uuid, numeric, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_avoir_imputer(uuid, uuid, numeric, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Droits et politiques
-- ---------------------------------------------------------------------------

ALTER TABLE public.snp_avoirs_client ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_avoirs_imputations ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.snp_avoirs_client TO authenticated;
GRANT SELECT ON public.snp_avoirs_imputations TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.snp_avoirs_client, public.snp_avoirs_imputations FROM anon, authenticated;

DROP POLICY IF EXISTS snp_avoirs_client_lecture ON public.snp_avoirs_client;
CREATE POLICY snp_avoirs_client_lecture
  ON public.snp_avoirs_client FOR SELECT TO authenticated
  USING (
    public.snp_actor_has_capability('reconciliation.read')
    OR (mining_company_id IS NOT NULL AND mining_company_id = public.snp_societe_utilisateur())
  );

DROP POLICY IF EXISTS snp_avoirs_imputations_lecture ON public.snp_avoirs_imputations;
CREATE POLICY snp_avoirs_imputations_lecture
  ON public.snp_avoirs_imputations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.snp_avoirs_client a
    WHERE a.id = avoir_id AND (
      public.snp_actor_has_capability('reconciliation.read')
      OR (a.mining_company_id IS NOT NULL AND a.mining_company_id = public.snp_societe_utilisateur())
    )
  ));

-- Trois politiques ciblees, jamais FOR ALL : celle-ci couvrirait aussi la
-- lecture et annulerait la politique ci-dessus.
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['snp_avoirs_client', 'snp_avoirs_imputations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_aucune_insertion_directe', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false)',
      v_table || '_aucune_insertion_directe', v_table
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_aucune_modification_directe', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false)',
      v_table || '_aucune_modification_directe', v_table
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_aucune_suppression_directe', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (false)',
      v_table || '_aucune_suppression_directe', v_table
    );
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.snp_avoirs_client') IS NULL
     OR to_regclass('public.snp_avoirs_imputations') IS NULL THEN
    RAISE EXCEPTION 'Postflight : les tables d''avoirs sont absentes.';
  END IF;
  IF to_regprocedure('public.snp_avoir_imputer(uuid, uuid, numeric, uuid)') IS NULL THEN
    RAISE EXCEPTION 'Postflight : la procédure d''imputation est absente.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'snp_avoirs_imputations'
      AND t.tgname = 'snp_avoirs_imputations_cumul' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Postflight : le contrôle de cumul est absent.';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
