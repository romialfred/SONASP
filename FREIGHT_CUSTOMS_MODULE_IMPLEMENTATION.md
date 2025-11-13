# Module Freight & Customs - Guide d'Implémentation

## ✅ Composants Implémentés

### 1. Base de Données (Migration)
**Fichier:** `supabase/migrations/20251113_020_create_freight_customs_module.sql`

**Tables créées:**
- `freight_customs_operations` - Opérations douanières principales
- `freight_customs_documents` - Documents attachés
- `freight_customs_invoice_data` - Données pour factures d'exportation

**Statuts disponibles:**
- `customs_pending` - En attente d'approbation douanière
- `customs_approved` - Approuvé par la douane
- `ready_for_transport` - Prêt pour le transport
- `shipped_to_refinery` - Expédié vers la raffinerie

**Types de documents:**
- `customs_declaration` - Déclaration en douane
- `customs_approval` - Approbation douanière
- `transport_document` - Document de transport
- `bill_of_lading` - Connaissement
- `export_invoice` - Facture d'exportation
- `bullion_summary` - Résumé des lingots
- `other` - Autre

### 2. Services TypeScript
**Fichier:** `src/services/freightCustomsService.ts`

**Fonctionnalités:**
- ✅ Liste des opérations douanières (filtrées sur expéditions 'shipped')
- ✅ CRUD complet des opérations
- ✅ Gestion des statuts
- ✅ Upload et gestion des documents PDF
- ✅ Gestion des données de facture
- ✅ Récupération des expéditions disponibles

**Fichier:** `src/services/freightInvoiceGenerationService.ts`

**Fonctionnalités:**
- ✅ Génération du Bullion Summary PDF (format tableau)
- ✅ Génération de l'Invoice pour la douane (format facture)
- ✅ Calculs automatiques (totaux, moyennes, conversions)
- ✅ Export en PDF téléchargeable ou uploadable

## 📋 Composants À Implémenter

### 3. Composants UI (À créer)

#### a) PDFViewer Component
**Fichier:** `src/components/ui/PDFViewerEnhanced.tsx`

Fonctionnalités requises:
- Visualisation de PDF inline
- Navigation entre pages
- Zoom in/out
- Téléchargement
- Impression

#### b) FreightCustomsDashboard Page
**Fichier:** `src/pages/freight/FreightCustomsDashboard.tsx`

Structure:
```tsx
- Header avec titre et bouton "Créer opération"
- Filtres (statut, société minière, date)
- Tableau des opérations avec colonnes:
  * Référence
  * N° Expédition
  * Société minière
  * Date d'expédition
  * Poids total
  * Statut
  * Actions (Voir détails)
- Pagination
```

#### c) FreightCustomsDetails Page
**Fichier:** `src/pages/freight/FreightCustomsDetails.tsx`

Structure avec panneau latéral:
```tsx
- Section principale (gauche):
  * Informations générales
  * Détails de l'expédition
  * Timeline des statuts
  * Liste des barres incluses
  
- Panneau latéral droit (drawer):
  * Documents attachés (liste avec preview)
  * Bouton "Ajouter document"
  * Bouton "Générer facture"
  * Changement de statut
```

#### d) Formulaires

**AddDocumentForm.tsx**
```tsx
- Sélection du type de document
- Titre
- Description (optionnelle)
- Upload fichier PDF
- Bouton sauvegarder
```

**GenerateInvoiceForm.tsx**
```tsx
Onglets:
1. Bullion Summary
   - Date du rapport
   - Informations des signatures
   - Preview des barres
   
2. Export Invoice
   - Informations expéditeur (pré-remplies)
   - Informations destinataire (raffinerie)
   - Informations mine
   - Taux de change FCFA/USD
   - Prix du métal
   - Bouton "Générer PDF"
```

**ChangeStatusForm.tsx**
```tsx
- Sélection du nouveau statut
- Champs conditionnels selon statut:
  * customs_approved: Date approbation, N° référence douane, Officier
  * ready_for_transport: Transporteur, Contact transitaire
  * shipped_to_refinery: Date départ, N° AWB, N° tracking
- Notes
- Bouton confirmer
```

### 4. Navigation et Routes

**Fichier:** `src/App.tsx`

Ajouter les routes:
```tsx
<Route path="/freight-customs" element={<FreightCustomsDashboard />} />
<Route path="/freight-customs/:id" element={<FreightCustomsDetails />} />
```

**Fichier:** `src/components/layout/AccordionSidebar.tsx`

Ajouter dans la navigation:
```tsx
{
  title: "Freight & Customs",
  icon: Truck,
  href: "/freight-customs",
  roles: ["admin", "freight_manager", "customs_officer"]
}
```

### 5. Storage Bucket

**À configurer dans Supabase:**
```sql
-- Créer le bucket pour les documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('freight-customs-documents', 'freight-customs-documents', true);

-- Politiques RLS pour le bucket
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'freight-customs-documents');

CREATE POLICY "Authenticated users can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'freight-customs-documents');

CREATE POLICY "Authenticated users can delete their documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'freight-customs-documents');
```

## 🔄 Flux de Travail

### 1. Création d'une Opération Douanière

```
Shipping Preparation (status = 'shipped')
    ↓
Freight Customs Dashboard → "Créer opération"
    ↓
Opération créée (status = 'customs_pending')
    ↓
Référence auto-générée: FC-YYYYMMDD-XXXX
```

### 2. Traitement Douanier

```
customs_pending
    ↓ [Upload déclaration douane]
    ↓ [Approbation officier douanes]
    ↓
customs_approved
    ↓ [Génération factures export]
    ↓ [Upload documents transport]
    ↓
ready_for_transport
    ↓ [Départ confirmé avec AWB]
    ↓
shipped_to_refinery
```

### 3. Génération de Documents

```
Clic "Générer facture d'exportation"
    ↓
Formulaire avec:
  - Données pré-remplies depuis shipping/production
  - Champs manquants à remplir:
    * Taux de change
    * Prix du métal
    * Informations transporteur
    ↓
Génération PDF (Bullion Summary + Invoice)
    ↓
Upload automatique dans documents
    ↓
Type = 'export_invoice' ou 'bullion_summary'
```

## 📊 Exemple de Génération de Facture

### Données Requises

**Depuis shipping_preparation:**
- reference_number → SHIPMENT No / INVOICE No
- shipment_date → Date
- total_weight_grams → Net Weight
- destination → Shipped to

**Depuis daily_productions (via items):**
- bar_reference → Bar No.
- production_date → Date Poured
- bullion_grams → Dore Weight
- estimated_fineness_pct → SMK Gold Assay
- estimated_silver_pct → SMK Silver Assay
- pure_gold_grams → Au Content
- silver_content_grams → Ag Content
- estimated_oz → Troy Oz

**Depuis mining_company:**
- name → Sender Name
- address → Sender Address
- nif → NIF

**À remplir manuellement:**
- Recipient (raffinerie) details
- Exchange rate FCFA/USD
- Metal price CFA/kg
- Box references range
- Signatures (positions + noms)

## 🎨 Style et Design

### Principes
- Headers de tableaux: `text-[10px] font-medium whitespace-nowrap`
- Contenu: `text-xs` sans gras excessif
- Formulaires: spacing généreux, labels clairs
- Panneau latéral: width 400-500px, slide animation
- PDF Viewer: mode plein écran optionnel

### Couleurs
- Status badges:
  * customs_pending: yellow-100/yellow-800
  * customs_approved: emerald-100/emerald-800
  * ready_for_transport: blue-100/blue-800
  * shipped_to_refinery: purple-100/purple-800

## 🔐 Permissions et Sécurité

### Rôles Suggérés
- **customs_officer**: Peut approuver, changer statuts, uploader documents
- **freight_manager**: Peut gérer transport, générer factures
- **admin**: Accès complet

### RLS
- Toutes les tables ont RLS activé
- Politiques basées sur auth.uid()
- Vérification des rôles dans les fonctions sensibles

## 📝 Tests À Effectuer

1. ✅ Création d'opération depuis expédition "shipped"
2. ✅ Upload de documents PDF
3. ✅ Visualisation des PDF
4. ✅ Changement de statuts avec données additionnelles
5. ✅ Génération Bullion Summary PDF
6. ✅ Génération Export Invoice PDF
7. ✅ Interopérabilité avec module Shipping
8. ✅ Permissions et RLS

## 🚀 Migration À Appliquer

```bash
# Appliquer la migration
supabase db push

# Ou via l'interface Supabase SQL Editor
# Copier le contenu de:
# supabase/migrations/20251113_020_create_freight_customs_module.sql

# Créer le bucket storage
# Voir section "Storage Bucket" ci-dessus
```

## 📦 Dépendances Nécessaires

Déjà installées:
- `jspdf` - Génération PDF
- `jspdf-autotable` - Tableaux dans PDF
- `pdfjs-dist` - Visualisation PDF (voir PDFViewer existant)

## 🔗 Interopérabilité

### Avec Shipping Module
- Lecture des shipping_preparations (status = 'shipped')
- Pas de modification directe des expéditions
- Relation 1-to-1: une expédition = une opération douanière max

### Avec Production Module
- Lecture des daily_productions via shipping_preparation_items
- Utilisation pour génération de factures

### Avec Mining Companies
- Lecture des informations société minière
- Utilisation pour factures (expéditeur)

## 📄 Exemple de Mapping des Données

### Pour Bullion Summary:
```typescript
{
  reportDate: new Date().toLocaleDateString('en-GB'),
  shipmentNumber: shipping.reference_number,
  bars: shipping.items.map(item => ({
    barNo: item.daily_production.bar_reference,
    datePoured: item.daily_production.production_date,
    dateShipped: shipping.shipment_date,
    doreWeight: item.daily_production.bullion_grams,
    smkGoldAssay: item.daily_production.estimated_fineness_pct,
    smkSilverAssay: item.daily_production.estimated_silver_pct || 0,
    auContent: item.daily_production.pure_gold_grams,
    agContent: item.daily_production.silver_content_grams || 0,
    auContentTroyOz: item.daily_production.estimated_oz,
    agContentTroyOz: (item.daily_production.silver_content_grams || 0) / 31.1035,
    valueUSD: calculateValue(...)
  })),
  signatures: [
    { position: 'Gold Room Operator', name: formData.operator },
    { position: 'SMK Finance', name: formData.finance }
  ]
}
```

### Pour Export Invoice:
```typescript
{
  shipmentDate: shipping.shipment_date,
  invoiceNumber: shipping.reference_number,
  senderName: mining_company.name,
  senderAddress: mining_company.address,
  // ... etc depuis invoice_data table
  netWeightKg: shipping.total_weight_grams / 1000,
  weightTroyOz: shipping.total_weight_oz,
  totalPriceUSD: invoice_data.total_value_usd
}
```

## 🎯 Prochaines Étapes

1. Créer les composants UI manquants
2. Implémenter les formulaires
3. Créer le bucket storage et configurer les politiques
4. Ajouter la navigation
5. Tester l'intégration complète
6. Valider avec des données réelles

