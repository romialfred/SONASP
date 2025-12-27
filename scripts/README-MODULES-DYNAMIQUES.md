# Système de Modules Dynamiques

## Vue d'ensemble

La sidebar de l'application charge maintenant dynamiquement les modules depuis la base de données `snp_modules`. Cela permet de gérer facilement les menus et sous-menus sans modifier le code.

## Architecture

### 1. Base de données

**Table: `snp_modules`**
- Stocke tous les modules et sous-modules
- Gère l'activation/désactivation des modules
- Contrôle la visibilité dans le menu
- Définit l'ordre d'affichage

### 2. Service: `modulesService`

Fichier: `src/services/modulesService.ts`

Fonctions principales:
- `getActiveHierarchy()` - Récupère les modules actifs avec leur hiérarchie
- `toggleActive(id)` - Active/désactive un module
- `toggleVisibility(id)` - Affiche/masque un module dans le menu
- `create(module)` - Crée un nouveau module
- `update(id, updates)` - Met à jour un module

### 3. Sidebar: `AccordionSidebar`

Fichier: `src/components/layout/AccordionSidebar.tsx`

La sidebar charge automatiquement les modules depuis la base de données et:
- Affiche les modules parents avec leurs icônes
- Affiche les sous-modules sous forme d'accordion
- Applique les couleurs et icônes définies dans la base

### 4. Page d'administration

**Route: `/admin/modules`**

Fichier: `src/pages/admin/ModulesManagement.tsx`

Permet de:
- Activer/désactiver des modules
- Afficher/masquer des modules du menu
- Modifier les informations des modules (nom, description, icône, route)

## Installation

### 1. Créer la table et les modules

Exécutez le script SQL dans Supabase SQL Editor:

```sql
-- scripts/CREATE-MODULES-MANAGEMENT-SYSTEM.sql
```

Ce script crée:
- La table `snp_modules`
- La vue `snp_modules_actifs`
- Tous les modules par défaut (Dashboard, Production, Shipping, etc.)

### 2. Vérifier les modules

Vérifiez que les modules ont été créés:

```sql
SELECT code, nom, est_actif, est_visible_menu
FROM snp_modules
ORDER BY ordre;
```

### 3. Accéder à la gestion des modules

1. Connectez-vous à l'application
2. Allez dans **Administration** > **Gestion des Modules**
3. Route: `/admin/modules`

## Utilisation

### Ajouter un nouveau module

1. **Via SQL** (recommandé pour les modules principaux):

```sql
INSERT INTO snp_modules (code, nom, description, icone, route, ordre, est_actif, est_visible_menu)
VALUES
  ('nouveau-module', 'Nouveau Module', 'Description', 'Grid', '/nouveau-module', 11, true, true);
```

2. **Via l'interface** (pour modifications rapides):
   - Allez dans `/admin/modules`
   - Cliquez sur "Modifier" sur un module existant
   - Modifiez les champs nécessaires
   - Sauvegardez

### Ajouter un sous-module

```sql
-- D'abord, récupérer l'ID du module parent
SELECT id FROM snp_modules WHERE code = 'artisan-minier';

-- Ensuite, insérer le sous-module
INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre)
VALUES
  ('artisan-transactions', 'Transactions', 'Gestion des transactions', 'DollarSign',
   '/artisan-minier/transactions',
   'UUID_DU_PARENT', -- Remplacer par l'ID récupéré
   6);
```

### Désactiver un module

**Option 1: Via l'interface**
- Allez dans `/admin/modules`
- Cliquez sur l'icône d'activation/désactivation

**Option 2: Via SQL**
```sql
UPDATE snp_modules
SET est_actif = false
WHERE code = 'nom-du-module';
```

### Masquer du menu (mais garder actif)

```sql
UPDATE snp_modules
SET est_visible_menu = false
WHERE code = 'nom-du-module';
```

## Icônes disponibles

Les icônes disponibles sont celles de **Lucide React**. Voici les plus courantes:

| Nom | Description |
|-----|-------------|
| `LayoutDashboard` | Tableau de bord |
| `Users` | Utilisateurs |
| `Pickaxe` | Artisans miniers |
| `Factory` | Production |
| `Ship` | Expédition |
| `Flame` | Raffinage |
| `TrendingUp` | Ventes |
| `BarChart3` | Analytique |
| `Settings` | Paramètres |
| `Shield` | Sécurité/Audit |
| `CreditCard` | Paiements |
| `Coins` | Or/Monnaie |
| `FileText` | Documents |
| `Grid` | Modules |
| `Calendar` | Calendrier |
| `Plus` | Ajouter |

Liste complète: https://lucide.dev/icons/

## Couleurs des icônes

Les couleurs sont définies dans `AccordionSidebar.tsx` via la fonction `getIconColor()`:

```typescript
const colorMap = {
  'artisan-minier': 'text-emerald-700',
  'production': 'text-emerald-600',
  'shipping': 'text-blue-600',
  'refining': 'text-teal-600',
  'sales': 'text-pink-600',
  'administration': 'text-red-600',
  // etc.
};
```

Pour ajouter une couleur personnalisée pour un nouveau module, ajoutez une entrée dans ce mapping.

## Modules existants

### Modules principaux créés par défaut:

1. **Dashboard** - Tableau de bord principal
2. **Production** - Gestion de la production
   - Production Journalière
   - Production en Coffre
   - Licences d'Export
   - Budget
3. **Expédition** - Gestion des expéditions
   - Tableau de Bord
   - Nouvelle Expédition
   - Certificats d'Essai
4. **Raffinage** - Gestion du raffinage
5. **Ventes** - Gestion des ventes
   - Tableau de Bord
   - Nouvelle Vente
   - Espace Trading
6. **Clients** - Gestion des clients
7. **Paiements** - Gestion des paiements
8. **Artisans Miniers** - Gestion des artisans
   - Tableau de Bord
   - Liste des Artisans
   - Suivi des Cartes
   - Validation Cartes
   - Expirations
9. **Analytique** - Tableaux de bord et rapports
10. **Administration** - Gestion du système
    - Gestion Utilisateurs
    - Rôles & Permissions
    - Gestion des Modules
    - Paramètres Système
    - Journal d'Audit

## Dépannage

### Les modules n'apparaissent pas dans la sidebar

1. Vérifiez que les modules sont actifs:
```sql
SELECT code, nom, est_actif, est_visible_menu FROM snp_modules;
```

2. Vérifiez les erreurs dans la console du navigateur

3. Rechargez la page (F5)

### Un module apparaît sans icône

L'icône n'est pas dans le mapping. Ajoutez-la dans `AccordionSidebar.tsx`:

```typescript
const iconMap: Record<string, React.ComponentType> = {
  // ... autres icônes
  NouvelleIcone, // Ajoutez l'import en haut du fichier
};
```

### RLS - Erreur de permissions

Vérifiez que les policies RLS sont en place:

```sql
SELECT * FROM pg_policies WHERE tablename = 'snp_modules';
```

Si aucune policy n'existe, réexécutez le script de création.

## Sécurité

- **RLS activé**: Seuls les utilisateurs authentifiés peuvent voir les modules
- **Route protégée**: La page de gestion nécessite le rôle 'management'
- **Validation**: Les modifications sont validées côté serveur

## Bonnes pratiques

1. **Codes uniques**: Utilisez des codes descriptifs et uniques (ex: `artisan-minier`, `production-daily`)
2. **Ordre logique**: Numérotez les modules par ordre d'importance (1, 2, 3...)
3. **Hiérarchie claire**: Les sous-modules doivent avoir un `parent_id`
4. **Noms courts**: Les noms doivent être courts mais descriptifs
5. **Icônes cohérentes**: Utilisez des icônes qui représentent bien la fonction

## Exemple complet

Créer un nouveau module "Collecte d'Or" avec sous-modules:

```sql
-- 1. Créer le module parent
INSERT INTO snp_modules (code, nom, description, icone, route, ordre, est_actif, est_visible_menu)
VALUES
  ('collecte-or', 'Collecte d''Or', 'Gestion de la collecte d''or', 'Coins', NULL, 9, true, true);

-- 2. Récupérer l'ID du module créé
SELECT id FROM snp_modules WHERE code = 'collecte-or';

-- 3. Créer les sous-modules
INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
VALUES
  ('collecte-or-dashboard', 'Tableau de Bord', 'Vue d''ensemble', 'LayoutDashboard', '/collecte-or/dashboard', 'UUID_DU_PARENT', 1, true, true),
  ('collecte-or-ventes', 'Ventes d''Or', 'Enregistrement des ventes', 'TrendingUp', '/collecte-or/ventes', 'UUID_DU_PARENT', 2, true, true),
  ('collecte-or-stats', 'Statistiques', 'Statistiques de collecte', 'BarChart3', '/collecte-or/stats', 'UUID_DU_PARENT', 3, true, true);
```

Le module apparaîtra automatiquement dans la sidebar après actualisation.

## Support

Pour toute question ou problème, consultez:
- La documentation Lucide React: https://lucide.dev
- Le code source: `src/components/layout/AccordionSidebar.tsx`
- Les services: `src/services/modulesService.ts`
