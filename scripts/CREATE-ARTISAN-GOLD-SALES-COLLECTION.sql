-- ============================================================================
-- SCRIPT SQL: Création du Système de Collecte et Vente d'Or des Artisans
-- Table: snp_artisan_ventes_or
-- Date: 2025-01-27
-- ============================================================================
--
-- Ce script crée le système complet de collecte et vente d'or pour les
-- artisans miniers avec calcul automatique des taxes
--
-- IMPORTANT: Ce script doit être exécuté dans Supabase SQL Editor
--
-- ============================================================================

/*
  # Système de Collecte et Vente d'Or

  1. Table créée
    - `snp_artisan_ventes_or` : Enregistrement des ventes d'or des artisans

  2. Colonnes
    - `id` (uuid, primary key)
    - `artisan_id` (uuid) : Référence à l'artisan minier
    - `date_vente` (date) : Date de la vente
    - `quantite_grammes` (numeric) : Quantité en grammes
    - `type_or` (text) : Type (Poudre, Lingot, Pépites, Bijoux)
    - `purete_karat` (numeric) : Pureté en karats (18K, 22K, 24K, etc.)
    - `prix_kg_fcfa` (numeric) : Prix de vente au kilogramme
    - `montant_brut_fcfa` (numeric) : Montant avant taxes
    - `tva_taux` (numeric) : Taux TVA (18%)
    - `tva_montant_fcfa` (numeric) : Montant TVA
    - `taxe_dev_comm_taux` (numeric) : Taxe de développement communautaire (1%)
    - `taxe_dev_comm_montant_fcfa` (numeric) : Montant taxe dev. comm.
    - `montant_total_fcfa` (numeric) : Montant total avec taxes
    - `numero_recu` (text) : Numéro du reçu de vente
    - `observations` (text) : Observations
    - `statut` (text) : Statut de la vente
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
    - `created_by` (uuid)
    - `updated_by` (uuid)

  3. Sécurité
    - Active RLS
    - Politiques pour lecture et écriture
*/

-- Créer la table des ventes d'or
CREATE TABLE IF NOT EXISTS snp_artisan_ventes_or (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid NOT NULL REFERENCES snp_artisans_miniers(id) ON DELETE CASCADE,
  date_vente date NOT NULL DEFAULT CURRENT_DATE,
  quantite_grammes numeric(12, 3) NOT NULL CHECK (quantite_grammes > 0),
  type_or text NOT NULL CHECK (type_or IN ('poudre', 'lingot', 'pepites', 'bijoux', 'autre')),
  purete_karat numeric(4, 2) NOT NULL CHECK (purete_karat > 0 AND purete_karat <= 24),
  prix_kg_fcfa numeric(15, 2) NOT NULL CHECK (prix_kg_fcfa > 0),
  montant_brut_fcfa numeric(15, 2) NOT NULL CHECK (montant_brut_fcfa >= 0),
  tva_taux numeric(5, 2) DEFAULT 18.00 CHECK (tva_taux >= 0),
  tva_montant_fcfa numeric(15, 2) DEFAULT 0 CHECK (tva_montant_fcfa >= 0),
  taxe_dev_comm_taux numeric(5, 2) DEFAULT 1.00 CHECK (taxe_dev_comm_taux >= 0),
  taxe_dev_comm_montant_fcfa numeric(15, 2) DEFAULT 0 CHECK (taxe_dev_comm_montant_fcfa >= 0),
  montant_total_fcfa numeric(15, 2) NOT NULL CHECK (montant_total_fcfa >= 0),
  numero_recu text,
  observations text,
  statut text DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'validee', 'payee', 'annulee')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- ============================================================================
-- Commentaires sur les colonnes
-- ============================================================================

COMMENT ON TABLE snp_artisan_ventes_or IS 'Collecte et vente d''or des artisans miniers avec calcul des taxes';
COMMENT ON COLUMN snp_artisan_ventes_or.type_or IS 'Type d''or: poudre, lingot, pepites, bijoux, autre';
COMMENT ON COLUMN snp_artisan_ventes_or.purete_karat IS 'Pureté en karats (18K, 22K, 24K, etc.)';
COMMENT ON COLUMN snp_artisan_ventes_or.prix_kg_fcfa IS 'Prix de vente au kilogramme en FCFA';
COMMENT ON COLUMN snp_artisan_ventes_or.montant_brut_fcfa IS 'Montant brut avant application des taxes';
COMMENT ON COLUMN snp_artisan_ventes_or.tva_taux IS 'Taux de TVA en pourcentage (18%)';
COMMENT ON COLUMN snp_artisan_ventes_or.taxe_dev_comm_taux IS 'Taux de taxe de développement communautaire (1%)';
COMMENT ON COLUMN snp_artisan_ventes_or.statut IS 'Statut: en_attente, validee, payee, annulee';

-- ============================================================================
-- Index pour optimiser les requêtes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ventes_or_artisan ON snp_artisan_ventes_or(artisan_id);
CREATE INDEX IF NOT EXISTS idx_ventes_or_date ON snp_artisan_ventes_or(date_vente DESC);
CREATE INDEX IF NOT EXISTS idx_ventes_or_statut ON snp_artisan_ventes_or(statut);
CREATE INDEX IF NOT EXISTS idx_ventes_or_artisan_date ON snp_artisan_ventes_or(artisan_id, date_vente DESC);

-- ============================================================================
-- Trigger pour calcul automatique des taxes et totaux
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_vente_or_taxes()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculer le montant brut (quantité en kg * prix au kg)
  NEW.montant_brut_fcfa := (NEW.quantite_grammes / 1000) * NEW.prix_kg_fcfa;

  -- Calculer la TVA (18% du montant brut)
  NEW.tva_montant_fcfa := NEW.montant_brut_fcfa * (NEW.tva_taux / 100);

  -- Calculer la taxe de développement communautaire (1% du montant brut)
  NEW.taxe_dev_comm_montant_fcfa := NEW.montant_brut_fcfa * (NEW.taxe_dev_comm_taux / 100);

  -- Calculer le montant total
  NEW.montant_total_fcfa := NEW.montant_brut_fcfa + NEW.tva_montant_fcfa + NEW.taxe_dev_comm_montant_fcfa;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_vente_or_taxes ON snp_artisan_ventes_or;
CREATE TRIGGER trigger_calculate_vente_or_taxes
  BEFORE INSERT OR UPDATE ON snp_artisan_ventes_or
  FOR EACH ROW
  EXECUTE FUNCTION calculate_vente_or_taxes();

-- ============================================================================
-- Trigger pour mettre à jour updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_vente_or_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vente_or_timestamp ON snp_artisan_ventes_or;
CREATE TRIGGER trigger_update_vente_or_timestamp
  BEFORE UPDATE ON snp_artisan_ventes_or
  FOR EACH ROW
  EXECUTE FUNCTION update_vente_or_updated_at();

-- ============================================================================
-- Trigger pour mettre à jour les métriques de l'artisan
-- ============================================================================

CREATE OR REPLACE FUNCTION update_artisan_metrics_on_vente_or()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.statut IN ('validee', 'payee') THEN
    -- Mise à jour lors de l'insertion d'une vente validée
    UPDATE snp_artisans_miniers
    SET
      quantite_or_vendu_grammes = COALESCE(quantite_or_vendu_grammes, 0) + NEW.quantite_grammes,
      chiffre_affaires_fcfa = COALESCE(chiffre_affaires_fcfa, 0) + NEW.montant_total_fcfa,
      nombre_transactions = COALESCE(nombre_transactions, 0) + 1,
      derniere_transaction_date = NEW.date_vente,
      updated_at = now()
    WHERE id = NEW.artisan_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Ajuster si le statut change
    IF OLD.statut NOT IN ('validee', 'payee') AND NEW.statut IN ('validee', 'payee') THEN
      -- Vente nouvellement validée
      UPDATE snp_artisans_miniers
      SET
        quantite_or_vendu_grammes = COALESCE(quantite_or_vendu_grammes, 0) + NEW.quantite_grammes,
        chiffre_affaires_fcfa = COALESCE(chiffre_affaires_fcfa, 0) + NEW.montant_total_fcfa,
        nombre_transactions = COALESCE(nombre_transactions, 0) + 1,
        derniere_transaction_date = NEW.date_vente,
        updated_at = now()
      WHERE id = NEW.artisan_id;
    ELSIF OLD.statut IN ('validee', 'payee') AND NEW.statut NOT IN ('validee', 'payee') THEN
      -- Vente annulée
      UPDATE snp_artisans_miniers
      SET
        quantite_or_vendu_grammes = GREATEST(0, COALESCE(quantite_or_vendu_grammes, 0) - OLD.quantite_grammes),
        chiffre_affaires_fcfa = GREATEST(0, COALESCE(chiffre_affaires_fcfa, 0) - OLD.montant_total_fcfa),
        nombre_transactions = GREATEST(0, COALESCE(nombre_transactions, 0) - 1),
        updated_at = now()
      WHERE id = OLD.artisan_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_artisan_metrics_vente_or ON snp_artisan_ventes_or;
CREATE TRIGGER trigger_update_artisan_metrics_vente_or
  AFTER INSERT OR UPDATE ON snp_artisan_ventes_or
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_metrics_on_vente_or();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE snp_artisan_ventes_or ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes si elles existent
DROP POLICY IF EXISTS "Users can view all gold sales" ON snp_artisan_ventes_or;
DROP POLICY IF EXISTS "Authorized users can insert gold sales" ON snp_artisan_ventes_or;
DROP POLICY IF EXISTS "Authorized users can update gold sales" ON snp_artisan_ventes_or;
DROP POLICY IF EXISTS "Authorized users can delete gold sales" ON snp_artisan_ventes_or;

-- Politique de lecture
CREATE POLICY "Users can view all gold sales"
  ON snp_artisan_ventes_or FOR SELECT
  TO authenticated
  USING (true);

-- Politique d'insertion
CREATE POLICY "Authorized users can insert gold sales"
  ON snp_artisan_ventes_or FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politique de mise à jour
CREATE POLICY "Authorized users can update gold sales"
  ON snp_artisan_ventes_or FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politique de suppression
CREATE POLICY "Authorized users can delete gold sales"
  ON snp_artisan_ventes_or FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- Vue pour les statistiques de ventes
-- ============================================================================

CREATE OR REPLACE VIEW snp_artisan_ventes_or_stats AS
SELECT
  artisan_id,
  COUNT(*) as nombre_ventes,
  SUM(quantite_grammes) as quantite_totale_grammes,
  SUM(montant_brut_fcfa) as montant_brut_total,
  SUM(tva_montant_fcfa) as tva_totale,
  SUM(taxe_dev_comm_montant_fcfa) as taxe_dev_comm_totale,
  SUM(montant_total_fcfa) as montant_total,
  AVG(prix_kg_fcfa) as prix_moyen_kg,
  AVG(purete_karat) as purete_moyenne,
  MIN(date_vente) as premiere_vente,
  MAX(date_vente) as derniere_vente,
  COUNT(CASE WHEN statut = 'validee' THEN 1 END) as ventes_validees,
  COUNT(CASE WHEN statut = 'payee' THEN 1 END) as ventes_payees,
  COUNT(CASE WHEN statut = 'annulee' THEN 1 END) as ventes_annulees
FROM snp_artisan_ventes_or
GROUP BY artisan_id;

COMMENT ON VIEW snp_artisan_ventes_or_stats IS 'Statistiques agrégées des ventes d''or par artisan';

-- ============================================================================
-- Fonction pour générer un numéro de reçu unique
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_numero_recu_vente_or()
RETURNS text AS $$
DECLARE
  annee text;
  mois text;
  sequence_num integer;
  numero text;
BEGIN
  -- Format: VENTE/OR/AAAA/MM/NNNN
  annee := to_char(CURRENT_DATE, 'YYYY');
  mois := to_char(CURRENT_DATE, 'MM');

  -- Compter les ventes du mois en cours
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM snp_artisan_ventes_or
  WHERE EXTRACT(YEAR FROM date_vente) = EXTRACT(YEAR FROM CURRENT_DATE)
    AND EXTRACT(MONTH FROM date_vente) = EXTRACT(MONTH FROM CURRENT_DATE);

  numero := 'VENTE/OR/' || annee || '/' || mois || '/' || LPAD(sequence_num::text, 4, '0');

  RETURN numero;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_numero_recu_vente_or IS 'Génère un numéro de reçu unique pour une vente d''or';
