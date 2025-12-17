# Fix Permissions - Show All Modules 🔧

## 🔍 Problem Identified

Your permissions page is loading modules from a **database table** (`modules`) that is either:
1. Empty
2. Contains only old modules (Batches, Sales, Refining)

The UserPermissionsPage loads modules from the database at line 82-108:
```typescript
const { data, error } = await supabase
  .from('modules')
  .select('*')
  .eq('is_active', true)
  .order('category, display_name');
```

## ✅ Solution - 2 Steps

### Step 1: Run SQL Script in Supabase

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Click on "SQL Editor" in the left menu

2. **Copy the SQL Script**
   - Open the file: `CREATE_ALL_MODULES_PERMISSIONS.sql`
   - Copy ALL the content

3. **Execute in Supabase**
   - Paste the SQL into the SQL Editor
   - Click "Run" or press Ctrl+Enter
   - Wait for success message

4. **Verify**
   - The script includes a verification query at the end
   - You should see 43 modules inserted
   - Categories: batches, operations, sales, analytics, system

### Step 2: Refresh Your Application

1. Clear browser cache or do a hard refresh (Ctrl+Shift+R)
2. Log back in as Management user
3. Navigate to User Management → Select a user → Permissions tab
4. You should now see ALL modules organized by category

## 📊 Expected Result

### Categories & Module Count

**Batches Management (8 modules)**
- Tableau de Bord
- Production Quotidienne
- Consultation Production
- Production en Coffre
- Préparation Expédition
- Consultation Expéditions
- Certificats d'Essai
- Licences d'Export

**Operations (7 modules)**
- Expéditions de Fret
- Douanes & Documents
- Inventaire Or
- Inventaire Argent
- Réception
- Processus de Raffinage
- Fret Raffinage

**Sales Management (10 modules)**
- Consultation Ventes
- Création Vente
- Espace Trading
- Pré-Ventes
- Consultation Clients
- Gestion Clients
- Consultation Paiements
- Enregistrer Paiement
- Approuver Paiements
- Paiements Virtuels

**Insights & Reports (7 modules)**
- Tableau Analytique
- Intelligence Center
- Génération Rapports
- Gestion Budgets
- Prévisions
- Prix de l'Or
- Taux de Change

**Administration (11 modules)**
- Sociétés Minières
- Déposants
- Compagnies de Fret
- Raffineries
- Transport Terrestre
- Gestion Utilisateurs
- Permissions Utilisateurs
- Paramètres Système
- Paramètres Ventes
- Gestionnaire Statuts
- Journal d'Audit
- Tableau Approbations

**TOTAL: 43 Modules**

## 🎯 What This SQL Does

1. **Creates Tables** (if not exist)
   - `modules` - Stores all application modules
   - `user_permissions` - Stores user-specific permissions

2. **Sets Up Security**
   - Enables Row Level Security (RLS)
   - Creates policies for authenticated access
   - Management users can manage permissions

3. **Populates Modules**
   - Inserts all 43 application modules
   - Organized by 5 categories
   - Includes French display names and descriptions

4. **Creates Indexes**
   - Optimizes queries on category and user_id
   - Improves performance

## 📸 Before & After

### Before (Old System)
```
Permissions Tab Categories:
├── Batches Management
│   ├── Batches (only 1 old module)
│
├── Sales Management
│   └── Sales (only 1 old module)
│
└── Insights & Reports
    └── (empty or minimal)
```

### After (Complete System)
```
Permissions Tab Categories:
├── Batches Management (8 modules)
│   ├── Tableau de Bord
│   ├── Production Quotidienne
│   ├── Production en Coffre
│   ├── Préparation Expédition
│   ├── Consultation Expéditions
│   ├── Certificats d'Essai
│   └── Licences d'Export
│
├── Operations (7 modules)
│   ├── Expéditions de Fret
│   ├── Douanes & Documents
│   ├── Inventaire Or & Argent
│   ├── Réception
│   └── Raffinage
│
├── Sales Management (10 modules)
│   ├── Ventes & Pré-Ventes
│   ├── Clients
│   └── Paiements (4 sous-modules)
│
├── Insights & Reports (7 modules)
│   ├── Analytics & Intelligence
│   ├── Rapports
│   ├── Budgets & Prévisions
│   └── Prix & Taux
│
└── Administration (11 modules)
    ├── Parties Prenantes (5)
    ├── Utilisateurs & Permissions
    ├── Paramètres (3)
    └── Audit & Approbations
```

## 🔐 Permissions Structure

Each module supports:
- ✅ **Read** - View module data
- ✅ **Write** - Create and edit records
- ✅ **Delete** - Remove records
- ✅ **Field-Level** - Granular control per field

Example fields configured:
- **Production:** batch_number, weight, status, shipping_date, etc.
- **Sales:** customer, quantity, price, london_am_rate, etc.
- **Payments:** amount, currency, fx_rate, proof_document, etc.
- **Refining:** pre/post melting weight, fineness, metal_retained, etc.

## 🚀 Quick Test

After running the SQL:

```sql
-- Test query - Run in Supabase SQL Editor
SELECT
  category,
  COUNT(*) as count,
  STRING_AGG(display_name, ', ' ORDER BY sort_order) as modules
FROM modules
WHERE is_active = true
GROUP BY category
ORDER BY category;
```

Expected output:
- analytics: 7 modules
- batches: 8 modules
- operations: 7 modules
- sales: 10 modules
- system: 11 modules

**Total: 43 modules**

## ⚠️ Important Notes

1. **Idempotent Script**
   - Safe to run multiple times
   - Uses `ON CONFLICT DO NOTHING`
   - Won't duplicate modules

2. **Preserves Existing Permissions**
   - Only populates the `modules` table
   - Doesn't delete user permissions
   - Users keep their assigned permissions

3. **RLS Protected**
   - Only management users can edit permissions
   - Users can only see their own permissions
   - All operations are audited

## 🎉 Success Criteria

You'll know it worked when:
1. ✅ Permissions tab shows 5 categories in sidebar
2. ✅ Each category has multiple modules
3. ✅ Total of 43 modules visible
4. ✅ French display names appear correctly
5. ✅ Can configure permissions per module
6. ✅ Field-level permissions work for each module

## 📝 Additional Configuration

### Add Custom Modules

If you need to add more modules:

```sql
INSERT INTO modules (name, display_name, description, category, sort_order)
VALUES ('custom_module', 'Mon Module', 'Description', 'sales', 999);
```

### Disable a Module

```sql
UPDATE modules SET is_active = false WHERE name = 'module_name';
```

### Change Module Category

```sql
UPDATE modules SET category = 'analytics' WHERE name = 'module_name';
```

## 🆘 Troubleshooting

### Issue: Still seeing old modules

**Solution:**
1. Clear browser cache completely
2. Log out and log back in
3. Try incognito/private browsing mode

### Issue: No modules appear

**Solution:**
1. Check if user has Management role
2. Verify RLS policies are created
3. Check browser console for errors

### Issue: Database error

**Solution:**
1. Ensure you're logged in to Supabase as admin
2. Verify user_profiles table exists
3. Check that auth.users table is accessible

## 📞 Need Help?

If you encounter issues:
1. Check Supabase logs in Dashboard → Logs
2. Verify the SQL executed successfully
3. Confirm module count: `SELECT COUNT(*) FROM modules;`
4. Check RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'modules';`

---

**Ready to fix?**
→ Open `CREATE_ALL_MODULES_PERMISSIONS.sql`
→ Copy all content
→ Paste in Supabase SQL Editor
→ Run it
→ Refresh your app
→ Enjoy all 43 modules! 🎉
