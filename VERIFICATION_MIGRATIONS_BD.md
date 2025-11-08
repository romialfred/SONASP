# Vérification de l'État de la Base de Données Supabase

## 📋 Liste Complète des Migrations (20 au total)

Voici toutes les migrations dans l'ordre chronologique avec leur statut probable :

---

## ✅ Migrations Déjà Appliquées (selon vos dires)

### Migration 1-2: Système de Base
- ✅ **20251101120000_create_reports_system.sql**
  - Tables: `reports`, `report_schedules`, `report_history`
  - Status: APPLIQUÉE

- ✅ **20251101130000_create_storage_buckets.sql**
  - Buckets: `batch-documents`, `assay-certificates`, `licenses`
  - Status: APPLIQUÉE

### Migration 3-13: Ventes et Paiements
- ✅ **20251102140000_clean_sales_status_transitions.sql**
  - Nettoie les anciennes transitions
  - Status: APPLIQUÉE

- ✅ **20251102140001_insert_new_sales_status_transitions.sql**
  - Nouvelles transitions de ventes
  - Status: APPLIQUÉE

- ✅ **20251102140002_update_sales_table_schema.sql**
  - Champs vendeur, suivi paiement
  - Status: APPLIQUÉE

- ✅ **20251102140003_update_payments_table_schema.sql**
  - Type paiement, champs bancaires
  - Status: APPLIQUÉE

- ✅ **20251102140004_ensure_fx_rate_analysis_table.sql**
  - Table `fx_rate_analysis`
  - Status: APPLIQUÉE

- ✅ **20251102140005_create_virtual_payment_triggers.sql**
  - Paiements virtuels automatiques
  - Status: APPLIQUÉE

- ✅ **20251102140006_create_status_transition_triggers.sql**
  - Automatisation workflow ventes
  - Status: APPLIQUÉE

- ✅ **20251102140007_add_reception_tracking_columns.sql**
  - Suivi réception expéditions
  - Status: APPLIQUÉE

- ✅ **20251102150000_fix_management_approved_transition.sql**
  - Correction workflow approbation
  - Status: APPLIQUÉE

- ✅ **20251102160000_create_customer_banks_table.sql**
  - Table `customer_banks`
  - Status: APPLIQUÉE

- ✅ **20251103000000_add_physical_payment_trigger.sql**
  - Gestion paiements physiques
  - Status: APPLIQUÉE

### Migration 14-18: Modules Fonctionnels
- ✅ **20251103000000_create_presales_module.sql**
  - Tables: `pre_sales`, `pre_sales_status_transitions`
  - Status: APPLIQUÉE

- ✅ **20251104000000_create_assay_certificates_system.sql**
  - Tables: `assay_certificates`, `assay_data_entries`
  - Status: APPLIQUÉE

- ✅ **20251105000000_create_batch_documents_system.sql**
  - Version 1 (peut avoir des problèmes)
  - Status: APPLIQUÉE (avec erreurs possibles)

- ✅ **20251105000001_create_batch_documents_fixed.sql**
  - Version corrigée de batch_documents
  - Status: APPLIQUÉE

- ✅ **20251106000000_create_enhanced_user_activation_system.sql**
  - Table: `user_activation_tokens`
  - Système d'activation utilisateurs
  - Status: APPLIQUÉE

---

## ❌ Migrations NON Appliquées (License Management)

### Migration 19: ⚠️ À APPLIQUER MAINTENANT
- ❌ **20251108000000_create_export_license_system.sql**
  - **Status: NON APPLIQUÉE**
  - **Taille:** 727 lignes
  - **Crée:**
    - Tables: `licenses`, `license_requests`, `license_request_documents`,
      `license_quota_transactions`, `license_events`, `license_kpi_thresholds`
    - Enums: `license_status`, `license_request_status`, `license_event_type`,
      `quota_transaction_type`
    - Triggers et fonctions automatiques
    - Politiques RLS complètes
    - Ajoute colonne `license_id` dans table `batches`

### Migration 20: ⚠️ À APPLIQUER APRÈS LA 19
- ❌ **20251108100000_seed_license_sample_data.sql**
  - **Status: NON APPLIQUÉE**
  - **Taille:** 227 lignes (CORRIGÉE)
  - **Crée:**
    - 10 licenses échantillons (LIC-2024-0001 à 0010)
    - 8 mois de données (Avril-Nov 2024)
    - Événements de license pour l'audit
    - Transactions de quota
    - 5 demandes de license échantillons
    - Lie automatiquement les batches existants aux licenses

---

## 🔍 Comment Vérifier l'État de Votre BD

### Étape 1: Exécuter le Script de Vérification

Copiez et exécutez ce SQL dans votre **Supabase SQL Editor**:

```sql
-- 1. Vérifier les tables liées aux licenses
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'licenses',
    'license_requests',
    'license_request_documents',
    'license_quota_transactions',
    'license_events',
    'license_kpi_thresholds'
  )
ORDER BY table_name;

-- Si ce query retourne 0 lignes → Les migrations 19-20 ne sont PAS appliquées
-- Si ce query retourne 6 lignes → Les migrations 19-20 SONT appliquées
```

### Étape 2: Vérifier la Colonne license_id dans batches

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'batches'
  AND column_name = 'license_id';

-- Si retourne 0 lignes → Migration 19 NON appliquée
-- Si retourne 1 ligne → Migration 19 appliquée
```

### Étape 3: Compter les Licenses Échantillons

```sql
SELECT COUNT(*) as total_licenses
FROM licenses
WHERE license_number LIKE 'LIC-2024-%';

-- Si erreur "relation licenses does not exist" → Migration 19 NON appliquée
-- Si retourne 0 → Migration 19 appliquée, mais PAS la migration 20
-- Si retourne 10 → Les deux migrations SONT appliquées
```

### Étape 4: Vérifier les Enums

```sql
SELECT typname
FROM pg_type
WHERE typname IN (
  'license_status',
  'license_request_status',
  'license_event_type',
  'quota_transaction_type'
)
ORDER BY typname;

-- Si retourne 0 lignes → Migration 19 NON appliquée
-- Si retourne 4 lignes → Migration 19 appliquée
```

---

## 📊 Résumé de l'État Probable

### Ce qui est déjà en place (selon vos dires):
```
✅ Migration 1-18 : TOUTES APPLIQUÉES (18 migrations)
   - Système de rapports
   - Buckets de stockage
   - Workflow ventes et paiements
   - Module pré-ventes
   - Certificats d'essai
   - Documents de batches
   - Activation utilisateurs
```

### Ce qui manque:
```
❌ Migration 19 : create_export_license_system.sql
❌ Migration 20 : seed_license_sample_data.sql

TOTAL À APPLIQUER : 2 migrations
```

---

## 🚀 Plan d'Action

### Option A: Vérification Rapide (RECOMMANDÉ)

1. **Ouvrez Supabase SQL Editor**
2. **Copiez-collez ce query:**
   ```sql
   SELECT
     CASE
       WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'licenses')
       THEN 'Migration 19 est APPLIQUÉE'
       ELSE '⚠️ Migration 19 est NON APPLIQUÉE - À faire!'
     END as migration_19_status,
     CASE
       WHEN EXISTS (SELECT 1 FROM licenses WHERE license_number LIKE 'LIC-2024-%')
       THEN 'Migration 20 est APPLIQUÉE'
       ELSE '⚠️ Migration 20 est NON APPLIQUÉE - À faire!'
     END as migration_20_status;
   ```
3. **Lisez le résultat** → Vous saurez exactement ce qui manque

### Option B: Application des Migrations

Si les migrations 19-20 ne sont PAS appliquées:

#### 🔷 Appliquer Migration 19 (OBLIGATOIRE EN PREMIER)

1. Ouvrez: `supabase/migrations/20251108000000_create_export_license_system.sql`
2. Copiez TOUT le fichier (727 lignes)
3. Collez dans Supabase SQL Editor
4. Cliquez **"Run"**
5. Attendez le message de succès

#### 🔷 Appliquer Migration 20 (APRÈS LA 19)

1. Ouvrez: `supabase/migrations/20251108100000_seed_license_sample_data.sql`
2. Copiez TOUT le fichier (227 lignes - VERSION CORRIGÉE)
3. Collez dans Supabase SQL Editor
4. Cliquez **"Run"**
5. Attendez le message de succès

---

## ✅ Vérification Post-Application

Après avoir appliqué les migrations, vérifiez:

```sql
-- Doit retourner 10
SELECT COUNT(*) FROM licenses;

-- Doit retourner 6 tables
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name LIKE 'license%';

-- Doit afficher les 10 licenses
SELECT
  license_number,
  status,
  ROUND(authorized_qty_oz::numeric, 2) as authorized_oz,
  ROUND(remaining_qty_oz::numeric, 2) as remaining_oz,
  days_to_expiry
FROM licenses
WHERE license_number LIKE 'LIC-2024-%'
ORDER BY license_number;
```

---

## 📁 Fichiers de Migration

Les fichiers sont situés dans:
```
/tmp/cc-agent/59164212/project/supabase/migrations/

À appliquer:
├── 20251108000000_create_export_license_system.sql    (Migration 19)
└── 20251108100000_seed_license_sample_data.sql        (Migration 20 - CORRIGÉE)
```

---

## ⚠️ Important

1. **N'appliquez PAS la migration 20 avant la 19** - Sinon erreurs garanties
2. **La migration 20 a été CORRIGÉE** - Les noms de colonnes correspondent maintenant
3. **Les 18 premières migrations sont supposées appliquées** - Selon vos dires
4. **Vérifiez d'abord** avec le query de l'Option A avant d'appliquer

---

## 🆘 Si Problèmes

### Erreur "relation already exists"
→ La table existe déjà, migration déjà appliquée partiellement
→ Vérifiez ce qui manque avec les queries de vérification

### Erreur "column does not exist"
→ La migration 19 n'a pas été appliquée complètement
→ Réappliquez la migration 19

### Erreur "no rows returned"
→ Normal si aucune donnée n'existe encore
→ Appliquez la migration 20

---

## 📞 Prochaines Étapes

1. ✅ Exécutez le query de vérification (Option A)
2. ✅ Notez le résultat
3. ✅ Appliquez les migrations manquantes si nécessaire
4. ✅ Vérifiez le résultat avec les queries de vérification
5. ✅ Accédez à "License Management" dans l'application

---

**Besoin d'aide?** Consultez `APPLY_MIGRATIONS_NOW.md` pour plus de détails!
