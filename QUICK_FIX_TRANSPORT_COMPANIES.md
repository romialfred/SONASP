# 🚨 ACTION REQUISE: Liste Compagnies de Transport

## ⚡ PROBLÈME

La liste des compagnies de transport est vide dans **Invoice & Consignment**, alors que "Brinks Freight Express Limited" existe déjà dans la base de données.

## ✅ CAUSE

**RLS (Row Level Security) bloque la lecture**

La table a des données mais les policies RLS manquent. Les utilisateurs ne peuvent pas lire les compagnies.

## 🔧 SOLUTION RAPIDE

### Exécutez ce script dans Supabase SQL Editor:

```sql
-- Enable RLS et créer les policies
ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;

-- DROP policies existantes
DROP POLICY IF EXISTS "Users can view all transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Authenticated users can view transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Admins can manage transport companies" ON transport_companies;

-- Policy LECTURE pour tous les users authentifiés
CREATE POLICY "Authenticated users can view transport companies"
  ON transport_companies
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy INSERT pour admins/managers
CREATE POLICY "Admins can insert transport companies"
  ON transport_companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- Policy UPDATE pour admins/managers
CREATE POLICY "Admins can update transport companies"
  ON transport_companies
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- Policy DELETE pour admins uniquement
CREATE POLICY "Admins can delete transport companies"
  ON transport_companies
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

### Ou utilisez le fichier:

Le script complet est dans **`fix_transport_companies_rls.sql`**

## 📋 ÉTAPES

1. Ouvrez **Supabase Dashboard**
2. Allez dans **SQL Editor**
3. Copiez/collez le script ci-dessus
4. Cliquez **"Run"**
5. Rafraîchissez votre page Invoice & Consignment

## ✅ RÉSULTAT

Après exécution, la liste affichera:

```
Transport Company
├─ -- Sélectionner --
└─ Brinks Freight Express Limited - Johannesburg, South Africa
```

## 📦 FICHIERS

- `fix_transport_companies_rls.sql` - Script SQL complet
- `FIX_TRANSPORT_COMPANIES_LISTE.md` - Documentation détaillée
- `QUICK_FIX_TRANSPORT_COMPANIES.md` - Ce guide rapide

## ⚡ BUILD

Code TypeScript: ✅ Corrigé et testé (24.46s)
