# À EXÉCUTER MAINTENANT

## Script Optimisé

**Fichier:** `ADD_SALES_STATUS_TRIGGER_ONLY.sql`

### Que fait ce script?

1. Met à jour la contrainte CHECK sur `unified_status_history` pour accepter 'sales'
2. Crée la fonction `log_sales_status_change()`
3. Crée le trigger `sales_status_history_trigger` sur la table sales
4. Vérifie que tout est en place

### Pourquoi optimisé?

- La colonne `status` existe déjà ✅
- L'index existe déjà ✅
- Seul le trigger manque ❌

Ce script ajoute **uniquement ce qui manque**.

---

## COPIER/COLLER DANS SUPABASE SQL EDITOR

### Étapes:

1. Ouvrir Supabase SQL Editor
2. Copier tout le contenu de `ADD_SALES_STATUS_TRIGGER_ONLY.sql`
3. Coller dans l'éditeur
4. Cliquer sur "Run"

### Résultat attendu:

```
========================================
AJOUT DU TRIGGER HISTORIQUE
========================================

Etape 1/3: Mise a jour contrainte unified_status_history...
  ✓ Contrainte mise a jour (accepte maintenant sales)

Etape 2/3: Creation de la fonction trigger...
  ✓ Fonction log_sales_status_change() creee

Etape 3/3: Creation du trigger...
  ✓ Trigger sales_status_history_trigger cree

========================================
VERIFICATION FINALE
========================================

1. Fonction trigger:
   Existe: ✓ OUI
   Nom: log_sales_status_change()

2. Trigger:
   Existe: ✓ OUI
   Nom: sales_status_history_trigger
   Table: sales

3. Configuration unified_status_history:
   Contrainte accepte sales: ✓ OUI

4. Donnees:
   Total ventes: 2

========================================
RESULTAT: ✓ CONFIGURATION COMPLETE!

Le trigger est actif.
Les changements de statut seront logues dans unified_status_history.

Test: Modifiez le statut d'une vente pour verifier.
========================================
```

---

## Après l'exécution

### Tester le trigger:

```sql
-- Mettre à jour le statut d'une vente
UPDATE sales
SET status = 'approved_by_management'
WHERE id = (SELECT id FROM sales LIMIT 1);

-- Vérifier l'historique
SELECT
  entity_type,
  entity_id,
  old_status,
  new_status,
  changed_at,
  metadata->>'sale_number' as sale_number
FROM unified_status_history
WHERE entity_type = 'sales'
ORDER BY changed_at DESC
LIMIT 5;
```

Vous devriez voir l'entrée avec:
- `old_status`: 'pending_management_approval'
- `new_status`: 'approved_by_management'

---

## Fichiers Créés

| Fichier | Usage |
|---------|-------|
| `ADD_SALES_STATUS_TRIGGER_ONLY.sql` | ✅ **EXÉCUTER MAINTENANT** |
| `VERIFIER_ETAT_SALES.sql` | Diagnostic (déjà exécuté) |
| `RAPPORT_AUDIT_CRITIQUE_SCRIPTS.md` | Documentation technique |

---

## Prêt?

Copiez le contenu de **ADD_SALES_STATUS_TRIGGER_ONLY.sql** et collez-le dans Supabase SQL Editor.

C'est tout! 🚀
