# Workflow de Production vers Expédition - Documentation

## Vue d'ensemble

Ce document décrit les modifications apportées au système pour implémenter un workflow de validation des productions avant leur inclusion dans les expéditions.

## Nouveau Workflow de Statuts

### Flux Complet

```
Préparé → Prêt pour la Douane → Expédié → Raffiné → Vendu
```

### Description des Statuts

1. **Préparé (prepared)** - Statut initial
   - La production est créée dans le système
   - En attente de validation manuelle
   - Visible uniquement dans le module "Production Management"

2. **Prêt pour la Douane (ready_for_customs)** - Nouveau statut
   - La production a été validée manuellement
   - Prête pour inclusion dans une expédition
   - Visible dans le module "Shipping Preparation"

3. **Expédié (shipped)**
   - La production a été incluse dans une expédition
   - Statut automatiquement mis à jour lors de la création de l'expédition
   - Statut final dans le module Production

## Modifications Techniques

### 1. Migration de Base de Données

**Fichier**: `supabase/migrations/20251114_001_add_ready_for_customs_status.sql`

- Ajoute le statut `ready_for_customs` au type enum `production_status`
- Met à jour toutes les productions existantes à 'prepared'
- Crée des indexes pour optimiser les performances
- Le trigger existant `log_production_status_change` enregistre automatiquement tous les changements dans `production_status_history`

### 2. Service dailyProductionService

**Fichier**: `src/services/dailyProductionService.ts`

Nouvelles méthodes ajoutées:

```typescript
// Mettre à jour le statut d'une production
updateProductionStatus(
  productionId: string,
  newStatus: 'prepared' | 'ready_for_customs' | 'shipped' | 'cancelled',
  notes?: string
): Promise<DailyProduction>

// Récupérer l'historique des changements de statut
getProductionStatusHistory(productionId: string): Promise<StatusHistoryEntry[]>

// Récupérer les productions prêtes pour la douane
getProductionsReadyForCustoms(miningCompanyId?: string): Promise<DailyProduction[]>
```

### 3. Constantes de Statuts

**Fichier**: `src/constants/productionStatuses.ts`

- Ajout du type `'ready_for_customs'` au type `ProductionStatus`
- Configuration des couleurs et labels pour l'affichage
- Mise à jour du flux de statuts: `['prepared', 'ready_for_customs', 'shipped']`

### 4. Module Shipping Preparation

**Fichier**: `src/pages/shipping/ShippingPreparationNew.tsx`

Modification de la fonction `loadProductions`:

```typescript
// Avant
.eq('mining_company_id', miningCompanyId)

// Après
.eq('mining_company_id', miningCompanyId)
.eq('status', 'ready_for_customs')  // Filtre ajouté
```

Maintenant, seules les productions avec le statut `ready_for_customs` sont affichées dans la liste des productions disponibles pour l'expédition.

## Utilisation du Système

### 1. Enregistrement d'une Production

1. Aller dans **Production Management → Daily Production**
2. Cliquer sur "Nouvelle Production"
3. Remplir le formulaire et enregistrer
4. La production est créée avec le statut **Préparé**

### 2. Validation d'une Production pour la Douane

1. Dans **Production Management → Production in Safe**
2. Cliquer sur une production
3. Dans la section "Workflow de Statut", cliquer sur le bouton **"Marquer Prêt pour Douane"**
4. Confirmer l'action
5. Le statut passe à **Prêt pour la Douane**

### 3. Création d'une Expédition

1. Aller dans **Shipping Preparation**
2. Cliquer sur "Nouvelle Expédition"
3. Sélectionner la mining company
4. Seules les productions avec le statut **Prêt pour la Douane** apparaissent dans la liste
5. Sélectionner les productions à inclure
6. Compléter et enregistrer l'expédition
7. Les productions sélectionnées passent automatiquement au statut **Expédié**

## Historique des Modifications

### Traçabilité Complète

Tous les changements de statut sont automatiquement enregistrés dans la table `production_status_history` grâce au trigger de base de données.

Pour chaque changement, le système enregistre:
- L'ancien statut
- Le nouveau statut
- L'utilisateur qui a effectué le changement
- La date et l'heure du changement
- Les notes optionnelles

### Visualisation de l'Historique

L'historique complet est visible dans le panneau de droite sur la page de détails de chaque production, avec:
- Timeline visuelle des changements
- Informations sur l'utilisateur
- Horodatage précis
- Notes associées

## Avantages du Nouveau Workflow

1. **Contrôle Qualité**: Validation manuelle obligatoire avant expédition
2. **Traçabilité**: Historique complet de tous les changements
3. **Clarté**: Séparation nette entre productions en attente et productions prêtes
4. **Sécurité**: Impossible d'expédier une production non validée
5. **Audit**: Tous les changements sont enregistrés avec l'utilisateur et l'horodatage

## Migration des Données Existantes

Lors de l'application de la migration:
- Toutes les productions existantes sont mises à jour au statut **Préparé**
- Les productions déjà expédiées (présentes dans shipping_preparations) conservent leur statut
- Aucune perte de données

## Points Importants

1. **Statut Initial**: Toutes les nouvelles productions démarrent en statut "Préparé"
2. **Validation Manuelle**: Le passage à "Prêt pour la Douane" doit être fait manuellement
3. **Filtre Automatique**: Le module Shipping ne montre que les productions "ready_for_customs"
4. **Mise à Jour Automatique**: Le passage à "Expédié" se fait automatiquement lors de la création de l'expédition
5. **Historique Automatique**: Tous les changements sont automatiquement enregistrés

## Prochaines Étapes

1. Appliquer la migration dans Supabase
2. Tester le workflow complet:
   - Créer une production (statut: Préparé)
   - Valider pour la douane (statut: Prêt pour la Douane)
   - Créer une expédition (statut: Expédié)
   - Vérifier l'historique des changements
3. Former les utilisateurs sur le nouveau processus
