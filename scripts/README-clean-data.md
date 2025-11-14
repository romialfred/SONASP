# Guide de Nettoyage des Données Transactionnelles

## 📋 Vue d'ensemble

Ce script permet de **supprimer toutes les données transactionnelles** tout en **préservant les données de configuration et de référence**.

## ⚠️ IMPORTANT - À LIRE AVANT UTILISATION

### Sauvegarder votre base de données

**TOUJOURS faire une sauvegarde complète avant d'exécuter ce script!**

1. Dans Supabase Dashboard → Settings → Backups
2. Ou via CLI: `supabase db dump -f backup.sql`

## 🗑️ Données qui seront SUPPRIMÉES

- ✅ **Productions journalières** (`daily_production`)
- ✅ **Documents de production** (`production_documents`)
- ✅ **Historique des statuts** (`unified_status_history`)
- ✅ **Expéditions** (`shipping_preparations`)
- ✅ **Documents d'expédition** (`shipping_documents`)
- ✅ **Fret et douanes** (`freight_customs`)
- ✅ **Batches** (`batches`)
- ✅ **Inventaire** (`inventory`, `inventory_movements`)
- ✅ **Ventes** (`sales`, `pre_sales`)
- ✅ **Paiements** (`payments`, `virtual_payments`)
- ✅ **Certificats d'essai** (`assay_certificates`)
- ✅ **Licences d'exportation** (`export_licenses`, `export_license_quotas`)

## 🔒 Données qui seront PRÉSERVÉES

- ✅ **Utilisateurs** (`profiles`, `user_permissions`)
- ✅ **Sociétés minières** (`mining_companies`)
- ✅ **Raffineries** (`refineries`, `refinery_plants`)
- ✅ **Transporteurs** (`transport_companies`, `freight_companies`)
- ✅ **Clients** (`customers`, `bank_accounts`)
- ✅ **Taux de change** (`fx_rates`, `fx_rate_snapshots`)
- ✅ **Prix de l'or** (`gold_prices`, `gold_price_snapshots`)
- ✅ **Prévisions** (`performance_forecasts`)
- ✅ **Budgets** (`annual_budgets`)
- ✅ **Paramètres système** (`system_parameters`)
- ✅ **Énumérations** (tous les types ENUM)

## 🚀 Utilisation

### Méthode 1: Via Supabase SQL Editor (Recommandé)

1. Connectez-vous à Supabase Dashboard
2. Allez dans **SQL Editor**
3. Copiez le contenu de `clean-transactional-data.sql`
4. Collez-le dans l'éditeur
5. **LISEZ attentivement les logs** qui s'affichent
6. À la fin, le script est en **transaction ouverte**:
   - Si tout est OK: Décommentez `COMMIT;` et exécutez
   - Si vous voulez annuler: Décommentez `ROLLBACK;` et exécutez

### Méthode 2: Via CLI Supabase

```bash
# Depuis le répertoire du projet
supabase db execute -f scripts/clean-transactional-data.sql
```

### Méthode 3: Via psql

```bash
psql "postgresql://[YOUR_CONNECTION_STRING]" -f scripts/clean-transactional-data.sql
```

## 📊 Ce que vous verrez

Le script affiche des logs détaillés en 5 étapes:

### ÉTAPE 0: Avertissement de sécurité
```
⚠️  ═══════════════════════════════════════════════════════
⚠️  ATTENTION: SUPPRESSION DES DONNÉES TRANSACTIONNELLES
⚠️  ═══════════════════════════════════════════════════════
```

### ÉTAPE 1: Comptage avant suppression
```
📊 ═══════════════════════════════════════════════════════
📊 COMPTAGE AVANT SUPPRESSION
📊 ═══════════════════════════════════════════════════════

📦 Productions journalières: 45 enregistrements
📄 Documents de production: 12 enregistrements
📜 Historique des statuts: 89 enregistrements
🚚 Expéditions: 23 enregistrements
...
```

### ÉTAPE 2: Suppression des données
```
🗑️  ═══════════════════════════════════════════════════════
🗑️  DÉBUT DE LA SUPPRESSION
🗑️  ═══════════════════════════════════════════════════════

✅ Quotas de licences d'exportation supprimés
✅ Licences d'exportation supprimées
✅ Certificats d'essai supprimés
...
```

### ÉTAPE 3: Vérification après suppression
```
📊 ═══════════════════════════════════════════════════════
📊 VÉRIFICATION APRÈS SUPPRESSION
📊 ═══════════════════════════════════════════════════════

📦 Productions journalières: 0
�� Documents de production: 0
📜 Historique des statuts: 0
🚚 Expéditions: 0

✅ Toutes les données transactionnelles ont été supprimées
```

### ÉTAPE 4: Vérification des données préservées
```
✅ ═══════════════════════════════════════════════════════
✅ DONNÉES PRÉSERVÉES
✅ ═══════════════════════════════════════════════════════

👥 Utilisateurs: 5 enregistrements
🏢 Sociétés minières: 3 enregistrements
🏭 Raffineries: 2 enregistrements
...
```

### ÉTAPE 5: Confirmation finale
```
🎉 ═══════════════════════════════════════════════════════
🎉 NETTOYAGE TERMINÉ AVEC SUCCÈS
🎉 ═══════════════════════════════════════════════════════

✅ Les données transactionnelles ont été supprimées
✅ Les données de configuration ont été préservées
✅ La base de données est prête pour de nouvelles données

⚠️  N'oubliez pas de COMMIT la transaction si tout est OK
⚠️  Ou ROLLBACK si vous voulez annuler
```

## 🔐 Sécurité du Script

### Transaction complète
Le script s'exécute dans une **transaction unique**:
- Si une erreur survient → **ROLLBACK automatique**
- Rien n'est supprimé jusqu'au COMMIT final
- Vous pouvez annuler à tout moment

### Vérifications multiples
- Comptage avant suppression
- Vérification après suppression
- Confirmation des données préservées
- Logs détaillés à chaque étape

### Ordre de suppression
Les suppressions respectent les **contraintes de clés étrangères**:
1. D'abord les tables enfants (dépendances)
2. Ensuite les tables parents
3. Respect de l'ordre des relations

## 🔄 Après le nettoyage

### Réinitialiser les séquences (optionnel)

Si vous voulez que les nouveaux IDs recommencent à 1:

```sql
-- Pour les tables avec serial/bigserial
ALTER SEQUENCE daily_production_id_seq RESTART WITH 1;
-- Répétez pour chaque table si nécessaire
```

### Vérifier les buckets de stockage

Les fichiers dans Supabase Storage ne sont PAS supprimés automatiquement:

```sql
-- Lister les fichiers orphelins
SELECT * FROM storage.objects
WHERE bucket_id IN ('production-documents', 'shipping-documents', 'assay-certificates');
```

Pour les supprimer, utilisez le Dashboard Storage ou l'API.

## ⚠️ Cas d'usage

### Quand utiliser ce script?

✅ **OUI** - Utiliser dans ces cas:
- Environnement de développement/test
- Réinitialisation pour démo
- Nettoyage avant migration
- Base de données corrompue

❌ **NON** - Ne PAS utiliser:
- En production sans sauvegarde
- Si vous avez besoin d'historique
- Sans autorisation appropriée

## 🆘 En cas de problème

### J'ai exécuté le script par erreur!

Si vous n'avez PAS encore fait COMMIT:
```sql
ROLLBACK;
```

Si vous avez déjà fait COMMIT:
```bash
# Restaurer depuis la sauvegarde
supabase db reset
# ou
psql -f backup.sql
```

### Le script bloque sur une erreur

Le script est conçu pour **continuer même si certaines tables n'existent pas**.

Si une vraie erreur survient:
1. La transaction est automatiquement annulée
2. Aucune donnée n'est supprimée
3. Lisez le message d'erreur
4. Corrigez le problème
5. Réexécutez le script

## 📝 Logs et Audit

Le script utilise `RAISE NOTICE` pour tous les logs.

Pour capturer les logs dans un fichier:
```bash
psql "connection_string" -f clean-transactional-data.sql > cleanup.log 2>&1
```

## ✅ Checklist avant exécution

- [ ] Sauvegarde complète effectuée
- [ ] Script lu et compris
- [ ] Environnement correct (dev/test/prod)
- [ ] Autorisation appropriée
- [ ] Équipe informée (si applicable)
- [ ] Prêt à lire les logs attentivement
- [ ] Prêt à faire COMMIT ou ROLLBACK

## 📞 Support

Si vous avez des questions ou rencontrez des problèmes:
1. Vérifiez les logs du script
2. Consultez la documentation Supabase
3. Contactez l'équipe de développement
