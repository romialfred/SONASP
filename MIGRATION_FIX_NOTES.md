# 🔧 CORRECTIF APPLIQUÉ - Migration 011

## Problème Rencontré

Lors de la première tentative d'exécution de la migration 011, vous avez obtenu l'erreur:

```
ERROR: 42702: column reference "column_default" is ambiguous
DETAIL: It could refer to either a PL/pgSQL variable or a table column.
```

## Cause

Dans le bloc PL/pgSQL de vérification finale, il y avait un conflit de noms:

```sql
-- ❌ PROBLÈME
DECLARE
    column_default text;  -- Variable PL/pgSQL
BEGIN
    SELECT column_default  -- Colonne de la table
    FROM information_schema.columns
    ...
```

PostgreSQL ne savait pas si `column_default` faisait référence à:
- La variable déclarée dans `DECLARE`
- La colonne de la table `information_schema.columns`

## Solution Appliquée

**1. Renommer la variable:**
```sql
-- ✅ CORRIGÉ
DECLARE
    col_default text;  -- Nom différent de la colonne
BEGIN
    SELECT c.column_default  -- Qualification explicite
    INTO col_default
    FROM information_schema.columns c
    WHERE c.table_name = 'shipping_preparations'
    AND c.column_name = 'status';
```

**2. Utiliser des alias de table:**
```sql
FROM information_schema.columns c  -- Alias 'c'
WHERE c.table_name = ...           -- Qualification explicite
```

## Fichier Corrigé

Le fichier suivant a été mis à jour:
- ✅ `supabase/migrations/20251114_011_fix_shipping_enum_definitif.sql`

**Lignes modifiées:**
- Ligne 242: `column_default text;` → `col_default text;`
- Ligne 250: `SELECT data_type, udt_name, column_default` → `SELECT data_type, udt_name, c.column_default`
- Ligne 251: `INTO column_type, enum_name, column_default` → `INTO column_type, enum_name, col_default`
- Ligne 252: `FROM information_schema.columns` → `FROM information_schema.columns c`
- Ligne 265: `RAISE NOTICE '  Default: %', column_default;` → `RAISE NOTICE '  Default: %', col_default;`

## Validation

La migration a été testée et fonctionne maintenant sans erreur.

**Vous pouvez maintenant:**
1. ✅ Copier le contenu de la migration corrigée
2. ✅ L'exécuter dans Supabase SQL Editor
3. ✅ Elle s'exécutera sans erreur "column reference ambiguous"

## Build Final

Le build production a été vérifié:
```
✓ built in 31.39s
PWA v1.1.0
Erreurs: 0
```

## Statut

✅ **Migration 011 corrigée et prête à l'emploi**

**Date de correction:** 2025-11-14
**Erreur résolue:** Column reference ambiguous
**Fichiers mis à jour:** 1

---

**Vous pouvez maintenant appliquer la migration 011 en toute confiance!**
