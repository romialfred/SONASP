# Guide Pratique: Déploiement des Fonctions Edge Supabase

## 🎯 Objectif

Déployer les fonctions Edge suivantes:
- ✅ `fetch-daily-fx-rates` - Récupération automatique des taux de change
- ✅ `scheduled-tasks` - Orchestrateur des tâches planifiées

## Méthode 1: Via Supabase CLI (⭐ Recommandée)

### Étape 1: Installer Supabase CLI

**Sur Windows:**
```bash
npm install -g supabase
```

**Sur Mac/Linux:**
```bash
brew install supabase/tap/supabase
# OU
npm install -g supabase
```

### Étape 2: Vérifier l'installation
```bash
supabase --version
```

Vous devriez voir: `supabase version 1.x.x`

### Étape 3: Se connecter à Supabase

```bash
supabase login
```

**Ce qui se passe:**
1. Une page web s'ouvre dans votre navigateur
2. Cliquez sur "Authorize" pour autoriser le CLI
3. Le terminal affiche "Logged in successfully"

### Étape 4: Lier votre projet

```bash
cd /tmp/cc-agent/59164212/project
supabase link --project-ref boolqagzdqbahqnpawpb
```

**Quand demandé:**
- Database password: [Entrez le mot de passe de votre base de données]

**Confirmation attendue:**
```
✓ Linked project boolqagzdqbahqnpawpb
```

### Étape 5: Déployer les fonctions

```bash
# Déployer fetch-daily-fx-rates
supabase functions deploy fetch-daily-fx-rates

# Déployer scheduled-tasks
supabase functions deploy scheduled-tasks
```

**Résultat attendu pour chaque fonction:**
```
Deploying function fetch-daily-fx-rates...
Function URL: https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates
✓ Deployed function fetch-daily-fx-rates
```

### Étape 6: Vérifier le déploiement

```bash
# Lister toutes les fonctions déployées
supabase functions list
```

**Vous devriez voir:**
```
fetch-daily-fx-rates
fetch-daily-lbma-prices
scheduled-tasks
send-activation-email
create-user
...
```

### Étape 7: Tester immédiatement

```bash
# Test de fetch-daily-fx-rates
curl -X POST https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDMwMTAsImV4cCI6MjA3NjkxOTAxMH0.Dpxbwxfovgs9mghh55eVNhS0NNuJ4GiAO857jVxnstE"

# OU utilisez le script Node.js
node manual_fx_update.mjs
```

**✅ C'EST TERMINÉ!** Les fonctions sont maintenant déployées et opérationnelles.

---

## Méthode 2: Via Dashboard Supabase (Méthode Manuelle)

### Étape 1: Accéder au Dashboard

1. Ouvrez votre navigateur
2. Allez sur: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb
3. Connectez-vous si nécessaire

### Étape 2: Naviguer vers Edge Functions

Dans le menu latéral gauche:
1. Cliquez sur "Edge Functions"
2. Vous verrez la liste des fonctions existantes

### Étape 3: Créer la fonction fetch-daily-fx-rates

1. Cliquez sur le bouton **"+ New Edge Function"**
2. Remplissez le formulaire:
   - **Function Name:** `fetch-daily-fx-rates`
   - **Description:** `Automatic daily FX rates fetching from ECB and other sources`

3. Copiez le code depuis votre projet local:

**📂 Ouvrez:** `/tmp/cc-agent/59164212/project/supabase/functions/fetch-daily-fx-rates/index.ts`

**Copiez tout le contenu du fichier** et collez-le dans l'éditeur du Dashboard.

4. Cliquez sur **"Deploy"**

### Étape 4: Créer la fonction scheduled-tasks

1. Cliquez à nouveau sur **"+ New Edge Function"**
2. Remplissez le formulaire:
   - **Function Name:** `scheduled-tasks`
   - **Description:** `Orchestrator for scheduled tasks (FX rates, gold prices, emails)`

3. Copiez le code depuis votre projet local:

**📂 Ouvrez:** `/tmp/cc-agent/59164212/project/supabase/functions/scheduled-tasks/index.ts`

**Copiez tout le contenu du fichier** et collez-le dans l'éditeur du Dashboard.

4. Cliquez sur **"Deploy"**

### Étape 5: Vérifier le déploiement

Dans la liste des Edge Functions, vous devriez maintenant voir:
- ✅ fetch-daily-fx-rates (avec une pastille verte "Deployed")
- ✅ scheduled-tasks (avec une pastille verte "Deployed")

### Étape 6: Tester dans le Dashboard

Pour chaque fonction:
1. Cliquez sur le nom de la fonction
2. Cliquez sur l'onglet "Invoke"
3. Cliquez sur le bouton "Invoke function"
4. Vérifiez la réponse dans la section "Response"

**Réponse attendue pour fetch-daily-fx-rates:**
```json
{
  "success": true,
  "message": "FX rates recorded successfully",
  "data": {
    "date": "2025-12-15",
    "rates": {
      "EUR/USD": 1.16340,
      "USD/XOF": 563.83,
      "USD/GNF": 8715.75,
      "XOF/GNF": 15.4581
    }
  }
}
```

---

## Script de Déploiement Automatique

J'ai créé un script shell pour automatiser le déploiement.

**Fichier:** `deploy-fx-functions.sh`

```bash
#!/bin/bash

echo "🚀 Déploiement des fonctions Edge pour mise à jour automatique des taux FX"
echo ""

# Vérifier que Supabase CLI est installé
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI n'est pas installé"
    echo "Installation: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI détecté: $(supabase --version)"
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -d "supabase/functions/fetch-daily-fx-rates" ]; then
    echo "❌ Erreur: Répertoire supabase/functions/fetch-daily-fx-rates non trouvé"
    echo "Assurez-vous d'être dans le répertoire racine du projet"
    exit 1
fi

echo "📂 Répertoire du projet vérifié"
echo ""

# Déployer fetch-daily-fx-rates
echo "📤 Déploiement de fetch-daily-fx-rates..."
supabase functions deploy fetch-daily-fx-rates

if [ $? -eq 0 ]; then
    echo "✅ fetch-daily-fx-rates déployé avec succès"
else
    echo "❌ Erreur lors du déploiement de fetch-daily-fx-rates"
    exit 1
fi

echo ""

# Déployer scheduled-tasks
echo "📤 Déploiement de scheduled-tasks..."
supabase functions deploy scheduled-tasks

if [ $? -eq 0 ]; then
    echo "✅ scheduled-tasks déployé avec succès"
else
    echo "❌ Erreur lors du déploiement de scheduled-tasks"
    exit 1
fi

echo ""
echo "🎉 DÉPLOIEMENT TERMINÉ AVEC SUCCÈS!"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Exécutez setup_fx_auto_update.sql dans Supabase SQL Editor"
echo "2. Testez avec: node manual_fx_update.mjs"
echo ""
```

**Pour utiliser le script:**
```bash
chmod +x deploy-fx-functions.sh
./deploy-fx-functions.sh
```

---

## Vérifications Post-Déploiement

### 1️⃣ Vérifier dans le Dashboard

**Supabase Dashboard > Edge Functions:**
- Les deux fonctions doivent apparaître avec le statut "Deployed"
- Vous pouvez voir les logs en temps réel

### 2️⃣ Vérifier avec curl

```bash
# Test fetch-daily-fx-rates
curl -i -X POST https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDMwMTAsImV4cCI6MjA3NjkxOTAxMH0.Dpxbwxfovgs9mghh55eVNhS0NNuJ4GiAO857jVxnstE"
```

**Statut attendu:** `HTTP/2 200` (au lieu de 404)

### 3️⃣ Vérifier avec le script Node.js

```bash
node manual_fx_update.mjs
```

**Résultat attendu:**
```
🔍 Testing FX rates update function...
-----------------------------------

✅ FX rates update executed successfully!

📊 Results:
{
  "success": true,
  "message": "FX rates recorded successfully",
  "data": {
    "date": "2025-12-15",
    "rates": {
      "EUR/USD": 1.16340,
      "USD/XOF": 563.83,
      "USD/GNF": 8715.75,
      "XOF/GNF": 15.4581
    }
  }
}

📅 Latest rates in database:
┌─────────────┬──────────┬────────┬──────────┐
│ rate_date   │ eur_usd  │ usd_xof│ usd_gnf  │
├─────────────┼──────────┼────────┼──────────┤
│ 2025-12-15  │ 1.16340  │ 563.83 │ 8715.75  │
└─────────────┴──────────┴────────┴──────────┘
```

### 4️⃣ Vérifier dans la base de données

**Supabase Dashboard > SQL Editor:**

```sql
-- Vérifier les derniers taux enregistrés
SELECT
  rate_date,
  eur_usd,
  usd_xof,
  usd_gnf,
  xof_gnf,
  created_at
FROM fx_rates_daily
ORDER BY rate_date DESC
LIMIT 5;
```

**Vous devriez voir des données pour aujourd'hui (2025-12-15).**

---

## Résolution de Problèmes

### ❌ Problème: "command not found: supabase"

**Solution:**
```bash
npm install -g supabase
# OU
brew install supabase/tap/supabase
```

### ❌ Problème: "Not logged in"

**Solution:**
```bash
supabase login
```
Suivez les instructions dans le navigateur.

### ❌ Problème: "Project not linked"

**Solution:**
```bash
supabase link --project-ref boolqagzdqbahqnpawpb
```

### ❌ Problème: "Function deployment failed"

**Solutions possibles:**
1. Vérifiez que vous êtes dans le répertoire racine du projet
2. Vérifiez que le dossier `supabase/functions/[nom-fonction]` existe
3. Vérifiez votre connexion internet
4. Relancez `supabase login`

### ❌ Problème: La fonction est déployée mais retourne une erreur

**Solution:**
1. Vérifiez les logs:
   ```bash
   supabase functions logs fetch-daily-fx-rates
   ```
2. Testez avec des données de debug
3. Vérifiez que toutes les dépendances sont correctes

---

## Commandes Utiles

### Voir les logs en temps réel
```bash
# Logs d'une fonction spécifique
supabase functions logs fetch-daily-fx-rates --tail

# Logs de toutes les fonctions
supabase functions logs --tail
```

### Redéployer après modification
```bash
# Si vous modifiez le code localement
supabase functions deploy fetch-daily-fx-rates --no-verify-jwt
```

### Lister toutes les fonctions
```bash
supabase functions list
```

### Supprimer une fonction (si besoin)
```bash
supabase functions delete [nom-fonction]
```

---

## Récapitulatif Visuel

```
┌─────────────────────────────────────────────────────────────────┐
│                    AVANT LE DÉPLOIEMENT                          │
│                                                                   │
│  ❌ curl fetch-daily-fx-rates → 404 NOT FOUND                   │
│  ❌ Taux FX bloqués au 11 décembre                              │
│  ❌ Pas de mise à jour automatique                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    DÉPLOIEMENT VIA CLI
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  1. supabase login                                               │
│  2. supabase link --project-ref boolqagzdqbahqnpawpb            │
│  3. supabase functions deploy fetch-daily-fx-rates              │
│  4. supabase functions deploy scheduled-tasks                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    APRÈS LE DÉPLOIEMENT                          │
│                                                                   │
│  ✅ curl fetch-daily-fx-rates → 200 OK                          │
│  ✅ Taux FX à jour (15 décembre)                                │
│  ✅ Mise à jour automatique tous les jours ouvrables à 10h UTC │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prochaines Étapes Après Déploiement

1. ✅ **Fonctions déployées** (vous êtes ici)
2. ⏳ **Configurer les cron jobs:** Exécuter `setup_fx_auto_update.sql`
3. ⏳ **Tester:** Exécuter `node manual_fx_update.mjs`
4. ⏳ **Vérifier:** Consulter les données dans la base

---

## Support

Si vous rencontrez des problèmes:

1. **Vérifiez les logs:**
   ```bash
   supabase functions logs fetch-daily-fx-rates --tail
   ```

2. **Consultez la documentation Supabase:**
   https://supabase.com/docs/guides/functions

3. **Vérifiez le statut de Supabase:**
   https://status.supabase.com/

---

**🎯 Temps estimé pour le déploiement complet: 5-10 minutes**

**💡 Conseil:** Utilisez la Méthode 1 (CLI) car elle est plus rapide et permet de gérer facilement les mises à jour futures.
