# Preuves bancaires privées — LOT 2L

## Contrat runtime

- Bucket `payment-proofs` privé, sans policy d'écriture client.
- Formats admis : PDF, JPEG et PNG, 10 MiB maximum. Le gateway contrôle le
  nom, l'extension, le MIME déclaré et les magic bytes avant Storage.
- Chemin objet : `<payment_id>/<idempotency_key>.<extension>` ; la base stocke
  uniquement la référence canonique
  `payment-proofs/<payment_id>/<idempotency_key>.<extension>`.
- La RPC `snp_paiement_preuve_rattacher` dérive la vente, le client et l'acteur.
  Elle exige session active, AAL2, `sonasp.finance.execute`, paiement
  `processing`, vente `virtual_payment`, exécuteur JWT exact et vendeur SONASP
  actif.
- Le SHA-256, le nom sûr, le paiement, la clé d'idempotence et l'acteur sont
  inscrits par l'Edge dans `storage.objects.user_metadata`. La RPC confronte
  exactement ces valeurs aux paramètres : un appel `authenticated` direct ne
  peut donc pas falsifier l'empreinte ou le nom d'audit.
- Des verrous advisory transactionnels sur le paiement et la clé sérialisent
  les rattachements concurrents. Un rejeu identique rend la ligne existante ;
  un contenu différent échoue fermé.
- La lecture exige la vente autoritative et une capacité finance execute ou
  reconcile. L'URL signée expire après 300 secondes.
- L'approbation 4H exige simultanément la metadata 1:1, les deux références
  canoniques sur payment/sale et l'objet Storage exact (MIME et taille inclus).
- Quatre policies Storage `RESTRICTIVE` empêchent une policy permissive
  générique ultérieure d'ouvrir le bucket en lecture ou en écriture.

## Reprise et rapprochement

- `snp_paiements_preuve_reprise_lister()` n'accepte aucun identifiant acteur :
  elle dérive le JWT et ne rend que les paiements `processing` exécutés par cet
  acteur dont la metadata ou l'objet exact manque.
- Sans metadata, le navigateur génère une nouvelle clé de preuve. Si la
  metadata a été commise mais que l'objet manque, la clé existante est
  obligatoirement réutilisée avec le même fichier.
- Après une réponse RPC ambiguë, l'Edge relit la metadata avec le service-role
  en lecture seule. Une ligne exacte confirme le succès ; une absence ou une
  ligne différente rend le refus certain et permet le nettoyage de l'objet
  nouvellement créé. Si la relecture réseau échoue, l'objet reste privé pour
  reprise/TTL au lieu de risquer de casser une metadata déjà commise.
- Le rapprocheur doit d'abord obtenir une URL signée, ouvrir la pièce, attester
  son contrôle et saisir un commentaire. L'approbation reste désactivée pour
  l'exécuteur et sans capability AAL2 `sonasp.finance.reconcile`.

Les objets conservés après une relecture DB indisponible sont privés mais ne
sont pas automatiquement purgés par ce lot. L'exploitation doit inventorier,
via un job serveur service-role, les objets `payment-proofs` âgés de plus de
24 heures sans ligne `snp_payment_proofs` exacte, journaliser la décision puis
les supprimer. Aucun navigateur ne doit effectuer cette purge et une ligne
metadata existante interdit la suppression automatique.

## Ordre de livraison

1. Appliquer `20260825000006_lot_2l_preuves_paiement_privees.sql` et ses
   contrôles pgTAP sur un clone, puis en production selon la procédure DB.
2. Déployer la fonction `sensitive-upload` contenant le profil
   `international-payment-proof`.
3. Déployer le frontend. Aucun secret service-role ne doit être ajouté au
   navigateur.
4. Vérifier qu'aucune policy INSERT/UPDATE/DELETE authentifiée ne vise le
   bucket et qu'aucune valeur `http://` ou `https://` n'est créée dans la table
   de metadata.
5. Exécuter les contrats `lot_2l_preuves_paiement_privees_contract_test.sql`,
   `lot_2l_preuves_paiement_privees_flow_test.sql` et
   `lot_2l_storage_generic_policy_guard_test.sql`.

Entre les étapes 1 et 3, une approbation sans nouvelle preuve est refusée. Ce
comportement fail-closed est intentionnel.

## Compatibilité historique

Les anciennes valeurs `payments.proof_url` ou `sales.payment_proof_url` ne
constituent pas une preuve 2L, même si elles ressemblent à un chemin Supabase.
Elles ne sont ni téléchargées automatiquement ni acceptées pour approbation.
Cette règle évite SSRF, substitution d'objet et réouverture d'un bucket public.

Pour conserver une preuve historique, récupérer le document depuis une source
institutionnelle vérifiée, contrôler son empreinte et son dossier hors
navigateur, puis utiliser une procédure d'import serveur distincte et auditée.
Un paiement déjà approuvé ne doit pas être remis à `processing` pour contourner
le contrat. Tant que cette procédure d'import historique n'existe pas, le
dossier reste consultable sans exposer le lien ancien et toute nouvelle
approbation reste fermée.

## Limites assumées

Le contrôle local identifie le format réel mais ne remplace pas un moteur
antivirus/CDR. La séparation exécuteur/rapprocheur et le statut `processing`
restent le contrôle métier avant approbation. Si un moteur AV/CDR est ajouté,
son verdict doit devenir une condition positive supplémentaire ; l'absence de
verdict ne doit jamais être interprétée comme « sain ».
