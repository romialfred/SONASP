# Guide d'Installation du Module de Paiements des Artisans Miniers

## Situation Actuelle

La table `snp_artisan_ventes_or` existe déjà dans votre base de données. Vous devez maintenant créer les tables de paiements.

## Installation - 1 Seul Script à Exécuter

### Étape 1 : Vérifier la Table Existante

Vérifiez que la table des ventes existe :

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'snp_artisan_ventes_or';

-- Devrait retourner : snp_artisan_ventes_or
```

### Étape 2 : Exécuter le Script des Paiements

1. Connectez-vous à **Supabase SQL Editor** : https://app.supabase.com
2. Sélectionnez votre projet
3. Cliquez sur **"SQL Editor"** dans le menu latéral
4. Cliquez sur **"New query"**
5. Ouvrez le fichier : `scripts/20251228_003_SYSTEME_PAIEMENTS_ARTISANS.sql`
6. **Copiez TOUT le contenu** du fichier
7. Collez-le dans l'éditeur SQL de Supabase
8. Cliquez sur **"Run"** (ou appuyez sur Ctrl+Enter)
9. Attendez que le script se termine (vous devriez voir "Success")

### Étape 3 : Vérifier l'Installation

Exécutez cette requête pour vérifier que toutes les tables ont été créées :

```sql
-- Vérifier les tables de paiements
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'snp_artisan_ventes_or',
  'snp_artisan_factures_definitives',
  'snp_artisan_paiements',
  'snp_artisan_taxes_retenues'
)
ORDER BY table_name;

-- Devrait afficher 4 tables :
-- - snp_artisan_factures_definitives
-- - snp_artisan_paiements
-- - snp_artisan_taxes_retenues
-- - snp_artisan_ventes_or
```

### Étape 4 : Vérifier les Colonnes Ajoutées

Vérifiez que les nouvelles colonnes ont été ajoutées à la table des ventes :

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'snp_artisan_ventes_or'
AND column_name IN ('statut_paiement', 'facture_definitive_id', 'reference_vente', 'statut_validation')
ORDER BY column_name;

-- Devrait afficher 4 colonnes
```

### Étape 5 : Vérifier les Fonctions SQL

```sql
-- Lister les fonctions créées
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (
  routine_name LIKE '%facture%' OR
  routine_name LIKE '%paiement%' OR
  routine_name LIKE '%taxe%'
)
ORDER BY routine_name;

-- Devrait afficher :
-- - calculer_taxes_vente
-- - generer_numero_facture
-- - generer_reference_paiement
-- + les fonctions trigger
```

### Étape 6 : Tester les Fonctions

#### Test 1 : Génération de numéro de facture

```sql
SELECT generer_numero_facture();
-- Devrait retourner : FACT-2024-12-0001
```

#### Test 2 : Calcul des taxes

```sql
SELECT *
FROM calculer_taxes_vente(
  1000000,  -- Montant brut: 1,000,000 FCFA
  18.0,     -- Taux TVA: 18%
  1.5       -- Taux retenue: 1.5%
);

-- Résultat attendu :
-- montant_tva: 180000.00
-- montant_retenue_source: 15000.00
-- montant_total_taxes: 195000.00
-- montant_net: 805000.00
```

### Étape 7 : Vérifier les Vues

```sql
-- Vérifier les vues créées
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name LIKE '%artisan%'
ORDER BY table_name;

-- Devrait inclure :
-- - v_artisan_paiements_resume
-- - v_taxes_a_reverser
-- - v_paiements_en_attente
```

## Dépannage

### Erreur : "relation snp_artisan_ventes_or does not exist"

**Cause :** La table des ventes n'existe pas.

**Solution :**
1. Vérifiez que vous êtes connecté à la bonne base de données
2. Exécutez d'abord la migration des artisans miniers :
   - `scripts/20251227_001_create_artisans_miniers_system.sql`

### Erreur : "foreign key constraint"

**Cause :** La table `snp_artisans_miniers` n'existe pas.

**Solution :**
1. Vérifiez que la table des artisans existe :
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_name = 'snp_artisans_miniers';
   ```
2. Si elle n'existe pas, exécutez d'abord la migration des artisans

### Erreur : "function already exists"

**Cause :** Les fonctions existent déjà (normal).

**Solution :**
- C'est normal, le script utilise `CREATE OR REPLACE` qui remplace les fonctions existantes
- Ignorez cet avertissement si le script se termine avec succès

### Erreur : "constraint already exists"

**Cause :** Les contraintes existent déjà (normal si vous réexécutez le script).

**Solution :**
- C'est normal, PostgreSQL ignore les contraintes qui existent déjà
- Le script utilise `IF NOT EXISTS` pour éviter les doublons

## Test Complet du Système

### 1. Créer une Vente de Test

```sql
-- Récupérer un artisan existant
SELECT id, nom, prenoms FROM snp_artisans_miniers WHERE statut = 'actif' LIMIT 1;

-- Créer une vente (remplacez ARTISAN_ID par un ID réel)
INSERT INTO snp_artisan_ventes_or (
  artisan_id,
  date_vente,
  quantite_grammes,
  type_or,
  purete_karat,
  prix_kg_fcfa,
  statut,
  statut_validation
) VALUES (
  'ARTISAN_ID_ICI',  -- Remplacer par un ID réel
  CURRENT_DATE,
  50.5,              -- 50.5 grammes
  'poudre',
  22.00,             -- 22 karats
  35000000,          -- 35,000,000 FCFA/kg
  'validee',
  'validee'
) RETURNING id, montant_total_fcfa;

-- Noter l'ID et le montant retournés
```

### 2. Créer une Facture

```sql
-- Créer une facture pour la vente (remplacez les IDs)
INSERT INTO snp_artisan_factures_definitives (
  numero_facture,
  vente_or_id,
  artisan_id,
  montant_brut,
  montant_taxe_tva,
  montant_taxe_retenue_source,
  montant_total_taxes,
  montant_net_a_payer,
  taux_tva,
  taux_retenue_source,
  statut
)
SELECT
  generer_numero_facture(),
  v.id,
  v.artisan_id,
  v.montant_total_fcfa,
  (v.montant_total_fcfa * 18.0 / 100),
  (v.montant_total_fcfa * 1.5 / 100),
  (v.montant_total_fcfa * 19.5 / 100),
  (v.montant_total_fcfa - (v.montant_total_fcfa * 19.5 / 100)),
  18.0,
  1.5,
  'emise'
FROM snp_artisan_ventes_or v
WHERE v.id = 'VENTE_ID_ICI'  -- Remplacer par l'ID de la vente
RETURNING *;
```

### 3. Vérifier les Ventes en Attente de Paiement

```sql
SELECT * FROM v_paiements_en_attente;
```

### 4. Créer un Paiement

```sql
-- Créer un paiement (remplacez les IDs)
INSERT INTO snp_artisan_paiements (
  reference_paiement,
  facture_id,
  vente_or_id,
  artisan_id,
  type_paiement,
  montant_paye,
  montant_taxes_retenues,
  statut
)
SELECT
  generer_reference_paiement(),
  f.id,
  f.vente_or_id,
  f.artisan_id,
  'virement_bancaire',
  f.montant_net_a_payer,
  f.montant_total_taxes,
  'complete'
FROM snp_artisan_factures_definitives f
WHERE f.id = 'FACTURE_ID_ICI'  -- Remplacer par l'ID de la facture
RETURNING *;
```

### 5. Vérifier les Taxes Retenues

```sql
SELECT * FROM v_taxes_a_reverser;
```

### 6. Vérifier le Résumé des Paiements

```sql
SELECT * FROM v_artisan_paiements_resume;
```

## Vérification Finale

Exécutez cette requête pour un résumé complet :

```sql
SELECT
  'Tables' AS type,
  COUNT(*) AS nombre
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'snp_artisan_%'

UNION ALL

SELECT
  'Fonctions' AS type,
  COUNT(*) AS nombre
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (
  routine_name LIKE '%facture%' OR
  routine_name LIKE '%paiement%' OR
  routine_name LIKE '%taxe%'
)

UNION ALL

SELECT
  'Vues' AS type,
  COUNT(*) AS nombre
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name LIKE '%artisan%';

-- Résultat attendu minimum :
-- Tables: 7+ (artisans, ventes, factures, paiements, taxes, infractions, cartes)
-- Fonctions: 5+
-- Vues: 4+
```

## Utilisation dans l'Application

Une fois l'installation terminée :

1. **Accédez au module :**
   - Menu : Or Artisanal → Paiements des Ventes

2. **Flux de Travail :**
   - Créer une vente d'or → Valider
   - Le système génère automatiquement une facture
   - Enregistrer le paiement
   - Les taxes sont automatiquement calculées et enregistrées

3. **Tableaux de Bord :**
   - Dashboard des paiements
   - Liste des factures
   - Taxes à reverser
   - Historique complet

## Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs dans l'éditeur SQL de Supabase
2. Consultez la documentation détaillée : `scripts/README-MODULE-PAIEMENTS-ARTISANS.md`
3. Vérifiez que vous êtes connecté avec un compte administrateur
4. Assurez-vous que toutes les tables requises existent

## Colonnes Ajoutées à snp_artisan_ventes_or

Le script ajoute automatiquement ces colonnes à la table des ventes :

- `statut_paiement` : Statut du paiement (non_paye, facture_emise, en_paiement, paye)
- `facture_definitive_id` : Référence à la facture générée
- `reference_vente` : Référence unique de la vente
- `statut_validation` : Statut de validation (en_attente, validee, rejetee)

Ces colonnes sont nécessaires pour le flux complet de facturation et paiement.

---

**Date de création :** 28 décembre 2024
**Version :** 2.0.0 (Corrigée pour noms de tables avec préfixe snp_)
**Auteur :** SONASP Development Team
