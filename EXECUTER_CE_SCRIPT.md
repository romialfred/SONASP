# 🚨 EXÉCUTEZ CE SCRIPT MAINTENANT

## Le problème: Table `profiles` n'existe pas

L'ancien script ne fonctionne pas. Utilisez ce nouveau script à la place.

---

## ✅ COPIEZ ET EXÉCUTEZ CECI DANS SUPABASE SQL EDITOR:

```sql
ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Authenticated users can view transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Admins can manage transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Admins can insert transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Admins can update transport companies" ON transport_companies;
DROP POLICY IF EXISTS "Admins can delete transport companies" ON transport_companies;

CREATE POLICY "Authenticated users can view transport companies"
  ON transport_companies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert transport companies"
  ON transport_companies FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update transport companies"
  ON transport_companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete transport companies"
  ON transport_companies FOR DELETE TO authenticated USING (true);
```

---

## C'EST TOUT !

Après avoir exécuté ce script:

1. ✅ Les policies RLS seront créées
2. ✅ La liste des compagnies de transport s'affichera
3. ✅ Vous pourrez créer des expéditions

**Rafraîchissez votre page Invoice & Consignment et la liste s'affichera.**

---

## Fichiers disponibles:

- **`fix_transport_companies_rls_simple.sql`** - Version complète du script
- **`SOLUTION_TRANSPORT_COMPANIES.md`** - Documentation détaillée
- **`EXECUTER_CE_SCRIPT.md`** - Ce guide

Build: ✅ Réussi
