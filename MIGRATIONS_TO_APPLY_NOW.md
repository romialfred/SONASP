# Migrations à Appliquer - Production Journalière

## 🚨 Migration SQL Requise

### 1. Migration à Exécuter

**Fichier:** `supabase/migrations/20251112_014_fix_daily_production_insert.sql`

**Via Supabase Dashboard:**
1. Ouvrir: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. Menu → **SQL Editor**
3. **New Query**
4. Copier-coller le contenu du fichier `20251112_014_fix_daily_production_insert.sql`
5. Cliquer sur **Run**

**Ou via CLI:**
```bash
# Si vous avez Supabase CLI installé
supabase db push
```

---

## ⚠️ Configuration Manuelle Storage Bucket

### 2. Configuration Storage Policies (MANUEL)

**Dashboard Supabase:**
1. **Storage** → `production-documents` → **Policies**
2. Créer **4 policies** pour `authenticated`:

```
Policy 1 (SELECT):
  Name: Allow authenticated users to read production documents
  Target roles: authenticated
  Policy definition: true

Policy 2 (INSERT):
  Name: Allow authenticated users to upload production documents
  Target roles: authenticated
  Policy definition: true

Policy 3 (UPDATE):
  Name: Allow authenticated users to update production documents
  Target roles: authenticated
  Policy definition: true

Policy 4 (DELETE):
  Name: Allow authenticated users to delete production documents
  Target roles: authenticated
  Policy definition: true
```

**Guide détaillé:** `docs/PRODUCTION_DOCUMENTS_BUCKET_SETUP.md`

---

## ✅ Ce Qui a Été Corrigé

### Dans le Code
- ✅ Service `dailyProductionService.ts` amélioré avec logs détaillés
- ✅ Messages d'erreur explicites et traduits
- ✅ Gestion d'erreurs robuste

### Dans la Migration SQL
- ✅ Policy INSERT avec auto-fill de `created_by`
- ✅ Trigger pour auto-remplir `created_by` et `site_id`
- ✅ Policy UPDATE simplifiée
- ✅ Vérification `mining_companies` accessible

---

## 🔍 Vérification Après Migration

### Vérifier que la migration a réussi:

```sql
-- Dans SQL Editor, exécuter:
SELECT COUNT(*) as insert_policy_count
FROM pg_policies
WHERE tablename = 'daily_production' AND cmd = 'INSERT';
-- Doit retourner: 1

SELECT EXISTS (
  SELECT 1
  FROM pg_trigger
  WHERE tgname = 'set_created_by_on_daily_production'
) as trigger_exists;
-- Doit retourner: true
```

---

## 🧪 Tests à Faire

1. ✅ **Créer une production journalière**
   - Remplir le formulaire
   - Cliquer "Enregistrer"
   - Vérifier message de succès

2. ✅ **Vérifier logs console**
   - Ouvrir DevTools F12
   - Voir logs: 🚀 ✅ ou ❌

3. ⚠️ **Upload document (après config Storage)**
   - Ajouter un document à une production
   - Vérifier pas d'erreur 400

---

## 📋 Checklist

- [ ] Migration SQL appliquée (`20251112_014_fix_daily_production_insert.sql`)
- [ ] 4 Storage Policies configurées manuellement
- [ ] Test création production réussie
- [ ] Test messages succès/erreur visibles
- [ ] Test upload document fonctionne

---

## 🆘 En Cas de Problème

**Erreur: "new row violates row-level security policy"**
→ Vérifier que la migration SQL est bien appliquée

**Erreur 400 sur storage bucket**
→ Configurer les 4 Storage Policies manuellement

**Pas de message de feedback**
→ Vérifier console pour voir les logs détaillés (🚀 ✅ ❌)

---

**Date:** 2025-11-12
**Priorité:** 🔴 HAUTE - Bloque l'enregistrement des productions
