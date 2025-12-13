# PROCHAINES ÉTAPES - MODULE SALES

**Date:** 2025-12-13
**Statut:** Analyse Terminée - Actions Recommandées

---

## RÉSUMÉ DE L'ANALYSE

L'analyse approfondie du module de ventes est **terminée**. Le rapport complet est disponible dans **`ANALYSE_APPROFONDIE_MODULE_SALES.md`**.

### Statut Global: 🟡 FONCTIONNEL AVEC RÉSERVES

✅ **Points Positifs:**
- Workflow complet (11 statuts)
- Services frontend robustes
- Business rules claires
- Trigger historique maintenant en place

⚠️  **Points d'Attention:**
- Colonnes potentiellement manquantes en DB
- Paiements virtuels avec fallback (colonnes manquantes?)
- Historique vide (trigger récent)
- Statuts legacy à nettoyer

---

## ACTIONS PRIORITAIRES

### ⚠️  CRITIQUE - À FAIRE MAINTENANT

#### 1. Vérifier Structure Table `sales` (15 min)

**Copier/coller dans Supabase SQL Editor:**

```sql
-- Fichier: ANALYSE_COMPLETE_SALES.sql
```

Ce script vous donnera:
- Liste complète des colonnes existantes
- Valeurs de l'enum sale_status
- Tous les triggers, indexes, foreign keys
- Statistiques des ventes
- État de l'historique

#### 2. Comparer avec Colonnes Utilisées dans le Code

**Colonnes critiques à vérifier:**

```sql
-- Approbation Management
management_approved_by
management_approved_at
management_approval_notes
management_rejected_by
management_rejected_at
management_rejection_notes

-- Approbation Client
customer_approved_by
customer_approved_at
customer_approval_notes
customer_rejected_by
customer_rejected_at
customer_rejection_notes

-- Paiement
payment_amount
payment_date
payment_method
payment_proof_url
payment_notes
payment_received_at

-- Autres
completed_at
mechanism_type
```

**Si colonnes manquantes:** Passer à l'étape 3.

#### 3. Créer Migration pour Colonnes Manquantes (1h)

**Fichier:** `add_sales_approval_columns.sql`

```sql
/*
  # Add Sales Approval and Payment Columns

  1. Columns Added
    - Management approval tracking
    - Customer approval tracking
    - Payment information
    - Completion timestamp

  2. Security
    - All columns nullable (ventes existantes)
    - Foreign keys vers auth.users pour approvers
*/

-- Approbation Management
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS management_approved_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS management_approved_at timestamptz,
ADD COLUMN IF NOT EXISTS management_approval_notes text,
ADD COLUMN IF NOT EXISTS management_rejected_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS management_rejected_at timestamptz,
ADD COLUMN IF NOT EXISTS management_rejection_notes text;

-- Approbation Client
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS customer_approved_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS customer_approved_at timestamptz,
ADD COLUMN IF NOT EXISTS customer_approval_notes text,
ADD COLUMN IF NOT EXISTS customer_rejected_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS customer_rejected_at timestamptz,
ADD COLUMN IF NOT EXISTS customer_rejection_notes text;

-- Paiement
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS payment_amount numeric(15,2),
ADD COLUMN IF NOT EXISTS payment_date date,
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS payment_proof_url text,
ADD COLUMN IF NOT EXISTS payment_notes text,
ADD COLUMN IF NOT EXISTS payment_received_at timestamptz;

-- Complétion
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Vérification
DO $$
BEGIN
  RAISE NOTICE 'Colonnes ajoutées avec succès!';
  RAISE NOTICE 'Vérifier avec: SELECT * FROM information_schema.columns WHERE table_name = ''sales'';';
END $$;
```

#### 4. Vérifier/Fixer Table `payments` (30 min)

**Fichier:** `add_payments_virtual_columns.sql`

```sql
/*
  # Add Virtual Payment Columns

  1. Columns Added
    - is_virtual: boolean flag
    - payment_type: 'virtual' | 'real'
    - mechanism_type: 'spot' | 'forward_7' | 'forward_14'
    - auto_credited_at: timestamp
    - virtual_due_date: due date for virtual payments

  2. Purpose
    - Support automatic virtual payment creation
    - Track payment mechanism and due dates
*/

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS is_virtual boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_type text,
ADD COLUMN IF NOT EXISTS mechanism_type text,
ADD COLUMN IF NOT EXISTS auto_credited_at timestamptz,
ADD COLUMN IF NOT EXISTS virtual_due_date date;

-- Créer index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_payments_is_virtual
  ON payments(is_virtual) WHERE is_virtual = true;

CREATE INDEX IF NOT EXISTS idx_payments_virtual_due_date
  ON payments(virtual_due_date) WHERE is_virtual = true AND status = 'pending';

-- Vérification
DO $$
BEGIN
  RAISE NOTICE 'Colonnes paiements virtuels ajoutées!';
  RAISE NOTICE 'Vérifier avec: SELECT * FROM information_schema.columns WHERE table_name = ''payments'';';
END $$;
```

#### 5. Tester le Trigger d'Historique (15 min)

```sql
-- Test 1: Modifier statut d'une vente
UPDATE sales
SET status = 'management_approved'
WHERE id = (SELECT id FROM sales WHERE status = 'pending_management_approval' LIMIT 1)
RETURNING id, sale_number, status;

-- Test 2: Vérifier que l'entrée est créée
SELECT
  entity_type,
  entity_id,
  old_status,
  new_status,
  changed_at,
  metadata
FROM unified_status_history
WHERE entity_type = 'sales'
ORDER BY changed_at DESC
LIMIT 5;

-- Si pas d'entrée:
-- 1. Vérifier que le trigger existe
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'sales'
  AND trigger_name = 'sales_status_history_trigger';

-- 2. Vérifier la fonction
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'log_sales_status_change';
```

**Résultat attendu:** 1 ligne dans `unified_status_history` avec:
- `entity_type = 'sales'`
- `old_status = 'pending_management_approval'`
- `new_status = 'management_approved'`

---

## ACTIONS COURT TERME (1-2 semaines)

### 🟡 6. Nettoyer Statuts Legacy

```sql
-- Vérifier utilisation des statuts legacy
SELECT
  status,
  COUNT(*) as count,
  MIN(created_at) as first_sale,
  MAX(created_at) as last_sale
FROM sales
WHERE status IN ('in_sale', 'sold', 'cancelled')
GROUP BY status;

-- Si inutilisés, mapper vers statuts actuels
-- 'sold' → 'completed'
-- 'cancelled' → 'management_rejected' ou 'customer_rejected'
```

### 🟡 7. Documenter Workflow Complet

Créer `docs/SALES_WORKFLOW.md` avec:
- Diagramme visuel du workflow
- Matrice de transitions autorisées
- Règles métier pour chaque transition
- Permissions requises par rôle
- Exemples de chaque étape

### 🟡 8. Ajouter Tests Unitaires Critiques

**Fichier:** `src/services/salesService.test.ts`

Tests essentiels:
- Calculs financiers (royalties 3%)
- Validation seller/customer pairs
- Création paiement virtuel
- Transitions de statut
- Business rules multi-vendeurs

### 🟡 9. Ajouter Indexes pour Performance

```sql
-- Index sur colonnes fréquemment filtrées
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller ON sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);

-- Index composites pour requêtes complexes
CREATE INDEX IF NOT EXISTS idx_sales_customer_status
  ON sales(customer_id, status);

CREATE INDEX IF NOT EXISTS idx_sales_seller_status
  ON sales(seller_id, status);

-- Vérifier utilisation
EXPLAIN ANALYZE
SELECT * FROM sales
WHERE status = 'pending_management_approval'
ORDER BY created_at DESC;
```

---

## ACTIONS MOYEN TERME (1 mois)

### 🟢 10. Améliorer Gestion des Erreurs

- Types d'erreur spécifiques: `SaleStatusTransitionError`, `InvalidSellerError`
- Standardiser format de réponse: `{ success, data?, error?, warnings? }`
- Retry logic pour paiements virtuels

### 🟢 11. Implémenter Notifications Complètes

- Activer emails au client (ligne 86 de `salesApprovalService.ts`)
- Notifications in-app pour changements de statut
- Reminders automatiques pour paiements en retard
- Alertes management pour ventes bloquées > 7 jours

### 🟢 12. Backfill Historique des Statuts

Si des ventes existent avant l'ajout du trigger, créer un historique initial:

```sql
-- Backfill: créer entrées initiales pour ventes existantes
INSERT INTO unified_status_history (
  entity_type,
  entity_id,
  old_status,
  new_status,
  change_context,
  changed_by,
  metadata,
  changed_at
)
SELECT
  'sales',
  id,
  NULL,
  status::text,
  'backfill',
  created_by,
  jsonb_build_object(
    'sale_number', sale_number,
    'customer_id', customer_id,
    'backfilled', true
  ),
  created_at
FROM sales
WHERE id NOT IN (
  SELECT entity_id FROM unified_status_history WHERE entity_type = 'sales'
);
```

---

## ACTIONS LONG TERME (3+ mois)

### 🔵 13. Audit et Compliance

- Dashboard management avec KPIs:
  - Temps moyen par étape du workflow
  - Taux d'approbation/rejet (management, client)
  - Montants par statut
  - Délais de paiement
- Alertes automatiques:
  - Ventes bloquées > 7 jours
  - Paiements en retard
  - Approvals en attente
- Rapports mensuels automatisés

### 🔵 14. Refactoring et Optimisations

- Extraire validation dans service dédié
- Créer state machine explicite (XState?)
- TypeScript strict mode
- Séparer concerns (calculs, workflow, persistence)
- Optimiser bundle size (code splitting)

### 🔵 15. Features Avancées

- Ventes partielles (split d'un batch)
- Ventes groupées (multiple batches → 1 sale)
- Négociation prix (contre-proposition client)
- Approbation multi-niveaux (superviseur → directeur → CEO)
- Workflow configurable par mining company

---

## CHECKLIST IMMÉDIATE

Avant de continuer le développement, faire ces vérifications:

- [ ] Exécuter `ANALYSE_COMPLETE_SALES.sql`
- [ ] Noter toutes les colonnes existantes dans la table `sales`
- [ ] Comparer avec colonnes utilisées dans le code (voir liste ci-dessus)
- [ ] Créer migration `add_sales_approval_columns.sql` si nécessaire
- [ ] Créer migration `add_payments_virtual_columns.sql` si nécessaire
- [ ] Tester trigger historique avec UPDATE d'une vente
- [ ] Vérifier présence d'entrée dans `unified_status_history`
- [ ] Documenter résultats dans un rapport

---

## FICHIERS CRÉÉS

| Fichier | Description | Usage |
|---------|-------------|-------|
| `ANALYSE_APPROFONDIE_MODULE_SALES.md` | Rapport d'analyse complet (9000+ lignes) | Documentation technique |
| `ANALYSE_COMPLETE_SALES.sql` | Script d'audit DB | Exécuter dans Supabase SQL Editor |
| `check_sales_complete_structure.mjs` | Version Node.js de l'audit | `node check_sales_complete_structure.mjs` |
| `PROCHAINES_ETAPES_SALES.md` | Ce fichier | Guide d'actions |
| `ADD_SALES_STATUS_TRIGGER_ONLY.sql` | ✅ Déjà exécuté | Trigger historique |

---

## AIDE RAPIDE

### Question: Les colonnes d'approbation existent-elles?

**Réponse:** Exécuter dans Supabase SQL Editor:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales'
  AND column_name LIKE '%approved%'
     OR column_name LIKE '%rejected%'
     OR column_name LIKE '%payment%'
     OR column_name LIKE '%completed%';
```

### Question: Le trigger d'historique fonctionne-t-il?

**Réponse:** Tester:

```sql
-- 1. Modifier une vente
UPDATE sales SET status = 'management_approved'
WHERE id = (SELECT id FROM sales LIMIT 1);

-- 2. Vérifier historique
SELECT COUNT(*) FROM unified_status_history WHERE entity_type = 'sales';
```

Si COUNT(*) > 0 → Trigger fonctionne!

### Question: Combien de ventes par statut?

**Réponse:**

```sql
SELECT
  status,
  COUNT(*) as count,
  ROUND(SUM(final_proceeds)::numeric, 2) as total_proceeds
FROM sales
GROUP BY status
ORDER BY count DESC;
```

---

## SUPPORT

Pour questions techniques:
1. Consulter `ANALYSE_APPROFONDIE_MODULE_SALES.md` (section correspondante)
2. Exécuter les scripts de diagnostic fournis
3. Vérifier les logs d'erreur dans la console

Pour bugs:
1. Noter le statut actuel de la vente
2. Noter l'action tentée
3. Copier message d'erreur complet
4. Vérifier si colonnes utilisées existent en DB

---

**Prêt à commencer?**

1. Ouvrir Supabase SQL Editor
2. Copier/coller `ANALYSE_COMPLETE_SALES.sql`
3. Exécuter
4. Analyser les résultats
5. Revenir ici pour les prochaines étapes

Bonne chance! 🚀
