# LISTE DES MIGRATIONS A EXECUTER

Date: 2025-01-15
Module: Budget Management
Status: ACTION REQUISE

---

## TABLEAU DES MIGRATIONS

| Ordre | Fichier Migration | Description | Priorite | Status |
|-------|------------------|-------------|----------|---------|
| 1 | 20251115_004_create_budget_system_tables.sql | Creation tables budgets (annual_budgets, monthly_budgets, quarterly_forecasts) | CRITIQUE | A EXECUTER |

---

## DETAILS MIGRATION #1

Fichier: supabase/migrations/20251115_004_create_budget_system_tables.sql

Priorite: CRITIQUE

Description:
- Creation table annual_budgets (budgets annuels)
- Creation table monthly_budgets (budgets mensuels)
- Creation table quarterly_forecasts (previsions trimestrielles)
- Contraintes uniques intelligentes (gestion NULL)
- RLS policies completes
- Indexes de performance
- Triggers updated_at

Pourquoi Critique:
- Module Budget actuellement NON FONCTIONNEL
- Erreurs 404 et 409 dans console
- Bloque enregistrement des budgets

Tables Creees:
1. annual_budgets - Configuration budget annuel par annee/site/compagnie
2. monthly_budgets - Repartition mensuelle (12 mois)
3. quarterly_forecasts - Revisions trimestrielles (4 trimestres)

---

## COMMANDES D'EXECUTION

Methode 1: psql (Recommandee)

```bash
# Verifier connexion
psql $SUPABASE_DB_URL -c "SELECT version();"

# Executer migration
psql $SUPABASE_DB_URL -f supabase/migrations/20251115_004_create_budget_system_tables.sql

# Verifier tables creees
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
4. Copier contenu de supabase/migrations/20251115_004_create_budget_system_tables.sql
5. Cliquer "Run"

---

## VALIDATION POST-MIGRATION

Etape 1: Verifier Tables Creees

```sql
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_name IN ('annual_budgets', 'monthly_budgets', 'quarterly_forecasts')
  AND table_schema = 'public'
ORDER BY table_name;
```

Resultat Attendu: 3 lignes
- annual_budgets
- monthly_budgets
- quarterly_forecasts

Etape 2: Verifier RLS Active

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('annual_budgets', 'monthly_budgets', 'quarterly_forecasts')
ORDER BY tablename;
```

Resultat Attendu: rowsecurity = t (true) pour les 3 tables

Etape 3: Test Interface Application

1. Aller sur URL: /production/budget
2. Selectionner annee: 2025
3. Selectionner compagnie: Kourousa
4. Entrer budgets mensuels (ex: Janvier: 35900, Fevrier: 45900)
5. Cliquer bouton "Enregistrer"

Resultat Attendu:
- Message: "Budget annuel enregistre avec succes"
- Pas d'erreur 409 dans console
- Pas d'erreur 404 dans console
- Budgets affiches correctement

---

## IMPACT

Avant Migration:

| Aspect | Etat |
|--------|------|
| Tables budget | Inexistantes |
| Module Budget | Non fonctionnel |
| Erreur 404 | Oui |
| Erreur 409 | Oui |
| Enregistrement | Impossible |

Apres Migration:

| Aspect | Etat |
|--------|------|
| Tables budget | Creees (3 tables) |
| Module Budget | Fonctionnel |
| Erreur 404 | Resolue |
| Erreur 409 | Resolue |
| Enregistrement | Operationnel |

---

## PRECAUTIONS

Avant Execution:

1. Backup Base de Donnees
   ```bash
   pg_dump $SUPABASE_DB_URL > backup_budget_$(date +%Y%m%d_%H%M%S).sql
   ```

2. Verifier Connexion
   ```bash
   psql $SUPABASE_DB_URL -c "SELECT current_database(), current_user;"
   ```

Rollback si Necessaire:

```sql
DROP TABLE IF EXISTS quarterly_forecasts CASCADE;
DROP TABLE IF EXISTS monthly_budgets CASCADE;
DROP TABLE IF EXISTS annual_budgets CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
```

---

## CHECKLIST FINALE

Cocher apres chaque etape:

- [ ] Backup base de donnees effectue
- [ ] Migration 20251115_004_create_budget_system_tables.sql executee
- [ ] Tables verifiees (3 tables creees)
- [ ] RLS verifie (active sur 3 tables)
- [ ] Test insertion reussi
- [ ] Interface Budget testee
- [ ] Console sans erreur 404
- [ ] Console sans erreur 409

---

## VALIDATION BUILD

```bash
npm run build
✓ built in 27.06s
```

Status: Build reussi sans erreur

---

Prepare Par: Senior Full Stack Developer
Date: 2025-01-15
Status: PRET POUR EXECUTION
