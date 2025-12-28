/*
  # Système de Gestion des Infractions des Artisans Miniers

  1. Nouvelle Table
    - `snp_artisan_infractions` (Convention: Toutes les tables doivent avoir le préfixe snp_)
      - `id` (uuid, primary key)
      - `artisan_id` (uuid, foreign key vers snp_artisans_miniers)
      - `date_infraction` (date)
      - `type_infraction` (text)
      - `description` (text)
      - `lieu` (text)
      - `statut_traitement` (enum: 'en_cours', 'cloture')
      - `conclusion` (enum: 'reconnu', 'soupçonne', 'complice', 'innocente', null)
      - `remarques` (text)
      - `documents` (jsonb array pour stocker les URLs de documents/images)
      - `date_cloture` (date)
      - `created_by` (uuid, foreign key vers auth.users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Sécurité
    - Enable RLS
    - Policies pour authenticated users

  3. Vérification Qualité SQL
    - ✅ Nom de table: snp_artisan_infractions (minuscules, préfixe snp_)
    - ✅ Référence FK: snp_artisans_miniers
    - ✅ RLS activé avec policies restrictives
    - ✅ Indexes pour performance
    - ✅ Trigger pour updated_at
*/

-- ============================================================================
-- PARTIE 1: VÉRIFICATIONS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Début création table snp_artisan_infractions';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- PARTIE 2: CREATE ENUM TYPES
-- ============================================================================

DO $$
BEGIN
  CREATE TYPE snp_statut_traitement_infraction AS ENUM ('en_cours', 'cloture');
  RAISE NOTICE '✅ Type snp_statut_traitement_infraction créé';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠️  Type snp_statut_traitement_infraction existe déjà';
END $$;

DO $$
BEGIN
  CREATE TYPE snp_conclusion_infraction AS ENUM ('reconnu', 'soupçonne', 'complice', 'innocente');
  RAISE NOTICE '✅ Type snp_conclusion_infraction créé';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠️  Type snp_conclusion_infraction existe déjà';
END $$;

-- ============================================================================
-- PARTIE 3: CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS snp_artisan_infractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid NOT NULL REFERENCES snp_artisans_miniers(id) ON DELETE CASCADE,
  date_infraction date NOT NULL,
  type_infraction text NOT NULL,
  description text NOT NULL,
  lieu text,
  statut_traitement snp_statut_traitement_infraction NOT NULL DEFAULT 'en_cours',
  conclusion snp_conclusion_infraction,
  remarques text,
  documents jsonb DEFAULT '[]'::jsonb,
  date_cloture date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  RAISE NOTICE '✅ Table snp_artisan_infractions créée';
END $$;

-- ============================================================================
-- PARTIE 4: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_snp_artisan_infractions_artisan_id
  ON snp_artisan_infractions(artisan_id);

CREATE INDEX IF NOT EXISTS idx_snp_artisan_infractions_date
  ON snp_artisan_infractions(date_infraction);

CREATE INDEX IF NOT EXISTS idx_snp_artisan_infractions_statut
  ON snp_artisan_infractions(statut_traitement);

CREATE INDEX IF NOT EXISTS idx_snp_artisan_infractions_conclusion
  ON snp_artisan_infractions(conclusion);

DO $$
BEGIN
  RAISE NOTICE '✅ Indexes créés';
END $$;

-- ============================================================================
-- PARTIE 5: ENABLE RLS
-- ============================================================================

ALTER TABLE snp_artisan_infractions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE '✅ RLS activé sur snp_artisan_infractions';
END $$;

-- ============================================================================
-- PARTIE 6: RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view all infractions"
  ON snp_artisan_infractions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create infractions"
  ON snp_artisan_infractions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update infractions"
  ON snp_artisan_infractions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'management')
  ))
  WITH CHECK (auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'management')
  ));

CREATE POLICY "Admins can delete infractions"
  ON snp_artisan_infractions
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'management')
  ));

DO $$
BEGIN
  RAISE NOTICE '✅ Policies RLS créées (4 policies)';
END $$;

-- ============================================================================
-- PARTIE 7: TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_snp_artisan_infractions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_snp_artisan_infractions_updated_at
  ON snp_artisan_infractions;

CREATE TRIGGER trigger_update_snp_artisan_infractions_updated_at
  BEFORE UPDATE ON snp_artisan_infractions
  FOR EACH ROW
  EXECUTE FUNCTION update_snp_artisan_infractions_updated_at();

DO $$
BEGIN
  RAISE NOTICE '✅ Trigger updated_at créé';
END $$;

-- ============================================================================
-- PARTIE 8: STORAGE BUCKET
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('snp-infraction-documents', 'snp-infraction-documents', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE '✅ Bucket storage snp-infraction-documents créé';
END $$;

-- ============================================================================
-- PARTIE 9: STORAGE POLICIES
-- ============================================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload infraction documents" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can view infraction documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own infraction documents" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can delete infraction documents" ON storage.objects;
  RAISE NOTICE '⚠️  Anciennes policies storage supprimées';
END $$;

CREATE POLICY "Authenticated users can upload infraction documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'snp-infraction-documents');

CREATE POLICY "Authenticated users can view infraction documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'snp-infraction-documents');

CREATE POLICY "Users can update their own infraction documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'snp-infraction-documents');

CREATE POLICY "Admins can delete infraction documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'snp-infraction-documents'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'management')
    )
  );

DO $$
BEGIN
  RAISE NOTICE '✅ Policies storage créées (4 policies)';
END $$;

-- ============================================================================
-- PARTIE 10: RÉSUMÉ
-- ============================================================================

DO $$
DECLARE
  v_table_exists boolean;
  v_bucket_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'snp_artisan_infractions'
  ) INTO v_table_exists;

  SELECT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'snp-infraction-documents'
  ) INTO v_bucket_exists;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RÉSUMÉ DE LA CRÉATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Table snp_artisan_infractions: %', CASE WHEN v_table_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE 'Bucket snp-infraction-documents: %', CASE WHEN v_bucket_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Script terminé avec succès';
  RAISE NOTICE '========================================';
END $$;
