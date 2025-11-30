# 🗑️ NETTOYAGE MODULE FREIGHT & CUSTOMS

## 📋 OBJECTIF

Supprimer **TOUTES** les données du module Freight & Customs pour le remettre à zéro.

## ⚠️ AVERTISSEMENT

**ATTENTION**: Cette opération est **IRRÉVERSIBLE**. Toutes les données suivantes seront supprimées:
- ✅ Toutes les expéditions freight
- ✅ Toutes les productions associées aux expéditions
- ✅ Tous les signataires
- ✅ Tous les documents PDF associés (références)

**BON À SAVOIR**: 
- ❌ Les productions dans `daily_production` ne sont **PAS** supprimées
- ✅ Le module reste fonctionnel et prêt pour de nouvelles données
- ✅ La structure des tables est préservée

## 📊 TABLES CONCERNÉES

### 1. `freight_shipment_signatories`
Signataires des documents PDF

### 2. `freight_shipment_productions`
Lien entre expéditions et productions journalières

### 3. `freight_shipments`
Expéditions principales du module Freight & Customs

## 🚀 INSTRUCTIONS D'APPLICATION

### Étape 1: Ouvrir Supabase SQL Editor

1. Connectez-vous à votre projet Supabase
2. Allez dans **SQL Editor**
3. Créez une nouvelle requête

### Étape 2: Copier le Script

Copiez **TOUT** le contenu du fichier:
```
CLEANUP_FREIGHT_CUSTOMS_MODULE.sql
```

### Étape 3: Exécuter le Script

1. Collez le script dans SQL Editor
2. **VÉRIFIEZ** que vous voulez vraiment tout supprimer
3. Cliquez sur **Run** (ou Ctrl+Enter)

### Étape 4: Vérifier les Résultats

Vous devriez voir dans les logs:

```
==============================================
DÉBUT DU NETTOYAGE - FREIGHT & CUSTOMS
==============================================
Signataires à supprimer: X
Productions liées à supprimer: Y
Expéditions à supprimer: Z

1/3 Suppression des signataires...
✓ Signataires supprimés: X

2/3 Suppression des productions liées...
✓ Productions liées supprimées: Y

3/3 Suppression des expéditions...
✓ Expéditions supprimées: Z

==============================================
NETTOYAGE TERMINÉ AVEC SUCCÈS
==============================================

==============================================
VÉRIFICATION FINALE
==============================================
Signataires restants: 0
Productions liées restantes: 0
Expéditions restantes: 0

✅ MODULE FREIGHT & CUSTOMS COMPLÈTEMENT VIDE
✅ Prêt pour de nouvelles données
==============================================

✓ Optimisation des tables effectuée

==============================================
SCRIPT TERMINÉ - MODULE FREIGHT & CUSTOMS VIDE
==============================================
```

## ✅ VALIDATION DANS L'APPLICATION

### Rafraîchir les Pages

1. Allez dans **Freight & Customs** > **Dashboard**
2. Rafraîchissez la page (F5)
3. Vérifiez que le tableau est vide
4. Le compteur devrait afficher: **Total: 0**

## 🔍 VÉRIFICATION MANUELLE (Optionnelle)

Si vous voulez vérifier manuellement les données:

```sql
-- Compter les expéditions
SELECT COUNT(*) as total_shipments FROM freight_shipments;
-- Résultat attendu: 0

-- Compter les productions liées
SELECT COUNT(*) as total_productions FROM freight_shipment_productions;
-- Résultat attendu: 0

-- Compter les signataires
SELECT COUNT(*) as total_signatories FROM freight_shipment_signatories;
-- Résultat attendu: 0
```

## 🔄 ORDRE D'EXÉCUTION

Le script respecte automatiquement l'ordre des contraintes de clés étrangères:

```
1. freight_shipment_signatories     (Enfant - Signataires)
              ↓
2. freight_shipment_productions     (Enfant - Productions liées)
              ↓
3. freight_shipments                (Parent - Expéditions)
```

## 🛡️ SÉCURITÉ

### Triggers Désactivés Temporairement
Le script désactive temporairement les triggers pour éviter les calculs automatiques pendant la suppression, puis les réactive après.

### Transactions Atomiques
Toutes les opérations sont dans des blocs `DO $$` pour garantir l'atomicité.

### Optimisation Automatique
Le script exécute `VACUUM ANALYZE` pour récupérer l'espace disque et mettre à jour les statistiques.

## 📝 BACKUP (Recommandé)

Si vous voulez une sauvegarde avant suppression:

```sql
-- Créer des tables de backup
CREATE TABLE backup_freight_shipments AS SELECT * FROM freight_shipments;
CREATE TABLE backup_freight_shipment_productions AS SELECT * FROM freight_shipment_productions;
CREATE TABLE backup_freight_shipment_signatories AS SELECT * FROM freight_shipment_signatories;
```

Pour restaurer (si nécessaire):
```sql
INSERT INTO freight_shipments SELECT * FROM backup_freight_shipments;
INSERT INTO freight_shipment_productions SELECT * FROM backup_freight_shipment_productions;
INSERT INTO freight_shipment_signatories SELECT * FROM backup_freight_shipment_signatories;
```

## 🆘 EN CAS DE PROBLÈME

### Si le Script Échoue

1. Vérifiez que les tables existent:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'freight_%' 
ORDER BY table_name;
```

2. Vérifiez les contraintes de clés étrangères:
```sql
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name LIKE 'freight_%';
```

### Support
Si vous rencontrez une erreur:
1. Copiez le message d'erreur COMPLET
2. Copiez le résultat des requêtes de diagnostic
3. Contactez le développeur

## ⏭️ APRÈS LE NETTOYAGE

Le module est maintenant vide et prêt à recevoir de nouvelles données:

1. ✅ Vous pouvez créer de nouvelles expéditions freight
2. ✅ Toutes les fonctionnalités sont opérationnelles
3. ✅ Les productions dans `daily_production` sont intactes
4. ✅ Vous pouvez refaire le workflow complet

---

**Statut**: ✅ PRÊT POUR EXÉCUTION
**Action**: Copier et exécuter dans Supabase SQL Editor
**Impact**: CRITIQUE - Suppression irréversible des données Freight & Customs
**Durée estimée**: < 5 secondes
