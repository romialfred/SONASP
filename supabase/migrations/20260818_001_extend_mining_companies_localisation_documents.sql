-- ============================================================================
-- SONASP — Enrichissement de l'entité "Société Minière"
-- Localisation administrative (Région / Province / Localité) + Documents joints.
-- Additif et non destructif. (nom usuel = abbreviation, RCCM = registration_number,
-- IFU = tax_id : déjà présents.)
-- ============================================================================

ALTER TABLE public.mining_companies
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS localite text;

-- Documents attachés à une société minière (RCCM, IFU, autorisation, statuts…)
CREATE TABLE IF NOT EXISTS public.mining_company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mining_company_id uuid NOT NULL REFERENCES public.mining_companies(id) ON DELETE CASCADE,
  doc_type text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mining_company_documents_company
  ON public.mining_company_documents(mining_company_id);

ALTER TABLE public.mining_company_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mcd_select ON public.mining_company_documents;
CREATE POLICY mcd_select ON public.mining_company_documents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS mcd_insert ON public.mining_company_documents;
CREATE POLICY mcd_insert ON public.mining_company_documents
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS mcd_delete ON public.mining_company_documents;
CREATE POLICY mcd_delete ON public.mining_company_documents
  FOR DELETE TO authenticated USING (true);

-- Bucket de stockage privé pour les documents des sociétés minières
INSERT INTO storage.buckets (id, name, public)
VALUES ('mining-company-documents', 'mining-company-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "mining_company_docs_read" ON storage.objects;
CREATE POLICY "mining_company_docs_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'mining-company-documents');

DROP POLICY IF EXISTS "mining_company_docs_write" ON storage.objects;
CREATE POLICY "mining_company_docs_write" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mining-company-documents');

DROP POLICY IF EXISTS "mining_company_docs_delete" ON storage.objects;
CREATE POLICY "mining_company_docs_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'mining-company-documents');
