# 🚀 Edge Functions - Prochaines Étapes

Vous avez créé avec succès les deux Edge Functions:
- ✅ `fetch-daily-fx-rates` - Récupère les taux de change quotidiens
- ✅ `fetch-daily-lbma-prices` - Récupère les prix de l'or quotidiens

## Étape 1: Vérifier les Tables dans Supabase

### 1.1 Aller dans SQL Editor
1. Ouvrez Supabase Dashboard
2. Menu de gauche → **SQL Editor**
3. Cliquez sur **New query**

### 1.2 Vérifier les Tables FX Rates
Copiez et exécutez ce SQL:

```sql
-- Vérifier les tables FX Rates
SELECT table_name,
       (SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_name = t.table_name
        AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN (
  'fx_rate_sources',
  'fx_rates_daily',
  'fx_rates_monthly_aggregated'
)
ORDER BY table_name;
```

**Résultat attendu:**
- `fx_rate_sources` (doit avoir ~5 colonnes)
- `fx_rates_daily` (doit avoir ~7 colonnes)
- `fx_rates_monthly_aggregated` (doit avoir ~11 colonnes)

### 1.3 Vérifier les Tables Gold Prices
```sql
-- Vérifier les tables Gold Prices
SELECT table_name,
       (SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_name = t.table_name
        AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN (
  'gold_prices_daily',
  'gold_prices_monthly'
)
ORDER BY table_name;
```

**Résultat attendu:**
- `gold_prices_daily` (doit avoir ~10 colonnes)
- `gold_prices_monthly` (doit avoir ~8 colonnes)

### 1.4 Si les Tables N'Existent PAS
Si certaines tables sont manquantes, il faut exécuter les migrations SQL:
- Fichier: `CREATE_GOLD_PRICES_TABLES.sql` (pour gold_prices)
- Il faut créer les tables FX si elles n'existent pas

---

## Étape 2: Tester les Fonctions Manuellement

### 2.1 Test de `fetch-daily-fx-rates`

1. **Aller dans Edge Functions**
   ```
   Supabase Dashboard → Edge Functions → fetch-daily-fx-rates
   ```

2. **Cliquer sur "Invoke"** ou utiliser le bouton de test

3. **Vérifier le résultat**
   - Success: `true`
   - Message: "FX rates recorded successfully"
   - Data: doit contenir EUR/USD, USD/XOF, USD/GNF, XOF/GNF

4. **Vérifier dans la base de données**
   ```sql
   SELECT * FROM fx_rates_daily
   ORDER BY rate_date DESC
   LIMIT 4;
   ```

### 2.2 Test de `fetch-daily-lbma-prices`

1. **Aller dans Edge Functions**
   ```
   Supabase Dashboard → Edge Functions → fetch-daily-lbma-prices
   ```

2. **Cliquer sur "Invoke"**

3. **Vérifier le résultat**
   - Success: `true`
   - Message: "Gold price recorded successfully"
   - Data: doit contenir london_am_rate, spot_price

4. **Vérifier dans la base de données**
   ```sql
   SELECT * FROM gold_prices_daily
   ORDER BY price_date DESC
   LIMIT 1;
   ```

---

## Étape 3: Configurer les Tâches Planifiées (Cron Jobs)

### 3.1 Aller dans les Paramètres des Edge Functions
1. Supabase Dashboard
2. Edge Functions
3. Cliquez sur la fonction `fetch-daily-fx-rates`
4. Onglet **"Triggers"** ou **"Settings"**

### 3.2 Créer le Cron Job pour FX Rates

**Fonction:** `fetch-daily-fx-rates`

**Cron Expression:**
```
0 10 * * 1-5
```

**Signification:**
- Tous les jours du lundi au vendredi (1-5)
- À 10:00 UTC
- Après l'ouverture des marchés européens

**Configuration:**
- Name: `daily-fx-rates`
- HTTP method: `POST`
- HTTP headers: `{"Content-Type": "application/json"}`

### 3.3 Créer le Cron Job pour Gold Prices

**Fonction:** `fetch-daily-lbma-prices`

**Cron Expression:**
```
45 16 * * 1-5
```

**Signification:**
- Tous les jours du lundi au vendredi
- À 16:45 UTC (4:45 PM)
- Après la fermeture du marché de Londres (London PM Fix à 15:00 GMT)

**Configuration:**
- Name: `daily-gold-prices`
- HTTP method: `POST`
- HTTP headers: `{"Content-Type": "application/json"}`

### 3.4 Alternative: Utiliser Supabase CLI

Si les Cron Jobs ne sont pas disponibles dans l'interface, créez-les via CLI:

```bash
# Installer Supabase CLI si nécessaire
npm install -g supabase

# Se connecter
supabase link --project-ref boolqagzdqbahqnpawpb

# Créer les cron jobs
supabase functions deploy fetch-daily-fx-rates --schedule "0 10 * * 1-5"
supabase functions deploy fetch-daily-lbma-prices --schedule "45 16 * * 1-5"
```

---

## Étape 4: Configuration Avancée (Optionnel)

### 4.1 Ajouter des API Keys (pour améliorer la qualité)

Les fonctions fonctionnent avec des APIs gratuites, mais vous pouvez améliorer avec:

**Pour FX Rates:**
- Aucune clé requise (utilise APIs gratuites)

**Pour Gold Prices:**
1. Aller dans Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Ajouter ces variables (optionnelles):
   - `METALS_API_KEY` - Pour metals-api.com
   - `GOLD_API_KEY` - Pour goldapi.io

### 4.2 Monitoring et Logs

**Voir les logs:**
```
Supabase Dashboard → Edge Functions → [fonction] → Logs
```

**Vérifier les erreurs:**
```sql
-- Voir les dernières exécutions
SELECT * FROM fx_rates_daily
ORDER BY created_at DESC
LIMIT 10;

SELECT * FROM gold_prices_daily
ORDER BY created_at DESC
LIMIT 10;
```

---

## Étape 5: Vérification Finale

### 5.1 Checklist de Vérification

- [ ] Tables `fx_rates_daily` et `fx_rates_monthly_aggregated` existent
- [ ] Tables `gold_prices_daily` et `gold_prices_monthly` existent
- [ ] Table `fx_rate_sources` contient au moins une source (ECB)
- [ ] Test manuel de `fetch-daily-fx-rates` réussi
- [ ] Test manuel de `fetch-daily-lbma-prices` réussi
- [ ] Données visibles dans les tables après le test
- [ ] Cron jobs configurés pour les deux fonctions
- [ ] Logs accessibles et sans erreurs

### 5.2 Vérifier Automatiquement Demain

Le lendemain (jour ouvrable), vérifiez:

```sql
-- Vérifier les nouvelles données FX
SELECT rate_date, currency_pair, rate
FROM fx_rates_daily
WHERE rate_date = CURRENT_DATE
ORDER BY currency_pair;

-- Vérifier les nouvelles données Gold
SELECT price_date, london_am_rate, spot_price
FROM gold_prices_daily
WHERE price_date = CURRENT_DATE;
```

---

## 🆘 Troubleshooting

### Problème: Les tables n'existent pas
**Solution:** Exécutez les migrations SQL dans l'ordre:
1. `CREATE_GOLD_PRICES_TABLES.sql`
2. Créez les tables FX si nécessaires

### Problème: Test retourne "source not found"
**Solution:** Insérez la source ECB:
```sql
INSERT INTO fx_rate_sources (code, name, description, is_active)
VALUES ('ECB', 'European Central Bank', 'Official ECB exchange rates', true)
ON CONFLICT (code) DO NOTHING;
```

### Problème: "Weekend" ou "Non-trading day"
**Solution:** C'est normal! Les fonctions ne s'exécutent que les jours ouvrables.
Attendez le prochain jour de semaine (lundi-vendredi).

### Problème: Cron jobs ne s'exécutent pas
**Solution:**
1. Vérifiez les logs dans Edge Functions
2. Vérifiez que le projet Supabase n'est pas en pause
3. Utilisez la CLI pour déployer avec schedule

---

## 📊 Utilisation dans l'Application

Une fois les données collectées, elles seront automatiquement disponibles dans:

### Frontend Pages:
- `/prices/fx-rates` - Page FX Rates avec graphiques
- `/prices/gold-prices` - Page Gold Prices avec graphiques
- `/sales/new` - Formulaire de vente avec prix London AM suggéré

### Services Utilisés:
- `src/services/fxRateService.ts` - Récupération des taux
- `src/services/goldPriceService.ts` - Récupération des prix
- `src/services/exchangeRateService.ts` - Calculs et conversions

---

## ✅ Vous Avez Terminé Quand...

1. ✅ Les deux fonctions Edge sont créées et déployées
2. ✅ Les tests manuels retournent "success: true"
3. ✅ Les données apparaissent dans les tables
4. ✅ Les cron jobs sont configurés
5. ✅ Le lendemain, de nouvelles données sont automatiquement ajoutées

**Bravo! Votre système d'import automatique est opérationnel!**
