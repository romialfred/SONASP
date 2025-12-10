# Guide de Résolution du Problème batch_id

## Situation Actuelle

Vous avez exécuté la migration mais l'erreur persiste:
```
column "batch_id" of relation "inventory_transactions" does not exist
```

Cette erreur indique que:
1. **OU BIEN** la colonne `batch_id` existe encore dans la base de données
2. **OU BIEN** un trigger/fonction essaie d'utiliser `batch_id` qui n'existe plus

## 🔍 Étape 1: Diagnostic Complet

**Exécutez ces 3 scripts dans Supabase SQL Editor dans cet ordre:**

### Script 1: Vérifier l'état de la base de données
```
CHECK_DB_STATE.sql
```

**Ce script va montrer:**
- ✅ ou ❌ Si `batch_id` existe encore
- ✅ ou ❌ Si `freight_shipment_id` existe
- Le nombre de contraintes et index sur `batch_id`
- Toutes les colonnes de `inventory_transactions`

### Script 2: Chercher batch_id dans le code SQL
```
CHERCHER_BATCH_ID_DANS_CODE_SQL.sql
```

**Ce script va chercher `batch_id` dans:**
- Les fonctions PostgreSQL
- Les triggers
- Les vues

### Script 3: Analyser le résultat

**Partagez-moi le résultat de ces 2 scripts et je vous dirai exactement quoi faire.**

---

## 🔧 Si batch_id existe encore

Si `CHECK_DB_STATE.sql` montre que `batch_id` existe, exécutez:
```
SUPPRIMER_BATCH_ID_SIMPLE.sql
```

Ce script va:
1. Supprimer toutes les contraintes qui référencent `batch_id`
2. Supprimer tous les index qui référencent `batch_id`
3. Supprimer la colonne `batch_id` de toutes les tables
4. Vérifier que la suppression a réussi

---

## 🔧 Si batch_id n'existe plus mais l'erreur persiste

Si `batch_id` n'existe plus mais l'erreur continue, le problème vient d'une fonction ou trigger qui essaie encore d'utiliser `batch_id`.

Dans ce cas:
1. Partagez-moi le résultat de `CHERCHER_BATCH_ID_DANS_CODE_SQL.sql`
2. Je créerai un script pour corriger les fonctions/triggers problématiques

---

## ⚠️ Important

**NE PAS** exécuter `FIX_BATCH_ID_MAINTENANT.sql` à nouveau.
Il est trop complexe et peut échouer à certains points.

Utilisez les scripts simples ci-dessus à la place.

---

## 🎯 Ordre d'exécution recommandé

1. ✅ `CHECK_DB_STATE.sql` → Partagez le résultat
2. ✅ `CHERCHER_BATCH_ID_DANS_CODE_SQL.sql` → Partagez le résultat
3. ⏸️ **Attendez mes instructions avant de continuer**
