# ⚡ QUICK START - Assay Certificates

## 🎯 ÉTAPE 1: Appliquer la Migration

### Option A: Fichier SQL déjà préparé (FACILE!)

J'ai créé le fichier **`APPLY_ASSAY_MIGRATION_NOW.sql`** à la racine de votre projet.

**Instructions:**

1. Ouvrez le fichier `APPLY_ASSAY_MIGRATION_NOW.sql`
2. Copiez TOUT (Ctrl+A, Ctrl+C)
3. Allez dans **Supabase → SQL Editor**
4. Collez (Ctrl+V)
5. Cliquez **RUN**
6. Attendez 5-10 secondes
7. ✅ Terminé!

### Option B: Via le fichier original

Si vous préférez, le fichier original est dans:
```
supabase/migrations/20251104000000_create_assay_certificates_system.sql
```

Faites la même chose: copiez → collez dans SQL Editor → RUN

---

## 🎯 ÉTAPE 2: Vérifier que ça a fonctionné

Exécutez ce SQL dans **SQL Editor**:

```sql
SELECT table_name, COUNT(*) as columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('assay_certificates', 'assay_certificate_data')
GROUP BY table_name;
```

**Résultat attendu:**
- assay_certificates → 18
- assay_certificate_data → 35

---

## 🎯 ÉTAPE 3: Tester dans l'App

1. Refresh votre app (F5)
2. Login
3. Allez dans **Batches**
4. Cliquez sur n'importe quel batch
5. Scrollez vers le bas
6. Vous devriez voir **"Assay Certificates"**
7. Essayez d'**uploader un PDF**!

---

## ✅ C'EST TOUT!

Si vous voyez la section "Assay Certificates" et que vous pouvez uploader un PDF, **c'est bon!**

---

## ⚠️ Si ça ne marche pas

Envoyez-moi:
1. Le résultat du SQL de vérification (Étape 2)
2. Une capture d'écran de la page Batch Details
3. Les erreurs dans la console (F12 → Console)

Je vous aiderai à corriger!

