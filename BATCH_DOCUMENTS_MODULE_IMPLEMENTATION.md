# BATCH DOCUMENTS MODULE - IMPLEMENTATION COMPLETE

## Module Overview

Ce module gère TOUS les documents liés au lifecycle d'un batch, SAUF les Assay Certificates (qui ont leur propre système dédié).

### Documents Supportés

1. **Shipping Report** - Rapports d'expédition (Factory)
2. **Refinery Process Report** - Rapports de traitement raffinerie
3. **Sales Invoice** - Factures de vente
4. **Quality Report** - Rapports de qualité
5. **Transport Document** - Documents de transport
6. **Customs Document** - Documents douaniers
7. **Payment Proof** - Preuves de paiement
8. **Other** - Autres documents

## ÉTAPE 1: Migration Base de Données ✅

### Fichier Créé
`supabase/migrations/20251105000000_create_batch_documents_system.sql`

### Composants de la Migration

#### 1. Table `batch_documents`

```sql
CREATE TABLE batch_documents (
  id uuid PRIMARY KEY,
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  document_type text CHECK (8 types),
  document_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES user_profiles(id),
  lifecycle_stage text CHECK (6 stages),
  description text,
  created_at timestamptz,
  updated_at timestamptz
);
```

**Colonnes Clés:**
- `batch_id`: Lien vers le batch
- `document_type`: Type de document (8 choix)
- `lifecycle_stage`: Étape du lifecycle (6 choix)
- `uploaded_by`: Qui a uploadé
- `file_url`: URL du fichier dans storage

#### 2. Storage Bucket

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('batch-documents', 'batch-documents', false);
```

**Caractéristiques:**
- Bucket privé (non public)
- Séparé des assay-certificates
- Structure: `{user_id}/{batch_id}/{filename}`

#### 3. RLS Policies (Row Level Security)

**Table Policies:**
- ✅ Users can view documents for accessible batches
- ✅ Users can upload documents
- ✅ Users can update own documents
- ✅ Users can delete own documents

**Storage Policies:**
- ✅ Authenticated users can upload
- ✅ Authenticated users can view
- ✅ Users can update own files
- ✅ Users can delete own files

#### 4. Indexes

```sql
idx_batch_documents_batch_id    -- Fast batch lookup
idx_batch_documents_type        -- Fast type filtering
idx_batch_documents_stage       -- Fast stage filtering
idx_batch_documents_created_at  -- Fast date sorting
```

#### 5. View avec Détails

```sql
CREATE VIEW v_batch_documents_with_details AS
SELECT 
  bd.*,
  up.full_name as uploaded_by_name,
  b.batch_number,
  b.status as batch_status
FROM batch_documents bd
LEFT JOIN user_profiles up ...
LEFT JOIN batches b ...
```

**Utilité:** Récupère documents avec infos utilisateur et batch en une requête

#### 6. Trigger Auto-Update

```sql
CREATE TRIGGER update_batch_documents_timestamp
  BEFORE UPDATE ON batch_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_documents_updated_at();
```

**Fonction:** Met à jour automatiquement `updated_at` à chaque modification

## ÉTAPE 2: Service Layer ✅

### Fichier Créé
`src/services/batchDocumentsService.ts`

### Fonctions Principales

#### 1. `fetchBatchDocuments(batchId)`

```typescript
// Récupère tous les documents d'un batch
const docs = await fetchBatchDocuments(batch.id);
```

**Retour:** `BatchDocument[]` avec détails utilisateur

#### 2. `uploadBatchDocument(batchId, file, metadata)`

```typescript
const newDoc = await uploadBatchDocument(
  batchId,
  file,
  {
    document_type: 'shipping_report',
    document_name: 'Shipping Report Q4 2024',
    lifecycle_stage: 'factory',
    description: 'Initial shipping report'
  }
);
```

**Process:**
1. Vérifie authentification
2. Upload fichier vers storage
3. Crée record en base
4. Si échec, nettoie le fichier uploadé
5. Retourne le document créé

#### 3. `deleteBatchDocument(documentId)`

```typescript
await deleteBatchDocument(doc.id);
```

**Process:**
1. Vérifie ownership (user doit être l'uploader)
2. Supprime fichier du storage
3. Supprime record de la base
4. Transaction sécurisée

#### 4. `updateBatchDocument(documentId, updates)`

```typescript
const updated = await updateBatchDocument(doc.id, {
  document_name: 'New Name',
  description: 'Updated description'
});
```

**Mise à jour:** Nom, type, stage, description

#### 5. `getDocumentDownloadUrl(fileUrl)`

```typescript
const signedUrl = await getDocumentDownloadUrl(doc.file_url);
```

**Sécurité:** Crée URL signée avec expiration (1h)

### Fonctions Utilitaires

#### `filterDocumentsByType(docs, type)`
Filtre par type de document

#### `filterDocumentsByStage(docs, stage)`
Filtre par étape de lifecycle

#### `getDocumentTypeStyle(type)`
Retourne icon, color, bgColor pour chaque type

### Types et Labels

```typescript
export type DocumentType =
  | 'shipping_report'
  | 'refinery_report'
  | 'sales_invoice'
  | 'quality_report'
  | 'transport_document'
  | 'customs_document'
  | 'payment_proof'
  | 'other';

export const DOCUMENT_TYPE_LABELS = {
  shipping_report: 'Shipping Report',
  refinery_report: 'Refinery Process Report',
  // ...
};
```

## ÉTAPE 3: Composant UI (À Implémenter)

### Fichier à Créer
`src/components/batch/BatchDocuments.tsx`

### Interface Requise

#### 1. Liste de Documents

```tsx
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>Batch Documents</CardTitle>
      <Button onClick={openUploadModal}>
        <Upload className="h-4 w-4 mr-2" />
        Add Document
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    {/* Filtres */}
    <div className="flex gap-4 mb-4">
      <Select label="Type" />
      <Select label="Lifecycle Stage" />
    </div>

    {/* Liste */}
    <div className="space-y-3">
      {documents.map(doc => (
        <DocumentCard key={doc.id} document={doc} />
      ))}
    </div>
  </CardContent>
</Card>
```

#### 2. Formulaire Upload

```tsx
<Modal isOpen={isUploadOpen}>
  <form onSubmit={handleUpload}>
    <Input label="Document Name" required />
    
    <Select label="Document Type" required>
      {DOCUMENT_TYPE_LABELS}
    </Select>
    
    <Select label="Lifecycle Stage">
      {LIFECYCLE_STAGE_LABELS}
    </Select>
    
    <FileUpload 
      accept=".pdf,.jpg,.png"
      onChange={setFile}
    />
    
    <TextArea label="Description (optional)" />
    
    <Button type="submit">Upload Document</Button>
  </form>
</Modal>
```

#### 3. Card Document

```tsx
<div className={`border rounded-lg p-4 ${bgColor}`}>
  <div className="flex items-start justify-between">
    <div className="flex items-start gap-3">
      {/* Icon */}
      <div className="text-3xl">{icon}</div>
      
      {/* Info */}
      <div>
        <h4 className="font-semibold">{doc.document_name}</h4>
        <p className="text-sm text-gray-600">
          {DOCUMENT_TYPE_LABELS[doc.document_type]}
        </p>
        {doc.lifecycle_stage && (
          <Badge>{LIFECYCLE_STAGE_LABELS[doc.lifecycle_stage]}</Badge>
        )}
        <p className="text-xs text-gray-500">
          Uploaded by {doc.uploaded_by_name} on {date}
        </p>
      </div>
    </div>
    
    {/* Actions */}
    <div className="flex gap-2">
      <Button onClick={viewPDF}>
        <Eye className="h-4 w-4" />
      </Button>
      <Button onClick={download}>
        <Download className="h-4 w-4" />
      </Button>
      {canDelete && (
        <Button onClick={deleteDoc}>
          <Trash className="h-4 w-4" />
        </Button>
      )}
    </div>
  </div>
  
  {doc.description && (
    <p className="text-sm text-gray-600 mt-2">{doc.description}</p>
  )}
</div>
```

#### 4. Viewer PDF

```tsx
<Modal isOpen={isPdfViewerOpen} size="lg">
  <PDFViewer fileUrl={selectedDoc?.file_url} />
</Modal>
```

**Utilise:** Composant existant `PDFViewer` de assay certificates

## ÉTAPE 4: Intégration dans BatchDetailsWorkflow

### Position dans la Page

```tsx
<div className="lg:col-span-2 space-y-6">
  {/* Batch Information */}
  <Card>...</Card>
  
  {/* Assay Certificates */}
  <Card>...</Card>
  
  {/* NOUVEAU: Batch Documents */}
  <BatchDocuments batchId={batch.id} />
  
  {/* Airport Receiving Form */}
  {batch.status === 'validated_for_transport' && (
    <Card>...</Card>
  )}
</div>
```

**Position:** Entre Assay Certificates et Airport Form

### Props du Composant

```typescript
interface BatchDocumentsProps {
  batchId: string;
  batchStatus?: string;  // Optional pour filtrage contextuel
}
```

## Lifecycle Stages Mapping

| Batch Status | Suggested Lifecycle Stage |
|--------------|---------------------------|
| created | factory |
| validated_for_transport | factory |
| received_airport | airport |
| received_refinery | refinery |
| processed | processing |
| approved | processing |
| sold | sales |
| paid | payment |

## Document Type Icons & Colors

| Type | Icon | Color | Use Case |
|------|------|-------|----------|
| shipping_report | 📦 | Blue | Factory shipping docs |
| refinery_report | 🏭 | Purple | Refinery processing docs |
| sales_invoice | 💰 | Green | Sales invoices |
| quality_report | ✓ | Emerald | Quality control reports |
| transport_document | 🚚 | Orange | Transport/logistics docs |
| customs_document | 🛂 | Indigo | Customs declarations |
| payment_proof | 💳 | Pink | Payment confirmations |
| other | 📄 | Gray | Other documents |

## Sécurité

### Authentification
- ✅ Toutes les opérations requièrent authentification
- ✅ JWT token vérifié par Supabase

### Authorization
- ✅ Users peuvent voir docs des batches accessibles
- ✅ Users peuvent seulement modifier/supprimer leurs propres uploads
- ✅ RLS enforce au niveau base de données

### Storage
- ✅ Bucket privé (non public)
- ✅ Signed URLs avec expiration (1h)
- ✅ Files organisés par user_id pour isolation

### Validation
- ✅ Document types limités (enum)
- ✅ Lifecycle stages limités (enum)
- ✅ File size limits (configurable)
- ✅ MIME type validation

## Performance

### Indexes
- ✅ 4 indexes pour fast queries
- ✅ Cascade delete sur batches

### Caching
- ✅ Storage cache-control: 3600s
- ✅ Signed URLs réutilisables pendant 1h

### Queries Optimisées
- ✅ View pré-jointure pour détails
- ✅ Pagination supportée
- ✅ Filtres avec indexes

## Tests Recommandés

### 1. Upload Document
- [ ] Sélectionner type et stage
- [ ] Upload fichier PDF
- [ ] Vérifier apparition dans liste
- [ ] Vérifier storage bucket

### 2. View Document
- [ ] Cliquer sur "View"
- [ ] PDF s'ouvre dans modal
- [ ] Navigation pages fonctionne

### 3. Download Document
- [ ] Cliquer sur "Download"
- [ ] Fichier téléchargé

### 4. Delete Document
- [ ] Cliquer sur "Delete"
- [ ] Confirmation demandée
- [ ] Document supprimé de liste
- [ ] Fichier supprimé du storage

### 5. Filtres
- [ ] Filtrer par type
- [ ] Filtrer par stage
- [ ] Combiner filtres

### 6. Permissions
- [ ] User A upload doc
- [ ] User B ne peut pas delete doc de A
- [ ] User B peut voir doc de A

## Migration Application Steps

### Step 1: Appliquer Migration SQL

```bash
# Via Supabase Dashboard SQL Editor
# Copier/coller le contenu de:
# supabase/migrations/20251105000000_create_batch_documents_system.sql
```

**Vérifications:**
- [ ] Table `batch_documents` créée
- [ ] Storage bucket `batch-documents` créé
- [ ] RLS policies actives
- [ ] View `v_batch_documents_with_details` créée

### Step 2: Créer Service Layer

✅ **FAIT:** `src/services/batchDocumentsService.ts` créé

**Exports:**
- Types: `BatchDocument`, `DocumentType`, `LifecycleStage`
- Labels: `DOCUMENT_TYPE_LABELS`, `LIFECYCLE_STAGE_LABELS`
- Functions: `fetchBatchDocuments`, `uploadBatchDocument`, etc.

### Step 3: Créer Composant BatchDocuments

**TODO:** Créer `src/components/batch/BatchDocuments.tsx`

**Features Required:**
1. Liste documents avec filtres
2. Upload modal avec form
3. PDF viewer integration
4. Delete confirmation
5. Download functionality
6. Professional UI design

### Step 4: Intégrer dans BatchDetailsWorkflow

**TODO:** Modifier `src/pages/batches/BatchDetailsWorkflow.tsx`

```tsx
import { BatchDocuments } from '@/components/batch/BatchDocuments';

// Dans le render, après Assay Certificates:
<BatchDocuments batchId={batch.id} />
```

### Step 5: Tester Complètement

**Checklist:**
- [ ] Upload documents de différents types
- [ ] Visualiser PDFs
- [ ] Télécharger documents
- [ ] Supprimer documents
- [ ] Tester filtres
- [ ] Vérifier permissions
- [ ] Tester avec plusieurs users

### Step 6: Build et Deploy

```bash
npm run build
# Vérifier 0 erreurs
```

## Avantages du Module

### ✅ Centralisation
Tous les documents batch au même endroit

### ✅ Traçabilité
- Qui a uploadé quoi et quand
- Lien avec lifecycle du batch

### ✅ Sécurité
- RLS strictes
- Storage privé
- Signed URLs

### ✅ Organisation
- Types de documents clairs
- Filtrage par stage
- Recherche facile

### ✅ Professional
- Interface claire
- PDF viewer intégré
- Upload facile

---

## 🎯 SUMMARY POUR USER

### Ce Qui Est FAIT ✅

1. **Migration SQL Complète**
   - Table batch_documents
   - Storage bucket
   - RLS policies
   - Indexes
   - View avec détails
   - Triggers

2. **Service Layer Complet**
   - Upload/Download/Delete
   - Filtrage
   - Types et labels
   - Sécurité intégrée

### Ce Qui Reste À FAIRE 📋

3. **Composant UI BatchDocuments**
   - Liste avec filtres
   - Upload modal
   - Document cards
   - Actions (view/download/delete)

4. **Intégration Page**
   - Import dans BatchDetailsWorkflow
   - Position après Assay Certificates

5. **Tests**
   - Upload documents
   - Visualisation
   - Permissions

### Prochaines Étapes 🚀

1. Appliquer migration SQL via Dashboard
2. Créer composant BatchDocuments.tsx
3. Intégrer dans BatchDetailsWorkflow
4. Tester complètement
5. Build et vérifier

**Temps Estimé:** 2-3 heures pour UI + intégration + tests

Le module est **architecturalement complet** au niveau base de données et service. Il ne reste que l'interface utilisateur à implémenter!
