# 🚀 Guide Rapide - Exécution de la Migration Shipping

## ⏱️ Temps Estimé: 5 minutes

## 📋 Étape 1: Vérifier l'État Actuel (1 min)

### Via Supabase Dashboard
1. Ouvrir Supabase Dashboard
2. Aller dans **Database** > **SQL Editor**
3. Copier/coller le contenu de `scripts/check-migrations-status.sql`
4. Cliquer sur **Run**
5. Lire les résultats

**Résultat Attendu:**
```
❌ Table shipping_status_history N'EXISTE PAS - Migration 20251114_006 à exécuter
```

Si vous voyez `✅ Table shipping_status_history existe`, la migration est déjà exécutée. Vous pouvez arrêter ici.

---

## 📦 Étape 2: Exécuter la Migration (2 min)

### Méthode A: Via Supabase Dashboard (Recommandé)

1. Rester dans **Database** > **SQL Editor**
2. Ouvrir le fichier `supabase/migrations/20251114_006_add_shipping_status_history.sql`
3. Copier **TOUT** le contenu du fichier
4. Coller dans l'éditeur SQL
5. Cliquer sur **Run**
6. Attendre le message de succès

**Résultat Attendu:**
```
✅ Success. No rows returned
```

### Méthode B: Via psql (Alternative)

```bash
# Remplacer YOUR_CONNECTION_STRING par votre vraie string
psql "YOUR_CONNECTION_STRING" < supabase/migrations/20251114_006_add_shipping_status_history.sql
```

**Résultat Attendu:**
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
ALTER TABLE
CREATE POLICY
CREATE POLICY
CREATE FUNCTION
CREATE TRIGGER
```

---

## ✅ Étape 3: Vérifier l'Exécution (1 min)

### Relancer le Script de Vérification

1. Dans **SQL Editor**, exécuter à nouveau `scripts/check-migrations-status.sql`
2. Vérifier les résultats

**Résultat Attendu:**
```
✅ Table shipping_status_history existe
✅ Tous les indexes sont présents (3)
✅ Trigger shipping_status_change_trigger existe
✅ Toutes les RLS policies sont présentes (2)
✅ Fonction create_shipping_status_history_on_update existe

═══════════════════════════════════════════════════════
📋 RÉSUMÉ DE LA MIGRATION 20251114_006
═══════════════════════════════════════════════════════

État: ✅ MIGRATION COMPLÈTE ET FONCTIONNELLE
```

---

## 🧪 Étape 4: Tester le Fonctionnement (1 min)

### Test Simple

Dans **SQL Editor**, exécuter:

```sql
-- Test 1: Vérifier qu'on peut lire la table
SELECT COUNT(*) as total_entries
FROM shipping_status_history;

-- Résultat attendu: 0 (table vide mais fonctionnelle)

-- Test 2: Trouver une shipping preparation existante
SELECT id, status
FROM shipping_preparations
LIMIT 1;

-- Noter l'ID retourné (exemple: 42bb8caf-e19c-4283-9280-1df6513834eb)

-- Test 3: Changer le statut pour déclencher le trigger
-- REMPLACER 'id-de-votre-shipping' par l'ID noté ci-dessus
UPDATE shipping_preparations
SET status = 'prepared'
WHERE id = 'id-de-votre-shipping';

-- Test 4: Vérifier que l'historique a été créé automatiquement
SELECT
    id,
    old_status,
    new_status,
    changed_at,
    notes
FROM shipping_status_history
ORDER BY changed_at DESC
LIMIT 5;

-- Résultat attendu: Une ligne avec le changement de statut
```

---

## 🌐 Étape 5: Tester dans l'Interface (1 min)

1. Ouvrir l'application Gold Shipper
2. Aller dans **Shipping** > **Preparations**
3. Cliquer sur n'importe quelle expédition
4. **RÉSULTAT ATTENDU:**
   - ✅ La page se charge sans erreur
   - ✅ Le workflow de statut s'affiche
   - ✅ L'historique s'affiche sur la droite
   - ✅ Vous pouvez changer le statut

Si tout fonctionne: **🎉 SUCCÈS!**

---

## 📝 Étape 6: Mettre à Jour la Documentation

1. Ouvrir `MIGRATIONS_TO_EXECUTE_NOW.md`
2. Changer le statut de la migration:
   ```markdown
   | 2025-11-14 | `20251114_006_add_shipping_status_history.sql` | Historique shipping | ✅ Exécutée |
   ```
3. Mettre à jour la date de dernière mise à jour en bas du fichier
4. Committer les changements:
   ```bash
   git add MIGRATIONS_TO_EXECUTE_NOW.md
   git commit -m "docs: Mark migration 20251114_006 as executed"
   git push
   ```

---

## 🚨 En Cas de Problème

### Erreur: "relation already exists"
**Cause:** La migration a déjà été exécutée partiellement.

**Solution:**
```sql
-- Vérifier ce qui existe déjà
SELECT tablename FROM pg_tables WHERE tablename = 'shipping_status_history';

-- Si la table existe mais trigger manque, continuer la migration
-- en commentant CREATE TABLE dans le fichier
```

### Erreur: "permission denied"
**Cause:** Droits insuffisants pour créer des tables.

**Solution:**
- Vérifier que vous êtes connecté avec le bon utilisateur (postgres ou admin)
- Contacter @devops si le problème persiste

### Erreur: "foreign key constraint"
**Cause:** Les tables `shipping_preparations` ou `users` n'existent pas.

**Solution:**
```sql
-- Vérifier que les tables existent
SELECT tablename FROM pg_tables
WHERE tablename IN ('shipping_preparations', 'users');

-- Si elles n'existent pas, exécuter les migrations précédentes d'abord
```

### La Page Shipping Details Ne S'affiche Toujours Pas
**Cause:** Les composants frontend ne sont pas à jour.

**Solution:**
```bash
# Relancer le build
npm run build

# Vérifier qu'il n'y a pas d'erreurs
# Recharger la page avec Ctrl+F5 (hard refresh)
```

---

## 📞 Besoin d'Aide?

- **Questions:** #dev-database sur Slack
- **Urgences:** @lead-dev ou @devops
- **Documentation:** Voir `MIGRATIONS_BEST_PRACTICES.md`

---

## ✅ Checklist Finale

Cocher chaque étape après l'avoir complétée:

- [ ] Étape 1: État vérifié - migration requise
- [ ] Étape 2: Migration exécutée sans erreur
- [ ] Étape 3: Vérification passée - tout est ✅
- [ ] Étape 4: Tests SQL réussis
- [ ] Étape 5: Interface testée et fonctionnelle
- [ ] Étape 6: Documentation mise à jour
- [ ] Équipe notifiée dans #dev-database

---

**🎯 Si toutes les cases sont cochées: Migration Réussie! 🎉**

**⏰ Temps Total:** ~5 minutes
**✅ Difficulté:** Facile
**🔒 Risque:** Aucun (table nouvelle, aucun impact sur données existantes)

---

**📅 Date de création:** 2025-11-14
**👤 Auteur:** AI Assistant
**🔄 Version:** 1.0
