# RAPPORT D'ANALYSE VENTES & PAIEMENTS

## État des Lieux

### 1. Enums de Statut dans le Code TypeScript

#### salesStatuses.ts - Statuts Définis
```typescript
CREATE_SALES
PENDING_MANAGEMENT_APPROVAL        ← Statut initial par défaut
MANAGEMENT_APPROVED
MANAGEMENT_REJECTED
PENDING_FOR_CUSTOMER_APPROVAL
CUSTOMER_APPROVED
CUSTOMER_REJECTED
WAITING_FOR_PAYMENT
VIRTUAL_PAYMENT
PAYMENT_RECEIVED
COMPLETED
```

#### sales.ts Schema Zod - Statuts Supportés
```typescript
'create_sales'
'pending_management_approval'
'management_approved'
'management_rejected'
'pending_for_customer_approval'
'customer_approved'
'customer_rejected'
'waiting_for_payment'
'virtual_payment'
'payment_received'
'completed'
'pending'           ← Mapping vers pending_management_approval
'approved'          ← Mapping vers management_approved
'rejected'          ← Mapping vers management_rejected
```

---

## 2. Problèmes Identifiés

### A. TRIGGER handle_sales_status_change()

**Problème:** Le trigger utilise des valeurs ENUM qui n'existent probablement pas dans la base de données.

```sql
-- Code actuel dans le trigger:
CASE
  WHEN NEW.status = 'pending_management_approval'
  WHEN NEW.status = 'management_approved'
  WHEN NEW.status = 'pending_for_customer_approval'
  ...
END;
```

**Action requise:** Vérifier que l'ENUM `sale_status` dans la base contient EXACTEMENT ces valeurs.

### B. Statuts de Paiement

**Manque de définition:** Aucun fichier de constantes pour les statuts de paiement.

**Dans paymentService.ts:**
- Références à `status` mais pas de constantes définies
- Pas d'ENUM TypeScript pour `payment_status`

---

## 3. Actions à Exécuter

### Étape 1: Exécuter le Script SQL d'Analyse

**Fichier:** `ANALYSE_COMPLETE_VENTES_PAIEMENTS.sql`

Dans Supabase SQL Editor, exécutez ce script pour obtenir:
1. Les ENUM réels dans la base
2. La structure des tables
3. Tous les triggers existants
4. Le code des fonctions de trigger
5. Les contraintes et politiques RLS

### Étape 2: Comparer les Résultats

Une fois le script exécuté, comparez:

#### A. ENUM sale_status dans la DB vs TypeScript
- Si l'ENUM DB est différent → CORRIGER L'ENUM DB
- Si les triggers utilisent des valeurs incorrectes → CORRIGER LES TRIGGERS

#### B. ENUM payment_status
- Vérifier s'il existe
- Créer les constantes TypeScript correspondantes

#### C. Vérifier les Triggers
- `handle_sales_status_change()` → Valeurs ENUM correctes?
- Autres triggers sur `gold_sales` → Cohérents?
- Triggers sur `payments` → Existent-ils?

---

## 4. Corrections à Prévoir

### A. Si l'ENUM sale_status est incorrect

```sql
-- Option 1: Ajouter les valeurs manquantes
ALTER TYPE sale_status ADD VALUE IF NOT EXISTS 'pending_management_approval';
ALTER TYPE sale_status ADD VALUE IF NOT EXISTS 'management_approved';
-- etc.

-- Option 2: Recréer l'ENUM (plus complexe)
```

### B. Si les triggers sont incorrects

```sql
-- Corriger handle_sales_status_change()
CREATE OR REPLACE FUNCTION handle_sales_status_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Utiliser les bonnes valeurs ENUM
  CASE
    WHEN NEW.status = 'pending_management_approval' THEN
      -- Logic here
    ...
  END CASE;

  RETURN NEW;
END;
$$;
```

### C. Créer les Constantes de Paiement

**Fichier à créer:** `src/constants/paymentStatuses.ts`

```typescript
export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed'
} as const;

export type PaymentStatus = typeof PAYMENT_STATUSES[keyof typeof PAYMENT_STATUSES];
```

---

## 5. Checklist de Vérification

### Base de Données
- [ ] Vérifier ENUM `sale_status` existe et contient les bonnes valeurs
- [ ] Vérifier ENUM `payment_status` existe
- [ ] Vérifier structure table `gold_sales` (colonne status)
- [ ] Vérifier structure table `payments` (colonne status)
- [ ] Vérifier tous les triggers sur `gold_sales`
- [ ] Vérifier tous les triggers sur `payments`
- [ ] Vérifier les contraintes CHECK
- [ ] Vérifier les politiques RLS

### Code Frontend
- [ ] `salesStatuses.ts` → Cohérent avec DB
- [ ] `paymentStatuses.ts` → À créer si manquant
- [ ] `sales.ts` schema Zod → Mapping correct
- [ ] `salesService.ts` → Utilise les bonnes constantes
- [ ] `paymentService.ts` → Utilise les bonnes constantes
- [ ] `validationService.ts` → Valide les bons statuts

### Tests Fonctionnels
- [ ] Créer une vente → Status = `pending_management_approval`
- [ ] Approuver par management → Status = `management_approved`
- [ ] Envoyer au client → Status = `pending_for_customer_approval`
- [ ] Client approuve → Status = `customer_approved`
- [ ] Créer paiement → Vérifie le statut de paiement
- [ ] Approuver paiement → Status vente = `payment_received`
- [ ] Finaliser vente → Status = `completed`

---

## 6. Prochaines Étapes Immédiates

1. **EXÉCUTER** `ANALYSE_COMPLETE_VENTES_PAIEMENTS.sql` dans Supabase
2. **PARTAGER** les résultats pour analyse
3. **IDENTIFIER** les incohérences
4. **CRÉER** les scripts de correction SQL
5. **APPLIQUER** les corrections
6. **TESTER** le workflow complet

---

## Notes Importantes

### Trigger SECURITY DEFINER
Tous les triggers utilisent `SECURITY DEFINER` et `SET search_path = public` pour éviter les erreurs de permissions RLS.

### Migration Idempotente
Toutes les corrections doivent être idempotentes (utilisez `IF EXISTS`, `IF NOT EXISTS`).

### Ordre d'Exécution
1. Corriger les ENUM
2. Corriger les triggers
3. Tester le code frontend
4. Valider le workflow complet
