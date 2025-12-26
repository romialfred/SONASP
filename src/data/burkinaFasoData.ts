/**
 * Données géographiques détaillées pour le Burkina Faso, Mali et Niger
 * Focus principal: Burkina Faso
 */

export interface Region {
  name: string;
  country: string;
  provinces?: string[];
  cities: string[];
}

export const BURKINA_FASO_REGIONS: Region[] = [
  {
    name: 'Boucle du Mouhoun',
    country: 'Burkina Faso',
    provinces: ['Balé', 'Banwa', 'Kossi', 'Mouhoun', 'Nayala', 'Sourou'],
    cities: ['Dédougou', 'Nouna', 'Toma', 'Boromo', 'Tougan', 'Solenzo']
  },
  {
    name: 'Cascades',
    country: 'Burkina Faso',
    provinces: ['Comoé', 'Léraba'],
    cities: ['Banfora', 'Sindou', 'Mangodara', 'Orodara']
  },
  {
    name: 'Centre',
    country: 'Burkina Faso',
    provinces: ['Kadiogo'],
    cities: ['Ouagadougou', 'Komsilga', 'Saaba', 'Tanghin-Dassouri', 'Koubri']
  },
  {
    name: 'Centre-Est',
    country: 'Burkina Faso',
    provinces: ['Boulgou', 'Koulpélogo', 'Kouritenga'],
    cities: ['Tenkodogo', 'Koupéla', 'Pouytenga', 'Garango']
  },
  {
    name: 'Centre-Nord',
    country: 'Burkina Faso',
    provinces: ['Bam', 'Namentenga', 'Sanmatenga'],
    cities: ['Kaya', 'Boussouma', 'Bourzanga', 'Kongoussi']
  },
  {
    name: 'Centre-Ouest',
    country: 'Burkina Faso',
    provinces: ['Boulkiemdé', 'Sanguié', 'Sissili', 'Ziro'],
    cities: ['Koudougou', 'Réo', 'Léo', 'Sapouy']
  },
  {
    name: 'Centre-Sud',
    country: 'Burkina Faso',
    provinces: ['Bazèga', 'Nahouri', 'Zoundwéogo'],
    cities: ['Manga', 'Pô', 'Kombissiri']
  },
  {
    name: 'Est',
    country: 'Burkina Faso',
    provinces: ['Gnagna', 'Gourma', 'Komondjari', 'Kompienga', 'Tapoa'],
    cities: ['Fada N\'Gourma', 'Pama', 'Diapaga', 'Bogandé']
  },
  {
    name: 'Hauts-Bassins',
    country: 'Burkina Faso',
    provinces: ['Houet', 'Kénédougou', 'Tuy'],
    cities: ['Bobo-Dioulasso', 'Orodara', 'Houndé']
  },
  {
    name: 'Nord',
    country: 'Burkina Faso',
    provinces: ['Loroum', 'Passoré', 'Yatenga', 'Zondoma'],
    cities: ['Ouahigouya', 'Yako', 'Gourcy', 'Titao']
  },
  {
    name: 'Plateau-Central',
    country: 'Burkina Faso',
    provinces: ['Ganzourgou', 'Kourwéogo', 'Oubritenga'],
    cities: ['Ziniaré', 'Zorgho', 'Absouya']
  },
  {
    name: 'Sahel',
    country: 'Burkina Faso',
    provinces: ['Oudalan', 'Séno', 'Soum', 'Yagha'],
    cities: ['Dori', 'Djibo', 'Gorom-Gorom', 'Sebba']
  },
  {
    name: 'Sud-Ouest',
    country: 'Burkina Faso',
    provinces: ['Bougouriba', 'Ioba', 'Noumbiel', 'Poni'],
    cities: ['Gaoua', 'Diébougou', 'Batié', 'Kampti']
  }
];

export const MALI_REGIONS: Region[] = [
  {
    name: 'Bamako',
    country: 'Mali',
    cities: ['Bamako']
  },
  {
    name: 'Kayes',
    country: 'Mali',
    cities: ['Kayes', 'Kéniéba', 'Kita', 'Nioro du Sahel', 'Yélimané']
  },
  {
    name: 'Koulikoro',
    country: 'Mali',
    cities: ['Koulikoro', 'Kati', 'Kolokani', 'Banamba', 'Dioïla']
  },
  {
    name: 'Sikasso',
    country: 'Mali',
    cities: ['Sikasso', 'Bougouni', 'Kadiolo', 'Kolondieba', 'Yanfolila']
  },
  {
    name: 'Ségou',
    country: 'Mali',
    cities: ['Ségou', 'Barouéli', 'Bla', 'Macina', 'Niono', 'San', 'Tominian']
  },
  {
    name: 'Mopti',
    country: 'Mali',
    cities: ['Mopti', 'Bandiagara', 'Djenné', 'Douentza', 'Koro', 'Tenenkou', 'Youwarou']
  },
  {
    name: 'Tombouctou',
    country: 'Mali',
    cities: ['Tombouctou', 'Diré', 'Goundam', 'Gourma-Rharous', 'Niafunké']
  },
  {
    name: 'Gao',
    country: 'Mali',
    cities: ['Gao', 'Ansongo', 'Bourem', 'Ménaka']
  },
  {
    name: 'Kidal',
    country: 'Mali',
    cities: ['Kidal', 'Abeibara', 'Tessalit', 'Tin-Essako']
  },
  {
    name: 'Ménaka',
    country: 'Mali',
    cities: ['Ménaka', 'Alata', 'Anderamboukane', 'Tidermène']
  },
  {
    name: 'Taoudénit',
    country: 'Mali',
    cities: ['Taoudénit', 'Araouane', 'Foum-Alba']
  }
];

export const NIGER_REGIONS: Region[] = [
  {
    name: 'Niamey',
    country: 'Niger',
    cities: ['Niamey']
  },
  {
    name: 'Agadez',
    country: 'Niger',
    cities: ['Agadez', 'Arlit', 'Bilma', 'Tchirozerine']
  },
  {
    name: 'Diffa',
    country: 'Niger',
    cities: ['Diffa', 'Maine-Soroa', 'N\'Guigmi']
  },
  {
    name: 'Dosso',
    country: 'Niger',
    cities: ['Dosso', 'Boboye', 'Dogondoutchi', 'Gaya', 'Loga']
  },
  {
    name: 'Maradi',
    country: 'Niger',
    cities: ['Maradi', 'Dakoro', 'Guidan Roumdji', 'Madarounfa', 'Mayahi', 'Tessaoua']
  },
  {
    name: 'Tahoua',
    country: 'Niger',
    cities: ['Tahoua', 'Abalak', 'Birni N\'Konni', 'Bouza', 'Illéla', 'Keita', 'Madaoua', 'Tchin-Tabaraden']
  },
  {
    name: 'Tillabéri',
    country: 'Niger',
    cities: ['Tillabéri', 'Filingué', 'Kollo', 'Ouallam', 'Say', 'Téra', 'Torodi']
  },
  {
    name: 'Zinder',
    country: 'Niger',
    cities: ['Zinder', 'Gouré', 'Kantché', 'Magaria', 'Matameye', 'Mirriah', 'Tanout']
  }
];

export const GUINEE_REGIONS: Region[] = [
  {
    name: 'Conakry',
    country: 'Guinée',
    cities: ['Conakry', 'Ratoma', 'Matam', 'Dixinn', 'Kaloum']
  },
  {
    name: 'Boké',
    country: 'Guinée',
    cities: ['Boké', 'Boffa', 'Fria', 'Gaoual', 'Koundara']
  },
  {
    name: 'Faranah',
    country: 'Guinée',
    cities: ['Faranah', 'Dabola', 'Dinguiraye', 'Kissidougou']
  },
  {
    name: 'Kankan',
    country: 'Guinée',
    cities: ['Kankan', 'Kérouané', 'Kouroussa', 'Mandiana', 'Siguiri']
  },
  {
    name: 'Kindia',
    country: 'Guinée',
    cities: ['Kindia', 'Coyah', 'Dubréka', 'Forécariah', 'Télimélé']
  },
  {
    name: 'Labé',
    country: 'Guinée',
    cities: ['Labé', 'Koubia', 'Lélouma', 'Mali', 'Tougué']
  },
  {
    name: 'Mamou',
    country: 'Guinée',
    cities: ['Mamou', 'Dalaba', 'Pita']
  },
  {
    name: 'Nzérékoré',
    country: 'Guinée',
    cities: ['Nzérékoré', 'Beyla', 'Guéckédou', 'Lola', 'Macenta', 'Yomou']
  }
];

export const SAHEL_COUNTRIES = [
  {
    code: 'BF',
    name: 'Burkina Faso',
    phonePrefix: '+226',
    flag: '🇧🇫',
    priority: 1
  },
  {
    code: 'ML',
    name: 'Mali',
    phonePrefix: '+223',
    flag: '🇲🇱',
    priority: 2
  },
  {
    code: 'NE',
    name: 'Niger',
    phonePrefix: '+227',
    flag: '🇳🇪',
    priority: 3
  },
  {
    code: 'GN',
    name: 'Guinée',
    phonePrefix: '+224',
    flag: '🇬🇳',
    priority: 4
  }
];

// Fonction pour obtenir toutes les régions par pays
export const getRegionsByCountry = (country: string): Region[] => {
  switch (country) {
    case 'Burkina Faso':
      return BURKINA_FASO_REGIONS;
    case 'Mali':
      return MALI_REGIONS;
    case 'Niger':
      return NIGER_REGIONS;
    case 'Guinée':
      return GUINEE_REGIONS;
    default:
      return [];
  }
};

// Fonction pour obtenir les villes d'une région
export const getCitiesByRegion = (country: string, region: string): string[] => {
  const regions = getRegionsByCountry(country);
  const foundRegion = regions.find(r => r.name === region);
  return foundRegion?.cities || [];
};

// Fonction pour obtenir le préfixe téléphonique d'un pays
export const getPhonePrefix = (country: string): string => {
  const countryData = SAHEL_COUNTRIES.find(c => c.name === country);
  return countryData?.phonePrefix || '';
};

// Fonction pour formater un numéro de téléphone
export const formatPhoneNumber = (phone: string, country: string): string => {
  // Enlever tous les espaces et caractères spéciaux sauf +
  let cleaned = phone.replace(/[^\d+]/g, '');

  const prefix = getPhonePrefix(country);

  // Si le numéro commence déjà par le bon préfixe, le retourner tel quel
  if (cleaned.startsWith(prefix)) {
    return cleaned;
  }

  // Si le numéro commence par +, enlever le +
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Si le numéro commence par 00, enlever le 00
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  // Si le numéro commence par le code du pays sans +, ajouter le +
  const prefixWithoutPlus = prefix.substring(1);
  if (cleaned.startsWith(prefixWithoutPlus)) {
    return '+' + cleaned;
  }

  // Sinon, ajouter le préfixe
  return prefix + cleaned;
};
