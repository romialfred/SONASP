# ✅ CORRECTION FINALE: Script Cleanup Freight & Customs

## ⚠️ ERREURS CORRIGÉES

### Erreur 1: Syntaxe RAISE NOTICE
**Erreur**: `syntax error at or near "RAISE" LINE 131`
**Cause**: Les commandes `RAISE NOTICE` étaient en dehors d'un bloc `DO $$`
**Solution**: ✅ Encapsulé dans un bloc `DO $$`

### Erreur 2: Triggers Système ⚠️ NOUVELLE
**Erreur**: `permission denied: "RI_ConstraintTrigger_a_55267" is a system trigger`
**Cause**: `DISABLE TRIGGER ALL` essaie de désactiver les triggers système (non autorisé)
**Solution**: ✅ Changé en `DISABLE TRIGGER USER` (triggers utilisateur uniquement)

## 📋 SCRIPT CORRIGÉ - VERSION FINALE

Le fichier `CLEANUP_FREIGHT_CUSTOMS_MODULE.sql` a été **COMPLÈTEMENT CORRIGÉ**.

### Changements Appliqués

```sql
-- AVANT (❌ ERREUR)
ALTER TABLE freight_shipments DISABLE TRIGGER ALL;

-- APRÈS (✅ CORRECT)
ALTER TABLE freight_shipments DISABLE TRIGGER USER;
```

**Pourquoi USER au lieu de ALL?**
- `ALL` = Tous les triggers (utilisateur + système)
- `USER` = Uniquement les triggers créés par l'utilisateur
- Les triggers système (contraintes FK) ne peuvent pas être désactivés

### Copier et Exécuter dans Supabase SQL Editor

Ouvrez le fichier `CLEANUP_FREIGHT_CUSTOMS_MODULE.sql` et copiez **TOUT** son contenu dans Supabase SQL Editor, puis exécutez.

## ✅ RÉSULTAT ATTENDU

Vous devriez voir:

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

## 🎯 BACKUP RECOMMANDÉ (Optionnel)

**AVANT** d'exécuter le cleanup, créez un backup:

```sql
-- Créer des tables de backup
CREATE TABLE backup_freight_shipments AS SELECT * FROM freight_shipments;
CREATE TABLE backup_freight_shipment_productions AS SELECT * FROM freight_shipment_productions;
CREATE TABLE backup_freight_shipment_signatories AS SELECT * FROM freight_shipment_signatories;
```

## 🔄 POUR RESTAURER (si nécessaire)

```sql
-- Vider les tables actuelles
TRUNCATE freight_shipment_signatories CASCADE;
TRUNCATE freight_shipment_productions CASCADE;
TRUNCATE freight_shipments CASCADE;

-- Restaurer depuis backup
INSERT INTO freight_shipments SELECT * FROM backup_freight_shipments;
INSERT INTO freight_shipment_productions SELECT * FROM backup_freight_shipment_productions;
INSERT INTO freight_shipment_signatories SELECT * FROM backup_freight_shipment_signatories;
```

## 📊 ORDRE D'EXÉCUTION

Le script respecte l'ordre des contraintes de clés étrangères:

```
1. Désactiver triggers USER (pas système)
              ↓
2. Supprimer signataires (enfant)
              ↓
3. Supprimer productions liées (enfant)
              ↓
4. Supprimer expéditions (parent)
              ↓
5. Réactiver triggers USER
              ↓
6. Vérifier que tout est vide
              ↓
7. Optimiser les tables (VACUUM)
```

## 🆘 SI NOUVELLE ERREUR

### Vérifier les Tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'freight_%' 
ORDER BY table_name;
```

### Vérifier les Contraintes FK
```sql
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name LIKE 'freight_%';
```

### Compter les Données
```sql
SELECT 
  (SELECT COUNT(*) FROM freight_shipments) as shipments,
  (SELECT COUNT(*) FROM freight_shipment_productions) as productions,
  (SELECT COUNT(*) FROM freight_shipment_signatories) as signatories;
```

---

**Statut**: ✅ **COMPLÈTEMENT CORRIGÉ - VERSION FINALE**
**Fichier à utiliser**: `CLEANUP_FREIGHT_CUSTOMS_MODULE.sql`
**Action**: Copier et exécuter dans Supabase SQL Editor
**Durée estimée**: < 5 secondes
