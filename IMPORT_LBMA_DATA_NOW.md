# Import Données LBMA - Guide Rapide

## ✅ Prérequis Vérifiés

- ✅ Tables `gold_prices_daily` et `gold_prices_monthly` existent
- ✅ Structure de table vérifiée et script adapté
- ✅ Script corrigé pour utiliser les bonnes colonnes:
  - `london_am_rate`, `london_pm_rate`, `spot_price`
  - `average_price`, `high_price`, `low_price`
  - `source`, `currency`, `notes`

## 🔑 Étape 1: Ajouter la Clé Service Role

Le script a besoin d'une clé avec permissions administratives pour insérer les données.

### Récupérer Votre Service Role Key

1. **Ouvrir Supabase Dashboard**: https://app.supabase.com
2. **Sélectionner votre projet**
3. **Aller dans Settings** (⚙️ menu gauche)
4. **Cliquer sur API**
5. **Dans la section "Project API keys"**:
   - Trouver `service_role` secret
   - Cliquer sur 👁️ pour révéler
   - Copier la clé complète

### Ajouter dans .env

Ouvrir votre fichier `.env` et ajouter:

```env
# Clé existante (ne pas modifier)
VITE_SUPABASE_URL=votre_url_existante
VITE_SUPABASE_ANON_KEY=votre_anon_key_existante

# NOUVELLE LIGNE À AJOUTER:
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
```

⚠️ **IMPORTANT:**
- Ne JAMAIS committer cette clé dans Git
- Elle donne accès admin complet à votre base
- À utiliser uniquement côté serveur/scripts

---

## 🚀 Étape 2: Exécuter l'Import

Une fois la clé ajoutée dans `.env`:

```bash
node scripts/fetch_lbma_historical_data.mjs
```

### Ce Qui Va Se Passer

**Durée:** ~3-5 minutes

**Processus:**
```
✅ Using Service Role Key (admin permissions)

📊 Data Source Priority:
   1. Metals-API (Official LBMA data)
   2. Gold-API (Alternative source)
   3. Synthetic data (Realistic fallback)

📅 Processing 1/2025...
   📊 22 trading days identified
   ⚠️  Using synthetic data (no API keys)
   ✅ Inserted 22 records (total: 22/22)
   ✅ Monthly aggregate: 22 trading days, avg $2765.32

📅 Processing 2/2025...
   📊 20 trading days identified
   ✅ Inserted 20 records (total: 20/20)
   ✅ Monthly aggregate: 20 trading days, avg $2850.15

[... 10 autres mois ...]

============================================================
✨ Import Complete!
   📊 Total daily prices: 242
   📈 Total monthly aggregates: 12
============================================================

📋 2025 Monthly Summary:
   Dec: $4100.23/oz (21 days)
   Nov: $3950.67/oz (22 days)
   Oct: $3800.45/oz (23 days)
   ...
   Jan: $2765.32/oz (22 days)

✅ LBMA historical data import complete!
```

---

## 📊 Étape 3: Vérifier les Données

### Dans Supabase SQL Editor

```sql
-- Compter les jours importés
SELECT COUNT(*) as total_days FROM gold_prices_daily;
-- Devrait retourner: ~242

-- Voir les premiers jours de janvier
SELECT
  price_date,
  london_am_rate,
  spot_price,
  high_price,
  low_price
FROM gold_prices_daily
WHERE price_date >= '2025-01-01'
ORDER BY price_date
LIMIT 10;

-- Vérifier les agrégations mensuelles
SELECT
  month,
  total_days,
  average_price
FROM gold_prices_monthly
WHERE year = 2025
ORDER BY month;
-- Devrait retourner: 12 rows avec 18-22 days chacun
```

### Dans l'Interface Web

1. **Vider le cache:** `Ctrl + Shift + R` (Windows/Linux) ou `Cmd + Shift + R` (Mac)
2. **Naviguer:** Menu > Prices > Gold Prices
3. **Vérifier:**
   - ✅ Current Price affiche un montant ($2,XXX - $4,XXX)
   - ✅ Month High/Low/Average affichent des valeurs
   - ✅ Trading days affiche 18-22 jours
   - ✅ Graphiques s'affichent
   - ✅ Tableau montre les prix quotidiens

---

## 🔍 Vérification Clé: London AM = Previous Close

```sql
-- Vérifier que London AM du jour = Spot price de la veille
SELECT
  current.price_date,
  current.london_am_rate as am_today,
  prev.spot_price as spot_yesterday,
  ROUND(ABS(current.london_am_rate - prev.spot_price), 2) as difference
FROM gold_prices_daily current
JOIN gold_prices_daily prev
  ON prev.price_date = (
    SELECT MAX(price_date)
    FROM gold_prices_daily
    WHERE price_date < current.price_date
  )
WHERE current.price_date >= '2025-01-03'
ORDER BY current.price_date
LIMIT 10;
```

**Résultat attendu:** `difference` doit être ~0 ou très petit (< 1)

---

## 🎯 Résultats Attendus

### gold_prices_daily
- **~242 rows** pour 2025
- **Colonnes remplies:**
  - `price_date`: 2025-01-02 à 2025-12-31 (jours ouvrables)
  - `london_am_rate`: $2,700 - $4,200
  - `london_pm_rate`: Similaire à AM ± 0.5%
  - `spot_price`: Prix du jour
  - `average_price`: Moyenne des prix
  - `high_price`, `low_price`: Min/max intrajournaliers
  - `source`: "Synthetic (Fallback)" ou API name
  - `currency`: "USD"

### gold_prices_monthly
- **12 rows** (Jan-Dec 2025)
- **`total_days`**: 18-22 par mois
- **Progression des prix:** ~$2,765 (Jan) → ~$4,100 (Dec)

---

## 🐛 Dépannage

### Erreur: "RLS policy violation"

**Solution:** La clé service role n'est pas correctement configurée

```bash
# Vérifier dans .env
cat .env | grep SERVICE

# Devrait afficher:
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

Si absente, retourner à l'Étape 1.

### Erreur: "Could not find column"

**Solution:** La structure de table ne correspond pas

Vérifier que ces colonnes existent:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'gold_prices_daily'
ORDER BY ordinal_position;
```

Doit inclure: `london_am_rate`, `spot_price`, `average_price`, etc.

### Aucune Donnée Insérée

**Vérifier les logs du script:**
```bash
node scripts/fetch_lbma_historical_data.mjs 2>&1 | tee import.log
```

Chercher les lignes:
- ✅ `Inserted XX records` → Succès
- ❌ `Error inserting` → Problème

---

## 📈 Utiliser des Données API Réelles (Optionnel)

### Pour Production / Données Officielles

**Metals-API** (Recommandé):
1. S'inscrire sur https://metals-api.com ($10/mois)
2. Copier votre API key
3. Ajouter dans `.env`:
   ```env
   METALS_API_KEY=votre_cle_ici
   ```
4. Réexécuter le script → Il utilisera les données LBMA officielles

**Alternative - Gold-API**:
```env
GOLD_API_KEY=votre_cle_ici
```

**Avantages API:**
- ✅ Données LBMA officielles historiques
- ✅ Mises à jour quotidiennes automatiques
- ✅ Conformité totale avec standards LBMA

**Note:** Sans API keys, le script génère des données synthétiques réalistes basées sur les tendances 2024-2025. Parfait pour tests/démo.

---

## ✅ Checklist Finale

- [ ] Service Role Key ajoutée dans `.env`
- [ ] Script exécuté avec succès
- [ ] ~242 rows dans `gold_prices_daily`
- [ ] 12 rows dans `gold_prices_monthly`
- [ ] Interface affiche les prix correctement
- [ ] 18-22 jours par mois affichés
- [ ] Graphiques visibles
- [ ] London AM = Previous Spot vérifié

---

## 🎉 Prochaines Étapes

Une fois l'import réussi:

1. **Déployer l'Edge Function** pour mises à jour automatiques quotidiennes
2. **Configurer le Cron Job** (16:45 GMT tous les jours ouvrables)
3. **Optionnel:** S'abonner à Metals-API pour données officielles

Voir `LBMA_DATA_INTEGRATION_GUIDE.md` pour les détails.

---

**Besoin d'aide?** Si l'import échoue, copiez l'erreur complète et je pourrai vous aider à résoudre le problème.
