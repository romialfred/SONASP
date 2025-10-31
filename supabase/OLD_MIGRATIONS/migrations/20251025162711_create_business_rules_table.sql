/*
  # Create Business Rules Configuration Table

  1. New Tables
    - `business_rules`
      - `id` (uuid, primary key)
      - `rule_key` (text, unique) - Unique identifier for the rule
      - `rule_name` (text) - Display name for the rule
      - `rule_value` (numeric) - Numeric value for the rule
      - `rule_category` (text) - Category (conversions, thresholds)
      - `description` (text) - Description of the rule
      - `unit` (text) - Unit of measurement if applicable
      - `updated_at` (timestamptz) - Last update timestamp
      - `updated_by` (uuid) - User who last updated (foreign key to user_profiles)

  2. Security
    - Enable RLS on `business_rules` table
    - Add policy for all authenticated users to read
    - Add policy for management role to update

  3. Initial Data
    - Conversion rates (grams to ounces, kg to ounces)
    - Variance thresholds (Mine to Airport, Airport to Refinery)
*/

CREATE TABLE IF NOT EXISTS business_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text UNIQUE NOT NULL,
  rule_name text NOT NULL,
  rule_value numeric NOT NULL,
  rule_category text NOT NULL,
  description text,
  unit text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES user_profiles(id)
);

ALTER TABLE business_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read business rules"
  ON business_rules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can update business rules"
  ON business_rules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can insert business rules"
  ON business_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM business_rules WHERE rule_key = 'grams_to_ounces') THEN
    INSERT INTO business_rules (rule_key, rule_name, rule_value, rule_category, description, unit)
    VALUES
      ('grams_to_ounces', 'Grams to Ounces Conversion', 31.1035, 'conversion', 'Standard conversion rate: 1 troy ounce = 31.1035 grams', 'grams per ounce'),
      ('kg_to_ounces', 'Kilograms to Ounces Conversion', 32.1507, 'conversion', 'Standard conversion rate: 1 kg = 32.1507 troy ounces', 'ounces per kg'),
      ('var_threshold_mine_airport', 'Variance Threshold: Mine to Airport', 2.0, 'threshold', 'Maximum acceptable variance percentage between Mine and Airport weights', '%'),
      ('var_threshold_airport_refinery', 'Variance Threshold: Airport to Refinery', 1.5, 'threshold', 'Maximum acceptable variance percentage between Airport and Refinery weights', '%'),
      ('var_threshold_refining_loss', 'Variance Threshold: Refining Loss', 5.0, 'threshold', 'Maximum acceptable weight loss percentage during refining process', '%');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_business_rules_category ON business_rules(rule_category);
CREATE INDEX IF NOT EXISTS idx_business_rules_key ON business_rules(rule_key);

CREATE OR REPLACE FUNCTION update_business_rule_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_business_rule_timestamp ON business_rules;
CREATE TRIGGER set_business_rule_timestamp
  BEFORE UPDATE ON business_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_business_rule_timestamp();
