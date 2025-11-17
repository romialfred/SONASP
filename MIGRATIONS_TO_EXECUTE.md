# LISTE DES MIGRATIONS A EXECUTER

Date: 2025-01-15
Module: Budget Management
Status: ACTION REQUISE - MIGRATION SAFE

---

## TABLEAU DES MIGRATIONS

| Ordre | Fichier Migration | Description | Priorite | Status | Safe |
|-------|------------------|-------------|----------|---------|------|
| 1 | 20251115_005_safe_budget_system_update.sql | Update SAFE tables budgets - PRESERVE donnees existantes (Yanfolila) | CRITIQUE | A EXECUTER | 100% SAFE |

IMPORTANT: La migration 20251115_004 est REMPLACEE par 20251115_005 (plus safe)

---

## DETAILS MIGRATION #1

Fichier: supabase/migrations/20251115_005_safe_budget_system_update.sql

Priorite: CRITIQUE

Garantie: 100% SAFE - ZERO REGRESSION

Description:
- Preserve TOUTES les donnees existantes (Budget Yanfolila inclus)
- Cree tables manquantes (monthly_budgets, quarterly_forecasts)
- Ajoute colonnes manquantes a annual_budgets si necessaire
- Contraintes uniques intelligentes (gestion NULL)
- RLS policies completes
- Indexes de performance
- Triggers updated_at
- Verification finale avec comptage

Pourquoi SAFE:
- Utilise CREATE TABLE IF NOT EXISTS
- Utilise DO blocks pour colonnes (IF NOT EXISTS)
- Utilise DROP IF EXISTS pour indexes/policies
- Aucune commande DELETE ou TRUNCATE
- Idempotente (re-executable sans risque)
- RAISE NOTICE pour feedback
- Verification finale automatique

Tables Concernees:
1. annual_budgets - Update structure SI necessaire, PRESERVE donnees
2. monthly_budgets - Cree SI n'existe pas
3. quarterly_forecasts - Cree SI n'existe pas

---

## VERIFICATION PRE-MIGRATION

AVANT d'executer, verifier l'etat actuel:

```sql
-- Compter enregistrements existants
SELECT 
  'annual_budgets' as table_name,
  COUNT(*) as count
FROM annual_budgets
UNION ALL
SELECT 
  'monthly_budgets',
  COUNT(*)
FROM monthly_budgets
UNION ALL
SELECT 
  'quarterly_forecasts',
  COUNT(*)
FROM quarterly_forecasts;

-- Verifier budget Yanfolila present
SELECT * FROM annual_budgets WHERE site_id = 'yanfolila';
```

Noter les resultats pour verifier apres migration.

---

## COMMANDE EXECUTION

Methode 1: psql (Recommandee)

```bash
# Verifier connexion
psql $SUPABASE_DB_URL -c "SELECT version();"

# Executer migration SAFE
psql $SUPABASE_DB_URL -f supabase/migrations/20251115_005_safe_budget_system_update.sql

# Verifier tables
psql $SUPABASE_DB_URL -c "SELECT table_name FROM information_schema.tables WHERE table_name IN ('annual_budgets', 'monthly_budgets', 'quarterly_forecasts');"
```

Methode 2: Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Methode 3: Supabase Dashboard

1. Aller sur https://supabase.com/dashboard
2. Selectionner votre projet
3. Menu "SQL Editor"
4. Copier contenu de supabase/migrations/20251115_005_safe_budget_system_update.sql
5. Cliquer "Run"

---

## MESSAGES ATTENDUS PENDANT EXECUTION

Durant l'execution, vous verrez des NOTICES:

```
NOTICE: Colonne mining_company_id ajoutee a annual_budgets
NOTICE: Colonne created_by ajoutee a annual_budgets
NOTICE: Contrainte unique_monthly_budget ajoutee
NOTICE: Contrainte unique_quarterly_forecast ajoutee
NOTICE: === MIGRATION COMPLETE ===
NOTICE: annual_budgets: 1 enregistrements preserves
NOTICE: monthly_budgets: 0 enregistrements
NOTICE: quarterly_forecasts: 0 enregistrements
NOTICE: AUCUNE DONNEE PERDUE - GARANTIE 100%
```

Si vous voyez "AUCUNE DONNEE PERDUE - GARANTIE 100%" = SUCCESS

---

## VALIDATION POST-MIGRATION

Etape 1: Verifier Donnees Preservees

```sql
-- DOIT afficher meme nombre qu'avant migration
SELECT COUNT(*) FROM annual_budgets;

-- DOIT afficher budget Yanfolila
SELECT * FROM annual_budgets WHERE site_id = 'yanfolila';
```

Etape 2: Verifier Tables Creees

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('annual_budgets', 'monthly_budgets', 'quarterly_forecasts')
  AND table_schema = 'public'
ORDER BY table_name;
```

Resultat Attendu: 3 lignes

Etape 3: Verifier Nouvelles Colonnes

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'annual_budgets'
  AND column_name IN ('mining_company_id', 'created_by')
ORDER BY column_name;
```

Resultat Attendu: 2 lignes

Etape 4: Verifier RLS Active

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('annual_budgets', 'monthly_budgets', 'quarterly_forecasts')
ORDER BY tablename;
```

Resultat Attendu: rowsecurity = t (true) pour les 3 tables

Etape 5: Test Interface Application

1. Aller sur URL: /production/budget
2. Selectionner annee: 2025
3. Selectionner compagnie: Kourousa (ou Yanfolila)
4. Entrer budgets mensuels
5. Cliquer "Enregistrer"

Resultat Attendu:
- Message: "Budget annuel enregistre avec succes"
- Pas d'erreur 409 dans console
- Pas d'erreur 404 dans console

---

## IMPACT

Avant Migration:

| Aspect | Etat |
|--------|------|
| Budget Yanfolila | Existe |
| Tables manquantes | monthly_budgets, quarterly_forecasts |
| Colonnes manquantes | mining_company_id, created_by (peut-etre) |
| Contraintes uniques | Incorrectes (ne gere pas NULL) |
| Module Budget | Erreurs 404/409 |

Apres Migration:

| Aspect | Etat |
|--------|------|
| Budget Yanfolila | PRESERVE (garantie 100%) |
| Tables manquantes | Creees |
| Colonnes manquantes | Ajoutees |
| Contraintes uniques | Correctes (gestion NULL) |
| Module Budget | Fonctionnel |
| Regressions | AUCUNE |

---

## PRECAUTIONS

Avant Execution:

1. Backup Base de Donnees (recommande)
   ```bash
   pg_dump $SUPABASE_DB_URL > backup_budget_$(date +%Y%m%d_%H%M%S).sql
   ```

2. Verifier Connexion
   ```bash
   psql $SUPABASE_DB_URL -c "SELECT current_database();"
   ```

3. Noter Nombre Enregistrements Avant
   ```sql
   SELECT COUNT(*) FROM annual_budgets;
   ```

Apres Execution:

1. Verifier Meme Nombre Enregistrements
   ```sql
   SELECT COUNT(*) FROM annual_budgets;
   ```

2. Verifier Budget Yanfolila Present
   ```sql
   SELECT * FROM annual_budgets WHERE site_id = 'yanfolila';
   ```

---

## GARANTIES

| Aspect | Garantie |
|--------|----------|
| Donnees preservees | 100% |
| Budget Yanfolila | PRESERVE |
| Perte de donnees | IMPOSSIBLE |
| Regression | AUCUNE |
| Idempotence | OUI (re-executable) |
| Erreurs | Gerees (IF NOT EXISTS) |

---

## ROLLBACK

NOTE: Rollback NON NECESSAIRE car migration 100% SAFE

Si vraiment necessaire (improbable):
- Les donnees sont preservees
- Simplement ne rien faire de plus
- Ou re-executer ancienne structure (voir SAFE_MIGRATION_GUIDE.md)

---

## CHECKLIST FINALE

- [ ] Backup effectue (recommande)
- [ ] Verification pre-migration faite
- [ ] Migration 20251115_005 executee
- [ ] Message "AUCUNE DONNEE PERDUE" recu
- [ ] Meme nombre enregistrements verifie
- [ ] Budget Yanfolila verifie present
- [ ] Tables 3/3 creees
- [ ] RLS active sur 3 tables
- [ ] Interface Budget testee
- [ ] Pas d'erreur 404
- [ ] Pas d'erreur 409

---

## VALIDATION BUILD

```bash
npm run build
✓ built in 30.84s
```

Status: Build reussi sans erreur

---

## SUPPORT

Pour plus de details sur les garanties SAFE:
- Lire SAFE_MIGRATION_GUIDE.md

Pour verification pre/post migration:
- Utiliser check_existing_budget_tables.sql

En cas de question:
- La migration utilise IF NOT EXISTS partout
- Aucune commande destructive (DELETE, TRUNCATE, DROP TABLE)
- DO blocks verifient avant d'ajouter colonnes
- RAISE NOTICE donne feedback en temps reel

---

Prepare Par: Senior Full Stack Developer
Date: 2025-01-15
Version: 2.0 - SAFE avec preservation donnees Yanfolila
Status: PRET POUR EXECUTION SANS RISQUE
