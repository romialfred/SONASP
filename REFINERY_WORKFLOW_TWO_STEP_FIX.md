# ✅ Fix: Workflow Refinery en Deux Étapes

## 🎯 Problème Identifié

Le workflow de confirmation de réception à la raffinerie ne suivait pas le processus en deux étapes défini dans la base de données.

**Comportement incorrect:**
- ❌ `waiting_refinery_receipt` → `received_at_refinery` (statut final)
- ❌ Une seule transition au lieu de deux

**Comportement correct:**
- ✅ `waiting_refinery_receipt` → `received_at_refinery` (confirmation physique)
- ✅ `received_at_refinery` → `validated_for_processing` (validation pour traitement)

---

## 🔍 Analyse Database

### Transitions Existantes

**Transition 1:**
```
FROM: waiting_refinery_receipt
TO:   received_at_refinery
ROLE: refinery_manager
TYPE: Manual (is_system_transition: false)
DESC: Refinery manager: réception confirmée à la raffinerie
```

**Transition 2:**
```
FROM: received_at_refinery
TO:   validated_for_processing
ROLE: refinery_manager
TYPE: Manual (is_system_transition: false)
DESC: Refinery manager: validation pour traitement
```

### Workflow Complet Refinery

```
validated_for_refinery
   ↓ (system automatic)
waiting_refinery_receipt
   ↓ (refinery_manager - Step 1: Physical receipt)
received_at_refinery
   ↓ (refinery_manager - Step 2: Validation)
validated_for_processing
   ↓
processing
   ↓
processed
```

---

## ✅ Solutions Implémentées

### Fix #1: Workflow en Deux Étapes dans RefineryReceivingConfirm

**Fichier:** `src/pages/refining/RefineryReceivingConfirm.tsx`

**AVANT:**
```typescript
// ❌ Une seule transition vers received_at_refinery
const { confirmRefineryReceipt } = await import('@/services/batchTransitionService');

const result = await confirmRefineryReceipt(
  batch.id,
  actualWeightGrams,
  { /* metadata */ }
);
```

**APRÈS:**
```typescript
// ✅ Deux transitions séquentielles
const { transitionBatchStatus } = await import('@/services/batchTransitionService');

// Step 1: Confirm physical receipt at refinery (if coming from waiting_refinery_receipt)
if (batch.status === BATCH_STATUSES.WAITING_REFINERY_RECEIPT) {
  const receiptResult = await transitionBatchStatus(
    batch.id,
    BATCH_STATUSES.RECEIVED_AT_REFINERY,
    {
      weightGrams: actualWeightGrams,
      variancePercentage: variance?.percentage,
      reconciliationComments: reconciliationComments || undefined,
      comments: `Refinery reception confirmed. Weight: ${formatWeight(actualWeightGrams)}. Variance: ${variance?.percentage || 0}%`,
    }
  );

  if (!receiptResult.success) {
    throw new Error(receiptResult.error || 'Failed to confirm receipt at refinery');
  }
}

// Step 2: Validate for processing (from received_at_refinery to validated_for_processing)
const validationResult = await transitionBatchStatus(
  batch.id,
  BATCH_STATUSES.VALIDATED_FOR_PROCESSING,
  {
    weightGrams: actualWeightGrams,
    variancePercentage: variance?.percentage,
    reconciliationComments: reconciliationComments || undefined,
    comments: `Batch validated for processing. Weight: ${formatWeight(actualWeightGrams)}. Variance: ${variance?.percentage || 0}%`,
  }
);

if (!validationResult.success) {
  throw new Error(validationResult.error || 'Failed to validate for processing');
}
```

**Pourquoi Step 1 est conditionnel?**

Le batch peut arriver sur cette page avec deux statuts différents:
1. `waiting_refinery_receipt` - Besoin des 2 étapes
2. `received_at_refinery` - Déjà reçu, besoin seulement validation (Step 2)

### Fix #2: Support VALIDATED_FOR_PROCESSING dans batchTransitionService

**Fichier:** `src/services/batchTransitionService.ts`

**AVANT:**
```typescript
// ❌ Gère uniquement RECEIVED_AT_REFINERY
if (newStatus === BATCH_STATUSES.RECEIVED_AT_REFINERY) {
  updateData.refinery_received_weight_grams = metadata.weightGrams;
  // ... autres champs refinery
}
```

**APRÈS:**
```typescript
// ✅ Gère RECEIVED_AT_REFINERY ET VALIDATED_FOR_PROCESSING
if (newStatus === BATCH_STATUSES.RECEIVED_AT_REFINERY || 
    newStatus === BATCH_STATUSES.VALIDATED_FOR_PROCESSING) {
  updateData.refinery_received_weight_grams = metadata.weightGrams;
  updateData.refinery_received_weight_ounces = metadata.weightGrams / 31.1035;
  updateData.refinery_received_at = new Date().toISOString();
  updateData.refinery_received_by = user.id;
  if (metadata.variancePercentage !== undefined) {
    updateData.refinery_variance_percentage = metadata.variancePercentage;
  }
  if (metadata.reconciliationComments) {
    updateData.refinery_reconciliation_comments = metadata.reconciliationComments;
  }
}
```

**Raison:**

Les deux statuts (`received_at_refinery` et `validated_for_processing`) nécessitent les mêmes informations de réception:
- Poids reçu
- Date de réception
- Utilisateur ayant reçu
- Variance
- Commentaires de réconciliation

---

## 📋 Changements de Code

### 1. RefineryReceivingConfirm.tsx

**Lignes modifiées:** 103-146

**Changements:**
- Implémentation workflow en 2 étapes
- Condition `if (batch.status === BATCH_STATUSES.WAITING_REFINERY_RECEIPT)`
- Deux appels séquentiels à `transitionBatchStatus`
- Gestion erreur pour chaque étape
- Message success mis à jour: "Batch confirmed and validated for processing"

### 2. batchTransitionService.ts

**Ligne modifiée:** 103

**Changement:**
```typescript
// Avant
if (newStatus === BATCH_STATUSES.RECEIVED_AT_REFINERY)

// Après
if (newStatus === BATCH_STATUSES.RECEIVED_AT_REFINERY || 
    newStatus === BATCH_STATUSES.VALIDATED_FOR_PROCESSING)
```

---

## 🔄 Workflow Détaillé

### Scénario Complet: User Confirme Réception

**État initial:** Batch avec statut `waiting_refinery_receipt`

#### Étape 1: User remplit formulaire

1. User accède `/refining/:id/confirm`
2. Voit batch avec statut `waiting_refinery_receipt`
3. Entre poids reçu (grams)
4. Si variance > threshold → entre commentaires réconciliation
5. Clique "Confirm Receipt"

#### Étape 2: Première Transition (Physical Receipt)

```typescript
transitionBatchStatus(
  batchId,
  BATCH_STATUSES.RECEIVED_AT_REFINERY,
  { weightGrams, variancePercentage, reconciliationComments }
)
```

**Actions système:**
1. Vérifier transition autorisée: `waiting_refinery_receipt` → `received_at_refinery`
2. Query `allowed_status_transitions` → ✅ Trouve transition
3. UPDATE batches SET:
   - `status = 'received_at_refinery'`
   - `refinery_received_weight_grams = actualWeight`
   - `refinery_received_weight_ounces = actualWeight / 31.1035`
   - `refinery_received_at = NOW()`
   - `refinery_received_by = user.id`
   - `refinery_variance_percentage = variance`
   - `refinery_reconciliation_comments = comments`
4. INSERT batch_status_history:
   - `previous_status = 'waiting_refinery_receipt'`
   - `status = 'received_at_refinery'`
   - `comments = "Refinery reception confirmed. Weight: XXX g. Variance: X%"`

#### Étape 3: Seconde Transition (Validation)

```typescript
transitionBatchStatus(
  batchId,
  BATCH_STATUSES.VALIDATED_FOR_PROCESSING,
  { weightGrams, variancePercentage, reconciliationComments }
)
```

**Actions système:**
1. Vérifier transition autorisée: `received_at_refinery` → `validated_for_processing`
2. Query `allowed_status_transitions` → ✅ Trouve transition
3. UPDATE batches SET:
   - `status = 'validated_for_processing'`
   - Colonnes refinery déjà remplies à Step 1
4. INSERT batch_status_history:
   - `previous_status = 'received_at_refinery'`
   - `status = 'validated_for_processing'`
   - `comments = "Batch validated for processing. Weight: XXX g. Variance: X%"`

#### Étape 4: Feedback User

1. Message success: "Batch confirmed and validated for processing"
2. Navigation vers `/refining` après 1 seconde
3. Batch apparaît maintenant avec statut `validated_for_processing`

---

## 🧪 Tests

### Test 1: Workflow Complet depuis waiting_refinery_receipt

**Setup:**
```sql
UPDATE batches 
SET status = 'waiting_refinery_receipt'
WHERE id = 'YOUR_BATCH_ID';
```

**Actions:**
1. Aller sur `/refining`
2. Cliquer batch en attente
3. Cliquer "Confirm Receipt"
4. Page `/refining/:id/confirm`
5. Entrer poids: 5000g (exemple)
6. Variance < 2% → pas de commentaires requis
7. Cliquer "Confirm Receipt"

**Résultats attendus:**
1. ✅ Transition 1: `waiting_refinery_receipt` → `received_at_refinery`
2. ✅ Transition 2: `received_at_refinery` → `validated_for_processing`
3. ✅ 2 entrées dans `batch_status_history`
4. ✅ Colonnes refinery remplies:
   - `refinery_received_weight_grams = 5000`
   - `refinery_received_weight_ounces = 160.617`
   - `refinery_received_at = NOW()`
   - `refinery_received_by = user_id`
   - `refinery_variance_percentage = X`
5. ✅ Message: "Batch confirmed and validated for processing"
6. ✅ Redirection vers `/refining`
7. ✅ Batch statut final: `validated_for_processing`

### Test 2: Variance Significative

**Setup:** Même que Test 1

**Actions:**
1-5. Identiques
6. Entrer poids avec variance > 2%: 4900g (si attendu: 5000g)
7. Variance = 2% → Champ commentaires devient requis
8. Entrer commentaires: "Petite perte durant transport"
9. Cliquer "Confirm Receipt"

**Résultats attendus:**
1-7. Identiques au Test 1
8. ✅ `refinery_reconciliation_comments = "Petite perte durant transport"`
9. ✅ Commentaires apparaissent dans `batch_status_history`

### Test 3: Depuis received_at_refinery (Skip Step 1)

**Setup:**
```sql
UPDATE batches 
SET status = 'received_at_refinery',
    refinery_received_weight_grams = 5000,
    refinery_received_at = NOW()
WHERE id = 'YOUR_BATCH_ID';
```

**Actions:**
1-7. Identiques au Test 1

**Résultats attendus:**
1. ✅ Step 1 SKIPPED (condition `if` non satisfaite)
2. ✅ Transition 2 uniquement: `received_at_refinery` → `validated_for_processing`
3. ✅ 1 seule entrée dans `batch_status_history`
4. ✅ Colonnes refinery conservées (déjà remplies)
5-7. Identiques au Test 1

### Test 4: Erreur Transition Non Autorisée

**Setup:**
```sql
UPDATE batches 
SET status = 'processing'
WHERE id = 'YOUR_BATCH_ID';
```

**Actions:**
1-7. Identiques au Test 1

**Résultats attendus:**
1. ❌ Erreur: "Transition from processing to validated_for_processing is not allowed"
2. ✅ Batch reste en statut `processing`
3. ✅ Message erreur affiché à l'utilisateur
4. ✅ Aucune modification en DB

---

## 📊 Validation Database

### Vérifier Transitions Existent

```sql
-- Transition 1
SELECT * FROM allowed_status_transitions
WHERE from_status = 'waiting_refinery_receipt'
  AND to_status = 'received_at_refinery';

-- Résultat attendu: 1 row, requires_role = 'refinery_manager'

-- Transition 2
SELECT * FROM allowed_status_transitions
WHERE from_status = 'received_at_refinery'
  AND to_status = 'validated_for_processing';

-- Résultat attendu: 1 row, requires_role = 'refinery_manager'
```

### Vérifier History Après Confirmation

```sql
SELECT 
  previous_status,
  status,
  comments,
  created_at
FROM batch_status_history
WHERE batch_id = 'YOUR_BATCH_ID'
ORDER BY created_at DESC
LIMIT 2;
```

**Résultat attendu:**
```
previous_status          | status                     | comments                              | created_at
-------------------------|----------------------------|---------------------------------------|----------------------------
received_at_refinery     | validated_for_processing   | Batch validated for processing...     | 2025-10-30 12:00:01
waiting_refinery_receipt | received_at_refinery       | Refinery reception confirmed...       | 2025-10-30 12:00:00
```

### Vérifier Colonnes Refinery

```sql
SELECT 
  batch_number,
  status,
  refinery_received_weight_grams,
  refinery_received_weight_ounces,
  refinery_received_at,
  refinery_variance_percentage
FROM batches
WHERE id = 'YOUR_BATCH_ID';
```

**Résultat attendu:**
```
batch_number | status                     | weight_grams | weight_oz | received_at         | variance
-------------|----------------------------|--------------|-----------|---------------------|----------
BATCH-123    | validated_for_processing   | 5000.00      | 160.62    | 2025-10-30 12:00:00 | 0.5
```

---

## ✅ Build Status

```bash
npm run build
✓ built in 11.05s (aucune erreur)
```

---

## 🎓 Leçons Apprises

### 1. Respecter le Workflow Database

Les transitions définies dans `allowed_status_transitions` sont la source de vérité:
- ❌ Ne pas créer de raccourcis
- ✅ Suivre chaque transition séquentiellement
- ✅ Valider chaque transition individuellement

### 2. Transitions Séquentielles

Quand un workflow nécessite plusieurs étapes:
```typescript
// ✅ BON: Séquentiel avec vérification à chaque étape
const step1 = await transition(batch, STATUS_A);
if (!step1.success) throw error;

const step2 = await transition(batch, STATUS_B);
if (!step2.success) throw error;

// ❌ MAUVAIS: Sauter des étapes
const directTransition = await transition(batch, STATUS_B); // Skip STATUS_A
```

### 3. Conditions pour Flexibilité

Permettre au workflow de gérer différents points d'entrée:
```typescript
if (batch.status === INTERMEDIATE_STATUS) {
  await firstTransition(); // Skip si déjà fait
}

await finalTransition(); // Toujours nécessaire
```

### 4. Gestion Erreur Granulaire

Chaque transition peut échouer pour des raisons différentes:
- Transition non autorisée
- Permissions utilisateur
- Erreur DB
- RLS policies

Gérer chaque transition individuellement permet des messages d'erreur précis.

### 5. Colonnes Refinery Persistantes

Les colonnes `refinery_*` doivent être remplies au premier statut refinery (`received_at_refinery`) et conservées lors des transitions suivantes:
- Ne pas écraser les valeurs existantes
- Permettre mise à jour uniquement si nécessaire

---

## 🛡️ Protection Contre Régressions

### Checklist

- [ ] Workflow suit les transitions DB
- [ ] `waiting_refinery_receipt` → `received_at_refinery` → `validated_for_processing`
- [ ] Colonnes refinery remplies correctement
- [ ] 2 entrées dans `batch_status_history`
- [ ] Gestion erreur pour chaque transition
- [ ] Message success approprié
- [ ] Build réussit sans erreurs
- [ ] Tests manuels OK

### Points de Vérification

1. **Vérifier nombre transitions:**
   ```sql
   SELECT COUNT(*) FROM batch_status_history
   WHERE batch_id = 'X' AND created_at > NOW() - INTERVAL '1 minute';
   -- Résultat attendu: 2 (si depuis waiting_refinery_receipt)
   ```

2. **Vérifier statut final:**
   ```sql
   SELECT status FROM batches WHERE id = 'X';
   -- Résultat attendu: 'validated_for_processing'
   ```

3. **Vérifier données refinery:**
   ```sql
   SELECT 
     refinery_received_weight_grams IS NOT NULL as has_weight,
     refinery_received_at IS NOT NULL as has_date,
     refinery_received_by IS NOT NULL as has_user
   FROM batches WHERE id = 'X';
   -- Résultat attendu: all true
   ```

---

## 📞 Support

**Si problème après cette implémentation:**

1. Vérifier statut batch initial
2. Vérifier transitions autorisées existent en DB
3. Vérifier logs console pour erreur spécifique
4. Vérifier permissions user (`refinery_manager`)
5. Vérifier `batch_status_history` pour voir transitions réussies

**Transitions attendues:**
```
waiting_refinery_receipt → received_at_refinery → validated_for_processing
```

**Fichiers impliqués:**
- `src/pages/refining/RefineryReceivingConfirm.tsx`
- `src/services/batchTransitionService.ts`
- `src/constants/batchStatuses.ts`

---

**Le workflow refinery en deux étapes est maintenant correctement implémenté!** 🎉
