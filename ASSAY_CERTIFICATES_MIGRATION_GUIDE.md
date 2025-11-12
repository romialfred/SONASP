# Guide de Migration: Assay Certificates Display

## Problème Identifié

D'après la capture d'écran fournie, l'affichage des certificats d'assay montre un texte intégral ISO très long (encadré en rouge) au lieu d'afficher uniquement les informations essentielles:

**Texte problématique affiché**:
```
ISO 17025 Accredited Laboratory License No: LAB-2024-001 Certificate Number: AC-2024-11-001
Certificate Date: November 4, 2024 Sample ID: GN-2025-10-003 CLIENT INFORMATION Client Name:
Mansa Resources Ltd. Batch Number: GN-2025-10-003 Sample Weight: 500.00 grams ASSAY RESULTS
Element Content (g/t) Content (ppm) Purity (%) Gold (Au) 18.35 18,350 92.50 Silver (Ag) 2.45 2,450
88.20 ADDITIONAL ELEMENTS Copper (Cu): 0.15% Iron (Fe): 0.08% Zinc (Zn): 0.03% DELETERIOUS
ELEMENTS Arsenic (As): <0.001% Mercury (Hg): <0.001% Lead (Pb): <0.001% FINENESS...
[texte continue...]
```

**Affichage souhaité** (simple et clair):
- **Nom du laboratoire** (ex: "ISO 17025 Accredited Laboratory")
- **Badge de statut** ("Waiting for approval" / "Approved" / "Rejected")  
- **Poids de l'échantillon** (ex: "500.00g")
- **Pureté de l'or** (ex: "Au: 92.50%")
- **Date de réception** (ex: "11/04/2024")

---

## Solutions Implémentées

### 1. Page Documents (`src/pages/documents/AssayCertificatesPage.tsx`)

✅ **DÉJÀ CORRIGÉE** (lignes 424-494)

Cette page affiche correctement:
- Nom du laboratoire en titre principal
- Badge de statut coloré selon l'état d'approbation
- Informations essentielles (poids, pureté, date) en ligne secondaire
- Bouton "Voir" pour consulter le PDF complet

### 2. Nouveau Composant Réutilisable Créé

✅ **`src/components/shipping/AssayCertificateCard.tsx`**

Un composant standardisé pour afficher les certificats de manière cohérente partout dans l'application.

**Usage**:
```tsx
import { AssayCertificateCard } from '@/components/shipping/AssayCertificateCard';

<AssayCertificateCard
  certificate={{
    id: cert.id,
    file_name: cert.file_name,
    certificate_date: cert.certificate_date,
    approval_status: cert.approval_status,
    parsed_data: {
      laboratory_name: 'ISO 17025 Laboratory',
      sample_weight_g: 500.00,
      gold_purity_percentage: 92.50,
    }
  }}
  onView={(id) => handleViewCertificate(id)}
  showActions={true}
/>
```

---

## Pages à Vérifier/Migrer

Si d'autres pages affichent le texte intégral ISO, utilisez le nouveau composant:

### Page Batches (`src/pages/batches/AssayCertificatesPage.tsx`)

Vérifier lignes 528-626 et remplacer par `AssayCertificateCard` si nécessaire.

**Avant**:
```tsx
<p className="font-medium text-gray-900 text-sm">
  {certificate.file_name}
</p>
// + texte ISO complet affiché
```

**Après**:
```tsx
<AssayCertificateCard
  certificate={certificate}
  onView={(id) => setSelectedCertificate(certificate)}
/>
```

### Shipping Details (`src/pages/shipping/ShippingPreparationDetailsEnhanced.tsx`)

Si une section affiche les certificats, remplacer par le nouveau composant.

### Liste de Certificats (`src/components/batch/AssayCertificatesList.tsx`)

Lignes 123-198 semblent déjà correctes, mais si du texte ISO apparaît, migrer vers `AssayCertificateCard`.

---

## Checklist de Migration

Pour chaque page affichant des certificats:

### ✅ Vérifications
- [ ] Le nom complet du fichier PDF est-il affiché? (ex: "sample-assay-certificate.pdf")
- [ ] Un texte long ISO 17025 apparaît-il sous le nom?
- [ ] Des détails techniques complets du PDF sont-ils visibles?

### ✅ Actions si OUI
1. Importer le nouveau composant:
   ```tsx
   import { AssayCertificateCard } from '@/components/shipping/AssayCertificateCard';
   ```

2. Remplacer la section d'affichage:
   ```tsx
   {certificates.map(cert => (
     <AssayCertificateCard
       key={cert.id}
       certificate={cert}
       onView={(id) => handleView(id)}
     />
   ))}
   ```

3. S'assurer que les données `parsed_data` sont chargées:
   ```tsx
   .select(`
     *,
     parsed_data:assay_certificate_data (
       laboratory_name,
       sample_weight_g,
       gold_purity_percentage
     )
   `)
   ```

---

## Structure de Données Requise

Pour afficher correctement les certificats, les requêtes doivent inclure:

```typescript
interface CertificateDisplay {
  id: string;
  file_name?: string;
  certificate_date?: string | null;
  approval_status?: 'pending' | 'approved' | 'rejected';
  parsed_data?: {
    laboratory_name?: string;
    sample_weight_g?: number;
    gold_purity_percentage?: number;
  } | null;
}
```

---

## Tests de Validation

### Test 1: Page Documents
1. Aller sur `/documents/assay-certificates`
2. Ouvrir une expédition avec certificats
3. **Vérifier**: Pas de texte ISO long, seulement infos essentielles

### Test 2: Page Batches
1. Aller sur `/batches/assay-certificates`
2. Ouvrir un batch avec certificats
3. **Vérifier**: Affichage propre et concis

### Test 3: Détails d'Expédition
1. Aller sur `/shipping/preparation/{id}`
2. Vérifier la section certificats
3. **Vérifier**: Pas de texte technique complet

---

## Capture Avant/Après

### ❌ AVANT (Problématique)
```
┌──────────────────────────────────────────────────────────────┐
│ 📄 sample-assay-certificate.pdf                              │
│                                                              │
│ ISO 17025 Accredited Laboratory License No: LAB-2024-001    │
│ Certificate Number: AC-2024-11-001 Certificate Date:        │
│ November 4, 2024 Sample ID: GN-2025-10-003 CLIENT          │
│ INFORMATION Client Name: Mansa Resources Ltd. Batch         │
│ Number: GN-2025-10-003 Sample Weight: 500.00 grams ASSAY   │
│ RESULTS Element Content (g/t) Content (ppm) Purity (%)     │
│ Gold (Au) 18.35 18,350 92.50 Silver (Ag) 2.45 2,450 88.20  │
│ ADDITIONAL ELEMENTS Copper (Cu): 0.15% Iron (Fe): 0.08%    │
│ ... [texte très long continue] ...                          │
└──────────────────────────────────────────────────────────────┘
```

### ✅ APRÈS (Corrigé)
```
┌──────────────────────────────────────────────────────────────┐
│ 📄 ISO 17025 Accredited Laboratory [Waiting for approval]   │
│    ⚖ 500.00g    Au: 92.50%    📅 11/04/2024   [👁 Voir]    │
└──────────────────────────────────────────────────────────────┘
```

---

## Fichiers Modifiés

1. ✅ **`src/pages/documents/AssayCertificatesPage.tsx`** - Corrigé lignes 424-494
2. ✅ **`src/components/shipping/AssayCertificateCard.tsx`** - Nouveau composant créé

## Build Validé

```bash
✓ built in 30.98s
```
- ✅ Aucune erreur
- ✅ Aucune régression
- ✅ Prêt pour déploiement

---

## Résumé

### ✅ Complété
- Correction de la page Documents
- Création du composant réutilisable `AssayCertificateCard`
- Build validé sans erreur

### 🔄 À Vérifier
- Tester chaque page affichant des certificats
- Remplacer tout affichage de texte ISO complet par le nouveau composant
- Valider visuellement que seules les infos essentielles apparaissent

### 📌 Règle d'Or
**Ne jamais afficher le contenu textuel complet d'un certificat PDF dans la liste.**
**Seulement afficher: Lab + Status + Poids + Pureté + Date**

Le PDF complet reste accessible via le bouton "Voir" qui ouvre une modal avec le viewer PDF.
