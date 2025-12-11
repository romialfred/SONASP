# Scripts d'Import FX Rates - Guide d'Utilisation

## 🚨 Problèmes Résolus

### 1. supabaseUrl is required ✅

Les scripts ont été corrigés pour charger automatiquement le fichier `.env` depuis la racine du projet, même s'ils sont exécutés depuis le dossier `scripts/`.

**Correction Appliquée:**

Tous les scripts utilisent maintenant:

```javascript
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '..', '.env') });
```

Cela permet d'exécuter les scripts depuis n'importe quel dossier.

### 2. Could not find 'average_rate' column ✅

Le script utilisait des noms de colonnes incorrects pour la table `fx_rates_monthly_aggregated`.

**Colonnes corrigées:**
- `average_rate` → `avg_rate` ✅
- `high_rate` → `max_rate` ✅
- `low_rate` → `min_rate` ✅
- `total_days` → `data_points` ✅
- `volatility` → `total_volume` ✅

Voir `FX_RATES_COLUMN_FIX.md` pour les détails complets.

## Scripts Disponibles

### 1. Test Rapide (1 date)

```bash
node scripts/test_one_date.mjs
```

**Description**: Importe les données pour une seule date (2025-12-05)
**Durée**: 2-3 secondes
**Usage**: Pour tester rapidement que tout fonctionne

### 2. Test Moyen (3 dates)

```bash
node scripts/test_improved_fx.mjs
```

**Description**: Importe les données pour 3 dates (2025-12-02, 03, 04)
**Durée**: 5-10 secondes
**Usage**: Pour tester avec plusieurs dates

### 3. Import Complet (2024-2025)

```bash
node scripts/fetch_historical_fx_rates_improved.mjs
```

**Description**: Importe TOUTES les données historiques de 2024-01-01 à 2025-12-11
**Durée**: 20-30 minutes
**Usage**: Pour l'import initial de toutes les données

**Résultat attendu**:
- ~490 jours ouvrés importés
- 4 paires de devises par jour (EUR/USD, USD/XOF, USD/GNF, XOF/GNF)
- Agrégats mensuels calculés automatiquement

## Exécution depuis n'importe quel dossier

Les scripts peuvent être exécutés depuis:

### 1. Racine du projet

```bash
cd /path/to/project
node scripts/test_one_date.mjs
```

### 2. Dossier scripts

```bash
cd /path/to/project/scripts
node test_one_date.mjs
```

Les deux méthodes fonctionnent!

## Données Importées

### Paires de Devises

Chaque date importée contient 4 enregistrements:

1. **EUR/USD**: Taux réel depuis Frankfurter (données ECB)
2. **USD/XOF**: Calculé depuis EUR/USD avec peg fixe (655.957)
3. **USD/GNF**: Estimation basée sur taux actuel avec variance réaliste
4. **XOF/GNF**: Taux croisé calculé depuis USD/XOF et USD/GNF

### Note sur USD/GNF

Les données historiques USD/GNF sont des **estimations** car les APIs gratuites ne fournissent pas de données historiques pour le Franc Guinéen.

L'estimation utilise:
- Le taux USD/GNF actuel comme base
- Une variance quotidienne réaliste (±0.5% par jour)
- Plus de variance pour les dates plus anciennes

**À partir d'aujourd'hui**, les données quotidiennes seront **réelles** (pas d'estimation).

Voir `EXPLICATION_PROBLEME_FX_HISTORIQUE.md` pour plus de détails.

## Vérification des Données

### Vérifier les données importées

```sql
SELECT
  rate_date,
  currency_pair,
  rate,
  notes
FROM fx_rates_daily
WHERE rate_date >= '2024-01-01'
ORDER BY rate_date DESC, currency_pair
LIMIT 20;
```

### Compter les enregistrements

```sql
SELECT
  currency_pair,
  COUNT(*) as total_records,
  MIN(rate_date) as from_date,
  MAX(rate_date) as to_date
FROM fx_rates_daily
WHERE source_id = (SELECT id FROM fx_rate_sources WHERE code = 'ECB')
GROUP BY currency_pair
ORDER BY currency_pair;
```

### Vérifier les agrégats mensuels

```sql
SELECT
  year,
  month,
  currency_pair,
  ROUND(average_rate, 2) as avg_rate,
  ROUND(high_rate, 2) as high,
  ROUND(low_rate, 2) as low,
  total_days
FROM fx_rates_monthly_aggregated
WHERE year >= 2024
ORDER BY year DESC, month DESC, currency_pair;
```

## Problèmes Courants

### ❌ Error: supabaseUrl is required

**Solution**: Ce problème est maintenant résolu. Les scripts trouvent automatiquement le fichier `.env`.

Si vous rencontrez encore ce problème:
1. Vérifiez que le fichier `.env` existe à la racine du projet
2. Vérifiez qu'il contient `VITE_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`

### ❌ Données déjà existantes

**Normal!** Les scripts skippent automatiquement les dates qui existent déjà:

```
✓ 2025-12-02 - Existe déjà
```

### ❌ EUR/USD non disponible

Cela peut arriver pour:
- Les weekends (automatiquement skippés)
- Les jours fériés européens
- Les problèmes temporaires de l'API Frankfurter

Le script continue avec les autres dates.

### ⚠️ Rate limiting API

Si vous voyez beaucoup d'erreurs API:
- Les APIs gratuites ont des limites (1500 req/mois pour open.er-api.com)
- Le script attend 300ms entre chaque requête pour éviter le rate limiting
- Pour l'import complet, laissez le script tourner sans interruption

## Prochaines Étapes

Après l'import historique:

1. **Configuration du scheduler automatique**
   - Voir `FX_RATES_QUICK_START.md` section "Étape 3"
   - Configure la mise à jour quotidienne automatique

2. **Vérification dans l'application**
   - Les données apparaîtront dans le module FX Rates
   - Les graphiques d'historique seront remplis

3. **Mise à jour quotidienne**
   - À partir d'aujourd'hui, toutes les données seront réelles
   - USD/GNF sera récupéré quotidiennement depuis l'API
   - Plus besoin d'estimations

## Support

Pour plus de détails:
- `FX_RATES_QUICK_START.md` - Guide de démarrage rapide
- `EXPLICATION_PROBLEME_FX_HISTORIQUE.md` - Explication du problème USD/GNF
- `FX_RATES_AUTO_UPDATE_GUIDE.md` - Configuration de la mise à jour automatique
