# 🗑️ Guide Complet de Nettoyage des Données

## 📋 Résumé Rapide

Ce guide explique comment **supprimer toutes les données transactionnelles** (productions, expéditions, ventes, etc.) tout en **préservant les données de configuration** (utilisateurs, stakeholders, taux de change, etc.).

## 🎯 Cas d'usage

**Utilisez ce script pour:**
- Nettoyer un environnement de développement/test
- Réinitialiser la base de données pour une démo
- Repartir à zéro après des tests
- Nettoyer des données corrompues

**N'utilisez PAS ce script pour:**
- Production sans sauvegarde complète
- Si vous avez besoin de l'historique
- Sans autorisation appropriée

## 📁 Fichiers Disponibles

### 1. `scripts/clean-transactional-data.sql` ⭐ RECOMMANDÉ

**Script interactif avec contrôle total**

✅ **Avantages:**
- Affiche des logs détaillés à chaque étape
- Transaction ouverte - vous choisissez COMMIT ou ROLLBACK
- Comptage avant/après suppression
- Vérification des données préservées
- Maximum de contrôle et de sécurité

❌ **Inconvénient:**
- Nécessite de faire COMMIT manuellement

**Usage:**
```sql
-- Dans Supabase SQL Editor ou psql
-- Copiez/collez le contenu du fichier
-- Lisez les logs
-- Puis exécutez:
COMMIT;  -- Pour confirmer
-- ou
ROLLBACK;  -- Pour annuler
```

### 2. `scripts/clean-transactional-data-auto.sql`

**Script automatique - COMMIT immédiat**

✅ **Avantages:**
- Exécution rapide
- Pas de confirmation nécessaire
- Commit automatique

❌ **Inconvénient:**
- Pas de possibilité d'annuler après exécution

**Usage:**
```bash
psql "$SUPABASE_DB_URL" -f scripts/clean-transactional-data-auto.sql
```

### 3. `scripts/clean-data.sh`

**Script shell interactif**

✅ **Avantages:**
- Interface en ligne de commande conviviale
- Vérifications de sécurité intégrées
- Demande de confirmation
- Coloré et facile à lire

❌ **Inconvénient:**
- Nécessite psql installé

**Usage:**
```bash
# Mode interactif (recommandé)
./scripts/clean-data.sh

# Mode automatique
./scripts/clean-data.sh --auto
```

## 🗂️ Données SUPPRIMÉES

| Catégorie | Tables | Description |
|-----------|--------|-------------|
| **Production** | `daily_production` | Toutes les productions journalières |
| | `production_documents` | Documents liés aux productions |
| | `unified_status_history` | Historique complet des changements |
| **Expédition** | `shipping_preparations` | Toutes les préparations d'expédition |
| | `shipping_documents` | Documents d'expédition |
| | `freight_customs` | Fret et douanes |
| **Inventaire** | `inventory` | Inventaire complet |
| | `inventory_movements` | Mouvements d'inventaire |
| **Ventes** | `sales` | Toutes les ventes |
| | `pre_sales` | Pré-ventes |
| **Paiements** | `payments` | Tous les paiements |
| | `virtual_payments` | Paiements virtuels |
| **Documents** | `assay_certificates` | Certificats d'essai |
| | `export_licenses` | Licences d'exportation |
| | `export_license_quotas` | Quotas de licences |
| **Batches** | `batches` | Tous les batches (si table existe) |

**Total estimé: 15+ tables**

## 🔒 Données PRÉSERVÉES

| Catégorie | Tables | Description |
|-----------|--------|-------------|
| **Utilisateurs** | `profiles` | Tous les utilisateurs |
| | `user_permissions` | Permissions |
| **Stakeholders** | `mining_companies` | Sociétés minières |
| | `refineries` | Raffineries |
| | `refinery_plants` | Usines de raffinage |
| | `transport_companies` | Compagnies de transport |
| | `freight_companies` | Compagnies de fret |
| | `customers` | Clients |
| | `bank_accounts` | Comptes bancaires |
| **Taux** | `fx_rates` | Taux de change |
| | `fx_rate_snapshots` | Snapshots des taux |
| | `gold_prices` | Prix de l'or |
| | `gold_price_snapshots` | Snapshots des prix |
| **Planification** | `performance_forecasts` | Prévisions |
| | `annual_budgets` | Budgets annuels |
| **Système** | `system_parameters` | Paramètres système |
| **Énumérations** | Tous les types ENUM | Types statiques |

**Total: 20+ tables préservées**

## 🚀 Guide d'utilisation pas à pas

### Méthode 1: Via Supabase Dashboard (Le plus simple)

#### Étape 1: Sauvegarde
```
1. Ouvrez Supabase Dashboard
2. Allez dans Settings → Backups
3. Cliquez "Create Backup"
4. Attendez la confirmation
```

#### Étape 2: Exécution
```
1. Allez dans SQL Editor
2. Cliquez "New Query"
3. Ouvrez scripts/clean-transactional-data.sql
4. Copiez tout le contenu
5. Collez dans l'éditeur
6. Cliquez "Run"
```

#### Étape 3: Lecture des logs
```
Lisez attentivement les logs qui s'affichent:
- Comptage avant suppression
- Progression de la suppression
- Vérification après suppression
- Données préservées
```

#### Étape 4: Confirmation
```
Si tout est OK:
  1. Dans l'éditeur, écrivez: COMMIT;
  2. Cliquez "Run"

Si vous voulez annuler:
  1. Dans l'éditeur, écrivez: ROLLBACK;
  2. Cliquez "Run"
```

### Méthode 2: Via CLI (Pour les développeurs)

#### Prérequis
```bash
# Installer psql (si nécessaire)
# macOS:
brew install postgresql

# Ubuntu/Debian:
sudo apt-get install postgresql-client

# Windows:
# Télécharger depuis postgresql.org
```

#### Exécution
```bash
# 1. Aller dans le répertoire du projet
cd /path/to/project

# 2. Vérifier que .env contient SUPABASE_DB_URL
cat .env | grep SUPABASE_DB_URL

# 3. Exécuter le script interactif
./scripts/clean-data.sh

# OU exécuter directement avec psql
source .env
psql "$SUPABASE_DB_URL" -f scripts/clean-transactional-data.sql
```

## 📊 Exemple de sortie

```
⚠️  ═══════════════════════════════════════════════════════
⚠️  ATTENTION: SUPPRESSION DES DONNÉES TRANSACTIONNELLES
⚠️  ═══════════════════════════════════════════════════════

📊 ═══════════════════════════════════════════════════════
📊 COMPTAGE AVANT SUPPRESSION
📊 ═══════════════════════════════════════════════════════

📦 Productions journalières: 45 enregistrements
📄 Documents de production: 12 enregistrements
📜 Historique des statuts: 89 enregistrements
🚚 Expéditions: 23 enregistrements
📋 Documents d'expédition: 8 enregistrements
🛃 Fret et douanes: 5 enregistrements
📦 Inventaire: 15 enregistrements
📊 Mouvements d'inventaire: 67 enregistrements
💰 Ventes: 18 enregistrements
💵 Pré-ventes: 3 enregistrements
💳 Paiements: 12 enregistrements
💸 Paiements virtuels: 0 enregistrements
🧪 Certificats d'essai: 34 enregistrements
📜 Licences d'exportation: 7 enregistrements
📊 Quotas de licences: 21 enregistrements

📊 TOTAL: 359 enregistrements seront supprimés

🗑️  ═══════════════════════════════════════════════════════
🗑️  DÉBUT DE LA SUPPRESSION
🗑️  ═══════════════════════════════════════════════════════

✅ Quotas de licences d'exportation supprimés
✅ Licences d'exportation supprimées
✅ Certificats d'essai supprimés
✅ Paiements virtuels supprimés
✅ Paiements supprimés
✅ Pré-ventes supprimées
✅ Ventes supprimées
✅ Mouvements d'inventaire supprimés
✅ Inventaire supprimé
✅ Fret et douanes supprimés
✅ Documents d'expédition supprimés
✅ Expéditions supprimées
✅ Historique des statuts supprimé
✅ Documents de production supprimés
✅ Productions journalières supprimées

✅ ═══════════════════════════════════════════════════════
✅ SUPPRESSION TERMINÉE AVEC SUCCÈS
✅ ═══════════════════════════════════════════════════════

📊 ═══════════════════════════════════════════════════════
📊 VÉRIFICATION APRÈS SUPPRESSION
📊 ═══════════════════════════════════════════════════════

📦 Productions journalières: 0
📄 Documents de production: 0
📜 Historique des statuts: 0
🚚 Expéditions: 0

✅ Toutes les données transactionnelles ont été supprimées

✅ ═══════════════════════════════════════════════════════
✅ DONNÉES PRÉSERVÉES
✅ ═══════════════════════════════════════════════════════

👥 Utilisateurs: 5 enregistrements
🏢 Sociétés minières: 3 enregistrements
🏭 Raffineries: 2 enregistrements
👨‍💼 Clients: 4 enregistrements
💱 Taux de change: 450 enregistrements
💰 Prix de l'or: 230 enregistrements
📈 Prévisions: 12 enregistrements
💼 Budgets: 6 enregistrements

✅ Toutes les données de configuration ont été préservées

🎉 ═══════════════════════════════════════════════════════
🎉 NETTOYAGE TERMINÉ AVEC SUCCÈS
🎉 ═══════════════════════════════════════════════════════

✅ Les données transactionnelles ont été supprimées
✅ Les données de configuration ont été préservées
✅ La base de données est prête pour de nouvelles données

⚠️  N'oubliez pas de COMMIT la transaction si tout est OK
⚠️  Ou ROLLBACK si vous voulez annuler
```

## ⚠️ Points Importants

### Sécurité

1. **TOUJOURS faire une sauvegarde** avant d'exécuter
2. Le script s'exécute dans une **transaction** (tout ou rien)
3. Vous pouvez faire **ROLLBACK** à tout moment (version standard)
4. Les logs sont **détaillés** pour chaque étape

### Ordre de suppression

Le script respecte les **contraintes de clés étrangères**:
- Supprime d'abord les tables enfants
- Puis les tables parents
- Évite les erreurs de contrainte

### Tables optionnelles

Le script vérifie l'existence des tables avant suppression:
```sql
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'table_name') THEN
  DELETE FROM table_name;
END IF;
```

Donc pas d'erreur si une table n'existe pas.

## 🔄 Après le nettoyage

### Réinitialiser les séquences (optionnel)

Si vous voulez que les nouveaux IDs recommencent à 1:

```sql
-- Voir toutes les séquences
SELECT sequence_name FROM information_schema.sequences;

-- Réinitialiser une séquence
ALTER SEQUENCE daily_production_id_seq RESTART WITH 1;
ALTER SEQUENCE shipping_preparations_id_seq RESTART WITH 1;
-- etc.
```

### Nettoyer le stockage Supabase

Les fichiers dans les buckets ne sont PAS supprimés automatiquement.

**Via Dashboard:**
1. Storage → Buckets
2. Sélectionnez le bucket (production-documents, shipping-documents, etc.)
3. Supprimez les fichiers orphelins

**Via SQL:**
```sql
-- Lister les fichiers
SELECT * FROM storage.objects
WHERE bucket_id IN ('production-documents', 'shipping-documents', 'assay-certificates');

-- Supprimer via l'API Storage
```

## 🆘 Dépannage

### "Transaction is already in progress"

**Solution:** Fermez et rouvrez l'éditeur SQL, ou exécutez:
```sql
ROLLBACK;
```

### "Permission denied"

**Solution:** Assurez-vous d'être connecté avec un compte admin.

### "Table does not exist"

**Solution:** Normal - le script gère les tables optionnelles. Continuez.

### J'ai fait COMMIT par erreur

**Solution:** Restaurez depuis la sauvegarde:
```bash
# Si vous avez une sauvegarde locale
psql "$SUPABASE_DB_URL" -f backup.sql

# Ou via Supabase Dashboard
# Settings → Backups → Restore
```

## 📞 Support

En cas de problème:
1. Lisez les logs du script attentivement
2. Vérifiez que vous avez une sauvegarde
3. Consultez la documentation Supabase
4. Contactez l'équipe de développement

## ✅ Checklist finale

Avant d'exécuter le script:

- [ ] Sauvegarde complète effectuée
- [ ] Script lu et compris
- [ ] Environnement vérifié (dev/test/prod)
- [ ] Autorisation appropriée obtenue
- [ ] Équipe informée (si nécessaire)
- [ ] Prêt à lire les logs attentivement
- [ ] Prêt à faire COMMIT ou ROLLBACK

## 📚 Fichiers de référence

- `scripts/clean-transactional-data.sql` - Script interactif complet
- `scripts/clean-transactional-data-auto.sql` - Script automatique
- `scripts/clean-data.sh` - Script shell
- `scripts/README-clean-data.md` - Documentation détaillée
- `CLEAN_DATA_GUIDE.md` - Ce guide (vous êtes ici)

---

**Version:** 1.0
**Dernière mise à jour:** 2025-11-14
**Testé avec:** Supabase PostgreSQL 15+
