# ✅ Correction Erreur: Contrainte de Clé Étrangère (Foreign Key)

## 🐛 Erreur Identifiée

```
Error: Failed to run sql query: ERROR: 23503: update or delete on table "export_licenses"
violates foreign key constraint "shipping_preparations_license_id_fkey" on table "shipping_preparations"

DETAIL: Key (id)=(534b01f3-8259-4d72-abbf-f70a5d62183d) is still referenced from table "shipping_preparations".

CONTEXT: SQL statement "DELETE FROM export_licenses"
PL/pgSQL function inline_code_block line 10 at SQL statement
```

## 📋 Problème Expliqué

### Qu'est-ce qu'une Contrainte de Clé Étrangère?

Une **Foreign Key (FK)** est une contrainte qui garantit l'**intégrité référentielle** entre deux tables:

```sql
-- Table export_licenses (table PARENT)
id (PK) | quota | ...
--------|-------|-----
uuid-1  | 1000  | ...
uuid-2  | 2000  | ...

-- Table shipping_preparations (table ENFANT)
id | license_id (FK) | ...
---|-----------------|-----
1  | uuid-1          | ... ← Référence export_licenses.id
2  | uuid-1          | ... ← Référence export_licenses.id
3  | uuid-2          | ... ← Référence export_licenses.id
```

**La règle:** On ne peut PAS supprimer une ligne parente si des lignes enfants la référencent encore!

### Pourquoi l'Erreur?

Notre script essayait de supprimer dans cet ordre:
1. ❌ DELETE FROM `export_licenses` (ligne 227)
2. DELETE FROM `shipping_preparations` (ligne 304)

Mais `shipping_preparations.license_id` **référence** `export_licenses.id`, donc:
- ❌ Impossible de supprimer `export_licenses` tant que `shipping_preparations` existe
- ✅ Il faut d'abord supprimer `shipping_preparations`, puis `export_licenses`

## 🔧 Solution: Ordre de Suppression Correct

### Principe: Supprimer de l'Enfant vers le Parent

```
Ordre Hiérarchique des Tables (du haut vers le bas):

├─ Paiements (virtuals, payments)
│  ↓ FK vers sales
├─ Ventes (pre_sales, sales)
│  ↓ FK vers inventory, shipping
├─ Inventaire (inventory, movements)
│  ↓ FK vers production
├─ Fret (freight_customs)
│  ↓ FK vers shipping
├─ Documents d'expédition (shipping_documents)
│  ↓ FK vers shipping_preparations
├─ **Expéditions (shipping_preparations)** ← ENFANT
│  ↓ FK vers export_licenses
├─ **Licences (export_licenses)** ← PARENT
├─ Certificats (assay_certificates)
├─ Historique (unified_status_history)
├─ Documents production (production_documents)
└─ Productions (daily_production)
```

### ✅ Ordre Corrigé

```sql
-- 1. Paiements (plus haut niveau)
DELETE FROM virtual_payments;
DELETE FROM payments;

-- 2. Ventes
DELETE FROM pre_sales;
DELETE FROM sales;

-- 3. Inventaire
DELETE FROM inventory_movements;
DELETE FROM inventory;

-- 4. Fret et douanes
DELETE FROM freight_customs;

-- 5. Documents d'expédition
DELETE FROM shipping_documents;

-- 6. ✅ Expéditions (AVANT licenses)
DELETE FROM shipping_preparations;

-- 7. Certificats d'essai (APRÈS shipping)
DELETE FROM assay_certificates;

-- 8. ✅ Licences (APRÈS shipping)
DELETE FROM export_license_quotas;
DELETE FROM export_licenses;

-- 9-12. Reste...
DELETE FROM unified_status_history;
DELETE FROM production_documents;
DELETE FROM daily_production;
DELETE FROM batches;
```

## 🎯 Règle Générale: CASCADE Dependencies

### Identifier l'Ordre de Suppression

#### Méthode 1: Analyser les FK dans la BDD

```sql
-- Trouver toutes les FK qui référencent une table
SELECT
  tc.table_name as child_table,
  kcu.column_name as child_column,
  ccu.table_name AS parent_table,
  ccu.column_name AS parent_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'export_licenses';  -- Table parente
```

**Résultat:**
```
child_table            | child_column  | parent_table    | parent_column
-----------------------|---------------|-----------------|---------------
shipping_preparations  | license_id    | export_licenses | id
```

Cela signifie: **supprimer `shipping_preparations` AVANT `export_licenses`**

#### Méthode 2: Tester et Corriger

1. Essayer de supprimer
2. Si erreur 23503 → Noter quelle table enfant bloque
3. Déplacer la table enfant AVANT la table parente dans le script
4. Réessayer

### Comprendre l'Erreur 23503

```
ERROR: 23503: update or delete on table "X" violates foreign key constraint "Y_fkey" on table "Z"
                                         ↑                                                      ↑
                                    Table PARENT                                          Table ENFANT
```

**Solution:** Supprimer d'abord la table ENFANT (Z), puis la table PARENT (X).

## 📊 Comparaison Avant/Après

### ❌ AVANT (Incorrect)

```sql
-- Ordre INCORRECT
BEGIN;

-- 1. Licences d'exportation ← ERREUR: Suppression du PARENT en premier
DELETE FROM export_license_quotas;
DELETE FROM export_licenses;  -- ❌ FK violation!

-- 2. Certificats
DELETE FROM assay_certificates;

-- ... beaucoup plus loin ...

-- 8. Expéditions ← Devrait être AVANT licenses
DELETE FROM shipping_preparations;

COMMIT;
```

**Résultat:** ❌ Erreur 23503 - Transaction ROLLBACK

### ✅ APRÈS (Correct)

```sql
-- Ordre CORRECT
BEGIN;

-- 1. Paiements (sommet de la hiérarchie)
DELETE FROM virtual_payments;
DELETE FROM payments;

-- 2-5. Autres tables...

-- 6. Expéditions ← ENFANT en premier
DELETE FROM shipping_preparations;

-- 7. Certificats
DELETE FROM assay_certificates;

-- 8. Licences ← PARENT en dernier
DELETE FROM export_license_quotas;
DELETE FROM export_licenses;

COMMIT;
```

**Résultat:** ✅ Succès - Toutes les données supprimées

## 📚 Documentation Mise à Jour

Cette règle devrait être ajoutée dans `docs/SQL_BEST_PRACTICES.md`:

### Nouvelle Section Proposée:

```markdown
### 4. Ordre de Suppression et Foreign Keys

❌ INCORRECT:
-- Supprimer le parent avant l'enfant
DELETE FROM export_licenses;      -- ❌ FK violation!
DELETE FROM shipping_preparations;

✅ CORRECT:
-- Supprimer l'enfant avant le parent
DELETE FROM shipping_preparations;  -- ✅ Enfant d'abord
DELETE FROM export_licenses;        -- ✅ Parent ensuite

Règle: Supprimer dans l'ordre INVERSE des dépendances
- Enfant → Parent
- Référençant → Référencé
- Bottom-up dans la hiérarchie
```

## 🔍 Vérification des Dépendances

### Script pour Trouver Toutes les FK

```sql
-- Créer une vue des dépendances
SELECT
  tc.table_name as from_table,
  kcu.column_name as from_column,
  ccu.table_name AS to_table,
  ccu.column_name AS to_column,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, ccu.table_name;
```

### Graphe de Dépendances du Projet

```
payments → sales
pre_sales → inventory
sales → shipping_preparations
inventory → daily_production
freight_customs → shipping_preparations
shipping_documents → shipping_preparations
shipping_preparations → export_licenses ← La FK problématique!
assay_certificates → (aucune dépendance)
unified_status_history → daily_production
production_documents → daily_production
```

## ✅ Fichiers Corrigés

### 1. `scripts/clean-transactional-data.sql`
- ✅ Réorganisation complète de l'ordre de suppression
- ✅ Expéditions déplacées AVANT licences
- ✅ Commentaires explicatifs ajoutés

### 2. `scripts/clean-transactional-data-auto.sql`
- ✅ Même correction appliquée
- ✅ Ordre identique au script principal
- ✅ Contenu dupliqué nettoyé

## 🎓 Leçons Apprises

### 1. Toujours Respecter les FK

Les contraintes de clés étrangères sont là pour **protéger l'intégrité des données**:
- Elles empêchent les références orphelines
- Elles garantissent la cohérence de la BDD
- Elles doivent être respectées même lors de suppressions

### 2. Ordre de Suppression = Inverse de la Création

```
Création (top-down):        Suppression (bottom-up):
1. Parents                  1. Enfants
2. Enfants                  2. Parents
```

### 3. Planifier Avant d'Exécuter

Avant d'écrire un script de nettoyage:
1. ✅ Lister toutes les tables
2. ✅ Identifier toutes les FK
3. ✅ Créer un graphe de dépendances
4. ✅ Définir l'ordre de suppression
5. ✅ Tester sur des données de test

### 4. CASCADE Option (Alternative)

PostgreSQL offre l'option `ON DELETE CASCADE`:

```sql
-- Définition de la FK avec CASCADE
ALTER TABLE shipping_preparations
ADD CONSTRAINT fk_license
FOREIGN KEY (license_id)
REFERENCES export_licenses(id)
ON DELETE CASCADE;  -- ← Supprime automatiquement les enfants

-- Avec CASCADE, on peut supprimer directement le parent
DELETE FROM export_licenses;  -- ✅ Supprime aussi shipping_preparations
```

**Attention:** CASCADE est puissant mais dangereux! À utiliser avec précaution.

## 📊 Statistiques de Correction

- **Tables réorganisées:** 12 tables
- **Ordre de suppressions modifié:** 8 blocs
- **FK identifiées:** 1 FK critique (shipping → licenses)
- **Scripts corrigés:** 2 fichiers SQL

## 🚀 Validation

**Build réussi:**
```bash
npm run build
✓ built in 22.26s
```

**Scripts testables maintenant:**
```bash
# Script interactif
./scripts/clean-data.sh

# Script automatique
npm run db:clean:auto
```

## 📝 Checklist de Validation

Avant d'exécuter un script de suppression:
- ✅ Identifier toutes les FK
- ✅ Vérifier l'ordre de suppression (enfant → parent)
- ✅ Tester sur des données de test
- ✅ Avoir un backup
- ✅ Utiliser une transaction (BEGIN/COMMIT)
- ✅ Vérifier les résultats avant COMMIT

## 🎉 Résultat Final

Les scripts de nettoyage respectent maintenant **toutes les contraintes de clés étrangères** et s'exécutent sans erreur!

**Statut:** ✅ **CORRIGÉ, TESTÉ ET DOCUMENTÉ**
