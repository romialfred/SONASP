# Système de Statuts et Suivi des Productions

## Vue d'ensemble

Le système de production journalière a été enrichi avec un workflow de statuts complet, un système de traçabilité des changements, et une page de détails améliorée pour chaque production.

## Workflow de Statuts

### États Disponibles

1. **Prepared (Préparé)** - Statut initial lors de la création
   - Production créée et prête pour expédition
   - Couleur: Bleu

2. **Shipped (Expédié)** - Production expédiée
   - Production expédiée vers la raffinerie
   - Couleur: Orange

3. **Refined (Raffiné)** - Production raffinée
   - Production raffinée et prête pour la vente
   - Couleur: Violet

4. **Sold (Vendu)** - Statut final
   - Production vendue au client
   - Couleur: Vert

### Règles de Transition

- **Progression linéaire uniquement** : Prepared → Shipped → Refined → Sold
- **Pas de retour en arrière** : Les statuts ne peuvent que progresser
- **Transition par étape** : On ne peut sauter aucune étape

## Fonctionnalités Implémentées

### 1. Système de Statuts

**Fichiers créés:**
- `src/constants/productionStatuses.ts` - Définitions et règles des statuts
- `src/services/productionStatusService.ts` - Service de gestion des statuts
- `src/components/production/ProductionStatusBadge.tsx` - Badge de statut visuel
- `src/components/production/ProductionStatusWorkflow.tsx` - Widget de workflow

**Fonctionnalités:**
- Badges colorés pour visualisation rapide
- Validation des transitions autorisées
- Messages d'erreur si transition non autorisée

### 2. Traçabilité Complète

**Table database: `production_status_history`**
```sql
CREATE TABLE production_status_history (
  id uuid PRIMARY KEY,
  production_id uuid REFERENCES daily_production(id),
  old_status production_status,
  new_status production_status NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now(),
  notes text,
  metadata jsonb
);
```

**Fonctionnalités:**
- Enregistrement automatique de chaque changement de statut
- Horodatage précis de chaque changement
- Identification de l'utilisateur ayant effectué le changement
- Notes optionnelles pour justifier les changements
- Historique complet consultable

### 3. Page de Détails de Production

**Route:** `/production/:id`

**Sections de la page:**

#### A. En-tête
- Titre avec numéro de batch
- Badge de statut actuel (grand format avec icône)
- Boutons d'action: Retour et Modifier

#### B. Colonne Principale (Gauche)

**Détails de Production:**
- Date de production
- Mining company
- Bar reference
- Finesse estimée
- Poids et conversions (Bullion, Pure Gold)
- Calculs automatiques affichés
- Notes (si présentes)

**Workflow de Statut:**
- Visualisation du flow complet avec états
- État actuel mis en évidence
- Bouton "Passer à l'état suivant"
- Option d'ajouter des notes lors du changement
- Confirmation visuelle après mise à jour

**Documents Attachés:**
- Liste des documents PDF
- Actions: Voir, Télécharger, Supprimer
- Bouton "Ajouter un Document"

#### C. Colonne Latérale (Droite)

**Historique des Changements:**
- Timeline chronologique inversée (plus récent en haut)
- Pour chaque changement:
  - Badges de transition (ancien → nouveau statut)
  - Date et heure précises
  - Email de l'utilisateur
  - Notes si présentes
- Point de timeline coloré pour chaque événement

### 4. Table de Production Améliorée

**Nouvelles colonnes:**
- **Statut** - Badge avec icône et couleur
- **Actions** - Bouton "Voir détails" ajouté (icône œil)

**Fonctionnalités:**
- Clic sur l'œil pour voir les détails complets
- Clic sur le crayon pour modifier (formulaire existant)
- Clic sur la poubelle pour supprimer (avec confirmation)

### 5. Onglets de Filtrage

**Fonctionnalités:**
- Onglet "Toutes les Sociétés" avec compteur global
- Un onglet par mining company avec nom complet
- Compteur par onglet (nombre de productions)
- Filtrage automatique des métriques, graphiques et tableau
- Design moderne avec indicateurs visuels

## Installation et Configuration

### 1. Appliquer la Migration Database

Exécutez dans Supabase SQL Editor:
```bash
supabase/migrations/add_production_status_tracking.sql
```

Cette migration:
- Crée le type ENUM `production_status`
- Ajoute la colonne `status` à `daily_production`
- Crée la table `production_status_history`
- Met en place les triggers automatiques
- Configure les politiques RLS
- Initialise les productions existantes à 'prepared'

### 2. Permissions RLS

Les politiques suivantes sont automatiquement créées:

**production_status_history:**
- SELECT: Tous les utilisateurs authentifiés
- INSERT: Utilisateur authentifié (doit être l'auteur du changement)

### 3. Fonction RPC

**`get_production_status_history(prod_id uuid)`**
- Retourne l'historique complet d'une production
- Inclut les informations utilisateur (email)
- Ordonne par date décroissante

## Utilisation

### Créer une Nouvelle Production

1. Aller sur `/production/daily`
2. Cliquer "Nouvelle Production"
3. Remplir le formulaire
4. Soumettre
5. La production est créée avec le statut "Prepared"
6. Un premier enregistrement est ajouté à l'historique

### Consulter les Détails

1. Dans le tableau, cliquer sur l'icône œil (👁️)
2. La page de détails s'ouvre
3. Toutes les informations sont affichées
4. L'historique montre la création initiale

### Changer le Statut

1. Sur la page de détails
2. Section "Workflow de Statut"
3. Le flow visuel montre la progression
4. Cliquer "Passer à: [Statut Suivant]"
5. Option: Cliquer "Ajouter des notes" pour justifier
6. Confirmer
7. Le statut est mis à jour
8. L'historique enregistre automatiquement le changement

### Filtrer par Société

1. Sur `/production/daily`
2. Les onglets apparaissent sous l'en-tête
3. Cliquer sur un onglet de société
4. Tous les widgets se filtrent automatiquement:
   - Métriques (cartes KPI)
   - Graphique de production
   - Tableau historique

### Consulter l'Historique

1. Page de détails → colonne de droite
2. Historique chronologique complet
3. Pour chaque changement:
   - Transition visualisée (ancien → nouveau)
   - Horodatage précis
   - Qui a fait le changement
   - Notes éventuelles

## Structure des Fichiers

### Nouveaux Fichiers

```
src/
├── constants/
│   └── productionStatuses.ts              # Définitions des statuts
├── services/
│   └── productionStatusService.ts         # Service de gestion
├── components/
│   └── production/
│       ├── ProductionStatusBadge.tsx      # Badge de statut
│       └── ProductionStatusWorkflow.tsx   # Widget de workflow
└── pages/
    └── production/
        └── ProductionDetails.tsx          # Page de détails complète

supabase/
└── migrations/
    └── add_production_status_tracking.sql # Migration database
```

### Fichiers Modifiés

```
src/
├── App.tsx                                # Ajout route /production/:id
├── services/
│   └── dailyProductionService.ts          # Ajout champ status
└── components/
    └── production/
        ├── ProductionTable.tsx            # Colonne statut + bouton détails
        └── ...
```

## Tests Recommandés

### Test du Workflow

1. Créer une production (statut: Prepared)
2. Vérifier le badge bleu dans le tableau
3. Ouvrir les détails
4. Vérifier que le workflow montre Prepared actif
5. Cliquer "Passer à: Expédié"
6. Ajouter une note: "Expédition effectuée le [date]"
7. Confirmer
8. Vérifier que le badge devient orange
9. Vérifier que l'historique montre la transition
10. Répéter pour Refined et Sold

### Test de Validation

1. Essayer de créer une production manuellement en SQL avec status 'refined'
2. Vérifier qu'on peut seulement passer de refined à sold
3. Essayer via l'API de passer directement de prepared à sold
4. Vérifier que c'est rejeté avec erreur

### Test des Filtres

1. Créer 3 productions pour 3 sociétés différentes
2. Vérifier que les onglets affichent les bons compteurs
3. Cliquer sur un onglet
4. Vérifier que seules les productions de cette société apparaissent
5. Vérifier que les métriques sont filtrées

### Test de l'Historique

1. Créer une production
2. Changer le statut 3 fois (avec notes différentes)
3. Consulter l'historique
4. Vérifier 4 entrées: création + 3 changements
5. Vérifier que les dates sont correctes
6. Vérifier que l'email de l'utilisateur apparaît

## Schéma de la Base de Données

### Table: daily_production

Colonne ajoutée:
```sql
status production_status DEFAULT 'prepared' NOT NULL
```

### Table: production_status_history

```sql
id              uuid PRIMARY KEY
production_id   uuid → daily_production(id)
old_status      production_status (nullable)
new_status      production_status NOT NULL
changed_by      uuid → auth.users(id)
changed_at      timestamptz DEFAULT now()
notes           text (nullable)
metadata        jsonb DEFAULT '{}'
```

### Indexes

```sql
idx_daily_production_status
idx_daily_production_mining_company_status
idx_production_status_history_production_id
idx_production_status_history_changed_at
```

## Considérations de Performance

- **Indexes** : Optimisent les requêtes par statut
- **RPC Function** : Requête optimisée avec JOIN pour l'historique
- **Lazy Loading** : Historique chargé seulement sur demande
- **Caching** : Les statuts sont en mémoire (constantes)

## Sécurité

- **RLS activé** sur toutes les tables
- **Triggers SECURITY DEFINER** pour garantir l'intégrité
- **Validation côté serveur** des transitions
- **Audit trail immuable** (INSERT only)
- **User tracking** automatique via auth.uid()

## Maintenance

### Consulter les Statistiques

```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(estimated_oz) as avg_oz
FROM daily_production
GROUP BY status;
```

### Consulter les Changements Récents

```sql
SELECT
  p.bar_reference,
  psh.old_status,
  psh.new_status,
  psh.changed_at,
  u.email
FROM production_status_history psh
JOIN daily_production p ON p.id = psh.production_id
JOIN auth.users u ON u.id = psh.changed_by
WHERE psh.changed_at > NOW() - INTERVAL '7 days'
ORDER BY psh.changed_at DESC;
```

### Corriger un Statut (Cas Exceptionnel)

**Attention:** Normalement les statuts ne doivent être modifiés que via le workflow.

```sql
-- Backup d'abord
SELECT * FROM production_status_history WHERE production_id = '<uuid>';

-- Correction
UPDATE daily_production
SET status = 'prepared'
WHERE id = '<uuid>';
```

## Support et Dépannage

### Erreur: "Transition non autorisée"

**Cause:** Tentative de sauter une étape ou de revenir en arrière.
**Solution:** Respecter le flow: Prepared → Shipped → Refined → Sold.

### L'historique ne s'affiche pas

**Vérifications:**
1. La migration a été appliquée
2. Les triggers sont actifs: `\d daily_production` dans psql
3. Les permissions RLS sont correctes

### Le statut ne se met pas à jour

**Vérifications:**
1. L'utilisateur est authentifié
2. La production existe
3. Le statut actuel permet la transition demandée
4. Consulter les logs Supabase pour les erreurs

## Roadmap Future

Améliorations possibles:
- Notifications push lors des changements de statut
- Export PDF avec historique complet
- Dashboard de suivi des statuts en temps réel
- Statistiques de temps moyen par étape
- Alertes si une production reste trop longtemps dans un statut
