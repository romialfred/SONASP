import { BarChart3, Building2, ClipboardCheck, Factory, FileCheck2, FlaskConical, Gem, Landmark, MapPin, Pickaxe, ReceiptText, ShieldCheck, Truck, Users, WalletCards, type LucideIcon } from 'lucide-react';

export type FasoActor = {
  id: string; label: string; role: string; title: string; description: string; icon: LucideIcon;
  modules: Array<{ title: string; description: string; icon: LucideIcon }>;
  outcome: string;
};

/** Présentation publique des fonctions existantes, sans données opérationnelles. */
export const fasoActors: FasoActor[] = [
  {
    id: 'presidence', label: 'Présidence du Faso', role: 'Pilotage national', icon: Landmark,
    title: 'Une vision d’ensemble pour la décision publique.',
    description: 'Rapprocher la production, les flux commerciaux et les informations financières pour suivre la performance du secteur minier à l’échelle nationale.',
    modules: [
      { title: 'Vue exécutive', description: 'Production, prévisions et performance des sociétés.', icon: BarChart3 },
      { title: 'Lecture financière', description: 'Contrats, factures, règlements et rapprochements.', icon: WalletCards },
      { title: 'Rapports et alertes', description: 'Une information consolidée pour orienter le suivi.', icon: ShieldCheck },
    ],
    outcome: 'Un pilotage stratégique, distinct de la gestion quotidienne des opérations.',
  },
  {
    id: 'mines', label: 'Sociétés minières', role: 'Production industrielle', icon: Factory,
    title: 'De la production à l’expédition, un dossier continu.',
    description: 'Chaque société dispose d’un espace dédié pour ses prévisions, ses déclarations, ses contrats et le suivi commercial de sa production.',
    modules: [
      { title: 'Production et prévisions', description: 'Déclarations, disponibilités et planification des volumes.', icon: Factory },
      { title: 'Contrats et ventes', description: 'Conditions commerciales, engagements et demandes d’achat.', icon: FileCheck2 },
      { title: 'Expéditions et règlements', description: 'Analyses, documents, factures et suivi des paiements.', icon: Truck },
    ],
    outcome: 'Les ventes à la SONASP reposent sur les conditions contractuelles acceptées par la société minière.',
  },
  {
    id: 'artisans', label: 'Artisans et sites', role: 'Identification et formalisation', icon: Pickaxe,
    title: 'Donner à chaque acteur une place dans la filière.',
    description: 'L’identification des artisans et des sites relie les dossiers administratifs, les affiliations et les opérations du marché artisanal.',
    modules: [
      { title: 'Sites artisanaux', description: 'Localisation, catégorie formalisée ou non formalisée, dossier AEA.', icon: MapPin },
      { title: 'Affiliations et cartes', description: 'Identité, droits d’adhésion, validité et suivi des cartes.', icon: Users },
      { title: 'Ventes et paiements', description: 'Origine de la production et historique des transactions.', icon: WalletCards },
    ],
    outcome: 'Des dossiers suivis par les gestionnaires habilités, tout au long de leur validité.',
  },
  {
    id: 'comptoirs', label: 'Comptoirs d’or', role: 'Achat et consolidation', icon: Building2,
    title: 'Structurer les achats et suivre chaque lot.',
    description: 'Un portail pour les achats locaux, les relations avec les collecteurs, les pièces fiscales, les paiements et la constitution des stocks.',
    modules: [
      { title: 'Dossier du comptoir', description: 'Société, responsables et autorisations documentées.', icon: FileCheck2 },
      { title: 'Achats et validations', description: 'Ventes soumises par les collecteurs et règlements autorisés.', icon: ClipboardCheck },
      { title: 'Stocks et cessions', description: 'Lots disponibles, mouvements et ventes à la SONASP.', icon: Gem },
    ],
    outcome: 'Le circuit des comptoirs organise la cession de leur or à la SONASP.',
  },
  {
    id: 'collecteurs', label: 'Collecteurs', role: 'Lien avec le terrain', icon: Users,
    title: 'Documenter la transaction dès la collecte.',
    description: 'Rattaché à un comptoir ou à la SONASP, le collecteur intervient dans son périmètre autorisé et enregistre les ventes des artisans.',
    modules: [
      { title: 'Rattachements', description: 'Sites de collecte, artisans et organisme représenté.', icon: MapPin },
      { title: 'Ventes à approuver', description: 'Saisie des opérations et transmission à l’organisme responsable.', icon: ClipboardCheck },
      { title: 'Paiements habilités', description: 'Règlement selon délégation et conservation des justificatifs.', icon: WalletCards },
    ],
    outcome: 'La saisie, l’approbation et le paiement restent associés à des responsabilités distinctes.',
  },
  {
    id: 'dgmg', label: 'DGMG', role: 'Supervision réglementaire', icon: ShieldCheck,
    title: 'Relier les registres à la réalité des opérations.',
    description: 'La Direction générale des mines et de la géologie dispose d’une lecture transversale des sites, des acteurs et des déclarations de production.',
    modules: [
      { title: 'Registres nationaux', description: 'Sites, sociétés minières, artisans, comptoirs et collecteurs.', icon: Building2 },
      { title: 'Déclarations et conformité', description: 'Suivi de l’activité, des dossiers et des points de vigilance.', icon: ClipboardCheck },
      { title: 'Validations réglementaires', description: 'Décisions et pièces de contrôle selon les habilitations.', icon: FileCheck2 },
    ],
    outcome: 'Un même socle d’information pour documenter la supervision du secteur.',
  },
  {
    id: 'finances', label: 'Finances et DGI', role: 'Suivi fiscal', icon: ReceiptText,
    title: 'Rapprocher l’activité minière et les recettes.',
    description: 'Le ministère chargé des Finances et la Direction générale des impôts s’appuient sur les opérations documentées pour le suivi fiscal de la filière.',
    modules: [
      { title: 'Assiette et fiscalité', description: 'Opérations, TVA, taxes et redevances associées.', icon: ReceiptText },
      { title: 'Paiements fiscaux', description: 'Échéances, règlements et montants restant à rapprocher.', icon: WalletCards },
      { title: 'Contrôle des écarts', description: 'Analyse des différences et suivi du recouvrement.', icon: BarChart3 },
    ],
    outcome: 'Une lecture fiscale reliée aux transactions et à leurs pièces justificatives.',
  },
  {
    id: 'sonasp', label: 'SONASP', role: 'Opérateur national', icon: Gem,
    title: 'Acheter, consolider et valoriser l’or du Burkina.',
    description: 'La SONASP intervient comme acteur de la filière. Son espace rassemble les achats, le contrôle de la matière, les stocks et la commercialisation.',
    modules: [
      { title: 'Achats et contrats', description: 'Acquisitions auprès des comptoirs et relations contractuelles avec les mines.', icon: FileCheck2 },
      { title: 'Consolidation et raffinage', description: 'Analyses, lots, stocks et transformations de la matière.', icon: FlaskConical },
      { title: 'Commercialisation', description: 'Ventes, expéditions, facturation et paiements.', icon: Truck },
    ],
    outcome: 'Un rôle commercial au sein de Faso SANAMA, plateforme de la Présidence du Faso.',
  },
];

export const fasoTraceability = [
  { id: 'production', title: 'Production', icon: Pickaxe, heading: 'Identifier l’origine.', description: 'Relier la production déclarée à une société minière ou à un site artisanal et à ses acteurs enregistrés.', evidence: ['Site et acteur', 'Déclaration', 'Quantité produite'] },
  { id: 'collecte', title: 'Collecte', icon: Users, heading: 'Documenter le premier échange.', description: 'Associer l’artisan, le collecteur et l’organisme de rattachement à la transaction soumise pour approbation.', evidence: ['Vendeur identifié', 'Collecteur habilité', 'Vente soumise'] },
  { id: 'controle', title: 'Contrôle', icon: FlaskConical, heading: 'Caractériser la matière.', description: 'Réunir les pesées, les analyses et les justificatifs utiles à la validation de la matière et de son dossier.', evidence: ['Poids', 'Teneur', 'Pièces de contrôle'] },
  { id: 'transaction', title: 'Achat et vente', icon: FileCheck2, heading: 'Formaliser les engagements.', description: 'Conserver les conditions de l’opération, les validations et les documents associés à la vente et à son règlement.', evidence: ['Accord commercial', 'Facture', 'Paiement'] },
  { id: 'stock', title: 'Stocks et lots', icon: Gem, heading: 'Suivre la matière disponible.', description: 'Constituer les lots et rattacher les mouvements de stock aux opérations qui les justifient.', evidence: ['Référence du lot', 'Entrées et sorties', 'Solde disponible'] },
  { id: 'expedition', title: 'Expédition', icon: Truck, heading: 'Accompagner chaque mouvement.', description: 'Réunir les documents et les validations nécessaires au suivi des enlèvements et des expéditions.', evidence: ['Lot expédié', 'Documents', 'Suivi du mouvement'] },
  { id: 'raffinage', title: 'Raffinage', icon: FlaskConical, heading: 'Conserver le lien après transformation.', description: 'Rapprocher les lots confiés au raffinage des résultats d’analyse et de la matière obtenue.', evidence: ['Lot d’origine', 'Résultat d’analyse', 'Matière raffinée'] },
  { id: 'fiscalite', title: 'Fiscalité', icon: ReceiptText, heading: 'Relier les flux aux recettes publiques.', description: 'Rapprocher les opérations, les montants fiscaux et les règlements pour suivre les échéances et les écarts.', evidence: ['Assiette documentée', 'Taxes et redevances', 'Recouvrement'] },
];
