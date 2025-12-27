# Outils de Gestion de Base de Données

Ces outils vous permettent d'exécuter des migrations SQL et d'analyser la structure de votre base de données Supabase directement depuis votre terminal.

## 📋 Prérequis

Les outils sont déjà configurés et prêts à l'emploi. Le package `pg` a été installé automatiquement.

## 🔧 Outils Disponibles

### 1. Analyser la Base de Données

Cet outil vous permet de voir la structure complète de vos tables avant de créer des scripts SQL.

**Lister toutes les tables:**
```bash
node scripts/analyze-database.js
```

**Analyser une table spécifique:**
```bash
node scripts/analyze-database.js nom_table
```

**Exemples:**
```bash
# Voir toutes les tables
node scripts/analyze-database.js

# Analyser la structure de SNP_artisans_miniers
node scripts/analyze-database.js SNP_artisans_miniers

# Analyser mining_companies
node scripts/analyze-database.js mining_companies

# Analyser snp_artisan_ventes_or
node scripts/analyze-database.js snp_artisan_ventes_or
```

**Affichage:**
- Liste des colonnes avec types et contraintes
- Clés primaires et étrangères
- Index
- Contraintes CHECK et UNIQUE
- Nombre de lignes dans la table

---

### 2. Exécuter des Migrations SQL

Cet outil exécute vos fichiers SQL directement sur la base de données Supabase.

**Usage:**
```bash
node scripts/run-migration.js <nom_fichier.sql>
```

**Exemples:**
```bash
# Exécuter le script de correction SONASP
node scripts/run-migration.js FIX-COMPANY-TYPE-AND-SONASP.sql

# Exécuter n'importe quel script SQL
node scripts/run-migration.js mon-script.sql
```

**Affichage:**
- Progression de l'exécution
- Messages NOTICE de PostgreSQL (les RAISE NOTICE)
- Confirmation de succès ou erreurs détaillées
- Nombre de lignes affectées

---

## 📝 Workflow Recommandé

### Étape 1: Analyser la base de données

Avant de créer un script SQL, analysez toujours la structure des tables concernées:

```bash
# Analyser la table principale
node scripts/analyze-database.js mining_companies

# Analyser la table des ventes
node scripts/analyze-database.js snp_artisan_ventes_or

# Analyser la table des artisans
node scripts/analyze-database.js SNP_artisans_miniers
```

Notez:
- Les noms exacts des colonnes
- Les types de données
- Les contraintes existantes
- Les relations entre tables

### Étape 2: Créer votre script SQL

Créez votre fichier `.sql` dans le dossier `scripts/` en utilisant les vrais noms de colonnes que vous avez observés.

### Étape 3: Exécuter la migration

```bash
node scripts/run-migration.js votre-script.sql
```

### Étape 4: Vérifier les résultats

Si besoin, ré-analysez la table pour confirmer les changements:

```bash
node scripts/analyze-database.js nom_table
```

---

## 🚨 Exemple Complet

### Scénario: Corriger les ventes artisans

```bash
# 1. Analyser la structure actuelle
node scripts/analyze-database.js mining_companies
node scripts/analyze-database.js snp_artisan_ventes_or

# 2. Observer les colonnes disponibles
# Vous verrez: contact_person_email, contact_person_phone, etc.

# 3. Exécuter le script de correction
node scripts/run-migration.js FIX-COMPANY-TYPE-AND-SONASP.sql

# 4. Vérifier les changements
node scripts/analyze-database.js mining_companies
```

---

## 💡 Avantages

Ces outils vous permettent de:

1. **Éviter les erreurs de nom de colonne** - Vous voyez la structure réelle avant de coder
2. **Exécuter rapidement** - Pas besoin de copier-coller dans l'interface Supabase
3. **Voir les logs PostgreSQL** - Tous les RAISE NOTICE apparaissent dans le terminal
4. **Déboguer facilement** - Messages d'erreur détaillés avec le numéro de ligne
5. **Automatiser** - Possibilité d'intégrer dans des scripts CI/CD

---

## 🔐 Sécurité

Les scripts utilisent la variable `SUPABASE_DB_URL` du fichier `.env` qui contient:
- L'URL de connexion PostgreSQL directe
- Les identifiants sécurisés
- Le certificat SSL

**Important:** Ne commitez jamais le fichier `.env` dans Git!

---

## 📞 Support

Si vous rencontrez une erreur:

1. Vérifiez que `SUPABASE_DB_URL` est défini dans `.env`
2. Analysez d'abord la table avec `analyze-database.js`
3. Vérifiez les noms de colonnes dans votre script SQL
4. Consultez le message d'erreur complet affiché

Pour plus d'aide, référez-vous aux fichiers README dans le dossier `scripts/`.
