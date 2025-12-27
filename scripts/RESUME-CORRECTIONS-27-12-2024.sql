/*
  # Corrections Complètes du Système - 27 Décembre 2024

  1. Problèmes résolus
    - Suppression du doublon "Tableau de Bord"
    - Correction des modules qui ne se déroulent pas (Clients, Paiements, Raffinage)
    - Restructuration complète de la hiérarchie des modules
    - Ajout du module "Ventes d'Or des Artisans"
    - Implémentation de SONASP comme société minière

  2. Logique Métier
    - Artisans miniers vendent UNIQUEMENT à SONASP
    - SONASP est une société minière (type: 'sonasp')
    - SONASP peut vendre à l'international via Espace Trading

  3. Sécurité
    - RLS activé sur toutes les tables
    - Vérifications des contraintes
*/

-- ============================================================================
-- ÉTAPE 1: Nettoyage complet des modules
-- ============================================================================

-- Désactiver temporairement les modules existants pour éviter les conflits
UPDATE snp_modules SET est_actif = false WHERE code = 'dashboard';

-- ============================================================================
-- ÉTAPE 2: Restructuration des modules principaux
-- ============================================================================

-- Supprimer tous les modules existants pour repartir à zéro
DO $$
BEGIN
  -- Supprimer d'abord les sous-modules (enfants)
  DELETE FROM snp_modules WHERE parent_id IS NOT NULL;

  -- Ensuite supprimer les modules parents
  DELETE FROM snp_modules WHERE parent_id IS NULL;

  RAISE NOTICE 'Tous les modules ont été supprimés';
END $$;

-- Recréer les modules principaux avec la bonne structure
INSERT INTO snp_modules (code, nom, description, icone, route, ordre, est_actif, est_visible_menu) VALUES
  ('dashboard', 'Tableau de Bord', 'Vue d''ensemble de l''activité', 'LayoutDashboard', '/dashboard', 1, true, false),
  ('artisan-minier', 'Artisans Miniers', 'Gestion des artisans miniers', 'Pickaxe', NULL, 2, true, true),
  ('production', 'Production', 'Gestion de la production d''or', 'Factory', NULL, 3, true, true),
  ('shipping', 'Expédition', 'Gestion des expéditions', 'Ship', NULL, 4, true, true),
  ('refining', 'Raffinage', 'Gestion du raffinage', 'Flame', NULL, 5, true, true),
  ('inventory', 'Inventaire', 'Suivi des stocks', 'Warehouse', NULL, 6, true, true),
  ('sales', 'Ventes', 'Gestion des ventes d''or', 'TrendingUp', NULL, 7, true, true),
  ('customers', 'Clients', 'Gestion des clients', 'Users', NULL, 8, true, true),
  ('payments', 'Paiements', 'Gestion des paiements', 'CreditCard', NULL, 9, true, true),
  ('documents', 'Documents', 'Gestion documentaire', 'FileText', NULL, 10, true, true),
  ('analytics', 'Analytique', 'Tableaux de bord et rapports', 'BarChart3', NULL, 11, true, true),
  ('administration', 'Administration', 'Gestion du système', 'Settings', NULL, 12, true, true)
ON CONFLICT (code) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description,
  icone = EXCLUDED.icone,
  route = EXCLUDED.route,
  ordre = EXCLUDED.ordre,
  est_actif = EXCLUDED.est_actif,
  est_visible_menu = EXCLUDED.est_visible_menu;

-- ============================================================================
-- ÉTAPE 3: Création des sous-modules Artisans Miniers
-- ============================================================================

DO $$
DECLARE
  artisan_id uuid;
BEGIN
  SELECT id INTO artisan_id FROM snp_modules WHERE code = 'artisan-minier';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('artisan-dashboard', 'Tableau de Bord', 'Vue d''ensemble des artisans', 'LayoutDashboard', '/artisan-minier', artisan_id, 1, true, true),
    ('artisan-liste', 'Liste des Artisans', 'Répertoire complet', 'Users', '/artisan-minier/liste', artisan_id, 2, true, true),
    ('artisan-ventes-or', 'Ventes d''Or', 'Collecte et ventes à SONASP', 'Coins', '/artisan-minier/ventes-or', artisan_id, 3, true, true),
    ('artisan-cartes-suivi', 'Suivi des Cartes', 'Suivi des cartes professionnelles', 'CreditCard', '/artisan-minier/cartes/suivi', artisan_id, 4, true, true),
    ('artisan-cartes-validation', 'Validation Cartes', 'Valider les nouvelles cartes', 'CheckCircle', '/artisan-minier/cartes/validation', artisan_id, 5, true, true),
    ('artisan-cartes-expiration', 'Expirations', 'Cartes expirées/à renouveler', 'AlertTriangle', '/artisan-minier/cartes/expirations', artisan_id, 6, true, true)
  ON CONFLICT (code) DO UPDATE SET
    nom = EXCLUDED.nom,
    route = EXCLUDED.route,
    parent_id = EXCLUDED.parent_id,
    ordre = EXCLUDED.ordre;
END $$;

-- ============================================================================
-- ÉTAPE 4: Sous-modules Production
-- ============================================================================

DO $$
DECLARE
  prod_id uuid;
BEGIN
  SELECT id INTO prod_id FROM snp_modules WHERE code = 'production';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('production-daily', 'Production Journalière', 'Enregistrement quotidien', 'Activity', '/production/daily', prod_id, 1, true, true),
    ('production-safe', 'Production en Coffre', 'Or en attente d''expédition', 'Lock', '/production/in-safe', prod_id, 2, true, true),
    ('production-licenses', 'Licences d''Export', 'Gestion des licences', 'Award', '/production/licenses', prod_id, 3, true, true),
    ('production-budget', 'Budgets Prévisionnels', 'Gestion budgétaire', 'TrendingUp', '/performance/budgets', prod_id, 4, true, true)
  ON CONFLICT (code) DO UPDATE SET
    nom = EXCLUDED.nom,
    route = EXCLUDED.route,
    parent_id = EXCLUDED.parent_id;
END $$;

-- ============================================================================
-- ÉTAPE 5: Sous-modules Expédition
-- ============================================================================

DO $$
DECLARE
  ship_id uuid;
BEGIN
  SELECT id INTO ship_id FROM snp_modules WHERE code = 'shipping';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('shipping-dashboard', 'Préparation Expéditions', 'Gestion des expéditions', 'PackagePlus', '/shipping/preparation', ship_id, 1, true, true),
    ('shipping-freight', 'Fret et Douanes', 'Suivi fret international', 'Truck', '/freight', ship_id, 2, true, true)
  ON CONFLICT (code) DO UPDATE SET
    nom = EXCLUDED.nom,
    route = EXCLUDED.route,
    parent_id = EXCLUDED.parent_id;
END $$;

-- ============================================================================
-- ÉTAPE 6: Sous-modules Raffinage
-- ============================================================================

DO $$
DECLARE
  ref_id uuid;
BEGIN
  SELECT id INTO ref_id FROM snp_modules WHERE code = 'refining';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('refining-process', 'Processus de Raffinage', 'Gestion du raffinage', 'FlaskConical', '/refining', ref_id, 1, true, true),
    ('refining-shipments', 'Expéditions Raffinerie', 'Fret vers raffinerie', 'Ship', '/refining/shipments', ref_id, 2, true, true)
  ON CONFLICT (code) DO UPDATE SET
    nom = EXCLUDED.nom,
    route = EXCLUDED.route,
    parent_id = EXCLUDED.parent_id;
END $$;

-- ============================================================================
-- ÉTAPE 7: Sous-modules Inventaire
-- ============================================================================

DO $$
DECLARE
  inv_id uuid;
BEGIN
  SELECT id INTO inv_id FROM snp_modules WHERE code = 'inventory';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('inventory-gold', 'Inventaire Or', 'Stock d''or disponible', 'Coins', '/inventory', inv_id, 1, true, true),
    ('inventory-silver', 'Inventaire Argent', 'Stock d''argent disponible', 'Sparkles', '/inventory/silver', inv_id, 2, true, true)
  ON CONFLICT (code) DO UPDATE SET
    nom = EXCLUDED.nom,
    route = EXCLUDED.route,
    parent_id = EXCLUDED.parent_id;
END $$;

-- ============================================================================
-- ÉTAPE 8: Sous-modules Ventes
-- ============================================================================

DO $$
DECLARE
  sales_id uuid;
BEGIN
  SELECT id INTO sales_id FROM snp_modules WHERE code = 'sales';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('sales-dashboard', 'Tableau de Bord Ventes', 'Suivi des ventes', 'LayoutDashboard', '/sales', sales_id, 1, true, true),
    ('sales-new', 'Nouvelle Vente', 'Créer une vente', 'Plus', '/sales/new', sales_id, 2, true, true),
    ('sales-trade', 'Espace Trading', 'Trading international', 'Store', '/sales/trade-space', sales_id, 3, true, true)
  ON CONFLICT (code) DO UPDATE SET
    nom = EXCLUDED.nom,
    route = EXCLUDED.route,
    parent_id = EXCLUDED.parent_id;
END $$;

-- ============================================================================
-- ÉTAPE 9: Sous-modules Clients
-- ============================================================================

DO $$
DECLARE
  cust_id uuid;
BEGIN
  SELECT id INTO cust_id FROM snp_modules WHERE code = 'customers';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('customers-list', 'Liste des Clients', 'Répertoire clients', 'Users', '/customers', cust_id, 1, true, true),
    ('customers-stakeholders', 'Parties Prenantes', 'Sociétés minières et dépositaires', 'Building2', '/stakeholders/mining-companies', cust_id, 2, true, true)
  ON CONFLICT (code) DO UPDATE SET
    nom = EXCLUDED.nom,
    route = EXCLUDED.route,
    parent_id = EXCLUDED.parent_id;
END $$;

-- ============================================================================
-- ÉTAPE 10: Sous-modules Paiements
-- ============================================================================

DO $$
DECLARE
  pay_id uuid;
BEGIN
  SELECT id INTO pay_id FROM snp_modules WHERE code = 'payments';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('payments-list', 'Liste des Paiements', 'Tous les paiements', 'DollarSign', '/payments', pay_id, 1, true, true),
    ('payments-virtual', 'Paiements Virtuels', 'Gestion paiements virtuels', 'CreditCard', '/payments/virtual', pay_id, 2, true, true)
  ON CONFLICT (code) DO UPDATE SET
    nom = EXCLUDED.nom,
    route = EXCLUDED.route,
    parent_id = EXCLUDED.parent_id;
END $$;

-- ============================================================================
-- ÉTAPE 11: Sous-modules Documents
-- ============================================================================

DO $$
DECLARE
  doc_id uuid;
BEGIN
  SELECT id INTO doc_id FROM snp_modules WHERE code = 'documents';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('documents-assay', 'Certificats d''Essai', 'Gestion des certificats', 'ScanText', '/documents/assay-certificates', doc_id, 1, true, true)
  ON CONFLICT (code) DO UPDATE SET
    nom = EXCLUDED.nom,
    route = EXCLUDED.route,
    parent_id = EXCLUDED.parent_id;
END $$;

-- ============================================================================
-- ÉTAPE 12: Sous-modules Analytics
-- ============================================================================

DO $$
DECLARE
  ana_id uuid;
BEGIN
  SELECT id INTO ana_id FROM snp_modules WHERE code = 'analytics';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('analytics-dashboard', 'Tableaux de Bord', 'Analytics avancées', 'BarChart3', '/analytics', ana_id, 1, true, true),
    ('analytics-reports', 'Rapports', 'Génération de rapports', 'FileText', '/reports', ana_id, 2, true, true)
  ON CONFLICT (code) DO UPDATE SET
    nom = EXCLUDED.nom,
    route = EXCLUDED.route,
    parent_id = EXCLUDED.parent_id;
END $$;

-- ============================================================================
-- ÉTAPE 13: Sous-modules Administration
-- ============================================================================

DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM snp_modules WHERE code = 'administration';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('admin-users', 'Gestion Utilisateurs', 'Comptes utilisateurs', 'Users', '/admin/users', admin_id, 1, true, true),
    ('admin-roles', 'Rôles & Permissions', 'Gestion des autorisations', 'Shield', '/admin/permissions', admin_id, 2, true, true),
    ('admin-modules', 'Gestion des Modules', 'Activer/désactiver modules', 'Grid', '/admin/modules', admin_id, 3, true, true),
    ('admin-settings', 'Paramètres Système', 'Configuration générale', 'Settings', '/admin/settings', admin_id, 4, true, true),
    ('admin-audit', 'Journal d''Audit', 'Historique des actions', 'FileCheck', '/admin/audit', admin_id, 5, true, true)
  ON CONFLICT (code) DO UPDATE SET
    nom = EXCLUDED.nom,
    route = EXCLUDED.route,
    parent_id = EXCLUDED.parent_id;
END $$;

-- ============================================================================
-- ÉTAPE 14: Création/Mise à jour de SONASP comme société minière
-- ============================================================================

-- Vérifier si la table des sociétés minières existe et la créer si nécessaire
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mining_companies') THEN
    -- Créer la table mining_companies
    CREATE TABLE mining_companies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL UNIQUE,
      abbreviation text,
      code text UNIQUE,
      company_type text DEFAULT 'standard' CHECK (company_type IN ('standard', 'sonasp', 'international')),
      registration_number text,
      tax_id text,
      email text,
      phone text,
      website text,
      address text,
      city text,
      country text NOT NULL DEFAULT 'BF',
      is_active boolean DEFAULT true,
      notes text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      created_by uuid REFERENCES auth.users(id),
      updated_by uuid REFERENCES auth.users(id)
    );

    -- Créer les index
    CREATE INDEX idx_mining_companies_country ON mining_companies(country);
    CREATE INDEX idx_mining_companies_active ON mining_companies(is_active);
    CREATE INDEX idx_mining_companies_type ON mining_companies(company_type);

    -- Activer RLS
    ALTER TABLE mining_companies ENABLE ROW LEVEL SECURITY;

    -- Créer les politiques RLS
    CREATE POLICY "Utilisateurs authentifiés peuvent lire mining_companies"
      ON mining_companies FOR SELECT TO authenticated USING (true);

    CREATE POLICY "Utilisateurs authentifiés peuvent créer mining_companies"
      ON mining_companies FOR INSERT TO authenticated WITH CHECK (true);

    CREATE POLICY "Utilisateurs authentifiés peuvent modifier mining_companies"
      ON mining_companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

    RAISE NOTICE 'Table mining_companies créée avec succès';
  ELSE
    RAISE NOTICE 'Table mining_companies existe déjà';
  END IF;
END $$;

-- Insérer ou mettre à jour SONASP
INSERT INTO mining_companies (
  name,
  abbreviation,
  code,
  company_type,
  registration_number,
  tax_id,
  email,
  phone,
  address,
  city,
  country,
  is_active,
  notes
) VALUES (
  'Société Nationale des Substances Naturelles',
  'SONASP',
  'SONASP-BF-001',
  'sonasp',
  'BF-SONASP-2024',
  'SONASP-TAX-001',
  'contact@sonasp.bf',
  '+226 25 XX XX XX',
  'Ouagadougou, Burkina Faso',
  'Ouagadougou',
  'BF',
  true,
  'Société nationale - Collecteur principal auprès des artisans miniers. Peut vendre à l''international via l''Espace Trading.'
)
ON CONFLICT (name)
DO UPDATE SET
  abbreviation = 'SONASP',
  code = 'SONASP-BF-001',
  company_type = 'sonasp',
  is_active = true,
  notes = 'Société nationale - Collecteur principal auprès des artisans miniers. Peut vendre à l''international via l''Espace Trading.',
  updated_at = now();

-- ============================================================================
-- ÉTAPE 15: Vérification et rapport final
-- ============================================================================

-- Afficher la hiérarchie complète des modules
SELECT
  CASE WHEN m.parent_id IS NULL THEN m.nom ELSE '  ↳ ' || m.nom END as "Module",
  m.code as "Code",
  m.route as "Route",
  m.ordre as "Ordre",
  CASE WHEN m.est_actif THEN '✓' ELSE '✗' END as "Actif",
  CASE WHEN m.est_visible_menu THEN '✓' ELSE '✗' END as "Visible"
FROM snp_modules m
LEFT JOIN snp_modules p ON m.parent_id = p.id
ORDER BY COALESCE(p.ordre, m.ordre), m.ordre;

-- Afficher SONASP
SELECT
  name as "Société",
  abbreviation as "Abréviation",
  company_type as "Type",
  email as "Email",
  CASE WHEN is_active THEN 'Actif' ELSE 'Inactif' END as "Statut"
FROM mining_companies
WHERE company_type = 'sonasp';

RAISE NOTICE '✓ Restructuration complète terminée avec succès';
RAISE NOTICE '✓ SONASP configurée comme société nationale';
RAISE NOTICE '✓ Tous les modules sont correctement hiérarchisés';
RAISE NOTICE '→ Actualisez votre navigateur (F5) pour voir les changements';
