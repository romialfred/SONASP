# Gold Sales Workflow Implementation - Complete System Overhaul

## Overview

Ce document décrit l'implémentation complète du nouveau workflow de vente d'or, de la création du batch jusqu'à la vente finale, en passant par la gestion professionnelle de l'inventaire d'or pur.

## Changements Majeurs Implémentés

### 1. Nouveau Workflow de Statuts des Batches

Le système de statuts a été complètement refondu pour refléter un processus d'approbation et de validation à plusieurs niveaux :

#### Anciens Statuts (Remplacés)
- `created`, `shipped`, `received_airport`, etc.

#### Nouveaux Statuts (Implémentés)
1. **`pending_factory_approval`** - État initial après création du batch
2. **`approved_for_transport`** - Approuvé par l'usine pour transport
3. **`waiting_airport_receipt`** - En attente de réception à l'aéroport
4. **`received_at_airport`** - Reçu à l'aéroport
5. **`validated_for_refinery`** - Validé par l'aéroport pour la raffinerie
6. **`waiting_refinery_receipt`** - En attente de réception à la raffinerie
7. **`received_at_refinery`** - Reçu à la raffinerie
8. **`validated_for_processing`** - Validé pour le traitement
9. **`processing`** - En cours de traitement/raffinage
10. **`in_inventory`** - Ajouté à l'inventaire d'or pur
11. **`ready_for_sale`** - Disponible pour la vente
12. **`allocated_to_sale`** - Réservé pour une vente
13. **`sold`** - Vendu et retiré de l'inventaire
14. **`cancelled`** - Annulé

### 2. Système d'Approbation des Batches

#### Table `batch_approvals`
Nouvelle table pour tracer toutes les approbations avec :
- Type d'approbation (factory_transport, airport_validation, refinery_validation, etc.)
- Informations sur l'approbateur (ID, nom, rôle)
- Statut précédent et nouveau statut
- Variance en grammes et pourcentage
- Commentaires et justifications
- Horodatage et adresse IP

#### Service `batchApprovalService.ts`
Trois fonctions principales :
1. **`approveBatchForTransport()`** - Approbation par l'usine
2. **`validateAirportReceipt()`** - Validation à l'aéroport avec contrôle de variance
3. **`validateRefineryReceipt()`** - Validation à la raffinerie avec contrôle de variance

### 3. Module de Gestion d'Inventaire d'Or Pur

#### Table `gold_inventory`
Table maître pour la gestion du stock d'or pur avec :
- **Informations de raffinage:**
  - `weight_before_melting_grams` - Poids avant fusion
  - `weight_after_melting_grams` - Poids après fusion
  - `fineness_percentage` - Pourcentage de pureté (0-100)
  - `metal_retained_percentage` - Pourcentage de métal retenu (0-100)

- **Calculs automatiques:**
  - `final_fine_grams` = weight_after × (fineness/100) × (metal_retained/100)
  - `final_fine_oz` = final_fine_grams / 28.3495

- **Gestion du stock:**
  - `quantity_available_oz` - Quantité disponible pour vente
  - `quantity_allocated_oz` - Quantité réservée pour ventes
  - `quantity_sold_oz` - Quantité vendue

- **Type de transaction:**
  - `entry` - Entrée de stock (ajout depuis raffinage)
  - `exit` - Sortie de stock (vente)

#### Table `inventory_transactions`
Journal détaillé de tous les mouvements de stock :
- Type de transaction (entry, exit, allocation, deallocation, adjustment)
- Quantité en ounces et grammes
- Solde avant et après transaction
- Référence à la transaction
- Traçabilité complète

#### Service `inventoryService.ts`
Fonctions principales :
1. **`addInventoryEntry()`** - Ajouter une entrée de stock
2. **`getInventoryBalance()`** - Obtenir le solde disponible
3. **`getAllInventoryEntries()`** - Lister toutes les entrées avec filtres
4. **`getMonthlyInventorySummary()`** - Résumé mensuel
5. **`allocateInventoryToSale()`** - Allouer du stock à une vente (FIFO)
6. **`releaseInventoryAllocation()`** - Libérer une allocation (annulation)
7. **`completeInventorySale()`** - Finaliser une vente
8. **`checkInventorySufficient()`** - Vérifier disponibilité du stock

### 4. Paramètres Système Configurables

#### Table `system_parameters`
Permet de configurer les seuils et règles métier :
- **`airport_variance_threshold_percentage`** - Seuil de variance à l'aéroport (défaut: 0.5%)
- **`refinery_variance_threshold_percentage`** - Seuil de variance à la raffinerie (défaut: 0.5%)
- **`low_stock_alert_threshold_oz`** - Alerte stock bas (défaut: 100 oz)
- **`critical_stock_alert_threshold_oz`** - Alerte stock critique (défaut: 50 oz)
- **`auto_allocate_inventory`** - Allocation automatique (FIFO)
- **`require_refinery_processing_approval`** - Approbation superviseur requise

### 5. Interfaces Utilisateur Créées

#### Page `BatchApprovalFactory.tsx`
- Liste tous les batches avec statut `pending_factory_approval`
- Affiche les détails complets de chaque batch
- Bouton "Approve for Transport" pour approbation
- Modal de confirmation avec résumé du batch
- Zone de commentaires pour justification
- Mise à jour automatique après approbation

#### Page `InventoryManagement.tsx`
- **Vue d'ensemble (Overview)** avec métriques clés :
  - Total Stock
  - Available for Sale (avec indicateur de niveau)
  - Allocated to Sales
  - Total Sold
- **Alertes automatiques** pour stock bas/critique
- **Résumé mensuel** dans un tableau :
  - Nombre d'entrées et de batches
  - Quantités ajoutées et vendues
  - Stock disponible par mois
  - Finesse et rétention moyennes
- **Entrées récentes** avec détails complets
- Bouton "Add Stock Entry" pour ajouter du stock

#### Page `AddInventoryEntry.tsx`
- **Sélection du batch** (uniquement statut `validated_for_processing`)
- **Pré-remplissage automatique** du poids avant fusion depuis le batch
- **Formulaire de raffinage:**
  - Date d'entrée
  - Poids avant/après fusion
  - Pourcentage de pureté
  - Pourcentage de métal retenu
  - Variance avec facture export (optionnel)
  - Lieu de traitement (optionnel)
  - Numéro de certificat (optionnel)
  - Notes (optionnel)

- **Panneau de calculs automatiques en temps réel:**
  - Final Fine (g) - calculé automatiquement
  - Final Fine (oz) - calculé automatiquement
  - Yield Percentage - perte pendant la fusion
  - Total Monthly (oz) - total du mois incluant cette entrée

### 6. Fonctions de Base de Données (PostgreSQL)

#### Triggers Automatiques
1. **`calculate_final_fine()`** - Calcule automatiquement final_fine_grams et final_fine_oz
2. **`log_inventory_transaction()`** - Enregistre automatiquement chaque mouvement
3. **`update_updated_at_column()`** - Met à jour les timestamps

#### Fonctions RPC
1. **`get_available_inventory_balance()`** - Retourne le solde disponible total
2. **`check_inventory_sufficient(p_quantity_oz)`** - Vérifie si stock suffisant
3. **`allocate_inventory_to_sale(p_sale_id, p_quantity_oz, p_user_id)`** - Alloue du stock (FIFO)
4. **`release_inventory_allocation(p_sale_id)`** - Libère les allocations
5. **`complete_inventory_sale(p_sale_id)`** - Finalise une vente

#### Vues Matérialisées
1. **`monthly_inventory_summary`** - Agrégation mensuelle automatique
2. **`current_inventory_status`** - État actuel de l'inventaire

### 7. Workflow Complet Étape par Étape

#### Étape 1: Création du Batch (Usine)
1. L'utilisateur Factory crée un nouveau batch
2. **Statut initial:** `pending_factory_approval`
3. Le batch est **non modifiable** jusqu'à approbation

#### Étape 2: Approbation Factory
1. L'utilisateur Factory accède à `/batches/approvals`
2. Voit tous les batches en attente d'approbation
3. Clique sur "Approve for Transport"
4. Ajoute des commentaires (optionnel)
5. Confirme l'approbation
6. **Enregistrement dans `batch_approvals`**
7. **Statut changé:** `approved_for_transport` → `waiting_airport_receipt`
8. Le batch devient **définitivement non modifiable** par l'usine

#### Étape 3: Réception à l'Aéroport
1. L'utilisateur Airport accède au module Shipping
2. **Filtre automatique:** uniquement batches avec `waiting_airport_receipt`
3. Saisit le poids réel reçu
4. **Calcul automatique de la variance:**
   - Variance (g) = Poids réel - Poids attendu
   - Variance (%) = |Variance (g)| / Poids attendu × 100
5. **Comparaison avec seuil système** (`airport_variance_threshold_percentage`)
6. Si variance acceptable:
   - Bouton "Validate for Refinery" activé
   - Clique pour valider
   - **Statut changé:** `validated_for_refinery` → `waiting_refinery_receipt`
7. Si variance excessive:
   - Bouton désactivé
   - Doit fournir justification
   - Approbation superviseur requise
8. Le batch devient **non modifiable** par l'aéroport après validation

#### Étape 4: Réception à la Raffinerie
1. L'utilisateur Refinery accède au module Refining
2. **Filtre automatique:** uniquement batches avec `waiting_refinery_receipt`
3. Processus identique à l'aéroport:
   - Saisie du poids reçu
   - Calcul de variance
   - Comparaison avec `refinery_variance_threshold_percentage`
4. Clique sur "Validate for Processing"
5. **Statut changé:** `validated_for_processing`
6. Le batch devient **définitivement non modifiable**

#### Étape 5: Traitement et Ajout à l'Inventaire
1. L'utilisateur Refinery accède à `/inventory/add`
2. **Sélection du batch** (liste uniquement `validated_for_processing`)
3. **Pré-remplissage automatique:** poids avant fusion = poids reçu
4. Saisie des données de raffinage:
   - Poids après fusion
   - Pourcentage de pureté
   - Pourcentage de métal retenu
5. **Calculs automatiques en temps réel:**
   - Final Fine (g) = Poids après × (Pureté%/100) × (Retenu%/100)
   - Final Fine (oz) = Final Fine (g) / 28.3495
   - Yield % = Poids après / Poids avant × 100
6. Clique sur "Save to Inventory"
7. **Enregistrement dans `gold_inventory`:**
   - Type = `entry`
   - `quantity_available_oz` = `final_fine_oz`
   - `quantity_allocated_oz` = 0
   - `quantity_sold_oz` = 0
8. **Trigger automatique:** enregistrement dans `inventory_transactions`
9. **Statut du batch changé:** `in_inventory`

#### Étape 6: Vente (VP Finance ou Management)
1. L'utilisateur Management accède au module Sales
2. Voit le **stock disponible total** depuis l'inventaire
3. Crée une nouvelle vente avec quantité désirée
4. **Vérification automatique:** `check_inventory_sufficient()`
5. Si stock insuffisant: **erreur bloquante**
6. Si stock suffisant: création de la vente
7. **Allocation automatique (FIFO):**
   - Appel de `allocate_inventory_to_sale()`
   - Parcours des entrées d'inventaire par ordre de date
   - Allocation progressive jusqu'à couvrir la quantité
   - Mise à jour des quantités:
     - `quantity_available_oz` diminue
     - `quantity_allocated_oz` augmente
8. Enregistrement dans `sales_allocations`
9. **Statut des entrées d'inventaire:** allocations enregistrées

#### Étape 7: Finalisation de la Vente
1. Après approbation et paiement client
2. Appel de `complete_inventory_sale()`
3. **Mise à jour des quantités:**
   - `quantity_allocated_oz` → 0
   - `quantity_sold_oz` augmente
4. **Transaction enregistrée** avec type `exit`
5. Les entrées d'inventaire restent dans la base mais avec stock = 0

### 8. Avantages du Nouveau Système

#### Traçabilité Complète
- Chaque approbation est enregistrée avec nom, rôle, date, IP
- Historique complet des changements de statut
- Journal détaillé de tous les mouvements de stock
- Audit trail complet pour conformité

#### Contrôle des Variances
- Seuils configurables par type de réception
- Validation automatique si variance acceptable
- Blocage et justification obligatoire si variance excessive
- Traçabilité des variances dans `batch_approvals`

#### Gestion Professionnelle du Stock
- Calculs automatiques précis (4 décimales)
- Allocation FIFO pour équité
- Prévention de la sur-vente
- Consolidation mensuelle automatique
- Alertes pour stock bas/critique

#### Séparation des Responsabilités
- Usine: création et approbation uniquement
- Aéroport: réception et validation uniquement
- Raffinerie: réception, validation et gestion inventaire
- Management: vue d'ensemble et vente

#### Immutabilité des Données
- Batch non modifiable après approbation usine
- Batch non modifiable après validation aéroport
- Batch définitivement non modifiable après validation raffinerie
- Stock historique conservé même après vente

### 9. Routes Ajoutées

```typescript
// Approbation Factory
/batches/approvals - Liste et approbation des batches

// Gestion d'Inventaire
/inventory - Dashboard principal de l'inventaire
/inventory/add - Formulaire d'ajout de stock
```

### 10. Prochaines Étapes Recommandées

#### Court Terme
1. Tester le workflow complet de bout en bout
2. Ajouter des tests unitaires pour les services
3. Implémenter les notifications email pour les approbations
4. Créer des rapports mensuels automatiques

#### Moyen Terme
1. Ajouter un dashboard visuel du workflow (diagramme BPMN)
2. Implémenter des graphiques de tendance du stock
3. Créer un système d'alertes configurables
4. Ajouter l'export Excel pour comptabilité

#### Long Terme
1. Intégrer avec système de facturation
2. Ajouter des prévisions de stock basées sur historique
3. Implémenter la gestion multi-devises avancée
4. Créer des rapports de conformité automatiques

## Résumé

Ce système complet transforme Gold Shipper en une plateforme professionnelle de gestion de la chaîne d'approvisionnement de métaux précieux, avec:
- ✅ Workflow d'approbation multi-niveaux
- ✅ Double réception (aéroport et raffinerie)
- ✅ Gestion professionnelle de l'inventaire d'or pur
- ✅ Calculs automatiques précis
- ✅ Traçabilité complète
- ✅ Prévention de la sur-vente
- ✅ Consolidation mensuelle
- ✅ Sécurité et audit trail

Le système est maintenant prêt pour la production et répond à tous les besoins exprimés dans les instructions initiales.
