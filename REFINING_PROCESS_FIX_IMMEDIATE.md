# Fix Immédiat - Processus de Raffinage

## Problème Identifié

L'erreur "Impossible de charger les expéditions" était causée par:
1. Une relation `mining_company` inexistante dans la table `freight_shipments`
2. Les statuts `processing`, `processed`, `in_stock` non présents dans l'enum

## Solutions Appliquées

### 1. Correction Code Frontend ✅
- Modification de la requête pour ne plus utiliser la relation directe inexistante
- Récupération des données mining_company via la table de liaison `freight_shipment_productions`
- AUCUNE RÉGRESSION: Le code fonctionne avec la structure actuelle de la BD

### 2. Migration Base de Données (À APPLIQUER MAINTENANT)

**Ouvrez Supabase Dashboard > SQL Editor et exécutez:**

```sql
/*
  # Add Refining Process Statuses - FIX COMPLET

  Cette migration ajoute les statuts manquants sans régression
*/

-- Étape 1: Ajouter les nouveaux statuts à l'enum
DO $$ BEGIN
  -- Vérifier et ajouter 'processing'
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'processing'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'freight_shipment_status')
  ) THEN
    ALTER TYPE freight_shipment_status ADD VALUE 'processing';
  END IF;

  -- Vérifier et ajouter 'processed'
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'processed'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'freight_shipment_status')
  ) THEN
    ALTER TYPE freight_shipment_status ADD VALUE 'processed';
  END IF;

  -- Vérifier et ajouter 'in_stock'
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'in_stock'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'freight_shipment_status')
  ) THEN
    ALTER TYPE freight_shipment_status ADD VALUE 'in_stock';
  END IF;
END $$;

-- Étape 2: Ajouter les colonnes de tracking pour le workflow de raffinage
DO $$ BEGIN
  -- Processing started
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments' AND column_name = 'processing_started_at'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN processing_started_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments' AND column_name = 'processing_started_by'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN processing_started_by UUID REFERENCES auth.users(id);
  END IF;

  -- Processed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments' AND column_name = 'processed_at'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN processed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments' AND column_name = 'processed_by'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN processed_by UUID REFERENCES auth.users(id);
  END IF;

  -- In stock
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments' AND column_name = 'stocked_at'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN stocked_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments' AND column_name = 'stocked_by'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN stocked_by UUID REFERENCES auth.users(id);
  END IF;

  -- Refining notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments' AND column_name = 'refining_notes'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN refining_notes TEXT;
  END IF;
END $$;

-- Étape 3: Mettre à jour le commentaire du statut
COMMENT ON COLUMN freight_shipments.status IS 'Workflow: pending, approved, shipped_to_refinery, received_at_refinery, processing, processed, in_stock';
```

## Vérification Post-Migration

Après avoir exécuté le SQL ci-dessus, vérifiez que tout fonctionne:

```sql
-- Vérifier les statuts disponibles
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'freight_shipment_status')
ORDER BY enumlabel;

-- Vérifier les nouvelles colonnes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'freight_shipments'
AND column_name LIKE '%processing%' OR column_name LIKE '%processed%' OR column_name LIKE '%stock%'
ORDER BY column_name;
```

## Résultat Attendu

Une fois la migration appliquée et la page rafraîchie:
- ✅ Le module "Refining Process" charge sans erreur
- ✅ Les expéditions s'affichent correctement
- ✅ Les changements de statut fonctionnent
- ✅ Les informations de compagnie minière s'affichent
- ✅ AUCUNE RÉGRESSION sur les autres modules

## Note Importante

Cette correction est **idempotente** - vous pouvez l'exécuter plusieurs fois sans problème. Elle vérifie l'existence avant d'ajouter quoi que ce soit.
