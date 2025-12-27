# Installation du Module Artisans Miniers

## Résumé des Corrections

Les artisans miniers sont **INDEPENDANTS** et n'appartiennent pas à une compagnie minière.

### Modifications Appliquées

1. **Structure de la Base de Données**
   - ❌ Suppression de `mining_company_id` (non applicable)
   - ✅ Ajout de `pays` pour supporter plusieurs pays
   - ✅ Ajout de `updated_by` pour l'audit
   - ✅ Correction de `adresse_complete` → `adresse`

2. **Code TypeScript**
   - ✅ Interface `ArtisanMinier` mise à jour
   - ✅ Service simplifié (pas de jointure avec mining_companies)
   - ✅ Types corrects pour `type_piece_identite`

3. **Build**
   - ✅ Le projet compile sans erreur
   - ✅ Toutes les dépendances sont correctes

## Installation en 2 Étapes

### ÉTAPE 1: Créer les Tables dans Supabase

Allez dans **Supabase SQL Editor** et exécutez:

```bash
supabase/migrations/20251227_001_create_artisans_miniers_system.sql
```

Ce script crée:
- Table `SNP_artisans_miniers` (sans mining_company_id)
- Table `SNP_cartes_professionnelles`
- Index, triggers, RLS, fonctions

### ÉTAPE 2: Insérer les Données de Test

Dans **Supabase SQL Editor**, exécutez:

```bash
scripts/insert-artisans-burkina-final.sql
```

Ce script insère 20 artisans du Burkina Faso:
- 12 exploitants
- 4 collecteurs
- 3 intermédiaires
- 1 fournisseur

## Vérification Rapide

Après installation, exécutez dans Supabase:

```sql
-- Compter les artisans
SELECT COUNT(*) as total_artisans FROM "SNP_artisans_miniers";
-- Résultat attendu: 20

-- Voir les artisans
SELECT
  numero_carte,
  type_artisan,
  COALESCE(nom || ' ' || prenoms, raison_sociale) as nom,
  commune,
  region,
  pays
FROM "SNP_artisans_miniers"
ORDER BY numero_carte
LIMIT 5;
```

## Résultat Attendu dans l'Application

Une fois les scripts exécutés:
- ✅ La page `/artisan-minier/liste` affiche les 20 artisans
- ✅ Vous pouvez créer de nouveaux artisans
- ✅ Les filtres par type et pays fonctionnent
- ✅ La génération de cartes est opérationnelle

## Structure des Données

### Types d'Artisans
- `exploitant`: Extrait l'or des sites miniers
- `collecteur`: Achète l'or auprès des exploitants
- `intermediaire`: Facilite les transactions
- `fournisseur`: Fournit du matériel

### Types de Personnes
- `physique`: Individu (nom + prénom)
- `morale`: Entreprise (raison sociale)

### Numérotation des Cartes
Format: `SONASP/AM/{année}/{pays}/{numéro}`

Exemples:
- SONASP/AM/2025/BF/0001 (Burkina Faso)
- SONASP/AM/2025/ML/0001 (Mali)
- SONASP/AM/2025/CI/0001 (Côte d'Ivoire)

## Support Multi-Pays

Le système supporte les pays suivants:
- 🇧🇫 Burkina Faso (BF)
- 🇲🇱 Mali (ML)
- 🇨🇮 Côte d'Ivoire (CI)
- 🇬🇳 Guinée (GN)
- 🇳🇪 Niger (NE)
- 🇸🇳 Sénégal (SN)

## En Cas de Problème

Si les artisans ne s'affichent pas:

1. Vérifiez que les tables existent:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('SNP_artisans_miniers', 'SNP_cartes_professionnelles');
```

2. Vérifiez que les données sont insérées:
```sql
SELECT COUNT(*) FROM "SNP_artisans_miniers";
```

3. Vérifiez les politiques RLS:
```sql
SELECT * FROM pg_policies WHERE tablename = 'SNP_artisans_miniers';
```

4. Vérifiez que vous êtes authentifié dans l'application

## Documentation Complète

Pour plus de détails, consultez:
- `scripts/README-ARTISANS-FINAL.md`: Documentation complète
- `supabase/migrations/20251227_001_create_artisans_miniers_system.sql`: Structure de la base de données
