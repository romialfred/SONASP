/*
  # Seed Bank FX Rates Data

  1. Purpose
    - Add sample FX rates from different bank sources
    - Allows testing of comparison feature

  2. Data
    - Rates for today's date from all 8 bank sources
    - Multiple currency pairs (USD/XOF, USD/GNF, EUR/USD)
*/

-- Get source IDs
DO $$
DECLARE
  today_date date := CURRENT_DATE;
  eco_gn_id uuid;
  eco_ml_id uuid;
  eco_ci_id uuid;
  coris_gn_id uuid;
  eco_fr_id uuid;
  citi_ci_id uuid;
  citi_ae_id uuid;
  scb_ae_id uuid;
BEGIN
  -- Get source IDs
  SELECT id INTO eco_gn_id FROM fx_rate_sources WHERE code = 'ECO_GN';
  SELECT id INTO eco_ml_id FROM fx_rate_sources WHERE code = 'ECO_ML';
  SELECT id INTO eco_ci_id FROM fx_rate_sources WHERE code = 'ECO_CI';
  SELECT id INTO coris_gn_id FROM fx_rate_sources WHERE code = 'CORIS_GN';
  SELECT id INTO eco_fr_id FROM fx_rate_sources WHERE code = 'ECO_FR';
  SELECT id INTO citi_ci_id FROM fx_rate_sources WHERE code = 'CITI_CI';
  SELECT id INTO citi_ae_id FROM fx_rate_sources WHERE code = 'CITI_AE';
  SELECT id INTO scb_ae_id FROM fx_rate_sources WHERE code = 'SCB_AE';

  -- Insert USD/XOF rates (slightly different rates from each bank)
  INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, notes)
  VALUES
    (today_date, 'USD/XOF', eco_gn_id, 612.50, 610.00, 615.00, 'Ecobank Guinea rate'),
    (today_date, 'USD/XOF', eco_ml_id, 613.25, 611.00, 615.50, 'Ecobank Mali rate'),
    (today_date, 'USD/XOF', eco_ci_id, 611.80, 610.50, 613.10, 'Ecobank Côte d''Ivoire rate'),
    (today_date, 'USD/XOF', coris_gn_id, 614.00, 612.00, 616.00, 'Coris Bank Guinea rate'),
    (today_date, 'USD/XOF', eco_fr_id, 612.75, 611.50, 614.00, 'Ecobank France rate'),
    (today_date, 'USD/XOF', citi_ci_id, 613.50, 612.50, 614.50, 'Citi Bank Côte d''Ivoire rate'),
    (today_date, 'USD/XOF', citi_ae_id, 612.90, 612.00, 613.80, 'Citi Bank Dubai rate'),
    (today_date, 'USD/XOF', scb_ae_id, 613.10, 612.20, 614.00, 'Standard Chartered Emirates rate')
  ON CONFLICT (rate_date, currency_pair, source_id) DO UPDATE SET
    rate = EXCLUDED.rate,
    bid_rate = EXCLUDED.bid_rate,
    ask_rate = EXCLUDED.ask_rate,
    notes = EXCLUDED.notes;

  -- Insert USD/GNF rates
  INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, notes)
  VALUES
    (today_date, 'USD/GNF', eco_gn_id, 8620.00, 8600.00, 8640.00, 'Ecobank Guinea local rate'),
    (today_date, 'USD/GNF', eco_ml_id, 8625.00, 8605.00, 8645.00, 'Ecobank Mali cross rate'),
    (today_date, 'USD/GNF', eco_ci_id, 8618.00, 8598.00, 8638.00, 'Ecobank CI cross rate'),
    (today_date, 'USD/GNF', coris_gn_id, 8630.00, 8610.00, 8650.00, 'Coris Bank Guinea competitive rate'),
    (today_date, 'USD/GNF', eco_fr_id, 8622.00, 8602.00, 8642.00, 'Ecobank France rate'),
    (today_date, 'USD/GNF', citi_ci_id, 8627.00, 8607.00, 8647.00, 'Citi Bank CI rate'),
    (today_date, 'USD/GNF', citi_ae_id, 8624.00, 8604.00, 8644.00, 'Citi Bank Dubai rate'),
    (today_date, 'USD/GNF', scb_ae_id, 8626.00, 8606.00, 8646.00, 'Standard Chartered rate')
  ON CONFLICT (rate_date, currency_pair, source_id) DO UPDATE SET
    rate = EXCLUDED.rate,
    bid_rate = EXCLUDED.bid_rate,
    ask_rate = EXCLUDED.ask_rate,
    notes = EXCLUDED.notes;

  -- Insert EUR/USD rates
  INSERT INTO fx_rates_daily (rate_date, currency_pair, source_id, rate, bid_rate, ask_rate, notes)
  VALUES
    (today_date, 'EUR/USD', eco_gn_id, 1.08750, 1.08700, 1.08800, 'Ecobank Guinea EUR rate'),
    (today_date, 'EUR/USD', eco_ml_id, 1.08780, 1.08730, 1.08830, 'Ecobank Mali EUR rate'),
    (today_date, 'EUR/USD', eco_ci_id, 1.08760, 1.08710, 1.08810, 'Ecobank CI EUR rate'),
    (today_date, 'EUR/USD', coris_gn_id, 1.08800, 1.08750, 1.08850, 'Coris Bank Guinea EUR rate'),
    (today_date, 'EUR/USD', eco_fr_id, 1.08770, 1.08720, 1.08820, 'Ecobank France EUR rate'),
    (today_date, 'EUR/USD', citi_ci_id, 1.08790, 1.08740, 1.08840, 'Citi Bank CI EUR rate'),
    (today_date, 'EUR/USD', citi_ae_id, 1.08785, 1.08735, 1.08835, 'Citi Bank Dubai EUR rate'),
    (today_date, 'EUR/USD', scb_ae_id, 1.08795, 1.08745, 1.08845, 'Standard Chartered EUR rate')
  ON CONFLICT (rate_date, currency_pair, source_id) DO UPDATE SET
    rate = EXCLUDED.rate,
    bid_rate = EXCLUDED.bid_rate,
    ask_rate = EXCLUDED.ask_rate,
    notes = EXCLUDED.notes;

  -- Calculate and insert spreads
  UPDATE fx_rates_daily
  SET spread = ask_rate - bid_rate
  WHERE rate_date = today_date AND spread IS NULL AND bid_rate IS NOT NULL AND ask_rate IS NOT NULL;

END $$;
