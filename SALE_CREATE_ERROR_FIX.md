# Fix - Sale Creation Error 400

## Problème Identifié

Erreur lors de la création d'une vente: "Failed to create sale. Please try again."

### Cause Racine

Les erreurs 400 dans la console montrent une URL Supabase corrompue:
- **URL en cache**: `boolagaezdabahangmapb`
- **URL correcte (.env)**: `boolqagzdqbahqnpawpb`

L'application utilise une ancienne URL Supabase mise en cache.

## Solutions

### Solution 1: Vider le Cache et Redémarrer (RECOMMANDÉE)

1. **Arrêter le serveur de développement**
   ```bash
   # Appuyez sur Ctrl+C dans le terminal
   ```

2. **Vider les caches**
   ```bash
   # Supprimer le cache Vite
   rm -rf node_modules/.vite/

   # Supprimer le dossier dist
   rm -rf dist/
   ```

3. **Vider le cache du navigateur**
   - Ouvrir les DevTools (F12)
   - Aller dans Application > Storage
   - Cliquer sur "Clear site data"
   - OU simplement ouvrir en mode incognito

4. **Redémarrer le serveur**
   ```bash
   npm run dev
   ```

### Solution 2: Forcer le Rechargement des Variables d'Environnement

Si le problème persiste, vérifier que le fichier .env est bien lu:

```bash
# Afficher les variables d'environnement
cat .env

# Doit afficher:
# VITE_SUPABASE_URL=https://boolqagzdqbahqnpawpb.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...
```

### Solution 3: Vérifier les Permissions RLS

Si après le redémarrage le problème persiste, vérifier les permissions de la table `sales`:

```sql
-- Vérifier que RLS est activé
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'sales';

-- Lister les policies
SELECT * FROM pg_policies WHERE tablename = 'sales';

-- Si nécessaire, ajouter une policy pour INSERT
CREATE POLICY "Users can insert sales"
ON sales
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());
```

## Vérification de la Structure

Assurez-vous que la table `sales` a toutes les colonnes nécessaires:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales'
ORDER BY ordinal_position;
```

Colonnes requises:
- ✅ sale_number (text)
- ✅ sale_date (date)
- ✅ customer_id (uuid)
- ✅ seller_id (uuid)
- ✅ seller_type (text)
- ✅ quantity_oz (numeric)
- ✅ london_am_rate (numeric)
- ✅ freight_cost (numeric)
- ✅ other_costs (numeric)
- ✅ gross_proceeds (numeric)
- ✅ net_proceeds (numeric)
- ✅ royalties (numeric)
- ✅ final_proceeds (numeric)
- ✅ total_amount (numeric)
- ✅ currency (text)
- ✅ status (text)
- ✅ mechanism_type (text, nullable)
- ✅ created_by (uuid)

## Test Après Correction

1. **Redémarrer l'application**
   ```bash
   npm run dev
   ```

2. **Ouvrir en mode incognito** (Ctrl+Shift+N)

3. **Se connecter et essayer de créer une vente**

4. **Vérifier la console**
   - Ne doit plus afficher d'erreurs 400
   - L'URL doit être `https://boolqagzdqbahqnpawpb.supabase.co`

## Erreurs Spécifiques et Solutions

### Erreur: "Database error: insert or update on table violates foreign key constraint"

**Solution**: Vérifier que le `customer_id` et `seller_id` existent dans leurs tables respectives

```sql
-- Vérifier customer
SELECT id, customer_name FROM customers WHERE id = 'VOTRE_CUSTOMER_ID';

-- Vérifier mining company
SELECT id, name FROM mining_companies WHERE id = 'VOTRE_SELLER_ID';
```

### Erreur: "new row violates row-level security policy"

**Solution**: Ajouter les policies RLS manquantes

```sql
-- Policy pour INSERT
CREATE POLICY "Authenticated users can insert sales"
ON sales
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy pour SELECT
CREATE POLICY "Users can view sales"
ON sales
FOR SELECT
TO authenticated
USING (true);
```

### Erreur: "column does not exist"

**Solution**: Vérifier que toutes les colonnes existent

```sql
-- Ajouter colonne manquante si nécessaire
ALTER TABLE sales ADD COLUMN IF NOT EXISTS mechanism_type text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
```

## Checklist de Vérification

Avant de créer une vente, vérifier:

- [ ] Le serveur de dev est redémarré
- [ ] Le cache navigateur est vidé (ou mode incognito)
- [ ] Les variables d'environnement sont correctes dans .env
- [ ] L'utilisateur est connecté (auth.uid() existe)
- [ ] Le customer_id est valide
- [ ] Le seller_id (mining_company_id) est valide
- [ ] Les permissions RLS permettent l'INSERT
- [ ] Toutes les colonnes requises existent

## Commande de Diagnostic Rapide

```bash
# Vider cache et redémarrer en une commande
rm -rf node_modules/.vite/ dist/ && npm run dev
```

## Si le Problème Persiste

1. **Vérifier les logs Supabase**
   - Aller sur dashboard.supabase.com
   - Projet > Logs > Database
   - Chercher les erreurs 400

2. **Tester l'insertion directement**
   ```sql
   -- Dans SQL Editor de Supabase
   INSERT INTO sales (
     sale_number,
     sale_date,
     customer_id,
     seller_id,
     seller_type,
     quantity_oz,
     london_am_rate,
     freight_cost,
     other_costs,
     gross_proceeds,
     net_proceeds,
     royalties,
     final_proceeds,
     total_amount,
     currency,
     status,
     created_by
   ) VALUES (
     'TEST-2025-001',
     CURRENT_DATE,
     (SELECT id FROM customers LIMIT 1),
     (SELECT id FROM mining_companies LIMIT 1),
     'mining_company',
     100.0,
     2700.0,
     0.0,
     0.0,
     270000.0,
     270000.0,
     8100.0,
     261900.0,
     261900.0,
     'USD',
     'draft',
     auth.uid()
   );
   ```

3. **Vérifier les contraintes**
   ```sql
   SELECT
     conname AS constraint_name,
     contype AS constraint_type,
     pg_get_constraintdef(oid) AS definition
   FROM pg_constraint
   WHERE conrelid = 'sales'::regclass;
   ```

---

**Date**: 2025-12-11
**Priorité**: CRITIQUE
**Status**: Solution Disponible
**Action**: Redémarrer le serveur + vider cache navigateur
