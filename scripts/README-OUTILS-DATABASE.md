# 🛠️ Outils de Gestion de Base de Données

## 📊 Analyse et Documentation

### `analyze-database.js`
**Utilisation:** Analyse complète de toutes les tables
```bash
node scripts/analyze-database.js
```

**Ce qu'il fait:**
- Détecte toutes les tables accessibles
- Liste les colonnes de chaque table
- Compte le nombre de lignes
- Génère automatiquement:
  - `DATABASE-SCHEMA.md` - Documentation lisible
  - `database-schema.json` - Schéma pour scripts automatiques

**Quand l'utiliser:**
- Avant de créer TOUT nouveau script SQL
- Après avoir ajouté des tables
- Pour vérifier l'état actuel de la base

## ✅ Validation et Tests

### `apply-fix-automatically.js`
**Utilisation:** Applique et teste les corrections
```bash
node scripts/apply-fix-automatically.js
```

**Ce qu'il fait:**
- Vérifie la présence des colonnes nécessaires
- Configure SONASP automatiquement (si possible)
- Lie les ventes à SONASP
- Affiche un rapport détaillé

**Quand l'utiliser:**
- Après avoir exécuté un script SQL dans Supabase
- Pour vérifier que tout est configuré correctement

## 📝 Scripts SQL Principaux

### `CORRECTION-COMPLETE-A-EXECUTER.sql`
**Utilisation:** Script SQL complet à exécuter DANS Supabase Dashboard

**Ce qu'il fait:**
- Ajoute `company_type` à mining_companies
- Configure SONASP
- Ajoute `acheteur_id` aux ventes
- Crée triggers automatiques
- Crée la vue des ventes SONASP

**Comment l'exécuter:**
1. Ouvrir Supabase Dashboard > SQL Editor
2. Copier-coller le contenu complet
3. Cliquer "Run"

## 📚 Documentation de Référence

### `DATABASE-SCHEMA.md`
Généré automatiquement par `analyze-database.js`

**Contenu:**
- Liste COMPLÈTE de toutes les tables
- TOUTES les colonnes de chaque table
- Nombre de lignes par table

**Utilisation:**
- Référence OBLIGATOIRE avant d'écrire du SQL
- Source de vérité pour les noms de tables/colonnes

### `SQL-QUALITY-CHECKLIST.md`
Guide des bonnes pratiques SQL

**Contenu:**
- Règles à respecter TOUJOURS
- Procédure standard de validation
- Erreurs fréquentes à éviter
- Templates de scripts sécurisés

## 🔄 Workflow Recommandé

### Pour Créer un Nouveau Script SQL:

```bash
# 1. Analyser la base (met à jour DATABASE-SCHEMA.md)
node scripts/analyze-database.js

# 2. Consulter le schéma
cat scripts/DATABASE-SCHEMA.md

# 3. Identifier les tables nécessaires
grep "ma_table" scripts/DATABASE-SCHEMA.md

# 4. Écrire le script SQL en utilisant les noms EXACTS

# 5. Exécuter dans Supabase Dashboard SQL Editor

# 6. Vérifier avec le script de test
node scripts/apply-fix-automatically.js
```

## 🚨 En Cas d'Erreur

### Erreur: "relation does not exist"

**Cause:** Nom de table incorrect

**Solution:**
```bash
# Vérifier le nom exact
node scripts/analyze-database.js
grep -i "nom_table" scripts/DATABASE-SCHEMA.md
```

### Erreur: "column does not exist"

**Cause:** Colonne inexistante ou mal orthographiée

**Solution:**
```bash
# Lister les colonnes de la table
grep -A 50 "### nom_table" scripts/DATABASE-SCHEMA.md
```

### Erreur: SQL échoue dans Supabase

**Solution:**
1. Copier le message d'erreur COMPLET
2. Identifier la ligne problématique
3. Vérifier dans DATABASE-SCHEMA.md
4. Corriger et réessayer

## 🎯 Règles Essentielles

1. **TOUJOURS** exécuter `analyze-database.js` avant de créer du SQL
2. **TOUJOURS** vérifier dans `DATABASE-SCHEMA.md` que la table existe
3. **JAMAIS** deviner un nom de table ou colonne
4. **TOUJOURS** utiliser les noms EXACTS (case-sensitive)

## 📞 Support

Si les outils ne fonctionnent pas:

```bash
# Vérifier les variables d'environnement
cat .env | grep SUPABASE

# Tester la connexion
node scripts/auto-analyze.js
```

---

**Créé le:** 27 Décembre 2024
**Mis à jour:** Automatiquement par les scripts
