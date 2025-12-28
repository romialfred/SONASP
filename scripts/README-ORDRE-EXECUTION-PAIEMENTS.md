# Ordre d'Exécution des Scripts - Module Paiements Artisans

## Scripts à Exécuter dans l'Ordre

Pour installer le module de paiements des artisans miniers, vous devez exécuter les scripts dans cet ordre exact :

### 1. Script de Désactivation (OBLIGATOIRE EN PREMIER)

**Fichier:** `20251228_002_SYSTEME_DESACTIVATION_ARTISANS.sql`

**Ce qu'il fait :**
- Ajoute la colonne `actif` (boolean) à la table `snp_artisans_miniers`
- Ajoute les colonnes `desactive_le`, `desactive_par`, `motif_desactivation`
- Crée le système de désactivation automatique à l'expiration de carte

**IMPORTANT :** Ce script DOIT être exécuté en premier car le script de paiements utilise la colonne `actif`.

### 2. Script des Paiements

**Fichier:** `20251228_003_SYSTEME_PAIEMENTS_ARTISANS.sql`

**Ce qu'il fait :**
- Crée les tables de paiements, factures et taxes
- Ajoute les colonnes de paiement à `snp_artisan_ventes_or`
- Crée les fonctions de calcul et génération de documents
- Crée les vues pour le suivi des paiements
- Configure les politiques RLS

**Dépendances :**
- Table `snp_artisans_miniers` avec colonne `actif` (créée par script 1)
- Table `snp_artisan_ventes_or` (doit déjà exister)

## Instructions d'Installation

### Étape 1 : Exécuter le Script de Désactivation

1. Ouvrez Supabase SQL Editor : https://app.supabase.com
2. Nouvelle requête
3. Copiez TOUT le contenu de : `scripts/20251228_002_SYSTEME_DESACTIVATION_ARTISANS.sql`
4. Cliquez "Run"
5. Attendez "Success"

### Étape 2 : Exécuter le Script des Paiements

1. Nouvelle requête dans Supabase SQL Editor
2. Copiez TOUT le contenu de : `scripts/20251228_003_SYSTEME_PAIEMENTS_ARTISANS.sql`
3. Cliquez "Run"
4. Attendez "Success"

## Vérification Rapide

Après installation, vérifiez :

```sql
-- Vérifier colonne actif
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'snp_artisans_miniers'
AND column_name = 'actif';
-- Devrait retourner : actif

-- Vérifier tables de paiements
SELECT table_name
FROM information_schema.tables
WHERE table_name LIKE 'snp_artisan_%'
ORDER BY table_name;
-- Devrait afficher 7+ tables incluant :
-- - snp_artisan_factures_definitives
-- - snp_artisan_paiements
-- - snp_artisan_taxes_retenues
-- - snp_artisan_ventes_or
```

## En Cas d'Erreur

### Erreur : "column a.actif does not exist"

**Cause :** Le script de désactivation n'a pas été exécuté en premier.

**Solution :**
1. Exécutez d'abord `20251228_002_SYSTEME_DESACTIVATION_ARTISANS.sql`
2. Puis exécutez `20251228_003_SYSTEME_PAIEMENTS_ARTISANS.sql`

### Erreur : "column a.prenoms does not exist"

**Cause :** Erreur de typo dans le script (déjà corrigée).

**Solution :** Utilisez la version corrigée du script.

## Guide Complet

Pour plus de détails, consultez : `GUIDE-INSTALLATION-PAIEMENTS-ARTISANS.md`
