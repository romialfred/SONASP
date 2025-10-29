# Field Guide Panel - Améliorations Complètes

## Vue d'Ensemble

Le panneau de guide des champs a été complètement repensé pour devenir un véritable guide interactif qui aide les utilisateurs à remplir les formulaires correctement.

## Avant vs Après

### ❌ AVANT (Liste Simple)

```
┌─────────────────────────────────┐
│ 🔵 Field Guide                  │
├─────────────────────────────────┤
│                                 │
│ All Fields                      │
│ ───────────────────             │
│ * Company Name                  │
│ * Company Code                  │
│ * Country                       │
│   Address                       │
│   City                          │
│   Postal Code                   │
│ * Contact Person                │
│ * Contact Email                 │
│                                 │
│ 💡 Tip: * = required            │
└─────────────────────────────────┘
```

**Problèmes:**
- ❌ Juste une liste de noms de champs
- ❌ Pas de description ni d'exemples
- ❌ Pas de guidage pour l'utilisateur
- ❌ Pas de contexte

### ✅ APRÈS (Guide Complet avec Sections)

```
┌──────────────────────────────────────────────┐
│ 🔵 Field Guide                               │
├──────────────────────────────────────────────┤
│ Guide détaillé des champs du formulaire     │
│ avec descriptions et exemples.              │
│                                              │
│ ┌──────────────────────────────────────┐   │
│ │ COMPANY INFORMATION      [Bleu clair]│   │
│ ├──────────────────────────────────────┤   │
│ │ ┌──────────────────────────────────┐ │   │
│ │ │ Company Name / Nom de la Société │ │   │
│ │ │ [Requis]                         │ │   │
│ │ │                                  │ │   │
│ │ │ Nom officiel complet de la       │ │   │
│ │ │ société minière tel              │ │   │
│ │ │ qu'enregistré légalement         │ │   │
│ │ │                                  │ │   │
│ │ │ ┌──────────────────────────────┐ │ │   │
│ │ │ │ Ex: Essakane Mine Site SA    │ │ │   │
│ │ │ └──────────────────────────────┘ │ │   │
│ │ └──────────────────────────────────┘ │   │
│ │                                      │   │
│ │ ┌──────────────────────────────────┐ │   │
│ │ │ Company Code / Code Société      │ │   │
│ │ │ [Requis]                         │ │   │
│ │ │                                  │ │   │
│ │ │ Code d'identification unique...  │ │   │
│ │ │                                  │ │   │
│ │ │ Ex: ESSAKANE_BF                  │ │   │
│ │ │                                  │ │   │
│ │ │ • Doit être unique               │ │   │
│ │ │ • Pas d'espaces                  │ │   │
│ │ │ • Utiliser majuscules            │ │   │
│ │ └──────────────────────────────────┘ │   │
│ └──────────────────────────────────────┘   │
│                                              │
│ ┌──────────────────────────────────────┐   │
│ │ CONTACT INFORMATION     [Vert clair] │   │
│ ├──────────────────────────────────────┤   │
│ │ [Champs de contact avec détails...]  │   │
│ └──────────────────────────────────────┘   │
│                                              │
│ ┌──────────────────────────────────────┐   │
│ │ ADDITIONAL INFORMATION [Ambre clair] │   │
│ ├──────────────────────────────────────┤   │
│ │ [Informations supplémentaires...]    │   │
│ └──────────────────────────────────────┘   │
│                                              │
│ 💡 Astuce: Les champs marqués "Requis"      │
│    doivent être remplis avant soumettre     │
└──────────────────────────────────────────────┘
```

**Avantages:**
- ✅ Descriptions complètes en français et anglais
- ✅ Exemples concrets pour chaque champ
- ✅ Règles de validation claires
- ✅ Sections avec couleurs différentes
- ✅ Badge "Requis" visible
- ✅ Guidage contextuel

## Structure des Sections

### 1️⃣ Company Information (Fond Bleu Clair)
```
┌────────────────────────────────────────┐
│ COMPANY INFORMATION        [bg-blue-50]│
├────────────────────────────────────────┤
│ • Company Name / Nom de la Société     │
│   → Nom officiel complet...            │
│   → Ex: Essakane Mine Site SA          │
│                                        │
│ • Company Code / Code Société          │
│   → Code d'identification unique...    │
│   → Ex: ESSAKANE_BF                    │
│   → Règles: unique, majuscules...      │
│                                        │
│ • Country / Pays                       │
│   → Pays où la société est enregistrée │
│   → Ex: Guinea, Mali, Burkina Faso     │
│                                        │
│ • Address / Adresse                    │
│ • City / Ville                         │
│ • Postal Code / Code Postal            │
└────────────────────────────────────────┘
```

### 2️⃣ Contact Information (Fond Vert Clair)
```
┌────────────────────────────────────────┐
│ CONTACT INFORMATION      [bg-green-50] │
├────────────────────────────────────────┤
│ • Contact Person / Personne de Contact │
│   → Nom complet du responsable...      │
│   → Ex: Mamadou Diallo                 │
│                                        │
│ • Contact Email / Email de Contact     │
│   → Adresse email professionnelle...   │
│   → Ex: m.diallo@essakane.com          │
│                                        │
│ • Contact Phone / Téléphone            │
│   → Numéro avec indicatif pays...      │
│   → Ex: +224 622 123 456               │
│                                        │
│ • Website / Site Web                   │
│   → Site web officiel (optionnel)      │
│   → Ex: https://www.miningcompany.com  │
└────────────────────────────────────────┘
```

### 3️⃣ Additional Information (Fond Ambre Clair)
```
┌────────────────────────────────────────┐
│ ADDITIONAL INFORMATION   [bg-amber-50] │
├────────────────────────────────────────┤
│ • Default Currency / Devise par Défaut │
│   → Devise préférée pour transactions  │
│   → Ex: USD, EUR, GNF                  │
│                                        │
│ • Tax ID / Numéro Fiscal               │
│   → Numéro d'identification fiscale    │
│   → Ex: NIF-123456789                  │
│                                        │
│ • Registration Number                  │
│   → Numéro d'enregistrement commercial │
│   → Ex: RCCM-GN-2023-A-12345           │
└────────────────────────────────────────┘
```

## Détails des Champs

### Company Name / Nom de la Société [REQUIS]
**Description:** Nom officiel complet de la société minière tel qu'enregistré légalement

**Exemple:** Essakane Mine Site SA

**Utilisation:**
- Utilisé dans tous les documents officiels
- Doit correspondre au nom sur les licences minières
- Apparaît sur les factures et contrats

---

### Company Code / Code Société [REQUIS]
**Description:** Code d'identification unique pour la société (utilisé dans les rapports et transactions)

**Exemple:** ESSAKANE_BF

**Règles de validation:**
- ✓ Doit être unique dans le système
- ✓ Pas d'espaces autorisés
- ✓ Utiliser des lettres majuscules
- ✓ Peut contenir des underscores (_)

**Utilisation:**
- Référence rapide dans les batches
- Filtrage dans les rapports
- Identification dans les exports

---

### Country / Pays [REQUIS]
**Description:** Pays où la société est enregistrée et opère

**Exemples:** Guinea, Mali, Burkina Faso, Liberia, Senegal, Ghana

**Pays disponibles:**
- 🇬🇳 Guinea (Guinée)
- 🇲🇱 Mali
- 🇨🇮 Côte d'Ivoire
- 🇱🇷 Liberia
- 🇸🇳 Senegal
- 🇬🇭 Ghana
- 🇧🇫 Burkina Faso
- 🇫🇷 France
- 🇦🇪 UAE
- 🇿🇦 South Africa

---

### Address / Adresse
**Description:** Adresse physique complète du siège social ou du site minier

**Exemple:** Zone industrielle de Kaloum, Rue KA-028

**Format recommandé:**
```
[Nom du bâtiment/zone]
[Numéro et nom de rue]
[Quartier/District]
```

---

### Contact Person / Personne de Contact [REQUIS]
**Description:** Nom complet de la personne responsable principale (directeur, responsable des opérations)

**Exemple:** Mamadou Diallo

**Rôles acceptables:**
- Directeur Général
- Directeur des Opérations
- Responsable du Site
- Chef de Production

---

### Contact Email / Email de Contact [REQUIS]
**Description:** Adresse email professionnelle de la personne de contact

**Exemple:** m.diallo@essakane.com

**Format requis:**
- Email valide avec @ et domaine
- De préférence email professionnel de la société
- Éviter les emails personnels (gmail, yahoo, etc.)

---

### Contact Phone / Téléphone
**Description:** Numéro de téléphone direct de la personne de contact (avec indicatif pays)

**Exemple:** +224 622 123 456

**Format recommandé:**
```
+[code pays] [numéro local]
```

**Codes pays courants:**
- +224 (Guinea)
- +223 (Mali)
- +225 (Côte d'Ivoire)
- +231 (Liberia)
- +221 (Senegal)
- +233 (Ghana)
- +226 (Burkina Faso)

---

### Default Currency / Devise par Défaut
**Description:** Devise préférée pour les transactions commerciales avec cette société

**Exemples:**
- USD (Dollar américain) - Recommandé pour international
- EUR (Euro)
- GNF (Franc guinéen)
- XOF (Franc CFA)
- AED (Dirham)
- ZAR (Rand sud-africain)
- GHS (Cedi ghanéen)

**Utilisation:**
- Utilisée par défaut dans les contrats de vente
- Affichée dans les rapports financiers
- Peut être modifiée pour des transactions spécifiques

---

### Tax ID / Numéro Fiscal
**Description:** Numéro d'identification fiscale attribué par les autorités locales

**Exemple:** NIF-123456789

**Formats par pays:**
- Guinea: NIF-XXXXXXXXX
- Mali: NIF-XXXXXXXXX
- Burkina Faso: IFU-XXXXXXXXX

---

### Registration Number / Numéro d'Enregistrement
**Description:** Numéro d'enregistrement commercial de la société

**Exemple:** RCCM-GN-2023-A-12345

**Formats par pays:**
- Guinea: RCCM-GN-YYYY-X-XXXXX
- Mali: RCCM-ML-YYYY-X-XXXXX
- Burkina Faso: RCCM-BF-YYYY-X-XXXXX

---

## Codes Couleur des Sections

| Section | Couleur | Classe CSS | Utilisation |
|---------|---------|------------|-------------|
| **Company Information** | Bleu clair | `bg-blue-50` | Informations de base sur la société |
| **Contact Information** | Vert clair | `bg-green-50` | Coordonnées et contacts |
| **Bank Information** | Violet clair | `bg-purple-50` | Comptes bancaires (si applicable) |
| **Additional Information** | Ambre clair | `bg-amber-50` | Informations administratives |

## Fonctionnalités Techniques

### 1. Regroupement Automatique par Section
```typescript
function groupGuidesBySection(guides: FieldGuideItem[]): FieldGuideSection[] {
  // Regroupe automatiquement les champs par leur propriété 'section'
  // Applique les couleurs appropriées
  // Trie par ordre logique
}
```

### 2. Support de Sections Personnalisées
```typescript
// Option 1: Définir la section dans chaque FieldGuideItem
const guide = {
  field: 'name',
  label: 'Company Name',
  section: 'Company Information'  // ← Regroupement automatique
};

// Option 2: Passer des sections prédéfinies
<FieldGuidePanel
  sections={[
    {
      title: 'Company Information',
      color: 'bg-blue-50',
      fields: [...]
    }
  ]}
/>
```

### 3. Scroll Automatique
- Le panneau a un scroll interne: `max-h-[calc(100vh-200px)] overflow-y-auto`
- Position sticky: `sticky top-6`
- Reste visible pendant le remplissage du formulaire

### 4. Responsive Design
- Adapté pour les écrans larges (lg:col-span-1)
- Se déplace en bas sur mobile
- Conserve la lisibilité sur tous les écrans

## Avantages pour les Utilisateurs

### 1. Gain de Temps
- ✅ Plus besoin de deviner le format
- ✅ Exemples concrets fournis
- ✅ Règles de validation claires
- ✅ Moins d'erreurs de saisie

### 2. Meilleure Compréhension
- ✅ Descriptions en français ET anglais
- ✅ Contexte d'utilisation expliqué
- ✅ Exemples localisés (Essakane, Mamadou, etc.)
- ✅ Codes pays africains inclus

### 3. Réduction des Erreurs
- ✅ Format attendu clairement indiqué
- ✅ Règles de validation visibles avant saisie
- ✅ Champs requis clairement marqués
- ✅ Exemples réalistes

### 4. Expérience Professionnelle
- ✅ Interface organisée et claire
- ✅ Couleurs douces et professionnelles
- ✅ Information accessible sans surcharge
- ✅ Guide toujours visible

## Exemples de Descriptions Améliorées

### Comparaison: Description Basique vs Enrichie

#### AVANT (Basique)
```
Company Name
Full legal name of the mining company
Example: Acme Gold Mining Ltd
```

#### APRÈS (Enrichie)
```
Company Name / Nom de la Société [REQUIS]

Nom officiel complet de la société minière 
tel qu'enregistré légalement

📝 Exemple: Essakane Mine Site SA

ℹ️ Utilisation:
• Utilisé dans tous les documents officiels
• Doit correspondre au nom sur les licences
• Apparaît sur les factures et contrats
```

**Amélioration:**
- ✅ Bilingue (FR/EN)
- ✅ Contexte d'utilisation
- ✅ Exemple local africain
- ✅ Badge requis visible

## Tests et Validation

### Test 1: Vérifier l'Affichage des Sections
1. Ouvrir le formulaire "Ajouter une Société Minière"
2. Regarder le panneau de droite
3. ✅ Devrait voir 3 sections colorées:
   - COMPANY INFORMATION (bleu)
   - CONTACT INFORMATION (vert)
   - ADDITIONAL INFORMATION (ambre)

### Test 2: Vérifier les Descriptions
1. Lire la description du champ "Company Name"
2. ✅ Devrait voir:
   - Label bilingue
   - Description en français
   - Exemple: "Essakane Mine Site SA"
   - Badge "Requis"

### Test 3: Vérifier les Règles de Validation
1. Chercher le champ "Company Code"
2. ✅ Devrait voir les règles:
   - Doit être unique
   - Pas d'espaces
   - Utiliser majuscules

### Test 4: Vérifier le Scroll
1. Scroller vers le bas dans le panneau guide
2. ✅ Devrait scroller indépendamment du formulaire
3. ✅ Devrait rester "collé" en haut (sticky)

## Migration vers d'Autres Formulaires

Ce nouveau design peut être appliqué à d'autres formulaires:

### Formulaires à Migrer:
1. ✅ **Mining Companies Form** - FAIT
2. ⏳ **Freight Companies Form** - À faire
3. ⏳ **Refinery Plants Form** - À faire
4. ⏳ **Customer Form** - À faire
5. ⏳ **Batch Creation Form** - À faire
6. ⏳ **Sales Form** - À faire

### Template de Migration:
```typescript
// 1. Définir les sections de champs
const fieldGuides: FieldGuideItem[] = [
  {
    field: 'field_name',
    label: 'Label FR/EN',
    description: 'Description détaillée en français',
    example: 'Exemple local et pertinent',
    required: true,
    rules: ['Règle 1', 'Règle 2'],
    section: 'Section Name'  // ← Important!
  },
  // ... autres champs
];

// 2. Utiliser dans le composant
<FieldGuidePanel
  title="Field Guide"
  guides={fieldGuides}
  currentField={undefined}  // Toujours afficher tout
/>
```

## Fichiers Modifiés

### 1. src/components/ui/FieldGuidePanel.tsx
**Changements majeurs:**
- Ajout de `FieldGuideSection` interface
- Fonction `groupGuidesBySection()` pour regroupement auto
- Nouveau rendu avec sections colorées
- Support des descriptions détaillées
- Scroll interne avec max-height
- Design avec cartes blanches sur fonds colorés

### 2. src/pages/stakeholders/MiningCompanyForm.tsx
**Changements majeurs:**
- Descriptions enrichies en français/anglais
- Exemples localisés (Essakane, Mamadou, etc.)
- Ajout de la propriété `section` à chaque champ
- Règles de validation explicites
- Contexte d'utilisation pour champs importants

## Performance

- ✅ Pas d'impact sur les performances
- ✅ Rendu statique (pas de state complexe)
- ✅ Scroll virtuel non nécessaire (liste courte)
- ✅ Composant léger et réutilisable

## Accessibilité

- ✅ Contraste de couleurs conforme WCAG
- ✅ Texte lisible (min 12px)
- ✅ Structure sémantique (h3 pour sections)
- ✅ Navigation clavier possible
- ✅ Scroll-able au clavier

## Conclusion

Le nouveau Field Guide Panel transforme une simple liste de champs en un véritable assistant de saisie qui guide les utilisateurs pas à pas avec:

- 📝 Descriptions détaillées bilingues
- 💡 Exemples concrets et localisés
- 🎨 Organisation visuelle par sections colorées
- ✅ Règles de validation claires
- 🌍 Contexte africain et local

**Résultat:** Formulaires plus faciles à remplir, moins d'erreurs, meilleure expérience utilisateur!
