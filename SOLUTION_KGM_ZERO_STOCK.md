# Solution: KGM Affiche 0.000 oz

## 🔍 Problème Identifié

Les **mining companies existent** dans votre base de données Supabase (vous les voyez dans le Table Editor), **MAIS** l'application ne peut pas les lire à cause des **politiques RLS (Row Level Security)** qui bloquent l'accès.

### Preuve du Problème
```
✅ Table mining_companies contient 4 entrées (visible dans Supabase UI)
❌ L'application retourne 0 entrées (bloqué par RLS)
```

### Pourquoi Ça Arrive?
- Le **Table Editor de Supabase** utilise des droits élevés → vous voyez les données
- L'**application** utilise la clé `anon` avec RLS → pas d'accès aux données
- Les **politiques RLS** n'autorisent pas la lecture des mining companies

---

## ✅ Solution: Corriger les Politiques RLS

### Étape 1: Ouvrir Supabase SQL Editor
1. Allez sur [https://supabase.com](https://supabase.com)
2. Ouvrez votre projet Gold Shipper
3. Cliquez sur **"SQL Editor"** dans le menu de gauche
4. Cliquez sur **"+ New query"**

### Étape 2: Exécuter le Script de Fix
1. Ouvrez le fichier **`FIX_RLS_MINING_COMPANIES.sql`**
2. Copiez **TOUT** le contenu
3. Collez dans l'éditeur SQL de Supabase
4. Cliquez sur **"RUN"** (ou Ctrl+Enter / Cmd+Enter)

### Étape 3: Vérifier les Messages
Vous devriez voir:
```
✅ RLS est activé sur mining_companies
========================================
POLITIQUES RLS SUR mining_companies
========================================
Nombre de politiques: 1

Politique: authenticated_users_can_read_mining_companies
  Commande: SELECT
  Rôles: {authenticated}

========================================

TEST DE LECTURE:
  Mining companies dans la DB: 4

✅ Les mining companies sont accessibles!

Liste:
  - Dugbe (GUB)
  - Kourousa (KGM)
  - Mansa Resources S.A. (MANSA)
  - Société des Mines de Komana (SMK)

✅ Politiques RLS créées pour toutes les tables de la chaîne!

🎉 FIX TERMINÉ!
```

### Étape 4: Rafraîchir l'Application
1. Retournez dans l'application Gold Shipper
2. **Vérifiez que vous êtes connecté** (important!)
3. Appuyez sur **Ctrl+Shift+R** (ou Cmd+Shift+R sur Mac) pour vider le cache
4. Allez sur **Gold Trade Space**
5. Sélectionnez **"Kourousa (KGM) - Guinea"**

---

## 🔑 Important: Authentification

Les nouvelles politiques RLS permettent la lecture **uniquement aux utilisateurs authentifiés**.

### Si Vous N'êtes PAS Connecté
L'application ne pourra toujours pas lire les mining companies.

**Solution**: Connectez-vous avec votre compte utilisateur avant d'aller sur Gold Trade Space.

### Si Vous Voulez Permettre l'Accès Sans Connexion
Décommentez cette ligne dans le script SQL:
```sql
CREATE POLICY "anon_users_can_read_mining_companies"
  ON mining_companies
  FOR SELECT
  TO anon
  USING (true);
```

---

## 📊 Ce Que Le Script Fait

### 1. Vérifie le RLS
- Confirme que RLS est activé sur `mining_companies`

### 2. Nettoie les Anciennes Politiques
- Supprime toutes les politiques RLS existantes qui pourraient être incorrectes

### 3. Crée de Nouvelles Politiques
- **mining_companies**: Lecture pour utilisateurs authentifiés
- **production**: Lecture pour utilisateurs authentifiés
- **freight_shipments**: Lecture pour utilisateurs authentifiés
- **gold_inventory**: Lecture pour utilisateurs authentifiés

### 4. Teste l'Accès
- Vérifie que les données sont maintenant accessibles
- Liste toutes les mining companies disponibles

---

## 🔗 Chaîne de Données Complète

Pour que KGM affiche son inventaire, cette chaîne doit fonctionner:

```
mining_companies (KGM)
      ↓ (RLS: ✅ après fix)
production (productions de KGM)
      ↓ (RLS: ✅ après fix)
freight_shipments (expéditions de ces productions)
      ↓ (RLS: ✅ après fix)
gold_inventory (inventaire de ces expéditions)
      ↓ (RLS: ✅ après fix)
quantity_available_oz > 0
```

Le script corrige **toutes** les politiques RLS de cette chaîne.

---

## 🧪 Test Après le Fix

### Test 1: Vérifier que les Mining Companies Sont Accessibles
Dans votre navigateur (console JavaScript):
```javascript
// Ouvrir la console (F12)
// Vérifier que vous êtes connecté
console.log(await window.supabase.from('mining_companies').select('*'))
```

Résultat attendu: Liste de 4 mining companies

### Test 2: Vérifier KGM dans Gold Trade Space
1. Aller sur Gold Trade Space
2. Ouvrir le dropdown "Mining Company (Seller)"
3. Sélectionner "Kourousa (KGM) - Guinea"
4. Observer l'affichage du stock

**Résultat attendu**:
- Si KGM a de l'inventaire: Affiche la quantité (ex: 123.45 oz)
- Si KGM n'a pas d'inventaire: Affiche 0.000 oz (c'est normal!)

---

## ⚠️ Si KGM Affiche Toujours 0.000 oz Après le Fix

Si après avoir corrigé les RLS, KGM affiche toujours 0.000 oz, cela peut signifier:

### Scénario 1: KGM n'a pas de Production
```sql
-- Vérifier dans Supabase SQL Editor
SELECT COUNT(*)
FROM production
WHERE mining_company_id = (
  SELECT id FROM mining_companies WHERE code = 'KGM'
);
```

Si retourne **0**: KGM n'a pas de productions enregistrées

### Scénario 2: Les Productions n'ont pas de Freight Shipments
```sql
SELECT COUNT(*)
FROM freight_shipments fs
JOIN production p ON p.id = fs.production_id
WHERE p.mining_company_id = (
  SELECT id FROM mining_companies WHERE code = 'KGM'
);
```

Si retourne **0**: Les productions KGM n'ont pas de shipments

### Scénario 3: Les Shipments n'ont pas d'Inventaire
```sql
SELECT SUM(gi.quantity_available_oz)
FROM gold_inventory gi
JOIN freight_shipments fs ON fs.id = gi.freight_shipment_id
JOIN production p ON p.id = fs.production_id
WHERE p.mining_company_id = (
  SELECT id FROM mining_companies WHERE code = 'KGM'
)
AND gi.quantity_available_oz > 0;
```

Si retourne **NULL ou 0**: Aucun inventaire disponible pour KGM

---

## 🎯 Résumé des Étapes

1. ✅ **Identifier le problème**: RLS bloque l'accès
2. ✅ **Exécuter FIX_RLS_MINING_COMPANIES.sql** dans Supabase
3. ✅ **Se connecter** à l'application
4. ✅ **Vider le cache** (Ctrl+Shift+R)
5. ✅ **Tester** dans Gold Trade Space

---

## 📁 Fichiers Créés

- **`FIX_RLS_MINING_COMPANIES.sql`** - Script SQL à exécuter
- **`SOLUTION_KGM_ZERO_STOCK.md`** - Ce document (guide complet)

---

## ✅ Checklist Finale

- [ ] Script SQL exécuté dans Supabase
- [ ] Messages de succès affichés
- [ ] Connecté à l'application
- [ ] Cache vidé (Ctrl+Shift+R)
- [ ] Gold Trade Space ouvert
- [ ] Dropdown affiche bien les mining companies
- [ ] KGM sélectionné
- [ ] Stock affiché (même si 0.000 oz)

**Si tout est coché, le problème RLS est résolu!** 🎉

Le stock affiché dépend maintenant uniquement des données réelles dans production → freight_shipments → gold_inventory.
