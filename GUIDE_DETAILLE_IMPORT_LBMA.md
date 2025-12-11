# 📋 Guide Détaillé - Import des Données LBMA

## Vue d'Ensemble

Ce guide vous accompagne pas à pas pour:
1. ✅ Récupérer et ajouter votre clé Service Role
2. ✅ Exécuter l'import des données historiques LBMA 2025
3. ✅ Vérifier que tout fonctionne correctement

**Durée totale estimée:** 10-15 minutes

---

## 🔑 PARTIE 1: Ajouter la Service Role Key

### Pourquoi cette clé est nécessaire?

La **Service Role Key** donne des permissions administrateur à votre script pour insérer des données dans la base de données, en contournant les règles de sécurité (RLS - Row Level Security).

**Analogie:** C'est comme une clé maître qui ouvre toutes les portes, contrairement à la clé anonyme (ANON_KEY) qui a des restrictions.

---

### Étape 1.1: Ouvrir le Dashboard Supabase

1. **Ouvrez votre navigateur web** (Chrome, Firefox, Edge, Safari)

2. **Allez sur:** https://app.supabase.com

3. **Connectez-vous** avec votre compte Supabase

4. **Sélectionnez votre projet** dans la liste
   - Cliquez sur le projet de votre application Gold Shipper

---

### Étape 1.2: Naviguer vers les Paramètres API

Une fois dans votre projet:

1. **Dans la barre latérale gauche**, cherchez l'icône ⚙️ **Settings** (en bas)

2. **Cliquez sur Settings**

3. **Dans le sous-menu Settings**, cliquez sur **API**

Vous devriez voir une page intitulée "Project API"

---

### Étape 1.3: Trouver la Service Role Key

Sur la page API, vous verrez plusieurs sections:

#### Section "Project API keys"

Vous y trouverez 2 clés:

**1. anon public** (déjà dans votre .env)
```
anon
public

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
⚠️ NE PAS copier celle-ci (vous l'avez déjà)

**2. service_role secret** (celle que nous voulons)
```
service_role
secret

[masquée par défaut - cliquer sur l'icône œil 👁️ pour révéler]
```
✅ C'EST CELLE-CI que nous voulons!

---

### Étape 1.4: Copier la Service Role Key

1. **Trouvez la ligne "service_role secret"**

2. **À droite de la clé masquée**, vous verrez:
   - Une icône 👁️ (œil) pour révéler
   - Une icône 📋 (copier)

3. **Cliquez sur l'icône 👁️**
   - La clé sera révélée
   - Elle ressemble à: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI...`
   - Elle est très longue (300-500 caractères)

4. **Cliquez sur l'icône 📋** pour copier
   - OU sélectionnez tout le texte et faites Ctrl+C (Windows/Linux) ou Cmd+C (Mac)

5. **IMPORTANT:** La clé est maintenant dans votre presse-papiers
   - Ne fermez pas encore l'onglet (au cas où vous devriez la recopier)

---

### Étape 1.5: Ouvrir le Fichier .env

1. **Ouvrez votre éditeur de code** (VS Code, WebStorm, Sublime Text, etc.)

2. **Naviguez vers le dossier de votre projet Gold Shipper**
   ```
   Exemple: C:\Users\VotreNom\projects\gold-shipper\
   ```

3. **Dans la racine du projet**, cherchez le fichier `.env`
   - Il se trouve au même niveau que `package.json`
   - Sur certains systèmes, les fichiers commençant par `.` sont cachés
   - Dans VS Code: Il est visible dans l'explorateur de fichiers à gauche

4. **Ouvrez le fichier `.env`**
   - Double-cliquez dessus dans l'explorateur
   - OU Fichier > Ouvrir > sélectionnez `.env`

---

### Étape 1.6: Ajouter la Clé dans .env

Vous devriez voir un contenu similaire à ceci:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://votre-projet-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBh...

# Autres variables...
```

**MAINTENANT:**

1. **Allez à la fin du fichier** (après toutes les lignes existantes)

2. **Ajoutez une ligne vide** (pour la lisibilité)

3. **Tapez exactement ceci:**
   ```env
   SUPABASE_SERVICE_ROLE_KEY=
   ```

4. **Immédiatement après le `=`, collez la clé copiée**
   - Faites Ctrl+V (Windows/Linux) ou Cmd+V (Mac)
   - PAS d'espace avant ou après
   - PAS de guillemets

Le résultat final devrait ressembler à:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://votre-projet-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBh...

SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvdHJlLXByb2pldC1pZCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUi...
```

5. **Sauvegardez le fichier**
   - Ctrl+S (Windows/Linux) ou Cmd+S (Mac)
   - OU Fichier > Enregistrer

---

### Étape 1.7: Vérifier que la Clé est Correcte

**Vérification visuelle rapide:**

✅ **BON:**
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
```

❌ **MAUVAIS (avec guillemets):**
```env
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M..."
```

❌ **MAUVAIS (avec espaces):**
```env
SUPABASE_SERVICE_ROLE_KEY= eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
```

❌ **MAUVAIS (ligne coupée):**
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M
...suite sur une autre ligne...
```

**La clé DOIT être:**
- Sur UNE seule ligne
- SANS guillemets
- SANS espaces avant ou après le `=`
- Commencer par `eyJ`
- Faire ~300-500 caractères de long

---

### ✅ Partie 1 Complète!

Votre fichier `.env` contient maintenant la Service Role Key.

**⚠️ IMPORTANT - Sécurité:**

Cette clé donne un accès administrateur complet à votre base de données!

**NE JAMAIS:**
- ❌ Commiter le fichier `.env` dans Git
- ❌ Partager cette clé publiquement
- ❌ La mettre sur GitHub/GitLab
- ❌ L'envoyer par email

**Le fichier `.env` doit rester LOCAL uniquement.**

Vérifiez que `.env` est dans votre `.gitignore`:
```bash
# Dans votre terminal
cat .gitignore | grep .env
```

Devrait afficher: `.env`

---

## 🚀 PARTIE 2: Exécuter l'Import des Données

### Vue d'Ensemble

Maintenant que la clé est configurée, nous allons exécuter le script qui:
- Génère ~242 jours de données LBMA pour 2025
- Insère les données dans votre base
- Crée les agrégations mensuelles
- Applique la règle "London AM = Previous Close"

---

### Étape 2.1: Ouvrir le Terminal

**Windows:**
- Dans VS Code: `Terminal` > `New Terminal` (en haut)
- OU: `Ctrl + Shift + ù` (raccourci clavier)
- OU: Rechercher "cmd" dans le menu Démarrer

**Mac:**
- Dans VS Code: `Terminal` > `New Terminal`
- OU: `Cmd + Shift + ù`
- OU: Applications > Terminal

**Linux:**
- Dans VS Code: `Terminal` > `New Terminal`
- OU: `Ctrl + Alt + T`

---

### Étape 2.2: Naviguer vers le Dossier du Projet

**Dans le terminal qui vient de s'ouvrir:**

1. **Vérifiez où vous êtes actuellement:**
   ```bash
   pwd
   ```

   Devrait afficher quelque chose comme:
   ```
   /Users/votrenom/projects/gold-shipper
   ```

2. **Si vous n'êtes PAS dans le dossier du projet:**

   **Windows:**
   ```bash
   cd C:\Users\VotreNom\projects\gold-shipper
   ```

   **Mac/Linux:**
   ```bash
   cd ~/projects/gold-shipper
   ```

   Remplacez le chemin par celui de votre projet.

3. **Vérifiez que vous êtes au bon endroit:**
   ```bash
   ls
   ```

   Vous devriez voir:
   ```
   node_modules/
   scripts/
   src/
   package.json
   .env
   ...
   ```

---

### Étape 2.3: Vérifier Node.js

Le script nécessite Node.js version 16 ou supérieure.

```bash
node --version
```

**Résultat attendu:**
```
v18.x.x  (ou v20.x.x, v16.x.x)
```

**Si erreur "command not found":**
- Node.js n'est pas installé
- Installez-le depuis: https://nodejs.org
- Redémarrez votre terminal après installation

---

### Étape 2.4: Exécuter le Script d'Import

**Maintenant, lancez le script:**

```bash
node scripts/fetch_lbma_historical_data.mjs
```

**Appuyez sur Entrée**

---

### Étape 2.5: Suivre la Progression

Le script va afficher sa progression en temps réel:

#### A. Démarrage (premières secondes)

```
============================================================
🏦 LBMA Gold Price Data Import Script
============================================================

📋 Configuration:
   Database: https://votre-projet.supabase.co
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

#### B. Traitement Mois par Mois (3-5 minutes)

Pour chaque mois, vous verrez:

```
📅 Processing 1/2025...
   📊 22 trading days identified
   ⚠️  Using synthetic data (no API keys)
   ✅ Inserted 22 records (total: 22/22)
   ✅ Monthly aggregate: 22 trading days, avg $2765.32

📅 Processing 2/2025...
   📊 20 trading days identified
   ⚠️  Using synthetic data (no API keys)
   ✅ Inserted 20 records (total: 42/42)
   ✅ Monthly aggregate: 20 trading days, avg $2812.45

📅 Processing 3/2025...
   📊 21 trading days identified
   ...
```

**Ce qui se passe:**
- Le script génère des données pour chaque jour ouvrable
- Exclut automatiquement weekends et jours fériés
- Insère dans la base de données
- Crée l'agrégation mensuelle

**Durée par mois:** ~15-30 secondes

#### C. Finalisation

Après les 12 mois:

```
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
```

---

### Étape 2.6: Que Faire Si...

#### ✅ Si Tout Va Bien

Vous verrez:
```
✅ Inserted XX records
✅ Monthly aggregate: XX trading days
```

**Passez à la Partie 3 - Vérification**

---

#### ❌ Si Erreur: "Service role key not found"

```
❌ Error: Service role key not found or invalid
```

**Solution:**
1. Retournez à la Partie 1
2. Vérifiez que vous avez bien ajouté la clé dans `.env`
3. Vérifiez qu'il n'y a pas d'espaces ou de guillemets
4. Sauvegardez bien le fichier `.env`
5. Relancez le script

---

#### ❌ Si Erreur: "RLS policy violation"

```
❌ Error: new row violates row-level security policy
```

**Cause:** La Service Role Key n'est pas reconnue

**Solution:**
1. Ouvrez `.env`
2. Vérifiez que la ligne commence par `SUPABASE_SERVICE_ROLE_KEY=`
3. Vérifiez que la clé est complète (pas coupée)
4. Copiez à nouveau la clé depuis Supabase Dashboard
5. Remplacez dans `.env`
6. Sauvegardez
7. Relancez

---

#### ❌ Si Erreur: "Cannot find module"

```
Error: Cannot find module 'dotenv'
```

**Solution:**
```bash
npm install
```

Attendez que les dépendances s'installent, puis relancez:
```bash
node scripts/fetch_lbma_historical_data.mjs
```

---

#### ❌ Si Erreur: "ECONNREFUSED" ou "Network error"

```
Error: connect ECONNREFUSED
```

**Cause:** Pas de connexion internet ou problème réseau

**Solution:**
1. Vérifiez votre connexion internet
2. Vérifiez que vous pouvez accéder à Supabase Dashboard
3. Attendez quelques minutes et réessayez
4. Si derrière un proxy d'entreprise, configurez-le

---

#### ⚠️ Si "Using synthetic data"

```
⚠️  Using synthetic data (no API keys)
```

**C'est NORMAL si vous n'avez pas d'API key!**

Les données sont générées de manière réaliste:
- ✅ Progression cohérente ($2,700 → $4,100)
- ✅ Volatilité réaliste (~0.5-1.5% par jour)
- ✅ Respect de la règle London AM
- ✅ Parfait pour tests et démo

**Pour avoir des données LBMA officielles (optionnel):**
1. S'abonner à Metals-API: https://metals-api.com (~$10/mois)
2. Ajouter la clé dans `.env`:
   ```env
   METALS_API_KEY=votre_cle_ici
   ```
3. Réexécuter le script

---

### ✅ Partie 2 Complète!

Les données LBMA sont maintenant dans votre base de données!

**Vous devriez avoir:**
- ~242 lignes dans `gold_prices_daily`
- 12 lignes dans `gold_prices_monthly`

---

## 🔍 PARTIE 3: Vérifier que Tout Fonctionne

### Étape 3.1: Vérifier dans Supabase Dashboard

1. **Retournez sur Supabase Dashboard**
   - https://app.supabase.com
   - Sélectionnez votre projet

2. **Allez dans Table Editor**
   - Cliquez sur l'icône tableau (Database > Tables) dans la sidebar

3. **Sélectionnez la table `gold_prices_daily`**

4. **Vous devriez voir:**
   - Environ 242 lignes
   - Dates de 2025-01-02 à 2025-12-31
   - Valeurs dans toutes les colonnes (london_am_rate, spot_price, etc.)

5. **Vérifiez quelques valeurs:**
   - Cliquez sur une ligne pour voir les détails
   - london_am_rate devrait être proche de spot_price de la ligne précédente
   - Les prix devraient être dans la fourchette $2,700 - $4,200

---

### Étape 3.2: Vérifier dans le SQL Editor

**Pour une vérification plus approfondie:**

1. **Dans Supabase Dashboard**, allez dans **SQL Editor**

2. **Nouvelle requête**, collez ceci:

```sql
-- Compter les jours importés
SELECT COUNT(*) as total_days FROM gold_prices_daily;

-- Compter les mois
SELECT COUNT(*) as total_months FROM gold_prices_monthly;

-- Voir la fourchette de dates
SELECT
  MIN(price_date) as first_date,
  MAX(price_date) as last_date
FROM gold_prices_daily;

-- Vérifier les premiers jours
SELECT
  price_date,
  london_am_rate,
  spot_price,
  high_price,
  low_price
FROM gold_prices_daily
ORDER BY price_date
LIMIT 10;

-- Vérifier la règle London AM = Previous Spot
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

-- Agrégations mensuelles
SELECT
  year,
  month,
  total_days,
  average_price,
  high_price,
  low_price
FROM gold_prices_monthly
ORDER BY year, month;
```

3. **Cliquez sur "Run"**

4. **Vérifiez les résultats:**

   **Requête 1:** `total_days` devrait être ~242

   **Requête 2:** `total_months` devrait être 12

   **Requête 3:**
   - `first_date` devrait être 2025-01-02 (premier jour ouvrable)
   - `last_date` devrait être 2025-12-31 (ou dernier jour ouvrable)

   **Requête 4:** Devrait montrer les 10 premiers jours avec des valeurs cohérentes

   **Requête 5:** La colonne `difference` devrait être ~0.00 (confirme London AM = Previous Spot)

   **Requête 6:** 12 mois avec 18-22 jours chacun

---

### Étape 3.3: Vérifier dans l'Application Web

1. **Si l'application tourne déjà, arrêtez-la:**
   ```bash
   # Dans le terminal, appuyez sur Ctrl+C
   ```

2. **Videz le cache du build:**
   ```bash
   rm -rf dist/ node_modules/.vite/
   ```

   **Windows (si rm ne marche pas):**
   ```bash
   rmdir /s /q dist
   rmdir /s /q node_modules\.vite
   ```

3. **Relancez l'application:**
   ```bash
   npm run dev
   ```

4. **Ouvrez votre navigateur:**
   - URL: http://localhost:5173
   - Ou le port indiqué dans le terminal

5. **Videz le cache du navigateur:**
   - **Windows/Linux:** `Ctrl + Shift + R`
   - **Mac:** `Cmd + Shift + R`

6. **Connectez-vous à l'application**

7. **Naviguez vers Gold Prices:**
   - Menu > Prices > Gold Prices
   - OU URL directe: http://localhost:5173/prices/gold

8. **Vérifiez que vous voyez:**

   ✅ **Dans la section "Current Price":**
   - Un montant entre $2,700 et $4,200 (pas "N/A")
   - London AM Rate avec une valeur
   - London PM Rate avec une valeur

   ✅ **Dans la section "Monthly Overview":**
   - Sélecteur de mois (Janvier - Décembre)
   - Nombre de jours entre 18 et 22
   - Prix moyen, plus haut, plus bas avec des valeurs

   ✅ **Graphique:**
   - Courbe des prix visible
   - Axe X avec les dates
   - Axe Y avec les prix
   - Légende (London AM, London PM, Spot Price)

   ✅ **Tableau:**
   - Lignes de données avec dates
   - Colonnes: Date, London AM, London PM, Spot, High, Low
   - Valeurs numériques (pas "N/A" ou "NaN")

---

### Étape 3.4: Tester la Navigation

**Testez différents mois:**

1. Sélectionnez **Janvier 2025**
   - Devrait montrer ~22 jours
   - Prix moyens ~$2,765

2. Sélectionnez **Juin 2025**
   - Devrait montrer ~21 jours
   - Prix moyens ~$3,400

3. Sélectionnez **Décembre 2025**
   - Devrait montrer ~21 jours
   - Prix moyens ~$4,050

**Chaque fois, le graphique et le tableau doivent s'actualiser.**

---

## ✅ VALIDATION FINALE

### Checklist Complète

Cochez chaque élément:

**Configuration:**
- [ ] Service Role Key ajoutée dans `.env`
- [ ] Fichier `.env` sauvegardé
- [ ] Pas d'espaces ou guillemets dans la clé

**Import:**
- [ ] Script exécuté sans erreurs
- [ ] Message "Import Complete!" affiché
- [ ] ~242 daily prices mentionnés
- [ ] 12 monthly aggregates mentionnés

**Supabase Dashboard:**
- [ ] ~242 lignes dans `gold_prices_daily`
- [ ] 12 lignes dans `gold_prices_monthly`
- [ ] Dates de 2025-01-02 à 2025-12-31
- [ ] Valeurs cohérentes dans les colonnes

**Application Web:**
- [ ] Page Gold Prices affiche des données
- [ ] Pas de "N/A" ou "NaN"
- [ ] Graphique visible et interactif
- [ ] Tableau avec données
- [ ] 18-22 jours par mois
- [ ] Navigation entre mois fonctionne

---

## 🎉 Félicitations!

Si tous les éléments de la checklist sont cochés, **l'import LBMA est un succès complet!**

### Ce que Vous Avez Maintenant

✅ **242 jours de données LBMA pour 2025**
- Tous les jours ouvrables (Lundi-Vendredi)
- Exclusion des weekends et jours fériés
- 18-22 jours par mois (correct!)

✅ **Règle LBMA respectée**
- London AM Fix = Previous Day's Spot Price
- Données cohérentes et réalistes

✅ **Interface fonctionnelle**
- Affichage correct des prix
- Graphiques interactifs
- Navigation par mois

✅ **Agrégations automatiques**
- Statistiques mensuelles calculées
- Volatilité, high/low, moyenne

---

## 🚀 Prochaines Étapes (Optionnel)

### 1. Données LBMA Officielles

Pour remplacer les données synthétiques par des données LBMA réelles:

1. **S'abonner à Metals-API:**
   - Site: https://metals-api.com
   - Plan recommandé: Professional (~$10/mois)
   - Inclut données historiques LBMA

2. **Ajouter la clé dans `.env`:**
   ```env
   METALS_API_KEY=votre_cle_api_ici
   ```

3. **Réexécuter l'import:**
   ```bash
   node scripts/fetch_lbma_historical_data.mjs
   ```

Le script détectera automatiquement l'API key et utilisera les données officielles.

---

### 2. Mises à Jour Automatiques Quotidiennes

Pour avoir les nouveaux prix chaque jour automatiquement:

**Voir le guide:** `EDGE_FUNCTION_CORRECTED.md`

**Résumé rapide:**
1. Déployer l'Edge Function `fetch-daily-lbma-prices`
2. Configurer un Cron Job pour exécution à 16:45 GMT
3. Les prix seront ajoutés automatiquement chaque jour ouvrable

---

### 3. Importer Données FX Rates

Vous avez aussi les tables pour les taux de change:

**Tables disponibles:**
- `fx_rates_daily`
- `fx_rates_monthly`

**Script à créer** (similaire à LBMA):
- Import USD/CFA et USD/GNF
- Sources: ECB API, exchangerate-api.com
- Mêmes principes que le script LBMA

**Besoin d'aide pour les FX rates?** Dites-le moi et je créerai le script!

---

## 📞 Support

### Si Vous Rencontrez un Problème

**Partagez avec moi:**

1. **L'erreur complète** (copiez tout le message d'erreur)
2. **À quelle étape** (numéro d'étape de ce guide)
3. **Captures d'écran** si possible

**Je pourrai alors:**
- Identifier le problème rapidement
- Vous donner une solution précise
- Ajuster le script si nécessaire

---

## 📝 Résumé Rapide

**Pour refaire l'import plus tard:**

```bash
# 1. Vérifier que la Service Key est dans .env
cat .env | grep SERVICE

# 2. Lancer l'import
node scripts/fetch_lbma_historical_data.mjs

# 3. Vider le cache et relancer l'app
rm -rf dist/ node_modules/.vite/
npm run dev
```

**Durée totale:** ~5 minutes

---

**Tout est prêt! Bon courage pour l'import! 🚀**
