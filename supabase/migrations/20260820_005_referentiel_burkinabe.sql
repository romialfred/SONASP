-- ============================================================================
-- Référentiel burkinabè : mines, sites, raffineurs — et les contraintes qui
-- interdisaient le pays de la plateforme
--
-- Quatre résidus de l'autre exploitant subsistaient dans les tables et les
-- contraintes, invisibles depuis les écrans déjà corrigés :
--   1. `sites_country_check` n'autorisait que 'GN', 'CI' et 'ML' : le schéma
--      **interdisait** d'enregistrer un site burkinabè ;
--   2. les dix sites — Conakry, Kouroussa, Siguiri, Dugbe, Yanfollia, Bamako,
--      Abidjan — dont pas un seul ne se trouvait au Burkina ;
--   3. les abréviations des sociétés (KGM = Kourousa Guinea Mining,
--      DGB = Dugbe au Liberia, MAN = Mansa) ;
--   4. le nom de la SONASP, « Substances Naturelles » au lieu de
--      « Substances Précieuses ».
--
-- Deux autres contraintes bloquaient des évolutions déjà faites côté écran :
--   • `fx_rates_daily_currency_pair_check` acceptait USD/GNF, EUR/GNF et
--     XOF/GNF mais **pas EUR/XOF**, la paire que les écrans de marché suivent
--     désormais ;
--   • `sales_seller_type_check` n'admettait que 'mining_company' et
--     'mansa_ressources' : la SONASP, vendeur de cette plateforme, n'avait pas
--     de valeur pour se désigner.
--
-- Quatre mines industrielles burkinabè rejoignent Boungou et Wahgnion.
--
-- Les anciens sites partent avant la nouvelle contrainte : PostgreSQL valide
-- l'existant à la pose de la règle. Aucune ligne ne les référençait
-- (`receiving_records` et `user_site_assignments` sont vides).
--
-- Retour arrière : les listes de valeurs autorisées et les anciens sites sont
-- reconstituables depuis ce fichier ; les mines ajoutées se suppriment par leur
-- code (ESK, HGO, SGO, BGO).
-- ============================================================================

-- 1. Sites -------------------------------------------------------------------
DELETE FROM sites;

ALTER TABLE sites DROP CONSTRAINT sites_country_check;
ALTER TABLE sites ADD CONSTRAINT sites_country_check
  CHECK (country = ANY (ARRAY['BF', 'CI', 'GH', 'TG', 'ML', 'NE', 'SN', 'BJ']));

INSERT INTO sites (name, site_type, country, address, is_active) VALUES
  ('Aéroport international de Ouagadougou', 'airport', 'BF', 'Ouagadougou, Kadiogo', true),
  ('Aéroport international de Bobo-Dioulasso', 'airport', 'BF', 'Bobo-Dioulasso, Houet', true),
  ('Coffre national SONASP — Ouagadougou', 'factory', 'BF', 'Ouagadougou, Kadiogo', true),
  ('Mine de Boungou', 'factory', 'BF', 'Partiaga, Tapoa', true),
  ('Mine de Wahgnion', 'factory', 'BF', 'Niankorodougou, Léraba', true),
  ('Mine d''Essakane', 'factory', 'BF', 'Gorom-Gorom, Oudalan', true),
  ('Mine de Houndé', 'factory', 'BF', 'Houndé, Tuy', true),
  ('Mine de Sanbrado', 'factory', 'BF', 'Boudry, Ganzourgou', true),
  ('Mine de Bomboré', 'factory', 'BF', 'Mogtédo, Ganzourgou', true);

-- 2. Paires de change et type de vendeur -------------------------------------
ALTER TABLE fx_rates_daily DROP CONSTRAINT fx_rates_daily_currency_pair_check;
ALTER TABLE fx_rates_daily ADD CONSTRAINT fx_rates_daily_currency_pair_check
  CHECK (currency_pair = ANY (ARRAY[
    'EUR/USD', 'USD/XOF', 'EUR/XOF',
    'USD/GNF', 'EUR/GNF', 'XOF/GNF'
  ]));

ALTER TABLE sales DROP CONSTRAINT sales_seller_type_check;
ALTER TABLE sales ADD CONSTRAINT sales_seller_type_check
  CHECK (seller_type = ANY (ARRAY['sonasp', 'mining_company']));

-- 3. Abréviations et raison sociale ------------------------------------------
UPDATE mining_companies SET abbreviation = 'BGM' WHERE code = 'SBM';
UPDATE mining_companies SET abbreviation = 'WGM' WHERE code = 'WGM';
UPDATE mining_companies SET abbreviation = 'SPM' WHERE code = 'SOPAMIB';
UPDATE mining_companies
SET name = 'Société Nationale des Substances Précieuses', abbreviation = 'SONASP'
WHERE code = 'SONASP';

-- 4. Mines industrielles burkinabè -------------------------------------------
INSERT INTO mining_companies
  (name, code, abbreviation, company_type, country, region, province, localite, default_currency, is_active, notes)
VALUES
  ('Essakane SA', 'ESK', 'ESK', 'production_mine', 'Burkina Faso',
   'Sahel', 'Oudalan', 'Gorom-Gorom', 'XOF', true, 'Mine à ciel ouvert, région du Sahel.'),
  ('Houndé Gold Operation SA', 'HGO', 'HGO', 'production_mine', 'Burkina Faso',
   'Hauts-Bassins', 'Tuy', 'Houndé', 'XOF', true, 'Mine à ciel ouvert, région des Hauts-Bassins.'),
  ('Sanbrado Gold Operations SA', 'SGO', 'SGO', 'production_mine', 'Burkina Faso',
   'Plateau-Central', 'Ganzourgou', 'Boudry', 'XOF', true, 'Exploitation souterraine et ciel ouvert.'),
  ('Bomboré Gold Operations SA', 'BGO', 'BGO', 'production_mine', 'Burkina Faso',
   'Plateau-Central', 'Ganzourgou', 'Mogtédo', 'XOF', true, 'Mine à ciel ouvert, minerai oxydé.')
ON CONFLICT DO NOTHING;

-- 5. Raffineurs habilités ----------------------------------------------------
-- Trois affineurs de la liste Good Delivery rejoignent Rand Refinery : la
-- SONASP vend hors du Burkina, elle a besoin de plus d'un débouché.
INSERT INTO refineries_approved
  (refinery_name, refinery_location, address_line1, city, country, certification_number,
   is_approved, approval_date, max_monthly_capacity_oz, average_processing_days, notes)
VALUES
  ('Metalor Technologies SA', 'Neuchâtel', 'Avenue du Vignoble 2', 'Marin-Epagnier', 'Suisse',
   'LBMA-GD-METALOR', true, '2026-01-15', 120000, 12, 'Affineur agréé LBMA Good Delivery.'),
  ('Valcambi SA', 'Tessin', 'Via Passeggiata', 'Balerna', 'Suisse',
   'LBMA-GD-VALCAMBI', true, '2026-01-15', 150000, 10, 'Affineur agréé LBMA Good Delivery.'),
  ('Argor-Heraeus SA', 'Tessin', 'Via Moree 14', 'Mendrisio', 'Suisse',
   'LBMA-GD-ARGOR', true, '2026-02-02', 100000, 14, 'Affineur agréé LBMA Good Delivery.')
ON CONFLICT DO NOTHING;

-- 6. Le client d'un autre exploitant, sans vente rattachée, est désactivé -----
UPDATE customers
SET is_active = false, status = 'inactive'
WHERE name ILIKE '%mansa%'
  AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.customer_id = customers.id);
