/*
  Module de gestion des sites artisanaux SONASP.

  Tables normalisées :
  - artisanal_sites : identité, localisation et capacité réglementaire ;
  - artisanal_site_assignments : responsables affectés au site ;
  - artisanal_site_productions : faits de production et données financières.
*/

CREATE TABLE IF NOT EXISTS public.artisanal_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('active', 'suspended', 'planned')),
  region text NOT NULL,
  province text NOT NULL,
  locality text NOT NULL,
  area_hectares numeric(12, 2) NOT NULL CHECK (area_hectares > 0),
  exploitation_type text NOT NULL
    CHECK (exploitation_type IN ('artisanale', 'semi_mecanisee', 'mixte')),
  authorized_miners integer NOT NULL DEFAULT 0 CHECK (authorized_miners >= 0),
  active_miners integer NOT NULL DEFAULT 0 CHECK (active_miners >= 0),
  average_hole_depth_m numeric(8, 2) NOT NULL DEFAULT 0 CHECK (average_hole_depth_m >= 0),
  authorized_chemicals text[] NOT NULL DEFAULT '{}',
  latitude numeric(9, 6) NOT NULL CHECK (latitude BETWEEN 9 AND 16),
  longitude numeric(9, 6) NOT NULL CHECK (longitude BETWEEN -6 AND 3),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artisanal_sites_active_capacity_check CHECK (active_miners <= authorized_miners)
);

CREATE TABLE IF NOT EXISTS public.artisanal_site_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.artisanal_sites(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('site_manager', 'collection_officer')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, role)
);

CREATE TABLE IF NOT EXISTS public.artisanal_site_productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.artisanal_sites(id) ON DELETE RESTRICT,
  production_date date NOT NULL,
  gold_weight_grams numeric(16, 3) NOT NULL CHECK (gold_weight_grams > 0),
  revenue_fcfa numeric(18, 2) NOT NULL DEFAULT 0 CHECK (revenue_fcfa >= 0),
  taxes_fcfa numeric(18, 2) NOT NULL DEFAULT 0 CHECK (taxes_fcfa >= 0),
  artisan_count integer NOT NULL DEFAULT 0 CHECK (artisan_count >= 0),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artisanal_sites_status ON public.artisanal_sites(status);
CREATE INDEX IF NOT EXISTS idx_artisanal_sites_location ON public.artisanal_sites(region, province, locality);
CREATE INDEX IF NOT EXISTS idx_artisanal_site_assignments_user ON public.artisanal_site_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_artisanal_site_productions_site_date
  ON public.artisanal_site_productions(site_id, production_date DESC);

CREATE OR REPLACE FUNCTION public.set_artisanal_site_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_artisanal_sites_updated_at ON public.artisanal_sites;
CREATE TRIGGER trg_artisanal_sites_updated_at
  BEFORE UPDATE ON public.artisanal_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_artisanal_site_updated_at();

DROP TRIGGER IF EXISTS trg_artisanal_site_assignments_updated_at ON public.artisanal_site_assignments;
CREATE TRIGGER trg_artisanal_site_assignments_updated_at
  BEFORE UPDATE ON public.artisanal_site_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_artisanal_site_updated_at();

-- Rattachement optionnel des artisans déjà enregistrés à un site artisanal.
ALTER TABLE public.snp_artisans_miniers
  ADD COLUMN IF NOT EXISTS artisanal_site_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'snp_artisans_miniers_artisanal_site_id_fkey'
  ) THEN
    ALTER TABLE public.snp_artisans_miniers
      ADD CONSTRAINT snp_artisans_miniers_artisanal_site_id_fkey
      FOREIGN KEY (artisanal_site_id)
      REFERENCES public.artisanal_sites(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_snp_artisans_miniers_artisanal_site
  ON public.snp_artisans_miniers(artisanal_site_id);

ALTER TABLE public.artisanal_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artisanal_site_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artisanal_site_productions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view artisanal sites" ON public.artisanal_sites;
CREATE POLICY "Authenticated users view artisanal sites"
  ON public.artisanal_sites FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Management manages artisanal sites" ON public.artisanal_sites;
CREATE POLICY "Management manages artisanal sites"
  ON public.artisanal_sites FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin') AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin') AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Authenticated users view site assignments" ON public.artisanal_site_assignments;
CREATE POLICY "Authenticated users view site assignments"
  ON public.artisanal_site_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Management manages site assignments" ON public.artisanal_site_assignments;
CREATE POLICY "Management manages site assignments"
  ON public.artisanal_site_assignments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin') AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin') AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Authenticated users view site productions" ON public.artisanal_site_productions;
CREATE POLICY "Authenticated users view site productions"
  ON public.artisanal_site_productions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Management manages site productions" ON public.artisanal_site_productions;
CREATE POLICY "Management manages site productions"
  ON public.artisanal_site_productions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin') AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('management', 'admin') AND is_active = true
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artisanal_sites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artisanal_site_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artisanal_site_productions TO authenticated;

-- Jeu de référence idempotent pour rendre la vue cartographique immédiatement exploitable.
INSERT INTO public.artisanal_sites (
  id, code, name, status, region, province, locality, area_hectares,
  exploitation_type, authorized_miners, active_miners, average_hole_depth_m,
  authorized_chemicals, latitude, longitude, notes
) VALUES
  ('a1100000-0000-4000-8000-000000000001', 'SA-2026-001', 'Site artisanal de Kalsaka', 'active', 'Nord', 'Yatenga', 'Kalsaka', 42.50, 'artisanale', 180, 146, 23, ARRAY['Borax','Charbon actif'], 13.178000, -1.992000, 'Site pilote pour le suivi numérique des productions.'),
  ('a1100000-0000-4000-8000-000000000002', 'SA-2026-002', 'Site artisanal de Poura', 'active', 'Boucle du Mouhoun', 'Balé', 'Poura', 61.00, 'semi_mecanisee', 240, 211, 31, ARRAY['Borax'], 11.586000, -2.753000, NULL),
  ('a1100000-0000-4000-8000-000000000003', 'SA-2026-003', 'Site artisanal de Gaoua', 'active', 'Sud-Ouest', 'Poni', 'Gaoua', 37.80, 'mixte', 160, 128, 18, ARRAY['Borax','Charbon actif'], 10.325000, -3.174000, NULL),
  ('a1100000-0000-4000-8000-000000000004', 'SA-2026-004', 'Site artisanal de Kongoussi', 'active', 'Centre-Nord', 'Bam', 'Kongoussi', 54.20, 'artisanale', 205, 174, 27, ARRAY['Borax'], 13.325000, -1.535000, NULL),
  ('a1100000-0000-4000-8000-000000000005', 'SA-2026-005', 'Site artisanal de Houndé', 'planned', 'Hauts-Bassins', 'Tuy', 'Houndé', 48.00, 'semi_mecanisee', 190, 0, 25, ARRAY['Borax','Charbon actif'], 11.500000, -3.516000, NULL),
  ('a1100000-0000-4000-8000-000000000006', 'SA-2026-006', 'Site artisanal de Gorom-Gorom', 'suspended', 'Sahel', 'Oudalan', 'Gorom-Gorom', 32.40, 'artisanale', 120, 0, 20, ARRAY['Borax'], 14.443000, -0.235000, NULL)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.artisanal_site_assignments (site_id, role, full_name, phone, email)
VALUES
  ('a1100000-0000-4000-8000-000000000001', 'site_manager', 'Issa Ouédraogo', '+226 70 12 34 56', 'issa.ouedraogo@sonasp.bf'),
  ('a1100000-0000-4000-8000-000000000001', 'collection_officer', 'Awa Kaboré', '+226 76 22 18 04', 'awa.kabore@sonasp.bf'),
  ('a1100000-0000-4000-8000-000000000002', 'site_manager', 'Moussa Traoré', '+226 71 03 19 47', 'moussa.traore@sonasp.bf'),
  ('a1100000-0000-4000-8000-000000000002', 'collection_officer', 'Aminata Sanou', '+226 75 14 09 38', NULL),
  ('a1100000-0000-4000-8000-000000000003', 'site_manager', 'Jean Kambou', '+226 70 38 15 42', NULL),
  ('a1100000-0000-4000-8000-000000000003', 'collection_officer', 'Fatou Somé', '+226 74 11 60 28', 'fatou.some@sonasp.bf'),
  ('a1100000-0000-4000-8000-000000000004', 'site_manager', 'Adama Sawadogo', '+226 78 21 07 55', NULL),
  ('a1100000-0000-4000-8000-000000000004', 'collection_officer', 'Salif Ilboudo', '+226 72 44 10 63', NULL),
  ('a1100000-0000-4000-8000-000000000005', 'site_manager', 'Clarisse Zongo', '+226 77 04 31 82', NULL),
  ('a1100000-0000-4000-8000-000000000005', 'collection_officer', 'Poste à pourvoir', '-', NULL),
  ('a1100000-0000-4000-8000-000000000006', 'site_manager', 'Oumar Dicko', '+226 70 09 28 64', NULL),
  ('a1100000-0000-4000-8000-000000000006', 'collection_officer', 'Mariam Diallo', '+226 75 33 06 77', NULL)
ON CONFLICT (site_id, role) DO NOTHING;

INSERT INTO public.artisanal_site_productions (
  id, site_id, production_date, gold_weight_grams, revenue_fcfa, taxes_fcfa, artisan_count
) VALUES
  ('b2200000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-000000000001', '2026-08-01', 18420, 824500000, 24735000, 146),
  ('b2200000-0000-4000-8000-000000000002', 'a1100000-0000-4000-8000-000000000002', '2026-08-02', 26750, 1198000000, 35940000, 211),
  ('b2200000-0000-4000-8000-000000000003', 'a1100000-0000-4000-8000-000000000003', '2026-08-05', 13980, 625300000, 18759000, 128),
  ('b2200000-0000-4000-8000-000000000004', 'a1100000-0000-4000-8000-000000000004', '2026-08-07', 21100, 944700000, 28341000, 174),
  ('b2200000-0000-4000-8000-000000000005', 'a1100000-0000-4000-8000-000000000001', '2026-07-11', 16900, 756900000, 22707000, 139),
  ('b2200000-0000-4000-8000-000000000006', 'a1100000-0000-4000-8000-000000000002', '2026-07-14', 23850, 1068000000, 32040000, 203)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.artisanal_sites IS 'Référentiel national des sites d''exploitation artisanale.';
COMMENT ON TABLE public.artisanal_site_assignments IS 'Responsable et chargé de collecte affectés à chaque site.';
COMMENT ON TABLE public.artisanal_site_productions IS 'Productions, chiffres d''affaires et taxes déclarés par site.';
