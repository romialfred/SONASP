# Guide de Test - Génération de Documents PDF

## 🎯 Objectif
Tester la génération automatique des documents PDF (Bullion Summary et Invoice) dans le module Invoice & Consignment.

---

## ✅ Étape 1: Configuration de Supabase Storage

### 1.1 Accéder au SQL Editor de Supabase
1. Ouvrez votre projet Supabase
2. Allez dans l'onglet **SQL Editor**
3. Créez une nouvelle query

### 1.2 Exécuter le script de configuration
1. Ouvrez le fichier `SETUP_FREIGHT_DOCUMENTS_BUCKET.sql`
2. Copiez tout le contenu
3. Collez dans le SQL Editor de Supabase
4. Cliquez sur **Run** ou **Ctrl+Enter**

### 1.3 Vérifier la création du bucket
Vous devriez voir en résultat:
```
status                        | id                  | name                | public
Bucket créé avec succès      | freight-documents   | freight-documents   | true

status                        | policy_count
Politiques RLS configurées    | 4
```

Si vous voyez ces résultats, le bucket est correctement configuré !

---

## ✅ Étape 2: Préparer les Données de Test

### 2.1 Vérifier votre expédition existante
Vous devez avoir au moins une expédition dans Invoice & Consignment avec:
- ✅ Des productions incluses (barres d'or)
- ✅ Des signataires définis
- ✅ Une date d'expédition
- ✅ Un prix de l'or et un taux de change

**Exemple:** Votre expédition `HUM-SMK-001/2025` devrait déjà avoir toutes ces données.

---

## ✅ Étape 3: Tester la Génération

### 3.1 Accéder à la page de détails
1. Démarrez l'application: `npm run dev`
2. Connectez-vous à l'application
3. Allez dans **Invoice & Consignment** (menu latéral)
4. Cliquez sur votre expédition `HUM-SMK-001/2025`

### 3.2 Générer les documents
1. Dans la section **"Documents Générés"**, vous verrez:
   - Un titre "Documents Générés"
   - Un bouton bleu **"Générer les Documents"**
   - Le message "Aucun document généré" (car les docs n'existent pas encore)

2. Cliquez sur le bouton **"Générer les Documents"**

3. Observez:
   - Le bouton affiche "Génération..." avec un spinner
   - Une notification apparaît: "Génération en cours - Création des documents PDF..."
   - Après quelques secondes (3-5 secondes):
     - Notification de succès: "Documents générés - Bullion Summary et Invoice générés avec succès !"
     - La page se recharge automatiquement

4. Vérifiez les documents:
   - Vous devriez maintenant voir **2 documents** dans la liste:
     - 📄 **Bullion Summary** (fond amber/doré)
     - 📄 **Invoice** (fond vert émeraude)
   - Chaque document a:
     - Un bouton **œil** (👁️) pour visualiser
     - Un bouton **télécharger** (⬇️) pour sauvegarder

---

## ✅ Étape 4: Visualiser les Documents

### 4.1 Visualiser le Bullion Summary
1. Cliquez sur le bouton **œil** du Bullion Summary
2. Une fenêtre modale s'ouvre avec le PDF en plein écran
3. Vérifiez le contenu:
   - ✅ Logo et titre "BULLION SUMMARY"
   - ✅ Report Date et Shipment Number
   - ✅ Tableau avec toutes vos barres:
     - Bar No., Date Poured, Date Shipped
     - Poids en grammes, Finesse or et argent (%)
     - Contenu or et argent (g et oz)
     - Valeur en USD
   - ✅ Ligne de totaux (fond gris)
   - ✅ Section signatures avec Position, Name, Signature
4. Fermez la fenêtre modale

### 4.2 Visualiser l'Invoice
1. Cliquez sur le bouton **œil** de l'Invoice
2. Une fenêtre modale s'ouvre avec le PDF
3. Vérifiez le contenu:
   - ✅ Titre "INVOICE - POUR BESOINS DE LA DOUANE"
   - ✅ Shipment Date et Invoice Number
   - ✅ Section "From" (Expéditeur): LA SOCIÉTÉ DES MINES DE KOMANA
   - ✅ Section "Shipped to" (Raffinerie destinataire)
   - ✅ Pays d'Origine: Mali
   - ✅ Mine: Komana Gold Mine
   - ✅ Tableau principal avec:
     - AWB #, Lot #, Nombre de boîtes
     - Type de boîtes, Description
     - Poids net (kg), Poids (Troy Oz)
     - Prix métal (CFA/kg), Valeur estimée (CFA)
   - ✅ Taux de change FCFA/USD
   - ✅ Total prix CFA et US$
4. Fermez la fenêtre modale

### 4.3 Télécharger les documents
1. Cliquez sur le bouton **télécharger** (⬇️) de chaque document
2. Les fichiers se téléchargent:
   - `bullion-summary-HUM-SMK-001-2025.pdf`
   - `customs-invoice-HUM-SMK-001-2025.pdf`
3. Ouvrez les PDF avec votre lecteur PDF pour vérifier la qualité

---

## ✅ Étape 5: Vérifier dans Supabase

### 5.1 Vérifier le Storage
1. Dans Supabase, allez dans **Storage**
2. Cliquez sur le bucket **freight-documents**
3. Vous devriez voir un dossier avec l'ID de votre expédition
4. À l'intérieur, vous trouverez les 2 PDF:
   - `bullion-summary-HUM-SMK-001-2025.pdf`
   - `customs-invoice-HUM-SMK-001-2025.pdf`

### 5.2 Vérifier la base de données
1. Dans Supabase, allez dans **Table Editor**
2. Sélectionnez la table **freight_shipments**
3. Trouvez votre expédition `HUM-SMK-001/2025`
4. Vérifiez les colonnes:
   - `bullion_summary_pdf_path`: doit contenir une URL publique
   - `customs_invoice_pdf_path`: doit contenir une URL publique

Les URLs devraient ressembler à:
```
https://[votre-projet].supabase.co/storage/v1/object/public/freight-documents/[id-expedition]/bullion-summary-HUM-SMK-001-2025.pdf
```

---

## ✅ Étape 6: Tester la Régénération

### 6.1 Régénérer les documents
1. Sur la page de détails de l'expédition
2. **Le bouton "Générer les Documents" a disparu** car les documents existent déjà
3. Pour régénérer, vous devez d'abord supprimer les documents existants dans Supabase Storage
4. Ou modifier le code pour afficher un bouton "Régénérer"

### 6.2 Option: Ajouter un bouton de régénération
Si vous voulez pouvoir régénérer les documents, modifiez le code pour afficher le bouton même si les docs existent:

```typescript
// Dans FreightShipmentDetails.tsx, ligne 590
// Remplacer:
{(!shipment.bullion_summary_pdf_path || !shipment.customs_invoice_pdf_path) && (

// Par:
{(
  <Button
    onClick={handleGenerateDocuments}
    disabled={generatingDocs}
    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
  >
```

Cela affichera toujours le bouton, permettant la régénération.

---

## 🎨 Personnalisation des Documents

### Logo et En-tête
Les documents utilisent actuellement des en-têtes textuels:
```
LA SOCIÉTÉ DES MINES DE KOMANA
HUMMINGBIRD RESOURCES
```

Pour ajouter votre logo:
1. Ouvrez `src/services/freightInvoiceGenerationService.ts`
2. Cherchez les lignes avec `doc.text('LA SOCIÉTÉ...')`
3. Remplacez par `doc.addImage(votre_logo, 'PNG', x, y, width, height)`

### Informations Expéditeur
Pour modifier l'adresse de l'expéditeur:
1. Ouvrez `src/pages/freight/FreightShipmentDetails.tsx`
2. Cherchez la ligne 149: `senderName: 'LA SOCIÉTÉ DES MINES DE KOMANA'`
3. Modifiez les informations selon vos besoins

---

## 🐛 Résolution de Problèmes

### Erreur: "Bucket not found"
**Cause:** Le bucket Supabase n'a pas été créé
**Solution:** Exécutez le script `SETUP_FREIGHT_DOCUMENTS_BUCKET.sql` dans Supabase

### Erreur: "Row Level Security policy violation"
**Cause:** Les politiques RLS ne sont pas configurées
**Solution:** Réexécutez le script SQL de configuration

### Erreur: "Cannot read property 'productions' of undefined"
**Cause:** L'expédition n'a pas de productions associées
**Solution:** Créez une nouvelle expédition avec des productions

### Le bouton "Générer les Documents" ne s'affiche pas
**Cause:** Les documents existent déjà
**Solution:** C'est normal ! Le bouton disparaît une fois les docs générés. Pour régénérer, supprimez d'abord les fichiers dans Storage.

### Les PDF sont vides ou mal formatés
**Cause:** Données manquantes (signataires, productions, etc.)
**Solution:** Vérifiez que votre expédition a toutes les données nécessaires

### Erreur: "Failed to upload PDF"
**Cause:** Problème de connexion Supabase ou permissions
**Solution:**
1. Vérifiez votre connexion Internet
2. Vérifiez que les clés Supabase dans `.env` sont correctes
3. Vérifiez les politiques RLS dans Supabase Storage

---

## ✅ Checklist Finale

- [ ] Bucket `freight-documents` créé dans Supabase Storage
- [ ] Politiques RLS configurées (4 policies)
- [ ] Application démarrée avec `npm run dev`
- [ ] Accès à une expédition avec données complètes
- [ ] Bouton "Générer les Documents" visible et cliquable
- [ ] Génération réussie avec notification de succès
- [ ] Bullion Summary visible et téléchargeable
- [ ] Invoice visible et téléchargeable
- [ ] Documents présents dans Supabase Storage
- [ ] URLs enregistrées dans la base de données

---

## 🎉 Prochaines Étapes

Une fois que tout fonctionne:

1. **Génération Automatique:** Modifier `FreightShipmentCreate.tsx` pour générer automatiquement les documents lors de la création d'une expédition

2. **Packing List & Consignment Note:** Implémenter la génération des 2 autres documents (déjà prévus dans la structure)

3. **Emails:** Ajouter l'envoi automatique des PDF par email aux parties prenantes

4. **Signatures Électroniques:** Permettre aux signataires de signer électroniquement les documents

5. **Historique:** Conserver un historique des versions de documents générées

---

## 📞 Support

Si vous rencontrez des problèmes non couverts par ce guide, vérifiez:
- Les logs de la console du navigateur (F12 > Console)
- Les logs de Supabase (Supabase Dashboard > Logs)
- Le fichier `FREIGHT_PDF_GENERATION_STATUS.md` pour plus de détails techniques

**La génération de PDF est maintenant opérationnelle ! 🎊**
