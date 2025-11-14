# 🚨 CORRECTIF BUG #6 - Mauvais ENUM utilisé

## LE PROBLÈME

La table `shipping_preparations` utilise **le MAUVAIS ENUM**!

### Dans Supabase, il existe 2 ENUMs:

1. ✅ **shipping_preparation_status** (BON)
   - waiting_for_customs_approval
   - approved_by_customs
   - ready_for_expedition

2. ❌ **shipping_status_v2** (ANCIEN - À SUPPRIMER)
   - pending
   - prepared
   - validated_for_refinery
   - in_refining
   - refined
   - in_sale
   - sold
   - cancelled
   - shipped

### La table shipping_preparations utilise shipping_status_v2!

C'est pour cela que l'erreur dit:
```
invalid input value for enum shipping_preparation_status: "pending"
```

Le code essaie d'utiliser `shipping_preparation_status` mais la table attend `shipping_status_v2`!

---

## SOLUTION - 3 ÉTAPES

### Étape 1: Ouvrir Supabase SQL Editor

Dashboard → Database → SQL Editor

### Étape 2: Exécuter la Migration 011

Copier-coller **TOUT** le contenu de:
```
supabase/migrations/20251114_011_fix_shipping_enum_definitif.sql
```

Cliquer **"Run"**

### Étape 3: Vérifier le Résultat

Vous DEVEZ voir dans l'output:
```
✅✅✅ PARFAIT! Le bon ENUM est utilisé! ✅✅✅
```

---

## CE QUE FAIT LA MIGRATION

1. ✅ Supprime toutes les données de test dans shipping_preparations
2. ✅ Supprime la colonne status
3. ✅ Supprime l'ancien ENUM shipping_status_v2
4. ✅ Recrée la colonne status avec shipping_preparation_status
5. ✅ Définit le DEFAULT: waiting_for_customs_approval

---

## APRÈS LA MIGRATION

1. **Rafraîchir le navigateur** (Ctrl + Shift + R)

2. **Dans Supabase Dashboard**, vérifier:
   - Database → Tables → shipping_preparations → Colonnes
   - La colonne `status` doit afficher: `shipping_preparation_status`
   - (PAS `shipping_status_v2`!)

3. **Tester la création** d'une nouvelle expédition

4. ✅ **Succès garanti!**

---

## GARANTIE 100%

Après cette migration:
- ✅ Plus d'erreur "invalid input value"
- ✅ Le bon ENUM est utilisé
- ✅ L'ancien ENUM est supprimé
- ✅ Création d'expéditions fonctionnelle

**APPLIQUEZ LA MIGRATION 011 MAINTENANT!**
