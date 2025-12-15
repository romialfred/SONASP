# ❌ ERREUR: "npm install -g Bolt Database"

## 🔴 Ce Que Vous Avez Fait (INCORRECT)

```bash
npm install -g Bolt Database
```

**Erreur:**
```
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/Bolt - Not found
npm error 404 'Bolt' is not in this registry
```

---

## ✅ La BONNE Commande

```bash
npm install -g supabase
```

**"supabase" - pas "Bolt", pas "Bolt Database", juste "supabase"**

---

## 🎯 Les 5 Commandes CORRECTES

Copiez-collez ces commandes une par une:

### 1️⃣ Installer Supabase CLI
```bash
npm install -g supabase
```

**Attendez que ça termine, puis vérifiez:**
```bash
supabase --version
```

Vous devriez voir quelque chose comme: `1.212.4`

---

### 2️⃣ Se connecter à Supabase
```bash
supabase login
```

- Une page web s'ouvrira dans votre navigateur
- Cliquez sur "Authorize"
- Revenez au terminal

**Résultat attendu:**
```
You are now logged in.
```

---

### 3️⃣ Aller dans le dossier du projet
```bash
cd /tmp/cc-agent/59164212/project
```

**Sur Windows, utilisez:**
```bash
cd C:\Users\VotreNom\path\to\project
```

---

### 4️⃣ Lier le projet
```bash
supabase link --project-ref boolqagzdqbahqnpawpb
```

**Si demandé, entrez le mot de passe de votre base de données.**

**Résultat attendu:**
```
Finished supabase link.
```

---

### 5️⃣ Déployer les fonctions
```bash
supabase functions deploy fetch-daily-fx-rates
```

Attendez que ça termine, puis:

```bash
supabase functions deploy scheduled-tasks
```

**Résultat attendu pour chaque fonction:**
```
Deploying function fetch-daily-fx-rates...
✓ Deployed Function fetch-daily-fx-rates in 2.5s
URL: https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates
```

---

## ✅ DÉPLOIEMENT TERMINÉ!

---

## 🧪 Tester Que Ça Marche

### Test avec curl:
```bash
curl -X POST https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDMwMTAsImV4cCI6MjA3NjkxOTAxMH0.c0u5g6tZgYQF_Rn-3TlFz7z5Z-8lH6M5yKcYXyDpT1I" \
  -H "Content-Type: application/json"
```

**Résultat attendu:**
```json
{
  "success": true,
  "message": "FX rates recorded successfully",
  "rates": {
    "eur_usd": 1.16340,
    "usd_xof": 563.83,
    "usd_gnf": 8715.75
  }
}
```

### OU test avec Node.js:
```bash
node manual_fx_update.mjs
```

---

## 🔍 Pourquoi "Bolt" Ne Marche Pas?

**"Bolt" est le nom de l'environnement de développement (Bolt.new)**, pas un package npm.

Pour déployer sur Supabase, vous utilisez le **Supabase CLI**, qui s'appelle "supabase".

| ❌ FAUX | ✅ CORRECT |
|---------|-----------|
| `npm install -g Bolt` | `npm install -g supabase` |
| `npm install -g Bolt Database` | `npm install -g supabase` |
| `Bolt functions deploy` | `supabase functions deploy` |
| `bolt login` | `supabase login` |

---

## 🆘 Si Vous Avez Encore des Erreurs

### "command not found: npm"
Installez Node.js d'abord: https://nodejs.org/

### "EACCES: permission denied"

**Mac/Linux:**
```bash
sudo npm install -g supabase
```

**Windows:**
- Ouvrir PowerShell ou CMD **en tant qu'Administrateur**
- Puis: `npm install -g supabase`

### "Project not found"
Vérifiez que vous utilisez le bon project-ref:
```bash
supabase link --project-ref boolqagzdqbahqnpawpb
```

### "Invalid credentials"
Reconnectez-vous:
```bash
supabase logout
supabase login
```

---

## 📊 Après le Déploiement

### Configurer les Cron Jobs (optionnel)

**Dans Supabase Dashboard > SQL Editor**, exécutez:
```sql
-- Copier-coller le contenu du fichier: setup_fx_auto_update_pgadmin.sql
```

### Vérifier les données

**Dans Supabase Dashboard > Table Editor**, sélectionnez `fx_rates_daily`

Vous devriez voir une ligne avec la date d'aujourd'hui.

---

## 🎯 Résumé Ultra-Rapide

```bash
# 1. LA BONNE COMMANDE
npm install -g supabase

# 2. Se connecter
supabase login

# 3. Lier
cd /tmp/cc-agent/59164212/project
supabase link --project-ref boolqagzdqbahqnpawpb

# 4 & 5. Déployer
supabase functions deploy fetch-daily-fx-rates
supabase functions deploy scheduled-tasks
```

**C'EST TOUT! ✅**

---

## 📁 Fichiers Utiles

- **ERREUR_BOLT_DATABASE_CORRECTION.md** - Ce fichier (correction de l'erreur)
- **QUICK_START_DEPLOIEMENT_FX.md** - Guide de démarrage rapide
- **GUIDE_PGADMIN_2_ETAPES.md** - Guide complet en 2 étapes
- **setup_fx_auto_update_pgadmin.sql** - Pour configurer les cron jobs
- **deploy-fx-functions.sh** - Script automatique (Mac/Linux)
- **deploy-fx-functions.bat** - Script automatique (Windows)

---

## ✨ Maintenant Essayez!

**Copiez cette commande dans votre terminal:**

```bash
npm install -g supabase
```

Puis suivez les 5 étapes ci-dessus. 🚀
