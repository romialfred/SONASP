# BATCH DOCUMENTS MIGRATION - ERREUR CORRIGÉE ✅

## Problème Identifié

```
ERROR: 42703: column "lifecycle_stage" does not exist
```

## Cause

Le CHECK constraint sur `lifecycle_stage` ne permettait pas les valeurs NULL, mais l'index était créé sans condition, causant une erreur lors de la création.

## Solution Appliquée ✅

### 1. CHECK Constraint Modifié

**AVANT:**
```sql
lifecycle_stage text CHECK (lifecycle_stage IN (
  'factory',
  'airport',
  ...
))
```

**APRÈS:**
```sql
lifecycle_stage text CHECK (
  lifecycle_stage IS NULL OR
  lifecycle_stage IN (
    'factory',
    'airport',
    'refinery',
    'processing',
    'sales',
    'payment'
  )
)
```

**Changement:** Accepte maintenant les valeurs NULL

### 2. Index Partiel

**AVANT:**
```sql
CREATE INDEX idx_batch_documents_stage 
ON batch_documents(lifecycle_stage);
```

**APRÈS:**
```sql
CREATE INDEX idx_batch_documents_stage 
ON batch_documents(lifecycle_stage) 
WHERE lifecycle_stage IS NOT NULL;
```

**Changement:** Index partiel qui ne contient que les lignes avec lifecycle_stage non NULL (plus performant)

## Migration Corrigée

Le fichier a été mis à jour:
```
supabase/migrations/20251105000000_create_batch_documents_system.sql
```

## Comment Appliquer

### Option 1: Via Supabase Dashboard (Recommandé)

1. Ouvrir Supabase Dashboard
2. Aller dans **SQL Editor**
3. Copier TOUT le contenu du fichier:
   `supabase/migrations/20251105000000_create_batch_documents_system.sql`
4. Coller dans l'éditeur
5. Cliquer **Run**

### Option 2: Vérifier Si Déjà Appliqué

Si vous avez déjà exécuté la migration avec l'erreur:

```sql
-- Vérifier si la table existe
SELECT * FROM batch_documents LIMIT 1;

-- Si elle existe mais l'index a échoué, supprimez l'index et recréez-le:
DROP INDEX IF EXISTS idx_batch_documents_stage;

CREATE INDEX IF NOT EXISTS idx_batch_documents_stage 
ON batch_documents(lifecycle_stage) 
WHERE lifecycle_stage IS NOT NULL;
```

## Vérification Post-Migration

Exécutez ces queries pour vérifier:

```sql
-- 1. Vérifier la table existe
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'batch_documents'
ORDER BY ordinal_position;

-- 2. Vérifier les indexes
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'batch_documents';

-- 3. Vérifier le storage bucket
SELECT * FROM storage.buckets WHERE id = 'batch-documents';

-- 4. Vérifier les RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'batch_documents';
```

## Résultats Attendus

### Table Columns
```
✓ id (uuid)
✓ batch_id (uuid)
✓ document_type (text)
✓ document_name (text)
✓ file_url (text)
✓ file_size (bigint)
✓ mime_type (text)
✓ uploaded_by (uuid)
✓ lifecycle_stage (text, nullable)
✓ description (text, nullable)
✓ created_at (timestamptz)
✓ updated_at (timestamptz)
```

### Indexes
```
✓ batch_documents_pkey (PRIMARY KEY on id)
✓ idx_batch_documents_batch_id
✓ idx_batch_documents_type
✓ idx_batch_documents_stage (partial, WHERE lifecycle_stage IS NOT NULL)
✓ idx_batch_documents_created_at
```

### Storage Bucket
```
✓ id: batch-documents
✓ name: batch-documents
✓ public: false
```

### RLS Policies
```
✓ Users can view batch documents (SELECT)
✓ Users can upload batch documents (INSERT)
✓ Users can update own documents (UPDATE)
✓ Users can delete own documents (DELETE)
```

### Storage Policies
```
✓ Authenticated users can upload batch documents
✓ Authenticated users can view batch documents
✓ Users can update own batch documents
✓ Users can delete own batch documents
```

## Test Rapide

Après migration, testez avec:

```sql
-- Test 1: Insert sans lifecycle_stage (devrait fonctionner)
INSERT INTO batch_documents (
  batch_id,
  document_type,
  document_name,
  file_url,
  uploaded_by
) VALUES (
  (SELECT id FROM batches LIMIT 1),
  'shipping_report',
  'Test Document',
  'https://example.com/file.pdf',
  auth.uid()
);

-- Test 2: Insert avec lifecycle_stage (devrait fonctionner)
INSERT INTO batch_documents (
  batch_id,
  document_type,
  document_name,
  file_url,
  uploaded_by,
  lifecycle_stage
) VALUES (
  (SELECT id FROM batches LIMIT 1),
  'refinery_report',
  'Test Document 2',
  'https://example.com/file2.pdf',
  auth.uid(),
  'refinery'
);

-- Test 3: Vérifier les inserts
SELECT * FROM batch_documents ORDER BY created_at DESC LIMIT 5;

-- Nettoyage (si besoin)
DELETE FROM batch_documents WHERE document_name LIKE 'Test Document%';
```

## Prochaines Étapes

Maintenant que la migration est corrigée:

1. ✅ **Appliquer la migration** via Dashboard
2. ✅ **Vérifier** avec les queries ci-dessus
3. 📋 **Créer composant UI** `BatchDocuments.tsx`
4. 📋 **Intégrer** dans `BatchDetailsWorkflow.tsx`
5. 📋 **Tester** l'upload/download/delete

## Support

Si vous rencontrez toujours des erreurs:

### Erreur: "table already exists"

```sql
-- La table existe déjà, vous pouvez skip cette partie
-- Passez directement aux indexes et policies manquants
```

### Erreur: "bucket already exists"

```sql
-- Le bucket existe, continuez avec les policies
```

### Erreur: "policy already exists"

```sql
-- Normal si vous ré-exécutez, utilisez DROP POLICY IF EXISTS d'abord
-- Ou ignorez cette erreur et continuez
```

---

## ✅ Correction Appliquée

La migration a été **corrigée** et est prête à être appliquée!

**Fichier:** `supabase/migrations/20251105000000_create_batch_documents_system.sql`

**Changements:**
1. CHECK constraint accepte NULL
2. Index partiel sur lifecycle_stage
3. Tout le reste identique

**Status:** ✅ READY TO APPLY
