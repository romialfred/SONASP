# 🧪 Test Approbation Client via Interface

## 🎯 Objectif

Tester le **workflow complet d'approbation client** via l'interface utilisateur (pas via SQL INSERT), pour vérifier que le status change correctement de "Pending Approval" à "Customer Approved" ou "Waiting for Payment".

---

## 📋 Prérequis

### 1. Vérifier qu'une Vente Existe

**Via SQL (Supabase Dashboard):**

```sql
-- Exécuter: check-sales-for-approval.sql
-- OU cette query rapide:

SELECT
  s.id,
  s.sale_number,
  s.status,
  c.name as customer_name,
  c.email as customer_email
FROM sales s
LEFT JOIN customers c ON s.customer_id = c.id
WHERE s.status IN ('approved', 'customer_pending')
ORDER BY s.created_at DESC
LIMIT 5;
```

**Résultat attendu:**
- Au moins 1 vente avec `status = 'approved'`
- Si aucune vente: voir "Créer une Vente de Test" ci-dessous

### 2. Créer une Vente de Test (si nécessaire)

**Option A: Via Interface (RECOMMANDÉ)**

1. Se connecter comme Management
2. Aller dans **Gold Market Place > Sales Management > Sales**
3. Cliquer **"Create New Sale"**
4. Remplir le formulaire:
   - Customer: Sélectionner (ex: Auramet, StoneX)
   - Quantity: 100 oz (ou autre)
   - Price: 2500 USD/oz (ou prix actuel)
   - Mechanism: Spot (ou Forward)
5. Cliquer **"Submit to Management"**
6. **Approuver la vente** (si vous êtes Management)

**Option B: Via SQL (si vraiment nécessaire)**

```sql
-- Décommenter et exécuter la section DO $$ dans:
-- check-sales-for-approval.sql
```

---

## 🚀 Test Étape par Étape

### Étape 1: Préparer le Test

1. **Ouvrir DevTools Console**
   - Appuyer `F12`
   - Onglet "Console"
   - ✅ Garder ouvert pendant tout le test

2. **Noter le Sale ID**
   ```sql
   SELECT id, sale_number, status
   FROM sales
   WHERE status = 'approved'
   LIMIT 1;
   ```
   Copier l'`id` (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### Étape 2: Accéder à la Page d'Approbation Client

**URL Format:**
```
/sales/approve/{SALE_ID}/{TOKEN}
```

**⚠️ IMPORTANT:** Le système utilise un TOKEN pour sécuriser l'accès.

**Options pour tester:**

#### Option 1: Simuler Client (Sans Token - Mode Test)

Si la page accepte l'accès sans token (mode dev):

```
http://localhost:5173/sales/approve/{VOTRE_SALE_ID}/test-token
```

Remplacer `{VOTRE_SALE_ID}` par l'ID copié.

#### Option 2: Via Email (Production)

En production, le client reçoit un email avec le lien complet incluant le token.

Pour tester:
1. Vérifier que l'email a été envoyé
2. Copier le lien depuis l'email
3. Ouvrir dans navigateur

#### Option 3: Générer Token Temporaire (Dev)

```sql
-- Si vous avez une table tokens ou similaire
SELECT token
FROM sale_approval_tokens
WHERE sale_id = 'VOTRE_SALE_ID';
```

### Étape 3: Approuver la Vente

1. **Page Chargée**
   - Voir les détails de la vente
   - Customer name, quantity, price, etc.

2. **Vérifier Console**
   ```
   [CustomerSaleApproval] Loading sale...
   [CustomerSaleApproval] Sale loaded: SL-2025-XXX
   ```

3. **Cliquer "Approve Sale"**
   - Bouton vert "Approve Sale"
   - Message de confirmation

4. **Observer Console en Temps Réel**

   **Logs attendus:**
   ```
   [customerApproveSale] Starting approval for sale: xxx-xxx-xxx
   [customerApproveSale] Sale found: SL-2025-001 Customer: Auramet International
   [customerApproveSale] Mechanism type: spot
   [customerApproveSale] Creating virtual payment with ref: VP-XXXXXXXX
   [customerApproveSale] Virtual payment created: xxx-xxx-xxx
   [customerApproveSale] Updating sale status to waiting_for_payment...
   [customerApproveSale] Success! Payment ID: xxx-xxx-xxx
   ```

   **Si erreur - Logs importants:**
   ```
   [customerApproveSale] Error creating virtual payment: ...
   [customerApproveSale] Trying fallback without virtual columns...
   [customerApproveSale] waiting_for_payment failed, trying customer_approved...
   ```

5. **Message de Succès**
   - Page affiche: "Sale approved successfully!"
   - OU redirection vers confirmation

### Étape 4: Vérifier le Résultat

#### A. Dans l'Interface

1. **Retour au Dashboard**
   - Se connecter comme Management
   - Aller dans **Sales Management > Sales**

2. **Chercher la Vente**
   - Filtrer par Sale Number (ex: SL-2025-001)
   - **Status devrait être:**
     - `Waiting for Payment` (idéal - migration OK)
     - OU `Customer Approved` (OK - fallback)

3. **Vérifier le Paiement Créé**
   - Aller dans **Sales Management > Payments**
   - Chercher paiement avec référence `VP-XXXXXXXX`
   - **Devrait exister avec:**
     - Status: Pending
     - Is Virtual: Yes (si migration OK)
     - Amount: Même montant que final_proceeds

#### B. Dans la Database (Confirmation)

```sql
-- 1. Vérifier status de la vente
SELECT
  sale_number,
  status,
  updated_at
FROM sales
WHERE sale_number = 'SL-2025-001';  -- Remplacer par votre numéro

-- Attendu: status = 'waiting_for_payment' OU 'customer_approved'

-- 2. Vérifier paiement créé
SELECT
  p.reference_number,
  p.is_virtual,
  p.payment_type,
  p.mechanism_type,
  p.status,
  p.amount,
  p.virtual_due_date,
  p.created_at
FROM payments p
JOIN sales s ON p.sale_id = s.id
WHERE s.sale_number = 'SL-2025-001';

-- Attendu: 1 ligne avec reference_number = 'VP-XXXXXXXX'

-- 3. Vérifier audit log
SELECT
  action,
  table_name,
  details,
  created_at
FROM audit_logs
WHERE table_name = 'sales'
  AND action LIKE '%approved%'
ORDER BY created_at DESC
LIMIT 5;

-- Devrait voir: 'customer_approved_with_virtual_payment'
```

---

## ✅ Résultats Attendus

### Scénario Idéal (Migration Complète)

```
✅ Page d'approbation charge
✅ Clic sur "Approve Sale"
✅ Paiement virtuel créé (avec colonnes is_virtual, payment_type, etc.)
✅ Status vente → 'waiting_for_payment'
✅ Message de succès affiché
✅ Visible dans dashboard avec nouveau status
✅ Paiement visible dans /payments avec indicateur "Virtual"
```

### Scénario Fallback (Migration Partielle)

```
✅ Page d'approbation charge
✅ Clic sur "Approve Sale"
⚠️ Erreur création paiement virtuel (colonnes manquantes)
✅ Fallback: Paiement créé sans colonnes virtuelles
✅ Status vente → 'customer_approved'
✅ Message de succès affiché
✅ Visible dans dashboard avec nouveau status
✅ Paiement visible dans /payments (sans indicateur "Virtual")
```

### Scénario Échec (À Débugger)

```
✅ Page d'approbation charge
✅ Clic sur "Approve Sale"
❌ Erreur dans console
❌ Status reste 'approved' (inchangé)
❌ Pas de paiement créé
❌ Message d'erreur affiché
```

---

## 🐛 Dépannage

### Problème 1: Page d'Approbation Ne Charge Pas

**Symptômes:**
- Erreur 404
- Ou page blanche

**Solutions:**

1. **Vérifier la Route**
   ```typescript
   // Dans App.tsx, devrait exister:
   <Route path="/sales/approve/:saleId/:token" element={<CustomerSaleApproval />} />
   ```

2. **Vérifier l'URL**
   - Format correct: `/sales/approve/{UUID}/{TOKEN}`
   - UUID valide (avec tirets)
   - Token présent (même "test" pour dev)

3. **Vérifier que Vente Existe**
   ```sql
   SELECT id, sale_number, status
   FROM sales
   WHERE id = 'VOTRE_SALE_ID';
   ```

### Problème 2: Erreur "Sale not found"

**Solution:**
```sql
-- Vérifier RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'sales';

-- Si trop restrictif, temporairement:
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
-- Retester
-- Puis réactiver:
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
```

### Problème 3: Status Ne Change Pas

**Console montre:**
```
[customerApproveSale] Error creating virtual payment: column "is_virtual" does not exist
[customerApproveSale] Fallback also failed: ...
```

**Solution:**
Migration pas appliquée. Exécuter:
```sql
-- Voir: supabase/migrations/20251030050000_enhance_payments_virtual_system.sql
-- Ou au minimum:
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'actual';
```

**Console montre:**
```
[customerApproveSale] waiting_for_payment failed: violates check constraint
```

**Solution:**
Status pas autorisé. Exécuter:
```sql
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_status_check
  CHECK (status IN (
    'customer_pending', 'approved', 'customer_approved',
    'waiting_for_payment', 'payment_received', 'completed',
    'rejected', 'cancelled'
  ));
```

### Problème 4: Paiement Pas Créé

**Console montre:**
```
[customerApproveSale] Success! Payment ID: xxx
```

Mais en DB: Aucun paiement

**Solution:**
RLS Policy bloque. Vérifier:
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'payments';

-- Temporairement pour test:
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
```

---

## 📊 Checklist de Test Complet

### Avant le Test
- [ ] Vente existe avec status='approved'
- [ ] Customer avec email valide
- [ ] DevTools Console ouvert (F12)
- [ ] Migration vérifiée (colonnes + fonctions)

### Pendant le Test
- [ ] URL d'approbation accessible
- [ ] Page charge sans erreur
- [ ] Détails vente affichés correctement
- [ ] Bouton "Approve Sale" visible et cliquable

### Après Approbation
- [ ] Message de succès affiché
- [ ] Console sans erreur critique
- [ ] Logs `[customerApproveSale]` présents
- [ ] Status changé dans dashboard

### Vérification Database
- [ ] Status vente = 'waiting_for_payment' OU 'customer_approved'
- [ ] Paiement créé (reference_number like 'VP-%')
- [ ] Audit log enregistré
- [ ] Updated_at mis à jour

---

## 🎯 Commandes Rapides

### Vérifier État Actuel

```sql
-- Tout-en-un: État du système
SELECT 'Sales' as table_name, COUNT(*) as count, status
FROM sales
GROUP BY status
UNION ALL
SELECT 'Payments', COUNT(*), COALESCE(payment_type, 'standard')
FROM payments
GROUP BY payment_type;
```

### Réinitialiser une Vente pour Retest

```sql
-- ATTENTION: Supprimer paiements et réinitialiser status
DELETE FROM payments
WHERE sale_id = (SELECT id FROM sales WHERE sale_number = 'SL-2025-001');

UPDATE sales
SET status = 'approved', updated_at = NOW()
WHERE sale_number = 'SL-2025-001';

-- Maintenant vous pouvez retester l'approbation
```

### Voir Dernière Activité

```sql
-- Voir ce qui s'est passé récemment
SELECT
  'Sales' as source,
  sale_number as reference,
  status,
  updated_at
FROM sales
ORDER BY updated_at DESC
LIMIT 5

UNION ALL

SELECT
  'Payments' as source,
  reference_number as reference,
  status,
  created_at as updated_at
FROM payments
ORDER BY created_at DESC
LIMIT 5

ORDER BY updated_at DESC;
```

---

## 🆘 Si Tout Échoue

### Collecte Complète d'Informations

1. **Console Logs (F12)**
   - Copier TOUS les logs préfixés `[customerApproveSale]`
   - Chercher erreurs en rouge

2. **Database State**
   ```sql
   -- Exécuter et copier résultat complet:
   \i check-sales-for-approval.sql
   ```

3. **Network Tab (F12)**
   - Onglet "Network"
   - Filtrer "Fetch/XHR"
   - Chercher requêtes vers Supabase
   - Copier erreurs (Status 400, 500, etc.)

4. **Route Verification**
   - Vérifier URL exacte utilisée
   - Copier message d'erreur si page ne charge pas

### Envoyer pour Analyse

Format:
```
CONSOLE LOGS:
[Copier ici]

SQL VERIFICATION:
[Copier résultat check-sales-for-approval.sql]

NETWORK ERRORS:
[Copier erreurs réseau]

URL UTILISÉE:
[Copier URL exacte]
```

---

## 🎉 Test Réussi Quand...

✅ Vous cliquez "Approve Sale"
✅ Message de succès s'affiche
✅ Console montre: `[customerApproveSale] Success! Payment ID: xxx`
✅ Dashboard montre nouveau status (waiting_for_payment OU customer_approved)
✅ Paiement visible dans liste des paiements
✅ Query SQL confirme changement de status

**Si TOUT ça fonctionne → Système OK! 🎊**

**Si UN élément échoue → Suivre "Dépannage" ci-dessus! 🔧**
