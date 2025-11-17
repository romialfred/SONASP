# 🚨 CORRECTION URGENTE: Workflow Production → Shipping

## ❌ PROBLÈME IDENTIFIÉ

**RÉGRESSION CRITIQUE**: Aucun trigger pour créer automatiquement `shipping_preparations` quand une production passe à `ready_for_customs`.

### Symptômes
- ✅ Production validée "Prêt pour la Douane" dans Production Management
- ❌ RIEN n'apparaît dans Shipping Preparation
- ❌ Le workflow est cassé

### Root Cause
Le trigger automatique `trigger_auto_create_shipping_on_ready_for_customs` **n'existe PAS** dans la base de données.

---

## ✅ SOLUTION

### Étape 1: Appliquer le Trigger SQL

1. **Ouvrir** Supabase Dashboard
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql
   ```

2. **Créer** un nouveau SQL Query

3. **Copier-Coller** le contenu du fichier:
   ```
   APPLY_THIS_IN_SUPABASE_SQL_EDITOR.sql
   ```

4. **Exécuter** (bouton Run ou Ctrl+Enter)

5. **Vérifier** le résultat:
   ```
   ✅ "TRIGGER INSTALLÉ AVEC SUCCÈS !"
   ✅ "Workflow Production → Shipping opérationnel"
   ```

### Étape 2: Tester le Workflow

1. **Aller** dans Production Management (`/production/in-safe`)

2. **Sélectionner** une production avec status "Préparé"

3. **Changer** le status vers "Prêt pour la Douane"

4. **Vérifier** dans Shipping Preparation (`/shipping`)
   - Un nouveau shipping doit apparaître **AUTOMATIQUEMENT**
   - Status initial: **"pending"** (En attente douane)
   - Numéro de lot: **`EXP-YYYYMMDD-XXXXXXXX`**

---

## 🔄 WORKFLOW COMPLET (après correction)

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRODUCTION MANAGEMENT                         │
│                                                                   │
│  1. Créer production                    → Status: "prepared"     │
│  2. Valider "Prêt pour la Douane"      → Status: "ready_for...  │
│                                              │                    │
│                                              │ TRIGGER AUTO       │
│                                              ▼                    │
└──────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                   SHIPPING PREPARATION                            │
│                                                                   │
│  3. Shipping créé AUTO                  → Status: "pending"      │
│  4. Approbation douane                  → Status: "prepared"     │
│  5. Expédition                          → Status: "shipped"      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📋 DÉTAILS TECHNIQUES

### Trigger Créé
```sql
CREATE TRIGGER trigger_auto_create_shipping_on_ready_for_customs
  AFTER UPDATE OF status ON daily_production
  FOR EACH ROW
  WHEN (NEW.status = 'ready_for_customs')
  EXECUTE FUNCTION auto_create_shipping_on_ready_for_customs();
```

### Fonction Créée
```sql
auto_create_shipping_on_ready_for_customs()
```

**Actions**:
1. Détecte changement status → `ready_for_customs`
2. Génère numéro de lot: `EXP-20251117-abcd1234`
3. Crée `shipping_preparations` avec:
   - `daily_production_id`: lien vers production
   - `status`: `pending`
   - `total_net_weight_grams`: copie du poids production
   - `total_gross_weight_grams`: +2% estimé
4. Log dans `unified_status_history`

---

## ⚠️ PRÉVENTION RÉGRESSION

### Tests à Effectuer
- [ ] Production → ready_for_customs
- [ ] Vérifier shipping créé automatiquement
- [ ] Vérifier numéro de lot unique
- [ ] Vérifier poids copiés correctement
- [ ] Vérifier historique des status

### Monitoring
Vérifier régulièrement:
```sql
-- Vérifier que le trigger existe
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'trigger_auto_create_shipping_on_ready_for_customs';

-- Vérifier les productions sans shipping
SELECT dp.id, dp.production_date, dp.status
FROM daily_production dp
LEFT JOIN shipping_preparations sp ON sp.daily_production_id = dp.id
WHERE dp.status = 'ready_for_customs'
AND sp.id IS NULL;
```

---

## 📞 SUPPORT

Si le problème persiste après application du trigger:

1. **Vérifier** que le trigger est bien créé:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE '%shipping%';
   ```

2. **Vérifier** les erreurs dans logs:
   - Supabase Dashboard > Logs
   - Filtrer par "shipping" ou "trigger"

3. **Tester manuellement**:
   ```sql
   UPDATE daily_production
   SET status = 'ready_for_customs'
   WHERE id = 'YOUR_PRODUCTION_ID';
   ```

---

**Date**: 2025-11-17
**Criticité**: 🔴 CRITIQUE
**Impact**: Workflow Production → Shipping cassé
**Solution**: Trigger SQL à appliquer immédiatement
