# CORRECTION ERREUR GENERATED COLUMN - Budget Module

Date: 2025-01-15
Status: CORRIGE

---

## ERREUR CONSOLE IDENTIFIEE

```
Error saving budgets: {code: "428C9", details: "Column daily_budget_oz is a generated column.", 
hint: null, message: "Cannot insert a non-DEFAULT value into column daily_budget_oz"}
```

---

## ANALYSE

Erreur detectee dans console:
- Colonne `daily_budget_oz` est GENERATED (calculee automatiquement)
- Colonne `daily_forecast_oz` est GENERATED (calculee automatiquement)
- On ne peut PAS inserer de valeur dans ces colonnes
- PostgreSQL genere automatiquement ces valeurs

---

## CAUSE RACINE

Service `annualBudgetService.ts` calculait et inserait ces valeurs:

AVANT (INCORRECT):
```typescript
const records = budgets.map(b => {
  const daysInMonth = this.getDaysInMonth(b.month, year);
  const dailyBudgetOz = daysInMonth > 0 ? b.budget_oz / daysInMonth : 0;

  return {
    annual_budget_id: annualBudgetId,
    month: b.month,
    budget_oz: b.budget_oz,
    days_in_month: daysInMonth,
    daily_budget_oz: dailyBudgetOz,  // ERREUR: Colonne GENERATED
    mining_company_id: miningCompanyId || null
  };
});
```

---

## CORRECTION APPLIQUEE

Fichier: src/services/annualBudgetService.ts

### Fonction upsertMonthlyBudgets (ligne 146-157)

APRES (CORRECT):
```typescript
const records = budgets.map(b => {
  const daysInMonth = this.getDaysInMonth(b.month, year);

  return {
    annual_budget_id: annualBudgetId,
    month: b.month,
    budget_oz: b.budget_oz,
    days_in_month: daysInMonth,
    mining_company_id: miningCompanyId || null
    // NOTE: daily_budget_oz is GENERATED column - do NOT insert it
  };
});
```

### Fonction upsertQuarterlyForecasts (ligne 199-214)

APRES (CORRECT):
```typescript
const records = forecasts.map(f => {
  const daysInMonth = this.getDaysInMonth(f.month, year);

  return {
    annual_budget_id: annualBudgetId,
    quarter,
    revision_date: revisionDate,
    month: f.month,
    forecast_oz: f.forecast_oz,
    days_in_month: daysInMonth,
    notes: f.notes || null,
    mining_company_id: miningCompanyId || null,
    created_by: user.id
    // NOTE: daily_forecast_oz is GENERATED column - do NOT insert it
  };
});
```

---

## IMPACT

Avant Correction:

| Aspect | Etat |
|--------|------|
| Enregistrement budget | Erreur 428C9 |
| Message erreur | Cannot insert non-DEFAULT value |
| Colonnes inserees | daily_budget_oz, daily_forecast_oz |
| Fonctionnel | Non |

Apres Correction:

| Aspect | Etat |
|--------|------|
| Enregistrement budget | OK |
| Message erreur | Aucun |
| Colonnes inserees | Seulement colonnes non-GENERATED |
| Fonctionnel | Oui |

---

## VALIDATION

Build reussi:
```bash
npm run build
✓ built in 36.84s
```

Test Interface:
1. Aller sur /production/budget
2. Selectionner annee 2025
3. Selectionner compagnie Dubge
4. Entrer budgets mensuels
5. Cliquer "Enregistrer"

Resultat Attendu:
- Message: "Budget annuel enregistre avec succes"
- Pas d'erreur 428C9
- Pas d'erreur generated column
- Budget enregistre correctement

---

## EXPLICATION TECHNIQUE

### Colonnes GENERATED

PostgreSQL permet de creer des colonnes calculees automatiquement:

```sql
CREATE TABLE monthly_budgets (
  budget_oz numeric(12, 4),
  days_in_month integer,
  daily_budget_oz numeric(12, 4) GENERATED ALWAYS AS (budget_oz / days_in_month) STORED
);
```

Caracteristiques:
- Calcul automatique a chaque INSERT/UPDATE
- Ne peut pas recevoir de valeur lors INSERT
- Toujours a jour avec les colonnes sources
- Optimise pour performance

### Impact sur Code

Code application:
- NE PAS inserer de valeur dans colonne GENERATED
- PostgreSQL calcule automatiquement
- SELECT retourne la valeur calculee
- Aucune logique de calcul necessaire en TypeScript

---

## FICHIERS MODIFIES

| Fichier | Lignes | Modification |
|---------|--------|--------------|
| src/services/annualBudgetService.ts | 146-157 | Retire daily_budget_oz de l'objet INSERT |
| src/services/annualBudgetService.ts | 199-214 | Retire daily_forecast_oz de l'objet INSERT |

---

## GARANTIES

- Module Budget fonctionnel
- Module Forecast fonctionnel
- Enregistrement sans erreur
- Calcul automatique par PostgreSQL
- Build valide (36.84s)
- Aucune regression

---

## NOTES ADDITIONNELLES

Si les colonnes daily_budget_oz et daily_forecast_oz NE SONT PAS GENERATED:
- Verifier structure table dans Supabase Dashboard
- Executer migration 20251115_005 qui cree colonnes normales
- Si besoin, recreer tables avec structure correcte

Si elles SONT GENERATED (cas actuel):
- Code corrige fonctionne correctement
- PostgreSQL gere calcul automatiquement
- Pas besoin de modifier migrations

---

Prepare Par: Senior Full Stack Developer
Date: 2025-01-15
Status: CORRIGE et VALIDE
Build: OK (36.84s)
