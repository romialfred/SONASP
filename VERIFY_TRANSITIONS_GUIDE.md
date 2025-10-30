# 🔍 Guide: Vérifier les Transitions Airport → Refinery

## 📋 Objectif

Vérifier si les transitions de la migration `20251030010000_fix_airport_validation_workflow.sql` existent déjà dans la base de données **avant** de réexécuter la migration.

---

## 🎯 Transitions à Vérifier

### Transitions du Fix (2)
1. `received_at_airport` → `validated_for_refinery`
2. `validated_for_refinery` → `waiting_refinery_receipt`

### Workflow Complet (5 transitions)
1. `approved_for_transport` → `waiting_airport_receipt`
2. `waiting_airport_receipt` → `received_at_airport`
3. `received_at_airport` → `validated_for_refinery` ⭐ **FIX**
4. `validated_for_refinery` → `waiting_refinery_receipt` ⭐ **FIX**
5. `waiting_refinery_receipt` → `received_at_refinery`

---

## 📝 Étape 1: Vérification Simple

Copiez et exécutez ce SQL dans **Supabase SQL Editor**:

```sql
-- Vérifier si les transitions du fix existent
SELECT 
  from_status,
  to_status,
  requires_role,
  description,
  is_active
FROM allowed_status_transitions
WHERE 
  (from_status = 'received_at_airport' AND to_status = 'validated_for_refinery')
  OR (from_status = 'validated_for_refinery' AND to_status = 'waiting_refinery_receipt')
ORDER BY from_status;
```

### Résultats Attendus

#### ✅ Si les transitions EXISTENT (2 lignes)
```
from_status              | to_status                  | requires_role | is_active
-------------------------|----------------------------|---------------|----------
received_at_airport      | validated_for_refinery     | airport_staff | true
validated_for_refinery   | waiting_refinery_receipt   | airport_staff | true
```

**Action:** ✅ **Aucune migration nécessaire!** Les transitions existent déjà.

---

#### ❌ Si les transitions N'EXISTENT PAS (0 lignes)
```
(No rows returned)
```

**Action:** ⚠️ **Migration requise!** Passez à l'Étape 3.

---

#### ⚠️ Si SEULEMENT 1 transition existe
```
from_status              | to_status                  | requires_role | is_active
-------------------------|----------------------------|---------------|----------
received_at_airport      | validated_for_refinery     | airport_staff | true
```

**Action:** ⚠️ **Migration partielle requise!** Passez à l'Étape 3.

---

## 📊 Étape 2: Vérification Complète (Optionnelle)

Pour un diagnostic complet, exécutez ce SQL:

```sql
-- ============================================
-- Vérification Complète: Airport → Refinery Workflow
-- ============================================

-- 1. Vérifier les 2 transitions critiques pour le fix
SELECT 
  '1. Transitions du Fix' as section,
  from_status,
  to_status,
  requires_role,
  description,
  is_active,
  CASE 
    WHEN is_active THEN '✓ Existe et Active'
    ELSE '⚠ Existe mais Inactive'
  END as status
FROM allowed_status_transitions
WHERE 
  (from_status = 'received_at_airport' AND to_status = 'validated_for_refinery')
  OR (from_status = 'validated_for_refinery' AND to_status = 'waiting_refinery_receipt')
ORDER BY from_status;

-- 2. Résumé: Transitions manquantes
WITH expected_transitions AS (
  SELECT 'approved_for_transport' as from_status, 'waiting_airport_receipt' as to_status
  UNION ALL SELECT 'waiting_airport_receipt', 'received_at_airport'
  UNION ALL SELECT 'received_at_airport', 'validated_for_refinery'
  UNION ALL SELECT 'validated_for_refinery', 'waiting_refinery_receipt'
  UNION ALL SELECT 'waiting_refinery_receipt', 'received_at_refinery'
)
SELECT 
  '2. Transitions Manquantes' as section,
  e.from_status,
  e.to_status,
  CASE 
    WHEN a.from_status IS NULL THEN '❌ MANQUANTE'
    WHEN NOT a.is_active THEN '⚠ Inactive'
    ELSE '✓ OK'
  END as status
FROM expected_transitions e
LEFT JOIN allowed_status_transitions a 
  ON e.from_status = a.from_status AND e.to_status = a.to_status
ORDER BY e.from_status;

-- 3. Statistiques finales
SELECT 
  (SELECT COUNT(*) FROM allowed_status_transitions 
   WHERE (from_status = 'received_at_airport' AND to_status = 'validated_for_refinery')
      OR (from_status = 'validated_for_refinery' AND to_status = 'waiting_refinery_receipt')
  ) as transitions_du_fix,
  (SELECT COUNT(*) FROM allowed_status_transitions
   WHERE (from_status = 'approved_for_transport' AND to_status = 'waiting_airport_receipt')
      OR (from_status = 'waiting_airport_receipt' AND to_status = 'received_at_airport')
      OR (from_status = 'received_at_airport' AND to_status = 'validated_for_refinery')
      OR (from_status = 'validated_for_refinery' AND to_status = 'waiting_refinery_receipt')
      OR (from_status = 'waiting_refinery_receipt' AND to_status = 'received_at_refinery')
  ) as workflow_complet_sur_5,
  CASE 
    WHEN (SELECT COUNT(*) FROM allowed_status_transitions
          WHERE (from_status = 'received_at_airport' AND to_status = 'validated_for_refinery')
             OR (from_status = 'validated_for_refinery' AND to_status = 'waiting_refinery_receipt')
         ) = 2 THEN '✅ Migration déjà exécutée'
    ELSE '⚠️ Migration à exécuter'
  END as action_requise;
```

---

## 🔧 Étape 3: Exécuter la Migration (si nécessaire)

Si l'Étape 1 montre que les transitions sont manquantes, exécutez cette migration:

```sql
/*
  # Fix Airport Validation Workflow
  
  Ajoute les transitions manquantes pour le workflow Airport → Refinery
*/

-- Transition 1: Airport validation
INSERT INTO allowed_status_transitions (
  from_status,
  to_status,
  requires_role,
  is_system_transition,
  description
) VALUES
  ('received_at_airport', 'validated_for_refinery', 'airport_staff', false,
   'Airport staff validates batch for refinery transport')
ON CONFLICT (from_status, to_status) DO NOTHING;

-- Transition 2: Ship to refinery
INSERT INTO allowed_status_transitions (
  from_status,
  to_status,
  requires_role,
  is_system_transition,
  description
) VALUES
  ('validated_for_refinery', 'waiting_refinery_receipt', 'airport_staff', false,
   'Batch shipped from airport to refinery')
ON CONFLICT (from_status, to_status) DO NOTHING;

-- Vérification
SELECT 
  'Résultat de la migration' as info,
  COUNT(*) as transitions_ajoutees
FROM allowed_status_transitions
WHERE 
  (from_status = 'received_at_airport' AND to_status = 'validated_for_refinery')
  OR (from_status = 'validated_for_refinery' AND to_status = 'waiting_refinery_receipt');
```

### Résultat Attendu
```
info                        | transitions_ajoutees
----------------------------|--------------------
Résultat de la migration    | 2
```

---

## ✅ Étape 4: Validation Finale

Après la migration (ou si les transitions existaient déjà), testez le workflow:

### Test 1: Validate for Refinery
1. Aller sur `/receiving`
2. Trouver un batch avec statut `received_at_airport`
3. Cliquer **"Validate for Refinery"**
4. Confirmer dans le modal

**Résultat attendu:**
- ✅ Batch passe au statut `validated_for_refinery`
- ✅ Aucune erreur console
- ✅ Message de succès

### Test 2: Ship to Refinery (futur)
1. Batch avec statut `validated_for_refinery`
2. Action "Ship to Refinery"

**Résultat attendu:**
- ✅ Batch passe au statut `waiting_refinery_receipt`

---

## 📝 Résumé: Décision Rapide

| Étape 1 Résultat | Action                          |
|------------------|---------------------------------|
| **2 lignes**     | ✅ Aucune action requise       |
| **1 ligne**      | ⚠️ Exécuter migration partielle |
| **0 lignes**     | ⚠️ Exécuter migration complète  |

---

## 🎯 Commande Copy-Paste Rapide

**Pour vérifier:**
```sql
SELECT COUNT(*) as transitions_presentes
FROM allowed_status_transitions
WHERE (from_status = 'received_at_airport' AND to_status = 'validated_for_refinery')
   OR (from_status = 'validated_for_refinery' AND to_status = 'waiting_refinery_receipt');
```

**Interprétation:**
- `2` → ✅ Migration déjà faite
- `1` → ⚠️ Migration partielle nécessaire
- `0` → ❌ Migration complète nécessaire

---

## 📞 Support

Si les transitions existent mais le workflow ne fonctionne pas:
1. Vérifier `is_active = true`
2. Vérifier `requires_role = 'airport_staff'`
3. Vérifier que le code front-end utilise `validateForRefinery()` (pas `confirmReceipt()`)

**Fichiers à vérifier:**
- `src/services/batchTransitionService.ts` (ligne 237-248)
- `src/services/batchActionsService.ts` (ligne 140-151)
- `src/pages/receiving/ReceivingDashboard.tsx` (ligne 100-117)
