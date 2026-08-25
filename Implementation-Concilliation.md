# MISSION GÉNÉRALE

Vous intervenez sur une **plateforme métier existante de la SONASP au Burkina Faso**, destinée à la gestion centralisée de la production, des achats, des ventes, des expéditions, des paiements et de la traçabilité de l’or et des substances précieuses.

Cette plateforme existe déjà.

## IL NE S’AGIT PAS DE CRÉER UNE NOUVELLE APPLICATION.

Votre mission consiste à :

1. auditer profondément l’existant ;
2. comprendre l’architecture actuelle ;
3. comprendre les différents portails ;
4. comprendre les utilisateurs, rôles et permissions ;
5. comprendre la base PostgreSQL et ses relations ;
6. comprendre les modules et workflows déjà implémentés ;
7. comprendre les achats, ventes, expéditions, contrats, paiements, factures et productions existantes ;
8. préserver les fonctionnalités correctes ;
9. améliorer ou refactoriser uniquement lorsque cela est justifié ;
10. implémenter les nouveaux modules décrits dans ce document ;
11. intégrer ces modules naturellement à l’écosystème existant ;
12. garantir l’intégrité comptable, financière, fiscale et transactionnelle ;
13. garantir l’absence de régression ;
14. tester tous les workflows de bout en bout ;
15. corriger automatiquement les anomalies détectées ;
16. poursuivre les itérations jusqu’à obtenir un niveau de qualité de **100/100** selon les critères définis dans cette mission.

Aucune implémentation ne doit commencer avant une compréhension sérieuse de l’existant.

---

# 1. CONSTITUTION OBLIGATOIRE D’UNE ÉQUIPE D’EXPERTS

Claude doit organiser le travail comme une équipe pluridisciplinaire virtuelle.

Mobiliser au minimum les expertises suivantes :

* Architecte logiciel senior ;
* Senior Backend Developer ;
* Senior Frontend Developer ;
* Expert PostgreSQL / Data Architect ;
* Expert sécurité applicative ;
* Expert QA / Test Automation ;
* Expert DevOps ;
* Expert UX/UI applications financières ;
* Expert Finance / Comptabilité ;
* Expert Facturation ;
* Fiscaliste Burkina Faso ;
* Expert fiscalité minière ;
* Expert industrie aurifère ;
* Expert opérations minières ;
* Expert commercialisation de l’or ;
* Expert contrôle interne ;
* Expert audit et traçabilité ;
* Business Analyst senior ;
* Expert workflow/BPM ;
* Expert RBAC/ABAC ;
* Expert performance et scalabilité.

Les agents doivent pouvoir travailler en parallèle lorsque cela est pertinent.

Un architecte principal doit assurer la cohérence générale.

---

# 2. RÈGLE ABSOLUE : ANALYSER AVANT DE MODIFIER

Avant toute modification du code, effectuer un audit complet.

Analyser notamment :

## Architecture

* frontend ;
* backend ;
* API ;
* services ;
* repositories ;
* ORM ;
* base PostgreSQL ;
* migrations ;
* authentification ;
* autorisations ;
* stockage documentaire ;
* génération PDF ;
* notifications ;
* jobs éventuels ;
* Docker ;
* configuration ;
* variables d’environnement ;
* intégrations externes.

## Base de données

Cartographier :

* tables ;
* clés primaires ;
* clés étrangères ;
* contraintes ;
* index ;
* triggers ;
* vues ;
* fonctions ;
* enums ;
* relations ;
* audit trails ;
* mécanismes de soft delete ;
* historique.

Identifier précisément les objets existants correspondant à :

* mines ;
* comptoirs ;
* SONASP ;
* clients internationaux ;
* raffineries ;
* orpailleurs ;
* productions ;
* expéditions ;
* ventes ;
* achats ;
* contrats ;
* factures ;
* paiements ;
* acomptes ;
* comptes bancaires ;
* pièces justificatives ;
* utilisateurs ;
* organisations ;
* rôles ;
* permissions.

Ne jamais créer une table doublonnant inutilement une entité déjà correctement modélisée.

---

# 3. CARTOGRAPHIER LES PORTAILS

La plateforme constitue **UN SEUL SYSTÈME MÉTIER** comportant plusieurs portails.

Les principaux portails sont :

### SONASP

Administration, supervision, achats, ventes, contrôles, validation, reporting et conciliation.

### MINE

Gestion de :

* production ;
* expéditions ;
* ventes ;
* contrats ;
* facturation ;
* paiements ;
* conciliation ;
* situation fiscale et commerciale.

### COMPTOIR

Gestion :

* achats auprès des orpailleurs ;
* achats/ventes avec la SONASP ;
* stocks ;
* expéditions ;
* ventes externes éventuelles ;
* paiements ;
* contrats ;
* conciliation pour les opérations éligibles.

Les habilitations doivent être strictement contrôlées.

---

# 4. REQUALIFICATION DES FLUX MÉTIER

L’équipe doit analyser les modules actuels et proposer une nomenclature métier cohérente.

La distinction suivante doit devenir structurante.

# A. ACHATS INTERNES

Exemple :

**Comptoir → SONASP**

La SONASP achète de l’or provenant d’un comptoir.

Ces opérations doivent être clairement identifiées comme des achats internes au dispositif national.

---

# B. VENTES EXTERNES

Comprennent notamment :

### Mine → SONASP

### Mine → Client international / Raffinerie internationale

### SONASP → Client international / Raffinerie internationale

### Comptoir → acheteur éligible lorsque le workflow métier le prévoit

Ces opérations peuvent être reliées à :

* expédition ;
* contrat ;
* facture provisoire ;
* paiement/acompte ;
* analyse laboratoire ;
* conciliation ;
* facture définitive ;
* ajustement fiscal ;
* règlement du solde.

---

# C. ACHATS AUPRÈS DES ORPAILLEURS

Flux :

**Orpailleur → Comptoir**

Ces transactions constituent un cas métier particulier.

Elles doivent être enregistrées pour assurer :

* traçabilité ;
* poids ;
* prix ;
* vendeur ;
* comptoir ;
* lieu ;
* date ;
* preuve éventuelle ;
* paiement ;
* alimentation du stock du comptoir.

MAIS :

## CES TRANSACTIONS NE DOIVENT PAS PASSER PAR LE MOTEUR DE CONCILIATION décrit dans cette mission.

Elles ne doivent pas automatiquement générer :

* TVA ;
* FNDL ;
* royalties ;

lorsque le cadre métier applicable à ce type d’achat ne les prévoit pas.

Ne pas modifier arbitrairement ce comportement sans validation juridique.

---

# 5. MODULE CENTRAL À IMPLÉMENTER : CONCILIATION

Le module de **Conciliation** devient l’un des composants les plus importants de toute la plateforme.

Il ne doit PAS être conçu comme :

> deux colonnes et un bouton « Valider ».

Il doit être conçu comme un véritable moteur transactionnel permettant de rapprocher :

**EXPÉDITION → VENTE PROVISOIRE → FACTURE PROVISOIRE → PAIEMENT/ACOMPTE → ANALYSE ACHETEUR → RECALCUL → AJUSTEMENTS FISCAUX → FACTURE DÉFINITIVE → SOLDE → COMPENSATION → CLÔTURE**

---

# 6. PRINCIPE MÉTIER DE LA CONCILIATION

Lors de l’expédition ou de la vente initiale, certaines valeurs sont basées sur les informations disponibles à la Mine ou au vendeur.

Exemples :

* poids ;
* teneur/pureté ;
* prix de référence ;
* prix contractuel ;
* devise ;
* taux de change ;
* quantité d’or fin ;
* chiffre d’affaires ;
* TVA ;
* royalties/redevances ;
* FNDL ;
* montant net.

L’acheteur ou sa raffinerie procède ensuite à sa propre analyse.

Cette analyse peut établir :

* un poids différent ;
* une pureté différente ;
* une quantité d’or fin différente ;
* éventuellement des déductions contractuelles ;
* un prix applicable différent ;
* une date de fixing différente ;
* un taux de change différent, selon contrat ;
* une valeur commerciale définitive différente.

La conciliation consiste à rapprocher :

### VALEURS PROVISOIRES

avec :

### VALEURS DÉFINITIVES ACCEPTÉES.

---

# 7. LIAISON AVEC L’EXPÉDITION

Une conciliation doit obligatoirement être rattachée à une opération existante et éligible.

L’utilisateur ne doit jamais ressaisir inutilement les données déjà disponibles.

Lorsqu’il sélectionne une opération à concilier, récupérer automatiquement :

* vendeur ;
* acheteur ;
* Mine ;
* expédition ;
* référence expédition ;
* date expédition ;
* contrat ;
* lot ;
* poids déclaré ;
* teneur déclarée ;
* prix initial ;
* devise ;
* taux de change applicable ;
* chiffre d’affaires provisoire ;
* facture provisoire ;
* taxes initiales ;
* paiements reçus ;
* acomptes ;
* documents associés.

---

# 8. LISTE DES OPÉRATIONS « À CONCILIER »

Créer une véritable file de travail.

Elle doit afficher notamment :

* référence ;
* Mine/vendeur ;
* acheteur ;
* contrat ;
* expédition ;
* date ;
* quantité ;
* montant provisoire ;
* montant déjà payé ;
* devise ;
* nombre de jours écoulés ;
* échéance contractuelle ;
* statut ;
* présence ou absence du rapport laboratoire.

Filtres :

* vendeur ;
* acheteur ;
* Mine ;
* comptoir ;
* période ;
* statut ;
* contrat ;
* en retard ;
* analyse reçue/non reçue ;
* paiement ;
* devise ;
* type d'opération.

---

# 9. STATUTS DE CONCILIATION

Définir une vraie machine à états.

Étudier les statuts existants avant création.

À défaut, prévoir conceptuellement :

* EN_ATTENTE_ANALYSE
* ANALYSE_RECUE
* BROUILLON_CONCILIATION
* CALCULEE
* ECART_A_VERIFIER
* EN_ATTENTE_VALIDATION
* VALIDEE
* CONTESTEE
* A_CORRIGER
* FACTURE_DEFINITIVE_GENEREE
* SOLDE_A_RECEVOIR
* TROP_PERCU
* SOLDEE
* CLOTUREE
* ANNULEE

Chaque transition doit être contrôlée.

Impossible de modifier silencieusement une conciliation validée.

Toute correction ultérieure doit produire :

* nouvelle version ;
* motif ;
* utilisateur ;
* date ;
* anciennes valeurs ;
* nouvelles valeurs ;
* trace d’audit.

---

# 10. SAISIE DES RÉSULTATS ACHETEUR

Créer une interface professionnelle.

## Partie gauche

### Informations initiales

Afficher en lecture seule :

* poids Mine ;
* pureté Mine ;
* quantité métal fin calculée ;
* prix initial ;
* taux de change ;
* CA initial ;
* taxes initiales ;
* facture initiale.

### Résultats acheteur

Permettre de saisir :

* poids final ;
* unité ;
* pureté finale ;
* assay ;
* laboratoire ;
* date de l’analyse ;
* référence laboratoire ;
* prix/fixing final ;
* date de fixing ;
* devise ;
* taux de change utilisé si applicable ;
* éventuels frais/déductions contractuelles ;
* observations.

---

# 11. PIÈCE JUSTIFICATIVE LABORATOIRE

Le rapport d’analyse doit pouvoir être joint.

Support :

* PDF ;
* image ;
* autres formats autorisés par la plateforme.

Enregistrer :

* document ;
* hash si disponible ;
* uploader ;
* date ;
* référence ;
* type ;
* version.

La validation définitive ne doit pas être possible lorsque le contrat ou la règle métier exige un assay mais qu’aucune preuve n’a été fournie.

---

# 12. COMPARAISON VISUELLE

La page doit afficher clairement :

| Paramètre | Initial Mine | Définitif acheteur | Écart |
| --------- | -----------: | -----------------: | ----: |
| Poids     |            X |                  Y |     Δ |
| Pureté    |            X |                  Y |     Δ |
| Or fin    |            X |                  Y |     Δ |
| Prix      |            X |                  Y |     Δ |
| CA HT     |            X |                  Y |     Δ |
| TVA       |            X |                  Y |     Δ |
| Royalties |            X |                  Y |     Δ |
| FNDL      |            X |                  Y |     Δ |
| Total     |            X |                  Y |     Δ |

Les écarts significatifs doivent être mis en évidence.

---

# 13. CALCUL DE L’OR FIN

Ne pas inventer arbitrairement la formule.

Analyser :

* workflow existant ;
* facture specimen ;
* contrats ;
* règles métier déjà implémentées.

Si le modèle métier confirme :

**Or fin = Poids × Teneur**

implémenter la formule avec des unités cohérentes.

Gérer :

* grammes ;
* kilogrammes ;
* onces troy.

Une seule unité interne canonique doit être utilisée pour les calculs.

---

# 14. CONVERSION OZ / GRAMME

Lorsque le prix est exprimé en USD par once troy, la plateforme doit pouvoir obtenir un prix par gramme.

Ne jamais utiliser une once générique.

Utiliser l’once troy selon les règles financières applicables.

Centraliser les conversions dans un service métier testé.

Ne jamais dupliquer les formules dans le frontend.

---

# 15. PRIX DE L’OR

Créer ou réutiliser un service centralisé de prix.

Une transaction doit conserver le prix réellement utilisé.

Le prix ne doit jamais devenir historiquement variable parce qu’une source externe a changé.

Enregistrer au minimum :

* valeur ;
* devise ;
* unité ;
* timestamp ;
* source ;
* type de prix ;
* date de fixing ;
* utilisateur si saisie manuelle.

La conciliation doit permettre d’utiliser la règle de pricing définie dans le contrat.

Exemples possibles :

* prix du jour de l’expédition ;
* prix du jour du résultat laboratoire ;
* prix de fixing convenu ;
* prix contractuel ;
* moyenne ;
* autre règle prévue au contrat.

## LE CONTRAT EST LA SOURCE DE VÉRITÉ.

---

# 16. MOTEUR FISCAL CENTRAL

Créer un moteur fiscal centralisé.

NE JAMAIS placer les taux dans :

* composants React ;
* formulaires ;
* controllers ;
* services commerciaux dispersés ;
* constantes non versionnées.

Créer un référentiel fiscal.

---

# 17. VERSIONNEMENT DES RÈGLES FISCALES

Chaque règle doit disposer au minimum de :

* type de taxe ;
* nom ;
* code ;
* assiette ;
* taux ;
* mode de calcul ;
* seuil inférieur ;
* seuil supérieur ;
* devise du seuil ;
* inclusivité des bornes ;
* date d’effet ;
* date de fin ;
* statut ;
* référence réglementaire ;
* commentaire ;
* auteur ;
* date création ;
* approbateur ;
* historique.

Une transaction historique doit toujours être recalculable avec la règle applicable à sa date.

Une modification en 2027 ne doit jamais modifier rétroactivement une facture de 2026.

---

# 18. TVA

Prévoir un paramétrage TVA.

Le métier évoque notamment un taux de référence de **18 %**, pouvant dépendre de la situation de l’acheteur/raffineur et du traitement fiscal applicable.

NE PAS considérer 18 % comme une constante universelle non modifiable.

Le moteur doit permettre :

* taux standard ;
* exonération ;
* taux spécifique ;
* date d’effet ;
* catégorie d’acheteur ;
* justification ;
* référence juridique.

---

# 19. ROYALTIES / REDEVANCES PROPORTIONNELLES

Créer un module spécifique :

# PARAMÉTRAGE DES ROYALTIES

Il doit gérer des barèmes progressifs ou par tranches/seuils selon le cours de l’or ou toute autre règle réglementaire.

Exemple conceptuel :

* intervalle A → taux A ;
* intervalle B → taux B ;
* intervalle C → taux C.

Les exemples de taux fournis dans les besoins ne doivent PAS être codés comme vérité juridique sans validation.

Le module doit permettre aux utilisateurs habilités de paramétrer :

* seuil ;
* taux ;
* devise ;
* unité de référence ;
* date d’application ;
* texte/référence ;
* version.

Le calcul doit expliquer :

> Règle appliquée
> Base taxable
> Taux appliqué
> Montant obtenu

---

# 20. FNDL

Créer un paramètre fiscal dédié au Fonds concerné par la législation minière.

Le métier évoque un calcul pouvant correspondre à **1 % du chiffre d’affaires hors taxes**.

Cette valeur doit être administrable, versionnée et historisée.

Elle ne doit jamais être inscrite arbitrairement dans le code.

---

# 21. TRAÇABILITÉ DES CALCULS

Chaque montant fiscal doit pouvoir répondre à :

> Pourquoi ce montant a-t-il été calculé ?

Conserver un snapshot de :

* assiette ;
* taux ;
* règle ;
* version ;
* date ;
* formule ;
* montant ;
* arrondi ;
* devise.

---

# 22. MODULE FACTURATION

Analyser la facture specimen déjà disponible dans le projet ou les documents associés.

S’en inspirer pour développer une véritable interface de génération de facture.

La facture ne doit PAS être un simple formulaire générique.

---

# 23. FACTURE PROVISOIRE

À la vente/expédition, permettre de visualiser et générer une facture présentant clairement :

### Parties

* vendeur ;
* acheteur ;
* adresses ;
* références fiscales ;
* contrat ;
* numéro facture ;
* expédition ;
* date.

### Produit

* substance ;
* lot ;
* poids ;
* unité ;
* teneur ;
* quantité d’or fin.

### Pricing

* prix USD/Oz ou autre ;
* prix converti ;
* taux de change ;
* date de référence.

### Finance

* CA HT ;
* TVA ;
* royalties ;
* FNDL ;
* autres éléments autorisés ;
* total.

### Paiement

* conditions contractuelles ;
* délai ;
* banque ;
* échéance.

Permettre :

* aperçu ;
* génération PDF ;
* téléchargement ;
* historique ;
* versionnage.

---

# 24. FACTURE DÉFINITIVE APRÈS CONCILIATION

Après validation de la conciliation, produire une facture définitive à partir des paramètres acceptés.

Afficher distinctement :

### Valeur définitive de la vente

### Montant déjà facturé

### Montant déjà reçu

### Ajustements

### Montant restant à recevoir

OU

### Trop-perçu

La facture doit mentionner clairement les références de :

* facture provisoire ;
* expédition ;
* contrat ;
* conciliation.

---

# 25. CONTRATS

Le module Conciliation doit être fortement intégré au module Gestion des contrats.

NE PAS ressaisir les conditions contractuelles.

Récupérer automatiquement :

* client ;
* vendeur ;
* objet ;
* date début ;
* date fin ;
* conditions de livraison ;
* tolérances ;
* règle de teneur ;
* méthode d’analyse ;
* laboratoire indépendant éventuel ;
* méthode de pricing ;
* date de fixing ;
* devise ;
* conditions de paiement ;
* délai de paiement ;
* pourcentage d’acompte ;
* règlement du solde ;
* pénalités éventuelles ;
* règles de différend ;
* tolérances d’écarts.

---

# 26. VALIDATION DU PAIEMENT PAR LA MINE

Lorsqu’un acheteur réalise un paiement, la Mine doit pouvoir confirmer la réception.

La page doit permettre :

* sélectionner la vente ;
* voir la facture ;
* voir les paiements antérieurs ;
* voir les acomptes ;
* voir le montant attendu ;
* saisir le montant effectivement reçu ;
* date de valeur ;
* banque ;
* compte bancaire ;
* référence ;
* devise ;
* taux de change si nécessaire ;
* preuve de paiement ;
* observations.

Supporter :

* paiement total ;
* paiement partiel ;
* acompte ;
* plusieurs paiements ;
* correction contrôlée.

---

# 27. PREUVES DE PAIEMENT

Permettre de joindre notamment :

* SWIFT ;
* MT103 ;
* avis de crédit ;
* bordereau bancaire ;
* autre pièce justificative.

Les comptes bancaires doivent provenir des comptes enregistrés sur la fiche société.

Ne pas ressaisir arbitrairement les coordonnées bancaires.

---

# 28. COMPTE CLIENT

Créer un véritable **ledger / compte courant commercial** entre :

* Mine ↔ SONASP ;
* Mine ↔ client international ;
* SONASP ↔ client international ;
* Comptoir ↔ contrepartie éligible.

Pour chaque contrepartie afficher :

* ventes ;
* factures ;
* paiements ;
* acomptes ;
* avoirs ;
* notes de débit ;
* compensations ;
* reliquats ;
* solde.

---

# 29. CAS : L’ACHETEUR A PAYÉ PLUS QUE LE MONTANT DÉFINITIF

Exemple :

Facture provisoire : 1 000 000 000 FCFA

Paiement reçu : 900 000 000 FCFA

Valeur finale après assay : 850 000 000 FCFA

La Mine dispose alors d’un trop-perçu de :

50 000 000 FCFA.

Ce montant devient une dette de la Mine envers son client.

Le système doit :

* matérialiser le trop-perçu ;
* créer l’écriture appropriée ;
* permettre un remboursement ;
* OU permettre son utilisation comme avoir sur une future vente.

---

# 30. CAS : L’ACHETEUR DOIT ENCORE DE L’ARGENT

Exemple :

Valeur finale : 950 000 000

Déjà reçu : 900 000 000

Reliquat :

50 000 000 FCFA.

Créer une créance ouverte.

Elle doit être visible dans :

* facture ;
* compte client ;
* dashboard ;
* échéancier ;
* relances éventuelles.

---

# 31. MODULE AVOIRS ET COMPENSATIONS CLIENTS

Créer un mécanisme explicite d’avoirs.

Un avoir doit comporter :

* origine ;
* client ;
* vendeur ;
* montant initial ;
* montant utilisé ;
* solde ;
* devise ;
* date ;
* statut.

Statuts conceptuels :

* DISPONIBLE ;
* PARTIELLEMENT_UTILISE ;
* UTILISE ;
* REMBOURSE ;
* ANNULE.

Lors d’une vente future, proposer :

> Avoir disponible : XX FCFA
> Souhaitez-vous l’imputer ?

Toute compensation doit produire une écriture et une trace d’audit.

---

# 32. AJUSTEMENTS FISCAUX APRÈS CONCILIATION

C’est un point CRITIQUE.

Si la conciliation modifie le CA, le moteur doit recalculer :

* TVA ;
* royalties ;
* FNDL ;
* autres prélèvements applicables.

Calculer pour chacun :

**Montant provisoire**

**Montant définitif**

**Écart**

---

# 33. COMPTE FISCAL DE LA MINE

Créer un véritable sous-ledger fiscal par Mine.

Types minimum :

* TVA ;
* ROYALTIES ;
* FNDL.

Chaque mouvement doit indiquer :

* Mine ;
* vente ;
* facture ;
* conciliation ;
* taxe ;
* période ;
* débit ;
* crédit ;
* solde ;
* raison ;
* date ;
* règle appliquée.

---

# 34. CAS DE TROP-VERSÉ FISCAL

Exemple :

Royalty provisoire :

55 000 000 FCFA.

Royalty définitive :

50 000 000 FCFA.

Écart :

-5 000 000 FCFA.

La Mine dispose potentiellement d’un crédit de 5 000 000.

Le système doit conserver cet écart.

NE JAMAIS l’effacer.

Selon les règles administratives applicables, permettre ensuite :

* report ;
* compensation future ;
* demande de remboursement ;
* régularisation ;
* écriture manuelle autorisée.

---

# 35. CAS DE SOUS-VERSEMENT FISCAL

Si la taxe définitive est supérieure à la taxe initialement comptabilisée :

créer un reliquat dû.

Exemple :

Taxe initiale : 50 M

Taxe définitive : 55 M

Reliquat : +5 M.

Il doit apparaître dans le compte fiscal de la Mine jusqu’à régularisation.

---

# 36. COMPENSATION FISCALE

IMPORTANT :

Ne pas considérer automatiquement que toute taxe trop payée est légalement compensable.

Le moteur doit distinguer :

* crédit constaté ;
* crédit disponible ;
* crédit approuvé pour compensation ;
* crédit utilisé ;
* remboursement demandé ;
* remboursement effectué.

Toute compensation fiscale doit nécessiter les autorisations prévues.

---

# 37. LEDGER IMMUTABLE

Les soldes financiers et fiscaux ne doivent pas dépendre uniquement d’un champ modifié directement.

Implémenter de préférence un système d’écritures permettant la reconstruction du solde.

Principe :

**ne jamais détruire une écriture financière validée.**

Corriger par :

* contrepassation ;
* ajustement ;
* nouvelle écriture.

---

# 38. IDEMPOTENCE

Toutes les opérations critiques doivent être idempotentes.

Une double validation ne doit jamais :

* doubler une facture ;
* doubler un paiement ;
* doubler une taxe ;
* doubler une compensation ;
* doubler un mouvement de ledger.

---

# 39. TRANSACTIONS ACID

Les actions critiques doivent être transactionnelles.

Exemple :

« Valider conciliation »

doit produire atomiquement :

* validation ;
* snapshot ;
* recalcul ;
* écriture commerciale ;
* écritures fiscales ;
* facture définitive ;
* mouvements éventuels.

Si une opération échoue :

ROLLBACK complet.

Aucune situation partiellement validée.

---

# 40. PRÉCISION FINANCIÈRE

INTERDICTION d’utiliser des flottants binaires ordinaires pour les montants financiers.

Utiliser :

* NUMERIC / DECIMAL dans PostgreSQL ;
* Decimal côté backend.

Définir explicitement :

* précision poids ;
* précision teneur ;
* précision cours ;
* taux ;
* devise ;
* règles d’arrondi.

---

# 41. DEVISES

Supporter correctement au minimum :

* XOF ;
* USD ;

et architecture extensible.

Chaque opération en devise étrangère doit conserver :

* devise source ;
* montant source ;
* taux de conversion ;
* source taux ;
* timestamp ;
* montant XOF.

Ne jamais recalculer une ancienne opération avec le taux de change actuel.

---

# 42. ARCHITECTURE DE DONNÉES

Avant création des migrations, analyser les modèles existants.

Créer ou enrichir conceptuellement les domaines nécessaires :

* Sale
* SaleLine
* Shipment
* Contract
* Assay
* Reconciliation
* ReconciliationVersion
* ReconciliationDifference
* Invoice
* InvoiceVersion
* Payment
* PaymentAllocation
* TaxRule
* TaxRuleVersion
* TaxCalculation
* TaxLedgerEntry
* CommercialLedgerEntry
* CreditNote
* DebitNote
* CreditApplication
* ReconciliationDocument
* AuditEvent

Mais :

## NE PAS CRÉER MÉCANIQUEMENT CES TABLES.

Réutiliser et enrichir les entités existantes.

Le modèle final doit être normalisé, cohérent et adapté à l’architecture actuelle.

---

# 43. IDENTIFIANTS MÉTIER

Créer des références professionnelles lisibles.

Exemples conceptuels :

* EXP-2026-XXXX
* SAL-2026-XXXX
* INV-P-2026-XXXX
* INV-F-2026-XXXX
* REC-2026-XXXX
* PAY-2026-XXXX
* CRN-2026-XXXX

Les séquences doivent éviter les collisions.

---

# 44. RBAC

La Conciliation doit être disponible uniquement aux profils habilités relevant de :

* SONASP ;
* MINE ;
* COMPTOIR.

MAIS cela ne signifie pas que tous les utilisateurs de ces portails disposent des mêmes droits.

Créer ou réutiliser des permissions granulaires, par exemple :

* reconciliation.read
* reconciliation.create
* reconciliation.edit
* reconciliation.submit
* reconciliation.approve
* reconciliation.reject
* reconciliation.dispute
* reconciliation.close
* reconciliation.export
* reconciliation.tax.adjust
* reconciliation.credit.apply
* tax.rules.read
* tax.rules.manage

---

# 45. ISOLATION ORGANISATIONNELLE

Une Mine ne doit jamais pouvoir consulter les transactions d’une autre Mine.

Un Comptoir ne doit jamais voir les données d’un autre Comptoir.

Un acheteur ne voit que ses opérations selon son rôle.

Les droits doivent être vérifiés :

## CÔTÉ BACKEND.

Masquer un bouton frontend n’est PAS une mesure de sécurité.

---

# 46. SÉPARATION DES RESPONSABILITÉS

Pour les opérations sensibles, étudier la mise en place du principe maker/checker.

Exemple :

Utilisateur A prépare une conciliation.

Utilisateur B la valide.

Éviter, selon les droits retenus, qu’un même utilisateur puisse :

* saisir ;
* modifier ;
* valider ;
* annuler ;

une opération financière importante sans contrôle.

---

# 47. AUDIT TRAIL

Tracer obligatoirement :

* création ;
* modification ;
* soumission ;
* validation ;
* rejet ;
* contestation ;
* annulation ;
* upload ;
* paiement ;
* compensation ;
* modification fiscale ;
* génération facture ;
* changement de statut.

Conserver :

* utilisateur ;
* rôle ;
* organisation ;
* timestamp ;
* IP si architecture prévue ;
* anciennes valeurs ;
* nouvelles valeurs ;
* motif ;
* objet concerné.

---

# 48. UI/UX DU MODULE CONCILIATION

Le design doit reprendre fidèlement le design system existant lorsqu’il est bon.

Ne pas introduire un second design system incohérent.

Le module doit être :

* premium ;
* professionnel ;
* sobre ;
* financier ;
* clair ;
* dense mais lisible ;
* adapté aux responsables financiers et dirigeants.

---

# 49. PAGE DASHBOARD CONCILIATION

Créer un véritable cockpit.

KPIs suggérés :

* ventes à concilier ;
* montant à concilier ;
* conciliations du mois ;
* écarts positifs ;
* écarts négatifs ;
* créances clients ;
* trop-perçus ;
* crédits fiscaux ;
* taxes complémentaires ;
* dossiers en retard ;
* dossiers contestés.

Ajouter des visualisations pertinentes :

* évolution des écarts ;
* écarts par Mine ;
* écarts par acheteur ;
* répartition des statuts ;
* délais moyens de conciliation.

---

# 50. PAGE DÉTAIL DE CONCILIATION

Organisation recommandée :

### Header

Référence + statut + vendeur + acheteur.

### Bandeau synthèse

* valeur provisoire ;
* valeur définitive ;
* différence ;
* payé ;
* solde.

### Navigation

* Synthèse
* Données initiales
* Assay acheteur
* Comparaison
* Fiscalité
* Paiements
* Factures
* Documents
* Historique

---

# 51. PANNEAU LATÉRAL

Sur les formulaires complexes, exploiter intelligemment un panneau de droite permettant de présenter :

* résumé vente ;
* contrat ;
* historique client ;
* paiements ;
* avoir disponible ;
* documents ;
* règles fiscales appliquées.

Éviter les formulaires interminables composés d’une simple succession de champs.

---

# 52. PAS DE FORMULAIRES MODAUX COMPLEXES

Pour les opérations importantes telles que :

* conciliation ;
* facture ;
* paiement ;
* contrat ;
* paramétrage fiscal ;

préférer des pages ou workflows dédiés.

Les modales peuvent être utilisées pour :

* confirmation ;
* aperçu rapide ;
* visualisation documentaire.

---

# 53. ALERTES

Créer des alertes pertinentes :

* assay attendu ;
* délai contractuel dépassé ;
* paiement en retard ;
* conciliation non effectuée ;
* écart au-delà du seuil ;
* facture définitive non générée ;
* reliquat impayé ;
* crédit fiscal inutilisé ;
* contrat expirant.

---

# 54. SEUILS D’ÉCART

Prévoir une configuration permettant de définir des seuils :

### Poids

### Pureté

### Valeur

### Pourcentage

Un écart dépassant le seuil doit nécessiter :

* justification ;
* éventuellement validation supérieure ;
* éventuellement second assay selon contrat.

---

# 55. GESTION DES CONTESTATIONS

Un résultat acheteur peut être contesté.

Créer un workflow :

ANALYSE_REÇUE
→ ÉCART
→ CONTESTATION
→ CONTRE-ANALYSE
→ ACCORD
→ CONCILIATION.

Associer :

* commentaires ;
* documents ;
* laboratoire indépendant ;
* nouvelles valeurs ;
* décisions.

---

# 56. REPORTING

Créer des rapports exploitables.

### Par Mine

* ventes ;
* valeur ;
* montant encaissé ;
* créances ;
* avoirs ;
* TVA ;
* royalties ;
* FNDL ;
* crédits fiscaux ;
* reliquats fiscaux.

### Par client

* volumes ;
* ventes ;
* paiements ;
* créances ;
* trop-perçus ;
* délais ;
* écarts assay.

### Par période

* mois ;
* trimestre ;
* année.

Prévoir export contrôlé :

* Excel ;
* PDF ;
* CSV si adapté.

---

# 57. RECHERCHE ET FILTRES

Toutes les listes métier doivent bénéficier de :

* recherche ;
* filtres ;
* pagination ;
* tri ;
* filtres persistants si possible ;
* export.

Ne jamais charger arbitrairement des milliers d’enregistrements dans le navigateur.

---

# 58. PERFORMANCE

Analyser les requêtes SQL.

Créer les index utiles sur notamment :

* transaction_id ;
* sale_id ;
* shipment_id ;
* mine_id ;
* buyer_id ;
* contract_id ;
* reconciliation_status ;
* invoice_status ;
* dates ;
* références.

Éviter :

* N+1 ;
* appels API inutiles ;
* recalculs coûteux ;
* sur-fetching.

---

# 59. SÉCURITÉ DOCUMENTAIRE

Les fichiers laboratoire, factures et preuves bancaires sont sensibles.

Contrôler :

* extension ;
* MIME ;
* taille ;
* nom ;
* autorisation ;
* accès ;
* téléchargement ;
* stockage privé ;
* URL signée si architecture adaptée.

Ne jamais exposer directement un bucket sensible au public.

---

# 60. VALIDATION BACKEND

Toutes les règles métier doivent être validées côté serveur.

Exemples :

Impossible de :

* concilier deux fois une même vente définitivement ;
* concilier une vente artisanale non éligible ;
* modifier une facture définitive silencieusement ;
* utiliser deux fois le même avoir ;
* appliquer un crédit supérieur au solde ;
* payer négativement ;
* créer une taxe avec chevauchement incohérent ;
* changer une règle fiscale historique déjà utilisée sans versionnement ;
* associer une expédition à une organisation non autorisée.

---

# 61. CONCURRENCE

Tester les cas de concurrence.

Exemple :

Deux utilisateurs tentent simultanément d’utiliser le même avoir.

Un seul doit réussir.

Prévoir :

* transaction ;
* locking adapté ;
* contraintes DB ;
* idempotency key.

---

# 62. TESTS UNITAIRES

Tester intensivement les moteurs :

* prix ;
* poids ;
* pureté ;
* conversion ;
* CA ;
* TVA ;
* royalties ;
* FNDL ;
* écarts ;
* devises ;
* arrondis ;
* avoir ;
* compensation ;
* solde ;
* statut.

---

# 63. TESTS D’INTÉGRATION

Tester :

* DB ;
* API ;
* règles métier ;
* permissions ;
* transactions ;
* documents ;
* génération facture.

---

# 64. TESTS E2E

Construire obligatoirement les scénarios suivants.

## SCÉNARIO 1

Mine vend → expédition → facture provisoire → paiement partiel → assay identique → facture définitive → règlement → clôture.

## SCÉNARIO 2

Assay inférieur → CA final inférieur → trop-perçu client → avoir → utilisation lors de vente suivante.

## SCÉNARIO 3

Assay supérieur → CA supérieur → reliquat client → paiement complémentaire.

## SCÉNARIO 4

CA inférieur → taxes définitives inférieures → crédit fiscal.

## SCÉNARIO 5

CA supérieur → taxes supérieures → reliquat fiscal.

## SCÉNARIO 6

Variation de royalty suivant barème.

## SCÉNARIO 7

Vente USD → conversion XOF → conciliation avec règles contractuelles.

## SCÉNARIO 8

Rapport assay contesté → contre-analyse → validation.

## SCÉNARIO 9

Comptoir achète auprès d’un orpailleur → transaction enregistrée → aucun workflow de conciliation.

## SCÉNARIO 10

Deux utilisateurs tentent d’utiliser le même avoir → aucune double consommation.

## SCÉNARIO 11

Utilisateur Mine tente d’accéder aux données d’une autre Mine → refus.

## SCÉNARIO 12

Modification du barème fiscal → anciennes transactions inchangées.

---

# 65. TESTS DE NON-RÉGRESSION

Tester également les modules existants impactés :

* production ;
* achats ;
* expéditions ;
* ventes ;
* stocks ;
* contrats ;
* factures ;
* paiements ;
* utilisateurs ;
* dashboards ;
* portails ;
* orpailleurs ;
* comptoirs.

Une fonctionnalité existante ne doit pas être cassée pour satisfaire cette mission.

---

# 66. MIGRATIONS

Les migrations doivent être :

* versionnées ;
* déterministes ;
* réversibles lorsque possible ;
* compatibles avec les données existantes.

Avant toute migration destructrice :

analyser les données existantes.

Aucune suppression sauvage.

---

# 67. DONNÉES EXISTANTES

Prévoir la migration des anciennes opérations.

Déterminer :

* quelles ventes sont conciliables ;
* lesquelles sont déjà définitivement soldées ;
* lesquelles manquent de données ;
* comment les anciennes factures sont conservées.

Ne pas inventer des données historiques.

---

# 68. OBSERVABILITÉ

Ajouter des logs structurés pour les opérations critiques.

Ne jamais logger :

* mots de passe ;
* tokens ;
* secrets ;
* informations bancaires sensibles complètes.

Les erreurs doivent permettre d’identifier :

* opération ;
* référence métier ;
* service ;
* cause.

---

# 69. GESTION DES ERREURS

Les erreurs utilisateur doivent être compréhensibles.

Éviter :

> Error 500.

Préférer :

> Cette vente ne peut pas être conciliée car une conciliation définitive REC-2026-00452 existe déjà.

---

# 70. DOCUMENTATION TECHNIQUE

Créer ou actualiser la documentation du projet.

Documenter :

* architecture ;
* modèle de données ;
* workflows ;
* états ;
* RBAC ;
* moteur fiscal ;
* moteur de conciliation ;
* règles de facturation ;
* compensation ;
* API ;
* tests ;
* migrations.

---

# 71. DOCUMENTATION MÉTIER

Produire également une documentation compréhensible par la SONASP.

Expliquer :

**Production → Expédition → Vente → Facture provisoire → Paiement → Assay → Conciliation → Ajustement fiscal → Facture définitive → Solde → Clôture.**

---

# 72. DIAGRAMMES

Produire des diagrammes Mermaid lorsque cela améliore la compréhension :

* architecture ;
* cycle de vente ;
* séquence de conciliation ;
* modèle financier ;
* modèle fiscal ;
* états de reconciliation ;
* relations entre entités.

---

# 73. INTERDICTIONS

Vous ne devez PAS :

* réécrire l’application from scratch ;
* remplacer arbitrairement le framework ;
* dupliquer des services existants ;
* casser les routes ;
* casser les APIs ;
* casser les migrations ;
* supprimer des données ;
* créer de faux soldes ;
* hardcoder des taxes ;
* hardcoder des prix ;
* utiliser des floats pour la finance ;
* cacher les erreurs ;
* contourner les permissions ;
* placer les règles métier uniquement dans le frontend ;
* considérer une compilation réussie comme preuve de fonctionnement ;
* créer seulement des écrans sans implémenter le backend ;
* mettre en place de faux boutons ;
* utiliser des données mockées en production ;
* terminer tant que des workflows essentiels sont incomplets.

---

# 74. MODE D’EXÉCUTION

Procéder de manière **ITÉRATIVE ET INCRÉMENTALE**, mais NE PAS demander à l’utilisateur à chaque étape :

> Voulez-vous que je continue ?

Vous êtes mandaté pour réaliser l’intégralité de la mission.

Vous devez arbitrer vous-même les décisions techniques raisonnables.

Une question utilisateur n’est nécessaire que lorsqu’une information métier indispensable ne peut réellement pas être déduite :

* du code ;
* des données ;
* du cahier des charges ;
* des contrats ;
* des factures specimen ;
* des règles existantes.

Sinon, prendre la décision professionnelle la plus sûre et la documenter.

---

# 75. PHASE 0 — DISCOVERY

Avant toute implémentation :

1. inventorier le repository ;
2. identifier stack ;
3. lancer l’application ;
4. analyser DB ;
5. analyser routes ;
6. analyser APIs ;
7. analyser portails ;
8. analyser RBAC ;
9. cartographier modules ;
10. identifier tests ;
11. comprendre nomenclature existante ;
12. analyser les factures specimen ;
13. analyser contrats ;
14. identifier dette technique.

Créer :

`docs/audit/EXISTING_PLATFORM_AUDIT.md`

---

# 76. PHASE 1 — MODÈLE MÉTIER CIBLE

Créer :

`docs/conciliation/DOMAIN_MODEL.md`

`docs/conciliation/WORKFLOWS.md`

`docs/conciliation/STATE_MACHINES.md`

`docs/conciliation/TAX_ENGINE.md`

`docs/conciliation/ACCOUNTING_LEDGER.md`

`docs/conciliation/RBAC.md`

Le modèle doit être compatible avec l’existant.

---

# 77. PHASE 2 — PLAN D’IMPLÉMENTATION

Créer :

`docs/conciliation/IMPLEMENTATION_PLAN.md`

Organiser le développement par incréments.

Ordre recommandé :

1. refactoring minimum préalable ;
2. référentiel fiscal ;
3. domaine ventes ;
4. contrats ;
5. facturation provisoire ;
6. paiements ;
7. assay ;
8. moteur conciliation ;
9. moteur ajustements ;
10. ledger fiscal ;
11. ledger commercial ;
12. avoirs ;
13. facture définitive ;
14. dashboards ;
15. sécurité ;
16. reporting ;
17. optimisation ;
18. tests complets.

---

# 78. PHASE 3 — IMPLÉMENTATION

Pour chaque incrément :

**ANALYSER → IMPLÉMENTER → MIGRER → TESTER → AUDITER → CORRIGER.**

Ne pas accumuler des anomalies pour la fin.

---

# 79. DEFINITION OF DONE PAR INCRÉMENT

Un incrément n’est terminé que si :

* code backend terminé ;
* frontend terminé ;
* DB terminée ;
* sécurité validée ;
* permissions validées ;
* tests unitaires passent ;
* tests intégration passent ;
* tests fonctionnels passent ;
* aucune régression connue ;
* aucun placeholder critique ;
* aucun TODO bloquant.

---

# 80. QUALITY GATES

À la fin de chaque phase, noter :

### Architecture /10

### Modèle de données /10

### Fonctionnel métier /10

### Fiscalité & Finance /10

### Sécurité /10

### UX/UI /10

### Performance /10

### Tests /10

### Maintenabilité /10

### Absence de régression /10

TOTAL /100.

---

# 81. OBJECTIF OBLIGATOIRE : 100/100

L’objectif final est :

# 100 / 100

Si l’auto-évaluation donne :

94/100

le travail n’est PAS terminé.

Identifier les 6 points manquants.

Créer une nouvelle itération.

Corriger.

Retester.

Réévaluer.

Continuer jusqu’à obtenir 100/100 sur la base d’éléments vérifiables.

IMPORTANT :

Ne jamais attribuer artificiellement 100/100.

Chaque point doit être justifié par :

* code ;
* tests ;
* inspection ;
* résultat observable.

---

# 82. TEST DE COHÉRENCE TRANSVERSE

Avant clôture, effectuer un audit transversal complet :

Une donnée créée par une Mine doit :

1. être correctement stockée ;
2. être visible au bon portail ;
3. apparaître dans le bon workflow ;
4. alimenter les bons calculs ;
5. être sécurisée ;
6. alimenter la facturation ;
7. alimenter la conciliation ;
8. alimenter les dashboards ;
9. alimenter les rapports ;
10. respecter l’audit trail.

Vérifier ces chaînes de bout en bout.

---

# 83. CONTRÔLE FINANCIER FINAL

Construire des tests d’invariants.

Exemples :

**Montant facture définitive**
doit être cohérent avec les éléments calculés.

**Total paiements alloués**
ne doit jamais dépasser ce qui est autorisé sans générer explicitement un trop-perçu.

**Avoir utilisé**
ne doit jamais dépasser son solde.

**Crédit fiscal utilisé**
ne doit jamais dépasser le crédit approuvé disponible.

**Solde client**
doit pouvoir être reconstruit depuis le ledger.

**Solde fiscal**
doit pouvoir être reconstruit depuis le ledger.

---

# 84. RAPPORT FINAL

Créer :

`docs/conciliation/FINAL_IMPLEMENTATION_REPORT.md`

avec :

* résumé exécutif ;
* architecture finale ;
* modules livrés ;
* migrations ;
* workflows ;
* captures/tests si infrastructure possible ;
* couverture de tests ;
* anomalies corrigées ;
* performances ;
* sécurité ;
* risques résiduels ;
* recommandations ;
* score final.

---

# 85. IMPORTANT : VÉRIFICATION DU CADRE JURIDIQUE

Les taux fiscaux mentionnés dans les spécifications fonctionnelles constituent des exigences métier initiales.

Ils ne doivent pas être considérés comme une justification juridique suffisante pour les coder définitivement.

Le Burkina Faso ayant fait évoluer son cadre minier et fiscal, concevoir le système pour supporter :

* nouvelles lois ;
* nouveaux décrets ;
* modification des seuils ;
* modification des taux ;
* changement d’assiette ;
* date d’entrée en vigueur ;
* régimes particuliers ;
* exemptions ;
* règles spécifiques selon acteur/opération.

La plateforme doit pouvoir absorber une évolution réglementaire **sans modification du code source** lorsque celle-ci consiste uniquement à changer un barème ou une règle paramétrable.

---

# 86. OBJECTIF MÉTIER FINAL

À l’issue de votre intervention, la SONASP doit disposer d’un système permettant de suivre de bout en bout :

**Production**

↓

**Expédition**

↓

**Vente**

↓

**Facturation provisoire**

↓

**Acompte / Paiement**

↓

**Analyse acheteur / Raffinerie**

↓

**Conciliation**

↓

**Recalcul poids + pureté + prix**

↓

**Valeur commerciale définitive**

↓

**Recalcul fiscal**

↓

**Écarts TVA / Royalties / FNDL**

↓

**Compte fiscal Mine**

↓

**Facture définitive**

↓

**Créance ou Trop-perçu**

↓

**Avoir / Paiement complémentaire / Compensation**

↓

**Clôture**

avec une traçabilité intégrale.

---

# 87. PRINCIPE DIRECTEUR

La Conciliation doit devenir la couche de vérité financière située entre :

**ce qui a été déclaré lors de l’expédition**

et

**ce qui est finalement reconnu, facturé, payé et fiscalisé après analyse de l’acheteur.**

Elle doit permettre à tout moment de répondre précisément à cinq questions :

1. **Combien d’or a réellement été reconnu ?**
2. **Quelle est la valeur définitive de la vente ?**
3. **Combien le client a-t-il déjà payé et combien reste-t-il à régler ou restituer ?**
4. **Combien la Mine devait-elle réellement au titre de chaque taxe et quel écart subsiste ?**
5. **Quelle écriture explique chaque franc du solde commercial ou fiscal ?**

Si la plateforme ne peut pas répondre à ces cinq questions avec une preuve et une piste d’audit, le module n’est pas considéré comme terminé.

---

# INSTRUCTION FINALE

Commencez immédiatement par l’audit complet du repository et de la base de données.

Ne commencez PAS par générer des écrans.

Comprenez d’abord :

**les données → les acteurs → les workflows → les règles → les transactions → les états → les dépendances.**

Ensuite seulement, implémentez.

Travaillez jusqu’à livraison intégrale.

Ne vous interrompez pas après chaque petite tâche pour demander la permission de continuer.

Ne laissez aucun workflow essentiel à moitié implémenté.

Ne considérez jamais :

> « le build passe »

comme une preuve de qualité.

La preuve finale doit être :

> **un workflow financier, fiscal et opérationnel complet, sécurisé, transactionnel, auditable, testé de bout en bout et sans régression, depuis l’expédition jusqu’à la clôture définitive de la vente et de ses conséquences fiscales.**
