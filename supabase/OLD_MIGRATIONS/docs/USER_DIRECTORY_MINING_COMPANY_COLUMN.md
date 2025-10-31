# User Directory - Mining Company Column

## ✅ Modification Complétée

La colonne **"Mining Company"** a été ajoutée à la table User Directory pour afficher les mining companies assignées à chaque utilisateur.

---

## 🎯 Ce Qui A Été Ajouté

### **1. Nouvelle Colonne dans User Directory ✅**

**Position:** Entre "ROLE" et "PHONE"

**Structure de la table:**
```
┌─────────────┬──────┬─────────────────┬───────┬────────┬────────────┬─────────┐
│ NAME        │ ROLE │ MINING COMPANY  │ PHONE │ STATUS │ LAST LOGIN │ ACTIONS │
├─────────────┼──────┼─────────────────┼───────┼────────┼────────────┼─────────┤
│ John Smith  │ Mgmt │ Kourousa       │ +224..│ Active │ 2 hrs ago  │ [Edit]  │
│ john@...    │      │                 │       │        │            │ [Lock]  │
├─────────────┼──────┼─────────────────┼───────┼────────┼────────────┼─────────┤
│ Jane Doe    │ Fact │ Kourousa       │ +225..│ Active │ 1 day ago  │ [Edit]  │
│ jane@...    │      │                 │       │        │            │ [Lock]  │
├─────────────┼──────┼─────────────────┼───────┼────────┼────────────┼─────────┤
│ Bob Martin  │ Airp │ Kourousa       │ +223..│ Active │ 3 hrs ago  │ [Edit]  │
│ bob@...     │      │                 │       │        │            │ [Lock]  │
└─────────────┴──────┴─────────────────┴───────┴────────┴────────────┴─────────┘
```

---

## 📊 Fonctionnalités

### **1. Affichage Unique ou Multiple**

**Un seul site:**
```
┌─────────────────┐
│ MINING COMPANY  │
├─────────────────┤
│ Kourousa        │
└─────────────────┘
```

**Plusieurs sites:**
```
┌─────────────────┐
│ MINING COMPANY  │
├─────────────────┤
│ Kourousa        │
│ Siguiri Gold    │
│ Dinguiraye Mine │
└─────────────────┘
```

**Aucun site assigné:**
```
┌─────────────────┐
│ MINING COMPANY  │
├─────────────────┤
│ Not assigned    │ ← Texte gris clair
└─────────────────┘
```

---

## 💻 Modifications Techniques

### **1. Interface User Étendue**

**Avant:**
```typescript
interface User {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  phone?: string | null;
  site_ids: string[];
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}
```

**Après:**
```typescript
interface User {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  phone?: string | null;
  site_ids: string[];
  mining_company_names?: string[];  // ← NOUVEAU
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}
```

---

### **2. Chargement des Mining Companies**

#### **Jointure SQL:**
```typescript
const { data: assignments } = await supabase
  .from('user_site_assignments')
  .select('user_id, site_id, mining_companies(name)');
```

#### **Mapping des Données:**
```typescript
const assignmentMap = new Map<string, {
  site_ids: string[];
  company_names: string[]
}>();

if (assignments) {
  assignments.forEach((assignment: any) => {
    if (!assignmentMap.has(assignment.user_id)) {
      assignmentMap.set(assignment.user_id, {
        site_ids: [],
        company_names: []
      });
    }
    const userAssignments = assignmentMap.get(assignment.user_id)!;
    userAssignments.site_ids.push(assignment.site_id);
    if (assignment.mining_companies?.name) {
      userAssignments.company_names.push(assignment.mining_companies.name);
    }
  });
}
```

#### **Application aux Utilisateurs:**
```typescript
const processedUsers: User[] = usersData
  .filter((profile: any) => profile && profile.id && profile.email)
  .map((profile: any) => {
    const userAssignments = assignmentMap.get(profile.id) || {
      site_ids: [],
      company_names: []
    };
    return {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      role: profile.role,
      phone: profile.phone,
      site_ids: userAssignments.site_ids,
      mining_company_names: userAssignments.company_names,  // ← NOUVEAU
      is_active: profile.is_active !== false,
      last_login_at: profile.last_login_at,
      created_at: profile.created_at,
    };
  });
```

---

### **3. Colonne dans la Table**

```typescript
{
  key: 'mining_company',
  label: 'MINING COMPANY',
  render: (_value: any, user: User) => {
    // Cas 1: Aucune company assignée
    if (!user || !user.mining_company_names || user.mining_company_names.length === 0) {
      return <span className="text-gray-400 text-sm">Not assigned</span>;
    }

    // Cas 2: Une ou plusieurs companies
    return (
      <div className="flex flex-col gap-1">
        {user.mining_company_names.map((name, idx) => (
          <span key={idx} className="text-sm text-gray-700">
            {name}
          </span>
        ))}
      </div>
    );
  },
}
```

---

## 📝 Ordre des Colonnes

**Nouvelle structure:**
```
1. NAME (nom + email)
2. ROLE (badge coloré)
3. MINING COMPANY (liste des mines) ← NOUVEAU
4. PHONE (numéro)
5. STATUS (Active/Inactive)
6. LAST LOGIN (date)
7. ACTIONS (Edit/Lock)
```

**Logique de placement:**
- Après ROLE car c'est une info organisationnelle
- Avant PHONE car plus important dans le contexte métier
- Cohérent avec le workflow: Identité → Rôle → Affectation → Contact

---

## 🗄️ Script SQL pour Assignation

### **Objectif:**
Assigner la **même mining company** aux 3 premiers utilisateurs

### **Fichier:** `ASSIGN_SAME_MINING_COMPANY.sql`

### **Fonctionnement:**

```sql
-- 1. Sélectionne la première mining company active
SELECT id FROM mining_companies
WHERE is_active = true
ORDER BY name
LIMIT 1;

-- 2. Récupère les 3 premiers utilisateurs
SELECT id FROM user_profiles
ORDER BY created_at
LIMIT 3;

-- 3. Supprime les anciennes assignations
DELETE FROM user_site_assignments
WHERE user_id IN (user_ids);

-- 4. Crée les nouvelles assignations
INSERT INTO user_site_assignments (user_id, site_id, assigned_at, assigned_by)
VALUES (user_id, mining_company_id, NOW(), management_user_id);

-- 5. Affiche le résumé
SELECT
  up.full_name,
  up.email,
  up.role,
  mc.name as mining_company,
  mc.code as company_code
FROM user_profiles up
LEFT JOIN user_site_assignments usa ON usa.user_id = up.id
LEFT JOIN mining_companies mc ON mc.id = usa.site_id;
```

### **Exécution:**

**Option 1: Dans Supabase Dashboard**
```bash
1. Ouvrir Supabase Dashboard
2. Aller dans SQL Editor
3. Copier le contenu de ASSIGN_SAME_MINING_COMPANY.sql
4. Cliquer "Run"
5. Vérifier le résumé affiché
```

**Option 2: Via psql**
```bash
psql -h db.xxx.supabase.co -U postgres -d postgres -f ASSIGN_SAME_MINING_COMPANY.sql
```

**Résultat attendu:**
```
NOTICE:  Mining company sélectionnée: abc-123-def-456
NOTICE:  Nombre d'utilisateurs à assigner: 3
NOTICE:  Anciennes assignations supprimées
NOTICE:  Utilisateur xxx assigné à la mining company abc
NOTICE:  Utilisateur yyy assigné à la mining company abc
NOTICE:  Utilisateur zzz assigné à la mining company abc
NOTICE:  Assignations terminées avec succès!
NOTICE:  --- RÉSUMÉ ---
NOTICE:  Mining Company: Kourousa
NOTICE:  Utilisateurs assignés: 3

   full_name    |      email       |   role   | mining_company | company_code
----------------+------------------+----------+----------------+--------------
 John Smith     | john@example.com | management| Kourousa      | KRGN01
 Jane Doe       | jane@example.com | factory   | Kourousa      | KRGN01
 Bob Martin     | bob@example.com  | airport   | Kourousa      | KRGN01
```

---

## 🎨 Styles Visuels

### **Mining Company Names**
```css
/* Texte normal (company assignée) */
text-sm text-gray-700
font-normal

/* Texte non assigné */
text-gray-400 text-sm
italic
```

### **Layout Multiple Companies**
```css
/* Container */
display: flex
flex-direction: column
gap: 4px (gap-1)

/* Chaque nom */
<span className="text-sm text-gray-700">
  Company Name
</span>
```

### **Exemple Visuel:**

**Un site:**
```
┌────────────────┐
│ Kourousa       │ ← text-gray-700, text-sm
└────────────────┘
```

**Deux sites:**
```
┌────────────────┐
│ Kourousa       │ ← text-gray-700, text-sm
│ Siguiri Gold   │ ← text-gray-700, text-sm
└────────────────┘
   ↑ gap-1 (4px)
```

**Aucun site:**
```
┌────────────────┐
│ Not assigned   │ ← text-gray-400, text-sm
└────────────────┘
```

---

## 🔍 Comportements

### **1. Chargement des Données**

**Timing:**
- Chargement des users
- Puis chargement des assignations (jointure)
- Merge des données
- Affichage dans la table

**Performance:**
- Une seule requête pour toutes les assignations
- Utilise Map pour O(1) lookup
- Pas de N+1 queries

### **2. Affichage**

**Si 0 company:**
```typescript
return <span className="text-gray-400 text-sm">Not assigned</span>;
```

**Si 1 company:**
```typescript
return (
  <div className="flex flex-col gap-1">
    <span className="text-sm text-gray-700">Kourousa</span>
  </div>
);
```

**Si 3+ companies:**
```typescript
return (
  <div className="flex flex-col gap-1">
    <span className="text-sm text-gray-700">Kourousa</span>
    <span className="text-sm text-gray-700">Siguiri Gold</span>
    <span className="text-sm text-gray-700">Dinguiraye</span>
  </div>
);
```

### **3. Tri et Filtres**

**La colonne est triable:** Non (pour l'instant)
**La colonne est filtrable:** Non (pour l'instant)
**Affichée par défaut:** Oui

---

## 📊 Cas d'Usage

### **Cas 1: Utilisateur avec 1 mine**
```
User: John Smith
Role: Management
Mining Company: Kourousa
Result: Affiche "Kourousa"
```

### **Cas 2: Utilisateur avec 3 mines**
```
User: Jane Doe
Role: Factory
Mining Companies:
  - Kourousa
  - Siguiri Gold
  - Dinguiraye Mine
Result: Affiche les 3 noms en vertical
```

### **Cas 3: Utilisateur sans assignation**
```
User: Bob Martin
Role: Customer
Mining Company: None
Result: Affiche "Not assigned" en gris
```

### **Cas 4: Nouvel utilisateur**
```
User: New User (vient d'être créé)
Mining Company: Empty array []
Result: Affiche "Not assigned" en gris
```

---

## 🧪 Tests à Effectuer

### **Test 1: Affichage Basique**
```bash
1. Exécuter le script SQL d'assignation
2. Rafraîchir la page User Management
3. ✓ Colonne "MINING COMPANY" visible
4. ✓ Nom de la mine affiché pour les 3 users
5. ✓ Tous les 3 ont la même mine
```

### **Test 2: Multiple Mining Companies**
```bash
1. Assigner 2 mines à un utilisateur (SQL direct)
2. Rafraîchir la page
3. ✓ Les 2 noms affichés en vertical
4. ✓ Gap de 4px entre les noms
5. ✓ Texte text-gray-700
```

### **Test 3: Pas d'Assignation**
```bash
1. Créer un nouvel utilisateur sans assignation
2. Voir la table
3. ✓ "Not assigned" affiché en gris clair
4. ✓ Texte text-gray-400
```

### **Test 4: Navigation et Tri**
```bash
1. Cliquer sur les headers de colonnes
2. ✓ Le tri fonctionne sur les autres colonnes
3. ✓ La colonne MINING COMPANY reste visible
4. Scroller horizontalement
5. ✓ La colonne reste accessible
```

---

## 📁 Fichiers Modifiés

**Fichier:** `src/pages/admin/UserManagement.tsx`

**Sections modifiées:**

1. **Interface User (ligne 25)**
   - Ajout de `mining_company_names?: string[]`

2. **fetchUsers - Fallback (lignes 331-371)**
   - Jointure avec `user_site_assignments`
   - Création du Map pour les assignations
   - Ajout de `mining_company_names` aux users

3. **fetchUsers - Edge Function (lignes 388-425)**
   - Même logique que le fallback
   - Jointure et mapping

4. **columns Definition (lignes 778-795)**
   - Nouvelle colonne "MINING COMPANY"
   - Render conditionnel (assigné / non assigné)
   - Support multi-companies

**Lignes ajoutées:** ~80 lignes
**Lignes modifiées:** ~40 lignes

---

## 📝 Script SQL Créé

**Fichier:** `ASSIGN_SAME_MINING_COMPANY.sql`

**Contenu:**
- Bloc PL/pgSQL pour assignation automatique
- Sélection de la première mining company
- Assignation aux 3 premiers users
- Requête de vérification

**Usage:**
```bash
# Dans Supabase Dashboard SQL Editor
-- Copier/coller le contenu du fichier
-- Exécuter

# Ou via psql
psql -f ASSIGN_SAME_MINING_COMPANY.sql
```

---

## ✅ Résumé Final

**Modifications appliquées:**

✅ **Interface User étendue** avec `mining_company_names`
✅ **Chargement des assignations** via jointure SQL
✅ **Nouvelle colonne** dans User Directory
✅ **Affichage multi-sites** supporté
✅ **État "Not assigned"** pour users sans mine
✅ **Script SQL** pour assignation groupée
✅ **Build réussi** sans erreurs

**Position de la colonne:**
- Entre ROLE et PHONE
- 3ème colonne de la table

**Résultat pour les 3 users:**
```
User 1 → Kourousa
User 2 → Kourousa
User 3 → Kourousa
```

**Build:** ✅ Réussi
**TypeScript:** ✅ Sans erreurs
**SQL Script:** ✅ Créé et prêt

---

**Date:** 2025-10-29
**Status:** ✅ Production Ready

🎉 **La colonne Mining Company est maintenant affichée dans la User Directory!**
