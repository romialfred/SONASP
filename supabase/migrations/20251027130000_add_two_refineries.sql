/*
  # Add Two Additional Refineries

  1. Purpose
    - Add 2 new refineries to the platform
    - These refineries will be available in all dropdown lists
    - Reports can be filtered by refinery

  2. New Refineries
    - Kaloti Precious Metals - Dubai, UAE
    - Valcambi SA - Balerna, Switzerland

  3. Security
    - RLS policies already exist on refineries table
    - All authenticated users can view active refineries
*/

-- Insert 2 new refineries
INSERT INTO refineries (
  name,
  location,
  country,
  email,
  phone,
  contact_person,
  capacity_grams_per_month,
  is_active
) VALUES
  (
    'Kaloti Precious Metals',
    'Dubai Gold & Commodities Exchange, Dubai',
    'AE',
    'operations@kaloti.com',
    '+971-4-425-8700',
    'Ahmed Al-Mansouri',
    100000.00,
    true
  ),
  (
    'Valcambi SA',
    'Via Passeggiata 5, Balerna',
    'CH',
    'refining@valcambi.com',
    '+41-91-695-5511',
    'Marco Rossi',
    150000.00,
    true
  )
ON CONFLICT (name) DO UPDATE SET
  location = EXCLUDED.location,
  country = EXCLUDED.country,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  contact_person = EXCLUDED.contact_person,
  capacity_grams_per_month = EXCLUDED.capacity_grams_per_month,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Verify the refineries were added
DO $$
DECLARE
  v_refinery_count int;
BEGIN
  SELECT COUNT(*) INTO v_refinery_count
  FROM refineries
  WHERE is_active = true;

  RAISE NOTICE 'Total active refineries: %', v_refinery_count;

  RAISE NOTICE 'Refineries list:';
  FOR v_refinery_count IN
    SELECT name FROM refineries WHERE is_active = true ORDER BY name
  LOOP
    RAISE NOTICE '  - %', v_refinery_count;
  END LOOP;
END $$;
