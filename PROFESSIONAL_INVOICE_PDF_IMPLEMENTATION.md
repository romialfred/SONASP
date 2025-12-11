# Implémentation de la Facture Professionnelle PDF

## Date
2025-12-11

## Résumé

Une facture professionnelle de type internationale a été implémentée avec génération de PDF, incluant les logos du client et du vendeur, en-têtes détaillés, et un format standardisé conforme aux normes internationales.

## Fonctionnalités Implémentées

### 1. Service de Génération de Facture PDF

**Fichier:** `src/services/saleInvoiceService.ts`

Le service fournit les fonctionnalités suivantes:

#### A. Génération de PDF (`generateSaleInvoicePDF`)

Génère une facture PDF professionnelle avec:
- **En-tête avec logos**
  - Logo du vendeur (Mining Company) à gauche
  - Logo du client (Customer) à droite
  - Bordure supérieure en couleur primaire (emerald)

- **Informations de la facture**
  - Numéro de facture
  - Date d'émission
  - Date d'échéance (optionnelle)
  - Mécanisme de pricing (si applicable)

- **Section Vendeur (FROM)**
  - Nom de la société
  - Adresse complète
  - Ville et pays
  - Email et téléphone
  - Numéro d'identification fiscale

- **Section Client (TO)**
  - Nom du client
  - Adresse complète
  - Ville et pays
  - Email et téléphone
  - Numéro d'identification fiscale

- **Tableau des lignes de produits**
  - Product/Service
  - Quantity (oz et grammes)
  - Unit Price
  - Amount

- **Détail des calculs**
  - Gross Proceeds
  - Freight Cost (si > 0)
  - Other Costs (si > 0)
  - Net Proceeds
  - Royalties (3%)
  - **TOTAL AMOUNT** (en grand format, fond coloré)

- **Termes de paiement**
  - Payment terms personnalisés

- **Notes additionnelles**
  - Notes ou conditions spéciales

- **Pied de page**
  - Mention légale
  - Date de génération
  - Numéro de page
  - Bordure inférieure en couleur primaire

#### B. Upload vers Supabase Storage (`uploadInvoicePDF`)

Upload le PDF généré vers Supabase Storage:
- Bucket: `sale-documents`
- Path: `sales/{saleId}/invoice_{invoiceNumber}_{timestamp}.pdf`
- Retourne l'URL publique du fichier

#### C. Génération et Upload combinés (`generateAndUploadSaleInvoice`)

Fonction all-in-one qui:
1. Génère le PDF
2. Upload vers Supabase
3. Met à jour l'enregistrement de vente avec le path et URL du PDF

#### D. Téléchargement local (`downloadInvoicePDF`)

Télécharge le PDF sur l'ordinateur de l'utilisateur.

### 2. Interface de Données

```typescript
interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;

  // Seller Information
  sellerName: string;
  sellerAddress: string;
  sellerCity: string;
  sellerCountry: string;
  sellerPhone?: string;
  sellerEmail?: string;
  sellerTaxId?: string;
  sellerLogoUrl?: string;

  // Customer Information
  customerName: string;
  customerAddress: string;
  customerCity: string;
  customerCountry: string;
  customerPhone?: string;
  customerEmail?: string;
  customerTaxId?: string;
  customerLogoUrl?: string;

  // Sale Details
  quantityOz: number;
  quantityGrams: number;
  pricePerOz: number;
  currency: string;

  // Pricing Details
  grossProceeds: number;
  freightCost: number;
  otherCosts: number;
  netProceeds: number;
  royaltiesPercentage: number;
  royaltiesAmount: number;
  finalAmount: number;

  // Additional Info
  mechanismType?: string;
  mechanismDisplayName?: string;
  paymentTerms?: string;
  notes?: string;
}
```

### 3. Intégration dans le Formulaire de Vente

**Fichier:** `src/pages/sales/SaleCreate.tsx`

#### A. Nouveaux États

```typescript
const [invoicePdfBlob, setInvoicePdfBlob] = useState<Blob | null>(null);
const [generatingPdf, setGeneratingPdf] = useState(false);
```

#### B. Fonction de Génération de Preview

La fonction `generateInvoicePreview()` est appelée automatiquement après le calcul:
- Récupère les informations complètes du client depuis la base de données
- Construit l'objet `InvoiceData` avec toutes les informations
- Génère le PDF avec `generateSaleInvoicePDF()`
- Stocke le Blob dans l'état pour permettre le téléchargement/preview

#### C. Nouvelles Actions Utilisateur

**Preview PDF:**
```typescript
const handlePreviewInvoice = () => {
  const url = URL.createObjectURL(invoicePdfBlob);
  window.open(url, '_blank');
};
```

**Download PDF:**
```typescript
const handleDownloadInvoice = () => {
  downloadInvoicePDF(invoicePdfBlob, `DRAFT-${Date.now()}`);
};
```

#### D. Interface Utilisateur Améliorée

**En-tête de la facture:**
- Titre "Professional Invoice" avec icône FileText
- Boutons "Preview PDF" et "Download PDF" dans l'en-tête
- Statut de génération affiché

**Corps de la facture (version web):**
- Grid 2 colonnes avec infos vendeur/client
- Résumé des calculs simplifié
- Mise en évidence du TOTAL AMOUNT
- Notice explicative sur le PDF professionnel

**Design:**
```
┌─────────────────────────────────────────────────────────┐
│  Professional Invoice        [Preview] [Download]       │
│  Draft invoice ready for download                       │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐                  │
│  │   SELLER     │    │   CUSTOMER   │                  │
│  │ Yanfolila    │    │ Auramet      │                  │
│  └──────────────┘    └──────────────┘                  │
│                                                          │
│  Fine Gold Quantity ........................ 400.000 oz │
│  Price per oz ............................ $4,006.83    │
│  Gross Proceeds ........................ $1,602,732.00  │
│  Less: Freight Cost .......................... -$500.00 │
│  Less: Other Costs ........................... -$100.00 │
│  Net Proceeds .......................... $1,602,132.00  │
│  Less: Royalties (3%) .................... -$48,063.96 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  TOTAL AMOUNT .......................... $1,554,068.04  │
│                                                          │
│  ⚠ Professional Invoice PDF                            │
│  The PDF includes logos, detailed info, and meets      │
│  international standards. Use buttons above.           │
└─────────────────────────────────────────────────────────┘
```

## Design de la Facture PDF

### Layout

**Format:** A4 Portrait (210mm × 297mm)
**Marges:** 15mm de chaque côté

### Structure Visuelle

```
┌───────────────────────────────────────────────────────┐
│ [Barre primaire 8mm]                                  │
├───────────────────────────────────────────────────────┤
│                                                        │
│  [Logo Vendeur]                     [Logo Client]     │
│     25×25mm                            25×25mm         │
│                                                        │
│              ╔═══════════════════╗                    │
│              ║     INVOICE       ║                    │
│              ║  Invoice #: 001   ║                    │
│              ║  Date: Dec 11     ║                    │
│              ╚═══════════════════╝                    │
│                                                        │
│  ┌────────────────────┐  ┌────────────────────┐      │
│  │ FROM (SELLER)      │  │ TO (CUSTOMER)      │      │
│  │ Company Name       │  │ Client Name        │      │
│  │ Address            │  │ Address            │      │
│  │ City, Country      │  │ City, Country      │      │
│  │ Email, Phone       │  │ Email, Phone       │      │
│  └────────────────────┘  └────────────────────┘      │
│                                                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Product    │ Quantity │ Unit Price │ Amount   │ │
│  ├─────────────────────────────────────────────────┤ │
│  │ Fine Gold  │ 400 oz   │ $4,006.83  │$1,602... │ │
│  └─────────────────────────────────────────────────┘ │
│                                                        │
│                             Gross Proceeds: $1,602... │
│                             Freight Cost:   -$500.00  │
│                             Other Costs:    -$100.00  │
│                             ───────────────────────   │
│                             Net Proceeds:  $1,602...  │
│                             Royalties (3%): -$48...   │
│                             ═══════════════════════   │
│                             TOTAL AMOUNT: $1,554...   │
│                                                        │
│  [Payment Terms Box]                                  │
│  [Notes Section]                                      │
│                                                        │
├───────────────────────────────────────────────────────┤
│  This invoice is generated electronically...          │
│  Generated on 2025-12-11 | Page 1 of 1               │
│ [Barre primaire 5mm]                                  │
└───────────────────────────────────────────────────────┘
```

### Palette de Couleurs

| Élément | Couleur RGB | Usage |
|---------|-------------|-------|
| Primary | [16, 185, 129] | Emerald - Bordures, titres |
| Secondary | [71, 85, 105] | Slate - Texte secondaire |
| Text | [31, 41, 55] | Gray-800 - Texte principal |
| Light Gray | [243, 244, 246] | Gray-100 - Fonds |

### Typography

- **Titres:** Helvetica Bold, 28pt
- **Sous-titres:** Helvetica Bold, 10pt
- **Corps:** Helvetica Normal, 9pt
- **Petit texte:** Helvetica Normal, 7-8pt

## Utilisation

### Dans le Formulaire de Vente

1. **L'utilisateur remplit le formulaire**
   - Sélectionne vendeur (Mining Company)
   - Sélectionne client autorisé
   - Entre quantité et prix
   - Entre frais optionnels

2. **Clic sur "Calculate Invoice"**
   - Validation des données
   - Vérification des autorisations
   - Affichage du résumé de la facture
   - **Génération automatique du PDF** (en background)

3. **Actions disponibles:**
   - **Preview PDF:** Ouvre le PDF dans un nouvel onglet
   - **Download PDF:** Télécharge le PDF sur l'ordinateur
   - **Create Sale:** Crée la vente en base de données

### Génération lors de la Création de Vente

Lorsque la vente est créée:
1. Le PDF peut être regénéré avec le vrai numéro de facture (SL-2025-001)
2. Le PDF est uploadé vers Supabase Storage
3. Les colonnes `invoice_pdf_path` et `invoice_pdf_url` sont mises à jour dans la table `sales`

## Migrations de Base de Données Requises

Pour stocker les PDFs de facture, ajouter ces colonnes à la table `sales`:

```sql
-- Migration: Add invoice PDF columns to sales table

ALTER TABLE sales
ADD COLUMN IF NOT EXISTS invoice_pdf_path TEXT,
ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT;

COMMENT ON COLUMN sales.invoice_pdf_path IS 'Path to invoice PDF in Supabase Storage';
COMMENT ON COLUMN sales.invoice_pdf_url IS 'Public URL to invoice PDF';
```

## Configuration Supabase Storage

### Bucket: sale-documents

**Création du bucket:**
```sql
-- Create bucket for sale documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('sale-documents', 'sale-documents', true);
```

**Policies RLS:**
```sql
-- Policy: Allow authenticated users to upload invoices
CREATE POLICY "Authenticated users can upload sale documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sale-documents');

-- Policy: Allow public read access to invoices
CREATE POLICY "Public read access to sale documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'sale-documents');

-- Policy: Allow authenticated users to update their sale documents
CREATE POLICY "Authenticated users can update sale documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'sale-documents');
```

## Logos des Sociétés

### Méthode 1: Upload dans Supabase Storage

Les logos peuvent être uploadés dans un bucket dédié:

**Bucket:** `company-logos`

**Structure:**
```
company-logos/
  mining-companies/
    yanfolila.png
    morila.png
  customers/
    auramet.png
    stonex.png
```

**URL dans la base de données:**
```sql
UPDATE mining_companies
SET logo_url = 'https://[project].supabase.co/storage/v1/object/public/company-logos/mining-companies/yanfolila.png'
WHERE id = 'uuid...';
```

### Méthode 2: Placeholders

Si aucun logo n'est disponible, le PDF génère automatiquement des placeholders:
- Rectangle gris avec le texte "SELLER" ou "CUSTOMER"
- Garde le layout cohérent même sans logos

## Exemple de Code pour Générer une Facture

```typescript
import { generateSaleInvoicePDF, downloadInvoicePDF } from '@/services/saleInvoiceService';

// Préparer les données
const invoiceData: InvoiceData = {
  invoiceNumber: 'SL-2025-001',
  invoiceDate: '2025-12-11',

  sellerName: 'Yanfolila Gold Mining',
  sellerAddress: '123 Mining Street',
  sellerCity: 'Yanfolila',
  sellerCountry: 'Mali',
  sellerEmail: 'contact@yanfolila.ml',
  sellerLogoUrl: 'https://.../yanfolila.png',

  customerName: 'Auramet International',
  customerAddress: '456 Refinery Ave',
  customerCity: 'New York',
  customerCountry: 'USA',
  customerEmail: 'sales@auramet.com',
  customerLogoUrl: 'https://.../auramet.png',

  quantityOz: 400,
  quantityGrams: 12441.40,
  pricePerOz: 4006.83,
  currency: 'USD',

  grossProceeds: 1602732.00,
  freightCost: 500.00,
  otherCosts: 100.00,
  netProceeds: 1602132.00,
  royaltiesPercentage: 3,
  royaltiesAmount: 48063.96,
  finalAmount: 1554068.04,

  paymentTerms: 'Payment due within 2 business days',
  notes: 'Thank you for your business.'
};

// Générer et télécharger
const pdfBlob = await generateSaleInvoicePDF(invoiceData);
downloadInvoicePDF(pdfBlob, 'SL-2025-001');
```

## Avantages de l'Implémentation

### 1. Conformité Internationale
- Format A4 standard
- Structure de facture professionnelle
- Informations complètes (vendeur, client, produits, termes)
- Mention légale de génération électronique

### 2. Professionnalisme
- Design épuré et moderne
- Logos des sociétés
- Typography hiérarchisée
- Couleurs cohérentes avec la marque

### 3. Facilité d'Utilisation
- Génération automatique après calcul
- Preview en 1 clic
- Téléchargement en 1 clic
- Pas de configuration nécessaire

### 4. Traçabilité
- PDF stocké dans Supabase Storage
- URL attachée à la vente
- Historique complet des factures
- Accès permanent aux documents

### 5. Flexibilité
- Supporte les logos ou placeholders
- Notes et termes personnalisables
- Multi-devise (USD par défaut)
- Extensible pour d'autres langues

## Tests Recommandés

### Scénarios à Tester

1. **Génération de PDF**
   - Avec logos du vendeur et client
   - Avec placeholders (sans logos)
   - Avec frais de transport
   - Sans frais additionnels

2. **Preview et Download**
   - Preview dans nouvel onglet
   - Download avec nom correct
   - Vérifier le contenu du PDF

3. **Différents Montants**
   - Petites quantités (< 1 oz)
   - Grandes quantités (> 1000 oz)
   - Prix avec décimales
   - Calculs de royalties corrects

4. **Informations Manquantes**
   - Client sans email/phone
   - Vendeur sans adresse complète
   - Vérifier les valeurs par défaut

5. **Upload vers Supabase**
   - Vérifier le path du fichier
   - Vérifier l'URL publique
   - Vérifier la mise à jour de la table sales

## Build Status

✅ Build réussi sans erreurs
✅ Service de facture créé et testé
✅ Intégration dans le formulaire de vente
✅ Génération PDF automatique
✅ Preview et download fonctionnels

## Prochaines Étapes

### Optionnel - Améliorations Futures

1. **Multi-devises**
   - Support de EUR, GBP, etc.
   - Taux de change automatique

2. **Multi-langues**
   - Factures en français
   - Factures en anglais
   - Termes traduits

3. **Templates Personnalisables**
   - Différents styles de facture
   - Choix de couleurs
   - Footer personnalisé

4. **Signature Électronique**
   - Signature numérique
   - QR code pour vérification
   - Hash cryptographique

5. **Email Automatique**
   - Envoi automatique au client
   - Suivi des ouvertures
   - Relances automatiques

## Conclusion

La facture professionnelle PDF est maintenant pleinement intégrée dans le formulaire de vente. Elle respecte les standards internationaux, inclut tous les éléments requis (logos, informations complètes, calculs détaillés), et offre une excellente expérience utilisateur avec preview et téléchargement en 1 clic.

---

**Status:** ✅ IMPLÉMENTATION COMPLÈTE - BUILD RÉUSSI

**Date:** 2025-12-11
