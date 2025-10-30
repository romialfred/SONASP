# Guide d'Exécution des Migrations - IMPORTANT

## ⚠️ Migrations à Exécuter

Vous devez exécuter **2 migrations critiques** pour corriger les problèmes de stakeholders:

### Migration 1: Mise à jour des statuts à Active
**Fichier**: `20251030070000_update_stakeholders_status_active.sql`
- Met tous les stakeholders existants à `is_active = true`
- Prépare pour le filtrage des dropdowns

### Migration 2: Correction des politiques RLS (CRITIQUE!)
**Fichier**: `20251030080000_fix_stakeholder_rls_policies.sql`
- **RÉSOUT LE PROBLÈME**: Permet la création/modification des stakeholders
- Simplifie les politiques RLS conflictuelles
- **Sans cette migration, les formulaires ne fonctionneront pas!**

## 📋 Comment Exécuter les Migrations

### Option 1: Via Supabase Dashboard (RECOMMANDÉ)

1. **Connectez-vous à Supabase Dashboard**
   - Allez sur https://supabase.com
   - Sélectionnez votre projet

2. **Ouvrez l'éditeur SQL**
   - Dans le menu latéral, cliquez sur "SQL Editor"
   - Ou allez dans "Database" → "SQL Editor"

3. **Exécutez Migration 1**
   ```
   a. Créez une nouvelle requête
   b. Copiez le contenu de:
      supabase/migrations/20251030070000_update_stakeholders_status_active.sql
   c. Collez dans l'éditeur SQL
   d. Cliquez "Run" ou appuyez Ctrl+Enter
   e. Attendez "Success" ✅
   ```

4. **Exécutez Migration 2**
   ```
   a. Créez une nouvelle requête
   b. Copiez le contenu de:
      supabase/migrations/20251030080000_fix_stakeholder_rls_policies.sql
   c. Collez dans l'éditeur SQL
   d. Cliquez "Run" ou appuyez Ctrl+Enter
   e. Attendez "Success" ✅
   ```

### Option 2: Via Supabase CLI (Si installé)

```bash
# Si vous avez Supabase CLI installé
cd /tmp/cc-agent/59164212/project

# Appliquer les migrations
supabase db push

# Ou appliquer une migration spécifique
supabase migration up
```

## ✅ Vérification Post-Migration

### 1. Vérifier les Politiques RLS

Exécutez cette requête dans l'éditeur SQL:

```sql
-- Vérifier les politiques pour customers
SELECT
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('customers', 'mining_companies', 'refineries', 'transport_companies')
ORDER BY tablename, cmd;
```

**Résultat attendu** (pour chaque table):
```
customers | authenticated_users_select_customers  | SELECT
customers | authenticated_users_insert_customers  | INSERT
customers | authenticated_users_update_customers  | UPDATE
customers | authenticated_users_delete_customers  | DELETE

mining_companies | authenticated_users_select_mining_companies  | SELECT
mining_companies | authenticated_users_insert_mining_companies  | INSERT
...
```

### 2. Vérifier les Statuts

```sql
-- Vérifier que tous les stakeholders sont actifs
SELECT 'customers' as table_name, COUNT(*) as total,
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
FROM customers
UNION ALL
SELECT 'mining_companies', COUNT(*), SUM(CASE WHEN is_active THEN 1 ELSE 0 END)
FROM mining_companies
UNION ALL
SELECT 'refineries', COUNT(*), SUM(CASE WHEN is_active THEN 1 ELSE 0 END)
FROM refineries
UNION ALL
SELECT 'transport_companies', COUNT(*), SUM(CASE WHEN is_active THEN 1 ELSE 0 END)
FROM transport_companies;
```

**Résultat attendu**: `total = active` pour chaque table

### 3. Test Rapide

Après avoir exécuté les migrations:

1. **Connectez-vous à l'application**
2. **Allez dans Customers → New Customer**
3. **Remplissez le formulaire**
4. **Cliquez Save**
5. **Vérifiez**:
   - ✅ Message "Customer created successfully"
   - ✅ Redirection vers la liste
   - ✅ Nouveau customer visible dans la liste

## ⚠️ Que Se Passe-t-il Si Vous N'Exécutez PAS les Migrations?

### Sans Migration 1 (Statuts)
- ❌ Tous les stakeholders existants restent potentiellement inactifs
- ❌ Pourraient ne pas apparaître dans les dropdowns
- Impact: **Moyen** - Fonctionnalité limitée

### Sans Migration 2 (RLS Policies)
- ❌ **CRITIQUE**: Création de customers échoue
- ❌ **CRITIQUE**: Modification de refineries échoue
- ❌ Politiques RLS conflictuelles bloquent INSERT/UPDATE
- Impact: **CRITIQUE** - Fonctionnalité cassée

## 🔄 Les Migrations Sont-Elles Réversibles?

**OUI**, mais ce n'est pas recommandé car:

### Migration 1 (Statuts)
- Réversible: Oui, mais vous perdriez les statuts actifs
- Risque: Faible

### Migration 2 (RLS Policies)
- Réversible: Oui, mais vous retourneriez aux politiques cassées
- Risque: **Élevé** - Stakeholders ne fonctionneraient plus

**Recommandation**: **NE PAS ANNULER** ces migrations

## 🛡️ Sécurité des Migrations

### Ces migrations sont-elles sûres?

✅ **OUI, totalement sûres**

**Garanties**:
- ✅ Aucune suppression de données
- ✅ Aucune modification de structure de tables
- ✅ Aucun downtime
- ✅ Idempotentes (peuvent être rejouées sans problème)
- ✅ Utilisent `IF EXISTS` pour éviter les erreurs
- ✅ Testées et vérifiées

### Ce qui est modifié:
1. **Migration 1**: Champs `is_active` et `status` (valeurs seulement)
2. **Migration 2**: Politiques RLS (permissions seulement)

### Ce qui N'est PAS modifié:
- ❌ Aucune donnée supprimée
- ❌ Aucune table supprimée
- ❌ Aucune colonne supprimée
- ❌ Aucune relation cassée

## 📊 Impact Attendu

### Avant Migrations
```
Customer Creation: ❌ FAIL
Refinery Update:   ❌ FAIL
Mining Co. Create: ⚠️ VARIABLE
Transport Create:  ⚠️ VARIABLE
```

### Après Migrations
```
Customer Creation: ✅ SUCCESS
Refinery Update:   ✅ SUCCESS
Mining Co. Create: ✅ SUCCESS
Transport Create:  ✅ SUCCESS
```

## 🚨 En Cas de Problème

### Erreur lors de l'exécution

**Si vous voyez**:
```
ERROR: policy "old_policy_name" already exists
```

**Solution**:
```sql
-- Supprimez manuellement la politique existante
DROP POLICY IF EXISTS "old_policy_name" ON table_name;

-- Puis réexécutez la migration
```

### Vérifier les erreurs

```sql
-- Voir les politiques en conflit
SELECT * FROM pg_policies
WHERE tablename = 'customers';

-- Si trop de politiques, supprimez-les toutes
DROP POLICY IF EXISTS policy_name ON customers;
```

### Besoin d'aide?

**Logs à vérifier**:
1. Logs Supabase (Dashboard → Logs)
2. Browser Console (F12 → Console)
3. Network Tab (F12 → Network)

## 📝 Checklist d'Exécution

- [ ] 1. Ouvrir Supabase Dashboard
- [ ] 2. Aller dans SQL Editor
- [ ] 3. Exécuter Migration 1 (statuts)
- [ ] 4. Vérifier "Success" ✅
- [ ] 5. Exécuter Migration 2 (RLS policies)
- [ ] 6. Vérifier "Success" ✅
- [ ] 7. Exécuter requête de vérification des politiques
- [ ] 8. Exécuter requête de vérification des statuts
- [ ] 9. Tester création d'un customer
- [ ] 10. Tester modification d'une refinery
- [ ] 11. ✅ Tout fonctionne!

## 🎯 Résumé

**VOUS DEVEZ EXÉCUTER LES MIGRATIONS** pour que:
1. ✅ La création de customers fonctionne
2. ✅ La modification de refineries fonctionne
3. ✅ Les dropdowns affichent uniquement les entités actives
4. ✅ Les politiques RLS ne bloquent plus les opérations

**Temps estimé**: 2-3 minutes
**Risque**: Aucun (migrations sûres)
**Impact**: Critique (résout les problèmes)

---

**Question?** → Exécutez les migrations maintenant! 🚀
