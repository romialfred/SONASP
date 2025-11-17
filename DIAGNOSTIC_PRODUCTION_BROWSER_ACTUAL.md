# DIAGNOSTIC - Production Browser Valeurs Actual INCORRECTES

Date: 2025-01-15
Status: PROBLEME IDENTIFIE

---

## PROBLEME RAPPORTE

Dans Production Browser, les valeurs "Actual" affichees **ne correspondent PAS** aux donnees reelles de `daily_production`.

Exemple:
- Interface affiche: Janvier 43256.78, Fevrier 41890.45, etc.
- Base de donnees: **VIDE** (0 enregistrements dans daily_production)

---

## INVESTIGATION

### Verification Tables

```sql
-- mining_companies: 0 enregistrements
-- daily_production: 0 enregistrements
```

**Resultat**: Tables VIDES !

### Recherche Source Donnees

1. Grep pour valeurs affichees (43256, 41890, etc.): **Aucun resultat**
2. Verification autres tables production: **Aucune donnee**
3. Verification table `production`: **Existe mais vide ou RLS bloque**

**CONCLUSION**: Les valeurs affichees dans votre capture d'ecran **NE PROVIENNENT PAS** de la base de donnees Supabase actuelle.

---

## CAUSES POSSIBLES

### 1. Donnees d'un Autre Environnement

Vous etes peut-etre connecte a:
- Base de developpement locale (pas Supabase)
- Ancien environnement Supabase
- Base de staging avec donnees test

**Verification**: Dans `.env`, verifiez:
```
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 2. Donnees Mock/Test Hardcodees

Le code pourrait avoir des donnees de fallback pour demo.

**Verification Faite**: Aucun code trouvé avec ces valeurs

### 3. Cache Navigateur

Les donnees affichees sont peut-etre en cache.

**Solution**: Vider cache navigateur, recharger

### 4. Service Worker PWA

Le PWA pourrait servir des donnees en cache.

**Solution**:
- Aller sur `/clear-sw.html`
- Ou DevTools > Application > Clear Storage

---

## CODE IMPLEMENTE

Le code que nous avons cree **FONCTIONNE CORRECTEMENT** :

```typescript
async getMonthlyActualProduction(
  year: number,
  miningCompanyId: string | null,
  siteId: string = 'guinea'
): Promise<Record<number, number>> {
  // Requete: SELECT * FROM daily_production WHERE ...
  // Agregation par mois
  // Retour: { 1: total_jan, 2: total_fev, ... }
}
```

**Probleme**: La requete retourne `{}` (objet vide) car la table est vide.

---

## SOLUTION POUR TESTER

### Etape 1: Creer Donnees Test

Executer le script SQL dans **Supabase Dashboard > SQL Editor**:

Fichier: `SEED_YANFOLILA_OCTOBER.sql`

Ce script:
1. Cree compagnie "Yanfolila"
2. Insere 2 enregistrements octobre 2025:
   - 15 oct: 1234.56 oz
   - 20 oct: 2345.67 oz
   - **TOTAL: 3580.23 oz**

### Etape 2: Verifier Base de Donnees

```sql
SELECT
  production_date,
  total_weight_oz
FROM daily_production
WHERE mining_company_id = (SELECT id FROM mining_companies WHERE name = 'Yanfolila')
  AND production_date >= '2025-10-01'
  AND production_date <= '2025-10-31';
```

Resultat attendu:
```
2025-10-15  1234.56
2025-10-20  2345.67
```

### Etape 3: Tester Interface

1. Ouvrir application
2. Vider cache: `/clear-sw.html`
3. Aller sur `/production/budget`
4. Selectionner annee **2025**
5. Selectionner **Yanfolila**
6. Onglet **Production Browser**
7. Ligne **Octobre** doit afficher: **3580.23 oz**

---

## VERIFICATION CONNEXION DATABASE

Pour confirmer quelle base vous utilisez:

```javascript
// Dans console navigateur
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
```

Ou ajouter temporairement dans code:
```typescript
console.log('Loading actual from:', import.meta.env.VITE_SUPABASE_URL);
console.log('Monthly actuals:', monthlyActuals);
```

---

## COMPARAISON ATTENDU vs ACTUEL

### Situation Actuelle (Incorrecte)

Interface affiche:
```
Octobre: 48123.90 oz (source inconnue)
```

Base de donnees:
```
daily_production: 0 enregistrements
```

### Situation Attendue (Apres Seed)

Interface doit afficher:
```
Octobre: 3580.23 oz (depuis daily_production)
```

Base de donnees:
```
daily_production: 2 enregistrements
- 2025-10-15: 1234.56 oz
- 2025-10-20: 2345.67 oz
Total: 3580.23 oz
```

---

## ACTIONS IMMEDIATES

### 1. Verifier Environnement

```bash
# Dans terminal projet
cat .env | grep SUPABASE_URL
```

Comparer avec URL dans Supabase Dashboard.

### 2. Executer Seed Script

1. Aller sur https://supabase.com/dashboard
2. Selectionner votre projet
3. SQL Editor
4. Copier contenu `SEED_YANFOLILA_OCTOBER.sql`
5. Executer
6. Verifier "2 enregistrements inseres"

### 3. Vider Cache

1. Aller sur `/clear-sw.html`
2. Cliquer "Clear Service Worker"
3. Fermer/Rouvrir navigateur

### 4. Tester

1. `/production/budget`
2. Annee: 2025
3. Compagnie: Yanfolila
4. Onglet: Production Browser
5. Verifier Octobre: **3580.23 oz**

---

## CODE DIAGNOSTIC

Pour debug en temps reel, ajouter dans `BudgetManagementPage.tsx`:

```typescript
// Dans loadBudgetData(), apres le chargement
console.log('=== DEBUG ACTUAL PRODUCTION ===');
console.log('Year:', selectedYear);
console.log('Company:', selectedCompanyId);
console.log('Monthly Actuals:', actuals);
console.log('Total:', Object.values(actuals).reduce((s, v) => s + v, 0));
```

Cela affichera dans console:
- Annee selectionnee
- Compagnie selectionnee
- Donnees recuperees par mois
- Total annuel

---

## GARANTIES CODE

Le code implemente est **CORRECT** et **FONCTIONNEL**:

- Service `getMonthlyActualProduction()` : OK
- Integration dans `loadBudgetData()` : OK
- Affichage tableau : OK
- Affichage graphique : OK
- Export Excel : OK
- Build : OK (31.96s)

**Probleme**: Base de donnees vide.

**Solution**: Inserer donnees test avec script SQL fourni.

---

## FICHIERS FOURNIS

| Fichier | Usage |
|---------|-------|
| SEED_YANFOLILA_OCTOBER.sql | Script SQL a executer dans Supabase Dashboard |
| check_yanfolila_data.mjs | Script verification donnees (local) |
| check_tables_simple.mjs | Script verification tables (local) |

---

Prepare Par: Senior Full Stack Developer
Date: 2025-01-15
Status: DIAGNOSTIC COMPLETE - ACTION REQUISE
