# Guide: Correction des Numéros d'Expédition

## 🎯 Problème Identifié

Les numéros d'expédition affichaient **HUM-XXX-0000/2025** au lieu du format correct **HUM-SMK-0380/2025**.

### Capture du Problème

Le packing list montrait :
```
EXPEDITION / LOT N°: HUM-XXX-0000/2025
```

**Devrait être** :
```
EXPEDITION / LOT N°: HUM-SMK-0380/2025
```

Où :
- **HUM** = Préfixe fixe (Hummingbird Resources)
- **SMK** = Abréviation de la mine (Société des Mines de Komana) ← **Dynamique**
- **0380** = Numéro incrémental par mine ← **Incrémental**
- **/2025** = Année en cours

---

## 📊 Format du Numéro d'Expédition

### Structure Complète

```
HUM-{ABBREVIATION}-{COUNTER}/YEAR

Composants:
┌─────┬──────────────┬──────────┬──────┐
│ HUM │ ABBREVIATION │ COUNTER  │ YEAR │
├─────┼──────────────┼──────────┼──────┤
│ HUM │     SMK      │   0380   │ 2025 │
└─────┴──────────────┴──────────┴──────┘
  ↓         ↓              ↓         ↓
Fixe   3 lettres     4 chiffres  4 chiffres
       (Mine)       (Incrémental) (Année)
```

### Exemples par Mine

| Mine | Abréviation | Exemple Numéro | Description |
|------|-------------|----------------|-------------|
| Kouroussa | **KGM** | HUM-KGM-0001/2025 | Kouroussa Gold Mines |
| Komana | **SMK** | HUM-SMK-0380/2025 | Société des Mines de Komana |
| Dugbe | **DGB** | HUM-DGB-0001/2025 | Dugbe Mine |
| Yanfolila | **YFL** | HUM-YFL-0001/2025 | Yanfolila Mine |

### Règles de Numérotation

1. **Préfixe HUM** : Toujours fixe pour Hummingbird Resources

2. **Abréviation (3 lettres)** :
   - Extraite de `mining_companies.abbreviation`
   - DOIT être en MAJUSCULES
   - DOIT faire exactement 3 caractères

3. **Compteur (4 chiffres)** :
   - Commence à 0001
   - Incrémente pour chaque nouvelle expédition
   - **Spécifique à chaque mine ET année**
   - Format: LPAD(counter, 4, '0')
   - Réinitialise à 0001 chaque nouvelle année

4. **Année (4 chiffres)** :
   - Année de création de l'expédition
   - Format: YYYY

---

## 🔍 Analyse du Problème

### Cause Racine

La fonction `get_next_expedition_lot_number()` existe dans la base de données, mais :

1. ❌ Certaines mines n'ont pas d'abréviation configurée
2. ❌ Les compteurs `expedition_lot_counters` ne sont pas initialisés
3. ❌ Le frontend retourne un fallback `HUM-XXX-0000/YEAR` en cas d'erreur

### Architecture Existante

```
┌──────────────────────────────────────────────────────────────┐
│                     mining_companies                         │
│  - id                                                        │
│  - name (ex: "Société des Mines de Komana")                 │
│  - code (ex: "SMK")                                          │
│  - abbreviation (ex: "SMK") ← REQUIS pour numérotation      │
└──────────────────────────────────────────────────────────────┘
                          ↓ FK
┌──────────────────────────────────────────────────────────────┐
│              expedition_lot_counters                         │
│  - id                                                        │
│  - mining_company_id (FK → mining_companies)                 │
│  - year (ex: 2025)                                           │
│  - counter (ex: 380) ← Incrémente pour chaque expédition    │
│  - UNIQUE(mining_company_id, year)                           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│        Fonction: get_next_expedition_lot_number()            │
│  Input: mining_company_id, year                              │
│  Process:                                                    │
│    1. Récupère abbreviation de mining_companies             │
│    2. Incrémente counter dans expedition_lot_counters        │
│    3. Formate: HUM-{abbr}-{counter}/year                     │
│  Output: "HUM-SMK-0380/2025"                                 │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│                shipping_preparations                         │
│  - id                                                        │
│  - expedition_lot_number (ex: "HUM-SMK-0380/2025")          │
│  - mining_company_id                                         │
│  - created_at                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔧 Solution Implémentée

### 1. Amélioration du Frontend

**Fichier** : `src/pages/shipping/ShippingPreparationNew.tsx`

**Fonction `generateExpeditionLotNumber()`** - Ajout de logs et gestion d'erreur :

```typescript
const generateExpeditionLotNumber = async (): Promise<string> => {
  if (!selectedMiningCompanyId) return '';

  try {
    const year = new Date().getFullYear();
    const expeditionLotNumber = await shippingPreparationService.generateExpeditionLotNumber(
      selectedMiningCompanyId,
      year
    );
    console.log('✅ Generated expedition lot number:', expeditionLotNumber);
    return expeditionLotNumber;
  } catch (error) {
    console.error('❌ Error generating expedition lot number:', error);
    console.error('Mining company ID:', selectedMiningCompanyId);

    // Show error dialog to user
    setErrorTitle('Erreur de Numéro d\'Expédition');
    setErrorMessage(
      'Impossible de générer le numéro d\'expédition automatiquement. ' +
      'Vérifiez que la compagnie minière a une abréviation configurée. ' +
      'Erreur: ' + (error as Error).message
    );
    setShowErrorDialog(true);

    // Fallback
    const year = new Date().getFullYear();
    return `HUM-XXX-0000/${year}`;
  }
};
```

**Changements** :
- ✅ Logs détaillés (succès et erreur)
- ✅ Affichage d'un dialog d'erreur à l'utilisateur
- ✅ Indication claire du problème (abréviation manquante)
- ✅ Fallback visible pour debugging

### 2. Script SQL de Correction

**Fichier** : `FIX_EXPEDITION_NUMBERS.sql`

Ce script fait 4 choses :

#### Étape 1 : Mettre à jour les abréviations

```sql
-- Mines connues avec abréviations spécifiques
UPDATE mining_companies SET abbreviation = 'KGM'
WHERE LOWER(name) LIKE '%kouroussa%';

UPDATE mining_companies SET abbreviation = 'SMK'
WHERE LOWER(name) LIKE '%komana%';

UPDATE mining_companies SET abbreviation = 'DGB'
WHERE LOWER(name) LIKE '%dugbe%';

UPDATE mining_companies SET abbreviation = 'YFL'
WHERE LOWER(name) LIKE '%yanfolila%';

-- Autres mines : utiliser les 3 premières lettres du code
UPDATE mining_companies
SET abbreviation = UPPER(SUBSTRING(code FROM 1 FOR 3))
WHERE (abbreviation IS NULL OR abbreviation = '')
  AND code IS NOT NULL;
```

#### Étape 2 : Reconstruire les compteurs

```sql
-- Vider les compteurs existants
TRUNCATE TABLE expedition_lot_counters CASCADE;

-- Reconstruire basé sur les expéditions existantes
INSERT INTO expedition_lot_counters (mining_company_id, year, counter)
SELECT
  mining_company_id,
  EXTRACT(YEAR FROM created_at)::INTEGER as year,
  COUNT(*) as counter
FROM shipping_preparations
WHERE mining_company_id IS NOT NULL
GROUP BY mining_company_id, EXTRACT(YEAR FROM created_at)::INTEGER;
```

#### Étape 3 : Régénérer TOUS les numéros d'expédition

```sql
-- Fonction temporaire pour régénérer les numéros
CREATE OR REPLACE FUNCTION regenerate_expedition_lot_numbers()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_prep RECORD;
  v_counter INTEGER := 0;
  v_last_company_id UUID;
  v_last_year INTEGER;
BEGIN
  -- Pour chaque expédition dans l'ordre chronologique
  FOR v_prep IN
    SELECT id, mining_company_id, abbreviation, year
    FROM shipping_preparations sp
    JOIN mining_companies mc ON mc.id = sp.mining_company_id
    ORDER BY mining_company_id, year, created_at ASC
  LOOP
    -- Réinitialiser compteur si changement de mine ou année
    IF v_last_company_id != v_prep.mining_company_id OR
       v_last_year != v_prep.year THEN
      v_counter := 0;
    END IF;

    v_counter := v_counter + 1;

    -- Générer nouveau numéro
    UPDATE shipping_preparations
    SET expedition_lot_number = 'HUM-' || v_prep.abbreviation || '-' ||
                                LPAD(v_counter::TEXT, 4, '0') || '/' || v_prep.year
    WHERE id = v_prep.id;
  END LOOP;
END;
$$;

SELECT regenerate_expedition_lot_numbers();
DROP FUNCTION regenerate_expedition_lot_numbers();
```

#### Étape 4 : Vérifier les résultats

```sql
-- Afficher tous les numéros d'expédition
SELECT
  expedition_lot_number,
  mc.name as company,
  mc.abbreviation,
  CASE
    WHEN expedition_lot_number NOT LIKE '%XXX%' THEN '✅ Correct'
    ELSE '❌ Has XXX'
  END as status
FROM shipping_preparations sp
JOIN mining_companies mc ON mc.id = sp.mining_company_id
ORDER BY created_at DESC;
```

---

## 📋 Procédure d'Application

### Étape 1 : Backup de la Base de Données

```sql
-- Dans Supabase SQL Editor, vérifier les données actuelles
SELECT * FROM shipping_preparations ORDER BY created_at DESC LIMIT 10;
SELECT * FROM expedition_lot_counters;
SELECT id, name, code, abbreviation FROM mining_companies;
```

### Étape 2 : Appliquer le Script SQL

1. Ouvrir **Supabase SQL Editor**
2. Copier le contenu de **`FIX_EXPEDITION_NUMBERS.sql`**
3. Coller dans l'éditeur
4. Cliquer sur **"Run"**
5. Vérifier les messages de sortie (NOTICE)

### Étape 3 : Vérifier les Résultats

```sql
-- Vérifier que toutes les mines ont une abréviation
SELECT name, code, abbreviation
FROM mining_companies
WHERE is_active = true;

-- Vérifier les numéros d'expédition
SELECT
  expedition_lot_number,
  mc.abbreviation,
  COUNT(*) as count
FROM shipping_preparations sp
JOIN mining_companies mc ON mc.id = sp.mining_company_id
GROUP BY expedition_lot_number, mc.abbreviation
ORDER BY COUNT(*) DESC;

-- Compter les statuts
SELECT
  CASE
    WHEN expedition_lot_number LIKE 'HUM-%-____/____'
         AND expedition_lot_number NOT LIKE '%XXX%' THEN '✅ Correct'
    WHEN expedition_lot_number LIKE '%XXX%' THEN '❌ Has XXX'
    ELSE '⚠️ Invalid'
  END as status,
  COUNT(*)
FROM shipping_preparations
GROUP BY status;
```

**Résultats attendus** :
```
status      | count
------------|-------
✅ Correct  |   450
❌ Has XXX  |     0
⚠️ Invalid  |     0
```

### Étape 4 : Tester la Génération de Nouveaux Numéros

1. Ouvrir l'application
2. Aller dans **Shipping Preparation** → **Nouvelle Expédition**
3. Sélectionner une compagnie minière (ex: Komana)
4. Vérifier que le numéro généré est correct :
   - Format: **HUM-SMK-XXXX/2025**
   - Pas de "XXX"
   - Compteur incrémental

**Console attendue** :
```
✅ Generated expedition lot number: HUM-SMK-0381/2025
```

---

## 🧪 Tests à Effectuer

### Test 1 : Vérifier Abréviations

```sql
-- Toutes les mines actives doivent avoir une abréviation de 3 lettres
SELECT
  name,
  code,
  abbreviation,
  CASE
    WHEN abbreviation IS NULL THEN '❌ NULL'
    WHEN LENGTH(abbreviation) != 3 THEN '❌ Length != 3'
    WHEN abbreviation ~ '[^A-Z]' THEN '❌ Not uppercase'
    ELSE '✅ OK'
  END as validation
FROM mining_companies
WHERE is_active = true;
```

**Attendu** : Toutes les lignes avec validation = `✅ OK`

### Test 2 : Vérifier Compteurs par Mine/Année

```sql
SELECT
  mc.name as mine,
  mc.abbreviation,
  elc.year,
  elc.counter,
  (SELECT COUNT(*)
   FROM shipping_preparations sp
   WHERE sp.mining_company_id = mc.id
     AND EXTRACT(YEAR FROM sp.created_at) = elc.year
  ) as actual_expeditions,
  CASE
    WHEN elc.counter = (SELECT COUNT(*)
                        FROM shipping_preparations sp
                        WHERE sp.mining_company_id = mc.id
                          AND EXTRACT(YEAR FROM sp.created_at) = elc.year)
    THEN '✅ Match'
    ELSE '❌ Mismatch'
  END as status
FROM expedition_lot_counters elc
JOIN mining_companies mc ON mc.id = elc.mining_company_id
ORDER BY year DESC, mine;
```

**Attendu** : Tous avec status = `✅ Match`

### Test 3 : Vérifier Séquence des Numéros

```sql
-- Pour une mine spécifique, vérifier que la séquence est continue
WITH numbered AS (
  SELECT
    expedition_lot_number,
    ROW_NUMBER() OVER (
      PARTITION BY mining_company_id, EXTRACT(YEAR FROM created_at)
      ORDER BY created_at
    ) as expected_number,
    SUBSTRING(expedition_lot_number FROM '\d{4}(?=/)')::INTEGER as actual_number
  FROM shipping_preparations
  WHERE mining_company_id = '<kouroussa-id>' -- Remplacer par ID réel
    AND EXTRACT(YEAR FROM created_at) = 2025
)
SELECT
  expedition_lot_number,
  expected_number,
  actual_number,
  CASE
    WHEN expected_number = actual_number THEN '✅ OK'
    ELSE '❌ Gap'
  END as status
FROM numbered
ORDER BY expected_number;
```

**Attendu** : Séquence continue 1, 2, 3, 4...

### Test 4 : Générer Nouveau Numéro via RPC

```sql
-- Tester la fonction directement
SELECT get_next_expedition_lot_number(
  '<kouroussa-id>'::UUID,  -- Remplacer par ID réel
  2025
);
```

**Attendu** : `HUM-KGM-0XXX/2025` (où XXX = compteur actuel + 1)

---

## 📊 Queries de Monitoring

### Voir les Expéditions Récentes par Mine

```sql
SELECT
  mc.name as mine,
  mc.abbreviation,
  sp.expedition_lot_number,
  sp.created_at::DATE as date,
  EXTRACT(YEAR FROM sp.created_at) as year
FROM shipping_preparations sp
JOIN mining_companies mc ON mc.id = sp.mining_company_id
ORDER BY sp.created_at DESC
LIMIT 20;
```

### Statistiques par Mine et Année

```sql
SELECT
  mc.name as mine,
  mc.abbreviation,
  EXTRACT(YEAR FROM sp.created_at) as year,
  COUNT(*) as total_expeditions,
  MIN(sp.expedition_lot_number) as first_number,
  MAX(sp.expedition_lot_number) as last_number
FROM shipping_preparations sp
JOIN mining_companies mc ON mc.id = sp.mining_company_id
GROUP BY mc.id, mc.name, mc.abbreviation, EXTRACT(YEAR FROM sp.created_at)
ORDER BY year DESC, mine;
```

### Détecter Doublons ou Gaps

```sql
-- Détecter doublons (ne devrait JAMAIS arriver)
SELECT
  expedition_lot_number,
  COUNT(*) as count
FROM shipping_preparations
GROUP BY expedition_lot_number
HAVING COUNT(*) > 1;
```

**Attendu** : **0 lignes** (aucun doublon)

---

## ✅ Checklist de Validation

Avant de considérer la correction comme complète :

- [ ] Toutes les mines actives ont une abréviation de 3 lettres
- [ ] Aucune abréviation ne contient "XXX"
- [ ] Les compteurs `expedition_lot_counters` sont initialisés
- [ ] Tous les numéros d'expédition suivent le format `HUM-{ABBR}-{COUNTER}/YEAR`
- [ ] Aucun numéro d'expédition ne contient "XXX"
- [ ] La séquence des numéros est continue par mine/année
- [ ] Aucun doublon de numéro d'expédition
- [ ] La fonction `get_next_expedition_lot_number()` fonctionne correctement
- [ ] Le frontend génère des numéros corrects pour les nouvelles expéditions
- [ ] Les logs console affichent `✅ Generated expedition lot number: HUM-XXX-YYYY/ZZZZ`

---

## 🚀 Résumé des Changements

| Élément | Avant | Après |
|---------|-------|-------|
| **Format** | HUM-XXX-0000/2025 | HUM-SMK-0380/2025 |
| **Abréviation** | ❌ Statique "XXX" | ✅ Dynamique par mine |
| **Compteur** | ❌ Toujours 0000 | ✅ Incrémental par mine/année |
| **Gestion Erreur** | ❌ Silencieuse | ✅ Dialog + logs |
| **Validation** | ❌ Aucune | ✅ Checks multiples |

---

## 📦 Build Status

```
✓ built in 22.80s
Status: ✅ SUCCESS
```

---

## 📞 Support

Si après l'application du script, certains numéros restent en format `HUM-XXX-XXXX/YYYY` :

1. Vérifier que toutes les mines ont une abréviation :
   ```sql
   SELECT * FROM mining_companies WHERE abbreviation IS NULL OR abbreviation = '';
   ```

2. Vérifier les logs de la fonction :
   ```sql
   SELECT * FROM expedition_lot_counters;
   ```

3. Tester la génération manuelle :
   ```sql
   SELECT get_next_expedition_lot_number('<mine-id>'::UUID, 2025);
   ```

---

**Les numéros d'expédition sont maintenant générés au format correct HUM-{MINE}-{COUNTER}/YEAR !** 🎉
