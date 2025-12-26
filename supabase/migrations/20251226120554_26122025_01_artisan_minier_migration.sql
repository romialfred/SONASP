/*
  # Module Artisan Minier - Système Complet SONASP

  ## Tables Créées
  1. SNP_artisans_miniers - Informations des artisans (physique/morale)
  2. SNP_cartes_professionnelles - Cartes professionnelles avec statuts
  3. SNP_artisan_documents - Documents joints (photo, CNI, etc.)
  4. SNP_artisan_activities - Activités et transactions
  5. SNP_carte_statistics - Statistiques par carte

  ## Automatisations
  - Auto-génération numéro carte: SONASP/AM/2025/000001
  - Création automatique carte professionnelle après enregistrement artisan
  - Mise à jour automatique des statistiques

  ## Sécurité
  - RLS activé sur toutes les tables
  - Policies pour authenticated users
*/

-- ============================================================================
-- 1. TABLE: SNP_artisans_miniers
-- ============================================================================
CREATE TABLE IF NOT EXISTS SNP_artisans_miniers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Type et catégorie
  type_personne text NOT NULL CHECK (type_personne IN ('physique', 'morale')),
  type_artisan text NOT NULL CHECK (type_artisan IN ('exploitant', 'collecteur', 'intermediaire', 'fournisseur')),
  
  -- Identité (personne physique)
  nom text,
  prenoms text,
  date_naissance date,
  lieu_naissance text,
  sexe text CHECK (sexe IN ('M', 'F')),
  nationalite text DEFAULT 'Burkinabé',
  
  -- Identité (personne morale)
  raison_sociale text,
  
  -- Localisation
  pays text DEFAULT 'Burkina Faso' CHECK (pays IN ('Burkina Faso', 'Mali', 'Niger')),
  
  -- Contact
  telephone text NOT NULL,
  email text,
  adresse text,
  commune text,
  region text,
  
  -- Pièce d'identité
  type_piece_identite text CHECK (type_piece_identite IN ('CNI', 'Passeport', 'Permis', 'Autre')),
  numero_piece_identite text,
  date_delivrance_piece date,
  date_expiration_piece date,
  lieu_delivrance_piece text,
  
  -- Fichiers
  photo_url text,
  piece_identite_url text,
  
  -- Collecteur associé (si artisan est rattaché à un collecteur)
  collecteur_id uuid,
  
  -- Numéro de carte (auto-généré par trigger)
  numero_carte text UNIQUE,
  
  -- Observations
  observations text,
  
  -- Métadonnées
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  -- Contraintes
  CONSTRAINT personne_physique_nom_requis CHECK (
    type_personne = 'morale' OR (nom IS NOT NULL)
  ),
  CONSTRAINT personne_morale_raison_sociale_requis CHECK (
    type_personne = 'physique' OR (raison_sociale IS NOT NULL)
  )
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_artisans_type_artisan ON SNP_artisans_miniers(type_artisan);
CREATE INDEX IF NOT EXISTS idx_artisans_numero_carte ON SNP_artisans_miniers(numero_carte);
CREATE INDEX IF NOT EXISTS idx_artisans_telephone ON SNP_artisans_miniers(telephone);
CREATE INDEX IF NOT EXISTS idx_artisans_collecteur ON SNP_artisans_miniers(collecteur_id);
CREATE INDEX IF NOT EXISTS idx_artisans_created_at ON SNP_artisans_miniers(created_at);
CREATE INDEX IF NOT EXISTS idx_artisans_pays ON SNP_artisans_miniers(pays);

-- ============================================================================
-- 2. TABLE: SNP_cartes_professionnelles
-- ============================================================================
CREATE TABLE IF NOT EXISTS SNP_cartes_professionnelles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Référence artisan
  artisan_id uuid NOT NULL REFERENCES SNP_artisans_miniers(id) ON DELETE CASCADE,
  
  -- Numéro de carte (copié de artisan)
  numero_carte text NOT NULL UNIQUE,
  
  -- Dates
  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  date_expiration date NOT NULL DEFAULT (CURRENT_DATE + interval '2 years'),
  date_validation date,
  date_suspension date,
  
  -- Statut
  statut text NOT NULL DEFAULT 'en_cours' CHECK (
    statut IN ('en_cours', 'validee', 'en_exploitation', 'expiree', 'suspendue', 'annulee')
  ),
  
  -- QR Code et sécurité
  qr_code_data text,
  numero_securite text DEFAULT substring(md5(random()::text) from 1 for 10),
  
  -- Validation
  validee_par uuid REFERENCES auth.users(id),
  motif_suspension text,
  
  -- Observations
  observations text,
  
  -- Métadonnées
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_cartes_artisan ON SNP_cartes_professionnelles(artisan_id);
CREATE INDEX IF NOT EXISTS idx_cartes_statut ON SNP_cartes_professionnelles(statut);
CREATE INDEX IF NOT EXISTS idx_cartes_expiration ON SNP_cartes_professionnelles(date_expiration);
CREATE INDEX IF NOT EXISTS idx_cartes_numero ON SNP_cartes_professionnelles(numero_carte);

-- ============================================================================
-- 3. TABLE: SNP_artisan_documents
-- ============================================================================
CREATE TABLE IF NOT EXISTS SNP_artisan_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Référence artisan
  artisan_id uuid NOT NULL REFERENCES SNP_artisans_miniers(id) ON DELETE CASCADE,
  
  -- Document
  type_document text NOT NULL CHECK (
    type_document IN ('photo', 'cni', 'passeport', 'permis', 'certificat', 'autre')
  ),
  nom_fichier text NOT NULL,
  chemin_fichier text NOT NULL,
  taille_fichier bigint,
  type_mime text,
  
  -- Métadonnées
  description text,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_documents_artisan ON SNP_artisan_documents(artisan_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON SNP_artisan_documents(type_document);

-- ============================================================================
-- 4. TABLE: SNP_artisan_activities
-- ============================================================================
CREATE TABLE IF NOT EXISTS SNP_artisan_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Références
  artisan_id uuid NOT NULL REFERENCES SNP_artisans_miniers(id) ON DELETE CASCADE,
  carte_id uuid REFERENCES SNP_cartes_professionnelles(id) ON DELETE SET NULL,
  
  -- Type d'activité
  type_activite text NOT NULL CHECK (
    type_activite IN ('vente', 'achat', 'production', 'transport', 'autre')
  ),
  
  -- Détails
  description text,
  quantite_grammes decimal(10,3),
  montant decimal(15,2),
  devise text DEFAULT 'XOF',
  
  -- Date
  date_activite date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Métadonnées
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_activities_artisan ON SNP_artisan_activities(artisan_id);
CREATE INDEX IF NOT EXISTS idx_activities_carte ON SNP_artisan_activities(carte_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON SNP_artisan_activities(date_activite);
CREATE INDEX IF NOT EXISTS idx_activities_type ON SNP_artisan_activities(type_activite);

-- ============================================================================
-- 5. TABLE: SNP_carte_statistics
-- ============================================================================
CREATE TABLE IF NOT EXISTS SNP_carte_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Référence carte (unique)
  carte_id uuid NOT NULL UNIQUE REFERENCES SNP_cartes_professionnelles(id) ON DELETE CASCADE,
  
  -- Statistiques
  nombre_ventes int DEFAULT 0,
  nombre_achats int DEFAULT 0,
  quantite_totale_grammes decimal(15,3) DEFAULT 0,
  montant_total decimal(15,2) DEFAULT 0,
  
  -- Dates
  derniere_activite date,
  
  -- Métadonnées
  updated_at timestamptz DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_statistics_carte ON SNP_carte_statistics(carte_id);

-- ============================================================================
-- TRIGGERS: Auto-génération numéro de carte
-- ============================================================================

-- Fonction pour générer le numéro: SONASP/AM/YYYY/NNNNNN
CREATE OR REPLACE FUNCTION generate_numero_carte()
RETURNS TRIGGER AS $$
DECLARE
  annee text;
  prochain_numero int;
  numero_format text;
BEGIN
  -- Obtenir l'année en cours
  annee := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  
  -- Compter le nombre d'artisans créés cette année + 1
  SELECT COUNT(*) + 1 INTO prochain_numero
  FROM SNP_artisans_miniers
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Formater: SONASP/AM/2025/000001
  numero_format := 'SONASP/AM/' || annee || '/' || LPAD(prochain_numero::text, 6, '0');
  
  -- Assigner au nouveau record
  NEW.numero_carte := numero_format;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger avant insertion (si numero_carte est null)
DROP TRIGGER IF EXISTS trigger_generate_numero_carte ON SNP_artisans_miniers;
CREATE TRIGGER trigger_generate_numero_carte
  BEFORE INSERT ON SNP_artisans_miniers
  FOR EACH ROW
  WHEN (NEW.numero_carte IS NULL)
  EXECUTE FUNCTION generate_numero_carte();

-- ============================================================================
-- TRIGGERS: Création automatique carte professionnelle
-- ============================================================================

CREATE OR REPLACE FUNCTION create_carte_professionnelle()
RETURNS TRIGGER AS $$
BEGIN
  -- Créer automatiquement la carte après insertion artisan
  INSERT INTO SNP_cartes_professionnelles (
    artisan_id,
    numero_carte,
    date_emission,
    date_expiration,
    statut
  ) VALUES (
    NEW.id,
    NEW.numero_carte,
    CURRENT_DATE,
    CURRENT_DATE + interval '2 years',
    'en_cours'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger après insertion artisan
DROP TRIGGER IF EXISTS trigger_create_carte ON SNP_artisans_miniers;
CREATE TRIGGER trigger_create_carte
  AFTER INSERT ON SNP_artisans_miniers
  FOR EACH ROW
  EXECUTE FUNCTION create_carte_professionnelle();

-- ============================================================================
-- TRIGGERS: Mise à jour timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer aux tables concernées
DROP TRIGGER IF EXISTS update_artisans_updated_at ON SNP_artisans_miniers;
CREATE TRIGGER update_artisans_updated_at
  BEFORE UPDATE ON SNP_artisans_miniers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_cartes_updated_at ON SNP_cartes_professionnelles;
CREATE TRIGGER update_cartes_updated_at
  BEFORE UPDATE ON SNP_cartes_professionnelles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE SNP_artisans_miniers ENABLE ROW LEVEL SECURITY;
ALTER TABLE SNP_cartes_professionnelles ENABLE ROW LEVEL SECURITY;
ALTER TABLE SNP_artisan_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE SNP_artisan_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE SNP_carte_statistics ENABLE ROW LEVEL SECURITY;

-- Policies pour SNP_artisans_miniers
CREATE POLICY "Authenticated users can view artisans"
  ON SNP_artisans_miniers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert artisans"
  ON SNP_artisans_miniers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update artisans"
  ON SNP_artisans_miniers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete artisans"
  ON SNP_artisans_miniers FOR DELETE
  TO authenticated
  USING (true);

-- Policies pour SNP_cartes_professionnelles
CREATE POLICY "Authenticated users can view cartes"
  ON SNP_cartes_professionnelles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cartes"
  ON SNP_cartes_professionnelles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cartes"
  ON SNP_cartes_professionnelles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies pour SNP_artisan_documents
CREATE POLICY "Authenticated users can view documents"
  ON SNP_artisan_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert documents"
  ON SNP_artisan_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete documents"
  ON SNP_artisan_documents FOR DELETE
  TO authenticated
  USING (true);

-- Policies pour SNP_artisan_activities
CREATE POLICY "Authenticated users can view activities"
  ON SNP_artisan_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert activities"
  ON SNP_artisan_activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update activities"
  ON SNP_artisan_activities FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies pour SNP_carte_statistics
CREATE POLICY "Authenticated users can view statistics"
  ON SNP_carte_statistics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert statistics"
  ON SNP_carte_statistics FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update statistics"
  ON SNP_carte_statistics FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
