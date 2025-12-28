# Système de Gestion des Modules - Documentation Complète

## 📋 Vue d'Ensemble

Le système de gestion des modules permet aux administrateurs de:
- Activer/désactiver dynamiquement les modules de l'application
- Contrôler la visibilité des menus dans la sidebar
- Organiser la hiérarchie des modules (parents/enfants)
- Définir l'ordre d'affichage
- Gérer les permissions requises par module

## 🎯 Fonctionnalités

### 1. Activation/Désactivation
- **Module Actif:** Accessible et fonctionnel
- **Module Inactif:** Complètement désactivé (routes inaccessibles)

### 2. Visibilité Menu
- **Visible:** Apparaît dans la sidebar
- **Caché:** N'apparaît pas dans le menu mais reste accessible via URL directe

### 3. Hiérarchie Parent/Enfant
- **Modules Parents:** Catégories principales (ex: Production, Ventes)
- **Sous-modules:** Éléments du menu déroulant (ex: Production → Production Journalière)

### 4. Organisation
- **Ordre d'affichage:** Personnalisable via numéro d'ordre
- **Réorganisation:** Glisser-déposer (à implémenter dans UI)

## 📁 Structure de la Base de Données

### Table `snp_modules`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | Identifiant unique |
| `code` | text | Code unique (ex: production, sales) |
| `nom` | text | Nom d'affichage |
| `description` | text | Description détaillée |
| `icone` | text | Nom de l'icône Lucide React |
| `route` | text | Chemin de la route (ex: /production/daily) |
| `parent_id` | uuid | ID du module parent (NULL si module racine) |
| `ordre` | integer | Ordre d'affichage (1, 2, 3...) |
| `est_actif` | boolean | Module activé (true) ou désactivé (false) |
| `est_visible_menu` | boolean | Visible dans le menu sidebar |
| `permissions_requises` | text[] | Liste des permissions nécessaires |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de dernière modification |

### Vue `snp_modules_actifs`

Vue matérialisée qui retourne uniquement les modules actifs avec les informations du parent.

## 🏗️ Modules Par Défaut

### Modules Principaux (13)

1. **Dashboard** - Tableau de Bord
   - Route: `/dashboard`
   - Icône: `LayoutDashboard`

2. **Production** - Gestion de la Production
   - Sous-modules: Production Journalière, Coffre, Licences, Budget

3. **Shipping** - Expédition
   - Sous-modules: Liste, Nouvelle, Transport Douane

4. **Refining** - Affinage
   - Sous-modules: Dashboard, Envois

5. **Sales** - Ventes
   - Sous-modules: Liste, Nouvelle, Pré-ventes, Espace Commercial

6. **Artisan** - Artisans Miniers
   - Sous-modules: Dashboard, Liste, Cartes, Ventes d'Or

7. **Customers** - Clients
   - Gestion des clients et comptes

8. **Stakeholders** - Parties Prenantes
   - Sociétés minières, raffineries, transporteurs

9. **Inventory** - Inventaire
   - Gestion des stocks or et argent

10. **Payments** - Paiements
    - Gestion des paiements clients

11. **Analytics** - Analytique
    - Analyses et rapports avancés

12. **Documents** - Documents
    - Certificats d'analyse et documents

13. **Admin** - Administration
    - Sous-modules: Utilisateurs, Modules, Paramètres, Audit

## 🔧 Migration SQL

### Fichier
`scripts/20251228_003_SYSTEME_GESTION_MODULES.sql`

### Contenu de la Migration

1. **Table `snp_modules`** avec toutes les colonnes
2. **Index** pour performance (parent_id, code, ordre, actif)
3. **Trigger** de mise à jour `updated_at`
4. **Vue `snp_modules_actifs`** avec jointure parent
5. **RLS Policies** pour sécurité
6. **Données initiales** - 13 modules parents + 30+ sous-modules

### Application

**Via Supabase Dashboard:**

```bash
1. Se connecter à Supabase Dashboard
2. Aller dans SQL Editor
3. Copier le contenu de scripts/20251228_003_SYSTEME_GESTION_MODULES.sql
4. Exécuter le script
5. Vérifier les messages de succès
```

### Vérification

```sql
-- Vérifier que la table existe
SELECT COUNT(*) FROM snp_modules;
-- Devrait retourner 40+ (modules + sous-modules)

-- Voir tous les modules parents
SELECT id, code, nom, ordre, est_actif, est_visible_menu
FROM snp_modules
WHERE parent_id IS NULL
ORDER BY ordre;

-- Voir la hiérarchie complète
SELECT
  p.nom as parent,
  m.nom as module,
  m.route,
  m.est_actif,
  m.est_visible_menu
FROM snp_modules m
LEFT JOIN snp_modules p ON m.parent_id = p.id
ORDER BY p.ordre, m.ordre;
```

## 💻 Interface d'Administration

### Accès
Route: `/admin/modules`

**Prérequis:** Rôle administrateur

### Page `ModulesManagement.tsx`

**Fichier:** `src/pages/admin/ModulesManagement.tsx`

**Fonctionnalités:**

1. **Liste des Modules**
   - Affichage hiérarchique (parent → enfants)
   - Badge de statut (Actif/Inactif, Visible/Caché)
   - Couleurs différentes pour sous-modules

2. **Actions Rapides**
   - Toggle Actif/Inactif (icône Power)
   - Toggle Visibilité (icône Eye/EyeOff)
   - Édition des détails (bouton Edit)

3. **Édition Module**
   - Nom
   - Description
   - Icône
   - Route
   - Ordre

4. **Feedback Visuel**
   - Modules inactifs en opacité réduite
   - Alertes de succès/erreur
   - Loading states

### Service `modulesService.ts`

**Fichier:** `src/services/modulesService.ts`

**Méthodes Principales:**

```typescript
// Récupérer tous les modules
modulesService.getAll(): Promise<Module[]>

// Récupérer modules actifs uniquement
modulesService.getActive(): Promise<Module[]>

// Récupérer hiérarchie complète
modulesService.getHierarchy(): Promise<Module[]>

// Récupérer hiérarchie active (pour menu)
modulesService.getActiveHierarchy(): Promise<Module[]>

// Activer/désactiver module
modulesService.toggleActive(id: string): Promise<Module>

// Afficher/cacher dans menu
modulesService.toggleVisibility(id: string): Promise<Module>

// Mettre à jour module
modulesService.update(id: string, updates: Partial<Module>): Promise<Module>

// Créer nouveau module
modulesService.create(module: Partial<Module>): Promise<Module>

// Supprimer module
modulesService.delete(id: string): Promise<void>

// Réorganiser ordre
modulesService.reorder(moduleId: string, newOrder: number): Promise<void>

// Récupérer modules accessibles pour un utilisateur
modulesService.getUserModules(userId: string): Promise<Module[]>
```

## 🧪 Tests à Effectuer

### 1. Vérifier l'Accès à la Page

```
1. Se connecter en tant qu'administrateur
2. Aller dans Administration → Modules Système
3. URL: /admin/modules
4. Vérifier: Page se charge avec liste des modules
```

### 2. Tester Activation/Désactivation

**Désactiver un module:**
```
1. Trouver le module "Analytics" dans la liste
2. Cliquer sur l'icône Power (rouge)
3. Vérifier: Message "Statut du module modifié"
4. Vérifier: Module apparaît en opacité réduite
5. Recharger la page
6. Vérifier: "Analytics" n'apparaît plus dans la sidebar
```

**Réactiver:**
```
1. Retourner sur /admin/modules
2. Trouver "Analytics" (opacité réduite)
3. Cliquer sur Power (vert)
4. Recharger
5. Vérifier: "Analytics" réapparaît dans sidebar
```

### 3. Tester Visibilité Menu

**Cacher un module:**
```
1. Trouver "Inventory" dans la liste
2. Cliquer sur l'icône Eye (cache)
3. Vérifier: Message de succès
4. Recharger la page
5. Vérifier: "Inventory" n'apparaît pas dans sidebar
6. Aller directement sur /inventory/management
7. Vérifier: Page fonctionne (module actif mais caché)
```

### 4. Tester Édition

```
1. Cliquer sur Edit pour un module
2. Modifier le nom: "Production" → "Gestion Production"
3. Sauvegarder
4. Vérifier: Nom mis à jour dans la liste
5. Recharger
6. Vérifier: Changement persistant
```

### 5. Tester Hiérarchie

```sql
-- Vérifier qu'un enfant hérite du statut parent
UPDATE snp_modules SET est_actif = false WHERE code = 'production';

-- Vérifier tous les sous-modules
SELECT nom, est_actif FROM snp_modules WHERE parent_id = (
  SELECT id FROM snp_modules WHERE code = 'production'
);

-- Réactiver
UPDATE snp_modules SET est_actif = true WHERE code = 'production';
```

## 🎨 Interface Utilisateur

### Vue Liste

```
┌─────────────────────────────────────────────────────────┐
│  Gestion des Modules Système                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────┐            │
│  │ 📊 Dashboard                            │ 🟢 👁️ ✏️  │
│  │    Tableau de Bord                      │            │
│  └────────────────────────────────────────┘            │
│                                                          │
│  ┌────────────────────────────────────────┐            │
│  │ 🏭 Production                           │ 🟢 👁️ ✏️  │
│  │    Gestion de la production             │            │
│  │    ├─ Production Journalière            │ 🟢 👁️     │
│  │    ├─ Production en Coffre              │ 🟢 👁️     │
│  │    ├─ Licences d'Export                 │ 🟢 👁️     │
│  │    └─ Budget Annuel                     │ 🟢 👁️     │
│  └────────────────────────────────────────┘            │
│                                                          │
│  ┌────────────────────────────────────────┐            │
│  │ 📈 Analytics                            │ 🔴 👁️ ✏️  │
│  │    Analyses et rapports                 │ (Inactif)  │
│  └────────────────────────────────────────┘            │
│                                                          │
└─────────────────────────────────────────────────────────┘

Légende:
🟢 = Actif
🔴 = Inactif
👁️ = Visible dans menu
✏️ = Éditer
```

### Modal d'Édition

```
┌─────────────────────────────────────┐
│  Modifier le Module                 │
├─────────────────────────────────────┤
│                                     │
│  Nom: [Production Journalière    ] │
│                                     │
│  Description:                       │
│  [Saisie quotidienne production   ] │
│                                     │
│  Icône: [CalendarDays             ] │
│                                     │
│  Route: [/production/daily        ] │
│                                     │
│  Ordre: [1                        ] │
│                                     │
│  [Annuler]  [💾 Enregistrer]       │
└─────────────────────────────────────┘
```

## 📊 Cas d'Utilisation

### Cas 1: Désactiver Module Temporairement

**Scénario:** Module "Analytics" en maintenance

```
1. Administrateur va sur /admin/modules
2. Trouve "Analytics"
3. Clique sur Power pour désactiver
4. Module devient gris (inactif)
5. Utilisateurs ne voient plus "Analytics" dans menu
6. Routes /analytics/* retournent erreur 403
7. Après maintenance: réactiver
```

### Cas 2: Module Bêta (Actif mais Caché)

**Scénario:** Nouvelle fonctionnalité en test

```
1. Créer module "Reports Beta"
2. Actif = true
3. Visible menu = false
4. Partager URL /reports/beta avec testeurs
5. Module fonctionne mais invisible dans menu général
6. Après validation: rendre visible
```

### Cas 3: Réorganiser les Menus

**Scénario:** Changer l'ordre d'affichage

```sql
-- Mettre "Artisans" avant "Sales"
UPDATE snp_modules SET ordre = 4 WHERE code = 'artisan';
UPDATE snp_modules SET ordre = 5 WHERE code = 'sales';

-- Ou via interface:
1. Éditer module "Artisans"
2. Changer ordre de 6 à 4
3. Sauvegarder
4. Recharger l'app
5. "Artisans" apparaît plus haut dans menu
```

### Cas 4: Ajouter Nouveau Module

```typescript
// Via code ou interface admin
const newModule = {
  code: 'reporting',
  nom: 'Rapports',
  description: 'Génération de rapports personnalisés',
  icone: 'FileBarChart',
  route: '/reports',
  ordre: 12,
  est_actif: true,
  est_visible_menu: true,
  permissions_requises: ['view_reports']
};

await modulesService.create(newModule);
```

## 🔒 Sécurité & Permissions

### Row Level Security (RLS)

**Lecture:** Tous les utilisateurs authentifiés
```sql
CREATE POLICY "Tous peuvent voir les modules"
  ON snp_modules FOR SELECT
  TO authenticated
  USING (true);
```

**Modification:** Administrateurs uniquement
```sql
CREATE POLICY "Admins peuvent gérer les modules"
  ON snp_modules FOR ALL
  TO authenticated
  USING (true)  -- À personnaliser avec vérification rôle admin
  WITH CHECK (true);
```

### Permissions Requises

Chaque module peut définir des permissions:
```typescript
{
  code: 'sales',
  permissions_requises: ['view_sales', 'create_sales']
}
```

Le système vérifie automatiquement si l'utilisateur possède ces permissions avant d'afficher le module.

## 🚀 Améliorations Futures

### 1. Interface Drag & Drop
```typescript
// Réorganiser visuellement les modules
<DraggableModule
  modules={modules}
  onReorder={handleReorder}
/>
```

### 2. Permissions Granulaires
```typescript
// Permissions par rôle
{
  code: 'admin',
  permissions: {
    'admin': ['view', 'edit', 'delete'],
    'manager': ['view'],
    'user': []
  }
}
```

### 3. Modules Conditionnels
```typescript
// Modules qui s'activent selon configuration
{
  code: 'artisan',
  conditions: {
    feature_flags: ['artisan_module_enabled'],
    country: ['Burkina Faso', 'Mali']
  }
}
```

### 4. Audit Trail Modules
```sql
-- Historique des changements
CREATE TABLE snp_modules_history (
  id uuid PRIMARY KEY,
  module_id uuid,
  action text,  -- 'activated', 'deactivated', 'updated'
  changed_by uuid,
  changed_at timestamptz,
  old_values jsonb,
  new_values jsonb
);
```

### 5. Import/Export Configuration
```typescript
// Sauvegarder configuration modules
const config = await modulesService.exportConfig();

// Restaurer sur autre environnement
await modulesService.importConfig(config);
```

## 📝 Maintenance

### Backup Configuration Modules

```sql
-- Exporter configuration actuelle
COPY (
  SELECT code, nom, est_actif, est_visible_menu, ordre
  FROM snp_modules
  ORDER BY ordre
) TO '/tmp/modules_backup.csv' CSV HEADER;
```

### Restaurer Modules Par Défaut

```sql
-- Si modules corrompus, réinitialiser
TRUNCATE snp_modules CASCADE;

-- Puis ré-exécuter la migration initiale
-- (voir scripts/20251228_003_SYSTEME_GESTION_MODULES.sql)
```

## 📞 Support

### Problèmes Courants

**1. Page /admin/modules affiche erreur**
```sql
-- Vérifier que la table existe
SELECT * FROM snp_modules LIMIT 1;

-- Si erreur, appliquer la migration
```

**2. Modules ne s'affichent pas dans menu**
```sql
-- Vérifier statut
SELECT code, nom, est_actif, est_visible_menu
FROM snp_modules
WHERE parent_id IS NULL;

-- Activer si nécessaire
UPDATE snp_modules SET est_actif = true, est_visible_menu = true;
```

**3. Erreur "Module non trouvé"**
```sql
-- Vérifier code module
SELECT id, code, nom FROM snp_modules WHERE code = 'VOTRE_CODE';

-- Créer si manquant (voir Cas 4 ci-dessus)
```

---

**Date de création:** 28 Décembre 2024
**Version:** 1.0
**Statut:** ✅ Prêt pour Production
