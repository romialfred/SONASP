-- ============================================================================
-- Cloisonnement des pièces de vente
-- ============================================================================
-- Une pièce n'est visible qu'à travers la vente à laquelle elle est rattachée.
-- Cette barrière restrictive neutralise les anciennes policies permissives et
-- empêche notamment d'obtenir « les derniers documents » d'un autre dossier.

ALTER TABLE public.sales_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_documents FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.snp_peut_consulter_document_vente(
  p_sale_id uuid,
  p_access_level text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1
    FROM public.sales s
    LEFT JOIN public.customers c ON c.id = s.customer_id
    LEFT JOIN public.user_profiles up ON up.id = auth.uid() AND up.is_active
    WHERE s.id = p_sale_id
      AND (
        public.snp_est_agent_sonasp()
        OR (
          s.seller_type = 'mining_company'
          AND s.seller_id = public.snp_societe_utilisateur()
        )
        OR (
          up.role = 'customer'
          AND lower(up.email) = lower(c.email)
          AND coalesce(p_access_level, 'internal') IN ('customer', 'external', 'public')
        )
      )
  );
$fn$;

REVOKE ALL ON FUNCTION public.snp_peut_consulter_document_vente(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_peut_consulter_document_vente(uuid, text) TO authenticated;

DROP POLICY IF EXISTS snp_documents_vente_lecture ON public.sales_documents;
CREATE POLICY snp_documents_vente_lecture
  ON public.sales_documents
  FOR SELECT TO authenticated
  USING (public.snp_peut_consulter_document_vente(sale_id, access_level));

DROP POLICY IF EXISTS snp_documents_vente_lecture_restrictive ON public.sales_documents;
CREATE POLICY snp_documents_vente_lecture_restrictive
  ON public.sales_documents
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (public.snp_peut_consulter_document_vente(sale_id, access_level));

CREATE OR REPLACE FUNCTION public.snp_peut_gerer_document_vente(p_sale_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1
    FROM public.sales s
    WHERE s.id = p_sale_id
      AND (
        public.snp_est_agent_sonasp()
        OR (
          s.seller_type = 'mining_company'
          AND s.seller_id = public.snp_societe_utilisateur()
        )
      )
  );
$fn$;

REVOKE ALL ON FUNCTION public.snp_peut_gerer_document_vente(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_peut_gerer_document_vente(uuid) TO authenticated;

DROP POLICY IF EXISTS snp_documents_vente_insertion ON public.sales_documents;
CREATE POLICY snp_documents_vente_insertion
  ON public.sales_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.snp_peut_gerer_document_vente(sale_id)
  );

DROP POLICY IF EXISTS snp_documents_vente_modification ON public.sales_documents;
CREATE POLICY snp_documents_vente_modification
  ON public.sales_documents
  FOR UPDATE TO authenticated
  USING (public.snp_peut_gerer_document_vente(sale_id))
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.snp_peut_gerer_document_vente(sale_id)
  );

DROP POLICY IF EXISTS snp_documents_vente_suppression ON public.sales_documents;
CREATE POLICY snp_documents_vente_suppression
  ON public.sales_documents
  FOR DELETE TO authenticated
  USING (
    public.snp_mfa_satisfaite()
    AND public.snp_role_utilisateur() IN ('owner', 'admin')
  );

COMMENT ON FUNCTION public.snp_peut_consulter_document_vente(uuid, text) IS
  'Autorise la lecture d une pièce uniquement dans le périmètre de sa vente et après MFA.';
