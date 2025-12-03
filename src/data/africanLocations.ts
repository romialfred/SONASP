/**
 * Données géographiques pour l'Afrique de l'Ouest, Afrique du Sud et Guinée
 */

export interface Country {
  code: string;
  name: string;
  capital: string;
}

export interface City {
  name: string;
  country: string;
  isCapital: boolean;
}

export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
}

// Pays d'Afrique de l'Ouest + Afrique du Sud + Guinée
export const AFRICAN_COUNTRIES: Country[] = [
  // Afrique de l'Ouest
  { code: 'BJ', name: 'Bénin', capital: 'Porto-Novo' },
  { code: 'BF', name: 'Burkina Faso', capital: 'Ouagadougou' },
  { code: 'CV', name: 'Cap-Vert', capital: 'Praia' },
  { code: 'CI', name: 'Côte d\'Ivoire', capital: 'Yamoussoukro' },
  { code: 'GM', name: 'Gambie', capital: 'Banjul' },
  { code: 'GH', name: 'Ghana', capital: 'Accra' },
  { code: 'GN', name: 'Guinée', capital: 'Conakry' },
  { code: 'GW', name: 'Guinée-Bissau', capital: 'Bissau' },
  { code: 'LR', name: 'Liberia', capital: 'Monrovia' },
  { code: 'ML', name: 'Mali', capital: 'Bamako' },
  { code: 'MR', name: 'Mauritanie', capital: 'Nouakchott' },
  { code: 'NE', name: 'Niger', capital: 'Niamey' },
  { code: 'NG', name: 'Nigeria', capital: 'Abuja' },
  { code: 'SN', name: 'Sénégal', capital: 'Dakar' },
  { code: 'SL', name: 'Sierra Leone', capital: 'Freetown' },
  { code: 'TG', name: 'Togo', capital: 'Lomé' },

  // Afrique du Sud
  { code: 'ZA', name: 'South Africa', capital: 'Pretoria' },
];

// Villes capitales et grandes villes
export const AFRICAN_CITIES: City[] = [
  // Mali
  { name: 'Bamako', country: 'Mali', isCapital: true },

  // Guinée
  { name: 'Conakry', country: 'Guinée', isCapital: true },

  // Côte d\'Ivoire
  { name: 'Yamoussoukro', country: 'Côte d\'Ivoire', isCapital: true },
  { name: 'Abidjan', country: 'Côte d\'Ivoire', isCapital: false },

  // Ghana
  { name: 'Accra', country: 'Ghana', isCapital: true },

  // Nigeria
  { name: 'Abuja', country: 'Nigeria', isCapital: true },
  { name: 'Lagos', country: 'Nigeria', isCapital: false },

  // Sénégal
  { name: 'Dakar', country: 'Sénégal', isCapital: true },

  // Burkina Faso
  { name: 'Ouagadougou', country: 'Burkina Faso', isCapital: true },

  // Niger
  { name: 'Niamey', country: 'Niger', isCapital: true },

  // Bénin
  { name: 'Porto-Novo', country: 'Bénin', isCapital: true },
  { name: 'Cotonou', country: 'Bénin', isCapital: false },

  // Togo
  { name: 'Lomé', country: 'Togo', isCapital: true },

  // Liberia
  { name: 'Monrovia', country: 'Liberia', isCapital: true },

  // Sierra Leone
  { name: 'Freetown', country: 'Sierra Leone', isCapital: true },

  // Mauritanie
  { name: 'Nouakchott', country: 'Mauritanie', isCapital: true },

  // Guinée-Bissau
  { name: 'Bissau', country: 'Guinée-Bissau', isCapital: true },

  // Gambie
  { name: 'Banjul', country: 'Gambie', isCapital: true },

  // Cap-Vert
  { name: 'Praia', country: 'Cap-Vert', isCapital: true },

  // South Africa
  { name: 'Pretoria', country: 'South Africa', isCapital: true },
  { name: 'Johannesburg', country: 'South Africa', isCapital: false },
  { name: 'Cape Town', country: 'South Africa', isCapital: false },
  { name: 'Durban', country: 'South Africa', isCapital: false },
];

// Aéroports majeurs d'Afrique de l'Ouest, Afrique du Sud et Guinée
export const AFRICAN_AIRPORTS: Airport[] = [
  // Mali
  {
    code: 'BKO',
    name: 'Bamako-Sénou International Airport',
    city: 'Bamako',
    country: 'Mali'
  },

  // Guinée (Conakry)
  {
    code: 'CKY',
    name: 'Conakry International Airport (Gbessia)',
    city: 'Conakry',
    country: 'Guinée'
  },

  // Côte d'Ivoire
  {
    code: 'ABJ',
    name: 'Félix-Houphouët-Boigny International Airport',
    city: 'Abidjan',
    country: 'Côte d\'Ivoire'
  },

  // Ghana
  {
    code: 'ACC',
    name: 'Kotoka International Airport',
    city: 'Accra',
    country: 'Ghana'
  },

  // Nigeria
  {
    code: 'ABV',
    name: 'Nnamdi Azikiwe International Airport',
    city: 'Abuja',
    country: 'Nigeria'
  },
  {
    code: 'LOS',
    name: 'Murtala Muhammed International Airport',
    city: 'Lagos',
    country: 'Nigeria'
  },

  // Sénégal
  {
    code: 'DSS',
    name: 'Blaise Diagne International Airport',
    city: 'Dakar',
    country: 'Sénégal'
  },

  // Burkina Faso
  {
    code: 'OUA',
    name: 'Ouagadougou Airport',
    city: 'Ouagadougou',
    country: 'Burkina Faso'
  },

  // Niger
  {
    code: 'NIM',
    name: 'Diori Hamani International Airport',
    city: 'Niamey',
    country: 'Niger'
  },

  // Bénin
  {
    code: 'COO',
    name: 'Cadjehoun Airport',
    city: 'Cotonou',
    country: 'Bénin'
  },

  // Togo
  {
    code: 'LFW',
    name: 'Gnassingbé Eyadéma International Airport',
    city: 'Lomé',
    country: 'Togo'
  },

  // Liberia
  {
    code: 'ROB',
    name: 'Roberts International Airport',
    city: 'Monrovia',
    country: 'Liberia'
  },

  // Sierra Leone
  {
    code: 'FNA',
    name: 'Lungi International Airport',
    city: 'Freetown',
    country: 'Sierra Leone'
  },

  // South Africa
  {
    code: 'JNB',
    name: 'OR Tambo International Airport',
    city: 'Johannesburg',
    country: 'South Africa'
  },
  {
    code: 'CPT',
    name: 'Cape Town International Airport',
    city: 'Cape Town',
    country: 'South Africa'
  },
  {
    code: 'DUR',
    name: 'King Shaka International Airport',
    city: 'Durban',
    country: 'South Africa'
  },
  {
    code: 'PRY',
    name: 'Wonderboom Airport',
    city: 'Pretoria',
    country: 'South Africa'
  },
];

// Fonctions utilitaires
export const getCountryByName = (name: string): Country | undefined => {
  return AFRICAN_COUNTRIES.find(c => c.name.toLowerCase() === name.toLowerCase());
};

export const getCitiesByCountry = (country: string): City[] => {
  return AFRICAN_CITIES.filter(c => c.country === country);
};

export const getAirportsByCountry = (country: string): Airport[] => {
  return AFRICAN_AIRPORTS.filter(a => a.country === country);
};

export const getAirportsByCity = (city: string): Airport[] => {
  return AFRICAN_AIRPORTS.filter(a => a.city === city);
};
