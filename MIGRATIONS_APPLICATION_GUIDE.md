# Guide d'Application des Migrations - Workflow Ventes et Paiements

## Vue d'Ensemble

Ce guide détaille l'application séquentielle des 7 migrations pour implémenter le nouveau workflow de gestion des ventes avec 9 étapes et système d'analyse FX.

## ⚠️ IMPORTANT - Avant de Commencer

1. **Faire une sauvegarde complète de la base de données**
2. **Tester sur un environnement de développement d'abord**
3. **Appliquer les migrations dans l'ordre exact**
4. **Vérifier après chaque migration avant de continuer**

## Tableau Récapitulatif des Migrations

| Ordre | Fichier | Description | Durée Estimée | Critique |
|-------|---------|-------------|---------------|----------|
| 1 | `20251102140000_clean_sales_status_transitions.sql` | Nettoyage table transitions | < 1 sec | ⚠️ Oui |
| 2 | `20251102140001_insert_new_sales_status_transitions.sql` | Insertion 11 nouvelles transitions | < 1 sec | ✅ Oui |
| 3 | `20251102140002_update_sales_table_schema.sql` | Mise à jour schéma sales | 1-2 sec | ⚠️ Oui |
| 4 | `20251102140003_update_payments_table_schema.sql` | Mise à jour schéma payments | 1-2 sec | ⚠️ Oui |
| 5 | `20251102140004_ensure_fx_rate_analysis_table.sql` | Création table fx_rate_analysis | < 1 sec | ✅ Non |
| 6 | `20251102140005_create_virtual_payment_triggers.sql` | Triggers paiements virtuels | < 1 sec | ✅ Oui |
| 7 | `20251102140006_create_status_transition_triggers.sql` | Triggers transitions auto | < 1 sec | ✅ Oui |

## Application Pas-à-Pas

### Migration 1: Nettoyage des Transitions

**Fichier:** `20251102140000_clean_sales_status_transitions.sql`

**Actions:**
- Supprime tous les triggers existants sur les transitions
- Vide la table `sales_status_transitions`
- Nettoie les fonctions de validation obsolètes

**Commandes de Vérification:**

```sql
-- Avant la migration
SELECT COUNT(*) as count_before FROM sales_status_transitions;

-- Après la migration (doit retourner 0)
SELECT COUNT(*) as count_after FROM sales_status_transitions;

-- Vérifier que les triggers sont supprimés
SELECT tgname FROM pg_trigger WHERE tgname LIKE '%sales_status%';
```

**Résultat Attendu:** 0 enregistrement dans sales_status_transitions

---

### Migration 2: Insertion des Nouvelles Transitions

**Fichier:** `20251102140001_insert_new_sales_status_transitions.sql`

**Actions:**
- Insère les 11 transitions du nouveau workflow
- Crée la fonction `validate_sales_status_transition()`
- Crée le trigger de validation sur la table sales
- Crée des index pour performance

**Commandes de Vérification:**

```sql
-- Vérifier nombre de transitions (doit être >= 11)
SELECT COUNT(*) as total_transitions FROM sales_status_transitions;

-- Afficher toutes les transitions
SELECT
  step_number,
  status_from,
  status_to,
  is_automatic,
  required_role
FROM sales_status_transitions
ORDER BY step_number;

-- Vérifier la fonction de validation
SELECT proname FROM pg_proc WHERE proname = 'validate_sales_status_transition';

-- Vérifier le trigger
SELECT tgname FROM pg_trigger WHERE tgrelid = 'sales'::regclass;
```

**Résultat Attendu:** 11 transitions, fonction et trigger créés

---

### Migration 3: Mise à Jour Schéma Sales

**Fichier:** `20251102140002_update_sales_table_schema.sql`

**Actions:**
- Met à jour la contrainte CHECK sur le statut
- Ajoute 4 nouvelles colonnes de tracking
- Crée le trigger pour timestamps automatiques
- Migre les anciens statuts vers les nouveaux

**Commandes de Vérification:**

```sql
-- Vérifier les nouvelles colonnes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales'
AND column_name IN ('management_approved_at', 'management_approved_by',
                    'customer_approved_at', 'customer_approved_by');

-- Vérifier la contrainte de statut
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'sales_status_check';

-- Vérifier migration des anciens statuts
SELECT status, COUNT(*)
FROM sales
GROUP BY status
ORDER BY status;

-- Vérifier les triggers
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'sales'::regclass
AND tgname LIKE '%approval%';
```

**Résultat Attendu:** 4 nouvelles colonnes, contrainte mise à jour, anciens statuts migrés

---

### Migration 4: Mise à Jour Schéma Payments

**Fichier:** `20251102140003_update_payments_table_schema.sql`

**Actions:**
- Ajoute 7 nouvelles colonnes (payment_type, bank_ids, currencies, etc.)
- Crée la vue `payments_with_bank_details`
- Synchronise payment_type avec is_virtual
- Crée des index pour performance

**Commandes de Vérification:**

```sql
-- Vérifier les nouvelles colonnes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payments'
AND column_name IN ('payment_type', 'customer_bank_id', 'seller_bank_id',
                    'payment_currency', 'receiving_currency', 'received_amount', 'fx_analysis_id');

-- Vérifier la vue
SELECT viewname FROM pg_views WHERE viewname = 'payments_with_bank_details';

-- Tester la vue
SELECT COUNT(*) FROM payments_with_bank_details;

-- Vérifier les index
SELECT indexname FROM pg_indexes
WHERE tablename = 'payments'
AND indexname LIKE '%payment_type%';
```

**Résultat Attendu:** 7 nouvelles colonnes, vue créée, index en place

---

### Migration 5: Table FX Rate Analysis

**Fichier:** `20251102140004_ensure_fx_rate_analysis_table.sql`

**Actions:**
- Crée la table `fx_rate_analysis`
- Crée 2 fonctions helper (calculate_fx_gain_loss, determine_best_fx_rate)
- Crée la vue `fx_analysis_with_details`
- Active RLS avec politiques appropriées

**Commandes de Vérification:**

```sql
-- Vérifier la table
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name = 'fx_rate_analysis';

-- Vérifier les colonnes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'fx_rate_analysis'
ORDER BY ordinal_position;

-- Vérifier les fonctions
SELECT proname FROM pg_proc
WHERE proname IN ('calculate_fx_gain_loss', 'determine_best_fx_rate');

-- Vérifier la vue
SELECT viewname FROM pg_views WHERE viewname = 'fx_analysis_with_details';

-- Vérifier RLS
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'fx_rate_analysis';

-- Vérifier les politiques
SELECT policyname FROM pg_policies
WHERE tablename = 'fx_rate_analysis';
```

**Résultat Attendu:** Table créée, 2 fonctions, vue, RLS activé, 3 politiques

---

### Migration 6: Triggers Paiements Virtuels

**Fichier:** `20251102140005_create_virtual_payment_triggers.sql`

**Actions:**
- Crée la fonction `create_virtual_payment_on_customer_approval()`
- Crée le trigger sur sales pour création automatique
- Crée la fonction de transition automatique
- Protège les paiements virtuels contre la suppression

**Commandes de Vérification:**

```sql
-- Vérifier les fonctions
SELECT proname FROM pg_proc
WHERE proname IN ('create_virtual_payment_on_customer_approval',
                  'auto_transition_to_waiting_for_payment',
                  'prevent_virtual_payment_deletion');

-- Vérifier les triggers
SELECT tgname, tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname LIKE '%virtual_payment%';

-- Test du trigger (sur une vente de test)
-- Créer une vente test
INSERT INTO sales (sale_number, customer_id, quantity_oz, london_am_rate,
                   gross_proceeds, net_proceeds, final_proceeds, status)
VALUES ('TEST-2025-00001',
        (SELECT id FROM customers LIMIT 1),
        10, 2450, 24500, 24000, 23500, 'pending_management_approval')
RETURNING id, sale_number, status;

-- Approuver management
UPDATE sales SET status = 'management_approved'
WHERE sale_number = 'TEST-2025-00001';

-- Transitionner vers approval client
UPDATE sales SET status = 'pending_for_customer_approval'
WHERE sale_number = 'TEST-2025-00001';

-- Approuver client (devrait créer paiement virtuel)
UPDATE sales SET status = 'customer_approved'
WHERE sale_number = 'TEST-2025-00001';

-- Vérifier création paiement virtuel
SELECT p.id, p.payment_type, p.is_virtual, p.status, s.status as sale_status
FROM payments p
INNER JOIN sales s ON p.sale_id = s.id
WHERE s.sale_number = 'TEST-2025-00001';

-- Nettoyer le test
DELETE FROM payments WHERE sale_id = (SELECT id FROM sales WHERE sale_number = 'TEST-2025-00001');
DELETE FROM sales WHERE sale_number = 'TEST-2025-00001';
```

**Résultat Attendu:** 3 fonctions, 3 triggers, test réussi avec paiement virtuel créé

---

### Migration 7: Triggers Transitions Automatiques

**Fichier:** `20251102140006_create_status_transition_triggers.sql`

**Actions:**
- Crée la fonction pour statut initial
- Crée la fonction de transition vers payment_received
- Crée la fonction d'auto-completion
- Crée la fonction de logging audit
- Crée la validation approval management

**Commandes de Vérification:**

```sql
-- Vérifier les fonctions
SELECT proname FROM pg_proc
WHERE proname IN ('set_initial_sale_status',
                  'update_sale_on_real_payment',
                  'auto_complete_sale_on_payment_received',
                  'log_sale_status_transition',
                  'validate_management_approval');

-- Vérifier les triggers
SELECT tgname, tgrelid::regclass as table_name, tgtype
FROM pg_trigger
WHERE tgname IN ('trigger_set_initial_sale_status',
                 'trigger_update_sale_on_real_payment',
                 'trigger_auto_complete_sale',
                 'trigger_log_sale_status_transition',
                 'trigger_validate_management_approval');

-- Test du workflow complet
-- 1. Créer vente (doit avoir statut pending_management_approval)
INSERT INTO sales (sale_number, customer_id, quantity_oz, london_am_rate,
                   gross_proceeds, net_proceeds, final_proceeds)
VALUES ('TEST-2025-00002',
        (SELECT id FROM customers LIMIT 1),
        5, 2450, 12250, 12000, 11750)
RETURNING id, sale_number, status;

-- Vérifier statut initial
SELECT sale_number, status FROM sales WHERE sale_number = 'TEST-2025-00002';

-- Nettoyer
DELETE FROM sales WHERE sale_number = 'TEST-2025-00002';
```

**Résultat Attendu:** 5 fonctions, 5 triggers, statut initial automatique

---

## Vérification Finale Complète

Après avoir appliqué toutes les migrations, exécuter ces requêtes:

```sql
-- 1. Vérifier toutes les tables
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('sales', 'payments', 'sales_status_transitions', 'fx_rate_analysis')
ORDER BY tablename;

-- 2. Vérifier toutes les transitions
SELECT step_number, status_from, status_to, is_automatic, required_role
FROM sales_status_transitions
ORDER BY step_number;

-- 3. Vérifier toutes les fonctions créées
SELECT proname FROM pg_proc
WHERE proname LIKE '%sale%' OR proname LIKE '%payment%' OR proname LIKE '%fx%'
ORDER BY proname;

-- 4. Vérifier tous les triggers
SELECT tgrelid::regclass as table_name, tgname
FROM pg_trigger
WHERE tgrelid IN ('sales'::regclass, 'payments'::regclass)
ORDER BY tgrelid, tgname;

-- 5. Vérifier toutes les vues
SELECT viewname FROM pg_views
WHERE viewname IN ('payments_with_bank_details', 'fx_analysis_with_details')
ORDER BY viewname;

-- 6. Vérifier RLS sur tables critiques
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('sales', 'payments', 'fx_rate_analysis')
ORDER BY tablename;

-- 7. Test workflow complet (optionnel mais recommandé)
-- Voir section "Test du Workflow Complet" ci-dessous
```

## Test du Workflow Complet (Recommandé)

```sql
-- Étape 1: Créer une vente test
INSERT INTO sales (
  sale_number,
  customer_id,
  quantity_oz,
  london_am_rate,
  gross_proceeds,
  net_proceeds,
  final_proceeds
)
VALUES (
  'WORKFLOW-TEST-001',
  (SELECT id FROM customers LIMIT 1),
  10,
  2450.00,
  24500.00,
  24000.00,
  23500.00
)
RETURNING id, sale_number, status; -- Devrait être 'pending_management_approval'

-- Étape 2: Approuver en tant que management
UPDATE sales
SET status = 'management_approved'
WHERE sale_number = 'WORKFLOW-TEST-001';

-- Vérifier timestamps
SELECT sale_number, status, management_approved_at, management_approved_by
FROM sales
WHERE sale_number = 'WORKFLOW-TEST-001';

-- Étape 3: Envoyer au client
UPDATE sales
SET status = 'pending_for_customer_approval'
WHERE sale_number = 'WORKFLOW-TEST-001';

-- Étape 4: Approuver en tant que client (crée paiement virtuel)
UPDATE sales
SET status = 'customer_approved'
WHERE sale_number = 'WORKFLOW-TEST-001';

-- Vérifier paiement virtuel créé
SELECT
  p.id as payment_id,
  p.payment_type,
  p.is_virtual,
  p.amount,
  p.reference_number,
  s.status as sale_status
FROM payments p
INNER JOIN sales s ON p.sale_id = s.id
WHERE s.sale_number = 'WORKFLOW-TEST-001';

-- Devrait montrer: payment_type='virtual', is_virtual=true, sale_status='waiting_for_payment'

-- Étape 5: Nettoyer le test
DELETE FROM payments WHERE sale_id = (SELECT id FROM sales WHERE sale_number = 'WORKFLOW-TEST-001');
DELETE FROM sales WHERE sale_number = 'WORKFLOW-TEST-001';

-- Vérifier nettoyage
SELECT COUNT(*) FROM sales WHERE sale_number = 'WORKFLOW-TEST-001'; -- Devrait être 0
```

## Rollback (En Cas de Problème)

Si un problème survient, voici les commandes de rollback dans l'ordre inverse:

```sql
-- 7. Rollback triggers transitions
DROP TRIGGER IF EXISTS trigger_set_initial_sale_status ON sales;
DROP TRIGGER IF EXISTS trigger_update_sale_on_real_payment ON payments;
DROP TRIGGER IF EXISTS trigger_auto_complete_sale ON sales;
DROP TRIGGER IF EXISTS trigger_log_sale_status_transition ON sales;
DROP TRIGGER IF EXISTS trigger_validate_management_approval ON sales;
DROP FUNCTION IF EXISTS set_initial_sale_status();
DROP FUNCTION IF EXISTS update_sale_on_real_payment();
DROP FUNCTION IF EXISTS auto_complete_sale_on_payment_received();
DROP FUNCTION IF EXISTS log_sale_status_transition();
DROP FUNCTION IF EXISTS validate_management_approval();

-- 6. Rollback triggers paiements virtuels
DROP TRIGGER IF EXISTS trigger_create_virtual_payment ON sales;
DROP TRIGGER IF EXISTS trigger_auto_transition_waiting_payment ON payments;
DROP TRIGGER IF EXISTS trigger_prevent_virtual_payment_deletion ON payments;
DROP FUNCTION IF EXISTS create_virtual_payment_on_customer_approval();
DROP FUNCTION IF EXISTS auto_transition_to_waiting_for_payment();
DROP FUNCTION IF EXISTS prevent_virtual_payment_deletion();

-- 5. Rollback table fx_rate_analysis
DROP VIEW IF EXISTS fx_analysis_with_details;
DROP FUNCTION IF EXISTS calculate_fx_gain_loss();
DROP FUNCTION IF EXISTS determine_best_fx_rate();
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_fx_analysis_id_fkey;
DROP TABLE IF EXISTS fx_rate_analysis;

-- 4. Rollback schéma payments
DROP VIEW IF EXISTS payments_with_bank_details;
ALTER TABLE payments DROP COLUMN IF EXISTS fx_analysis_id;
ALTER TABLE payments DROP COLUMN IF EXISTS received_amount;
ALTER TABLE payments DROP COLUMN IF EXISTS receiving_currency;
ALTER TABLE payments DROP COLUMN IF EXISTS payment_currency;
ALTER TABLE payments DROP COLUMN IF EXISTS seller_bank_id;
ALTER TABLE payments DROP COLUMN IF EXISTS customer_bank_id;
ALTER TABLE payments DROP COLUMN IF EXISTS is_virtual;
ALTER TABLE payments DROP COLUMN IF EXISTS payment_type;

-- 3. Rollback schéma sales
DROP TRIGGER IF EXISTS trigger_update_sales_approval_timestamps ON sales;
DROP FUNCTION IF EXISTS update_sales_approval_timestamps();
ALTER TABLE sales DROP COLUMN IF EXISTS customer_approved_by;
ALTER TABLE sales DROP COLUMN IF EXISTS customer_approved_at;
ALTER TABLE sales DROP COLUMN IF EXISTS management_approved_by;
ALTER TABLE sales DROP COLUMN IF EXISTS management_approved_at;

-- 2. Rollback transitions
DROP TRIGGER IF EXISTS trigger_validate_sales_status_transition ON sales;
DROP FUNCTION IF EXISTS check_sales_status_transition();
DROP FUNCTION IF EXISTS validate_sales_status_transition();
DELETE FROM sales_status_transitions;

-- 1. (Pas de rollback nécessaire pour le nettoyage)
```

## Support et Dépannage

### Problème: Migration échoue avec erreur de contrainte

**Solution:** Vérifier les données existantes qui ne respectent pas les nouvelles contraintes

```sql
-- Vérifier les statuts invalides dans sales
SELECT DISTINCT status FROM sales
WHERE status NOT IN ('create_sales', 'pending_management_approval', 'management_approved',
                     'management_rejected', 'pending_for_customer_approval', 'customer_approved',
                     'customer_rejected', 'waiting_for_payment', 'virtual_payment',
                     'payment_received', 'completed', 'pending', 'approved', 'rejected');
```

### Problème: Trigger ne se déclenche pas

**Solution:** Vérifier que le trigger est bien activé

```sql
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'nom_du_trigger';
-- tgenabled devrait être 'O' (Origin)
```

### Problème: Fonction introuvable

**Solution:** Vérifier le schéma de la fonction

```sql
SELECT n.nspname, p.proname
FROM pg_proc p
INNER JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'nom_de_la_fonction';
```

## Résumé

- **7 migrations** à appliquer séquentiellement
- **Durée totale estimée:** < 10 secondes
- **Impact:** Nouveau workflow de ventes avec 9 étapes automatisées
- **Bénéfices:** Traçabilité complète, analyse FX automatique, prévention d'erreurs

## Prochaines Étapes Après Migration

1. Tester le workflow complet avec données réelles
2. Former les utilisateurs sur le nouveau processus
3. Compléter l'interface utilisateur (PaymentRecordPage, FX Analysis Panel)
4. Configurer les sources FX dans `fx_rates_daily`
5. Monitorer les logs d'audit pour détecter tout problème

---

**Date de création:** 2 Novembre 2025
**Version:** 1.0
**Auteur:** Système automatisé de migration
