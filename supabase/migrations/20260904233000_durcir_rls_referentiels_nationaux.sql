-- Durcit les politiques RLS des référentiels nationaux (raffineries, transporteurs)
-- et corrige les comptes bancaires des sociétés.
--
-- Constats :
--  * refineries et transport_companies exposaient des politiques d'ECRITURE
--    « USING (true) » / « WITH CHECK (true) » : tout compte authentifié (mine,
--    comptoir, collecteur...) pouvait créer/modifier/supprimer ces référentiels
--    nationaux. transport_companies portait en plus des politiques dupliquées
--    (trois variantes par commande) héritées de migrations successives.
--  * stakeholder_bank_accounts n'avait AUCUNE politique DELETE : le remplacement
--    des coordonnées bancaires d'une société (delete puis insert) supprimait zéro
--    ligne en silence et accumulait des doublons ; l'INSERT restait « WITH CHECK
--    (true) », ouvert à tout compte authentifié.
--
-- Correctif : écritures réservées aux gestionnaires de référentiels
-- (snp_sec_can_admin_referentials = AAL2 + capacité referentials.manage), politiques
-- dédupliquées, lecture conservée large (les formulaires d'expédition listent
-- transporteurs et raffineries). Migration additive, idempotente. Aucune fonction
-- n'est créée : le registre RPC deny-by-default n'est pas modifié.

-- ============================ REFINERIES ============================
DROP POLICY IF EXISTS "Authenticated users can create refineries" ON public.refineries;
DROP POLICY IF EXISTS "Authenticated users can update refineries" ON public.refineries;
DROP POLICY IF EXISTS "Authenticated users can delete refineries" ON public.refineries;

CREATE POLICY snp_refineries_insert_referentials ON public.refineries
  FOR INSERT TO authenticated
  WITH CHECK (public.snp_sec_can_admin_referentials());
CREATE POLICY snp_refineries_update_referentials ON public.refineries
  FOR UPDATE TO authenticated
  USING (public.snp_sec_can_admin_referentials())
  WITH CHECK (public.snp_sec_can_admin_referentials());
CREATE POLICY snp_refineries_delete_referentials ON public.refineries
  FOR DELETE TO authenticated
  USING (public.snp_sec_can_admin_referentials());
-- La lecture (« Authenticated users can view all refineries ») reste inchangée.

-- ========================= TRANSPORT_COMPANIES =========================
-- Suppression des politiques dupliquées et permissives.
DROP POLICY IF EXISTS "Authenticated users can view transport companies" ON public.transport_companies;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.transport_companies;
DROP POLICY IF EXISTS authenticated_users_select_transport_companies ON public.transport_companies;
DROP POLICY IF EXISTS "Authenticated users can insert transport companies" ON public.transport_companies;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.transport_companies;
DROP POLICY IF EXISTS authenticated_users_insert_transport_companies ON public.transport_companies;
DROP POLICY IF EXISTS "Authenticated users can update transport companies" ON public.transport_companies;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.transport_companies;
DROP POLICY IF EXISTS authenticated_users_update_transport_companies ON public.transport_companies;
DROP POLICY IF EXISTS "Authenticated users can delete transport companies" ON public.transport_companies;
DROP POLICY IF EXISTS authenticated_users_delete_transport_companies ON public.transport_companies;

CREATE POLICY snp_transport_companies_select ON public.transport_companies
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY snp_transport_companies_insert_referentials ON public.transport_companies
  FOR INSERT TO authenticated
  WITH CHECK (public.snp_sec_can_admin_referentials());
CREATE POLICY snp_transport_companies_update_referentials ON public.transport_companies
  FOR UPDATE TO authenticated
  USING (public.snp_sec_can_admin_referentials())
  WITH CHECK (public.snp_sec_can_admin_referentials());
CREATE POLICY snp_transport_companies_delete_referentials ON public.transport_companies
  FOR DELETE TO authenticated
  USING (public.snp_sec_can_admin_referentials());

-- ====================== STAKEHOLDER_BANK_ACCOUNTS ======================
-- INSERT trop ouvert (« WITH CHECK (true) ») et DELETE inexistant (doublons).
-- Alignement sur la condition déjà appliquée à l'UPDATE (rôle management/admin).
DROP POLICY IF EXISTS stakeholder_bank_accounts_insert_policy ON public.stakeholder_bank_accounts;
DROP POLICY IF EXISTS stakeholder_bank_accounts_delete_policy ON public.stakeholder_bank_accounts;

CREATE POLICY stakeholder_bank_accounts_insert_policy ON public.stakeholder_bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = ANY (ARRAY['management'::text, 'admin'::text])
  ));
CREATE POLICY stakeholder_bank_accounts_delete_policy ON public.stakeholder_bank_accounts
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = ANY (ARRAY['management'::text, 'admin'::text])
  ));

-- ============================== POSTFLIGHT ==============================
DO $postflight$
DECLARE
  v_ouvertes int;
  v_delete_bank int;
BEGIN
  -- Plus aucune écriture « (true) » sur ces référentiels.
  SELECT count(*) INTO v_ouvertes
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('refineries', 'transport_companies')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
    AND (coalesce(with_check, '') = 'true' OR coalesce(qual, '') = 'true');
  IF v_ouvertes > 0 THEN
    RAISE EXCEPTION 'Des politiques d''écriture permissives subsistent sur les référentiels (%).', v_ouvertes;
  END IF;

  -- La suppression des comptes bancaires est désormais possible pour les habilités.
  SELECT count(*) INTO v_delete_bank
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'stakeholder_bank_accounts' AND cmd = 'DELETE';
  IF v_delete_bank = 0 THEN
    RAISE EXCEPTION 'La politique DELETE des comptes bancaires est absente.';
  END IF;
END;
$postflight$;

NOTIFY pgrst, 'reload schema';
