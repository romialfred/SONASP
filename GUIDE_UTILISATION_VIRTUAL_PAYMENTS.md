# Guide d'Utilisation - Système de Paiements Virtuels

## Vue d'Ensemble

Votre table `payments` possède déjà une infrastructure partielle pour les paiements virtuels avec:
- Colonnes `is_virtual` et `payment_type`
- Plusieurs triggers existants
- Contraintes NOT NULL sur `bank_name` et `reference_number`

## Le Problème Actuel

### Contraintes Bloquantes

```sql
bank_name TEXT NOT NULL        ← Bloque les paiements virtuels
reference_number TEXT NOT NULL ← Bloque les paiements virtuels
```

Ces contraintes empêchent la création de paiements virtuels car:
- Un paiement virtuel = créé automatiquement quand le client approuve
- À ce moment, on n'a PAS encore les détails bancaires
- Les détails seront remplis plus tard quand le paiement réel arrive

## La Solution

### Script à Utiliser

**Fichier:** `/tmp/cc-agent/59164212/project/fix_virtual_payments_compatible.sql`

Ce script:
1. ✅ Supprime les contraintes NOT NULL sur `bank_name` et `reference_number`
2. ✅ Crée la fonction de calcul des dates d'échéance
3. ✅ Crée le trigger pour création automatique
4. ✅ Backfill les ventes existantes avec status `customer_approved`
5. ✅ Utilise les colonnes existantes (`is_virtual`, `payment_type`, `virtual_due_date`, etc.)

### Différences avec Votre Structure Actuelle

| Colonne Existante | Utilisation dans le Script |
|-------------------|----------------------------|
| `is_virtual` | ✅ Mis à `true` pour paiements virtuels |
| `payment_type` | ✅ Mis à `'virtual'` (au lieu de `'actual'`) |
| `mechanism_type` | ✅ Copié depuis `sales.mechanism_type` |
| `auto_credited_at` | ✅ Rempli avec `NOW()` à la création |
| `virtual_due_date` | ✅ Calculé selon `mechanism_type` |
| `bank_name` | ⏳ NULL jusqu'au paiement réel |
| `reference_number` | ⏳ NULL jusqu'au paiement réel |
| `payment_method` | ⏳ NULL jusqu'au paiement réel |
| `actual_date` | ⏳ NULL jusqu'au paiement réel |

## Workflow Complet

### 1. Vente Approuvée par le Client

```sql
-- Sale status: 'customer_approved'
UPDATE sales SET status = 'customer_approved' WHERE id = '...';
```

### 2. Paiement Virtuel Créé Automatiquement

Le trigger `trigger_create_virtual_payment_on_approval` s'exécute et crée:

```sql
INSERT INTO payments (
  sale_id,
  customer_id,
  expected_date,        -- Calculé selon mechanism_type
  amount,               -- Copié de sale.final_proceeds
  currency,             -- Copié de sale.currency
  status,               -- 'pending'
  is_virtual,           -- true
  payment_type,         -- 'virtual'
  mechanism_type,       -- Copié de sale.mechanism_type
  auto_credited_at,     -- NOW()
  virtual_due_date,     -- expected_date + 30 jours
  invoice_number,       -- 'INV-20251214-XXXXXXXX'
  bank_name,            -- NULL ← Sera rempli plus tard
  reference_number,     -- NULL ← Sera rempli plus tard
  payment_method,       -- NULL ← Sera rempli plus tard
  actual_date           -- NULL ← Sera rempli plus tard
);
```

### 3. Visible dans l'Application

Le paiement virtuel apparaît dans `/payments`:
- Invoice Number: `INV-20251214-XXXXXXXX`
- Amount: `792464.78 USD`
- Status: `Pending`
- Type: `Virtual`
- Expected Date: Calculé selon le type de vente

### 4. Conversion en Paiement Réel

Quand le paiement réel arrive, l'utilisateur:

```typescript
// Frontend: Update payment with actual details
await supabase
  .from('payments')
  .update({
    payment_type: 'actual',          // virtual → actual
    is_virtual: false,                // true → false
    bank_name: 'Bank of Africa',
    reference_number: 'REF-2025-001',
    payment_method: 'wire_transfer',
    actual_date: '2025-12-20',
    status: 'approved',
    converted_to_actual_at: new Date(),
    converted_by: userId
  })
  .eq('id', paymentId);
```

### 5. Triggers Existants Activés

Vos triggers existants s'activent alors:

| Trigger | Action |
|---------|--------|
| `trigger_sync_payment_type` | Synchronise `is_virtual` avec `payment_type` |
| `trigger_enforce_payment_type_consistency` | Valide la cohérence |
| `trigger_update_sale_on_real_payment` | Met à jour le statut de la vente |

## Calcul des Dates d'Échéance

### Logique du Fonction `calculate_virtual_payment_due_date`

```sql
mechanism_type = 'spot'           → expected_date = aujourd'hui
mechanism_type = 'forward_7'      → expected_date = aujourd'hui + 7 jours
mechanism_type = 'forward_14'     → expected_date = aujourd'hui + 14 jours
autre                             → expected_date = aujourd'hui + 2 jours

virtual_due_date = expected_date + 30 jours
```

### Exemples

| Type de Vente | Date Approbation | Expected Date | Virtual Due Date |
|---------------|------------------|---------------|------------------|
| Spot | 2025-12-14 | 2025-12-14 | 2026-01-13 |
| Forward 7 | 2025-12-14 | 2025-12-21 | 2026-01-20 |
| Forward 14 | 2025-12-14 | 2025-12-28 | 2026-01-27 |
| Standard | 2025-12-14 | 2025-12-16 | 2026-01-15 |

## Exécution du Script

### Étape 1: Ouvrir Supabase SQL Editor

1. Aller sur votre projet Supabase
2. Cliquer sur "SQL Editor"
3. Nouvelle requête

### Étape 2: Copier/Coller le Script

Copier tout le contenu de:
```
/tmp/cc-agent/59164212/project/fix_virtual_payments_compatible.sql
```

### Étape 3: Exécuter

Cliquer sur "Run" ou Ctrl+Enter

### Résultat Attendu

```
NOTICE: ✓ Removed NOT NULL constraint from payments.bank_name
NOTICE: ✓ Removed NOT NULL constraint from payments.reference_number
NOTICE:
NOTICE: ✅ Table structure updated for virtual payments
NOTICE: ✓ Function calculate_virtual_payment_due_date() created
NOTICE: ✓ Function create_virtual_payment_on_approval() created
NOTICE: ✓ Trigger created on sales table
NOTICE:
NOTICE: ==========================================
NOTICE: Backfilling virtual payments...
NOTICE: ==========================================
NOTICE:   ✓ Created: INV-20251214-B53BCF57 - SALE-001 (792464.78 USD)
NOTICE:   ✓ Created: INV-20251214-796F4077 - SALE-002 (150000.00 USD)
NOTICE:
NOTICE: ==========================================
NOTICE: Backfill Summary:
NOTICE:   • Created: 2 virtual payments
NOTICE:   • Skipped: 0 (already exist or error)
NOTICE: ==========================================
NOTICE:
NOTICE: ╔════════════════════════════════════════════════════════╗
NOTICE: ║  Virtual Payments System - Setup Complete             ║
NOTICE: ╚════════════════════════════════════════════════════════╝
NOTICE:
NOTICE: 📊 Current State:
NOTICE:    ├─ Total payments:        2
NOTICE:    ├─ Virtual payments:      2
NOTICE:    ├─ Actual payments:       0
NOTICE:    ├─ Pending virtuals:      2
NOTICE:    └─ Sales awaiting payment: 2
NOTICE:
NOTICE: ⚙️  System Components:
NOTICE:    ├─ Trigger: trigger_create_virtual_payment_on_approval [ACTIVE]
NOTICE:    ├─ Function: create_virtual_payment_on_approval()
NOTICE:    └─ Helper: calculate_virtual_payment_due_date()
NOTICE:
NOTICE: ✅ System ready!
NOTICE:    When a sale status changes to "customer_approved",
NOTICE:    a virtual payment will be automatically created.
NOTICE:
NOTICE: 💡 Next steps:
NOTICE:    1. Open /payments in your application
NOTICE:    2. You should see 2 pending virtual payment(s)
NOTICE:    3. When actual payment is received, convert virtual→actual
```

## Vérification Post-Installation

### Query 1: Voir tous les paiements

```sql
SELECT
  p.invoice_number,
  p.payment_type,
  p.is_virtual,
  p.amount,
  p.currency,
  p.status,
  p.expected_date,
  p.virtual_due_date,
  p.bank_name,
  p.reference_number,
  s.sale_number,
  c.name as customer_name
FROM payments p
LEFT JOIN sales s ON s.id = p.sale_id
LEFT JOIN customers c ON c.id = p.customer_id
ORDER BY p.created_at DESC;
```

**Résultat Attendu:**

| invoice_number | payment_type | is_virtual | amount | status | bank_name | reference_number |
|----------------|--------------|------------|--------|--------|-----------|------------------|
| INV-20251214-... | virtual | true | 792464.78 | pending | NULL | NULL |
| INV-20251214-... | virtual | true | 150000.00 | pending | NULL | NULL |

### Query 2: Vérifier le trigger

```sql
SELECT
  tgname as trigger_name,
  tgenabled as enabled,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgname = 'trigger_create_virtual_payment_on_approval';
```

### Query 3: Tester la création automatique

```sql
-- Créer une nouvelle vente de test
INSERT INTO sales (
  sale_number,
  customer_id,
  mechanism_type,
  final_proceeds,
  currency,
  status,
  created_by
) VALUES (
  'SALE-TEST-001',
  (SELECT id FROM customers LIMIT 1),
  'spot',
  10000.00,
  'USD',
  'pending_management_approval',
  auth.uid()
);

-- Approuver la vente (devrait créer le paiement virtuel automatiquement)
UPDATE sales
SET status = 'customer_approved'
WHERE sale_number = 'SALE-TEST-001';

-- Vérifier que le paiement virtuel a été créé
SELECT * FROM payments
WHERE sale_id = (SELECT id FROM sales WHERE sale_number = 'SALE-TEST-001');
```

## Intégration Frontend

### Affichage des Paiements Virtuels

```typescript
// Récupérer tous les paiements avec distinction virtual/actual
const { data: payments } = await supabase
  .from('payments')
  .select(`
    *,
    sale:sales(sale_number),
    customer:customers(name)
  `)
  .order('created_at', { ascending: false });

// Filtrer les paiements virtuels en attente
const virtualPending = payments?.filter(
  p => p.payment_type === 'virtual' && p.status === 'pending'
);

// Filtrer les paiements réels
const actualPayments = payments?.filter(
  p => p.payment_type === 'actual'
);
```

### Badge de Type

```tsx
<span className={
  payment.payment_type === 'virtual'
    ? 'bg-yellow-100 text-yellow-800'
    : 'bg-green-100 text-green-800'
}>
  {payment.payment_type === 'virtual' ? 'Virtual' : 'Actual'}
</span>
```

### Conversion Virtual → Actual

```typescript
async function convertToActualPayment(paymentId: string, data: {
  bank_name: string;
  reference_number: string;
  payment_method: string;
  actual_date: string;
}) {
  const { data: payment, error } = await supabase
    .from('payments')
    .update({
      ...data,
      payment_type: 'actual',
      is_virtual: false,
      status: 'approved',
      converted_to_actual_at: new Date().toISOString(),
      converted_by: userId
    })
    .eq('id', paymentId)
    .select()
    .single();

  if (error) throw error;
  return payment;
}
```

## Triggers Existants - Comportement

Vos triggers existants continueront à fonctionner:

### 1. `trigger_auto_transition_waiting_payment`
```sql
-- S'exécute APRÈS l'insertion d'un paiement virtuel
-- Devrait mettre à jour le statut de la vente
```

### 2. `trigger_sync_payment_type`
```sql
-- Synchronise is_virtual avec payment_type
-- Exemple: payment_type='virtual' → is_virtual=true
```

### 3. `trigger_enforce_payment_type_consistency`
```sql
-- Valide la cohérence entre is_virtual et payment_type
```

### 4. `trigger_prevent_virtual_payment_deletion`
```sql
-- Empêche la suppression accidentelle des paiements virtuels
```

### 5. `trigger_update_sale_on_real_payment`
```sql
-- Met à jour la vente quand payment_type passe à 'real'
```

## Résolution de Problèmes

### Problème: Les paiements virtuels ne sont pas créés

**Vérifier le trigger:**
```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'trigger_create_virtual_payment_on_approval';
```

**Activer le trigger si désactivé:**
```sql
ALTER TABLE sales
ENABLE TRIGGER trigger_create_virtual_payment_on_approval;
```

### Problème: Erreur "null value violates not-null constraint"

**Vérifier les colonnes nullables:**
```sql
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'payments'
AND column_name IN ('bank_name', 'reference_number');
```

**Ré-exécuter la partie 1 du script:**
```sql
ALTER TABLE payments ALTER COLUMN bank_name DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN reference_number DROP NOT NULL;
```

### Problème: Conflits avec triggers existants

**Lister tous les triggers:**
```sql
SELECT tgname, tgenabled, tgtype
FROM pg_trigger
WHERE tgrelid = 'payments'::regclass
OR tgrelid = 'sales'::regclass;
```

Si conflit, ajuster l'ordre d'exécution ou désactiver temporairement.

## Maintenance

### Nettoyer les Paiements Virtuels Expirés

```sql
-- Alerter sur les paiements virtuels en retard
SELECT
  p.invoice_number,
  p.expected_date,
  p.virtual_due_date,
  CURRENT_DATE - p.expected_date as days_overdue,
  s.sale_number,
  c.name as customer
FROM payments p
JOIN sales s ON s.id = p.sale_id
JOIN customers c ON c.id = p.customer_id
WHERE p.payment_type = 'virtual'
  AND p.status = 'pending'
  AND p.expected_date < CURRENT_DATE
ORDER BY days_overdue DESC;
```

### Statistiques

```sql
SELECT
  payment_type,
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount
FROM payments
GROUP BY payment_type, status
ORDER BY payment_type, status;
```

---

**Fichier à utiliser:** `fix_virtual_payments_compatible.sql`

**Compatible avec:** Structure existante de la table `payments` incluant `is_virtual`, `payment_type`, et tous les triggers existants.
