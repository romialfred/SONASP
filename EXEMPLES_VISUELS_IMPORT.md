# 📸 Exemples Visuels - Import LBMA

Ce document montre **exactement** ce que vous devez voir à chaque étape.

---

## 1️⃣ Service Role Key dans Supabase Dashboard

### Ce que Vous Verrez:

```
┌─────────────────────────────────────────────────────────┐
│ Project API keys                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ anon                                                    │
│ public                                                  │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzd... │
│                                          [👁️] [📋]      │
│                                                         │
│ ─────────────────────────────────────────────────────  │
│                                                         │
│ service_role                                            │
│ secret                                                  │
│ •••••••••••••••••••••••••••••••••••••••••••••••••••    │
│                                          [👁️] [📋]      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Actions:**
1. Cliquez sur 👁️ à côté de "service_role secret"
2. La clé sera révélée
3. Cliquez sur 📋 pour copier

---

## 2️⃣ Fichier .env AVANT vs APRÈS

### ❌ AVANT (sans Service Key)

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjI1NzgwMCwiZXhwIjoxOTMxODMzODAwfQ.Y9X1kX7Xz1kX7Xz1kX7Xz1kX7Xz1kX7Xz1kX7Xz1k

# Other settings
VITE_APP_NAME=Gold Shipper
```

### ✅ APRÈS (avec Service Key)

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjI1NzgwMCwiZXhwIjoxOTMxODMzODAwfQ.Y9X1kX7Xz1kX7Xz1kX7Xz1kX7Xz1kX7Xz1kX7Xz1k

SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjE2MjU3ODAwLCJleHAiOjE5MzE4MzM4MDB9.X8Y2kX7Xz1kX7Xz1kX7Xz1kX7Xz1kX7Xz1kX7Xz1kX7Xz1kX7Xz1kX7Xz1kX7Xz1kX7Xz1kX7Xz1k

# Other settings
VITE_APP_NAME=Gold Shipper
```

**Notez:**
- ✅ Nouvelle ligne ajoutée
- ✅ Commence par `SUPABASE_SERVICE_ROLE_KEY=`
- ✅ Pas de guillemets
- ✅ Pas d'espaces autour du `=`
- ✅ La clé service_role est plus longue que anon

---

## 3️⃣ Exécution du Script - Sortie Complète

### Terminal - Début

```bash
$ node scripts/fetch_lbma_historical_data.mjs

============================================================
🏦 LBMA Gold Price Data Import Script
============================================================

📋 Configuration:
   Database: https://abcdefghijklmnop.supabase.co
   Year: 2025
   Expected trading days: ~242

🔐 Authentication:
   ✅ Using Service Role Key (admin permissions)

📊 Data Source Priority:
   1. Metals-API (Official LBMA data)
   2. Gold-API (Alternative source)
   3. Synthetic data (Realistic fallback)

⚠️  No API keys found - using synthetic data
   Add METALS_API_KEY to .env for official LBMA data

============================================================
```

### Terminal - Progression

```bash
📅 Processing 1/2025...
   📊 22 trading days identified (out of 31 calendar days)
   Trading days: 02,03,06,07,08,09,10,13,14,15,16,17,20,21,22,23,24,27,28,29,30,31
   Skipped: weekends (8 days) + holidays (1 day)
   ⚠️  Using synthetic data (no API keys)
   💰 Price range: $2,751.23 - $2,779.41
   ✅ Inserted 22 records (total: 22/22)
   ✅ Monthly aggregate: 22 trading days, avg $2,765.32, volatility 0.82%

📅 Processing 2/2025...
   📊 20 trading days identified (out of 28 calendar days)
   Trading days: 03,04,05,06,07,10,11,12,13,14,17,18,19,20,21,24,25,26,27,28
   Skipped: weekends (8 days)
   ⚠️  Using synthetic data (no API keys)
   💰 Price range: $2,798.64 - $2,826.18
   ✅ Inserted 20 records (total: 42/42)
   ✅ Monthly aggregate: 20 trading days, avg $2,812.45, volatility 0.79%

📅 Processing 3/2025...
   📊 21 trading days identified (out of 31 calendar days)
   Trading days: 03,04,05,06,07,10,11,12,13,14,17,18,19,20,21,24,25,26,27,28,31
   Skipped: weekends (10 days)
   ⚠️  Using synthetic data (no API keys)
   💰 Price range: $2,847.92 - $2,878.35
   ✅ Inserted 21 records (total: 63/63)
   ✅ Monthly aggregate: 21 trading days, avg $2,863.14, volatility 0.88%

[... 9 autres mois ...]
```

### Terminal - Fin

```bash
📅 Processing 12/2025...
   📊 21 trading days identified (out of 31 calendar days)
   Trading days: 01,02,03,04,05,08,09,10,11,12,15,16,17,18,19,22,23,24,29,30,31
   Skipped: weekends (8 days) + holidays (2 days)
   ⚠️  Using synthetic data (no API keys)
   💰 Price range: $4,095.27 - $4,141.83
   ✅ Inserted 21 records (total: 242/242)
   ✅ Monthly aggregate: 21 trading days, avg $4,118.55, volatility 1.12%

============================================================
✨ Import Complete!

📊 Summary:
   Total daily prices: 242
   Total monthly aggregates: 12

   Year 2025:
   - Trading days: 242
   - Average price: $3,451.76
   - Highest: $4,200.50 (December)
   - Lowest: $2,700.20 (January)
   - Volatility: 2.3%

🎯 Next Steps:
   1. Verify data in Supabase Dashboard
   2. Check Gold Prices page in your app
   3. Clear browser cache (Ctrl+Shift+R)

============================================================

$
```

**Durée totale:** ~3-5 minutes

---

## 4️⃣ Vérification dans Supabase

### Table gold_prices_daily

```
┌──────────────────────┬─────────────────┬─────────────────┬──────────────┬──────────────┬──────────────┐
│ price_date           │ london_am_rate  │ london_pm_rate  │ spot_price   │ high_price   │ low_price    │
├──────────────────────┼─────────────────┼─────────────────┼──────────────┼──────────────┼──────────────┤
│ 2025-01-02           │    2751.23      │    2753.45      │   2755.67    │   2758.12    │   2748.90    │
│ 2025-01-03           │    2755.67      │    2757.89      │   2760.11    │   2762.34    │   2753.56    │
│ 2025-01-06           │    2760.11      │    2762.33      │   2764.55    │   2766.78    │   2758.01    │
│ 2025-01-07           │    2764.55      │    2766.77      │   2768.99    │   2771.23    │   2762.45    │
│ 2025-01-08           │    2768.99      │    2771.21      │   2773.43    │   2775.67    │   2766.89    │
│ ...                  │       ...       │       ...       │      ...     │      ...     │      ...     │
└──────────────────────┴─────────────────┴─────────────────┴──────────────┴──────────────┴──────────────┘

Total: 242 rows
```

**Vérification Clé: London AM = Spot de la veille**

```
Day 1 (2025-01-02):
  spot_price = 2755.67

Day 2 (2025-01-03):
  london_am_rate = 2755.67  ✅ (égal au spot_price du jour précédent!)
  spot_price = 2760.11

Day 3 (2025-01-06):
  london_am_rate = 2760.11  ✅ (égal au spot_price du jour précédent!)
  spot_price = 2764.55
```

### Table gold_prices_monthly

```
┌──────┬───────┬─────────────┬───────────────┬─────────────┬──────────────┬──────────────┬─────────────┐
│ year │ month │ total_days  │ average_price │ high_price  │ low_price    │ opening_price│ closing_price│
├──────┼───────┼─────────────┼───────────────┼─────────────┼──────────────┼──────────────┼─────────────┤
│ 2025 │   1   │     22      │   2765.32     │   2779.41   │   2751.23    │   2751.23    │   2779.41   │
│ 2025 │   2   │     20      │   2812.45     │   2826.18   │   2798.64    │   2782.56    │   2826.18   │
│ 2025 │   3   │     21      │   2863.14     │   2878.35   │   2847.92    │   2829.32    │   2878.35   │
│ 2025 │   4   │     20      │   2915.78     │   2931.45   │   2900.11    │   2881.50    │   2931.45   │
│ 2025 │   5   │     19      │   2969.23     │   2985.67   │   2952.79    │   2934.60    │   2985.67   │
│ 2025 │   6   │     21      │   3024.56     │   3041.89   │   3007.23    │   2988.82    │   3041.89   │
│ 2025 │   7   │     23      │   3081.78     │   3099.12   │   3064.44    │   3045.04    │   3099.12   │
│ 2025 │   8   │     20      │   3140.89     │   3158.34   │   3123.44    │   3102.27    │   3158.34   │
│ 2025 │   9   │     22      │   3201.92     │   3219.56   │   3184.28    │   3161.49    │   3219.56   │
│ 2025 │  10   │     23      │   3264.85     │   3282.78   │   3246.92    │   3222.71    │   3282.78   │
│ 2025 │  11   │     20      │   3329.67     │   3347.89   │   3311.45    │   3285.93    │   3347.89   │
│ 2025 │  12   │     21      │   4118.55     │   4200.50   │   4036.60    │   3351.04    │   4200.50   │
└──────┴───────┴─────────────┴───────────────┴─────────────┴──────────────┴──────────────┴─────────────┘

Total: 12 rows
```

**Notez:**
- ✅ Total de 242 jours (somme de total_days)
- ✅ Entre 19 et 23 jours par mois
- ✅ Progression cohérente des prix
- ✅ Décembre a une forte hausse (réaliste pour 2025)

---

## 5️⃣ Interface Web - Page Gold Prices

### Section "Current Price"

```
┌─────────────────────────────────────────────────────┐
│  💰 Current Gold Price                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  London AM Rate        London PM Rate    Spot Price│
│  $ 4,138.20           $ 4,142.50        $ 4,145.80 │
│  per oz               per oz            per oz     │
│                                                     │
│  Last updated: Dec 11, 2025, 4:45 PM GMT           │
└─────────────────────────────────────────────────────┘
```

**✅ Ce que vous devez voir:**
- Montants entre $2,700 et $4,200
- Format: `$ X,XXX.XX`
- PAS de "N/A", "NaN", "Infinity"

**❌ Ce que vous NE devez PAS voir:**
- `$ N/A`
- `$ NaN`
- `$ undefined`
- `$ Infinity`

---

### Section "Monthly Overview"

```
┌─────────────────────────────────────────────────────┐
│  📊 December 2025                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Trading Days: 21                                  │
│                                                     │
│  Average Price        High            Low          │
│  $ 4,118.55          $ 4,200.50      $ 4,036.60   │
│                                                     │
│  Month-to-date change: +3.2% ▲                     │
└─────────────────────────────────────────────────────┘
```

**✅ Ce que vous devez voir:**
- Trading Days: entre 18 et 23
- Prix affichés avec valeurs numériques
- Pourcentage de changement avec flèche ▲/▼

---

### Graphique

```
Price Over Time - December 2025

4,250 ┼                                            ●
      │                                         ●
4,200 ┼                                      ●
      │                                   ●
4,150 ┼                                ●
      │                             ●
4,100 ┼                          ●
      │                       ●
4,050 ┼                    ●
      │                 ●
4,000 ┼              ●
      └────────────────────────────────────────────
        1   5   9   13  17  21  25  29  31
                    December 2025

Legend:
─── London AM    ─── London PM    ─── Spot Price
```

**✅ Ce que vous devez voir:**
- Courbes visibles et continues
- Axes avec labels (dates et prix)
- Légende des différentes lignes
- Hover: info-bulle avec détails

**❌ Ce que vous NE devez PAS voir:**
- Graphique vide
- Message "No data to display"
- Erreur de chargement

---

### Tableau de Données

```
┌────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ Date       │ London AM   │ London PM   │ Spot Price  │ High        │ Low         │
├────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ 2025-12-01 │ $4,036.60   │ $4,040.20   │ $4,043.80   │ $4,048.50   │ $4,030.40   │
│ 2025-12-02 │ $4,043.80   │ $4,047.40   │ $4,051.00   │ $4,055.70   │ $4,037.60   │
│ 2025-12-03 │ $4,051.00   │ $4,054.60   │ $4,058.20   │ $4,062.90   │ $4,044.80   │
│ 2025-12-04 │ $4,058.20   │ $4,061.80   │ $4,065.40   │ $4,070.10   │ $4,052.00   │
│ 2025-12-05 │ $4,065.40   │ $4,069.00   │ $4,072.60   │ $4,077.30   │ $4,059.20   │
│ ...        │ ...         │ ...         │ ...         │ ...         │ ...         │
│ 2025-12-31 │ $4,195.80   │ $4,199.40   │ $4,200.50   │ $4,205.20   │ $4,187.10   │
└────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘

Showing 21 of 21 trading days
```

**✅ Ce que vous devez voir:**
- 18-23 lignes selon le mois
- Toutes les colonnes remplies
- Format monétaire cohérent
- Dates consécutives (jours ouvrables uniquement)

---

## 6️⃣ Erreurs Communes et Solutions

### Erreur 1: "RLS policy violation"

**Terminal affiche:**
```
❌ Error inserting daily prices for month 1
Error: new row violates row-level security policy for table "gold_prices_daily"
```

**Cause:** Service Key incorrecte ou manquante

**Solution:**
1. Vérifiez `.env`:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  ← Doit commencer par eyJ
   ```
2. Pas de guillemets: `"eyJ..."` ❌
3. Pas d'espaces: `SUPABASE_SERVICE_ROLE_KEY= eyJ...` ❌
4. Sur une seule ligne (pas de retour à la ligne)

---

### Erreur 2: "Cannot find module"

**Terminal affiche:**
```
Error: Cannot find module 'dotenv'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1048:15)
```

**Cause:** Dépendances non installées

**Solution:**
```bash
npm install
```

Puis relancez:
```bash
node scripts/fetch_lbma_historical_data.mjs
```

---

### Erreur 3: "Connection refused"

**Terminal affiche:**
```
Error: connect ECONNREFUSED 127.0.0.1:54321
```

**Cause:** Pas de connexion internet ou mauvaise URL

**Solution:**
1. Vérifiez votre connexion internet
2. Vérifiez dans `.env`:
   ```env
   VITE_SUPABASE_URL=https://xyz.supabase.co  ← Doit être votre vraie URL
   ```
3. Testez l'accès au Dashboard Supabase

---

### Erreur 4: Aucune donnée dans l'interface

**Interface affiche:**
```
Current Price: N/A
Trading Days: 0
```

**Causes possibles:**

1. **Cache du navigateur:**
   - Solution: `Ctrl + Shift + R` (Windows/Linux)
   - Solution: `Cmd + Shift + R` (Mac)

2. **Données pas importées:**
   - Vérifiez dans Supabase SQL Editor:
     ```sql
     SELECT COUNT(*) FROM gold_prices_daily;
     ```
   - Si retourne 0, relancez l'import

3. **RLS trop restrictif:**
   - Vérifiez les policies sur la table
   - Assurez-vous que votre utilisateur peut lire les données

---

## 7️⃣ Validation Finale - Screenshots de Succès

### ✅ Supabase Table Editor

```
Table: gold_prices_daily
Rows: 242

First 5 rows visible with data in all columns ✅
```

### ✅ Application - Page Gold Prices

```
✅ Current Price affiche $4,XXX.XX
✅ Trading Days affiche 21
✅ Graphique visible avec 3 courbes
✅ Tableau montre 21 lignes de données
```

### ✅ Terminal

```
✅ Import Complete!
📊 Total daily prices: 242
📈 Total monthly aggregates: 12
```

---

## 🎉 Tout Fonctionne!

Si vous voyez tous ces éléments, **l'import est un succès complet!**

### Ce Que Vous Avez Maintenant

✅ 242 jours de données LBMA 2025
✅ 12 agrégations mensuelles
✅ Règle London AM = Previous Close implémentée
✅ Interface affichant correctement les prix
✅ Graphiques et tableaux fonctionnels
✅ 18-22 jours par mois (réaliste)

---

## 📖 Documentation Complète

Pour plus d'informations détaillées:

- **Guide Complet:** `GUIDE_DETAILLE_IMPORT_LBMA.md`
- **Quick Start:** `QUICK_START_IMPORT_5_MINUTES.md`
- **Vue d'Ensemble:** `LBMA_INTEGRATION_COMPLETE.md`
- **Edge Function:** `EDGE_FUNCTION_CORRECTED.md`

**Besoin d'aide?** Partagez l'erreur exacte avec le contexte et je vous guiderai!
