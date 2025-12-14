# ✅ Système de Paiements Virtuels - Configuration Complète

## Résumé Exécutif

**Problème:** Les ventes approuvées par les clients ne créent PAS automatiquement d'enregistrements dans la table `payments`, donc la page "Payment Records" est vide.

**Solution:** Créer un trigger database qui génère automatiquement un enregistrement de paiement virtuel quand une vente passe au statut `customer_approved` ou `waiting_for_payment`.

**Date:** 14 décembre 2025
**Fichier SQL:** `create_virtual_payments_system.sql`

---

## 🔍 Analyse du Problème

### État Actuel
```
Vente approuvée par client (status='customer_approved')
    ↓
❌ AUCUN enregistrement créé dans table payments
    ↓
Page "Payment Records" affiche: "No payments found"
    ↓
Les métriques montrent: $0.00 partout
```

### État Souhaité
```
Vente approuvée par client (status='customer_approved')
    ↓
✅ Trigger crée automatiquement un payment record
    ↓
Payment record:
  - sale_id: lié à la vente
  - amount: final_proceeds de la vente
  - status: 'pending'
  - expected_date: calculé selon mechanism_type
    ↓
Page "Payment Records" affiche la vente
    ↓
Métriques actualisées avec montants réels
```

---

## 📊 Workflow Automatique

### Déclenchement du Trigger

```sql
-- Le trigger se déclenche quand:
UPDATE sales SET status = 'customer_approved' WHERE id = 'xxx';

-- OU

INSERT INTO sales (...) VALUES (..., status='customer_approved', ...);
```

### Calcul de la Date de Paiement Attendue

| Mechanism Type | Expected Date | Exemple |
|----------------|---------------|---------|
| `spot` | Date actuelle | Si approuvé le 14/12, paiement attendu le 14/12 |
| `forward_7_days` | Date + 7 jours | Si approuvé le 14/12, paiement attendu le 21/12 |
| `forward_14_days` | Date + 14 jours | Si approuvé le 14/12, paiement attendu le 28/12 |
| `default` | Date + 2 jours | Si approuvé le 14/12, paiement attendu le 16/12 |

### Génération du Numéro de Facture

Format: `INV-YYYYMMDD-XXXXXXXX`
- `YYYYMMDD`: Date actuelle
- `XXXXXXXX`: 8 premiers caractères de l'UUID de la vente

Exemple: `INV-20251214-A3F2B9C1`

---

## 🛠️ Composants du Système

### 1. Table `payments` (Structure)

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sales(id),
  customer_id UUID REFERENCES customers(id),
  invoice_number TEXT,
  expected_date DATE NOT NULL,
  actual_date DATE,
  due_date DATE,
  amount DECIMAL(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  fx_rate DECIMAL(10, 6) DEFAULT 1.0,
  bank_name TEXT,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  proof_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Fonction de Calcul de Date

```sql
CREATE FUNCTION calculate_payment_expected_date(
  p_mechanism_type TEXT,
  p_approval_date DATE DEFAULT CURRENT_DATE
)
RETURNS DATE
```

**Logique:**
- Analyse le `mechanism_type` de la vente
- Ajoute le nombre de jours approprié
- Retourne la date attendue

### 3. Fonction Trigger

```sql
CREATE FUNCTION create_virtual_payment_on_customer_approval()
RETURNS TRIGGER
```

**Logique:**
1. Vérifie si statut changé vers `customer_approved` ou `waiting_for_payment`
2. Vérifie qu'aucun paiement n'existe déjà pour cette vente
3. Calcule la `expected_date`
4. Génère le `invoice_number`
5. Crée l'enregistrement dans `payments`
6. Log le résultat

### 4. Trigger sur Table Sales

```sql
CREATE TRIGGER trigger_create_virtual_payment
  AFTER INSERT OR UPDATE OF status
  ON sales
  FOR EACH ROW
  EXECUTE FUNCTION create_virtual_payment_on_customer_approval();
```

**Déclenchement:**
- Après INSERT dans `sales`
- Après UPDATE du champ `status` dans `sales`
- Pour CHAQUE ligne modifiée

### 5. Backfill des Ventes Existantes

```sql
-- Recherche toutes les ventes customer_approved sans payment
-- Crée un payment pour chacune
-- Log le nombre de payments créés
```

---

## 🚀 Instructions d'Application

### Option 1: Via Supabase SQL Editor (RECOMMANDÉ)

1. **Copier le contenu du fichier SQL:**
   - Fichier: `/tmp/create_virtual_payments_system.sql`
   - OU copier le contenu ci-dessous

2. **Ouvrir Supabase Dashboard:**
   - Aller sur votre projet Supabase
   - Cliquer sur "SQL Editor" dans le menu gauche

3. **Coller et Exécuter:**
   - Coller tout le contenu SQL dans l'éditeur
   - Cliquer sur "Run" ou Ctrl+Enter
   - Attendre la fin de l'exécution

4. **Vérifier les Logs:**
   - Vous devriez voir des messages:
     ```
     NOTICE: Created payment for sale: SALE-XXX
     NOTICE: ✅ Backfill complete: 2 virtual payments created
     NOTICE: === Virtual Payments System Setup Complete ===
     NOTICE: Total payments in system: 2
     NOTICE: Total sales awaiting payment: 2
     ```

### Option 2: Via CLI (Alternative)

```bash
psql $SUPABASE_DB_URL -f create_virtual_payments_system.sql
```

---

## ✅ Vérification Post-Installation

### Test 1: Vérifier les Paiements Créés

```sql
SELECT
  p.id,
  p.invoice_number,
  p.amount,
  p.status,
  p.expected_date,
  s.sale_number,
  s.status as sale_status
FROM payments p
JOIN sales s ON s.id = p.sale_id
ORDER BY p.created_at DESC;
```

**Résultat Attendu:** 2 lignes (vos 2 ventes approuvées)

### Test 2: Vérifier le Trigger Fonctionne

```sql
-- Créer une vente test et l'approuver
INSERT INTO sales (
  sale_number,
  customer_id,
  final_proceeds,
  currency,
  mechanism_type,
  status
) VALUES (
  'TEST-001',
  'YOUR_CUSTOMER_ID',
  10000.00,
  'USD',
  'spot',
  'pending_management_approval'
);

-- Changer le statut à customer_approved
UPDATE sales
SET status = 'customer_approved'
WHERE sale_number = 'TEST-001';

-- Vérifier qu'un payment a été créé
SELECT * FROM payments WHERE sale_id IN (
  SELECT id FROM sales WHERE sale_number = 'TEST-001'
);
```

**Résultat Attendu:** 1 payment créé automatiquement

### Test 3: Vérifier dans l'Application

1. Ouvrir `/payments` dans votre application
2. Rafraîchir la page (Ctrl+Shift+R)
3. Vous devriez voir:
   - Total Payments: montant total des 2 ventes
   - Pending: montant total des 2 ventes
   - Table affichant 2 lignes avec vos ventes

---

## 📋 Détails de la Migration SQL

### STEP 1: Création/Mise à jour Table Payments

```sql
CREATE TABLE IF NOT EXISTS payments (
  -- Colonnes principales
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Informations facture
  invoice_number TEXT,
  expected_date DATE NOT NULL,
  actual_date DATE,
  due_date DATE,

  -- Montants
  amount DECIMAL(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  fx_rate DECIMAL(10, 6) DEFAULT 1.0,

  -- Détails paiement
  bank_name TEXT,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  proof_url TEXT,
  notes TEXT,

  -- Audit
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_expected_date ON payments(expected_date);
```

### STEP 2: RLS Policies

```sql
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view all payments"
  ON payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to create payments"
  ON payments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update payments"
  ON payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete payments"
  ON payments FOR DELETE TO authenticated USING (true);
```

### STEP 3: Fonction de Calcul de Date

```sql
CREATE OR REPLACE FUNCTION calculate_payment_expected_date(
  p_mechanism_type TEXT,
  p_approval_date DATE DEFAULT CURRENT_DATE
)
RETURNS DATE
LANGUAGE plpgsql
AS $$
BEGIN
  CASE p_mechanism_type
    WHEN 'spot' THEN
      RETURN p_approval_date;
    WHEN 'forward_7', 'forward_7_days' THEN
      RETURN p_approval_date + INTERVAL '7 days';
    WHEN 'forward_14', 'forward_14_days' THEN
      RETURN p_approval_date + INTERVAL '14 days';
    ELSE
      RETURN p_approval_date + INTERVAL '2 days';
  END CASE;
END;
$$;
```

### STEP 4: Fonction Trigger

```sql
CREATE OR REPLACE FUNCTION create_virtual_payment_on_customer_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expected_date DATE;
  v_invoice_number TEXT;
  v_payment_exists BOOLEAN;
BEGIN
  -- Vérifier changement de statut
  IF NEW.status IN ('customer_approved', 'waiting_for_payment') AND
     (OLD.status IS NULL OR OLD.status NOT IN ('customer_approved', 'waiting_for_payment')) THEN

    -- Vérifier si payment existe déjà
    SELECT EXISTS(
      SELECT 1 FROM payments WHERE sale_id = NEW.id
    ) INTO v_payment_exists;

    IF NOT v_payment_exists THEN
      -- Calculer expected_date
      v_expected_date := calculate_payment_expected_date(NEW.mechanism_type, CURRENT_DATE);

      -- Générer invoice_number
      v_invoice_number := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
                          UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));

      -- Créer payment
      INSERT INTO payments (
        sale_id,
        customer_id,
        invoice_number,
        expected_date,
        due_date,
        amount,
        currency,
        status,
        created_by,
        created_at
      ) VALUES (
        NEW.id,
        NEW.customer_id,
        v_invoice_number,
        v_expected_date,
        v_expected_date + INTERVAL '30 days',
        NEW.final_proceeds,
        COALESCE(NEW.currency, 'USD'),
        'pending',
        NEW.created_by,
        NOW()
      );

      RAISE NOTICE 'Virtual payment created for sale %', NEW.sale_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

### STEP 5: Trigger

```sql
DROP TRIGGER IF EXISTS trigger_create_virtual_payment ON sales;

CREATE TRIGGER trigger_create_virtual_payment
  AFTER INSERT OR UPDATE OF status
  ON sales
  FOR EACH ROW
  EXECUTE FUNCTION create_virtual_payment_on_customer_approval();
```

### STEP 6: Backfill

```sql
-- Crée des payments pour toutes les ventes customer_approved existantes
-- qui n'ont pas encore de payment associé
```

---

## 🎯 Résultats Attendus

### Avant Migration

**Page Payment Records:**
```
Total Payments: $0.00
Paid: $0.00
Pending: $0.00
Overdue: 0

Table: "No payments found"
```

### Après Migration

**Page Payment Records:**
```
Total Payments: $150,234.56  (montant de vos 2 ventes)
Paid: $0.00
Pending: $150,234.56
Overdue: 0

Table:
┌──────────────────┬─────────────┬────────────┬──────────────┬─────────┐
│ Invoice          │ Customer    │ Amount     │ Due Date     │ Status  │
├──────────────────┼─────────────┼────────────┼──────────────┼─────────┤
│ INV-20251214-... │ Customer A  │ $75,000.00 │ Jan 13, 2025 │ Pending │
│ INV-20251214-... │ Customer B  │ $75,234.56 │ Jan 13, 2025 │ Pending │
└──────────────────┴─────────────┴────────────┴──────────────┴─────────┘
```

---

## 🔄 Workflow Complet de Paiement

### Étape 1: Vente Approuvée par Management
```
Sale Status: pending_management_approval
    ↓ (Management approves)
Sale Status: management_approved
    ↓
Email envoyé au client
```

### Étape 2: Vente Approuvée par Client
```
Client clique "Approve" dans email
    ↓
Sale Status: customer_approved
    ↓
✅ TRIGGER DÉCLENCHÉ
    ↓
Payment record créé automatiquement:
  - invoice_number: INV-20251214-XXXXXXXX
  - amount: $75,000.00
  - status: 'pending'
  - expected_date: calculé selon mechanism
```

### Étape 3: Visible sur Page Payments
```
User ouvre /payments
    ↓
PaymentsPage.tsx:
  - Query: SELECT * FROM payments
  - Résultat: 2 payments trouvés
    ↓
UI affiche:
  - Métriques actualisées
  - Table avec les 2 paiements
  - Status "Pending"
```

### Étape 4: Enregistrement du Paiement Réel
```
User clique "Create Payment" sur une ligne
    ↓
Remplit formulaire avec:
  - Received amount
  - Received date
  - Bank details
  - Proof upload
    ↓
UPDATE payments SET:
  actual_date = received_date,
  status = 'approved',
  proof_url = uploaded_file
    ↓
Sale Status: payment_received
    ↓
Sale Status: completed
```

---

## 📝 Notes Importantes

### Sécurité
- ✅ RLS activé sur `payments` table
- ✅ Trigger en mode `SECURITY DEFINER` (exécuté avec droits owner)
- ✅ Vérification d'existence avant création (évite doublons)

### Performance
- ✅ Index créés sur colonnes clés (sale_id, status, expected_date)
- ✅ Trigger optimisé (vérifie changement de statut avant traitement)
- ✅ Query backfill optimisée avec LEFT JOIN

### Maintenance
- Trigger peut être désactivé: `ALTER TABLE sales DISABLE TRIGGER trigger_create_virtual_payment;`
- Trigger peut être réactivé: `ALTER TABLE sales ENABLE TRIGGER trigger_create_virtual_payment;`
- Payments peuvent être manuellement créés si besoin

### Cas Particuliers

**1. Vente annulée après création payment:**
```sql
-- Le payment reste en base avec status 'pending'
-- L'admin peut le supprimer manuellement si nécessaire
-- Ou le statut peut être changé à 'cancelled'
```

**2. Changement de montant de vente:**
```sql
-- Le payment garde le montant original
-- Si montant vente change, mettre à jour payment manuellement:
UPDATE payments SET amount = (
  SELECT final_proceeds FROM sales WHERE id = payments.sale_id
)
WHERE sale_id = 'xxx';
```

**3. Multiple payments pour une vente:**
```sql
-- Le trigger vérifie l'existence avant création
-- Impossible de créer un doublon automatiquement
-- Mais possibilité de créer manuellement si besoin de paiements partiels
```

---

## ✅ Checklist de Validation

### Avant Migration
- [ ] Backup de la base de données effectué
- [ ] Accès SQL Editor Supabase confirmé
- [ ] Fichier SQL téléchargé et prêt

### Pendant Migration
- [ ] SQL copié dans Supabase SQL Editor
- [ ] Exécution lancée (Run)
- [ ] Logs affichés sans erreurs
- [ ] Messages NOTICE confirmant succès

### Après Migration
- [ ] Table `payments` contient 2 enregistrements
- [ ] Trigger `trigger_create_virtual_payment` existe
- [ ] Fonction `create_virtual_payment_on_customer_approval()` existe
- [ ] Fonction `calculate_payment_expected_date()` existe
- [ ] RLS policies actives sur `payments`

### Test Application
- [ ] Page `/payments` affiche les 2 paiements
- [ ] Métriques correctes (Total, Pending)
- [ ] Détails paiements visibles au clic
- [ ] Création nouvelle vente test déclenche auto-création payment

---

## 🚨 Dépannage

### Problème: Aucun payment créé après migration

**Solution:**
```sql
-- Vérifier que les ventes ont bien le bon statut
SELECT id, sale_number, status
FROM sales
WHERE status IN ('customer_approved', 'waiting_for_payment');

-- Si aucune vente n'a ces statuts, changer manuellement:
UPDATE sales SET status = 'customer_approved'
WHERE id = 'YOUR_SALE_ID';
```

### Problème: Trigger ne se déclenche pas

**Solution:**
```sql
-- Vérifier que le trigger existe
SELECT * FROM pg_trigger WHERE tgname = 'trigger_create_virtual_payment';

-- Réactiver le trigger si désactivé
ALTER TABLE sales ENABLE TRIGGER trigger_create_virtual_payment;
```

### Problème: Erreur de permissions

**Solution:**
```sql
-- Vérifier RLS
SELECT tablename, policyname FROM pg_policies WHERE tablename = 'payments';

-- Si aucune policy, les recréer (voir STEP 2 du SQL)
```

---

## 📞 Support

Si des problèmes persistent après avoir suivi toutes les étapes:
1. Copier les messages d'erreur complets
2. Exécuter les requêtes de vérification ci-dessus
3. Partager les résultats pour diagnostic

---

## 🎉 Conclusion

Une fois la migration appliquée avec succès:

✅ **Ventes approuvées = Paiements automatiques**
✅ **Page Payments fonctionnelle avec données réelles**
✅ **Workflow complet vente → paiement opérationnel**
✅ **Métriques et rapports corrects**

Le système est maintenant prêt pour gérer les paiements de manière automatisée et traçable!

---

*Documentation créée le 14 décembre 2025*
*Fichier SQL: create_virtual_payments_system.sql*
*Status: ✅ Prêt à appliquer*
