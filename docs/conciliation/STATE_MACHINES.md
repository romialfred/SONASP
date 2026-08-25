# Machines à états — Conciliation

Les statuts existants font foi. Le cahier des charges §9 propose une liste ; elle
est ici confrontée aux états réellement utilisés par la plateforme avant d'en
retenir un jeu.

---

## 1. États existants à respecter

`sales` utilise déjà une machine à états dont les transitions sont posées par les
RPC restaurées :

```
pending_management_approval
   ├── approve ──> pending_for_customer_approval
   │                  ├── approve ──> waiting_for_payment
   │                  └── reject  ──> customer_rejected
   └── reject  ──> management_rejected
```

`snp_analyses_teneur` porte son propre `statut` et une `decision`.
`snp_contrats` porte `statut` avec les jalons `date_soumission`,
`date_approbation`, `date_activation`, `date_cloture`.

La conciliation ne remplace aucune de ces machines : elle s'ouvre en aval de
`waiting_for_payment` et se referme sur la clôture de la vente.

---

## 2. États de conciliation retenus

Le cahier des charges propose quinze états. Plusieurs se recouvrent ou décrivent
une situation de solde plutôt qu'un état de dossier. Le jeu retenu en distingue
neuf, la situation de solde devenant un attribut et non un état.

| État | Signification | Sortie |
|---|---|---|
| `en_attente_analyse` | dossier ouvert, analyse acheteur non reçue | analyse reçue, ou annulation |
| `analyse_recue` | analyse enregistrée, pièce jointe présente | calcul |
| `calculee` | écarts et ajustements fiscaux calculés | soumission, ou contestation |
| `ecart_a_verifier` | un écart dépasse le seuil contractuel | justification, contre-analyse, ou soumission |
| `en_attente_validation` | soumise, en attente d'un second acteur | validation ou rejet |
| `contestee` | résultat acheteur contesté | contre-analyse puis accord |
| `validee` | valeurs définitives arrêtées, écritures passées | facture définitive |
| `facture_definitive_generee` | facture émise, solde connu | clôture |
| `cloturee` | solde réglé ou compensé | terminal |
| `annulee` | dossier abandonné avant validation | terminal |

**Situations de solde** — `solde_a_recevoir`, `trop_percu`, `soldee` — ne sont pas
des états mais des attributs dérivés du ledger commercial. Les traiter comme des
états conduirait à des combinaisons contradictoires : une conciliation validée peut
simultanément présenter un trop-perçu commercial et un reliquat fiscal.

---

## 3. Transitions

```
en_attente_analyse ──(analyse + pièce)──> analyse_recue
analyse_recue ──(calcul)──> calculee
calculee ──(écart > seuil)──> ecart_a_verifier
calculee ──(écart ≤ seuil)──> en_attente_validation
ecart_a_verifier ──(justification)──> en_attente_validation
ecart_a_verifier ──(contestation)──> contestee
contestee ──(contre-analyse + accord)──> calculee
en_attente_validation ──(validation)──> validee
en_attente_validation ──(rejet)──> calculee
validee ──(émission)──> facture_definitive_generee
facture_definitive_generee ──(solde réglé ou compensé)──> cloturee
{en_attente_analyse, analyse_recue, calculee, ecart_a_verifier} ──> annulee
```

Toute transition non listée est refusée par le serveur. `validee` et au-delà ne
reviennent jamais en arrière : une correction ouvre une nouvelle version, jamais un
retour d'état.

---

## 4. Règles de transition contrôlées côté serveur

1. **Preuve d'analyse obligatoire.** Le passage à `analyse_recue` exige une pièce
   jointe lorsque le contrat impose un assay, `methode_analyse` étant renseignée.
2. **Séparation des tâches.** L'acteur qui soumet ne peut pas valider. Contrôlé sur
   `auth.uid()`, jamais sur un identifiant transmis par le client.
3. **Seuil d'écart.** Un écart dépassant `teneur_tolerance_pct` ou
   `tolerance_quantite_pct` du contrat impose une justification, et selon le
   contrat une contre-analyse.
4. **Unicité.** Une vente ne peut porter deux conciliations non annulées.
   Contrainte d'unicité partielle en base.
5. **Immutabilité.** Une conciliation `validee` ne se modifie pas. Toute correction
   crée une version, avec motif, acteur, valeurs antérieures et nouvelles.
6. **Atomicité.** La validation produit en une seule transaction : le changement
   d'état, l'instantané des valeurs, les écritures commerciales et fiscales, et la
   facture définitive. Tout échec annule l'ensemble.
7. **Idempotence.** Une double validation ne produit ni deuxième facture, ni
   deuxième écriture, la clé d'idempotence étant portée par le journal
   d'opérations.

---

## 5. Contestation

Le contrat gouverne : `delai_contestation_jours`, `frais_contre_expertise`,
`laboratoire_independant`, `teneur_faisant_foi`.

```
analyse_recue ──> ecart_a_verifier ──> contestee
   ──> contre-analyse (laboratoire indépendant)
   ──> accord ──> calculee ──> ...
```

Une contestation ouverte au-delà du délai contractuel est refusée. La contre-analyse
enregistre son laboratoire, sa référence et sa pièce ; la teneur qui l'emporte est
celle que `teneur_faisant_foi` désigne.

---

## 6. Ce qui reste à confirmer

Le cahier des charges évoque une validation supérieure au-delà d'un seuil d'écart
(§54) sans en fixer la valeur, et aucun contrat en base ne la précise. Le seuil est
donc porté par le contrat lorsqu'il existe, et par un paramètre versionné à défaut —
jamais par une constante dans le code.
