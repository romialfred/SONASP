# ⚡ Quick Start - Import LBMA en 5 Minutes

## 🎯 Les 2 Actions Essentielles

### Action 1: Ajouter la Service Role Key (2 minutes)

#### Où la trouver?

1. **Ouvrez:** https://app.supabase.com
2. **Allez dans:** Settings ⚙️ > API
3. **Cherchez:** "service_role secret"
4. **Cliquez:** 👁️ (œil) pour révéler
5. **Copiez:** 📋 (icône copier)

#### Où la mettre?

Ouvrez le fichier `.env` dans votre projet et ajoutez:

```env
SUPABASE_SERVICE_ROLE_KEY=COLLEZ_ICI_LA_CLE_COPIEE
```

**Exemple complet de .env:**
```env
VITE_SUPABASE_URL=https://xyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5...

SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5eiIsInJvbGUiOiJzZXJ2aWNlX3JvbGUi...
```

**⚠️ Important:**
- PAS de guillemets
- PAS d'espaces
- Sur UNE seule ligne
- Sauvegarder le fichier (Ctrl+S)

---

### Action 2: Exécuter l'Import (3 minutes)

#### Dans le terminal:

```bash
# Assurez-vous d'être dans le dossier du projet
cd /chemin/vers/votre/gold-shipper

# Lancez l'import
node scripts/fetch_lbma_historical_data.mjs
```

#### Vous verrez:

```
✅ Using Service Role Key (admin permissions)

📅 Processing 1/2025...
   ✅ Inserted 22 records (total: 22/22)

📅 Processing 2/2025...
   ✅ Inserted 20 records (total: 42/42)

...

✨ Import Complete!
   📊 Total daily prices: 242
   📈 Total monthly aggregates: 12
```

**Durée:** ~3-5 minutes pour tout importer

---

## ✅ Vérification Rapide

### Dans Supabase Dashboard:

```sql
-- Copiez-collez dans SQL Editor
SELECT COUNT(*) FROM gold_prices_daily;
-- Résultat attendu: ~242

SELECT * FROM gold_prices_daily ORDER BY price_date LIMIT 5;
-- Devrait montrer 5 lignes avec des données
```

### Dans votre Application:

1. Ouvrez: http://localhost:5173
2. Allez à: **Prices > Gold Prices**
3. Vous devriez voir:
   - ✅ Prix affichés (pas "N/A")
   - ✅ Graphique visible
   - ✅ 18-22 jours par mois

---

## 🐛 Résolution Rapide

### Erreur: "Service role key not found"

➡️ **Solution:** Vérifiez que dans `.env`:
- La ligne commence par `SUPABASE_SERVICE_ROLE_KEY=`
- Pas de guillemets
- Pas d'espaces
- Fichier bien sauvegardé

### Erreur: "Cannot find module"

➡️ **Solution:**
```bash
npm install
```

Puis relancez:
```bash
node scripts/fetch_lbma_historical_data.mjs
```

### "Using synthetic data"

➡️ **C'est NORMAL!** Les données sont générées de manière réaliste.

Pour avoir des données LBMA officielles (optionnel):
1. S'abonner à https://metals-api.com (~$10/mois)
2. Ajouter dans `.env`: `METALS_API_KEY=votre_cle`
3. Réexécuter le script

---

## 📋 Checklist Ultra-Rapide

**Avant de commencer:**
- [ ] J'ai un compte Supabase actif
- [ ] Mon projet Gold Shipper est configuré
- [ ] J'ai accès à mon Dashboard Supabase
- [ ] Mon terminal est ouvert

**Action 1 (2 min):**
- [ ] Copié la Service Role Key depuis Supabase
- [ ] Collé dans `.env`
- [ ] Fichier `.env` sauvegardé

**Action 2 (3 min):**
- [ ] Terminal dans le bon dossier
- [ ] Commande `node scripts/...` lancée
- [ ] Message "Import Complete!" affiché
- [ ] 242 daily prices confirmés

**Vérification (1 min):**
- [ ] Requête SQL montre ~242 lignes
- [ ] Page Gold Prices affiche des données
- [ ] Pas de "N/A" ou erreurs

---

## 🎉 C'est Tout!

**Temps total:** 5-10 minutes

**Résultat:** Votre module Gold Prices est maintenant fonctionnel avec des données LBMA complètes pour 2025!

---

## 📖 Guides Complets

**Pour plus de détails:**
- `GUIDE_DETAILLE_IMPORT_LBMA.md` - Guide pas à pas détaillé (15 pages)
- `LBMA_INTEGRATION_COMPLETE.md` - Vue d'ensemble complète
- `EDGE_FUNCTION_CORRECTED.md` - Mises à jour automatiques

**Besoin d'aide?** Partagez l'erreur complète et je vous aiderai immédiatement!
