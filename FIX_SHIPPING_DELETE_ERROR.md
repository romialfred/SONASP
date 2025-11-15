# 🚨 Fix: Erreur de Suppression Shipping

## 📅 Date: 2025-01-15

---

## ⚠️ Problèmes Identifiés

### 1. Erreur de Suppression (BLOQUANT)
**Erreur visible:**
```
Failed to delete table row: Failed to run sql query:
ERROR: 42883: function release_license_quota(uuid, uuid, numeric, uuid) does not exist
HINT: No function matches the given name and argument types.
You might need to add explicit type casts.
QUERY: SELECT release_license_quota(
  OLD.license_id, OLD.id, OLD.total_weight_oz, auth.uid()
) CONTEXT: PL/pgSQL function trigger_release_shipping_quota() line 5 at PERFORM
```

**Cause:** Le trigger `trigger_release_shipping_quota()` appelle `release_license_quota()` avec **4 paramètres**, mais la fonction n'accepte que **3 paramètres**.

---

### 2. Données Incohérentes (CRITIQUE)
**Problème:** Une shipping_preparation existe alors que ses productions sont encore à l'étape "prepared".

**Détails:**
- **Shipping ID:** `4bb05720-db14-436a-b8d5-67786c36091`
- **Lot:** `HUM-TGML01-1027/2025`
- **Status Shipping:** (à vérifier)
- **Productions:** Toutes avec `status = "prepared"`

**Incohérence:** Les productions "prepared" ne devraient PAS pouvoir être ajoutées à une expédition.

---

## ✅ Solution en 3 Étapes

### Étape 1: Corriger le Trigger (REQUIS)

**Fichier:** `supabase/migrations/20251115_001_fix_shipping_delete_trigger.sql`

**Dans Supabase SQL Editor:**
1. Ouvrir SQL Editor
2. Copier-coller le contenu complet du fichier
3. Cliquer "Run"
4. Vérifier: "Success. No rows returned"

**Ce que fait la migration:**
- ✅ Crée/remplace la fonction `trigger_release_shipping_quota()`
- ✅ Appelle `release_license_quota()` avec **3 paramètres** au lieu de 4
- ✅ Gère les erreurs sans bloquer la suppression
- ✅ Ajoute des logs détaillés

---

### Étape 2: Diagnostic (OPTIONNEL)

**Fichier:** `scripts/diagnostic-shipping-delete-error.sql`

**Dans Supabase SQL Editor:**
1. Copier-coller le script
2. Cliquer "Run"
3. Lire les messages dans les logs

**Ce qu'il affiche:**
```
NOTICE: ========================================
NOTICE: DIAGNOSTIC ERREUR SUPPRESSION SHIPPING
NOTICE: ========================================
NOTICE:
NOTICE: 1. TRIGGERS sur shipping_preparations:
NOTICE:   Trigger: trigger_release_shipping_quota
NOTICE:     Event: DELETE
NOTICE:     Action: EXECUTE FUNCTION trigger_release_shipping_quota()
NOTICE:
NOTICE: 2. FONCTION release_license_quota:
NOTICE:   Fonction: release_license_quota(p_license_id uuid, p_quantity numeric, p_user_id uuid DEFAULT NULL)  RETURNS boolean
NOTICE:
NOTICE: 4. SHIPPING_PREPARATIONS avec productions "prepared":
NOTICE:   Shipping: HUM-TGML01-1027/2025 (Status: ...)
NOTICE:     Productions: X (Statuts: prepared)
```

---

### Étape 3: Nettoyer les Données (REQUIS)

**Fichier:** `scripts/cleanup-invalid-shippings.sql`

**Dans Supabase SQL Editor:**
1. Copier-coller le script
2. Cliquer "Run"
3. Vérifier les logs

**Sortie attendue:**
```
NOTICE: ========================================
NOTICE: NETTOYAGE SHIPPING PREPARATIONS INVALIDES
NOTICE: ========================================
NOTICE:
NOTICE: 1. IDENTIFICATION des shipping_preparations invalides:
NOTICE:
NOTICE:   ❌ Shipping INVALIDE #1:
NOTICE:       ID: 4bb05720-db14-436a-b8d5-67786c36091
NOTICE:       Lot: HUM-TGML01-1027/2025
NOTICE:       Status Shipping: ...
NOTICE:       Productions (X): ...
NOTICE:       Status Productions: prepared
NOTICE:       Poids Total: ... g
NOTICE:
NOTICE:       ✅ SUPPRIMÉ avec succès
NOTICE:       📋 Quota de licence libéré: ... g
NOTICE:
NOTICE: ========================================
NOTICE: RÉSUMÉ
NOTICE: ========================================
NOTICE:
NOTICE: Shipping invalides trouvées: 1
NOTICE: Shipping supprimées: 1
NOTICE:
NOTICE: ✅ NETTOYAGE TERMINÉ AVEC SUCCÈS
```

---

## 🔍 Explication Technique

### Pourquoi l'Erreur

**Le trigger ACTUEL (incorrect):**
```sql
-- ❌ INCORRECT: 4 paramètres
PERFORM release_license_quota(
  OLD.license_id,           -- UUID (license_id)
  OLD.id,                   -- UUID (shipping_id) ← EN TROP!
  OLD.total_weight_oz,      -- NUMERIC (quantity)
  auth.uid()                -- UUID (user_id)
);
```

**La fonction ATTEND:**
```sql
-- Signature de la fonction
CREATE OR REPLACE FUNCTION release_license_quota(
  p_license_id UUID,        -- Paramètre 1
  p_quantity NUMERIC,       -- Paramètre 2
  p_user_id UUID DEFAULT NULL  -- Paramètre 3 (optionnel)
)
RETURNS BOOLEAN
```

**Le FIX (correct):**
```sql
-- ✅ CORRECT: 3 paramètres
PERFORM release_license_quota(
  v_license_id,      -- UUID: license_id
  v_total_weight,    -- NUMERIC: quantity to release
  auth.uid()         -- UUID: user_id
);
```

**Problème:** L'ancien code passait `OLD.id` (shipping_id) comme 2ème paramètre, alors que la fonction attend une `NUMERIC` (quantité).

---

### Pourquoi les Données sont Incohérentes

**Workflow NORMAL:**
```
1. Production créée
   └─→ status = "prepared"

2. Production prête pour shipping
   └─→ status = "ready_for_shipping" ✅

3. Créer shipping_preparation
   └─→ Ajouter productions "ready_for_shipping" ✅
```

**Ce qui s'est passé (ANORMAL):**
```
1. Production créée
   └─→ status = "prepared"

2. Créer shipping_preparation (BUG!)
   └─→ Ajouter productions "prepared" ❌

3. Résultat: Données incohérentes
```

**Causes possibles:**
1. Bug dans le formulaire de création de shipping
2. Validation insuffisante côté client
3. Données importées manuellement
4. Migration qui a créé des incohérences

---

## 🎯 Ordre d'Exécution (IMPORTANT)

**Suivre CET ORDRE:**

```
1️⃣ Appliquer la migration
   📄 supabase/migrations/20251115_001_fix_shipping_delete_trigger.sql
   ✅ Fix le trigger de suppression

   ↓

2️⃣ (Optionnel) Diagnostic
   📄 scripts/diagnostic-shipping-delete-error.sql
   🔍 Voir l'état actuel

   ↓

3️⃣ Nettoyer les données
   📄 scripts/cleanup-invalid-shippings.sql
   🧹 Supprimer les shipping invalides

   ↓

4️⃣ Vérification finale
   ✅ Essayer de supprimer manuellement dans l'interface
```

**⚠️ NE PAS** essayer de supprimer avant d'appliquer la migration !

---

## ✅ Vérification Post-Fix

### 1. Vérifier que le trigger fonctionne

**Dans Supabase SQL Editor:**
```sql
-- Essayer de supprimer une shipping_preparation
-- (Devrait fonctionner sans erreur)
DELETE FROM shipping_preparations
WHERE id = '4bb05720-db14-436a-b8d5-67786c36091';

-- Résultat attendu:
-- "DELETE 1" (succès, pas d'erreur)
```

### 2. Vérifier qu'il ne reste plus de shipping invalides

```sql
SELECT
  sp.id,
  sp.expedition_lot_number,
  STRING_AGG(DISTINCT dp.status::text, ', ') as production_statuses
FROM shipping_preparations sp
LEFT JOIN shipping_production_items spi ON spi.shipping_preparation_id = sp.id
LEFT JOIN daily_production dp ON dp.id = spi.production_id
GROUP BY sp.id, sp.expedition_lot_number
HAVING STRING_AGG(DISTINCT dp.status::text, ', ') LIKE '%prepared%';

-- Résultat attendu:
-- "0 rows" (aucune shipping invalide)
```

### 3. Vérifier que les quotas de licence sont corrects

```sql
-- Voir toutes les licences et leurs quotas
SELECT
  license_number,
  status,
  authorized_quantity_grams,
  used_quantity_grams,
  remaining_quantity_grams
FROM export_licenses
ORDER BY created_at DESC;

-- Vérifier que:
-- ✅ remaining_quantity_grams = authorized - used
-- ✅ remaining_quantity_grams a augmenté après suppression
```

---

## 📊 Impact

### Avant le Fix:

```
❌ Impossible de supprimer les shipping_preparations
❌ Erreur PostgreSQL 42883
❌ Données incohérentes dans la base
❌ Quotas de licence potentiellement bloqués
❌ Workflow bloqué
```

### Après le Fix:

```
✅ Suppression fonctionne correctement
✅ Quotas libérés automatiquement lors de la suppression
✅ Données cohérentes (shipping invalides supprimées)
✅ Trigger corrigé avec bons paramètres
✅ Logs détaillés pour debugging
✅ Workflow normal restauré
```

---

## 🔒 Prévention Future

### 1. Validation Côté Client

**Dans le service de création de shipping:**

```typescript
// services/shippingPreparationService.ts

export async function createShipping(data: ShippingData) {
  // Vérifier que toutes les productions sont "ready_for_shipping"
  const productions = await getProductionsByIds(data.productionIds);

  const invalidProductions = productions.filter(
    p => p.status !== 'ready_for_shipping'
  );

  if (invalidProductions.length > 0) {
    throw new Error(
      `Certaines productions ne sont pas prêtes pour expédition: ${
        invalidProductions.map(p => p.bar_reference).join(', ')
      }`
    );
  }

  // Continuer avec la création...
}
```

### 2. Validation Côté Base de Données (Optionnel)

**Ajouter un trigger de validation:**

```sql
CREATE OR REPLACE FUNCTION validate_shipping_productions()
RETURNS TRIGGER AS $$
DECLARE
  v_invalid_count INTEGER;
BEGIN
  -- Compter les productions non prêtes
  SELECT COUNT(*)
  INTO v_invalid_count
  FROM shipping_production_items spi
  JOIN daily_production dp ON dp.id = spi.production_id
  WHERE spi.shipping_preparation_id = NEW.id
    AND dp.status != 'ready_for_shipping';

  -- Lever une erreur si des productions invalides
  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION
      'Impossible de créer une expédition avec % production(s) non prête(s)',
      v_invalid_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
CREATE TRIGGER validate_shipping_productions_trigger
  AFTER INSERT OR UPDATE ON shipping_preparations
  FOR EACH ROW
  EXECUTE FUNCTION validate_shipping_productions();
```

---

## 🎯 Résumé

**Problème 1:** Trigger avec signature incorrecte (4 paramètres au lieu de 3)
**Problème 2:** Données incohérentes (shipping avec productions "prepared")

**Solution 1:** Migration `20251115_001_fix_shipping_delete_trigger.sql`
**Solution 2:** Script `cleanup-invalid-shippings.sql`

**Résultat:** Suppression fonctionne + données cohérentes

**Temps estimé:** 5-10 minutes

---

## 📚 Fichiers Créés

1. **supabase/migrations/20251115_001_fix_shipping_delete_trigger.sql**
   - Corrige la fonction trigger
   - Adapte les paramètres à la signature de release_license_quota()
   - Ajoute gestion d'erreurs

2. **scripts/diagnostic-shipping-delete-error.sql**
   - Diagnostic complet du problème
   - Liste tous les triggers et fonctions
   - Identifie les shipping invalides

3. **scripts/cleanup-invalid-shippings.sql**
   - Supprime les shipping_preparations invalides
   - Libère les quotas de licence
   - Rapport détaillé

4. **FIX_SHIPPING_DELETE_ERROR.md** (ce fichier)
   - Guide complet de résolution
   - Explications techniques
   - Vérifications post-fix

---

**Status: 🚨 ACTION REQUISE**

**Priorité: HAUTE - Bloque la suppression**

**Action immédiate:** Appliquer la migration `20251115_001_fix_shipping_delete_trigger.sql`

---

**Dernière mise à jour:** 2025-01-15
