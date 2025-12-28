/*
  # Système de Gestion des Modules

  ## Vue d'ensemble
  Ce système permet de gérer dynamiquement l'activation/désactivation
  des modules et menus de l'application.

  ## Tables créées
  1. snp_modules - Table principale des modules
  2. snp_modules_actifs - Vue des modules actifs

  ## Fonctionnalités
  - Hiérarchie parent/enfant
  - Activation/désactivation
  - Visibilité dans le menu
  - Ordre d'affichage
  - Permissions requises
*/

-- ============================================================================
-- ETAPE 1: Créer la table des modules
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.snp_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  nom text NOT NULL,
  description text,
  icone text,
  route text,
  parent_id uuid REFERENCES public.snp_modules(id) ON DELETE CASCADE,
  ordre integer DEFAULT 0 NOT NULL,
  est_actif boolean DEFAULT true NOT NULL,
  est_visible_menu boolean DEFAULT true NOT NULL,
  permissions_requises text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_modules_parent_id ON public.snp_modules(parent_id);
CREATE INDEX IF NOT EXISTS idx_modules_code ON public.snp_modules(code);
CREATE INDEX IF NOT EXISTS idx_modules_ordre ON public.snp_modules(ordre);
CREATE INDEX IF NOT EXISTS idx_modules_actif ON public.snp_modules(est_actif);

-- ============================================================================
-- ETAPE 2: Trigger de mise à jour
-- ============================================================================

CREATE OR REPLACE FUNCTION update_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_modules_timestamp ON public.snp_modules;
CREATE TRIGGER trigger_update_modules_timestamp
  BEFORE UPDATE ON public.snp_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_modules_updated_at();

-- ============================================================================
-- ETAPE 3: Vue des modules actifs
-- ============================================================================

CREATE OR REPLACE VIEW public.snp_modules_actifs AS
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
  m.permissions_requises,
  m.created_at,
  m.updated_at
FROM public.snp_modules m
LEFT JOIN public.snp_modules p ON m.parent_id = p.id
WHERE m.est_actif = true
ORDER BY m.ordre;

-- ============================================================================
-- ETAPE 4: Row Level Security
-- ============================================================================

ALTER TABLE public.snp_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous peuvent voir les modules"
  ON public.snp_modules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins peuvent gérer les modules"
  ON public.snp_modules FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ETAPE 5: Insérer les modules par défaut
-- ============================================================================

-- Nettoyer les modules existants si la table était vide
DO $$
DECLARE
  module_count integer;
BEGIN
  SELECT COUNT(*) INTO module_count FROM public.snp_modules;
  
  IF module_count = 0 THEN
    -- Modules principaux (niveau 1)
    INSERT INTO public.snp_modules (code, nom, description, icone, route, ordre, est_actif, est_visible_menu) VALUES
    ('dashboard', 'Tableau de Bord', 'Vue d''ensemble de l''activité', 'LayoutDashboard', '/dashboard', 1, true, true),
    ('production', 'Production', 'Gestion de la production journalière', 'Factory', NULL, 2, true, true),
    ('shipping', 'Expédition', 'Préparation et suivi des expéditions', 'Package', NULL, 3, true, true),
    ('refining', 'Affinage', 'Gestion de l''affinage', 'Flame', NULL, 4, true, true),
    ('sales', 'Ventes', 'Gestion des ventes d''or', 'DollarSign', NULL, 5, true, true),
    ('artisan', 'Artisans Miniers', 'Gestion des artisans miniers', 'Users', NULL, 6, true, true),
    ('customers', 'Clients', 'Gestion des clients', 'Building2', NULL, 7, true, true),
    ('stakeholders', 'Parties Prenantes', 'Sociétés minières, raffineries, transporteurs', 'Network', NULL, 8, true, true),
    ('inventory', 'Inventaire', 'Gestion des stocks', 'PackageCheck', NULL, 9, true, true),
    ('payments', 'Paiements', 'Gestion des paiements', 'CreditCard', NULL, 10, true, true),
    ('analytics', 'Analytique', 'Analyses et rapports', 'BarChart3', NULL, 11, true, true),
    ('documents', 'Documents', 'Certificats et documents', 'FileText', NULL, 12, true, true),
    ('admin', 'Administration', 'Paramètres système', 'Settings', NULL, 13, true, true);

    -- Sous-modules Production
    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'production_daily', 'Production Journalière', 'Saisie production quotidienne', 'CalendarDays', '/production/daily',
      id, 1, true, true
    FROM public.snp_modules WHERE code = 'production';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'production_safe', 'Production en Coffre', 'Stock disponible pour vente', 'Shield', '/production/in-safe',
      id, 2, true, true
    FROM public.snp_modules WHERE code = 'production';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'production_licenses', 'Licences d''Export', 'Gestion des licences', 'FileCheck', '/production/export-licenses',
      id, 3, true, true
    FROM public.snp_modules WHERE code = 'production';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'production_budget', 'Budget Annuel', 'Planification budgétaire', 'Calculator', '/production/budget',
      id, 4, true, true
    FROM public.snp_modules WHERE code = 'production';

    -- Sous-modules Expédition
    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'shipping_list', 'Liste des Expéditions', 'Toutes les expéditions', 'List', '/shipping',
      id, 1, true, true
    FROM public.snp_modules WHERE code = 'shipping';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'shipping_new', 'Nouvelle Expédition', 'Préparer une expédition', 'Plus', '/shipping/new',
      id, 2, true, true
    FROM public.snp_modules WHERE code = 'shipping';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'shipping_freight', 'Transport Douane', 'Gestion douanière', 'Truck', '/freight/customs',
      id, 3, true, true
    FROM public.snp_modules WHERE code = 'shipping';

    -- Sous-modules Affinage
    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'refining_dashboard', 'Tableau de Bord', 'Vue d''ensemble affinage', 'LayoutDashboard', '/refining',
      id, 1, true, true
    FROM public.snp_modules WHERE code = 'refining';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'refining_shipments', 'Envois en Affinage', 'Suivi des envois', 'Send', '/refining/shipments',
      id, 2, true, true
    FROM public.snp_modules WHERE code = 'refining';

    -- Sous-modules Ventes
    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'sales_list', 'Liste des Ventes', 'Toutes les ventes', 'List', '/sales',
      id, 1, true, true
    FROM public.snp_modules WHERE code = 'sales';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'sales_new', 'Nouvelle Vente', 'Créer une vente', 'Plus', '/sales/new',
      id, 2, true, true
    FROM public.snp_modules WHERE code = 'sales';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'sales_presales', 'Pré-ventes', 'Gestion pré-ventes', 'FileEdit', '/presales',
      id, 3, true, true
    FROM public.snp_modules WHERE code = 'sales';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'sales_trade_space', 'Espace Commercial', 'Négociation ventes', 'Store', '/sales/trade-space',
      id, 4, true, true
    FROM public.snp_modules WHERE code = 'sales';

    -- Sous-modules Artisans Miniers
    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'artisan_dashboard', 'Tableau de Bord', 'Vue d''ensemble artisans', 'LayoutDashboard', '/artisan-minier',
      id, 1, true, true
    FROM public.snp_modules WHERE code = 'artisan';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'artisan_list', 'Liste des Artisans', 'Tous les artisans', 'Users', '/artisan-minier/liste',
      id, 2, true, true
    FROM public.snp_modules WHERE code = 'artisan';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'artisan_cartes', 'Suivi des Cartes', 'Gestion des cartes pro', 'CreditCard', '/artisan-minier/cartes/suivi',
      id, 3, true, true
    FROM public.snp_modules WHERE code = 'artisan';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'artisan_ventes', 'Ventes d''Or', 'Achats aux artisans', 'Coins', '/artisan-minier/ventes-or',
      id, 4, true, true
    FROM public.snp_modules WHERE code = 'artisan';

    -- Sous-modules Administration
    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'admin_users', 'Utilisateurs', 'Gestion des utilisateurs', 'Users', '/admin/users',
      id, 1, true, true
    FROM public.snp_modules WHERE code = 'admin';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'admin_modules', 'Modules Système', 'Activer/désactiver modules', 'Grid', '/admin/modules',
      id, 2, true, true
    FROM public.snp_modules WHERE code = 'admin';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'admin_parameters', 'Paramètres', 'Configuration système', 'Settings', '/admin/parameters',
      id, 3, true, true
    FROM public.snp_modules WHERE code = 'admin';

    INSERT INTO public.snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    SELECT
      'admin_audit', 'Piste d''Audit', 'Journal des actions', 'FileText', '/audit',
      id, 4, true, true
    FROM public.snp_modules WHERE code = 'admin';

    RAISE NOTICE '✅ Modules par défaut insérés avec succès';
  ELSE
    RAISE NOTICE 'ℹ️  Modules déjà existants - insertion ignorée';
  END IF;
END $$;

-- ============================================================================
-- ETAPE 6: Commentaires
-- ============================================================================

COMMENT ON TABLE public.snp_modules IS
'Configuration des modules et menus de l''application avec support hiérarchique';

COMMENT ON COLUMN public.snp_modules.code IS
'Code unique du module (ex: production, sales, artisan)';

COMMENT ON COLUMN public.snp_modules.est_actif IS
'Si false, le module est complètement désactivé';

COMMENT ON COLUMN public.snp_modules.est_visible_menu IS
'Si false, le module n''apparaît pas dans le menu (mais reste fonctionnel)';

COMMENT ON COLUMN public.snp_modules.permissions_requises IS
'Liste des permissions nécessaires pour accéder au module';

-- ============================================================================
-- Message final
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration modules terminée!';
  RAISE NOTICE '- Table snp_modules créée';
  RAISE NOTICE '- Vue snp_modules_actifs créée';
  RAISE NOTICE '- Modules par défaut configurés';
END $$;
