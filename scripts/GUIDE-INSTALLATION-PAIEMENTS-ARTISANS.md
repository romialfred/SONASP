# Guide d'Installation du Module de Paiements des Artisans Miniers

## Important - Ordre d'Exécution

Pour éviter les erreurs, les scripts SQL doivent être exécutés dans l'ordre suivant :

1. **Script 1** : Prérequis (création table ventes d'or)
2. **Script 2** : Système de paiements

## Étape 1 : Vérifier les Tables Existantes

Avant de commencer, vérifiez quelles tables existent déjà dans votre base de données :

```sql
-- Vérifier si les tables artisans existent
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND (table_name LIKE '%artisan%' OR table_name LIKE '%vente%')
ORDER BY table_name;
```

## Étape 2 : Exécuter le Script des Prérequis

### Via l'Interface Supabase (Recommandé)

1. Connectez-vous à votre projet Supabase : https://app.supabase.com
2. Sélectionnez votre projet
3. Dans le menu latéral, cliquez sur **"SQL Editor"**
4. Cliquez sur **"New query"**
5. Ouvrez le fichier : `scripts/20251228_002_PREREQUIS_SYSTEME_PAIEMENTS.sql`
6. **Copiez TOUT le contenu** du fichier
7. Collez-le dans l'éditeur SQL de Supabase
8. Cliquez sur **"Run"** (ou appuyez sur Ctrl+Enter)
9. Attendez que le script se termine (vous devriez voir "Success" en vert)

### Vérification

Après l'exécution, vérifiez que la table a été créée :

```sql
-- Vérifier la table artisan_ventes_or
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'artisan_ventes_or'
ORDER BY ordinal_position;

-- Devrait afficher environ 20 colonnes
```

## Étape 3 : Exécuter le Script du Système de Paiements

1. Restez dans l'éditeur SQL de Supabase
2. Créez une **nouvelle query** (bouton "New query")
3. Ouvrez le fichier : `scripts/20251228_003_SYSTEME_PAIEMENTS_ARTISANS.sql`
4. **Copiez TOUT le contenu** du fichier
5. Collez-le dans l'éditeur SQL
6. Cliquez sur **"Run"**
7. Attendez la fin de l'exécution

### Vérification

Vérifiez que toutes les tables ont été créées :

```sql
-- Vérifier les tables de paiements
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'artisan_ventes_or',
  'artisan_factures_definitives',
  'artisan_paiements',
  'artisan_taxes_retenues'
)
ORDER BY table_name;

-- Devrait afficher les 4 tables
```

## Étape 4 : Vérifier les Fonctions SQL

Vérifiez que les fonctions ont été créées correctement :

```sql
-- Lister les fonctions créées
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%facture%' OR routine_name LIKE '%paiement%'
ORDER BY routine_name;

-- Devrait afficher :
-- - generer_numero_facture
-- - generer_reference_paiement
-- - calculer_taxes_vente
```

## Étape 5 : Tester les Fonctions

### Tester la génération de numéro de facture

```sql
SELECT generer_numero_facture();
-- Devrait retourner quelque chose comme: FACT-2024-12-0001
```

### Tester le calcul des taxes

```sql
SELECT *
FROM calculer_taxes_vente(
  1000000,  -- Montant brut: 1,000,000 FCFA
  18.0,     -- Taux TVA: 18%
  1.5       -- Taux retenue: 1.5%
);

-- Devrait retourner:
-- montant_tva: 180000
-- montant_retenue_source: 15000
-- montant_total_taxes: 195000
-- montant_net: 805000
```

## Étape 6 : Vérifier les Vues SQL

```sql
-- Vérifier les vues créées
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name LIKE '%artisan%'
ORDER BY table_name;

-- Devrait afficher :
-- - v_artisan_paiements_resume
-- - v_taxes_a_reverser
-- - v_paiements_en_attente
-- - v_artisan_ventes_or_stats
```

## Étape 7 : Tester avec des Données

### Créer une vente de test (optionnel)

```sql
-- 1. Récupérer un artisan existant
SELECT id, nom, prenom FROM artisans_miniers LIMIT 1;

-- 2. Créer une vente de test (remplacez l'UUID par un vrai artisan_id)
INSERT INTO artisan_ventes_or (
  artisan_id,
  date_vente,
  quantite_grammes,
  type_or,
  purete_karat,
  prix_kg_fcfa,
  statut
) VALUES (
  'REMPLACER-PAR-ARTISAN-ID',  -- ID d'un artisan existant
  CURRENT_DATE,
  50.5,                         -- 50.5 grammes
  'poudre',
  22.00,                        -- 22 karats
  35000000,                     -- 35,000,000 FCFA/kg
  'validee'
) RETURNING *;

-- Les montants devraient être calculés automatiquement
```

### Créer une facture de test

```sql
-- 1. Récupérer une vente validée
SELECT id, reference_vente, montant_total_fcfa
FROM artisan_ventes_or
WHERE statut = 'validee'
LIMIT 1;

-- 2. Appeler la fonction pour calculer les taxes
SELECT * FROM calculer_taxes_vente(
  (SELECT montant_total_fcfa FROM artisan_ventes_or WHERE statut = 'validee' LIMIT 1),
  18.0,
  1.5
);
```

## Dépannage

### Erreur : "relation artisan_ventes_or does not exist"

**Solution :** Le script prérequis n'a pas été exécuté ou a échoué.
- Retournez à l'Étape 2
- Vérifiez les messages d'erreur dans l'éditeur SQL
- Assurez-vous que la table `artisans_miniers` existe

### Erreur : "foreign key constraint"

**Solution :** La table `artisans_miniers` n'existe pas.
- Exécutez d'abord la migration des artisans miniers
- Fichier : `scripts/20251227_001_create_artisans_miniers_system.sql`

### Erreur : "function does not exist"

**Solution :** Le script de paiements n'a pas créé les fonctions.
- Vérifiez les messages d'erreur dans l'éditeur SQL
- Réexécutez le script 20251228_003

### Erreur : "duplicate key value"

**Solution :** Des données existent déjà avec les mêmes IDs.
- Normal si vous avez déjà des données de test
- Le script utilise `ON CONFLICT DO NOTHING` pour éviter les doublons

## Vérification Finale

Exécutez cette requête pour vérifier que tout est en place :

```sql
-- Compte des objets créés
SELECT
  'Tables' AS type,
  COUNT(*) AS nombre
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'artisan_ventes_or',
  'artisan_factures_definitives',
  'artisan_paiements',
  'artisan_taxes_retenues'
)

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

-- Résultat attendu :
-- Tables: 4
-- Fonctions: 5+
-- Vues: 4+
```

## Prochaines Étapes

Une fois l'installation terminée :

1. **Accédez au module dans l'application :**
   - Menu : Or Artisanal → Paiements des Ventes

2. **Créez une première vente :**
   - Menu : Or Artisanal → Ventes d'Or → Nouvelle Vente
   - Validez la vente pour générer une facture automatiquement

3. **Effectuez un paiement :**
   - La vente validée apparaîtra dans "Paiements en attente"
   - Cliquez sur "Payer" pour enregistrer un paiement

4. **Consultez les statistiques :**
   - Dashboard des paiements
   - Taxes retenues
   - Historique complet

## Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs dans l'éditeur SQL de Supabase
2. Consultez la documentation : `scripts/README-MODULE-PAIEMENTS-ARTISANS.md`
3. Vérifiez que toutes les dépendances sont installées
4. Assurez-vous d'être connecté avec un compte administrateur

---

**Date de création :** 28 décembre 2024
**Version :** 1.0.0
**Auteur :** SONASP Development Team
