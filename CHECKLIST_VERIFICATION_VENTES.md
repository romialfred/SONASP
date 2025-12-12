# CHECKLIST - VÉRIFICATION VENTES & PAIEMENTS

## Phase 1: Analyse Base de Données

### Préparation
- [ ] Ouvrir Supabase Dashboard
- [ ] Aller dans SQL Editor
- [ ] Créer une nouvelle requête

### Exécution Script SQL
- [ ] Copier ANALYSE_COMPLETE_VENTES_PAIEMENTS.sql
- [ ] Coller dans l'éditeur
- [ ] Exécuter le script (Run)
- [ ] Vérifier qu'il n'y a pas d'erreur

### Copier les Résultats
- [ ] Section 1: ENUMS (sale_status, payment_status)
- [ ] Section 2: Structure gold_sales (colonne status)
- [ ] Section 4: Triggers gold_sales
- [ ] Section 6: Code fonction handle_sales_status_change()

---

## Phase 2: Vérification ENUM sale_status

### L'ENUM existe?
- [ ] OUI → Passer à la vérification des valeurs
- [ ] NON → Migration complète nécessaire

### Valeurs ENUM (cocher celles présentes)
- [ ] `pending_management_approval`
- [ ] `management_approved`
- [ ] `management_rejected`
- [ ] `pending_for_customer_approval`
- [ ] `customer_approved`
- [ ] `customer_rejected`
- [ ] `waiting_for_payment`
- [ ] `virtual_payment`
- [ ] `payment_received`
- [ ] `completed`

**Si toutes cochées:** ENUM OK ✓
**Si certaines manquent:** Migration ADD VALUE nécessaire

---

## Phase 3: Vérification Structure gold_sales

### Colonne status
- [ ] Type: `sale_status` (ENUM)
- [ ] Nullable: `NO`
- [ ] Default: `'pending_management_approval'`

**Si tout coché:** Structure OK ✓
**Si problème:** Migration ALTER TABLE nécessaire

---

## Phase 4: Vérification Triggers

### Trigger handle_sales_status_change
- [ ] Le trigger existe
- [ ] Type: BEFORE UPDATE ou AFTER UPDATE
- [ ] Fonction: handle_sales_status_change()

### Code du Trigger
- [ ] Utilise `SECURITY DEFINER`
- [ ] Utilise `SET search_path = public`
- [ ] Utilise les bonnes valeurs ENUM
- [ ] Pas de valeurs en dur incorrectes

**Si tout coché:** Triggers OK ✓
**Si problème:** Correction trigger nécessaire

---

## Phase 5: Vérification Paiements

### ENUM payment_status
- [ ] L'ENUM existe
- [ ] Contient: pending, approved, rejected, completed

### Structure payments
- [ ] Table existe
- [ ] Colonne status existe
- [ ] Type correct

### Triggers payments
- [ ] Vérifier s'il y a des triggers
- [ ] Vérifier leur cohérence

---

## Phase 6: Actions Nécessaires

### Corrections Identifiées

#### ENUM
- [ ] Créer sale_status
- [ ] Ajouter valeurs manquantes
- [ ] Créer payment_status

#### Tables
- [ ] Modifier colonne gold_sales.status
- [ ] Modifier colonne payments.status
- [ ] Ajouter valeurs par défaut

#### Triggers
- [ ] Créer handle_sales_status_change()
- [ ] Corriger triggers existants
- [ ] Créer triggers manquants

#### Code Frontend
- [ ] Créer paymentStatuses.ts (si manquant)
- [ ] Vérifier imports
- [ ] Vérifier cohérence

---

## Phase 7: Tests Après Correction

### Test Création Vente
- [ ] Ouvrir /sales/new
- [ ] Remplir formulaire
- [ ] Soumettre
- [ ] Vérifier status = `pending_management_approval`
- [ ] Vérifier pas d'erreur dans console

### Test Workflow Management
- [ ] Management approuve
- [ ] Status devient `management_approved`
- [ ] Historique enregistré
- [ ] Notification envoyée

### Test Workflow Client
- [ ] Envoyer au client
- [ ] Status devient `pending_for_customer_approval`
- [ ] Email envoyé
- [ ] Client peut approuver

### Test Paiement
- [ ] Client approuve
- [ ] Status devient `customer_approved`
- [ ] Peut créer paiement
- [ ] Status paiement correct

### Test Finalisation
- [ ] Paiement approuvé
- [ ] Status vente devient `payment_received`
- [ ] Peut finaliser
- [ ] Status devient `completed`
- [ ] Inventaire mis à jour

---

## Phase 8: Build & Déploiement

### Préparation
- [ ] Toutes les corrections appliquées
- [ ] Tous les tests passent
- [ ] Pas d'erreur dans console

### Build
- [ ] `npm run build`
- [ ] Build réussit sans erreur
- [ ] Pas d'erreur TypeScript
- [ ] Pas d'erreur ESLint

### Vérification Finale
- [ ] Tester en local après build
- [ ] Vérifier toutes les pages
- [ ] Vérifier tous les workflows
- [ ] Vérifier les performances

---

## Résumé

### ✅ Vert (OK)
Tout fonctionne, aucune correction nécessaire

### ⚠️ Orange (Attention)
Quelques corrections mineures nécessaires (ADD VALUE)

### ❌ Rouge (Urgent)
Corrections majeures nécessaires (CREATE TYPE, CREATE TRIGGER)

---

## Prochaine Étape

Après avoir coché les éléments de Phase 1 et 2:
**Partager les résultats pour créer la migration de correction**

---

**Commencer maintenant avec Phase 1**
