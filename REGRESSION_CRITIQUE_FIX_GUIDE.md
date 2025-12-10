# FIX CRITIQUE - Régression Shipping Preparation

## Diagnostic Professionnel

### Erreur Observée
```
Erreur lors de l'enregistrement
Il y a eu un problème technique lors de l'enregistrement de la préparation.
La compagnie de fret sélectionnée n'est pas valide.

Erreur technique: insert or update on table "shipping_preparations"
violates foreign key constraint "shipping_preparations_freight_company_id_fkey"

Code: 23503
Détails: Key is not present in table "freight_companies".
```

---

## Cause Racine Identifiée

### Problème dans la Migration du 9 Décembre 2025

**Fichier:** `supabase/migrations/20251209_001_add_refinery_freight_to_shipping.sql`

**Ligne 57:**
```sql
ALTER TABLE shipping_preparations
ADD COLUMN freight_company_id UUID REFERENCES freight_companies(id) ON DELETE SET NULL;
```

**ERREUR:** La contrainte pointe vers `freight_companies` MAIS cette table **N'EXISTE PAS**.

**RÉALITÉ:** La vraie table s'appelle `transport_companies` (créée bien avant).

### Impact

- **Impossible de créer une nouvelle Shipping Preparation**
- **Impossible de modifier une Shipping Preparation existante**
- **Régression critique depuis le 9 décembre**
- **Bloque complètement le workflow d'expédition**

### Code Frontend (Correct)

Le code frontend utilise correctement `transport_companies` :

```typescript
// ShippingPreparationNew.tsx - Ligne 222
const loadFreightCompanies = async () => {
  const { data, error } = await supabase
    .from('transport_companies')  // ✅ CORRECT
    .select('*')
    .eq('is_active', true)
    .order('name');
};

// Ligne 687
freight_company_id: selectedFreightCompanyId,  // ✅ Envoie un UUID de transport_companies
```

### Problème Base de Données

```
shipping_preparations.freight_company_id → [FK] → freight_companies.id
                                                    ❌ TABLE N'EXISTE PAS

DEVRAIT ÊTRE:

shipping_preparations.freight_company_id → [FK] → transport_companies.id
                                                    ✅ TABLE EXISTE
```

---

## Solution - À Appliquer IMMÉDIATEMENT

### Étape 1 : Ouvrir Supabase SQL Editor

1. Aller sur https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. Cliquer sur "SQL Editor" dans le menu de gauche
3. Cliquer sur "+ New query"

### Étape 2 : Copier le Script de Correction

**Fichier à utiliser:** `APPLY_THIS_FIX_IMMEDIATELY.sql`

Ou copier directement le script ci-dessous :

```sql
-- =====================================================
-- 1. SUPPRIMER LA CONTRAINTE INCORRECTE
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'shipping_preparations_freight_company_id_fkey'
    AND table_name = 'shipping_preparations'
  ) THEN
    ALTER TABLE shipping_preparations
    DROP CONSTRAINT IF EXISTS shipping_preparations_freight_company_id_fkey CASCADE;

    RAISE NOTICE '✅ Contrainte incorrecte supprimée';
  END IF;
END $$;

-- =====================================================
-- 2. NETTOYER LES DONNÉES INVALIDES
-- =====================================================

DO $$
DECLARE
  v_invalid_count INT;
BEGIN
  SELECT COUNT(*) INTO v_invalid_count
  FROM shipping_preparations sp
  WHERE sp.freight_company_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM transport_companies tc
      WHERE tc.id = sp.freight_company_id
    );

  IF v_invalid_count > 0 THEN
    UPDATE shipping_preparations
    SET freight_company_id = NULL
    WHERE freight_company_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM transport_companies tc
        WHERE tc.id = freight_company_id
      );

    RAISE NOTICE '✅ % IDs invalides nettoyés', v_invalid_count;
  END IF;
END $$;

-- =====================================================
-- 3. CRÉER LA BONNE CONTRAINTE
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'freight_company_id'
  ) THEN
    ALTER TABLE shipping_preparations
    ADD CONSTRAINT shipping_preparations_freight_company_id_fkey
    FOREIGN KEY (freight_company_id)
    REFERENCES transport_companies(id)
    ON DELETE SET NULL;

    RAISE NOTICE '✅ Contrainte vers transport_companies créée';

    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_freight
    ON shipping_preparations(freight_company_id);
  END IF;
END $$;

-- =====================================================
-- 4. VÉRIFICATION
-- =====================================================

DO $$
DECLARE
  v_target_table TEXT;
BEGIN
  SELECT MAX(ccu.table_name) INTO v_target_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.constraint_name = 'shipping_preparations_freight_company_id_fkey'
    AND tc.table_name = 'shipping_preparations';

  RAISE NOTICE '====================================';
  RAISE NOTICE '✅ CORRECTION APPLIQUÉE';
  RAISE NOTICE 'Contrainte pointe vers: %', v_target_table;
  RAISE NOTICE '====================================';
END $$;
```

### Étape 3 : Exécuter le Script

1. Coller le script dans le SQL Editor
2. Cliquer sur "Run" (ou Ctrl+Enter)
3. Vérifier les messages de confirmation :
   - ✅ Contrainte incorrecte supprimée
   - ✅ X IDs invalides nettoyés (si applicable)
   - ✅ Contrainte vers transport_companies créée
   - ✅ CORRECTION APPLIQUÉE

### Étape 4 : Tester

1. Retourner sur l'application
2. Aller dans **Shipping Preparation**
3. Cliquer sur **"+ Nouvelle préparation"**
4. Remplir le formulaire :
   - Sélectionner une Mining Company
   - Sélectionner une Export License
   - **Sélectionner une Freight Company** ← Celui qui causait l'erreur
   - Sélectionner une Refinery
   - Ajouter des productions
5. Cliquer sur **"Enregistrer"**
6. ✅ **Devrait fonctionner sans erreur**

---

## Vérification de la Correction

### Commandes SQL pour Vérifier

```sql
-- Vérifier que la contrainte pointe vers la bonne table
SELECT
  tc.constraint_name,
  tc.table_name AS from_table,
  ccu.table_name AS to_table,
  ccu.column_name AS to_column
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_name = 'shipping_preparations_freight_company_id_fkey'
  AND tc.table_name = 'shipping_preparations';

-- Résultat attendu:
-- from_table: shipping_preparations
-- to_table: transport_companies  ← DOIT ÊTRE CELUI-CI
-- to_column: id
```

```sql
-- Vérifier qu'il n'y a plus d'IDs invalides
SELECT COUNT(*) as invalid_count
FROM shipping_preparations sp
WHERE sp.freight_company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM transport_companies tc
    WHERE tc.id = sp.freight_company_id
  );

-- Résultat attendu: 0
```

---

## Prévention Future

### Actions pour Éviter Ce Type de Régression

1. **Vérifier les noms de tables avant migration**
   ```sql
   -- Toujours vérifier qu'une table existe avant d'y référencer
   SELECT tablename FROM pg_tables WHERE tablename LIKE '%freight%';
   SELECT tablename FROM pg_tables WHERE tablename LIKE '%transport%';
   ```

2. **Tester les migrations sur environnement de développement**
   - Ne JAMAIS appliquer directement en production
   - Créer des données de test
   - Tester insertion/update/delete

3. **Documenter les dépendances**
   - Liste des tables référencées par FK
   - Schéma relationnel à jour
   - Documentation des migrations

---

## Timeline de la Régression

- **9 décembre 2025** : Migration incorrecte appliquée
- **10 décembre 2025** : Erreur détectée par l'utilisateur
- **10 décembre 2025** : Cause racine identifiée
- **10 décembre 2025** : Correction créée et documentée

---

## Résumé Exécutif

| Élément | Valeur |
|---------|--------|
| **Gravité** | CRITIQUE - Bloque workflow complet |
| **Impact** | Impossible de créer/modifier Shipping Preparations |
| **Cause** | Migration pointant vers table inexistante |
| **Correction** | Recréer FK vers la bonne table |
| **Durée estimation** | 2 minutes |
| **Risque correction** | Très faible (idempotent) |

---

## Support

Si après l'application du script l'erreur persiste :

1. Vérifier les messages dans SQL Editor
2. Exécuter les requêtes de vérification ci-dessus
3. Vérifier qu'il n'y a pas d'autres contraintes en conflit :
   ```sql
   SELECT constraint_name, constraint_type
   FROM information_schema.table_constraints
   WHERE table_name = 'shipping_preparations'
   AND constraint_name LIKE '%freight%';
   ```

---

**Date de création :** 10 décembre 2025
**Status :** ✅ SOLUTION PRÊTE - À APPLIQUER IMMÉDIATEMENT
**Priorité :** CRITIQUE
**Temps d'application :** < 2 minutes
