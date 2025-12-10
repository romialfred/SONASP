# Guide de Recherche "batch_id" dans la Base de Données

Ce guide vous aide à trouver toutes les références à "batch_id" dans votre base de données Supabase.

## 📋 Deux Méthodes Disponibles

### Méthode 1 : Script SQL (Supabase SQL Editor)

**Fichier :** `SEARCH_BATCH_ID_EVERYWHERE.sql`

**Comment l'utiliser :**
1. Ouvrez Supabase Dashboard
2. Allez dans "SQL Editor"
3. Créez une nouvelle requête
4. Copiez tout le contenu du fichier `SEARCH_BATCH_ID_EVERYWHERE.sql`
5. Exécutez la requête
6. Examinez les résultats dans différents onglets

**Avantages :**
- Résultats détaillés avec définitions complètes
- Pas besoin d'installer Node.js
- Copie facile des résultats

### Méthode 2 : Script Node.js (Ligne de Commande)

**Fichier :** `search_batch_id.mjs`

**Comment l'utiliser :**
```bash
# Exécuter le script
node search_batch_id.mjs
```

**Avantages :**
- Rapport formaté et coloré
- Résumé clair
- Rapide à exécuter
- Idéal pour les vérifications régulières

## 🔍 Ce qui est Recherché

Le script recherche "batch_id" dans :

### 1. **Colonnes de Tables**
   - Toutes les colonnes dont le nom contient "batch_id"
   - Type de données
   - Contraintes NULL/NOT NULL

### 2. **Colonnes de Vues**
   - Vues qui exposent des colonnes "batch_id"

### 3. **Fonctions**
   - Fonctions avec des paramètres "batch_id"
   - Fonctions qui utilisent "batch_id" dans leur code

### 4. **Triggers**
   - Triggers qui manipulent "batch_id"
   - Triggers qui dépendent de "batch_id"

### 5. **Contraintes**
   - Foreign Keys sur "batch_id"
   - Check constraints mentionnant "batch_id"
   - Unique constraints sur "batch_id"

### 6. **Index**
   - Index créés sur "batch_id"
   - Index composites incluant "batch_id"

## 📊 Interprétation des Résultats

### ✅ Résultat Idéal
```
✅ AUCUNE RÉFÉRENCE À "batch_id" TROUVÉE DANS LA BASE DE DONNÉES
```

Cela signifie que la migration est complète et "batch_id" a été complètement supprimé.

### ⚠️ Résultats à Traiter

Si des références sont trouvées :

1. **Colonnes de Tables**
   ```
   ⚠️ Action requise : Supprimer la colonne ou migrer les données
   ```

2. **Fonctions**
   ```
   ⚠️ Action requise : Mettre à jour le code de la fonction
   ```

3. **Triggers**
   ```
   ⚠️ Action requise : Mettre à jour ou supprimer le trigger
   ```

4. **Contraintes**
   ```
   ⚠️ Action requise : Supprimer la contrainte avant la colonne
   ```

5. **Index**
   ```
   ⚠️ Action requise : Supprimer l'index avant la colonne
   ```

## 🔧 Ordre de Nettoyage Recommandé

Si vous trouvez des références à "batch_id", suivez cet ordre :

1. **Triggers** - Supprimer ou mettre à jour en premier
2. **Fonctions** - Mettre à jour le code
3. **Contraintes** - Supprimer les FK et CHECK
4. **Index** - Supprimer les index
5. **Colonnes de Tables** - Supprimer en dernier
6. **Vues** - Recréer sans "batch_id"

## 📝 Exemples de Commandes de Nettoyage

### Supprimer un Index
```sql
DROP INDEX IF EXISTS idx_batch_id;
```

### Supprimer une Contrainte
```sql
ALTER TABLE table_name DROP CONSTRAINT IF EXISTS fk_batch_id;
```

### Supprimer une Colonne
```sql
ALTER TABLE table_name DROP COLUMN IF EXISTS batch_id;
```

### Mettre à Jour une Fonction
```sql
CREATE OR REPLACE FUNCTION function_name()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Code sans batch_id
END;
$$;
```

### Supprimer un Trigger
```sql
DROP TRIGGER IF EXISTS trigger_name ON table_name;
```

## 🎯 Tables Connues à Vérifier

Ces tables pourraient encore avoir "batch_id" :

- `gold_inventory` (colonne supprimée normalement)
- `inventory_transactions` (colonne à supprimer)
- `shipping_preparations` (colonne à migrer vers refining_record_id)
- `refining_processes` (vérifier les anciennes colonnes)

## 🚨 Avertissements Importants

1. **Sauvegardez avant de supprimer**
   ```bash
   # Sauvegarde via Supabase Dashboard recommandée
   ```

2. **Testez dans l'ordre**
   - Ne supprimez jamais les colonnes avant les contraintes
   - Ne supprimez jamais les contraintes avant les triggers

3. **Vérifiez les dépendances**
   - Utilisez ce script avant et après chaque suppression
   - Confirmez que rien n'est cassé

## ✅ Vérification Post-Migration

Après avoir nettoyé toutes les références :

1. Exécutez le script à nouveau
2. Vérifiez que le résumé affiche "0" partout
3. Testez l'application complètement
4. Vérifiez les logs pour des erreurs SQL

## 📞 Besoin d'Aide ?

Si vous trouvez des références inattendues à "batch_id" :

1. Notez la table/fonction/trigger concerné
2. Vérifiez si c'est dans le code de l'application
3. Consultez l'historique des migrations
4. Demandez de l'aide avec le contexte complet

---

**Date de création :** 2025-12-10
**Version :** 1.0
**Auteur :** Système de Migration Gold Shipper
