-- Durcit les politiques RLS des certificats d'analyse (approbations et metaux de base).
--
-- Constats :
--  * certificate_approvals : INSERT « check=true », SELECT « true » -> tout compte
--    authentifie pouvait FORGER une ligne d'approbation en PostgREST direct. Le
--    statut autoritatif vit sur assay_certificates (lui, gouverne par capacite),
--    mais ce journal d'audit doit rester digne de confiance. Le flux applicatif
--    approuver/rejeter n'est pas cable a l'UI : le durcissement n'a aucun risque
--    de regression.
--  * assay_base_metals : INSERT/UPDATE « true » alors que la table n'est JAMAIS
--    ecrite par le client (les metaux traces sont ranges dans assay_certificate_data).
--    On ferme l'ecriture directe.
--
-- Gate : remonter certificate_id -> assay_certificates.shipping_preparation_id puis
-- appliquer les gardes d'expedition existantes (snp_sec_can_prepare/approve/read_shipping),
-- exactement comme les policies de assay_certificate_data. Migration additive et
-- idempotente. Aucune fonction creee (registre RPC intact).

-- ========================= CERTIFICATE_APPROVALS =========================
DROP POLICY IF EXISTS "Authenticated users can create approvals" ON public.certificate_approvals;
DROP POLICY IF EXISTS "Authenticated users can view approvals" ON public.certificate_approvals;

CREATE POLICY snp_certificate_approvals_insert ON public.certificate_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.snp_sec_can_prepare_shipping(
      (SELECT c.shipping_preparation_id FROM public.assay_certificates c WHERE c.id = certificate_id)
    )
    OR public.snp_sec_can_approve_shipping(
      (SELECT c.shipping_preparation_id FROM public.assay_certificates c WHERE c.id = certificate_id)
    )
  );
CREATE POLICY snp_certificate_approvals_select ON public.certificate_approvals
  FOR SELECT TO authenticated
  USING (
    public.snp_sec_can_read_shipping(
      (SELECT c.shipping_preparation_id FROM public.assay_certificates c WHERE c.id = certificate_id)
    )
  );

-- ============================ ASSAY_BASE_METALS ============================
DROP POLICY IF EXISTS "Users can insert base metals" ON public.assay_base_metals;
DROP POLICY IF EXISTS "Users can update base metals" ON public.assay_base_metals;

CREATE POLICY snp_assay_base_metals_insert ON public.assay_base_metals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.snp_sec_can_prepare_shipping(
      (SELECT c.shipping_preparation_id FROM public.assay_certificates c WHERE c.id = certificate_id)
    )
  );
CREATE POLICY snp_assay_base_metals_update ON public.assay_base_metals
  FOR UPDATE TO authenticated
  USING (
    public.snp_sec_can_prepare_shipping(
      (SELECT c.shipping_preparation_id FROM public.assay_certificates c WHERE c.id = certificate_id)
    )
  )
  WITH CHECK (
    public.snp_sec_can_prepare_shipping(
      (SELECT c.shipping_preparation_id FROM public.assay_certificates c WHERE c.id = certificate_id)
    )
  );
-- La lecture (« Users can view base metals ») reste inchangee.

-- ============================== POSTFLIGHT ==============================
DO $postflight$
DECLARE
  v_ouvertes int;
BEGIN
  SELECT count(*) INTO v_ouvertes
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('certificate_approvals', 'assay_base_metals')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
    AND (coalesce(with_check, '') = 'true' OR coalesce(qual, '') = 'true');
  IF v_ouvertes > 0 THEN
    RAISE EXCEPTION 'Des politiques d''ecriture permissives subsistent sur les certificats (%).', v_ouvertes;
  END IF;
END;
$postflight$;

NOTIFY pgrst, 'reload schema';
