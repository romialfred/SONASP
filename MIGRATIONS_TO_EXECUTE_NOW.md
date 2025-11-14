# 🗃️ Migrations à Exécuter - Gold Shipper

## 📋 État Actuel (2025-11-14)

### ⚠️ URGENT: Migration en Attente d'Exécution

#### 20251114_006_add_shipping_status_history.sql
**Statut:** 🔴 **NON EXÉCUTÉE - À FAIRE IMMÉDIATEMENT**

**Description:**
Crée le système de suivi d'historique pour les changements de statut des expéditions (shipping).
Cette migration est **REQUISE** pour que le module Shipping fonctionne correctement.

**Impact:**
- Crée la table `shipping_status_history`
- Ajoute des indexes pour performance
- Active RLS avec policies de sécurité
- Crée un trigger automatique pour capturer les changements

**Dépendances:**
- Table `shipping_preparations` (déjà existante)
- Table `users` (déjà existante)

**Comment Exécuter:**
```bash
# Méthode 1: Via psql
psql "votre_connection_string" < supabase/migrations/20251114_006_add_shipping_status_history.sql

# Méthode 2: Via Supabase Dashboard
# 1. Aller dans Database > SQL Editor
# 2. Copier le contenu du fichier
# 3. Exécuter

# Méthode 3: Via Supabase CLI (si disponible)
supabase db push
```

**Vérification Post-Exécution:**
```sql
-- Vérifier que la table existe
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'shipping_status_history'
);

-- Vérifier les indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'shipping_status_history';

-- Vérifier le trigger
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'shipping_preparations'
AND trigger_name = 'shipping_status_change_trigger';

-- Vérifier les RLS policies
SELECT policyname FROM pg_policies
WHERE tablename = 'shipping_status_history';
```

**Tests Recommandés:**
```sql
-- Test 1: Créer une entrée d'historique manuellement
INSERT INTO shipping_status_history (
  shipping_preparation_id,
  old_status,
  new_status,
  changed_by,
  notes
) VALUES (
  'uuid-dune-shipping-preparation-existante',
  'pending',
  'prepared',
  auth.uid(),
  'Test de la création d''historique'
);

-- Test 2: Changer le statut d'une expédition pour vérifier le trigger
UPDATE shipping_preparations
SET status = 'prepared'
WHERE id = 'uuid-dune-shipping-preparation-existante';

-- Test 3: Vérifier que l'historique a été créé
SELECT * FROM shipping_status_history
ORDER BY changed_at DESC
LIMIT 5;
```

**Rollback (Si Nécessaire):**
```sql
-- En cas de problème, exécuter dans l'ordre:
DROP TRIGGER IF EXISTS shipping_status_change_trigger ON shipping_preparations;
DROP FUNCTION IF EXISTS create_shipping_status_history_on_update();
DROP TABLE IF EXISTS shipping_status_history CASCADE;
```

---

## 📊 Historique des Migrations

### ✅ Migrations Exécutées en Production

#### Novembre 2025 - Semaine 2

| Date | Fichier | Description | Status |
|------|---------|-------------|--------|
| 2025-11-13 | `20251113_001_fix_site_id_trigger.sql` | Correction du trigger site_id | ✅ Exécutée |
| 2025-11-13 | `20251113_002_fix_storage_policies_format.sql` | Correction format policies storage | ✅ Exécutée |
| 2025-11-13 | `20251113_003_fix_daily_production_display.sql` | Fix affichage production journalière | ✅ Exécutée |
| 2025-11-13 | `20251113_004_fix_shipping_status_enum.sql` | Fix enum shipping status | ✅ Exécutée |
| 2025-11-13 | `20251113_005_fix_shipping_table_definitive.sql` | Fix définitif table shipping | ✅ Exécutée |
| 2025-11-13 | `20251113_011_fix_assay_certificates_storage.sql` | Fix storage certificats | ✅ Exécutée |
| 2025-11-13 | `20251113_012_add_silver_tracking_to_production.sql` | Ajout tracking argent | ✅ Exécutée |
| 2025-11-13 | `20251113_020_create_freight_customs_module.sql` | Création module freight | ✅ Exécutée |

#### Novembre 2025 - Semaine 3

| Date | Fichier | Description | Status |
|------|---------|-------------|--------|
| 2025-11-14 | `20251114_001_add_ready_for_customs_status.sql` | Ajout statut customs | ✅ Exécutée |
| 2025-11-14 | `20251114_002_complete_ready_for_customs.sql` | Complétion statut customs | ✅ Exécutée |
| 2025-11-14 | `20251114_003_complete_status_enums_system.sql` | Complétion enums système | ✅ Exécutée |
| 2025-11-14 | `20251114_004_correct_status_enums_verified.sql` | Correction enums vérifiés | ✅ Exécutée |
| 2025-11-14 | `20251114_005_fix_production_status_trigger.sql` | Fix trigger production | ✅ Exécutée |
| 2025-11-14 | **`20251114_006_add_shipping_status_history.sql`** | **Historique shipping** | 🔴 **À EXÉCUTER** |

---

## 🔄 Migrations en Développement

_Aucune migration en développement actuellement._

---

## 📝 Instructions pour l'Équipe

### Avant de Commencer à Travailler
1. ✅ Faire un `git pull` pour récupérer les dernières migrations
2. ✅ Vérifier ce fichier pour voir les migrations en attente
3. ✅ Exécuter les migrations dans l'ordre chronologique
4. ✅ Vérifier que tout fonctionne avant de commencer à coder

### Avant de Créer une Nouvelle Migration
1. 📢 Annoncer dans le canal #dev-database
2. 🔍 Vérifier qu'il n'y a pas de conflits avec d'autres migrations en cours
3. 📝 Suivre le format standard (voir MIGRATIONS_BEST_PRACTICES.md)
4. 🧪 Tester localement avant de committer

### Après avoir Créé une Migration
1. ✅ Committer le fichier de migration
2. ✅ Mettre à jour ce fichier (MIGRATIONS_TO_EXECUTE_NOW.md)
3. 📢 Notifier l'équipe dans #dev-database
4. 📄 Ajouter une entrée dans docs/CHANGELOG.md

### Après avoir Exécuté une Migration
1. ✅ Vérifier que tout fonctionne (tests)
2. ✅ Mettre à jour le statut dans ce fichier
3. ✅ Committer la mise à jour
4. 📢 Confirmer l'exécution dans #dev-database

---

## 🚨 Règles Importantes

### ❌ NE JAMAIS
- Modifier une migration déjà exécutée en production
- Supprimer une migration déjà exécutée
- Exécuter les migrations dans le désordre
- Committer du code qui dépend de migrations non exécutées

### ✅ TOUJOURS
- Lire ce fichier avant de commencer à travailler
- Mettre à jour ce fichier après chaque migration
- Tester les migrations sur un environnement de dev
- Documenter les changements dans le fichier de migration
- Communiquer avec l'équipe

---

## 📞 Contacts

### En Cas de Problème
- **Migrations bloquées:** @lead-dev
- **Problèmes de permissions:** @devops
- **Questions sur le schéma:** @architecte
- **Urgences:** #dev-urgent sur Slack

### Ressources
- 📖 [Best Practices](./MIGRATIONS_BEST_PRACTICES.md)
- 📚 [Documentation Supabase](https://supabase.com/docs)
- 🔧 [Guide de Débogage](./docs/TROUBLESHOOTING.md)

---

## 📊 Statistiques

- **Total migrations créées:** 17
- **Migrations exécutées:** 16 ✅
- **Migrations en attente:** 1 🔴
- **Taux de succès:** 94%
- **Dernière migration:** 2025-11-14

---

**🔄 Dernière mise à jour:** 2025-11-14 à 15:30 UTC
**👤 Mis à jour par:** AI Assistant
**📧 Questions:** #dev-database sur Slack

---

## ⚡ Actions Immédiates Requises

### 🔴 URGENT - À Faire Maintenant

1. **Exécuter la migration 20251114_006_add_shipping_status_history.sql**
   - Temps estimé: 2 minutes
   - Impact: Aucun sur données existantes
   - Requis pour: Module Shipping Details

2. **Vérifier le bon fonctionnement**
   - Tester la page Shipping Details
   - Vérifier que l'historique s'affiche
   - Tester le changement de statut

3. **Mettre à jour ce fichier**
   - Marquer la migration comme ✅ Exécutée
   - Ajouter la date d'exécution
   - Notifier l'équipe

---

**🎯 Objectif:** Avoir toutes les migrations exécutées avant la fin de journée
**⏰ Deadline:** 2025-11-14 EOD
**✅ Responsable:** Équipe Dev
