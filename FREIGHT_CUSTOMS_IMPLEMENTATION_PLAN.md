# 🚢 PLAN D'IMPLÉMENTATION: MODULE FREIGHT & CUSTOMS

## 📋 ANALYSE DES BESOINS

### Différences avec l'existant

| Aspect | Existant | Requis |
|--------|----------|--------|
| **Source** | shipping_preparations | daily_production |
| **Status source** | shipped | ready_for_expedition |
| **Nb productions** | 1 shipping → 1 freight | **MULTI**: plusieurs productions → 1 freight |
| **PDFs générés** | Aucun | **2 PDFs**: Bullion Summary + Invoice Douane |
| **Prix/Taux** | Non géré | **Prix $/oz + Taux change ($/CFA ou $/GNF)** |

### Workflow Requis
```
SHIPPING PREPARATION
  └─ Status: ready_for_expedition
      ↓
FREIGHT & CUSTOMS / Nouvelle Expédition
  ├─ Sélectionner PLUSIEURS productions (ready_for_expedition)
  ├─ Saisir: Prix $/oz, Taux change $/CFA ou $/GNF  
  ├─ Ajouter signataires
  ├─ Enregistrer (status: pending)
  │   └─ Génération AUTO: Bullion Summary PDF
  │   └─ Génération AUTO: Invoice Douane PDF
  └─ Approuver → shipped_to_refinery
```

## 🗄️ MODIFICATIONS DATABASE

### 1. Nouvelle table: freight_shipments
```sql
CREATE TABLE freight_shipments (
  id UUID PRIMARY KEY,
  reference_number TEXT UNIQUE,
  shipment_date DATE,
  
  -- Prix et taux
  gold_price_usd_per_oz DECIMAL(10,2),
  exchange_rate_usd_to_local DECIMAL(10,4),
  currency_code TEXT, -- 'CFA' ou 'GNF'
  
  -- Totaux calculés
  total_dore_weight_grams DECIMAL(12,2),
  total_pure_gold_grams DECIMAL(12,2),
  total_pure_gold_oz DECIMAL(12,4),
  total_value_usd DECIMAL(15,2),
  total_value_local DECIMAL(15,2),
  
  -- Documents générés
  bullion_summary_pdf_path TEXT,
  customs_invoice_pdf_path TEXT,
  
  -- Status
  status freight_shipment_status DEFAULT 'pending',
  
  -- Destination
  refinery_id UUID REFERENCES refineries(id),
  
  -- Audit
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_by UUID,
  approved_at TIMESTAMPTZ
);
```

### 2. Table de liaison: freight_shipment_productions
```sql
CREATE TABLE freight_shipment_productions (
  id UUID PRIMARY KEY,
  freight_shipment_id UUID REFERENCES freight_shipments(id),
  production_id UUID REFERENCES daily_production(id),
  
  -- Données snapshot au moment de l'ajout
  batch_number TEXT,
  dore_weight_grams DECIMAL(10,2),
  gold_assay_percent DECIMAL(5,2),
  pure_gold_grams DECIMAL(10,2),
  pure_gold_oz DECIMAL(10,4),
  
  added_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. Table: freight_shipment_signatories
```sql
CREATE TABLE freight_shipment_signatories (
  id UUID PRIMARY KEY,
  freight_shipment_id UUID REFERENCES freight_shipments(id),
  position TEXT,
  full_name TEXT,
  signature_data TEXT, -- Base64 ou path
  signed_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. ENUM freight_shipment_status
```sql
CREATE TYPE freight_shipment_status AS ENUM (
  'pending',              -- Enregistré, pas encore approuvé
  'approved',             -- Approuvé pour expédition
  'shipped_to_refinery',  -- Expédié
  'received_at_refinery'  -- Reçu
);
```

## 📄 GÉNÉRATION PDF

### PDF 1: BULLION SUMMARY

**Structure** (selon image fournie) :
```
┌─────────────────────────────────────────────────┐
│           LOGO + TITLE: BULLION SUMMARY         │
├─────────────────────────────────────────────────┤
│ REPORT DATE: XX-XXX-XX    SHIPMENT No: HUM-XXX │
├──────────┬──────────┬──────────┬───────────────┤
│ Bar No.  │Date Pour.│Date Ship.│ Dore Weight   │
│          │          │          │ SMK Gold (%)  │
│          │          │          │ SMK Silver(%) │
│          │          │          │ Au Content(g) │
│          │          │          │ Ag Content(g) │
│          │          │          │ Au (troy oz)  │
│          │          │          │ Ag (troy oz)  │
│          │          │          │ Value USD     │
├──────────┴──────────┴──────────┴───────────────┤
│                    TOTAUX                       │
├─────────────────────────────────────────────────┤
│ SIGNATAIRES                                     │
│ Position | Name | Signature                    │
└─────────────────────────────────────────────────┘
```

### PDF 2: INVOICE DOUANE

**Structure** (selon image fournie) :
```
┌─────────────────────────────────────────────────┐
│              INVOICE                            │
│        POUR BESOINS DE LA DOUANE                │
├─────────────────────────────────────────────────┤
│ Date: XX/XX/XXXX     INVOICE No: HUM-XXX       │
├───────────────────┬─────────────────────────────┤
│ Société Expéditeur│         Shipped to:         │
│ Address           │         Refinery Name       │
│ City/Country      │         Address             │
│ NIF               │         Phone               │
├───────────────────┴─────────────────────────────┤
│        EXCHANGE RATE FCFA/USD: XXX.XXXX         │
├─────────────────────────────────────────────────┤
│ # Boxes │ Type    │ Description                │
│         │         │ Metal | Net Wt | Wt (oz)   │
│         │         │       | (kg)   |           │
│         │         │ Au    | XX.XXX | XXX.XX    │
│         │         │                              │
│         │         │ Total Net Weight (kg): XX.XX│
│         │         │ Box No: HUM-XXX to HUM-XXX  │
│         │         │ Conversion: 1 oz = 31.1035g │
├─────────────────────────────────────────────────┤
│                Metal Price (CFA/kg): XXX,XXX    │
│                Estimated Value (CFA): XXX,XXX   │
│                Total prix CFA: XXX,XXX,XXX      │
│                Total prix US$: X,XXX,XXX.XX     │
└─────────────────────────────────────────────────┘
```

## 🎨 INTERFACE UTILISATEUR

### Page 1: FreightCustomsDashboard (EXISTANT - À ADAPTER)
- Liste des freight shipments
- Filtres par status
- Action: "Nouvelle Expédition"

### Page 2: FreightCustomsCreate (NOUVELLE)

**Section 1: Sélection Productions**
```
┌──────────────────────────────────────────────┐
│ PRODUCTIONS DISPONIBLES (ready_for_expedition)│
├──────────────────────────────────────────────┤
│ [✓] BATCH-001 | 10,500g | 92.5% | 315oz     │
│ [✓] BATCH-002 | 11,200g | 93.1% | 335oz     │
│ [ ] BATCH-003 | 9,800g  | 91.8% | 289oz     │
│                                               │
│ Total sélectionné: 2 productions | 650.12oz  │
└──────────────────────────────────────────────┘
```

**Section 2: Informations Commerciales**
```
┌──────────────────────────────────────────────┐
│ Prix de l'or ($/oz):    [________] USD      │
│ Taux de change:         [________]          │
│ Devise locale:          [CFA ▼] ou [GNF ▼]  │
│                                               │
│ Raffinerie destination: [Rand Refinery ▼]   │
│ Date d'expédition:      [31/10/2025]        │
└──────────────────────────────────────────────┘
```

**Section 3: Signataires**
```
┌──────────────────────────────────────────────┐
│ [+] Ajouter un signataire                    │
│                                               │
│ 1. Position: [Gold Room Operator]           │
│    Nom: [SIDIKI SIDIBE]                     │
│    [Signature pad]                           │
│                                               │
│ 2. Position: [SMK Finance]                  │
│    Nom: [MOUHAMAD TERA]                     │
│    [Signature pad]                           │
└──────────────────────────────────────────────┘
```

**Actions**
```
[Annuler]  [Enregistrer Brouillon]  [Créer Expédition]
```

### Page 3: FreightCustomsDetails (NOUVELLE)

**Sections**:
1. En-tête avec status et infos principales
2. Onglets:
   - Détails de l'expédition
   - Productions incluses (tableau)
   - Documents générés (PDFs téléchargeables)
   - Signataires
   - Historique

**Actions selon status**:
- `pending` → [Approuver pour Expédition]
- `approved` → [Marquer comme Expédié]
- `shipped_to_refinery` → [Confirmer Réception Raffinerie]

## 🔧 SERVICES

### freightShipmentService.ts (NOUVEAU)
```typescript
export const freightShipmentService = {
  // CRUD
  createShipment(data, productionIds)
  getShipmentById(id)
  updateShipment(id, data)
  deleteShipment(id)
  
  // Productions
  addProductions(shipmentId, productionIds)
  removeProduction(shipmentId, productionId)
  getAvailableProductions() // ready_for_expedition
  
  // Status
  approveForShipping(shipmentId)
  markAsShipped(shipmentId)
  confirmReceipt(shipmentId)
  
  // Signataires
  addSignatory(shipmentId, signatory)
  updateSignatory(id, data)
  removeSignatory(id)
}
```

### bullionSummaryPdfService.ts (NOUVEAU)
```typescript
export const bullionSummaryPdfService = {
  generate(shipmentId): Promise<Blob>
  save(shipmentId, pdf): Promise<string> // returns path
  download(shipmentId)
}
```

### customsInvoicePdfService.ts (NOUVEAU)
```typescript
export const customsInvoicePdfService = {
  generate(shipmentId): Promise<Blob>
  save(shipmentId, pdf): Promise<string>
  download(shipmentId)
}
```

## ✅ PLAN D'EXÉCUTION

### Phase 1: Database (2h)
- [ ] Créer migration avec nouvelles tables
- [ ] Appliquer et tester
- [ ] Vérifier RLS policies

### Phase 2: Services (3h)
- [ ] freightShipmentService.ts
- [ ] bullionSummaryPdfService.ts
- [ ] customsInvoicePdfService.ts

### Phase 3: UI - Create (4h)
- [ ] FreightCustomsCreate page
- [ ] Section sélection productions
- [ ] Section infos commerciales
- [ ] Section signataires
- [ ] Validation et submit

### Phase 4: UI - Details (2h)
- [ ] FreightCustomsDetails page
- [ ] Affichage complet
- [ ] Téléchargement PDFs
- [ ] Actions status

### Phase 5: PDF Generation (3h)
- [ ] Bullion Summary template
- [ ] Customs Invoice template
- [ ] Tests génération

### Phase 6: Tests & QA (2h)
- [ ] Test workflow complet
- [ ] Vérification non-régression
- [ ] Contrôle qualité PDFs

**TOTAL: ~16h de développement**

