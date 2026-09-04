-- Gouvernance unifiée des portails, rôles métier et autorisations effectives.
-- La couche historique (user_profiles.role, modules, user_permissions et
-- capacités) est conservée comme plafond de compatibilité. La présente couche
-- ne peut que maintenir ou réduire ces droits, jamais les élargir.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.user_profiles') IS NULL
    OR to_regclass('public.snp_modules') IS NULL
    OR to_regclass('public.modules') IS NULL
    OR to_regclass('public.user_permissions') IS NULL
    OR to_regclass('public.snp_access_role_policies') IS NULL
    OR to_regprocedure('public.snp_actor_has_capability(text)') IS NULL
    OR to_regprocedure('public.snp_actor_can_module_action(text,text)') IS NULL
  THEN
    RAISE EXCEPTION 'Préflight gouvernance des accès : socle IAM incomplet.';
  END IF;
END;
$preflight$;

CREATE TABLE public.snp_actor_categories (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9-]{1,39}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 100),
  description text,
  resource_kind text NOT NULL CHECK (resource_kind IN (
    'mining_company','organization','artisan','collector','artisanal_site','identity'
  )),
  legacy_role text NOT NULL REFERENCES public.snp_access_role_policies(role) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.snp_access_portals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9-]{1,49}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  description text,
  institutional_scope text,
  display_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(display_config)='object'),
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT snp_access_portals_deleted_shape CHECK (
    (deleted_at IS NULL AND deleted_by IS NULL) OR deleted_at IS NOT NULL
  )
);

CREATE INDEX idx_snp_access_portals_active
  ON public.snp_access_portals(is_active, code) WHERE deleted_at IS NULL;

CREATE TABLE public.snp_navigation_groups (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9-]{1,59}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.snp_navigation_group_modules (
  group_code text NOT NULL REFERENCES public.snp_navigation_groups(code) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.snp_modules(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY(group_code,module_id),
  UNIQUE(module_id)
);

CREATE TABLE public.snp_portal_navigation_groups (
  portal_id uuid NOT NULL REFERENCES public.snp_access_portals(id) ON DELETE CASCADE,
  group_code text NOT NULL REFERENCES public.snp_navigation_groups(code) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  is_visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY(portal_id,group_code)
);

CREATE TABLE public.snp_portal_modules (
  portal_id uuid NOT NULL REFERENCES public.snp_access_portals(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.snp_modules(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  is_visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY(portal_id,module_id)
);

CREATE INDEX idx_snp_portal_modules_module ON public.snp_portal_modules(module_id,portal_id);

CREATE TABLE public.snp_permission_catalog (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  sort_order integer NOT NULL,
  is_sensitive boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.snp_module_applicable_permissions (
  module_id uuid NOT NULL REFERENCES public.snp_modules(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES public.snp_permission_catalog(code) ON DELETE RESTRICT,
  PRIMARY KEY(module_id,permission_code)
);

CREATE TABLE public.snp_access_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.snp_access_portals(id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9-]{1,79}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 140),
  description text,
  legacy_role text NOT NULL REFERENCES public.snp_access_role_policies(role) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(portal_id,id)
);

CREATE UNIQUE INDEX uq_snp_access_roles_portal_name
  ON public.snp_access_roles(portal_id,lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX idx_snp_access_roles_portal_active
  ON public.snp_access_roles(portal_id,is_active) WHERE deleted_at IS NULL;

CREATE TABLE public.snp_access_role_categories (
  role_id uuid NOT NULL REFERENCES public.snp_access_roles(id) ON DELETE CASCADE,
  category_code text NOT NULL REFERENCES public.snp_actor_categories(code) ON DELETE RESTRICT,
  PRIMARY KEY(role_id,category_code)
);

CREATE TABLE public.snp_access_role_permissions (
  role_id uuid NOT NULL REFERENCES public.snp_access_roles(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.snp_modules(id) ON DELETE RESTRICT,
  permission_code text NOT NULL REFERENCES public.snp_permission_catalog(code) ON DELETE RESTRICT,
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY(role_id,module_id,permission_code),
  FOREIGN KEY(module_id,permission_code)
    REFERENCES public.snp_module_applicable_permissions(module_id,permission_code)
    ON DELETE RESTRICT
);

CREATE TABLE public.snp_user_access_assignments (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  portal_id uuid NOT NULL,
  role_id uuid NOT NULL,
  actor_category_code text NOT NULL REFERENCES public.snp_actor_categories(code) ON DELETE RESTRICT,
  organization_id uuid REFERENCES public.snp_organizations(id) ON DELETE RESTRICT,
  resource_type text,
  resource_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  FOREIGN KEY(portal_id) REFERENCES public.snp_access_portals(id) ON DELETE RESTRICT,
  FOREIGN KEY(role_id) REFERENCES public.snp_access_roles(id) ON DELETE RESTRICT,
  FOREIGN KEY(portal_id,role_id)
    REFERENCES public.snp_access_roles(portal_id,id) ON DELETE RESTRICT,
  CONSTRAINT snp_user_access_resource_shape CHECK (
    (resource_type IS NULL AND resource_id IS NULL)
    OR (resource_type IN ('mining_company','organization','artisan','collector','artisanal_site') AND resource_id IS NOT NULL)
  )
);

CREATE INDEX idx_snp_user_access_assignments_portal ON public.snp_user_access_assignments(portal_id,is_active);
CREATE INDEX idx_snp_user_access_assignments_role ON public.snp_user_access_assignments(role_id,is_active);
CREATE INDEX idx_snp_user_access_assignments_resource
  ON public.snp_user_access_assignments(resource_type,resource_id) WHERE resource_id IS NOT NULL;

CREATE TABLE public.snp_user_permission_restrictions (
  user_id uuid NOT NULL REFERENCES public.snp_user_access_assignments(user_id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.snp_modules(id) ON DELETE RESTRICT,
  permission_code text NOT NULL REFERENCES public.snp_permission_catalog(code) ON DELETE RESTRICT,
  denied boolean NOT NULL DEFAULT true CHECK (denied),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY(user_id,module_id,permission_code),
  FOREIGN KEY(module_id,permission_code)
    REFERENCES public.snp_module_applicable_permissions(module_id,permission_code)
    ON DELETE RESTRICT
);

CREATE TABLE public.snp_access_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_id uuid,
  actor_email text,
  target_user_id uuid,
  target_label text,
  object_type text NOT NULL,
  object_id uuid,
  action text NOT NULL,
  portal_code text,
  role_code text,
  previous_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text NOT NULL CHECK (result IN ('success','failure','denied','warning')),
  reason text,
  ip_address inet,
  correlation_id text,
  session_id text,
  CONSTRAINT snp_access_audit_values_shape CHECK (
    jsonb_typeof(previous_values)='object' AND jsonb_typeof(new_values)='object'
  )
);

CREATE INDEX idx_snp_access_audit_occurred ON public.snp_access_audit_log(occurred_at DESC);
CREATE INDEX idx_snp_access_audit_actor ON public.snp_access_audit_log(actor_id,occurred_at DESC);
CREATE INDEX idx_snp_access_audit_target ON public.snp_access_audit_log(target_user_id,occurred_at DESC);
CREATE INDEX idx_snp_access_audit_portal_role ON public.snp_access_audit_log(portal_code,role_code,occurred_at DESC);
CREATE INDEX idx_snp_access_audit_action_result ON public.snp_access_audit_log(action,result,occurred_at DESC);

INSERT INTO public.snp_actor_categories
  (code,name,description,resource_kind,legacy_role,sort_order)
VALUES
  ('societe-miniere','Société minière','Compte rattaché à une société minière enregistrée.','mining_company','mine',10),
  ('comptoir','Comptoir','Compte rattaché à un comptoir actif.','organization','comptoir',20),
  ('artisan-minier','Artisan minier','Compte rattaché à un artisan minier enregistré.','artisan','customer',30),
  ('collecteur','Collecteur','Compte rattaché à un collecteur enregistré et à son comptoir.','collector','collector',40),
  ('mine-semi-mecanisee','Mine semi-mécanisée','Compte rattaché à un site semi-mécanisé enregistré.','artisanal_site','customer',50),
  ('administrateur','Administrateur','Compte institutionnel ou d’administration SONASP.','identity','admin',60),
  ('administration-dgmg','Administration minière (DGMG)','Compte rattaché à une structure active de la DGMG.','organization','dgmg',70),
  ('administration-dgi','Administration fiscale (DGI)','Compte rattaché à une structure active de la DGI.','organization','dgi',80);

INSERT INTO public.snp_permission_catalog(code,name,description,sort_order,is_sensitive)
VALUES
  ('view','Lecture','Consulter le module et ses données autorisées.',10,false),
  ('create','Création','Créer un nouvel enregistrement.',20,true),
  ('edit','Modification','Modifier un enregistrement existant.',30,true),
  ('delete','Suppression','Supprimer un enregistrement lorsque le workflow le permet.',40,true),
  ('submit','Soumission','Soumettre un dossier dans un workflow.',50,true),
  ('validate','Validation','Valider un contrôle ou une étape métier.',60,true),
  ('approve','Approbation','Approuver une décision métier.',70,true),
  ('reject','Rejet','Rejeter une demande avec motif.',80,true),
  ('export','Exportation','Exporter un ensemble de données autorisé.',90,true),
  ('download','Téléchargement','Télécharger une pièce ou un document autorisé.',100,false),
  ('admin','Administration','Paramétrer le module.',110,true);

INSERT INTO public.snp_navigation_groups(code,name,description,sort_order)
VALUES
  ('pilotage','Pilotage','Tableaux de bord de pilotage.',1),
  ('mine-semi-mecanisee','Mine semi-mécanisée','Sites et acteurs semi-mécanisés.',10),
  ('mine-industrielle','Mine industrielle','Production, achats et expéditions industrielles.',20),
  ('vente-achat-or','Vente et achat d’or','Marché d’or artisanal.',30),
  ('raffinage-stocks','Raffinage et stocks','Raffinage et positions de stock.',40),
  ('reserve-nationale','Réserve d’or du Burkina Faso','Patrimoine aurifère national.',50),
  ('vente-internationale','Vente internationale','Marchés, ventes et parties prenantes.',60),
  ('parametres','Paramètres et configuration','Référentiels et configuration technique.',70),
  ('utilisateurs-portails','Utilisateurs et portails','Gouvernance des accès et portails.',80),
  ('rapports-analyses','Rapports et analyses','Analyses consolidées et rapports.',90);

-- Quatrième entrée fonctionnelle du nouveau groupe ; les trois autres
-- sous-modules historiques sont conservés et redirigés par l’application.
INSERT INTO public.snp_modules(
  code,nom,description,icone,route,parent_id,ordre,est_actif,est_visible_menu,permissions_requises
)
SELECT 'admin-portals','Portails','Configuration des portails et de leurs menus.','PanelsTopLeft',
  '/access/portals',parent.id,0,true,true,ARRAY['users:manage']::text[]
FROM public.snp_modules parent WHERE parent.code='administration'
ON CONFLICT(code) DO UPDATE SET
  nom=excluded.nom,description=excluded.description,route=excluded.route,parent_id=excluded.parent_id,
  ordre=excluded.ordre,est_actif=true,est_visible_menu=true,updated_at=now();

UPDATE public.snp_modules SET route='/access/roles',nom='Rôles & permissions',updated_at=now()
WHERE code='admin-roles';
UPDATE public.snp_modules SET route='/access/audit',nom='Audit des accès',updated_at=now()
WHERE code='admin-audit';

-- Regroupement du référentiel réel de navigation. Les sous-modules
-- d’administration ont leur groupe propre, sans dupliquer leurs définitions.
WITH mapping(group_code,module_code,sort_order) AS (VALUES
  ('pilotage','dashboard',1),
  ('mine-semi-mecanisee','mining_sites',10),('mine-semi-mecanisee','artisan-minier',20),
  ('vente-achat-or','artisan_gold_market',10),
  ('mine-industrielle','production',10),('mine-industrielle','gold_purchases',20),('mine-industrielle','shipping',30),
  ('raffinage-stocks','refining',10),('raffinage-stocks','gold_inventory',20),
  ('reserve-nationale','national_reserve',10),
  ('vente-internationale','international_markets',10),('vente-internationale','sales',20),
  ('vente-internationale','stakeholders',30),('vente-internationale','documents',40),
  ('parametres','settings',10),('parametres','administration',20),
  ('utilisateurs-portails','admin-portals',10),('utilisateurs-portails','admin-roles',20),
  ('utilisateurs-portails','admin-users',30),('utilisateurs-portails','admin-audit',40),
  ('rapports-analyses','sales_analytics',10),('rapports-analyses','production_analytics',20),
  ('rapports-analyses','reports',30),('rapports-analyses','analytics',40)
)
INSERT INTO public.snp_navigation_group_modules(group_code,module_id,sort_order)
SELECT mapping.group_code,module.id,mapping.sort_order
FROM mapping JOIN public.snp_modules module ON module.code=mapping.module_code
ON CONFLICT(module_id) DO UPDATE SET
  group_code=excluded.group_code,sort_order=excluded.sort_order;

-- Les enfants non explicitement regroupés héritent du groupe de leur racine.
WITH RECURSIVE tree AS (
  SELECT module.id,module.parent_id,module.id AS root_id
  FROM public.snp_modules module WHERE module.parent_id IS NULL
  UNION ALL
  SELECT child.id,child.parent_id,tree.root_id
  FROM public.snp_modules child JOIN tree ON child.parent_id=tree.id
)
INSERT INTO public.snp_navigation_group_modules(group_code,module_id,sort_order)
SELECT root_group.group_code,child.id,coalesce(child.ordre,0)
FROM tree
JOIN public.snp_modules child ON child.id=tree.id
JOIN public.snp_navigation_group_modules root_group ON root_group.module_id=tree.root_id
WHERE NOT EXISTS(
  SELECT 1 FROM public.snp_navigation_group_modules existing WHERE existing.module_id=child.id
)
ON CONFLICT(module_id) DO NOTHING;

-- Permissions applicables : le référentiel ne présente jamais une action sans
-- signification métier. Les descendants héritent de la nature de leur racine.
WITH RECURSIVE tree AS (
  SELECT module.id,module.code,module.parent_id,module.code AS root_code
  FROM public.snp_modules module WHERE module.parent_id IS NULL
  UNION ALL
  SELECT child.id,child.code,child.parent_id,tree.root_code
  FROM public.snp_modules child JOIN tree ON child.parent_id=tree.id
), applicable AS (
  SELECT tree.id,'view'::text AS permission_code FROM tree
  UNION ALL SELECT tree.id,'create' FROM tree WHERE tree.root_code NOT IN ('dashboard','sales_analytics','production_analytics','reports','analytics')
  UNION ALL SELECT tree.id,'edit' FROM tree WHERE tree.root_code NOT IN ('dashboard','sales_analytics','production_analytics','reports','analytics')
  UNION ALL SELECT tree.id,'delete' FROM tree WHERE tree.root_code IN ('stakeholders','documents','settings','administration')
  UNION ALL SELECT tree.id,'submit' FROM tree WHERE tree.root_code IN ('production','gold_purchases','shipping','sales','conciliation','national_reserve')
  UNION ALL SELECT tree.id,'validate' FROM tree WHERE tree.root_code IN ('production','gold_purchases','shipping','conciliation','national_reserve')
  UNION ALL SELECT tree.id,'approve' FROM tree WHERE tree.root_code IN ('production','gold_purchases','sales','conciliation','national_reserve')
  UNION ALL SELECT tree.id,'reject' FROM tree WHERE tree.root_code IN ('production','gold_purchases','sales','conciliation','national_reserve')
  UNION ALL SELECT tree.id,'export' FROM tree WHERE tree.root_code IN ('production','gold_purchases','sales','gold_inventory','national_reserve','sales_analytics','production_analytics','reports','analytics','administration')
  UNION ALL SELECT tree.id,'download' FROM tree WHERE tree.root_code IN ('documents','production','shipping','sales','reports','administration')
  UNION ALL SELECT tree.id,'admin' FROM tree WHERE tree.root_code IN ('settings','administration')
)
INSERT INTO public.snp_module_applicable_permissions(module_id,permission_code)
SELECT DISTINCT id,permission_code FROM applicable
ON CONFLICT DO NOTHING;

-- Portails actuels : le code historique reste le lien de migration. Aucun
-- portail ni utilisateur existant n’est supprimé ou renommé.
INSERT INTO public.snp_access_portals(code,name,description,institutional_scope,is_active,is_system)
SELECT DISTINCT policy.portal_code,
  CASE policy.portal_code
    WHEN 'sonasp' THEN 'Portail SONASP'
    WHEN 'dgmg' THEN 'Portail DGMG'
    WHEN 'dgi' THEN 'Portail DGI'
    WHEN 'operator' THEN 'Portail des opérateurs'
    WHEN 'collector' THEN 'Portail des collecteurs'
    WHEN 'client' THEN 'Portail des clients'
    ELSE 'Portail '||upper(policy.portal_code)
  END,
  'Portail migré depuis le référentiel d’accès institutionnel existant.',
  policy.organization_type,true,true
FROM public.snp_access_role_policies policy
ON CONFLICT(code) DO UPDATE SET is_system=true,updated_at=now();

INSERT INTO public.snp_access_roles(portal_id,code,name,description,legacy_role,is_active,is_system)
SELECT portal.id,policy.role,
  CASE policy.role
    WHEN 'owner' THEN 'Super Administrateur'
    WHEN 'admin' THEN 'Administrateur'
    WHEN 'management' THEN 'SONASP'
    WHEN 'manager' THEN 'Direction — consultation'
    WHEN 'dgmg' THEN 'DGMG'
    WHEN 'dgi' THEN 'DGI'
    WHEN 'mine' THEN 'Société minière'
    WHEN 'comptoir' THEN 'Comptoir'
    WHEN 'collector' THEN 'Collecteur'
    WHEN 'factory' THEN 'Unité de production'
    WHEN 'airport' THEN 'Aéroport'
    WHEN 'refinery' THEN 'Raffinerie'
    WHEN 'customer' THEN 'Client'
    ELSE initcap(replace(policy.role,'_',' '))
  END,
  'Rôle migré sans perte depuis le profil technique '||policy.role||'.',
  policy.role,true,true
FROM public.snp_access_role_policies policy
JOIN public.snp_access_portals portal ON portal.code=policy.portal_code
ON CONFLICT(code) DO UPDATE SET
  portal_id=excluded.portal_id,legacy_role=excluded.legacy_role,is_system=true,updated_at=now();

-- Rôles DGI spécialisés demandés ; ils partagent le même rôle technique afin
-- de préserver les workflows fiscaux existants, mais possèdent des matrices distinctes.
INSERT INTO public.snp_access_roles(portal_id,code,name,description,legacy_role,is_active,is_system)
SELECT portal.id,role.code,role.name,role.description,'dgi',true,true
FROM public.snp_access_portals portal
CROSS JOIN (VALUES
  ('dgi-perception-specialisee','DGI – Perception spécialisée','Perception, contrôle et rapprochement des paiements fiscaux.'),
  ('dgi-royalties','DGI – Royalties','Contrôle des redevances et royalties minières.')
) role(code,name,description)
WHERE portal.code='dgi'
ON CONFLICT(code) DO UPDATE SET portal_id=excluded.portal_id,updated_at=now();

-- Compatibilité entre catégories métier et rôles précis.
INSERT INTO public.snp_access_role_categories(role_id,category_code)
SELECT role.id,category.code
FROM public.snp_access_roles role
JOIN public.snp_actor_categories category ON (
  (role.legacy_role='mine' AND category.code='societe-miniere')
  OR (role.legacy_role='comptoir' AND category.code='comptoir')
  OR (role.legacy_role='collector' AND category.code='collecteur')
  OR (role.legacy_role='customer' AND category.code IN ('artisan-minier','mine-semi-mecanisee'))
  OR (role.legacy_role='dgmg' AND category.code='administration-dgmg')
  OR (role.legacy_role='dgi' AND category.code='administration-dgi')
  OR (role.legacy_role NOT IN ('mine','comptoir','collector','customer','dgmg','dgi') AND category.code='administrateur')
)
ON CONFLICT DO NOTHING;

-- Chaque portail reprend seulement les modules autorisés par au moins un de
-- ses rôles historiques. Le portail SONASP du Super Administrateur conserve le
-- catalogue complet comme mécanisme de reprise.
WITH RECURSIVE module_tree AS (
  SELECT navigation.id,navigation.code,navigation.parent_id,navigation.code AS root_code
  FROM public.snp_modules navigation WHERE navigation.parent_id IS NULL
  UNION ALL
  SELECT child.id,child.code,child.parent_id,module_tree.root_code
  FROM public.snp_modules child JOIN module_tree ON child.parent_id=module_tree.id
), eligible AS (
  SELECT DISTINCT portal.id AS portal_id,module_tree.id AS module_id
  FROM public.snp_access_portals portal
  JOIN public.snp_access_roles role ON role.portal_id=portal.id AND role.deleted_at IS NULL
  CROSS JOIN module_tree
  JOIN public.modules permission_module ON permission_module.name=module_tree.root_code
  LEFT JOIN public.snp_role_module_ceilings ceiling
    ON ceiling.role=role.legacy_role AND ceiling.access_domain=permission_module.access_domain
  WHERE role.legacy_role='owner' OR coalesce(ceiling.can_view,false)
)
INSERT INTO public.snp_portal_modules(portal_id,module_id,is_active,is_visible)
SELECT eligible.portal_id,eligible.module_id,true,true FROM eligible
ON CONFLICT(portal_id,module_id) DO NOTHING;

INSERT INTO public.snp_portal_navigation_groups(portal_id,group_code,is_active,is_visible)
SELECT DISTINCT portal_module.portal_id,group_module.group_code,true,true
FROM public.snp_portal_modules portal_module
JOIN public.snp_navigation_group_modules group_module ON group_module.module_id=portal_module.module_id
ON CONFLICT(portal_id,group_code) DO NOTHING;

-- Conversion du plafond CRUD historique vers la matrice étendue.
WITH RECURSIVE module_tree AS (
  SELECT navigation.id,navigation.code,navigation.parent_id,navigation.code AS root_code
  FROM public.snp_modules navigation WHERE navigation.parent_id IS NULL
  UNION ALL
  SELECT child.id,child.code,child.parent_id,module_tree.root_code
  FROM public.snp_modules child JOIN module_tree ON child.parent_id=module_tree.id
), grants AS (
  SELECT role.id AS role_id,module_tree.id AS module_id,applicable.permission_code,
    CASE applicable.permission_code
      WHEN 'view' THEN ceiling.can_view
      WHEN 'create' THEN ceiling.can_create
      WHEN 'edit' THEN ceiling.can_edit
      WHEN 'delete' THEN ceiling.can_delete
      WHEN 'submit' THEN ceiling.can_edit
      WHEN 'validate' THEN ceiling.can_approve
      WHEN 'approve' THEN ceiling.can_approve
      WHEN 'reject' THEN ceiling.can_approve
      WHEN 'export' THEN ceiling.can_view
      WHEN 'download' THEN ceiling.can_view
      WHEN 'admin' THEN ceiling.can_edit
      ELSE false
    END AS allowed
  FROM public.snp_access_roles role
  JOIN public.snp_portal_modules portal_module ON portal_module.portal_id=role.portal_id AND portal_module.is_active
  JOIN module_tree ON module_tree.id=portal_module.module_id
  JOIN public.modules permission_module ON permission_module.name=module_tree.root_code
  JOIN public.snp_role_module_ceilings ceiling
    ON ceiling.role=role.legacy_role AND ceiling.access_domain=permission_module.access_domain
  JOIN public.snp_module_applicable_permissions applicable ON applicable.module_id=module_tree.id
  WHERE role.deleted_at IS NULL
)
INSERT INTO public.snp_access_role_permissions(role_id,module_id,permission_code,allowed)
SELECT role_id,module_id,permission_code,true FROM grants WHERE coalesce(allowed,false)
ON CONFLICT(role_id,module_id,permission_code) DO UPDATE SET allowed=true,updated_at=now();

-- Les deux rôles DGI spécialisés ne voient que leur périmètre fonctionnel.
-- Le filtrage se fait sur la racine afin de conserver les sous-pages utiles.
WITH RECURSIVE tree AS (
  SELECT module.id,module.parent_id,module.code AS root_code
  FROM public.snp_modules module WHERE module.parent_id IS NULL
  UNION ALL
  SELECT child.id,child.parent_id,tree.root_code
  FROM public.snp_modules child JOIN tree ON child.parent_id=tree.id
)
DELETE FROM public.snp_access_role_permissions permission
USING public.snp_access_roles role,tree
WHERE permission.role_id=role.id AND permission.module_id=tree.id
  AND role.code='dgi-perception-specialisee'
  AND tree.root_code NOT IN ('artisan_gold_market','conciliation','administration','reports','analytics');
WITH RECURSIVE tree AS (
  SELECT module.id,module.parent_id,module.code AS root_code
  FROM public.snp_modules module WHERE module.parent_id IS NULL
  UNION ALL
  SELECT child.id,child.parent_id,tree.root_code
  FROM public.snp_modules child JOIN tree ON child.parent_id=tree.id
)
DELETE FROM public.snp_access_role_permissions permission
USING public.snp_access_roles role,tree
WHERE permission.role_id=role.id AND permission.module_id=tree.id
  AND role.code='dgi-royalties'
  AND tree.root_code NOT IN ('production','conciliation','sales_analytics','reports','analytics','administration');

-- Affectation sans perte de tous les profils existants à leur rôle migré.
INSERT INTO public.snp_user_access_assignments(
  user_id,portal_id,role_id,actor_category_code,organization_id,resource_type,resource_id,is_active
)
SELECT profile.id,role.portal_id,role.id,
  CASE profile.role
    WHEN 'mine' THEN 'societe-miniere'
    WHEN 'comptoir' THEN 'comptoir'
    WHEN 'collector' THEN 'collecteur'
    WHEN 'customer' THEN 'artisan-minier'
    WHEN 'dgmg' THEN 'administration-dgmg'
    WHEN 'dgi' THEN 'administration-dgi'
    ELSE 'administrateur'
  END,
  membership.organization_id,
  CASE profile.role
    WHEN 'mine' THEN 'mining_company'
    WHEN 'comptoir' THEN 'organization'
    WHEN 'collector' THEN 'collector'
    WHEN 'dgmg' THEN 'organization'
    WHEN 'dgi' THEN 'organization'
    ELSE NULL
  END,
  CASE profile.role
    WHEN 'mine' THEN profile.mining_company_id
    WHEN 'comptoir' THEN membership.organization_id
    WHEN 'collector' THEN collector.collector_id
    WHEN 'dgmg' THEN membership.organization_id
    WHEN 'dgi' THEN membership.organization_id
    ELSE NULL
  END,
  profile.is_active
FROM public.user_profiles profile
JOIN public.snp_access_roles role ON role.code=profile.role AND role.deleted_at IS NULL
LEFT JOIN LATERAL (
  SELECT link.organization_id
  FROM public.snp_user_organization_memberships link
  WHERE link.user_id=profile.id AND link.is_primary AND link.valid_until IS NULL
  ORDER BY link.valid_from DESC LIMIT 1
) membership ON true
LEFT JOIN LATERAL (
  SELECT account.collector_id
  FROM public.snp_collector_accounts account
  WHERE account.user_id=profile.id AND account.is_active
  ORDER BY account.linked_at DESC LIMIT 1
) collector ON true
ON CONFLICT(user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.snp_access_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  NEW.updated_at=clock_timestamp();
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_compatible_portals(p_category_code text)
RETURNS TABLE(
  id uuid,code text,name text,description text,institutional_scope text,
  is_active boolean,is_system boolean,role_count bigint,user_count bigint,
  active_group_count bigint,updated_at timestamptz,updated_by_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF NOT public.snp_access_admin_authorized(false,false) THEN
    RAISE EXCEPTION 'Consultation des portails compatibles non autorisée.' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.snp_actor_categories WHERE code=p_category_code AND is_active) THEN
    RAISE EXCEPTION 'Catégorie inconnue.' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  SELECT summary.* FROM public.snp_access_portals_list(false) summary
  WHERE EXISTS(
    SELECT 1 FROM public.snp_access_roles role
    JOIN public.snp_access_role_categories category ON category.role_id=role.id
    WHERE role.portal_id=summary.id AND role.is_active AND role.deleted_at IS NULL
      AND category.category_code=p_category_code
  ) ORDER BY summary.name;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_compatible_roles(p_portal_id uuid,p_category_code text)
RETURNS TABLE(
  id uuid,portal_id uuid,portal_code text,portal_name text,code text,name text,
  description text,legacy_role text,is_active boolean,is_system boolean,
  user_count bigint,updated_at timestamptz,updated_by_name text,category_codes text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_actor_role text;
BEGIN
  IF NOT public.snp_access_admin_authorized(false,false) THEN
    RAISE EXCEPTION 'Consultation des rôles compatibles non autorisée.' USING ERRCODE='42501';
  END IF;
  SELECT profile.role INTO v_actor_role FROM public.user_profiles profile WHERE profile.id=auth.uid();
  RETURN QUERY
  SELECT summary.* FROM public.snp_access_roles_list(p_portal_id,false) summary
  WHERE p_category_code=ANY(summary.category_codes)
    AND summary.legacy_role<>'owner'
    AND (v_actor_role='owner' OR public.snp_niveau_role(summary.legacy_role)<public.snp_niveau_role(v_actor_role))
  ORDER BY summary.name;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_user_assignment(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,portal_id uuid,portal_code text,portal_name text,role_id uuid,
  role_code text,role_name text,actor_category_code text,resource_type text,
  resource_id uuid,is_active boolean,restriction_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF p_user_id<>auth.uid() AND NOT public.snp_access_admin_authorized(false,false) THEN
    RAISE EXCEPTION 'Consultation de l’affectation non autorisée.' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT assignment.user_id,assignment.portal_id,portal.code,portal.name,assignment.role_id,
    role.code,role.name,assignment.actor_category_code,assignment.resource_type,
    assignment.resource_id,assignment.is_active,
    (SELECT count(*) FROM public.snp_user_permission_restrictions restriction
      WHERE restriction.user_id=assignment.user_id)
  FROM public.snp_user_access_assignments assignment
  JOIN public.snp_access_portals portal ON portal.id=assignment.portal_id
  JOIN public.snp_access_roles role ON role.id=assignment.role_id
  WHERE assignment.user_id=p_user_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_effective_matrix(p_role_id uuid,p_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  module_id uuid,module_code text,module_name text,parent_id uuid,permission_code text,
  portal_allowed boolean,role_allowed boolean,user_denied boolean,effective boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_portal_id uuid;
BEGIN
  IF NOT public.snp_access_admin_authorized(false,false) THEN
    RAISE EXCEPTION 'Consultation de la matrice effective non autorisée.' USING ERRCODE='42501';
  END IF;
  SELECT role.portal_id INTO v_portal_id
  FROM public.snp_access_roles role WHERE role.id=p_role_id AND role.deleted_at IS NULL;
  IF v_portal_id IS NULL THEN RAISE EXCEPTION 'Rôle introuvable.' USING ERRCODE='P0002'; END IF;
  IF p_user_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.snp_user_access_assignments assignment
    WHERE assignment.user_id=p_user_id AND assignment.role_id=p_role_id
  ) THEN RAISE EXCEPTION 'Le rôle ne correspond pas à l’utilisateur.' USING ERRCODE='42501'; END IF;

  RETURN QUERY
  SELECT module.id,module.code,module.nom,module.parent_id,applicable.permission_code,
    portal.is_active AND portal.deleted_at IS NULL AND portal_module.is_active
      AND module.est_actif AND group_state.is_active AS portal_allowed,
    coalesce(role_permission.allowed,false) AS role_allowed,
    coalesce(restriction.denied,false) AS user_denied,
    portal.is_active AND portal.deleted_at IS NULL AND portal_module.is_active
      AND module.est_actif AND group_state.is_active
      AND role.is_active AND role.deleted_at IS NULL
      AND coalesce(role_permission.allowed,false)
      AND NOT coalesce(restriction.denied,false) AS effective
  FROM public.snp_access_roles role
  JOIN public.snp_access_portals portal ON portal.id=role.portal_id
  JOIN public.snp_portal_modules portal_module ON portal_module.portal_id=portal.id AND portal_module.is_active
  JOIN public.snp_modules module ON module.id=portal_module.module_id
  JOIN public.snp_navigation_group_modules group_link ON group_link.module_id=module.id
  JOIN public.snp_portal_navigation_groups group_state
    ON group_state.portal_id=portal.id AND group_state.group_code=group_link.group_code
  JOIN public.snp_module_applicable_permissions applicable ON applicable.module_id=module.id
  LEFT JOIN public.snp_access_role_permissions role_permission
    ON role_permission.role_id=role.id AND role_permission.module_id=module.id
      AND role_permission.permission_code=applicable.permission_code
  LEFT JOIN public.snp_user_permission_restrictions restriction
    ON restriction.user_id=p_user_id AND restriction.module_id=module.id
      AND restriction.permission_code=applicable.permission_code
  WHERE role.id=p_role_id
  ORDER BY group_link.group_code,group_link.sort_order,module.ordre,applicable.permission_code;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_current_access_context()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_context jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.snp_session_est_active() THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'portal_id',portal.id,'portal_code',portal.code,'portal_name',portal.name,
    'portal_active',portal.is_active AND portal.deleted_at IS NULL,
    'role_id',role.id,'role_code',role.code,'role_name',role.name,
    'role_active',role.is_active AND role.deleted_at IS NULL,
    'actor_category_code',assignment.actor_category_code,
    'resource_type',assignment.resource_type,'resource_id',assignment.resource_id,
    'module_codes',coalesce((
      SELECT jsonb_agg(module.code ORDER BY module.code)
      FROM public.snp_portal_modules portal_module
      JOIN public.snp_modules module ON module.id=portal_module.module_id
      WHERE portal_module.portal_id=portal.id AND portal_module.is_active
        AND module.est_actif
        AND public.snp_effective_access_for_user(auth.uid(),module.code,'view')
    ),'[]'::jsonb)
  ) INTO v_context
  FROM public.snp_user_access_assignments assignment
  JOIN public.snp_access_portals portal ON portal.id=assignment.portal_id
  JOIN public.snp_access_roles role ON role.id=assignment.role_id
  WHERE assignment.user_id=auth.uid() AND assignment.is_active;
  RETURN v_context;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_audit_feed(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(
  id text,occurred_at timestamptz,actor_id uuid,actor_email text,target_user_id uuid,
  target_label text,object_type text,object_id text,action text,portal_code text,
  role_code text,result text,reason text,ip_address text,correlation_id text,
  previous_values jsonb,new_values jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE
  v_query text:=lower(trim(coalesce(p_filters->>'query','')));
  v_from timestamptz:=nullif(p_filters->>'from','')::timestamptz;
  v_to timestamptz:=nullif(p_filters->>'to','')::timestamptz;
  v_actor uuid:=nullif(p_filters->>'actorId','')::uuid;
  v_portal text:=nullif(p_filters->>'portalCode','');
  v_role text:=nullif(p_filters->>'roleCode','');
  v_action text:=nullif(p_filters->>'action','');
  v_result text:=nullif(p_filters->>'result','');
  v_offset integer:=greatest(coalesce((p_filters->>'offset')::integer,0),0);
  v_limit integer:=least(greatest(coalesce((p_filters->>'limit')::integer,100),1),500);
BEGIN
  IF p_filters IS NULL OR jsonb_typeof(p_filters)<>'object' THEN
    RAISE EXCEPTION 'Filtres d’audit invalides.' USING ERRCODE='22023';
  END IF;
  IF NOT public.snp_access_admin_authorized(false,false)
    OR NOT public.snp_actor_has_capability('reports.read') THEN
    RAISE EXCEPTION 'Consultation de l’audit non autorisée.' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  WITH normalized AS (
    SELECT audit.id::text,audit.occurred_at,audit.actor_id,audit.actor_email,
      audit.target_user_id,audit.target_label,audit.object_type,audit.object_id::text,
      audit.action,audit.portal_code,audit.role_code,audit.result,audit.reason,
      audit.ip_address::text,audit.correlation_id,audit.previous_values,audit.new_values
    FROM public.snp_access_audit_log audit
    UNION ALL
    SELECT 'account:'||account.id::text,account.created_at,account.actor_id,actor.email,
      account.target_id,target.email,'user_account',account.target_id::text,account.action,
      NULL,NULL,'success',NULL,NULL,NULL,account.previous_values,account.new_values
    FROM public.snp_account_admin_audit account
    LEFT JOIN public.user_profiles actor ON actor.id=account.actor_id
    LEFT JOIN public.user_profiles target ON target.id=account.target_id
    UNION ALL
    SELECT 'legacy:'||legacy.id::text,legacy.created_at,legacy.user_id,legacy.user_email,
      NULL,NULL,legacy.module,NULL,legacy.action,NULL,NULL,
      CASE lower(coalesce(legacy.status,'')) WHEN 'failed' THEN 'failure' ELSE 'success' END,
      legacy.details,legacy.ip_address::text,NULL,'{}'::jsonb,
      jsonb_build_object('details',legacy.details)
    FROM public.audit_logs legacy
  )
  SELECT event.* FROM normalized event
  WHERE (v_from IS NULL OR event.occurred_at>=v_from)
    AND (v_to IS NULL OR event.occurred_at<v_to+interval '1 day')
    AND (v_actor IS NULL OR event.actor_id=v_actor)
    AND (v_portal IS NULL OR event.portal_code=v_portal)
    AND (v_role IS NULL OR event.role_code=v_role)
    AND (v_action IS NULL OR event.action=v_action)
    AND (v_result IS NULL OR event.result=v_result)
    AND (v_query='' OR lower(concat_ws(' ',event.actor_email,event.target_label,event.object_type,
      event.action,event.portal_code,event.role_code,event.reason,event.object_id)) LIKE '%'||v_query||'%')
  ORDER BY event.occurred_at DESC,event.id DESC OFFSET v_offset LIMIT v_limit;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_audit_export(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(
  id text,occurred_at timestamptz,actor_id uuid,actor_email text,target_user_id uuid,
  target_label text,object_type text,object_id text,action text,portal_code text,
  role_code text,result text,reason text,ip_address text,correlation_id text,
  previous_values jsonb,new_values jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF NOT public.snp_access_admin_authorized(false,false)
    OR NOT public.snp_effective_access_for_user(auth.uid(),'admin-audit','export') THEN
    RAISE EXCEPTION 'Export de l’audit non autorisé.' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT * FROM public.snp_access_audit_feed(
    coalesce(p_filters,'{}'::jsonb)||jsonb_build_object('offset',0,'limit',500)
  );
END;
$fn$;

CREATE TRIGGER trg_snp_access_portals_updated_at
BEFORE UPDATE ON public.snp_access_portals FOR EACH ROW
EXECUTE FUNCTION public.snp_access_touch_updated_at();
CREATE TRIGGER trg_snp_access_roles_updated_at
BEFORE UPDATE ON public.snp_access_roles FOR EACH ROW
EXECUTE FUNCTION public.snp_access_touch_updated_at();
CREATE TRIGGER trg_snp_user_access_assignments_updated_at
BEFORE UPDATE ON public.snp_user_access_assignments FOR EACH ROW
EXECUTE FUNCTION public.snp_access_touch_updated_at();

CREATE OR REPLACE FUNCTION public.snp_access_audit_immutable()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  RAISE EXCEPTION 'Le journal d’audit des accès est immuable.' USING ERRCODE='42501';
END;
$fn$;

CREATE TRIGGER trg_snp_access_audit_immutable
BEFORE UPDATE OR DELETE ON public.snp_access_audit_log FOR EACH ROW
EXECUTE FUNCTION public.snp_access_audit_immutable();

CREATE OR REPLACE FUNCTION public.snp_access_admin_authorized(
  p_write boolean DEFAULT false,
  p_owner_only boolean DEFAULT false
) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT CASE
    WHEN coalesce(auth.role(),'')='service_role' THEN true
    WHEN auth.uid() IS NULL OR NOT public.snp_session_est_active() THEN false
    WHEN p_write AND NOT public.snp_mfa_satisfaite() THEN false
    ELSE coalesce((
      SELECT profile.is_active
        AND profile.mining_company_id IS NULL
        AND profile.role IN ('owner','admin')
        AND (NOT p_owner_only OR profile.role='owner')
        AND public.snp_actor_has_capability('accounts.manage')
      FROM public.user_profiles profile WHERE profile.id=auth.uid()
    ),false)
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_audit_append(
  p_object_type text,
  p_object_id uuid,
  p_action text,
  p_target_user_id uuid DEFAULT NULL,
  p_target_label text DEFAULT NULL,
  p_portal_code text DEFAULT NULL,
  p_role_code text DEFAULT NULL,
  p_previous_values jsonb DEFAULT '{}'::jsonb,
  p_new_values jsonb DEFAULT '{}'::jsonb,
  p_result text DEFAULT 'success',
  p_reason text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE
  v_id uuid;
  v_headers jsonb:='{}'::jsonb;
  v_ip inet;
  v_email text;
BEGIN
  IF p_result NOT IN ('success','failure','denied','warning') THEN
    RAISE EXCEPTION 'Résultat d’audit invalide.' USING ERRCODE='22023';
  END IF;
  BEGIN
    v_headers:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb);
    v_ip:=nullif(split_part(coalesce(v_headers->>'x-forwarded-for',v_headers->>'x-real-ip',''),',',1),'')::inet;
  EXCEPTION WHEN OTHERS THEN
    v_ip:=NULL;
  END;
  SELECT profile.email INTO v_email FROM public.user_profiles profile WHERE profile.id=auth.uid();
  INSERT INTO public.snp_access_audit_log(
    actor_id,actor_email,target_user_id,target_label,object_type,object_id,action,
    portal_code,role_code,previous_values,new_values,result,reason,ip_address,
    correlation_id,session_id
  ) VALUES(
    auth.uid(),v_email,p_target_user_id,p_target_label,trim(p_object_type),p_object_id,trim(p_action),
    p_portal_code,p_role_code,coalesce(p_previous_values,'{}'::jsonb),
    coalesce(p_new_values,'{}'::jsonb),p_result,nullif(trim(coalesce(p_reason,'')),''),v_ip,
    nullif(trim(coalesce(p_correlation_id,'')),''),v_headers->>'x-client-session-id'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_action_to_legacy(p_action text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path TO 'pg_catalog','pg_temp' AS $fn$
  SELECT CASE lower(coalesce(p_action,''))
    WHEN 'view' THEN 'view'
    WHEN 'export' THEN 'view'
    WHEN 'download' THEN 'view'
    WHEN 'create' THEN 'create'
    WHEN 'edit' THEN 'edit'
    WHEN 'submit' THEN 'edit'
    WHEN 'delete' THEN 'delete'
    WHEN 'validate' THEN 'approve'
    WHEN 'approve' THEN 'approve'
    WHEN 'reject' THEN 'approve'
    WHEN 'admin' THEN 'edit'
    ELSE NULL
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_legacy_user_permission_allowed(
  p_user_id uuid,p_module_id uuid,p_action text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  WITH normalized AS (
    SELECT public.snp_access_action_to_legacy(p_action) AS action
  ), target AS (
    SELECT profile.role,module.access_domain,(SELECT action FROM normalized) AS action
    FROM public.user_profiles profile CROSS JOIN public.modules module
    WHERE profile.id=p_user_id AND profile.is_active AND module.id=p_module_id
  ), selected AS (
    SELECT responsibility_code FROM public.snp_user_responsibilities WHERE user_id=p_user_id
  )
  SELECT coalesce((SELECT CASE
    WHEN target.action IS NULL THEN false
    WHEN NOT public.snp_permission_allowed(target.role,p_module_id,target.action) THEN false
    WHEN target.role='owner' THEN true
    WHEN target.action='view' THEN true
    WHEN target.role='admin' THEN true /* l’attribution explicite reste exigée par la matrice effective */
    WHEN target.role='management' AND target.action IN('create','edit') THEN CASE
      WHEN target.access_domain='payments' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.finance.execute')
      WHEN target.access_domain='reconciliation' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='reconciliation.manage')
      ELSE EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.prepare') END
    WHEN target.role='management' AND target.action='approve' THEN CASE
      WHEN target.access_domain IN('payments','reconciliation') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.finance.reconcile')
      ELSE EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.approve') END
    WHEN target.role='dgmg' AND target.action IN('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgmg.supervise')
    WHEN target.role='dgmg' AND target.action='approve' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgmg.production.validate')
    WHEN target.role='dgi' AND target.action='edit' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgi.fiscal.control')
    WHEN target.role='dgi' AND target.action='approve' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgi.fiscal.reconcile')
    WHEN target.role='mine' AND target.action IN('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='mine.production.manage')
    WHEN target.role='comptoir' AND target.action IN('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='comptoir.manage')
    WHEN target.role='collector' AND target.action IN('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='collector.operate')
    ELSE false END FROM target),false);
$fn$;

CREATE OR REPLACE FUNCTION public.snp_effective_access_for_user(
  p_user_id uuid,p_module_code text,p_action text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  WITH RECURSIVE target AS (
    SELECT module.id,module.code,module.parent_id,0 AS depth
    FROM public.snp_modules module WHERE module.code=p_module_code
  ), ancestors AS (
    SELECT * FROM target
    UNION ALL
    SELECT parent.id,parent.code,parent.parent_id,ancestors.depth+1
    FROM public.snp_modules parent JOIN ancestors ON ancestors.parent_id=parent.id
  ), root AS (
    SELECT * FROM ancestors WHERE parent_id IS NULL ORDER BY depth DESC LIMIT 1
  ), context AS (
    SELECT profile.role AS legacy_role,profile.is_active AS account_active,
      assignment.portal_id,assignment.role_id,assignment.is_active AS assignment_active,
      portal.is_active AS portal_active,portal.deleted_at AS portal_deleted_at,
      role.is_active AS role_active,role.deleted_at AS role_deleted_at,
      role.portal_id AS role_portal_id,role.legacy_role AS assigned_legacy_role
    FROM public.user_profiles profile
    LEFT JOIN public.snp_user_access_assignments assignment ON assignment.user_id=profile.id
    LEFT JOIN public.snp_access_portals portal ON portal.id=assignment.portal_id
    LEFT JOIN public.snp_access_roles role ON role.id=assignment.role_id
    WHERE profile.id=p_user_id
  ), legacy_module AS (
    SELECT module.id FROM public.modules module JOIN root ON module.name=root.code
  ), legacy_grant AS (
    SELECT permission.* FROM public.user_permissions permission
    JOIN legacy_module ON legacy_module.id=permission.module_id
    WHERE permission.user_id=p_user_id
  ), group_state AS (
    SELECT portal_group.is_active,portal_group.is_visible
    FROM target
    JOIN public.snp_navigation_group_modules link ON link.module_id=target.id
    JOIN context ON true
    JOIN public.snp_portal_navigation_groups portal_group
      ON portal_group.portal_id=context.portal_id AND portal_group.group_code=link.group_code
  )
  SELECT coalesce((SELECT CASE
    -- Continuité de reprise : le Super Administrateur actif conserve son accès
    -- global historique, y compris lorsqu’un portail est en maintenance.
    WHEN context.legacy_role='owner' AND context.account_active THEN true
    WHEN lower(coalesce(p_action,'')) NOT IN (
      SELECT code FROM public.snp_permission_catalog WHERE is_active
    ) THEN false
    WHEN NOT context.account_active OR NOT context.assignment_active
      OR NOT context.portal_active OR context.portal_deleted_at IS NOT NULL
      OR NOT context.role_active OR context.role_deleted_at IS NOT NULL
      OR context.role_portal_id<>context.portal_id
      OR context.assigned_legacy_role<>context.legacy_role THEN false
    WHEN NOT EXISTS(SELECT 1 FROM target) OR NOT EXISTS(SELECT 1 FROM root) THEN false
    WHEN EXISTS(
      SELECT 1 FROM ancestors node
      JOIN public.snp_modules module ON module.id=node.id
      LEFT JOIN public.snp_portal_modules portal_module
        ON portal_module.portal_id=context.portal_id AND portal_module.module_id=node.id
      WHERE NOT coalesce(module.est_actif,false)
        OR NOT coalesce(portal_module.is_active,false)
    ) THEN false
    WHEN NOT coalesce((SELECT is_active AND is_visible FROM group_state),false) THEN false
    WHEN NOT EXISTS(
      SELECT 1 FROM target
      JOIN public.snp_module_applicable_permissions applicable ON applicable.module_id=target.id
      WHERE applicable.permission_code=lower(p_action)
    ) THEN false
    WHEN NOT EXISTS(
      SELECT 1 FROM target
      JOIN public.snp_access_role_permissions permission
        ON permission.role_id=context.role_id AND permission.module_id=target.id
      WHERE permission.permission_code=lower(p_action) AND permission.allowed
    ) THEN false
    WHEN NOT EXISTS(SELECT 1 FROM legacy_grant permission WHERE CASE public.snp_access_action_to_legacy(p_action)
      WHEN 'view' THEN permission.can_view
      WHEN 'create' THEN permission.can_create
      WHEN 'edit' THEN permission.can_edit
      WHEN 'delete' THEN permission.can_delete
      WHEN 'approve' THEN permission.can_approve
      ELSE false END
    ) THEN false
    WHEN EXISTS(
      SELECT 1 FROM public.snp_user_permission_restrictions restriction
      JOIN ancestors ON ancestors.id=restriction.module_id
      WHERE restriction.user_id=p_user_id
        AND restriction.permission_code=lower(p_action) AND restriction.denied
    ) THEN false
    ELSE true END FROM context),false);
$fn$;

-- Étend le plafond historique aux actions de workflow sans modifier les cinq
-- colonnes existantes.
CREATE OR REPLACE FUNCTION public.snp_permission_allowed(p_role text,p_module_id uuid,p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT coalesce((
    SELECT CASE
      WHEN public.snp_access_action_to_legacy(p_action) IS NULL THEN false
      WHEN p_role='owner' THEN true
      WHEN NOT coalesce(module.is_active,true) THEN false
      ELSE coalesce(CASE public.snp_access_action_to_legacy(p_action)
        WHEN 'view' THEN ceiling.can_view WHEN 'create' THEN ceiling.can_create
        WHEN 'edit' THEN ceiling.can_edit WHEN 'delete' THEN ceiling.can_delete
        WHEN 'approve' THEN ceiling.can_approve ELSE false END,false)
      END
    FROM public.modules module
    LEFT JOIN public.snp_role_module_ceilings ceiling
      ON ceiling.role=p_role AND ceiling.access_domain=module.access_domain
    WHERE module.id=p_module_id
  ),false);
$fn$;

CREATE OR REPLACE FUNCTION public.snp_user_permission_allowed(p_user_id uuid,p_module_id uuid,p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT coalesce((
    SELECT CASE
      WHEN profile.role='owner' AND profile.is_active THEN true
      ELSE public.snp_access_legacy_user_permission_allowed(p_user_id,p_module_id,p_action)
        AND public.snp_effective_access_for_user(p_user_id,module.name,p_action)
      END
    FROM public.user_profiles profile CROSS JOIN public.modules module
    WHERE profile.id=p_user_id AND module.id=p_module_id
  ),false);
$fn$;

CREATE OR REPLACE FUNCTION public.snp_actor_can_module_action(p_module_code text,p_action text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_navigation_code text;
  v_root_code text;
  v_module_id uuid;
BEGIN
  WITH RECURSIVE ancestors AS (
    SELECT module.id,module.code,module.parent_id FROM public.snp_modules module WHERE module.code=p_module_code
    UNION ALL
    SELECT parent.id,parent.code,parent.parent_id
    FROM public.snp_modules parent JOIN ancestors ON ancestors.parent_id=parent.id
  )
  SELECT requested.code,root.code,permission.id
  INTO v_navigation_code,v_root_code,v_module_id
  FROM public.snp_modules requested
  CROSS JOIN LATERAL (
    SELECT code FROM ancestors WHERE parent_id IS NULL LIMIT 1
  ) root
  LEFT JOIN public.modules permission ON permission.name=root.code
  WHERE requested.code=p_module_code;

  IF v_navigation_code IS NULL OR v_module_id IS NULL THEN RETURN false; END IF;
  IF coalesce(auth.role(),'')='service_role' THEN RETURN true; END IF;
  IF auth.uid() IS NULL OR NOT public.snp_session_est_active() THEN RETURN false; END IF;

  SELECT * INTO v_profile FROM public.user_profiles WHERE id=auth.uid();
  IF NOT FOUND OR NOT v_profile.is_active THEN RETURN false; END IF;
  IF v_profile.role='owner' THEN RETURN true; END IF;
  IF public.snp_access_action_to_legacy(p_action)<>'view' AND NOT public.snp_mfa_satisfaite() THEN RETURN false; END IF;

  RETURN public.snp_access_legacy_user_permission_allowed(auth.uid(),v_module_id,p_action)
    AND public.snp_effective_access_for_user(auth.uid(),v_navigation_code,p_action);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_actor_categories()
RETURNS TABLE(
  code text,name text,description text,resource_kind text,legacy_role text,
  is_active boolean,sort_order integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF NOT public.snp_access_admin_authorized(false,false) THEN
    RAISE EXCEPTION 'Consultation des catégories non autorisée.' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT category.code,category.name,category.description,category.resource_kind,
    category.legacy_role,category.is_active,category.sort_order
  FROM public.snp_actor_categories category
  WHERE category.is_active ORDER BY category.sort_order,category.name;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_portals_list(p_include_inactive boolean DEFAULT true)
RETURNS TABLE(
  id uuid,code text,name text,description text,institutional_scope text,
  is_active boolean,is_system boolean,role_count bigint,user_count bigint,
  active_group_count bigint,updated_at timestamptz,updated_by_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF NOT public.snp_access_admin_authorized(false,false) THEN
    RAISE EXCEPTION 'Consultation des portails non autorisée.' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT portal.id,portal.code,portal.name,portal.description,portal.institutional_scope,
    portal.is_active,portal.is_system,
    (SELECT count(*) FROM public.snp_access_roles role
      WHERE role.portal_id=portal.id AND role.deleted_at IS NULL),
    (SELECT count(*) FROM public.snp_user_access_assignments assignment
      WHERE assignment.portal_id=portal.id),
    (SELECT count(*) FROM public.snp_portal_navigation_groups group_state
      WHERE group_state.portal_id=portal.id AND group_state.is_active),
    portal.updated_at,editor.full_name
  FROM public.snp_access_portals portal
  LEFT JOIN public.user_profiles editor ON editor.id=portal.updated_by
  WHERE portal.deleted_at IS NULL AND (p_include_inactive OR portal.is_active)
  ORDER BY portal.name;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_portal_configuration(p_portal_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_portal jsonb; v_groups jsonb; v_modules jsonb;
BEGIN
  IF NOT public.snp_access_admin_authorized(false,false) THEN
    RAISE EXCEPTION 'Consultation de la configuration non autorisée.' USING ERRCODE='42501';
  END IF;
  IF p_portal_id IS NOT NULL THEN
    SELECT to_jsonb(summary) INTO v_portal
    FROM public.snp_access_portals_list(true) summary WHERE summary.id=p_portal_id;
    IF v_portal IS NULL THEN RAISE EXCEPTION 'Portail introuvable.' USING ERRCODE='P0002'; END IF;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'code',navigation.code,'name',navigation.name,'sort_order',navigation.sort_order,
    'is_active',coalesce(state.is_active,false),'is_visible',coalesce(state.is_visible,false)
  ) ORDER BY navigation.sort_order,navigation.name),'[]'::jsonb)
  INTO v_groups
  FROM public.snp_navigation_groups navigation
  LEFT JOIN public.snp_portal_navigation_groups state
    ON state.group_code=navigation.code AND state.portal_id=p_portal_id
  WHERE navigation.is_active;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',module.id,'code',module.code,'name',module.nom,'description',module.description,
    'route',module.route,'parent_id',module.parent_id,'group_code',group_link.group_code,
    'group_name',navigation.name,'sort_order',coalesce(group_link.sort_order,module.ordre,0),
    'is_globally_active',coalesce(module.est_actif,false),
    'is_portal_active',coalesce(state.is_active,false),
    'is_portal_visible',coalesce(state.is_visible,false),
    'permissions',coalesce((SELECT jsonb_agg(applicable.permission_code ORDER BY catalog.sort_order)
      FROM public.snp_module_applicable_permissions applicable
      JOIN public.snp_permission_catalog catalog ON catalog.code=applicable.permission_code
      WHERE applicable.module_id=module.id AND catalog.is_active),'[]'::jsonb)
  ) ORDER BY navigation.sort_order,coalesce(group_link.sort_order,module.ordre,0),module.nom),'[]'::jsonb)
  INTO v_modules
  FROM public.snp_modules module
  LEFT JOIN public.snp_navigation_group_modules group_link ON group_link.module_id=module.id
  LEFT JOIN public.snp_navigation_groups navigation ON navigation.code=group_link.group_code
  LEFT JOIN public.snp_portal_modules state
    ON state.module_id=module.id AND state.portal_id=p_portal_id;

  RETURN jsonb_build_object('portal',v_portal,'groups',v_groups,'modules',v_modules);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_roles_list(
  p_portal_id uuid DEFAULT NULL,p_include_inactive boolean DEFAULT true
) RETURNS TABLE(
  id uuid,portal_id uuid,portal_code text,portal_name text,code text,name text,
  description text,legacy_role text,is_active boolean,is_system boolean,
  user_count bigint,updated_at timestamptz,updated_by_name text,category_codes text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF NOT public.snp_access_admin_authorized(false,false) THEN
    RAISE EXCEPTION 'Consultation des rôles non autorisée.' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT role.id,role.portal_id,portal.code,portal.name,role.code,role.name,
    role.description,role.legacy_role,role.is_active,role.is_system,
    (SELECT count(*) FROM public.snp_user_access_assignments assignment WHERE assignment.role_id=role.id),
    role.updated_at,editor.full_name,
    coalesce((SELECT array_agg(category.category_code ORDER BY category.category_code)
      FROM public.snp_access_role_categories category WHERE category.role_id=role.id),'{}'::text[])
  FROM public.snp_access_roles role
  JOIN public.snp_access_portals portal ON portal.id=role.portal_id
  LEFT JOIN public.user_profiles editor ON editor.id=role.updated_by
  WHERE role.deleted_at IS NULL AND portal.deleted_at IS NULL
    AND (p_portal_id IS NULL OR role.portal_id=p_portal_id)
    AND (p_include_inactive OR (role.is_active AND portal.is_active))
  ORDER BY portal.name,role.name;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_role_matrix(p_role_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_role jsonb; v_modules jsonb; v_permissions jsonb; v_portal_id uuid;
BEGIN
  IF NOT public.snp_access_admin_authorized(false,false) THEN
    RAISE EXCEPTION 'Consultation de la matrice non autorisée.' USING ERRCODE='42501';
  END IF;
  SELECT summary.portal_id,to_jsonb(summary) INTO v_portal_id,v_role
  FROM public.snp_access_roles_list(NULL,true) summary WHERE summary.id=p_role_id;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Rôle introuvable.' USING ERRCODE='P0002'; END IF;

  SELECT configuration->'modules' INTO v_modules
  FROM (SELECT public.snp_access_portal_configuration(v_portal_id) AS configuration) source;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'module_id',applicable.module_id,'permission_code',applicable.permission_code,
    'allowed',coalesce(permission.allowed,false)
  ) ORDER BY module.ordre,catalog.sort_order),'[]'::jsonb)
  INTO v_permissions
  FROM public.snp_portal_modules portal_module
  JOIN public.snp_module_applicable_permissions applicable ON applicable.module_id=portal_module.module_id
  JOIN public.snp_modules module ON module.id=portal_module.module_id
  JOIN public.snp_permission_catalog catalog ON catalog.code=applicable.permission_code AND catalog.is_active
  LEFT JOIN public.snp_access_role_permissions permission
    ON permission.role_id=p_role_id AND permission.module_id=applicable.module_id
      AND permission.permission_code=applicable.permission_code
  WHERE portal_module.portal_id=v_portal_id AND portal_module.is_active;

  RETURN jsonb_build_object('role',v_role,'modules',v_modules,'permissions',v_permissions);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_resources_search(
  p_category_code text,p_query text DEFAULT '',p_offset integer DEFAULT 0,p_limit integer DEFAULT 20
) RETURNS TABLE(
  id uuid,category_code text,resource_kind text,display_name text,secondary_name text,
  code text,email text,phone text,address text,representative text,status text,
  organization_id uuid,organization_name text,details jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE
  v_kind text;
  v_legacy_role text;
  v_expected_organization_type text;
  v_query text:='%'||lower(trim(coalesce(p_query,'')))||'%';
BEGIN
  IF NOT public.snp_access_admin_authorized(false,false) THEN
    RAISE EXCEPTION 'Recherche de ressources non autorisée.' USING ERRCODE='42501';
  END IF;
  IF p_offset<0 OR p_limit NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Pagination invalide.' USING ERRCODE='22023';
  END IF;
  SELECT category.resource_kind,category.legacy_role INTO v_kind,v_legacy_role
  FROM public.snp_actor_categories category
  WHERE category.code=p_category_code AND category.is_active;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'Catégorie inconnue.' USING ERRCODE='22023'; END IF;
  IF v_kind='identity' THEN RETURN; END IF;
  SELECT policy.organization_type INTO v_expected_organization_type
  FROM public.snp_access_role_policies policy WHERE policy.role=v_legacy_role;
  IF v_legacy_role='collector' THEN v_expected_organization_type:='comptoir'; END IF;

  IF v_kind='mining_company' THEN
    RETURN QUERY SELECT company.id,p_category_code,v_kind,company.name,company.abbreviation,company.code,
      company.contact_person_email,company.contact_person_phone,
      concat_ws(', ',company.address,company.city,company.region),company.contact_person_name,
      CASE WHEN coalesce(company.is_active,false) THEN 'Actif' ELSE 'Inactif' END,
      organization.id,organization.name,
      jsonb_strip_nulls(jsonb_build_object('raison_sociale',company.name,'registre',company.registration_number,
        'identifiant_fiscal',company.tax_id,'pays',company.country,'type',company.company_type))
    FROM public.mining_companies company
    LEFT JOIN public.snp_organizations organization
      ON organization.mining_company_id=company.id AND organization.is_active
    WHERE lower(concat_ws(' ',company.name,company.abbreviation,company.code,company.registration_number)) LIKE v_query
    ORDER BY company.name OFFSET p_offset LIMIT p_limit;
  ELSIF v_kind='organization' THEN
    RETURN QUERY SELECT organization.id,p_category_code,v_kind,organization.name,organization.short_name,
      organization.code,organization.email,organization.phone,organization.address,NULL::text,
      CASE WHEN organization.is_active THEN 'Actif' ELSE 'Inactif' END,
      organization.id,organization.name,
      jsonb_strip_nulls(jsonb_build_object('forme_juridique',organization.legal_form,
        'region',organization.administrative_region,'type',organization.organization_type,
        'sous_type',organization.organization_subtype))
    FROM public.snp_organizations organization
    WHERE organization.organization_type=v_expected_organization_type
      AND lower(concat_ws(' ',organization.name,organization.short_name,organization.code)) LIKE v_query
    ORDER BY organization.name OFFSET p_offset LIMIT p_limit;
  ELSIF v_kind IN ('artisan','collector') THEN
    RETURN QUERY SELECT artisan.id,p_category_code,v_kind,
      coalesce(nullif(trim(concat_ws(' ',artisan.prenoms,artisan.nom)),''),artisan.raison_sociale,'Sans nom'),
      artisan.raison_sociale,coalesce(artisan.numero_carte,artisan.numero_piece_identite),
      artisan.email,artisan.telephone,concat_ws(', ',artisan.adresse,artisan.commune,artisan.region),NULL::text,
      CASE WHEN artisan.actif THEN 'Actif' ELSE 'Inactif' END,
      collector_scope.comptoir_organization_id,organization.name,
      jsonb_strip_nulls(jsonb_build_object('type_personne',artisan.type_personne,
        'type_acteur',artisan.type_artisan,'numero_carte',artisan.numero_carte,
        'registre_commerce',artisan.numero_registre_commerce,'site_id',artisan.artisanal_site_id))
    FROM public.snp_artisans_miniers artisan
    LEFT JOIN LATERAL (
      SELECT assignment.comptoir_organization_id
      FROM public.snp_collector_artisan_assignments assignment
      WHERE assignment.collector_id=artisan.id AND assignment.valid_until IS NULL
        AND assignment.comptoir_organization_id IS NOT NULL
      ORDER BY assignment.valid_from DESC LIMIT 1
    ) collector_scope ON true
    LEFT JOIN public.snp_organizations organization ON organization.id=collector_scope.comptoir_organization_id
    WHERE ((v_kind='collector' AND artisan.type_artisan='collecteur')
      OR (v_kind='artisan' AND artisan.type_artisan<>'collecteur'))
      AND lower(concat_ws(' ',artisan.nom,artisan.prenoms,artisan.raison_sociale,
        artisan.numero_carte,artisan.numero_piece_identite,artisan.telephone)) LIKE v_query
    ORDER BY artisan.raison_sociale NULLS LAST,artisan.nom,artisan.prenoms
    OFFSET p_offset LIMIT p_limit;
  ELSIF v_kind='artisanal_site' THEN
    RETURN QUERY SELECT site.id,p_category_code,v_kind,site.name,site.locality,site.code,
      NULL::text,NULL::text,concat_ws(', ',site.locality,site.province,site.region),NULL::text,
      CASE WHEN lower(site.status) IN ('active','actif','approved') THEN 'Actif' ELSE site.status END,
      NULL::uuid,NULL::text,
      jsonb_strip_nulls(jsonb_build_object('type_exploitation',site.exploitation_type,
        'region',site.region,'province',site.province,'superficie_hectares',site.area_hectares,
        'mineurs_actifs',site.active_miners))
    FROM public.artisanal_sites site
    WHERE lower(concat_ws(' ',site.name,site.code,site.locality,site.province,site.region)) LIKE v_query
    ORDER BY site.name OFFSET p_offset LIMIT p_limit;
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_root_permission_module(p_navigation_module_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  WITH RECURSIVE ancestors AS (
    SELECT module.id,module.code,module.parent_id
    FROM public.snp_modules module WHERE module.id=p_navigation_module_id
    UNION ALL
    SELECT parent.id,parent.code,parent.parent_id
    FROM public.snp_modules parent JOIN ancestors ON ancestors.parent_id=parent.id
  )
  SELECT permission.id FROM ancestors
  JOIN public.modules permission ON permission.name=ancestors.code
  WHERE ancestors.parent_id IS NULL LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_portal_save(
  p_portal_id uuid,p_code text,p_name text,p_description text,p_institutional_scope text,
  p_is_active boolean,p_groups jsonb,p_modules jsonb,p_reason text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE
  v_actor_role text;
  v_portal public.snp_access_portals%ROWTYPE;
  v_previous jsonb:='{}'::jsonb;
  v_created boolean:=false;
  v_result jsonb;
BEGIN
  IF NOT public.snp_access_admin_authorized(true,false) THEN
    RAISE EXCEPTION 'Modification des portails non autorisée.' USING ERRCODE='42501';
  END IF;
  SELECT profile.role INTO v_actor_role FROM public.user_profiles profile WHERE profile.id=auth.uid();
  IF p_portal_id IS NULL AND v_actor_role<>'owner' THEN
    RAISE EXCEPTION 'La création d’un portail est réservée au Super Administrateur.' USING ERRCODE='42501';
  END IF;
  IF length(trim(coalesce(p_reason,'')))<10 THEN
    RAISE EXCEPTION 'Un motif détaillé est obligatoire.' USING ERRCODE='22023';
  END IF;
  IF trim(coalesce(p_code,'')) !~ '^[a-z][a-z0-9-]{1,49}$'
    OR length(trim(coalesce(p_name,''))) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Code ou nom de portail invalide.' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(coalesce(p_groups,'[]'::jsonb))<>'array'
    OR jsonb_typeof(coalesce(p_modules,'[]'::jsonb))<>'array'
    OR jsonb_array_length(coalesce(p_groups,'[]'::jsonb))>100
    OR jsonb_array_length(coalesce(p_modules,'[]'::jsonb))>1000 THEN
    RAISE EXCEPTION 'Configuration de portail invalide.' USING ERRCODE='22023';
  END IF;

  IF p_portal_id IS NULL THEN
    INSERT INTO public.snp_access_portals(
      code,name,description,institutional_scope,is_active,created_by,updated_by
    ) VALUES(
      trim(p_code),trim(p_name),nullif(trim(coalesce(p_description,'')),''),
      nullif(trim(coalesce(p_institutional_scope,'')),''),coalesce(p_is_active,true),auth.uid(),auth.uid()
    ) RETURNING * INTO v_portal;
    v_created:=true;
  ELSE
    SELECT * INTO v_portal FROM public.snp_access_portals
    WHERE id=p_portal_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Portail introuvable.' USING ERRCODE='P0002'; END IF;
    v_previous:=to_jsonb(v_portal);
    IF v_portal.is_system AND (trim(p_code)<>v_portal.code OR (NOT p_is_active AND v_actor_role<>'owner')) THEN
      RAISE EXCEPTION 'Seul le Super Administrateur peut renommer ou désactiver un portail système.' USING ERRCODE='42501';
    END IF;
    UPDATE public.snp_access_portals SET
      code=trim(p_code),name=trim(p_name),description=nullif(trim(coalesce(p_description,'')),''),
      institutional_scope=nullif(trim(coalesce(p_institutional_scope,'')),''),
      is_active=coalesce(p_is_active,true),updated_by=auth.uid()
    WHERE id=p_portal_id RETURNING * INTO v_portal;
  END IF;

  IF EXISTS(
    SELECT item.code FROM jsonb_to_recordset(coalesce(p_groups,'[]'::jsonb))
      item(code text,is_active boolean,is_visible boolean)
    GROUP BY item.code HAVING count(*)>1
  ) OR EXISTS(
    SELECT item.module_id FROM jsonb_to_recordset(coalesce(p_modules,'[]'::jsonb))
      item(module_id uuid,is_active boolean,is_visible boolean)
    GROUP BY item.module_id HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'Une entrée de configuration est dupliquée.' USING ERRCODE='22023'; END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_to_recordset(coalesce(p_groups,'[]'::jsonb))
      item(code text,is_active boolean,is_visible boolean)
    LEFT JOIN public.snp_navigation_groups navigation ON navigation.code=item.code
    WHERE navigation.code IS NULL
  ) OR EXISTS(
    SELECT 1 FROM jsonb_to_recordset(coalesce(p_modules,'[]'::jsonb))
      item(module_id uuid,is_active boolean,is_visible boolean)
    LEFT JOIN public.snp_modules module ON module.id=item.module_id
    WHERE module.id IS NULL
  ) THEN RAISE EXCEPTION 'Un groupe ou module est inconnu.' USING ERRCODE='22023'; END IF;

  INSERT INTO public.snp_portal_navigation_groups(
    portal_id,group_code,is_active,is_visible,updated_by
  ) SELECT v_portal.id,item.code,coalesce(item.is_active,false),
      coalesce(item.is_visible,false) AND coalesce(item.is_active,false),auth.uid()
  FROM jsonb_to_recordset(coalesce(p_groups,'[]'::jsonb))
    item(code text,is_active boolean,is_visible boolean)
  ON CONFLICT(portal_id,group_code) DO UPDATE SET
    is_active=excluded.is_active,is_visible=excluded.is_visible,
    updated_at=now(),updated_by=auth.uid();

  INSERT INTO public.snp_portal_modules(portal_id,module_id,is_active,is_visible,updated_by)
  SELECT v_portal.id,item.module_id,
    coalesce(item.is_active,false) AND module.est_actif,
    coalesce(item.is_visible,false) AND coalesce(item.is_active,false) AND module.est_actif,
    auth.uid()
  FROM jsonb_to_recordset(coalesce(p_modules,'[]'::jsonb))
    item(module_id uuid,is_active boolean,is_visible boolean)
  JOIN public.snp_modules module ON module.id=item.module_id
  ON CONFLICT(portal_id,module_id) DO UPDATE SET
    is_active=excluded.is_active,is_visible=excluded.is_visible,
    updated_at=now(),updated_by=auth.uid();

  -- Un groupe fermé et tout parent fermé priment sur les sélections enfants.
  UPDATE public.snp_portal_modules portal_module SET
    is_active=false,is_visible=false,updated_at=now(),updated_by=auth.uid()
  FROM public.snp_navigation_group_modules group_link
  JOIN public.snp_portal_navigation_groups group_state
    ON group_state.portal_id=v_portal.id AND group_state.group_code=group_link.group_code
  WHERE portal_module.portal_id=v_portal.id AND portal_module.module_id=group_link.module_id
    AND NOT group_state.is_active;

  WITH RECURSIVE disabled AS (
    SELECT module.id FROM public.snp_portal_modules state
    JOIN public.snp_modules module ON module.id=state.module_id
    WHERE state.portal_id=v_portal.id AND NOT state.is_active
    UNION
    SELECT child.id FROM public.snp_modules child JOIN disabled parent ON child.parent_id=parent.id
  )
  UPDATE public.snp_portal_modules state SET
    is_active=false,is_visible=false,updated_at=now(),updated_by=auth.uid()
  FROM disabled WHERE state.portal_id=v_portal.id AND state.module_id=disabled.id;

  PERFORM public.snp_access_audit_append(
    'portal',v_portal.id,CASE WHEN v_created THEN 'portal_create' ELSE 'portal_update' END,
    NULL,v_portal.name,v_portal.code,NULL,v_previous,to_jsonb(v_portal),'success',trim(p_reason),NULL
  );
  SELECT to_jsonb(summary) INTO v_result
  FROM public.snp_access_portals_list(true) summary WHERE summary.id=v_portal.id;
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_portal_archive(p_portal_id uuid,p_reason text)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_portal public.snp_access_portals%ROWTYPE;
BEGIN
  IF NOT public.snp_access_admin_authorized(true,true) THEN
    RAISE EXCEPTION 'La suppression d’un portail est réservée au Super Administrateur.' USING ERRCODE='42501';
  END IF;
  IF length(trim(coalesce(p_reason,'')))<10 THEN
    RAISE EXCEPTION 'Un motif détaillé est obligatoire.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_portal FROM public.snp_access_portals
  WHERE id=p_portal_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Portail introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_portal.is_system THEN
    RAISE EXCEPTION 'Un portail système doit être désactivé, pas supprimé.' USING ERRCODE='42501';
  END IF;
  UPDATE public.snp_access_portals SET
    is_active=false,deleted_at=clock_timestamp(),deleted_by=auth.uid(),updated_by=auth.uid()
  WHERE id=p_portal_id;
  PERFORM public.snp_access_audit_append(
    'portal',v_portal.id,'portal_archive',NULL,v_portal.name,v_portal.code,NULL,
    to_jsonb(v_portal),jsonb_build_object('deleted_at',clock_timestamp()),'success',trim(p_reason),NULL
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_role_save(
  p_role_id uuid,p_portal_id uuid,p_code text,p_name text,p_description text,
  p_legacy_role text,p_is_active boolean,p_category_codes jsonb,p_permissions jsonb,p_reason text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE
  v_actor_role text;
  v_role public.snp_access_roles%ROWTYPE;
  v_previous jsonb:='{}'::jsonb;
  v_created boolean:=false;
  v_result jsonb;
BEGIN
  IF NOT public.snp_access_admin_authorized(true,false) THEN
    RAISE EXCEPTION 'Modification des rôles non autorisée.' USING ERRCODE='42501';
  END IF;
  SELECT profile.role INTO v_actor_role FROM public.user_profiles profile WHERE profile.id=auth.uid();
  IF length(trim(coalesce(p_reason,'')))<10 THEN
    RAISE EXCEPTION 'Un motif détaillé est obligatoire.' USING ERRCODE='22023';
  END IF;
  IF trim(coalesce(p_code,'')) !~ '^[a-z][a-z0-9-]{1,79}$'
    OR length(trim(coalesce(p_name,''))) NOT BETWEEN 2 AND 140 THEN
    RAISE EXCEPTION 'Code ou nom de rôle invalide.' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.snp_access_portals portal
      WHERE portal.id=p_portal_id AND portal.deleted_at IS NULL AND portal.is_active)
    OR NOT EXISTS(SELECT 1 FROM public.snp_access_role_policies policy WHERE policy.role=p_legacy_role) THEN
    RAISE EXCEPTION 'Portail ou rôle technique incompatible.' USING ERRCODE='23503';
  END IF;
  IF v_actor_role<>'owner' AND public.snp_niveau_role(p_legacy_role)>=public.snp_niveau_role(v_actor_role) THEN
    RAISE EXCEPTION 'Un Administrateur standard ne peut pas gérer ce niveau de rôle.' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(coalesce(p_category_codes,'[]'::jsonb))<>'array'
    OR jsonb_typeof(coalesce(p_permissions,'[]'::jsonb))<>'array'
    OR jsonb_array_length(coalesce(p_category_codes,'[]'::jsonb)) NOT BETWEEN 1 AND 20
    OR jsonb_array_length(coalesce(p_permissions,'[]'::jsonb))>5000 THEN
    RAISE EXCEPTION 'Matrice de rôle invalide.' USING ERRCODE='22023';
  END IF;

  IF p_role_id IS NULL THEN
    INSERT INTO public.snp_access_roles(
      portal_id,code,name,description,legacy_role,is_active,created_by,updated_by
    ) VALUES(
      p_portal_id,trim(p_code),trim(p_name),nullif(trim(coalesce(p_description,'')),''),
      p_legacy_role,coalesce(p_is_active,true),auth.uid(),auth.uid()
    ) RETURNING * INTO v_role;
    v_created:=true;
  ELSE
    SELECT * INTO v_role FROM public.snp_access_roles
    WHERE id=p_role_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Rôle introuvable.' USING ERRCODE='P0002'; END IF;
    v_previous:=to_jsonb(v_role);
    IF v_role.portal_id<>p_portal_id AND EXISTS(
      SELECT 1 FROM public.snp_user_access_assignments assignment WHERE assignment.role_id=v_role.id
    ) THEN RAISE EXCEPTION 'Un rôle affecté ne peut pas changer de portail.' USING ERRCODE='23503'; END IF;
    IF v_role.is_system AND v_actor_role<>'owner'
      AND (v_role.portal_id<>p_portal_id OR v_role.code<>trim(p_code) OR v_role.legacy_role<>p_legacy_role) THEN
      RAISE EXCEPTION 'La structure d’un rôle système est réservée au Super Administrateur.' USING ERRCODE='42501';
    END IF;
    UPDATE public.snp_access_roles SET
      portal_id=p_portal_id,code=trim(p_code),name=trim(p_name),
      description=nullif(trim(coalesce(p_description,'')),''),legacy_role=p_legacy_role,
      is_active=coalesce(p_is_active,true),updated_by=auth.uid()
    WHERE id=p_role_id RETURNING * INTO v_role;
  END IF;

  IF EXISTS(
    SELECT value FROM jsonb_array_elements_text(p_category_codes) GROUP BY value HAVING count(*)>1
  ) OR EXISTS(
    SELECT 1 FROM jsonb_array_elements_text(p_category_codes) category
    LEFT JOIN public.snp_actor_categories catalog ON catalog.code=category.value AND catalog.is_active
    WHERE catalog.code IS NULL
  ) THEN RAISE EXCEPTION 'Une catégorie est inconnue ou dupliquée.' USING ERRCODE='22023'; END IF;

  IF EXISTS(
    SELECT item.module_id,item.permission_code
    FROM jsonb_to_recordset(p_permissions)
      item(module_id uuid,permission_code text,allowed boolean)
    GROUP BY item.module_id,item.permission_code HAVING count(*)>1
  ) OR EXISTS(
    SELECT 1 FROM jsonb_to_recordset(p_permissions)
      item(module_id uuid,permission_code text,allowed boolean)
    LEFT JOIN public.snp_portal_modules portal_module
      ON portal_module.portal_id=p_portal_id AND portal_module.module_id=item.module_id AND portal_module.is_active
    LEFT JOIN public.snp_module_applicable_permissions applicable
      ON applicable.module_id=item.module_id AND applicable.permission_code=item.permission_code
    WHERE portal_module.module_id IS NULL OR applicable.module_id IS NULL
  ) THEN RAISE EXCEPTION 'Une permission vise un module indisponible.' USING ERRCODE='42501'; END IF;

  IF EXISTS(
    SELECT 1 FROM jsonb_to_recordset(p_permissions)
      item(module_id uuid,permission_code text,allowed boolean)
    WHERE coalesce(item.allowed,false)
      AND NOT public.snp_permission_allowed(
        p_legacy_role,public.snp_access_root_permission_module(item.module_id),item.permission_code
      )
  ) THEN RAISE EXCEPTION 'Une permission dépasse le plafond du rôle technique.' USING ERRCODE='42501'; END IF;

  DELETE FROM public.snp_access_role_categories WHERE role_id=v_role.id;
  INSERT INTO public.snp_access_role_categories(role_id,category_code)
  SELECT v_role.id,value FROM jsonb_array_elements_text(p_category_codes);

  DELETE FROM public.snp_access_role_permissions WHERE role_id=v_role.id;
  INSERT INTO public.snp_access_role_permissions(
    role_id,module_id,permission_code,allowed,updated_by
  ) SELECT v_role.id,item.module_id,item.permission_code,true,auth.uid()
  FROM jsonb_to_recordset(p_permissions)
    item(module_id uuid,permission_code text,allowed boolean)
  WHERE coalesce(item.allowed,false);

  PERFORM public.snp_access_audit_append(
    'role',v_role.id,CASE WHEN v_created THEN 'role_create' ELSE 'role_update' END,
    NULL,v_role.name,(SELECT code FROM public.snp_access_portals WHERE id=v_role.portal_id),v_role.code,
    v_previous,to_jsonb(v_role)||jsonb_build_object('permission_count',(
      SELECT count(*) FROM public.snp_access_role_permissions WHERE role_id=v_role.id
    )),'success',trim(p_reason),NULL
  );
  SELECT to_jsonb(summary) INTO v_result
  FROM public.snp_access_roles_list(NULL,true) summary WHERE summary.id=v_role.id;
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_user_assignment_save(
  p_user_id uuid,p_portal_id uuid,p_role_id uuid,p_actor_category_code text,
  p_resource_type text DEFAULT NULL,p_resource_id uuid DEFAULT NULL,
  p_restrictions jsonb DEFAULT '[]'::jsonb,p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE
  v_actor_role text;
  v_profile public.user_profiles%ROWTYPE;
  v_role public.snp_access_roles%ROWTYPE;
  v_category public.snp_actor_categories%ROWTYPE;
  v_previous jsonb:='{}'::jsonb;
  v_result jsonb;
BEGIN
  IF NOT public.snp_access_admin_authorized(true,false) THEN
    RAISE EXCEPTION 'Affectation des accès non autorisée.' USING ERRCODE='42501';
  END IF;
  SELECT profile.role INTO v_actor_role FROM public.user_profiles profile WHERE profile.id=auth.uid();
  SELECT * INTO v_profile FROM public.user_profiles profile WHERE profile.id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Utilisateur introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_actor_role<>'owner' AND public.snp_niveau_role(v_profile.role)>=public.snp_niveau_role(v_actor_role) THEN
    RAISE EXCEPTION 'Un Administrateur standard ne peut pas gérer ce niveau de compte.' USING ERRCODE='42501';
  END IF;
  IF length(trim(coalesce(p_reason,'')))<10 THEN
    RAISE EXCEPTION 'Un motif détaillé est obligatoire.' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(coalesce(p_restrictions,'[]'::jsonb))<>'array'
    OR jsonb_array_length(coalesce(p_restrictions,'[]'::jsonb))>1000 THEN
    RAISE EXCEPTION 'Restrictions individuelles invalides.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_role FROM public.snp_access_roles role
  WHERE role.id=p_role_id AND role.portal_id=p_portal_id
    AND role.is_active AND role.deleted_at IS NULL;
  IF NOT FOUND OR NOT EXISTS(
    SELECT 1 FROM public.snp_access_portals portal
    WHERE portal.id=p_portal_id AND portal.is_active AND portal.deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'Portail ou rôle indisponible.' USING ERRCODE='23503'; END IF;
  SELECT * INTO v_category FROM public.snp_actor_categories category
  WHERE category.code=p_actor_category_code AND category.is_active;
  IF NOT FOUND OR NOT EXISTS(
    SELECT 1 FROM public.snp_access_role_categories category_role
    WHERE category_role.role_id=p_role_id AND category_role.category_code=p_actor_category_code
  ) THEN RAISE EXCEPTION 'Catégorie incompatible avec le rôle.' USING ERRCODE='23503'; END IF;
  IF v_role.legacy_role<>v_profile.role THEN
    RAISE EXCEPTION 'Le rôle technique du compte est incompatible avec l’affectation.' USING ERRCODE='23503';
  END IF;
  IF (v_category.resource_kind='identity' AND (p_resource_type IS NOT NULL OR p_resource_id IS NOT NULL))
    OR (v_category.resource_kind<>'identity' AND (
      p_resource_type IS DISTINCT FROM v_category.resource_kind OR p_resource_id IS NULL
    )) THEN RAISE EXCEPTION 'La ressource sélectionnée est incompatible avec la catégorie.' USING ERRCODE='23503'; END IF;
  IF p_resource_id IS NOT NULL AND CASE v_category.resource_kind
    WHEN 'mining_company' THEN NOT EXISTS(SELECT 1 FROM public.mining_companies resource WHERE resource.id=p_resource_id)
    WHEN 'organization' THEN NOT EXISTS(SELECT 1 FROM public.snp_organizations resource WHERE resource.id=p_resource_id AND resource.is_active)
    WHEN 'artisan' THEN NOT EXISTS(SELECT 1 FROM public.snp_artisans_miniers resource WHERE resource.id=p_resource_id AND resource.actif AND resource.type_artisan<>'collecteur')
    WHEN 'collector' THEN NOT EXISTS(SELECT 1 FROM public.snp_artisans_miniers resource WHERE resource.id=p_resource_id AND resource.actif AND resource.type_artisan='collecteur')
    WHEN 'artisanal_site' THEN NOT EXISTS(SELECT 1 FROM public.artisanal_sites resource WHERE resource.id=p_resource_id)
    ELSE false END THEN
    RAISE EXCEPTION 'La ressource métier n’existe plus ou n’est plus active.' USING ERRCODE='23503';
  END IF;
  IF EXISTS(
    SELECT item.module_id,item.permission_code
    FROM jsonb_to_recordset(p_restrictions)
      item(module_id uuid,permission_code text,denied boolean,reason text)
    GROUP BY item.module_id,item.permission_code HAVING count(*)>1
  ) OR EXISTS(
    SELECT 1 FROM jsonb_to_recordset(p_restrictions)
      item(module_id uuid,permission_code text,denied boolean,reason text)
    LEFT JOIN public.snp_access_role_permissions role_permission
      ON role_permission.role_id=p_role_id AND role_permission.module_id=item.module_id
        AND role_permission.permission_code=item.permission_code AND role_permission.allowed
    WHERE NOT coalesce(item.denied,false) OR role_permission.role_id IS NULL
      OR length(trim(coalesce(item.reason,'')))<5
  ) THEN
    RAISE EXCEPTION 'Une restriction est invalide ou tenterait d’accorder un droit.' USING ERRCODE='42501';
  END IF;

  SELECT to_jsonb(existing) INTO v_previous
  FROM public.snp_access_user_assignment(p_user_id) existing;
  INSERT INTO public.snp_user_access_assignments(
    user_id,portal_id,role_id,actor_category_code,organization_id,resource_type,resource_id,
    is_active,assigned_by,assigned_at,updated_by
  ) VALUES(
    p_user_id,p_portal_id,p_role_id,p_actor_category_code,
    CASE WHEN p_resource_type='organization' THEN p_resource_id ELSE NULL END,p_resource_type,p_resource_id,
    v_profile.is_active,auth.uid(),clock_timestamp(),auth.uid()
  ) ON CONFLICT(user_id) DO UPDATE SET
    portal_id=excluded.portal_id,role_id=excluded.role_id,
    actor_category_code=excluded.actor_category_code,resource_type=excluded.resource_type,
    resource_id=excluded.resource_id,organization_id=excluded.organization_id,is_active=excluded.is_active,
    assigned_by=excluded.assigned_by,assigned_at=excluded.assigned_at,updated_by=excluded.updated_by;

  DELETE FROM public.snp_user_permission_restrictions WHERE user_id=p_user_id;
  INSERT INTO public.snp_user_permission_restrictions(
    user_id,module_id,permission_code,denied,reason,created_by
  ) SELECT p_user_id,item.module_id,item.permission_code,true,trim(item.reason),auth.uid()
  FROM jsonb_to_recordset(p_restrictions)
    item(module_id uuid,permission_code text,denied boolean,reason text)
  WHERE item.denied;

  -- La matrice précise devient la source des anciennes lignes CRUD utilisées
  -- par les écrans non encore migrés. Cette projection n’élargit rien : chaque
  -- colonne reste bornée par le plafond technique du rôle.
  DELETE FROM public.user_permissions WHERE user_id=p_user_id;
  INSERT INTO public.user_permissions(
    user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,
    can_read,can_write,field_permissions,granted_by
  )
  WITH role_grants AS (
    SELECT DISTINCT public.snp_access_root_permission_module(permission.module_id) AS root_id,
      permission.permission_code
    FROM public.snp_access_role_permissions permission
    WHERE permission.role_id=p_role_id AND permission.allowed
  ), aggregated AS (
    SELECT root_id,
      bool_or(permission_code='view') AS can_view,
      bool_or(permission_code='create') AS can_create,
      bool_or(permission_code IN ('edit','submit','validate','reject')) AS can_edit,
      bool_or(permission_code='delete') AS can_delete,
      bool_or(permission_code='approve') AS can_approve
    FROM role_grants WHERE root_id IS NOT NULL GROUP BY root_id
  )
  SELECT p_user_id,aggregated.root_id,
    aggregated.can_view AND public.snp_permission_allowed(v_profile.role,aggregated.root_id,'view'),
    aggregated.can_create AND public.snp_permission_allowed(v_profile.role,aggregated.root_id,'create'),
    aggregated.can_edit AND public.snp_permission_allowed(v_profile.role,aggregated.root_id,'edit'),
    aggregated.can_delete AND public.snp_permission_allowed(v_profile.role,aggregated.root_id,'delete'),
    aggregated.can_approve AND public.snp_permission_allowed(v_profile.role,aggregated.root_id,'approve'),
    aggregated.can_view AND public.snp_permission_allowed(v_profile.role,aggregated.root_id,'view'),
    (aggregated.can_create OR aggregated.can_edit OR aggregated.can_delete OR aggregated.can_approve),
    '{}'::jsonb,auth.uid()
  FROM aggregated;

  SELECT to_jsonb(assignment) INTO v_result
  FROM public.snp_access_user_assignment(p_user_id) assignment;
  PERFORM public.snp_access_audit_append(
    'user_access',p_user_id,'user_access_assignment',p_user_id,
    coalesce(v_profile.full_name,v_profile.email),
    (SELECT code FROM public.snp_access_portals WHERE id=p_portal_id),v_role.code,
    coalesce(v_previous,'{}'::jsonb),coalesce(v_result,'{}'::jsonb),'success',trim(p_reason),NULL
  );
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_user_account_update(
  p_user_id uuid,p_full_name text,p_phone text,p_job_title text,p_department text,
  p_is_active boolean,p_portal_id uuid,p_role_id uuid,p_actor_category_code text,
  p_resource_type text DEFAULT NULL,p_resource_id uuid DEFAULT NULL,
  p_responsibilities jsonb DEFAULT '{}'::jsonb,
  p_restrictions jsonb DEFAULT '[]'::jsonb,p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE
  v_role public.snp_access_roles%ROWTYPE;
  v_mining_company_id uuid;
  v_organization_id uuid;
  v_collector_id uuid;
  v_result jsonb;
BEGIN
  IF NOT public.snp_access_admin_authorized(true,false) THEN
    RAISE EXCEPTION 'Modification du compte non autorisée.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_role FROM public.snp_access_roles role
  WHERE role.id=p_role_id AND role.portal_id=p_portal_id
    AND role.is_active AND role.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rôle précis introuvable.' USING ERRCODE='23503'; END IF;
  IF p_resource_type='mining_company' THEN v_mining_company_id:=p_resource_id; END IF;
  IF p_resource_type='organization' THEN v_organization_id:=p_resource_id; END IF;
  IF p_resource_type='collector' THEN
    v_collector_id:=p_resource_id;
    SELECT assignment.comptoir_organization_id INTO v_organization_id
    FROM public.snp_collector_artisan_assignments assignment
    WHERE assignment.collector_id=p_resource_id AND assignment.valid_until IS NULL
      AND assignment.comptoir_organization_id IS NOT NULL
    ORDER BY assignment.valid_from DESC LIMIT 1;
  END IF;
  PERFORM public.snp_configurer_acces_compte(
    p_user_id,p_full_name,p_phone,v_role.legacy_role,coalesce(p_is_active,true),
    v_mining_company_id,v_organization_id,v_collector_id,
    coalesce(p_responsibilities,'{}'::jsonb),'[]'::jsonb
  );
  UPDATE public.user_profiles SET
    job_title=nullif(trim(coalesce(p_job_title,'')),''),
    department=nullif(trim(coalesce(p_department,'')),''),updated_at=now()
  WHERE id=p_user_id;
  v_result:=public.snp_access_user_assignment_save(
    p_user_id,p_portal_id,p_role_id,p_actor_category_code,p_resource_type,
    p_resource_id,p_restrictions,p_reason
  );
  RETURN v_result;
END;
$fn$;

-- Le statut du compte historique reste le coupe-circuit d’autorité. Un changement
-- explicite de rôle réinitialise l’affectation vers le rôle système compatible ;
-- une personnalisation précise pourra ensuite être appliquée par la transaction
-- d’administration.
CREATE OR REPLACE FUNCTION public.snp_access_sync_profile_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_role public.snp_access_roles%ROWTYPE; v_category text;
BEGIN
  IF TG_OP='UPDATE' AND NEW.role IS NOT DISTINCT FROM OLD.role THEN
    UPDATE public.snp_user_access_assignments SET is_active=NEW.is_active,updated_by=auth.uid()
    WHERE user_id=NEW.id AND is_active IS DISTINCT FROM NEW.is_active;
    RETURN NEW;
  END IF;
  SELECT role.* INTO v_role
  FROM public.snp_access_roles role
  JOIN public.snp_access_portals portal ON portal.id=role.portal_id
  WHERE role.legacy_role=NEW.role AND role.is_system AND role.is_active
    AND role.deleted_at IS NULL AND portal.is_active AND portal.deleted_at IS NULL
  ORDER BY role.created_at LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT category.code INTO v_category FROM public.snp_actor_categories category
  JOIN public.snp_access_role_categories link
    ON link.role_id=v_role.id AND link.category_code=category.code
  WHERE category.is_active
  ORDER BY category.sort_order LIMIT 1;
  IF v_category IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.snp_user_access_assignments(
    user_id,portal_id,role_id,actor_category_code,is_active,assigned_by,updated_by
  ) VALUES(NEW.id,v_role.portal_id,v_role.id,v_category,NEW.is_active,auth.uid(),auth.uid())
  ON CONFLICT(user_id) DO UPDATE SET
    portal_id=excluded.portal_id,role_id=excluded.role_id,
    actor_category_code=excluded.actor_category_code,resource_type=NULL,resource_id=NULL,
    is_active=excluded.is_active,updated_by=excluded.updated_by;
  DELETE FROM public.snp_user_permission_restrictions WHERE user_id=NEW.id;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_snp_access_sync_profile_assignment
AFTER INSERT OR UPDATE OF role,is_active ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.snp_access_sync_profile_assignment();

ALTER TABLE public.snp_actor_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_access_portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_navigation_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_navigation_group_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_portal_navigation_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_portal_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_permission_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_module_applicable_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_access_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_access_role_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_access_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_user_access_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_user_permission_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_access_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.snp_actor_categories,public.snp_access_portals,
  public.snp_navigation_groups,public.snp_navigation_group_modules,
  public.snp_portal_navigation_groups,public.snp_portal_modules,
  public.snp_permission_catalog,public.snp_module_applicable_permissions,
  public.snp_access_roles,public.snp_access_role_categories,
  public.snp_access_role_permissions,public.snp_user_access_assignments,
  public.snp_user_permission_restrictions,public.snp_access_audit_log
FROM PUBLIC,anon,authenticated;

DO $privileges$
DECLARE function_record record;
BEGIN
  FOR function_record IN
    SELECT procedure.oid::regprocedure AS signature
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid=procedure.pronamespace
    WHERE namespace.nspname='public'
      AND (procedure.proname LIKE 'snp_access_%'
        OR procedure.proname IN ('snp_current_access_context','snp_effective_access_for_user'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',function_record.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',function_record.signature);
  END LOOP;
END;
$privileges$;

GRANT EXECUTE ON FUNCTION public.snp_access_actor_categories() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_portals_list(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_portal_configuration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_roles_list(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_role_matrix(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_resources_search(text,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_compatible_portals(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_compatible_roles(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_user_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_effective_matrix(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_audit_feed(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_audit_export(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_portal_save(uuid,text,text,text,text,boolean,jsonb,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_portal_archive(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_role_save(uuid,uuid,text,text,text,text,boolean,jsonb,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_user_assignment_save(uuid,uuid,uuid,text,text,uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_access_user_account_update(uuid,text,text,text,text,boolean,uuid,uuid,text,text,uuid,jsonb,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_current_access_context() TO authenticated;

DO $postflight$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.snp_actor_categories WHERE code='administrateur' AND is_active)
    OR NOT EXISTS(SELECT 1 FROM public.snp_permission_catalog WHERE code='admin' AND is_active)
    OR NOT EXISTS(SELECT 1 FROM public.snp_access_portals WHERE code='sonasp' AND deleted_at IS NULL)
    OR EXISTS(
      SELECT 1 FROM public.snp_user_access_assignments assignment
      JOIN public.snp_access_roles role ON role.id=assignment.role_id
      WHERE assignment.portal_id<>role.portal_id
    )
    OR EXISTS(
      SELECT 1 FROM public.user_profiles profile
      WHERE NOT EXISTS(SELECT 1 FROM public.snp_user_access_assignments assignment WHERE assignment.user_id=profile.id)
    ) THEN
    RAISE EXCEPTION 'Postflight gouvernance des accès : invariants incomplets.';
  END IF;
END;
$postflight$;

NOTIFY pgrst,'reload schema';
COMMIT;
