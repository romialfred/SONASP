# Guide d'Implémentation: Gestion des Modules et Collecte d'Or

## Date: 27 Décembre 2024

## Vue d'ensemble

Ce document détaille l'implémentation de deux fonctionnalités majeures:
1. **Système de Gestion des Modules** - Permet d'activer/désactiver dynamiquement les fonctionnalités
2. **Module de Collecte et Vente d'Or** - Enregistrement des ventes d'or des artisans miniers

---

## PARTIE 1: Système de Gestion des Modules

### Objectif

Créer un système permettant aux administrateurs de:
- Activer ou désactiver des modules entiers de l'application
- Masquer des modules du menu sans les désactiver
- Gérer la hiérarchie des modules (parents et sous-modules)
- Contrôler dynamiquement ce qui apparaît dans la navigation

### Fichiers Créés

#### 1. Script SQL
**Fichier:** `scripts/CREATE-MODULES-MANAGEMENT-SYSTEM.sql`

**Contenu:**
- Table `snp_modules` avec colonnes:
  - `code` : Identifiant unique du module
  - `nom` : Nom d'affichage
  - `description` : Description
  - `icone` : Nom de l'icône Lucide React
  - `route` : Route principale
  - `parent_id` : Référence au module parent (pour sous-modules)
  - `ordre` : Ordre d'affichage
  - `est_actif` : Si false, module désactivé
  - `est_visible_menu` : Si false, masqué du menu
  - `permissions_requises` : Liste des permissions

- Vue `snp_modules_actifs` : Modules actifs avec hiérarchie
- Fonction `get_user_modules` : Récupère les modules d'un utilisateur
- Insertion automatique de tous les modules existants

**Modules pré-configurés:**
- Dashboard
- Production (avec 4 sous-modules)
- Expédition (avec 3 sous-modules)
- Raffinage
- Ventes (avec 3 sous-modules)
- Clients
- Paiements
- Artisans Miniers (avec 5 sous-modules)
- Analytique
- Administration (avec 5 sous-modules dont "Gestion des Modules")

#### 2. Service TypeScript
**Fichier:** `src/services/modulesService.ts`

**Fonctions principales:**
- `getAll()` : Récupère tous les modules
- `getActive()` : Récupère uniquement les modules actifs
- `getHierarchy()` : Récupère avec structure parent/enfant
- `getActiveHierarchy()` : Hiérarchie des modules actifs uniquement
- `toggleActive(id)` : Active/désactive un module
- `toggleVisibility(id)` : Affiche/masque du menu
- `create()` : Crée un nouveau module
- `update()` : Met à jour un module
- `delete()` : Supprime un module

#### 3. Page d'Administration
**Fichier:** `src/pages/admin/ModulesManagement.tsx`

**Fonctionnalités:**
- Liste tous les modules avec hiérarchie visuelle
- Toggle rapide actif/inactif
- Toggle rapide visible/masqué
- Édition inline des modules
- Badges de statut (Désactivé, Masqué)
- Informations contextuelles
- Design responsive

**Interface:**
```
┌─ Module Parent ─────────────────────────────┐
│ 📊 Production                  [🟢] [👁️] [✏️]│
│ Gestion de la production d'or              │
└────────────────────────────────────────────┘
  ┌─ Sous-module ──────────────────────────┐
  │ 📅 Production Journalière  [🟢] [👁️] [✏️]│
  │ /production/daily                      │
  └────────────────────────────────────────┘
```

### Utilisation

#### Exécution du Script SQL

1. Se connecter à Supabase SQL Editor
2. Ouvrir `scripts/CREATE-MODULES-MANAGEMENT-SYSTEM.sql`
3. Exécuter le script complet
4. Vérifier la création de la table et des données

#### Navigation vers la Page

```
Administration → Gestion des Modules
/admin/modules
```

#### Actions Disponibles

**Activer/Désactiver un Module:**
- Clic sur l'icône ⚡ (Power)
- Effet immédiat sur l'application
- Si parent désactivé, tous les enfants sont inaccessibles

**Afficher/Masquer du Menu:**
- Clic sur l'icône 👁️ (Eye)
- Le module reste actif mais invisible dans la navigation
- Utile pour modules internes ou en développement

**Modifier un Module:**
- Clic sur l'icône ✏️ (Edit)
- Formulaire inline
- Modification du nom, description, icône, route

### Impact sur la Navigation

**Avant:** Navigation statique codée en dur
**Après:** Navigation dynamique basée sur la base de données

Les modules désactivés:
- N'apparaissent plus dans le menu latéral
- Restent accessibles si l'URL est connue (à corriger avec guards de route)
- Conservent leurs données

Les modules masqués:
- Fonctionnent normalement
- N'apparaissent juste pas dans le menu

---

## PARTIE 2: Module de Collecte et Vente d'Or

### Objectif

Créer un système complet pour enregistrer et suivre les ventes d'or achetées aux artisans miniers avec:
- Calcul automatique des taxes (TVA 18%, Taxe dev. communautaire 1%)
- Gestion des différents types d'or (poudre, lingot, pépites, bijoux)
- Suivi de la pureté en karats
- Génération automatique de reçus
- Mise à jour des métriques artisan

### Fichiers Créés

#### 1. Script SQL
**Fichier:** `scripts/CREATE-ARTISAN-GOLD-SALES-COLLECTION.sql`

**Table:** `snp_artisan_ventes_or`

**Colonnes principales:**
- `artisan_id` : Référence à l'artisan
- `date_vente` : Date de la transaction
- `quantite_grammes` : Quantité d'or en grammes
- `type_or` : poudre | lingot | pepites | bijoux | autre
- `purete_karat` : Pureté (18K, 22K, 24K, etc.)
- `prix_kg_fcfa` : Prix au kilogramme
- `montant_brut_fcfa` : Montant avant taxes
- `tva_taux` : 18%
- `tva_montant_fcfa` : Montant TVA calculé
- `taxe_dev_comm_taux` : 1%
- `taxe_dev_comm_montant_fcfa` : Montant taxe calculé
- `montant_total_fcfa` : Total avec taxes
- `numero_recu` : Numéro unique généré automatiquement
- `statut` : en_attente | validee | payee | annulee

**Triggers automatiques:**

1. **Calcul des taxes** (`calculate_vente_or_taxes`)
   - Calcule automatiquement tous les montants
   - Se déclenche à l'INSERT et UPDATE
   - Formules:
     ```
     montant_brut = (quantite_grammes / 1000) * prix_kg_fcfa
     tva = montant_brut * 0.18
     taxe_dev = montant_brut * 0.01
     total = montant_brut + tva + taxe_dev
     ```

2. **Mise à jour métriques artisan** (`update_artisan_metrics_on_vente_or`)
   - Met à jour automatiquement:
     - `quantite_or_vendu_grammes`
     - `chiffre_affaires_fcfa`
     - `nombre_transactions`
     - `derniere_transaction_date`
   - Gère les annulations

3. **Génération numéro de reçu** (`generate_numero_recu_vente_or`)
   - Format: `VENTE/OR/AAAA/MM/NNNN`
   - Exemple: `VENTE/OR/2025/01/0001`
   - Séquence mensuelle

**Vue statistique:** `snp_artisan_ventes_or_stats`
- Agrège les données par artisan
- Nombre de ventes, quantités totales, montants, moyennes
- Répartition par statut

#### 2. Service TypeScript
**Fichier:** `src/services/artisanGoldSalesService.ts`

**Interface:** `ArtisanGoldSale`

**Fonctions principales:**
- `getAll()` : Toutes les ventes
- `getByArtisan(artisanId)` : Ventes d'un artisan spécifique
- `create(sale)` : Enregistre une nouvelle vente
- `update(id, updates)` : Modifie une vente
- `delete(id)` : Supprime une vente
- `updateStatus(id, status)` : Change le statut
- `calculateTaxes(...)` : Calcule les taxes côté client (preview)

**Exemple d'utilisation:**
```typescript
import { artisanGoldSalesService } from '@/services/artisanGoldSalesService';

// Créer une vente
const sale = await artisanGoldSalesService.create({
  artisan_id: 'uuid-de-l-artisan',
  date_vente: '2025-01-27',
  quantite_grammes: 50.5,
  type_or: 'poudre',
  purete_karat: 22,
  prix_kg_fcfa: 28000000, // 28M FCFA/kg
  observations: 'Or de qualité supérieure'
});

// Les taxes sont calculées automatiquement
console.log(sale.montant_total_fcfa); // Avec TVA et taxe dev.
console.log(sale.numero_recu); // VENTE/OR/2025/01/0001
```

### Utilisation du Module

#### 1. Configuration Initiale

**Exécuter le script SQL:**
```sql
-- Dans Supabase SQL Editor
-- Fichier: scripts/CREATE-ARTISAN-GOLD-SALES-COLLECTION.sql
```

**Ajouter le module dans la navigation:**
Le module devra être ajouté manuellement dans la table `snp_modules`:
```sql
DO $$
DECLARE
  artisan_id uuid;
BEGIN
  SELECT id INTO artisan_id FROM snp_modules WHERE code = 'artisan-minier';

  INSERT INTO snp_modules (
    code, nom, description, icone, route,
    parent_id, ordre, est_actif, est_visible_menu
  ) VALUES (
    'artisan-collecte-vente',
    'Collecte & Vente d''Or',
    'Enregistrement des ventes d''or',
    'Coins',
    '/artisan-minier/collecte-vente',
    artisan_id,
    6,
    true,
    true
  );
END $$;
```

#### 2. Créer la Page (À Implémenter)

**Route:** `/artisan-minier/collecte-vente`
**Fichier:** `src/pages/artisan-minier/CollecteVenteOr.tsx` (à créer)

**Structure recommandée:**
```tsx
import { ArtisanMinierFormWithTabs } from '@/components/artisan/...';
import { artisanGoldSalesService } from '@/services/artisanGoldSalesService';

export default function CollecteVenteOr() {
  // État
  const [selectedArtisan, setSelectedArtisan] = useState(null);
  const [formData, setFormData] = useState({
    date_vente: new Date().toISOString().split('T')[0],
    quantite_grammes: 0,
    type_or: 'poudre',
    purete_karat: 24,
    prix_kg_fcfa: 0
  });

  // Calcul preview des taxes
  const preview = artisanGoldSalesService.calculateTaxes(
    formData.quantite_grammes,
    formData.prix_kg_fcfa
  );

  // Soumettre
  const handleSubmit = async () => {
    await artisanGoldSalesService.create({
      artisan_id: selectedArtisan.id,
      ...formData
    });
  };

  return (
    <MainLayout>
      <Card>
        {/* 1. Sélecteur d'artisan */}
        <ArtisanSelector onChange={setSelectedArtisan} />

        {/* 2. Formulaire de vente */}
        <VenteForm data={formData} onChange={setFormData} />

        {/* 3. Aperçu des calculs */}
        <TaxPreview {...preview} />

        {/* 4. Actions */}
        <Button onClick={handleSubmit}>Enregistrer</Button>
      </Card>
    </MainLayout>
  );
}
```

**Champs du formulaire:**
- Date de vente (date picker)
- Quantité en grammes (input number)
- Type d'or (select: Poudre, Lingot, Pépites, Bijoux, Autre)
- Pureté en karats (input number: 18, 22, 24, etc.)
- Prix au kg en FCFA (input number)
- Observations (textarea)

**Aperçu des calculs (lecture seule):**
- Montant brut
- TVA (18%)
- Taxe développement communautaire (1%)
- **Montant total**
- Numéro de reçu (après enregistrement)

### Formules et Calculs

**Conversion grammes → kilogrammes:**
```
kg = grammes / 1000
```

**Montant brut:**
```
montant_brut = (quantite_grammes / 1000) × prix_kg_fcfa
```

**TVA (18%):**
```
tva = montant_brut × 0.18
```

**Taxe de développement communautaire (1%):**
```
taxe_dev = montant_brut × 0.01
```

**Montant total:**
```
total = montant_brut + tva + taxe_dev
```

**Exemple concret:**
```
Quantité: 50 grammes
Prix/kg: 28,000,000 FCFA

Calculs:
- Montant brut = (50 / 1000) × 28,000,000 = 1,400,000 FCFA
- TVA = 1,400,000 × 0.18 = 252,000 FCFA
- Taxe dev. = 1,400,000 × 0.01 = 14,000 FCFA
- Total = 1,400,000 + 252,000 + 14,000 = 1,666,000 FCFA
```

### Intégration avec la Page Détails Artisan

Le module de ventes s'intègre dans la page de détails de l'artisan:

**Route:** `/artisan-minier/:id`

**Onglet "Transactions":**
- Liste des ventes d'or
- Filtresdats, statut
- Totaux et statistiques
- Actions (voir détails, modifier statut)

**Métriques mises à jour automatiquement:**
- Or Vendu (en grammes)
- Chiffre d'Affaires (en FCFA)
- Nombre de Transactions
- Dernière Transaction

---

## Configuration Supabase

### Scripts SQL à Exécuter (Dans l'ordre)

1. ✅ **Modules artisans** (si pas déjà fait)
   ```
   scripts/ADD-ARTISAN-METRICS-COLUMNS.sql
   scripts/CREATE-ARTISAN-TRANSACTIONS-TABLE.sql
   ```

2. ✅ **Système de modules**
   ```
   scripts/CREATE-MODULES-MANAGEMENT-SYSTEM.sql
   ```

3. ✅ **Collecte vente d'or**
   ```
   scripts/CREATE-ARTISAN-GOLD-SALES-COLLECTION.sql
   ```

### Vérifications Post-Installation

**1. Tables créées:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'snp_modules',
  'snp_artisan_ventes_or',
  'snp_artisan_transactions'
);
```

**2. Modules chargés:**
```sql
SELECT code, nom, est_actif, est_visible_menu
FROM snp_modules
ORDER BY ordre;
```

**3. Fonctions créées:**
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%vente_or%';
```

### Politiques RLS

Toutes les tables ont RLS activé avec politiques permettant:
- ✅ SELECT : Tous les utilisateurs authentifiés
- ✅ INSERT : Tous les utilisateurs authentifiés
- ✅ UPDATE : Tous les utilisateurs authentifiés
- ✅ DELETE : Tous les utilisateurs authentifiés

**Note:** À affiner selon les besoins de sécurité

---

## État de l'Implémentation

### ✅ Complété

1. **Système de Gestion des Modules**
   - [x] Script SQL avec table et données
   - [x] Service TypeScript complet
   - [x] Page d'administration fonctionnelle
   - [x] Hiérarchie des modules
   - [x] Toggle actif/inactif
   - [x] Toggle visible/masqué
   - [x] Édition inline

2. **Module de Collecte d'Or - Backend**
   - [x] Script SQL avec table
   - [x] Calcul automatique des taxes (triggers)
   - [x] Génération numéro de reçu
   - [x] Mise à jour métriques artisan
   - [x] Vue statistique
   - [x] Service TypeScript complet
   - [x] Fonctions de calcul

### ⏳ À Compléter

1. **Module de Collecte d'Or - Frontend**
   - [ ] Page de collecte (`/artisan-minier/collecte-vente`)
   - [ ] Sélecteur d'artisan
   - [ ] Formulaire de vente
   - [ ] Aperçu des calculs en temps réel
   - [ ] Validation et soumission
   - [ ] Intégration dans l'onglet Transactions de la page détails

2. **Navigation Dynamique**
   - [ ] Mise à jour du composant Sidebar pour charger depuis la DB
   - [ ] Guards de route basés sur `est_actif`
   - [ ] Actualisation dynamique du menu

3. **Permissions**
   - [ ] Intégration avec le système de permissions
   - [ ] Restriction d'accès selon rôle
   - [ ] Limitation des actions selon permissions

---

## Routes de l'Application

### Routes Existantes (Modules Pré-configurés)

```
/dashboard
/production/daily
/production/in-safe
/production/licenses
/production/budget
/shipping/dashboard
/shipping/new
/documents/assay
/sales/dashboard
/sales/new
/sales/trade-space
/artisan-minier/dashboard
/artisan-minier/liste
/artisan-minier/:id
/artisan-minier/cartes/suivi
/artisan-minier/cartes/validation
/artisan-minier/cartes/expirations
/admin/users
/admin/permissions
/admin/modules          ← NOUVEAU
/admin/settings
/admin/audit
```

### Nouvelles Routes à Ajouter

```
/artisan-minier/collecte-vente    ← À CRÉER
```

---

## Tests et Vérifications

### Test du Système de Modules

1. **Navigation vers la page:**
   ```
   http://localhost:5173/admin/modules
   ```

2. **Désactiver un module:**
   - Clic sur l'icône ⚡ du module "Paiements"
   - Le module devient grisé
   - Badge "Désactivé" apparaît

3. **Masquer un module:**
   - Clic sur l'icône 👁️ du module "Analytique"
   - Badge "Masqué" apparaît
   - Module reste actif mais invisible au menu (après implémentation navigation dynamique)

4. **Modifier un module:**
   - Clic sur ✏️
   - Changer le nom
   - Enregistrer
   - Vérifier l'actualisation

### Test du Module de Vente d'Or

1. **Insertion manuelle (via SQL):**
   ```sql
   INSERT INTO snp_artisan_ventes_or (
     artisan_id, quantite_grammes, type_or,
     purete_karat, prix_kg_fcfa
   )
   SELECT id, 50, 'poudre', 24, 28000000
   FROM snp_artisans_miniers
   LIMIT 1;
   ```

2. **Vérifier le calcul automatique:**
   ```sql
   SELECT
     numero_recu,
     quantite_grammes,
     montant_brut_fcfa,
     tva_montant_fcfa,
     taxe_dev_comm_montant_fcfa,
     montant_total_fcfa
   FROM snp_artisan_ventes_or
   ORDER BY created_at DESC
   LIMIT 1;
   ```

3. **Vérifier la mise à jour des métriques:**
   ```sql
   SELECT
     nom,
     prenoms,
     quantite_or_vendu_grammes,
     chiffre_affaires_fcfa,
     nombre_transactions
   FROM snp_artisans_miniers
   WHERE id = (SELECT artisan_id FROM snp_artisan_ventes_or ORDER BY created_at DESC LIMIT 1);
   ```

---

## Prochaines Étapes Recommandées

### Court Terme (Cette Semaine)

1. **Créer la page de collecte de vente d'or**
   - Fichier: `src/pages/artisan-minier/CollecteVenteOr.tsx`
   - Sélecteur d'artisan avec recherche
   - Formulaire complet avec tous les champs
   - Aperçu calculs en temps réel
   - Validation et soumission

2. **Ajouter le module dans le système**
   ```sql
   -- À exécuter dans Supabase
   INSERT INTO snp_modules ...
   ```

3. **Ajouter la route dans App.tsx**
   ```tsx
   <Route path="/artisan-minier/collecte-vente" element={<CollecteVenteOr />} />
   ```

4. **Intégrer dans l'onglet Transactions**
   - Modifier `src/pages/artisan-minier/ArtisanMinierDetails.tsx`
   - Charger et afficher les ventes d'or
   - Actions (voir, modifier statut)

### Moyen Terme (Prochaines 2 Semaines)

1. **Navigation dynamique**
   - Refactoriser le Sidebar
   - Charger les modules depuis `modulesService.getActiveHierarchy()`
   - Rendre les icônes dynamiques

2. **Guards de route**
   - Vérifier `est_actif` avant d'afficher une route
   - Rediriger si module désactivé

3. **Interface de gestion avancée**
   - Drag & drop pour réorganiser
   - Création de nouveaux modules via l'interface
   - Import/export de configuration

### Long Terme (Prochains Mois)

1. **Permissions granulaires**
   - Lier modules aux permissions
   - Vérifier `permissions_requises`
   - UI de gestion des permissions par module

2. **Historique et audit**
   - Log des changements de statut modules
   - Notifications sur désactivation
   - Rapports d'utilisation

3. **Analytics**
   - Modules les plus utilisés
   - Performance par module
   - Tendances d'utilisation

---

## Support et Dépannage

### Problème: Module ne s'affiche pas après activation

**Solution:**
1. Vérifier dans la DB: `SELECT * FROM snp_modules WHERE code = 'votre-code'`
2. S'assurer que `est_actif = true` ET `est_visible_menu = true`
3. Recharger la page (Ctrl+F5)
4. Si le menu n'est pas encore dynamique, attendre l'implémentation

### Problème: Taxes mal calculées

**Solution:**
1. Vérifier le trigger: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_calculate_vente_or_taxes'`
2. Tester manuellement:
   ```sql
   SELECT calculate_vente_or_taxes();
   ```
3. Vérifier les taux: 18% TVA, 1% taxe dev.
4. Recréer le trigger si nécessaire

### Problème: Métriques artisan non mises à jour

**Solution:**
1. Vérifier le trigger: `trigger_update_artisan_metrics_vente_or`
2. Vérifier que le statut est 'validee' ou 'payee'
3. Recalculer manuellement si nécessaire:
   ```sql
   UPDATE snp_artisans_miniers SET
     quantite_or_vendu_grammes = (
       SELECT COALESCE(SUM(quantite_grammes), 0)
       FROM snp_artisan_ventes_or
       WHERE artisan_id = snp_artisans_miniers.id
       AND statut IN ('validee', 'payee')
     );
   ```

---

## Résumé des Fichiers Créés/Modifiés

### Nouveaux Fichiers

**Scripts SQL:**
1. `scripts/CREATE-MODULES-MANAGEMENT-SYSTEM.sql` - Système de modules
2. `scripts/CREATE-ARTISAN-GOLD-SALES-COLLECTION.sql` - Ventes d'or

**Services:**
1. `src/services/modulesService.ts` - Service modules (remplacé)
2. `src/services/artisanGoldSalesService.ts` - Service ventes or

**Pages:**
1. `src/pages/admin/ModulesManagement.tsx` - Page gestion modules
2. (À créer) `src/pages/artisan-minier/CollecteVenteOr.tsx` - Page collecte

**Documentation:**
1. `scripts/README-MODULES-ET-COLLECTE-OR-IMPLEMENTATION.md` - Ce document

### Fichiers Modifiés

1. `src/pages/admin/UserManagementModern.tsx` - Imports mis à jour

---

## Conclusion

Cette implémentation pose les fondations pour:
1. **Gestion modulaire** de l'application
2. **Collecte systématique** des ventes d'or
3. **Traçabilité complète** des transactions artisans
4. **Calculs automatiques** des taxes

**Statut:** ✅ Backend complet, ⏳ Frontend partiel

**Build:** ✅ Compile sans erreurs

**Tests:** ⏳ À effectuer après déploiement

**Date de dernière mise à jour:** 27 Décembre 2024
**Version:** 2.0.0
