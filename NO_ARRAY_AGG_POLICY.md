# ⛔ INTERDICTION STRICTE DE array_agg

## 🚨 RÈGLE ABSOLUE : NE JAMAIS UTILISER array_agg

La fonction `array_agg()` est **STRICTEMENT INTERDITE** dans ce projet.

### ❌ Ne JAMAIS utiliser :
```sql
-- INTERDIT
array_agg(column_name)
array_agg(DISTINCT column_name)
array_agg(column_name ORDER BY something)
```

### ✅ Alternatives Autorisées

#### 1. Pour aggréger des valeurs en texte
```sql
-- ✅ Utiliser string_agg
string_agg(column_name, ', ')
string_agg(column_name, ', ' ORDER BY column_name)
string_agg(DISTINCT column_name, ', ')
```

#### 2. Pour compter des valeurs
```sql
-- ✅ Utiliser COUNT
COUNT(column_name)
COUNT(DISTINCT column_name)
```

#### 3. Pour vérifier des valeurs d'ENUM
```sql
-- ❌ INTERDIT
SELECT array_agg(enumlabel ORDER BY enumsortorder)
FROM pg_enum;

-- ✅ CORRECT - Méthode 1: Liste avec string_agg
SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder) as enum_values
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'mon_enum');

-- ✅ CORRECT - Méthode 2: Lignes séparées
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'mon_enum')
ORDER BY enumsortorder;

-- ✅ CORRECT - Méthode 3: JSON
SELECT json_agg(enumlabel ORDER BY enumsortorder) as enum_values
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'mon_enum');
```

#### 4. Pour les Foreign Keys
```sql
-- ❌ INTERDIT
SELECT table_name, array_agg(DISTINCT fk_table) as foreign_keys
FROM constraints
GROUP BY table_name;

-- ✅ CORRECT - Méthode 1: string_agg
SELECT table_name, string_agg(DISTINCT fk_table, ', ') as foreign_keys
FROM constraints
GROUP BY table_name;

-- ✅ CORRECT - Méthode 2: Requêtes séparées
SELECT table_name, fk_table
FROM constraints
ORDER BY table_name, fk_table;
```

#### 5. Pour les vérifications de diagnostic
```sql
-- ❌ INTERDIT
SELECT
  typname,
  array_agg(enumlabel) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
GROUP BY typname;

-- ✅ CORRECT
SELECT
  typname,
  string_agg(enumlabel, ', ' ORDER BY enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('production_status_v2', 'shipping_status_v2')
GROUP BY typname;
```

## 🔍 Remplacement Automatique

Si vous trouvez `array_agg` dans le code, remplacez-le immédiatement :

### Règle de remplacement simple :
```
array_agg(X)           → string_agg(X, ', ')
array_agg(X ORDER BY Y) → string_agg(X, ', ' ORDER BY Y)
array_agg(DISTINCT X)   → string_agg(DISTINCT X, ', ')
```

## 📋 Checklist avant tout commit

Avant de créer ou modifier un fichier SQL :

- [ ] Rechercher `array_agg` dans le fichier
- [ ] Remplacer par `string_agg` ou une alternative
- [ ] Tester la requête
- [ ] Confirmer qu'aucun `array_agg` n'est présent

## 🚀 Commande de vérification

Pour vérifier qu'aucun `array_agg` n'est présent dans les migrations actives :

```bash
# Rechercher array_agg dans les migrations
grep -r "array_agg" supabase/migrations/*.sql

# Si des résultats apparaissent : CORRIGER IMMÉDIATEMENT
```

## 📝 Raison de cette interdiction

La fonction `array_agg` cause des erreurs dans Supabase :
- Erreur 42809: "array_agg" is an aggregate function
- Incompatibilités avec certaines configurations
- Problèmes de permissions RLS

**Solution :** Utiliser `string_agg` qui est plus stable et compatible.

## ⚠️ Fichiers à NE JAMAIS utiliser comme référence

Ces fichiers contiennent `array_agg` et sont OBSOLÈTES :

- `supabase/migrations/20251113_004_fix_shipping_status_enum.sql`
- `supabase/migrations/20251113_005_fix_shipping_table_definitive.sql`
- `supabase/migrations/20251114_009_fix_shipping_workflow_statuses.sql`
- `supabase/migrations/20251114_010_remove_old_shipping_constraints.sql`
- `supabase/migrations/20251114_011_fix_shipping_enum_definitif.sql`
- `scripts/verify-shipping-enum-final.sql`
- `scripts/analyze-and-generate-delete-order.sql`

**Ces fichiers doivent être corrigés ou supprimés.**

---

**Date de création :** 2025-12-10
**Règle stricte :** JAMAIS de array_agg dans ce projet
**Alternative principale :** string_agg
