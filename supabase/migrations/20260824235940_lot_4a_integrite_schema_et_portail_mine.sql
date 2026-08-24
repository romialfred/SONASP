-- Lot 4A - intégrité relationnelle, vues invoker et garde du portail Mine.
--
-- Cette migration est volontairement additive et rejouable. Elle ne répare
-- aucune donnée historique de façon implicite : les relations propres sont
-- validées, tandis que la divergence Production -> Expédition déjà connue est
-- conservée sous une FK NOT VALID qui protège néanmoins les nouvelles lignes.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- -------------------------------------------------------------------------
-- 0. Préflight : aucune écriture ne précède ces contrôles.
-- -------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_count bigint;
  v_required text;
BEGIN
  FOREACH v_required IN ARRAY ARRAY[
    'public.shipping_preparations',
    'public.shipping_production_items',
    'public.daily_production',
    'public.freight_shipments',
    'public.assay_certificates',
    'public.assay_certificate_data',
    'public.user_profiles',
    'public.user_invitations',
    'public.snp_artisans_miniers',
    'public.snp_reglements_achat'
  ] LOOP
    IF to_regclass(v_required) IS NULL THEN
      RAISE EXCEPTION 'Préflight 4A : objet requis absent : %.', v_required;
    END IF;
  END LOOP;

  IF to_regprocedure('public.snp_require_capability(text)') IS NULL
     OR to_regprocedure('public.snp_actor_has_capability(text)') IS NULL
     OR to_regprocedure('public.snp_sec_can_read_shipping(uuid)') IS NULL
     OR to_regprocedure('public.snp_sec_can_read_company(uuid)') IS NULL THEN
    RAISE EXCEPTION
      'Préflight 4A : les gardes capability/tenant du socle P0 sont absentes.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.snp_capability_catalog WHERE code = 'mine.operate'
  ) THEN
    RAISE EXCEPTION 'Préflight 4A : la capability mine.operate est absente.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.assay_certificate_data d
  LEFT JOIN public.assay_certificates c ON c.id = d.certificate_id
  LEFT JOIN public.shipping_preparations s ON s.id = d.shipping_preparation_id
  WHERE d.shipping_preparation_id IS NULL
     OR c.id IS NULL
     OR s.id IS NULL
     OR d.shipping_preparation_id IS DISTINCT FROM c.shipping_preparation_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Préflight 4A : % donnée(s) de certificat sans parent Shipping cohérent. Réconcilier certificate_id/shipping_preparation_id avant migration.',
      v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.freight_shipments f
  LEFT JOIN public.shipping_preparations s ON s.id = f.shipping_preparation_id
  WHERE f.shipping_preparation_id IS NOT NULL
    AND (
      s.id IS NULL
      OR f.mining_company_id IS NULL
      OR f.mining_company_id IS DISTINCT FROM s.mining_company_id
    );
  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Préflight 4A : % fret(s) ont un parent Shipping absent ou un tenant divergent.',
      v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.user_profiles p
  LEFT JOIN public.user_invitations i ON i.id = p.invitation_id
  WHERE p.invitation_id IS NOT NULL AND i.id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Préflight 4A : % profil(s) référencent une invitation absente.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.snp_artisans_miniers a
  LEFT JOIN public.snp_artisans_miniers c ON c.id = a.collecteur_id
  WHERE a.collecteur_id IS NOT NULL
    AND (c.id IS NULL OR c.type_artisan IS DISTINCT FROM 'collecteur' OR a.id = c.id);
  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Préflight 4A : % rattachement(s) artisan/collecteur sont orphelins, auto-référents ou de type incorrect.',
      v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.shipping_preparations s
  JOIN public.daily_production d ON d.id = s.daily_production_id
  WHERE s.mining_company_id IS DISTINCT FROM d.mining_company_id;
  IF v_count > 0 THEN
    RAISE NOTICE
      'Lot 4A : % divergence(s) historique(s) Production -> Expédition restent à réconcilier ; la FK est créée NOT VALID pour bloquer les nouvelles divergences.',
      v_count;
  END IF;
END;
$preflight$;

-- -------------------------------------------------------------------------
-- 1. Vues API : contexte de l'appelant + prédicat tenant explicite.
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.assay_certificates_with_shipping
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  ac.*,
  sp.expedition_lot_number,
  sp.status::text AS shipping_status,
  sp.total_net_weight_grams AS shipping_weight,
  sp.total_gross_weight_grams AS shipping_gross_weight,
  sp.shipped_to_company,
  sp.shipped_to_address,
  sp.shipped_to_country,
  sp.mining_company_id,
  mc.name AS mining_company_name,
  mc.country AS mining_company_country,
  sp.prepared_at,
  sp.shipped_at,
  sp.created_at AS shipping_created_at
FROM public.assay_certificates ac
JOIN public.shipping_preparations sp ON sp.id = ac.shipping_preparation_id
LEFT JOIN public.mining_companies mc ON mc.id = sp.mining_company_id
WHERE public.snp_sec_can_read_shipping(ac.shipping_preparation_id);

-- Le cycle canonique 2026 ne contient plus les statuts legacy
-- validated_for_refinery/refined. La disponibilité Raffinerie/Prévente est
-- désormais portée par ready_for_expedition.
CREATE OR REPLACE VIEW public.shipments_for_refinery
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  sp.*,
  dp.production_date,
  dp.bullion_grams,
  dp.pure_gold_grams,
  dp.estimated_fineness_pct
FROM public.shipping_preparations sp
LEFT JOIN public.daily_production dp ON dp.id = sp.daily_production_id
WHERE sp.status = 'ready_for_expedition'::public.shipping_preparation_status
  AND public.snp_sec_can_read_shipping(sp.id);

CREATE OR REPLACE VIEW public.shipments_for_presale
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  sp.*,
  dp.production_date,
  dp.bullion_grams,
  dp.pure_gold_grams,
  dp.estimated_fineness_pct,
  dp.estimated_oz
FROM public.shipping_preparations sp
LEFT JOIN public.daily_production dp ON dp.id = sp.daily_production_id
WHERE sp.status = 'ready_for_expedition'::public.shipping_preparation_status
  AND public.snp_sec_can_read_shipping(sp.id);

CREATE OR REPLACE VIEW public.daily_production_with_metals
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  dp.*,
  dp.bullion_grams * dp.estimated_gold_pct / 100 AS gold_content_grams,
  (dp.bullion_grams * dp.estimated_gold_pct / 100) / 31.1034768 AS gold_content_oz,
  COALESCE(dp.silver_content_grams, 0) / 31.1034768 AS silver_content_oz,
  dp.bullion_grams * dp.estimated_gold_pct / 100
    + COALESCE(dp.silver_content_grams, 0) AS total_metal_content_grams,
  COALESCE(dp.estimated_gold_pct, 0)
    + COALESCE(dp.estimated_silver_pct, 0) AS total_metal_pct
FROM public.daily_production dp
WHERE public.snp_sec_can_read_company(dp.mining_company_id);

REVOKE ALL ON TABLE public.assay_certificates_with_shipping FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.shipments_for_refinery FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.shipments_for_presale FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.daily_production_with_metals FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.assay_certificates_with_shipping TO authenticated;
GRANT SELECT ON TABLE public.shipments_for_refinery TO authenticated;
GRANT SELECT ON TABLE public.shipments_for_presale TO authenticated;
GRANT SELECT ON TABLE public.daily_production_with_metals TO authenticated;

COMMENT ON VIEW public.assay_certificates_with_shipping IS
  'Certificats et expéditions visibles dans le tenant de l’appelant ; SECURITY INVOKER et RLS des tables parentes.';
COMMENT ON VIEW public.shipments_for_refinery IS
  'Expéditions prêtes pour la raffinerie, filtrées par tenant sous SECURITY INVOKER.';
COMMENT ON VIEW public.shipments_for_presale IS
  'Expéditions prêtes pour la prévente, filtrées par tenant sous SECURITY INVOKER.';
COMMENT ON VIEW public.daily_production_with_metals IS
  'Calculs de métaux sur les productions du tenant courant sous SECURITY INVOKER.';

-- -------------------------------------------------------------------------
-- 2. FK critiques et cohérence tenant.
-- -------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipping_preparations_id_company
  ON public.shipping_preparations(id, mining_company_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_production_id_company
  ON public.daily_production(id, mining_company_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assay_certificates_id_shipping
  ON public.assay_certificates(id, shipping_preparation_id);

ALTER TABLE public.assay_certificate_data
  ALTER COLUMN shipping_preparation_id SET NOT NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.assay_certificate_data'::regclass
      AND conname = 'assay_certificate_data_certificate_shipping_fkey'
  ) THEN
    ALTER TABLE public.assay_certificate_data
      ADD CONSTRAINT assay_certificate_data_certificate_shipping_fkey
      FOREIGN KEY (certificate_id, shipping_preparation_id)
      REFERENCES public.assay_certificates(id, shipping_preparation_id)
      ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.freight_shipments'::regclass
      AND conname = 'freight_shipping_requires_company'
  ) THEN
    ALTER TABLE public.freight_shipments
      ADD CONSTRAINT freight_shipping_requires_company
      CHECK (shipping_preparation_id IS NULL OR mining_company_id IS NOT NULL)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.freight_shipments'::regclass
      AND conname = 'freight_shipments_shipping_company_fkey'
  ) THEN
    ALTER TABLE public.freight_shipments
      ADD CONSTRAINT freight_shipments_shipping_company_fkey
      FOREIGN KEY (shipping_preparation_id, mining_company_id)
      REFERENCES public.shipping_preparations(id, mining_company_id)
      ON UPDATE RESTRICT ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND conname = 'user_profiles_invitation_id_fkey'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_invitation_id_fkey
      FOREIGN KEY (invitation_id)
      REFERENCES public.user_invitations(id)
      ON UPDATE RESTRICT ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.snp_artisans_miniers'::regclass
      AND conname = 'snp_artisans_collecteur_distinct'
  ) THEN
    ALTER TABLE public.snp_artisans_miniers
      ADD CONSTRAINT snp_artisans_collecteur_distinct
      CHECK (collecteur_id IS NULL OR collecteur_id <> id) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.snp_artisans_miniers'::regclass
      AND conname = 'snp_artisans_collecteur_id_fkey'
  ) THEN
    ALTER TABLE public.snp_artisans_miniers
      ADD CONSTRAINT snp_artisans_collecteur_id_fkey
      FOREIGN KEY (collecteur_id)
      REFERENCES public.snp_artisans_miniers(id)
      ON UPDATE RESTRICT ON DELETE RESTRICT NOT VALID;
  END IF;

  -- Une divergence historique est connue. NOT VALID protège les nouvelles
  -- écritures sans faire passer l'historique divergent pour conforme.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.shipping_preparations'::regclass
      AND conname = 'shipping_production_requires_company'
  ) THEN
    ALTER TABLE public.shipping_preparations
      ADD CONSTRAINT shipping_production_requires_company
      CHECK (daily_production_id IS NULL OR mining_company_id IS NOT NULL)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.shipping_preparations'::regclass
      AND conname = 'shipping_production_company_fkey'
  ) THEN
    ALTER TABLE public.shipping_preparations
      ADD CONSTRAINT shipping_production_company_fkey
      FOREIGN KEY (daily_production_id, mining_company_id)
      REFERENCES public.daily_production(id, mining_company_id)
      ON UPDATE RESTRICT ON DELETE RESTRICT NOT VALID;
  END IF;
END;
$constraints$;

ALTER TABLE public.assay_certificate_data
  VALIDATE CONSTRAINT assay_certificate_data_certificate_shipping_fkey;
ALTER TABLE public.freight_shipments
  VALIDATE CONSTRAINT freight_shipping_requires_company;
ALTER TABLE public.freight_shipments
  VALIDATE CONSTRAINT freight_shipments_shipping_company_fkey;
ALTER TABLE public.user_profiles
  VALIDATE CONSTRAINT user_profiles_invitation_id_fkey;
ALTER TABLE public.snp_artisans_miniers
  VALIDATE CONSTRAINT snp_artisans_collecteur_distinct;
ALTER TABLE public.snp_artisans_miniers
  VALIDATE CONSTRAINT snp_artisans_collecteur_id_fkey;

CREATE INDEX IF NOT EXISTS idx_assay_certificate_data_shipping
  ON public.assay_certificate_data(shipping_preparation_id, certificate_id);
CREATE INDEX IF NOT EXISTS idx_assay_certificate_data_certificate_shipping
  ON public.assay_certificate_data(certificate_id, shipping_preparation_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_invitation
  ON public.user_profiles(invitation_id) WHERE invitation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_freight_shipping_company
  ON public.freight_shipments(shipping_preparation_id, mining_company_id)
  WHERE shipping_preparation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipping_preparations_production_company
  ON public.shipping_preparations(daily_production_id, mining_company_id)
  WHERE daily_production_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipping_preparations_license_company
  ON public.shipping_preparations(export_license_id, mining_company_id)
  WHERE export_license_id IS NOT NULL;

-- Les items ne portent pas de colonne tenant. Le trigger compare donc les
-- deux parents sans inventer ni réécrire le tenant de la ligne historique.
CREATE OR REPLACE FUNCTION public.snp_4a_assert_shipping_item_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_shipping_company uuid;
  v_production_company uuid;
BEGIN
  SELECT mining_company_id INTO v_shipping_company
  FROM public.shipping_preparations
  WHERE id = NEW.shipping_preparation_id;

  SELECT mining_company_id INTO v_production_company
  FROM public.daily_production
  WHERE id = NEW.daily_production_id;

  IF v_shipping_company IS NULL
     OR v_production_company IS NULL
     OR v_shipping_company IS DISTINCT FROM v_production_company THEN
    RAISE EXCEPTION
      'L’item Shipping doit référencer une production du même tenant que son expédition.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_4a_assert_shipping_item_tenant()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER snp_4a_shipping_item_tenant_guard
BEFORE INSERT OR UPDATE OF shipping_preparation_id, daily_production_id
ON public.shipping_production_items
FOR EACH ROW EXECUTE FUNCTION public.snp_4a_assert_shipping_item_tenant();

CREATE OR REPLACE FUNCTION public.snp_4a_assert_artisan_collector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_type text;
BEGIN
  IF NEW.collecteur_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.collecteur_id = NEW.id THEN
    RAISE EXCEPTION 'Un artisan ne peut pas être son propre collecteur.'
      USING ERRCODE = '23514';
  END IF;

  SELECT type_artisan INTO v_type
  FROM public.snp_artisans_miniers
  WHERE id = NEW.collecteur_id;
  IF v_type IS DISTINCT FROM 'collecteur' THEN
    RAISE EXCEPTION 'Le rattachement cible doit être un collecteur existant.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_4a_assert_artisan_collector()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER snp_4a_artisan_collector_guard
BEFORE INSERT OR UPDATE OF collecteur_id
ON public.snp_artisans_miniers
FOR EACH ROW EXECUTE FUNCTION public.snp_4a_assert_artisan_collector();

-- -------------------------------------------------------------------------
-- 3. Indexes essentiels observés dans les parcours tenant/parent.
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_snp_artisan_taxes_comptoir_status
  ON public.snp_artisan_taxes_retenues(
    comptoir_organization_id, statut_reversement
  );
CREATE INDEX IF NOT EXISTS idx_snp_artisan_ventes_acheteur_comptoir_date
  ON public.snp_artisan_ventes_or(
    acheteur_comptoir_organization_id, date_vente DESC
  );
CREATE INDEX IF NOT EXISTS idx_snp_demandes_requisition
  ON public.snp_demandes_achat(requisition_id)
  WHERE requisition_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_snp_collector_accounts_comptoir_active
  ON public.snp_collector_accounts(comptoir_organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_snp_memberships_organization_validity
  ON public.snp_user_organization_memberships(organization_id, valid_until);
CREATE INDEX IF NOT EXISTS idx_snp_comptoir_ventes_sonasp_scope
  ON public.snp_comptoir_ventes_sonasp(
    sonasp_organization_id, status, created_at DESC
  );

-- -------------------------------------------------------------------------
-- 4. Portail Mine : capability obligatoire au point central de résolution.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_societe_compte_mine()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid;
BEGIN
  PERFORM public.snp_require_capability('mine.operate');

  SELECT p.mining_company_id INTO v_societe
  FROM public.user_profiles p
  JOIN public.mining_companies m
    ON m.id = p.mining_company_id AND m.is_active
  WHERE p.id = auth.uid()
    AND p.is_active
    AND p.mining_company_id IS NOT NULL;

  IF v_societe IS NULL THEN
    RAISE EXCEPTION
      'Cette opération est réservée à un compte actif rattaché à une société minière active.'
      USING ERRCODE = '42501';
  END IF;
  RETURN v_societe;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_societe_compte_mine()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.snp_societe_compte_mine() TO authenticated;

COMMENT ON FUNCTION public.snp_societe_compte_mine() IS
  'Résout le tenant Mine après auth.uid, AAL2 et capability sensible mine.operate ; fail-closed si profil ou société inactifs.';

-- Baseline manquante du contrat frontend : accusé de réception d'un règlement.
ALTER TABLE public.snp_reglements_achat
  ADD COLUMN IF NOT EXISTS reception_statut text NOT NULL DEFAULT 'a_confirmer',
  ADD COLUMN IF NOT EXISTS reception_motif text,
  ADD COLUMN IF NOT EXISTS reception_repondu_par uuid,
  ADD COLUMN IF NOT EXISTS reception_repondu_le timestamptz;

DO $reglement_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.snp_reglements_achat'::regclass
      AND conname = 'snp_reglement_reception_statut_check'
  ) THEN
    ALTER TABLE public.snp_reglements_achat
      ADD CONSTRAINT snp_reglement_reception_statut_check
      CHECK (reception_statut IN (
        'non_requise', 'a_confirmer', 'confirmee', 'contestee'
      )) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.snp_reglements_achat'::regclass
      AND conname = 'snp_reglements_reception_repondu_par_fkey'
  ) THEN
    ALTER TABLE public.snp_reglements_achat
      ADD CONSTRAINT snp_reglements_reception_repondu_par_fkey
      FOREIGN KEY (reception_repondu_par)
      REFERENCES auth.users(id)
      ON UPDATE RESTRICT ON DELETE SET NULL NOT VALID;
  END IF;
END;
$reglement_constraints$;

ALTER TABLE public.snp_reglements_achat
  VALIDATE CONSTRAINT snp_reglement_reception_statut_check;
ALTER TABLE public.snp_reglements_achat
  VALIDATE CONSTRAINT snp_reglements_reception_repondu_par_fkey;
CREATE INDEX IF NOT EXISTS idx_snp_reglements_reception_actor
  ON public.snp_reglements_achat(reception_repondu_par)
  WHERE reception_repondu_par IS NOT NULL;

CREATE OR REPLACE FUNCTION public.snp_portail_mine_repondre_reglement(
  p_reglement_id uuid,
  p_decision text,
  p_motif text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid;
  v_statut text;
  v_reception text;
BEGIN
  PERFORM public.snp_require_capability('mine.operate');
  v_societe := public.snp_societe_compte_mine();

  IF p_decision NOT IN ('confirmer', 'contester') THEN
    RAISE EXCEPTION 'Décision de réception invalide.' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'contester'
     AND length(trim(coalesce(p_motif, ''))) < 5 THEN
    RAISE EXCEPTION
      'Le motif de contestation doit contenir au moins cinq caractères.'
      USING ERRCODE = '22023';
  END IF;

  SELECT r.statut, r.reception_statut INTO v_statut, v_reception
  FROM public.snp_reglements_achat r
  WHERE r.id = p_reglement_id
    AND r.mining_company_id = v_societe
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Règlement introuvable dans votre périmètre.'
      USING ERRCODE = '42501';
  END IF;
  IF v_statut NOT IN ('execute', 'rapproche') THEN
    RAISE EXCEPTION 'Seul un règlement exécuté peut être confirmé.'
      USING ERRCODE = '23514';
  END IF;
  IF v_reception <> 'a_confirmer' THEN
    RAISE EXCEPTION 'Une réponse de réception a déjà été enregistrée.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.snp_reglements_achat
  SET reception_statut = CASE
        WHEN p_decision = 'confirmer' THEN 'confirmee'
        ELSE 'contestee'
      END,
      reception_motif = CASE
        WHEN p_decision = 'contester' THEN trim(p_motif)
        ELSE NULL
      END,
      reception_repondu_par = auth.uid(),
      reception_repondu_le = now(),
      updated_at = now()
  WHERE id = p_reglement_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_portail_mine_repondre_reglement(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_repondre_reglement(uuid, text, text)
  TO authenticated;

COMMENT ON FUNCTION public.snp_portail_mine_repondre_reglement(uuid, text, text) IS
  'Accusé de réception atomique d’un règlement du tenant courant ; AAL2 et mine.operate obligatoires, cycle comptable SONASP inchangé.';

-- Toutes les RPC du namespace fonctionnel Portail Mine passent par
-- snp_societe_compte_mine(); elles restent exposées uniquement à authenticated.
DO $portal_grants$
DECLARE
  v_function record;
  v_signature text;
BEGIN
  FOR v_function IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'snp_portail_mine_%'
  LOOP
    v_signature := format(
      '%I.%I(%s)', v_function.nspname, v_function.proname, v_function.args
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',
      v_signature
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO authenticated', v_signature
    );
  END LOOP;
END;
$portal_grants$;

-- -------------------------------------------------------------------------
-- 5. Postflight structurel.
-- -------------------------------------------------------------------------
DO $postflight$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'assay_certificates_with_shipping',
      'shipments_for_refinery',
      'shipments_for_presale',
      'daily_production_with_metals'
    )
    AND c.relkind = 'v'
    AND 'security_invoker=true' = ANY(COALESCE(c.reloptions, ARRAY[]::text[]))
    AND 'security_barrier=true' = ANY(COALESCE(c.reloptions, ARRAY[]::text[]));
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Postflight 4A : les quatre vues ne sont pas invoker/barrier.';
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_constraint
  WHERE conname IN (
      'assay_certificate_data_certificate_shipping_fkey',
      'freight_shipments_shipping_company_fkey',
      'user_profiles_invitation_id_fkey',
      'snp_artisans_collecteur_id_fkey'
    )
    AND convalidated;
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Postflight 4A : les quatre FK propres ne sont pas validées.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.shipping_preparations'::regclass
      AND conname = 'shipping_production_company_fkey'
      AND NOT convalidated
  ) THEN
    RAISE EXCEPTION
      'Postflight 4A : la FK historique Production/Expédition doit rester explicitement NOT VALID.';
  END IF;

  IF position(
       'snp_require_capability(''mine.operate'')'
       IN pg_get_functiondef('public.snp_societe_compte_mine()'::regprocedure)
     ) = 0 THEN
    RAISE EXCEPTION 'Postflight 4A : la garde mine.operate est absente.';
  END IF;
END;
$postflight$;

-- Rollback manuel documenté (non exécuté automatiquement) :
-- 1. Révoquer les nouvelles RPC avant tout retrait de colonne.
-- 2. Supprimer les deux triggers snp_4a_* puis leurs fonctions.
-- 3. Supprimer uniquement les contraintes/indexes portant les noms de ce lot.
-- 4. Conserver security_invoker sur les vues : revenir à SECURITY DEFINER
--    réintroduirait une fuite RLS et n'est pas un rollback de sécurité acceptable.
-- 5. Les colonnes reception_* sont additives ; les conserver évite toute perte
--    d'accusés déjà enregistrés même si la RPC devait être désactivée.

COMMIT;
