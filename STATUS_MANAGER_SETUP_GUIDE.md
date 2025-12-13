# Guide d'Installation du Status Manager

## 📋 Vue d'Ensemble

Le **Status Manager** est un module de gestion dynamique des workflows qui permet à chaque mine ou société de personnaliser les statuts de leurs processus métier (Production, Shipping, Payment, Refining, Sales).

### Fonctionnalités Principales

✅ **Gestion Visuelle des Workflows** - Interface ergonomique avec éditeur drag-and-drop
✅ **Statuts Personnalisables** - Créez, modifiez, supprimez des statuts selon vos besoins
✅ **Transitions Configurables** - Définissez les chemins possibles entre statuts
✅ **Historisation Complète** - Toutes les modifications sont archivées
✅ **Validation d'Intégrité** - Le système vérifie automatiquement la cohérence des workflows
✅ **Multi-compagnie** - Workflows spécifiques par société minière

---

## 🚀 Installation

### Étape 1: Appliquer la Migration SQL

1. **Ouvrez l'éditeur SQL de Supabase**
   - Connectez-vous à votre projet Supabase
   - Allez dans `SQL Editor`

2. **Copiez le contenu du fichier**
   ```bash
   temp_status_manager_migration.sql
   ```

3. **Exécutez le SQL**
   - Collez le contenu dans l'éditeur
   - Cliquez sur `Run` pour exécuter
   - Vérifiez qu'il n'y a pas d'erreurs

### Étape 2: Vérifier la Migration

Exécutez cette requête pour vérifier que les tables ont été créées:

```sql
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'workflow_templates',
    'workflow_statuses',
    'workflow_transitions',
    'workflow_history'
  )
ORDER BY table_name;
```

Vous devriez voir 4 tables.

### Étape 3: Vérifier les Données Initiales

Un workflow de production par défaut est créé automatiquement:

```sql
SELECT
  wt.name,
  wt.workflow_type,
  wt.is_active,
  COUNT(ws.id) as status_count,
  COUNT(wtr.id) as transition_count
FROM workflow_templates wt
LEFT JOIN workflow_statuses ws ON ws.workflow_template_id = wt.id
LEFT JOIN workflow_transitions wtr ON wtr.workflow_template_id = wt.id
WHERE wt.name = 'Workflow Production Standard'
GROUP BY wt.id, wt.name, wt.workflow_type, wt.is_active;
```

---

## 🏗️ Architecture des Tables

### 1. workflow_templates

Table principale des workflows:

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | Identifiant unique |
| name | VARCHAR(200) | Nom du workflow |
| workflow_type | ENUM | Type: production, shipping, payment, refining, sales |
| description | TEXT | Description du workflow |
| is_active | BOOLEAN | Un seul workflow actif par type et compagnie |
| mining_company_id | UUID | Société minière (NULL = global) |
| version | INTEGER | Version (incrémentée automatiquement) |

### 2. workflow_statuses

Statuts individuels d'un workflow:

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | Identifiant unique |
| workflow_template_id | UUID | Référence au workflow |
| status_key | VARCHAR(100) | Clé technique (ex: `in_safe`) |
| status_label | VARCHAR(200) | Libellé affiché (ex: "En Coffre") |
| status_color | VARCHAR(50) | Couleur hexadécimale |
| description | TEXT | Description au survol |
| order_index | INTEGER | Ordre d'affichage |
| is_initial | BOOLEAN | Statut de départ |
| is_final | BOOLEAN | Statut de fin |
| icon | VARCHAR(50) | Nom de l'icône Lucide |
| metadata | JSONB | Données additionnelles |

### 3. workflow_transitions

Transitions autorisées entre statuts:

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | Identifiant unique |
| workflow_template_id | UUID | Référence au workflow |
| from_status_id | UUID | Statut source |
| to_status_id | UUID | Statut destination |
| transition_label | VARCHAR(200) | Libellé de l'action |
| requires_approval | BOOLEAN | Approbation nécessaire |
| approval_roles | TEXT[] | Rôles autorisés |
| conditions | JSONB | Conditions additionnelles |

### 4. workflow_history

Historique complet des modifications:

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | Identifiant unique |
| workflow_template_id | UUID | Référence au workflow |
| version | INTEGER | Version du workflow |
| change_type | ENUM | Type de modification |
| changed_by | UUID | Utilisateur |
| changes_summary | TEXT | Résumé des changements |
| previous_config | JSONB | Configuration avant |
| new_config | JSONB | Configuration après |
| changed_at | TIMESTAMPTZ | Date/heure |

---

## 🎨 Interface Utilisateur

### Page Principale (`/admin/status-manager`)

**Fonctionnalités:**
- Vue en grille de tous les workflows
- Filtrage par type (Production, Shipping, etc.)
- Création de nouveaux workflows
- Activation/désactivation
- Duplication de workflows
- Suppression (si inactif)

**Informations affichées:**
- Type de workflow avec badge coloré
- Nom et description
- Statut actif/inactif
- Version actuelle
- Date de dernière modification

### Éditeur Visuel

**Fonctionnalités:**
- Ajout de statuts avec formulaire complet
- Édition des propriétés (nom, couleur, description, icône)
- Définition des statuts de départ et d'arrivée
- Création de transitions entre statuts
- Configuration des approbations requises
- Validation en temps réel de l'intégrité

**Guidage utilisateur:**
- Info-bulles explicatives
- Aperçu en direct des modifications
- Messages de validation clairs
- Code couleur pour les états

### Panneau Historique

**Affichage:**
- Timeline chronologique inversée
- Type de modification avec badge coloré
- Utilisateur ayant effectué la modification
- Résumé des changements
- Détails techniques (avant/après)

---

## 🔒 Sécurité

### Row Level Security (RLS)

Toutes les tables sont protégées par RLS:

**Lecture:**
- ✅ Tous les utilisateurs authentifiés peuvent consulter les workflows

**Écriture:**
- ✅ Seuls les administrateurs peuvent modifier les workflows
- ✅ Vérification via `user_profiles.role = 'admin'`

### Triggers Automatiques

**1. Incrémentation de version**
- Déclencheur: Modification de statuts ou transitions
- Action: `version = version + 1`

**2. Journalisation**
- Déclencheur: Toute modification
- Action: Insertion dans `workflow_history`

### Validations

**Contraintes de base de données:**
- Un seul workflow actif par type et compagnie
- `status_key` unique par workflow
- `order_index` unique par workflow
- Pas de transitions vers soi-même
- Pas de doublons de transitions

**Validations applicatives:**
- Au moins un statut initial
- Au moins un statut final
- Pas de cycles dans les transitions
- Format correct des couleurs et clés

---

## 📝 Exemples d'Utilisation

### Créer un Workflow Personnalisé

1. Accédez à `/admin/status-manager`
2. Cliquez sur "Nouveau Workflow"
3. Remplissez:
   - Nom: "Workflow Expédition Mali"
   - Type: Shipping
   - Description: "Workflow pour les expéditions depuis le Mali"
   - Société: Sélectionnez la société minière

### Ajouter un Statut

1. Dans l'éditeur, cliquez "Ajouter un statut"
2. Remplissez:
   - Clé: `en_preparation` (minuscules + underscores)
   - Libellé: "En Préparation"
   - Couleur: Choisissez une couleur
   - Description: "Expédition en cours de préparation"
   - Type: Cochez "Statut de départ" si c'est le premier

### Créer une Transition

1. Sur un statut, cliquez "+ Transition"
2. Sélectionnez le statut de destination
3. (Optionnel) Ajoutez un libellé: "Valider la préparation"
4. (Optionnel) Cochez "Approbation requise"
5. Cliquez "Créer la transition"

### Activer un Workflow

1. Sur la carte du workflow, cliquez sur "Activer"
2. Le système valide l'intégrité
3. Si tout est OK, le workflow devient actif
4. L'ancien workflow du même type est désactivé automatiquement

---

## 🧪 Tests

### Tester la Création

```sql
-- Insérer un workflow de test
INSERT INTO workflow_templates (name, workflow_type, description, is_active)
VALUES ('Test Workflow', 'payment', 'Workflow de test pour paiements', false);

-- Vérifier
SELECT * FROM workflow_templates WHERE name = 'Test Workflow';
```

### Tester les Validations

```sql
-- Essayer de créer un statut avec une clé invalide (doit échouer)
INSERT INTO workflow_statuses (
  workflow_template_id,
  status_key,
  status_label,
  order_index
) VALUES (
  '...id-du-workflow...',
  'MAJUSCULE', -- ❌ Invalide
  'Test',
  0
);
```

---

## 🐛 Dépannage

### Erreur: "Could not find the function"

**Cause:** La migration n'a pas été appliquée
**Solution:** Vérifiez que toutes les fonctions sont créées:

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%workflow%';
```

### Erreur: "Permission denied"

**Cause:** RLS bloque l'accès
**Solution:** Vérifiez le rôle de l'utilisateur:

```sql
SELECT role FROM user_profiles WHERE id = auth.uid();
```

### Workflows non visibles

**Cause:** Politique RLS trop restrictive
**Solution:** Vérifiez les policies:

```sql
SELECT * FROM pg_policies WHERE tablename = 'workflow_templates';
```

---

## 🔄 Migration des Workflows Existants

Si vous avez déjà des statuts en dur dans le code:

1. **Identifiez tous les statuts actuels**
2. **Créez un workflow correspondant**
3. **Ajoutez tous les statuts existants**
4. **Définissez les transitions**
5. **Activez le workflow**
6. **Mettez à jour le code pour utiliser les workflows dynamiques**

---

## 📚 Intégration dans le Code

### Récupérer le Workflow Actif

```typescript
import { getActiveWorkflow } from '@/services/workflowManagerService';

const workflow = await getActiveWorkflow('production', miningCompanyId);
```

### Utiliser les Statuts

```typescript
// Récupérer les statuts disponibles
const statuses = workflow.statuses;

// Trouver un statut par clé
const inSafeStatus = statuses.find(s => s.status_key === 'in_safe');

// Afficher avec la couleur
<span style={{ color: inSafeStatus.status_color }}>
  {inSafeStatus.status_label}
</span>
```

### Vérifier les Transitions

```typescript
// Récupérer les transitions possibles depuis un statut
const possibleTransitions = workflow.transitions.filter(
  t => t.from_status_id === currentStatusId
);

// Vérifier si une transition nécessite approbation
const needsApproval = possibleTransitions.some(t => t.requires_approval);
```

---

## 🎯 Prochaines Étapes

1. ✅ Appliquer la migration SQL
2. ✅ Vérifier que tout fonctionne
3. ✅ Accéder à `/admin/status-manager`
4. ✅ Explorer l'interface
5. ✅ Créer votre premier workflow personnalisé
6. 🔄 Migrer progressivement les statuts en dur vers le système dynamique
7. 🔄 Former les utilisateurs

---

## 💡 Conseils d'Utilisation

**Best Practices:**
- Utilisez des noms de statuts clairs et cohérents
- Limitez le nombre de statuts (5-8 maximum par workflow)
- Documentez chaque statut avec une description
- Testez les workflows avant de les activer
- Conservez un workflow simple pour démarrer

**Codes Couleurs Suggérés:**
- Bleu (#3B82F6) - Statuts en cours
- Vert (#10B981) - Statuts validés
- Orange (#F59E0B) - Statuts en attente
- Rouge (#EF4444) - Statuts bloqués
- Violet (#8B5CF6) - Statuts finaux

---

## 📞 Support

En cas de problème:
1. Consultez la section Dépannage ci-dessus
2. Vérifiez les logs Supabase
3. Vérifiez la console du navigateur
4. Contactez l'équipe technique

---

**Version:** 1.0
**Date:** 13 Décembre 2025
**Auteur:** Gold Shipper Development Team
