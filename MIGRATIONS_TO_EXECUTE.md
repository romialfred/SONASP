# 🗄️ LISTE DES MIGRATIONS À EXÉCUTER

## Pour: Module License Management Complet
## Date: 2025-11-10

---

## ⚠️ IMPORTANT - LIRE D'ABORD

**ORDRE D'EXÉCUTION:** Les migrations doivent être exécutées dans l'ordre exact indiqué ci-dessous.

**MÉTHODE:** 
1. Ouvrir Supabase SQL Editor
2. Copier TOUT le contenu de chaque fichier
3. Coller dans l'éditeur
4. Exécuter
5. Vérifier "Success. No rows returned" ou résultats attendus

---

## 📋 MIGRATION 1: Workflow d'Approbation

**Fichier:** `supabase/migrations/20251111020000_add_license_approval_workflow.sql`

**Status:** ✅ CORRIGÉ (justification → comments)

**Description:**
- Ajoute colonnes approved_at et approved_by à license_requests
- Ajoute colonne request_id à licenses
- Crée fonction approve_license_request()
- Crée vue v_approved_license_requests
- Crée fonction generate_license_number()

**Contenu à Copier:**
```sql
-- Ouvrir le fichier:
supabase/migrations/20251111020000_add_license_approval_workflow.sql

-- COPIER TOUT LE CONTENU (de la ligne 1 à la fin)
-- COLLER dans Supabase SQL Editor
-- EXÉCUTER
```

**Vérification après exécution:**
```sql
-- Test 1: Colonnes ajoutées?
SELECT column_name FROM information_schema.columns
WHERE table_name = 'license_requests'
  AND column_name IN ('approved_at', 'approved_by');
-- Devrait retourner 2 lignes

-- Test 2: Fonction créée?
SELECT proname FROM pg_proc WHERE proname = 'approve_license_request';
-- Devrait retourner: approve_license_request

-- Test 3: Vue créée?
SELECT COUNT(*) FROM v_approved_license_requests;
-- Devrait retourner un nombre (peut-être 0 si pas de demandes approved)
```

**Résultat Attendu:** ✅ Success. No rows returned

---

## 📋 MIGRATION 2: Vues Améliorées

**Fichier:** `supabase/migrations/20251111030000_enhance_license_views.sql`

**Status:** ✅ NOUVEAU - CRÉÉ AUJOURD'HUI

**Description:**
- Crée vue v_license_requests_detailed (infos complètes requests)
- Crée vue v_licenses_with_shipments (licences + expéditions)
- Crée vue v_license_quota_usage (analyse consommation)
- Ajoute indexes de performance

**Contenu à Copier:**
```sql
-- Ouvrir le fichier:
supabase/migrations/20251111030000_enhance_license_views.sql

-- COPIER TOUT LE CONTENU (de la ligne 1 à la fin)
-- COLLER dans Supabase SQL Editor
-- EXÉCUTER
```

**Vérification après exécution:**
```sql
-- Test 1: Vue v_license_requests_detailed créée?
SELECT COUNT(*) FROM v_license_requests_detailed;
-- Devrait retourner nombre de license requests

-- Test 2: Vue v_licenses_with_shipments créée?
SELECT COUNT(*) FROM v_licenses_with_shipments;
-- Devrait retourner nombre de licenses

-- Test 3: Vue v_license_quota_usage créée?
SELECT COUNT(*) FROM v_license_quota_usage;
-- Devrait retourner nombre de licenses actives

-- Test 4: Permissions accordées?
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'v_license_requests_detailed';
-- Devrait montrer 'authenticated' avec 'SELECT'
```

**Résultat Attendu:** ✅ Success. No rows returned

---

## ✅ CHECKLIST POST-MIGRATION

Après avoir exécuté TOUTES les migrations:

### Base de Données:
- [ ] Migration 20251111020000 exécutée sans erreur
- [ ] Migration 20251111030000 exécutée sans erreur
- [ ] Toutes les vérifications SQL passent

### Test Complet:
```sql
-- TEST GLOBAL - Tout doit fonctionner

-- 1. Vérifier toutes les colonnes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'license_requests'
  AND column_name IN ('approved_at', 'approved_by', 'comments', 'priority', 'title')
ORDER BY column_name;
-- Devrait retourner 5 lignes

-- 2. Vérifier toutes les vues
SELECT table_name
FROM information_schema.views
WHERE table_name LIKE '%license%'
  AND table_schema = 'public'
ORDER BY table_name;
-- Devrait inclure:
-- - licenses_with_computed_fields
-- - v_active_licenses
-- - v_approved_license_requests
-- - v_license_quota_usage
-- - v_license_requests_detailed
-- - v_licenses_with_shipments

-- 3. Vérifier toutes les fonctions
SELECT proname
FROM pg_proc
WHERE proname LIKE '%license%'
ORDER BY proname;
-- Devrait inclure:
-- - approve_license_request
-- - generate_license_number
-- - generate_license_request_number
-- - update_license_timestamp
```

### Frontend:
- [ ] Build réussi: `npm run build`
- [ ] Pas d'erreurs TypeScript
- [ ] Page /licenses/requests accessible
- [ ] Page /licenses/requests/:id accessible

---

## 🐛 EN CAS D'ERREUR

### Erreur: "column lr.justification does not exist"

**Cause:** Version non corrigée de la migration 20251111020000

**Solution:**
```sql
-- Supprimer la vue problématique
DROP VIEW IF EXISTS v_approved_license_requests;

-- Réexécuter la migration corrigée
-- (celle dans supabase/migrations/20251111020000_add_license_approval_workflow.sql)
```

### Erreur: "relation already exists"

**Cause:** Migration déjà partiellement appliquée

**Solution:**
```sql
-- Voir quelle vue existe déjà
SELECT table_name FROM information_schema.views
WHERE table_name LIKE '%license%';

-- Supprimer les vues existantes si nécessaire
DROP VIEW IF EXISTS v_approved_license_requests CASCADE;
DROP VIEW IF EXISTS v_license_requests_detailed CASCADE;
DROP VIEW IF EXISTS v_licenses_with_shipments CASCADE;
DROP VIEW IF EXISTS v_license_quota_usage CASCADE;

-- Réexécuter la migration
```

### Erreur: "function already exists"

**Cause:** Fonction déjà créée

**Solution:**
```sql
-- Remplacer au lieu de créer
-- La migration utilise déjà CREATE OR REPLACE
-- Donc réexécuter devrait fonctionner

-- Si problème persiste:
DROP FUNCTION IF EXISTS approve_license_request CASCADE;
DROP FUNCTION IF EXISTS generate_license_number CASCADE;

-- Réexécuter la migration
```

---

## 📞 RÉSUMÉ

**Migrations à Exécuter:** 2
1. `20251111020000_add_license_approval_workflow.sql`
2. `20251111030000_enhance_license_views.sql`

**Temps Estimé:** 5 minutes

**Vérifications:** 3 tests SQL par migration

**Résultat Attendu:** 
- 2 nouvelles colonnes dans license_requests
- 1 nouvelle colonne dans licenses
- 2 fonctions créées
- 4 vues créées
- Indexes de performance

**Impact:** 
- Workflow d'approbation complet
- Vues optimisées pour frontend
- Performance améliorée
- Module License Management fonctionnel

---

**APRÈS L'EXÉCUTION:**
Consultez `LICENSE_MODULE_IMPLEMENTATION_GUIDE.md` pour le guide d'utilisation complet!

---

**Date:** 2025-11-10
**Status:** ✅ PRÊT À EXÉCUTER
**Build:** ✅ 28.39s (déjà vérifié)
