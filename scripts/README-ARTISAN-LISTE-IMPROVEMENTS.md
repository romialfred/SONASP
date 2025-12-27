# Améliorations de la Liste des Artisans Miniers

## Vue d'ensemble

Cette amélioration transforme la liste des artisans miniers avec de nouvelles fonctionnalités professionnelles incluant deux modes d'affichage, des filtres avancés, et des métriques commerciales.

## Nouvelles Fonctionnalités

### 1. Deux Modes d'Affichage

#### Mode Tuiles (Grid View)
- Cartes professionnelles inspirées des cartes d'artisan minier
- En-tête coloré avec dégradé vert émeraude
- Affichage compact et visuel des informations
- Métriques commerciales en bas de chaque carte

#### Mode Table (Table View)
- Table structurée avec colonnes bien définies
- En-tête coloré avec dégradé vert émeraude
- Lignes alternées (blanc/gris) pour faciliter la lecture
- Colonnes optimisées pour afficher toutes les informations importantes

### 2. Filtres Avancés

Le système inclut maintenant 4 filtres combinables :

- **Région** : Filtre par région géographique
- **Genre** : Masculin, Féminin, Autre
- **Type d'artisan** : Exploitant, Collecteur, Intermédiaire, Fournisseur
- **Pays** : Filtre par pays (Burkina Faso, Mali, etc.)

Fonctionnalités des filtres :
- Badge indiquant le nombre de filtres actifs
- Bouton "Effacer les filtres" pour réinitialiser
- Les filtres sont persistants pendant la session

### 3. Nouvelles Métriques Commerciales

Deux nouvelles métriques ajoutées pour chaque artisan :

- **Quantité d'Or Vendu** : Affichée en grammes (g)
- **Chiffre d'Affaires** : Affiché en FCFA

Ces métriques sont visibles dans les deux modes d'affichage.

### 4. Interface Optimisée

- Tailles de police réduites pour un aspect plus professionnel
- Espacement et padding optimisés
- Icônes plus petites et cohérentes
- Couleurs adaptées selon le type d'artisan

## Configuration de la Base de Données

### ⚠️ Important : Erreur Corrigée

Le script a été **corrigé** pour résoudre un problème de casse dans les noms de tables PostgreSQL.

**Problème identifié** : Incohérence entre `"SNP_artisans_miniers"` (avec guillemets et majuscules) et `snp_artisans_miniers` (minuscules sans guillemets).

**Solution** : Le script utilise maintenant systématiquement `snp_artisans_miniers` (tout en minuscules, sans guillemets), conformément aux conventions PostgreSQL.

📖 **Voir** : `GUIDE-POSTGRESQL-NAMING.md` pour comprendre comment éviter ce type d'erreur à l'avenir.

### Colonnes Requises

Pour afficher les métriques commerciales, vous devez exécuter le script SQL fourni :

**Fichier** : `scripts/ADD-ARTISAN-METRICS-COLUMNS.sql`

### Étapes d'Installation

1. **Ouvrir Supabase SQL Editor**
   - Connectez-vous à votre projet Supabase
   - Naviguez vers l'onglet "SQL Editor"

2. **Copier le Script**
   - Ouvrez le fichier `ADD-ARTISAN-METRICS-COLUMNS.sql`
   - Copiez tout le contenu

3. **Exécuter le Script**
   - Collez le contenu dans l'éditeur SQL
   - Cliquez sur "Run" pour exécuter
   - ✅ Le script devrait maintenant s'exécuter sans erreur

### Colonnes Ajoutées

Le script ajoute les colonnes suivantes à la table `snp_artisans_miniers` :

| Colonne | Type | Description |
|---------|------|-------------|
| `quantite_or_vendu_grammes` | numeric(12,3) | Quantité totale d'or vendu en grammes |
| `chiffre_affaires_fcfa` | numeric(15,2) | Chiffre d'affaires total en FCFA |
| `nombre_transactions` | integer | Nombre de transactions effectuées |
| `derniere_transaction_date` | date | Date de la dernière transaction |

### Index Créés

Pour optimiser les performances, le script crée automatiquement :
- Index sur le chiffre d'affaires (pour tri et classement)
- Index sur la date de dernière transaction (pour suivi d'activité)
- Index composite pour filtres combinés

### Fonction de Mise à Jour

Une fonction `update_artisan_metrics()` est créée pour faciliter la mise à jour des métriques :

```sql
SELECT update_artisan_metrics(
  'uuid-de-l-artisan',
  quantite_grammes,
  montant_fcfa
);
```

## Utilisation

### Basculer Entre les Vues

- Cliquez sur l'icône **Grille** (LayoutGrid) pour le mode tuiles
- Cliquez sur l'icône **Liste** (LayoutList) pour le mode table

### Utiliser les Filtres

1. Cliquez sur le bouton **Filtrer**
2. Sélectionnez vos critères dans les listes déroulantes
3. Les résultats se filtrent automatiquement
4. Cliquez sur **Effacer les filtres** pour réinitialiser

### Navigation

- Cliquez sur n'importe quelle carte ou ligne pour éditer un artisan
- La recherche fonctionne sur : nom, prénom, raison sociale, n° carte, téléphone

## Structure des Couleurs

### Types d'Artisan

- **Exploitant** : Bleu (`bg-blue-100 text-blue-700`)
- **Collecteur** : Violet (`bg-purple-100 text-purple-700`)
- **Intermédiaire** : Orange (`bg-orange-100 text-orange-700`)
- **Fournisseur** : Turquoise (`bg-teal-100 text-teal-700`)

### En-têtes

- Dégradé vert émeraude : `from-emerald-600 to-emerald-700`
- Texte blanc pour contraste optimal

### Table

- Lignes paires : Blanc (`bg-white`)
- Lignes impaires : Gris clair (`bg-gray-50`)
- Hover : Vert émeraude clair (`hover:bg-emerald-50`)

## Données de Test (Optionnel)

Le script SQL inclut une section optionnelle pour générer des données de test.

Pour activer les données de test :
1. Décommentez la section "Données de test" à la fin du script
2. Exécutez le script
3. 10 artisans aléatoires seront mis à jour avec des métriques fictives

Pour désactiver :
- Commentez ou supprimez cette section avant d'exécuter

## Compatibilité

- ✅ Desktop : Affichage optimal sur tous les écrans
- ✅ Tablet : Vue adaptée avec colonnes réduites
- ✅ Mobile : Vue tuiles par défaut, table responsive

## Support

Pour toute question ou problème :
1. Vérifiez que le script SQL a été exécuté correctement
2. Vérifiez les logs de la console pour les erreurs
3. Assurez-vous que les politiques RLS sont correctement configurées

## Notes Techniques

### Optimisations

- Les listes déroulantes de filtres sont générées dynamiquement à partir des données
- Les valeurs uniques sont triées alphabétiquement
- Les filtres peuvent être combinés pour des recherches précises

### Performance

- Index créés pour optimiser les requêtes fréquentes
- Composants optimisés pour éviter les re-renders inutiles
- Chargement paresseux pour les grandes listes (à implémenter si nécessaire)

### Sécurité

- Toutes les opérations respectent les politiques RLS existantes
- Les métriques sont en lecture seule pour les utilisateurs standard
- Fonction `update_artisan_metrics()` en mode SECURITY DEFINER
