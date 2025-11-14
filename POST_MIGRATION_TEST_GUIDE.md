# 📋 GUIDE DE TEST POST-MIGRATION 011

## Objectif
Valider que la migration 011 a été appliquée correctement et que le module Shipping fonctionne sans erreur.

---

## PARTIE 1: VALIDATION BASE DE DONNÉES

### Test 1.1: Vérifier les ENUMs

**Commande SQL:**
```sql
SELECT
    typname as enum_name,
    array_agg(enumlabel ORDER BY enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname LIKE '%shipping%status%'
GROUP BY typname
ORDER BY typname;
```

**Résultat attendu:**
- ✅ `shipping_preparation_status` existe avec: `{waiting_for_customs_approval, approved_by_customs, ready_for_expedition}`
- ✅ `shipping_status_v2` N'EXISTE PAS (ou affiche rien)

**Statut:** [ ] PASS [ ] FAIL

---

### Test 1.2: Vérifier le type de colonne

**Commande SQL:**
```sql
SELECT
    column_name,
    data_type,
    udt_name as enum_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'shipping_preparations'
AND column_name = 'status';
```

**Résultat attendu:**
- ✅ `data_type: USER-DEFINED`
- ✅ `enum_type: shipping_preparation_status`
- ✅ `column_default: 'waiting_for_customs_approval'::shipping_preparation_status`

**Statut:** [ ] PASS [ ] FAIL

---

### Test 1.3: Test d'insertion SQL

**Commande SQL:**
```sql
-- Test d'insertion
INSERT INTO shipping_preparations (
    mining_company_id,
    status
) VALUES (
    (SELECT id FROM mining_companies LIMIT 1),
    'waiting_for_customs_approval'::shipping_preparation_status
)
RETURNING id, status;

-- Nettoyer le test
DELETE FROM shipping_preparations WHERE id = (SELECT id FROM shipping_preparations ORDER BY created_at DESC LIMIT 1);
```

**Résultat attendu:**
- ✅ Insertion réussie sans erreur
- ✅ Statut retourné: `waiting_for_customs_approval`

**Statut:** [ ] PASS [ ] FAIL

---

### Test 1.4: Vérifier les contraintes

**Commande SQL:**
```sql
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'shipping_preparations'::regclass
AND contype = 'c'
AND pg_get_constraintdef(oid) ILIKE '%status%';
```

**Résultat attendu:**
- ✅ AUCUNE contrainte CHECK sur status (résultat vide)
- ✅ Seules les contraintes NOT NULL peuvent exister

**Statut:** [ ] PASS [ ] FAIL

---

## PARTIE 2: VALIDATION APPLICATION

### Test 2.1: Rafraîchir le navigateur

**Actions:**
1. Ouvrir l'application Gold Shipper
2. Appuyer sur **Ctrl + Shift + R** (ou Cmd + Shift + R sur Mac)
3. Attendre le rechargement complet

**Résultat attendu:**
- ✅ Page se recharge sans erreur
- ✅ Pas d'erreur dans la console (F12)

**Statut:** [ ] PASS [ ] FAIL

---

### Test 2.2: Navigation vers Shipping

**Actions:**
1. Se connecter avec un compte autorisé
2. Naviguer vers **Shipping → Préparations d'Expédition**

**Résultat attendu:**
- ✅ Page se charge sans erreur
- ✅ Liste des expéditions s'affiche (vide ou avec données)
- ✅ Bouton "Nouvelle Expédition" visible

**Statut:** [ ] PASS [ ] FAIL

---

### Test 2.3: Créer une nouvelle expédition

**Actions:**
1. Cliquer sur **"Nouvelle Expédition"**
2. Remplir le formulaire:
   - Sélectionner une compagnie minière
   - Sélectionner une production (statut "Prêt pour Douane")
   - Ajouter un numéro de lot: `TEST-BATCH-001`
   - Ajouter un numéro de scellé: `SEAL-001`
3. Cliquer sur **"Sauvegarder"**

**Résultat attendu:**
- ✅ Formulaire se soumet sans erreur
- ✅ Message de succès affiché: "Expédition créée avec succès"
- ✅ Redirection vers la liste ou les détails
- ✅ Aucune erreur dans la console navigateur

**Statut:** [ ] PASS [ ] FAIL

---

### Test 2.4: Vérifier le statut initial

**Actions:**
1. Dans la liste des expéditions, trouver l'expédition créée
2. Observer le badge de statut

**Résultat attendu:**
- ✅ Badge affiché: **"En Attente Douane"** (jaune/orange)
- ✅ Statut technique: `waiting_for_customs_approval`

**Statut:** [ ] PASS [ ] FAIL

---

### Test 2.5: Voir les détails de l'expédition

**Actions:**
1. Cliquer sur l'expédition créée
2. Observer la page de détails

**Résultat attendu:**
- ✅ Page de détails se charge
- ✅ Toutes les informations affichées
- ✅ Workflow de statut visible
- ✅ Statut actuel surligné: "En Attente Douane"

**Statut:** [ ] PASS [ ] FAIL

---

### Test 2.6: Changer le statut (si autorisé)

**Actions:**
1. Sur la page de détails, cliquer sur **"Changer Statut"**
2. Sélectionner **"Approuvé par Douane"**
3. Ajouter une note: `Test d'approbation douane`
4. Confirmer

**Résultat attendu:**
- ✅ Statut change sans erreur
- ✅ Badge mis à jour: **"Approuvé par Douane"** (vert)
- ✅ Historique des statuts mis à jour
- ✅ Notification de succès

**Statut:** [ ] PASS [ ] FAIL

---

### Test 2.7: Changer vers "Prêt pour Expédition"

**Actions:**
1. Cliquer à nouveau sur **"Changer Statut"**
2. Sélectionner **"Prêt pour Expédition"**
3. Ajouter une note: `Test prêt pour expédition`
4. Confirmer

**Résultat attendu:**
- ✅ Statut change sans erreur
- ✅ Badge mis à jour: **"Prêt pour Expédition"** (bleu)
- ✅ Historique complet visible avec 3 entrées
- ✅ Workflow complet fonctionnel

**Statut:** [ ] PASS [ ] FAIL

---

## PARTIE 3: TESTS DE NON-RÉGRESSION

### Test 3.1: Module Production

**Actions:**
1. Naviguer vers **Production → Production Journalière**
2. Créer une nouvelle production
3. Changer le statut vers "Prêt pour Douane"

**Résultat attendu:**
- ✅ Production créée sans erreur
- ✅ Statut change correctement
- ✅ Aucune interférence avec Shipping

**Statut:** [ ] PASS [ ] FAIL

---

### Test 3.2: Filtre par statut

**Actions:**
1. Retourner à **Shipping → Préparations d'Expédition**
2. Utiliser le filtre de statut
3. Filtrer par "En Attente Douane"
4. Filtrer par "Approuvé par Douane"

**Résultat attendu:**
- ✅ Filtres fonctionnent correctement
- ✅ Résultats appropriés affichés
- ✅ Aucune erreur de filtrage

**Statut:** [ ] PASS [ ] FAIL

---

### Test 3.3: Recherche

**Actions:**
1. Utiliser la barre de recherche
2. Chercher par numéro de lot: `TEST-BATCH-001`

**Résultat attendu:**
- ✅ Recherche fonctionne
- ✅ Expédition de test trouvée

**Statut:** [ ] PASS [ ] FAIL

---

## PARTIE 4: TESTS CONSOLE & RÉSEAU

### Test 4.1: Console navigateur

**Actions:**
1. Ouvrir la console (F12 → Console)
2. Effectuer toutes les actions ci-dessus
3. Observer les messages

**Résultat attendu:**
- ✅ Aucune erreur rouge dans la console
- ✅ Pas de message "invalid input value for enum"
- ✅ Warnings acceptables (bundle size, etc.)

**Statut:** [ ] PASS [ ] FAIL

---

### Test 4.2: Requêtes réseau

**Actions:**
1. Ouvrir l'onglet Network (F12 → Network)
2. Créer une expédition
3. Observer les requêtes

**Résultat attendu:**
- ✅ Requête POST vers Supabase: Status 201
- ✅ Payload contient `status: "waiting_for_customs_approval"`
- ✅ Aucune requête en erreur (4xx, 5xx)

**Statut:** [ ] PASS [ ] FAIL

---

## PARTIE 5: NETTOYAGE

### Test 5.1: Supprimer les données de test

**Actions:**
1. Dans Supabase SQL Editor:
```sql
-- Supprimer les expéditions de test
DELETE FROM shipping_preparations
WHERE batch_numbers LIKE '%TEST%';
```

**Résultat attendu:**
- ✅ Données de test supprimées
- ✅ Base propre pour production

**Statut:** [ ] PASS [ ] FAIL

---

## RÉCAPITULATIF

### Résultats Partie 1 (Base de Données)
- [ ] Test 1.1: Vérifier les ENUMs
- [ ] Test 1.2: Vérifier le type de colonne
- [ ] Test 1.3: Test d'insertion SQL
- [ ] Test 1.4: Vérifier les contraintes

**Partie 1:** [ ] TOUS PASS [ ] AU MOINS UN FAIL

---

### Résultats Partie 2 (Application)
- [ ] Test 2.1: Rafraîchir le navigateur
- [ ] Test 2.2: Navigation vers Shipping
- [ ] Test 2.3: Créer une nouvelle expédition
- [ ] Test 2.4: Vérifier le statut initial
- [ ] Test 2.5: Voir les détails
- [ ] Test 2.6: Changer le statut (Approuvé)
- [ ] Test 2.7: Changer vers Prêt pour Expédition

**Partie 2:** [ ] TOUS PASS [ ] AU MOINS UN FAIL

---

### Résultats Partie 3 (Non-Régression)
- [ ] Test 3.1: Module Production
- [ ] Test 3.2: Filtre par statut
- [ ] Test 3.3: Recherche

**Partie 3:** [ ] TOUS PASS [ ] AU MOINS UN FAIL

---

### Résultats Partie 4 (Console & Réseau)
- [ ] Test 4.1: Console navigateur
- [ ] Test 4.2: Requêtes réseau

**Partie 4:** [ ] TOUS PASS [ ] AU MOINS UN FAIL

---

### Résultats Partie 5 (Nettoyage)
- [ ] Test 5.1: Supprimer les données de test

**Partie 5:** [ ] PASS [ ] FAIL

---

## STATUT FINAL

- **Tests Base de Données:** [ ] ✅ [ ] ❌
- **Tests Application:** [ ] ✅ [ ] ❌
- **Tests Non-Régression:** [ ] ✅ [ ] ❌
- **Tests Console/Réseau:** [ ] ✅ [ ] ❌
- **Nettoyage:** [ ] ✅ [ ] ❌

---

## CONCLUSION

**Migration 011 validée:** [ ] OUI [ ] NON

**Système prêt pour production:** [ ] OUI [ ] NON

**Date de test:** ___________________

**Testeur:** ___________________

**Signature:** ___________________

---

## EN CAS D'ÉCHEC

Si UN SEUL test échoue:

1. **NE PAS déployer en production**
2. **Consulter:** `SHIPPING_ENUM_RESOLUTION_COMPLETE.md`
3. **Exécuter:** `scripts/verify-shipping-enum-final.sql`
4. **Vérifier:** Que la migration 011 a été complètement appliquée
5. **Contacter:** L'équipe de développement

---

**Ce guide doit être complété AVANT toute mise en production du module Shipping.**
