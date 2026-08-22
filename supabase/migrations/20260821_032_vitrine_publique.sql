-- Vitrine institutionnelle SONASP : publications administrables et assistance publique.
-- Les données privées du back-office ne sont jamais exposées par ces objets.

CREATE TABLE IF NOT EXISTS public.publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text NOT NULL CHECK (category IN (
    'communique', 'information-operationnelle', 'avis-mines', 'procedure',
    'reglementation', 'guide', 'calendrier', 'interruption'
  )),
  title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 180),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 20 AND 600),
  content text NOT NULL DEFAULT '',
  image_url text,
  document_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT publications_publication_date_required
    CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_publications_public_feed
  ON public.publications (published_at DESC)
  WHERE status = 'published';

DROP TRIGGER IF EXISTS trg_publications_touch ON public.publications;
CREATE TRIGGER trg_publications_touch
  BEFORE UPDATE ON public.publications
  FOR EACH ROW EXECUTE FUNCTION public.snp_touch_updated_at();

ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS publications_public_read ON public.publications;
CREATE POLICY publications_public_read
  ON public.publications FOR SELECT
  TO anon, authenticated
  USING (status = 'published' AND published_at <= now());

DROP POLICY IF EXISTS publications_staff_manage ON public.publications;
CREATE POLICY publications_staff_manage
  ON public.publications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role IN ('owner', 'admin', 'management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role IN ('owner', 'admin', 'management')
    )
  );

GRANT SELECT ON public.publications TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.publications TO authenticated;

CREATE TABLE IF NOT EXISTS public.public_support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_name text NOT NULL CHECK (char_length(requester_name) BETWEEN 2 AND 160),
  requester_email text NOT NULL CHECK (char_length(requester_email) BETWEEN 5 AND 254),
  company_name text CHECK (company_name IS NULL OR char_length(company_name) <= 180),
  category text NOT NULL CHECK (category IN ('access', 'operation', 'incident', 'document', 'other')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 5 AND 200),
  message text NOT NULL CHECK (char_length(message) BETWEEN 20 AND 5000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  email_hash text NOT NULL CHECK (char_length(email_hash) = 64),
  ip_hash text NOT NULL CHECK (char_length(ip_hash) = 64),
  user_agent text CHECK (user_agent IS NULL OR char_length(user_agent) <= 255),
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_support_requests_created
  ON public.public_support_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_support_requests_rate_ip
  ON public.public_support_requests (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_support_requests_rate_email
  ON public.public_support_requests (email_hash, created_at DESC);

DROP TRIGGER IF EXISTS trg_public_support_requests_touch ON public.public_support_requests;
CREATE TRIGGER trg_public_support_requests_touch
  BEFORE UPDATE ON public.public_support_requests
  FOR EACH ROW EXECUTE FUNCTION public.snp_touch_updated_at();

ALTER TABLE public.public_support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_support_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_support_requests_staff_read ON public.public_support_requests;
CREATE POLICY public_support_requests_staff_read
  ON public.public_support_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role IN ('owner', 'admin', 'management')
    )
  );

DROP POLICY IF EXISTS public_support_requests_staff_update ON public.public_support_requests;
CREATE POLICY public_support_requests_staff_update
  ON public.public_support_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role IN ('owner', 'admin', 'management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role IN ('owner', 'admin', 'management')
    )
  );

REVOKE ALL ON public.public_support_requests FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.public_support_requests TO authenticated;

COMMENT ON TABLE public.publications IS
  'Publications administrables de la vitrine institutionnelle SONASP.';
COMMENT ON TABLE public.public_support_requests IS
  'Demandes publiques insérées exclusivement par la fonction Edge protégée.';
