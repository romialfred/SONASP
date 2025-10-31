/*
  Insert Bank Accounts for All Customers

  This script creates bank account records for each customer with realistic
  international banking information based on their country.
*/

-- ============================================================================
-- CLEAR EXISTING BANK ACCOUNTS (Optional - Remove if you want to keep existing)
-- ============================================================================

-- Uncomment the line below to clear all existing customer banks
-- DELETE FROM customer_banks;

-- ============================================================================
-- INSERT BANK ACCOUNTS FOR EACH CUSTOMER
-- ============================================================================

-- Auramet International (United States)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'JPMorgan Chase Bank, N.A.',
  'United States',
  'New York',
  'US-123456789012',
  'US89370400440532013000',
  'CHASUS33XXX',
  'USD',
  true,
  true
FROM customers WHERE name = 'Auramet International' AND country = 'United States';

-- Secondary account for Auramet (EUR)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'Bank of America, N.A.',
  'United States',
  'New York',
  'US-987654321098',
  'US89370400440532013001',
  'BOFAUS3NXXX',
  'EUR',
  false,
  true
FROM customers WHERE name = 'Auramet International' AND country = 'United States';

-- StoneX Group (United States)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'Wells Fargo Bank, N.A.',
  'United States',
  'San Francisco',
  'US-234567890123',
  'US89121000248230011234',
  'WFBIUS6SXXX',
  'USD',
  true,
  true
FROM customers WHERE name = 'StoneX Group' AND country = 'United States';

-- Secondary account for StoneX (GBP)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'Citibank N.A.',
  'United States',
  'New York',
  'US-345678901234',
  'US89370400440532013002',
  'CITIUS33XXX',
  'GBP',
  false,
  true
FROM customers WHERE name = 'StoneX Group' AND country = 'United States';

-- Emirates Gold (United Arab Emirates)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'Emirates NBD Bank PJSC',
  'United Arab Emirates',
  'Dubai',
  'AE-456789012345',
  'AE070331234567890123456',
  'EBILAEAD',
  'USD',
  true,
  true
FROM customers WHERE name = 'Emirates Gold' AND country = 'United Arab Emirates';

-- Secondary account for Emirates Gold (AED)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'Mashreq Bank PSC',
  'United Arab Emirates',
  'Dubai',
  'AE-567890123456',
  'AE070331234567890123457',
  'BOMLAEAD',
  'AED',
  false,
  true
FROM customers WHERE name = 'Emirates Gold' AND country = 'United Arab Emirates';

-- China Gold International (China)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'Industrial and Commercial Bank of China (ICBC)',
  'China',
  'Beijing',
  'CN-678901234567',
  NULL,  -- China doesn't use IBAN
  'ICBKCNBJBJM',
  'USD',
  true,
  true
FROM customers WHERE name = 'China Gold International' AND country = 'China';

-- Secondary account for China Gold (CNY)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'Bank of China',
  'China',
  'Beijing',
  'CN-789012345678',
  NULL,  -- China doesn't use IBAN
  'BKCHCNBJ',
  'CNY',
  false,
  true
FROM customers WHERE name = 'China Gold International' AND country = 'China';

-- Swiss Gold Traders (Switzerland)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'UBS Switzerland AG',
  'Switzerland',
  'Zurich',
  'CH-890123456789',
  'CH9300762011623852957',
  'UBSWCHZH80A',
  'CHF',
  true,
  true
FROM customers WHERE name = 'Swiss Gold Traders' AND country = 'Switzerland';

-- Secondary account for Swiss Gold (USD)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'Credit Suisse',
  'Switzerland',
  'Zurich',
  'CH-901234567890',
  'CH9300762011623852958',
  'CRESCHZZ80A',
  'USD',
  false,
  true
FROM customers WHERE name = 'Swiss Gold Traders' AND country = 'Switzerland';

-- London Bullion Market (United Kingdom)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'HSBC Bank plc',
  'United Kingdom',
  'London',
  'GB-012345678901',
  'GB29NWBK60161331926819',
  'HBUKGB4B',
  'GBP',
  true,
  true
FROM customers WHERE name = 'London Bullion Market' AND country = 'United Kingdom';

-- Secondary account for London Bullion (USD)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'Barclays Bank PLC',
  'United Kingdom',
  'London',
  'GB-123456789012',
  'GB29NWBK60161331926820',
  'BARCGB22',
  'USD',
  false,
  true
FROM customers WHERE name = 'London Bullion Market' AND country = 'United Kingdom';

-- Metalor Technologies (Switzerland)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'Banque Cantonale Vaudoise',
  'Switzerland',
  'Lausanne',
  'CH-234567890123',
  'CH9300762011623852959',
  'BCVLCH2LXXX',
  'CHF',
  true,
  true
FROM customers WHERE name = 'Metalor Technologies' AND country = 'Switzerland';

-- Secondary account for Metalor (EUR)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'Julius Baer',
  'Switzerland',
  'Zurich',
  'CH-345678901234',
  'CH9300762011623852960',
  'BAERCHZZ',
  'EUR',
  false,
  true
FROM customers WHERE name = 'Metalor Technologies' AND country = 'Switzerland';

-- Valcambi SA (Switzerland)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'PostFinance',
  'Switzerland',
  'Bern',
  'CH-456789012345',
  'CH9300762011623852961',
  'POFICHBEXXX',
  'CHF',
  true,
  true
FROM customers WHERE name = 'Valcambi SA' AND country = 'Switzerland';

-- ============================================================================
-- MANSA INTERNAL (for internal sales)
-- ============================================================================

-- Mansa Resources (Guinea)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'Société Générale Guinée',
  'Guinea',
  'Conakry',
  'GN-567890123456',
  NULL,  -- Guinea may not use IBAN
  'SOGEGGCX',
  'GNF',
  true,
  true
FROM customers WHERE name = 'Mansa Resources' AND country = 'Guinea';

-- Secondary account for Mansa (USD for international)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'Ecobank Guinea',
  'Guinea',
  'Conakry',
  'GN-678901234567',
  NULL,
  'ECOCZZZZ',
  'USD',
  false,
  true
FROM customers WHERE name = 'Mansa Resources' AND country = 'Guinea';

-- ============================================================================
-- ADDITIONAL INTERNATIONAL CUSTOMERS
-- ============================================================================

-- Perth Mint (Australia)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'Commonwealth Bank of Australia',
  'Australia',
  'Perth',
  'AU-789012345678',
  NULL,  -- Australia doesn't use IBAN
  'CTBAAU2S',
  'AUD',
  true,
  true
FROM customers WHERE name LIKE '%Perth Mint%';

-- Reserve Bank of India (India)
INSERT INTO customer_banks (customer_id, bank_name, country, city, account_number, iban, swift_code, currency, is_primary, is_active)
SELECT
  id,
  'State Bank of India',
  'India',
  'Mumbai',
  'IN-890123456789',
  NULL,  -- India doesn't use IBAN
  'SBININBB',
  'USD',
  true,
  true
FROM customers WHERE name LIKE '%Reserve Bank%' AND country = 'India';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Run this to verify all banks were inserted correctly
SELECT
  c.name as customer_name,
  c.country,
  cb.bank_name,
  cb.city as bank_city,
  cb.currency,
  cb.is_primary,
  cb.swift_code
FROM customer_banks cb
JOIN customers c ON cb.customer_id = c.id
ORDER BY c.name, cb.is_primary DESC, cb.currency;

-- ============================================================================
-- COUNT BY CUSTOMER
-- ============================================================================

SELECT
  c.name as customer_name,
  COUNT(cb.id) as bank_accounts_count,
  STRING_AGG(cb.currency, ', ' ORDER BY cb.is_primary DESC) as currencies
FROM customers c
LEFT JOIN customer_banks cb ON c.customer_id = cb.customer_id
GROUP BY c.id, c.name
ORDER BY c.name;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Customer Bank Accounts Inserted';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Bank accounts created for all customers';
  RAISE NOTICE 'Each customer has 1-2 bank accounts';
  RAISE NOTICE 'Primary account in their local/preferred currency';
  RAISE NOTICE 'Secondary account in USD or major currency';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Run the verification queries above to check results';
END $$;
