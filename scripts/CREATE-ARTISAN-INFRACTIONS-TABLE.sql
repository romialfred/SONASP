/*
  # Système de Gestion des Infractions des Artisans Miniers

  1. Nouvelle Table
    - `artisan_infractions`
      - `id` (uuid, primary key)
      - `artisan_id` (uuid, foreign key vers artisans_miniers)
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
*/

-- Create enum types
DO $$ BEGIN
  CREATE TYPE statut_traitement_infraction AS ENUM ('en_cours', 'cloture');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE conclusion_infraction AS ENUM ('reconnu', 'soupçonne', 'complice', 'innocente');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create artisan_infractions table
CREATE TABLE IF NOT EXISTS artisan_infractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid NOT NULL REFERENCES artisans_miniers(id) ON DELETE CASCADE,
  date_infraction date NOT NULL,
  type_infraction text NOT NULL,
  description text NOT NULL,
  lieu text,
  statut_traitement statut_traitement_infraction NOT NULL DEFAULT 'en_cours',
  conclusion conclusion_infraction,
  remarques text,
  documents jsonb DEFAULT '[]'::jsonb,
  date_cloture date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_artisan_infractions_artisan_id ON artisan_infractions(artisan_id);
CREATE INDEX IF NOT EXISTS idx_artisan_infractions_date ON artisan_infractions(date_infraction);
CREATE INDEX IF NOT EXISTS idx_artisan_infractions_statut ON artisan_infractions(statut_traitement);
CREATE INDEX IF NOT EXISTS idx_artisan_infractions_conclusion ON artisan_infractions(conclusion);

-- Enable RLS
ALTER TABLE artisan_infractions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all infractions"
  ON artisan_infractions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create infractions"
  ON artisan_infractions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update infractions"
  ON artisan_infractions
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
  ON artisan_infractions
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'management')
  ));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_artisan_infractions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_artisan_infractions_updated_at ON artisan_infractions;
CREATE TRIGGER trigger_update_artisan_infractions_updated_at
  BEFORE UPDATE ON artisan_infractions
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_infractions_updated_at();

-- Create storage bucket for infraction documents (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('infraction-documents', 'infraction-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for infraction documents
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Authenticated users can upload infraction documents" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can view infraction documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own infraction documents" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can delete infraction documents" ON storage.objects;
END $$;

CREATE POLICY "Authenticated users can upload infraction documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'infraction-documents');

CREATE POLICY "Authenticated users can view infraction documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'infraction-documents');

CREATE POLICY "Users can update their own infraction documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'infraction-documents');

CREATE POLICY "Admins can delete infraction documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'infraction-documents'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'management')
    )
  );
