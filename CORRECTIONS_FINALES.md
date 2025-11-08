# ✅ Corrections Finales - Migration 19 Complète

## 🐛 Problèmes Identifiés et Corrigés

Vous avez rencontré **2 erreurs successives** lors de l'application de la migration 19:

### Erreur 1: Colonne générée référençant une autre colonne générée
```
ERROR: 42P17: cannot use generated column "remaining_qty_oz" in column generation expression
```

### Erreur 2: Expression de génération non immuable
```
ERROR: 42P17: generation expression is not immutable
```

## 🔍 Analyse Approfondie

### Problème Principal: `CURRENT_DATE` dans les colonnes générées

PostgreSQL **interdit** l'utilisation de fonctions non-immuables comme `CURRENT_DATE`, `NOW()`, `CURRENT_TIMESTAMP` dans les colonnes générées STORED car:

1. **Valeur changeante**: `CURRENT_DATE` retourne une valeur différente chaque jour
2. **Colonnes STORED**: Doivent avoir une valeur calculable et constante au moment de l'insertion
3. **Immuabilité**: Une fonction immuable doit toujours retourner le même résultat pour les mêmes paramètres

### Colonnes Problématiques

**AVANT (incorrect):**
```sql
-- ❌ Utilise CURRENT_DATE (non immuable)
is_active boolean GENERATED ALWAYS AS (
  status = 'ACTIVE' AND
  CURRENT_DATE >= COALESCE(start_date, issue_date) AND
  CURRENT_DATE <= expiry_date AND
  remaining_qty_oz > 0
) STORED

-- ❌ Utilise CURRENT_DATE (non immuable)
days_to_expiry integer GENERATED ALWAYS AS (
  expiry_date - CURRENT_DATE
) STORED
```

## ✅ Solutions Appliquées

### 1. Suppression des Colonnes Non-Immuables

**Colonnes supprimées de la table:**
- `is_active` (utilisait `CURRENT_DATE`)
- `days_to_expiry` (utilisait `CURRENT_DATE`)

**Colonnes conservées (immuables):**
- ✅ `remaining_qty_oz` - Calcul basé sur d'autres colonnes (immuable)
- ✅ `remaining_percentage` - Calcul basé sur d'autres colonnes (immuable)

### 2. Création d'une Vue pour les Champs Dépendants du Temps

**Nouvelle vue `licenses_with_computed_fields`:**

```sql
CREATE OR REPLACE VIEW licenses_with_computed_fields AS
SELECT
  l.*,
  -- Compute is_active based on current date
  (
    l.status = 'ACTIVE' AND
    CURRENT_DATE >= COALESCE(l.start_date, l.issue_date) AND
    CURRENT_DATE <= l.expiry_date AND
    l.remaining_qty_oz > 0
  ) AS is_active,
  -- Compute days to expiry
  (l.expiry_date - CURRENT_DATE) AS days_to_expiry
FROM licenses l;
```

**Avantages:**
- ✅ Calcul en temps réel à chaque requête
- ✅ Valeurs toujours à jour
- ✅ Pas de problème d'immuabilité
- ✅ Performance acceptable (calculs simples)

### 3. Simplification du Trigger `auto_update_license_status`

**AVANT (avec CURRENT_DATE):**
```sql
CREATE OR REPLACE FUNCTION auto_update_license_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Activate license on issue date if not already active
  IF NEW.status = 'REGISTERED' AND
     CURRENT_DATE >= COALESCE(NEW.start_date, NEW.issue_date) AND
     CURRENT_DATE <= NEW.expiry_date THEN
    NEW.status := 'ACTIVE';
  END IF;

  -- Expire license if past expiry date
  IF NEW.status IN ('ACTIVE', 'REGISTERED') AND
     CURRENT_DATE > NEW.expiry_date THEN
    NEW.status := 'EXPIRED';
  END IF;

  -- Close license if quota fully consumed
  IF NEW.status = 'ACTIVE' AND
     (NEW.authorized_qty_oz - NEW.consumed_qty_oz - NEW.reserved_qty_oz) <= 0 THEN
    NEW.status := 'CLOSED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**APRÈS (simplifié - seulement quota):**
```sql
CREATE OR REPLACE FUNCTION auto_update_license_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Close license if quota fully consumed
  IF NEW.status = 'ACTIVE' AND
     (NEW.authorized_qty_oz - NEW.consumed_qty_oz - NEW.reserved_qty_oz) <= 0 THEN
    NEW.status := 'CLOSED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Pourquoi?** Le trigger ne gère plus les transitions basées sur les dates car `CURRENT_DATE` peut causer des problèmes.

### 4. Ajout d'une Fonction de Mise à Jour Périodique

**Nouvelle fonction `update_license_statuses_by_date()`:**

```sql
CREATE OR REPLACE FUNCTION update_license_statuses_by_date()
RETURNS void AS $$
BEGIN
  -- Activate licenses that should be active
  UPDATE licenses
  SET status = 'ACTIVE'
  WHERE status = 'REGISTERED'
    AND CURRENT_DATE >= COALESCE(start_date, issue_date)
    AND CURRENT_DATE <= expiry_date;

  -- Expire licenses that are past expiry date
  UPDATE licenses
  SET status = 'EXPIRED'
  WHERE status IN ('ACTIVE', 'REGISTERED')
    AND CURRENT_DATE > expiry_date;

  -- Close licenses with no remaining quota
  UPDATE licenses
  SET status = 'CLOSED'
  WHERE status = 'ACTIVE'
    AND (authorized_qty_oz - consumed_qty_oz - reserved_qty_oz) <= 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage:**
- À appeler manuellement: `SELECT update_license_statuses_by_date();`
- Ou via cron job quotidien (si pg_cron est activé)
- Ou via l'application (scheduled job)

### 5. Suppression de l'Index Problématique

**Supprimé:**
```sql
CREATE INDEX idx_licenses_is_active ON licenses(is_active) WHERE is_active = true;
```

**Raison:** `is_active` n'existe plus comme colonne de la table

## 📊 Structure Finale de la Table `licenses`

**Colonnes stockées:**
```sql
licenses (
  -- Identité
  id uuid PRIMARY KEY
  license_number text UNIQUE

  -- Relations
  applicant_mine_id uuid

  -- Dates
  request_date date
  issue_date date
  start_date date
  expiry_date date

  -- Quotas (colonnes réelles)
  authorized_qty_oz decimal(18,3)
  reserved_qty_oz decimal(18,3)
  consumed_qty_oz decimal(18,3)

  -- Quotas (colonnes générées - immuables)
  remaining_qty_oz decimal(18,3) GENERATED ALWAYS AS (
    authorized_qty_oz - consumed_qty_oz - reserved_qty_oz
  ) STORED

  remaining_percentage decimal(5,2) GENERATED ALWAYS AS (
    ROUND(((authorized_qty_oz - consumed_qty_oz - reserved_qty_oz) / authorized_qty_oz * 100)::numeric, 2)
  ) STORED

  -- Statut
  status license_status

  -- Audit
  created_at timestamptz
  updated_at timestamptz
  created_by uuid
  updated_by uuid

  -- ... autres champs
)
```

**Champs calculés dynamiquement (via vue):**
- `is_active` - Calculé à chaque requête
- `days_to_expiry` - Calculé à chaque requête

## 🎯 Impact sur l'Application

### Dans le Frontend (Services TypeScript)

**AVANT:**
```typescript
// Query directement la table
const { data } = await supabase
  .from('licenses')
  .select('*')
  .eq('is_active', true);  // ❌ is_active n'existe plus
```

**APRÈS (Option 1 - Utiliser la vue):**
```typescript
// Query la vue qui calcule les champs
const { data } = await supabase
  .from('licenses_with_computed_fields')
  .select('*')
  .eq('is_active', true);  // ✅ is_active calculé dans la vue
```

**APRÈS (Option 2 - Calculer côté client):**
```typescript
// Query la table et calculer is_active
const { data: licenses } = await supabase
  .from('licenses')
  .select('*');

// Calculer is_active côté client
const activeLicenses = licenses?.filter(l =>
  l.status === 'ACTIVE' &&
  new Date() >= new Date(l.start_date || l.issue_date) &&
  new Date() <= new Date(l.expiry_date) &&
  l.remaining_qty_oz > 0
);
```

**APRÈS (Option 3 - Filtrer avec des conditions):**
```typescript
const today = new Date().toISOString().split('T')[0];

const { data } = await supabase
  .from('licenses')
  .select('*')
  .eq('status', 'ACTIVE')
  .lte('issue_date', today)
  .gte('expiry_date', today)
  .gt('remaining_qty_oz', 0);
```

### Mise à Jour des Statuts

**Option 1: Appel manuel**
```sql
-- Dans l'admin panel ou via API
SELECT update_license_statuses_by_date();
```

**Option 2: Cron job Supabase (si pg_cron activé)**
```sql
-- Exécuter une fois pour setup
SELECT cron.schedule(
  'update-license-statuses',
  '0 0 * * *',  -- Tous les jours à minuit
  'SELECT update_license_statuses_by_date()'
);
```

**Option 3: Depuis l'application**
```typescript
// Dans un scheduled task côté serveur
import { supabase } from './supabaseClient';

async function updateLicenseStatuses() {
  const { error } = await supabase.rpc('update_license_statuses_by_date');
  if (error) console.error('Failed to update license statuses:', error);
}

// Appeler quotidiennement
setInterval(updateLicenseStatuses, 24 * 60 * 60 * 1000);
```

## ✅ Modifications Nécessaires dans le Code Frontend

### Fichier: `src/services/licenseService.ts`

**Changements requis:**

1. **Utiliser la vue au lieu de la table:**
```typescript
// AVANT
.from('licenses')

// APRÈS
.from('licenses_with_computed_fields')
```

2. **Ou ajouter un helper pour calculer is_active:**
```typescript
export function isLicenseActive(license: License): boolean {
  const today = new Date();
  const startDate = new Date(license.start_date || license.issue_date);
  const expiryDate = new Date(license.expiry_date);

  return (
    license.status === 'ACTIVE' &&
    today >= startDate &&
    today <= expiryDate &&
    license.remaining_qty_oz > 0
  );
}

export function getDaysToExpiry(license: License): number {
  const today = new Date();
  const expiryDate = new Date(license.expiry_date);
  const diffTime = expiryDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
```

### Fichier: `src/pages/licenses/LicensesListingPage.tsx`

**Si vous filtrez par is_active:**
```typescript
// AVANT
const { data: licenses } = await supabase
  .from('licenses')
  .select('*')
  .eq('is_active', true);

// APRÈS - Option 1 (Vue)
const { data: licenses } = await supabase
  .from('licenses_with_computed_fields')
  .select('*')
  .eq('is_active', true);

// APRÈS - Option 2 (Filtre manuel)
const { data: allLicenses } = await supabase
  .from('licenses')
  .select('*');

const activeLicenses = allLicenses?.filter(isLicenseActive);
```

## 📋 Checklist Post-Migration

Après avoir appliqué la migration 19 corrigée:

- [ ] La migration s'exécute sans erreur
- [ ] La table `licenses` existe
- [ ] La vue `licenses_with_computed_fields` existe
- [ ] Les colonnes `remaining_qty_oz` et `remaining_percentage` fonctionnent
- [ ] Query `SELECT * FROM licenses_with_computed_fields` retourne is_active et days_to_expiry
- [ ] Mettre à jour le code frontend pour utiliser la vue ou calculer is_active
- [ ] Optionnel: Configurer un cron job pour `update_license_statuses_by_date()`
- [ ] Appliquer la migration 20 (sample data)
- [ ] Vérifier que les 10 licenses échantillons apparaissent

## 🚀 Prochaines Étapes

1. **Appliquer la migration 19 corrigée**
   ```
   Fichier: supabase/migrations/20251108000000_create_export_license_system.sql
   ```

2. **Vérifier**
   ```sql
   -- Vérifier la table
   SELECT COUNT(*) FROM licenses;

   -- Vérifier la vue
   SELECT * FROM licenses_with_computed_fields LIMIT 1;

   -- Tester la fonction
   SELECT update_license_statuses_by_date();
   ```

3. **Appliquer la migration 20**
   ```
   Fichier: supabase/migrations/20251108100000_seed_license_sample_data.sql
   ```

4. **Mettre à jour le code frontend**
   - Utiliser `licenses_with_computed_fields` au lieu de `licenses`
   - Ou implémenter les helpers `isLicenseActive()` et `getDaysToExpiry()`

## ✨ Résumé des Corrections

| Problème | Solution | Impact |
|----------|----------|--------|
| ❌ Colonnes générées avec `CURRENT_DATE` | ✅ Vue `licenses_with_computed_fields` | Frontend doit utiliser la vue ou calculer |
| ❌ Trigger avec `CURRENT_DATE` | ✅ Trigger simplifié + fonction périodique | Appeler `update_license_statuses_by_date()` |
| ❌ Index sur `is_active` | ✅ Index supprimé | Utiliser index sur `status` + `expiry_date` |
| ❌ Colonne `is_active` dans table | ✅ Champ calculé dans vue | Requêtes adaptées |
| ❌ Colonne `days_to_expiry` dans table | ✅ Champ calculé dans vue | Requêtes adaptées |

## 🎯 Avantages de Cette Approche

✅ **Compatible PostgreSQL** - Aucune fonction non-immuable dans colonnes générées
✅ **Valeurs à jour** - `is_active` et `days_to_expiry` toujours corrects
✅ **Flexibilité** - Peut calculer côté BD (vue) ou côté client
✅ **Performance** - Colonnes `remaining_qty_oz` et `remaining_percentage` restent STORED
✅ **Maintenabilité** - Code plus clair et conforme aux règles PostgreSQL

---

✅ **La migration 19 est maintenant complètement corrigée et prête à être appliquée!**

**Prochaine action:** Appliquer la migration 19 avec le fichier corrigé.
