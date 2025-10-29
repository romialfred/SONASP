# Guide de Normalisation des Statuts de Batches

## 🎯 Objectif

Cette migration analyse **tous les batches existants** et corrige automatiquement les statuts invalides pour les rendre conformes aux transitions définies dans `allowed_status_transitions`.

## 📋 Ordre Complet des Migrations

Voici l'ordre EXACT d'exécution des 4 migrations:

```
1. 20251029110000_add_missing_status_transitions.sql
   → Ajoute les transitions manquantes

2. 20251029120000_add_processed_status_and_fix_workflow.sql
   → Ajoute le statut 'processed' et corrige le workflow

3. 20251029130000_fix_processed_inventory_transition_role.sql
   → Corrige le rôle de la transition processed → in_inventory

4. 20251029140000_normalize_batch_statuses.sql
   → Normalise TOUS les statuts existants dans les batches ⭐
```

## 🔍 Ce que fait la Migration de Normalisation

### Étape 1: Analyse
```sql
-- Compte tous les batches
SELECT COUNT(*) FROM batches;

-- Vérifie chaque statut
SELECT DISTINCT status FROM batches;
```

### Étape 2: Mapping Automatique

La migration mappe automatiquement les statuts invalides vers leurs équivalents valides:

| Statut Invalide | Statut Valide Mappé |
|---|---|
| `created`, `draft`, `new` | `pending_factory_approval` |
| `validated`, `approved` | `approved_for_transport` |
| `in_transit_to_airport` | `waiting_airport_receipt` |
| `at_airport` | `received_at_airport` |
| `airport_validated` | `validated_for_refinery` |
| `in_transit_to_refinery` | `waiting_refinery_receipt` |
| `at_refinery` | `received_at_refinery` |
| `refinery_validated` | `validated_for_processing` |
| `in_processing` | `processing` |
| `process_complete` | `processed` |
| `inventory`, `in_stock` | `in_inventory` |
| `for_sale` | `ready_for_sale` |
| `allocated`, `reserved` | `allocated_to_sale` |
| `sale_complete` | `sold` |
| `canceled`, `deleted` | `cancelled` |
| **Statut inconnu** | `pending_factory_approval` (sécurité) |

### Étape 3: Mise à Jour

```sql
-- Pour chaque batch avec statut invalide
UPDATE batches 
SET status = <statut_valide_mappé>, 
    updated_at = now()
WHERE status = <statut_invalide>;
```

### Étape 4: Audit Trail

Toutes les modifications sont enregistrées dans une table temporaire:

```sql
CREATE TEMP TABLE batch_status_updates (
  batch_id UUID,
  batch_number TEXT,
  old_status TEXT,
  new_status TEXT,
  reason TEXT,
  updated_at TIMESTAMPTZ
);
```

### Étape 5: Validation

Vérifie que tous les statuts ont des transitions sortantes valides:

```sql
-- Trouve les statuts sans transitions
SELECT DISTINCT b.status, COUNT(*) as batch_count
FROM batches b
WHERE b.status NOT IN ('sold', 'cancelled')
  AND NOT EXISTS (
    SELECT 1 FROM allowed_status_transitions ast
    WHERE ast.from_status = b.status
  )
GROUP BY b.status;
```

### Étape 6: Rapport

Affiche:
- ✅ Nombre total de batches analysés
- ✅ Nombre de batches mis à jour
- ✅ Nombre de batches inchangés
- ✅ Distribution actuelle des statuts
- ✅ Log de tous les changements

## 📊 Statuts Valides

Les 15 statuts valides reconnus par le système:

```
1.  pending_factory_approval     (Créé, en attente d'approbation)
2.  approved_for_transport       (Approuvé pour transport)
3.  waiting_airport_receipt      (En transit vers aéroport)
4.  received_at_airport          (Reçu à l'aéroport)
5.  validated_for_refinery       (Validé par aéroport)
6.  waiting_refinery_receipt     (En transit vers raffinerie)
7.  received_at_refinery         (Reçu à la raffinerie)
8.  validated_for_processing     (Validé pour traitement)
9.  processing                   (En cours de traitement)
10. processed                    (Traitement terminé) ⭐ NOUVEAU
11. in_inventory                 (En inventaire)
12. ready_for_sale               (Prêt pour vente)
13. allocated_to_sale            (Alloué à une vente)
14. sold                         (Vendu)
15. cancelled                    (Annulé)
```

## 🧪 Exemple d'Exécution

### Avant la Migration

```sql
-- Batches avec statuts variés
SELECT batch_number, status FROM batches LIMIT 5;

batch_number | status
-------------|-------------------
B-2024-001   | created            ❌ Invalide
B-2024-002   | approved           ❌ Invalide
B-2024-003   | in_inventory       ✅ Valide
B-2024-004   | at_airport         ❌ Invalide
B-2024-005   | processing         ✅ Valide
```

### Pendant la Migration

```
========================================
Batch Status Normalization
========================================
Total batches to analyze: 50

Updated batch B-2024-001: created → pending_factory_approval
Updated batch B-2024-002: approved → approved_for_transport
Updated batch B-2024-004: at_airport → received_at_airport

========================================
Validating Status Transitions
========================================
✓ All statuses have valid transitions

========================================
Normalization Complete
========================================
Total batches analyzed: 50
Batches updated: 3
Batches unchanged: 47

Current Batch Status Distribution:
  pending_factory_approval     : 15 batches
  processing                   : 12 batches
  in_inventory                 : 10 batches
  received_at_airport          : 8 batches
  sold                         : 5 batches
```

### Après la Migration

```sql
-- Tous les statuts sont valides
SELECT batch_number, status FROM batches LIMIT 5;

batch_number | status
-------------|---------------------------
B-2024-001   | pending_factory_approval  ✅
B-2024-002   | approved_for_transport    ✅
B-2024-003   | in_inventory              ✅
B-2024-004   | received_at_airport       ✅
B-2024-005   | processing                ✅
```

## 🔍 Vérification Post-Migration

### 1. Vérifier tous les statuts

```sql
-- Voir la distribution des statuts
SELECT status, COUNT(*) as count
FROM batches
GROUP BY status
ORDER BY count DESC;
```

### 2. Vérifier les changements effectués

```sql
-- Voir tous les changements (si migration vient d'être exécutée)
SELECT * FROM batch_status_updates
ORDER BY updated_at DESC;
```

### 3. Vérifier qu'il n'y a pas de statuts orphelins

```sql
-- Trouver les statuts sans transitions sortantes
SELECT DISTINCT b.status, COUNT(*) as batch_count
FROM batches b
WHERE b.status NOT IN ('sold', 'cancelled')
  AND NOT EXISTS (
    SELECT 1 FROM allowed_status_transitions ast
    WHERE ast.from_status = b.status
  )
GROUP BY b.status;

-- Résultat attendu: 0 lignes
```

### 4. Vérifier les transitions disponibles pour chaque statut

```sql
-- Voir toutes les transitions disponibles
SELECT 
  from_status,
  to_status,
  requires_role,
  is_system_transition
FROM allowed_status_transitions
ORDER BY from_status, to_status;
```

## ⚠️ Cas Particuliers

### Que faire si un batch a un statut complètement inconnu?

La migration le met automatiquement à `pending_factory_approval` par sécurité:

```sql
-- Statut inconnu
status = 'statut_bizarre_123'

-- Devient
status = 'pending_factory_approval'
reason = 'Invalid status mapped to valid equivalent'
```

### Que faire si des batches sont bloqués?

Après la migration, si des batches ne peuvent pas progresser:

```sql
-- 1. Identifier le batch
SELECT id, batch_number, status FROM batches WHERE batch_number = 'B-2024-XXX';

-- 2. Voir les transitions disponibles
SELECT to_status, requires_role 
FROM allowed_status_transitions 
WHERE from_status = 'current_status';

-- 3. Faire la transition manuellement (si nécessaire)
-- Via l'interface utilisateur ou:
UPDATE batches 
SET status = 'next_valid_status', updated_at = now()
WHERE batch_number = 'B-2024-XXX';
```

## 📁 Fichiers de Migration Complets

### Structure Complète

```
supabase/migrations/
├── 20251029110000_add_missing_status_transitions.sql
│   └── Ajoute transitions manquantes Airport/Refinery
│
├── 20251029120000_add_processed_status_and_fix_workflow.sql
│   └── Ajoute statut 'processed' + workflow complet
│
├── 20251029130000_fix_processed_inventory_transition_role.sql
│   └── Corrige: processed → in_inventory (refinery_staff)
│
└── 20251029140000_normalize_batch_statuses.sql ⭐
    └── Normalise TOUS les batches existants
```

## ✅ Checklist Post-Migration

- [ ] Migration 110000 exécutée
- [ ] Migration 120000 exécutée  
- [ ] Migration 130000 exécutée
- [ ] Migration 140000 exécutée ⭐
- [ ] Aucun batch avec statut invalide
- [ ] Tous les statuts ont des transitions sortantes
- [ ] Distribution des statuts vérifiée
- [ ] Log des changements consulté
- [ ] Tests utilisateur effectués

## 🎯 Résultat Final Attendu

Après avoir exécuté les 4 migrations:

1. ✅ Tous les statuts de batches sont **valides**
2. ✅ Toutes les transitions sont **cohérentes**
3. ✅ Le workflow est **complet** et **fonctionnel**
4. ✅ Les rôles des transitions sont **corrects**
5. ✅ Le statut `'processed'` est **disponible**
6. ✅ Le flow visuel affiche **8 checkpoints clés**
7. ✅ Aucun batch n'est **bloqué**

## 📚 Documentation Associée

1. **COMPLETE_BATCH_WORKFLOW_FIXED.md** - Workflow complet
2. **BATCH_STATUS_FLOW_UPDATED.md** - Flow visuel optimisé
3. **CORRECTION_TRANSITION_PROCESSED_INVENTORY.md** - Correction transition
4. **Ce document** - Guide de normalisation

---

**Date:** 29 Octobre 2025  
**Version:** 2.0 - Normalisation Complète  
**Statut:** ✅ PRÊT À EXÉCUTER  
**Impact:** 🔄 Met à jour TOUS les batches existants  
**Sécurité:** ✅ Crée un audit trail complet
