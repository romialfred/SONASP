# Guide d'Analyse des Transitions

## 🎯 Objectif

Le script `ANALYZE_TRANSITIONS.sql` permet d'analyser la table `allowed_status_transitions` pour identifier les doublons, conflits et problèmes de configuration.

## ✅ Corrections Appliquées

### Problème: Colonne `is_active` inexistante

**AVANT (INCORRECT):**
```sql
SELECT 
  id,
  from_status,
  to_status,
  requires_role,
  description,
  is_active,        -- ❌ Cette colonne n'existe PAS!
  created_at
FROM allowed_status_transitions
```

**APRÈS (CORRECT):**
```sql
SELECT
  id,
  from_status,
  to_status,
  requires_role,
  description,
  is_system_transition,  -- ✅ Colonne qui existe vraiment
  created_at,
  updated_at            -- ✅ Ajouté également
FROM allowed_status_transitions
```

## 📊 Structure Réelle de la Table

```sql
CREATE TABLE allowed_status_transitions (
  id uuid PRIMARY KEY,
  from_status text NOT NULL,
  to_status text NOT NULL,
  requires_role text,
  description text NOT NULL,
  is_system_transition boolean DEFAULT false,  -- ✅ Existe
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(from_status, to_status)
);
```

### Colonnes disponibles:
- ✅ `id` - Identifiant unique
- ✅ `from_status` - Status source
- ✅ `to_status` - Status destination
- ✅ `requires_role` - Rôle requis pour la transition
- ✅ `description` - Description de la transition
- ✅ `is_system_transition` - Indique si c'est une transition système
- ✅ `created_at` - Date de création
- ✅ `updated_at` - Date de mise à jour
- ❌ `is_active` - N'EXISTE PAS!

## 📋 Requêtes Disponibles dans le Script

### 1. Identifier les Doublons
```sql
-- Trouve les paires (from_status, to_status) qui apparaissent plusieurs fois
SELECT from_status, to_status, COUNT(*) as duplicate_count
FROM allowed_status_transitions
GROUP BY from_status, to_status
HAVING COUNT(*) > 1
```

**Utilité:** Identifier rapidement les transitions en double

### 2. Voir Toutes les Transitions
```sql
-- Liste complète avec tous les détails
SELECT id, from_status, to_status, requires_role, description,
       is_system_transition, created_at, updated_at
FROM allowed_status_transitions
ORDER BY from_status, to_status, created_at
```

**Utilité:** Vue d'ensemble de toutes les transitions

### 3. Compter le Total
```sql
-- Statistiques globales
SELECT 
  COUNT(*) as total_transitions,
  COUNT(DISTINCT (from_status, to_status)) as unique_transitions,
  COUNT(*) - COUNT(DISTINCT (from_status, to_status)) as duplicates_to_remove
```

**Utilité:** Savoir combien de doublons existent

### 4. Transitions Système vs Normales
```sql
-- Compte par type de transition
SELECT is_system_transition, COUNT(*) as count
FROM allowed_status_transitions
GROUP BY is_system_transition
```

**Utilité:** Distinguer transitions système et manuelles

### 5. Transitions par Rôle
```sql
-- Compte par rôle requis
SELECT COALESCE(requires_role, 'NULL/Any') as role,
       COUNT(*) as transition_count
FROM allowed_status_transitions
GROUP BY requires_role
```

**Utilité:** Voir quels rôles peuvent faire quelles transitions

### 6. Identifier les Conflits
```sql
-- Trouve les transitions identiques avec des rôles différents
SELECT ast1.from_status, ast1.to_status,
       ast1.requires_role as role_1,
       ast2.requires_role as role_2
FROM allowed_status_transitions ast1
JOIN allowed_status_transitions ast2
  ON ast1.from_status = ast2.from_status
  AND ast1.to_status = ast2.to_status
  AND ast1.id < ast2.id
```

**Utilité:** Détecter les configurations contradictoires

### 7. Transitions Sortantes par Status
```sql
-- Nombre de transitions possibles depuis chaque status
SELECT from_status, COUNT(*) as outgoing_transitions
FROM allowed_status_transitions
GROUP BY from_status
```

**Utilité:** Voir quels status ont plusieurs chemins possibles

### 8. Transitions Entrantes par Status
```sql
-- Nombre de chemins menant à chaque status
SELECT to_status, COUNT(*) as incoming_transitions
FROM allowed_status_transitions
GROUP BY to_status
```

**Utilité:** Identifier les status finaux (peu d'entrées) et de passage (nombreuses entrées)

## 🔍 Cas d'Utilisation

### Avant le Nettoyage
```bash
# Exécuter toutes les requêtes pour voir l'état actuel
# Résultats attendus AVANT nettoyage:
- Total: ~47 transitions
- Uniques: ~21 transitions
- Doublons: ~26 à supprimer
```

### Après le Nettoyage
```bash
# Réexécuter pour vérifier
# Résultats attendus APRÈS nettoyage:
- Total: 21 transitions
- Uniques: 21 transitions
- Doublons: 0
```

## 📋 Workflow d'Analyse

1. **Analyse initiale:**
   ```bash
   # Exécuter ANALYZE_TRANSITIONS.sql dans Supabase SQL Editor
   # Noter les statistiques
   ```

2. **Nettoyage (si nécessaire):**
   ```bash
   # Exécuter CLEAN_TRANSITIONS_REFERENCE_WORKFLOW.sql
   ```

3. **Vérification:**
   ```bash
   # Réexécuter ANALYZE_TRANSITIONS.sql
   # Confirmer 0 doublons
   ```

## 📁 Fichiers Associés

1. ✅ `ANALYZE_TRANSITIONS.sql` - Script d'analyse (CORRIGÉ)
2. ✅ `CLEAN_TRANSITIONS_REFERENCE_WORKFLOW.sql` - Script de nettoyage (CORRIGÉ)
3. ✅ `CHECK_TABLE_STRUCTURE_COMPLETE.sql` - Vérification structure table
4. ✅ `ANALYZE_TRANSITIONS_GUIDE.md` - Ce guide

## ⚠️ Notes Importantes

1. **Aucune colonne `is_active`:** La table n'a jamais eu cette colonne
2. **is_system_transition:** Utilisé pour marquer les transitions automatiques
3. **UNIQUE constraint:** Empêche normalement les doublons (from_status, to_status)
4. **Doublons existants:** Créés par migrations multiples avant la contrainte

## ✅ Status de Correction

- ✅ Colonne `is_active` supprimée
- ✅ Colonne `is_system_transition` ajoutée
- ✅ Colonne `updated_at` ajoutée
- ✅ 8 requêtes d'analyse complètes
- ✅ Script prêt à l'emploi

---

**Le script est maintenant aligné avec la structure réelle de la table!** 🎉
