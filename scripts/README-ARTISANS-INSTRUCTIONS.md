# Instructions pour Activer les Données des Artisans Miniers

## ✅ Ce qui a été fait

### 1. Pages Mises à Jour avec Vraies Données

Toutes les pages suivantes affichent maintenant de vraies données depuis la base de données :

- ✅ **Page Validation des Cartes** (`/artisan-minier/cartes/validation`)
  - Affiche les cartes "en_cours" en attente de validation
  - Bouton "Valider" fonctionnel
  - Statistiques en temps réel

- ✅ **Page Suivi des Cartes** (`/artisan-minier/cartes/suivi`)
  - Cartes actives en exploitation
  - Activités récentes (10 dernières transactions)
  - Top 5 artisans par volume de ventes

- ✅ **Page Expirations** (`/artisan-minier/cartes/expirations`)
  - Cartes expirées
  - Cartes expirant dans 7, 30, et 60 jours
  - Interface avec tabs interactifs

### 2. Script SQL Créé

Un script SQL complet a été créé : `/scripts/generate-cartes-statuts.sql`

Ce script génère :
- 20 cartes professionnelles avec statuts diversifiés
- 3 cartes "en_cours" (en attente)
- 5 cartes "validee"
- 8 cartes "en_exploitation" (avec dates d'expiration variées)
- 2 cartes "expiree"
- 2 cartes "suspendue"
- Environ 30 activités (ventes, collectes, dépôts)
- Statistiques mensuelles pour les cartes actives

## 🚀 Étapes pour Activer les Données

### Étape 1: Exécuter le Script SQL

1. Ouvrez votre projet Supabase : https://supabase.com/dashboard
2. Allez dans **SQL Editor**
3. Copiez tout le contenu du fichier `/scripts/generate-cartes-statuts.sql`
4. Collez-le dans l'éditeur SQL
5. Cliquez sur **Run** pour exécuter

**Résultat attendu** : Vous verrez un message de confirmation avec le résumé des cartes créées.

### Étape 2: Vérifier les Données

Après l'exécution du script, vérifiez que les données sont bien créées :

```sql
-- Vérifier les cartes
SELECT statut, COUNT(*) as total
FROM snp_cartes_professionnelles
GROUP BY statut;

-- Vérifier les activités
SELECT type_activite, COUNT(*) as total
FROM snp_artisan_activities
GROUP BY type_activite;

-- Vérifier les statistiques
SELECT COUNT(*) as total
FROM snp_carte_statistics;
```

### Étape 3: Accéder aux Pages

Toutes les pages sont maintenant fonctionnelles :

1. **Tableau de Bord** : `/artisan-minier/dashboard`
   - Affichera les statistiques globales
   - Graphiques avec données réelles

2. **Liste des Artisans** : `/artisan-minier/liste`
   - 20 artisans du Burkina Faso
   - Recherche fonctionnelle

3. **Validation des Cartes** : `/artisan-minier/cartes/validation`
   - 3 cartes en attente de validation
   - Bouton "Valider" fonctionnel

4. **Suivi des Cartes** : `/artisan-minier/cartes/suivi`
   - Activités récentes
   - Top 5 artisans performants

5. **Expirations** : `/artisan-minier/cartes/expirations`
   - Cartes expirées et à expirer
   - Interface avec filtres par période

## 📊 Données Générées

### Distribution des Statuts

- **En cours** (en attente de validation) : 3 cartes
- **Validée** (validées, pas encore utilisées) : 5 cartes
- **En exploitation** (cartes actives) : 8 cartes
- **Expirée** : 2 cartes
- **Suspendue** : 2 cartes

### Dates d'Expiration

Pour tester les alertes d'expiration :
- 2 cartes expirant dans 5-15 jours (alerte haute)
- 2 cartes expirant dans 25-45 jours (alerte moyenne)
- 2 cartes expirant dans 55 jours (alerte faible)
- 2 cartes déjà expirées

### Activités et Statistiques

- ~30 activités (ventes, collectes, dépôts)
- Statistiques mensuelles pour les cartes en exploitation
- Montants réalistes (500k - 5M FCFA)
- Quantités d'or réalistes (50-500 grammes)

## 🔧 Corrections Apportées

### 1. Noms de Tables

Tous les services ont été corrigés pour utiliser les noms de tables en minuscules :
- `SNP_artisans_miniers` → `snp_artisans_miniers`
- `SNP_cartes_professionnelles` → `snp_cartes_professionnelles`
- `SNP_artisan_activities` → `snp_artisan_activities`
- `SNP_carte_statistics` → `snp_carte_statistics`

### 2. Pages Réécrites

Les 3 pages suivantes ont été complètement réécrites pour utiliser de vraies données :
- `CarteValidation.tsx` - Gestion des validations
- `CarteExpirations.tsx` - Suivi des expirations
- `CarteSuivi.tsx` - Statistiques et activités

## ⚠️ Important

### Prochaines Étapes Recommandées

1. **Améliorer la Liste des Artisans** (à faire ensuite)
   - Ajouter vue Table détaillée
   - Ajouter vue Tuiles
   - Afficher statistiques de vente pour chaque artisan

2. **Implémenter Fonctionnalités Manquantes**
   - Renouvellement de cartes
   - Suspension/Réactivation
   - Export PDF des cartes
   - Génération QR Code

3. **Tests Utilisateur**
   - Valider une carte
   - Vérifier les alertes d'expiration
   - Tester la recherche d'artisans

## 🐛 En cas de Problème

### Les pages sont toujours vides ?

1. Vérifiez que le script SQL a bien été exécuté
2. Vérifiez dans Supabase Table Editor que les tables contiennent des données
3. Vérifiez la console du navigateur (F12) pour les erreurs
4. Vérifiez que les politiques RLS autorisent la lecture des données

### Erreurs dans la console ?

Si vous voyez des erreurs SQL, c'est probablement :
- Les tables n'existent pas encore → Exécutez les migrations
- Les politiques RLS bloquent l'accès → Vérifiez les policies
- Les relations ne sont pas correctes → Vérifiez les foreign keys

## 📝 Notes pour le Développement Futur

### Structure de la Base de Données

```
snp_artisans_miniers
├── id (uuid, PK)
├── numero_carte (text, unique)
├── type_personne (physique/morale)
├── type_artisan (exploitant/collecteur/intermediaire/fournisseur)
├── nom, prenoms (pour physique)
├── raison_sociale (pour morale)
└── ... (autres champs)

snp_cartes_professionnelles
├── id (uuid, PK)
├── artisan_id (FK → snp_artisans_miniers)
├── numero_carte (text)
├── statut (en_cours/validee/en_exploitation/expiree/suspendue)
├── date_delivrance, date_expiration
└── ... (autres champs)

snp_artisan_activities
├── id (uuid, PK)
├── artisan_id (FK)
├── carte_id (FK)
├── type_activite (vente/collecte/depot)
├── montant, quantite_grammes
└── created_at

snp_carte_statistics
├── id (uuid, PK)
├── carte_id (FK)
├── artisan_id (FK)
├── annee, mois
├── nombre_ventes, montant_total_ventes
├── quantite_totale_grammes
└── ...
```

---

**Dernière mise à jour** : 27 décembre 2025
**Auteur** : Claude (Assistant IA)
**Version** : 1.0.0
