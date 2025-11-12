# Configuration du Bucket Storage pour Production Documents

## Problème Identifié

L'erreur console montre:
```
Failed to load resource: the server responded with a status of 400 ()
StorageApiError: new row violates row-level security policy
```

Cela signifie que le bucket `production-documents` existe mais **n'a pas de policies RLS configurées**.

## Solution

### ⚠️ IMPORTANT
Les Storage Policies **NE PEUVENT PAS** être créées via SQL. Elles doivent être configurées manuellement dans le Dashboard Supabase.

### Étapes à Suivre

1. **Ouvrir le Dashboard Supabase**
   - Aller sur: https://supabase.com/dashboard/project/YOUR_PROJECT_ID

2. **Accéder à Storage**
   - Menu latéral → Storage
   - Sélectionner le bucket `production-documents`
   - Cliquer sur l'onglet "Policies"

3. **Créer 4 Policies**

#### Policy 1: SELECT (Lecture)
```
Name: Allow authenticated users to read production documents
Target roles: authenticated
Policy definition: true
Operations: SELECT
```

#### Policy 2: INSERT (Upload)
```
Name: Allow authenticated users to upload production documents
Target roles: authenticated
Policy definition: true
Operations: INSERT
```

#### Policy 3: UPDATE (Modification)
```
Name: Allow authenticated users to update production documents
Target roles: authenticated
Policy definition: true
Operations: UPDATE
```

#### Policy 4: DELETE (Suppression)
```
Name: Allow authenticated users to delete production documents
Target roles: authenticated
Policy definition: true
Operations: DELETE
```

### Alternative: Via SQL (si le bucket n'existe pas encore)

Si le bucket n'existe pas encore, le créer via la console Supabase:

```sql
-- Créer le bucket (si nécessaire)
INSERT INTO storage.buckets (id, name, public)
VALUES ('production-documents', 'production-documents', false)
ON CONFLICT (id) DO NOTHING;
```

**Note:** Les policies doivent toujours être créées manuellement via le Dashboard.

## Vérification

Après avoir créé les policies:

1. Recharger la page de l'application
2. Essayer d'uploader un document
3. Vérifier que l'erreur 400 n'apparaît plus

## Problèmes Courants

### Erreur: "new row violates row-level security policy"
**Solution:** Assurez-vous que les 4 policies (SELECT, INSERT, UPDATE, DELETE) sont créées avec `policy definition: true`

### Erreur: "Bucket not found"
**Solution:** Créer le bucket via le Dashboard ou utiliser le script `scripts/create-storage-buckets.js`

### Documents non visibles après upload
**Solution:** Vérifier que la policy SELECT est bien configurée avec `policy definition: true`

## Commande NPM

Un script NPM existe pour créer automatiquement le bucket (mais pas les policies):

```bash
npm run create-buckets
```

Ce script crée le bucket mais **vous devez toujours configurer les policies manuellement** via le Dashboard.
