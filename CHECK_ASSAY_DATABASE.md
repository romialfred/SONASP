# 🔍 DIAGNOSTIC COMPLET - Assay Certificates

## 📋 SQL à Exécuter dans Supabase

Copiez et exécutez ce SQL dans votre **SQL Editor** Supabase:

```sql
-- 1. Check if assay_certificates table exists
SELECT 
  'assay_certificates' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'assay_certificates'
UNION ALL
SELECT 
  'assay_certificate_data' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'assay_certificate_data';

-- 2. Check RLS policies on assay_certificates table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('assay_certificates', 'assay_certificate_data')
ORDER BY tablename, policyname;

-- 3. Check storage buckets
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets
WHERE name IN ('assay-certificates', 'documents', 'payment-proofs', 'reports')
ORDER BY name;

-- 4. Check storage policies
SELECT 
  id,
  name,
  bucket_id,
  definition
FROM storage.policies
WHERE bucket_id IN (
  SELECT id FROM storage.buckets 
  WHERE name = 'assay-certificates'
)
ORDER BY name;
```

---

## 🎯 CE QU'ON CHERCHE

### ✅ Si tout est OK, vous devriez voir:

1. **Tables existantes:**
   - `assay_certificates` avec ~25+ colonnes
   - `assay_certificate_data` avec ~45+ colonnes

2. **Buckets storage:**
   - `assay-certificates` (public = false)
   - `documents` (public = false)

3. **Storage policies pour assay-certificates:**
   - Au moins 1 policy pour permettre INSERT/SELECT/UPDATE/DELETE

4. **RLS policies sur les tables:**
   - Policies pour `authenticated` users

---

## ❌ SI QUELQUE CHOSE MANQUE

### Cas 1: Tables n'existent pas
→ La migration n'a pas été appliquée
→ Solution: Appliquer la migration

### Cas 2: Buckets n'existent pas
→ Les buckets n'ont pas été créés
→ Solution: Créer les buckets manuellement

### Cas 3: Storage policies manquantes
→ Les policies de storage n'ont pas été créées
→ Solution: Créer les policies manuellement

---

## 📊 ENVOYEZ-MOI LES RÉSULTATS

Une fois que vous avez exécuté le SQL:
1. Prenez un screenshot des résultats
2. OU copiez-collez les résultats ici

Je vous dirai exactement ce qui manque et comment le corriger!

