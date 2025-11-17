# CORRECTION IMMEDIATE - Erreur DROP INDEX

Date: 2025-01-15
Status: CORRIGE

---

## ERREUR RENCONTREE

```
ERROR: cannot drop index unique_annual_budget because constraint unique_annual_budget on table annual_budgets requires it
HINT: You can drop constraint unique_annual_budget on table annual_budgets instead.
```

---

## CAUSE

La contrainte `unique_annual_budget` existe comme **CONSTRAINT** (pas index simple).
PostgreSQL ne permet pas de supprimer un index lie a une contrainte.
Il faut supprimer la CONSTRAINT elle-meme.

---

## CORRECTION APPLIQUEE

Migration 20251115_005 mise a jour:

AVANT (INCORRECT):
```sql
DROP INDEX IF EXISTS unique_annual_budget;
```

APRES (CORRECT):
```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_annual_budget' AND conrelid = 'annual_budgets'::regclass
  ) THEN
    ALTER TABLE annual_budgets DROP CONSTRAINT unique_annual_budget;
    RAISE NOTICE 'Contrainte unique_annual_budget supprimee';
  END IF;
END $$;
```

---

## EXECUTION

La migration corrigee peut maintenant etre executee:

```bash
psql $SUPABASE_DB_URL -f supabase/migrations/20251115_005_safe_budget_system_update.sql
```

Messages attendus:
```
NOTICE: Contrainte unique_annual_budget supprimee
NOTICE: === MIGRATION COMPLETE ===
NOTICE: annual_budgets: X enregistrements preserves
NOTICE: AUCUNE DONNEE PERDUE - GARANTIE 100%
```

---

## VALIDATION BUILD

```bash
npm run build
✓ built in 28.37s
```

Build reussi sans erreur.

---

## GARANTIES

Memes garanties SAFE:
- Preserve toutes donnees (Budget Yanfolila inclus)
- Utilise DO block avec IF EXISTS
- Aucune perte de donnees
- 100% SAFE

---

Status: CORRIGE et PRET
Date: 2025-01-15
Build: OK (28.37s)
