# Guide d'Application - DEPOSITOR_FIX.sql

## 📍 Fichier SQL
**Emplacement**: `DEPOSITOR_FIX.sql` (racine du projet)

---

## 🎯 Objectif
Corriger le doublon de **GEOFFREY Peter Eye** et empêcher les futurs doublons de dépositaires.

---

## 📋 Étapes d'Application

### Étape 1: Ouvrir Supabase SQL Editor

1. Connectez-vous à votre projet Supabase
2. Dans le menu latéral, cliquez sur **SQL Editor**
3. Cliquez sur **New Query**

### Étape 2: Copier le Script

1. Ouvrez le fichier `DEPOSITOR_FIX.sql` dans votre éditeur
2. Copiez **TOUT** le contenu du fichier (Ctrl+A, Ctrl+C)

### Étape 3: Exécuter le Script

1. Collez le script dans l'éditeur SQL de Supabase
2. Cliquez sur **Run** (ou appuyez sur Ctrl+Enter)
3. Attendez l'exécution (quelques secondes)

### Étape 4: Vérifier les Résultats

Le script affichera des messages comme :

```
=== Starting Depositor Duplicate Fix ===

✅ Kouroussa mining company found
   ID: abc123...

--- Looking for GEOFFREY Peter Eye records ---
📋 Record: GEOFFREY Peter Eye | Title | Company: SMK Finance | Created: 2024-...
📋 Record: GEOFFREY Peter Eye | Title | Company: SMK Finance | Created: 2024-...

⚠️  Duplicate found in company: SMK Finance

--- Updating duplicate record ---
✅ Updated duplicate record to KOUROUSSA mine
   Record ID: xyz789...

--- Adding unique constraint ---
✅ Constraint added: depositors_unique_person_company_category
   Columns: (mining_company_id, category, full_name)

✅ Performance index created: idx_depositors_company_category

=== Final Depositor List for GEOFFREY Peter Eye ===

1 ✓ GEOFFREY Peter Eye | Title | Company: KOUROUSSA
2 ✓ GEOFFREY Peter Eye | Title | Company: SMK Finance

=== Summary ===
Total records: 2

✅ Script completed successfully!
```

---

## ✅ Vérifications

### Si Tout Est OK, Vous Devriez Voir:

- ✅ "Kouroussa mining company found"
- ✅ "Updated duplicate record to KOUROUSSA mine"
- ✅ "Constraint added"
- ✅ Deux enregistrements pour GEOFFREY (un pour chaque compagnie)

### Si Problème:

#### ⚠️ "Kouroussa mining company not found"
**Solution**:
1. Vérifiez que la compagnie "KOUROUSSA" existe dans votre base
2. Ou modifiez le script pour utiliser une autre compagnie

#### ❌ "Cannot add constraint due to existing duplicates"
**Solution**:
1. D'autres doublons existent dans la table
2. Exécutez d'abord cette requête pour les trouver:
```sql
SELECT full_name, mining_company_id, category, COUNT(*)
FROM depositors
GROUP BY full_name, mining_company_id, category
HAVING COUNT(*) > 1;
```
3. Supprimez manuellement les doublons
4. Réexécutez le script

---

## 🧪 Tests Après Application

### Test 1: Essayer de Créer un Doublon

1. Allez sur la page de création de dépositaire
2. Sélectionnez une compagnie (ex: SMK Finance)
3. Choisissez une catégorie (ex: General Management)
4. Entrez un nom qui existe déjà pour cette compagnie + catégorie
5. Essayez de sauvegarder

**Résultat Attendu**:
```
⚠️ Duplicate Depositor Warning
This person is already registered for this company with the same category/role...
```

### Test 2: Créer avec Catégorie Différente (Doit Réussir)

1. Même compagnie
2. Même nom
3. **Catégorie différente** ✓

**Résultat Attendu**: Création réussie ✅

### Test 3: Créer pour Compagnie Différente (Doit Réussir)

1. **Compagnie différente** ✓
2. Même nom
3. Même catégorie

**Résultat Attendu**: Création réussie ✅

---

## 🔍 Requêtes Utiles

### Voir Tous les Dépositaires d'une Personne

```sql
SELECT d.full_name, mc.name as company, d.category, d.job_title
FROM depositors d
LEFT JOIN mining_companies mc ON d.mining_company_id = mc.id
WHERE d.full_name ILIKE '%geoffrey%peter%'
ORDER BY mc.name, d.category;
```

### Vérifier la Contrainte

```sql
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'depositors_unique_person_company_category';
```

### Voir Tous les Doublons (Doit Retourner 0)

```sql
SELECT full_name, mc.name as company, category, COUNT(*)
FROM depositors d
LEFT JOIN mining_companies mc ON d.mining_company_id = mc.id
GROUP BY full_name, mc.name, category
HAVING COUNT(*) > 1;
```

---

## 📝 Ce Que le Script Fait

### 1. Correction du Doublon ✅
- Trouve les enregistrements de GEOFFREY Peter Eye
- Identifie le doublon (2ème par date de création)
- Met à jour le doublon vers KOUROUSSA

### 2. Protection Future ✅
- Ajoute contrainte unique: `(mining_company_id, category, full_name)`
- Crée un index de performance
- Empêche la création de doublons

### 3. Validation ✅
- Affiche tous les enregistrements trouvés
- Confirme la mise à jour
- Montre le résultat final

---

## 🚨 Important

### Ce Qui Est Permis:
✅ Même personne dans **compagnies différentes**
✅ Même personne avec **catégories différentes** dans même compagnie

### Ce Qui Est Bloqué:
❌ Même personne + même compagnie + même catégorie

---

## 🎯 Résultat Attendu

Après l'application du script:

**GEOFFREY Peter Eye aura 2 enregistrements**:
1. SMK Finance - General Management ✅
2. KOUROUSSA - General Management ✅

**Aucun doublon dans la même compagnie** ✅

---

## 💡 Support

Si vous rencontrez des problèmes:

1. Vérifiez les messages NOTICE du script
2. Consultez le fichier `DEPOSITOR_DUPLICATE_PREVENTION.md` pour plus de détails
3. Exécutez les requêtes de vérification ci-dessus
4. Vérifiez que la contrainte a bien été créée

---

## ✅ Checklist Finale

- [ ] Script exécuté avec succès
- [ ] Messages "✅ Script completed successfully!" affiché
- [ ] GEOFFREY Peter Eye a 2 enregistrements (un par compagnie)
- [ ] Contrainte unique créée
- [ ] Test de doublon bloqué par le frontend
- [ ] Test de catégorie différente fonctionne
- [ ] Test de compagnie différente fonctionne

---

**Une fois tous ces points validés, la protection contre les doublons est active !** 🎉
