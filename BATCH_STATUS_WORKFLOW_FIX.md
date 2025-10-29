# NETTOYAGE: Transitions de Statut - Suppression des Doublons

## 🐛 Problème

**Dans la table `allowed_status_transitions`:**
- ❌ Multiples doublons à cause d'exécutions répétées de migrations
- ❌ Beaucoup de transitions inutilisées ou incorrectes
- ❌ Confusion sur le workflow réel

**Exemple visible dans le screenshot:**
Vous voyez dans l'image plusieurs transitions en double avec des rôles différents.

## 🎯 Objectif

Nettoyer la table et garder UNIQUEMENT les transitions valides selon le workflow officiel.

## 📊 Workflow Officiel de Référence

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WORKFLOW PRINCIPAL                            │
└─────────────────────────────────────────────────────────────────────┘

1. FACTORY (Création et Approbation)
   created
      ↓ [factory_manager approves]
   approved_for_transport
      ↓ [factory_staff ships]
   waiting_airport_receipt

   Alternative:
   pending_factory_approval
      ↓ [factory_manager approves]
   approved_for_transport
      ↓ [OR cancelled by factory_manager]
   cancelled

2. AIRPORT (Réception et Validation)
   waiting_airport_receipt
      ↓ [airport_staff confirms receipt]
   received_at_airport
      ↓ [airport_manager validates]
   validated_for_refinery
      ↓ [airport_staff ships to refinery]
   waiting_refinery_receipt

   Alternative:
   waiting_airport_receipt → cancelled [by management]

3. REFINERY (Réception et Traitement)
   waiting_refinery_receipt
      ↓ [refinery_staff confirms receipt]
   received_at_refinery
      ↓ [refinery_manager validates]
   validated_for_processing
      ↓ [refinery_staff starts processing]
   processing
      ↓ [refinery_staff completes] ⭐ CRITIQUE!
   processed
      ↓ [refinery_staff adds to inventory]
   in_inventory

   Alternative:
   waiting_refinery_receipt → cancelled [by management]

4. SALES (Vente)
   in_inventory
      ↓ [management approves for sale]
   ready_for_sale
      ↓ [sales_staff allocates to sale]
   allocated_to_sale
      ↓ [sales_manager finalizes]
   sold

   Alternatives:
   ready_for_sale → in_inventory [management removes from sale]
   allocated_to_sale → ready_for_sale [sales_staff cancels allocation]
```

## 🗑️ Script de Nettoyage

**Fichier:** `CLEAN_TRANSITIONS_REFERENCE_WORKFLOW.sql`

### Ce que fait le script:

1. ✅ **Backup temporaire** des transitions actuelles (sécurité)
2. ✅ **Compte les doublons** avant nettoyage
3. ✅ **Supprime TOUTES** les transitions existantes
4. ✅ **Insère UNIQUEMENT** les 21 transitions valides du workflow officiel
5. ✅ **Vérifie** qu'il n'y a plus de doublons
6. ✅ **Affiche** toutes les transitions dans l'ordre du workflow

### Transitions Valides (21 au total):

**FACTORY (5):**
- created → approved_for_transport
- approved_for_transport → waiting_airport_receipt
- approved_for_transport → cancelled
- pending_factory_approval → approved_for_transport
- pending_factory_approval → cancelled

**AIRPORT (4):**
- waiting_airport_receipt → received_at_airport
- waiting_airport_receipt → cancelled
- received_at_airport → waiting_refinery_receipt
- received_at_airport → validated_for_refinery

**REFINERY (7):**
- waiting_refinery_receipt → received_at_refinery
- waiting_refinery_receipt → cancelled
- received_at_refinery → validated_for_processing
- validated_for_processing → processing
- validated_for_refinery → waiting_refinery_receipt
- **processing → processed** ⭐ (La transition critique!)
- **processed → in_inventory** ⭐

**SALES (5):**
- in_inventory → ready_for_sale
- ready_for_sale → allocated_to_sale
- ready_for_sale → in_inventory
- allocated_to_sale → sold
- allocated_to_sale → ready_for_sale

## 📋 Étapes d'Exécution

### 1. Analyser l'État Actuel (OPTIONNEL)

Exécutez d'abord `ANALYZE_TRANSITIONS.sql` pour voir les doublons:

```sql
-- Voir les doublons
SELECT 
  from_status,
  to_status,
  COUNT(*) as duplicate_count
FROM allowed_status_transitions
GROUP BY from_status, to_status
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
```

### 2. Exécuter le Nettoyage

**Dans Supabase SQL Editor:**

1. Copier tout le contenu de `CLEAN_TRANSITIONS_REFERENCE_WORKFLOW.sql`
2. Exécuter
3. Observer les messages de progression

**Messages attendus:**
```
NOTICE: ═══════════════════════════════════════════════
NOTICE: BEFORE CLEANUP
NOTICE: ═══════════════════════════════════════════════
NOTICE: Total transitions: 47
NOTICE: Unique transitions: 23
NOTICE: Duplicates to remove: 24
...
NOTICE: ═══════════════════════════════════════════════
NOTICE: AFTER CLEANUP
NOTICE: ═══════════════════════════════════════════════
NOTICE: Total transitions: 21
NOTICE: Unique transitions: 21
NOTICE: Duplicates: 0
...
NOTICE: ✓✓✓ CLEANUP COMPLETED SUCCESSFULLY ✓✓✓
```

### 3. Vérifier le Résultat

```sql
-- Compter les transitions
SELECT COUNT(*) as total FROM allowed_status_transitions;
-- Résultat attendu: 21

-- Voir toutes les transitions
SELECT from_status, to_status, requires_role, description
FROM allowed_status_transitions
ORDER BY from_status, to_status;

-- Vérifier qu'il n'y a AUCUN doublon
SELECT from_status, to_status, COUNT(*) 
FROM allowed_status_transitions
GROUP BY from_status, to_status
HAVING COUNT(*) > 1;
-- Résultat attendu: 0 lignes
```

### 4. Tester le Workflow

**Test de la transition critique:**

1. Créer un batch avec status = 'processing'
2. Aller sur `/refining`
3. Cliquer "Process Completed"
4. ✅ Devrait fonctionner: processing → processed
5. Aller sur `/inventory`
6. Cliquer "Add Inventory Entry"
7. ✅ Devrait fonctionner: processed → in_inventory

## ⚠️ IMPORTANT: Sécurité

**Le script crée un backup temporaire:**
```sql
CREATE TEMP TABLE transitions_backup AS
SELECT * FROM allowed_status_transitions;
```

**Si vous avez besoin de restaurer:**
```sql
-- Restaurer depuis le backup (DANS LA MÊME SESSION seulement!)
DELETE FROM allowed_status_transitions;
INSERT INTO allowed_status_transitions 
SELECT * FROM transitions_backup;
```

**Note:** Le backup TEMP disparaît quand vous fermez la session SQL Editor.

## 🎯 Résultats Attendus

**Avant le nettoyage:**
- Total: ~47+ transitions
- Doublons: ~24+
- Confusion sur le workflow

**Après le nettoyage:**
- Total: **21 transitions exactement**
- Doublons: **0**
- Workflow clair et cohérent
- Toutes les fonctionnalités marchent

## 📁 Fichiers

1. ✅ `CLEAN_TRANSITIONS_REFERENCE_WORKFLOW.sql` - Script de nettoyage principal
2. ✅ `ANALYZE_TRANSITIONS.sql` - Analyse des doublons
3. ✅ `BATCH_STATUS_WORKFLOW_FIX.md` - Ce document

---

**Exécutez le nettoyage pour avoir un workflow propre et sans doublons!** 🎉
