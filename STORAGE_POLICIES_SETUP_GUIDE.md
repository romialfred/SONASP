# 📦 Guide de Configuration des Storage Policies

## 🎯 Problème Résolu

Lorsque vous voyez **"0 policies"** dans un bucket Supabase Storage, cela signifie que les policies RLS (Row Level Security) ne sont pas configurées. Sans policies, le bucket est **complètement inaccessible**, même pour les utilisateurs authentifiés.

## ✅ Solution: Migrations SQL

### 📋 Migrations Disponibles

#### **1. Migration 20251112_016** (Production Documents uniquement)
```bash
supabase/migrations/20251112_016_setup_production_documents_storage_policies.sql
```
Configure uniquement le bucket `production-documents`.

#### **2. Migration 20251112_017** (TOUS les buckets) ⭐ **RECOMMANDÉ**
```bash
supabase/migrations/20251112_017_setup_all_storage_buckets_policies.sql
```
Configure **3 buckets** avec leurs policies:
- ✅ `production-documents` (Privé)
- ✅ `shipping-documents` (Public pour visualisation)
- ✅ `assay-certificates` (Privé)

---

## 🚀 Application des Migrations

### Méthode 1: Via Supabase Dashboard (Recommandé)

1. **Ouvrez votre Dashboard Supabase**
   ```
   https://app.supabase.com/project/[votre-project-id]
   ```

2. **Allez dans SQL Editor**
   - Menu latéral → **SQL Editor**
   - Ou directement: `/project/[project-id]/sql`

3. **Créez une nouvelle query**
   - Cliquez sur **"New Query"**

4. **Copiez le contenu de la migration**
   - Ouvrez: `supabase/migrations/20251112_017_setup_all_storage_buckets_policies.sql`
   - Copiez **TOUT le contenu**
   - Collez dans l'éditeur SQL

5. **Exécutez la migration**
   - Cliquez sur **"Run"** (ou `Ctrl+Enter`)
   - Attendez la confirmation ✅

6. **Vérifiez les résultats**
   - La console devrait afficher:
     ```
     ✅✅✅ ALL POLICIES SUCCESSFULLY CREATED!
     TOTAL: 12 storage policies created
     ```

---

### Méthode 2: Via Supabase CLI

Si vous utilisez la CLI Supabase locale:

```bash
# 1. Vérifiez que la CLI est installée
supabase --version

# 2. Appliquez la migration
supabase db push

# Ou appliquez une migration spécifique
supabase db reset
```

---

## ✅ Vérification

### 1. Via Dashboard

**Pour chaque bucket:**

1. Allez dans **Storage**
2. Sélectionnez le bucket (`production-documents`, `shipping-documents`, ou `assay-certificates`)
3. Cliquez sur l'onglet **"Policies"**
4. Vous devriez voir **4 policies**:
   - ✅ SELECT (View)
   - ✅ INSERT (Upload)
   - ✅ UPDATE (Modify)
   - ✅ DELETE (Remove)

### 2. Via SQL Query

Exécutez cette query dans SQL Editor:

```sql
SELECT
  policyname,
  CASE
    WHEN policyname LIKE 'Production:%' THEN 'production-documents'
    WHEN policyname LIKE 'Shipping:%' THEN 'shipping-documents'
    WHEN policyname LIKE 'Assay:%' THEN 'assay-certificates'
  END as bucket,
  cmd as operation
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND (
    policyname LIKE 'Production:%' OR
    policyname LIKE 'Shipping:%' OR
    policyname LIKE 'Assay:%'
  )
ORDER BY bucket, operation;
```

**Résultat attendu:** 12 lignes (4 policies × 3 buckets)

---

## 📋 Détails des Policies Créées

### 🔹 Production Documents (Privé)

| Policy Name | Operation | Description |
|-------------|-----------|-------------|
| `Production: View all docs` | SELECT | Tous les users authentifiés peuvent voir |
| `Production: Upload own docs` | INSERT | Upload dans son propre dossier |
| `Production: Update own docs` | UPDATE | Modifier ses propres fichiers |
| `Production: Delete own docs` | DELETE | Supprimer ses propres fichiers |

### 🔹 Shipping Documents (Public viewing)

| Policy Name | Operation | Description |
|-------------|-----------|-------------|
| `Shipping: View all docs` | SELECT | Tous les users authentifiés peuvent voir |
| `Shipping: Upload own docs` | INSERT | Upload dans son propre dossier |
| `Shipping: Update own docs` | UPDATE | Modifier ses propres fichiers |
| `Shipping: Delete own docs` | DELETE | Supprimer ses propres fichiers |

### 🔹 Assay Certificates (Privé)

| Policy Name | Operation | Description |
|-------------|-----------|-------------|
| `Assay: View all certificates` | SELECT | Tous les users authentifiés peuvent voir |
| `Assay: Upload own certificates` | INSERT | Upload dans son propre dossier |
| `Assay: Update own certificates` | UPDATE | Modifier ses propres fichiers |
| `Assay: Delete own certificates` | DELETE | Supprimer ses propres fichiers |

---

## 🔐 Modèle de Sécurité

### Structure des Fichiers

```
bucket-name/
├── {user-id-1}/
│   ├── document1.pdf
│   └── document2.png
├── {user-id-2}/
│   └── document3.pdf
└── {user-id-3}/
    └── certificate.pdf
```

### Règles d'Accès

**Lecture (SELECT):**
- ✅ Tous les utilisateurs authentifiés peuvent voir **tous les fichiers**
- 📝 Permet la collaboration et le partage

**Écriture (INSERT/UPDATE/DELETE):**
- ✅ Les utilisateurs ne peuvent modifier que **leurs propres fichiers**
- ✅ Vérification via: `(storage.foldername(name))[1] = auth.uid()::text`
- ❌ Impossible de modifier les fichiers d'autres utilisateurs

---

## 🐛 Dépannage

### Problème: "0 policies" après migration

**Solutions:**

1. **Vérifiez que la migration s'est exécutée sans erreur**
   ```sql
   -- Vérifiez les buckets
   SELECT * FROM storage.buckets
   WHERE id IN ('production-documents', 'shipping-documents', 'assay-certificates');
   ```

2. **Vérifiez les policies dans pg_policies**
   ```sql
   SELECT COUNT(*)
   FROM pg_policies
   WHERE tablename = 'objects' AND schemaname = 'storage';
   ```

3. **Réexécutez la migration**
   - La migration utilise `DROP POLICY IF EXISTS`
   - Vous pouvez la réexécuter sans risque

### Problème: Erreur "policy already exists"

**Solution:**
La migration gère automatiquement ce cas avec `DROP POLICY IF EXISTS`. Si l'erreur persiste:

```sql
-- Supprimez manuellement les policies existantes
DROP POLICY IF EXISTS "Production: View all docs" ON storage.objects;
DROP POLICY IF EXISTS "Production: Upload own docs" ON storage.objects;
-- ... etc pour toutes les policies

-- Puis réexécutez la migration
```

### Problème: "Permission denied" lors de l'upload

**Causes possibles:**
1. L'utilisateur n'est pas authentifié
2. Le chemin du fichier ne commence pas par `{user_id}/`
3. Les policies ne sont pas appliquées

**Solution:**
```typescript
// ✅ Correct - chemin avec user_id
const filePath = `${userId}/document.pdf`;

// ❌ Incorrect - chemin sans user_id
const filePath = `document.pdf`;
```

---

## 📊 Limites de Configuration

### Tailles de Fichiers
- **Maximum par fichier:** 50 MB
- Configurable dans la migration

### Types MIME Autorisés

**Production & Shipping Documents:**
- `application/pdf`
- `image/png`
- `image/jpeg`
- `image/jpg`
- `application/msword`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

**Assay Certificates:**
- `application/pdf`
- `image/png`
- `image/jpeg`
- `image/jpg`

---

## 🎯 Checklist Finale

Après avoir appliqué la migration, vérifiez:

- [ ] **3 buckets créés** (production-documents, shipping-documents, assay-certificates)
- [ ] **12 policies créées** (4 par bucket)
- [ ] **Onglet "Policies" affiche 4 policies** pour chaque bucket
- [ ] **Upload test réussi** pour un utilisateur authentifié
- [ ] **Download test réussi** pour un utilisateur authentifié
- [ ] **Test de sécurité:** Utilisateur ne peut pas modifier les fichiers d'un autre user

---

## 📚 Ressources

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Row Level Security Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Policies Guide](https://supabase.com/docs/guides/storage/security/access-control)

---

## ✅ Résumé

**Migration Recommandée:**
```bash
supabase/migrations/20251112_017_setup_all_storage_buckets_policies.sql
```

**Résultat Attendu:**
- ✅ 3 buckets configurés
- ✅ 12 policies créées (4 par bucket)
- ✅ Sécurité RLS activée
- ✅ Prêt pour l'utilisation en production

**Temps d'Exécution:** < 5 secondes

**Aucune Action Manuelle Requise!** 🎉
