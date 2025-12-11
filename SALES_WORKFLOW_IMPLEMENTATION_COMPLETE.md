# Implémentation Complète - Workflow d'Approbation des Ventes

## 🎯 Objectif

Implémenter un workflow professionnel d'approbation des ventes:

```
Create Sale → Management Approval → Customer Approval → Payment → Completed
```

## ✅ SOLUTION COMPLÈTE

### Étape 1: Ajouter les Statuses à l'Enum (CRITIQUE)

**Fichier**: `ADD_SALES_WORKFLOW_STATUSES.sql`

1. Ouvrir Supabase Dashboard → SQL Editor
2. Copier-coller le contenu du fichier
3. Cliquer sur **Run**

**Résultat**: Ajoute 11 nouveaux statuses à l'enum `sale_status`

### Étape 2: Ajouter les Colonnes d'Approbation

**Fichier**: `ADD_SALES_APPROVAL_COLUMNS.sql`

1. Ouvrir Supabase Dashboard → SQL Editor
2. Copier-coller le contenu du fichier
3. Cliquer sur **Run**

**Résultat**: Ajoute les colonnes pour tracker les approbations:
- `management_approved_by`, `management_approved_at`, `management_approval_notes`
- `management_rejected_by`, `management_rejected_at`, `management_rejection_notes`
- `customer_approved_by`, `customer_approved_at`, `customer_approval_notes`
- `customer_rejected_by`, `customer_rejected_at`, `customer_rejection_notes`
- `payment_amount`, `payment_date`, `payment_method`, `payment_proof_url`, `payment_notes`
- `completed_at`

### Étape 3: Vérifier l'Installation

```sql
-- Vérifier les statuses
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status')
ORDER BY enumsortorder;

-- Vérifier les colonnes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sales'
  AND column_name LIKE '%approved%'
     OR column_name LIKE '%rejected%'
     OR column_name LIKE '%payment%'
     OR column_name = 'completed_at'
ORDER BY column_name;
```

### Étape 4: Redémarrer l'Application

```bash
# Vider cache et redémarrer
rm -rf node_modules/.vite/ dist/ && npm run dev
```

## 📊 WORKFLOW DÉTAILLÉ

### 1. Création de Vente

**Status Initial**: `pending_management_approval`

```typescript
// Dans SaleCreate.tsx
const { data, error } = await supabase
  .from('sales')
  .insert({
    // ... autres champs
    status: SALES_STATUSES.PENDING_MANAGEMENT_APPROVAL,
    created_by: user.id
  });
```

### 2. Approbation Management

**Transition**: `pending_management_approval` → `pending_for_customer_approval`

```typescript
import { approveSaleByManagement } from '@/services/salesApprovalService';

// Management approuve
await approveSaleByManagement({
  sale_id: saleId,
  approver_id: currentUser.id,
  approver_role: 'management',
  notes: 'Approved for customer review'
});

// Résultat: Sale status = 'pending_for_customer_approval'
// Email envoyé au client (à implémenter)
```

### 3. Approbation Client

**Transition**: `pending_for_customer_approval` → `waiting_for_payment`

```typescript
import { approveSaleByCustomer } from '@/services/salesApprovalService';

// Client approuve
await approveSaleByCustomer({
  sale_id: saleId,
  approver_id: customerId,
  approver_role: 'customer',
  notes: 'Agreement confirmed'
});

// Résultat: Sale status = 'waiting_for_payment'
```

### 4. Réception Paiement

**Transition**: `waiting_for_payment` → `payment_received` → `completed`

```typescript
import { recordPayment } from '@/services/salesApprovalService';

// Enregistrer le paiement
await recordPayment({
  sale_id: saleId,
  payment_amount: 1515784.00,
  payment_date: '2025-12-13',
  payment_method: 'wire_transfer',
  payment_proof_url: 'https://...',
  notes: 'Payment received via bank wire'
});

// Résultat:
// 1. Sale status = 'payment_received'
// 2. Automatiquement: sale status = 'completed'
```

## 🔐 PERMISSIONS RLS

Vérifier que les policies permettent les opérations:

```sql
-- Policy pour UPDATE (approbations)
CREATE POLICY "Users can update sales they manage"
ON sales
FOR UPDATE
TO authenticated
USING (
  -- User est le créateur OU management role
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'management'
  )
)
WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'management'
  )
);

-- Policy pour SELECT
CREATE POLICY "Users can view relevant sales"
ON sales
FOR SELECT
TO authenticated
USING (
  -- Voir ses propres ventes
  created_by = auth.uid()
  -- OU ventes de son customer
  OR customer_id IN (
    SELECT id FROM customers WHERE id = auth.uid()
  )
  -- OU si management
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('management', 'admin')
  )
);
```

## 🎨 INTERFACE UTILISATEUR

### Page Management Approvals

```typescript
// src/pages/admin/SalesApprovalsDashboard.tsx
import { getSalesPendingManagementApproval, approveSaleByManagement, rejectSaleByManagement } from '@/services/salesApprovalService';

export function SalesApprovalsDashboard() {
  const [pendingSales, setPendingSales] = useState([]);

  useEffect(() => {
    async function loadPendingSales() {
      const sales = await getSalesPendingManagementApproval();
      setPendingSales(sales);
    }
    loadPendingSales();
  }, []);

  const handleApprove = async (saleId: string) => {
    try {
      await approveSaleByManagement({
        sale_id: saleId,
        approver_id: user.id,
        approver_role: 'management',
        notes: 'Approved'
      });
      // Recharger la liste
      loadPendingSales();
      alert.showSuccess('Sale approved successfully');
    } catch (error) {
      alert.showError('Failed to approve sale');
    }
  };

  return (
    <div>
      <h1>Pending Management Approvals</h1>
      {pendingSales.map(sale => (
        <div key={sale.id}>
          <p>{sale.sale_number}</p>
          <button onClick={() => handleApprove(sale.id)}>
            Approve
          </button>
          <button onClick={() => handleReject(sale.id)}>
            Reject
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Page Customer Approvals

```typescript
// src/pages/customers/CustomerSaleApproval.tsx
import { getSalesPendingCustomerApproval, approveSaleByCustomer } from '@/services/salesApprovalService';

export function CustomerSaleApproval() {
  const [pendingSales, setPendingSales] = useState([]);

  useEffect(() => {
    async function loadPendingSales() {
      const sales = await getSalesPendingCustomerApproval(user.customer_id);
      setPendingSales(sales);
    }
    loadPendingSales();
  }, []);

  const handleApprove = async (saleId: string) => {
    try {
      await approveSaleByCustomer({
        sale_id: saleId,
        approver_id: user.id,
        approver_role: 'customer',
        notes: 'Confirmed'
      });
      loadPendingSales();
      alert.showSuccess('Sale approved successfully');
    } catch (error) {
      alert.showError('Failed to approve sale');
    }
  };

  return (
    <div>
      <h1>Pending Your Approval</h1>
      {pendingSales.map(sale => (
        <div key={sale.id}>
          <p>{sale.sale_number}</p>
          <button onClick={() => handleApprove(sale.id)}>
            Approve
          </button>
        </div>
      ))}
    </div>
  );
}
```

## ✅ CHECKLIST D'IMPLÉMENTATION

### Base de Données
- [ ] Exécuter `ADD_SALES_WORKFLOW_STATUSES.sql`
- [ ] Exécuter `ADD_SALES_APPROVAL_COLUMNS.sql`
- [ ] Vérifier que les 14 statuses existent
- [ ] Vérifier que les colonnes d'approbation existent
- [ ] Configurer les policies RLS

### Code Frontend
- [ ] Service `salesApprovalService.ts` créé
- [ ] Importer le service dans les pages nécessaires
- [ ] Créer page Management Approvals
- [ ] Créer page Customer Approvals
- [ ] Créer page Payment Recording
- [ ] Mettre à jour SaleCreate pour utiliser le bon status initial

### Tests
- [ ] Créer une vente → status = `pending_management_approval`
- [ ] Management approuve → status = `pending_for_customer_approval`
- [ ] Customer approuve → status = `waiting_for_payment`
- [ ] Enregistrer paiement → status = `completed`
- [ ] Tester rejet management
- [ ] Tester rejet customer

### Notification (Optionnel)
- [ ] Email à management quand vente créée
- [ ] Email à customer quand management approuve
- [ ] Email à management quand customer approuve
- [ ] Email à management quand paiement reçu

## 🚀 PROCHAINES ÉTAPES

1. **Appliquer les migrations SQL** (Étapes 1 et 2)
2. **Redémarrer l'application**
3. **Tester la création de vente** → doit fonctionner maintenant!
4. **Créer les pages d'approbation** (Management et Customer)
5. **Implémenter les notifications email** (optionnel)

## 📋 FICHIERS CRÉÉS

- ✅ `ADD_SALES_WORKFLOW_STATUSES.sql` - Ajoute les statuses
- ✅ `ADD_SALES_APPROVAL_COLUMNS.sql` - Ajoute les colonnes
- ✅ `src/services/salesApprovalService.ts` - Service d'approbation
- ✅ `SALES_WORKFLOW_IMPLEMENTATION_COMPLETE.md` - Ce guide
- ✅ `APPLY_SALES_WORKFLOW_MIGRATION.md` - Guide d'application

## 🔍 DIAGNOSTIC

Si le problème persiste:

```sql
-- Vérifier les statuses
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status');

-- Tester l'insertion
INSERT INTO sales (
  sale_number, sale_date, customer_id, seller_id, seller_type,
  quantity_oz, london_am_rate, freight_cost, other_costs,
  gross_proceeds, net_proceeds, royalties, final_proceeds,
  total_amount, currency, status, created_by
) VALUES (
  'TEST-001', CURRENT_DATE,
  (SELECT id FROM customers LIMIT 1),
  (SELECT id FROM mining_companies LIMIT 1),
  'mining_company',
  100, 2700, 0, 0,
  270000, 270000, 8100, 261900,
  261900, 'USD',
  'pending_management_approval',  -- Doit fonctionner maintenant
  auth.uid()
) RETURNING *;
```

---

**Temps d'implémentation**: 15-20 minutes
**Complexité**: Moyenne
**Impact**: Zéro regression - Aucune donnée existante modifiée
