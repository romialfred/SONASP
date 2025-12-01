# Gold Shipper MCP Server

MCP (Model Context Protocol) Server pour exécuter directement des requêtes SQL sur Supabase sans copier-coller manuel.

## 🚀 Installation Rapide

### Étape 1: Installer les dépendances MCP

```bash
npm run mcp:install
```

### Étape 2: Configurer la fonction SQL dans Supabase

1. Ouvrez Supabase SQL Editor
2. Copiez et exécutez le contenu de `mcp-server/setup_exec_sql.sql`
3. Cela crée la fonction `exec_sql` nécessaire

### Étape 3: Configurer Claude Desktop

#### Sur macOS/Linux

Ouvrez `~/Library/Application Support/Claude/claude_desktop_config.json` et ajoutez:

```json
{
  "mcpServers": {
    "gold-shipper": {
      "command": "node",
      "args": [
        "/chemin/absolu/vers/projet/mcp-server/index.js"
      ],
      "env": {
        "VITE_SUPABASE_URL": "votre_supabase_url",
        "SUPABASE_SERVICE_ROLE_KEY": "votre_service_role_key"
      }
    }
  }
}
```

#### Sur Windows

Ouvrez `%APPDATA%\Claude\claude_desktop_config.json` et ajoutez la même configuration.

**Important**: Remplacez `/chemin/absolu/vers/projet` par le chemin réel vers votre projet.

### Étape 4: Redémarrer Claude Desktop

Fermez complètement Claude Desktop et relancez-le.

## 🛠️ Outils Disponibles

Le serveur MCP expose 5 outils:

### 1. `execute_sql`
Exécute n'importe quelle requête SQL sur Supabase.

**Exemple d'utilisation**:
```
Execute SQL: SELECT * FROM freight_shipments LIMIT 5;
```

### 2. `list_tables`
Liste toutes les tables avec leur nombre de lignes.

**Exemple d'utilisation**:
```
List all tables in the database
```

### 3. `describe_table`
Affiche la structure d'une table (colonnes, types, contraintes).

**Exemple d'utilisation**:
```
Describe the freight_shipments table
```

### 4. `cleanup_freight_module`
Exécute le script de nettoyage complet du module Freight & Customs.

**Exemple d'utilisation**:
```
Cleanup freight module (confirm: true)
```

### 5. `optimize_freight_tables`
Exécute ANALYZE sur les tables freight pour optimiser les performances.

**Exemple d'utilisation**:
```
Optimize freight tables
```

## 📝 Exemples d'Utilisation

### Exécuter une requête SELECT

```
Via MCP: Execute SQL to count all freight shipments
```

Claude utilisera automatiquement l'outil `execute_sql`.

### Créer une nouvelle table

```
Via MCP: Create a test table with id and name columns
```

### Insérer des données

```
Via MCP: Insert a test row into freight_shipments
```

### Nettoyer le module Freight

```
Via MCP: Run the freight cleanup script
```

## 🔒 Sécurité

**IMPORTANT**: Le serveur MCP utilise `SUPABASE_SERVICE_ROLE_KEY` qui donne un accès complet à la base de données. 

**Recommandations**:
- ✅ Utilisez uniquement en développement
- ✅ Ne partagez jamais votre `claude_desktop_config.json`
- ✅ Ne commitez jamais les clés dans Git
- ❌ N'utilisez pas en production sans restrictions RLS appropriées

## 🔍 Vérification de l'Installation

Pour vérifier que le serveur MCP fonctionne:

1. Ouvrez Claude Desktop
2. Créez une nouvelle conversation
3. Tapez: "List all tables in the database via MCP"
4. Claude devrait utiliser l'outil `list_tables` et afficher vos tables

## 🐛 Dépannage

### Erreur: "Missing Supabase credentials"

**Solution**: Vérifiez que votre `.env` contient:
```
VITE_SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
```

### Erreur: "exec_sql function not found"

**Solution**: Exécutez `mcp-server/setup_exec_sql.sql` dans Supabase SQL Editor.

### Le serveur MCP ne démarre pas

**Solution**: 
1. Testez localement: `npm run mcp:start`
2. Vérifiez les logs: `tail -f ~/Library/Logs/Claude/mcp-server-gold-shipper.log`
3. Vérifiez le chemin absolu dans `claude_desktop_config.json`

### Claude ne voit pas les outils MCP

**Solution**:
1. Redémarrez complètement Claude Desktop (Cmd+Q sur Mac)
2. Vérifiez la syntaxe JSON de votre configuration
3. Consultez les logs MCP dans Claude Desktop

## 📚 Structure des Fichiers

```
mcp-server/
├── index.js                    # Serveur MCP principal
├── package.json               # Dépendances MCP
├── setup_exec_sql.sql         # Fonction SQL à exécuter dans Supabase
└── README.md                  # Cette documentation
```

## 🎯 Avantages du Serveur MCP

✅ **Pas de copier-coller manuel** - Exécution directe depuis Claude  
✅ **Accès complet à Supabase** - Toutes les opérations SQL supportées  
✅ **Scripts intégrés** - Cleanup et optimisation en un clic  
✅ **Inspection de base** - List tables, describe table automatiquement  
✅ **Développement rapide** - Test de requêtes instantané

## 🔄 Mise à Jour

Pour mettre à jour le serveur MCP:

```bash
cd mcp-server
npm update
```

## 📞 Support

Pour tout problème:
1. Vérifiez les logs Claude Desktop
2. Testez avec `npm run mcp:start`
3. Consultez la documentation MCP: https://modelcontextprotocol.io

---

**Version**: 1.0.0  
**License**: MIT  
**Projet**: Gold Shipper - Mansa Resources
