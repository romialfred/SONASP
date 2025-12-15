# 🚀 Quick Start: Déploiement FX Rates en 5 Minutes

## 📌 Ce Qui Va Se Passer

Vous allez déployer 2 fonctions qui mettront à jour automatiquement les taux de change **tous les jours ouvrables à 10h00 UTC**.

---

## ⚡ Option Rapide: Script Automatique

### Sur Mac/Linux:
```bash
cd /tmp/cc-agent/59164212/project
./deploy-fx-functions.sh
```

### Sur Windows:
```cmd
cd C:\path\to\project
deploy-fx-functions.bat
```

**Temps estimé: 2 minutes**

---

## 🛠️ Option Manuelle: 4 Commandes

### 1. Installer Supabase CLI (si pas déjà fait)
```bash
npm install -g supabase
```

### 2. Se connecter
```bash
supabase login
```
→ Une page web s'ouvre, cliquez sur "Authorize"

### 3. Lier le projet
```bash
cd /tmp/cc-agent/59164212/project
supabase link --project-ref boolqagzdqbahqnpawpb
```
→ Entrez le mot de passe de votre base de données

### 4. Déployer les 2 fonctions
```bash
supabase functions deploy fetch-daily-fx-rates
supabase functions deploy scheduled-tasks
```

**✅ C'EST TOUT! Les fonctions sont déployées.**

---

## ✅ Vérification Rapide

Test immédiat avec curl:
```bash
curl -X POST https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDMwMTAsImV4cCI6MjA3NjkxOTAxMH0.Dpxbwxfovgs9mghh55eVNhS0NNuJ4GiAO857jVxnstE"
```

**Résultat attendu:**
```json
{
  "success": true,
  "message": "FX rates recorded successfully",
  "data": {
    "date": "2025-12-15",
    "rates": {
      "EUR/USD": 1.16340,
      "USD/XOF": 563.83,
      "USD/GNF": 8715.75
    }
  }
}
```

OU avec le script Node.js:
```bash
node manual_fx_update.mjs
```

---

## 🔧 Configuration Finale (2 minutes)

### 1. Activer les cron jobs
Dans **Supabase Dashboard > SQL Editor**, exécutez:
```sql
-- Copier-coller le contenu de setup_fx_auto_update.sql
```

### 2. Vérifier les données
```sql
SELECT * FROM fx_rates_daily
ORDER BY rate_date DESC
LIMIT 5;
```

Vous devriez voir des taux pour **aujourd'hui (2025-12-15)**.

---

## 📊 Ce Que Ça Va Faire

### Taux Récupérés Automatiquement
- **EUR/USD** - Euro vers Dollar (de la BCE)
- **USD/XOF** - Dollar vers Franc CFA (calculé)
- **USD/GNF** - Dollar vers Franc Guinéen (de ExchangeRate-API)
- **XOF/GNF** - Franc CFA vers Franc Guinéen (calculé)

### Calendrier d'Exécution
- **Lundi à Vendredi** à **10h00 UTC**
- Skip automatiquement les weekends
- Agrégations mensuelles automatiques

### Où Voir les Données
- **Application:** Page FX Rates
- **Dashboard Supabase:** Table `fx_rates_daily`
- **Logs:** `supabase functions logs fetch-daily-fx-rates --tail`

---

## 🆘 Problèmes Courants

### "command not found: supabase"
```bash
npm install -g supabase
```

### "Not logged in"
```bash
supabase login
```

### "Project not linked"
```bash
supabase link --project-ref boolqagzdqbahqnpawpb
```

### La fonction retourne 404
→ Elle n'est pas déployée, relancez:
```bash
supabase functions deploy fetch-daily-fx-rates
```

---

## 📖 Besoin d'Aide?

- **Guide complet:** `GUIDE_DEPLOIEMENT_EDGE_FUNCTIONS.md`
- **Résumé exécutif:** `RESUME_SOLUTION_FX_RATES_AUTO_UPDATE.md`
- **Logs en temps réel:**
  ```bash
  supabase functions logs fetch-daily-fx-rates --tail
  ```

---

## ✨ Après le Déploiement

Les taux FX seront automatiquement mis à jour:
- ✅ **Tous les jours ouvrables** à 10h00 UTC
- ✅ **Skip weekends** automatiquement
- ✅ **Agrégations mensuelles** automatiques
- ✅ **Visible dans l'application** immédiatement

**Exactement comme les prix de l'or qui fonctionnent déjà!**

---

## 🎯 Checklist Finale

- [ ] Supabase CLI installé
- [ ] Connexion effectuée (`supabase login`)
- [ ] Projet lié (`supabase link`)
- [ ] Fonction `fetch-daily-fx-rates` déployée
- [ ] Fonction `scheduled-tasks` déployée
- [ ] Script SQL `setup_fx_auto_update.sql` exécuté
- [ ] Test manuel réussi (`node manual_fx_update.mjs`)
- [ ] Données visibles dans `fx_rates_daily`

**Temps total: 5-10 minutes maximum**
