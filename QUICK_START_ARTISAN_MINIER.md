# 🚀 Quick Start - Module Artisan Minier

## 3 Étapes pour Activer le Module

---

## Étape 1: Appliquer la Migration SQL ⚡

### Option A: Via fichier préparé

1. Le fichier SQL est déjà prêt: `/tmp/artisan_minier_migration.sql`

2. **Copier le contenu:**
   ```bash
   cat /tmp/artisan_minier_migration.sql
   ```

3. **Dans Supabase Dashboard:**
   - Aller sur https://supabase.com/dashboard
   - Sélectionner votre projet SONASP
   - Cliquer sur **SQL Editor** (dans le menu gauche)
   - Créer une nouvelle query
   - Coller le contenu du fichier
   - Cliquer **RUN** ou **Ctrl+Enter**

4. **Vérifier:**
   ```sql
   -- Dans SQL Editor, exécuter:
   SELECT tablename FROM pg_tables
   WHERE schemaname = 'public'
   AND tablename LIKE 'SNP_%';
   ```

   **Résultat attendu: 5 tables**
   - SNP_artisans_miniers
   - SNP_cartes_professionnelles
   - SNP_artisan_documents
   - SNP_artisan_activities
   - SNP_carte_statistics

---

## Étape 2: Créer le Bucket Storage 📁

### Dans Supabase Dashboard > Storage:

1. Cliquer sur **Storage** dans le menu
2. Cliquer **New bucket**
3. Configurer:
   ```
   Name: artisan-documents
   Public bucket: ✅ Oui (coché)
   Allowed MIME types: image/jpeg, image/png, application/pdf
   File size limit: 5 MB
   ```
4. Cliquer **Create bucket**

### Ajouter les Policies:

Dans **Storage** > **Policies** > **artisan-documents**:

```sql
-- 1. Lecture publique
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'artisan-documents');

-- 2. Upload authentifié
CREATE POLICY "Authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'artisan-documents');

-- 3. Suppression authentifiée
CREATE POLICY "Authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'artisan-documents');
```

---

## Étape 3: Ajouter la Route 🛣️

### Dans `src/App.tsx`:

Ajouter l'import en haut du fichier:

```typescript
import ArtisanMinierDashboard from '@/pages/artisan-minier/ArtisanMinierDashboard';
```

Ajouter la route dans le Router:

```typescript
// Dans les routes protégées (après <ProtectedRoute>)
<Route path="/artisan-minier" element={<ArtisanMinierDashboard />} />
```

---

## ✅ Vérification Finale

### 1. Redémarrer l'application
```bash
npm run dev
```

### 2. Ouvrir dans le navigateur
```
http://localhost:5173
```

### 3. Vérifier la navigation
- ✅ Ouvrir la sidebar
- ✅ Voir **"Artisans Miniers"** EN HAUT (avant "Gestion de la Collecte")
- ✅ Couleur verte pour l'icône
- ✅ 6 sous-menus visibles

### 4. Accéder au dashboard
- Cliquer sur **"Artisans Miniers"** > **"Tableau de Bord"**
- Voir le dashboard avec:
  - 4 cartes de statistiques
  - 3 cartes de statuts
  - Actions rapides
  - Barre de recherche

---

## 🎯 Test Rapide

### Créer un artisan de test (SQL):

```sql
INSERT INTO SNP_artisans_miniers (
  numero_carte, -- Auto-généré par trigger
  type_personne,
  type_artisan,
  nom,
  prenoms,
  telephone,
  adresse_complete,
  region
) VALUES (
  '', -- Sera auto-généré
  'physique',
  'exploitant',
  'TRAORE',
  'Jean',
  '+223 70 00 00 00',
  'Gaoua, Région du Sud-Ouest',
  'Région du Sud-Ouest'
);
```

### Vérifier la création automatique de la carte:

```sql
-- Voir l'artisan créé avec son numéro auto-généré
SELECT numero_carte, nom, prenoms, type_artisan
FROM SNP_artisans_miniers
ORDER BY created_at DESC
LIMIT 1;

-- Voir la carte créée automatiquement
SELECT
  numero_carte,
  statut,
  date_delivrance,
  date_expiration,
  numero_securite
FROM SNP_cartes_professionnelles
ORDER BY created_at DESC
LIMIT 1;
```

**Résultat attendu:**
- Artisan avec numéro: `SONASP/AM/2025/000001`
- Carte créée automatiquement avec:
  - Statut: `en_cours`
  - Date expiration: +1 an
  - Numéro sécurité: 10 chiffres

---

## 🎨 Personnalisation

### Changer les couleurs dans la navigation:

Dans `AccordionSidebar.tsx`, le groupe artisan-minier:

```typescript
{
  id: 'artisan-minier',
  label: t('nav.artisanMinier'),
  groupIconColor: 'text-emerald-700', // Changer ici
  groupIcon: Users,
  items: [
    {
      label: t('nav.artisanDashboard'),
      path: '/artisan-minier',
      icon: LayoutDashboard,
      iconColor: 'text-emerald-700' // Et ici
    },
    // ...
  ],
}
```

### Ajouter des traductions supplémentaires:

Dans `src/i18n/locales/fr/common.json`:

```json
{
  "artisanMinier": {
    "titre": "Artisans Miniers",
    "description": "Gestion complète des artisans miniers",
    "enregistrer": "Enregistrer un artisan",
    "rechercher": "Rechercher un artisan",
    // ... ajouter vos traductions
  }
}
```

---

## 📝 Prochaines Étapes Suggérées

### Court terme (1-2 jours):
1. ✅ Tester le dashboard
2. ✅ Créer quelques artisans de test
3. ✅ Vérifier la génération des numéros de carte
4. ✅ Tester les statistiques

### Moyen terme (1 semaine):
1. Créer le formulaire d'enregistrement complet
2. Implémenter la prévisualisation de carte temps réel
3. Créer la page liste des artisans
4. Ajouter la validation des cartes

### Long terme (2-4 semaines):
1. Créer toutes les pages (6 pages restantes)
2. Implémenter le workflow complet
3. Ajouter les notifications automatiques
4. Créer les rapports et exports
5. Formation des utilisateurs
6. Déploiement en production

---

## 🆘 Dépannage

### La migration échoue?

**Vérifier:**
1. Connexion à Supabase active
2. Permissions SQL (doit être owner)
3. Pas d'autres tables SNP_ existantes

**Solution:**
```sql
-- Supprimer les tables existantes si nécessaire
DROP TABLE IF EXISTS SNP_carte_statistics CASCADE;
DROP TABLE IF EXISTS SNP_artisan_activities CASCADE;
DROP TABLE IF EXISTS SNP_artisan_documents CASCADE;
DROP TABLE IF EXISTS SNP_cartes_professionnelles CASCADE;
DROP TABLE IF EXISTS SNP_artisans_miniers CASCADE;

-- Puis réexécuter la migration
```

### Le menu n'apparaît pas?

**Vérifier:**
1. Traductions ajoutées dans `common.json` (FR et EN)
2. Imports des icônes dans `AccordionSidebar.tsx`
3. Application redémarrée
4. Cache navigateur vidé (Ctrl+F5)

### La route ne fonctionne pas?

**Vérifier:**
1. Import de `ArtisanMinierDashboard` dans `App.tsx`
2. Route ajoutée dans les routes protégées
3. Chemin exact: `/artisan-minier`
4. Console pour erreurs

---

## 📊 Données de Test Complètes

```sql
-- Insérer 3 artisans de test
INSERT INTO SNP_artisans_miniers (
  numero_carte,
  type_personne,
  type_artisan,
  nom,
  prenoms,
  telephone,
  adresse_complete,
  region
) VALUES
(
  '',
  'physique',
  'exploitant',
  'TRAORE',
  'Jean',
  '+223 70 00 00 01',
  'Gaoua, Sud-Ouest',
  'Région du Sud-Ouest'
),
(
  '',
  'physique',
  'collecteur',
  'DIARRA',
  'Aminata',
  '+223 70 00 00 02',
  'Sikasso',
  'Région de Sikasso'
),
(
  '',
  'morale',
  'intermediaire',
  NULL,
  NULL,
  '+223 70 00 00 03',
  'Bamako',
  'District de Bamako'
);

-- Mettre à jour la raison sociale pour la personne morale
UPDATE SNP_artisans_miniers
SET raison_sociale = 'OR DU MALI SARL'
WHERE type_personne = 'morale';
```

### Vérifier les statistiques:

```sql
SELECT
  COUNT(*) as total_artisans,
  COUNT(CASE WHEN type_artisan = 'exploitant' THEN 1 END) as exploitants,
  COUNT(CASE WHEN type_artisan = 'collecteur' THEN 1 END) as collecteurs,
  COUNT(CASE WHEN type_artisan = 'intermediaire' THEN 1 END) as intermediaires
FROM SNP_artisans_miniers;
```

---

## ✨ Résultat Final

Après ces 3 étapes, vous aurez:

✅ **Module opérationnel**
- Dashboard avec statistiques
- Navigation verte intégrée
- Base de données complète
- Génération automatique de cartes

✅ **Prêt pour:**
- Enregistrer des artisans
- Générer des cartes professionnelles
- Suivre les activités
- Gérer les expirations

✅ **Architecture robuste:**
- 5 tables SNP_ créées
- Triggers automatiques
- RLS activé
- Services TypeScript complets

---

**Temps d'installation: ~15 minutes**

**Questions? Consultez:**
- `MODULE_ARTISAN_MINIER_GUIDE.md` - Guide complet
- `MODULE_ARTISAN_MINIER_IMPLEMENTATION.md` - Détails techniques
- Services TypeScript - Documentation dans le code

---

**🎉 Félicitations! Le module Artisan Minier est maintenant actif!**
