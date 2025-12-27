-- ============================================================================
-- SCRIPT SQL: Création du Système de Gestion des Modules
-- Table: snp_modules
-- Date: 2025-01-27
-- ============================================================================
--
-- Ce script crée le système complet de gestion des modules permettant
-- d'activer/désactiver dynamiquement les fonctionnalités de l'application
--
-- IMPORTANT: Ce script doit être exécuté dans Supabase SQL Editor
--
-- ============================================================================

/*
  # Système de Gestion des Modules

  1. Tables créées
    - `snp_modules` : Table principale des modules de l'application

  2. Colonnes
    - `id` (uuid, primary key)
    - `code` (text, unique) : Code unique du module
    - `nom` (text) : Nom du module
    - `description` (text) : Description du module
    - `icone` (text) : Nom de l'icône Lucide React
    - `route` (text) : Route principale du module
    - `parent_id` (uuid, nullable) : Référence au module parent pour les sous-modules
    - `ordre` (integer) : Ordre d'affichage dans le menu
    - `est_actif` (boolean) : Indique si le module est actif
    - `est_visible_menu` (boolean) : Indique si le module apparaît dans le menu
    - `permissions_requises` (text[]) : Liste des permissions requises
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  3. Sécurité
    - Active RLS sur `snp_modules`
    - Politiques pour lecture (tous les utilisateurs authentifiés)
    - Politiques pour modification (administrateurs uniquement)
*/

-- Créer la table des modules
CREATE TABLE IF NOT EXISTS snp_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  nom text NOT NULL,
  description text,
  icone text,
  route text,
  parent_id uuid REFERENCES snp_modules(id) ON DELETE SET NULL,
  ordre integer DEFAULT 0,
  est_actif boolean DEFAULT true,
  est_visible_menu boolean DEFAULT true,
  permissions_requises text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- Commentaires sur les colonnes
-- ============================================================================

COMMENT ON TABLE snp_modules IS 'Gestion des modules et sous-modules de l''application';
COMMENT ON COLUMN snp_modules.code IS 'Code unique du module (ex: dashboard, production, sales)';
COMMENT ON COLUMN snp_modules.est_actif IS 'Si false, le module est désactivé et invisible';
COMMENT ON COLUMN snp_modules.est_visible_menu IS 'Si false, le module n''apparaît pas dans le menu latéral';
COMMENT ON COLUMN snp_modules.permissions_requises IS 'Liste des permissions nécessaires pour accéder au module';

-- ============================================================================
-- Index pour optimiser les requêtes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_modules_code ON snp_modules(code);
CREATE INDEX IF NOT EXISTS idx_modules_parent ON snp_modules(parent_id);
CREATE INDEX IF NOT EXISTS idx_modules_actif ON snp_modules(est_actif);
CREATE INDEX IF NOT EXISTS idx_modules_ordre ON snp_modules(ordre);

-- ============================================================================
-- Trigger pour mettre à jour updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_module_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_module_timestamp ON snp_modules;
CREATE TRIGGER trigger_update_module_timestamp
  BEFORE UPDATE ON snp_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_module_updated_at();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE snp_modules ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes si elles existent
DROP POLICY IF EXISTS "Users can view active modules" ON snp_modules;
DROP POLICY IF EXISTS "Admins can insert modules" ON snp_modules;
DROP POLICY IF EXISTS "Admins can update modules" ON snp_modules;
DROP POLICY IF EXISTS "Admins can delete modules" ON snp_modules;

-- Politique de lecture pour tous les utilisateurs authentifiés
CREATE POLICY "Users can view active modules"
  ON snp_modules FOR SELECT
  TO authenticated
  USING (true);

-- Politique d'insertion pour administrateurs
CREATE POLICY "Admins can insert modules"
  ON snp_modules FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politique de mise à jour pour administrateurs
CREATE POLICY "Admins can update modules"
  ON snp_modules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politique de suppression pour administrateurs
CREATE POLICY "Admins can delete modules"
  ON snp_modules FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- Insertion des modules principaux existants
-- ============================================================================

INSERT INTO snp_modules (code, nom, description, icone, route, ordre, est_actif, est_visible_menu) VALUES
  ('dashboard', 'Tableau de Bord', 'Vue d''ensemble de l''activité', 'LayoutDashboard', '/dashboard', 1, true, true),
  ('production', 'Production', 'Gestion de la production d''or', 'Factory', NULL, 2, true, true),
  ('shipping', 'Expédition', 'Gestion des expéditions', 'Ship', NULL, 3, true, true),
  ('refining', 'Raffinage', 'Gestion du raffinage', 'Flame', NULL, 4, true, true),
  ('sales', 'Ventes', 'Gestion des ventes d''or', 'TrendingUp', NULL, 5, true, true),
  ('customers', 'Clients', 'Gestion des clients', 'Users', NULL, 6, true, true),
  ('payments', 'Paiements', 'Gestion des paiements', 'CreditCard', NULL, 7, true, true),
  ('artisan-minier', 'Artisans Miniers', 'Gestion des artisans miniers', 'Pickaxe', NULL, 8, true, true),
  ('analytics', 'Analytique', 'Tableaux de bord et rapports', 'BarChart3', NULL, 9, true, true),
  ('administration', 'Administration', 'Gestion du système', 'Settings', NULL, 10, true, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Sous-modules de Production
-- ============================================================================

DO $$
DECLARE
  prod_id uuid;
BEGIN
  SELECT id INTO prod_id FROM snp_modules WHERE code = 'production';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('production-daily', 'Production Journalière', 'Enregistrement production quotidienne', 'Calendar', '/production/daily', prod_id, 1, true, true),
    ('production-safe', 'Production en Coffre', 'Or en attente d''expédition', 'Lock', '/production/in-safe', prod_id, 2, true, true),
    ('production-licenses', 'Licences d''Export', 'Gestion des licences', 'FileText', '/production/licenses', prod_id, 3, true, true),
    ('production-budget', 'Budget', 'Gestion budgétaire', 'DollarSign', '/production/budget', prod_id, 4, true, true)
  ON CONFLICT (code) DO NOTHING;
END $$;

-- ============================================================================
-- Sous-modules d'Expédition
-- ============================================================================

DO $$
DECLARE
  ship_id uuid;
BEGIN
  SELECT id INTO ship_id FROM snp_modules WHERE code = 'shipping';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('shipping-dashboard', 'Tableau de Bord', 'Vue d''ensemble expéditions', 'Ship', '/shipping/dashboard', ship_id, 1, true, true),
    ('shipping-new', 'Nouvelle Expédition', 'Préparer une expédition', 'Plus', '/shipping/new', ship_id, 2, true, true),
    ('shipping-documents', 'Certificats d''Essai', 'Gestion des certificats', 'FileCheck', '/documents/assay', ship_id, 3, true, true)
  ON CONFLICT (code) DO NOTHING;
END $$;

-- ============================================================================
-- Sous-modules de Ventes
-- ============================================================================

DO $$
DECLARE
  sales_id uuid;
BEGIN
  SELECT id INTO sales_id FROM snp_modules WHERE code = 'sales';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('sales-dashboard', 'Tableau de Bord', 'Vue d''ensemble des ventes', 'TrendingUp', '/sales/dashboard', sales_id, 1, true, true),
    ('sales-new', 'Nouvelle Vente', 'Créer une vente', 'Plus', '/sales/new', sales_id, 2, true, true),
    ('sales-trade', 'Espace Trading', 'Prix et trading en direct', 'LineChart', '/sales/trade-space', sales_id, 3, true, true)
  ON CONFLICT (code) DO NOTHING;
END $$;

-- ============================================================================
-- Sous-modules d'Artisans Miniers
-- ============================================================================

DO $$
DECLARE
  artisan_id uuid;
BEGIN
  SELECT id INTO artisan_id FROM snp_modules WHERE code = 'artisan-minier';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('artisan-dashboard', 'Gestion des Artisans', 'Vue d''ensemble et gestion des artisans', 'LayoutDashboard', '/artisan-minier', artisan_id, 1, true, true),
    ('artisan-liste', 'Liste des Artisans', 'Répertoire complet', 'Users', '/artisan-minier/liste', artisan_id, 2, true, true),
    ('artisan-cartes-suivi', 'Suivi des Cartes', 'Suivi des cartes pro', 'CreditCard', '/artisan-minier/cartes/suivi', artisan_id, 3, true, true),
    ('artisan-cartes-validation', 'Validation Cartes', 'Valider les cartes', 'CheckCircle', '/artisan-minier/cartes/validation', artisan_id, 4, true, true),
    ('artisan-cartes-expiration', 'Expirations', 'Cartes expirées/à renouveler', 'AlertTriangle', '/artisan-minier/cartes/expirations', artisan_id, 5, true, true),
    ('artisan-ventes-or', 'Ventes d''Or', 'Collecte et ventes d''or des artisans', 'Coins', '/artisan-minier/ventes-or', artisan_id, 6, true, true)
  ON CONFLICT (code) DO NOTHING;
END $$;

-- ============================================================================
-- Sous-modules d'Administration
-- ============================================================================

DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM snp_modules WHERE code = 'administration';

  INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu) VALUES
    ('admin-users', 'Gestion Utilisateurs', 'Gestion des comptes utilisateurs', 'Users', '/admin/users', admin_id, 1, true, true),
    ('admin-roles', 'Rôles & Permissions', 'Gestion des autorisations', 'Shield', '/admin/permissions', admin_id, 2, true, true),
    ('admin-modules', 'Gestion des Modules', 'Activer/désactiver modules', 'Grid', '/admin/modules', admin_id, 3, true, true),
    ('admin-settings', 'Paramètres Système', 'Configuration générale', 'Settings', '/admin/settings', admin_id, 4, true, true),
    ('admin-audit', 'Journal d''Audit', 'Historique des actions', 'FileText', '/admin/audit', admin_id, 5, true, true)
  ON CONFLICT (code) DO NOTHING;
END $$;

-- ============================================================================
-- Vue pour obtenir les modules actifs avec leur hiérarchie
-- ============================================================================

CREATE OR REPLACE VIEW snp_modules_actifs AS
SELECT
  m.id,
  m.code,
  m.nom,
  m.description,
  m.icone,
  m.route,
  m.parent_id,
  p.nom as parent_nom,
  p.code as parent_code,
  m.ordre,
  m.est_actif,
  m.est_visible_menu,
  m.permissions_requises
FROM snp_modules m
LEFT JOIN snp_modules p ON m.parent_id = p.id
WHERE m.est_actif = true
ORDER BY COALESCE(p.ordre, m.ordre), m.ordre;

COMMENT ON VIEW snp_modules_actifs IS 'Vue des modules actifs avec leur hiérarchie pour l''affichage dans le menu';

-- ============================================================================
-- Fonction pour obtenir les modules d'un utilisateur
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_modules(user_id uuid)
RETURNS TABLE (
  id uuid,
  code text,
  nom text,
  description text,
  icone text,
  route text,
  parent_id uuid,
  parent_nom text,
  ordre integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.code,
    m.nom,
    m.description,
    m.icone,
    m.route,
    m.parent_id,
    p.nom as parent_nom,
    m.ordre
  FROM snp_modules m
  LEFT JOIN snp_modules p ON m.parent_id = p.id
  WHERE m.est_actif = true
    AND m.est_visible_menu = true
  ORDER BY COALESCE(p.ordre, m.ordre), m.ordre;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_modules IS 'Retourne les modules accessibles pour un utilisateur donné';
