# 🛠️ Outils de Gestion de Base de Données

Outils pour analyser et exécuter des migrations SQL sur votre base de données Supabase.

## ⚙️ Installation Initiale

**IMPORTANT:** Vous devez d'abord configurer la connexion PostgreSQL.

👉 **[Suivez le guide SETUP-DB-CONNECTION.md](./SETUP-DB-CONNECTION.md)** pour ajouter `SUPABASE_DB_URL` dans votre `.env`

Une fois configuré, les outils seront opérationnels.

---

## 🔍 1. Analyser la Base de Données

Cet outil vous montre la structure réelle de vos tables AVANT de créer des scripts SQL.

### Usage

```bash
# Lister toutes les tables
node scripts/analyze-database.js

# Analyser une table spécifique
node scripts/analyze-database.js nom_table
```

### Exemples

```bash
# Voir la structure de mining_companies
node scripts/analyze-database.js mining_companies

# Voir la structure de SNP_artisans_miniers
node scripts/analyze-database.js SNP_artisans_miniers

# Voir la structure de snp_artisan_ventes_or
node scripts/analyze-database.js snp_artisan_ventes_or
```

### Ce Que Vous Verrez

- **Nom exact des colonnes** (évite les erreurs "column does not exist")
- **Types de données** (text, uuid, integer, etc.)
- **Contraintes** (NOT NULL, nullable)
- **Valeurs par défaut**
- **Nombre de lignes** dans la table

---

## 🚀 2. Exécuter des Migrations SQL

Exécute vos fichiers SQL directement sur la base de données.

### Usage

```bash
node scripts/run-migration.js <fichier.sql>
```

### Exemples

```bash
# Exécuter le script de correction SONASP
node scripts/run-migration.js FIX-COMPANY-TYPE-AND-SONASP.sql

# Exécuter un script d'insertion
node scripts/run-migration.js insert-artisans-burkina-final.sql

# Exécuter n'importe quel script SQL
node scripts/run-migration.js mon-script.sql
```

### Ce Que Vous Verrez

- ✅ Progression de l'exécution
- 📢 Messages `RAISE NOTICE` de PostgreSQL
- ✓ Confirmation de succès
- ❌ Erreurs détaillées avec ligne et position

---

## 📖 Workflow Recommandé

### Étape 1: Analyser AVANT de Coder

Avant de créer un script SQL, **toujours analyser** les tables concernées:

```bash
node scripts/analyze-database.js mining_companies
node scripts/analyze-database.js snp_artisan_ventes_or
```

**Notez bien:**
- Les noms exacts des colonnes
- Les types de données
- Les contraintes existantes

### Étape 2: Créer Votre Script SQL

Créez votre fichier `.sql` dans `scripts/` en utilisant les **VRAIS noms** de colonnes.

**Exemple:** Si l'analyse montre `contact_person_email`, utilisez ce nom et PAS `email`.

### Étape 3: Exécuter la Migration

```bash
node scripts/run-migration.js votre-script.sql
```

### Étape 4: Vérifier les Résultats

```bash
node scripts/analyze-database.js nom_table
```

---

## 💡 Exemples Complets

### Exemple: Corriger une Table

```bash
# 1. Voir la structure actuelle
node scripts/analyze-database.js mining_companies

# Sortie attendue:
# • id                      uuid                      NOT NULL
# • name                    text                      NOT NULL
# • contact_person_email    character varying(255)    NULL
# • contact_person_phone    character varying(50)     NULL
# ...

# 2. Créer votre script SQL avec les bons noms
# Fichier: fix-contacts.sql
# UPDATE mining_companies
# SET contact_person_email = 'new@email.com'
# WHERE name = 'SONASP';

# 3. Exécuter le script
node scripts/run-migration.js fix-contacts.sql

# 4. Vérifier les changements
node scripts/analyze-database.js mining_companies
```

### Exemple: Créer une Nouvelle Table

```bash
# 1. Voir les tables existantes
node scripts/analyze-database.js

# 2. Créer le script SQL
# Fichier: create-new-table.sql

# 3. Exécuter
node scripts/run-migration.js create-new-table.sql

# 4. Vérifier la création
node scripts/analyze-database.js ma_nouvelle_table
```

---

## ✨ Avantages

### ✓ Évite les Erreurs

Plus d'erreurs "column does not exist" - vous voyez la structure réelle.

### ✓ Rapide

Pas besoin de copier-coller dans l'interface Supabase.

### ✓ Complet

Tous les logs PostgreSQL apparaissent dans le terminal.

### ✓ Débogage Facile

Messages d'erreur détaillés avec le numéro de ligne exacte.

### ✓ Automatisable

Peut être intégré dans des scripts CI/CD.

---

## 🔐 Sécurité

- Les scripts utilisent `SUPABASE_DB_URL` du fichier `.env`
- **Ne commitez JAMAIS** le `.env` dans Git
- Utilisez toujours le service role key pour les opérations admin

---

## 🆘 Dépannage

### "Variable SUPABASE_DB_URL manquante"

→ **[Suivez SETUP-DB-CONNECTION.md](./SETUP-DB-CONNECTION.md)**

### "column XXX does not exist"

→ Analysez la table d'abord:
```bash
node scripts/analyze-database.js nom_table
```

### "Table not found"

→ Vérifiez que:
1. Le nom de la table est correct (sensible à la casse)
2. La table existe (listez toutes les tables)
3. Les guillemets sont corrects pour les noms avec majuscules

---

## 📚 Fichiers de Documentation

- `README.md` (ce fichier) - Guide principal
- `SETUP-DB-CONNECTION.md` - Configuration initiale
- `README-OUTILS-DATABASE.md` - Documentation détaillée
- `SQL-QUALITY-CHECKLIST.md` - Bonnes pratiques SQL

---

## 🎯 Prêt à Commencer?

1. **[Configurez la connexion](./SETUP-DB-CONNECTION.md)**
2. **Listez les tables:** `node scripts/analyze-database.js`
3. **Analysez une table:** `node scripts/analyze-database.js nom_table`
4. **Exécutez votre premier script:** `node scripts/run-migration.js votre-script.sql`

---

**Bon travail!** 🚀
