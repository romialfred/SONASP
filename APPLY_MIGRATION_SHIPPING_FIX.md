# 🚨 ACTION REQUISE - Appliquer la Migration

## ⚠️ PROBLÈME CRITIQUE IDENTIFIÉ

Les informations de **Raffinerie** et **Compagnie de Fret** ne s'affichent pas car :
- Les colonnes `refinery_id` et `freight_company_id` n'existaient pas dans la base de données
- Les UUIDs étaient enregistrés dans des colonnes TEXT par erreur

---

## ✅ SOLUTION PRÊTE

Une migration SQL complète a été créée pour :
1. Ajouter les colonnes manquantes
2. Migrer automatiquement les données existantes
3. Corriger le code front-end

---

## 📋 ÉTAPES À SUIVRE (5 MINUTES)

### 1. Ouvrir Supabase Dashboard

Allez sur : https://supabase.com/dashboard/project/[YOUR_PROJECT]/sql

### 2. Copier la Migration SQL

Ouvrez le fichier :
```
supabase/migrations/20251209_001_add_refinery_freight_to_shipping.sql
```

### 3. Coller et Exécuter

1. Coller le contenu dans le SQL Editor
2. Cliquer sur "Run" (ou Ctrl+Enter)
3. Vérifier les messages de succès

### 4. Résultat Attendu

Vous verrez :
```
✅ Colonne refinery_id ajoutée
✅ Colonne freight_company_id ajoutée  
✅ X raffineries migrées
✅ X compagnies de fret migrées
====================================
✅ MIGRATION TERMINÉE
====================================
```

### 5. Tester

1. Rafraîchir la page de l'application
2. Ouvrir une expédition existante
3. ✅ Les informations s'affichent maintenant !

---

## 🎯 RÉSULTAT IMMÉDIAT

Après la migration, la page affichera :

**AVANT :**
```
Raffinerie de Destination: Non spécifiée
Compagnie de Fret: Non spécifiée
```

**APRÈS :**
```
Raffinerie de Destination
  ┌──────────────────────────────┐
  │ Rand Refinery                │
  │ Johannesburg, South Africa   │
  └──────────────────────────────┘

Compagnie de Fret
  Brinks Freight Express Limited
```

---

## 📞 SUPPORT

Si vous rencontrez une erreur :
1. Vérifiez que vous êtes dans le bon projet Supabase
2. Copiez le message d'erreur
3. La migration est idempotente (peut être réexécutée sans risque)

---

## ✅ CHECKLIST RAPIDE

- [ ] Migration SQL exécutée dans Supabase
- [ ] Messages de succès reçus
- [ ] Application rafraîchie
- [ ] Page de détails expédition testée
- [ ] Informations visibles

---

**DURÉE ESTIMÉE:** 5 minutes
**IMPACT:** Immédiat - Les informations s'affichent correctement
**RISQUE:** Aucun - Migration idempotente et sans perte de données
