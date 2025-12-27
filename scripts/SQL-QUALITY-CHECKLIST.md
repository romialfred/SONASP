# ✅ CHECKLIST QUALITÉ SQL - À RESPECTER TOUJOURS

## 🚨 RÈGLES NON NÉGOCIABLES

### 1. VÉRIFIER L'EXISTENCE DES TABLES
**AVANT d'écrire TOUTE requête SQL:**
```bash
node scripts/analyze-database.js
```

**Consulter:**
- `scripts/DATABASE-SCHEMA.md` - Liste de toutes les tables existantes
- `scripts/database-schema.json` - Schéma complet avec colonnes

### 2. UTILISER LES NOMS EXACTS
❌ **JAMAIS faire:**
- Deviner le nom d'une table
- Utiliser des majuscules arbitraires ("SNP_artisans_miniers")
- Utiliser des guillemets autour des noms de table sans raison

✅ **TOUJOURS faire:**
- Copier le nom EXACT de `DATABASE-SCHEMA.md`
- Exemple: `snp_artisans_miniers` (pas `SNP_artisans_miniers`)

### 3. VÉRIFIER LES COLONNES
Avant d'utiliser une colonne dans un JOIN ou SELECT:

1. Chercher la table dans `DATABASE-SCHEMA.md`
2. Vérifier que la colonne existe
3. Copier le nom EXACT de la colonne

❌ **Colonnes qui n'existent PAS dans snp_carte_statistics:**
- artisan_id
- annee, mois
- montant_total_ventes
- nombre_collectes, nombre_depots

✅ **Colonnes qui EXISTENT:**
- carte_id
- nombre_ventes, nombre_achats
- quantite_totale_grammes
- montant_total
- derniere_activite

### 4. TESTER AVANT DE PROPOSER
Avant de donner un script SQL à l'utilisateur:

```bash
# Tester la connexion
node scripts/apply-fix-automatically.js

# Si le script utilise des vues
# Vérifier que toutes les tables du JOIN existent
```

## 📋 PROCÉDURE STANDARD

### Pour Chaque Nouveau Script SQL:

1. **Analyser la base** (2 secondes)
   ```bash
   node scripts/analyze-database.js
   ```

2. **Lire le schéma** (10 secondes)
   ```bash
   cat scripts/DATABASE-SCHEMA.md
   ```

3. **Identifier les tables nécessaires**
   - Noter les noms EXACTS
   - Noter les colonnes disponibles

4. **Écrire le SQL**
   - Utiliser UNIQUEMENT les tables qui existent
   - Utiliser UNIQUEMENT les colonnes qui existent
   - Utiliser les noms EXACTS (case-sensitive)

5. **Valider**
   - Relire le SQL
   - Vérifier chaque nom de table
   - Vérifier chaque nom de colonne

## 🔍 OUTILS DE VALIDATION

### Avant toute exécution SQL:
```bash
# Vérifier qu'une table existe
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('NOM_TABLE').select('*').limit(1).then(r => console.log(r.error ? '❌' : '✅'));
"
```

## 🎯 CAS D'USAGE TYPIQUES

### Créer une Vue avec JOIN:
1. Lister toutes les tables du JOIN
2. Vérifier que TOUTES existent dans `DATABASE-SCHEMA.md`
3. Pour chaque table, vérifier les colonnes utilisées
4. Écrire la vue avec les noms EXACTS

### Créer une Fonction:
1. Vérifier les tables utilisées
2. Vérifier les colonnes utilisées
3. Tester la logique sur une petite requête d'abord

### Créer un Trigger:
1. Vérifier que la table cible existe
2. Vérifier les colonnes utilisées dans NEW/OLD
3. Vérifier la fonction appelée existe

## 📝 TEMPLATE DE SCRIPT SQL SÉCURISÉ

```sql
-- ===================================================================
-- NOM DU SCRIPT
-- ===================================================================
-- 
-- TABLES UTILISÉES (vérifiées dans DATABASE-SCHEMA.md):
--   ✅ table_1 (colonnes: id, col1, col2)
--   ✅ table_2 (colonnes: id, col3, col4)
--
-- COLONNES UTILISÉES:
--   table_1: id, col1
--   table_2: id, col3
--
-- TESTÉ LE: [DATE]
-- ===================================================================

-- Vérification de l'existence
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'table_1') THEN
    RAISE EXCEPTION 'Table table_1 n''existe pas';
  END IF;
END $$;

-- Reste du script...
```

## ⚠️ ERREURS FRÉQUENTES À ÉVITER

1. **Nom de table avec mauvaise casse**
   - ❌ `"SNP_artisans_miniers"`
   - ✅ `snp_artisans_miniers`

2. **Colonnes qui n'existent pas**
   - Toujours vérifier dans DATABASE-SCHEMA.md

3. **Foreign keys sans vérification**
   - Vérifier que la colonne de référence existe

4. **Vues avec tables supprimées**
   - Avant de créer une vue, vérifier TOUTES les tables

## 🎓 FORMATION

### Exercice de Validation:
Avant d'écrire un script qui utilise `table_x`:

```bash
# 1. Vérifier existence
grep "table_x" scripts/DATABASE-SCHEMA.md

# 2. Si trouvée, lire les colonnes
grep -A 20 "### table_x" scripts/DATABASE-SCHEMA.md

# 3. Noter les colonnes disponibles
# 4. Écrire le script en utilisant UNIQUEMENT ces colonnes
```

---

**RÈGLE D'OR:**
> Si une table ou colonne n'est pas dans DATABASE-SCHEMA.md,
> elle N'EXISTE PAS. Ne pas deviner.

**En cas de doute:**
```bash
node scripts/analyze-database.js
```
