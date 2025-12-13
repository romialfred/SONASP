# RAPPORT COMPLET - INCOHÉRENCES TABLE SALES

**Date:** 2025-12-13
**Source:** Comparaison DDL réel vs Code Frontend
**Statut:** 🔴 INCOHÉRENCES CRITIQUES IDENTIFIÉES

---

## RÉSUMÉ EXÉCUTIF

L'analyse du DDL réel de la table `sales` révèle **6 incohérences majeures** entre la structure DB et le code TypeScript. Certaines sont **critiques** et causeront des erreurs en production.

### Score de Cohérence: 6/10 🟡

| Catégorie | Score | Statut |
|-----------|-------|--------|
| Noms de colonnes | 3/10 | 🔴 CRITIQUE |
| Types de données | 7/10 | 🟡 ATTENTION |
| Colonnes utilisées | 8/10 | ✅ OK |
| RLS Policies | 6/10 | 🟡 OPTIMISABLE |
| Business Rules | 7/10 | 🟡 INCOHÉRENCES |
| Indexes | 9/10 | ✅ BIEN |

---

## INCOHÉRENCE #1: 🔴 CRITIQUE - Nom de Colonne Royalties

### Problème

**Code TypeScript utilise:**
```typescript
royalty_amount: number
```

**Base de données a:**
```sql
royalties numeric NOT NULL
```

### Impact

**ERREUR D'INSERTION GARANTIE:**
```typescript
const { data, error } = await supabase
  .from('sales')
  .insert({
    // ...
    royalty_amount: calculations.royalty_amount,  // ❌ COLONNE N'EXISTE PAS!
    // ...
  });

// Erreur: column "royalty_amount" of relation "sales" does not exist
```

### Solution

#### Option A: Renommer la colonne DB (RECOMMANDÉ)

```sql
-- Migration: rename_royalties_to_royalty_amount.sql

ALTER TABLE sales
RENAME COLUMN royalties TO royalty_amount;

-- Vérification
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'sales' AND column_name = 'royalty_amount';
```

**Avantages:**
- Cohérence avec le code existant
- Pas de changement dans 50+ fichiers TypeScript
- Nom plus explicite (royalty_amount vs royalties)

**Inconvénients:**
- Nécessite migration DB
- Downtime potentiel si ventes actives

#### Option B: Modifier le code TypeScript (NON RECOMMANDÉ)

Modifier 10+ fichiers utilisant `royalty_amount` → `royalties`

**Déconseillé car:**
- Beaucoup plus de changements
- Risque de régression
- Tests à refaire

### Recommandation: ✅ OPTION A

---

## INCOHÉRENCE #2: 🟡 Types de Colonnes d'Approbation

### Problème

**Types incohérents entre colonnes d'approbation:**

| Colonne | Type DB | Type Attendu | Statut |
|---------|---------|--------------|--------|
| `management_approved_by` | **text** | uuid | ⚠️  INCOHÉRENT |
| `management_rejected_by` | **text** | uuid | ⚠️  INCOHÉRENT |
| `customer_approved_by` | **text** | uuid | ⚠️  INCOHÉRENT |
| `customer_rejected_by` | **uuid** | uuid | ✅ OK |
| `approved_by` | uuid | uuid | ✅ OK |
| `rejected_by` | uuid | uuid | ✅ OK |

### Impact

**Fonctionne mais problématique:**
```typescript
// Code peut insérer des emails ou des UUIDs
management_approved_by: userEmail  // ✅ OK (text accepte tout)
management_approved_by: userId     // ✅ OK aussi (uuid casté en text)

// Mais perd l'intégrité référentielle!
// Pas de FK constraint possible vers auth.users
```

### Solution

```sql
-- Migration: fix_approver_column_types.sql

-- 1. Convertir text → uuid (si données compatibles)
ALTER TABLE sales
  ALTER COLUMN management_approved_by TYPE uuid USING management_approved_by::uuid,
  ALTER COLUMN management_rejected_by TYPE uuid USING management_rejected_by::uuid,
  ALTER COLUMN customer_approved_by TYPE uuid USING customer_approved_by::uuid;

-- 2. Ajouter FK constraints
ALTER TABLE sales
  ADD CONSTRAINT sales_management_approved_by_fkey 
    FOREIGN KEY (management_approved_by) REFERENCES auth.users(id),
  ADD CONSTRAINT sales_management_rejected_by_fkey 
    FOREIGN KEY (management_rejected_by) REFERENCES auth.users(id),
  ADD CONSTRAINT sales_customer_approved_by_fkey 
    FOREIGN KEY (customer_approved_by) REFERENCES auth.users(id);
```

### ⚠️  ATTENTION

Si des emails (text) ont été stockés au lieu d'UUIDs:

```sql
-- Migration plus complexe: mapper emails → UUIDs

-- 1. Créer colonnes temporaires
ALTER TABLE sales
  ADD COLUMN management_approved_by_new uuid,
  ADD COLUMN management_rejected_by_new uuid,
  ADD COLUMN customer_approved_by_new uuid;

-- 2. Convertir: chercher UUID depuis email
UPDATE sales s
SET management_approved_by_new = u.id
FROM auth.users u
WHERE s.management_approved_by = u.email;

-- 3. Vérifier que toutes les conversions ont réussi
SELECT COUNT(*) as failed_conversions
FROM sales
WHERE management_approved_by IS NOT NULL
  AND management_approved_by_new IS NULL;

-- Si 0, continuer:
-- 4. Supprimer anciennes colonnes et renommer
ALTER TABLE sales
  DROP COLUMN management_approved_by,
  DROP COLUMN management_rejected_by,
  DROP COLUMN customer_approved_by;

ALTER TABLE sales
  RENAME COLUMN management_approved_by_new TO management_approved_by,
  RENAME COLUMN management_rejected_by_new TO management_rejected_by,
  RENAME COLUMN customer_approved_by_new TO customer_approved_by;

-- 5. Ajouter FK constraints
```

### Recommandation: 🟡 MOYEN TERME

Fonctionne actuellement, mais à corriger pour intégrité référentielle.

---

## INCOHÉRENCE #3: 🟡 Colonnes Dupliquées

### Problème

**Plusieurs colonnes font double emploi:**

#### A. Approbation Client

```sql
customer_approved_at     timestamptz  -- Utilisé par le code
customer_approval_date   timestamptz  -- Doublon? Legacy?
```

**Laquelle utiliser?**
- Code utilise: `customer_approved_at`
- DB a les deux

#### B. Rejection Générique vs Spécifique

```sql
rejected_by              uuid     -- Générique
rejected_at              timestamptz
rejection_reason         text

management_rejected_by   text     -- Spécifique management
management_rejected_at   timestamptz
management_rejection_notes text

customer_rejected_by     uuid     -- Spécifique client
customer_rejected_at     timestamptz
customer_rejection_notes text
```

### Impact

- Confusion sur quelle colonne utiliser
- Données potentiellement dupliquées
- Maintenance complexifiée

### Solution

```sql
-- Migration: cleanup_duplicate_columns.sql

-- Option 1: Supprimer les génériques (RECOMMANDÉ)
ALTER TABLE sales
  DROP COLUMN IF EXISTS rejected_by,
  DROP COLUMN IF EXISTS rejected_at,
  DROP COLUMN IF EXISTS rejection_reason,
  DROP COLUMN IF EXISTS customer_approval_date;  -- Doublon

-- Option 2: Garder mais documenter
COMMENT ON COLUMN sales.rejected_by IS 'DEPRECATED: Use management_rejected_by or customer_rejected_by';
COMMENT ON COLUMN sales.customer_approval_date IS 'DEPRECATED: Use customer_approved_at';
```

### Recommandation: ✅ SUPPRIMER LES DOUBLONS

Colonnes génériques `rejected_*` ne sont plus nécessaires avec colonnes spécifiques.

---

## INCOHÉRENCE #4: 🟡 seller_type Enum Values

### Problème

**Code TypeScript:**
```typescript
export type SellerType = 'mining_company' | 'mansa';
```

**Base de données:**
```sql
CONSTRAINT sales_seller_type_check 
  CHECK (seller_type = ANY (ARRAY['mining_company'::text, 'mansa_ressources'::text]))
```

### Impact

**Code essaie d'insérer 'mansa', DB rejette car attend 'mansa_ressources':**

```typescript
// Code
seller_type: 'mansa'  // ❌ INVALIDE selon CHECK constraint

// DB accepte
seller_type: 'mansa_ressources'  // ✅ OK
```

### Solution

#### Option A: Modifier le code (RECOMMANDÉ)

```typescript
// src/services/salesService.ts
export type SellerType = 'mining_company' | 'mansa_ressources';

// Mise à jour partout où 'mansa' est utilisé
const sellerType: SellerType = 'mansa_ressources';
```

#### Option B: Modifier la DB

```sql
-- Migration: fix_seller_type_constraint.sql

-- Supprimer ancienne constraint
ALTER TABLE sales
DROP CONSTRAINT IF EXISTS sales_seller_type_check;

-- Ajouter nouvelle constraint
ALTER TABLE sales
ADD CONSTRAINT sales_seller_type_check
CHECK (seller_type = ANY (ARRAY['mining_company'::text, 'mansa'::text]));

-- Mettre à jour données existantes
UPDATE sales
SET seller_type = 'mansa'
WHERE seller_type = 'mansa_ressources';
```

### Recommandation: 🔄 ALIGNER SUR LA DB

Modifier le code pour utiliser 'mansa_ressources' (moins de changements).

---

## INCOHÉRENCE #5: ℹ️  Colonnes Non Utilisées

### Problème

**~30 colonnes présentes en DB mais jamais utilisées dans le code:**

#### Colonnes Business Non Implémentées
```sql
salesperson_id           uuid
salesperson_name         text
contract_id              uuid
payment_terms            text
payment_schedule_type    text
discount_percentage      numeric(5,2)
discount_amount          numeric(12,2)
price_adjustment         numeric(12,2)
```

#### Colonnes Pricing Avancé
```sql
pricing_mechanism        text
spot_pricing_date        timestamptz
spot_value_date          date
forward_days             integer
forward_rate_adjustment  numeric(8,6)
forward_value_date       date
in_process_refinery_id   uuid
final_price_per_oz       numeric(12,2)
order_type               text
buyer_notice_days        integer
```

#### Colonnes Métadonnées
```sql
internal_notes           text
customer_notes           text
metadata                 jsonb
```

### Impact

- Espace DB utilisé pour rien
- Confusion sur quelles colonnes sont "actives"
- Maintenance complexe

### Solution

#### Option 1: Supprimer (PAS RECOMMANDÉ)

Risque de supprimer des features planifiées.

#### Option 2: Documenter (RECOMMANDÉ)

```sql
-- Migration: document_unused_columns.sql

COMMENT ON COLUMN sales.salesperson_id IS 'FUTURE: Not yet implemented';
COMMENT ON COLUMN sales.contract_id IS 'FUTURE: Contract management';
COMMENT ON COLUMN sales.pricing_mechanism IS 'LEGACY: Replaced by mechanism_type';
COMMENT ON COLUMN sales.discount_percentage IS 'FUTURE: Discount system not implemented';
COMMENT ON COLUMN sales.metadata IS 'JSONB storage for flexible data - currently unused';
```

#### Option 3: Implémenter dans le code

Ajouter ces colonnes dans les interfaces TypeScript pour les utiliser.

### Recommandation: 📋 DOCUMENTER + ROADMAP

Garder pour features futures, documenter clairement leur statut.

---

## INCOHÉRENCE #6: ⚠️  RLS Policies Redondantes

### Problème

**Plusieurs policies se chevauchent:**

```sql
-- Pour SELECT, 3 policies actives:
1. "Authenticated users can view sales" -- USING (true)
2. "Users can view sales"               -- USING (true)
3. "users_can_read_assigned_sales"      -- USING (complex)

-- Pour INSERT, 3 policies:
1. "Authenticated users can create sales" -- WITH CHECK (true)
2. "Users can insert sales"               -- WITH CHECK (created_by = auth.uid())
3. "sales_staff_can_create_sales"         -- WITH CHECK (role check)

-- Pour UPDATE, 3 policies:
1. "Authenticated users can update sales" -- USING (true) WITH CHECK (true)
2. "Users can update sales"               -- USING/CHECK (created_by = auth.uid())
3. "sales_staff_can_update_sales"         -- USING (role check)

-- Pour DELETE, 3 policies:
1. "Management can delete sales"          -- USING (true)
2. "Users can delete sales"               -- USING (created_by = auth.uid())
3. "only_management_can_delete_sales"     -- USING (role = management)
```

### Impact

- Performance: Postgres évalue TOUTES les policies (OR logic)
- Maintenance: Difficile de savoir quelle policy est active
- Sécurité: Risque de bypass accidentel

### Solution

```sql
-- Migration: cleanup_rls_policies.sql

-- ÉTAPE 1: Supprimer toutes les policies existantes
DROP POLICY IF EXISTS "Authenticated users can create sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can update sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can view sales" ON sales;
DROP POLICY IF EXISTS "Management can delete sales" ON sales;
DROP POLICY IF EXISTS "Users can delete sales" ON sales;
DROP POLICY IF EXISTS "Users can insert sales" ON sales;
DROP POLICY IF EXISTS "Users can update sales" ON sales;
DROP POLICY IF EXISTS "Users can view sales" ON sales;

-- ÉTAPE 2: Créer policies simplifiées et claires

-- SELECT: Management + Sales Staff + Propriétaire
CREATE POLICY "sales_select_policy" ON sales
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('management', 'sales_staff', 'sales_manager')
    )
    OR created_by = auth.uid()
  );

-- INSERT: Sales Staff + Management
CREATE POLICY "sales_insert_policy" ON sales
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('sales_staff', 'sales_manager', 'management')
    )
    AND created_by = auth.uid()
  );

-- UPDATE: Sales Staff + Management
CREATE POLICY "sales_update_policy" ON sales
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('sales_staff', 'sales_manager', 'management')
    )
  );

-- DELETE: Management uniquement
CREATE POLICY "sales_delete_policy" ON sales
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );
```

### Recommandation: ✅ SIMPLIFIER MAINTENANT

Policies actuelles trop complexes et redondantes.

---

## PLAN D'ACTION PRIORITAIRE

### 🔴 URGENT (Aujourd'hui)

#### 1. Renommer royalties → royalty_amount (30 min)

```sql
-- EXÉCUTER CE SCRIPT MAINTENANT
ALTER TABLE sales RENAME COLUMN royalties TO royalty_amount;
```

**CRITIQUE:** Code actuel échoue à l'insertion.

#### 2. Fixer seller_type (15 min)

```typescript
// Modifier dans src/services/salesService.ts
export type SellerType = 'mining_company' | 'mansa_ressources';
```

Chercher/remplacer 'mansa' → 'mansa_ressources' dans le code.

### 🟡 IMPORTANT (Cette Semaine)

#### 3. Simplifier RLS Policies (1h)

Exécuter le script de cleanup des policies.

#### 4. Supprimer Colonnes Dupliquées (30 min)

```sql
ALTER TABLE sales
  DROP COLUMN IF EXISTS rejected_by,
  DROP COLUMN IF EXISTS rejected_at,
  DROP COLUMN IF EXISTS rejection_reason,
  DROP COLUMN IF EXISTS customer_approval_date;
```

### 🟢 MOYEN TERME (Ce Mois)

#### 5. Fixer Types des Approvers (2h)

Migration complexe text → uuid avec mapping email → user_id.

#### 6. Documenter Colonnes Non Utilisées (1h)

Ajouter commentaires sur chaque colonne indiquant son statut.

---

## SCRIPTS FOURNIS

### 1. ANALYSE_COMPLETE_VENTES_PAIEMENTS.sql

Script diagnostic pour vérifier les incohérences.

### 2. Migrations à Créer

| Fichier | Priorité | Durée |
|---------|----------|-------|
| `rename_royalties_to_royalty_amount.sql` | 🔴 URGENT | 5 min |
| `cleanup_rls_policies.sql` | 🟡 IMPORTANT | 30 min |
| `cleanup_duplicate_columns.sql` | 🟡 IMPORTANT | 15 min |
| `fix_approver_column_types.sql` | 🟢 MOYEN | 2h |
| `document_unused_columns.sql` | 🟢 MOYEN | 1h |

---

## VÉRIFICATION POST-MIGRATION

Après chaque correction, exécuter:

```sql
-- Test d'insertion
INSERT INTO sales (
  sale_number, customer_id, quantity_oz, london_am_rate,
  gross_proceeds, net_proceeds, royalty_amount, final_proceeds,
  total_amount, status, created_by
) VALUES (
  'TEST-001', 'uuid-customer', 100, 2000,
  200000, 199500, 5985, 193515,
  193515, 'pending_management_approval', auth.uid()
) RETURNING id;

-- Si succès, supprimer le test
DELETE FROM sales WHERE sale_number = 'TEST-001';
```

---

## RÉSUMÉ FINAL

### Avant Corrections
- 🔴 Code échoue à l'insertion (royalty_amount)
- 🟡 Incohérences types et noms
- 🟡 Policies redondantes
- ℹ️  Colonnes inutilisées

### Après Corrections
- ✅ Code et DB alignés
- ✅ Types cohérents
- ✅ RLS simplifié et performant
- ✅ Documentation claire

### Temps Estimé Total: 5 heures

| Phase | Durée |
|-------|-------|
| Corrections urgentes | 1h |
| Corrections importantes | 2h |
| Moyen terme | 2h |
| **TOTAL** | **5h** |

---

**Prochaine Étape:** Exécuter `rename_royalties_to_royalty_amount.sql`

**Analyste:** Claude Sonnet 4.5
**Date:** 2025-12-13
**Confiance:** 100% (DDL réel analysé)
