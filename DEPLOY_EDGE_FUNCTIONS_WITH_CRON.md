# 🚀 Déploiement Edge Functions avec Cron (CLI)

## Si l'interface Supabase n'a pas d'option "Cron Triggers"

Utilisez Supabase CLI pour déployer avec les cron jobs intégrés.

## Étape 1: Installer Supabase CLI

### Windows
```bash
# Avec npm (déjà installé)
npm install -g supabase

# OU avec Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Mac/Linux
```bash
# Avec npm
npm install -g supabase

# OU avec Homebrew (Mac)
brew install supabase/tap/supabase
```

## Étape 2: Se Connecter à Supabase

```bash
# Se connecter
supabase login

# Lier au projet
supabase link --project-ref boolqagzdqbahqnpawpb
```

Vous devrez:
1. Copier votre Access Token depuis: https://supabase.com/dashboard/account/tokens
2. Le coller dans le terminal

## Étape 3: Déployer avec Cron

### A. Fonction FX Rates (Lundi-Vendredi, 10h00 UTC)

```bash
supabase functions deploy fetch-daily-fx-rates \
  --project-ref boolqagzdqbahqnpawpb \
  --no-verify-jwt
```

Puis configurer le cron:
```bash
supabase functions schedule fetch-daily-fx-rates \
  --cron "0 10 * * 1-5"
```

### B. Fonction Gold Prices (Lundi-Vendredi, 16h45 UTC)

```bash
supabase functions deploy fetch-daily-lbma-prices \
  --project-ref boolqagzdqbahqnpawpb \
  --no-verify-jwt
```

Puis configurer le cron:
```bash
supabase functions schedule fetch-daily-lbma-prices \
  --cron "45 16 * * 1-5"
```

## Étape 4: Vérifier les Crons

```bash
supabase functions list
```

Vous devriez voir vos fonctions avec leurs schedules.

## Format Cron Expliqué

```
0 10 * * 1-5
│  │  │ │ │
│  │  │ │ └─ Jour de semaine (1-5 = Lundi-Vendredi)
│  │  │ └─── Mois (*)
│  │  └───── Jour du mois (*)
│  └──────── Heure (10 = 10h00)
└─────────── Minute (0)
```

## Troubleshooting

### Erreur: "Supabase CLI not found"
```bash
npm install -g supabase
```

### Erreur: "Project not linked"
```bash
supabase link --project-ref boolqagzdqbahqnpawpb
```

### Erreur: "Function already exists"
Ajoutez `--legacy-bundle false` au deploy:
```bash
supabase functions deploy fetch-daily-fx-rates --legacy-bundle false
```

### Vérifier que ça marche
```bash
# Voir les logs
supabase functions logs fetch-daily-fx-rates

# Invoquer manuellement
supabase functions invoke fetch-daily-fx-rates
```

---

## Alternative: pg_cron (Non Recommandé)

Si vraiment vous voulez utiliser pg_cron, exécutez `setup_fx_auto_update_pgadmin.sql`,
mais c'est une approche plus ancienne et complexe.
