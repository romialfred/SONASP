/**
 * Données géographiques pour l'Afrique de l'Ouest, Afrique du Sud et Guinée
 */

export interface Country {
  code: string;
  name: string;
  capital: string;
  flag: string;
  timezone: string;
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
  { code: 'BJ', name: 'Bénin', capital: 'Porto-Novo', flag: '🇧🇯', timezone: 'Africa/Porto-Novo' },
  { code: 'BF', name: 'Burkina Faso', capital: 'Ouagadougou', flag: '🇧🇫', timezone: 'Africa/Ouagadougou' },
  { code: 'CV', name: 'Cap-Vert', capital: 'Praia', flag: '🇨🇻', timezone: 'Atlantic/Cape_Verde' },
  { code: 'CI', name: 'Côte d\'Ivoire', capital: 'Yamoussoukro', flag: '🇨🇮', timezone: 'Africa/Abidjan' },
  { code: 'GM', name: 'Gambie', capital: 'Banjul', flag: '🇬🇲', timezone: 'Africa/Banjul' },
  { code: 'GH', name: 'Ghana', capital: 'Accra', flag: '🇬🇭', timezone: 'Africa/Accra' },
  { code: 'GN', name: 'Guinée', capital: 'Conakry', flag: '🇬🇳', timezone: 'Africa/Conakry' },
  { code: 'GW', name: 'Guinée-Bissau', capital: 'Bissau', flag: '🇬🇼', timezone: 'Africa/Bissau' },
  { code: 'LR', name: 'Liberia', capital: 'Monrovia', flag: '🇱🇷', timezone: 'Africa/Monrovia' },
  { code: 'ML', name: 'Mali', capital: 'Bamako', flag: '🇲🇱', timezone: 'Africa/Bamako' },
  { code: 'MR', name: 'Mauritanie', capital: 'Nouakchott', flag: '🇲🇷', timezone: 'Africa/Nouakchott' },
  { code: 'NE', name: 'Niger', capital: 'Niamey', flag: '🇳🇪', timezone: 'Africa/Niamey' },
  { code: 'NG', name: 'Nigeria', capital: 'Abuja', flag: '🇳🇬', timezone: 'Africa/Lagos' },
  { code: 'SN', name: 'Sénégal', capital: 'Dakar', flag: '🇸🇳', timezone: 'Africa/Dakar' },
  { code: 'SL', name: 'Sierra Leone', capital: 'Freetown', flag: '🇸🇱', timezone: 'Africa/Freetown' },
  { code: 'TG', name: 'Togo', capital: 'Lomé', flag: '🇹🇬', timezone: 'Africa/Lome' },

  // Afrique du Sud
  { code: 'ZA', name: 'South Africa', capital: 'Pretoria', flag: '🇿🇦', timezone: 'Africa/Johannesburg' },
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

// Obtenir le fuseau horaire d'un pays
export const getTimezoneByCountry = (country: string): string => {
  const countryData = AFRICAN_COUNTRIES.find(c => c.name === country);
  return countryData?.timezone || 'UTC';
};

// Obtenir l'offset UTC en heures pour un timezone
export const getTimezoneOffset = (timezone: string): number => {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
  } catch (error) {
    console.error('Error getting timezone offset:', error);
    return 0;
  }
};

// Formater l'offset UTC (ex: +01:00, -05:00)
export const formatTimezoneOffset = (timezone: string): string => {
  const offset = getTimezoneOffset(timezone);
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset);
  const minutes = Math.round((absOffset - hours) * 60);
  return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * Calcule la durée de vol entre deux heures en tenant compte des fuseaux horaires
 * @param departureTime - Heure de départ (HH:MM)
 * @param departureTimezone - Fuseau horaire de départ
 * @param arrivalTime - Heure d'arrivée (HH:MM)
 * @param arrivalTimezone - Fuseau horaire d'arrivée
 * @returns Durée formatée (ex: "4h 30min") ou null si données invalides
 */
export const calculateFlightDuration = (
  departureTime: string,
  departureTimezone: string,
  arrivalTime: string,
  arrivalTimezone: string
): string | null => {
  if (!departureTime || !arrivalTime) return null;

  try {
    // Parser les heures (format HH:MM)
    const [depHours, depMinutes] = departureTime.split(':').map(Number);
    const [arrHours, arrMinutes] = arrivalTime.split(':').map(Number);

    if (isNaN(depHours) || isNaN(depMinutes) || isNaN(arrHours) || isNaN(arrMinutes)) {
      return null;
    }

    // Créer des dates pour aujourd'hui avec ces heures
    const today = new Date();
    const departure = new Date(today);
    departure.setHours(depHours, depMinutes, 0, 0);

    const arrival = new Date(today);
    arrival.setHours(arrHours, arrMinutes, 0, 0);

    // Ajuster pour les fuseaux horaires
    const depOffset = getTimezoneOffset(departureTimezone);
    const arrOffset = getTimezoneOffset(arrivalTimezone);

    // Convertir en UTC
    const departureUTC = new Date(departure.getTime() - depOffset * 60 * 60 * 1000);
    let arrivalUTC = new Date(arrival.getTime() - arrOffset * 60 * 60 * 1000);

    // Si l'arrivée est "avant" le départ, c'est le lendemain
    if (arrivalUTC < departureUTC) {
      arrivalUTC = new Date(arrivalUTC.getTime() + 24 * 60 * 60 * 1000);
    }

    // Calculer la différence en minutes
    const durationMinutes = Math.round((arrivalUTC.getTime() - departureUTC.getTime()) / (1000 * 60));

    if (durationMinutes < 0 || durationMinutes > 24 * 60) {
      return null;
    }

    // Formater
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    if (hours === 0) {
      return `${minutes}min`;
    } else if (minutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${minutes}min`;
    }
  } catch (error) {
    console.error('Error calculating flight duration:', error);
    return null;
  }
};
