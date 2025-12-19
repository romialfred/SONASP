# Guide de Déploiement - Système d'Inventaire et Améliorations Ventes

## 🚀 Quick Start (5 Minutes)

### Étape 1: Appliquer Migration SQL (2 min)

**Fichiers à exécuter dans Supabase SQL Editor (dans cet ordre):**

1. `ADD_LOGOS_AND_MANSA_RESOURCES.sql`
   - Ajoute colonnes logo_url
   - Crée client Mansa Resources
   - Configure logos mines

2. `CREATE_INVENTORY_TRANSACTIONS_SYSTEM.sql`
   - Crée table inventory_transactions
   - Crée indexes et vue
   - Configure RLS

**Comment appliquer:**
```bash
# 1. Ouvrir Supabase Dashboard
# 2. Aller dans SQL Editor
# 3. Créer nouveau query
# 4. Copier-coller contenu fichier SQL
# 5. Cliquer "Run"
# 6. Vérifier succès (pas d'erreurs rouges)
# 7. Répéter pour second fichier
```

### Étape 2: Ajouter Logos Mines (2 min)

**Créer dossier et ajouter fichiers:**
```
/public/logos/
  ├── kouroussa-logo.png  (300x120px)
  ├── dugbe-logo.png      (300x120px)
  └── smk-logo.png        (300x120px)
```

**Spécifications:**
- Format: PNG transparent
- Taille: 300x120 pixels
- Poids: < 100KB
- Nom exactement comme indiqué

### Étape 3: Vérifier Build (1 min)

```bash
npm run build
# Doit réussir sans erreurs
```

### Étape 4: Test Fonctionnel (1 min)

1. **Trade Space:**
   - ✅ Quantité à 100% pré-remplie
   - ✅ Champ verrouillé (amber)
   - ✅ Bouton "Simulate" actif
   - ✅ Mansa Resources pré-sélectionné

2. **Création Vente:**
   - ✅ Créer une vente test
   - ✅ Vérifier succès
   - ✅ Pas d'erreur console

3. **Vérifier Transactions:**
   ```sql
   SELECT * FROM inventory_transactions
   ORDER BY created_at DESC LIMIT 5;
   ```

## 📋 Checklist Complète

### Pré-Déploiement

- [ ] Backup base de données
- [ ] Vérifier que Supabase est accessible
- [ ] Avoir accès SQL Editor
- [ ] Avoir logos mines prêts
- [ ] Code fusionné dans main branch

### Déploiement

#### Base de Données

- [ ] **Migration 1:** ADD_LOGOS_AND_MANSA_RESOURCES.sql
  - [ ] Script exécuté sans erreur
  - [ ] Colonnes logo_url créées
  - [ ] Client Mansa Resources créé
  - [ ] Vérifier: `SELECT * FROM customers WHERE name LIKE '%Mansa%';`

- [ ] **Migration 2:** CREATE_INVENTORY_TRANSACTIONS_SYSTEM.sql
  - [ ] Table inventory_transactions créée
  - [ ] Indexes créés
  - [ ] Vue inventory_balances créée
  - [ ] Fonction get_entity_inventory_balance créée
  - [ ] RLS activé et policies créées
  - [ ] Vérifier: `SELECT * FROM inventory_transactions LIMIT 1;`

#### Assets

- [ ] Dossier `/public/logos/` créé
- [ ] Logo kouroussa-logo.png ajouté
- [ ] Logo dugbe-logo.png ajouté
- [ ] Logo smk-logo.png ajouté
- [ ] Vérifier: Logos accessibles via browser

#### Application

- [ ] Build réussi: `npm run build`
- [ ] Pas d'erreurs TypeScript
- [ ] Pas d'erreurs console
- [ ] Bundle size acceptable (<5MB)

### Post-Déploiement

#### Tests Interface

- [ ] **Trade Space**
  - [ ] Sélectionner mine avec stock
  - [ ] Quantité pré-remplie à 100%
  - [ ] Badge "100%" visible
  - [ ] Champ en lecture seule (amber)
  - [ ] Message politique affiché
  - [ ] Bouton "Simulate" actif et cliquable

- [ ] **Sélection Client**
  - [ ] Mansa Resources pré-sélectionné
  - [ ] Badge "Default" visible
  - [ ] Sélecteur désactivé (amber)
  - [ ] Message politique affiché

- [ ] **Diagramme Flux**
  - [ ] Visible en bas de page
  - [ ] 3 mines affichées
  - [ ] Mansa Resources au centre
  - [ ] Auramet et clients finaux à droite
  - [ ] Pourcentages corrects (100%, 5%, 2%)

#### Tests Fonctionnels

- [ ] **Simulation Vente**
  - [ ] Bouton "Simulate" fonctionne
  - [ ] Calculs affichés
  - [ ] Pas d'erreur

- [ ] **Création Vente**
  - [ ] Formulaire accessible
  - [ ] Tous champs pré-remplis
  - [ ] Validation fonctionne
  - [ ] Bouton "Create Sale" actif

- [ ] **Vente Complète**
  - [ ] Créer vente test
  - [ ] Message succès affiché
  - [ ] Redirection vers /sales
  - [ ] Vente visible dans liste

#### Tests Base de Données

- [ ] **Vérifier Vente**
  ```sql
  SELECT * FROM sales
  ORDER BY created_at DESC LIMIT 1;
  ```

- [ ] **Vérifier Transactions Inventaire**
  ```sql
  -- Doit retourner 2 lignes (exit + entry)
  SELECT * FROM inventory_transactions
  WHERE reference_type = 'sale'
  ORDER BY created_at DESC LIMIT 2;
  ```

- [ ] **Vérifier Transaction SORTIE**
  ```sql
  -- Quantité négative pour la mine
  SELECT * FROM inventory_transactions
  WHERE transaction_type = 'exit'
  AND entity_type = 'mining_company'
  ORDER BY created_at DESC LIMIT 1;
  ```

- [ ] **Vérifier Transaction ENTRÉE**
  ```sql
  -- Quantité positive pour Mansa
  SELECT * FROM inventory_transactions
  WHERE transaction_type = 'entry'
  AND entity_type = 'customer'
  ORDER BY created_at DESC LIMIT 1;
  ```

- [ ] **Vérifier Balances**
  ```sql
  SELECT * FROM inventory_balances;
  ```

#### Tests Sécurité

- [ ] RLS activé sur inventory_transactions
- [ ] Utilisateur non-admin ne peut pas delete
- [ ] Logs audit fonctionnent
- [ ] Pas de données sensibles exposées

## 🐛 Dépannage

### Problème 1: Migration SQL Échoue

**Symptôme:** Erreur lors exécution SQL

**Solutions:**
```sql
-- Vérifier si table existe déjà
SELECT table_name FROM information_schema.tables
WHERE table_name = 'inventory_transactions';

-- Si existe, dropper et recréer
DROP TABLE IF EXISTS inventory_transactions CASCADE;
-- Puis réexécuter migration
```

### Problème 2: Bouton Simulate Désactivé

**Symptôme:** Bouton reste grisé

**Solutions:**
1. Vérifier console browser (F12)
2. Vérifier que mine a du stock
3. Rafraîchir page (Ctrl+F5)
4. Vider cache: `localStorage.clear()`

### Problème 3: Mansa Resources Non Pré-sélectionné

**Symptôme:** Dropdown client vide ou autre client

**Solutions:**
```sql
-- Vérifier client existe
SELECT * FROM customers
WHERE name LIKE '%Mansa%';

-- Si n'existe pas, exécuter:
-- ADD_LOGOS_AND_MANSA_RESOURCES.sql
```

### Problème 4: Transactions Non Créées

**Symptôme:** Vente OK mais pas de transactions

**Solutions:**
1. Vérifier console browser pour erreurs
2. Vérifier table existe:
   ```sql
   SELECT * FROM information_schema.tables
   WHERE table_name = 'inventory_transactions';
   ```
3. Vérifier RLS:
   ```sql
   SELECT * FROM pg_policies
   WHERE tablename = 'inventory_transactions';
   ```
4. Test manuel:
   ```sql
   INSERT INTO inventory_transactions (
     transaction_type, entity_type, entity_id,
     quantity_oz, quantity_grams
   ) VALUES (
     'entry', 'customer', 'test-uuid',
     100.0, 3110.35
   );
   ```

### Problème 5: Logos Non Affichés

**Symptôme:** Facture sans logos

**Solutions:**
1. Vérifier chemins fichiers:
   ```bash
   ls -la public/logos/
   ```
2. Vérifier accessibilité:
   ```
   http://localhost:5173/logos/kouroussa-logo.png
   ```
3. Vérifier DB:
   ```sql
   SELECT name, logo_url FROM mining_companies;
   SELECT name, logo_url FROM customers WHERE name LIKE '%Mansa%';
   ```

### Problème 6: Build Échoue

**Symptôme:** `npm run build` avec erreurs

**Solutions:**
```bash
# Nettoyer
rm -rf node_modules/.vite dist

# Rebuild
npm run build

# Si erreur TypeScript
npm run typecheck

# Si problème imports
grep -r "inventoryTransactionService" src/
```

## 📊 Métriques de Succès

Après déploiement, vérifier:

### Technique
- ✅ 0 erreur console
- ✅ Build < 30 secondes
- ✅ Bundle < 5MB
- ✅ Lighthouse score > 90

### Fonctionnel
- ✅ 100% ventes créent transactions
- ✅ 0% erreur utilisateur sur quantité
- ✅ 0% mauvais client sélectionné
- ✅ Temps création vente: -70%

### Base de Données
- ✅ 2 transactions par vente
- ✅ Balances cohérentes
- ✅ RLS actif
- ✅ Pas de transactions orphelines

## 📞 Support

### En Cas de Problème

1. **Vérifier logs:**
   - Console browser (F12)
   - Supabase logs
   - Network tab

2. **Consulter documentation:**
   - INVENTORY_TRANSACTION_SYSTEM_COMPLETE.md
   - SALES_PROCESS_IMPROVEMENTS_IMPLEMENTATION.md
   - VISUAL_GUIDE_SALES_IMPROVEMENTS.md

3. **Tests diagnostic:**
   ```sql
   -- État système
   SELECT 'inventory_transactions' as table_name, COUNT(*) as count
   FROM inventory_transactions
   UNION ALL
   SELECT 'inventory_balances', COUNT(*)
   FROM inventory_balances
   UNION ALL
   SELECT 'customers (Mansa)', COUNT(*)
   FROM customers WHERE name LIKE '%Mansa%';
   ```

4. **Rollback si nécessaire:**
   ```sql
   -- Supprimer transactions test
   DELETE FROM inventory_transactions
   WHERE created_at > 'YYYY-MM-DD HH:MM:SS';

   -- Désactiver temporairement
   -- (Commenter l'appel dans SaleCreate.tsx)
   ```

## ✅ Validation Finale

Une fois tout déployé, faire un test end-to-end complet:

1. ✅ Login application
2. ✅ Aller Trade Space
3. ✅ Sélectionner mine avec stock
4. ✅ Vérifier quantité 100% pré-remplie
5. ✅ Vérifier Mansa pré-sélectionné
6. ✅ Cliquer "Simulate"
7. ✅ Vérifier calculs
8. ✅ Cliquer "Continue to Sale Form"
9. ✅ Vérifier formulaire pré-rempli
10. ✅ Calculer montants
11. ✅ Créer vente
12. ✅ Vérifier succès
13. ✅ Vérifier vente dans liste
14. ✅ Vérifier transactions inventaire en DB
15. ✅ Vérifier balances mises à jour

## 🎉 Félicitations !

Si tous les tests passent, le système est prêt en production !

**Prochaines étapes:**
- Former les utilisateurs
- Monitorer les premières ventes
- Collecter feedback
- Ajuster si nécessaire

---

**Status:** ✅ Ready for Production
**Estimated Deployment Time:** 10-15 minutes
**Risk Level:** 🟢 Low (backward compatible)
**Rollback Available:** ✅ Yes
