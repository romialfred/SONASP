export const dailyProductionFieldGuides = {
  production_date: {
    title: 'Production Date',
    description: 'Date de la production journalière',
    tips: [
      'Sélectionnez la date de production',
      'Une seule entrée par date recommandée pour la clarté',
      'Les enregistrements rétroactifs nécessitent une justification'
    ],
    examples: ['2025-11-10'],
    required: true
  },
  bullion_grams: {
    title: 'Bullion (g)',
    description: 'Poids total du bullion produit en grammes',
    tips: [
      'Entrez le poids brut en grammes',
      'Utilisez une balance calibrée',
      'Arrondissez à 2 décimales maximum',
      'Vérifiez la cohérence avec les barres produites'
    ],
    examples: ['11270', '11602'],
    formula: 'Poids brut mesuré après fusion',
    required: true
  },
  estimated_fineness_pct: {
    title: 'Estimated Fineness (%)',
    description: 'Pourcentage estimé de pureté de l\'or',
    tips: [
      'Basé sur l\'analyse préliminaire du laboratoire',
      'Généralement entre 85% et 95%',
      'Sera confirmé par l\'assay final',
      'Impact direct sur le calcul de l\'or pur'
    ],
    examples: ['92.1', '91.5', '93.2'],
    formula: '% mesuré par analyse XRF ou fire assay préliminaire',
    validation: 'Doit être entre 50% et 100%',
    required: true
  },
  pure_gold_grams: {
    title: 'Pure Gold (g)',
    description: 'Poids d\'or pur calculé automatiquement',
    tips: [
      'Calcul automatique basé sur le bullion et la finesse',
      'Champ en lecture seule',
      'Représente l\'or récupérable estimé'
    ],
    formula: 'Bullion (g) × Fineness (%) ÷ 100',
    examples: ['10,375', '10,685'],
    readOnly: true
  },
  estimated_oz: {
    title: 'Estimated Oz',
    description: 'Onces troy d\'or pur (calculé automatiquement)',
    tips: [
      'Conversion automatique en onces troy',
      'Champ en lecture seule',
      'Utilisé pour les rapports et comparaisons',
      '1 oz troy = 31.1035 grammes'
    ],
    formula: 'Pure Gold (g) ÷ 31.1035',
    examples: ['334', '344', '677'],
    readOnly: true
  },
  bar_reference: {
    title: 'Bar Reference',
    description: 'Référence de la barre de bullion',
    tips: [
      'Code unique d\'identification de la barre',
      'Format recommandé: PREFIX-NNNN',
      'Exemples: HUMSMK-1204, HUMSMK-1205',
      'Facilite la traçabilité'
    ],
    examples: ['HUMSMK-1204', 'HUMSMK-1205', 'KMSA-0891'],
    pattern: 'XXXXX-NNNN',
    required: false
  },
  notes: {
    title: 'Notes',
    description: 'Notes supplémentaires sur la production',
    tips: [
      'Incidents ou observations particulières',
      'Conditions de production',
      'Problèmes techniques rencontrés',
      'Toute information pertinente'
    ],
    examples: [
      'Production normale',
      'Finesse légèrement inférieure due à nouveau minerai',
      'Équipement de fusion calibré'
    ],
    required: false
  }
};

export const forecastFieldGuides = {
  forecast_date: {
    title: 'Forecast Date',
    description: 'Date pour laquelle la prévision est établie',
    tips: [
      'Date de référence pour la période',
      'Pour les prévisions hebdomadaires: premier jour de la semaine',
      'Pour les prévisions mensuelles: premier jour du mois'
    ],
    required: true
  },
  period_type: {
    title: 'Period Type',
    description: 'Type de période de prévision',
    tips: [
      'Daily: Prévision quotidienne',
      'Weekly: Prévision hebdomadaire (7 jours)',
      'Monthly: Prévision mensuelle',
      'Yearly: Prévision annuelle'
    ],
    options: [
      { value: 'daily', label: 'Daily (Journalier)' },
      { value: 'weekly', label: 'Weekly (Hebdomadaire)' },
      { value: 'monthly', label: 'Monthly (Mensuel)' },
      { value: 'yearly', label: 'Yearly (Annuel)' }
    ],
    required: true
  },
  forecast_oz: {
    title: 'Forecast (Oz)',
    description: 'Production prévue en onces troy',
    tips: [
      'Basé sur les performances historiques',
      'Conditions normales d\'opération',
      'Ajustable selon les circonstances',
      'Sert de référence pour les comparaisons'
    ],
    examples: ['340', '732', '2368'],
    required: false
  },
  budget_oz: {
    title: 'Budget (Oz)',
    description: 'Objectif budgétaire en onces troy',
    tips: [
      'Objectif fixé par la direction',
      'Généralement supérieur au forecast',
      'Utilisé pour l\'évaluation de performance',
      'Base pour les bonus et incentives'
    ],
    examples: ['350', '807', '2735'],
    required: false
  },
  notes: {
    title: 'Notes',
    description: 'Notes sur les prévisions',
    tips: [
      'Hypothèses utilisées',
      'Facteurs pris en compte',
      'Ajustements par rapport aux périodes précédentes'
    ],
    required: false
  }
};
