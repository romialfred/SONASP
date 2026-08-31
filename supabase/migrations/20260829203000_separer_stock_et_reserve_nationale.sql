-- Sépare le suivi opérationnel des stocks du patrimoine de Réserve nationale.
-- Les deux domaines restent rattachés au même access_domain `inventory`, mais
-- disposent de modules, routes et sous-modules indépendamment administrables.

BEGIN;

UPDATE public.modules
SET display_name = 'Suivi des stocks',
    description = 'Position opérationnelle, disponibilités, transit et alimentation des stocks.',
    sort_order = 25,
    updated_at = now()
WHERE name = 'gold_inventory';

UPDATE public.snp_modules
SET nom = 'Suivi des stocks',
    description = 'Position opérationnelle, disponibilités, transit et alimentation des stocks.',
    icone = 'Layers',
    route = '/inventory',
    ordre = 25,
    updated_at = now()
WHERE code = 'gold_inventory';

INSERT INTO public.modules
  (name, display_name, description, category, sort_order, is_active, access_domain)
VALUES
  (
    'national_reserve',
    'Réserve nationale',
    'Affectation, conservation, contrôle et valorisation du patrimoine aurifère national.',
    'mines_industrielles',
    26,
    true,
    'inventory'
  )
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  access_domain = EXCLUDED.access_domain,
  updated_at = now();

INSERT INTO public.snp_modules
  (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu, permissions_requises)
VALUES
  (
    'national_reserve',
    'Réserve nationale',
    'Affectation, conservation, contrôle et valorisation du patrimoine aurifère national.',
    'Landmark',
    '/national-reserve',
    NULL,
    26,
    true,
    true,
    '{}'
  )
ON CONFLICT (code) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description,
  icone = EXCLUDED.icone,
  route = EXCLUDED.route,
  parent_id = NULL,
  ordre = EXCLUDED.ordre,
  est_actif = true,
  updated_at = now();

-- La nouvelle racine occupe son propre rang ; les modules suivants sont
-- décales de manière identique dans le catalogue d'habilitations et le menu.
WITH orders(code, ordre) AS (
  VALUES
    ('international_markets', 27),
    ('sales', 28),
    ('stakeholders', 29),
    ('documents', 30)
)
UPDATE public.modules AS module
SET sort_order = orders.ordre, updated_at = now()
FROM orders
WHERE module.name = orders.code;

WITH orders(code, ordre) AS (
  VALUES
    ('international_markets', 27),
    ('sales', 28),
    ('stakeholders', 29),
    ('documents', 30)
)
UPDATE public.snp_modules AS module
SET ordre = orders.ordre, updated_at = now()
FROM orders
WHERE module.code = orders.code;

WITH parent AS (
  SELECT id FROM public.snp_modules WHERE code = 'national_reserve'
), children(code, nom, description, icone, route, ordre) AS (
  VALUES
    ('reserve-overview', 'Vue d’ensemble', 'Vue patrimoniale consolidée de la Réserve nationale.', 'Grid2X2', '/national-reserve', 1),
    ('inventory-allocations', 'Affectations à la réserve', 'Registre et circuit d’affectation des actifs.', 'PackageCheck', '/national-reserve/allocations', 2),
    ('inventory-physical', 'Réserve physique', 'Position des actifs physiquement rapprochés et actifs.', 'Layers', '/national-reserve/physical', 3),
    ('inventory-controls', 'Contrôles & écarts', 'Réceptions, écarts et rapprochements indépendants.', 'ClipboardCheck', '/national-reserve/controls', 4),
    ('inventory-valuation', 'Valorisation et analyse', 'Valorisations horodatées du patrimoine actif.', 'TrendingUp', '/national-reserve/valuation', 5),
    ('inventory-audit', 'Rapports et audit', 'Journal des événements et transitions de la réserve.', 'FileText', '/national-reserve/audit', 6)
)
INSERT INTO public.snp_modules
  (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu, permissions_requises)
SELECT children.code, children.nom, children.description, children.icone,
       children.route, parent.id, children.ordre, true, true, '{}'
FROM children CROSS JOIN parent
ON CONFLICT (code) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description,
  icone = EXCLUDED.icone,
  route = EXCLUDED.route,
  parent_id = EXCLUDED.parent_id,
  ordre = EXCLUDED.ordre,
  est_actif = true,
  est_visible_menu = true,
  updated_at = now();

-- Les identifiants historiques sont conservés : les préférences et paramètres
-- déjà rattachés à ces sous-modules ne sont pas cassés par la séparation.
UPDATE public.snp_modules
SET est_visible_menu = false, updated_at = now()
WHERE code = 'inventory-national-position';

UPDATE public.snp_modules
SET nom = CASE code
      WHEN 'inventory-overview' THEN 'Position des stocks'
      WHEN 'inventory-silver' THEN 'Position argent'
      ELSE 'Nouvelle entrée de stock'
    END,
    description = CASE code
      WHEN 'inventory-overview' THEN 'Position opérationnelle, disponibilités, allocations et mouvements.'
      WHEN 'inventory-silver' THEN 'Teneur argent associée aux lots d’or documentés.'
      ELSE 'Enregistrement contrôlé d’une entrée de stock.'
    END,
    est_actif = true,
    est_visible_menu = true,
    updated_at = now()
WHERE code IN ('inventory-overview', 'inventory-silver', 'inventory-new-entry');

-- Les profils institutionnels existants reçoivent un socle explicite. Les
-- capabilities `reserve.allocations.*` et les RPC restent le contrôle métier
-- autoritatif de chaque transition.
INSERT INTO public.user_permissions (
  user_id, module_id,
  can_view, can_create, can_edit, can_delete, can_approve,
  can_read, can_write, field_permissions, granted_by
)
SELECT
  profile.id,
  module.id,
  true,
  profile.role IN ('owner', 'management'),
  profile.role IN ('owner', 'management'),
  profile.role = 'owner',
  profile.role IN ('owner', 'management'),
  true,
  profile.role IN ('owner', 'management'),
  '{}'::jsonb,
  profile.id
FROM public.user_profiles AS profile
CROSS JOIN public.modules AS module
WHERE module.name = 'national_reserve'
  AND module.is_active = true
  AND profile.is_active = true
  AND profile.role IN ('owner', 'admin', 'management')
ON CONFLICT (user_id, module_id) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  can_approve = EXCLUDED.can_approve,
  can_read = EXCLUDED.can_read,
  can_write = EXCLUDED.can_write,
  updated_at = now();

-- Postflight : le catalogue doit contenir deux racines cohérentes et tous les
-- écrans de la réserve doivent dépendre de la nouvelle racine.
DO $postflight$
DECLARE
  v_stock_roots integer;
  v_reserve_roots integer;
  v_reserve_children integer;
BEGIN
  SELECT count(*) INTO v_stock_roots
  FROM public.snp_modules navigation
  JOIN public.modules permission ON permission.name = navigation.code
  WHERE navigation.code = 'gold_inventory'
    AND navigation.parent_id IS NULL
    AND permission.access_domain = 'inventory';

  SELECT count(*) INTO v_reserve_roots
  FROM public.snp_modules navigation
  JOIN public.modules permission ON permission.name = navigation.code
  WHERE navigation.code = 'national_reserve'
    AND navigation.parent_id IS NULL
    AND permission.access_domain = 'inventory';

  SELECT count(*) INTO v_reserve_children
  FROM public.snp_modules child
  JOIN public.snp_modules parent ON parent.id = child.parent_id
  WHERE parent.code = 'national_reserve'
    AND child.code IN (
      'reserve-overview', 'inventory-allocations', 'inventory-physical',
      'inventory-controls', 'inventory-valuation', 'inventory-audit'
    )
    AND child.est_actif
    AND child.est_visible_menu;

  IF v_stock_roots <> 1 OR v_reserve_roots <> 1 OR v_reserve_children <> 6 THEN
    RAISE EXCEPTION 'Catalogue Stock/Réserve incohérent après migration.';
  END IF;
END;
$postflight$;

NOTIFY pgrst, 'reload schema';

COMMIT;
