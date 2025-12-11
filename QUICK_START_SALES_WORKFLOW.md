# 🚀 Démarrage Rapide - Workflow Ventes

## ⚡ SOLUTION EN 5 MINUTES

### 1️⃣ Ajouter les Statuses (2 min)

**Supabase Dashboard → SQL Editor:**

Copier-coller et exécuter: `ADD_SALES_WORKFLOW_STATUSES.sql`

```sql
-- Ajoute: create_sales, pending_management_approval,
-- management_approved, management_rejected,
-- pending_for_customer_approval, customer_approved,
-- customer_rejected, waiting_for_payment,
-- virtual_payment, payment_received, completed
```

### 2️⃣ Ajouter les Colonnes (1 min)

**Supabase Dashboard → SQL Editor:**

Copier-coller et exécuter: `ADD_SALES_APPROVAL_COLUMNS.sql`

```sql
-- Ajoute: management_approved_by, customer_approved_by,
-- payment_amount, payment_date, completed_at, etc.
```

### 3️⃣ Redémarrer l'App (1 min)

```bash
rm -rf node_modules/.vite/ dist/ && npm run dev
```

### 4️⃣ Tester (1 min)

1. Ouvrir l'app en mode incognito
2. Créer une nouvelle vente
3. ✅ Devrait fonctionner!

## 📊 WORKFLOW IMPLÉMENTÉ

```
┌─────────────────────────────────────────────────┐
│  1. CREATE SALE                                 │
│     Status: pending_management_approval         │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│  2. MANAGEMENT APPROVES                         │
│     Status: pending_for_customer_approval       │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│  3. CUSTOMER APPROVES                           │
│     Status: waiting_for_payment                 │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│  4. PAYMENT RECEIVED                            │
│     Status: payment_received → completed        │
└─────────────────────────────────────────────────┘
```

## 🎯 UTILISATION

### Service d'Approbation Créé

```typescript
import {
  approveSaleByManagement,
  rejectSaleByManagement,
  approveSaleByCustomer,
  rejectSaleByCustomer,
  recordPayment
} from '@/services/salesApprovalService';
```

### Exemple: Management Approuve

```typescript
await approveSaleByManagement({
  sale_id: 'abc-123',
  approver_id: currentUser.id,
  approver_role: 'management',
  notes: 'Approved'
});

// Résultat: Status passe à 'pending_for_customer_approval'
```

### Exemple: Customer Approuve

```typescript
await approveSaleByCustomer({
  sale_id: 'abc-123',
  approver_id: currentUser.id,
  approver_role: 'customer',
  notes: 'Confirmed'
});

// Résultat: Status passe à 'waiting_for_payment'
```

### Exemple: Enregistrer Paiement

```typescript
await recordPayment({
  sale_id: 'abc-123',
  payment_amount: 1515784.00,
  payment_date: '2025-12-13',
  payment_method: 'wire_transfer',
  payment_proof_url: 'https://...'
});

// Résultat: Status passe à 'completed'
```

## ✅ VÉRIFICATION

```sql
-- Tous les statuses disponibles?
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status')
ORDER BY enumsortorder;

-- Devrait afficher 14 valeurs
```

## 🎨 PROCHAINES ÉTAPES

Pour compléter l'UI:

1. **Page Management Approvals** - Liste des ventes à approuver
2. **Page Customer Approvals** - Liste pour le client
3. **Page Payment Recording** - Enregistrer les paiements
4. **Email Notifications** - Notifier les parties prenantes

Voir `SALES_WORKFLOW_IMPLEMENTATION_COMPLETE.md` pour les détails.

## 📁 FICHIERS

- ✅ `ADD_SALES_WORKFLOW_STATUSES.sql` - Migration statuses
- ✅ `ADD_SALES_APPROVAL_COLUMNS.sql` - Migration colonnes
- ✅ `src/services/salesApprovalService.ts` - Service complet
- ✅ `SALES_WORKFLOW_IMPLEMENTATION_COMPLETE.md` - Guide détaillé
- ✅ `APPLY_SALES_WORKFLOW_MIGRATION.md` - Guide migration

## 🆘 BESOIN D'AIDE?

- Guide détaillé: `SALES_WORKFLOW_IMPLEMENTATION_COMPLETE.md`
- Guide migration: `APPLY_SALES_WORKFLOW_MIGRATION.md`
- Vérification DB: `CHECK_SALES_TABLE_STRUCTURE.sql`

---

**Temps**: 5 minutes
**Difficulté**: Facile
**Zero Regression**: ✅
