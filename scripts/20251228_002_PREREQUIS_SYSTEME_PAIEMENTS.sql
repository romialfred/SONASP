/*
  # Prérequis pour le Système de Paiements des Ventes d'Or Artisanal

  Ce script doit être exécuté AVANT la migration 20251228_003_SYSTEME_PAIEMENTS_ARTISANS.sql

  1. Crée la table des ventes d'or si elle n'existe pas
  2. Crée des vues/alias pour harmoniser les noms de tables
  3. Assure la compatibilité entre les anciennes et nouvelles conventions de nommage
*/

-- ============================================================================
-- 1. Créer la table des ventes d'or (si elle n'existe pas déjà)
-- ============================================================================

CREATE TABLE IF NOT EXISTS artisan_ventes_or (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID NOT NULL REFERENCES artisans_miniers(id) ON DELETE CASCADE,
  reference_vente TEXT,
  date_vente DATE NOT NULL DEFAULT CURRENT_DATE,
  quantite_grammes NUMERIC(12, 3) NOT NULL CHECK (quantite_grammes > 0),
  type_or TEXT NOT NULL CHECK (type_or IN ('poudre', 'lingot', 'pepites', 'bijoux', 'autre')),
  purete_karat NUMERIC(4, 2) NOT NULL CHECK (purete_karat > 0 AND purete_karat <= 24),
  prix_kg_fcfa NUMERIC(15, 2) NOT NULL CHECK (prix_kg_fcfa > 0),
  montant_brut_fcfa NUMERIC(15, 2) NOT NULL CHECK (montant_brut_fcfa >= 0),
  tva_taux NUMERIC(5, 2) DEFAULT 18.00 CHECK (tva_taux >= 0),
  tva_montant_fcfa NUMERIC(15, 2) DEFAULT 0 CHECK (tva_montant_fcfa >= 0),
  taxe_dev_comm_taux NUMERIC(5, 2) DEFAULT 1.00 CHECK (taxe_dev_comm_taux >= 0),
  taxe_dev_comm_montant_fcfa NUMERIC(15, 2) DEFAULT 0 CHECK (taxe_dev_comm_montant_fcfa >= 0),
  montant_total_fcfa NUMERIC(15, 2) NOT NULL CHECK (montant_total_fcfa >= 0),
  numero_recu TEXT,
  observations TEXT,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'validee', 'payee', 'annulee')),
  statut_validation TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- 2. Index pour optimiser les requêtes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_artisan_ventes_or_artisan ON artisan_ventes_or(artisan_id);
CREATE INDEX IF NOT EXISTS idx_artisan_ventes_or_date ON artisan_ventes_or(date_vente DESC);
CREATE INDEX IF NOT EXISTS idx_artisan_ventes_or_statut ON artisan_ventes_or(statut);
CREATE INDEX IF NOT EXISTS idx_artisan_ventes_or_artisan_date ON artisan_ventes_or(artisan_id, date_vente DESC);
CREATE INDEX IF NOT EXISTS idx_artisan_ventes_or_reference ON artisan_ventes_or(reference_vente);

-- ============================================================================
-- 3. Trigger pour calcul automatique des taxes
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

  -- Générer référence si pas fournie
  IF NEW.reference_vente IS NULL THEN
    NEW.reference_vente := 'VENTE-' || TO_CHAR(NEW.date_vente, 'YYYYMM') || '-' ||
                          LPAD((SELECT COUNT(*) + 1 FROM artisan_ventes_or
                                WHERE DATE_TRUNC('month', date_vente) = DATE_TRUNC('month', NEW.date_vente))::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_vente_or_taxes ON artisan_ventes_or;
CREATE TRIGGER trigger_calculate_vente_or_taxes
  BEFORE INSERT OR UPDATE ON artisan_ventes_or
  FOR EACH ROW
  EXECUTE FUNCTION calculate_vente_or_taxes();

-- ============================================================================
-- 4. Trigger pour mettre à jour updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_artisan_ventes_or_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vente_or_timestamp ON artisan_ventes_or;
CREATE TRIGGER trigger_update_vente_or_timestamp
  BEFORE UPDATE ON artisan_ventes_or
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_ventes_or_updated_at();

-- ============================================================================
-- 5. Row Level Security (RLS)
-- ============================================================================

ALTER TABLE artisan_ventes_or ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all gold sales" ON artisan_ventes_or;
DROP POLICY IF EXISTS "Authorized users can insert gold sales" ON artisan_ventes_or;
DROP POLICY IF EXISTS "Authorized users can update gold sales" ON artisan_ventes_or;
DROP POLICY IF EXISTS "Authorized users can delete gold sales" ON artisan_ventes_or;

CREATE POLICY "Users can view all gold sales"
  ON artisan_ventes_or FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can insert gold sales"
  ON artisan_ventes_or FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authorized users can update gold sales"
  ON artisan_ventes_or FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authorized users can delete gold sales"
  ON artisan_ventes_or FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- 6. Fonction pour générer un numéro de reçu
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_numero_recu_vente_or()
RETURNS TEXT AS $$
DECLARE
  annee TEXT;
  mois TEXT;
  sequence_num INTEGER;
  numero TEXT;
BEGIN
  annee := TO_CHAR(CURRENT_DATE, 'YYYY');
  mois := TO_CHAR(CURRENT_DATE, 'MM');

  SELECT COUNT(*) + 1 INTO sequence_num
  FROM artisan_ventes_or
  WHERE EXTRACT(YEAR FROM date_vente) = EXTRACT(YEAR FROM CURRENT_DATE)
    AND EXTRACT(MONTH FROM date_vente) = EXTRACT(MONTH FROM CURRENT_DATE);

  numero := 'VENTE-OR-' || annee || '-' || mois || '-' || LPAD(sequence_num::TEXT, 4, '0');

  RETURN numero;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Migration de données si table snp_artisan_ventes_or existe
-- ============================================================================

DO $$
BEGIN
  -- Si l'ancienne table existe, migrer les données
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'snp_artisan_ventes_or') THEN

    -- Insérer les données de l'ancienne table vers la nouvelle
    INSERT INTO artisan_ventes_or (
      id, artisan_id, date_vente, quantite_grammes, type_or, purete_karat,
      prix_kg_fcfa, montant_brut_fcfa, tva_taux, tva_montant_fcfa,
      taxe_dev_comm_taux, taxe_dev_comm_montant_fcfa, montant_total_fcfa,
      numero_recu, observations, statut, created_at, updated_at,
      created_by, updated_by
    )
    SELECT
      id, artisan_id, date_vente, quantite_grammes, type_or, purete_karat,
      prix_kg_fcfa, montant_brut_fcfa, tva_taux, tva_montant_fcfa,
      taxe_dev_comm_taux, taxe_dev_comm_montant_fcfa, montant_total_fcfa,
      numero_recu, observations, statut, created_at, updated_at,
      created_by, updated_by
    FROM snp_artisan_ventes_or
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Migration des données de snp_artisan_ventes_or vers artisan_ventes_or effectuée';
  END IF;
END $$;

-- ============================================================================
-- 8. Vue pour statistiques
-- ============================================================================

CREATE OR REPLACE VIEW v_artisan_ventes_or_stats AS
SELECT
  artisan_id,
  COUNT(*) AS nombre_ventes,
  SUM(quantite_grammes) AS quantite_totale_grammes,
  SUM(montant_brut_fcfa) AS montant_brut_total,
  SUM(tva_montant_fcfa) AS tva_totale,
  SUM(taxe_dev_comm_montant_fcfa) AS taxe_dev_comm_totale,
  SUM(montant_total_fcfa) AS montant_total,
  AVG(prix_kg_fcfa) AS prix_moyen_kg,
  AVG(purete_karat) AS purete_moyenne,
  MIN(date_vente) AS premiere_vente,
  MAX(date_vente) AS derniere_vente,
  COUNT(CASE WHEN statut = 'validee' THEN 1 END) AS ventes_validees,
  COUNT(CASE WHEN statut = 'payee' THEN 1 END) AS ventes_payees,
  COUNT(CASE WHEN statut = 'annulee' THEN 1 END) AS ventes_annulees
FROM artisan_ventes_or
GROUP BY artisan_id;

-- ============================================================================
-- Commentaires
-- ============================================================================

COMMENT ON TABLE artisan_ventes_or IS 'Collecte et vente d''or des artisans miniers avec calcul automatique des taxes';
COMMENT ON COLUMN artisan_ventes_or.reference_vente IS 'Référence unique de la vente';
COMMENT ON COLUMN artisan_ventes_or.type_or IS 'Type d''or: poudre, lingot, pepites, bijoux, autre';
COMMENT ON COLUMN artisan_ventes_or.purete_karat IS 'Pureté en karats (18K, 22K, 24K, etc.)';
COMMENT ON COLUMN artisan_ventes_or.montant_total_fcfa IS 'Montant total incluant toutes les taxes';
