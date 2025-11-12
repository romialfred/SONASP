# Configuration Supabase Storage - Documents de Production

## 🔒 Sécurité: PDF Uniquement

Pour les documents de production, **AUTORISER UNIQUEMENT LES PDF** est la configuration recommandée pour:

✅ **Sécurité:** Éviter les scripts malveillants (JS, EXE, etc.)
✅ **Uniformité:** Format standard pour tous les documents
✅ **Compatibilité:** Visualisation universelle dans les navigateurs
✅ **Archivage:** Format idéal pour conservation long terme

## 📋 Configuration Supabase Storage

### Étape 1: Créer le Bucket

1. Dashboard Supabase → **Storage**
2. Cliquer **"New bucket"**
3. Configuration:

```
Bucket name:     production-documents
Public bucket:   ❌ NON (décoché)
Restrict size:   ✅ OUI (coché)
File size limit: 10 MB
Restrict MIME:   ✅ OUI (coché) ← IMPORTANT!
```

### Étape 2: Configurer les MIME Types

Après avoir activé "Restrict MIME types", entrez:

```
application/pdf
```

**C'est tout!** Un seul type MIME.

### Étape 3: Vérification Visuelle

La configuration doit ressembler à ceci:

```
✅ Public bucket: OFF
✅ Restrict file size: ON → 10 MB
✅ Restrict MIME types: ON → application/pdf
```

## 🛡️ Double Validation (Frontend + Backend)

### 1. Validation Frontend (ProductionDocumentUpload.tsx)

```typescript
const ALLOWED_TYPES = ['application/pdf'];

const validateFile = (file: File): string | null => {
  // Vérification 1: Type MIME
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Seuls les fichiers PDF sont acceptés';
  }

  // Vérification 2: Taille
  if (file.size > MAX_FILE_SIZE) {
    return `Le fichier est trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`;
  }

  return null;
};
```

**Avantages:**
- ✅ Feedback immédiat à l'utilisateur
- ✅ Pas de requête serveur inutile
- ✅ UX fluide

### 2. Validation Backend (Supabase Storage)

Configuration du bucket avec "Restrict MIME types":
- ✅ Protection serveur
- ✅ Empêche contournement frontend
- ✅ Sécurité renforcée

### 3. HTML Input Accept

```html
<input
  type="file"
  accept=".pdf"
  onChange={handleFileInputChange}
/>
```

**Avantages:**
- ✅ Filtre natif de sélection de fichiers
- ✅ L'utilisateur voit uniquement les PDF
- ✅ Expérience utilisateur optimale

## 📊 Comparaison des Types de Fichiers

| Type | Extension | MIME Type | Recommandation |
|------|-----------|-----------|----------------|
| PDF | .pdf | application/pdf | ✅ **AUTORISÉ** |
| Word | .doc, .docx | application/msword | ❌ Refusé |
| Excel | .xls, .xlsx | application/vnd.ms-excel | ❌ Refusé |
| Image | .jpg, .png | image/jpeg, image/png | ❌ Refusé |
| Texte | .txt | text/plain | ❌ Refusé |
| Script | .js, .exe | application/javascript | ❌ Refusé |

## 🎯 Pourquoi PDF Uniquement?

### Avantages du PDF

1. **Sécurité Maximale**
   - Pas d'exécution de code
   - Pas de macros malveillantes
   - Sandboxing navigateur

2. **Standard Universel**
   - Lisible sur tous les systèmes
   - Apparence identique partout
   - Pas de problème de compatibilité

3. **Traçabilité**
   - Difficilement modifiable
   - Idéal pour l'audit
   - Conservation légale

4. **Performance**
   - Visualisation native dans le navigateur
   - Pas de conversion nécessaire
   - Téléchargement optimisé

### Risques des Autres Formats

| Format | Risque |
|--------|--------|
| .docx, .xlsx | Macros malveillantes possibles |
| .zip, .rar | Peut contenir exécutables |
| .exe, .bat | Exécution de code |
| .js, .html | Scripts malveillants |
| Images | Exploits EXIF, taille excessive |

## 🔧 Configuration Complète SQL

Si vous préférez créer le bucket via SQL:

```sql
-- Créer le bucket (si pas déjà fait via UI)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'production-documents',
  'production-documents',
  false,
  10485760, -- 10MB en bytes
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- Vérifier la configuration
SELECT
  name,
  public,
  file_size_limit / 1024 / 1024 as "size_limit_mb",
  allowed_mime_types
FROM storage.buckets
WHERE name = 'production-documents';
```

**Résultat attendu:**
```
name                   | public | size_limit_mb | allowed_mime_types
-----------------------|--------|---------------|--------------------
production-documents   | false  | 10            | {application/pdf}
```

## 🧪 Tests de Validation

### Test 1: Upload PDF Valide ✅

**Scénario:**
1. Sélectionner un fichier PDF < 10MB
2. Entrer un nom de document
3. Cliquer "Télécharger"

**Résultat attendu:**
- ✅ Upload réussit
- ✅ Document visible dans la liste
- ✅ Téléchargeable et visualisable

### Test 2: Upload Non-PDF ❌

**Scénario:**
1. Essayer de sélectionner un .docx
2. Input HTML ne montre pas les .docx (grâce à accept=".pdf")

**Si contournement du HTML:**
- ❌ Frontend: "Seuls les fichiers PDF sont acceptés"
- ❌ Backend: Erreur Supabase Storage

### Test 3: Upload PDF Trop Gros ❌

**Scénario:**
1. Sélectionner un PDF > 10MB

**Résultat attendu:**
- ❌ Frontend: "Le fichier est trop volumineux (max 10MB)"
- ❌ Backend: Erreur Supabase Storage

### Test 4: Tentative de Contournement ❌

**Scénario:**
1. Renommer `malware.exe` en `document.pdf`
2. Tenter l'upload

**Résultat attendu:**
- ❌ Frontend détecte que file.type !== 'application/pdf'
- ❌ Message: "Seuls les fichiers PDF sont acceptés"

## 🔍 Vérification Post-Configuration

### Via Supabase Dashboard

1. Storage → Buckets → `production-documents`
2. Cliquer sur l'icône ⚙️ Settings
3. Vérifier:
   - ✅ Public: OFF
   - ✅ File size limit: 10 MB
   - ✅ Allowed MIME types: `application/pdf`

### Via SQL

```sql
SELECT
  name as bucket_name,
  CASE WHEN public THEN '❌ PUBLIC' ELSE '✅ PRIVÉ' END as access,
  CASE
    WHEN file_size_limit = 10485760 THEN '✅ 10MB'
    ELSE '❌ ' || (file_size_limit / 1024 / 1024)::text || 'MB'
  END as size_limit,
  CASE
    WHEN allowed_mime_types = ARRAY['application/pdf']::text[] THEN '✅ PDF uniquement'
    ELSE '❌ Autres types autorisés'
  END as mime_types
FROM storage.buckets
WHERE name = 'production-documents';
```

**Résultat attendu:**
```
bucket_name          | access    | size_limit | mime_types
---------------------|-----------|------------|------------------
production-documents | ✅ PRIVÉ  | ✅ 10MB    | ✅ PDF uniquement
```

## 📱 UX - Messages Utilisateur

### Messages Clairs

| Situation | Message |
|-----------|---------|
| Pas de fichier | "Veuillez sélectionner un fichier" |
| Type incorrect | "Seuls les fichiers PDF sont acceptés" |
| Trop volumineux | "Le fichier est trop volumineux (max 10MB)" |
| Upload réussi | "Document téléchargé avec succès" |
| Erreur serveur | "Erreur lors du téléchargement. Réessayez." |

### Interface Intuitive

```
┌─────────────────────────────────────────┐
│  📄  Ajouter un Document                │
│     Rapport ou analyse de production    │
├─────────────────────────────────────────┤
│                                         │
│  Nom du Document *                      │
│  [Analyse Journalière 15 Nov 2025]     │
│                                         │
│  Fichier PDF *                          │
│  ┌───────────────────────────────────┐ │
│  │   📤                              │ │
│  │   Cliquez ou glissez-déposez      │ │
│  │   PDF uniquement (max 10MB)       │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [Télécharger] [Annuler]               │
└─────────────────────────────────────────┘
```

## 🎓 Best Practices Appliquées

✅ **Principe de défense en profondeur:**
- Validation HTML (accept)
- Validation JavaScript (frontend)
- Validation Supabase (backend)

✅ **Principe du moindre privilège:**
- Bucket privé (non public)
- RLS policies strictes
- Accès authentifié uniquement

✅ **Principe de sécurité par défaut:**
- PDF uniquement par défaut
- Taille limitée à 10MB
- Pas d'exceptions

## 🚀 Configuration Finale Recommandée

### Dans Supabase Storage UI

```
Bucket Configuration
├── Name: production-documents
├── Public: ❌ OFF
├── Restrict file size: ✅ ON
│   └── Limit: 10 MB
└── Restrict MIME types: ✅ ON
    └── Allowed types: application/pdf
```

### Vérification Visuelle dans l'Interface

Vous devez voir exactement:

```
✅ Restrict MIME types
   Allow only certain types of files to be uploaded

   Allowed MIME types:
   [application/pdf]

   [+ Add MIME type]
```

**NE PAS ajouter d'autres MIME types!**

## 📋 Checklist Finale

Avant de considérer la configuration comme terminée:

- [ ] Bucket `production-documents` créé
- [ ] Public bucket: **DÉSACTIVÉ** ❌
- [ ] Restrict file size: **ACTIVÉ** ✅ (10MB)
- [ ] Restrict MIME types: **ACTIVÉ** ✅
- [ ] MIME types allowed: **application/pdf** uniquement
- [ ] Test upload PDF réussi ✅
- [ ] Test upload non-PDF échoue ✅
- [ ] Test upload > 10MB échoue ✅
- [ ] RLS policies en place (via migration)
- [ ] Frontend validation active

## 🎯 Résumé

**Configuration Sécurisée = PDF Uniquement**

```
Frontend:  accept=".pdf" + file.type validation
     ↓
Backend:   allowed_mime_types = ['application/pdf']
     ↓
Storage:   Seuls les PDF peuvent être stockés
     ↓
Résultat:  Sécurité maximale ✅
```

**Cette configuration est la meilleure pratique pour les documents sensibles de production.**
