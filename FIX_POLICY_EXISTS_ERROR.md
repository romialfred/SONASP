# ERROR: must be owner of table objects - SOLUTION

================================================================================
POURQUOI CETTE ERREUR?
================================================================================

L'erreur "must be owner of table objects" arrive parce que:

❌ Vous ne pouvez PAS créer des storage policies via SQL Editor
❌ Les policies de storage nécessitent des permissions spéciales
✅ Vous DEVEZ utiliser l'interface Dashboard de Supabase

================================================================================
SOLUTION: MÉTHODE DASHBOARD (LA SEULE QUI MARCHE)
================================================================================

Basé sur votre screenshot, voici les étapes EXACTES:

## OPTION 1: Via Configuration Sidebar (Recommandé)

1. Dans votre screenshot, vous êtes sur: Storage → assay-certificates
2. Regardez la SIDEBAR GAUCHE
3. Scrollez vers le bas si nécessaire
4. Vous devriez voir une section "CONFIGURATION"
5. Sous CONFIGURATION, cliquez sur "Policies"
6. Cliquez "New Policy"
7. Remplissez le formulaire (voir ci-dessous)

## OPTION 2: Via le Menu Three Dots

Si vous ne voyez pas "CONFIGURATION":

1. Dans la liste des buckets (sidebar gauche)
2. Trouvez "assay-certificates"
3. À côté du nom, il y a trois points (•••) ou un menu
4. Cliquez dessus
5. Cherchez "Policies" ou "Configuration"

## OPTION 3: Via Storage Settings

1. En haut à droite de votre écran
2. Vous voyez: Reload | View | Upload files | Create folder
3. Cherchez un icône de Settings/Configuration (⚙️)
4. Ou cherchez un menu dropdown
5. Devrait avoir une option "Policies"

================================================================================
FORMULAIRE À REMPLIR (Une fois dans Policies)
================================================================================

Une fois que vous trouvez la page "Policies":

1. Cliquez "New Policy"
2. Cliquez "For full customization" 
3. Remplissez:

┌────────────────────────────────────────────────┐
│ Policy name:                                   │
│ Allow authenticated users all operations       │
├────────────────────────────────────────────────┤
│ Allowed operation: ALL                         │
├────────────────────────────────────────────────┤
│ Target roles: authenticated                    │
├────────────────────────────────────────────────┤
│ USING expression:                              │
│ bucket_id = 'assay-certificates'               │
├────────────────────────────────────────────────┤
│ WITH CHECK expression:                         │
│ bucket_id = 'assay-certificates'               │
└────────────────────────────────────────────────┘

4. Cliquez "Save Policy"

================================================================================
ALTERNATIVE: CRÉER LE BUCKET VIA CODE (SI VRAIMENT BLOQUÉ)
================================================================================

Si vous ne trouvez vraiment pas l'interface Policies, on peut créer
le bucket ET la policy via l'API Supabase Management.

Mais d'abord, essayez de trouver l'interface dans le Dashboard!

================================================================================
VÉRIFICATION: Est-ce que le bucket existe déjà?
================================================================================

Votre screenshot montre que "assay-certificates" existe déjà. ✅

Maintenant il faut juste ajouter la policy via l'interface Dashboard.

================================================================================
SCREENSHOT GUIDE
================================================================================

Dans votre screenshot actuel, vous voyez:

SIDEBAR GAUCHE:
├── Storage
├── + New bucket
├── Search buckets...
│
├── ALL BUCKETS
│   ├── documents
│   ├── reports
│   ├── payment-proofs
│   └── assay-certificates (sélectionné avec cercle rouge)
│
└── CONFIGURATION  ← Cherchez cette section!
    ├── Policies   ← Cliquez ici!
    └── Settings

Si vous ne voyez pas "CONFIGURATION":
→ Scrollez vers le bas dans la sidebar
→ Ou cliquez sur l'icône Settings en haut

================================================================================
DERNIÈRE OPTION: CONTACTEZ VOTRE ADMIN
================================================================================

Si vous ne trouvez toujours pas l'interface Policies:

1. Vérifiez vos permissions Supabase
2. Peut-être que vous n'êtes pas "Owner" du projet
3. Contactez l'administrateur du projet Supabase
4. Demandez-lui de:
   - Vous donner les permissions "Owner"
   - OU créer la policy pour vous

================================================================================
RÉSUMÉ
================================================================================

❌ SQL Editor ne marche PAS pour les storage policies
✅ Utilisez l'interface Dashboard → Storage → Policies
✅ Cherchez la section "CONFIGURATION" dans la sidebar gauche
✅ Ou demandez à l'admin du projet de créer la policy

================================================================================
