# Guide: Fix KGM Showing 0.000 oz

## 🔍 Problème Identifié

Vous voyez "Kourousa (KGM)" dans le dropdown mais obtenez **0.000 oz** quand vous le sélectionnez.

### Cause Racine
La table `mining_companies` dans votre base de données est **VIDE**. Le dropdown affiche "KGM" parce que c'est dans le **cache du navigateur** ou dans le code frontend, mais la base de données n'a pas ces enregistrements.

### Investigation Effectuée
```
✅ Table mining_companies: EXISTE mais est VIDE (0 lignes)
✅ Table gold_inventory: EXISTE
✅ Table production: EXISTE
✅ Table freight_shipments: EXISTE
❌ Aucune mining company dans la DB
❌ Donc impossible de lier inventory → shipments → production → mining_company
```

---

## 🛠️ Solution: Seed Mining Companies

### Option 1: Via Supabase SQL Editor (RECOMMANDÉ)

#### Étape 1: Ouvrir Supabase Dashboard
1. Allez sur [https://supabase.com](https://supabase.com)
2. Connectez-vous à votre compte
3. Sélectionnez votre projet Gold Shipper

#### Étape 2: Ouvrir SQL Editor
1. Dans le menu de gauche, cliquez sur **"SQL Editor"**
2. Cliquez sur **"+ New query"** pour créer une nouvelle requête

#### Étape 3: Exécuter le Script
1. Ouvrez le fichier `SEED_MINING_COMPANIES_MANUAL.sql`
2. Copiez TOUT le contenu du fichier
3. Collez dans l'éditeur SQL de Supabase
4. Cliquez sur le bouton **"RUN"** (ou appuyez sur Ctrl+Enter / Cmd+Enter)

#### Étape 4: Vérifier les Messages
Vous devriez voir dans les logs:
```
✅ KGM/Kourousa créé avec ID: ...
✅ DGB/Dugbe créé avec ID: ...
✅ YAN/Yanfolila créé avec ID: ...

========================================
RÉSULTATS DU SEED
========================================
Total Mining Companies: 3

Liste des companies:
  - Dugbe (DGB) - Liberia [ID: ...]
  - Kourousa (KGM) - Guinea [ID: ...]
  - Yanfolila (YAN) - Mali [ID: ...]
========================================

🎉 SEED TERMINÉ AVEC SUCCÈS!
```

#### Étape 5: Rafraîchir l'Application
1. Retournez dans l'application Gold Shipper
2. Appuyez sur **Ctrl+Shift+R** (ou Cmd+Shift+R sur Mac) pour vider le cache
3. Allez sur la page **Gold Trade Space**
4. Sélectionnez **"Kourousa (KGM) - Guinea"** dans le dropdown

---

### Option 2: Via Table Editor (Alternative)

Si vous préférez une interface graphique:

#### Pour KGM/Kourousa:
1. Dans Supabase Dashboard, allez dans **"Table Editor"**
2. Sélectionnez la table **"mining_companies"**
3. Cliquez sur **"Insert row"**
4. Remplissez les champs:
   - **name**: `Kourousa`
   - **abbreviation**: `KGM`
   - **code**: `KGM`
   - **country**: `Guinea`
   - **is_active**: `true` (coché)
5. Cliquez sur **"Save"**

#### Pour DGB/Dugbe:
1. Cliquez à nouveau sur **"Insert row"**
2. Remplissez:
   - **name**: `Dugbe`
   - **abbreviation**: `DGB`
   - **code**: `DGB`
   - **country**: `Liberia`
   - **is_active**: `true`
3. Cliquez sur **"Save"**

#### Pour YAN/Yanfolila:
1. Cliquez sur **"Insert row"**
2. Remplissez:
   - **name**: `Yanfolila`
   - **abbreviation**: `YAN`
   - **code**: `YAN`
   - **country**: `Mali`
   - **is_active**: `true`
3. Cliquez sur **"Save"**

---

## ⚠️ Problème Potentiel: Pas d'Inventaire Réel

Après avoir créé les mining companies, **KGM affichera toujours 0.000 oz** si:

### Scénario 1: Aucune Production
Si KGM n'a pas de production enregistrée dans la table `production`:
```
mining_companies (KGM existe) ✅
      ↓
production (VIDE pour KGM) ❌
```

### Scénario 2: Aucun Freight Shipment
Si la production existe mais pas de shipments:
```
production (KGM a des productions) ✅
      ↓
freight_shipments (VIDE pour ces productions) ❌
```

### Scénario 3: Aucun Inventaire
Si les shipments existent mais pas d'inventaire:
```
freight_shipments (Shipments existent) ✅
      ↓
gold_inventory (VIDE pour ces shipments) ❌
```

---

## 🔍 Vérification Post-Seed

Après avoir exécuté le seed, vérifiez que tout fonctionne:

### Étape 1: Vérifier que les Mining Companies Existent
Dans Supabase SQL Editor, exécutez:
```sql
SELECT * FROM mining_companies ORDER BY name;
```

Résultat attendu:
```
id | name      | abbreviation | code | country  | is_active
---+-----------+--------------+------+----------+-----------
...| Dugbe     | DGB          | DGB  | Liberia  | true
...| Kourousa  | KGM          | KGM  | Guinea   | true
...| Yanfolila | YAN          | YAN  | Mali     | true
```

### Étape 2: Vérifier l'Inventaire pour KGM
```sql
-- Get KGM ID
SELECT id, name FROM mining_companies WHERE abbreviation = 'KGM';

-- Replace <KGM_ID> with the actual ID from above
SELECT COUNT(*) as production_count
FROM production
WHERE mining_company_id = '<KGM_ID>';

-- Check freight shipments
SELECT COUNT(*) as shipment_count
FROM freight_shipments fs
JOIN production p ON p.id = fs.production_id
WHERE p.mining_company_id = '<KGM_ID>';

-- Check inventory
SELECT SUM(gi.quantity_available_oz) as total_available_oz
FROM gold_inventory gi
JOIN freight_shipments fs ON fs.id = gi.freight_shipment_id
JOIN production p ON p.id = fs.production_id
WHERE p.mining_company_id = '<KGM_ID>'
  AND gi.quantity_available_oz > 0;
```

### Résultats Possibles

#### Cas A: Inventaire Trouvé ✅
```
total_available_oz
------------------
123.45
```
**Résultat**: KGM affichera 123.45 oz dans Gold Trade Space

#### Cas B: Aucun Inventaire ⚠️
```
total_available_oz
------------------
NULL (ou 0)
```
**Résultat**: KGM affichera 0.000 oz (c'est NORMAL s'il n'y a pas d'inventaire)

---

## 📊 Créer des Données de Test (Optionnel)

Si vous voulez tester avec des données fictives:

### Script de Test Complet
```sql
-- 1. Get KGM ID
DO $$
DECLARE
    v_kgm_id UUID;
    v_prod_id UUID;
    v_shipment_id UUID;
BEGIN
    -- Get KGM ID
    SELECT id INTO v_kgm_id FROM mining_companies WHERE abbreviation = 'KGM';

    IF v_kgm_id IS NULL THEN
        RAISE EXCEPTION 'KGM not found! Run seed script first.';
    END IF;

    -- 2. Create a test production
    INSERT INTO production (
        mining_company_id,
        production_date,
        weight_grams,
        status
    ) VALUES (
        v_kgm_id,
        CURRENT_DATE,
        1000.0,
        'prepared'
    ) RETURNING id INTO v_prod_id;

    RAISE NOTICE 'Production created: %', v_prod_id;

    -- 3. Create a test freight shipment
    INSERT INTO freight_shipments (
        production_id,
        shipment_date,
        destination,
        status
    ) VALUES (
        v_prod_id,
        CURRENT_DATE,
        'Refinery',
        'delivered'
    ) RETURNING id INTO v_shipment_id;

    RAISE NOTICE 'Freight shipment created: %', v_shipment_id;

    -- 4. Create test inventory
    INSERT INTO gold_inventory (
        freight_shipment_id,
        entry_date,
        transaction_type,
        weight_before_melting_grams,
        weight_after_melting_grams,
        fineness_percentage,
        metal_retained_percentage,
        final_fine_grams,
        final_fine_oz,
        quantity_available_oz,
        quantity_allocated_oz,
        quantity_sold_oz
    ) VALUES (
        v_shipment_id,
        CURRENT_DATE,
        'entry',
        1000.0,
        995.0,
        99.5,
        99.0,
        985.0,
        31.67,
        31.67,
        0,
        0
    );

    RAISE NOTICE '✅ Test data created successfully!';
    RAISE NOTICE 'KGM should now show ~31.67 oz in Gold Trade Space';
END $$;
```

---

## 🎯 Résumé des Étapes

1. **Exécuter SEED_MINING_COMPANIES_MANUAL.sql** dans Supabase SQL Editor
2. **Vider le cache** du navigateur (Ctrl+Shift+R)
3. **Rafraîchir** la page Gold Trade Space
4. **Sélectionner KGM** dans le dropdown
5. **Vérifier** l'affichage du stock disponible

### Si Stock Affiché = 0.000 oz
- C'est **NORMAL** si KGM n'a pas de production/shipments/inventory dans la DB
- Vérifiez avec les requêtes SQL de vérification ci-dessus
- Créez des données de test si besoin

### Si Stock Affiché > 0 oz
- ✅ **SUCCÈS!** Le lien entre KGM et l'inventaire fonctionne
- Le Pricing Calculator devrait apparaître
- Vous pouvez maintenant créer des simulations

---

## 🐛 Dépannage

### Problème: "RLS policy violation"
**Cause**: Les politiques RLS empêchent l'insertion

**Solution**: Exécutez le script dans Supabase SQL Editor (pas via l'application)

### Problème: "Column 'region' does not exist"
**Cause**: La structure de la table a changé

**Solution**: Le script SEED_MINING_COMPANIES_MANUAL.sql utilise uniquement les colonnes de base (name, abbreviation, code, country, is_active)

### Problème: KGM toujours à 0.000 oz après seed
**Causes Possibles**:
1. Cache du navigateur pas vidé → Solution: Ctrl+Shift+R
2. Pas de production pour KGM → Solution: Créer des données ou vérifier avec SQL
3. RLS bloque la lecture → Solution: Vérifier les politiques RLS

---

## 📁 Fichiers Créés

- `SEED_MINING_COMPANIES_MANUAL.sql` - Script SQL à exécuter dans Supabase
- `FIX_KGM_ZERO_INVENTORY_GUIDE.md` - Ce guide (documentation complète)

---

## ✅ Checklist Finale

- [ ] Script SQL exécuté dans Supabase
- [ ] 3 mining companies créées (KGM, DGB, YAN)
- [ ] Cache navigateur vidé
- [ ] Page Gold Trade Space rafraîchie
- [ ] KGM sélectionné dans dropdown
- [ ] Stock affiché (même si 0.000 oz)

**Si tout est coché, le problème est résolu!** 🎉

Si KGM affiche 0.000 oz, c'est parce qu'il n'y a pas d'inventaire réel dans la base de données, pas un problème de code.
