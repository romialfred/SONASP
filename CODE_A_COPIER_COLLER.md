# 🎯 Les 2 Fichiers à Copier-Coller

## 📍 Où Sont les Fichiers?

Dans votre projet, vous avez déjà 2 fichiers prêts:

```
votre-projet/
  └── supabase/
      └── functions/
          ├── fetch-daily-fx-rates/
          │   └── index.ts  ← FICHIER 1
          └── scheduled-tasks/
              └── index.ts  ← FICHIER 2
```

---

## 📄 FICHIER 1: `fetch-daily-fx-rates`

**Chemin:** `supabase/functions/fetch-daily-fx-rates/index.ts`

**Taille:** 355 lignes

**À faire:**
1. Ouvrir ce fichier dans votre éditeur
2. Sélectionner TOUT (Ctrl+A / Cmd+A)
3. Copier (Ctrl+C / Cmd+C)
4. Aller sur Supabase Dashboard > Edge Functions
5. New Edge Function → Nom: `fetch-daily-fx-rates`
6. Coller le code (Ctrl+V / Cmd+V)
7. Deploy

---

## 📄 FICHIER 2: `scheduled-tasks`

**Chemin:** `supabase/functions/scheduled-tasks/index.ts`

**Taille:** 223 lignes

**À faire:**
1. Ouvrir ce fichier dans votre éditeur
2. Sélectionner TOUT (Ctrl+A / Cmd+A)
3. Copier (Ctrl+C / Cmd+C)
4. Aller sur Supabase Dashboard > Edge Functions
5. New Edge Function → Nom: `scheduled-tasks`
6. Coller le code (Ctrl+V / Cmd+V)
7. Deploy

---

## 🌐 Lien Direct Supabase

```
https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/functions
```

---

## ✅ C'EST TOUT!

**Pas d'installation nécessaire.**
**Pas de CLI nécessaire.**
**Juste copier-coller dans l'interface web.**

---

## 🧪 Tester Après Déploiement

Dans Supabase Dashboard:
1. Cliquez sur la fonction `fetch-daily-fx-rates`
2. Cliquez sur "Invoke" ou "Test"
3. Laissez le body vide: `{}`
4. Cliquez "Send"

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

---

## ⏰ Automatiser (Optionnel)

Dans **Supabase Dashboard > SQL Editor**, exécutez:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'fetch-daily-fx-rates',
  '0 10 * * 1-5',
  $$
  SELECT
    net.http_post(
      url:='https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDMwMTAsImV4cCI6MjA3NjkxOTAxMH0.c0u5g6tZgYQF_Rn-3TlFz7z5Z-8lH6M5yKcYXyDpT1I'
      ),
      body:='{}'::jsonb
    ) as request_id;
  $$
);
```

**Ceci va exécuter la fonction automatiquement du lundi au vendredi à 10h00 UTC.**

---

## 📁 Fichiers Disponibles

Si vous voulez plus de détails:
- **METHODE_ALTERNATIVE_SANS_CLI.md** - Guide complet
- **ERREUR_BOLT_DATABASE_CORRECTION.md** - Correction de l'erreur CLI
- **CODE_A_COPIER_COLLER.md** - Ce fichier (résumé simple)

**Les 2 fichiers `.ts` sont déjà prêts dans `supabase/functions/`!**
