# 🚀 GUIDE RAPIDE - Test Approbation Client

## 🎯 Vous Voulez: Tester l'approbation client via l'interface

**PAS via INSERT SQL ✅**
**OUI via interface utilisateur ✅**

---

## ⚡ DÉMARRAGE RAPIDE (3 Étapes)

### Étape 1: Vérifier qu'une Vente Existe (30 secondes)

**Via Supabase Dashboard → SQL Editor:**

```sql
SELECT
  s.id,
  s.sale_number,
  s.status,
  c.name as customer,
  c.email
FROM sales s
JOIN customers c ON s.customer_id = c.id
WHERE s.status = 'approved'
ORDER BY s.created_at DESC
LIMIT 1;
```

**✅ Vente trouvée?** → Copier l'`id` et aller à Étape 2

**❌ Aucune vente?** → Créer une vente:

**Option Rapide (Interface):**
1. Se connecter comme Management
2. **Gold Market Place > Sales Management > Sales**
3. **"Create New Sale"**
4. Remplir:
   - Customer: Auramet ou StoneX
   - Quantity: 100 oz
   - Price: 2500 USD/oz
5. **Submit** puis **Approuver** (comme Management)

### Étape 2: Ouvrir la Page d'Approbation Client (10 secondes)

**URL à utiliser:**
```
http://localhost:5173/sales/approve/{VOTRE_SALE_ID}/test-token
```

Remplacer `{VOTRE_SALE_ID}` par l'ID copié à l'Étape 1.

**IMPORTANT:** Ouvrir DevTools (F12) → Onglet "Console" AVANT de charger la page!

### Étape 3: Approuver et Observer (30 secondes)

1. **Page chargée?** → Voir détails de la vente

2. **Cliquer "Approve Sale"** (bouton vert)

3. **Observer Console en temps réel:**

   **✅ Succès - Vous devriez voir:**
   ```
   [customerApproveSale] Starting approval...
   [customerApproveSale] Sale found: SL-2025-XXX
   [customerApproveSale] Virtual payment created: xxx
   [customerApproveSale] Success! Payment ID: xxx
   ```

   **❌ Erreur - Vous verriez:**
   ```
   [customerApproveSale] Error creating virtual payment: ...
   [customerApproveSale] Trying fallback...
   [customerApproveSale] Status update failed: ...
   ```

4. **Vérifier Résultat:**

   **Via Dashboard:**
   - Retour à **Sales Management > Sales**
   - Chercher la vente (SL-2025-XXX)
   - **Status devrait être:**
     - `Waiting for Payment` ✅ (idéal)
     - OU `Customer Approved` ✅ (OK aussi)

   **Via SQL (confirmation):**
   ```sql
   SELECT sale_number, status, updated_at
   FROM sales
   WHERE sale_number = 'SL-2025-XXX';  -- Remplacer

   -- Status devrait avoir changé!
   ```

---

## 🎉 Test Réussi Si:

✅ Page d'approbation charge
✅ Détails vente affichés
✅ Clic "Approve Sale" réussit
✅ Message succès affiché
✅ Console sans erreur rouge critique
✅ Status dans dashboard a changé
✅ Paiement créé (reference VP-XXXX)

**→ SI TOUT OK: SYSTÈME FONCTIONNE! 🎊**

---

## 🐛 Si Problème - Diagnostics Rapides

### Problème: Page Ne Charge Pas (404)

**Vérifier:**
```bash
# Build est à jour?
npm run build

# Route existe?
grep "sales/approve" /tmp/cc-agent/59164212/project/src/App.tsx
```

### Problème: Status Ne Change Pas

**Console montre quoi?**

**Si:** `column "is_virtual" does not exist`
**→ Solution:** Migration partielle

```sql
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'actual';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS mechanism_type TEXT;
```

**Si:** `violates check constraint "sales_status_check"`
**→ Solution:** Status pas autorisé

```sql
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_status_check
  CHECK (status IN (
    'customer_pending', 'approved', 'customer_approved',
    'waiting_for_payment', 'payment_received', 'completed',
    'rejected', 'cancelled'
  ));
```

**Si:** Aucun log dans console
**→ Solution:** Vérifier connexion Supabase

```typescript
// Logs devrait apparaitre. Si rien:
// Vérifier .env
console.log(import.meta.env.VITE_SUPABASE_URL);
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY);
```

### Problème: Paiement Pas Créé

**SQL pour vérifier:**
```sql
SELECT COUNT(*) FROM payments WHERE reference_number LIKE 'VP-%';
```

**Si 0:** RLS Policy bloque

```sql
-- Temporairement pour test:
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
-- Retester approbation
-- Puis réactiver:
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
```

---

## 📁 Fichiers de Référence

Si vous voulez plus de détails:

1. **`TEST_CUSTOMER_APPROVAL_UI.md`**
   → Guide complet étape par étape (15 pages)

2. **`DEBUG_CUSTOMER_APPROVAL.md`**
   → Solutions à tous les problèmes possibles

3. **`check-sales-for-approval.sql`**
   → Script SQL pour vérifier l'état

4. **`simulate-customer-approval.sql`**
   → Test complet en SQL (si vous voulez vérifier DB)

---

## 💡 Astuce Pro

**Test Rapide en Boucle:**

1. Créer vente → Approuver (Management) → Status: 'approved'
2. Tester approbation client (via interface)
3. Vérifier status changé
4. Si besoin réinitialiser:
   ```sql
   DELETE FROM payments WHERE sale_id = 'VOTRE_SALE_ID';
   UPDATE sales SET status = 'approved' WHERE id = 'VOTRE_SALE_ID';
   ```
5. Recommencer au point 2

---

## 🆘 Aide Rapide

**Tout marche SAUF status qui ne change pas?**

→ Exécuter:
```sql
-- Vérifier constraint
SELECT check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'sales_status_check';

-- Devrait contenir 'waiting_for_payment' et 'customer_approved'
```

**Paiement créé mais pas visible dans interface?**

→ Vérifier:
```sql
SELECT * FROM payments ORDER BY created_at DESC LIMIT 5;
-- Si vide alors que console dit "Success" → RLS bloque lecture
```

**Console dit "Success" mais RIEN ne change?**

→ Problème cache browser:
```
1. Ctrl+Shift+R (hard refresh)
2. Vider cache
3. Recharger page
```

---

## 📞 Besoin d'Aide Détaillée?

**Envoyer:**

1. **Logs Console** (copier TOUT ce qui a `[customerApproveSale]`)
2. **Screenshot de l'erreur** (si message rouge)
3. **Résultat SQL:**
   ```sql
   SELECT sale_number, status FROM sales
   WHERE id = 'VOTRE_SALE_ID';
   ```
4. **Résultat SQL:**
   ```sql
   SELECT reference_number, status FROM payments
   WHERE sale_id = 'VOTRE_SALE_ID';
   ```

---

## ✅ RÉSUMÉ ULTRA-RAPIDE

```
1. Avoir une vente (status='approved')
2. Ouvrir: /sales/approve/{ID}/test-token
3. F12 → Console
4. Cliquer "Approve Sale"
5. Vérifier console + dashboard
```

**Temps total: 2 minutes ⏱️**

**Si marche: 🎉 Système OK!**
**Si bloque: 🔧 Voir "Diagnostics Rapides" ci-dessus!**

---

## 🎯 Action Immédiate

**FAIRE MAINTENANT:**

1. ✅ Copier Sale ID depuis SQL ci-dessus
2. ✅ Ouvrir URL: `/sales/approve/{ID}/test-token`
3. ✅ F12 pour console
4. ✅ Cliquer "Approve Sale"
5. ✅ M'envoyer le résultat (logs console + status final)

**C'est parti! 🚀**
