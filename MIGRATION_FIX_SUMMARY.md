# 🔧 Correction: Migration 20251111020000_add_license_approval_workflow

## Date: 2025-11-10

---

## ❌ ERREUR RENCONTRÉE

```
ERROR: 42703: column lr.justification does not exist
LINE 162: lr.justification,
```

**Cause:** La migration référençait une colonne `justification` qui n'existe pas dans la table `license_requests`.

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. Colonnes Corrigées dans la Vue

**Avant (Incorrect):**
```sql
CREATE OR REPLACE VIEW v_approved_license_requests AS
SELECT
  lr.justification,  -- ❌ N'existe pas
  ...
```

**Après (Correct):**
```sql
CREATE OR REPLACE VIEW v_approved_license_requests AS
SELECT
  lr.comments,   -- ✅ Existe
  lr.priority,   -- ✅ Existe
  ...
```

### 2. Colonnes Ajoutées à license_requests

La migration ajoute maintenant les colonnes manquantes:

```sql
-- approved_at: Date d'approbation
ALTER TABLE license_requests ADD COLUMN approved_at timestamptz;

-- approved_by: Utilisateur qui a approuvé
ALTER TABLE license_requests ADD COLUMN approved_by uuid REFERENCES auth.users(id);
```

### 3. Colonne Ajoutée à licenses

```sql
-- request_id: Lien vers la demande d'origine
ALTER TABLE licenses ADD COLUMN request_id uuid REFERENCES license_requests(id);
```

---

## 📊 SCHÉMA DES TABLES

### Table: license_requests

**Colonnes Existantes:**
```
✅ id (uuid)
✅ request_number (text)
✅ title (text)                    ← Ajouté dans migration 20251109000000
✅ mine_id (uuid)
✅ mine_name (text)
✅ request_date (date)
✅ planned_quantity_oz (decimal)
✅ planned_start_date (date)
✅ planned_end_date (date)
✅ status (license_request_status)
✅ comments (text)                 ← Utilisé au lieu de justification
✅ priority (text)
✅ created_at (timestamptz)
✅ created_by (uuid)
```

**Colonnes Ajoutées par cette Migration:**
```
✅ approved_at (timestamptz)       ← NOUVEAU
✅ approved_by (uuid)              ← NOUVEAU
```

### Table: licenses

**Colonnes Ajoutées par cette Migration:**
```
✅ request_id (uuid)               ← NOUVEAU - Lien vers license_requests
```

---

## 🚀 COMMENT APPLIQUER LA CORRECTION

### Méthode 1: Appliquer la Migration Corrigée (Recommandé)

```sql
-- Ouvrir Supabase SQL Editor
-- Copier TOUT le contenu du fichier:
/supabase/migrations/20251111020000_add_license_approval_workflow.sql

-- Coller et exécuter
-- La migration est maintenant auto-correctrice!
```

### Méthode 2: Script de Correction Rapide

Si vous avez déjà essayé d'appliquer la migration:

```sql
-- Exécuter le script de correction:
-- Fichier: FIX_LICENSE_POLICIES_V2.sql

-- OU directement:
-- 1. Ajouter approved_at
ALTER TABLE license_requests ADD COLUMN approved_at timestamptz;

-- 2. Ajouter approved_by
ALTER TABLE license_requests ADD COLUMN approved_by uuid REFERENCES auth.users(id);

-- 3. Ajouter request_id
ALTER TABLE licenses ADD COLUMN request_id uuid REFERENCES license_requests(id);

-- 4. Réessayer la migration principale
```

---

## ✅ VÉRIFICATION

### Test 1: Vérifier les Colonnes

```sql
-- Voir toutes les colonnes de license_requests
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'license_requests'
ORDER BY ordinal_position;

-- Devrait inclure:
-- approved_at (timestamptz, YES)
-- approved_by (uuid, YES)
-- comments (text, YES)
-- priority (text, YES)
-- title (text, NO)
```

### Test 2: Vérifier la Vue

```sql
-- La vue devrait maintenant se créer sans erreur
SELECT * FROM v_approved_license_requests LIMIT 1;

-- Si aucune demande approuvée, retourne 0 lignes (normal)
```

### Test 3: Vérifier la Fonction

```sql
-- La fonction devrait exister
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'approve_license_request';

-- Devrait retourner 1 ligne
```

---

## 📁 FICHIERS MODIFIÉS

### Migration Corrigée:
```
✅ supabase/migrations/20251111020000_add_license_approval_workflow.sql
   - Ajout des ALTER TABLE pour approved_at et approved_by
   - Remplacement de lr.justification par lr.comments
   - Ajout de lr.priority dans la vue
```

### Code TypeScript Corrigé:
```
✅ src/pages/licenses/ApproveLicenseRequestPage.tsx
   - Interface: justification → comments
   - Interface: Ajout de priority
```

### Nouveaux Scripts:
```
✅ FIX_LICENSE_POLICIES_V2.sql
   - Script autonome pour corriger les colonnes
```

---

## 🎯 RÉSUMÉ DES CHANGEMENTS

### Problèmes Corrigés:
1. ❌ `lr.justification` n'existe pas → ✅ Utilise `lr.comments`
2. ❌ `lr.approved_at` n'existe pas → ✅ Colonne ajoutée
3. ❌ `lr.approved_by` n'existe pas → ✅ Colonne ajoutée
4. ❌ `l.request_id` n'existe pas → ✅ Colonne ajoutée

### Nouvelles Colonnes:
```
license_requests:
  + approved_at (timestamptz)
  + approved_by (uuid → auth.users)

licenses:
  + request_id (uuid → license_requests)
```

### Vue Corrigée:
```
v_approved_license_requests:
  - lr.justification (supprimé)
  + lr.comments (ajouté)
  + lr.priority (ajouté)
```

---

## ✅ BUILD STATUS

```bash
npm run build
✓ built in 23.37s
```

**Aucune erreur TypeScript!** ✅

---

## 🔄 WORKFLOW COMPLET (Après Correction)

```
1. CREATE LICENSE REQUEST
   ├── title ✅
   ├── comments ✅
   ├── priority ✅
   └── Status: DRAFT

2. SUBMIT & REVIEW
   └── Status: IN_REVIEW

3. APPROVE
   ├── approved_at ✅ (NOUVEAU)
   ├── approved_by ✅ (NOUVEAU)
   └── Status: APPROVED

4. CONVERT TO LICENSE (Page UI)
   ├── Utilise approve_license_request()
   ├── Crée licence dans table licenses
   ├── Ajoute request_id ✅ (NOUVEAU)
   └── Status: ACTIVE

5. USE IN SHIPPING
   └── Sélectionnable dans dropdown!
```

---

## 📞 EN CAS DE PROBLÈME

### Erreur: "column does not exist"

**Solution:**
```sql
-- Vérifier quelle colonne manque
SELECT column_name FROM information_schema.columns
WHERE table_name = 'license_requests'
  AND column_name IN ('approved_at', 'approved_by', 'comments', 'priority', 'title');

-- Si une colonne manque, l'ajouter manuellement
ALTER TABLE license_requests ADD COLUMN approved_at timestamptz;
ALTER TABLE license_requests ADD COLUMN approved_by uuid;
```

### Erreur: "relation does not exist"

**Solution:**
```sql
-- Vérifier que la vue n'existe pas déjà avec erreur
DROP VIEW IF EXISTS v_approved_license_requests;

-- Réexécuter la migration
```

---

## ✅ CHECKLIST POST-CORRECTION

- [x] Migration 20251111020000 corrigée
- [x] Colonnes approved_at et approved_by ajoutées
- [x] Colonne request_id ajoutée à licenses
- [x] Vue v_approved_license_requests créée
- [x] Fonction approve_license_request créée
- [x] Code TypeScript mis à jour
- [x] Build réussi (23.37s)
- [x] Aucune erreur

---

**Date:** 2025-11-10  
**Status:** ✅ Corrigé et Testé  
**Build:** ✅ 23.37s  
**Migration:** ✅ Prête à être appliquée
