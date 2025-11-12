# Configuration des Storage Policies - Production Documents

## ⚠️ Problème Commun: Bucket sans Policies

Si votre bucket `production-documents` montre **0 policies**, les utilisateurs ne pourront **PAS** uploader, voir ou supprimer de fichiers, même authentifiés!

### Symptômes
- ❌ Upload échoue avec erreur "Unauthorized"
- ❌ Impossible de voir les documents uploadés
- ❌ Erreur 401/403 dans la console

### Cause
Les policies SQL créées par `add_production_documents.sql` concernent la **table** `production_documents`, mais **PAS le bucket Storage**.

## 🔧 Solution Rapide (SQL)

Exécutez ce script dans **Supabase SQL Editor**:

```sql
-- ========================================
-- STORAGE POLICIES pour production-documents
-- ========================================

-- 1. Policy SELECT: Voir/Télécharger les fichiers
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Authenticated users can view production documents',
  'production-documents',
  'SELECT',
  '(auth.role() = ''authenticated'')'
)
ON CONFLICT (bucket_id, name) DO UPDATE SET
  operation = EXCLUDED.operation,
  definition = EXCLUDED.definition;

-- 2. Policy INSERT: Upload des fichiers
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Authenticated users can upload production documents',
  'production-documents',
  'INSERT',
  '(auth.role() = ''authenticated'')'
)
ON CONFLICT (bucket_id, name) DO UPDATE SET
  operation = EXCLUDED.operation,
  definition = EXCLUDED.definition;

-- 3. Policy UPDATE: Modifier les métadonnées (optionnel)
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Authenticated users can update production documents',
  'production-documents',
  'UPDATE',
  '(auth.role() = ''authenticated'')'
)
ON CONFLICT (bucket_id, name) DO UPDATE SET
  operation = EXCLUDED.operation,
  definition = EXCLUDED.definition;

-- 4. Policy DELETE: Supprimer les fichiers
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Authenticated users can delete production documents',
  'production-documents',
  'DELETE',
  '(auth.role() = ''authenticated'')'
)
ON CONFLICT (bucket_id, name) DO UPDATE SET
  operation = EXCLUDED.operation,
  definition = EXCLUDED.definition;

-- ========================================
-- VÉRIFICATION
-- ========================================

SELECT
  name,
  operation,
  definition,
  CASE
    WHEN definition LIKE '%authenticated%' THEN '✅ Utilisateurs authentifiés'
    ELSE '❌ Configuration à vérifier'
  END as access_level
FROM storage.policies
WHERE bucket_id = 'production-documents'
ORDER BY operation;
```

### Résultat Attendu

```
name                                              | operation | definition                        | access_level
--------------------------------------------------|-----------|-----------------------------------|---------------------------
Authenticated users can delete production doc...  | DELETE    | (auth.role() = 'authenticated')  | ✅ Utilisateurs authentifiés
Authenticated users can upload production doc...  | INSERT    | (auth.role() = 'authenticated')  | ✅ Utilisateurs authentifiés
Authenticated users can view production docum...  | SELECT    | (auth.role() = 'authenticated')  | ✅ Utilisateurs authentifiés
Authenticated users can update production doc...  | UPDATE    | (auth.role() = 'authenticated')  | ✅ Utilisateurs authentifiés

(4 rows)
```

## 🖱️ Solution via Interface Supabase

### Étape 1: Accéder aux Policies
1. **Storage** → Cliquer sur `production-documents`
2. **Policies** (dans le menu du bucket)
3. Cliquer **"New Policy"**

### Étape 2: Créer Policy SELECT

```
Policy Name: Authenticated users can view production documents
Allowed operation: SELECT
Target roles: authenticated

Policy definition (USING):
auth.role() = 'authenticated'
```

Cliquer **"Save policy"**

### Étape 3: Créer Policy INSERT

```
Policy Name: Authenticated users can upload production documents
Allowed operation: INSERT
Target roles: authenticated

Policy definition (WITH CHECK):
auth.role() = 'authenticated'
```

Cliquer **"Save policy"**

### Étape 4: Créer Policy DELETE

```
Policy Name: Authenticated users can delete production documents
Allowed operation: DELETE
Target roles: authenticated

Policy definition (USING):
auth.role() = 'authenticated'
```

Cliquer **"Save policy"**

### Étape 5: Créer Policy UPDATE (Optionnel)

```
Policy Name: Authenticated users can update production documents
Allowed operation: UPDATE
Target roles: authenticated

Policy definition (USING):
auth.role() = 'authenticated'
```

Cliquer **"Save policy"**

## 🔒 Policies Plus Restrictives (Avancé)

Si vous voulez que les utilisateurs ne voient que **leurs propres** documents:

### Policy SELECT (Restrictive)

```sql
-- L'utilisateur doit être le uploader du document
(storage.foldername(name))[1] IN (
  SELECT production_id::text
  FROM production_documents
  WHERE uploaded_by = auth.uid()
)
```

### Policy DELETE (Restrictive)

```sql
-- Seul l'uploader peut supprimer
(storage.foldername(name))[1] IN (
  SELECT production_id::text
  FROM production_documents
  WHERE uploaded_by = auth.uid()
)
```

## 📊 Comparaison des Configurations

| Configuration | Avantages | Inconvénients | Recommandation |
|---------------|-----------|---------------|----------------|
| **Permissive** (auth.role()) | Simple, tous peuvent voir/modifier | Moins sécurisé | ✅ Pour commencer |
| **Restrictive** (uploaded_by) | Très sécurisé, isolation par user | Plus complexe | ⚠️ Pour production |
| **Basé sur rôles** | Granularité fine | Nécessite table roles | 🔧 Avancé |

## 🧪 Tests après Configuration

### Test 1: Vérifier le Nombre de Policies

**Interface Supabase:**
```
production-documents    4    10 MB    application/pdf
                        ↑
                   Doit montrer 4
```

**SQL:**
```sql
SELECT COUNT(*) as policy_count
FROM storage.policies
WHERE bucket_id = 'production-documents';
```

**Attendu:** `policy_count = 4`

### Test 2: Test d'Upload

1. Aller sur une production
2. Cliquer "Ajouter" document
3. Sélectionner PDF < 10MB
4. Upload

**Avec 0 policies:** ❌ Erreur 401 Unauthorized
**Avec 4 policies:** ✅ Upload réussi

### Test 3: Test de Visualisation

1. Cliquer sur l'icône œil d'un document
2. Le PDF doit s'ouvrir dans un nouvel onglet

**Avec 0 policies:** ❌ Erreur 403 Forbidden
**Avec 4 policies:** ✅ PDF s'affiche

### Test 4: Test de Suppression

1. Cliquer sur l'icône poubelle
2. Confirmer la suppression

**Avec 0 policies:** ❌ Erreur dans console
**Avec 4 policies:** ✅ Document supprimé

## 🔍 Diagnostic en Cas de Problème

### Erreur: "Unauthorized" lors de l'upload

**Vérification:**
```sql
-- Vérifier la policy INSERT
SELECT * FROM storage.policies
WHERE bucket_id = 'production-documents'
AND operation = 'INSERT';
```

**Si vide:** Policy INSERT manquante, exécuter le script SQL ci-dessus.

### Erreur: "Forbidden" lors de la visualisation

**Vérification:**
```sql
-- Vérifier la policy SELECT
SELECT * FROM storage.policies
WHERE bucket_id = 'production-documents'
AND operation = 'SELECT';
```

**Si vide:** Policy SELECT manquante, exécuter le script SQL ci-dessus.

### Erreur: Ne peut pas supprimer

**Vérification:**
```sql
-- Vérifier la policy DELETE
SELECT * FROM storage.policies
WHERE bucket_id = 'production-documents'
AND operation = 'DELETE';
```

**Si vide:** Policy DELETE manquante, exécuter le script SQL ci-dessus.

## 📋 Checklist de Vérification

Après configuration, vérifier:

- [ ] Bucket `production-documents` existe
- [ ] POLICIES montre **4** (pas 0)
- [ ] FILE SIZE LIMIT: 10 MB
- [ ] ALLOWED MIME TYPES: application/pdf
- [ ] Test upload réussi ✅
- [ ] Test visualisation réussi ✅
- [ ] Test suppression réussi ✅
- [ ] Pas d'erreur 401/403 dans console

## 🎯 Configuration Finale Recommandée

### Pour Environnement de Développement/Test
```sql
-- Policies permissives (auth.role() = 'authenticated')
-- Tous les utilisateurs authentifiés ont accès complet
```

### Pour Environnement de Production
```sql
-- Policies restrictives basées sur uploaded_by
-- Chaque utilisateur voit uniquement ses propres documents
```

## 🚀 Script Complet de Vérification

```sql
-- ========================================
-- DIAGNOSTIC COMPLET
-- ========================================

-- 1. Vérifier que le bucket existe
SELECT
  id,
  name,
  public,
  file_size_limit / 1024 / 1024 as size_limit_mb,
  allowed_mime_types
FROM storage.buckets
WHERE name = 'production-documents';

-- 2. Compter les policies
SELECT
  bucket_id,
  COUNT(*) as policy_count,
  string_agg(operation, ', ') as operations
FROM storage.policies
WHERE bucket_id = 'production-documents'
GROUP BY bucket_id;

-- 3. Détail des policies
SELECT
  name,
  operation,
  definition,
  check_definition
FROM storage.policies
WHERE bucket_id = 'production-documents'
ORDER BY operation;

-- 4. Vérifier les fichiers existants
SELECT
  COUNT(*) as file_count,
  SUM(size) / 1024 / 1024 as total_size_mb
FROM storage.objects
WHERE bucket_id = 'production-documents';
```

## 💡 Résumé

**Différence Critique:**
- **Table policies** (production_documents) → Contrôle l'accès aux DONNÉES dans PostgreSQL
- **Storage policies** (bucket) → Contrôle l'accès aux FICHIERS dans Storage

**Les deux sont nécessaires!**

✅ **Solution:** Exécuter le script SQL fourni ci-dessus pour créer les 4 storage policies.

**Après configuration, le bucket doit montrer:** `POLICIES: 4` ✅
