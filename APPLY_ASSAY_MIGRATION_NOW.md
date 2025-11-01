# 🚀 MIGRATION À APPLIQUER - Assay Certificates System

## 📌 FICHIER À MIGRER

**UN SEUL fichier:**

```
supabase/migrations/20251104000000_create_assay_certificates_system.sql
```

---

## 🎯 MÉTHODE 1: Via Supabase Dashboard (RECOMMANDÉ)

### Étapes:

1. **Ouvrez le fichier** sur votre machine:
   ```
   supabase/migrations/20251104000000_create_assay_certificates_system.sql
   ```

2. **Copiez TOUT le contenu** du fichier (Ctrl+A, Ctrl+C)

3. **Allez dans Supabase Dashboard:**
   - Cliquez sur **SQL Editor** (dans la sidebar gauche)
   - Cliquez sur **New Query**

4. **Collez le contenu** (Ctrl+V)

5. **Cliquez sur RUN** (en haut à droite)

6. **Attendez** que l'exécution se termine (environ 5-10 secondes)

7. **Vérifiez** qu'il n'y a pas d'erreurs

---

## ✅ CE QUE CETTE MIGRATION VA CRÉER

### Tables:
- ✅ `assay_certificates` (18 colonnes)
- ✅ `assay_certificate_data` (35 colonnes)
- ✅ `certificate_approvals` (7 colonnes)

### Storage:
- ✅ Bucket `assay-certificates`
- ✅ 4 policies storage (INSERT, SELECT, UPDATE, DELETE)

### Security:
- ✅ RLS activé sur toutes les tables
- ✅ 7 policies RLS pour les tables
- ✅ Triggers pour `updated_at`

### Fonctions:
- ✅ `get_certificate_with_data()`
- ✅ `get_batch_certificates()`

---

## 🔍 VÉRIFICATION APRÈS MIGRATION

Une fois la migration appliquée, exécutez ce SQL pour vérifier:

```sql
-- Vérifier les tables
SELECT table_name, COUNT(*) as columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('assay_certificates', 'assay_certificate_data', 'certificate_approvals')
GROUP BY table_name;

-- Devrait retourner:
-- assay_certificates → 18
-- assay_certificate_data → 35
-- certificate_approvals → 7
```

---

## 📋 APRÈS LA MIGRATION

1. ✅ Refresh votre app (F5)
2. ✅ Login
3. ✅ Allez dans un Batch Details
4. ✅ Scrollez vers le bas
5. ✅ Vous devriez voir **"Assay Certificates"**
6. ✅ Essayez d'uploader un PDF!

---

## ⚠️ SI VOUS AVEZ DES ERREURS

### Erreur: "already exists"
→ La migration a déjà été appliquée! Pas besoin de la réappliquer.

### Erreur: "permission denied"
→ Assurez-vous d'être connecté avec un compte admin.

### Erreur: "bucket already exists"
→ Normal! Le bucket existe déjà, la migration continue quand même.

---

## 🎯 EN RÉSUMÉ

**1 fichier à migrer:**
- `supabase/migrations/20251104000000_create_assay_certificates_system.sql`

**Méthode:**
- Copier-coller dans SQL Editor
- Cliquer RUN
- Attendre 5-10 secondes
- C'est fait!

**Ensuite:**
- Refresh l'app
- Tester l'upload!

