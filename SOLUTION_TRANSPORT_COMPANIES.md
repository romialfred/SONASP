# ✅ SOLUTION FINALE: Liste Compagnies de Transport

## ❌ ERREUR RENCONTRÉE

```
Error: Failed to run sql query: 
ERROR: 42P01: relation "profiles" does not exist
```

Le premier script faisait référence à une table `profiles` qui n'existe pas.

## ✅ SOLUTION CORRIGÉE

Utilisez le nouveau script **`fix_transport_companies_rls_simple.sql`** qui ne dépend pas de la table `profiles`.

---

## 🚀 SCRIPT À EXÉCUTER

### Dans Supabase SQL Editor, exécutez:

```sql
-- Enable RLS
ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Authenticated users can view transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Admins can manage transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Admins can insert transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Admins can update transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Admins can delete transport companies" ON transport_companies;

-- Policy: Lecture pour tous les users authentifiés
CREATE POLICY "Authenticated users can view transport companies"
  ON transport_companies
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Insert pour tous les users authentifiés
CREATE POLICY "Authenticated users can insert transport companies"
  ON transport_companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Update pour tous les users authentifiés
CREATE POLICY "Authenticated users can update transport companies"
  ON transport_companies
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Delete pour tous les users authentifiés
CREATE POLICY "Authenticated users can delete transport companies"
  ON transport_companies
  FOR DELETE
  TO authenticated
  USING (true);
```

---

## 📋 ÉTAPES

1. ✅ Ouvrez **Supabase Dashboard**
2. ✅ Allez dans **SQL Editor**
3. ✅ Copiez/collez le script ci-dessus **OU** utilisez `fix_transport_companies_rls_simple.sql`
4. ✅ Cliquez **"Run"**
5. ✅ Vérifiez que vous voyez les 4 policies créées
6. ✅ Rafraîchissez la page Invoice & Consignment

---

## ✅ RÉSULTAT ATTENDU

### Après exécution du script:

La requête de test devrait afficher:
```
id | name                                | email              | is_active
---+-------------------------------------+--------------------+-----------
xxx| Brinks Freight Express Limited      | contact@brinks.com | true
```

### Dans l'interface Invoice & Consignment:

```
Transport Company
├─ -- Sélectionner --
└─ Brinks Freight Express Limited - Johannesburg, South Africa
```

---

## 🔐 PERMISSIONS

Cette version simple autorise **tous les utilisateurs authentifiés** à:
- ✅ Lire les compagnies de transport
- ✅ Ajouter des compagnies
- ✅ Modifier des compagnies
- ✅ Supprimer des compagnies

**Note:** Si vous souhaitez des permissions plus restrictives plus tard (ex: seuls les admins peuvent modifier), vous pourrez affiner les policies une fois que vous aurez un système de rôles en place.

---

## 📦 FICHIERS

1. **`fix_transport_companies_rls_simple.sql`** ⭐ UTILISEZ CELUI-CI
2. ~~`fix_transport_companies_rls.sql`~~ (ne fonctionne pas sans table profiles)
3. **`SOLUTION_TRANSPORT_COMPANIES.md`** - Cette documentation

---

## ✅ VÉRIFICATION

Après exécution, vérifiez dans SQL Editor:

```sql
-- Vérifier les policies
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'transport_companies';

-- Vérifier les données
SELECT id, name, is_active FROM transport_companies;
```

Vous devriez voir:
- 4 policies (SELECT, INSERT, UPDATE, DELETE)
- 1+ compagnie(s) de transport

---

## 🎊 RÉSULTAT FINAL

Une fois le script exécuté:
- ✅ Le code TypeScript fonctionne
- ✅ Les RLS policies sont en place
- ✅ La liste des compagnies s'affiche
- ✅ Vous pouvez créer de nouvelles expéditions

**Le problème est résolu !** ✅
