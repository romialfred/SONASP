# 🔧 PLAN DE CORRECTION COMPLET - Assay Certificates

## 🐛 PROBLÈMES IDENTIFIÉS

### 1. **Code du Service est INCORRECT**
Le fichier `assayCertificateService.ts` (lignes 360-378) essaie d'écrire dans des colonnes qui **N'EXISTENT PAS** dans la table `assay_certificates`:

**Colonnes qui N'EXISTENT PAS:**
- `sample_id` ❌
- `sample_weight_grams` ❌
- `gold_content_ppm` ❌
- `gold_content_gpt` ❌
- `gold_content_percent` ❌
- `silver_content_ppm` ❌
- `silver_content_gpt` ❌
- `silver_content_percent` ❌
- `platinum_content_ppm` ❌
- `palladium_content_ppm` ❌
- `fineness` ❌
- `purity_percent` ❌

**Ces colonnes existent SEULEMENT dans `assay_certificate_data`!**

### 2. **Fausses Données Hardcodées**
Le fichier `BatchDetails.tsx` (lignes 200-215) contient des fausses données hardcodées pour la section "Documents".

### 3. **Section Assay Certificates existe déjà!**
Les lignes 454-474 de `BatchDetails.tsx` contiennent déjà la section Assay Certificates correcte!

---

## ✅ SOLUTIONS

### Solution 1: Corriger le Service

Supprimer les lignes 359-379 qui font l'UPDATE incorrect:

```typescript
// SUPPRIMER CE CODE:
await supabase
  .from('assay_certificates')
  .update({
    certificate_number: assayData.certificateNumber,
    issuing_laboratory: assayData.laboratoryName,
    certificate_date: assayData.certificateDate,
    sample_id: assayData.sampleId, // ❌ N'existe pas
    sample_weight_grams: assayData.sampleWeight, // ❌ N'existe pas
    // ... etc
  })
  .eq('id', certificateId);
```

**REMPLACER PAR:**
```typescript
// UPDATE seulement les colonnes qui existent dans assay_certificates
await supabase
  .from('assay_certificates')
  .update({
    certificate_number: assayData.certificateNumber,
    issuing_laboratory: assayData.laboratoryName,
    certificate_date: assayData.certificateDate,
    parsing_status: 'completed',
    parsed_at: new Date().toISOString()
  })
  .eq('id', certificateId);
```

### Solution 2: Supprimer les Fausses Données

Supprimer les lignes 200-215 de `BatchDetails.tsx`:

```typescript
// SUPPRIMER CE BLOC:
const documents = [
  {
    id: '1',
    name: 'Initial Quality Report.pdf',
    // ...
  },
  // ...
];
```

### Solution 3: Vérifier la DB

Exécuter le SQL de diagnostic pour vérifier si:
1. Les tables existent
2. Le bucket existe
3. Les policies existent

---

## 📋 ÉTAPES À SUIVRE

### Étape 1: Exécuter le Diagnostic SQL
```sql
-- Dans Supabase SQL Editor
SELECT table_name, COUNT(*) as columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('assay_certificates', 'assay_certificate_data')
GROUP BY table_name;
```

### Étape 2: Corriger le Code
Je vais corriger les fichiers maintenant.

### Étape 3: Tester
1. Refresh l'app
2. Aller dans Batch Details
3. Essayer d'uploader un PDF

---

## 🎯 RÉSULTAT ATTENDU

Après les corrections:
- ✅ Section "Assay Certificates" visible dans Batch Details
- ✅ Upload d'un PDF fonctionne
- ✅ Parsing automatique se lance
- ✅ Certificate apparaît dans la liste
- ✅ Pas de section "Documents" hardcodée

