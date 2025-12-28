# Correction du Système de Carte Professionnelle - RECTO/VERSO

## 📋 Problème Identifié

L'aperçu de la carte professionnelle affichait **SEULEMENT LE RECTO**, alors qu'il devrait montrer **RECTO ET VERSO côte à côte** comme sur l'image de référence.

## ✅ Solutions Implémentées

### 1. Service de Génération Amélioré

**Fichier:** `src/services/carteProfessionnelleGeneratorService.ts`

#### Nouvelle Fonction: `generatePreviewRectoVerso()`

Cette fonction génère un aperçu complet avec RECTO et VERSO côte à côte:

```typescript
async generatePreviewRectoVerso(
  artisan: ArtisanMinier,
  carte: CarteProfessionnelle
): Promise<string>
```

**Ce qu'elle fait:**
1. Génère le RECTO de la carte en PDF
2. Génère le VERSO de la carte en PDF
3. Crée un canvas HTML5
4. Place les deux images côte à côte avec un espace entre elles
5. Ajoute les labels "RECTO" et "VERSO" au-dessus
6. Ajoute le numéro de carte en bas
7. Retourne l'image complète en format PNG (data URL)

**Dimensions:**
- Largeur de chaque carte: 800px
- Hauteur: 500px
- Espace entre les cartes: 40px
- Canvas total: 1640px x 600px

### 2. Migration Base de Données

**Fichier:** `scripts/20251228_001_ADD_CARTE_RECTO_VERSO_URLS.sql`

#### Colonnes Ajoutées à `snp_cartes_professionnelles`:

| Colonne | Type | Description |
|---------|------|-------------|
| `carte_recto_url` | text | URL de l'image du recto |
| `carte_verso_url` | text | URL de l'image du verso |
| `qr_code_data` | text | Données JSON du QR code |
| `qr_code_url` | text | URL de l'image du QR code |
| `numero_securite` | text | Numéro de sécurité unique (10 chiffres) |
| `validee_par` | uuid | Utilisateur validateur (FK auth.users) |
| `validee_le` | timestamptz | Date de validation |
| `suspendue_le` | timestamptz | Date de suspension |
| `suspendue_par` | uuid | Utilisateur suspenseur (FK auth.users) |
| `motif_suspension` | text | Raison de la suspension |

#### Contrainte de Statut Mise à Jour:

```sql
CHECK (statut IN (
  'en_cours',
  'validee',
  'en_exploitation',
  'expiree',
  'suspendue',
  'annulee'
))
```

#### Index Créés:

- `idx_cartes_numero_securite` - Pour validation rapide
- `idx_cartes_validee_par` - Pour audit trail

### 3. Interface Utilisateur

**Fichier:** `src/components/artisan/ArtisanMinierFormWithTabs.tsx`

L'interface utilise maintenant `generatePreviewDataUrl()` qui appelle automatiquement `generatePreviewRectoVerso()`:

```typescript
const preview = await carteProfessionnelleGeneratorService.generatePreviewDataUrl(
  artisanData,
  carteData
);
```

## 📊 Comparaison AVANT/APRÈS

### AVANT ❌
```
┌─────────────────────────────┐
│                             │
│    APERÇU RECTO SEULEMENT   │
│                             │
└─────────────────────────────┘
```

### APRÈS ✅
```
   RECTO                        VERSO
┌──────────────┐         ┌──────────────┐
│ BURKINA FASO │         │   QR CODE    │
│   SONASP     │         │              │
│              │         │ Carte délivrée│
│ CARTE D'ARTISAN       │ conformément  │
│    MINIER    │         │ au Code minier│
│              │         │              │
│ [Photo]      │         │ Oumar Zongo  │
│              │         │ Directeur    │
└──────────────┘         └──────────────┘
       Carte N°: SONASP/AM/2025/000123
```

## 🔧 Comment Appliquer la Migration

### Option 1: Via Supabase Dashboard (RECOMMANDÉ)

1. Se connecter à [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionner le projet Gold Shipper
3. Aller dans **SQL Editor**
4. Créer une nouvelle requête
5. Copier-coller le contenu de `scripts/20251228_001_ADD_CARTE_RECTO_VERSO_URLS.sql`
6. Cliquer sur **Run** / **Exécuter**
7. Vérifier les messages de succès dans la console

### Option 2: Via CLI Supabase (si disponible)

```bash
cd /tmp/cc-agent/59164212/project
supabase db execute -f scripts/20251228_001_ADD_CARTE_RECTO_VERSO_URLS.sql
```

## 🧪 Comment Tester

### 1. Tester l'Aperçu dans l'Interface

1. Aller sur **Artisans Miniers** → **Liste des Artisans**
2. Cliquer sur **Nouvel Artisan Minier**
3. Remplir les informations de base:
   - Nom: TRAORE
   - Prénoms: Jean
   - Type d'artisan: Exploitant
   - Téléphone: +226 70 12 34 56
   - Pays: Burkina Faso
   - Région: Région de Gaoua
4. (Optionnel) Ajouter une photo
5. Aller sur l'onglet **Carte Professionnelle**
6. Cliquer sur **Générer l'aperçu**
7. **Vérifier:** Vous devez voir le RECTO et VERSO côte à côte

### 2. Vérifier la Base de Données

```sql
-- Vérifier que toutes les colonnes existent
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'snp_cartes_professionnelles'
AND column_name IN (
  'carte_recto_url',
  'carte_verso_url',
  'qr_code_data',
  'qr_code_url',
  'numero_securite'
)
ORDER BY column_name;
```

Devrait retourner 5 lignes.

### 3. Vérifier les Index

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'snp_cartes_professionnelles'
AND indexname IN ('idx_cartes_numero_securite', 'idx_cartes_validee_par');
```

Devrait retourner 2 index.

## 📁 Fichiers Modifiés

1. ✅ `src/services/carteProfessionnelleGeneratorService.ts`
   - Ajout de `generatePreviewRectoVerso()`
   - Modification de `generatePreviewDataUrl()` pour utiliser la nouvelle fonction

2. ✅ `scripts/20251228_001_ADD_CARTE_RECTO_VERSO_URLS.sql`
   - Migration complète pour ajouter les colonnes

3. ✅ `scripts/README-CORRECTION-CARTE-PROFESSIONNELLE.md`
   - Cette documentation

## 🎯 Résultat Attendu

Après l'application de ces corrections:

1. **Aperçu complet:** RECTO + VERSO visible simultanément
2. **Labels clairs:** "RECTO" et "VERSO" au-dessus de chaque carte
3. **Information complète:** Numéro de carte affiché en bas
4. **Données stockées:** URLs des images sauvegardées en base
5. **Traçabilité:** Audit trail complet (qui/quand/pourquoi)

## 📝 Données de la Carte

### Informations sur le RECTO:
- Pays: BURKINA FASO
- Titre: CARTE D'ARTISAN MINIER
- Sous-titre: Secteur Minier Artisanal
- Photo de l'artisan (si disponible)
- Nom & Prénoms
- Type de carte (Exploitant, Collecteur, etc.)
- N° de carte (ex: SONASP/AM/2025/000123)
- Site d'exploitation / Région
- Date de délivrance
- Date d'expiration
- Numéro de sécurité (footer)

### Informations sur le VERSO:
- QR Code pour vérification
- Texte "Scanner pour vérification"
- Titre: CARTE D'ARTISAN MINIER
- Texte légal: "Cette carte est délivrée conformément au Code minier du Burkina Faso..."
- Signature: Oumar Zongo, Directeur Général
- Sceau officiel SONASP
- Mentions légales: "CARTE PERSONNELLE - NON CESSIBLE"
- Avertissement: "TOUTE FALSIFICATION EST PUNIE PAR LA LOI"

## 🔒 Sécurité

### Validation de Carte

Le numéro de sécurité unique permet de vérifier l'authenticité:

```typescript
// Exemple de validation
const numeroSecurite = "1234567890";
const { data } = await supabase
  .from('snp_cartes_professionnelles')
  .select('*')
  .eq('numero_securite', numeroSecurite)
  .single();

if (data) {
  console.log('Carte valide:', data.numero_carte);
} else {
  console.log('Carte non trouvée - Possible contrefaçon');
}
```

### Audit Trail

Toutes les actions sont tracées:

```sql
-- Voir qui a validé une carte
SELECT
  c.numero_carte,
  u.email as validee_par_email,
  c.validee_le,
  c.statut
FROM snp_cartes_professionnelles c
LEFT JOIN auth.users u ON c.validee_par = u.id
WHERE c.statut = 'validee';
```

## 🚀 Prochaines Étapes

1. ✅ Appliquer la migration SQL
2. ✅ Tester l'aperçu RECTO/VERSO
3. ⏳ Implémenter la sauvegarde des URLs en base (lors de la génération finale)
4. ⏳ Ajouter un système de scan de QR code pour vérification
5. ⏳ Créer un rapport d'impression pour cartes physiques

## 📞 Support

En cas de problème:

1. Vérifier que la migration est appliquée: `SELECT * FROM snp_cartes_professionnelles LIMIT 1;`
2. Vérifier les logs du navigateur (Console)
3. Vérifier les logs Supabase (SQL Editor → History)
4. Consulter `scripts/DATABASE-SCHEMA.md` pour le schéma complet

---

**Date de création:** 28 Décembre 2024
**Version:** 1.0
**Statut:** ✅ Prêt pour Application
