/*
  # Add Bank FX Rate Sources

  1. New Bank Sources
    - Adds 9 bank sources for FX rates across Guinea, Mali, Côte d'Ivoire, France, Dubai, and Emirates
    - Each bank has a unique code and country information

  2. Changes
    - Add country column to fx_rate_sources table
    - Insert bank records into fx_rate_sources table
    - Banks: Ecobank Guinée, Ecobank Mali, Ecobank Côte d'Ivoire, Coris Bank Guinée,
             Ecobank France, Citi Bank Côte d'Ivoire, Citi Bank Dubai, Standard Chartered Bank Emirates
*/

-- Add country column to fx_rate_sources if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fx_rate_sources' AND column_name = 'country'
  ) THEN
    ALTER TABLE fx_rate_sources ADD COLUMN country text;
  END IF;
END $$;

-- Insert bank sources for FX rates
INSERT INTO fx_rate_sources (name, code, country, is_active, description) VALUES
  ('Ecobank Guinée', 'ECO_GN', 'Guinea', true, 'Ecobank Guinea branch - local market rates'),
  ('Ecobank Mali', 'ECO_ML', 'Mali', true, 'Ecobank Mali branch - West African CFA rates'),
  ('Ecobank Côte d''Ivoire', 'ECO_CI', 'Côte d''Ivoire', true, 'Ecobank Côte d''Ivoire branch - CFA franc rates'),
  ('Coris Bank Guinée', 'CORIS_GN', 'Guinea', true, 'Coris Bank Guinea - competitive local rates'),
  ('Ecobank France', 'ECO_FR', 'France', true, 'Ecobank France - Euro zone rates'),
  ('Citi Bank Côte d''Ivoire', 'CITI_CI', 'Côte d''Ivoire', true, 'Citi Bank Côte d''Ivoire - international rates'),
  ('Citi Bank Dubai', 'CITI_AE', 'UAE', true, 'Citi Bank Dubai - Middle East rates'),
  ('Standard Chartered Bank Emirates', 'SCB_AE', 'UAE', true, 'Standard Chartered Bank UAE - GCC rates')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  country = EXCLUDED.country,
  is_active = EXCLUDED.is_active,
  description = EXCLUDED.description;
