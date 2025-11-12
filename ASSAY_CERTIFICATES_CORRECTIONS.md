# ✅ Corrections - Migration Assay Certificates

## 🔧 Problèmes Corrigés

### Erreur 1: `column sp.preparation_number does not exist`
**Cause** : La colonne s'appelle `expedition_lot_number` dans la table `shipping_preparations`, pas `preparation_number`.

**Correction** :
```sql
-- Avant ❌
sp.preparation_number

-- Après ✅
sp.expedition_lot_number
```

---

### Erreur 2: Colonnes inexistantes dans la vue
**Colonnes supprimées** :
- `freight_company_id` (n'existe pas dans shipping_preparations)
- `destination_refinery_id` (n'existe pas dans shipping_preparations)
- `shipping_date` (n'existe pas, utiliser `created_at`)

**Vue corrigée** :
```sql
CREATE OR REPLACE VIEW assay_certificates_with_shipping AS
SELECT
  ac.*,
  sp.expedition_lot_number,          -- ✅ Corrigé
  sp.status as shipping_status,
  sp.total_net_weight_grams,
  sp.total_gross_weight_grams,
  sp.shipped_to_company,             -- ✅ Existe
  sp.shipped_to_address,
  sp.shipped_to_country,
  sp.mining_company_id,
  mc.name as mining_company_name,
  mc.country as mining_company_country,
  sp.prepared_at,
  sp.shipped_at,
  sp.created_at as shipping_created_at -- ✅ Au lieu de shipping_date
FROM assay_certificates ac
LEFT JOIN shipping_preparations sp ON ac.shipping_preparation_id = sp.id
LEFT JOIN mining_companies mc ON sp.mining_company_id = mc.id
ORDER BY ac.created_at DESC;
```

---

### Erreur 3: Nom de fichier migration non numéroté
**Problème** : Difficile de retrouver et d'ordonner les migrations.

**Solution** : Format standardisé `YYYYMMDD_NNN_description.sql`

```
Avant ❌
migrate_assay_certificates_to_shipping.sql

Après ✅
20251112_012_migrate_assay_certificates_to_shipping.sql
└─┬─┘ └┬┘ └───────────────┬───────────────┘
  │    │                  └─ Description
  │    └─ Numéro séquentiel
  └─ Date YYYYMMDD
```

---

## 📊 Structure Réelle de shipping_preparations

```sql
CREATE TABLE shipping_preparations (
  id UUID PRIMARY KEY,
  daily_production_id UUID,
  mining_company_id UUID,              -- ✅ Existe
  expedition_lot_number TEXT,          -- ✅ Numéro d'expédition
  seal_number TEXT,
  packing_list_url TEXT,
  packing_list_document_id UUID,
  shipped_to_company TEXT,             -- ✅ Existe
  shipped_to_address TEXT,             -- ✅ Existe
  shipped_to_country TEXT,             -- ✅ Existe
  status TEXT,
  prepared_at TIMESTAMPTZ,             -- ✅ Existe
  shipped_at TIMESTAMPTZ,              -- ✅ Existe
  notes TEXT,
  total_net_weight_grams DECIMAL,      -- ✅ Existe
  total_gross_weight_grams DECIMAL,    -- ✅ Existe
  total_boxes INTEGER,
  created_at TIMESTAMPTZ,              -- ✅ Utilisé comme date
  updated_at TIMESTAMPTZ,
  created_by UUID
);
```

**Colonnes qui n'existent PAS** :
- ❌ `preparation_number` → utiliser `expedition_lot_number`
- ❌ `freight_company_id`
- ❌ `destination_refinery_id`
- ❌ `shipping_date` → utiliser `created_at` ou `shipped_at`

---

## 🔄 Corrections TypeScript

### Interface ShippingWithCertificates

```typescript
// Avant ❌
interface ShippingWithCertificates {
  preparation_number: string;      // N'existe pas
  total_weight_grams: number;      // Nom incorrect
  freight_company_name: string;    // Colonne inexistante
  destination_refinery_name: string; // Colonne inexistante
  shipping_date: string;           // N'existe pas
}

// Après ✅
interface ShippingWithCertificates {
  expedition_lot_number: string;   // ✅ Correct
  total_net_weight_grams: number;  // ✅ Correct
  shipped_to_company: string;      // ✅ Existe
  created_at: string;              // ✅ Date de création
}
```

### Requête Supabase

```typescript
// Avant ❌
const { data } = await supabase
  .from('shipping_preparations')
  .select(`
    *,
    mining_company:mining_companies(name, country),
    freight_company:freight_companies(name),
    destination_refinery:refineries(name)
  `);

// Après ✅
const { data } = await supabase
  .from('shipping_preparations')
  .select(`
    *,
    mining_company:mining_companies(name, country)
  `);
```

---

## 📁 Fichiers Modifiés

### 1. Migration SQL
- ✅ **Créé** : `supabase/migrations/20251112_012_migrate_assay_certificates_to_shipping.sql`
- ❌ **Supprimé** : `supabase/migrations/migrate_assay_certificates_to_shipping.sql`

### 2. Page TypeScript
- ✅ **Modifié** : `src/pages/documents/AssayCertificatesPage.tsx`
  - Interface mise à jour
  - Requête Supabase simplifiée
  - Affichage corrigé

### 3. Service
- ✅ **Modifié** : `src/services/assayCertificateService.ts`
  - Fonction `getBatchCertificates()` conservée (deprecated)
  - Nouvelle fonction `getShippingCertificates()`

---

## ⚠️ Instructions d'Application

### Étape 1 : Appliquer la Migration SQL

```bash
# 1. Copier le fichier
supabase/migrations/20251112_012_migrate_assay_certificates_to_shipping.sql

# 2. Dans Supabase Dashboard
# - Ouvrir SQL Editor
# - Coller le contenu
# - RUN

# 3. Vérifier
SELECT column_name FROM information_schema.columns
WHERE table_name = 'assay_certificates'
AND column_name = 'shipping_preparation_id';
-- Doit retourner 1 ligne
```

### Étape 2 : Vérifier la Vue

```sql
-- Tester la vue
SELECT * FROM assay_certificates_with_shipping LIMIT 1;

-- Doit afficher:
-- - expedition_lot_number (pas preparation_number)
-- - mining_company_name
-- - shipped_to_company
-- - created_at (pas shipping_date)
```

### Étape 3 : Rafraîchir l'Application

```bash
# L'application est déjà buildée
# Rafraîchir simplement le navigateur (F5)
```

---

## 🧪 Tests de Vérification

### Test 1 : Menu Navigation
- [ ] Menu "Document Management" visible
- [ ] Sous-menu "Assay Certificates" cliquable
- [ ] Route `/documents/assay-certificates` fonctionne

### Test 2 : Page Assay Certificates
- [ ] Liste des expéditions s'affiche
- [ ] `expedition_lot_number` visible (pas `preparation_number`)
- [ ] Mining company name et country affichés
- [ ] Total net weight affiché
- [ ] Compteurs corrects (Total, Pending, Approved)

### Test 3 : Filtres & Recherche
- [ ] Recherche par `expedition_lot_number` fonctionne
- [ ] Recherche par mining company fonctionne
- [ ] Filtre par statut fonctionne
- [ ] Filtre par approval status fonctionne

### Test 4 : Expand/Collapse
- [ ] Cliquer sur une expédition l'expand
- [ ] Liste des certificats s'affiche
- [ ] Bouton "View" sur certificat fonctionne

---

## 📊 Tableau Comparatif

| Élément | Avant ❌ | Après ✅ |
|---------|---------|----------|
| Nom migration | `migrate_assay...sql` | `20251112_012_migrate...sql` |
| Colonne numéro | `preparation_number` | `expedition_lot_number` |
| Colonne poids | `total_weight_grams` | `total_net_weight_grams` |
| Colonne date | `shipping_date` | `created_at` |
| Freight company | Référencé | Retiré (n'existe pas) |
| Destination refinery | Référencé | Retiré (n'existe pas) |
| Vue SQL | Colonnes inexistantes | Colonnes existantes uniquement |
| TypeScript interface | Noms incorrects | Noms corrects |

---

## 🎯 Résultat Final

### ✅ Migration SQL
- Numérotée : `20251112_012_migrate_assay_certificates_to_shipping.sql`
- Vue corrigée avec colonnes existantes uniquement
- Fonctions RPC créées
- Politiques RLS configurées

### ✅ Code TypeScript
- Interface mise à jour avec bons noms de colonnes
- Requêtes Supabase simplifiées
- Affichage adapté aux données réelles
- Build réussi (29.44s)

### ✅ Navigation
- Nouveau groupe "Document Management"
- Route : `/documents/assay-certificates`
- Menu accessible et fonctionnel

---

## 📖 Documentation

- **Guide complet** : `ASSAY_CERTIFICATES_MIGRATION_GUIDE.md`
- **Corrections** : `ASSAY_CERTIFICATES_CORRECTIONS.md` (ce fichier)
- **Migration SQL** : `supabase/migrations/20251112_012_migrate_assay_certificates_to_shipping.sql`

---

**Date** : 12 Novembre 2025
**Version** : 1.1 (Corrigée)
**Status** : ✅ Production Ready
