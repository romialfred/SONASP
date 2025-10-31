# 🔍 Debug Customer Approval - Guide de Diagnostic

## 🎯 Problème Rapporté

Status de la vente reste "Pending Approval" au lieu de changer à "Customer Approved" ou "Waiting for Payment" après approbation client.

**IMPORTANT:** Migration `20251030050000_enhance_payments_virtual_system.sql` a été **exécutée avec succès**.

---

## 📋 Scripts de Diagnostic Créés

### 1. `test-customer-approval.sql`

**Utilité:** Vérifier que la migration a bien tout configuré

**Utilisation:**
```bash
# Via Supabase Dashboard SQL Editor
1. Copier contenu du fichier
2. Coller dans SQL Editor
3. Cliquer "Run"
4. Vérifier les résultats
```

**Ce qui est vérifié:**
- ✅ Colonnes virtuelles dans `payments`
- ✅ Status `waiting_for_payment` autorisé dans `sales`
- ✅ Fonctions RPC existent (`create_virtual_payment`, `calculate_payment_due_date`)
- ✅ Ventes en attente d'approbation
- ✅ Paiements virtuels existants
- ✅ Policies RLS

### 2. `simulate-customer-approval.sql`

**Utilité:** Simuler une approbation client COMPLÈTE et identifier où ça bloque

**Utilisation:**
```bash
# Via Supabase Dashboard SQL Editor
1. Copier contenu du fichier
2. Coller dans SQL Editor
3. Cliquer "Run"
4. Lire attentivement les NOTICES dans Output
```

**Ce script fait:**
1. 🔍 Trouve une vente avec status='approved'
2. 🧪 Teste création paiement virtuel via RPC
3. 🔄 Teste changement de status (waiting_for_payment puis customer_approved)
4. ✅ Vérifie que tout a fonctionné
5. 📊 Affiche résultat final

**Output attendu:**
```
✅ Found sale: SL-2025-001 (ID: xxx)
✅ Virtual payment created successfully!
✅ Status updated to: waiting_for_payment
✅✅✅ TEST PASSED! ✅✅✅
```

---

## 🔧 Diagnostic Étape par Étape

### Étape 1: Vérifier la Migration

Exécuter cette query:

```sql
-- Vérifier colonnes virtuelles
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name IN ('is_virtual', 'payment_type', 'mechanism_type', 'virtual_due_date');
```

**Attendu:** 4 lignes retournées

**Si 0 ligne:** Migration pas appliquée correctement

### Étape 2: Vérifier les Fonctions RPC

```sql
-- Vérifier fonctions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'create_virtual_payment';
```

**Attendu:** 1 ligne avec `create_virtual_payment`

**Si 0 ligne:** Fonction RPC n'existe pas

### Étape 3: Tester Création Paiement Virtuel

```sql
-- Test RPC simple
SELECT create_virtual_payment(
  '00000000-0000-0000-0000-000000000000'::UUID,  -- sale_id fictif
  '00000000-0000-0000-0000-000000000000'::UUID,  -- customer_id fictif
  1000.00,
  'USD',
  'spot',
  NOW()
);
```

**Attendu:** Un UUID de paiement retourné (puis DELETE pour nettoyer)

**Si erreur:** Copier le message d'erreur exact

### Étape 4: Vérifier Status Constraint

```sql
-- Vérifier statuts autorisés
SELECT check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'sales_status_check';
```

**Attendu:** Clause contenant 'waiting_for_payment' et 'customer_approved'

**Si manquant:** Constraint pas mis à jour

### Étape 5: Tester Changement de Status

```sql
-- Trouver une vente
SELECT id, sale_number, status
FROM sales
WHERE status = 'approved'
LIMIT 1;

-- Essayer de changer le status (REMPLACER l'ID)
UPDATE sales
SET status = 'waiting_for_payment'
WHERE id = 'VOTRE_SALE_ID_ICI';

-- Vérifier
SELECT status FROM sales WHERE id = 'VOTRE_SALE_ID_ICI';
```

**Attendu:** Status change à 'waiting_for_payment'

**Si erreur:** Copier le message (probablement constraint violation)

---

## 🐛 Problèmes Courants

### Problème 1: Fonction RPC n'existe pas

**Symptôme:**
```
ERROR: function create_virtual_payment(...) does not exist
```

**Solution:**
Réexécuter la partie de la migration qui crée la fonction:

```sql
CREATE OR REPLACE FUNCTION create_virtual_payment(
  p_sale_id UUID,
  p_customer_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_mechanism_type TEXT,
  p_approved_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_due_date DATE;
BEGIN
  -- Calculate due date
  v_due_date := calculate_payment_due_date(p_mechanism_type, p_approved_date);

  -- Create virtual payment
  INSERT INTO payments (
    sale_id,
    customer_id,
    expected_date,
    amount,
    currency,
    is_virtual,
    payment_type,
    mechanism_type,
    auto_credited_at,
    virtual_due_date,
    status,
    bank_name,
    reference_number,
    notes,
    created_at
  ) VALUES (
    p_sale_id,
    p_customer_id,
    v_due_date,
    p_amount,
    p_currency,
    true,
    'virtual',
    p_mechanism_type,
    NOW(),
    v_due_date,
    'pending',
    'Virtual Payment - Pending Confirmation',
    'VP-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8)),
    'Virtual payment created automatically upon customer approval. Payment due: ' || v_due_date || ' (' || p_mechanism_type || ' terms)',
    NOW()
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Problème 2: Status 'waiting_for_payment' pas autorisé

**Symptôme:**
```
ERROR: new row for relation "sales" violates check constraint "sales_status_check"
```

**Solution:**
Mettre à jour le constraint:

```sql
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;

ALTER TABLE sales ADD CONSTRAINT sales_status_check
  CHECK (status IN (
    'customer_pending',
    'approved',
    'customer_approved',
    'waiting_for_payment',
    'payment_received',
    'completed',
    'rejected',
    'cancelled'
  ));
```

### Problème 3: Colonnes virtuelles n'existent pas

**Symptôme:**
```
ERROR: column "is_virtual" of relation "payments" does not exist
```

**Solution:**
Ajouter les colonnes manuellement:

```sql
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('virtual', 'actual')) DEFAULT 'actual';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS mechanism_type TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS auto_credited_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS virtual_due_date DATE;
```

### Problème 4: RLS Policy bloque l'insertion

**Symptôme:** Paiement pas créé, pas d'erreur visible

**Solution:**
Vérifier les policies:

```sql
-- Voir policies sur payments
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'payments';

-- Si trop restrictif, temporairement disable RLS pour test
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

-- Réessayer l'approbation client

-- Puis réactiver
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
```

---

## 🧪 Test Complet dans le Frontend

### Étape 1: Activer DevTools Console

1. Ouvrir l'application
2. Appuyer F12 (DevTools)
3. Onglet "Console"
4. Garder ouvert pendant le test

### Étape 2: Approuver une Vente

1. Trouver une vente avec status "Pending Approval"
2. Copier le lien d'approbation client
3. Ouvrir dans navigateur
4. Cliquer "Approve Sale"

### Étape 3: Observer les Logs

Chercher dans console:

```
[customerApproveSale] Starting approval for sale: ...
[customerApproveSale] Sale found: SL-2025-XXX Customer: XXX
[customerApproveSale] Mechanism type: spot
[customerApproveSale] Creating virtual payment...
```

**Si succès:**
```
[customerApproveSale] Virtual payment created: xxx-xxx-xxx
[customerApproveSale] Success! Payment ID: xxx-xxx-xxx
```

**Si erreur:**
```
[customerApproveSale] Error creating virtual payment: ...
[customerApproveSale] Trying fallback...
```

### Étape 4: Vérifier dans Database

```sql
-- Vérifier status changé
SELECT sale_number, status, updated_at
FROM sales
WHERE sale_number = 'SL-2025-XXX';

-- Vérifier paiement créé
SELECT reference_number, is_virtual, status
FROM payments
WHERE sale_id = (SELECT id FROM sales WHERE sale_number = 'SL-2025-XXX');
```

---

## 📞 Si Tout Échoue

### Collecte d'Informations

Exécuter toutes ces queries et envoyer résultats:

```sql
-- 1. Vérifier migration
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name LIKE '%virtual%' OR column_name = 'payment_type';

-- 2. Vérifier fonctions
SELECT routine_name
FROM information_schema.routines
WHERE routine_name LIKE '%virtual%';

-- 3. Vérifier constraint
SELECT check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'sales_status_check';

-- 4. Vérifier policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('sales', 'payments');

-- 5. Tester approbation
-- EXÉCUTER: simulate-customer-approval.sql
-- COPIER TOUS LES NOTICES
```

### Logs Frontend

1. Ouvrir console (F12)
2. Filtrer par `[customerApproveSale]`
3. Copier tous les logs
4. Envoyer avec les résultats SQL

---

## ✅ Checklist de Résolution

- [ ] Migration appliquée (vérifier colonnes existent)
- [ ] Fonction RPC créée (vérifier existe)
- [ ] Status autorisé (vérifier constraint)
- [ ] Test SQL réussi (simulate-customer-approval.sql)
- [ ] Test frontend réussi (approbation client)
- [ ] Status change visible (dashboard)
- [ ] Paiement créé (query payments table)

**Si TOUS cochés:** ✅ Système fonctionne!

**Si UN échoue:** 🔍 Se concentrer sur celui-là avec les solutions ci-dessus.
