# ✅ CHECKLIST DE DÉPLOIEMENT - Correction batch_id

## 📋 AVANT DE COMMENCER

- [ ] J'ai sauvegardé mes changements locaux
- [ ] J'ai accès à Supabase (propriétaire du projet)
- [ ] L'application fonctionne (sauf l'erreur batch_id)

---

## 🎯 PHASE 1: EXÉCUTION SQL (2 MINUTES)

### Étape 1.1: Ouvrir Supabase
- [ ] J'ai ouvert Supabase SQL Editor
- [ ] URL: `https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/sql`

### Étape 1.2: Copier le Script
- [ ] J'ai ouvert `FIX_BATCH_ID_MAINTENANT.sql`
- [ ] J'ai sélectionné TOUT (Ctrl+A)
- [ ] J'ai copié (Ctrl+C)

### Étape 1.3: Exécuter
- [ ] J'ai collé dans Supabase SQL Editor (Ctrl+V)
- [ ] J'ai cliqué "Run" (ou Ctrl+Enter)
- [ ] J'attends... (~30 secondes)

### Étape 1.4: Vérifier le Succès
- [ ] J'ai vu le message:
  ```
  ╔════════════════════════════════════════╗
  ║  ✅ SUCCESS - CORRECTION TERMINÉE      ║
  ╚════════════════════════════════════════╝
  ```
- [ ] Aucune erreur rouge affichée
- [ ] Toutes les étapes ont "✅"

---

## 🔄 PHASE 2: RAFRAÎCHISSEMENT APP (1 MINUTE)

### Étape 2.1: Vider le Cache
- [ ] J'ai appuyé sur `Ctrl + Shift + Delete` (Windows/Linux)
- [ ] OU `Cmd + Shift + Delete` (Mac)
- [ ] J'ai coché "Cached images and files"
- [ ] J'ai sélectionné "All time"
- [ ] J'ai cliqué "Clear data"

### Étape 2.2: Recharger l'Application
- [ ] J'ai appuyé sur `Ctrl + Shift + R` (force reload)
- [ ] OU `Cmd + Shift + R` (Mac)
- [ ] La page s'est rechargée complètement

---

## ✅ PHASE 3: TEST (1 MINUTE)

### Étape 3.1: Naviguer vers Inventory
- [ ] Je suis connecté à l'application
- [ ] J'ai navigué vers "Inventory Management"
- [ ] La page s'affiche correctement

### Étape 3.2: Tester Add Stock
- [ ] J'ai cliqué sur "Add Stock"
- [ ] Le formulaire s'affiche
- [ ] Pas d'erreur dans la console (F12)

### Étape 3.3: Soumettre le Formulaire
- [ ] J'ai rempli les champs requis:
  - [ ] Date
  - [ ] Mining Company
  - [ ] Quantity
  - [ ] Type de transaction
- [ ] J'ai cliqué "Save to Inventory"
- [ ] Pas d'erreur "batch_id does not exist"
- [ ] Le formulaire a été soumis avec succès
- [ ] Confirmation affichée

---

## 🔍 PHASE 4: VÉRIFICATION (OPTIONNEL)

### Étape 4.1: Vérifier en Base de Données
```sql
-- Dans Supabase SQL Editor, exécutez:

-- 1. batch_id ne doit plus exister
SELECT COUNT(*) as batch_id_count
FROM information_schema.columns
WHERE column_name = 'batch_id' AND table_schema = 'public';
-- Résultat attendu: 0
```
- [ ] Résultat: 0 ✅

```sql
-- 2. freight_shipment_id doit exister
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name = 'freight_shipment_id'
  AND table_name IN ('inventory_transactions', 'gold_inventory');
-- Résultat attendu: 2 lignes
```
- [ ] Résultat: 2 lignes ✅

### Étape 4.2: Vérifier les Données
```sql
-- 3. Vérifier la dernière transaction créée
SELECT *
FROM inventory_transactions
ORDER BY created_at DESC
LIMIT 1;
```
- [ ] Une ligne s'affiche ✅
- [ ] Colonne `freight_shipment_id` présente ✅
- [ ] Colonne `batch_id` absente ✅

---

## 🎊 CONFIRMATION FINALE

- [ ] ✅ Script SQL exécuté avec succès
- [ ] ✅ Cache vidé et app rafraîchie
- [ ] ✅ Add Stock fonctionne sans erreur
- [ ] ✅ Vérifications DB passées (optionnel)

---

## 🚨 EN CAS DE PROBLÈME

### Si le Script SQL Échoue
- [ ] J'ai copié le message d'erreur complet
- [ ] J'ai noté à quelle étape ça échoue
- [ ] J'envoie l'erreur pour analyse

### Si l'Erreur Persiste
- [ ] J'ai exécuté `DIAGNOSTIC_COMPLET_INVENTORY_TRANSACTIONS.sql`
- [ ] J'ai copié les résultats des sections 3, 7, et 10
- [ ] J'envoie les résultats pour correction ciblée

### Si le Cache Persiste
- [ ] J'ai essayé en navigation privée (Ctrl+Shift+N)
- [ ] J'ai essayé dans un autre navigateur
- [ ] J'ai redémarré le navigateur

---

## 📊 MÉTRIQUES

| Phase | Temps Estimé | Statut |
|-------|--------------|--------|
| Phase 1: SQL | 2 min | ⏳ |
| Phase 2: Rafraîchissement | 1 min | ⏳ |
| Phase 3: Test | 1 min | ⏳ |
| Phase 4: Vérification | 2 min | ⏳ (optionnel) |
| **TOTAL** | **4-6 min** | |

---

## 💡 NOTES

- Le script SQL est **idempotent** (peut être exécuté plusieurs fois)
- **Aucune perte de données** ne se produira
- Si une étape échoue, vous pouvez recommencer
- Le cache du navigateur est CRUCIAL à vider

---

## 🎯 OBJECTIF FINAL

**Pouvoir ajouter une entrée d'inventaire sans l'erreur "batch_id does not exist"**

Si toutes les cases sont cochées, l'objectif est atteint!

---

**Date d'exécution**: _____________

**Exécuté par**: _____________

**Résultat**: ⬜ SUCCÈS  ⬜ ÉCHEC

**Notes**: _____________________________________________
