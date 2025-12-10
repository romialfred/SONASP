# Résolution du problème batch_id dans l'inventaire

## Problème identifié

Erreur lors de l'ajout d'une entrée en stock:
```
Code: 42703
Message: column "batch_id" of relation "inventory_transactions" does not exist
```

## Analyse Root Cause (Senior Developer Analysis)

### Investigation menée

1. **Vérification du code frontend**: ✅ PROPRE
   - `inventoryService.ts`: N'utilise PAS batch_id
   - `AddInventoryEntry.tsx`: N'utilise PAS batch_id
   - Tous les fichiers utilisent correctement `freight_shipment_id`

2. **Vérification de la structure DB**: ✅ CORRECTE
   - La colonne `batch_id` n'existe PAS dans `gold_inventory`
   - La colonne `batch_id` n'existe PAS dans `inventory_transactions`
   - Les tables utilisent correctement `freight_shipment_id`

3. **Vérification des triggers DB**: ❌ PROBLÈME TROUVÉ
   - Le trigger `create_inventory_transaction()` essayait encore d'insérer `batch_id`
   - Cette fonction n'avait pas été mise à jour lors de la migration vers `freight_shipment_id`

## Solution appliquée

### Script SQL de correction créé

Fichier: `FIX_INVENTORY_TRIGGER_BATCH_ID.sql`

Le script:
1. Supprime les anciens triggers
2. Recrée la fonction `create_inventory_transaction()` SANS référence à batch_id
3. Utilise uniquement `freight_shipment_id`
4. Nettoie toute colonne batch_id résiduelle (par sécurité)
5. Vérifie que `freight_shipment_id` existe

### Ce qui a été nettoyé

```sql
-- AVANT (trigger défectueux)
INSERT INTO inventory_transactions (
  ...,
  batch_id,  -- ❌ Cette colonne n'existe plus!
  ...
)

-- APRÈS (trigger corrigé)
INSERT INTO inventory_transactions (
  ...,
  freight_shipment_id,  -- ✅ Colonne correcte
  ...
)
```

## Instructions d'application

### Étape 1: Exécuter le script SQL

1. Ouvrir Supabase Dashboard
2. Aller dans SQL Editor
3. Copier le contenu de `FIX_INVENTORY_TRIGGER_BATCH_ID.sql`
4. Exécuter le script

### Étape 2: Vérifier la correction

Après l'exécution, vous devriez voir:
- Trigger `trigger_create_inventory_transaction` recréé
- Fonction `create_inventory_transaction()` mise à jour
- Plus d'erreur lors de l'ajout d'inventaire

### Étape 3: Tester

1. Rafraîchir l'application (Ctrl+F5)
2. Aller dans Inventory Management → Gold Inventory
3. Cliquer sur "Add Gold Inventory Entry"
4. Sélectionner une expédition
5. Remplir les champs requis
6. Sauvegarder

L'erreur "batch_id does not exist" ne devrait plus apparaître.

## Architecture correcte (post-fix)

```
┌─────────────────────────┐
│   gold_inventory        │
│                         │
│  - freight_shipment_id  │ ───┐
│  - (PAS batch_id)       │    │
└─────────────────────────┘    │
                               │
                               │ trigger
                               │ create_inventory_transaction()
                               ▼
┌─────────────────────────────────┐
│   inventory_transactions        │
│                                 │
│  - freight_shipment_id          │
│  - (PAS batch_id)               │
└─────────────────────────────────┘
```

## Prévention des régressions

Pour éviter ce type de problème à l'avenir:

1. **Toujours vérifier les triggers** lors d'une migration de schéma
2. **Tester en environnement de dev** avant production
3. **Documenter les migrations** avec les changements de triggers
4. **Utiliser des migrations versionnées** et les conserver

## Fichiers créés pour diagnostic

- `check_batch_id_issue.mjs`: Test de la présence de batch_id
- `check_inventory_triggers.mjs`: Analyse des triggers
- `DIAGNOSTIC_AND_FIX_BATCH_ID.sql`: Script diagnostic complet
- `FIX_INVENTORY_TRIGGER_BATCH_ID.sql`: **SCRIPT DE CORRECTION À APPLIQUER**

## Status

- ✅ Code frontend: Propre (pas de batch_id)
- ✅ Schéma DB: Correct (pas de colonne batch_id)
- ✅ Script de correction: Créé et prêt
- ⏳ Application en DB: À faire par vous
- ⏳ Tests: À faire après application

## Support

Si le problème persiste après l'application du script:

1. Vérifier les messages d'erreur dans Supabase SQL Editor
2. Vérifier que le trigger a bien été recréé:
   ```sql
   SELECT tgname FROM pg_trigger WHERE tgrelid = 'gold_inventory'::regclass;
   ```
3. Vérifier la définition de la fonction:
   ```sql
   SELECT pg_get_functiondef('create_inventory_transaction'::regproc);
   ```

---

*Correction effectuée par: Senior Developer Analysis*
*Date: 2025-12-10*
