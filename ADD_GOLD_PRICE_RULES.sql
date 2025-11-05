-- Add Gold Price Business Rules
-- To be applied manually via Supabase SQL Editor

-- Insert gold price rules if they don't exist
DO $$
BEGIN
  -- London AM Rate Margin
  IF NOT EXISTS (SELECT 1 FROM business_rules WHERE rule_key = 'gold_price_margin_london_am') THEN
    INSERT INTO business_rules (rule_key, rule_name, rule_value, rule_category, description, unit)
    VALUES (
      'gold_price_margin_london_am',
      'Marge sur London AM',
      2.5,
      'gold_price',
      'Marge appliquée sur le cours London AM pour les ventes (en pourcentage)',
      '%'
    );
  END IF;

  -- Minimum Gold Price
  IF NOT EXISTS (SELECT 1 FROM business_rules WHERE rule_key = 'gold_price_minimum') THEN
    INSERT INTO business_rules (rule_key, rule_name, rule_value, rule_category, description, unit)
    VALUES (
      'gold_price_minimum',
      'Prix Minimum de l''Or',
      1800.00,
      'gold_price',
      'Prix minimum par once troy en USD (protection contre les erreurs)',
      'USD/oz'
    );
  END IF;

  -- Maximum Gold Price
  IF NOT EXISTS (SELECT 1 FROM business_rules WHERE rule_key = 'gold_price_maximum') THEN
    INSERT INTO business_rules (rule_key, rule_name, rule_value, rule_category, description, unit)
    VALUES (
      'gold_price_maximum',
      'Prix Maximum de l''Or',
      3000.00,
      'gold_price',
      'Prix maximum par once troy en USD (protection contre les erreurs)',
      'USD/oz'
    );
  END IF;

  -- Royalty Percentage
  IF NOT EXISTS (SELECT 1 FROM business_rules WHERE rule_key = 'gold_royalty_percentage') THEN
    INSERT INTO business_rules (rule_key, rule_name, rule_value, rule_category, description, unit)
    VALUES (
      'gold_royalty_percentage',
      'Pourcentage Royalties',
      3.0,
      'gold_price',
      'Pourcentage de royalties net smelted appliqué aux ventes',
      '%'
    );
  END IF;

  -- Freight Cost Default
  IF NOT EXISTS (SELECT 1 FROM business_rules WHERE rule_key = 'gold_freight_cost_default') THEN
    INSERT INTO business_rules (rule_key, rule_name, rule_value, rule_category, description, unit)
    VALUES (
      'gold_freight_cost_default',
      'Frais de Transport par Défaut',
      500.00,
      'gold_price',
      'Frais de transport par défaut pour les expéditions internationales',
      'USD'
    );
  END IF;
END $$;

-- Verify the insertion
SELECT 
  rule_name,
  rule_value,
  unit,
  description
FROM business_rules 
WHERE rule_category = 'gold_price'
ORDER BY rule_name;
