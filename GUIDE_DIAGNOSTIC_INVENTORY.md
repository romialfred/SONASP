# 🔍 GUIDE DE DIAGNOSTIC - Erreur batch_id Persistante

## 🚨 Situation

Vous avez exécuté la migration mais l'erreur **"batch_id does not exist"** persiste.

**Hypothèse**: Il existe probablement une **VUE** ou un **INDEX** qui référence encore `batch_id`.

---

## 🎯 ACTION IMMÉDIATE (5 MINUTES)

### Étape 1: Exécuter le Diagnostic Complet

1. **Ouvrez Supabase SQL Editor**
   ```
   https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/sql
   ```

2. **Copiez le fichier** `DIAGNOSTIC_COMPLET_INVENTORY_TRANSACTIONS.sql`

3. **Exécutez-le** (Ctrl+Enter)

4. **Attendez les résultats** (~10 secondes)

---

## 📊 Que va faire ce script?

Le script va analyser **10 sections**:

| Section | Description | Recherche |
|---------|-------------|-----------|
| 1 | Structure de la table | Vérifie si `batch_id` existe dans les colonnes |
| 2 | Vues liées | Trouve toutes les vues qui utilisent `inventory_transactions` |
| 3 | **Vues avec batch_id** | ⚠️ **COUPABLE PROBABLE #1** |
| 4 | Index | Liste tous les index sur la table |
| 5 | Contraintes | Foreign keys, checks, etc. |
| 6 | Fonctions SELECT | Fonctions qui lisent la table |
| 7 | **Fonctions INSERT** | ⚠️ **COUPABLE PROBABLE #2** |
| 8 | Triggers | Triggers qui créent des transactions |
| 9 | Recherche globale | Où `batch_id` existe encore |
| 10 | Test d'insertion | Test direct pour isoler le problème |

---

## 🔎 Comment Lire les Résultats

### ✅ SI le test d'insertion (Section 10) RÉUSSIT

```
✅ Insertion directe RÉUSSIE!
→ La table inventory_transactions fonctionne correctement
→ Le problème vient d'ailleurs (vue, fonction, trigger)
```

**Alors**: Le problème est dans une **VUE** ou **FONCTION** qui référence `batch_id`.

**Action**: Cherchez dans les sections 2, 3, 6, 7 pour trouver `batch_id`.

---

### ❌ SI le test d'insertion (Section 10) ÉCHOUE

```
❌ Insertion directe ÉCHOUÉE!
Erreur: [message d'erreur]
→ Le problème est dans la table elle-même
```

**Alors**: Il reste une **contrainte** ou **index** sur `batch_id`.

**Action**: Cherchez dans les sections 4 et 5.

---

## 🎯 Que Rechercher Exactement

### Dans Section 3: Vues avec batch_id
Cherchez une vue qui contient:
```sql
SELECT ...
  it.batch_id,
  ...
FROM inventory_transactions it
```

**Si trouvé**: C'est le coupable! Notez le nom de la vue.

---

### Dans Section 7: Fonctions INSERT
Cherchez une fonction qui contient:
```sql
INSERT INTO inventory_transactions (
  ...
  batch_id,  -- ❌ COUPABLE
  ...
)
```

**Si trouvé**: C'est le coupable! Notez le nom de la fonction.

---

### Dans Section 4: Index
Cherchez un index qui référence `batch_id`:
```
index_name: idx_inventory_transactions_batch_id
column_name: batch_id
```

**Si trouvé**: C'est le coupable! Notez le nom de l'index.

---

## 📝 Après le Diagnostic

### Une fois que vous avez les résultats:

1. **Copiez TOUS les résultats** (surtout les sections 3, 4, 7)

2. **Envoyez-moi**:
   - Le résultat de la Section 3 (Vues avec batch_id)
   - Le résultat de la Section 7 (Fonctions INSERT)
   - Le résultat de la Section 10 (Test d'insertion)

3. **Je créerai** un script SQL pour corriger les vues/fonctions trouvées

---

## 🔧 Correction Probable

En fonction de ce qui est trouvé, il faudra:

### Si c'est une VUE:
```sql
DROP VIEW IF EXISTS nom_de_la_vue CASCADE;
CREATE OR REPLACE VIEW nom_de_la_vue AS
SELECT
  ...
  it.freight_shipment_id,  -- ✅ Au lieu de batch_id
  ...
FROM inventory_transactions it;
```

### Si c'est un INDEX:
```sql
DROP INDEX IF EXISTS idx_inventory_transactions_batch_id;
CREATE INDEX idx_inventory_transactions_freight_shipment 
  ON inventory_transactions(freight_shipment_id);
```

### Si c'est une FONCTION:
```sql
CREATE OR REPLACE FUNCTION nom_fonction() ...
  INSERT INTO inventory_transactions (
    ...
    freight_shipment_id,  -- ✅ Au lieu de batch_id
    ...
  )
```

---

## ⚡ Résumé Rapide

1. ✅ Exécutez `DIAGNOSTIC_COMPLET_INVENTORY_TRANSACTIONS.sql`
2. 📋 Envoyez-moi les résultats des sections 3, 7, 10
3. 🔧 J'identifierai le coupable exact
4. ✅ Je créerai le script SQL pour le corriger

---

## 🎯 Checklist

- [ ] J'ai ouvert Supabase SQL Editor
- [ ] J'ai copié le script DIAGNOSTIC_COMPLET
- [ ] J'ai exécuté le script
- [ ] J'ai noté les résultats de la Section 10 (test d'insertion)
- [ ] J'ai cherché `batch_id` dans les résultats
- [ ] Je suis prêt à envoyer les résultats

---

**Ce diagnostic va nous dire EXACTEMENT où se cache le problème batch_id!**

*Durée estimée: 5 minutes*
