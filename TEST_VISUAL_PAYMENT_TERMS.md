# 🧪 Tests Visuels - Payment Terms

## 🎯 Objectif
Vérifier que la section **Payment Terms** s'affiche correctement dans les deux pages.

---

## 📄 TEST 1: SaleDetails (Page Management)

### Pré-requis
- ✅ Avoir une vente avec `mechanism_type` = `'spot'`, `'forward_7'` ou `'forward_14'`
- ✅ Être authentifié comme Management

### Étapes de Test

#### 1. Créer une Vente Spot
```bash
1. Aller sur /sales/gold-trade-space
2. Sélectionner mécanisme: "Spot"
3. Remplir formulaire
4. Créer la vente
```

#### 2. Ouvrir la Vente
```bash
1. Aller sur /sales
2. Cliquer sur la vente créée
3. Page SaleDetails s'ouvre (/sales/{id})
```

### ✅ Vérifications Visuelles

#### A. Position de la Section
```
┌─────────────────────────────────────────────┐
│ SL-2025-001 [Pending Approval]             │
├─────────────────────────────────────────────┤
│                                             │
│ ┌──────────────┐  ┌──────────────────────┐ │
│ │ Customer     │  │ 🆕 Payment Terms     │ │◄─ ICI!
│ │ Information  │  │ ══════════════════════│ │
│ │              │  │ $ Payment Terms      │ │
│ │ Auramet Int. │  │                      │ │
│ │ ...          │  │ Spot Basis Payment   │ │
│ │              │  │ ──────────────────── │ │
│ │ YTD Customer │  │ Immediate payment... │ │
│ │ Performance  │  │                      │ │
│ │              │  │ ✓ Customer approval  │ │
│ └──────────────┘  │ ✓ Payment due 2 days │ │
│                    │ ✓ Spot price locked  │ │
│ ┌──────────────┐  │ ✓ Wire transfer...   │ │
│ │ Sale         │  │ ✓ Settlement...      │ │
│ │ Calculations │  │                      │ │
│ │ Report       │  │ ℹ Note: Upon...      │ │
│ │              │  └──────────────────────┘ │
│ │ Quantity     │  ┌──────────────────────┐ │
│ │ London AM    │  │ Management Actions   │ │◄─ APRÈS
│ │ ...          │  │ ══════════════════════│ │
│ └──────────────┘  │ [Approve Sale]       │ │
│                    │ [Reject Sale]        │ │
│                    └──────────────────────┘ │
└─────────────────────────────────────────────┘
```

**La section "Payment Terms" doit être:**
- ✅ AVANT "Management Actions"
- ✅ Dans la colonne de droite (sidebar)
- ✅ Visible uniquement si `mechanism_type` existe

#### B. Design de la Card

**Border et Background:**
```
┌──[border-emerald-200]─────────────────┐
│ [bg-emerald-50 gradient]              │
│ $ Payment Terms                       │
├───────────────────────────────────────┤
│ [white background]                    │
│                                       │
│ Spot Basis Payment (bold)             │
│ Immediate payment upon...             │
│                                       │
│ ✓ Customer approval = Payment...      │
│ ✓ Payment due within 2 business...   │
│ ✓ Spot price locked at approval...   │
│ ✓ Wire transfer required              │
│ ✓ Settlement upon payment receipt     │
│                                       │
│ ┌─[bg-blue-50 border-blue-200]────┐  │
│ │ ℹ Note: Upon customer approval,  │  │
│ │   payment is considered...        │  │
│ └───────────────────────────────────┘ │
└───────────────────────────────────────┘
```

**Éléments à vérifier:**
- ✅ Icône `$` (DollarSign) dans le header
- ✅ Titre "Payment Terms" en emerald-900
- ✅ Fond du header: gradient emerald-50 → green-50
- ✅ Border emerald-200 (2px)
- ✅ Titre mécanisme en gras (ex: "Spot Basis Payment")
- ✅ Description en petit texte gris
- ✅ 5 points avec icône CheckCircle verte
- ✅ Note en bas dans box bleue

#### C. Contenu selon Mécanisme

**Pour SPOT:**
```
Title: "Spot Basis Payment"
Description: "Immediate payment upon customer approval"
Details:
  • Customer approval = Payment commitment
  • Payment due within 2 business days
  • Spot price locked at approval time
  • Wire transfer required
  • Settlement upon payment receipt
```

**Pour FORWARD 7:**
```
Title: "Forward 7 Days Payment"
Description: "Payment due 7 days after customer approval"
Details:
  • Customer approval locks the terms
  • Payment due date: 7 business days
  • Price fixed at contract date
  • Wire transfer to designated account
  • Grace period: 1 additional business day
```

**Pour FORWARD 14:**
```
Title: "Forward 14 Days Payment"
Description: "Payment due 14 days after customer approval"
Details:
  • Customer approval locks the terms
  • Payment due date: 14 business days
  • Price fixed at contract date
  • Wire transfer to designated account
  • Grace period: 2 additional business days
```

### 📸 Screenshot Attendu

La section devrait ressembler à ceci:

```
╔═══════════════════════════════════════╗
║ $ Payment Terms                       ║
╠═══════════════════════════════════════╣
║                                       ║
║ Spot Basis Payment                    ║
║ Immediate payment upon customer...    ║
║                                       ║
║ ✓ Customer approval = Payment commit  ║
║ ✓ Payment due within 2 business days  ║
║ ✓ Spot price locked at approval time  ║
║ ✓ Wire transfer required              ║
║ ✓ Settlement upon payment receipt     ║
║                                       ║
║ ┌─────────────────────────────────┐   ║
║ │ ℹ Note: Upon customer approval, │   ║
║ │   payment is considered committed│   ║
║ │   according to the spot mechanism│   ║
║ │   terms.                         │   ║
║ └─────────────────────────────────┘   ║
╚═══════════════════════════════════════╝
```

---

## 📄 TEST 2: CustomerSaleApproval (Page Client)

### Pré-requis
- ✅ Avoir une vente avec status `'approved'`
- ✅ Avoir un lien d'approbation (généré après approbation management)

### Étapes de Test

#### 1. Approbation Management
```bash
1. Ouvrir SaleDetails d'une vente pending
2. Cliquer "Approve Sale"
3. ✅ Vérifier email envoyé (check console)
4. Copier le lien d'approbation
   Format: /sales/approve/{saleId}/{token}
```

#### 2. Ouvrir Page Customer
```bash
1. Ouvrir nouvel onglet (navigation privée ou déconnecté)
2. Coller le lien d'approbation
3. Page CustomerSaleApproval charge
```

### ✅ Vérifications Visuelles

#### A. Layout Global
```
┌─────────────────────────────────────────────┐
│      Sale Approval Request                  │
│   Please review sale details and...         │
├─────────────────────────────────────────────┤
│                                             │
│ ┌────────────────┐  ┌──────────────────┐  │
│ │ 📋 Sale        │  │ 💰 Payment       │  │
│ │ Information    │  │ Terms            │  │
│ │                │  │                  │  │
│ │ Sale Number:   │  │ Spot Basis       │  │
│ │ SL-2025-001    │  │ Payment          │  │
│ │                │  │                  │  │
│ │ Customer:      │  │ Timeline:        │  │
│ │ Auramet...     │  │ Immediate        │  │
│ │                │  │                  │  │
│ │ Quantity:      │  │ Commitment:      │  │
│ │ 480.000 oz     │  │ Your approval =  │  │
│ │                │  │ payment...       │  │
│ │ Price per oz:  │  │                  │  │
│ │ $2,570         │  │ Due Date:        │  │
│ │                │  │ Within 2 days    │  │
│ │ Gross:         │  │                  │  │
│ │ $1,233,600     │  │ Pricing:         │  │
│ │                │  │ Current market.. │  │
│ │ ...            │  │                  │  │
│ │                │  │ ✓ Customer...    │  │
│ │ Final Amount:  │  │ ✓ Payment...     │  │
│ │ $1,189,802     │  │ ✓ Spot price...  │  │
│ └────────────────┘  │ ✓ Wire...        │  │
│                     │ ✓ Settlement...  │  │
│                     │                  │  │
│                     │ ⚠ WARNING        │  │
│                     │ By approving...  │  │
│                     └──────────────────┘  │
│                                             │
│                     ┌──────────────────┐   │
│                     │ Your Decision    │   │
│                     │                  │   │
│                     │ [✓ Approve Sale] │   │
│                     │                  │   │
│                     │ [✗ Reject Sale]  │   │
│                     └──────────────────┘   │
└─────────────────────────────────────────────┘
```

#### B. Payment Terms Card (Client)

**Design:**
```
╔═══[border-emerald-200]════════════════════╗
║ [bg-emerald-50]                           ║
║ $ Spot Basis Payment                      ║
╠═══════════════════════════════════════════╣
║                                           ║
║ Timeline          │ Pricing               ║
║ ─────────────────────────────────────     ║
║ Immediate         │ Current market        ║
║                   │ price locked          ║
║                                           ║
║ ✓ Your approval constitutes payment...    ║
║ ✓ Payment due within 2 business days      ║
║ ✓ Wire transfer to designated account     ║
║                                           ║
║ ┌─[bg-yellow-50 border-yellow-300]─────┐  ║
║ │ ⚠ By approving this sale, you are    │  ║
║ │   committing to pay within 2 business│  ║
║ │   days according to spot basis terms. │  ║
║ └───────────────────────────────────────┘ ║
╚═══════════════════════════════════════════╝
```

**Couleurs selon mécanisme:**
- Spot → Emerald (vert) + Alert yellow
- Forward 7 → Blue + Alert yellow
- Forward 14 → Indigo + Alert yellow

#### C. Page de Confirmation (après approbation)

**Pour SPOT (après clic "Approve Sale"):**
```
╔═══[border-green-300]══════════════════════╗
║ [bg-green-50]                             ║
║ ✓ Sale Approved Successfully              ║
╠═══════════════════════════════════════════╣
║                                           ║
║ Sale SL-2025-001                          ║
║                                           ║
║ ┌─[bg-emerald-50 border-emerald-300]───┐  ║
║ │ Payment Status: COMMITTED             │  ║
║ │                                       │  ║
║ │ Your approval on Spot Basis           │  ║
║ │ constitutes payment commitment.       │  ║
║ │ Payment is expected within            │  ║
║ │ 2 business days.                      │  ║
║ └───────────────────────────────────────┘ ║
║                                           ║
║ ✉ Confirmation email sent to...          ║
║ 📄 Invoice and payment details will...   ║
║                                           ║
║ Amount: $1,189,802                        ║
║ Quantity: 480.000 oz                      ║
╚═══════════════════════════════════════════╝
```

**Pour FORWARD (après clic "Approve Sale"):**
```
╔═══[border-green-300]══════════════════════╗
║ [bg-green-50]                             ║
║ ✓ Sale Approved Successfully              ║
╠═══════════════════════════════════════════╣
║                                           ║
║ Sale SL-2025-001                          ║
║                                           ║
║ ┌─[bg-blue-50 border-blue-300]─────────┐  ║
║ │ Payment Required                      │  ║
║ │                                       │  ║
║ │ Please proceed with payment according │  ║
║ │ to the terms agreed:                  │  ║
║ │ 7 business days                       │  ║
║ └───────────────────────────────────────┘ ║
║                                           ║
║ ✉ Confirmation email sent to...          ║
║ 📄 Invoice and payment details will...   ║
╚═══════════════════════════════════════════╝
```

---

## 🔍 Checklist de Vérification Complète

### Page SaleDetails (Management)

#### Affichage
- [ ] Section "Payment Terms" visible dans sidebar droite
- [ ] Position AVANT "Management Actions"
- [ ] Border emerald-200 (2px)
- [ ] Header avec gradient emerald-50 → green-50
- [ ] Icône $ (DollarSign) dans header
- [ ] Titre "Payment Terms" en emerald-900

#### Contenu
- [ ] Titre mécanisme correct (Spot/Forward 7/Forward 14)
- [ ] Description en gris
- [ ] 5 points avec CheckCircle vert
- [ ] Texte des points correct pour le mécanisme
- [ ] Note en bas dans box bleue
- [ ] Mention du mécanisme dans la note

#### Comportement
- [ ] Affichage conditionnel (seulement si mechanism_type existe)
- [ ] Pas d'affichage si mechanism_type = null
- [ ] Pas d'erreurs console

### Page CustomerSaleApproval (Client)

#### Affichage Initial
- [ ] Layout 2 colonnes (Sale Info | Payment Terms + Actions)
- [ ] Titre "Sale Approval Request" centré
- [ ] Sale Information complète
- [ ] Payment Terms card avec couleur appropriée
- [ ] Alert warning en bas des payment terms
- [ ] Boutons "Approve Sale" et "Reject Sale" visibles

#### Payment Terms
- [ ] Titre mécanisme correct
- [ ] Timeline affiché
- [ ] Commitment expliqué
- [ ] Due date mentionné
- [ ] Pricing info
- [ ] 3+ points avec CheckCircle
- [ ] Alert warning visible et clair

#### Post-Approbation (Spot)
- [ ] Page confirmation affichée
- [ ] Card verte avec border-green-300
- [ ] Titre "Sale Approved Successfully"
- [ ] Card emerald "Payment Status: COMMITTED"
- [ ] Message "2 business days" visible
- [ ] Email confirmation mentionné
- [ ] Montant et quantité affichés

#### Post-Approbation (Forward)
- [ ] Card bleue "Payment Required"
- [ ] Mention "7 business days" ou "14 business days"
- [ ] Message différent de Spot

---

## 🐛 Problèmes Potentiels

### Si Payment Terms ne s'affiche pas:

#### 1. Vérifier mechanism_type en DB
```sql
SELECT id, sale_number, mechanism_type, status
FROM sales
WHERE id = 'votre-sale-id';
```

**Solution si NULL:**
```sql
UPDATE sales
SET mechanism_type = 'spot'
WHERE id = 'votre-sale-id';
```

#### 2. Vérifier console browser
- Ouvrir DevTools (F12)
- Onglet Console
- Chercher erreurs React
- Vérifier `sale.mechanismType` dans React DevTools

#### 3. Vérifier condition d'affichage
```typescript
// Dans SaleDetails.tsx ligne 578
{sale.mechanismType && (
  <Card>...</Card>
)}
```

Si `mechanismType` est undefined ou null, rien ne s'affiche.

### Si couleurs incorrectes:

Vérifier les classes Tailwind:
```
border-emerald-200   ✅ Correct
border-green-200     ❌ Différent
bg-emerald-50        ✅ Correct
bg-green-50          ✅ OK pour gradient
```

### Si position incorrecte:

Ordre dans le JSX (SaleDetails.tsx):
```tsx
<div className="space-y-6">
  {/* 1. Payment Terms - PREMIER */}
  {sale.mechanismType && <Card>Payment Terms</Card>}

  {/* 2. Management Actions - APRÈS */}
  <Card>Management Actions</Card>
</div>
```

---

## ✅ Tests de Validation

### Test A: Création Spot
```bash
✓ Créer vente spot via Gold Trade Space
✓ Ouvrir SaleDetails
✓ Payment Terms visible avec contenu Spot
✓ Approuver vente
✓ Email généré avec lien
✓ Ouvrir lien client
✓ Page CustomerSaleApproval charge
✓ Payment Terms Spot affiché
✓ Approuver comme client
✓ Status → payment_received
✓ Page confirmation "COMMITTED"
```

### Test B: Création Forward 7
```bash
✓ Créer vente forward_7
✓ Ouvrir SaleDetails
✓ Payment Terms "Forward 7 Days" visible
✓ Approuver vente
✓ Ouvrir lien client
✓ Payment Terms "7 business days" affiché
✓ Approuver comme client
✓ Status → customer_approved (PAS payment_received!)
✓ Page confirmation "Payment Required"
```

### Test C: Sans mechanism_type
```bash
✓ Créer vente avec mechanism_type = NULL
✓ Ouvrir SaleDetails
✓ Payment Terms "Standard Payment Terms" ou pas affiché
✓ Comportement normal
```

---

## 📊 Résumé Visuel

### Ce qui DOIT s'afficher:

**SaleDetails (Management):**
```
[Customer Info]  [🆕 Payment Terms]  ← AJOUTÉ
[Sale Calcs]     [Management Actions]
```

**CustomerSaleApproval (Client):**
```
[Sale Info]  [💰 Payment Terms]  [Your Decision]
            ↑ Complet avec alert warning
```

**Post-Approbation Client:**
```
[✓ Success]
[Payment Status: COMMITTED/Required]
[Email confirmation]
[Amount & Quantity]
```

---

## 🎉 Conclusion

Si tous les tests passent:
- ✅ Payment Terms affiché correctement dans SaleDetails
- ✅ Payment Terms affiché correctement dans CustomerSaleApproval
- ✅ Workflow Spot fonctionne (auto payment_received)
- ✅ Workflow Forward fonctionne (customer_approved)
- ✅ Pages de confirmation différentes selon mécanisme

**L'IMPLÉMENTATION EST COMPLÈTE ET FONCTIONNELLE!** 🎉
