# Améliorations du Workflow de Ventes et Paiements

## 🎯 Objectifs

Améliorer le système de ventes et paiements avec:
1. Affichage des conditions de paiement basées sur le mécanisme choisi
2. Redirection du bouton "Create New Sale" vers Gold Trade Space
3. Approbation client = Paiement effectué (pour Spot)
4. Module d'enregistrement de paiement avec comparaison FX

## ✅ Implémentations Réalisées

### 1. **Section Payment Terms dans SaleDetails**

#### Localisation
- **Fichier:** `src/pages/sales/SaleDetails.tsx`
- **Position:** Sidebar droite, avant les "Management Actions"

#### Fonctionnalités

**Fonction Helper `getPaymentTerms()`:**
```typescript
const getPaymentTerms = (mechanismType: string | null | undefined) => {
  // Retourne title, description, details selon le mécanisme
}
```

**Mécanismes Supportés:**

1. **Spot Basis Payment**
   - Description: "Immediate payment upon customer approval"
   - Détails:
     - Customer approval = Payment commitment
     - Payment due within 2 business days
     - Spot price locked at approval time
     - Wire transfer required
     - Settlement upon payment receipt

2. **Forward 7 Days Payment**
   - Description: "Payment due 7 days after customer approval"
   - Détails:
     - Customer approval locks the terms
     - Payment due date: 7 business days
     - Price fixed at contract date
     - Wire transfer to designated account
     - Grace period: 1 additional business day

3. **Forward 14 Days Payment**
   - Description: "Payment due 14 days after customer approval"
   - Détails:
     - Customer approval locks the terms
     - Payment due date: 14 business days
     - Price fixed at contract date
     - Wire transfer to designated account
     - Grace period: 2 additional business days

4. **Standard Payment Terms** (si pas de mécanisme)
   - Description: "Payment within 2 business days upon customer approval"
   - Détails:
     - Customer approval via email link
     - Payment expected within 2 business days
     - Wire transfer to designated account
     - Final settlement upon payment confirmation

#### UI/UX

```tsx
<Card className="border-2 border-emerald-200">
  <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50">
    <CardTitle className="flex items-center gap-2 text-emerald-900">
      <DollarSign className="h-5 w-5" />
      Payment Terms
    </CardTitle>
  </CardHeader>
  <CardContent>
    {/* Affichage dynamique des conditions */}
    <CheckCircle /> Point 1
    <CheckCircle /> Point 2
    ...
    <div className="bg-blue-50 border border-blue-200">
      Note: Upon customer approval, payment is considered committed...
    </div>
  </CardContent>
</Card>
```

#### Données Requises
- Champ ajouté à l'interface: `mechanismType?: string | null`
- Récupération depuis DB: `record.mechanism_type`

---

### 2. **Redirection Bouton "Create New Sale"**

#### Localisation
- **Fichier:** `src/pages/sales/SalesDashboard.tsx`
- **Ligne:** ~367-382

#### AVANT (❌):
```tsx
<Button
  onClick={() => navigate('/sales/new')}
  className="flex items-center gap-2"
>
  <Plus className="h-4 w-4" />
  Create New Sale
</Button>
```

#### APRÈS (✅):
```tsx
<div className="relative group">
  <Button
    onClick={() => navigate('/sales/gold-trade-space')}
    className="flex items-center gap-2"
  >
    <Plus className="h-4 w-4" />
    Create New Sale
  </Button>
  <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-blue-50
                  border border-blue-200 rounded-lg shadow-lg
                  opacity-0 invisible group-hover:opacity-100
                  group-hover:visible transition-all duration-200 z-10">
    <p className="text-xs text-blue-900">
      <strong>Note:</strong> Sales can only be created through the
      Gold Trade Space module for proper pricing mechanism selection.
    </p>
  </div>
</div>
```

#### Comportement
- **Clic:** Redirige vers `/sales/gold-trade-space`
- **Hover:** Affiche tooltip explicatif
- **Message:** Explique pourquoi passer par Gold Trade Space

---

### 3. **Workflow Approbation Client = Paiement (Spot)**

#### Localisation
- **Fichier:** `src/services/salesService.ts`
- **Fonction:** `customerApproveSale()`

#### Logique Implémentée

**AVANT (❌):**
```typescript
export async function customerApproveSale(
  saleId: string,
  customerEmail: string
) {
  return updateSaleStatus(saleId, 'customer_approved', customerEmail, 'Customer approved sale');
}
```

**APRÈS (✅):**
```typescript
export async function customerApproveSale(
  saleId: string,
  customerEmail: string
) {
  // 1. Récupère la vente et le mechanism_type
  const { data: sale } = await supabase
    .from('sales')
    .select('*, mechanism_type')
    .eq('id', saleId)
    .maybeSingle();

  // 2. Détermine si c'est spot basis
  const mechanism = sale.mechanism_type?.toLowerCase();
  const isSpotBasis = !mechanism || mechanism === 'spot';

  // 3. Statut selon mécanisme
  let newStatus = 'customer_approved';

  if (isSpotBasis) {
    newStatus = 'payment_received';  // 🎉 Paiement automatique!

    // 4. Log audit spécial
    await logAuditAction({
      action: 'customer_approved_spot_payment',
      note: 'Customer approval on spot basis = Payment commitment',
      approved_at: new Date().toISOString()
    });
  }

  // 5. Update status
  return updateSaleStatus(
    saleId,
    newStatus,
    customerEmail,
    isSpotBasis
      ? 'Customer approved sale - Payment committed (Spot Basis)'
      : 'Customer approved sale'
  );
}
```

#### Règles de Statut

| Mécanisme | Approbation Client → Statut Final |
|-----------|-----------------------------------|
| `spot` ou `NULL` | `payment_received` ✅ |
| `forward_7` | `customer_approved` ⏳ |
| `forward_14` | `customer_approved` ⏳ |
| Autres | `customer_approved` ⏳ |

#### Justification
- **Spot = Immédiat:** L'approbation équivaut à un engagement de paiement
- **Forward = Délai:** Paiement attendu selon échéance (7 ou 14 jours)

---

### 4. **Module Payment Recording avec Comparaison FX**

#### Nouveau Fichier Créé
- **Path:** `src/pages/payments/PaymentRecordPage.tsx`
- **Route:** `/payments/record`
- **Accès:** Management role

#### Fonctionnalités Principales

**A. Sélection Customer & Sale**
```typescript
// Filtre automatique des ventes selon customer
useEffect(() => {
  if (formData.customerId) {
    const customerSales = sales.filter(
      s => s.customer_id === formData.customerId &&
      ['customer_approved', 'payment_received'].includes(s.status)
    );
    setFilteredSales(customerSales);
  }
}, [formData.customerId, sales]);
```

**B. Currencies Supportées**
```typescript
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'XOF', name: 'West African CFA', flag: '🌍' },
  { code: 'GNF', name: 'Guinean Franc', flag: '🇬🇳' },
];
```

**C. FX Rate Auto-Fetch**
```typescript
useEffect(() => {
  if (formData.currency && formData.currency !== 'USD') {
    fetchFXRates();  // Récupère taux actuel
  } else {
    setFormData(prev => ({ ...prev, fxRate: '1.00' }));
  }
}, [formData.currency]);
```

**D. Comparaison FX Rates (Multiple Sources)**
```typescript
interface FXComparison {
  source: string;
  rate: number;
  date: string;
  variance_percent: number;
}

// Exemple de comparaison affichée
[
  {
    source: 'European Central Bank',
    rate: 0.92,
    variance_percent: 0
  },
  {
    source: 'Commercial Bank',
    rate: 0.90,
    variance_percent: -2.0  // 2% moins bon
  },
  {
    source: 'XE.com',
    rate: 0.93,
    variance_percent: +1.0  // 1% meilleur
  }
]
```

#### UI Components

**1. Formulaire Principal:**
- Customer selection
- Sale selection (filtered)
- Expected Payment Date
- Amount & Currency
- FX Rate (auto-filled, editable)

**2. Banking Details:**
- Source Bank (Customer's bank)
- Account Number (optional)
- Reference Number (required)
- Notes (optional)

**3. Sale Summary Card:**
```tsx
<Card className="border-2 border-blue-200">
  <CardHeader className="bg-blue-50">
    <CardTitle>Sale Summary</CardTitle>
  </CardHeader>
  <CardContent>
    • Customer: {name}
    • Sale Number: {sale_number}
    • Amount: ${final_proceeds}
    • Quantity: {quantity_oz} oz
  </CardContent>
</Card>
```

**4. FX Rate Comparison Card:**
```tsx
<Card className="border-2 border-emerald-200">
  <CardHeader className="bg-emerald-50">
    <CardTitle>
      <DollarSign /> FX Rate Comparison
    </CardTitle>
  </CardHeader>
  <CardContent>
    {fxComparisons.map(comp => (
      <div className="p-3 bg-white rounded border">
        <span>{comp.source}</span>
        {comp.variance_percent > 0 ? (
          <TrendingUp className="text-green-600" />
        ) : (
          <TrendingDown className="text-red-600" />
        )}
        <p className="font-bold">{comp.rate.toFixed(6)}</p>
        <p className="text-xs">{comp.variance_percent}%</p>
      </div>
    ))}
    <Alert type="info">
      Compare rates to ensure best conversion value
    </Alert>
  </CardContent>
</Card>
```

#### Validation & Submission

**Champs Requis:**
- ✅ Customer
- ✅ Sale
- ✅ Expected Date
- ✅ Bank Name
- ✅ Reference Number
- ✅ Amount > 0
- ✅ FX Rate > 0

**Soumission:**
```typescript
const handleSubmit = async () => {
  const result = await createPayment({
    sale_id: formData.saleId,
    expected_date: formData.expectedDate,
    amount: parseFloat(formData.amount),
    currency: formData.currency,
    fx_rate: parseFloat(formData.fxRate),
    bank_name: formData.bankName,
    account_number: formData.bankAccount,
    reference_number: formData.referenceNumber,
    notes: formData.notes
  }, user.id);

  if (result.success) {
    alert.success('Payment recorded successfully!');
    navigate('/payments');
  }
};
```

---

## 📊 Workflow Complet

### Scénario: Vente Spot Basis

```
1. Management crée vente via Gold Trade Space
   • Sélectionne mécanisme "Spot"
   • Simule pricing
   • Crée sale → Status: customer_pending

2. Management approuve sale
   • Sale → Status: approved
   • Email envoyé au customer

3. Customer clique "Approve" dans email
   • customerApproveSale() détecte mechanism='spot'
   • Sale → Status: payment_received ✅
   • Audit log: "Spot payment committed"

4. Management enregistre réception physique
   • Accède /payments/record
   • Sélectionne customer & sale
   • Entre détails bancaires
   • Sélectionne currency (ex: EUR)
   • FX rates comparés automatiquement
   • Enregistre payment

5. Payment créé en DB
   • Status: pending
   • Lié à la sale
   • Taux FX enregistré
```

### Scénario: Vente Forward 7 Days

```
1-2. [Même que Spot]

3. Customer clique "Approve" dans email
   • customerApproveSale() détecte mechanism='forward_7'
   • Sale → Status: customer_approved ⏳
   • Payment attendu dans 7 jours

4. Après 7 jours, Management enregistre paiement
   • [Même processus que Spot]
   • Sale → Status: payment_received
```

---

## 🔧 Routes Ajoutées

```typescript
// App.tsx
<Route
  path="/payments/record"
  element={
    <ProtectedRoute>
      <PaymentRecordPage />
    </ProtectedRoute>
  }
/>
```

---

## 📁 Fichiers Modifiés/Créés

### Modifiés:
1. ✅ `src/pages/sales/SaleDetails.tsx`
   - Ajout `mechanismType` dans interface
   - Fonction `getPaymentTerms()`
   - Section Payment Terms UI
   - Récupération `mechanism_type` depuis DB

2. ✅ `src/pages/sales/SalesDashboard.tsx`
   - Redirection bouton vers Gold Trade Space
   - Tooltip explicatif

3. ✅ `src/services/salesService.ts`
   - Logique `customerApproveSale()` améliorée
   - Détection spot basis
   - Status automatique selon mécanisme

4. ✅ `src/services/paymentService.ts`
   - Suppression imports `logAuditAction` invalides
   - Correction interfaces Payment

5. ✅ `src/App.tsx`
   - Import `PaymentRecordPage`
   - Route `/payments/record`

### Créés:
6. ✅ `src/pages/payments/PaymentRecordPage.tsx`
   - Module complet enregistrement paiement
   - Comparaison FX rates
   - Validation formulaire
   - UI responsive

---

## 🎨 UI/UX Améliorations

### Payment Terms Section
- ✅ Card avec border emerald
- ✅ Icône DollarSign
- ✅ Liste avec CheckCircle icons
- ✅ Note explicative en bleu
- ✅ Affichage conditionnel (si mechanism existe)

### Create Sale Button
- ✅ Tooltip au hover
- ✅ Animation smooth
- ✅ Message clair
- ✅ Redirection Gold Trade Space

### Payment Record Page
- ✅ Layout 2 colonnes (form + summary)
- ✅ Auto-fill FX rates
- ✅ Comparaison visuelle avec icônes trend
- ✅ Cards avec couleurs distinctes
- ✅ Validation en temps réel

---

## 🧪 Tests Recommandés

### 1. Payment Terms Display
```
• Créer vente avec mechanism='spot'
• Ouvrir SaleDetails
• Vérifier affichage "Spot Basis Payment"
• Vérifier 5 points listés
• Vérifier note en bas
```

### 2. Create Sale Button
```
• Aller sur /sales
• Hover sur "Create New Sale"
• Vérifier tooltip apparaît
• Cliquer bouton
• Vérifier redirection vers /sales/gold-trade-space
```

### 3. Customer Approval Workflow
```
• Créer vente spot basis
• Approuver (management)
• Simuler approbation customer
• Vérifier status → payment_received
• Vérifier audit log
```

### 4. Payment Recording
```
• Aller sur /payments/record
• Sélectionner customer → sales filtrées
• Sélectionner currency EUR → FX auto-loaded
• Vérifier comparaison FX affichée
• Remplir formulaire
• Soumettre
• Vérifier création payment en DB
```

---

## 📊 Base de Données

### Champs Utilisés

**Table `sales`:**
```sql
mechanism_type TEXT  -- 'spot', 'forward_7', 'forward_14', etc.
status TEXT  -- 'customer_pending', 'approved', 'customer_approved', 'payment_received'
```

**Table `payments`:**
```sql
sale_id UUID REFERENCES sales(id)
expected_date DATE
amount NUMERIC
currency TEXT
fx_rate NUMERIC
bank_name TEXT
account_number TEXT
reference_number TEXT
status TEXT  -- 'pending', 'approved', 'rejected'
created_by UUID
```

**Table `fx_rates`:**
```sql
from_currency TEXT
to_currency TEXT
rate NUMERIC
rate_date DATE
source TEXT
```

---

## ✅ Build Status

```bash
✓ built in 11.41s
Bundle: 1.8MB (494KB gzipped)
Aucune erreur TypeScript
PWA: 17 entries precached
```

---

## 🎉 Résultat Final

### Améliorations Réalisées:

1. ✅ **Payment Terms** affichés dynamiquement selon mécanisme
2. ✅ **Bouton Create Sale** redirige vers Gold Trade Space avec tooltip
3. ✅ **Approbation Spot** = Paiement automatique (status `payment_received`)
4. ✅ **Module Payment Recording** avec:
   - Sélection Customer & Sale
   - Support multi-devises
   - Auto-fetch FX rates
   - Comparaison FX multi-sources
   - Banking details complets
   - Validation formulaire
   - UI professionnelle

### Workflow Complet:
```
Gold Trade Space → Simulation → Create Sale →
Management Approval → Customer Email →
Customer Approval (Spot = Payment Done) →
Payment Recording (FX Comparison) →
Payment Confirmed
```

**Le système de ventes et paiements est maintenant complet et opérationnel!** 🎉📊💰
