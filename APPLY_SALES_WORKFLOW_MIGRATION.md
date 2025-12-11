# Guide d'Application - Migration Sales Workflow

## 🔴 PROBLÈME ACTUEL

Erreur lors de la création d'une vente:
```
invalid input value for enum sale_status: "pending_management_approval"
```

**Cause**: L'enum `sale_status` n'a que 3 valeurs ('in_sale', 'sold', 'cancelled') mais le code utilise 11 statuses différents.

## ✅ SOLUTION (2 minutes)

### Étape 1: Appliquer la Migration

**Dans Supabase Dashboard:**

1. Aller sur https://dashboard.supabase.com
2. Sélectionner votre projet
3. Cliquer sur **SQL Editor** dans la barre latérale
4. Cliquer sur **New Query**
5. Copier-coller tout le contenu du fichier `ADD_SALES_WORKFLOW_STATUSES.sql`
6. Cliquer sur **Run** (ou Ctrl+Enter)

**Résultat attendu:**
```
✓ Added status: create_sales
✓ Added status: pending_management_approval
✓ Added status: management_approved
✓ Added status: management_rejected
✓ Added status: pending_for_customer_approval
✓ Added status: customer_approved
✓ Added status: customer_rejected
✓ Added status: waiting_for_payment
✓ Added status: virtual_payment
✓ Added status: payment_received
✓ Added status: completed
```

### Étape 2: Vérifier la Migration

Exécuter cette requête dans SQL Editor:
```sql
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status')
ORDER BY enumsortorder;
```

**Vous devriez voir 14 statuses:**
- in_sale
- sold
- cancelled
- create_sales
- pending_management_approval
- management_approved
- management_rejected
- pending_for_customer_approval
- customer_approved
- customer_rejected
- waiting_for_payment
- virtual_payment
- payment_received
- completed

### Étape 3: Tester la Création de Vente

1. Retourner dans l'application
2. Recharger la page (Ctrl+R)
3. Essayer de créer une nouvelle vente
4. ✅ Devrait fonctionner maintenant!

## 📊 WORKFLOW IMPLEMENTÉ

```
┌─────────────────────────────────────────────────────────────┐
│                      SALES WORKFLOW                          │
└─────────────────────────────────────────────────────────────┘

1. CREATE_SALES
   │ (User creates sale)
   ↓
2. PENDING_MANAGEMENT_APPROVAL ⏱️
   │ (Awaiting management decision)
   ├─→ MANAGEMENT_APPROVED
   │   │ (Management approves)
   │   ↓
   │   3. PENDING_FOR_CUSTOMER_APPROVAL ⏱️
   │      │ (Email sent to customer)
   │      ├─→ CUSTOMER_APPROVED
   │      │   │ (Customer approves)
   │      │   ↓
   │      │   4. WAITING_FOR_PAYMENT ⏱️
   │      │      │ (Awaiting payment proof)
   │      │      ├─→ VIRTUAL_PAYMENT (optional)
   │      │      ├─→ PAYMENT_RECEIVED
   │      │      │   │ (Payment confirmed)
   │      │      │   ↓
   │      │      │   5. COMPLETED ✅
   │      │      │
   │      │      └─→ CANCELLED ❌
   │      │
   │      └─→ CUSTOMER_REJECTED ❌
   │          (Customer rejects)
   │
   └─→ MANAGEMENT_REJECTED ❌
       (Management rejects)
```

## 🔧 PERMISSIONS RLS

Après la migration, vérifiez que les permissions RLS permettent les opérations:

```sql
-- Vérifier les policies sur sales
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'sales';
```

Si nécessaire, ajoutez les policies pour INSERT:
```sql
CREATE POLICY "Users can insert sales"
ON sales
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());
```

## 📝 NOTES IMPORTANTES

1. **Migration Idempotente**: Peut être exécutée plusieurs fois sans erreur
2. **Pas de Downtime**: N'affecte pas les données existantes
3. **Backwards Compatible**: Les anciens statuses sont préservés
4. **Safe**: Vérifie l'existence avant d'ajouter

## 🚨 EN CAS DE PROBLÈME

### Erreur: "must be owner of type sale_status"

**Solution**: Utiliser le compte super admin de Supabase ou contacter le support

### Migration déjà appliquée

**Résultat**: Tous les statuses montreront "Status already exists" - c'est normal!

### Erreur persiste après migration

1. Vérifier que les 14 statuses existent (requête Étape 2)
2. Vider le cache navigateur et redémarrer le serveur
3. Vérifier les permissions RLS sur la table sales

## ✅ CHECKLIST POST-MIGRATION

- [ ] Migration appliquée avec succès
- [ ] 14 statuses visibles dans pg_enum
- [ ] Application redémarrée
- [ ] Cache navigateur vidé
- [ ] Test création de vente réussi
- [ ] Status initial = "pending_management_approval"

## 📞 SUPPORT

Si le problème persiste après ces étapes:
1. Exécuter `CHECK_SALES_TABLE_STRUCTURE.sql` pour diagnostic complet
2. Vérifier les logs Supabase (Dashboard > Logs > Database)
3. Exécuter `TEST_SALES_INSERT.sql` pour test d'insertion directe

---

**Temps estimé**: 2-3 minutes
**Complexité**: Facile
**Risk**: Aucun (migration safe)
