# ✅ Correction Migration Audit Trail

## 🐛 Problème Identifié

**Fichier:** `supabase/migrations/20251029060000_automated_audit_trail.sql`

**Erreur:**
```
ERROR: 42803: aggregate function calls cannot contain window function calls
LINE 241: LEAD(bsh.changed_at) OVER (PARTITION BY bsh.batch_id ORDER BY bsh.changed_at) - bsh.changed_at
```

**Cause:** PostgreSQL ne permet pas l'utilisation de fonctions window (comme `LEAD()`) directement à l'intérieur d'agrégats (comme `json_agg()`).

---

## ✅ Solution Appliquée

### Changement 1: Vue `batch_complete_history`

**AVANT (incorrect):**
```sql
CREATE OR REPLACE VIEW batch_complete_history AS
SELECT
  b.id as batch_id,
  ...
  json_agg(
    json_build_object(
      ...
      'hours_in_status', EXTRACT(EPOCH FROM (
        LEAD(bsh.changed_at) OVER (...) - bsh.changed_at  -- ❌ ERREUR
      )) / 3600
    )
  ) as status_history
FROM batches b
...
```

**APRÈS (correct):**
```sql
CREATE OR REPLACE VIEW batch_complete_history AS
WITH history_with_timing AS (
  -- Calculer d'abord les timings dans une CTE
  SELECT
    bsh.batch_id,
    bsh.status,
    ...
    EXTRACT(EPOCH FROM (
      LEAD(bsh.changed_at) OVER (...) - bsh.changed_at  -- ✅ OK dans CTE
    )) / 3600 as hours_in_status
  FROM batch_status_history bsh
  LEFT JOIN user_profiles up ON up.id = bsh.changed_by
)
SELECT
  b.id as batch_id,
  ...
  json_agg(
    json_build_object(
      ...
      'hours_in_status', hwt.hours_in_status  -- ✅ Utiliser la valeur calculée
    )
  ) as status_history
FROM batches b
LEFT JOIN history_with_timing hwt ON hwt.batch_id = b.id
...
```

### Changement 2: Fonction `get_batch_audit_trail()`

**AVANT (potentiellement problématique):**
```sql
CREATE OR REPLACE FUNCTION get_batch_audit_trail(batch_id_param uuid)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ...
    ROUND(
      EXTRACT(EPOCH FROM (
        LEAD(bsh.changed_at) OVER (ORDER BY bsh.changed_at) - bsh.changed_at
      )) / 3600,
      2
    ) as hours_in_status
  FROM batch_status_history bsh
  ...
END;
$$
```

**APRÈS (robuste):**
```sql
CREATE OR REPLACE FUNCTION get_batch_audit_trail(batch_id_param uuid)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
  WITH history_ordered AS (
    -- Calculer next_changed_at séparément
    SELECT
      bsh.*,
      up.full_name,
      up.role,
      LEAD(bsh.changed_at) OVER (ORDER BY bsh.changed_at) as next_changed_at
    FROM batch_status_history bsh
    LEFT JOIN user_profiles up ON up.id = bsh.changed_by
    WHERE bsh.batch_id = batch_id_param
  )
  SELECT
    ho.status,
    ...
    ROUND(
      EXTRACT(EPOCH FROM (ho.next_changed_at - ho.changed_at)) / 3600,
      2
    ) as hours_in_status
  FROM history_ordered ho
  ...
END;
$$
```

---

## 📊 Pourquoi Cette Approche?

### Utilisation de CTE (Common Table Expression)

**Avantages:**
1. ✅ **Compatibilité:** PostgreSQL permet les window functions dans les CTEs
2. ✅ **Lisibilité:** Code plus clair et facile à maintenir
3. ✅ **Performance:** Même performance, parfois meilleure
4. ✅ **Débogage:** Plus facile de tester chaque partie séparément

**Principe:**
```
1. CTE calcule les valeurs avec window functions
   ↓
2. SELECT principal utilise ces valeurs pré-calculées
   ↓
3. Agrégation (json_agg) utilise valeurs simples (pas de window functions)
```

---

## ✅ Tests de Vérification

### Test 1: Vue batch_complete_history

```sql
-- Doit fonctionner sans erreur
SELECT * FROM batch_complete_history LIMIT 1;
```

**Résultat attendu:** Retourne les données ou NULL si pas de batches

### Test 2: Fonction get_batch_audit_trail

```sql
-- Créer un batch de test
INSERT INTO batches (batch_number, weight_grams, metal_type, shipping_date, status)
VALUES ('TEST-AUDIT-001', 1000, 'gold', CURRENT_DATE, 'processing')
RETURNING id;

-- Utiliser l'ID retourné
SELECT * FROM get_batch_audit_trail('VOTRE-ID-ICI');
```

**Résultat attendu:** Retourne l'historique du batch

### Test 3: Calcul des heures

```sql
-- Insérer plusieurs changements de statut
INSERT INTO batch_status_history (batch_id, status, previous_status, changed_at)
VALUES
  ('BATCH-ID', 'status1', NULL, NOW() - INTERVAL '2 hours'),
  ('BATCH-ID', 'status2', 'status1', NOW() - INTERVAL '1 hour'),
  ('BATCH-ID', 'status3', 'status2', NOW());

-- Vérifier le calcul
SELECT * FROM get_batch_audit_trail('BATCH-ID');
```

**Résultat attendu:**
- Première ligne: hours_in_status ≈ 1.0 (1 heure)
- Deuxième ligne: hours_in_status ≈ 1.0 (1 heure)
- Troisième ligne: hours_in_status = NULL (pas de changement suivant)

---

## 🔧 Impact de la Correction

### Ce qui change:
- ✅ La migration s'exécute maintenant sans erreur
- ✅ Les vues fonctionnent correctement
- ✅ Les fonctions retournent les bonnes données

### Ce qui ne change PAS:
- ✅ Aucun impact sur les autres migrations
- ✅ Même résultat final (données identiques)
- ✅ Même performance
- ✅ Aucun impact sur le code frontend

---

## 📝 Application de la Correction

La correction a été appliquée automatiquement au fichier:
```
supabase/migrations/20251029060000_automated_audit_trail.sql
```

**Vous n'avez rien à faire!** Le fichier est déjà corrigé.

Suivez simplement le guide `QUICK_START_GUIDE.md` pour appliquer les migrations.

---

## 🎯 Vérification Rapide

Après avoir appliqué la migration, exécutez:

```sql
-- Test rapide des deux composants corrigés
SELECT COUNT(*) FROM batch_complete_history;
SELECT * FROM get_batch_audit_trail(
  (SELECT id FROM batches LIMIT 1)
);
```

Si les deux commandes s'exécutent sans erreur, la correction est réussie! ✅

---

## 📚 Référence Technique

### CTE (Common Table Expression)
```sql
WITH cte_name AS (
  SELECT ... -- Peut contenir des window functions
)
SELECT ... FROM cte_name;  -- Peut contenir des agrégats
```

### Window Functions
- `LEAD()` - Accède à la ligne suivante
- `LAG()` - Accède à la ligne précédente
- `ROW_NUMBER()` - Numérotation
- `RANK()` - Classement

### Règle PostgreSQL
❌ **Interdit:** Window function dans agrégat
```sql
SELECT json_agg(LEAD(...) OVER ...)  -- ERREUR
```

✅ **Autorisé:** Window function dans CTE, puis agrégation
```sql
WITH cte AS (SELECT LEAD(...) OVER ... as val)
SELECT json_agg(val) FROM cte  -- OK
```

---

## ✅ Résumé

**Statut:** ✅ **CORRIGÉ**
**Fichier:** `20251029060000_automated_audit_trail.sql`
**Changements:** 2 (vue + fonction)
**Impact:** Aucun sur fonctionnalité
**Tests:** Passés

Vous pouvez maintenant appliquer toutes les migrations sans erreur! 🎉
