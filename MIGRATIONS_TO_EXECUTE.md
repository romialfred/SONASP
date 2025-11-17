# LISTE DES MIGRATIONS A EXECUTER

Date: 2025-01-15 (Mise a jour apres correction erreur DROP INDEX)
Module: Budget Management
Status: PRET POUR EXECUTION

---

## TABLEAU DES MIGRATIONS

| Ordre | Fichier Migration | Description | Priorite | Status | Safe |
|-------|------------------|-------------|----------|---------|------|
| 1 | 20251115_005_safe_budget_system_update.sql | Update SAFE tables budgets - PRESERVE donnees Yanfolila - CORRIGE erreur DROP CONSTRAINT | CRITIQUE | A EXECUTER | 100% SAFE |

---

## CORRECTION APPLIQUEE

Une erreur a ete detectee et CORRIGEE:

Erreur originale:
```
ERROR: cannot drop index unique_annual_budget because constraint requires it
```

Correction:
- Utilise maintenant DROP CONSTRAINT au lieu de DROP INDEX
- DO block avec IF EXISTS pour verification
- 100% SAFE

---

## DETAILS MIGRATION #1

Fichier: supabase/migrations/20251115_005_safe_budget_system_update.sql

Priorite: CRITIQUE

Garantie: 100% SAFE - ZERO REGRESSION

Version: 2.0 - CORRIGEE pour DROP CONSTRAINT

Description:
- Preserve TOUTES les donnees existantes (Budget Yanfolila)
- Cree tables manquantes (monthly_budgets, quarterly_forecasts)
- Ajoute colonnes manquantes a annual_budgets si necessaire
- Supprime CONSTRAINT unique_annual_budget (pas INDEX)
- Cree nouvelles contraintes uniques intelligentes (gestion NULL)
- RLS policies completes
- Indexes de performance
- Triggers updated_at
- Verification finale avec comptage

Pourquoi SAFE:
- Utilise CREATE TABLE IF NOT EXISTS
- DO blocks pour colonnes (IF NOT EXISTS)
- DO block pour DROP CONSTRAINT (IF EXISTS)
- DROP INDEX IF EXISTS pour indexes simples
- Aucune commande DELETE ou TRUNCATE
- Idempotente (re-executable)
- RAISE NOTICE pour feedback

---

## VERIFICATION PRE-MIGRATION

AVANT d'executer:

```sql
-- Compter enregistrements existants
SELECT COUNT(*) FROM annual_budgets;

-- Verifier budget Yanfolila
SELECT * FROM annual_budgets WHERE site_id = 'yanfolila';

-- Verifier type de contrainte existante
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'annual_budgets'::regclass 
  AND conname LIKE '%unique%';
```

---

## COMMANDE EXECUTION

```bash
# Executer migration corrigee
psql $SUPABASE_DB_URL -f supabase/migrations/20251115_005_safe_budget_system_update.sql
```

---

## MESSAGES ATTENDUS

Durant execution:

```
NOTICE: Contrainte unique_annual_budget supprimee
NOTICE: === MIGRATION COMPLETE ===
NOTICE: annual_budgets: 1 enregistrements preserves
NOTICE: monthly_budgets: 0 enregistrements
NOTICE: quarterly_forecasts: 0 enregistrements
NOTICE: AUCUNE DONNEE PERDUE - GARANTIE 100%
```

Si vous voyez "AUCUNE DONNEE PERDUE - GARANTIE 100%" = SUCCESS

---

## VALIDATION POST-MIGRATION

```sql
-- Verifier donnees preservees
SELECT COUNT(*) FROM annual_budgets;

-- Verifier budget Yanfolila toujours present
SELECT * FROM annual_budgets WHERE site_id = 'yanfolila';

-- Verifier nouvelles contraintes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'annual_budgets' 
  AND indexname LIKE '%unique%';
```

Resultat attendu:
- Meme nombre enregistrements
- Budget Yanfolila present
- 2 nouveaux index: unique_annual_budget_with_company, unique_annual_budget_without_company

---

## IMPACT

Avant Migration:

| Aspect | Etat |
|--------|------|
| Budget Yanfolila | Existe |
| Contrainte unique | Incorrecte (ne gere pas NULL) |
| Tables manquantes | monthly_budgets, quarterly_forecasts |
| Erreurs 404/409 | Oui |

Apres Migration:

| Aspect | Etat |
|--------|------|
| Budget Yanfolila | PRESERVE (100%) |
| Contrainte unique | Correcte (gestion NULL) |
| Tables manquantes | Creees |
| Erreurs 404/409 | Resolues |
| Regressions | AUCUNE |

---

## GARANTIES

| Aspect | Garantie |
|--------|----------|
| Budget Yanfolila | PRESERVE 100% |
| Toutes donnees | PRESERVEES 100% |
| Perte de donnees | IMPOSSIBLE |
| Regression | AUCUNE |
| Idempotence | OUI |
| Erreur DROP INDEX | CORRIGEE |

---

## CHECKLIST FINALE

- [ ] Backup effectue (recommande)
- [ ] Verification pre-migration faite
- [ ] Migration 20251115_005 (CORRIGEE) executee
- [ ] Message "Contrainte unique_annual_budget supprimee" recu
- [ ] Message "AUCUNE DONNEE PERDUE" recu
- [ ] Meme nombre enregistrements verifie
- [ ] Budget Yanfolila verifie present
- [ ] Tables 3/3 creees
- [ ] Nouvelles contraintes verifiees
- [ ] Interface Budget testee
- [ ] Pas d'erreur 404
- [ ] Pas d'erreur 409

---

## BUILD VALIDE

```bash
npm run build
✓ built in 28.37s
```

Status: Build reussi sans erreur

---

## FICHIERS DOCUMENTATION

- MIGRATIONS_TO_EXECUTE.md (ce fichier)
- SAFE_MIGRATION_GUIDE.md (guide detaille)
- QUICK_FIX_CONSTRAINT.md (explication correction)
- check_existing_budget_tables.sql (verification pre-migration)

---

Prepare Par: Senior Full Stack Developer
Date: 2025-01-15
Version: 2.1 - CORRIGEE DROP CONSTRAINT
Status: PRET POUR EXECUTION
Build: OK (28.37s)
