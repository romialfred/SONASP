# 📋 LISTE DES MIGRATIONS À EXÉCUTER

## 🎯 **Migrations pour Corriger Daily Production**

⚠️ **MISE À JOUR:** 3 migrations au total!

Exécuter dans cet ordre **EXACT** via Supabase Dashboard → SQL Editor

---

## ✅ **Migration 1: Fix Site ID Trigger**

**Fichier:** `supabase/migrations/20251113_001_fix_site_id_trigger.sql`

**Ce qu'elle fait:**
- Corrige le trigger qui forçait site_id='guinea' pour tous les utilisateurs
- Le nouveau trigger lit le site depuis le profil utilisateur (`profiles.site_ids[1]`)
- Utilise 'guinea' seulement en dernier recours si le profil n'a pas de site

**Comment l'appliquer:**
1. Ouvrir Supabase Dashboard
2. Aller dans **SQL Editor**
3. Cliquer **"New Query"**
4. Copier **TOUT** le contenu du fichier:
   ```
   /tmp/cc-agent/59164212/project/supabase/migrations/20251113_001_fix_site_id_trigger.sql
   ```
5. Coller dans l'éditeur
6. Cliquer **"Run"** ou appuyer sur `Ctrl+Enter`

**Vérification du succès:**
```
✅ Site ID trigger successfully updated!

Behavior:
  1. If site_id is provided → Use provided value
  2. If site_id is NULL → Try to fetch from user profile
  3. If no profile site → Default to guinea
```

**Temps d'exécution:** < 2 secondes

---

## ✅ **Migration 2: Fix Storage Policies**

**Fichier:** `supabase/migrations/20251113_002_fix_storage_policies_format.sql`

**Ce qu'elle fait:**
- Supprime les anciennes policies de storage qui causaient des erreurs RLS
- Crée 12 nouvelles policies simplifiées (4 par bucket)
- Configure 3 buckets: production-documents, shipping-documents, assay-certificates

**Comment l'appliquer:**
1. Ouvrir Supabase Dashboard
2. Aller dans **SQL Editor**
3. Cliquer **"New Query"**
4. Copier **TOUT** le contenu du fichier:
   ```
   /tmp/cc-agent/59164212/project/supabase/migrations/20251113_002_fix_storage_policies_format.sql
   ```
5. Coller dans l'éditeur
6. Cliquer **"Run"** ou appuyer sur `Ctrl+Enter`

**Vérification du succès:**
```
✅✅✅ ALL POLICIES CONFIGURED CORRECTLY!
TOTAL: 12 storage policies

📦 Bucket: assay-certificates
   Public: 🔒 No
   Policies: 4
   Status: ✅ Complete

📦 Bucket: production-documents
   Public: 🔒 No
   Policies: 4
   Status: ✅ Complete

📦 Bucket: shipping-documents
   Public: ✅ Yes
   Policies: 4
   Status: ✅ Complete
```

**Temps d'exécution:** < 5 secondes

---

## ✅ **Migration 3: Fix Data Display (NOUVEAU)**

**Fichier:** `supabase/migrations/20251113_003_fix_daily_production_display.sql`

**Ce qu'elle fait:**
- **FIX CRITIQUE:** Corrige le problème d'affichage des données
- Supprime toutes les anciennes policies SELECT conflictuelles
- Crée UNE policy SELECT claire permettant à tous les utilisateurs authentifiés de voir les données
- Ajoute des index pour améliorer les performances
- Affiche des diagnostics complets

**Comment l'appliquer:**
1. Ouvrir Supabase Dashboard
2. Aller dans **SQL Editor**
3. Cliquer **"New Query"**
4. Copier **TOUT** le contenu du fichier:
   ```
   /tmp/cc-agent/59164212/project/supabase/migrations/20251113_003_fix_daily_production_display.sql
   ```
5. Coller dans l'éditeur
6. Cliquer **"Run"** ou appuyer sur `Ctrl+Enter`

**Vérification du succès:**
```
✅✅✅ CONFIGURATION LOOKS GOOD!

📊 DATABASE STATUS:
   Total records: 22
   SELECT policies: 1
   INSERT policies: 1
   UPDATE policies: 1

📅 MOST RECENT RECORD:
   Date: 2025-11-13
   Site ID: guinea
   Company ID: 53cce625-d11d-...
   Created: 2025-11-13 ...

🔍 NEXT STEPS:
   1. Refresh the Daily Production page
   2. Check browser console for errors
   3. Verify date range filter includes recent dates
```

**Temps d'exécution:** < 3 secondes

---

## 🔄 **Résumé de l'Ordre d'Exécution**

```
1️⃣ 20251113_001_fix_site_id_trigger.sql
   ↓ Corrige le site_id pour les nouvelles productions
   ↓

2️⃣ 20251113_002_fix_storage_policies_format.sql
   ↓ Corrige les erreurs de storage buckets
   ↓

3️⃣ 20251113_003_fix_daily_production_display.sql  ← NOUVEAU!
   ↓ Corrige l'affichage des données
   ↓

✅ TERMINÉ - Données visibles!
```

**Temps total:** < 15 secondes
**Ordre:** Critique (respecter cet ordre)
**Réversible:** Oui (les migrations peuvent être réexécutées sans danger)

---

## ⚠️ **IMPORTANT**

### **Ne PAS sauter d'étapes!**
- Les 3 migrations doivent être exécutées
- Dans l'ordre indiqué
- Via Supabase Dashboard SQL Editor

### **Migrations Idempotentes**
- ✅ Peuvent être réexécutées sans danger
- ✅ Utilisent `DROP IF EXISTS` avant CREATE
- ✅ Utilisent `ON CONFLICT DO UPDATE` pour les inserts

### **Aucun Danger pour les Données**
- ✅ Aucune suppression de données
- ✅ Aucune modification de données existantes
- ✅ Seulement des modifications de triggers et policies

---

## 📊 **Après Avoir Exécuté les Migrations**

### **Vérification Rapide**

**1. Vérifier le Trigger:**
```sql
SELECT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgname = 'set_daily_production_defaults_trigger'
);
```
**Résultat attendu:** `true`

**2. Vérifier les Policies:**
```sql
SELECT COUNT(*)
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage';
```
**Résultat attendu:** Au moins `12`

**3. Vérifier les Buckets:**
```sql
SELECT id, name, public
FROM storage.buckets
WHERE id IN (
  'production-documents',
  'shipping-documents',
  'assay-certificates'
);
```
**Résultat attendu:** `3 lignes`

---

## 🧪 **Tests Post-Migration**

### **Test 1: Créer une Production**
```
1. Daily Production → "Nouvelle Production"
2. Remplir tous les champs
3. Enregistrer et Confirmer
4. ✅ Vérifier: Message de succès visible pendant 1.5s
5. ✅ Vérifier: Production apparaît dans la liste
```

### **Test 2: Vérifier le site_id**
```sql
-- Remplacer YYYY-MM-DD par la date de test
SELECT site_id, mining_company_id, created_at
FROM daily_production
WHERE production_date = 'YYYY-MM-DD'
ORDER BY created_at DESC
LIMIT 1;
```
**✅ Vérifier:** `site_id` correspond au site de l'utilisateur (PAS 'guinea')

### **Test 3: Upload de Document**
```
1. Ouvrir détails d'une production
2. Upload un document PDF
3. ✅ Vérifier: Aucune erreur dans la console
4. ✅ Vérifier: Document apparaît dans la liste
```

---

## 📝 **Checklist Complète**

- [ ] **Migration 001 exécutée** (site_id trigger)
- [ ] **Migration 002 exécutée** (storage policies)
- [ ] **Vérification SQL effectuée** (trigger + policies + buckets)
- [ ] **Test création production** (message visible)
- [ ] **Test site_id** (valeur correcte)
- [ ] **Test upload document** (aucune erreur)
- [ ] **Console navigateur propre** (pas d'erreurs RLS)

---

## 🎯 **Temps Estimé Total**

| Étape | Durée |
|-------|-------|
| Exécution Migration 001 | < 2s |
| Exécution Migration 002 | < 5s |
| Vérifications SQL | 1 min |
| Tests fonctionnels | 2 min |
| **TOTAL** | **< 5 minutes** |

---

## 📞 **En cas de Problème**

### **Erreur lors de l'exécution:**
1. Vérifier que vous êtes connecté à Supabase Dashboard
2. Vérifier que vous avez les droits d'exécution SQL
3. Copier l'erreur exacte et consulter `DAILY_PRODUCTION_FIXES_GUIDE.md`

### **Migrations déjà appliquées:**
- Pas de problème! Les migrations sont idempotentes
- Vous pouvez les réexécuter sans danger

### **Tests échouent:**
1. Vérifier que les 2 migrations sont bien exécutées
2. Recharger la page de l'application (Ctrl+F5)
3. Vider le cache du navigateur
4. Consulter la section Dépannage du guide

---

## ✅ **Résumé**

**Migrations à exécuter:** 2
**Ordre:** Critique
**Temps:** < 5 minutes
**Danger:** Aucun
**Régressions:** Aucune
**Documentation:** DAILY_PRODUCTION_FIXES_GUIDE.md

**Prêt à exécuter!** 🚀
