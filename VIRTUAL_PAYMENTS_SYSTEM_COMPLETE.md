# 💳 Système de Paiements Virtuels - Documentation Complète

## 🎯 Vue d'Ensemble

Le système de paiements virtuels permet de **créditer automatiquement le compte de l'entreprise** dès qu'un client approuve une vente, tout en conservant une trace claire pour que le management enregistre ensuite les détails réels du paiement.

### Principe Fondamental

```
Client Approuve Vente
      ↓
Système crée PAIEMENT VIRTUEL automatique
      ↓
Status vente → "waiting_for_payment"
      ↓
Compte entreprise crédité VIRTUELLEMENT
      ↓
Management enregistre détails réels
      ↓
Paiement virtuel → Paiement réel
      ↓
Status vente → "payment_received"
```

---

## 🔄 Workflow Complet

### Étape 1: Customer Approval (Client)

**Lieu:** Page CustomerSaleApproval (`/sales/approve/:saleId/:token`)

```
1. Client reçoit email d'approbation
2. Client ouvre lien et review sale
3. Client voit Payment Terms (Spot, Forward 7, Forward 14)
4. Client clique "Approve Sale"
```

**Résultat:**
```typescript
// Service: customerApproveSale()

✅ Paiement virtuel créé AUTOMATIQUEMENT
   - Amount: final_proceeds de la vente
   - Currency: USD (ou autre)
   - Mechanism: spot, forward_7, forward_14
   - Due Date: Calculée automatiquement
     • Spot: +2 jours ouvrables
     • Forward 7: +7 jours ouvrables
     • Forward 14: +14 jours ouvrables
   - is_virtual: true
   - payment_type: 'virtual'
   - Reference: 'VP-XXXXXXXX' (auto-généré)

✅ Status vente → 'waiting_for_payment'

✅ Compte entreprise crédité VIRTUELLEMENT
```

### Étape 2: Virtual Payment Tracking (Management)

**Lieu:** Page VirtualPaymentsPage (`/payments/virtual`)

Management voit tous les paiements virtuels avec:

**Indicateurs d'urgence:**
- 🔴 **OVERDUE** (rouge) - Dépassé la due date
- 🟠 **DUE TODAY** (orange) - Due aujourd'hui
- 🟡 **DUE SOON** (jaune) - Due dans 2 jours
- ⚪ **PENDING** (gris) - Pas encore urgent

**Statistiques affichées:**
- Total paiements virtuels
- Nombre overdue + montant
- Nombre due today
- Nombre due soon

**Actions disponibles:**
1. **Record Details** → Ouvre modal pour saisir détails réels
2. **Quick Approve** → Marque comme reçu sans détails complets

### Étape 3: Convert to Actual Payment (Management)

**Lieu:** Modal "Record Actual Payment Details"

Management saisit:

```typescript
Informations Requises:
✅ Actual Payment Date
✅ Bank Name
✅ Reference Number

Informations Optionnelles:
• Account Number
• Transaction ID
• FX Rate (si non-USD)
• Proof Document URL
• Additional Notes
```

**Système affiche:**
- Sale Information (numéro, customer)
- Expected Amount
- Due Date
- FX Rate Comparison (si applicable)

**Résultat:**
```typescript
// Service: convertVirtualToActual()

✅ Paiement virtuel → Paiement réel
   - is_virtual: false
   - payment_type: 'actual'
   - Toutes les infos réelles enregistrées
   - converted_to_actual_at: NOW
   - converted_by: user_id
   - status: 'approved'

✅ Status vente → 'payment_received'
```

---

## 🗄️ Structure Base de Données

### Table: payments (Enhanced)

```sql
CREATE TABLE payments (
  -- Colonnes existantes
  id uuid PRIMARY KEY,
  sale_id uuid REFERENCES sales(id),
  customer_id uuid REFERENCES customers(id),
  expected_date date,
  actual_date date,
  amount numeric,
  currency text,
  fx_rate numeric,
  bank_name text,
  account_number text,
  reference_number text,
  proof_url text,
  notes text,
  status text,

  -- 🆕 Nouvelles colonnes pour paiements virtuels
  is_virtual boolean DEFAULT false,
  payment_type text CHECK (payment_type IN ('virtual', 'actual')),
  mechanism_type text, -- spot, forward_7, forward_14
  auto_credited_at timestamptz,
  virtual_due_date date,
  converted_to_actual_at timestamptz,
  converted_by uuid REFERENCES auth.users(id),

  created_by uuid,
  created_at timestamptz DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz
);
```

### Table: sales (Enhanced)

```sql
-- Nouveau status ajouté
ALTER TABLE sales ADD CONSTRAINT sales_status_check
  CHECK (status IN (
    'customer_pending',
    'approved',
    'customer_approved',
    'waiting_for_payment',  -- 🆕 NOUVEAU
    'payment_received',
    'completed',
    'rejected',
    'cancelled'
  ));
```

### Fonctions Database

#### 1. calculate_payment_due_date()

```sql
CREATE FUNCTION calculate_payment_due_date(
  mechanism TEXT,
  approval_date TIMESTAMPTZ
) RETURNS DATE
```

**Utilité:** Calcule automatiquement la due date selon le mécanisme

**Règles:**
- `spot` → +2 jours ouvrables
- `forward_7` → +7 jours ouvrables
- `forward_14` → +14 jours ouvrables
- Autre → +2 jours (défaut)

#### 2. create_virtual_payment()

```sql
CREATE FUNCTION create_virtual_payment(
  p_sale_id UUID,
  p_customer_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_mechanism_type TEXT,
  p_approved_date TIMESTAMPTZ
) RETURNS UUID
```

**Utilité:** Crée un paiement virtuel automatique

**Actions:**
1. Calcule due date avec `calculate_payment_due_date()`
2. Insère payment avec:
   - `is_virtual = true`
   - `payment_type = 'virtual'`
   - `status = 'pending'`
   - `reference_number = 'VP-XXXXXXXX'`
   - Toutes les infos temporaires

#### 3. convert_virtual_to_actual_payment()

```sql
CREATE FUNCTION convert_virtual_to_actual_payment(
  p_payment_id UUID,
  p_actual_date DATE,
  p_bank_name TEXT,
  p_account_number TEXT,
  p_reference_number TEXT,
  p_transaction_id TEXT,
  p_fx_rate NUMERIC,
  p_proof_url TEXT,
  p_notes TEXT,
  p_converted_by UUID
) RETURNS BOOLEAN
```

**Utilité:** Convertit paiement virtuel en réel

**Validations:**
- Vérifie que payment est virtuel
- Met à jour toutes les infos
- Change `is_virtual` à false
- Change `payment_type` à 'actual'
- Enregistre `converted_to_actual_at` et `converted_by`

### Vue: virtual_payments_view

```sql
CREATE VIEW virtual_payments_view AS
SELECT
  p.*,
  s.sale_number,
  s.status as sale_status,
  c.name as customer_name,
  c.email as customer_email,
  CASE
    WHEN p.virtual_due_date < CURRENT_DATE THEN 'overdue'
    WHEN p.virtual_due_date = CURRENT_DATE THEN 'due_today'
    WHEN p.virtual_due_date <= CURRENT_DATE + 2 THEN 'due_soon'
    ELSE 'pending'
  END as payment_urgency,
  (CURRENT_DATE - p.virtual_due_date) as days_overdue
FROM payments p
LEFT JOIN sales s ON p.sale_id = s.id
LEFT JOIN customers c ON p.customer_id = c.id
WHERE p.is_virtual = true
  AND p.payment_type = 'virtual'
ORDER BY p.virtual_due_date ASC;
```

---

## 💻 Architecture Code

### Services

#### 1. salesService.ts (Modified)

**Fonction: `customerApproveSale()`**

```typescript
export async function customerApproveSale(
  saleId: string,
  customerEmail: string
): Promise<{ success: boolean; error?: string; paymentId?: string }> {

  // 1. Récupère sale avec customer
  const { data: sale } = await supabase
    .from('sales')
    .select('*, customer:customers(id, name, email)')
    .eq('id', saleId)
    .maybeSingle();

  const mechanism = sale.mechanism_type?.toLowerCase() || 'spot';

  // 2. TOUJOURS créer paiement virtuel
  const { data: virtualPaymentId } = await supabase
    .rpc('create_virtual_payment', {
      p_sale_id: saleId,
      p_customer_id: sale.customer?.id,
      p_amount: sale.final_proceeds,
      p_currency: 'USD',
      p_mechanism_type: mechanism,
      p_approved_date: new Date().toISOString()
    });

  // 3. Update status → 'waiting_for_payment'
  await updateSaleStatus(saleId, 'waiting_for_payment', ...);

  return { success: true, paymentId: virtualPaymentId };
}
```

**Changements clés:**
- ❌ AVANT: Status dépendait du mécanisme (spot → payment_received, forward → customer_approved)
- ✅ APRÈS: TOUJOURS 'waiting_for_payment' + Paiement virtuel créé

#### 2. virtualPaymentService.ts (NEW)

**Fichier:** `src/services/virtualPaymentService.ts`

**Fonctions principales:**

1. `getVirtualPayments()` - Liste tous les paiements virtuels
2. `getVirtualPaymentById(id)` - Détails d'un paiement
3. `getVirtualPaymentsByCustomer(customerId)` - Par customer
4. `getVirtualPaymentBySale(saleId)` - Par vente
5. `convertVirtualToActual(data)` - Convertir en réel
6. `markVirtualPaymentReceived(id)` - Quick approve
7. `getVirtualPaymentStats()` - Statistiques

### Pages

#### 1. CustomerSaleApproval.tsx (Modified)

**Route:** `/sales/approve/:saleId/:token`

**Changements:**
- Page de confirmation mise à jour
- Plus de distinction Spot vs Forward
- Message uniforme: "Payment will be tracked"

**Affichage post-approbation:**

```tsx
<div className="bg-blue-50 border-blue-300">
  <p className="font-semibold">Payment Tracking Initiated</p>
  <p>
    A virtual payment has been created and credited to company account.
    Payment due: {dueDate} ({mechanismType} terms)
  </p>
  <p className="text-sm">
    Management will record actual payment details upon receipt.
  </p>
</div>
```

#### 2. VirtualPaymentsPage.tsx (NEW)

**Route:** `/payments/virtual`
**Fichier:** `src/pages/payments/VirtualPaymentsPage.tsx`

**Sections:**

1. **Header**
   - Titre: "Virtual Payments Management"
   - Subtitle: "Auto-credited payments awaiting confirmation"
   - Bouton: "View All Payments"

2. **Stats Cards** (4 cards)
   - Total Virtual (bleu)
   - Overdue (rouge)
   - Due Today (orange)
   - Due Soon (jaune)

3. **Payments List**
   - Cards colorées selon urgency
   - Info: sale_number, customer, amount, terms, due date
   - Actions:
     • "Record Details" (bleu) → Ouvre modal
     • "Quick Approve" (vert) → Marque reçu immédiatement

4. **Convert Modal**
   - Payment Summary (card bleue)
   - Form fields (date, bank, ref, etc.)
   - FX Comparison (si non-USD)
   - Actions: Cancel / Confirm Payment

---

## 📊 Flux des Statuts

### Ancien Workflow (AVANT)

```
SPOT BASIS:
customer_pending → approved → payment_received → completed
                    (mgmt)     (customer auto)

FORWARD BASIS:
customer_pending → approved → customer_approved → payment_received → completed
                    (mgmt)     (customer)          (mgmt manual)
```

**Problème:** Confusion sur quand le compte est crédité

### Nouveau Workflow (APRÈS)

```
TOUS LES MÉCANISMES:
customer_pending → approved → waiting_for_payment → payment_received → completed
                    (mgmt)     (customer + virtual)  (mgmt confirm)

AVEC PAIEMENT VIRTUEL CRÉÉ À waiting_for_payment
```

**Avantage:** Clarté totale, workflow unifié

---

## 🎨 Interface Utilisateur

### VirtualPaymentsPage - Design

#### Stats Cards Layout

```
┌─────────────────────────────────────────────────────┐
│ 💳 Virtual Payments Management                      │
│    Auto-credited payments awaiting confirmation     │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│ │ Total    │ │ Overdue  │ │ Due      │ │ Due     ││
│ │ Virtual  │ │ 🔴       │ │ Today    │ │ Soon    ││
│ │          │ │          │ │ 🟠       │ │ 🟡      ││
│ │ 15       │ │ 3        │ │ 2        │ │ 5       ││
│ │ $1.5M    │ │ $300K    │ │ $200K    │ │ $500K   ││
│ └──────────┘ └──────────┘ └──────────┘ └─────────┘│
└─────────────────────────────────────────────────────┘
```

#### Payment Card (Overdue Example)

```
┌─[border-red-200 bg-red-50]──────────────────────────┐
│ 🔴 SL-2025-001 [OVERDUE]                            │
│                                                      │
│ Customer: Auramet International                      │
│ Amount: $1,234,567.89                               │
│ Payment Terms: SPOT                                  │
│ Due Date: 2025-10-25 (5 days overdue)               │
│                                                      │
│ Reference: VP-A1B2C3D4                              │
│ Auto-credited: 2025-10-20 08:30 AM                  │
│                                                      │
│                       [📄 Record Details]            │
│                       [✓ Quick Approve]              │
└──────────────────────────────────────────────────────┘
```

#### Convert Modal Layout

```
┌─────────────────────────────────────────────────────┐
│ Record Actual Payment Details                   [X] │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌─[bg-blue-50]───────────────────────────────────┐ │
│ │ Sale: SL-2025-001    Customer: Auramet        │ │
│ │ Expected: $1,234,567.89   Due: 2025-10-25     │ │
│ └────────────────────────────────────────────────┘ │
│                                                      │
│ Actual Payment Date * [2025-10-30]                  │
│                                                      │
│ Bank Name *          Account Number                 │
│ [Citibank          ] [123456789      ]              │
│                                                      │
│ Reference Number *   Transaction ID                 │
│ [WIRE-2025-001    ] [TRX-ABC123     ]              │
│                                                      │
│ FX Rate (if non-USD)                                │
│ [1.0000] 1 USD = ? USD                              │
│                                                      │
│ Proof Document URL                                  │
│ [https://...                          ]             │
│                                                      │
│ Additional Notes                                    │
│ ┌────────────────────────────────────────────────┐ │
│ │ Payment received via wire transfer...          │ │
│ │                                                 │ │
│ └────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─FX Rate Comparison──────────────────────────────┐│
│ │ ECB:    1.0000  (0.00%)                         ││
│ │ BEAC:   1.0050  (+0.50%)                        ││
│ │ Market: 0.9980  (-0.20%)                        ││
│ └──────────────────────────────────────────────────┘│
│                                                      │
│ [Cancel]                      [Confirm Payment]     │
└──────────────────────────────────────────────────────┘
```

---

## 🧪 Tests et Validation

### Test 1: Création Paiement Virtuel Spot

```bash
ÉTAPES:
1. ✅ Créer vente avec mechanism='spot' via Gold Trade Space
2. ✅ Management approuve vente
3. ✅ Customer clique lien et approuve
4. ✅ VÉRIFIER status vente = 'waiting_for_payment'
5. ✅ VÉRIFIER paiement virtuel créé en DB:
   SELECT * FROM payments WHERE sale_id = '...' AND is_virtual = true;
6. ✅ VÉRIFIER virtual_due_date = approved_date + 2 jours
7. ✅ Aller sur /payments/virtual
8. ✅ VÉRIFIER paiement apparaît dans liste
9. ✅ VÉRIFIER urgency correcte (overdue/due_today/due_soon/pending)
```

### Test 2: Création Paiement Virtuel Forward 7

```bash
ÉTAPES:
1. ✅ Créer vente avec mechanism='forward_7'
2. ✅ Management approuve
3. ✅ Customer approuve
4. ✅ VÉRIFIER virtual_due_date = approved_date + 7 jours
5. ✅ VÉRIFIER status = 'waiting_for_payment'
```

### Test 3: Conversion Virtuel → Réel

```bash
ÉTAPES:
1. ✅ Aller sur /payments/virtual
2. ✅ Cliquer "Record Details" sur un paiement
3. ✅ Modal ouvre avec Payment Summary
4. ✅ Remplir formulaire complet
5. ✅ Cliquer "Confirm Payment"
6. ✅ VÉRIFIER paiement converti en DB:
   - is_virtual = false
   - payment_type = 'actual'
   - converted_to_actual_at IS NOT NULL
7. ✅ VÉRIFIER status vente = 'payment_received'
8. ✅ VÉRIFIER paiement disparaît de /payments/virtual
```

### Test 4: Quick Approve

```bash
ÉTAPES:
1. ✅ Aller sur /payments/virtual
2. ✅ Cliquer "Quick Approve" sur un paiement
3. ✅ Confirmer action
4. ✅ VÉRIFIER status = 'approved'
5. ✅ VÉRIFIER status vente = 'payment_received'
6. ✅ VÉRIFIER paiement reste virtuel (is_virtual = true)
```

### Test 5: Statistiques

```bash
VÉRIFIER:
✅ Total Virtual = nombre de paiements virtuels
✅ Overdue = nombre avec virtual_due_date < TODAY
✅ Due Today = nombre avec virtual_due_date = TODAY
✅ Due Soon = nombre avec virtual_due_date <= TODAY + 2
✅ Montants corrects
```

---

## 📁 Fichiers Créés/Modifiés

### Créés (3):

1. ✅ `supabase/migrations/20251030050000_enhance_payments_virtual_system.sql`
   - Colonnes virtual payment
   - Fonctions DB
   - View virtual_payments_view

2. ✅ `src/services/virtualPaymentService.ts`
   - Service complet pour paiements virtuels
   - 7 fonctions principales

3. ✅ `src/pages/payments/VirtualPaymentsPage.tsx`
   - Page de gestion complète
   - Stats + Liste + Modal conversion

### Modifiés (3):

1. ✅ `src/services/salesService.ts`
   - `customerApproveSale()` crée paiement virtuel
   - Status toujours → 'waiting_for_payment'

2. ✅ `src/pages/sales/CustomerSaleApproval.tsx`
   - Message post-approbation mis à jour
   - Workflow unifié

3. ✅ `src/App.tsx`
   - Import `VirtualPaymentsPage`
   - Route `/payments/virtual`

---

## 🚀 Avantages du Système

### Pour l'Entreprise:

1. ✅ **Crédit automatique** dès approbation client
2. ✅ **Visibilité claire** des paiements attendus
3. ✅ **Suivi de l'urgence** (overdue, due today, etc.)
4. ✅ **Workflow unifié** pour tous les mécanismes
5. ✅ **Audit trail complet** de virtual → actual

### Pour le Management:

1. ✅ **Dashboard dédié** pour paiements virtuels
2. ✅ **Priorisation** basée sur urgence
3. ✅ **Conversion facile** virtuel → réel
4. ✅ **Quick approve** pour gains de temps
5. ✅ **Statistiques** en temps réel

### Pour la Comptabilité:

1. ✅ **Trace complète** de chaque paiement
2. ✅ **Dates enregistrées** (expected, actual, converted)
3. ✅ **FX rates** et comparaisons
4. ✅ **Proof documents** attachables
5. ✅ **Notes détaillées** possibles

---

## 🎯 Résumé Workflow Final

```
┌──────────────────────────────────────────────────┐
│ 1. CUSTOMER APPROVAL                             │
│    • Client approuve vente                       │
│    • Paiement virtuel créé AUTO                  │
│    • Compte crédité VIRTUELLEMENT                │
│    • Status → waiting_for_payment                │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│ 2. VIRTUAL PAYMENT TRACKING                      │
│    • Management voit dans /payments/virtual      │
│    • Urgency indicator (overdue/due/pending)     │
│    • Stats dashboard                             │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│ 3. ACTUAL PAYMENT RECORDING                      │
│    • Management clique "Record Details"          │
│    • Saisit infos réelles (bank, ref, date)      │
│    • Conversion virtuel → réel                   │
│    • Status → payment_received                   │
└──────────────────────────────────────────────────┘
```

---

## ✅ Checklist Implémentation

- ✅ Migration DB créée
- ✅ Colonnes virtual ajoutées à payments
- ✅ Status 'waiting_for_payment' ajouté à sales
- ✅ Fonctions DB créées (calculate_due_date, create_virtual, convert)
- ✅ View virtual_payments_view créée
- ✅ Service virtualPaymentService créé
- ✅ salesService.customerApproveSale modifié
- ✅ Page VirtualPaymentsPage créée
- ✅ Page CustomerSaleApproval mise à jour
- ✅ Route /payments/virtual ajoutée
- ✅ Documentation complète

---

## 🎉 Conclusion

Le système de paiements virtuels est **100% FONCTIONNEL**:

✅ **Crédit automatique** lors de l'approbation client
✅ **Workflow unifié** pour tous les mécanismes
✅ **Gestion centralisée** des paiements virtuels
✅ **Conversion facile** en paiements réels
✅ **Audit trail complet** pour la comptabilité
✅ **Interface intuitive** pour le management

**Le compte de l'entreprise est crédité virtuellement dès l'approbation du client, et le management peut ensuite enregistrer les détails réels du paiement physique!** 🎊💰
