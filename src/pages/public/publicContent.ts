export type PublicLocale = 'fr' | 'en';

export type PublicFeature = {
  title: string;
  description: string;
  icon: string;
};

type PublicContent = {
  localeName: string;
  navigation: {
    platform: string;
    mines: string;
    process: string;
    security: string;
    news: string;
    login: string;
    portal: string;
    about: string;
    assistance: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    primary: string;
    secondary: string;
    reassurance: string[];
  };
  valueChain: {
    eyebrow: string;
    title: string;
    description: string;
    items: PublicFeature[];
  };
  portal: {
    eyebrow: string;
    title: string;
    description: string;
    cta: string;
    families: Array<{ title: string; items: string[] }>;
  };
  process: {
    eyebrow: string;
    title: string;
    description: string;
    steps: Array<{ title: string; description: string }>;
  };
  contracts: {
    eyebrow: string;
    title: string;
    description: string;
    items: string[];
  };
  payments: {
    eyebrow: string;
    title: string;
    description: string;
    items: string[];
  };
  security: {
    eyebrow: string;
    title: string;
    description: string;
    items: PublicFeature[];
  };
  benefits: {
    minesTitle: string;
    minesDescription: string;
    minesItems: string[];
    stateTitle: string;
    stateDescription: string;
    stateItems: string[];
  };
  ecosystem: {
    eyebrow: string;
    title: string;
    description: string;
    actors: string[];
  };
  news: {
    eyebrow: string;
    title: string;
    description: string;
    all: string;
    empty: string;
    loading: string;
  };
  assistance: {
    eyebrow: string;
    title: string;
    description: string;
    help: string;
    password: string;
    incident: string;
  };
  finalCta: {
    title: string;
    description: string;
    portal: string;
    assistance: string;
  };
  footer: {
    description: string;
    institution: string;
    platform: string;
    legal: string;
    rights: string;
  };
};

export const publicContent: Record<PublicLocale, PublicContent> = {
  fr: {
    localeName: 'Français',
    navigation: {
      platform: 'La plateforme',
      mines: 'Les acteurs',
      process: 'La traçabilité',
      security: 'Les garanties',
      news: 'Actualités',
      login: 'Connexion',
      portal: 'Connexion',
      about: 'À propos',
      assistance: 'Assistance',
    },
    hero: {
      eyebrow: 'Une plateforme de la Présidence du Faso',
      title: 'Une filière connectée. Une richesse mieux maîtrisée.',
      description:
        'Faso SANAMA réunit les acteurs du secteur minier pour tracer la production, suivre les échanges et éclairer la décision publique.',
      primary: 'Accéder à mon espace',
      secondary: 'Découvrir la plateforme',
      reassurance: ['Accès sécurisé', 'Données souveraines', 'Opérations auditées'],
    },
    valueChain: {
      eyebrow: 'Chaîne de valeur',
      title: 'Une plateforme unique pour toute la chaîne de valeur',
      description:
        'Des opérations structurées, de la déclaration initiale au pilotage consolidé.',
      items: [
        {
          title: 'Déclarer',
          description: 'Déclarez votre production dans un cadre simple, structuré et sécurisé.',
          icon: 'file-input',
        },
        {
          title: 'Collecter',
          description: 'Planifiez les expéditions et suivez les quantités collectées avec la SONASP.',
          icon: 'package-check',
        },
        {
          title: 'Vendre',
          description: 'Suivez les achats, les ventes, les factures et les conditions commerciales.',
          icon: 'hand-coins',
        },
        {
          title: 'Piloter',
          description: 'Contrôlez vos engagements, vos paiements, vos documents et vos indicateurs.',
          icon: 'chart-no-axes-combined',
        },
      ],
    },
    portal: {
      eyebrow: 'Portail Mine',
      title: 'Un espace sécurisé, pensé pour chaque mine',
      description:
        'Prévisions, analyses, expéditions, contrats et paiements : chaque équipe retrouve ses dossiers et ses échanges avec la SONASP dans un espace clair, conçu pour le travail quotidien.',
      cta: 'Découvrir le Portail Mine',
      families: [
        {
          title: 'Production & Expédition',
          items: ['Gestion des prévisions de production', 'Déclaration de production', 'Analyse Labo', 'Enlèvement & Expédition'],
        },
        {
          title: 'Contrats et engagements',
          items: ['Contrats et avenants', 'Engagements mensuels', 'Réquisitions', 'Écarts et régularisations'],
        },
        {
          title: 'Facturation et paiements',
          items: ['Achats SONASP', 'Factures et acomptes', 'Paiements et soldes', 'Justificatifs de règlement'],
        },
        {
          title: 'Documents et conformité',
          items: ['Sites et contacts de la mine', 'Accès de l’équipe', 'Dossiers partagés', 'Messages et notifications'],
        },
      ],
    },
    process: {
      eyebrow: 'Processus intégré',
      title: 'Une chaîne numérique continue, de la mine au paiement',
      description:
        'Chaque étape alimente un historique contrôlable et limite les ruptures d’information.',
      steps: [
        { title: 'Déclaration', description: 'Enregistrement structuré de la production.' },
        { title: 'Planification', description: 'Organisation de la collecte ou de l’expédition.' },
        { title: 'Enlèvement', description: 'Suivi du départ et de la prise en charge.' },
        { title: 'Réception', description: 'Pesée et constat à l’arrivée.' },
        { title: 'Analyse', description: 'Contrôle de la teneur et rapprochement.' },
        { title: 'Validation', description: 'Validation de l’achat selon le processus autorisé.' },
        { title: 'Facturation', description: 'Émission ou transmission des pièces financières.' },
        { title: 'Paiement', description: 'Suivi des acomptes, soldes et justificatifs.' },
        { title: 'Affectation', description: 'Vente ou affectation du stock validé.' },
      ],
    },
    contracts: {
      eyebrow: 'Contrats et engagements',
      title: 'Des engagements contractuels suivis en temps réel',
      description:
        'Les obligations, réalisations et échéances sont réunies dans une lecture commune entre la mine et la SONASP.',
      items: [
        'Contrats de fourniture et avenants',
        'Quantités, teneurs et tolérances',
        'Échéanciers et expéditions réalisées',
        'Reports, dépassements et défauts',
        'Renouvellements et réquisitions exceptionnelles',
      ],
    },
    payments: {
      eyebrow: 'Factures et paiements',
      title: 'Une visibilité complète sur les factures et les paiements',
      description:
        'Des statuts lisibles et des justificatifs rattachés aux opérations pour faciliter le rapprochement financier.',
      items: [
        'Factures générées, transmises ou en attente',
        'Acomptes, paiements partiels et soldes',
        'Comptes bancaires validés',
        'Preuves de paiement, MT103 et messages SWIFT',
        'Historique et rapprochement',
      ],
    },
    security: {
      eyebrow: 'Sécurité et souveraineté',
      title: 'Des données stratégiques protégées et maîtrisées',
      description:
        'La plateforme applique des contrôles techniques et organisationnels adaptés à la sensibilité des opérations.',
      items: [
        { title: 'Accès maîtrisés', description: 'Droits par rôle et périmètre de société, avec séparation des responsabilités.', icon: 'key-round' },
        { title: 'Traçabilité', description: 'Historique des opérations, validations et actions sensibles.', icon: 'list-checks' },
        { title: 'Protection des échanges', description: 'Échanges chiffrés et contrôles appliqués aux documents financiers.', icon: 'shield-check' },
        { title: 'Continuité', description: 'Sauvegardes, supervision et procédures de disponibilité prévues dans l’exploitation.', icon: 'database-backup' },
      ],
    },
    benefits: {
      minesTitle: 'Plus de visibilité, moins d’incertitude',
      minesDescription: 'Un point d’accès central pour préparer les opérations et suivre les échanges avec la SONASP.',
      minesItems: ['Engagements et quantités', 'Résultats d’analyse', 'Factures et paiements', 'Justificatifs et notifications', 'Historique complet'],
      stateTitle: 'Une vision consolidée au service de la décision nationale',
      stateDescription: 'Une lecture institutionnelle des flux autorisés, sans exposer les données sensibles au public.',
      stateItems: ['Production et collectes', 'Achats, stocks et ventes', 'Recettes et redevances', 'Rapports officiels', 'Aide à la décision'],
    },
    ecosystem: {
      eyebrow: 'Écosystème et rayonnement international',
      title: 'La SONASP, pivot national vers les marchés internationaux',
      description:
        'De la production nationale aux débouchés internationaux, la SONASP centralise les flux autorisés et coordonne les fonctions de contrôle, de traçabilité et de valorisation.',
      actors: ['Mines industrielles', 'Mines semi-mécanisées', 'Artisans miniers', 'Laboratoires', 'Logistique', 'Douanes', 'Raffineries', 'Finance', 'Institutions de tutelle'],
    },
    news: {
      eyebrow: 'Actualités et publications',
      title: 'Les informations officielles de la plateforme',
      description: 'Communiqués, procédures, guides et interruptions programmées publiés par les équipes habilitées.',
      all: 'Voir toutes les publications',
      empty: 'Aucune publication n’est disponible pour le moment.',
      loading: 'Chargement des publications…',
    },
    assistance: {
      eyebrow: 'Assistance',
      title: 'Une aide adaptée à chaque situation',
      description: 'Retrouvez les guides essentiels ou transmettez une demande à l’équipe d’assistance.',
      help: 'Consulter le centre d’aide',
      password: 'Récupérer mon mot de passe',
      incident: 'Déclarer un incident',
    },
    finalCta: {
      title: 'Accédez à votre espace et pilotez vos opérations avec la SONASP',
      description: 'Le Portail Mine centralise vos déclarations, vos engagements, vos expéditions, vos factures, vos paiements et vos documents.',
      portal: 'Portail SONASP',
      assistance: 'Contacter l’assistance',
    },
    footer: {
      description: 'Faso SANAMA, plateforme de la Présidence du Faso pour la traçabilité du secteur minier. La performance minière au service du citoyen.',
      institution: 'Institution',
      platform: 'Plateforme',
      legal: 'Informations légales',
      rights: 'Tous droits réservés.',
    },
  },
  en: {
    localeName: 'English',
    navigation: {
      platform: 'The platform',
      mines: 'Mining companies',
      process: 'Process',
      security: 'Security',
      news: 'News',
      login: 'Sign in',
      portal: 'SONASP Portal',
      about: 'About',
      assistance: 'Support',
    },
    hero: {
      eyebrow: 'National gold collection and sales platform',
      title: 'Burkina Faso’s gold, collected and valued within a sovereign framework.',
      description: 'The secure platform connecting mining companies, SONASP and public institutions to manage production, purchases, sales and payments.',
      primary: 'SONASP Portal',
      secondary: 'Discover the platform',
      reassurance: ['Secure access', 'Sovereign data', 'Auditable operations'],
    },
    valueChain: {
      eyebrow: 'Value chain',
      title: 'One platform for the entire value chain',
      description: 'Structured operations from the initial declaration to consolidated oversight.',
      items: [
        { title: 'Declare', description: 'Report production within a simple, structured and secure framework.', icon: 'file-input' },
        { title: 'Collect', description: 'Plan shipments and monitor quantities collected with SONASP.', icon: 'package-check' },
        { title: 'Sell', description: 'Track purchases, sales, invoices and commercial conditions.', icon: 'hand-coins' },
        { title: 'Oversee', description: 'Control commitments, payments, documents and indicators.', icon: 'chart-no-axes-combined' },
      ],
    },
    portal: {
      eyebrow: 'Mine Portal',
      title: 'A secure workspace designed for every mine',
      description: 'Forecasts, assays, shipments, contracts and payments: every team finds its records and exchanges with SONASP in a clear workspace designed for everyday work.',
      cta: 'Discover the Mine Portal',
      families: [
        { title: 'Production & Shipment', items: ['Production forecast management', 'Production reporting', 'Laboratory assay', 'Pickup & shipment'] },
        { title: 'Contracts and commitments', items: ['Contracts and amendments', 'Monthly commitments', 'Requisitions', 'Exceptions and corrections'] },
        { title: 'Invoicing and payments', items: ['SONASP purchases', 'Invoices and advances', 'Payments and balances', 'Settlement evidence'] },
        { title: 'Documents and compliance', items: ['Mine sites and contacts', 'Team access', 'Shared records', 'Messages and notifications'] },
      ],
    },
    process: {
      eyebrow: 'Integrated process',
      title: 'A continuous digital chain from mine to payment',
      description: 'Every step contributes to a controlled history and reduces information gaps.',
      steps: [
        { title: 'Declaration', description: 'Structured production recording.' },
        { title: 'Planning', description: 'Collection or shipment scheduling.' },
        { title: 'Pickup', description: 'Departure and custody monitoring.' },
        { title: 'Reception', description: 'Weighing and receipt control.' },
        { title: 'Assay', description: 'Grade control and reconciliation.' },
        { title: 'Approval', description: 'Purchase approval under the authorized process.' },
        { title: 'Invoicing', description: 'Financial document generation or submission.' },
        { title: 'Payment', description: 'Advance, balance and evidence monitoring.' },
        { title: 'Allocation', description: 'Sale or allocation of approved stock.' },
      ],
    },
    contracts: {
      eyebrow: 'Contracts and commitments',
      title: 'Contractual commitments monitored in real time',
      description: 'Obligations, performance and deadlines are combined into a shared view for the mine and SONASP.',
      items: ['Supply contracts and amendments', 'Quantities, grades and tolerances', 'Schedules and completed shipments', 'Carryovers, overruns and defaults', 'Renewals and exceptional requisitions'],
    },
    payments: {
      eyebrow: 'Invoices and payments',
      title: 'Complete visibility over invoices and payments',
      description: 'Clear statuses and supporting evidence attached to operations help financial reconciliation.',
      items: ['Generated, submitted or pending invoices', 'Advances, partial payments and balances', 'Validated bank accounts', 'Payment evidence, MT103 and SWIFT messages', 'History and reconciliation'],
    },
    security: {
      eyebrow: 'Security and sovereignty',
      title: 'Strategic data protected and controlled',
      description: 'The platform applies technical and organizational controls suited to sensitive operations.',
      items: [
        { title: 'Controlled access', description: 'Rights by role and company scope, with separation of duties.', icon: 'key-round' },
        { title: 'Traceability', description: 'History of operations, approvals and sensitive actions.', icon: 'list-checks' },
        { title: 'Protected exchanges', description: 'Encrypted exchanges and controls for financial documents.', icon: 'shield-check' },
        { title: 'Continuity', description: 'Backups, supervision and availability procedures planned for operations.', icon: 'database-backup' },
      ],
    },
    benefits: {
      minesTitle: 'More visibility, less uncertainty',
      minesDescription: 'One access point to prepare operations and monitor exchanges with SONASP.',
      minesItems: ['Commitments and quantities', 'Assay results', 'Invoices and payments', 'Evidence and notifications', 'Complete history'],
      stateTitle: 'A consolidated view for national decision-making',
      stateDescription: 'An institutional view of authorized flows without exposing sensitive information publicly.',
      stateItems: ['Production and collections', 'Purchases, stocks and sales', 'Revenue and royalties', 'Official reports', 'Decision support'],
    },
    ecosystem: {
      eyebrow: 'Ecosystem and international reach',
      title: 'SONASP, the national hub to international markets',
      description: 'From national production to international outlets, SONASP centralizes authorized flows and coordinates control, traceability and value creation.',
      actors: ['Industrial mines', 'Semi-mechanized mines', 'Artisanal miners', 'Laboratories', 'Logistics', 'Customs', 'Refineries', 'Finance', 'Supervisory institutions'],
    },
    news: {
      eyebrow: 'News and publications',
      title: 'Official platform information',
      description: 'Notices, procedures, guides and scheduled interruptions published by authorized teams.',
      all: 'View all publications',
      empty: 'No publications are available at this time.',
      loading: 'Loading publications…',
    },
    assistance: {
      eyebrow: 'Support',
      title: 'Help for every situation',
      description: 'Find essential guides or submit a request to the support team.',
      help: 'Open the help center',
      password: 'Recover my password',
      incident: 'Report an incident',
    },
    finalCta: {
      title: 'Access your workspace and manage operations with SONASP',
      description: 'The Mine Portal centralizes declarations, commitments, shipments, invoices, payments and documents.',
      portal: 'SONASP Portal',
      assistance: 'Contact support',
    },
    footer: {
      description: 'A national digital infrastructure dedicated to gold collection, purchases, sales and operations monitoring.',
      institution: 'Institution',
      platform: 'Platform',
      legal: 'Legal information',
      rights: 'All rights reserved.',
    },
  },
};
