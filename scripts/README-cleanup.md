# Scripts de Nettoyage - Préparations d'Expédition

Ce dossier contient des scripts pour nettoyer les préparations d'expédition avec le statut "prepared".

## 📋 Scripts Disponibles

### 1. Script Node.js (Recommandé)

**Fichier:** `cleanup-prepared-shipments.js`

#### Mode Preview (Dry Run)
```bash
npm run cleanup:prepared-shipments:preview
```
ou
```bash
node scripts/cleanup-prepared-shipments.js --dry-run
```

Ce mode affiche ce qui sera supprimé **sans rien supprimer**.

#### Mode Suppression
```bash
npm run cleanup:prepared-shipments
```
ou
```bash
node scripts/cleanup-prepared-shipments.js
```

Ce mode **supprime réellement** les données.

### 2. Script SQL

**Fichier:** `cleanup-prepared-shipments.sql`

Exécuter dans l'éditeur SQL de Supabase:

1. **Section PREVIEW:** Affiche ce qui sera supprimé
2. **Section DELETE:** Supprime les données

## 🔍 Ce qui est Supprimé

Pour chaque préparation avec `status = 'prepared'`:

1. **Fichiers PDF** dans Supabase Storage (`shipping-documents` bucket)
   - Packing Lists
   - Documents uploadés

2. **shipping_documents** (table)
   - Enregistrements de documents

3. **shipping_production_items** (table)
   - Items de production liés

4. **shipping_signatories** (table)
   - Signataires

5. **shipping_preparations** (table)
   - L'enregistrement de la préparation elle-même

## ⚠️ Avertissements

- **IRRÉVERSIBLE:** Les données supprimées ne peuvent pas être récupérées
- **TOUJOURS** exécuter le mode preview d'abord
- **VÉRIFIER** les résultats du preview avant de supprimer
- Les **fichiers PDF** sont supprimés du storage Supabase

## 📊 Exemple de Sortie

### Preview Mode
```
👁️ DRY RUN MODE - No data will be deleted

🚀 Starting cleanup of prepared shipments...

📋 Step 1: Fetching all preparations with status "prepared"...
✅ Found 2 prepared shipment(s) to delete:

   1. EXP-2025-001 (abc-123-def)
   2. EXP-2025-002 (ghi-456-jkl)

👁️ Processing preparation: EXP-2025-001 (abc-123-def)
   📄 Would delete 3 document(s)
      - Packing List - EXP-2025-001 (Packing-List-EXP-2025-001.pdf)
      - Invoice (Invoice-001.pdf)
      - Certificate (Certificate-001.pdf)
   📦 Would delete 5 production item(s)
      - HUMSMK-1204
      - HUMSMK-1205
      - HUMSMK-1206
      - HUMSMK-1207
      - HUMSMK-1208
   ✍️ Would delete 3 signatory(ies)
      - Gold Room Operator: John Doe
      - SMK Finance: Jane Smith
      - Management: Bob Johnson

👁️ Dry run completed successfully!
📊 Summary: Would delete 2 prepared shipment(s) and all related data.

💡 To actually delete the data, run: npm run cleanup:prepared-shipments
```

### Delete Mode
```
🚀 Starting cleanup of prepared shipments...

📋 Step 1: Fetching all preparations with status "prepared"...
✅ Found 2 prepared shipment(s) to delete:

   1. EXP-2025-001 (abc-123-def)
   2. EXP-2025-002 (ghi-456-jkl)

🗑️ Processing preparation: EXP-2025-001 (abc-123-def)
   📁 Fetching documents for preparation abc-123-def...
   📄 Found 3 document(s) to delete
      Deleting file: abc-123-def/Packing-List-EXP-2025-001.pdf
      ✅ Deleted file: abc-123-def/Packing-List-EXP-2025-001.pdf
      Deleting file: abc-123-def/Invoice-001.pdf
      ✅ Deleted file: abc-123-def/Invoice-001.pdf
      Deleting file: abc-123-def/Certificate-001.pdf
      ✅ Deleted file: abc-123-def/Certificate-001.pdf
   ✅ Deleted folder: abc-123-def/
   🗄️ Deleting shipping_documents records...
   ✅ Deleted shipping_documents records
   🗄️ Deleting shipping_production_items...
   ✅ Deleted shipping_production_items
   🗄️ Deleting shipping_signatories...
   ✅ Deleted shipping_signatories
   🗄️ Deleting shipping_preparation...
   ✅ Deleted shipping_preparation
   ✅ Completed cleanup for EXP-2025-001

✅ Cleanup completed successfully!
📊 Summary: Deleted 2 prepared shipment(s) and all related data.
```

## 🛠️ Workflow Recommandé

```bash
# 1. Vérifier ce qui sera supprimé
npm run cleanup:prepared-shipments:preview

# 2. Lire attentivement la sortie

# 3. Si OK, supprimer
npm run cleanup:prepared-shipments

# 4. Vérifier dans Supabase que tout est nettoyé
```

## 🔐 Sécurité

- Utilise les credentials dans `.env`
- Nécessite `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
- Respecte les Row Level Security (RLS) policies

## 📝 Notes

- Les préparations avec `status = 'shipped'` ou autres statuts ne sont **pas affectées**
- Seules les préparations avec `status = 'prepared'` sont supprimées
- Tous les fichiers PDF associés sont supprimés du storage
- L'ordre de suppression respecte les contraintes de clés étrangères

## 🐛 Dépannage

### Erreur: Missing Supabase credentials
```
❌ Missing Supabase credentials in .env file
```
**Solution:** Vérifier que `.env` contient:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

### Erreur: Permission denied
**Solution:** Vérifier les RLS policies dans Supabase pour les tables concernées

### Aucune préparation trouvée
```
✅ No prepared shipments found. Nothing to clean up.
```
Ceci est normal s'il n'y a aucune préparation avec `status = 'prepared'`.

## 📞 Support

En cas de problème, contacter l'équipe de développement.
