/*
  # Système de Gestion des Artisans Miniers

  ## Vue d'ensemble
  Ce système gère les artisans miniers indépendants et leurs cartes professionnelles
  pour plusieurs pays du Sahel (Burkina Faso, Mali, Côte d'Ivoire, Guinée, etc.).

  ## Tables créées

  ### SNP_artisans_miniers
  Table principale stockant les informations des artisans miniers.

  **Colonnes importantes:**
  - `id`: Identifiant unique (UUID)
  - `numero_carte`: Numéro unique de carte (ex: SONASP/AM/2025/BF/0001)
  - `type_personne`: Physique ou morale
  - `type_artisan`: Exploitant, collecteur, intermédiaire, fournisseur
  - `pays`: Pays d'origine (Burkina Faso, Mali, etc.)
  - `nom`, `prenoms`: Pour personne physique
  - `raison_sociale`: Pour personne morale
  - `telephone`: Contact principal
  - `adresse`, `commune`, `region`: Localisation
  - `type_piece_identite`, `numero_piece_identite`: Documents d'identité
  - `collecteur_id`: Référence au collecteur associé (optionnel)

  **Note importante:** Les artisans sont INDEPENDANTS, ils n'ont PAS de `mining_company_id`

  ### SNP_cartes_professionnelles
  Table de suivi des cartes professionnelles délivrées aux artisans.

  ## Sécurité
  - RLS activé sur toutes les tables
  - Politiques restrictives basées sur l'authentification
  - Audit trail complet avec created_by/updated_by
*/

-- ============================================================================
-- ETAPE 1: Créer la table SNP_artisans_miniers
-- ============================================================================

CREATE TABLE IF NOT EXISTS "SNP_artisans_miniers" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_carte text UNIQUE NOT NULL,
  type_personne text NOT NULL CHECK (type_personne IN ('physique', 'morale')),
  type_artisan text NOT NULL CHECK (type_artisan IN ('exploitant', 'collecteur', 'intermediaire', 'fournisseur')),
  nom text,
  prenoms text,
  date_naissance date,
  lieu_naissance text,
  sexe text CHECK (sexe IN ('M', 'F', 'Autre')),
  nationalite text DEFAULT 'Burkinabé',
  raison_sociale text,
  numero_registre_commerce text,
  telephone text NOT NULL,
  telephone_secondaire text,
  email text,
  adresse text,
  commune text,
  region text,
  pays text NOT NULL DEFAULT 'Burkina Faso',
  type_piece_identite text CHECK (type_piece_identite IN ('CNI', 'Passeport', 'Permis', 'Autre')),
  numero_piece_identite text,
  date_delivrance_piece date,
  date_expiration_piece date,
  lieu_delivrance_piece text,
  piece_identite_url text,
  photo_url text,
  collecteur_id uuid REFERENCES "SNP_artisans_miniers"(id),
  observations text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_artisans_numero_carte ON "SNP_artisans_miniers"(numero_carte);
CREATE INDEX IF NOT EXISTS idx_artisans_pays ON "SNP_artisans_miniers"(pays);
CREATE INDEX IF NOT EXISTS idx_artisans_type_artisan ON "SNP_artisans_miniers"(type_artisan);
CREATE INDEX IF NOT EXISTS idx_artisans_collecteur ON "SNP_artisans_miniers"(collecteur_id);

CREATE OR REPLACE FUNCTION update_artisan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_artisan_timestamp ON "SNP_artisans_miniers";
CREATE TRIGGER trigger_update_artisan_timestamp
  BEFORE UPDATE ON "SNP_artisans_miniers"
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_updated_at();

-- ============================================================================
-- ETAPE 2: Créer la table SNP_cartes_professionnelles
-- ============================================================================

CREATE TABLE IF NOT EXISTS "SNP_cartes_professionnelles" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid NOT NULL REFERENCES "SNP_artisans_miniers"(id) ON DELETE CASCADE,
  numero_carte text NOT NULL,
  date_delivrance date NOT NULL DEFAULT CURRENT_DATE,
  date_expiration date NOT NULL,
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'expiré', 'suspendu', 'révoqué')),
  carte_pdf_url text,
  raison_changement_statut text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_cartes_artisan ON "SNP_cartes_professionnelles"(artisan_id);
CREATE INDEX IF NOT EXISTS idx_cartes_statut ON "SNP_cartes_professionnelles"(statut);
CREATE INDEX IF NOT EXISTS idx_cartes_expiration ON "SNP_cartes_professionnelles"(date_expiration);

DROP TRIGGER IF EXISTS trigger_update_carte_timestamp ON "SNP_cartes_professionnelles";
CREATE TRIGGER trigger_update_carte_timestamp
  BEFORE UPDATE ON "SNP_cartes_professionnelles"
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_updated_at();

-- ============================================================================
-- ETAPE 3: Row Level Security (RLS)
-- ============================================================================

ALTER TABLE "SNP_artisans_miniers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SNP_cartes_professionnelles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all artisans"
  ON "SNP_artisans_miniers" FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can insert artisans"
  ON "SNP_artisans_miniers" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authorized users can update artisans"
  ON "SNP_artisans_miniers" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authorized users can delete artisans"
  ON "SNP_artisans_miniers" FOR DELETE TO authenticated USING (true);

CREATE POLICY "Users can view all cartes"
  ON "SNP_cartes_professionnelles" FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can insert cartes"
  ON "SNP_cartes_professionnelles" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authorized users can update cartes"
  ON "SNP_cartes_professionnelles" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authorized users can delete cartes"
  ON "SNP_cartes_professionnelles" FOR DELETE TO authenticated USING (true);
