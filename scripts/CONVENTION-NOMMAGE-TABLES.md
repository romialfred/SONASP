# Convention de Nommage des Tables - Gold Shipper

## 📌 Règle Fondamentale

### Tables EXISTANTES
**Ne PAS modifier** - Garder le nom actuel (avec ou sans préfixe)

### Tables NOUVELLES
**Préfixe snp_ OBLIGATOIRE** - Toute nouvelle table doit commencer par `snp_`

---

## 🎯 Définitions

### Qu'est-ce qu'une Table EXISTANTE ?

Une table est considérée comme **EXISTANTE** si:
- Elle est déjà créée dans la base de données Supabase
- Elle est utilisée par l'application en production
- Elle contient des données utilisateur

**Exemples de tables existantes:**
```
✅ mining_companies (pas de préfixe snp_)
✅ user_profiles (pas de préfixe snp_)
✅ daily_production (pas de préfixe snp_)
✅ snp_artisans_miniers (avec préfixe snp_)
✅ snp_cartes_professionnelles (avec préfixe snp_)
```

**Action:** NE PAS RENOMMER - Utiliser tel quel dans tous les scripts SQL

### Qu'est-ce qu'une Table NOUVELLE ?

Une table est considérée comme **NOUVELLE** si:
- Elle n'existe pas encore dans la base de données
- C'est une nouvelle fonctionnalité en cours de développement
- Elle n'a jamais contenu de données utilisateur

**Exemples de nouvelles tables:**
```
✅ snp_artisan_infractions (nouvelle fonctionnalité)
✅ snp_artisan_transactions (nouvelle fonctionnalité)
✅ snp_modules_management (nouvelle fonctionnalité)
```

**Action:** TOUJOURS créer avec le préfixe `snp_`

---

## 📝 Exemples Concrets

### ✅ BON: Créer une Nouvelle Table

```sql
-- Nouvelle table pour gérer les infractions
CREATE TABLE IF NOT EXISTS snp_artisan_infractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid NOT NULL REFERENCES snp_artisans_miniers(id),
  date_infraction date NOT NULL,
  ...
);
```

**Pourquoi c'est correct:**
- Nouvelle fonctionnalité → préfixe `snp_` ✅
- Référence une table existante `snp_artisans_miniers` (nom exact) ✅

### ✅ BON: Utiliser une Table Existante

```sql
-- Ajouter une colonne à une table existante
ALTER TABLE mining_companies
ADD COLUMN IF NOT EXISTS sonasp_trading_space boolean DEFAULT false;
```

**Pourquoi c'est correct:**
- Table existante → garder le nom `mining_companies` (pas de snp_) ✅
- Ne PAS renommer en `snp_mining_companies` ✅

### ❌ MAUVAIS: Renommer une Table Existante

```sql
-- NE JAMAIS FAIRE CECI
ALTER TABLE mining_companies
RENAME TO snp_mining_companies;
```

**Pourquoi c'est incorrect:**
- Casse toutes les références existantes ❌
- Nécessite de modifier tout le code de l'application ❌
- Risque de perte de données ❌

### ❌ MAUVAIS: Créer une Nouvelle Table sans Préfixe

```sql
-- INCORRECT pour une nouvelle table
CREATE TABLE IF NOT EXISTS artisan_infractions (
  id uuid PRIMARY KEY,
  ...
);
```

**Pourquoi c'est incorrect:**
- Nouvelle table → doit avoir le préfixe `snp_` ❌
- Nom correct: `snp_artisan_infractions` ✅

---

## 🔍 Comment Vérifier si une Table Existe ?

### Méthode 1: Consulter DATABASE-SCHEMA.md

```bash
cat scripts/DATABASE-SCHEMA.md | grep "nom_table"
```

Si la table apparaît → **Table EXISTANTE** → Utiliser le nom exact

Si la table n'apparaît pas → **Table NOUVELLE** → Ajouter préfixe `snp_`

### Méthode 2: Analyser la Base de Données

```bash
node scripts/analyze-database.js
```

Regarde le fichier généré `scripts/DATABASE-SCHEMA.md`

### Méthode 3: Requête SQL Directe

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'nom_table';
```

Si retourne un résultat → **Table EXISTANTE**

Si ne retourne rien → **Table NOUVELLE**

---

## 📋 Checklist pour Nouveaux Scripts SQL

Avant d'écrire un script SQL avec `CREATE TABLE` ou `ALTER TABLE`:

- [ ] Vérifier si la table existe dans `DATABASE-SCHEMA.md`
- [ ] Si la table existe:
  - [ ] Utiliser le nom EXACT (avec ou sans snp_)
  - [ ] Ne PAS ajouter ou enlever de préfixe
- [ ] Si la table n'existe PAS (nouvelle):
  - [ ] TOUJOURS ajouter le préfixe `snp_`
  - [ ] Exemple: `snp_nouvelle_table`
- [ ] Vérifier les références FK utilisent les noms exacts
- [ ] Pour les buckets storage: préfixe `snp-` pour les nouveaux

---

## 🎓 Exemples de Migrations

### Migration 1: Ajouter une Colonne à une Table Existante

```sql
-- Table existante: mining_companies (pas de snp_)
ALTER TABLE mining_companies
ADD COLUMN IF NOT EXISTS nouvelle_colonne text;

-- ✅ Correct: utilise le nom exact de la table existante
```

### Migration 2: Créer une Nouvelle Table avec FK vers Existante

```sql
-- Nouvelle table avec FK vers table existante
CREATE TABLE IF NOT EXISTS snp_artisan_gold_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid NOT NULL REFERENCES snp_artisans_miniers(id),
  mining_company_id uuid REFERENCES mining_companies(id),
  ...
);

-- ✅ Correct:
-- - Nouvelle table → snp_artisan_gold_sales ✅
-- - FK vers snp_artisans_miniers (nom exact) ✅
-- - FK vers mining_companies (nom exact) ✅
```

### Migration 3: Créer une Vue avec Plusieurs Tables

```sql
-- Vue utilisant tables existantes ET nouvelles
CREATE OR REPLACE VIEW v_artisan_statistics AS
SELECT
  a.id,
  a.nom,
  COUNT(i.id) as nombre_infractions,
  mc.name as mining_company_name
FROM snp_artisans_miniers a
LEFT JOIN snp_artisan_infractions i ON a.id = i.artisan_id
LEFT JOIN mining_companies mc ON a.mining_company_id = mc.id
GROUP BY a.id, a.nom, mc.name;

-- ✅ Correct:
-- - snp_artisans_miniers (table existante avec snp_) ✅
-- - snp_artisan_infractions (nouvelle table avec snp_) ✅
-- - mining_companies (table existante sans snp_) ✅
```

---

## ⚠️ Cas Particuliers

### Tables Système

Les tables système ne suivent pas cette règle:

```
✅ auth.users (table système Supabase)
✅ storage.buckets (table système Supabase)
✅ pg_tables (table système PostgreSQL)
```

### Tables Temporaires

Pour les tables temporaires dans les scripts de migration:

```sql
-- OK pour tables temporaires
CREATE TEMP TABLE temp_migration_data AS ...;
```

---

## 🔧 Outils de Validation

### Script Automatique

```bash
# Valider tous les scripts SQL
node scripts/validate-sql-conventions.cjs
```

Le validateur vérifie:
- ✅ Nouvelles tables ont le préfixe `snp_`
- ⚠️ Avertissement si référence FK vers table sans snp_ (normal pour tables existantes)
- ❌ Erreur si bucket storage sans préfixe `snp-`

---

## 📚 Résumé

| Situation | Action | Exemple |
|-----------|--------|---------|
| Table existante AVEC snp_ | Garder tel quel | `snp_artisans_miniers` |
| Table existante SANS snp_ | Garder tel quel | `mining_companies` |
| Nouvelle table | Ajouter préfixe snp_ | `snp_artisan_infractions` |
| Nouveau bucket storage | Ajouter préfixe snp- | `snp-infraction-documents` |
| Table système | Aucun préfixe | `auth.users`, `storage.buckets` |

---

## ❓ FAQ

**Q: Pourquoi ne pas renommer toutes les tables existantes ?**

R: Cela casserait toute l'application en production et nécessiterait de modifier des centaines de fichiers. La migration progressive est plus sûre.

**Q: Et si je fais une erreur de nom ?**

R: Le validateur `validate-sql-conventions.cjs` détectera l'erreur avant l'exécution.

**Q: Comment savoir si ma table existe déjà ?**

R: Consultez `scripts/DATABASE-SCHEMA.md` ou exécutez `node scripts/analyze-database.js`

**Q: Les enum types suivent-ils la même règle ?**

R: Oui, les nouveaux types enum doivent avoir le préfixe `snp_`
- Exemple: `snp_statut_traitement_infraction`

**Q: Et les fonctions et triggers ?**

R: Oui, les nouvelles fonctions doivent suivre la convention
- Exemple: `update_snp_artisan_infractions_updated_at()`

---

**Dernière mise à jour:** 28 Décembre 2024
**Version:** 1.0
**Statut:** ✅ Standard Officiel
