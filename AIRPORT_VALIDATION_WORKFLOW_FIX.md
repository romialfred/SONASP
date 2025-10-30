# ✅ Correction: Airport Validation Workflow

## 🐛 Problème Identifié

**Workflow incorrect:**
Quand le batch est `received_at_airport` et qu'on clique "Validate for Refinery", le système ouvrait un formulaire de réception (page `/receiving/:id/confirm`). C'est incorrect!

**Comportement attendu:**
- Airport staff valide le batch avec une simple confirmation
- Pas de formulaire de réception
- Message d'avertissement: "This action is irreversible"
- Transition directe: `received_at_airport` → `validated_for_refinery`

---

## ✅ Workflow Correct (Implémenté)

```
Factory Approval
    ↓
[approved_for_transport]
    ↓ Ship to Airport
[waiting_airport_receipt]
    ↓ Confirm Receipt (avec poids)
[received_at_airport]
    ↓ Validate for Refinery ✅ CORRIGÉ
    │ (simple confirmation, irreversible)
    │ Action par: airport_staff
    ↓
[validated_for_refinery]
    ↓ Ship to Refinery
[waiting_refinery_receipt]
    ↓ Confirm Receipt at Refinery
[received_at_refinery]
    ↓ Validate for Processing
[validated_for_processing]
    ↓ Start Processing
[processing]
    ↓ Complete Processing
[processed]
    ↓
[in_inventory]
```

---

## 🔧 Corrections Appliquées

### 1. Nouveau Service: `validateForRefinery()`

**Fichier:** `src/services/batchTransitionService.ts`

Ajout d'une fonction dédiée pour la validation airport:

```typescript
/**
 * Specific transition: Validate batch for refinery (Simple validation by airport staff)
 * After batch is received_at_airport, airport staff validates it for refinery transport
 */
export async function validateForRefinery(
  batchId: string,
  comments?: string
): Promise<TransitionResult> {
  return transitionBatchStatus(
    batchId,
    BATCH_STATUSES.VALIDATED_FOR_REFINERY,
    {
      comments: comments || 'Batch validated for refinery transport by airport staff',
    }
  );
}
```

**Avantages:**
- ✅ Pas de poids requis
- ✅ Pas de variance à calculer
- ✅ Simple confirmation avec commentaire optionnel
- ✅ Suit le workflow défini

---

### 2. Nouveau Handler: `onValidateForRefinery`

**Fichier:** `src/services/batchActionsService.ts`

**Avant (INCORRECT):**
```typescript
if (status === BATCH_STATUSES.RECEIVED_AT_AIRPORT && isAirportStaff) {
  actions.push({
    id: 'validate_for_refinery',
    label: 'Validate for Refinery',
    icon: CheckCircle,
    variant: 'success',
    handler: handlers.onConfirmReceipt || (() => {}), // ❌ MAUVAIS
    requiresConfirmation: true,
    confirmationMessage: 'Validate this batch for refinery transport?',
    visible: true,
  });
}
```

**Après (CORRECT):**
```typescript
if (status === BATCH_STATUSES.RECEIVED_AT_AIRPORT && isAirportStaff) {
  actions.push({
    id: 'validate_for_refinery',
    label: 'Validate for Refinery',
    icon: CheckCircle,
    variant: 'success',
    handler: handlers.onValidateForRefinery || (() => {}), // ✅ CORRECT
    requiresConfirmation: true,
    confirmationMessage: 'Validate this batch for refinery transport? This action is irreversible.', // ⚠️ Warning ajouté
    visible: true,
  });
}
```

**Interface mise à jour:**
```typescript
handlers: {
  onApproveForTransport?: (batchId: string) => Promise<void>;
  onConfirmReceipt?: (batchId: string) => void;
  onValidateForRefinery?: (batchId: string) => Promise<void>; // ✅ NEW
  onViewDetails?: (batchId: string) => void;
  onEdit?: (batchId: string) => void;
  onCancel?: (batchId: string) => Promise<void>;
  onStartProcessing?: (batchId: string) => void;
  onTrackShipment?: (batchId: string) => void;
}
```

---

### 3. Implémentation Dashboard

**Fichier:** `src/pages/receiving/ReceivingDashboard.tsx`

**Nouveau Handler:**
```typescript
const handleValidateForRefinery = async (batchId: string) => {
  // This will be called after confirmation modal
  try {
    const { validateForRefinery } = await import('@/services/batchTransitionService');
    const result = await validateForRefinery(batchId, 'Validated by airport staff');

    if (result.success) {
      // Batch will refresh automatically via realtime
      console.log('✅ Batch validated for refinery:', result.data);
    } else {
      console.error('❌ Failed to validate batch:', result.error);
      alert('Failed to validate batch: ' + result.error);
    }
  } catch (error) {
    console.error('Error validating batch:', error);
    alert('Error validating batch. Please try again.');
  }
};
```

**Action Click Handler mis à jour:**
```typescript
const handleActionClick = (actionId: string, batchId: string) => {
  if (actionId === 'confirm_receipt' || actionId === 'receive_batch') {
    handleConfirmReceipt(batchId);
  } else if (actionId === 'view_details') {
    handleViewDetails(batchId);
  }
  // validate_for_refinery is handled by BatchCard confirmation modal
};
```

**Tous les appels `getAvailableBatchActions` mis à jour:**
```typescript
const actions = getAvailableBatchActions(
  batch,
  { role: getUserRole() },
  'shipping',
  {
    onViewDetails: handleViewDetails,
    onConfirmReceipt: handleConfirmReceipt,
    onValidateForRefinery: handleValidateForRefinery, // ✅ Added
  }
);
```

---

### 4. Migration Base de Données

**Fichier:** `supabase/migrations/20251030010000_fix_airport_validation_workflow.sql`

**Transitions ajoutées:**

1. `received_at_airport` → `validated_for_refinery` (airport_staff)
2. `validated_for_refinery` → `waiting_refinery_receipt` (airport_staff)

```sql
-- Ensure received_at_airport → validated_for_refinery transition exists
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

-- Ensure validated_for_refinery → waiting_refinery_receipt transition exists
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
```

**Vérification automatique:**
- Compte les 5 transitions critiques Airport → Refinery
- Affiche un warning si des transitions manquent

---

## 📊 Workflow Complet Airport → Refinery

### Étape 1: Factory Approval
```
Status: approved_for_transport
Role: factory_manager
Action: Aucune (déjà approuvé)
```

### Étape 2: Ship to Airport
```
Status: approved_for_transport → waiting_airport_receipt
Role: factory_staff / system
Action: Automatic lors de "Confirm Receipt" si batch approved_for_transport
```

### Étape 3: Confirm Receipt at Airport
```
Status: waiting_airport_receipt → received_at_airport
Role: airport_staff
Action: Click "Confirm Receipt"
Form: ✅ Oui (avec poids reçu, variance)
Page: /receiving/:id/confirm
```

### Étape 4: Validate for Refinery ✅ CORRIGÉ
```
Status: received_at_airport → validated_for_refinery
Role: airport_staff
Action: Click "Validate for Refinery"
Form: ❌ Non (simple confirmation modal)
Modal: "Validate this batch for refinery transport? This action is irreversible."
Handler: handleValidateForRefinery() → validateForRefinery()
```

### Étape 5: Ship to Refinery
```
Status: validated_for_refinery → waiting_refinery_receipt
Role: airport_staff / transport
Action: Manual shipping action (à implémenter)
```

### Étape 6: Confirm Receipt at Refinery
```
Status: waiting_refinery_receipt → received_at_refinery
Role: refinery_staff
Action: Click "Confirm Receipt at Refinery"
Form: ✅ Oui (avec poids reçu, variance)
Page: /refining/:id/confirm (similaire à airport)
```

---

## 🎯 Différences Clés: Confirm Receipt vs Validate

### Confirm Receipt (Airport/Refinery)
- ✅ Formulaire avec champs de saisie
- ✅ Poids reçu (grams) requis
- ✅ Calcul de variance automatique
- ✅ Commentaires pour réconciliation si variance > 2%
- ✅ Upload de documents possibles
- 📍 Page dédiée: `/receiving/:id/confirm`

### Validate for Refinery
- ❌ Pas de formulaire
- ❌ Pas de poids à saisir
- ✅ Simple modal de confirmation
- ⚠️ Message: "This action is irreversible"
- ✅ Validation immédiate
- 📍 Action dans la carte du batch

---

## 📁 Fichiers Modifiés

### Code
1. ✅ `src/services/batchTransitionService.ts` (lignes 233-248)
   - Ajout fonction `validateForRefinery()`
   - Marquage `validateAirportReceipt()` comme deprecated

2. ✅ `src/services/batchActionsService.ts` (lignes 44-58, 140-151)
   - Ajout handler `onValidateForRefinery` dans interface
   - Modification action `validate_for_refinery` pour utiliser nouveau handler
   - Message de confirmation mis à jour avec "irreversible"

3. ✅ `src/pages/receiving/ReceivingDashboard.tsx` (lignes 100-130, 186-310)
   - Ajout fonction `handleValidateForRefinery()`
   - Mise à jour `handleActionClick()` pour gérer validation séparément
   - Tous les appels `getAvailableBatchActions` mis à jour

### Migration
4. ✅ `supabase/migrations/20251030010000_fix_airport_validation_workflow.sql`
   - Transitions `received_at_airport → validated_for_refinery`
   - Transitions `validated_for_refinery → waiting_refinery_receipt`
   - Vérification complète workflow Airport → Refinery

---

## ✅ Tests de Validation

### Scénario 1: Validation Simple
```
1. Batch status: received_at_airport
2. User (airport_staff) clique "Validate for Refinery"
3. Modal apparaît: "Validate this batch for refinery transport? 
                    This action is irreversible."
4. User clique "Confirm"

Résultat attendu:
✓ Transition: received_at_airport → validated_for_refinery
✓ Message console: "✅ Batch validated for refinery: ..."
✓ Batch disparaît de "Need Validation"
✓ Batch apparaît dans "Validated" section
✓ Status badge: "Validated for Refinery"
```

### Scénario 2: Validation puis Shipping
```
1. Batch status: validated_for_refinery
2. User (airport_staff) clique "Ship to Refinery"
3. Confirmation

Résultat attendu:
✓ Transition: validated_for_refinery → waiting_refinery_receipt
✓ Batch apparaît dans dashboard Refinery
✓ Bouton "Confirm Receipt at Refinery" disponible
```

### Scénario 3: Refinery Receipt
```
1. Batch status: waiting_refinery_receipt
2. User (refinery_staff) clique "Confirm Receipt at Refinery"
3. Form appears avec poids reçu

Résultat attendu:
✓ Page: /refining/:id/confirm
✓ Form similaire à airport receipt
✓ Calcul variance automatique
✓ Transition: waiting_refinery_receipt → received_at_refinery
```

---

## 🎯 Résultat Final

### Avant
- ❌ "Validate for Refinery" ouvrait formulaire de réception
- ❌ Confusion entre validation et réception
- ❌ Workflow incorrect

### Après
- ✅ "Validate for Refinery" = simple confirmation modal
- ✅ Message "irreversible" pour alerter l'utilisateur
- ✅ Pas de formulaire, transition directe
- ✅ Workflow clair: Réception (avec form) ≠ Validation (simple)
- ✅ Airport staff contrôle complètement le workflow
- ✅ Migration pour garantir transitions DB

---

## 📋 Migrations à Exécuter

### Migration 1: Approved → Waiting (Déjà créée)
```sql
-- File: 20251030000000_add_approved_to_waiting_transition.sql
INSERT INTO allowed_status_transitions (
  from_status, to_status, requires_role, 
  is_system_transition, description
) VALUES
  ('approved_for_transport', 'waiting_airport_receipt', 
   'factory_staff', false,
   'Batch shipped from factory to airport')
ON CONFLICT (from_status, to_status) DO NOTHING;
```

### Migration 2: Airport Validation Workflow (Nouvelle)
```sql
-- File: 20251030010000_fix_airport_validation_workflow.sql
INSERT INTO allowed_status_transitions (
  from_status, to_status, requires_role, 
  is_system_transition, description
) VALUES
  ('received_at_airport', 'validated_for_refinery', 
   'airport_staff', false,
   'Airport staff validates batch for refinery transport'),
  ('validated_for_refinery', 'waiting_refinery_receipt', 
   'airport_staff', false,
   'Batch shipped from airport to refinery')
ON CONFLICT (from_status, to_status) DO NOTHING;
```

**Vérification:**
```sql
-- Vérifier toutes les transitions Airport → Refinery
SELECT from_status, to_status, requires_role, description
FROM allowed_status_transitions
WHERE from_status IN (
  'approved_for_transport',
  'waiting_airport_receipt',
  'received_at_airport',
  'validated_for_refinery'
)
ORDER BY from_status, to_status;
```

---

## ✅ Build Status

```bash
npm run build
✓ built in 8.32s (aucune erreur)
```

---

**Le workflow Airport Validation est maintenant correct! Simple confirmation sans formulaire, action irréversible par airport_staff.** 🎉
