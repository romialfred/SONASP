# Guide de Résolution - Artisans Miniers

## Problème Détecté

Les données artisans ne s'affichent pas à cause de:
1. Colonne `pays` manquante dans la table
2. Relations incorrectes avec `mining_companies`
3. Colonnes manquantes: `mining_company_id`, `updated_by`

## Solution en 3 Étapes

### Étape 1: Diagnostic et Correction Structure
**Fichier:** `diagnose-and-fix-artisans.sql`

Ce script va:
- Vérifier l'existence de la table
- Ajouter les colonnes manquantes: `pays`, `mining_company_id`, `updated_by`
- Nettoyer les données invalides
- Afficher la structure actuelle
- Vérifier les RLS policies et triggers

**Comment faire:**
1. Ouvrez votre Supabase Dashboard: https://boolqagzdqbahqnpawpb.supabase.co
2. Allez dans **SQL Editor**
3. Cliquez sur **New Query**
4. Copiez tout le contenu de `diagnose-and-fix-artisans.sql`
5. Cliquez sur **RUN** (ou Ctrl+Enter)
6. Vérifiez les messages dans la console

### Étape 2: Insertion des Données Test
**Fichier:** `insert-artisans-fixed.sql`

Ce script va insérer 20 artisans test du Burkina Faso:
- 7 Exploitants (personnes physiques)
- 4 Collecteurs (personnes physiques)
- 3 Intermédiaires (personnes physiques)
- 2 Fournisseurs (personnes physiques)
- 4 Sociétés (personnes morales)

**Comment faire:**
1. Dans le SQL Editor de Supabase
2. Créez une nouvelle query
3. Copiez tout le contenu de `insert-artisans-fixed.sql`
4. Cliquez sur **RUN**
5. Vérifiez le résultat: devrait afficher 20 artisans

### Étape 3: Vérification dans l'Application

1. Le code frontend a été corrigé automatiquement
2. Ouvrez votre application: http://localhost:5173
3. Connectez-vous avec vos identifiants
4. Allez dans **Artisan Minier > Liste des Artisans**
5. Vous devriez voir 20 artisans avec:
   - Leurs noms/raisons sociales
   - Leurs numéros de carte (SONASP/AM/2025/...)
   - Leurs types (exploitant, collecteur, etc.)
   - Leurs coordonnées

## Modifications Apportées au Code

### Service artisanMinierService.ts
- Suppression des relations avec `mining_companies` qui n'existent pas
- Simplification des requêtes SELECT
- Conservation de la relation avec `SNP_cartes_professionnelles`

## Vérification Rapide

Pour vérifier que tout fonctionne:

```sql
-- Dans le SQL Editor
SELECT COUNT(*) FROM "SNP_artisans_miniers";
-- Devrait retourner: 20

SELECT
  numero_carte,
  type_artisan,
  COALESCE(nom || ' ' || prenoms, raison_sociale) as identite
FROM "SNP_artisans_miniers"
ORDER BY created_at DESC
LIMIT 5;
```

## Résolution des Problèmes

### Erreur: "column pays does not exist"
→ Exécutez l'étape 1 (diagnose-and-fix-artisans.sql)

### Erreur: "relation mining_companies does not exist"
→ Le code a été corrigé, rebuild l'application: `npm run build`

### Les artisans ne s'affichent toujours pas
→ Vérifiez les RLS policies:
```sql
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'SNP_artisans_miniers';
```

### Erreur d'authentification
→ Assurez-vous d'être connecté avec un compte valide dans l'application

## Contact Support

Si le problème persiste après ces 3 étapes, fournissez:
1. Les messages d'erreur du SQL Editor
2. Les erreurs dans la console du navigateur (F12)
3. Les résultats de la requête de vérification
