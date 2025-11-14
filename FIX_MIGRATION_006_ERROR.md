# 🚨 Fix Migration 006 - Erreur "users does not exist"

## ❌ Erreur Rencontrée

```
Error: Failed to run sql query: ERROR: 42P01: relation "users" does not exist
```

## 🔍 Cause du Problème

La migration `20251114_006_add_shipping_status_history.sql` contenait:
```sql
changed_by uuid REFERENCES users(id)
```

**Problème:** La table `public.users` n'existe pas dans votre base de données Supabase.

Dans Supabase, les utilisateurs sont dans `auth.users`, pas `public.users`.

## ✅ Solution Rapide (2 minutes)

### Étape 1: Utiliser la Migration CORRIGÉE

**N'utilisez PAS:** `20251114_006_add_shipping_status_history.sql` ❌

**UTILISEZ:** `20251114_006_add_shipping_status_history_FIXED.sql` ✅

### Étape 2: Exécuter la Migration Corrigée

1. Ouvrir Supabase Dashboard
2. Aller dans **Database** > **SQL Editor**
3. Copier le contenu de `supabase/migrations/20251114_006_add_shipping_status_history_FIXED.sql`
4. Coller et cliquer **Run**

**Différence Clé:**
```sql
-- AVANT (erreur):
changed_by uuid REFERENCES users(id)

-- APRÈS (corrigé):
changed_by uuid  -- Sans foreign key, stocke auth.uid()
```

### Étape 3: Vérifier le Succès

Exécuter dans SQL Editor:
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'shipping_status_history'
) AS migration_success;
```

**Résultat attendu:** `true` ✅

---

## 🔍 Pourquoi Cette Solution ?

### Option 1: Sans Foreign Key (CHOISIE) ✅

**Avantages:**
- ✅ Pas de dépendance sur une table custom
- ✅ Fonctionne immédiatement
- ✅ `auth.uid()` est toujours disponible
- ✅ Peut quand même joindre avec `auth.users` dans les queries

**Code:**
```sql
changed_by uuid  -- Stocke auth.uid()
```

**Comment récupérer l'email:**
```sql
SELECT
  h.*,
  u.email
FROM shipping_status_history h
LEFT JOIN auth.users u ON h.changed_by = u.id;
```

### Option 2: Avec auth.users (Alternative)

**Inconvénient:**
- ⚠️ Foreign key vers un schéma externe (`auth`)
- ⚠️ Moins flexible si vous voulez une table custom plus tard

**Code:**
```sql
changed_by uuid REFERENCES auth.users(id)
```

### Option 3: Créer user_profiles d'abord

**Si vous voulez une foreign key:**
1. Créer d'abord une migration pour `user_profiles`
2. Puis modifier cette migration pour utiliser `user_profiles(id)`

---

## 📋 Vérification Préalable (Pour l'Avenir)

### AVANT d'exécuter toute migration, TOUJOURS:

#### 1. Exécuter le Script de Vérification

```bash
# Copier dans Supabase SQL Editor:
scripts/verify-database-structure.sql
```

Ce script vous dira:
- ✅ Quelles tables existent
- ✅ Quelle table utiliser pour `changed_by`
- ❌ Quelles dépendances manquent

#### 2. Lire les Prérequis dans la Migration

Chaque migration DOIT inclure:
```sql
/*
  ## ⚠️  PREREQUISITES - VERIFY BEFORE EXECUTION
  Run this verification script first: scripts/verify-database-structure.sql

  Required tables:
  - ✅ shipping_preparations (must exist)
  - ⚠️  users or user_profiles (optional)
*/
```

---

## 🎯 Pour Cette Migration Spécifiquement

### Checklist Complète

- [ ] 1. **VÉRIFIER:** Exécuter `scripts/verify-database-structure.sql`
- [ ] 2. **CONFIRMER:** Table `shipping_preparations` existe
- [ ] 3. **UTILISER:** La version `_FIXED.sql` de la migration
- [ ] 4. **EXÉCUTER:** La migration dans SQL Editor
- [ ] 5. **VÉRIFIER:** Table créée avec succès
- [ ] 6. **TESTER:** Interface Shipping Details fonctionne
- [ ] 7. **METTRE À JOUR:** `MIGRATIONS_TO_EXECUTE_NOW.md`
- [ ] 8. **NOTIFIER:** L'équipe dans #dev-database

---

## 🧪 Test de la Migration

Après l'exécution, tester:

```sql
-- Test 1: Table existe
SELECT tablename FROM pg_tables WHERE tablename = 'shipping_status_history';

-- Test 2: Colonnes correctes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'shipping_status_history';

-- Test 3: Trigger existe
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'shipping_preparations'
AND trigger_name = 'shipping_status_change_trigger';

-- Test 4: Insertion manuelle (optionnel)
INSERT INTO shipping_status_history (
  shipping_preparation_id,
  old_status,
  new_status,
  changed_by,
  notes
) VALUES (
  (SELECT id FROM shipping_preparations LIMIT 1),
  'pending',
  'prepared',
  auth.uid(),
  'Test après fix'
);

-- Test 5: Lecture avec jointure
SELECT
  h.*,
  u.email as changed_by_email
FROM shipping_status_history h
LEFT JOIN auth.users u ON h.changed_by = u.id
ORDER BY h.changed_at DESC
LIMIT 5;
```

---

## 📚 Leçons Apprises

### Pour l'Équipe

1. **TOUJOURS vérifier les dépendances avant d'exécuter**
   - Utiliser `verify-database-structure.sql`

2. **Ne JAMAIS assumer qu'une table existe**
   - Vérifier avec `information_schema.tables`

3. **Foreign Keys = Dépendances**
   - Réfléchir si c'est vraiment nécessaire
   - Parfois, pas de FK est plus flexible

4. **Supabase != PostgreSQL standard**
   - `auth.users` existe, pas `public.users`
   - Vérifier la doc Supabase

5. **Documenter les prérequis**
   - Toujours inclure section `## PREREQUISITES` dans les migrations

---

## 🔧 Si Vous Avez Déjà Exécuté la Mauvaise Version

### Rollback et Correction

```sql
-- 1. Supprimer la table partiellement créée (si elle existe)
DROP TABLE IF EXISTS shipping_status_history CASCADE;

-- 2. Supprimer le trigger (si créé)
DROP TRIGGER IF EXISTS shipping_status_change_trigger ON shipping_preparations;

-- 3. Supprimer la fonction (si créée)
DROP FUNCTION IF EXISTS create_shipping_status_history_on_update();

-- 4. Maintenant, exécuter la version FIXED
-- Copier/coller le contenu de 20251114_006_add_shipping_status_history_FIXED.sql
```

---

## ✅ Résumé

**Problème:** Migration référençait `users` qui n'existe pas

**Solution:** Utiliser `20251114_006_add_shipping_status_history_FIXED.sql`

**Changement:** `changed_by uuid` sans foreign key

**Impact:** Aucun sur les fonctionnalités, juste plus flexible

**Statut:** ✅ Résolu

**Temps:** ~2 minutes pour fix + exécution

---

## 📞 Besoin d'Aide ?

- **Questions:** #dev-database sur Slack
- **Vérification:** Utilisez `verify-database-structure.sql`
- **Documentation:** Voir `MIGRATIONS_BEST_PRACTICES.md`

---

**📅 Date:** 2025-11-14
**🐛 Type:** Foreign Key Error
**✅ Status:** Résolu
**📝 Solution:** Migration FIXED créée
