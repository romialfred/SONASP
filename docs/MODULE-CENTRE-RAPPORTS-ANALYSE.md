# Module Centre de Rapports & Analyse - Documentation Complète

## Vue d'ensemble

Le module **Centre de Rapports & Analyse** est un système complet de reporting et d'analyse des données pour le suivi des ventes d'or artisanal. Ce module est spécialement conçu pour les Ministères des Finances et des Mines afin d'assurer un suivi rigoureux des activités minières artisanales.

## Objectifs du Module

- Fournir une vue d'ensemble des indicateurs clés de performance (KPI)
- Générer des rapports détaillés sur les chiffres d'affaires
- Analyser les quantités d'or par type (Poudre, Lingot, etc.)
- Suivre les taxes et royalties générées
- Permettre l'export de données pour analyse externe
- Offrir des visualisations graphiques interactives

## Architecture du Module

### 1. Service d'Analyse des Données

**Fichier:** `src/services/artisanAnalyticsService.ts`

Le service principal qui gère toutes les requêtes d'analyse et d'agrégation des données :

#### Méthodes Principales

- `getIndicateursCles()` - Récupère les indicateurs clés de performance
- `getChiffreAffairesParRegion()` - Analyse du CA par région
- `getChiffreAffairesParArtisan()` - Analyse du CA par artisan
- `getChiffreAffairesParMois()` - Évolution mensuelle du CA
- `getChiffreAffairesParTrimestre()` - Analyse trimestrielle
- `getChiffreAffairesParAnnee()` - Comparaison annuelle
- `getQuantiteParType()` - Répartition des quantités par type d'or
- `getRapportTaxesRoyalties()` - Analyse des taxes et royalties
- `exporterRapportExcel()` - Export des rapports au format Excel

#### Types de Données

```typescript
interface IndicateursCles {
  total_ventes: number;
  total_artisans_actifs: number;
  quantite_totale_grammes: number;
  quantite_totale_onces: number;
  chiffre_affaires_total: number;
  taxes_total: number;
  royalties_total: number;
  prix_moyen_gramme: number;
  ventes_en_attente: number;
  montant_en_attente: number;
}
```

### 2. Pages et Interfaces

#### 2.1 Centre de Rapports Principal

**Fichier:** `src/pages/artisan-minier/CentreRapportsAnalyse.tsx`

**Fonctionnalités:**
- Tableau de bord avec 6 indicateurs clés
- Filtrage par période (date début/fin)
- Graphiques interactifs :
  - Chiffre d'affaires par région (Bar Chart)
  - Répartition par type d'or (Pie Chart)
  - Évolution mensuelle (Line Chart)
- Navigation rapide vers les rapports détaillés

**Indicateurs Affichés:**
1. Total des ventes (avec ventes en attente)
2. Chiffre d'affaires total (avec montant en attente)
3. Quantité d'or totale (grammes et onces)
4. Nombre d'artisans actifs (avec prix moyen/gramme)
5. Taxes totales collectées
6. Royalties totales (3% des taxes)

#### 2.2 Rapport Chiffre d'Affaires

**Fichier:** `src/pages/artisan-minier/RapportChiffreAffaires.tsx`

**Types de Rapports:**
- **Par Région** : Analyse comparative entre régions
- **Par Artisan** : Top 20 des artisans (filtrable par région)
- **Mensuel** : Évolution mois par mois pour une année
- **Trimestriel** : Analyse par trimestre
- **Annuel** : Comparaison sur 5 ans

**Données Affichées:**
- Nombre de ventes
- Nombre d'artisans actifs
- Quantité totale (grammes)
- Chiffre d'affaires brut
- Taxes totales
- Chiffre d'affaires net

**Visualisations:**
- Graphiques en barres comparatifs
- Tableaux détaillés avec totaux
- Export Excel

#### 2.3 Rapport Quantités

**Fichier:** `src/pages/artisan-minier/RapportQuantites.tsx`

**Fonctionnalités:**
- Analyse des quantités par type d'or
- Calcul des pourcentages de répartition
- Prix moyen par gramme par type

**Indicateurs:**
- Total des ventes
- Quantité en grammes
- Quantité en onces
- Valeur totale

**Visualisations:**
- Graphique circulaire (Pie Chart) avec pourcentages
- Graphique en barres comparatif
- Tableau détaillé avec codes couleur

#### 2.4 Rapport Taxes & Royalties

**Fichier:** `src/pages/artisan-minier/RapportTaxesRoyalties.tsx`

**Groupements de Données:**
- Par mois
- Par trimestre
- Par année

**Métriques Calculées:**
- Chiffre d'affaires total
- TVA (18%)
- Retenue à la source (1,5%)
- Autres taxes
- Total des taxes
- Royalties (3% des taxes)
- Taux de taxation effectif

**Visualisations:**
- Graphique en aires empilées (Stacked Area Chart)
- Comparaison CA vs Taxes (Bar Chart)
- Évolution du nombre de factures (Line Chart)
- Récapitulatif global avec taux moyens

## Flux de Navigation

```
Menu Artisans Miniers
└── Centre de Rapports & Analyse (/artisan-minier/rapports)
    ├── Rapports CA (/artisan-minier/rapports/chiffre-affaires)
    ├── Rapports Quantités (/artisan-minier/rapports/quantites)
    └── Rapports Taxes (/artisan-minier/rapports/taxes)
```

## Filtres et Paramètres

### Filtres Disponibles

1. **Période** : Date début et date fin
2. **Type de rapport** : Région, Artisan, Mensuel, Trimestriel, Annuel
3. **Année** : Sélection d'année pour les rapports temporels
4. **Région** : Filtrage par région spécifique (rapports par artisan)
5. **Groupement** : Mois, Trimestre, Année (taxes)

### Paramètres par Défaut

- Date début : 1er janvier de l'année en cours
- Date fin : Date du jour
- Type : Par région
- Année : Année en cours

## Exports de Données

### Format Excel

Tous les rapports peuvent être exportés au format Excel (.xlsx) avec :
- En-têtes de colonnes
- Données formatées
- Nom de fichier descriptif incluant le type et la période

### Exemple de Noms de Fichiers

- `rapport_ca_region_2025.xlsx`
- `rapport_quantites_2025-01-01_2025-12-31.xlsx`
- `rapport_taxes_mois_2025-01-01_2025-12-31.xlsx`

## Graphiques et Visualisations

Le module utilise **Recharts** pour les visualisations :

### Types de Graphiques

1. **BarChart** : Comparaisons de chiffres d'affaires
2. **PieChart** : Répartition des quantités par type
3. **LineChart** : Évolutions temporelles
4. **AreaChart** : Composition des taxes

### Palette de Couleurs

```javascript
const COLORS = [
  '#B8860B', // Or (Deep Gold)
  '#475569', // Bleu Ardoise (Slate Blue)
  '#10B981', // Vert Émeraude (Emerald Green)
  '#3B82F6', // Bleu
  '#EF4444', // Rouge
  '#F59E0B'  // Orange
];
```

## Calculs et Formules

### Taxes

- **TVA** : 18% du montant brut
- **Retenue à la source** : 1,5% du montant brut
- **Royalties** : 3% du total des taxes

### Conversions

- **Onces** : grammes ÷ 31.1035
- **Prix moyen/gramme** : montant total ÷ quantité totale (grammes)

### Taux de Taxation

```
Taux effectif = (Total taxes ÷ CA total) × 100
```

## Sécurité et Permissions

### Contrôle d'Accès

Le module est protégé par le système `ProtectedRoute` et nécessite :
- Authentification utilisateur
- Rôle approprié (Ministère, Management)

### Protection des Données

- Row Level Security (RLS) sur les tables Supabase
- Requêtes filtrées par permissions utilisateur
- Validation des dates et périodes

## Performances

### Optimisations

1. **Agrégations côté serveur** : Les calculs sont effectués dans Supabase
2. **Chargement paresseux** : Les données sont chargées à la demande
3. **Mise en cache** : Utilisation de `useEffect` avec dépendances
4. **Pagination** : Top 20 pour les rapports par artisan

### Requêtes Optimisées

- Utilisation de `SELECT` spécifiques
- Jointures efficaces avec les tables artisans
- Filtrage au niveau SQL

## Tables Supabase Utilisées

1. `artisan_ventes_or` : Ventes d'or
2. `artisans_miniers` : Informations artisans
3. `artisan_factures_definitives` : Factures et taxes

## Installation et Configuration

### Prérequis

- React 18+
- Vite
- Supabase
- Recharts
- XLSX (pour exports Excel)

### Dépendances

```json
{
  "recharts": "^3.3.0",
  "xlsx": "^0.18.5"
}
```

### Configuration Supabase

Les tables nécessaires doivent exister avec les colonnes appropriées. Les migrations sont disponibles dans `/scripts`.

## Utilisation

### Accès au Module

1. Connectez-vous à l'application
2. Naviguez vers "Artisans Miniers" dans le menu
3. Cliquez sur "Centre de Rapports & Analyse"

### Génération de Rapport

1. Sélectionnez les filtres désirés
2. Cliquez sur "Actualiser" pour charger les données
3. Consultez les graphiques et tableaux
4. Cliquez sur "Exporter Excel" pour télécharger

### Navigation entre Rapports

Utilisez les boutons de navigation rapide ou les liens dans le menu pour accéder aux différents types de rapports.

## Support et Maintenance

### Logs et Débogage

Tous les services incluent des logs console en cas d'erreur :

```typescript
catch (error) {
  console.error('Erreur getIndicateursCles:', error);
  throw error;
}
```

### Messages d'Erreur

Les erreurs sont capturées et affichées à l'utilisateur via le système de notifications.

## Évolutions Futures

### Fonctionnalités Planifiées

1. Export PDF avec graphiques
2. Rapports programmés par email
3. Comparaisons multi-périodes
4. Filtres avancés par type d'or
5. Tableaux de bord personnalisables
6. Alertes et notifications automatiques

### Améliorations Techniques

1. Cache Redis pour les données agrégées
2. Mise à jour en temps réel (WebSocket)
3. Rapports interactifs avec drill-down
4. API REST pour intégrations externes

## Conformité et Réglementations

Ce module est conçu pour répondre aux exigences de :
- Ministère des Finances (suivi fiscal)
- Ministère des Mines (production et quotas)
- Traçabilité LBMA (London Bullion Market Association)
- Normes de l'OCDE pour la chaîne d'approvisionnement

## Glossaire

- **CA** : Chiffre d'affaires
- **KPI** : Key Performance Indicator (Indicateur clé de performance)
- **RLS** : Row Level Security
- **TVA** : Taxe sur la valeur ajoutée
- **Royalties** : Redevances minières

## Contact et Support Technique

Pour toute question ou problème technique, contactez l'équipe de développement avec les détails suivants :
- Module concerné : Centre de Rapports & Analyse
- Version : 1.0.0
- Date de déploiement : 28 décembre 2025

---

**Dernière mise à jour** : 28 décembre 2025
**Version** : 1.0.0
**Auteur** : Équipe de Développement Gold Shipper
