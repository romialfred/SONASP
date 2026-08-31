-- =============================================================================
-- Catalogue fonctionnel unique SONASP
-- - déclare chaque module principal de la sidebar dans les deux référentiels ;
-- - expose la Réserve d'or nationale au profil Owner ;
-- - synchronise atomiquement activation/libellé entre navigation et habilitations.
-- Migration idempotente, applicable isolément sur le schéma actuellement déployé.
-- =============================================================================

BEGIN;

ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS access_domain text;

CREATE UNIQUE INDEX IF NOT EXISTS modules_name_unique_idx
  ON public.modules (name);

-- Le nom technique est partagé avec `snp_modules.code`. Les UUID existants sont
-- conservés par l'UPSERT afin de ne révoquer aucune habilitation déjà accordée.
INSERT INTO public.modules
  (name, display_name, description, category, sort_order, is_active, access_domain)
VALUES
  ('dashboard', 'Tableau de bord', 'Vue nationale de pilotage de la plateforme.', 'pilotage', 1, true, 'reports'),
  ('mining_sites', 'Sites miniers', 'Référentiel et suivi des sites miniers semi-mécanisés.', 'mines_semi_mecanisees', 10, true, 'sites'),
  ('artisan-minier', 'Artisans miniers', 'Gestion des artisans, cartes et rattachements.', 'mines_semi_mecanisees', 11, true, 'artisans'),
  ('artisan_gold_market', 'Marché d’or artisanal', 'Ventes, paiements et analyses de la collecte artisanale.', 'mines_semi_mecanisees', 12, true, 'artisans'),
  ('conciliation', 'Conciliation', 'Dossiers de conciliation et règles fiscales applicables.', 'mines_industrielles', 20, true, 'reconciliation'),
  ('production', 'Collecte de l’or', 'Production, collecte, licences et prévisions.', 'mines_industrielles', 21, true, 'production'),
  ('gold_purchases', 'Achats d’or', 'Contrats, plans, réquisitions et règlements des achats d’or.', 'mines_industrielles', 22, true, 'purchases'),
  ('shipping', 'Expéditions', 'Préparation, fret et formalités douanières.', 'mines_industrielles', 23, true, 'shipping'),
  ('refining', 'Raffinage', 'Suivi des lots, traitements et résultats de raffinage.', 'mines_industrielles', 24, true, 'refining'),
  ('gold_inventory', 'Réserve d’or nationale', 'Position nationale consolidée, stocks, transit et créances.', 'mines_industrielles', 25, true, 'inventory'),
  ('international_markets', 'Marchés internationaux', 'Espace de négoce, cours de l’or et taux de change.', 'mines_industrielles', 26, true, 'sales'),
  ('sales', 'Vente d’or international', 'Ventes internationales et règlements associés.', 'mines_industrielles', 27, true, 'sales'),
  ('stakeholders', 'Parties prenantes', 'Organisations et partenaires de la chaîne de valeur.', 'mines_industrielles', 28, true, 'customers'),
  ('documents', 'Documents', 'Certificats, pièces justificatives et rapports.', 'mines_industrielles', 29, true, 'documents'),
  ('settings', 'Paramètres', 'Paramètres généraux et référentiels fonctionnels.', 'administration', 40, true, 'settings'),
  ('administration', 'Administration', 'Utilisateurs, modules et messagerie administrative.', 'administration', 41, true, 'users'),
  ('sales_analytics', 'Analyses des ventes', 'Indicateurs et analyses consolidées des ventes.', 'rapports_analyses', 50, true, 'reports'),
  ('production_analytics', 'Rapports de production', 'Indicateurs et analyses consolidées de la production.', 'rapports_analyses', 51, true, 'reports'),
  ('reports', 'Rapports institutionnels', 'Rapports réglementaires et institutionnels.', 'rapports_analyses', 52, true, 'reports'),
  ('analytics', 'Performance nationale', 'Performance nationale et tendances consolidées.', 'rapports_analyses', 53, true, 'reports')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  access_domain = EXCLUDED.access_domain,
  updated_at = now();

INSERT INTO public.snp_modules
  (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu, permissions_requises)
VALUES
  ('dashboard', 'Tableau de bord', 'Vue nationale de pilotage de la plateforme.', 'LayoutDashboard', '/dashboard', NULL, 1, true, true, '{}'),
  ('mining_sites', 'Sites miniers', 'Référentiel et suivi des sites miniers semi-mécanisés.', 'Mountain', '/artisan-sites', NULL, 10, true, true, '{}'),
  ('artisan-minier', 'Artisans miniers', 'Gestion des artisans, cartes et rattachements.', 'Users', '/artisan-minier/liste', NULL, 11, true, true, '{}'),
  ('artisan_gold_market', 'Marché d’or artisanal', 'Ventes, paiements et analyses de la collecte artisanale.', 'CircleDollarSign', '/artisan-minier/paiements', NULL, 12, true, true, '{}'),
  ('conciliation', 'Conciliation', 'Dossiers de conciliation et règles fiscales applicables.', 'Scale', '/conciliation', NULL, 20, true, true, '{}'),
  ('production', 'Collecte de l’or', 'Production, collecte, licences et prévisions.', 'Building2', '/production/daily', NULL, 21, true, true, '{}'),
  ('gold_purchases', 'Achats d’or', 'Contrats, plans, réquisitions et règlements des achats d’or.', 'CircleDollarSign', '/achats/plans', NULL, 22, true, true, '{}'),
  ('shipping', 'Expéditions', 'Préparation, fret et formalités douanières.', 'Truck', '/shipping/preparation', NULL, 23, true, true, '{}'),
  ('refining', 'Raffinage', 'Suivi des lots, traitements et résultats de raffinage.', 'FlaskConical', '/refining', NULL, 24, true, true, '{}'),
  ('gold_inventory', 'Réserve d’or nationale', 'Position nationale consolidée, stocks, transit et créances.', 'Landmark', '/inventory', NULL, 25, true, true, '{}'),
  ('international_markets', 'Marchés internationaux', 'Espace de négoce, cours de l’or et taux de change.', 'TrendingUp', '/sales/trade-space', NULL, 26, true, true, '{}'),
  ('sales', 'Vente d’or international', 'Ventes internationales et règlements associés.', 'CircleDollarSign', '/sales', NULL, 27, true, true, '{}'),
  ('stakeholders', 'Parties prenantes', 'Organisations et partenaires de la chaîne de valeur.', 'Users', '/stakeholders/organizations', NULL, 28, true, true, '{}'),
  ('documents', 'Documents', 'Certificats, pièces justificatives et rapports.', 'FileText', '/documents/assay-certificates', NULL, 29, true, true, '{}'),
  ('settings', 'Paramètres', 'Paramètres généraux et référentiels fonctionnels.', 'SlidersHorizontal', '/parameters', NULL, 40, true, true, '{}'),
  ('administration', 'Administration', 'Utilisateurs, modules et messagerie administrative.', 'Settings', '/users', NULL, 41, true, true, '{}'),
  ('sales_analytics', 'Analyses des ventes', 'Indicateurs et analyses consolidées des ventes.', 'CircleDollarSign', '/analytics/ventes', NULL, 50, true, true, '{}'),
  ('production_analytics', 'Rapports de production', 'Indicateurs et analyses consolidées de la production.', 'Building2', '/analytics/production', NULL, 51, true, true, '{}'),
  ('reports', 'Rapports institutionnels', 'Rapports réglementaires et institutionnels.', 'FileText', '/reports', NULL, 52, true, true, '{}'),
  ('analytics', 'Performance nationale', 'Performance nationale et tendances consolidées.', 'TrendingUp', '/analytics', NULL, 53, true, true, '{}')
ON CONFLICT (code) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description,
  icone = EXCLUDED.icone,
  route = EXCLUDED.route,
  parent_id = NULL,
  ordre = EXCLUDED.ordre,
  updated_at = now();

-- Tous les sous-écrans réellement présents dans la sidebar. Ils héritent de
-- l'habilitation de leur module racine et ne créent donc pas une seconde ligne
-- attribuable dans `modules`.
WITH navigation_children(code, nom, description, icone, route, parent_code, ordre) AS (
  VALUES
    ('mining-sites-overview', 'Vue d’ensemble', 'Vue consolidée des sites miniers.', 'Grid2X2', '/artisan-sites', 'mining_sites', 1),
    ('mining-sites-production', 'Productions', 'Productions des sites semi-mécanisés.', 'Building2', '/artisan-sites/production', 'mining_sites', 2),

    ('artisan-dashboard', 'Vue d’ensemble', 'Vue consolidée des artisans miniers.', 'Grid2X2', '/artisan-minier', 'artisan-minier', 1),
    ('artisan-liste', 'Liste des artisans', 'Référentiel des artisans miniers.', 'Users', '/artisan-minier/liste', 'artisan-minier', 2),
    ('artisan-cartes-suivi', 'Suivi des cartes', 'Suivi du cycle de vie des cartes.', 'TrendingUp', '/artisan-minier/cartes/suivi', 'artisan-minier', 3),
    ('artisan-cartes-validation', 'Validation des cartes', 'Contrôle et validation des cartes.', 'CheckCircle2', '/artisan-minier/cartes/validation', 'artisan-minier', 4),
    ('artisan-cartes-expiration', 'Expirations', 'Cartes arrivant à expiration.', 'AlertTriangle', '/artisan-minier/cartes/expirations', 'artisan-minier', 5),

    ('artisan-market-overview', 'Vue d’ensemble', 'Pilotage du marché d’or artisanal.', 'Grid2X2', '/artisan-minier/paiements', 'artisan_gold_market', 1),
    ('artisan-ventes-or', 'Ventes d’or', 'Registre des ventes d’or artisanales.', 'CircleDollarSign', '/artisan-minier/ventes-or', 'artisan_gold_market', 2),
    ('artisan-paiements', 'Paiements', 'Traitement et historique des paiements.', 'CircleDollarSign', '/artisan-minier/paiements/historique', 'artisan_gold_market', 3),
    ('artisan-reports', 'Rapports et analyses', 'Rapports du marché artisanal.', 'BarChart3', '/artisan-minier/rapports', 'artisan_gold_market', 4),

    ('conciliation-dossiers', 'Dossiers', 'Dossiers de conciliation des ventes.', 'Scale', '/conciliation', 'conciliation', 1),
    ('conciliation-regles-fiscales', 'Règles fiscales', 'Taux et barèmes versionnés.', 'Gavel', '/conciliation/regles-fiscales', 'conciliation', 2),

    ('production-daily', 'Production journalière', 'Déclarations quotidiennes de production.', 'Building2', '/production/daily', 'production', 1),
    ('production-mine-purchases', 'Achats aux mines', 'Achats issus de la production déclarée.', 'CircleDollarSign', '/production/achats-mines', 'production', 2),
    ('production-safe', 'Or en coffre', 'Production sécurisée en coffre.', 'PackageCheck', '/production/in-safe', 'production', 3),
    ('production-licenses', 'Licences d’exportation', 'Licences d’exportation délivrées.', 'FileText', '/production/licenses', 'production', 4),
    ('production-license-requests', 'Demandes de licences', 'Demandes de licences à instruire.', 'ClipboardCheck', '/production/licenses/requests', 'production', 5),
    ('production-budget', 'Prévisions & Forecast', 'Prévisions et planification annuelle.', 'TrendingUp', '/performance/budgets', 'production', 6),

    ('purchases-contracts', 'Contrats de fourniture', 'Contrats qui fondent les engagements.', 'FileSignature', '/contrats', 'gold_purchases', 1),
    ('purchases-commitments', 'Pilotage des engagements', 'Suivi des obligations contractuelles.', 'BellRing', '/contrats/pilotage', 'gold_purchases', 2),
    ('purchases-plans', 'Plans mensuels', 'Planification mensuelle des besoins.', 'CalendarRange', '/achats/plans', 'gold_purchases', 3),
    ('purchases-requests', 'Demandes aux mines', 'Demandes d’approvisionnement adressées aux mines.', 'FileText', '/achats/demandes', 'gold_purchases', 4),
    ('purchases-requisitions', 'Réquisitions', 'Réquisitions d’achat d’or.', 'Gavel', '/requisitions', 'gold_purchases', 5),
    ('purchases-settlements', 'Règlements', 'Règlements financiers des achats.', 'CircleDollarSign', '/achats/reglements', 'gold_purchases', 6),
    ('purchases-mine-accounts', 'Comptes des mines', 'Situation des comptes des sociétés minières.', 'BarChart3', '/achats/comptes', 'gold_purchases', 7),

    ('shipping-dashboard', 'Préparations', 'Préparations d’expédition.', 'PackageCheck', '/shipping/preparation', 'shipping', 1),
    ('shipping-new', 'Nouvelle préparation', 'Création d’une préparation d’expédition.', 'Truck', '/shipping/preparation/new', 'shipping', 2),
    ('shipping-freight', 'Expéditions de fret', 'Suivi des expéditions de fret.', 'Truck', '/freight', 'shipping', 3),
    ('shipping-customs', 'Formalités douanières', 'Suivi documentaire des formalités douanières.', 'FileText', '/freight-customs', 'shipping', 4),

    ('refining-overview', 'Suivi du raffinage', 'Suivi opérationnel du raffinage.', 'FlaskConical', '/refining', 'refining', 1),
    ('refining-received-lots', 'Lots réceptionnés', 'Lots reçus pour traitement.', 'PackageCheck', '/refining/freight-shipments', 'refining', 2),

    ('inventory-national-position', 'Position nationale', 'Position consolidée de la réserve nationale.', 'PackageCheck', '/inventory', 'gold_inventory', 1),
    ('inventory-silver', 'Stock d’argent', 'Suivi du stock d’argent.', 'Layers', '/inventory/silver', 'gold_inventory', 2),
    ('inventory-new-entry', 'Nouvelle entrée', 'Saisie d’une entrée de réserve.', 'Grid2X2', '/inventory/add', 'gold_inventory', 3),

    ('sales-trade', 'Espace de négoce', 'Espace de négoce international.', 'CircleDollarSign', '/sales/trade-space', 'international_markets', 1),
    ('market-gold-prices', 'Cours de l’or', 'Cours de référence de l’or.', 'TrendingUp', '/gold-prices', 'international_markets', 2),
    ('market-fx-rates', 'Taux de change', 'Taux de change de référence.', 'TrendingUp', '/fx-rates', 'international_markets', 3),

    ('sales-dashboard', 'Ventes', 'Registre des ventes internationales.', 'CircleDollarSign', '/sales', 'sales', 1),
    ('sales-payments', 'Paiements', 'Paiements des ventes internationales.', 'CircleDollarSign', '/payments', 'sales', 2),

    ('stakeholders-organizations', 'Organisations', 'Organisations institutionnelles et privées.', 'Landmark', '/stakeholders/organizations', 'stakeholders', 1),
    ('stakeholders-mining-companies', 'Sociétés minières', 'Référentiel des sociétés minières.', 'Building2', '/stakeholders/mining-companies', 'stakeholders', 2),
    ('stakeholders-customers', 'Clients internationaux', 'Référentiel des clients internationaux.', 'Users', '/customers', 'stakeholders', 3),
    ('stakeholders-freight', 'Transporteurs', 'Référentiel des transporteurs.', 'Truck', '/stakeholders/freight-companies', 'stakeholders', 4),
    ('stakeholders-refineries', 'Raffineries', 'Référentiel des raffineries.', 'FlaskConical', '/stakeholders/refinery-plants', 'stakeholders', 5),
    ('stakeholders-depositors', 'Dépositaires', 'Référentiel des dépositaires.', 'Users', '/stakeholders/depositors', 'stakeholders', 6),

    ('documents-assay', 'Certificats d’essai', 'Certificats et résultats d’essai.', 'FileText', '/documents/assay-certificates', 'documents', 1),
    ('documents-reports', 'Rapports', 'Rapports disponibles sur la plateforme.', 'BarChart3', '/reports', 'documents', 2),

    ('settings-general', 'Paramètres généraux', 'Paramètres généraux de la plateforme.', 'SlidersHorizontal', '/parameters', 'settings', 1),
    ('settings-gold-sales', 'Paramètres des ventes', 'Paramètres fonctionnels des ventes d’or.', 'CircleDollarSign', '/admin/gold-sales-settings', 'settings', 2),
    ('settings-statuses', 'Référentiel des statuts', 'Statuts et transitions applicatives.', 'Layers', '/admin/status-manager', 'settings', 3),
    ('settings-workflow', 'Circuit de traçabilité', 'Configuration du circuit de traçabilité.', 'TrendingUp', '/admin/workflow', 'settings', 4),

    ('admin-users', 'Utilisateurs', 'Gestion des comptes et habilitations.', 'Users', '/users', 'administration', 1),
    ('admin-modules', 'Modules', 'Gestion du catalogue fonctionnel.', 'Layers', '/admin/modules', 'administration', 2),
    ('admin-messaging', 'Messagerie', 'Paramètres de la messagerie transactionnelle.', 'Mail', '/admin/messagerie', 'administration', 3)
), resolved_children AS (
  SELECT child.*, parent.id AS resolved_parent_id
  FROM navigation_children child
  JOIN public.snp_modules parent ON parent.code = child.parent_code
)
INSERT INTO public.snp_modules
  (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu, permissions_requises)
SELECT
  code, nom, description, icone, route, resolved_parent_id, ordre, true, true, '{}'
FROM resolved_children
ON CONFLICT (code) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description,
  icone = EXCLUDED.icone,
  route = EXCLUDED.route,
  parent_id = EXCLUDED.parent_id,
  ordre = EXCLUDED.ordre,
  updated_at = now();

-- Entrées historiques remplacées par le catalogue ci-dessus. Elles restent en
-- base pour préserver les références existantes, mais ne prétendent plus être
-- des éléments visibles de la navigation courante.
UPDATE public.snp_modules
SET est_visible_menu = false, updated_at = now()
WHERE code IN (
  'customers', 'payments', 'sales-new', 'shipping-documents',
  'admin-roles', 'admin-settings', 'admin-audit'
);

-- Vue de contrôle consommée par l'écran d'administration. Les sous-modules
-- héritent de leur parent ; seuls les modules racine doivent avoir un pendant
-- habilitable direct.
CREATE OR REPLACE VIEW public.snp_module_catalog_admin
WITH (security_invoker = true)
AS
SELECT
  navigation.*,
  permission.id AS permission_module_id,
  permission.access_domain,
  CASE
    WHEN navigation.parent_id IS NOT NULL THEN true
    ELSE permission.id IS NOT NULL
      AND COALESCE(permission.is_active, true) = COALESCE(navigation.est_actif, true)
  END AS catalog_consistent
FROM public.snp_modules AS navigation
LEFT JOIN public.modules AS permission ON permission.name = navigation.code;

GRANT SELECT ON public.snp_module_catalog_admin TO authenticated;

-- Une seule opération serveur met à jour le registre de menu et le registre
-- d'habilitation. La désactivation d'un parent est propagée à ses descendants.
CREATE OR REPLACE FUNCTION public.snp_update_module_catalog(
  p_module_id uuid,
  p_nom text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_route text DEFAULT NULL,
  p_ordre integer DEFAULT NULL,
  p_est_actif boolean DEFAULT NULL,
  p_est_visible_menu boolean DEFAULT NULL
)
RETURNS public.snp_modules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_module public.snp_modules%ROWTYPE;
  v_result public.snp_modules%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_profiles profile
    WHERE profile.id = auth.uid()
      AND profile.is_active = true
      AND profile.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Accès refusé : la gestion du catalogue exige un compte Owner ou Administrateur actif.';
  END IF;

  SELECT * INTO v_module
  FROM public.snp_modules
  WHERE id = p_module_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Module introuvable.';
  END IF;

  UPDATE public.snp_modules
  SET
    nom = COALESCE(NULLIF(trim(p_nom), ''), nom),
    description = CASE WHEN p_description IS NULL THEN description ELSE p_description END,
    route = CASE WHEN p_route IS NULL THEN route ELSE NULLIF(trim(p_route), '') END,
    ordre = COALESCE(p_ordre, ordre),
    est_visible_menu = COALESCE(p_est_visible_menu, est_visible_menu),
    updated_at = now()
  WHERE id = p_module_id;

  IF p_est_actif IS NOT NULL THEN
    WITH RECURSIVE descendants AS (
      SELECT id, code FROM public.snp_modules WHERE id = p_module_id
      UNION ALL
      SELECT child.id, child.code
      FROM public.snp_modules child
      JOIN descendants parent ON child.parent_id = parent.id
    ), updated_navigation AS (
      UPDATE public.snp_modules target
      SET est_actif = p_est_actif, updated_at = now()
      FROM descendants
      WHERE target.id = descendants.id
      RETURNING target.code
    )
    UPDATE public.modules permission
    SET is_active = p_est_actif, updated_at = now()
    WHERE permission.name IN (SELECT code FROM updated_navigation);
  END IF;

  UPDATE public.modules
  SET
    display_name = COALESCE(NULLIF(trim(p_nom), ''), display_name),
    description = CASE WHEN p_description IS NULL THEN description ELSE p_description END,
    sort_order = COALESCE(p_ordre, sort_order),
    updated_at = now()
  WHERE name = v_module.code;

  SELECT * INTO v_result FROM public.snp_modules WHERE id = p_module_id;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.snp_update_module_catalog(uuid,text,text,text,integer,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snp_update_module_catalog(uuid,text,text,text,integer,boolean,boolean) TO authenticated;

-- Le Owner est le garant global de la plateforme : il reçoit explicitement
-- toutes les habilitations présentes et futures lors de cette synchronisation.
INSERT INTO public.user_permissions (
  user_id, module_id,
  can_view, can_create, can_edit, can_delete, can_approve,
  can_read, can_write, field_permissions, granted_by
)
SELECT
  owner_profile.id, module.id,
  true, true, true, true, true,
  true, true, '{}'::jsonb, owner_profile.id
FROM public.user_profiles owner_profile
CROSS JOIN public.modules module
WHERE owner_profile.role = 'owner'
  AND owner_profile.is_active = true
  AND COALESCE(module.is_active, true)
ON CONFLICT (user_id, module_id) DO UPDATE SET
  can_view = true,
  can_create = true,
  can_edit = true,
  can_delete = true,
  can_approve = true,
  can_read = true,
  can_write = true,
  granted_by = EXCLUDED.granted_by,
  updated_at = now();

-- Garanties prospectives : un nouveau module actif est automatiquement ouvert
-- à tous les Owner actifs, et un compte promu Owner reçoit immédiatement le
-- catalogue complet. La règle ne dépend donc pas d'une correction ponctuelle.
CREATE OR REPLACE FUNCTION public.snp_grant_module_to_active_owners()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF COALESCE(NEW.is_active, true) THEN
    INSERT INTO public.user_permissions (
      user_id, module_id,
      can_view, can_create, can_edit, can_delete, can_approve,
      can_read, can_write, field_permissions, granted_by
    )
    SELECT
      owner_profile.id, NEW.id,
      true, true, true, true, true,
      true, true, '{}'::jsonb, owner_profile.id
    FROM public.user_profiles owner_profile
    WHERE owner_profile.role = 'owner' AND owner_profile.is_active = true
    ON CONFLICT (user_id, module_id) DO UPDATE SET
      can_view = true, can_create = true, can_edit = true,
      can_delete = true, can_approve = true,
      can_read = true, can_write = true,
      granted_by = EXCLUDED.granted_by, updated_at = now();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_snp_grant_module_to_active_owners ON public.modules;
CREATE TRIGGER trg_snp_grant_module_to_active_owners
AFTER INSERT OR UPDATE OF is_active ON public.modules
FOR EACH ROW EXECUTE FUNCTION public.snp_grant_module_to_active_owners();

CREATE OR REPLACE FUNCTION public.snp_grant_active_modules_to_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.role = 'owner' AND NEW.is_active = true THEN
    INSERT INTO public.user_permissions (
      user_id, module_id,
      can_view, can_create, can_edit, can_delete, can_approve,
      can_read, can_write, field_permissions, granted_by
    )
    SELECT
      NEW.id, module.id,
      true, true, true, true, true,
      true, true, '{}'::jsonb, NEW.id
    FROM public.modules module
    WHERE COALESCE(module.is_active, true)
    ON CONFLICT (user_id, module_id) DO UPDATE SET
      can_view = true, can_create = true, can_edit = true,
      can_delete = true, can_approve = true,
      can_read = true, can_write = true,
      granted_by = EXCLUDED.granted_by, updated_at = now();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_snp_grant_active_modules_to_owner ON public.user_profiles;
CREATE TRIGGER trg_snp_grant_active_modules_to_owner
AFTER INSERT OR UPDATE OF role, is_active ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.snp_grant_active_modules_to_owner();

NOTIFY pgrst, 'reload schema';

COMMIT;
