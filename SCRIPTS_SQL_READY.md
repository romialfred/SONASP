# ✅ Scripts de Réinitialisation - Prêts et Testés

## 📅 Date: 2025-01-15

---

## 🎯 Objectif

Fournir des scripts pour réinitialiser tous les statuts de production à `"prepared"` avec enregistrement automatique dans `unified_status_history`.

---

## 📦 2 Options Disponibles

### Option 1: Script JavaScript (Recommandé)

**Fichier:** `scripts/reset-all-production-to-prepared.js`

**Avantages:**
- ✅ Mode dry-run intégré
- ✅ Interface interactive
- ✅ Progression en temps réel
- ✅ Vérifications automatiques
- ✅ Rapports détaillés

**Utilisation:**
```bash
# Preview sans modification
npm run db:reset-production-status:preview

# Exécution réelle
npm run db:reset-production-status
```

### Option 2: Script SQL (Alternatif)

**Fichier:** `scripts/reset-all-production-to-prepared.sql`

**Avantages:**
- ✅ Compatible Supabase SQL Editor
- ✅ Syntaxe SQL pure
- ✅ Messages RAISE NOTICE
- ✅ Vérifications intégrées

**Utilisation:**
```
1. Ouvrir Supabase Dashboard
2. Aller dans SQL Editor
3. Copier-coller le script
4. Cliquer sur "Run"
5. Regarder les logs
```

---

## ✅ Script SQL: Corrections Appliquées

### Problème Initial

```sql
-- ❌ NE FONCTIONNE PAS dans Supabase
\echo 'Message'
\echo ''
```

**Erreur:**
```
ERROR: 42601: syntax error at or near "\"
```

### Solution Appliquée

```sql
-- ✅ FONCTIONNE dans Supabase
DO $$
BEGIN
  RAISE NOTICE 'Message';
  RAISE NOTICE '';
END $$;
```

---

## 🔧 Bonnes Pratiques SQL Appliquées

### 1. RAISE NOTICE pour les messages

```sql
RAISE NOTICE 'Information: %', valeur;
RAISE WARNING 'Attention: %', probleme;
```

### 2. Boucles FOR pour afficher les résultats

```sql
FOR rec IN SELECT * FROM table LOOP
  RAISE NOTICE 'Colonne: %', rec.colonne;
END LOOP;
```

### 3. Variables avec préfixe v_

```sql
DECLARE
  v_count INTEGER;
  v_updated INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO v_count FROM table;
END;
```

### 4. GET DIAGNOSTICS pour compter les modifications

```sql
UPDATE table SET col = 'val' WHERE ...;
GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE '% ligne(s) modifiée(s)', v_updated;
```

### 5. COALESCE pour gérer NULL

```sql
RAISE NOTICE 'Valeur: %', COALESCE(rec.col, 'N/A');
```

### 6. RPAD pour l'alignement

```sql
RAISE NOTICE '  % : %',
  RPAD(rec.statut::text, 25),
  rec.count;
```

### 7. Sortie anticipée avec RETURN

```sql
IF nothing_to_do THEN
  RAISE NOTICE 'Rien à faire!';
  RETURN;
END IF;
```

### 8. Trigger automatique pour l'historique

```sql
-- Le trigger log_unified_status_change()
-- crée automatiquement les entrées dans
-- unified_status_history
UPDATE daily_production SET status = 'prepared' WHERE ...;
```

---

## 📊 Structure du Script SQL

```
DO $$
  DECLARE
    Variables (v_count, v_updated, rec)

  BEGIN
    1. Résumé AVANT
       - Compter total productions
       - Afficher répartition par statut

    2. Productions à modifier
       - Compter celles à changer
       - Vérifier si 0 → RETURN
       - Afficher exemples

    3. Mise à jour
       - UPDATE daily_production
       - GET DIAGNOSTICS
       - pg_sleep(0.5) pour le trigger

    4. Vérification historique
       - COUNT dans unified_status_history
       - Afficher dernières entrées

    5. Résumé APRÈS
       - Afficher nouvelle répartition
       - Messages de confirmation
  END
$$;
```

---

## 🚀 Utilisation dans Supabase

### Étapes:

1. **Ouvrir Supabase Dashboard**
   - https://app.supabase.com

2. **Aller dans SQL Editor**
   - Menu latéral → SQL Editor
   - Ou appuyer sur `⌘K` puis taper "SQL"

3. **Créer une nouvelle query**
   - Cliquer sur "+ New query"

4. **Copier le script**
   - Copier le contenu de `scripts/reset-all-production-to-prepared.sql`
   - Coller dans l'éditeur

5. **Exécuter**
   - Cliquer sur "Run" ou `⌘ Enter`

6. **Regarder les logs**
   - Les messages RAISE NOTICE apparaissent dans la console
   - Vérifier que tout s'est bien passé

---

## 📋 Exemple de sortie

```
NOTICE:
NOTICE: ========================================
NOTICE: RÉSUMÉ AVANT MODIFICATION
NOTICE: ========================================
NOTICE:
NOTICE: Total productions: 88
NOTICE:
NOTICE: Répartition par statut:
NOTICE:   ready_for_customs         : 45 production(s)
NOTICE:   prepared                  : 23 production(s)
NOTICE:   in_inventory              : 12 production(s)
NOTICE:   shipped_to_refinery       : 8 production(s)
NOTICE:
NOTICE: ========================================
NOTICE: PRODUCTIONS À MODIFIER: 65
NOTICE: ========================================
NOTICE:
NOTICE: Exemples de productions qui seront modifiées (5 premiers):
NOTICE:
NOTICE:   HUMYAN-0002          | ready_for_customs    -> prepared | Date: 31/10/2025
NOTICE:   HUMYAN-0001          | in_inventory         -> prepared | Date: 30/10/2025
NOTICE:
NOTICE: ========================================
NOTICE: MISE À JOUR EN COURS...
NOTICE: ========================================
NOTICE:
NOTICE: 65 production(s) mise(s) à jour avec succès!
NOTICE:
NOTICE: ========================================
NOTICE: VÉRIFICATION HISTORIQUE
NOTICE: ========================================
NOTICE:
NOTICE: 65 entrée(s) créée(s) dans unified_status_history
NOTICE:
NOTICE: Dernières entrées créées (5 premiers):
NOTICE:
NOTICE:   ready_for_customs    -> prepared        | 15/01 14:30:45
NOTICE:   in_inventory         -> prepared        | 15/01 14:30:44
NOTICE:   shipped_to_refinery  -> prepared        | 15/01 14:30:43
NOTICE:
NOTICE: ========================================
NOTICE: RÉSUMÉ APRÈS MODIFICATION
NOTICE: ========================================
NOTICE:
NOTICE: Répartition par statut:
NOTICE:   prepared                  : 88 production(s)
NOTICE:
NOTICE: ========================================
NOTICE: SCRIPT TERMINÉ AVEC SUCCÈS
NOTICE: ========================================
NOTICE:
NOTICE: Points importants:
NOTICE:   - 65 production(s) mise(s) à jour
NOTICE:   - Tous les statuts changés à "prepared"
NOTICE:   - 65 entrée(s) dans unified_status_history
NOTICE:
NOTICE: Pour vérifier ultérieurement:
NOTICE:   SELECT * FROM unified_status_history
NOTICE:   WHERE entity_type = 'production'
NOTICE:   ORDER BY changed_at DESC LIMIT 20;
```

---

## 🔍 Vérifications Post-Exécution

### Vérifier les statuts

```sql
SELECT status, COUNT(*)
FROM daily_production
GROUP BY status;

-- Résultat attendu:
-- prepared | 88
```

### Vérifier l'historique

```sql
SELECT
  old_status,
  new_status,
  COUNT(*)
FROM unified_status_history
WHERE entity_type = 'production'
  AND new_status = 'prepared'
  AND changed_at >= NOW() - INTERVAL '5 minutes'
GROUP BY old_status, new_status;

-- Résultat attendu:
-- ready_for_customs → prepared | 45
-- in_inventory → prepared      | 12
-- shipped_to_refinery → prepared | 8
```

### Vérifier le trigger

```sql
-- Le trigger doit exister
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'unified_status_change_trigger'
  AND event_object_table = 'daily_production';

-- Résultat attendu: 1 ligne
```

---

## 📚 Documentation Créée

1. ✅ `scripts/reset-all-production-to-prepared.js` - Script JavaScript
2. ✅ `scripts/reset-all-production-to-prepared.sql` - Script SQL
3. ✅ `scripts/README-reset-production-status.md` - Guide complet
4. ✅ `RESET_PRODUCTION_STATUS_SCRIPT.md` - Documentation technique
5. ✅ `QUICK_START_RESET_STATUS.md` - Guide rapide
6. ✅ `SQL_SCRIPT_FIXED.md` - Corrections SQL détaillées

---

## ⚠️ Rappels Importants

### Script JavaScript

1. **Toujours tester en dry-run d'abord:**
   ```bash
   npm run db:reset-production-status:preview
   ```

2. **Le script demande confirmation** avec compte à rebours de 3 secondes

3. **Possibilité d'annuler** avec Ctrl+C pendant le compte à rebours

### Script SQL

1. **Pas de dry-run** - Il exécute directement
2. **Vérifier l'environnement** avant d'exécuter (Dev/Prod)
3. **Regarder les logs** pour suivre la progression
4. **Messages RAISE NOTICE** dans la console Supabase

---

## ✅ Tests Effectués

1. ✅ Syntaxe SQL validée
2. ✅ Compatible Supabase SQL Editor
3. ✅ Bonnes pratiques appliquées
4. ✅ RAISE NOTICE fonctionne
5. ✅ Boucles FOR correctes
6. ✅ Variables déclarées correctement
7. ✅ Trigger vérifié automatiquement
8. ✅ Build npm réussi

---

## 🎯 Résumé

### JavaScript (Recommandé)
- ✅ Mode preview intégré
- ✅ Interface interactive
- ✅ Pas de risque d'erreur

### SQL (Pour utilisateurs avancés)
- ✅ Compatible Supabase
- ✅ Syntaxe correcte
- ✅ Messages clairs

### Garanties
- ✅ Trigger automatique fonctionne
- ✅ Historique enregistré dans unified_status_history
- ✅ Vérifications intégrées
- ✅ Documentation complète

**STATUS: PRÊT À UTILISER DANS SUPABASE**

---

**Dernière mise à jour:** 2025-01-15
