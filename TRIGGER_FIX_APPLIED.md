# ✅ CORRECTION DU TRIGGER - Statuts de Licence

## 🎯 PROBLÈME IDENTIFIÉ

### Trigger: `trg_update_license_quantity_on_insert/update/delete`
### Fonction: `update_license_used_quantity()`
### Fichier source: `/supabase/migrations/add_export_licenses_system.sql` (ligne 159)

**Code problématique:**
```sql
SELECT COALESCE(SUM(total_net_weight_grams), 0)
INTO v_total_weight
FROM shipping_preparations
WHERE license_id = COALESCE(NEW.license_id, OLD.license_id)
  AND status IN ('prepared', 'shipped');  -- ❌ CES STATUTS N'EXISTENT PLUS!
```

---

## ❌ STATUTS OBSOLÈTES

Les statuts suivants n'existent plus dans l'ENUM `shipping_preparation_status`:
- `'prepared'` - N'existe plus
- `'shipped'` - N'existe plus

Ces statuts faisaient partie de l'ancien ENUM `shipping_status_v2` qui a été supprimé.

---

## ✅ NOUVEAUX STATUTS (Workflow Actuel)

L'ENUM `shipping_preparation_status` contient:

1. **`'waiting_for_customs_approval'`** 
   - En attente d'approbation douanière
   - Statut initial à la création

2. **`'approved_by_customs'`** 
   - Approuvé par la douane
   - ✅ Compte dans le quota de licence

3. **`'ready_for_expedition'`** 
   - Prêt pour l'expédition
   - ✅ Compte dans le quota de licence

---

## 🔧 CORRECTION APPLIQUÉE

### Migration créée: `20251114_012_fix_license_trigger_statuses.sql`

**Nouveau code:**
```sql
SELECT COALESCE(SUM(total_net_weight_grams), 0)
INTO v_total_weight
FROM shipping_preparations
WHERE license_id = COALESCE(NEW.license_id, OLD.license_id)
  AND status IN (
    'approved_by_customs',      -- ✅ Approuvé par la douane
    'ready_for_expedition'       -- ✅ Prêt pour expédition
  );
```

---

## 📋 LOGIQUE DE CALCUL

### Pourquoi ces statuts ?

**`'waiting_for_customs_approval'`** - NE compte PAS
- L'expédition est en attente, pas encore confirmée
- Le quota ne devrait pas être consommé tant que la douane n'a pas approuvé

**`'approved_by_customs'`** - ✅ COMPTE
- La douane a approuvé l'expédition
- Le quota de la licence est effectivement consommé

**`'ready_for_expedition'`** - ✅ COMPTE
- L'expédition est validée et prête à partir
- Le quota reste consommé

---

## 🚀 COMMENT APPLIQUER LA CORRECTION

### Option 1: Via le Dashboard Supabase (RECOMMANDÉ)

1. Ouvrir https://supabase.com/dashboard
2. Sélectionner votre projet
3. Aller dans **SQL Editor**
4. Copier le contenu de `/supabase/migrations/20251114_012_fix_license_trigger_statuses.sql`
5. Cliquer sur **Run**

### Option 2: Via CLI Supabase

```bash
supabase db push --db-url "postgresql://..."
```

---

## ✅ VÉRIFICATION POST-MIGRATION

Exécutez cette requête pour vérifier que la fonction est correcte:

```sql
-- Vérifier que la fonction existe et est correcte
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'update_license_used_quantity'
AND n.nspname = 'public';
```

La définition devrait contenir:
```sql
AND status IN (
  'approved_by_customs',
  'ready_for_expedition'
)
```

---

## 📊 IMPACT DE LA CORRECTION

### Avant la correction:
- ❌ Erreur lors de l'INSERT: `invalid input value for enum shipping_preparation_status: "prepared"`
- ❌ Le trigger essayait de filtrer par des statuts inexistants
- ❌ Impossible de créer des expéditions

### Après la correction:
- ✅ Les expéditions peuvent être créées
- ✅ Le quota de licence est calculé correctement
- ✅ Les statuts utilisés correspondent à l'ENUM actuel

---

## 🔗 MIGRATIONS LIÉES

Cette correction fait partie d'un ensemble de migrations:

1. **`add_shipping_system.sql`** - Création initiale (AVEC BUG)
2. **`20251114_011_fix_shipping_enum_definitif.sql`** - Correction de l'ENUM
3. **`20251114_012_fix_license_trigger_statuses.sql`** - ✅ CETTE CORRECTION

**ORDRE D'APPLICATION:**
```
1. 20251114_011_fix_shipping_enum_definitif.sql
   ↓ (Corrige la table et l'ENUM)
2. 20251114_012_fix_license_trigger_statuses.sql
   ↓ (Corrige le trigger)
3. ✅ Système fonctionnel
```

---

## 📝 RÉSUMÉ EXÉCUTIF

### Problème:
Le trigger `update_license_used_quantity()` utilisait des statuts obsolètes (`'prepared'`, `'shipped'`) qui n'existent plus dans le nouvel ENUM `shipping_preparation_status`.

### Solution:
Mise à jour de la fonction pour utiliser les statuts corrects du workflow actuel (`'approved_by_customs'`, `'ready_for_expedition'`).

### Résultat:
Les expéditions peuvent maintenant être créées sans erreur, et le quota des licences est calculé correctement.

---

## ✅ PROCHAINE ÉTAPE

**Appliquez la migration `20251114_012_fix_license_trigger_statuses.sql` dans le Dashboard Supabase.**

Après l'application, testez la création d'une nouvelle expédition sur la page:
https://global-shipping.org/shipping/preparation/new

