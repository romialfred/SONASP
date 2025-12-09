# 🔧 Correction - Erreur Raffineries Manquantes

## 🚨 Problème Identifié

**Erreur lors de l'enregistrement d'une préparation de shipping:**

```
Erreur technique: insert or update on table "shipping_preparations" violates
foreign key constraint "shipping_preparations_refinery_id_fkey"

Code: 23503
Details: Key (refinery_id) is not present in table "refinery_plants".
```

**Cause:** Les raffineries ne sont pas présentes dans la table `refinery_plants` de la base de données.

---

## ✅ Solution

### Option 1: Via l'Interface Utilisateur (RECOMMANDÉ)

**Étape 1: Aller dans la page des Raffineries**
1. Connectez-vous en tant qu'administrateur
2. Allez dans le menu **Admin** → **Refinery Plants**
3. Cliquez sur **"Add Refinery"**

**Étape 2: Ajouter les raffineries**

Ajoutez ces trois raffineries:

#### 1. Rand Refinery Ltd - South Africa
- **Name:** Rand Refinery Ltd - South Africa
- **Location:** Germiston
- **Country:** South Africa
- **Email:** info@randrefinery.com
- **Phone:** +27 11 961 9000
- **Contact Person:** General Manager
- **Capacity:** 500000 grams/month
- **Status:** Active ✅

#### 2. Valcambi SA - Switzerland
- **Name:** Valcambi SA - Switzerland
- **Location:** Balerna
- **Country:** Switzerland
- **Email:** info@valcambi.com
- **Phone:** +41 91 695 61 11
- **Contact Person:** Operations Manager
- **Capacity:** 1000000 grams/month
- **Status:** Active ✅

#### 3. Emirates Gold DMCC - UAE
- **Name:** Emirates Gold DMCC - UAE
- **Location:** Dubai
- **Country:** United Arab Emirates
- **Email:** info@emiratesgold.ae
- **Phone:** +971 4 434 0100
- **Contact Person:** Refinery Manager
- **Capacity:** 300000 grams/month
- **Status:** Active ✅

---

### Option 2: Via SQL (Pour Administrateur Base de Données)

Si vous avez accès à l'éditeur SQL de Supabase:

1. Ouvrez **Supabase Dashboard**
2. Allez dans **SQL Editor**
3. Exécutez ce script:

```sql
-- Insert refinery plants data
INSERT INTO refinery_plants (name, city, country, is_active)
VALUES
  ('Rand Refinery Ltd - South Africa', 'Germiston', 'South Africa', true),
  ('Valcambi SA - Switzerland', 'Balerna', 'Switzerland', true),
  ('Emirates Gold DMCC - UAE', 'Dubai', 'United Arab Emirates', true)
ON CONFLICT (name) DO NOTHING;

-- Also insert into refineries table for compatibility
INSERT INTO refineries (name, location, country, email, phone, contact_person, capacity_grams_per_month, is_active)
VALUES
  (
    'Rand Refinery Ltd - South Africa',
    'Germiston',
    'South Africa',
    'info@randrefinery.com',
    '+27 11 961 9000',
    'General Manager',
    500000,
    true
  ),
  (
    'Valcambi SA - Switzerland',
    'Balerna',
    'Switzerland',
    'info@valcambi.com',
    '+41 91 695 61 11',
    'Operations Manager',
    1000000,
    true
  ),
  (
    'Emirates Gold DMCC - UAE',
    'Dubai',
    'United Arab Emirates',
    'info@emiratesgold.ae',
    '+971 4 434 0100',
    'Refinery Manager',
    300000,
    true
  )
ON CONFLICT (name) DO NOTHING;
```

---

## 🧪 Vérification

Après avoir ajouté les raffineries:

1. **Vérifier dans l'interface**
   - Aller dans Admin → Refinery Plants
   - Vous devriez voir les 3 raffineries listées

2. **Tester la création d'une préparation**
   - Aller dans Shipping Preparations
   - Créer une nouvelle préparation
   - Sélectionner une raffinerie dans la liste déroulante
   - Sauvegarder
   - ✅ **Résultat attendu:** Sauvegarde réussie sans erreur

---

## 🔍 Pourquoi Ce Problème Est Survenu

### Contrainte de Clé Étrangère

La table `shipping_preparations` a une contrainte de clé étrangère sur `refinery_id`:

```sql
refinery_id UUID REFERENCES refinery_plants(id) ON DELETE SET NULL
```

Cette contrainte garantit l'intégrité des données en s'assurant que:
- Chaque `refinery_id` dans `shipping_preparations` correspond à un ID valide dans `refinery_plants`
- On ne peut pas référencer une raffinerie qui n'existe pas

### Base de Données Vide

Après la création des tables, les raffineries n'ont pas été ajoutées automatiquement. C'est une bonne pratique de:
1. Créer les structures de tables via migrations
2. Ajouter les données de référence via l'interface ou des seeds SQL

---

## 📊 État des Tables

| Table | Statut | Données |
|-------|--------|---------|
| `refinery_plants` | ✅ Existe | ❌ Vide (à peupler) |
| `refineries` | ✅ Existe | ❌ Vide (à peupler) |
| `shipping_preparations` | ✅ Existe | Prêt après ajout raffineries |

---

## 🛡️ Prévention Future

### Pour Éviter Ce Problème

1. **Seeds de Données de Référence**
   - Créer des migrations qui incluent les données de base
   - Les raffineries sont des données de référence stables

2. **Validation Côté Frontend**
   - Afficher un message si aucune raffinerie n'est disponible
   - Guider l'utilisateur vers la page de configuration

3. **Documentation**
   - Documenter les étapes de configuration initiale
   - Créer un guide de démarrage rapide

---

## 📝 Checklist de Configuration Initiale

Après déploiement d'une nouvelle base de données:

- [ ] Ajouter les raffineries de base
- [ ] Ajouter les mining companies
- [ ] Ajouter les transport companies
- [ ] Configurer les signataires
- [ ] Créer les utilisateurs administrateurs
- [ ] Tester un workflow complet

---

## 🆘 Si Le Problème Persiste

Si après avoir ajouté les raffineries, l'erreur persiste:

1. **Vider le cache du navigateur**
   - Le frontend peut avoir caché les anciennes données

2. **Vérifier les RLS Policies**
   ```sql
   SELECT * FROM refinery_plants;
   ```
   Cette requête doit retourner les 3 raffineries

3. **Vérifier les permissions**
   - L'utilisateur connecté doit avoir les permissions pour lire `refinery_plants`

4. **Réinitialiser la session**
   - Se déconnecter et se reconnecter

---

## ✅ Statut Final

**Une fois les raffineries ajoutées:**
- ✅ Création de shipping preparations fonctionnelle
- ✅ Sélection de raffinerie dans le formulaire
- ✅ Génération de documents avec informations de raffinerie
- ✅ Workflow complet opérationnel

**Action immédiate requise:** Ajouter les 3 raffineries via l'interface ou via SQL.
