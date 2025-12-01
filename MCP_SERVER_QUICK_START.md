# ⚡ Guide de Démarrage Rapide - Serveur MCP Gold Shipper

## 🎯 Objectif

Exécuter directement des requêtes SQL sur Supabase depuis Claude Desktop, sans copier-coller manuel.

## 🚀 Installation en 4 Étapes

### Étape 1: Installer les Dépendances (2 min)

```bash
# À la racine du projet
npm run mcp:install
```

### Étape 2: Créer la Fonction SQL dans Supabase (1 min)

1. Ouvrez [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql)
2. Copiez le contenu de `mcp-server/setup_exec_sql.sql`
3. Cliquez sur "Run" (RUN)

### Étape 3: Configurer Claude Desktop (3 min)

#### macOS/Linux

```bash
# Ouvrir le fichier de configuration
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

#### Windows

```bash
# Ouvrir le fichier de configuration
notepad %APPDATA%\Claude\claude_desktop_config.json
```

#### Ajouter cette configuration

```json
{
  "mcpServers": {
    "gold-shipper": {
      "command": "node",
      "args": [
        "/tmp/cc-agent/59164212/project/mcp-server/index.js"
      ],
      "env": {
        "VITE_SUPABASE_URL": "https://votre-projet.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "votre-service-role-key"
      }
    }
  }
}
```

**IMPORTANT**: 
- Remplacez le chemin `/tmp/cc-agent/59164212/project` par votre chemin réel
- Obtenez vos credentials Supabase depuis [Settings > API](https://supabase.com/dashboard/project/_/settings/api)

### Étape 4: Redémarrer Claude Desktop

1. Fermez **complètement** Claude Desktop (Cmd+Q sur Mac, Alt+F4 sur Windows)
2. Relancez Claude Desktop
3. ✅ Le serveur MCP est maintenant actif !

## ✅ Test de Vérification

Dans une nouvelle conversation Claude, tapez:

```
List all database tables
```

Claude devrait répondre avec la liste de toutes vos tables Supabase.

## 🛠️ Outils Disponibles

### 1. Exécuter du SQL

```
Execute this SQL: SELECT COUNT(*) FROM freight_shipments;
```

### 2. Lister les Tables

```
List all tables in the database
```

### 3. Décrire une Table

```
Describe the structure of freight_shipments table
```

### 4. Nettoyer le Module Freight

```
Run the freight cleanup script with confirmation
```

### 5. Optimiser les Tables

```
Optimize the freight tables
```

## 🎉 Exemples Pratiques

### Compter les Expéditions

**Vous**: "Combien d'expéditions freight avons-nous ?"

**Claude utilisera automatiquement**:
```sql
SELECT COUNT(*) FROM freight_shipments;
```

### Voir les Dernières Expéditions

**Vous**: "Montre-moi les 5 dernières expéditions"

**Claude utilisera**:
```sql
SELECT * FROM freight_shipments 
ORDER BY created_at DESC 
LIMIT 5;
```

### Créer une Table de Test

**Vous**: "Crée une table test_table avec id et name"

**Claude utilisera**:
```sql
CREATE TABLE test_table (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);
```

### Nettoyer Toutes les Données Freight

**Vous**: "Nettoie complètement le module freight & customs"

**Claude utilisera**: L'outil `cleanup_freight_module`

## 🔒 Sécurité

⚠️ **ATTENTION**: Le serveur MCP utilise votre `SERVICE_ROLE_KEY` qui donne un accès administrateur complet.

**Bonnes Pratiques**:
- ✅ Utilisez uniquement en développement/staging
- ✅ Ne partagez JAMAIS votre configuration
- ✅ Gardez vos credentials secrets
- ❌ N'utilisez pas en production sans audit de sécurité

## 🐛 Problèmes Courants

### "Cannot find module @modelcontextprotocol/sdk"

**Solution**: Exécutez `npm run mcp:install`

### "Missing Supabase credentials"

**Solution**: Vérifiez votre fichier `.env`:
```bash
cat .env | grep SUPABASE
```

### Claude ne voit pas les outils MCP

**Solution**:
1. Vérifiez le chemin absolu dans `claude_desktop_config.json`
2. Redémarrez complètement Claude Desktop (Cmd+Q)
3. Vérifiez les logs: `~/Library/Logs/Claude/`

### Erreur "exec_sql function not found"

**Solution**: Exécutez `mcp-server/setup_exec_sql.sql` dans Supabase

## 📁 Structure du Projet

```
project/
├── mcp-server/                         # Serveur MCP
│   ├── index.js                        # Code principal
│   ├── package.json                    # Dépendances
│   ├── setup_exec_sql.sql              # À exécuter dans Supabase
│   └── README.md                       # Documentation complète
├── CLEANUP_FREIGHT_CUSTOMS_MODULE.sql  # Script de nettoyage
├── OPTIMIZE_FREIGHT_TABLES.sql         # Script d'optimisation
└── .env                                # Credentials (jamais commit!)
```

## 🎓 Prochaines Étapes

1. ✅ Testez avec des requêtes SELECT simples
2. ✅ Explorez les outils de description de tables
3. ✅ Exécutez le nettoyage freight en toute sécurité
4. ✅ Automatisez vos workflows SQL quotidiens

## 📚 Documentation Complète

Pour plus de détails, consultez `mcp-server/README.md`

---

**Temps total d'installation**: ~6 minutes  
**Niveau**: Intermédiaire  
**Prérequis**: Node.js, Claude Desktop, Accès Supabase

**Besoin d'aide?** Consultez la documentation MCP: https://modelcontextprotocol.io
