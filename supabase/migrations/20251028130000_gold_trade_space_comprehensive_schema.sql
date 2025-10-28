/*
  # Gold Trade Space - Marketplace & Pricing Mechanisms Schema

  ## Ce que fait cette migration

  1. **Tables de Prix et Forward Rates**
     - `forward_rates` - Taux forward pour calculs à terme (jusqu'à 30 jours)
     - `spot_pricing_sessions` - Sessions de pricing spot
     - `pricing_mechanism_comparisons` - Comparaisons financières entre mécanismes

  2. **Tables de Ventes Sophistiquées**
     - Extension de la table `sales` pour supporter les 3 mécanismes
     - `sale_pricing_details` - Détails de pricing par mécanisme
     - `sale_recommendations` - Recommandations AI pour quantités optimales

  3. **Tables de Configuration**
     - `trading_hours_config` - Configuration des heures de trading
     - `refineries_approved` - Raffineries approuvées pour In-Process

  4. **Vues et Fonctions**
     - Vue de comparaison en temps réel
     - Fonctions de calcul automatique
     - Triggers pour recommandations

  ## Sécurité
  - RLS activé sur toutes les tables
  - Policies basées sur les rôles utilisateur
*/

-- ============================================================================
-- ÉTAPE 1: TABLE DES TAUX FORWARD
-- ============================================================================

CREATE TABLE IF NOT EXISTS forward_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date DATE NOT NULL,
  forward_days INTEGER NOT NULL CHECK (forward_days BETWEEN 1 AND 90),

  adjustment_rate_percentage DECIMAL(8, 6) NOT NULL,
  currency_pair TEXT NOT NULL DEFAULT 'XAU/USD',

  is_premium BOOLEAN DEFAULT true,
  market_conditions TEXT,

  source TEXT DEFAULT 'Market Data',
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(rate_date, forward_days, currency_pair)
);

CREATE INDEX IF NOT EXISTS idx_forward_rates_date ON forward_rates(rate_date, forward_days);
CREATE INDEX IF NOT EXISTS idx_forward_rates_active ON forward_rates(is_active, rate_date);

COMMENT ON TABLE forward_rates IS 'Forward rate adjustments for gold pricing up to 90 days';

-- Insérer des taux forward par défaut
INSERT INTO forward_rates (rate_date, forward_days, adjustment_rate_percentage, is_premium, market_conditions)
VALUES
  (CURRENT_DATE, 7, 0.15, true, 'Normal market conditions'),
  (CURRENT_DATE, 14, 0.28, true, 'Normal market conditions'),
  (CURRENT_DATE, 21, 0.42, true, 'Normal market conditions'),
  (CURRENT_DATE, 30, 0.58, true, 'Normal market conditions')
ON CONFLICT (rate_date, forward_days, currency_pair) DO NOTHING;

-- ============================================================================
-- ÉTAPE 2: TABLE DES RAFFINERIES APPROUVÉES
-- ============================================================================

CREATE TABLE IF NOT EXISTS refineries_approved (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refinery_name TEXT NOT NULL,
  refinery_location TEXT NOT NULL,

  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  country TEXT NOT NULL,

  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,

  certification_number TEXT,
  is_approved BOOLEAN DEFAULT true,
  approval_date DATE,

  max_monthly_capacity_oz DECIMAL(12, 2),
  average_processing_days INTEGER,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refineries_approved_active ON refineries_approved(is_approved);
CREATE INDEX IF NOT EXISTS idx_refineries_country ON refineries_approved(country, is_approved);

COMMENT ON TABLE refineries_approved IS 'Approved refineries for In-Process gold sales';

-- Insérer Rand Refinery (mentionné dans le contrat)
INSERT INTO refineries_approved (
  refinery_name, refinery_location, address_line1, city, country,
  certification_number, is_approved, approval_date,
  max_monthly_capacity_oz, average_processing_days
)
VALUES
  (
    'Rand Refinery Ltd.',
    'Germiston, South Africa',
    'Refinery Road, Industries West',
    'Germiston',
    'South Africa',
    'RR-ZA-001',
    true,
    '2024-01-01',
    10000.00,
    7
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ÉTAPE 3: TABLE DES HEURES DE TRADING
-- ============================================================================

CREATE TABLE IF NOT EXISTS trading_hours_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_name TEXT NOT NULL UNIQUE,

  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  opening_time TIME NOT NULL,
  closing_time TIME NOT NULL,

  days_of_operation TEXT[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO trading_hours_config (market_name, timezone, opening_time, closing_time)
VALUES
  ('New York Commodity Exchange', 'America/New_York', '07:30:00', '16:30:00')
ON CONFLICT (market_name) DO NOTHING;

COMMENT ON TABLE trading_hours_config IS 'Trading hours configuration for spot pricing';

-- ============================================================================
-- ÉTAPE 4: EXTENSION DE LA TABLE SALES
-- ============================================================================

DO $$
BEGIN
  -- Ajouter les colonnes pour les mécanismes de pricing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'pricing_mechanism') THEN
    ALTER TABLE sales ADD COLUMN pricing_mechanism TEXT CHECK (pricing_mechanism IN ('spot', 'forward', 'in_process'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'spot_pricing_date') THEN
    ALTER TABLE sales ADD COLUMN spot_pricing_date TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'spot_value_date') THEN
    ALTER TABLE sales ADD COLUMN spot_value_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'forward_days') THEN
    ALTER TABLE sales ADD COLUMN forward_days INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'forward_rate_adjustment') THEN
    ALTER TABLE sales ADD COLUMN forward_rate_adjustment DECIMAL(8, 6);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'forward_value_date') THEN
    ALTER TABLE sales ADD COLUMN forward_value_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'in_process_refinery_id') THEN
    ALTER TABLE sales ADD COLUMN in_process_refinery_id UUID REFERENCES refineries_approved(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'in_process_batch_id') THEN
    ALTER TABLE sales ADD COLUMN in_process_batch_id UUID REFERENCES batches(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'final_price_per_oz') THEN
    ALTER TABLE sales ADD COLUMN final_price_per_oz DECIMAL(12, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'order_type') THEN
    ALTER TABLE sales ADD COLUMN order_type TEXT DEFAULT 'good_until_cancelled';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'buyer_notice_days') THEN
    ALTER TABLE sales ADD COLUMN buyer_notice_days INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 5: TABLE DES DÉTAILS DE PRICING PAR MÉCANISME
-- ============================================================================

CREATE TABLE IF NOT EXISTS sale_pricing_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,

  mechanism TEXT NOT NULL CHECK (mechanism IN ('spot', 'forward', 'in_process')),

  base_spot_price DECIMAL(12, 2) NOT NULL,

  forward_adjustment DECIMAL(12, 2) DEFAULT 0,
  forward_adjustment_percentage DECIMAL(8, 6) DEFAULT 0,

  final_price_per_oz DECIMAL(12, 2) NOT NULL,
  total_value_usd DECIMAL(15, 2) NOT NULL,

  calculation_timestamp TIMESTAMPTZ DEFAULT now(),
  market_conditions TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_pricing_sale_id ON sale_pricing_details(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_pricing_mechanism ON sale_pricing_details(mechanism);

COMMENT ON TABLE sale_pricing_details IS 'Detailed pricing breakdown per sales mechanism';

-- ============================================================================
-- ÉTAPE 6: TABLE DES COMPARAISONS DE MÉCANISMES
-- ============================================================================

CREATE TABLE IF NOT EXISTS pricing_mechanism_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  quantity_oz DECIMAL(12, 4) NOT NULL,
  spot_price_per_oz DECIMAL(12, 2) NOT NULL,

  spot_total_value DECIMAL(15, 2) NOT NULL,
  spot_value_date DATE NOT NULL,

  forward_7d_total_value DECIMAL(15, 2),
  forward_7d_adjustment DECIMAL(8, 6),
  forward_7d_benefit DECIMAL(15, 2),

  forward_14d_total_value DECIMAL(15, 2),
  forward_14d_adjustment DECIMAL(8, 6),
  forward_14d_benefit DECIMAL(15, 2),

  forward_30d_total_value DECIMAL(15, 2),
  forward_30d_adjustment DECIMAL(8, 6),
  forward_30d_benefit DECIMAL(15, 2),

  in_process_estimated_value DECIMAL(15, 2),
  in_process_refinery_id UUID REFERENCES refineries_approved(id),
  in_process_benefit DECIMAL(15, 2),

  recommended_mechanism TEXT CHECK (recommended_mechanism IN ('spot', 'forward_7d', 'forward_14d', 'forward_30d', 'in_process')),
  recommendation_reason TEXT,

  gold_trend TEXT,
  market_volatility DECIMAL(8, 4),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_comparisons_user ON pricing_mechanism_comparisons(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pricing_comparisons_recommended ON pricing_mechanism_comparisons(recommended_mechanism);

COMMENT ON TABLE pricing_mechanism_comparisons IS 'Financial comparison of all pricing mechanisms';

-- ============================================================================
-- ÉTAPE 7: TABLE DES RECOMMANDATIONS DE QUANTITÉ
-- ============================================================================

CREATE TABLE IF NOT EXISTS sale_quantity_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  available_stock_oz DECIMAL(12, 4) NOT NULL,
  current_price_per_oz DECIMAL(12, 2) NOT NULL,

  gold_trend TEXT NOT NULL CHECK (gold_trend IN ('bullish', 'bearish', 'neutral')),
  trend_strength DECIMAL(5, 2),

  price_volatility DECIMAL(8, 4),
  avg_price_30d DECIMAL(12, 2),

  recommended_quantity_oz DECIMAL(12, 4) NOT NULL,
  recommended_percentage DECIMAL(5, 2) NOT NULL,

  reasoning TEXT NOT NULL,
  confidence_score DECIMAL(5, 2) CHECK (confidence_score BETWEEN 0 AND 100),

  optimal_timing TEXT,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quantity_recommendations_trend ON sale_quantity_recommendations(gold_trend, created_at);
CREATE INDEX IF NOT EXISTS idx_quantity_recommendations_confidence ON sale_quantity_recommendations(confidence_score DESC);

COMMENT ON TABLE sale_quantity_recommendations IS 'AI-powered quantity recommendations based on market trends';

-- ============================================================================
-- ÉTAPE 8: FONCTIONS DE CALCUL
-- ============================================================================

-- Fonction pour calculer le prix forward
CREATE OR REPLACE FUNCTION calculate_forward_price(
  spot_price DECIMAL,
  forward_days INTEGER
)
RETURNS DECIMAL AS $$
DECLARE
  adjustment_rate DECIMAL;
  forward_price DECIMAL;
BEGIN
  SELECT adjustment_rate_percentage INTO adjustment_rate
  FROM forward_rates
  WHERE rate_date = CURRENT_DATE
    AND forward_days = calculate_forward_price.forward_days
    AND is_active = true
  LIMIT 1;

  IF adjustment_rate IS NULL THEN
    adjustment_rate := 0.02 * (forward_days / 7.0);
  END IF;

  forward_price := spot_price * (1 + (adjustment_rate / 100));

  RETURN ROUND(forward_price, 2);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_forward_price IS 'Calculate forward price with adjustment for specified days';

-- Fonction pour obtenir le meilleur mécanisme
CREATE OR REPLACE FUNCTION get_recommended_mechanism(
  quantity DECIMAL,
  trend TEXT
)
RETURNS TEXT AS $$
DECLARE
  recommendation TEXT;
BEGIN
  IF trend = 'bullish' THEN
    recommendation := 'spot';
  ELSIF trend = 'bearish' THEN
    recommendation := 'forward_30d';
  ELSE
    recommendation := 'forward_14d';
  END IF;

  RETURN recommendation;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_recommended_mechanism IS 'Get recommended pricing mechanism based on market trend';

-- ============================================================================
-- ÉTAPE 9: VUE DE COMPARAISON EN TEMPS RÉEL
-- ============================================================================

CREATE OR REPLACE VIEW live_pricing_comparison AS
SELECT
  gp.london_am_rate as current_spot_price,
  gp.price_date,

  calculate_forward_price(gp.london_am_rate, 7) as forward_7d_price,
  calculate_forward_price(gp.london_am_rate, 14) as forward_14d_price,
  calculate_forward_price(gp.london_am_rate, 30) as forward_30d_price,

  (calculate_forward_price(gp.london_am_rate, 7) - gp.london_am_rate) as forward_7d_benefit_per_oz,
  (calculate_forward_price(gp.london_am_rate, 14) - gp.london_am_rate) as forward_14d_benefit_per_oz,
  (calculate_forward_price(gp.london_am_rate, 30) - gp.london_am_rate) as forward_30d_benefit_per_oz,

  fr7.adjustment_rate_percentage as forward_7d_rate,
  fr14.adjustment_rate_percentage as forward_14d_rate,
  fr30.adjustment_rate_percentage as forward_30d_rate,

  gp.created_at
FROM gold_prices_daily gp
LEFT JOIN forward_rates fr7 ON fr7.rate_date = CURRENT_DATE AND fr7.forward_days = 7 AND fr7.is_active = true
LEFT JOIN forward_rates fr14 ON fr14.rate_date = CURRENT_DATE AND fr14.forward_days = 14 AND fr14.is_active = true
LEFT JOIN forward_rates fr30 ON fr30.rate_date = CURRENT_DATE AND fr30.forward_days = 30 AND fr30.is_active = true
WHERE gp.price_date = CURRENT_DATE
ORDER BY gp.created_at DESC
LIMIT 1;

COMMENT ON VIEW live_pricing_comparison IS 'Real-time comparison of all pricing mechanisms';

-- ============================================================================
-- ÉTAPE 10: ACTIVER RLS ET CRÉER LES POLICIES
-- ============================================================================

ALTER TABLE forward_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE refineries_approved ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_hours_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_pricing_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_mechanism_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_quantity_recommendations ENABLE ROW LEVEL SECURITY;

-- Policies pour forward_rates (lecture publique, écriture management)
CREATE POLICY "forward_rates_select_policy"
  ON forward_rates FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "forward_rates_management_policy"
  ON forward_rates FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Policies pour refineries_approved
CREATE POLICY "refineries_select_policy"
  ON refineries_approved FOR SELECT TO authenticated USING (is_approved = true);

CREATE POLICY "refineries_management_policy"
  ON refineries_approved FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Policies pour trading_hours_config
CREATE POLICY "trading_hours_select_policy"
  ON trading_hours_config FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "trading_hours_management_policy"
  ON trading_hours_config FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Policies pour sale_pricing_details
CREATE POLICY "sale_pricing_select_policy"
  ON sale_pricing_details FOR SELECT TO authenticated USING (true);

CREATE POLICY "sale_pricing_insert_policy"
  ON sale_pricing_details FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('factory', 'management')
    )
  );

-- Policies pour pricing_mechanism_comparisons
CREATE POLICY "pricing_comparisons_select_policy"
  ON pricing_mechanism_comparisons FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'management'
  ));

CREATE POLICY "pricing_comparisons_insert_policy"
  ON pricing_mechanism_comparisons FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policies pour sale_quantity_recommendations
CREATE POLICY "quantity_recommendations_select_policy"
  ON sale_quantity_recommendations FOR SELECT TO authenticated USING (true);

CREATE POLICY "quantity_recommendations_insert_policy"
  ON sale_quantity_recommendations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('factory', 'management')
    )
  );
