# Correction du Module Artisan Minier

## Problèmes corrigés

### 1. Doublon "Tableau de Bord"
**Avant:** Il y avait deux entrées "Tableau de bord" dans la sidebar
**Après:** Le second "Tableau de Bord" (dans Artisans Miniers) est renommé en "Gestion des Artisans"

### 2. Route incorrecte
**Avant:** Le sous-module artisan pointait vers `/artisan-minier/dashboard`
**Après:** Le sous-module pointe maintenant vers `/artisan-minier` (la page principale)

### 3. Module manquant: Ventes d'Or
**Avant:** Pas de menu pour les ventes d'or des artisans
**Après:** Nouveau sous-module "Ventes d'Or" ajouté dans Artisans Miniers

## Installation

### Étape 1: Exécuter le script SQL de correction

Ouvrez le SQL Editor dans Supabase et exécutez:

```sql
-- scripts/FIX-ARTISAN-MODULES.sql
```

Ou exécutez directement:

```sql
-- 1. Correction du nom et de la route
UPDATE snp_modules
SET
  nom = 'Gestion des Artisans',
  description = 'Vue d''ensemble et gestion des artisans',
  route = '/artisan-minier'
WHERE code = 'artisan-dashboard';

-- 2. Ajout du module Ventes d'Or
DO $$
DECLARE
  artisan_parent_id uuid;
BEGIN
  SELECT id INTO artisan_parent_id FROM snp_modules WHERE code = 'artisan-minier';

  IF NOT EXISTS (SELECT 1 FROM snp_modules WHERE code = 'artisan-ventes-or') THEN
    INSERT INTO snp_modules (code, nom, description, icone, route, parent_id, ordre, est_actif, est_visible_menu)
    VALUES (
      'artisan-ventes-or',
      'Ventes d''Or',
      'Collecte et ventes d''or des artisans',
      'Coins',
      '/artisan-minier/ventes-or',
      artisan_parent_id,
      6,
      true,
      true
    );
  END IF;
END $$;
```

### Étape 2: Vérifier les modifications

Vérifiez que les modules sont corrects:

```sql
SELECT
  m.code,
  m.nom,
  m.route,
  m.ordre,
  m.est_actif,
  m.est_visible_menu
FROM snp_modules m
WHERE m.code LIKE 'artisan-%'
  OR m.parent_id = (SELECT id FROM snp_modules WHERE code = 'artisan-minier')
ORDER BY m.ordre;
```

Vous devriez voir:

| code | nom | route | ordre |
|------|-----|-------|-------|
| artisan-minier | Artisans Miniers | NULL | 8 |
| artisan-dashboard | Gestion des Artisans | /artisan-minier | 1 |
| artisan-liste | Liste des Artisans | /artisan-minier/liste | 2 |
| artisan-cartes-suivi | Suivi des Cartes | /artisan-minier/cartes/suivi | 3 |
| artisan-cartes-validation | Validation Cartes | /artisan-minier/cartes/validation | 4 |
| artisan-cartes-expiration | Expirations | /artisan-minier/cartes/expirations | 5 |
| artisan-ventes-or | Ventes d'Or | /artisan-minier/ventes-or | 6 |

### Étape 3: Actualiser l'application

1. Rechargez la page dans votre navigateur (F5)
2. La sidebar devrait maintenant afficher correctement:
   - **Dashboard** (seul, sans doublon)
   - **Artisans Miniers** avec:
     - Gestion des Artisans
     - Liste des Artisans
     - Suivi des Cartes
     - Validation Cartes
     - Expirations
     - **Ventes d'Or** (nouveau)

## Nouvelle fonctionnalité: Ventes d'Or

### Accès
Route: `/artisan-minier/ventes-or`

### Fonctionnalités
- Liste de toutes les ventes d'or des artisans
- Filtrage par statut (En Attente, Validée, Payée, Annulée)
- Recherche par numéro de reçu
- Statistiques en temps réel:
  - Nombre total de ventes
  - Montant total collecté
  - Quantité totale en grammes
  - Ventes en attente
- Actions disponibles:
  - Voir les détails
  - Modifier une vente
  - Supprimer une vente

### Données affichées
- Date de vente
- Numéro de reçu
- Type d'or (Poudre, Lingot, Pépites, Bijoux, Autre)
- Quantité en grammes
- Pureté en karats
- Montant total en FCFA
- Statut de la vente

### Table de base de données
La page utilise la table `snp_artisan_ventes_or` qui doit déjà être créée avec le script:
- `scripts/CREATE-ARTISAN-GOLD-SALES-COLLECTION.sql`

## Structure du module Artisans Miniers

```
📁 Artisans Miniers (parent)
├── 📄 Gestion des Artisans (/artisan-minier)
├── 👥 Liste des Artisans (/artisan-minier/liste)
├── 💳 Suivi des Cartes (/artisan-minier/cartes/suivi)
├── ✅ Validation Cartes (/artisan-minier/cartes/validation)
├── ⚠️ Expirations (/artisan-minier/cartes/expirations)
└── 💰 Ventes d'Or (/artisan-minier/ventes-or) ← NOUVEAU
```

## Fichiers modifiés

### Frontend
1. **src/pages/artisan-minier/VentesOr.tsx** (NOUVEAU)
   - Page principale de gestion des ventes d'or

2. **src/App.tsx**
   - Ajout de la route `/artisan-minier/ventes-or`
   - Import du composant VentesOr

3. **src/components/layout/AccordionSidebar.tsx**
   - Déjà configuré pour charger dynamiquement les modules

### Backend/Database
1. **scripts/CREATE-MODULES-MANAGEMENT-SYSTEM.sql**
   - Correction du nom "Gestion des Artisans"
   - Correction de la route `/artisan-minier`
   - Ajout du sous-module "Ventes d'Or"
   - Correction de l'icône AlertTriangle

2. **scripts/FIX-ARTISAN-MODULES.sql** (NOUVEAU)
   - Script de correction dédié pour mise à jour rapide

## Services utilisés

Le module Ventes d'Or utilise le service existant:
- **src/services/artisanGoldSalesService.ts**

Fonctions disponibles:
```typescript
artisanGoldSalesService.getAll()           // Récupère toutes les ventes
artisanGoldSalesService.getByArtisan(id)   // Ventes d'un artisan
artisanGoldSalesService.create(data)       // Crée une nouvelle vente
artisanGoldSalesService.update(id, data)   // Met à jour une vente
artisanGoldSalesService.delete(id)         // Supprime une vente
```

## Développements futurs

Pages à créer pour compléter le module:
1. `/artisan-minier/ventes-or/nouvelle` - Formulaire de création
2. `/artisan-minier/ventes-or/:id` - Détails d'une vente
3. `/artisan-minier/ventes-or/:id/modifier` - Édition d'une vente

## Dépannage

### Le module n'apparaît pas dans la sidebar

1. Vérifiez que le script SQL a été exécuté:
```sql
SELECT * FROM snp_modules WHERE code = 'artisan-ventes-or';
```

2. Vérifiez que le module est actif et visible:
```sql
UPDATE snp_modules
SET est_actif = true, est_visible_menu = true
WHERE code = 'artisan-ventes-or';
```

3. Actualisez la page (F5)

### Le doublon "Tableau de Bord" persiste

Exécutez:
```sql
UPDATE snp_modules
SET nom = 'Gestion des Artisans', route = '/artisan-minier'
WHERE code = 'artisan-dashboard';
```

Puis actualisez la page.

### L'icône ne s'affiche pas correctement

Vérifiez que l'icône est dans le mapping de `AccordionSidebar.tsx`:
```typescript
const iconMap = {
  Coins,        // Pour Ventes d'Or
  CreditCard,   // Pour Suivi des Cartes
  // etc.
};
```

## Support

Pour toute question:
- Vérifiez les logs de la console navigateur (F12)
- Consultez `scripts/README-MODULES-DYNAMIQUES.md` pour plus d'informations sur le système de modules
- Vérifiez les RLS policies de la table `snp_modules`
