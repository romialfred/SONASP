# 🚀 Guide Rapide - Module Artisan Minier

## ✅ TOUT EST PRÊT!

### 1. Corrections Appliquées
- ✅ Menu corrigé (plus de "Nouvel Artisan" dans le menu)
- ✅ Bouton "Nouvel Artisan" déplacé dans la page Liste
- ✅ Formulaire en panneau latéral (pas de modale)
- ✅ Champs regroupés par nature avec codes couleurs
- ✅ Design professionnel et ergonomique
- ✅ Build réussi sans erreurs

### 2. Fichier de Migration
📄 **Emplacement**: `supabase/migrations/26122025_01_artisan_minier_migration.sql`
📊 **Taille**: 14 KB (417 lignes)

---

## 🎯 UNE SEULE ÉTAPE RESTANTE

### Appliquer la migration SQL dans Supabase (3 minutes):

1. **Ouvrez Supabase Dashboard**
   - https://supabase.com → Votre projet

2. **SQL Editor**
   - Cliquez sur "SQL Editor" dans le menu
   - Cliquez sur "New Query"

3. **Copiez-Collez**
   - Ouvrez: `supabase/migrations/26122025_01_artisan_minier_migration.sql`
   - Copiez TOUT (417 lignes)
   - Collez dans l'éditeur SQL
   - Cliquez **"Run"**

4. **Vérifiez**
   - Allez dans "Table Editor"
   - Vous devriez voir 5 nouvelles tables SNP_*

---

## 📊 Ce Qui Sera Créé

### 5 Tables:
1. ✅ **SNP_artisans_miniers** - Données artisans (physique/morale)
2. ✅ **SNP_cartes_professionnelles** - Cartes avec statuts
3. ✅ **SNP_artisan_documents** - Documents (photo, CNI)
4. ✅ **SNP_artisan_activities** - Activités/transactions
5. ✅ **SNP_carte_statistics** - Statistiques

### Automatisations:
- 🔄 Génération auto numéro: **SONASP/AM/2025/000001**
- 🔄 Création auto de la carte professionnelle
- 🔄 Mise à jour auto des statistiques
- 🔄 Timestamps automatiques

### Sécurité:
- 🔒 RLS activé sur toutes les tables
- 🔒 Policies pour authenticated users
- 🔒 Contraintes de données

---

## 🎨 Navigation du Module

```
Menu Artisan Minier
│
├── 📊 Tableau de bord           (/artisan-minier)
│   └── Statistiques et alertes
│
├── 👥 Liste des Artisans        (/artisan-minier/liste) ⭐ NOUVEAU
│   └── Bouton "Nouvel Artisan" → Panneau latéral
│
├── 📈 Suivi des Cartes          (/artisan-minier/cartes/suivi)
│   └── Statistiques d'activité
│
├── ✅ Validation Cartes         (/artisan-minier/cartes/validation)
│   └── Workflow de validation
│
└── ⚠️ Expirations               (/artisan-minier/cartes/expirations)
    └── Suivi des dates d'expiration
```

---

## 📝 Formulaire d'Enregistrement

Le formulaire s'ouvre en **panneau latéral** (pas de modale) avec sections colorées:

### 🟢 Informations Générales
- Type de personne (physique/morale)
- Type d'artisan (exploitant/collecteur/intermédiaire/fournisseur)

### 🔵 Identité
- Nom, prénoms (si physique)
- Raison sociale (si morale)
- Date/lieu naissance, sexe, nationalité

### 🟣 Coordonnées
- Téléphone (requis), Email
- Adresse, Commune, Région

### 🟠 Pièce d'Identité
- Type (CNI/Passeport/Permis/Autre)
- Numéro, dates de délivrance/expiration
- Lieu de délivrance

### 📝 Observations
- Notes additionnelles

---

## 🧪 Test Après Migration

1. **Rechargez l'application** (F5)
2. Menu → **"Gestion des Artisans Miniers"**
3. Cliquez → **"Liste des Artisans"**
4. Cliquez → Bouton vert **"Nouvel Artisan"** (en haut à droite)
5. Le panneau latéral s'ouvre!
6. Remplissez les champs obligatoires (*)
7. Cliquez → **"Enregistrer l'artisan"**
8. L'artisan est créé avec numéro auto-généré!

---

## ⚙️ Fonctionnalités Implémentées

### ✅ Prêt à l'emploi:
- Enregistrement artisans (physique/morale)
- 4 types d'artisans
- Formulaire en panneau latéral
- Champs groupés et validés
- Recherche et filtrage
- Navigation fluide
- Design moderne

### ⏳ Après migration SQL:
- Auto-génération numéro de carte
- Création automatique carte professionnelle
- Statistiques temps réel
- Workflow de validation
- Suivi des expirations

---

## ❓ FAQ

### Q: Je vois encore "We hit a snag"?
**R**: La migration SQL n'a pas encore été appliquée. Suivez les étapes ci-dessus.

### Q: Le panneau latéral ne s'ouvre pas?
**R**: Vérifiez la console du navigateur (F12). Si erreur 404, appliquez la migration.

### Q: Comment vérifier que la migration a fonctionné?
**R**: Dans Supabase → SQL Editor, exécutez:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'SNP_%';
```
Vous devriez voir 5 tables.

### Q: Puis-je modifier les champs du formulaire?
**R**: Oui! Le formulaire est dans `src/pages/artisan-minier/ArtisanMinierListe.tsx`

---

## 📞 Structure des Fichiers

```
src/pages/artisan-minier/
├── ArtisanMinierDashboard.tsx   → Tableau de bord
├── ArtisanMinierListe.tsx       → Liste + Formulaire panneau latéral ⭐
├── CarteSuivi.tsx               → Suivi des cartes
├── CarteValidation.tsx          → Validation
└── CarteExpirations.tsx         → Expirations

supabase/migrations/
└── 26122025_01_artisan_minier_migration.sql  → Migration à appliquer ⭐
```

---

## 🎉 Après la Migration

L'application sera 100% fonctionnelle:
1. ✅ Enregistrement d'artisans
2. ✅ Génération auto des numéros de carte
3. ✅ Création auto des cartes professionnelles
4. ✅ Recherche et filtrage
5. ✅ Statistiques temps réel
6. ✅ Workflow complet

**Bon déploiement!** 🚀
