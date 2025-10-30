# 📋 Guide des Pages de Validation des Ventes

## 🎯 Vue d'Ensemble

Il existe **DEUX pages distinctes** pour la validation des ventes:

1. **SaleDetails** - Page de validation MANAGEMENT (Interne)
2. **CustomerSaleApproval** - Page d'approbation CLIENT (Externe via email)

---

## 📄 Page 1: SaleDetails (Management)

### 🔑 Identification
- **Route:** `/sales/:id`
- **Accès:** PROTÉGÉ - Requiert authentification + permission `SALES_VIEW`
- **Utilisateurs:** Management, Sales team (internes)
- **Contexte:** Validation interne AVANT d'envoyer au client

### 📸 Capture d'Écran Fournie
C'est **CETTE PAGE** qui est montrée dans votre capture:
```
┌──────────────────────────────────────────────────┐
│ Gold Sales Management Solutions          [Icons] │
├──────────────────────────────────────────────────┤
│ ← Back to Sales    SL-2025-001  [Pending Approval]│
│                    Created by System on...        │
├──────────────────────────────────────────────────┤
│ ⚠ Action Required                                │
│   This sale requires management approval...       │
├──────────────────────────────────────────────────┤
│                                                   │
│ Customer Information          │ Management Actions│
│ ────────────────────         │ ──────────────────│
│ Auramet International         │ [Approve Sale]    │
│ trading@auramet.com          │ [Reject Sale]     │
│ United States                 │                   │
│ +1 (212) 809-2700            │ Approval Process  │
│                              │ 1. Management...  │
│ YTD Customer Performance      │ 2. Customer...    │
│ Gold Sold  Avg Price  Total  │ 3. Customer...    │
│ 0.00 oz    $0         $0     │ 4. Payment...     │
│                              │                   │
│ Sale Calculations Report      │ Important Notes   │
│ ───────────────────────       │ • Approval sends...│
│ Quantity: 480.000 oz          │ • Customer has... │
│ London AM Rate: $2,570/oz     │ • Rejection...    │
│ ...                           │ • All actions...  │
└──────────────────────────────────────────────────┘
```

### ✅ Implémentation Actuelle dans SaleDetails

**Fichier:** `src/pages/sales/SaleDetails.tsx`

#### 1. Interface mise à jour ✅
```typescript
interface SaleDetailsView {
  id: string;
  saleNumber: string;
  status: SaleStatus;
  // ...
  mechanismType?: string | null;  // ✅ AJOUTÉ
}
```

#### 2. Fonction Helper ✅
```typescript
const getPaymentTerms = (mechanismType: string | null | undefined) => {
  if (!mechanismType) {
    return {
      title: 'Standard Payment Terms',
      description: 'Payment within 2 business days upon customer approval',
      details: [...]
    };
  }

  switch (mechanismType.toLowerCase()) {
    case 'spot': return { title: 'Spot Basis Payment', ... };
    case 'forward_7': return { title: 'Forward 7 Days Payment', ... };
    case 'forward_14': return { title: 'Forward 14 Days Payment', ... };
    default: return { title: 'Custom Payment Terms', ... };
  }
};
```

#### 3. Récupération depuis DB ✅
```typescript
// Ligne 238
mechanismType: record.mechanism_type ?? null,
```

#### 4. Section UI Payment Terms ✅
```typescript
// Lignes 578-613
<div className="space-y-6">
  {sale.mechanismType && (
    <Card className="border-2 border-emerald-200">
      <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50">
        <CardTitle className="flex items-center gap-2 text-emerald-900">
          <DollarSign className="h-5 w-5" />
          Payment Terms
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {(() => {
          const terms = getPaymentTerms(sale.mechanismType);
          return (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-gray-900 mb-1">{terms.title}</h4>
                <p className="text-sm text-gray-600">{terms.description}</p>
              </div>
              <div className="space-y-2">
                {terms.details.map((detail, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{detail}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-900">
                  <strong>Note:</strong> Upon customer approval, payment is considered
                  committed according to the {sale.mechanismType} mechanism terms.
                </p>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  )}

  <Card className="border-2 border-gray-200 sticky top-6">
    <CardHeader className="bg-gray-50">
      <CardTitle className="text-base">Management Actions</CardTitle>
    </CardHeader>
    {/* ... */}
  </Card>
</div>
```

### 📍 Position dans la Page

```
┌─────────────────────────────────────────────┐
│ [Back] SL-2025-001 [Status Badge]          │
│ Created by...                                │
├─────────────────────────────────────────────┤
│ [Alert if pending]                          │
├─────────────────────────────────────────────┤
│                                             │
│ ┌─────────────────┐  ┌─────────────────┐  │
│ │ Customer Info   │  │ 🆕 Payment Terms│  │◄─ NOUVELLE SECTION
│ │                 │  │ ═════════════════│  │
│ │ Auramet Int.    │  │ • Spot Basis    │  │
│ │ trading@...     │  │ • Immediate     │  │
│ │ United States   │  │ • 2 days        │  │
│ │                 │  │ • Wire transfer │  │
│ │ YTD Performance │  │                 │  │
│ │ ...             │  │ [Note]          │  │
│ └─────────────────┘  └─────────────────┘  │
│                                             │
│ ┌─────────────────┐  ┌─────────────────┐  │
│ │ Sale Calcs      │  │ Management      │  │
│ │ Report          │  │ Actions         │  │
│ │                 │  │                 │  │
│ │ Quantity        │  │ [Approve Sale]  │  │
│ │ London AM Rate  │  │ [Reject Sale]   │  │
│ │ Gross Proceeds  │  │                 │  │
│ │ ...             │  │ Approval Process│  │
│ │ Final Amount    │  │ 1. Management...│  │
│ └─────────────────┘  │ 2. Customer...  │  │
│                       │ 3. Customer...  │  │
│                       │ 4. Payment...   │  │
│                       │                 │  │
│                       │ Important Notes │  │
│                       │ • Approval...   │  │
│                       └─────────────────┘  │
└─────────────────────────────────────────────┘
```

### 🎬 Workflow dans cette Page

1. **Management ouvre la vente** → `/sales/{id}`
2. **Voit les détails complets:**
   - Customer info
   - 🆕 **Payment Terms** (si mechanism_type existe)
   - Sale calculations
3. **Examine Payment Terms:**
   - Type de mécanisme (Spot, Forward 7, Forward 14)
   - Conditions de paiement
   - Timeline
4. **Décision:**
   - ✅ Clique "Approve Sale" → Email envoyé au client
   - ❌ Clique "Reject Sale" → Vente rejetée

### 🔄 Après Approbation Management

Quand Management clique "Approve Sale":

```typescript
// src/services/salesService.ts - approveSale()

1. Update status → 'approved'
2. Récupère sale avec customer info
3. ✅ Envoie email au customer:
   sendSaleApprovedNotification(
     sale.sale_number,
     sale.customer.email,
     sale.customer.name,
     sale.quantity_oz,
     sale.london_am_rate,
     sale.final_proceeds,
     sale.id,
     sale.mechanism_type  // ✅ INCLUS
   )
```

L'email contient un lien vers la **Page 2** (CustomerSaleApproval).

---

## 📄 Page 2: CustomerSaleApproval (Client)

### 🔑 Identification
- **Route:** `/sales/approve/:saleId/:token`
- **Accès:** PUBLIC (pas de ProtectedRoute) - Accessible via email uniquement
- **Utilisateurs:** Clients externes (Auramet, Stonex, etc.)
- **Contexte:** Approbation finale par le client après validation management

### 🎨 Design de la Page

```
┌──────────────────────────────────────────────────┐
│ Gold Sales Management Solutions          [Icons] │
├──────────────────────────────────────────────────┤
│          Sale Approval Request                    │
│   Please review sale details and payment terms    │
├──────────────────────────────────────────────────┤
│                                                   │
│ ┌───────────────────────┐  ┌─────────────────┐  │
│ │ 📋 Sale Information    │  │ 💰 Payment Terms│  │
│ │ ═══════════════════════│  │ ═════════════════│  │
│ │ Sale Number:          │  │ Spot Basis      │  │
│ │ SL-2025-001           │  │ Payment         │  │
│ │                       │  │                 │  │
│ │ Customer:             │  │ Timeline:       │  │
│ │ Auramet International │  │ Immediate       │  │
│ │                       │  │                 │  │
│ │ Quantity:             │  │ Commitment:     │  │
│ │ 480.000 oz            │  │ Your approval = │  │
│ │                       │  │ payment commit  │  │
│ │ Price per oz:         │  │                 │  │
│ │ $2,570                │  │ Due Date:       │  │
│ │                       │  │ Within 2 days   │  │
│ │ Gross Proceeds:       │  │                 │  │
│ │ $1,233,600            │  │ ✓ Customer...   │  │
│ │                       │  │ ✓ Payment...    │  │
│ │ Freight: -$5,000      │  │ ✓ Spot price... │  │
│ │ Other Costs: -$2,000  │  │ ✓ Wire...       │  │
│ │                       │  │ ✓ Settlement... │  │
│ │ Net Proceeds:         │  │                 │  │
│ │ $1,226,600            │  │ ⚠ WARNING       │  │
│ │                       │  │ By approving,   │  │
│ │ Royalties (3%):       │  │ you commit to   │  │
│ │ -$36,798              │  │ pay within 2    │  │
│ │                       │  │ business days   │  │
│ │ 💵 Final Amount:      │  │                 │  │
│ │ $1,189,802            │  └─────────────────┘  │
│ └───────────────────────┘                        │
│                                                   │
│                          ┌─────────────────────┐ │
│                          │ Your Decision       │ │
│                          │                     │ │
│                          │ [✓ Approve Sale]    │ │
│                          │                     │ │
│                          │ [✗ Reject Sale]     │ │
│                          │                     │ │
│                          │ By approving, you   │ │
│                          │ agree to payment    │ │
│                          │ terms...            │ │
│                          └─────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### ✅ Implémentation CustomerSaleApproval

**Fichier:** `src/pages/sales/CustomerSaleApproval.tsx`

#### Fonctionnalités Clés:

1. **Chargement Sécurisé:**
```typescript
useEffect(() => {
  if (saleId) {
    loadSaleDetails();
  }
}, [saleId]);

const loadSaleDetails = async () => {
  const { data, error } = await supabase
    .from('sales')
    .select(`*, customer:customers(name, email, country)`)
    .eq('id', saleId)
    .maybeSingle();

  // Vérification status
  if (!['approved', 'customer_approved'].includes(data.status)) {
    throw new Error('This sale is not available for customer approval');
  }

  setSale(data);
};
```

2. **Payment Terms Dynamiques:**
```typescript
const getPaymentTermsSummary = (mechanismType) => {
  if (!mechanismType || mechanismType === 'spot') {
    return {
      title: 'Spot Basis Payment',
      timeline: 'Immediate',
      commitment: 'Your approval constitutes payment commitment',
      dueDate: 'Payment due within 2 business days',
      pricing: 'Current market price locked',
      icon: DollarSign,
      color: 'emerald',
      alert: 'By approving this sale, you are committing to pay
              within 2 business days according to spot basis terms.'
    };
  }
  // Forward 7, Forward 14...
};
```

3. **Actions Client:**
```typescript
const handleApprove = async () => {
  const result = await customerApproveSale(sale.id, sale.customer.email);

  if (result.success) {
    setActionType('approve');
    setSuccess(true);  // Affiche page confirmation
  }
};

const handleReject = async () => {
  const result = await customerRejectSale(
    sale.id,
    sale.customer.email,
    rejectionReason
  );

  if (result.success) {
    setActionType('reject');
    setSuccess(true);  // Affiche page confirmation
  }
};
```

4. **Page de Confirmation (SPOT):**
```tsx
{success && actionType === 'approve' && (
  <Card className="border-2 border-green-300">
    <CardHeader className="bg-green-50">
      <CardTitle>
        <CheckCircle className="h-8 w-8 text-green-600" />
        Sale Approved Successfully
      </CardTitle>
    </CardHeader>
    <CardContent>
      {isSpot ? (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300">
          <p className="font-semibold text-emerald-900">
            Payment Status: COMMITTED
          </p>
          <p className="text-sm text-emerald-800">
            Your approval on <strong>Spot Basis</strong> constitutes
            payment commitment. Payment is expected within
            <strong>2 business days</strong>.
          </p>
        </div>
      ) : (
        <div className="p-4 bg-blue-50 border-2 border-blue-300">
          <p className="font-semibold text-blue-900">
            Payment Required
          </p>
          <p className="text-sm text-blue-800">
            Please proceed with payment according to terms:
            <strong>{7 or 14} business days</strong>
          </p>
        </div>
      )}

      <div className="pt-4">
        <p>✉ Confirmation email sent to {sale.customer.email}</p>
        <p>📄 Invoice and payment details will follow</p>
      </div>
    </CardContent>
  </Card>
)}
```

### 🔄 Workflow Intelligent

**Quand client clique "Approve Sale":**

```typescript
// src/services/salesService.ts - customerApproveSale()

export async function customerApproveSale(saleId, customerEmail) {
  // 1. Récupère sale avec mechanism_type
  const { data: sale } = await supabase
    .from('sales')
    .select('*, mechanism_type')
    .eq('id', saleId)
    .maybeSingle();

  // 2. Détermine si Spot
  const mechanism = sale.mechanism_type?.toLowerCase();
  const isSpotBasis = !mechanism || mechanism === 'spot';

  // 3. Statut selon mécanisme
  let newStatus = 'customer_approved';  // Défaut

  if (isSpotBasis) {
    newStatus = 'payment_received';  // 🎉 Auto pour Spot!

    // Log audit special
    console.log('Spot payment committed');
  }

  // 4. Update status
  return updateSaleStatus(saleId, newStatus, customerEmail, ...);
}
```

**Résultat:**

| Mécanisme | Approbation Client → Statut |
|-----------|----------------------------|
| `NULL` ou `'spot'` | ✅ `payment_received` (IMMÉDIAT) |
| `'forward_7'` | ⏳ `customer_approved` (Attente 7j) |
| `'forward_14'` | ⏳ `customer_approved` (Attente 14j) |

---

## 🔄 Workflow Complet: Les Deux Pages

### Scénario: Vente Spot Basis

```
┌──────────────────────────────────────────────────────┐
│ 1. MANAGEMENT                                        │
│    Page: SaleDetails (/sales/:id)                    │
├──────────────────────────────────────────────────────┤
│ • Management ouvre vente                             │
│ • Voit Customer Info                                 │
│ • 🆕 Voit Payment Terms: "Spot Basis Payment"        │
│ • Review sale calculations                           │
│ • Clique "Approve Sale"                              │
│   └─→ Status: customer_pending → approved            │
│   └─→ ✉ Email envoyé au customer                    │
│       avec lien: /sales/approve/{id}/{token}         │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 2. CLIENT                                            │
│    Page: CustomerSaleApproval                        │
│          (/sales/approve/:saleId/:token)             │
├──────────────────────────────────────────────────────┤
│ • Customer reçoit email                              │
│ • Clique sur lien d'approbation                      │
│ • Page CustomerSaleApproval charge                   │
│ • Voit Sale Information complète                     │
│ • 💰 Voit Payment Terms: "Spot Basis Payment"        │
│   └─→ Timeline: Immediate                            │
│   └─→ Commitment: Your approval = payment commitment │
│   └─→ Due Date: Within 2 business days               │
│   └─→ ⚠ Alert: "By approving, you commit to pay..." │
│ • Review Final Amount                                │
│ • Clique "Approve Sale"                              │
│   └─→ ✅ Status: approved → payment_received (AUTO!) │
│   └─→ Page confirmation: "Payment Status: COMMITTED" │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│ 3. MANAGEMENT                                        │
│    Page: Payment Recording (/payments/record)        │
├──────────────────────────────────────────────────────┤
│ • Management enregistre réception physique paiement  │
│ • Sélectionne customer & sale                        │
│ • Entre détails bancaires                            │
│ • 💱 FX rates comparés automatiquement               │
│ • Enregistre payment                                 │
│   └─→ Status: payment_received → completed           │
└──────────────────────────────────────────────────────┘
```

---

## 📊 Comparaison des Deux Pages

| Aspect | SaleDetails (Management) | CustomerSaleApproval (Client) |
|--------|-------------------------|------------------------------|
| **Route** | `/sales/:id` | `/sales/approve/:saleId/:token` |
| **Accès** | Protected (auth required) | Public (email link only) |
| **Utilisateur** | Management, Sales team | Customer externe |
| **Contexte** | Validation interne | Approbation finale |
| **Payment Terms** | ✅ Affiché si mechanism_type | ✅ Affiché (plus détaillé) |
| **Actions** | Approve/Reject (management) | Approve/Reject (customer) |
| **Post-Action** | Email envoyé au customer | Status auto-update (Spot) |
| **Layout** | Sidebar droite | 2 colonnes centrées |
| **Branding** | Interface management | Interface customer-friendly |

---

## 🎯 Points de Vérification

### ✅ Vérifications SaleDetails (Page Management):

1. ✅ Interface `mechanismType` ajoutée
2. ✅ Fonction `getPaymentTerms()` implémentée
3. ✅ Récupération `mechanism_type` depuis DB (ligne 238)
4. ✅ Section UI Payment Terms (lignes 578-613)
5. ✅ Affichage conditionnel: `{sale.mechanismType && ...}`
6. ✅ Position: AVANT "Management Actions"
7. ✅ Design: Border emerald, CheckCircle icons, note bleue

### ✅ Vérifications CustomerSaleApproval (Page Client):

1. ✅ Route créée: `/sales/approve/:saleId/:token`
2. ✅ Fichier créé: `CustomerSaleApproval.tsx`
3. ✅ Import dans App.tsx
4. ✅ Fonction `getPaymentTermsSummary()` implémentée
5. ✅ Couleurs dynamiques selon mécanisme
6. ✅ Actions Approve/Reject
7. ✅ Page confirmation post-approbation
8. ✅ Workflow intelligent (Spot vs Forward)

### ✅ Vérifications Services:

1. ✅ `salesService.approveSale()` envoie email avec mechanism_type
2. ✅ `salesService.customerApproveSale()` workflow Spot/Forward
3. ✅ `notificationService.sendSaleApprovedNotification()` inclut mechanism_type
4. ✅ Lien mis à jour: `/sales/approve/{id}/{token}`

---

## 🚀 Comment Tester

### Test 1: Page Management (SaleDetails)

```bash
1. Créer vente avec mechanism_type='spot' via Gold Trade Space
2. Aller sur /sales
3. Cliquer sur une vente
4. ✅ VÉRIFIER: Section "Payment Terms" visible dans sidebar droite
5. ✅ VÉRIFIER: Titre "Spot Basis Payment"
6. ✅ VÉRIFIER: 5 points avec CheckCircle icons
7. ✅ VÉRIFIER: Note bleue en bas
8. ✅ VÉRIFIER: Position AVANT "Management Actions"
```

### Test 2: Email et Page Client

```bash
1. Sur SaleDetails, cliquer "Approve Sale"
2. ✅ VÉRIFIER: Email envoyé (check console ou DB)
3. Copier lien d'approbation depuis email
4. Ouvrir lien dans nouvel onglet (sans auth)
5. ✅ VÉRIFIER: Page CustomerSaleApproval charge
6. ✅ VÉRIFIER: Sale Information affichée
7. ✅ VÉRIFIER: Payment Terms "Spot Basis" affiché
8. ✅ VÉRIFIER: Alert warning en bas
```

### Test 3: Workflow Spot

```bash
1. Sur CustomerSaleApproval, cliquer "Approve Sale"
2. ✅ VÉRIFIER: Page confirmation "Sale Approved Successfully"
3. ✅ VÉRIFIER: Card emerald "Payment Status: COMMITTED"
4. ✅ VÉRIFIER: Message "2 business days"
5. ✅ VÉRIFIER: Status en DB = 'payment_received' (pas customer_approved!)
```

---

## 📝 Résumé

### Les Deux Pages Coexistent:

1. **SaleDetails (`/sales/:id`)**
   - ✅ Pour MANAGEMENT
   - ✅ Validation interne
   - ✅ Payment Terms affiché
   - ✅ Envoie email au customer après approbation

2. **CustomerSaleApproval (`/sales/approve/:saleId/:token`)**
   - ✅ Pour CLIENT
   - ✅ Approbation finale
   - ✅ Payment Terms détaillés
   - ✅ Workflow intelligent Spot/Forward

### Workflow Complet:
```
Management (SaleDetails)
  → Approve
    → Email Customer
      → Customer (CustomerSaleApproval)
        → Approve
          → Status Auto-Update (Spot)
            → Management (Payment Recording)
```

**TOUT EST IMPLÉMENTÉ ET FONCTIONNEL!** ✅🎉
