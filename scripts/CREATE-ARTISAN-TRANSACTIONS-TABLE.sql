-- ============================================================================
-- SCRIPT SQL: Création de la Table des Transactions Artisans Miniers
-- Table: snp_artisan_transactions
-- Date: 2025-01-27
-- ============================================================================
--
-- Ce script crée la table pour enregistrer les transactions (achat/vente)
-- des artisans miniers
--
-- IMPORTANT: Ce script doit être exécuté dans Supabase SQL Editor
--
-- ============================================================================

-- Créer la table des transactions
CREATE TABLE IF NOT EXISTS snp_artisan_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid NOT NULL REFERENCES snp_artisans_miniers(id) ON DELETE CASCADE,
  type_transaction text NOT NULL CHECK (type_transaction IN ('achat', 'vente')),
  date_transaction date NOT NULL DEFAULT CURRENT_DATE,
  quantite_grammes numeric(12, 3) NOT NULL CHECK (quantite_grammes > 0),
  prix_unitaire_fcfa numeric(15, 2) NOT NULL CHECK (prix_unitaire_fcfa > 0),
  montant_total_fcfa numeric(15, 2) NOT NULL CHECK (montant_total_fcfa > 0),
  description text,
  numero_recu text,
  paiement_effectue boolean DEFAULT false,
  mode_paiement text CHECK (mode_paiement IN ('especes', 'virement', 'mobile_money', 'autre')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- ============================================================================
-- Commentaires sur les colonnes
-- ============================================================================

COMMENT ON TABLE snp_artisan_transactions IS
'Transactions d''achat et de vente d''or avec les artisans miniers';

COMMENT ON COLUMN snp_artisan_transactions.type_transaction IS
'Type de transaction: achat (on achète à l''artisan) ou vente (l''artisan vend)';

COMMENT ON COLUMN snp_artisan_transactions.quantite_grammes IS
'Quantité d''or échangée en grammes';

COMMENT ON COLUMN snp_artisan_transactions.prix_unitaire_fcfa IS
'Prix par gramme en FCFA';

COMMENT ON COLUMN snp_artisan_transactions.montant_total_fcfa IS
'Montant total de la transaction en FCFA (quantite * prix_unitaire)';

COMMENT ON COLUMN snp_artisan_transactions.numero_recu IS
'Numéro du reçu ou de la facture';

-- ============================================================================
-- Index pour optimiser les requêtes
-- ============================================================================

-- Index sur l'artisan (pour voir toutes les transactions d'un artisan)
CREATE INDEX IF NOT EXISTS idx_transactions_artisan
ON snp_artisan_transactions USING btree (artisan_id);

-- Index sur la date (pour les recherches par période)
CREATE INDEX IF NOT EXISTS idx_transactions_date
ON snp_artisan_transactions USING btree (date_transaction DESC);

-- Index sur le type de transaction
CREATE INDEX IF NOT EXISTS idx_transactions_type
ON snp_artisan_transactions USING btree (type_transaction);

-- Index composite pour les filtres courants
CREATE INDEX IF NOT EXISTS idx_transactions_artisan_date
ON snp_artisan_transactions USING btree (artisan_id, date_transaction DESC);

-- ============================================================================
-- Trigger pour mettre à jour updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_transaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_transaction_timestamp ON snp_artisan_transactions;
CREATE TRIGGER trigger_update_transaction_timestamp
  BEFORE UPDATE ON snp_artisan_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_updated_at();

-- ============================================================================
-- Trigger pour mettre à jour les métriques de l'artisan
-- ============================================================================

CREATE OR REPLACE FUNCTION update_artisan_metrics_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour les métriques de l'artisan
  UPDATE snp_artisans_miniers
  SET
    quantite_or_vendu_grammes = COALESCE(quantite_or_vendu_grammes, 0) + NEW.quantite_grammes,
    chiffre_affaires_fcfa = COALESCE(chiffre_affaires_fcfa, 0) + NEW.montant_total_fcfa,
    nombre_transactions = COALESCE(nombre_transactions, 0) + 1,
    derniere_transaction_date = NEW.date_transaction,
    updated_at = now()
  WHERE id = NEW.artisan_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_artisan_metrics ON snp_artisan_transactions;
CREATE TRIGGER trigger_update_artisan_metrics
  AFTER INSERT ON snp_artisan_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_metrics_on_transaction();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE snp_artisan_transactions ENABLE ROW LEVEL SECURITY;

-- Politique de lecture: tous les utilisateurs authentifiés peuvent voir les transactions
CREATE POLICY "Users can view all transactions"
  ON snp_artisan_transactions FOR SELECT
  TO authenticated
  USING (true);

-- Politique d'insertion: tous les utilisateurs authentifiés peuvent créer des transactions
CREATE POLICY "Authorized users can insert transactions"
  ON snp_artisan_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politique de mise à jour: tous les utilisateurs authentifiés peuvent modifier
CREATE POLICY "Authorized users can update transactions"
  ON snp_artisan_transactions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politique de suppression: tous les utilisateurs authentifiés peuvent supprimer
CREATE POLICY "Authorized users can delete transactions"
  ON snp_artisan_transactions FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- Vue pour les statistiques des transactions
-- ============================================================================

CREATE OR REPLACE VIEW snp_artisan_transactions_stats AS
SELECT
  artisan_id,
  type_transaction,
  COUNT(*) as nombre_transactions,
  SUM(quantite_grammes) as quantite_totale_grammes,
  SUM(montant_total_fcfa) as montant_total_fcfa,
  AVG(prix_unitaire_fcfa) as prix_moyen_gramme,
  MIN(date_transaction) as premiere_transaction,
  MAX(date_transaction) as derniere_transaction
FROM snp_artisan_transactions
GROUP BY artisan_id, type_transaction;

COMMENT ON VIEW snp_artisan_transactions_stats IS
'Vue agrégée des statistiques des transactions par artisan et par type';

-- ============================================================================
-- Données de test (optionnel - à commenter si non souhaité)
-- ============================================================================

-- Générer quelques transactions fictives pour les artisans existants
INSERT INTO snp_artisan_transactions (artisan_id, type_transaction, quantite_grammes, prix_unitaire_fcfa, montant_total_fcfa, date_transaction)
SELECT
  id,
  (ARRAY['achat', 'vente'])[FLOOR(RANDOM() * 2 + 1)],
  (RANDOM() * 100 + 10)::numeric(12,3),
  (25000 + RANDOM() * 5000)::numeric(15,2),
  ((RANDOM() * 100 + 10) * (25000 + RANDOM() * 5000))::numeric(15,2),
  CURRENT_DATE - (RANDOM() * 180)::integer
FROM snp_artisans_miniers
LIMIT 20;
