# État de la Génération de Documents PDF - Module Invoice & Consignment

## Situation Actuelle

### ✓ Ce qui existe déjà

1. **Service de génération PDF complet** (`src/services/freightInvoiceGenerationService.ts`)
   - ✅ `generateBullionSummary()` - Génère le résumé des lingots
   - ✅ `generateExportInvoice()` - Génère la facture pour la douane
   - ✅ `getPDFBlob()` - Convertit le PDF en blob pour upload
   - ✅ `downloadPDF()` - Télécharge directement le PDF

2. **Champs dans la base de données** (`freight_shipments` table)
   - ✅ `bullion_summary_pdf_path` - Chemin du Bullion Summary
   - ✅ `customs_invoice_pdf_path` - Chemin de l'Invoice
   - ✅ `packing_list_pdf_path` - Chemin du Packing List
   - ✅ `consignment_note_pdf_path` - Chemin du Consignment Note

3. **Interface d'affichage** (`src/pages/freight/FreightShipmentDetails.tsx`)
   - ✅ Section "Documents Générés" complète
   - ✅ Boutons de visualisation (œil)
   - ✅ Boutons de téléchargement
   - ✅ Viewer PDF modal intégré
   - ✅ Message "Aucun document généré" quand les champs sont vides

### ❌ Ce qui manque

**LA GÉNÉRATION AUTOMATIQUE DES PDF N'EST PAS IMPLÉMENTÉE !**

Les documents ne sont jamais générés lors de :
1. ❌ La création d'une nouvelle expédition
2. ❌ L'approbation d'une expédition
3. ❌ Aucun moment du cycle de vie de l'expédition

**Résultat :** Vous voyez toujours "Aucun document généré" car les champs `bullion_summary_pdf_path` et `customs_invoice_pdf_path` sont `NULL`.

---

## Pourquoi les Documents ne sont-ils pas Générés ?

### Dans `FreightShipmentCreate.tsx`

**Ce qu'il y a :**
```typescript
// Ligne 995
<p className="text-xs text-blue-700 mt-1">
  Ces signataires apparaîtront automatiquement sur les documents PDF
  (Bullion Summary et Facture Customs)
</p>
```

**Ce qui manque :**
- ❌ Aucun import de `freightInvoiceGenerationService`
- ❌ Aucun appel à `generateBullionSummary()`
- ❌ Aucun appel à `generateExportInvoice()`
- ❌ Aucun upload vers Supabase Storage
- ❌ Aucune mise à jour des champs `pdf_path` dans la BDD

Le service existe mais n'est **JAMAIS APPELÉ**.

---

## Solution Proposée

### Option 1: Génération Manuelle (Rapide à tester)

Ajouter un bouton "Générer les Documents" dans la page de détails de l'expédition.

**Avantages :**
- ✅ Facile à tester immédiatement
- ✅ Permet de régénérer les documents si nécessaire
- ✅ Contrôle total sur quand générer

**Inconvénients :**
- ⚠️ L'utilisateur doit cliquer manuellement
- ⚠️ Peut oublier de générer les documents

### Option 2: Génération Automatique (Production-ready)

Générer automatiquement les documents lors de la création de l'expédition.

**Avantages :**
- ✅ Documents toujours disponibles
- ✅ Aucune action manuelle requise
- ✅ Professionnel et automatisé

**Inconvénients :**
- ⚠️ Plus complexe à implémenter
- ⚠️ Doit gérer les erreurs d'upload

### Option 3: Génération Hybride (Recommandé)

1. **Génération automatique** lors de la création
2. **Bouton de régénération** pour mettre à jour si nécessaire

---

## Plan d'Implémentation

### Étape 1: Créer le service d'upload PDF

```typescript
// src/services/freightDocumentService.ts

export const freightDocumentService = {
  /**
   * Upload un PDF vers Supabase Storage et retourne le path
   */
  async uploadPDF(
    file: Blob,
    fileName: string,
    shipmentId: string
  ): Promise<string> {
    const path = `freight-documents/${shipmentId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('freight-documents')
      .upload(path, file, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) throw error;

    // Retourner l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from('freight-documents')
      .getPublicUrl(path);

    return publicUrl;
  },

  /**
   * Génère et upload le Bullion Summary
   */
  async generateAndUploadBullionSummary(
    shipmentId: string,
    data: BullionSummaryData
  ): Promise<string> {
    // Générer le PDF
    const pdf = freightInvoiceGenerationService.generateBullionSummary(data);

    // Convertir en blob
    const blob = freightInvoiceGenerationService.getPDFBlob(pdf);

    // Upload
    const fileName = `bullion-summary-${data.shipmentNumber}.pdf`;
    return await this.uploadPDF(blob, fileName, shipmentId);
  },

  /**
   * Génère et upload l'Invoice
   */
  async generateAndUploadInvoice(
    shipmentId: string,
    data: ExportInvoiceData
  ): Promise<string> {
    // Générer le PDF
    const pdf = freightInvoiceGenerationService.generateExportInvoice(data);

    // Convertir en blob
    const blob = freightInvoiceGenerationService.getPDFBlob(pdf);

    // Upload
    const fileName = `customs-invoice-${data.invoiceNumber}.pdf`;
    return await this.uploadPDF(blob, fileName, shipmentId);
  },

  /**
   * Met à jour les paths PDF dans la BDD
   */
  async updateDocumentPaths(
    shipmentId: string,
    bullionPath?: string,
    invoicePath?: string
  ): Promise<void> {
    const updates: any = {};

    if (bullionPath) updates.bullion_summary_pdf_path = bullionPath;
    if (invoicePath) updates.customs_invoice_pdf_path = invoicePath;

    const { error } = await supabase
      .from('freight_shipments')
      .update(updates)
      .eq('id', shipmentId);

    if (error) throw error;
  }
};
```

### Étape 2: Ajouter le bouton de génération manuelle

Dans `FreightShipmentDetails.tsx`, ajouter :

```typescript
const handleGenerateDocuments = async () => {
  if (!shipment) return;

  try {
    setGenerating(true);
    showInfo('Génération des documents en cours...');

    // Préparer les données pour Bullion Summary
    const bullionData: BullionSummaryData = {
      reportDate: new Date().toLocaleDateString('en-US'),
      shipmentNumber: shipment.reference_number,
      bars: shipment.productions.map(p => ({
        barNo: p.bar_reference,
        datePoured: new Date(p.production_date).toLocaleDateString('en-US'),
        dateShipped: new Date(shipment.shipment_date).toLocaleDateString('en-US'),
        doreWeight: p.bullion_grams,
        smkGoldAssay: p.estimated_fineness_pct,
        smkSilverAssay: p.estimated_silver_pct || 0,
        auContent: p.pure_gold_grams,
        agContent: p.silver_content_grams || 0,
        auContentTroyOz: p.pure_gold_oz,
        agContentTroyOz: (p.silver_content_grams || 0) / 31.1035,
        valueUSD: p.pure_gold_oz * shipment.gold_price_usd_per_oz
      })),
      signatures: shipment.signatories?.map(s => ({
        position: s.position,
        name: s.full_name
      })) || []
    };

    // Préparer les données pour Invoice
    const invoiceData: ExportInvoiceData = {
      shipmentDate: new Date(shipment.shipment_date).toLocaleDateString('en-US'),
      invoiceNumber: shipment.reference_number,
      // ... autres champs nécessaires
    };

    // Générer et uploader
    const bullionPath = await freightDocumentService.generateAndUploadBullionSummary(
      shipment.id,
      bullionData
    );

    const invoicePath = await freightDocumentService.generateAndUploadInvoice(
      shipment.id,
      invoiceData
    );

    // Mettre à jour la BDD
    await freightDocumentService.updateDocumentPaths(
      shipment.id,
      bullionPath,
      invoicePath
    );

    // Recharger les données
    await loadShipment();

    showSuccess('Documents générés avec succès !');
  } catch (error: any) {
    console.error('Erreur génération documents:', error);
    showError('Erreur', error.message);
  } finally {
    setGenerating(false);
  }
};
```

Ajouter le bouton dans l'interface :

```tsx
{/* Documents Card */}
<Card className="p-6">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
      <FileText className="w-5 h-5" />
      Documents Générés
    </h2>

    {/* Bouton Générer */}
    {(!shipment.bullion_summary_pdf_path || !shipment.customs_invoice_pdf_path) && (
      <Button
        onClick={handleGenerateDocuments}
        disabled={generating}
        className="bg-blue-600 hover:bg-blue-700"
      >
        {generating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Génération...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            Générer les Documents
          </>
        )}
      </Button>
    )}
  </div>

  {/* Liste des documents */}
  {/* ... */}
</Card>
```

### Étape 3: Configuration de Supabase Storage

Créer le bucket `freight-documents` :

```sql
-- Dans Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('freight-documents', 'freight-documents', true);

-- RLS Policies
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'freight-documents');

CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'freight-documents');

CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'freight-documents');
```

---

## Comment Tester Maintenant

### Méthode 1: Test Direct du Service

Créer un fichier de test temporaire:

```typescript
// test-pdf-generation.ts
import { freightInvoiceGenerationService, BullionSummaryData } from './services/freightInvoiceGenerationService';

const testData: BullionSummaryData = {
  reportDate: '12/10/2025',
  shipmentNumber: 'HUM-SMK-001/2025',
  bars: [
    {
      barNo: 'SMK-240315-001',
      datePoured: '03/15/2024',
      dateShipped: '12/10/2025',
      doreWeight: 985.50,
      smkGoldAssay: 92.34,
      smkSilverAssay: 5.20,
      auContent: 910.00,
      agContent: 51.25,
      auContentTroyOz: 29.26,
      agContentTroyOz: 1.65,
      valueUSD: 75234.12
    },
    {
      barNo: 'SMK-241208-001',
      datePoured: '12/08/2024',
      dateShipped: '12/10/2025',
      doreWeight: 3302.60,
      smkGoldAssay: 96.10,
      smkSilverAssay: 2.80,
      auContent: 3173.80,
      agContent: 92.47,
      auContentTroyOz: 102.04,
      agContentTroyOz: 2.97,
      valueUSD: 262348.70
    }
  ],
  signatures: [
    { position: 'Production Manager', name: 'John Doe' },
    { position: 'Quality Control', name: 'Jane Smith' },
    { position: 'Security Officer', name: 'Bob Johnson' }
  ]
};

// Générer et télécharger
const pdf = freightInvoiceGenerationService.generateBullionSummary(testData);
freightInvoiceGenerationService.downloadPDF(pdf, 'test-bullion-summary.pdf');

console.log('PDF généré et téléchargé !');
```

Exécuter:
```bash
npx tsx test-pdf-generation.ts
```

Un fichier `test-bullion-summary.pdf` sera téléchargé dans votre navigateur.

### Méthode 2: Via l'Interface (une fois le bouton ajouté)

1. ✅ Créer une expédition dans Invoice & Consignment
2. ✅ Aller sur la page de détails de l'expédition
3. ✅ Cliquer sur "Générer les Documents"
4. ✅ Attendre la génération (quelques secondes)
5. ✅ Les documents apparaîtront dans la section "Documents Générés"
6. ✅ Cliquer sur l'œil pour visualiser
7. ✅ Cliquer sur le téléchargement pour sauvegarder

---

## Structure des Documents PDF

### Bullion Summary

**Format :** PDF Landscape (A4)
**Contenu :**
- Logo et titre "BULLION SUMMARY"
- Report Date et Shipment Number
- Tableau avec colonnes :
  - Bar No.
  - Date Poured
  - Date Shipped
  - Dore Weight (g)
  - SMK Gold Assay (%)
  - SMK Silver Assay (%)
  - Au Content (g)
  - Ag Content (g)
  - Au Content (troy oz)
  - Ag Content (troy oz)
  - Value USD
- Ligne de totaux avec moyennes
- Section signatures avec Position, Name, Signature

### Export Invoice (Customs)

**Format :** PDF Portrait (A4)
**Contenu :**
- Titre "INVOICE - POUR BESOINS DE LA DOUANE"
- Shipment Date et Invoice Number
- Logo central
- Section "From" (Expéditeur)
- Section "Shipped to" (Destinataire)
- Pays d'Origine et Mine
- Tableau principal :
  - AWB #
  - Lot #
  - # de Boîtes
  - Type de Boîtes
  - Description
  - Metal
  - Net Weight (kg)
  - Weight (Troy Oz)
  - Metal Price (CFA/kg)
  - Estimated Value (CFA)
- Informations de conversion
- Exchange Rate et totaux (CFA et USD)

---

## Données Requises pour Générer les Documents

### Pour Bullion Summary

```typescript
interface BullionSummaryData {
  reportDate: string;              // Date du rapport
  shipmentNumber: string;          // Numéro de référence
  bars: Array<{
    barNo: string;                 // Référence de la barre
    datePoured: string;            // Date de coulée
    dateShipped: string;           // Date d'expédition
    doreWeight: number;            // Poids brut en grammes
    smkGoldAssay: number;          // Finesse or (%)
    smkSilverAssay: number;        // Finesse argent (%)
    auContent: number;             // Contenu or pur (g)
    agContent: number;             // Contenu argent pur (g)
    auContentTroyOz: number;       // Contenu or (oz)
    agContentTroyOz: number;       // Contenu argent (oz)
    valueUSD: number;              // Valeur en USD
  }>;
  signatures: Array<{
    position: string;              // Poste
    name: string;                  // Nom complet
  }>;
}
```

### Pour Export Invoice

```typescript
interface ExportInvoiceData {
  shipmentDate: string;
  invoiceNumber: string;

  // Expéditeur
  senderName: string;
  senderAddress: string;
  senderCity: string;
  senderCountry: string;
  senderNIF: string;

  // Destinataire
  recipientName: string;
  recipientAddress: string;
  recipientCity: string;
  recipientCountry: string;
  recipientPhone: string;

  // Mine
  countryOfOrigin: string;
  mineName: string;

  // Détails expédition
  awbNumber: string;
  lotNumber: string;
  numberOfBoxes: number;
  boxType: string;
  description: string;

  // Métal
  metal: string;
  netWeightKg: number;
  weightTroyOz: number;
  metalPriceCFAPerKg: number;
  estimatedValueCFA: number;

  // Autres
  boxReferences: string;
  exchangeRateFCFAUSD: number;
  totalPriceCFA: number;
  totalPriceUSD: number;
}
```

---

## Checklist de Mise en Production

- [ ] Créer le bucket Supabase Storage `freight-documents`
- [ ] Configurer les RLS policies pour le bucket
- [ ] Créer le service `freightDocumentService.ts`
- [ ] Ajouter le bouton "Générer les Documents" dans FreightShipmentDetails
- [ ] Implémenter la génération automatique dans FreightShipmentCreate (optionnel)
- [ ] Tester la génération du Bullion Summary
- [ ] Tester la génération de l'Invoice
- [ ] Tester la visualisation des PDF
- [ ] Tester le téléchargement des PDF
- [ ] Vérifier que les paths sont bien sauvegardés dans la BDD
- [ ] Ajouter une gestion d'erreur robuste
- [ ] Ajouter des notifications de succès/erreur
- [ ] Documenter l'utilisation pour les utilisateurs finaux

---

## Conclusion

**Le système de génération de PDF est à 80% complet !**

✅ Le moteur de génération fonctionne
✅ L'interface d'affichage est prête
✅ La structure de BDD existe
❌ Il manque juste l'appel au service et l'upload

**Prochaine étape:** Implémenter le bouton de génération manuelle pour tester immédiatement.

Une fois validé, on pourra automatiser lors de la création.
