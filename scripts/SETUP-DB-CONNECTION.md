# Configuration de la Connexion PostgreSQL Directe

Pour utiliser les outils d'analyse et d'exécution de migrations, vous devez ajouter la chaîne de connexion PostgreSQL dans votre fichier `.env`.

## 📋 Étapes de Configuration

### 1. Obtenir l'URL de Connexion Supabase

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet `boolqagzdqbahqnpawpb`
3. Cliquez sur **Settings** (Paramètres) dans le menu latéral
4. Cliquez sur **Database**
5. Faites défiler jusqu'à **Connection string**
6. Sélectionnez **Connection pooling** et copiez l'URL qui ressemble à:

```
postgresql://postgres.[REF]:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

**Important:** Remplacez `[YOUR-PASSWORD]` par le mot de passe de votre base de données.

### 2. Ajouter la Variable dans .env

Ouvrez le fichier `.env` à la racine du projet et ajoutez cette ligne:

```bash
SUPABASE_DB_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

Votre fichier `.env` devrait ressembler à:

```bash
VITE_SUPABASE_URL=https://boolqagzdqbahqnpawpb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_DB_URL=postgresql://postgres.boolqagzdqbahqnpawpb:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

### 3. Trouver le Mot de Passe

Si vous n'avez pas le mot de passe:

1. Dans Supabase Dashboard > Settings > Database
2. Cliquez sur **Reset database password**
3. Générez un nouveau mot de passe
4. Copiez-le et remplacez `[PASSWORD]` dans l'URL

## ✅ Vérification

Une fois configuré, testez la connexion:

```bash
# Lister toutes les tables
node scripts/analyze-database.js

# Analyser une table spécifique
node scripts/analyze-database.js mining_companies
```

Si vous voyez la liste des tables, c'est bon!

## 🚀 Utilisation

### Analyser la Base de Données

```bash
# Voir toutes les tables
node scripts/analyze-database.js

# Analyser une table
node scripts/analyze-database.js SNP_artisans_miniers
```

### Exécuter des Migrations

```bash
node scripts/run-migration.js FIX-COMPANY-TYPE-AND-SONASP.sql
```

## 🔐 Sécurité

- **Ne commitez jamais** le fichier `.env` dans Git
- Le fichier `.gitignore` doit contenir `.env`
- Ne partagez jamais votre mot de passe de base de données

## 🆘 Dépannage

### Erreur: "Variable SUPABASE_DB_URL manquante"

→ Vous n'avez pas ajouté la variable dans `.env`

### Erreur: "Connection refused" ou "timeout"

→ Vérifiez que:
- L'URL est correcte
- Le mot de passe est correct
- Votre IP est autorisée dans Supabase (Settings > Database > Connection pooling)

### Erreur: "role postgres does not exist"

→ Utilisez l'URL avec `postgres.` au lieu de `postgres:`

Bonne URL:
```
postgresql://postgres.REF:PASSWORD@...
```

Mauvaise URL:
```
postgresql://postgres:PASSWORD@...
```

## 📞 Support

Si vous rencontrez des problèmes, vérifiez:
1. Le mot de passe est correct
2. L'URL ne contient pas d'espaces
3. Le fichier `.env` est à la racine du projet
4. Vous avez relancé le terminal après avoir modifié `.env`
