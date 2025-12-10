# 📋 INSTRUCTIONS - Exécution du Diagnostic

## 🎯 Objectif
Identifier EXACTEMENT où se cache le problème `batch_id` dans votre base de données.

---

## ⚡ ÉTAPES (5 MINUTES)

### Étape 1: Ouvrir Supabase SQL Editor
```
https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/sql
```

### Étape 2: Copier le Script
1. Ouvrez le fichier: **`DIAGNOSTIC_COMPLET_INVENTORY_TRANSACTIONS.sql`**
2. Sélectionnez TOUT (Ctrl+A)
3. Copiez (Ctrl+C)

### Étape 3: Exécuter dans Supabase
1. Collez dans l'éditeur SQL (Ctrl+V)
2. Cliquez sur **"Run"** (ou Ctrl+Enter)
3. Attendez ~10 secondes

### Étape 4: Copier les Résultats
Le script va afficher plusieurs sections. **Copiez TOUT**, mais surtout:

#### 🔴 SECTION CRITIQUE 1: "VUES AVEC batch_id"
Cherchez cette partie:
```
╔══════════════════════════════════════════════════════════════╗
║  SECTION 3: VUES AVEC batch_id                               ║
╚══════════════════════════════════════════════════════════════╝
```
→ **Copiez TOUT ce qui suit jusqu'à la section suivante**

#### 🔴 SECTION CRITIQUE 2: "FONCTIONS INSERT"
Cherchez cette partie:
```
╔══════════════════════════════════════════════════════════════╗
║  SECTION 7: FONCTIONS INSÉRANT dans inventory_transactions   ║
╚══════════════════════════════════════════════════════════════╝
```
→ **Copiez la définition complète de chaque fonction**

#### 🔴 SECTION CRITIQUE 3: "TEST D'INSERTION"
Cherchez cette partie:
```
╔══════════════════════════════════════════════════════════════╗
║  SECTION 10: TEST D'INSERTION DIRECTE                        ║
╚══════════════════════════════════════════════════════════════╝
```
→ **Notez si vous voyez ✅ SUCCÈS ou ❌ ÉCHEC**

---

## 📤 Que M'envoyer

### Format Idéal:
```
SECTION 3 - VUES AVEC batch_id:
[Collez ici les résultats]

SECTION 7 - FONCTIONS INSERT:
[Collez ici les définitions de fonctions]

SECTION 10 - TEST:
[✅ SUCCÈS ou ❌ ÉCHEC + message d'erreur]

SECTION 4 - INDEX (si vous voyez batch_id):
[Collez ici]
```

---

## 🎯 Ce que Je Vais Chercher

### Dans les Vues:
```sql
-- ❌ COUPABLE si vous voyez:
SELECT 
  it.batch_id,  -- ← PROBLÈME ICI
  ...
FROM inventory_transactions it
```

### Dans les Fonctions:
```sql
-- ❌ COUPABLE si vous voyez:
INSERT INTO inventory_transactions (
  batch_id,  -- ← PROBLÈME ICI
  ...
)
```

### Dans les Index:
```
-- ❌ COUPABLE si vous voyez:
idx_inventory_transactions_batch_id
```

---

## ⏱️ Checklist Rapide

- [ ] J'ai ouvert Supabase SQL Editor
- [ ] J'ai copié `DIAGNOSTIC_COMPLET_INVENTORY_TRANSACTIONS.sql`
- [ ] J'ai exécuté le script (Ctrl+Enter)
- [ ] J'ai attendu les résultats (~10 secondes)
- [ ] J'ai copié les SECTIONS 3, 7, et 10
- [ ] Je suis prêt à vous envoyer les résultats

---

## 🚨 Si le Script Ne Fonctionne Pas

Si vous voyez une erreur lors de l'exécution du diagnostic:

1. **Copiez l'erreur complète**
2. **Envoyez-moi**:
   - Le message d'erreur
   - Le code d'erreur (ex: 42703)
   - La capture d'écran si possible

Je créerai alors une version simplifiée du diagnostic.

---

**Prêt? Exécutez le script et envoyez-moi les résultats!**

*Une fois que j'aurai les résultats, je créerai une correction SQL ciblée sur mesure.*
