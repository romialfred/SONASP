# Edge Function Corrected - fetch-daily-lbma-prices

## ✅ Problème Résolu

L'Edge Function pour l'import automatique quotidien des prix LBMA a été **entièrement corrigée** pour correspondre à la structure réelle de votre table `gold_prices_daily`.

---

## 🔧 Corrections Appliquées

### 1. Colonnes Inexistantes Supprimées

**Avant (INCORRECT):**
```typescript
// Tentait d'utiliser des colonnes qui n'existent pas
.select('closing_price, price_date')
.insert({
  opening_price: ...,
  closing_price: ...,
  data_points: 100,
})
```

**Après (CORRIGÉ):**
```typescript
// Utilise uniquement les colonnes existantes
.select('spot_price, price_date')
.insert({
  price_date: todayStr,
  london_am_rate: ...,
  london_pm_rate: ...,
  spot_price: ...,
  high_price: ...,
  low_price: ...,
  average_price: ...,
  source: 'API (Automated)',
  currency: 'USD',
  notes: 'Automated daily import at market close',
})
```

### 2. Règle LBMA AM = Previous Close

**Implémentation correcte:**
```typescript
// Récupérer le spot_price de la veille (représente la clôture)
const { data: previousDay } = await supabase
  .from('gold_prices_daily')
  .select('spot_price, price_date')
  .order('price_date', { ascending: false })
  .limit(1)
  .maybeSingle();

// CRITIQUE: London AM = spot_price de la veille
const londonAM = previousDay ? previousDay.spot_price : closingPrice * 0.995;
```

### 3. Calculs Adaptés

**Avant (utilisait opening qui n'existe pas):**
```typescript
const opening = londonAM * (0.998 + Math.random() * 0.004);
const high = Math.max(opening, closingPrice, londonAM, londonPM) * ...;
const low = Math.min(opening, closingPrice, londonAM, londonPM) * ...;
const average = (opening + closingPrice + high + low) / 4;
```

**Après (utilise uniquement valeurs disponibles):**
```typescript
const high = Math.max(closingPrice, londonAM, londonPM) * (1 + Math.random() * 0.005);
const low = Math.min(closingPrice, londonAM, londonPM) * (1 - Math.random() * 0.005);
const average = (closingPrice + high + low + londonAM + londonPM) / 5;
```

### 4. Agrégation Mensuelle Corrigée

**Avant (colonnes inexistantes):**
```typescript
opening_price: monthlyData[0].opening_price,
closing_price: monthlyData[monthlyData.length - 1].closing_price,
```

**Après (colonnes existantes):**
```typescript
opening_price: monthlyData[0].london_am_rate,      // Premier AM du mois
closing_price: monthlyData[monthlyData.length - 1].spot_price,  // Dernier spot du mois
```

---

## 📋 Structure de Table Respectée

L'Edge Function utilise maintenant **uniquement** ces colonnes:

| Colonne | Type | Description |
|---------|------|-------------|
| `price_date` | DATE | Date du trading day |
| `london_am_rate` | DECIMAL | LBMA AM Fix (= spot_price de la veille) |
| `london_pm_rate` | DECIMAL | LBMA PM Fix |
| `spot_price` | DECIMAL | Prix de clôture du jour |
| `average_price` | DECIMAL | Prix moyen calculé |
| `high_price` | DECIMAL | Plus haut intrajournalier |
| `low_price` | DECIMAL | Plus bas intrajournalier |
| `source` | TEXT | Source des données |
| `currency` | TEXT | Devise (USD) |
| `notes` | TEXT | Notes supplémentaires |

---

## 🚀 Fonctionnement de l'Edge Function

### Quand Elle S'Exécute
- **Horaire:** 16:45 GMT (après London PM Fix à 15:00 GMT)
- **Fréquence:** Tous les jours ouvrables (Lundi-Vendredi)
- **Cron:** `0 16 45 * * 1-5`

### Ce Qu'Elle Fait

1. **Vérifie si c'est un jour ouvrable**
   - Exclut weekends (Samedi-Dimanche)
   - Exclut jours fériés UK (liste hardcodée)

2. **Vérifie si le prix existe déjà**
   - Évite les doublons
   - Retourne un message si déjà importé

3. **Récupère le prix du jour**
   - Priorité 1: Metals-API (données LBMA officielles)
   - Priorité 2: Gold-API (source alternative)
   - Priorité 3: Sources gratuites (fallback)

4. **Applique la règle LBMA**
   - `london_am_rate` = `spot_price` de la veille
   - Si premier jour, utilise spot actuel × 0.995

5. **Calcule les valeurs intrajournalières**
   - `london_pm_rate`: spot × (0.997 - 1.003)
   - `high_price`: max(spot, AM, PM) × (1.000 - 1.005)
   - `low_price`: min(spot, AM, PM) × (0.995 - 1.000)
   - `average_price`: moyenne des 5 valeurs

6. **Insère dans gold_prices_daily**
   - Uniquement les colonnes existantes
   - Source: "API (Automated)"

7. **En fin de mois: crée l'agrégation**
   - Calcule moyenne, volatilité
   - Trouve high/low du mois
   - Compte les jours de trading
   - Insère dans `gold_prices_monthly`

---

## 🔐 Variables d'Environnement

L'Edge Function utilise automatiquement:

| Variable | Disponibilité | Utilisation |
|----------|---------------|-------------|
| `SUPABASE_URL` | ✅ Automatique | URL de votre projet |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Automatique | Permissions admin pour insert |
| `METALS_API_KEY` | ⚠️ Optionnel | Données LBMA officielles |
| `GOLD_API_KEY` | ⚠️ Optionnel | Source alternative |

**Sans API keys:** La fonction utilise des sources gratuites (moins fiables mais fonctionnelles pour tests).

---

## 📊 Exemple de Réponse

### Succès
```json
{
  "success": true,
  "message": "Gold price recorded successfully",
  "data": {
    "date": "2025-12-11",
    "london_am_rate": 4125.50,
    "spot_price": 4138.20,
    "previous_spot_used": 4125.50,
    "monthly_aggregate_created": false
  }
}
```

### Jour non ouvrable
```json
{
  "success": false,
  "message": "Non-trading day: 2025-12-13",
  "reason": "weekend"
}
```

### Déjà importé
```json
{
  "success": false,
  "message": "Price already recorded for 2025-12-11"
}
```

### Erreur
```json
{
  "success": false,
  "error": "Unable to fetch gold price from any source"
}
```

---

## 🎯 Prochaines Étapes

### 1. Déployer l'Edge Function

```bash
# Si vous avez Supabase CLI installé
supabase functions deploy fetch-daily-lbma-prices
```

**OU** via le Dashboard:
1. Aller dans Functions > Create new function
2. Nom: `fetch-daily-lbma-prices`
3. Copier le contenu de `supabase/functions/fetch-daily-lbma-prices/index.ts`
4. Deploy

### 2. Configurer le Cron Job

Dans Supabase Dashboard > Database > Cron Jobs:

```sql
-- Créer un cron job pour exécution automatique quotidienne
SELECT cron.schedule(
  'daily-lbma-price-import',
  '45 16 * * 1-5',  -- 16:45 GMT, Lundi-Vendredi
  $$
  SELECT
    net.http_post(
      url := 'https://votre-projet.supabase.co/functions/v1/fetch-daily-lbma-prices',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      )
    )
  $$
);
```

### 3. Tester Manuellement

**Via curl:**
```bash
curl -X POST https://votre-projet.supabase.co/functions/v1/fetch-daily-lbma-prices \
  -H "Authorization: Bearer VOTRE_ANON_KEY" \
  -H "Content-Type: application/json"
```

**Via Supabase Dashboard:**
1. Functions > fetch-daily-lbma-prices
2. Cliquer sur "Invoke function"
3. Vérifier la réponse

---

## ✅ Checklist de Validation

- [x] Edge Function corrigée pour structure de table actuelle
- [x] Règle LBMA AM = Previous Close implémentée
- [x] Colonnes inexistantes supprimées
- [x] Calculs adaptés aux valeurs disponibles
- [x] Agrégation mensuelle corrigée
- [x] Documentation mise à jour
- [x] Build réussi sans erreurs

**Prêt pour déploiement!** 🎉

---

## 📝 Fichiers Modifiés

- ✅ `supabase/functions/fetch-daily-lbma-prices/index.ts` - Entièrement corrigé
- ✅ `scripts/fetch_lbma_historical_data.mjs` - Déjà corrigé précédemment
- ✅ Build vérifié: `npm run build` ✅ SUCCESS

---

**Besoin d'aide pour le déploiement?** Dites-moi et je vous guiderai étape par étape!
