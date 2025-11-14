# 🔍 Guide: Analyse des Foreign Keys

## Problème: "Success. No rows returned"

Ce message signifie que le script avec `RAISE NOTICE` affiche les informations dans les **LOGS**, pas dans les résultats.

## ✅ Solution Simple: Nouveau Script

### Étape 1: Exécuter ce Script

**Fichier:** `scripts/analyze-fk-simple.sql`

Dans Supabase SQL Editor, copiez et exécutez:

```sql
SELECT
  tc.table_name as table_enfant,
  kcu.column_name as colonne_enfant,
  ccu.table_name AS table_parent,
  ccu.column_name AS colonne_parent,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY ccu.table_name, tc.table_name;
```

### Étape 2: Copier TOUS les Résultats

Vous devriez voir une table comme:

```
table_enfant          | colonne_enfant    | table_parent         | colonne_parent
---------------------|-------------------|----------------------|----------------
payments             | sale_id           | sales                | id
sales                | customer_id       | customers            | id
shipping_preparations| license_id        | export_licenses      | id
inventory            | production_id     | daily_production     | id
...
```

**COPIEZ TOUTES LES LIGNES** et partagez-les avec moi.

## Alternative: Voir les Logs dans Supabase

Si vous voulez voir les résultats du premier script (avec RAISE NOTICE):

1. Dans Supabase SQL Editor
2. Après exécution, regardez l'onglet **"Messages"** ou **"Logs"** (en bas)
3. Vous y verrez tous les `RAISE NOTICE`

## Ce Dont J'ai Besoin

**Format idéal:**

```
table_enfant          | colonne_enfant    | table_parent
---------------------|-------------------|----------------------
payments             | sale_id           | sales
virtual_payments     | payment_id        | payments
sales                | customer_id       | customers
inventory            | production_id     | daily_production
shipping_preparations| license_id        | export_licenses
...
```

Avec cette information, je pourrai créer l'ordre de suppression PARFAIT!

## Temps Estimé

- Exécution script: 2 secondes
- Copie résultats: 30 secondes
- Création script final: 10 minutes
- **Total: ~11 minutes pour solution parfaite**

---

**Prêt à essayer avec le nouveau script?** `scripts/analyze-fk-simple.sql`
