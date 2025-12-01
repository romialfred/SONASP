# ✅ CORRECTION: Script Cleanup Freight & Customs

## ⚠️ ERREUR CORRIGÉE

**Erreur**: `syntax error at or near "RAISE" LINE 131`

**Cause**: Les commandes `RAISE NOTICE` étaient en dehors d'un bloc `DO $$`

**Solution**: ✅ Corrigé dans `CLEANUP_FREIGHT_CUSTOMS_MODULE.sql`

## 📋 SCRIPT CORRIGÉ - PRÊT À UTILISER

Le fichier `CLEANUP_FREIGHT_CUSTOMS_MODULE.sql` a été corrigé.

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

## 🎯 SI VOUS AVEZ BESOIN D'UN BACKUP

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

---

**Statut**: ✅ **CORRIGÉ ET PRÊT**
**Fichier à utiliser**: `CLEANUP_FREIGHT_CUSTOMS_MODULE.sql`
**Action**: Copier et exécuter dans Supabase SQL Editor
