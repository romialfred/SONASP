/*
  ===============================================================================
  MIGRATION: Create Gold Prices Tables for LBMA Data
  ===============================================================================

  INSTRUCTIONS D'APPLICATION:
  1. Ouvrir Supabase Dashboard > SQL Editor
  2. Copier tout le contenu de ce fichier
  3. Coller dans l'éditeur SQL
  4. Cliquer sur "Run" pour exécuter
  5. Vérifier que les tables sont créées avec succès

  DESCRIPTION:
  Crée les tables pour stocker les données de prix de l'or LBMA
  (London Bullion Market Association - autorité mondiale des prix de l'or)

  - gold_prices_daily: Prix quotidiens (18-22 jours par mois)
  - gold_prices_monthly: Agrégations mensuelles

  ===============================================================================
*/

-- =============================================================================
-- TABLE: gold_prices_daily
-- Description: Stocke les prix quotidiens de l'or LBMA
-- Fréquence: Jours de trading uniquement (lundi-vendredi, hors jours fériés)
-- Source: London Bullion Market Association (LBMA)
-- =============================================================================

CREATE TABLE IF NOT EXISTS gold_prices_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_date DATE NOT NULL UNIQUE,
  opening_price DECIMAL(10, 2) NOT NULL,
  closing_price DECIMAL(10, 2) NOT NULL,
  high_price DECIMAL(10, 2) NOT NULL,
  low_price DECIMAL(10, 2) NOT NULL,
  london_am_rate DECIMAL(10, 2) NOT NULL,  -- Prix de référence principal LBMA (10:30 AM GMT)
  london_pm_rate DECIMAL(10, 2),           -- Prix de référence secondaire LBMA (3:00 PM GMT)
  spot_price DECIMAL(10, 2),
  average_price DECIMAL(10, 2) NOT NULL,
  source VARCHAR(100) DEFAULT 'LBMA',
  currency VARCHAR(3) DEFAULT 'USD',
  data_points INTEGER DEFAULT 1,           -- Nombre d'échantillons intrajournaliers
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Contraintes de validité des prix
  CONSTRAINT valid_prices CHECK (
    opening_price > 0 AND
    closing_price > 0 AND
    high_price > 0 AND
    low_price > 0 AND
    london_am_rate > 0 AND
    average_price > 0
  ),

  -- Contrainte logique: le plus haut doit être >= au plus bas
  CONSTRAINT logical_high_low CHECK (high_price >= low_price)
);

-- =============================================================================
-- INDEXES pour gold_prices_daily
-- =============================================================================

-- Index pour les requêtes par date (ordre décroissant pour les plus récents)
CREATE INDEX IF NOT EXISTS idx_gold_prices_daily_date
  ON gold_prices_daily(price_date DESC);

-- Index pour les filtres par année/mois
CREATE INDEX IF NOT EXISTS idx_gold_prices_daily_year_month
  ON gold_prices_daily(
    EXTRACT(YEAR FROM price_date),
    EXTRACT(MONTH FROM price_date)
  );

-- =============================================================================
-- TABLE: gold_prices_monthly
-- Description: Agrégations mensuelles calculées à partir des données quotidiennes
-- =============================================================================

CREATE TABLE IF NOT EXISTS gold_prices_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  average_price DECIMAL(10, 2) NOT NULL,
  high_price DECIMAL(10, 2) NOT NULL,
  low_price DECIMAL(10, 2) NOT NULL,
  opening_price DECIMAL(10, 2) NOT NULL,  -- Prix du premier jour du mois
  closing_price DECIMAL(10, 2) NOT NULL,  -- Prix du dernier jour du mois
  total_days INTEGER NOT NULL CHECK (total_days >= 0 AND total_days <= 31),  -- Nombre réel de jours de trading
  volatility DECIMAL(10, 2) DEFAULT 0,    -- Écart-type (mesure de volatilité)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Contrainte d'unicité: une seule entrée par mois
  CONSTRAINT unique_year_month UNIQUE (year, month),

  -- Contraintes de validité des prix
  CONSTRAINT valid_monthly_prices CHECK (
    average_price > 0 AND
    high_price > 0 AND
    low_price > 0 AND
    opening_price > 0 AND
    closing_price > 0
  ),

  -- Contrainte logique: le plus haut doit être >= au plus bas
  CONSTRAINT logical_monthly_high_low CHECK (high_price >= low_price)
);

-- =============================================================================
-- INDEXES pour gold_prices_monthly
-- =============================================================================

-- Index pour les requêtes par année/mois (ordre décroissant)
CREATE INDEX IF NOT EXISTS idx_gold_prices_monthly_year_month
  ON gold_prices_monthly(year DESC, month DESC);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Activer RLS sur les deux tables
ALTER TABLE gold_prices_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_prices_monthly ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- POLICIES pour gold_prices_daily
-- =============================================================================

-- Lecture publique (tout le monde peut voir les prix)
CREATE POLICY "Anyone can view daily gold prices"
  ON gold_prices_daily
  FOR SELECT
  TO public
  USING (true);

-- Insertion réservée aux utilisateurs authentifiés
CREATE POLICY "Only authenticated users can insert daily prices"
  ON gold_prices_daily
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Mise à jour réservée aux utilisateurs authentifiés
CREATE POLICY "Only authenticated users can update daily prices"
  ON gold_prices_daily
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- POLICIES pour gold_prices_monthly
-- =============================================================================

-- Lecture publique (tout le monde peut voir les agrégations)
CREATE POLICY "Anyone can view monthly gold prices"
  ON gold_prices_monthly
  FOR SELECT
  TO public
  USING (true);

-- Insertion réservée aux utilisateurs authentifiés
CREATE POLICY "Only authenticated users can insert monthly aggregates"
  ON gold_prices_monthly
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Mise à jour réservée aux utilisateurs authentifiés
CREATE POLICY "Only authenticated users can update monthly aggregates"
  ON gold_prices_monthly
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- COMMENTAIRES INFORMATIFS
-- =============================================================================

COMMENT ON TABLE gold_prices_daily IS
  'Données quotidiennes des prix de l''or LBMA (London Bullion Market Association). '
  'Contient uniquement les jours de trading (lundi-vendredi, hors jours fériés). '
  'Environ 20-22 jours par mois. Source officielle: www.lbma.org.uk';

COMMENT ON COLUMN gold_prices_daily.london_am_rate IS
  'LBMA London AM Gold Fix - Prix de référence principal fixé à 10:30 AM GMT. '
  'C''est le prix de référence utilisé pour les calculs de vente.';

COMMENT ON COLUMN gold_prices_daily.london_pm_rate IS
  'LBMA London PM Gold Fix - Prix de référence secondaire fixé à 3:00 PM GMT';

COMMENT ON COLUMN gold_prices_daily.price_date IS
  'Date de trading - jours ouvrables uniquement, exclut les weekends et jours fériés';

COMMENT ON COLUMN gold_prices_daily.data_points IS
  'Nombre d''échantillons de prix intrajournaliers utilisés pour le calcul de la moyenne';

COMMENT ON TABLE gold_prices_monthly IS
  'Statistiques mensuelles agrégées des prix de l''or. '
  'Le champ total_days reflète le nombre réel de jours de trading (typiquement 18-22 par mois).';

COMMENT ON COLUMN gold_prices_monthly.total_days IS
  'Nombre de jours de trading réels dans le mois (exclut weekends et jours fériés)';

COMMENT ON COLUMN gold_prices_monthly.volatility IS
  'Volatilité des prix mesurée par l''écart-type';

-- =============================================================================
-- VÉRIFICATION
-- =============================================================================

-- Afficher les tables créées
SELECT
  'gold_prices_daily' as table_name,
  COUNT(*) as row_count
FROM gold_prices_daily
UNION ALL
SELECT
  'gold_prices_monthly' as table_name,
  COUNT(*) as row_count
FROM gold_prices_monthly;

-- =============================================================================
-- FIN DE LA MIGRATION
-- =============================================================================

/*
  PROCHAINES ÉTAPES:

  1. ✅ Migration appliquée avec succès
  2. ⚠️ Exécuter le script de seed: node scripts/seed_lbma_gold_prices.mjs
  3. ⚠️ Vérifier les données dans la page Gold Prices
  4. ⚠️ Importer des données LBMA réelles depuis une source officielle

  DOCUMENTATION:
  - LBMA Official: https://www.lbma.org.uk
  - Gold Price Data: https://www.lbma.org.uk/gold-price

  Pour toute question, consultez le fichier:
  GOLD_PRICES_MODULE_FIX_COMPLETE.md
*/
