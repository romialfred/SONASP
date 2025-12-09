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

// Pays africains + destinations internationales (Europe, États-Unis)
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

  // Afrique du Nord
  { code: 'DZ', name: 'Algérie', capital: 'Alger', flag: '🇩🇿', timezone: 'Africa/Algiers' },
  { code: 'EG', name: 'Égypte', capital: 'Le Caire', flag: '🇪🇬', timezone: 'Africa/Cairo' },
  { code: 'LY', name: 'Libye', capital: 'Tripoli', flag: '🇱🇾', timezone: 'Africa/Tripoli' },
  { code: 'MA', name: 'Maroc', capital: 'Rabat', flag: '🇲🇦', timezone: 'Africa/Casablanca' },
  { code: 'TN', name: 'Tunisie', capital: 'Tunis', flag: '🇹🇳', timezone: 'Africa/Tunis' },
  { code: 'EH', name: 'Sahara Occidental', capital: 'El Aaiún', flag: '🇪🇭', timezone: 'Africa/El_Aaiun' },

  // Afrique de l'Est
  { code: 'BI', name: 'Burundi', capital: 'Gitega', flag: '🇧🇮', timezone: 'Africa/Bujumbura' },
  { code: 'KM', name: 'Comores', capital: 'Moroni', flag: '🇰🇲', timezone: 'Indian/Comoro' },
  { code: 'DJ', name: 'Djibouti', capital: 'Djibouti', flag: '🇩🇯', timezone: 'Africa/Djibouti' },
  { code: 'ER', name: 'Érythrée', capital: 'Asmara', flag: '🇪🇷', timezone: 'Africa/Asmara' },
  { code: 'ET', name: 'Éthiopie', capital: 'Addis-Abeba', flag: '🇪🇹', timezone: 'Africa/Addis_Ababa' },
  { code: 'KE', name: 'Kenya', capital: 'Nairobi', flag: '🇰🇪', timezone: 'Africa/Nairobi' },
  { code: 'MG', name: 'Madagascar', capital: 'Antananarivo', flag: '🇲🇬', timezone: 'Indian/Antananarivo' },
  { code: 'MW', name: 'Malawi', capital: 'Lilongwe', flag: '🇲🇼', timezone: 'Africa/Blantyre' },
  { code: 'MU', name: 'Maurice', capital: 'Port-Louis', flag: '🇲🇺', timezone: 'Indian/Mauritius' },
  { code: 'MZ', name: 'Mozambique', capital: 'Maputo', flag: '🇲🇿', timezone: 'Africa/Maputo' },
  { code: 'RE', name: 'La Réunion', capital: 'Saint-Denis', flag: '🇷🇪', timezone: 'Indian/Reunion' },
  { code: 'RW', name: 'Rwanda', capital: 'Kigali', flag: '🇷🇼', timezone: 'Africa/Kigali' },
  { code: 'SC', name: 'Seychelles', capital: 'Victoria', flag: '🇸🇨', timezone: 'Indian/Mahe' },
  { code: 'SO', name: 'Somalie', capital: 'Mogadiscio', flag: '🇸🇴', timezone: 'Africa/Mogadishu' },
  { code: 'SS', name: 'Soudan du Sud', capital: 'Djouba', flag: '🇸🇸', timezone: 'Africa/Juba' },
  { code: 'SD', name: 'Soudan', capital: 'Khartoum', flag: '🇸🇩', timezone: 'Africa/Khartoum' },
  { code: 'TZ', name: 'Tanzanie', capital: 'Dodoma', flag: '🇹🇿', timezone: 'Africa/Dar_es_Salaam' },
  { code: 'UG', name: 'Ouganda', capital: 'Kampala', flag: '🇺🇬', timezone: 'Africa/Kampala' },
  { code: 'YT', name: 'Mayotte', capital: 'Mamoudzou', flag: '🇾🇹', timezone: 'Indian/Mayotte' },
  { code: 'ZM', name: 'Zambie', capital: 'Lusaka', flag: '🇿🇲', timezone: 'Africa/Lusaka' },
  { code: 'ZW', name: 'Zimbabwe', capital: 'Harare', flag: '🇿🇼', timezone: 'Africa/Harare' },

  // Afrique Centrale
  { code: 'AO', name: 'Angola', capital: 'Luanda', flag: '🇦🇴', timezone: 'Africa/Luanda' },
  { code: 'CM', name: 'Cameroun', capital: 'Yaoundé', flag: '🇨🇲', timezone: 'Africa/Douala' },
  { code: 'CF', name: 'République Centrafricaine', capital: 'Bangui', flag: '🇨🇫', timezone: 'Africa/Bangui' },
  { code: 'TD', name: 'Tchad', capital: 'N\'Djaména', flag: '🇹🇩', timezone: 'Africa/Ndjamena' },
  { code: 'CG', name: 'République du Congo', capital: 'Brazzaville', flag: '🇨🇬', timezone: 'Africa/Brazzaville' },
  { code: 'CD', name: 'RD Congo', capital: 'Kinshasa', flag: '🇨🇩', timezone: 'Africa/Kinshasa' },
  { code: 'GQ', name: 'Guinée Équatoriale', capital: 'Malabo', flag: '🇬🇶', timezone: 'Africa/Malabo' },
  { code: 'GA', name: 'Gabon', capital: 'Libreville', flag: '🇬🇦', timezone: 'Africa/Libreville' },
  { code: 'ST', name: 'Sao Tomé-et-Principe', capital: 'São Tomé', flag: '🇸🇹', timezone: 'Africa/Sao_Tome' },

  // Afrique Australe
  { code: 'BW', name: 'Botswana', capital: 'Gaborone', flag: '🇧🇼', timezone: 'Africa/Gaborone' },
  { code: 'SZ', name: 'Eswatini', capital: 'Mbabane', flag: '🇸🇿', timezone: 'Africa/Mbabane' },
  { code: 'LS', name: 'Lesotho', capital: 'Maseru', flag: '🇱🇸', timezone: 'Africa/Maseru' },
  { code: 'NA', name: 'Namibie', capital: 'Windhoek', flag: '🇳🇦', timezone: 'Africa/Windhoek' },
  { code: 'ZA', name: 'Afrique du Sud', capital: 'Pretoria', flag: '🇿🇦', timezone: 'Africa/Johannesburg' },

  // Europe (Destinations de raffineries)
  { code: 'CH', name: 'Suisse', capital: 'Berne', flag: '🇨🇭', timezone: 'Europe/Zurich' },
  { code: 'GB', name: 'Royaume-Uni', capital: 'Londres', flag: '🇬🇧', timezone: 'Europe/London' },
  { code: 'BE', name: 'Belgique', capital: 'Bruxelles', flag: '🇧🇪', timezone: 'Europe/Brussels' },
  { code: 'FR', name: 'France', capital: 'Paris', flag: '🇫🇷', timezone: 'Europe/Paris' },
  { code: 'DE', name: 'Allemagne', capital: 'Berlin', flag: '🇩🇪', timezone: 'Europe/Berlin' },
  { code: 'IT', name: 'Italie', capital: 'Rome', flag: '🇮🇹', timezone: 'Europe/Rome' },
  { code: 'AE', name: 'Émirats Arabes Unis', capital: 'Abu Dhabi', flag: '🇦🇪', timezone: 'Asia/Dubai' },

  // Amérique du Nord
  { code: 'US', name: 'États-Unis', capital: 'Washington D.C.', flag: '🇺🇸', timezone: 'America/New_York' },
  { code: 'CA', name: 'Canada', capital: 'Ottawa', flag: '🇨🇦', timezone: 'America/Toronto' },
];

// Villes capitales et grandes villes
export const AFRICAN_CITIES: City[] = [
  // Afrique de l'Ouest
  { name: 'Bamako', country: 'Mali', isCapital: true },
  { name: 'Conakry', country: 'Guinée', isCapital: true },
  { name: 'Yamoussoukro', country: 'Côte d\'Ivoire', isCapital: true },
  { name: 'Abidjan', country: 'Côte d\'Ivoire', isCapital: false },
  { name: 'Accra', country: 'Ghana', isCapital: true },
  { name: 'Abuja', country: 'Nigeria', isCapital: true },
  { name: 'Lagos', country: 'Nigeria', isCapital: false },
  { name: 'Dakar', country: 'Sénégal', isCapital: true },
  { name: 'Ouagadougou', country: 'Burkina Faso', isCapital: true },
  { name: 'Niamey', country: 'Niger', isCapital: true },
  { name: 'Porto-Novo', country: 'Bénin', isCapital: true },
  { name: 'Cotonou', country: 'Bénin', isCapital: false },
  { name: 'Lomé', country: 'Togo', isCapital: true },
  { name: 'Monrovia', country: 'Liberia', isCapital: true },
  { name: 'Freetown', country: 'Sierra Leone', isCapital: true },
  { name: 'Nouakchott', country: 'Mauritanie', isCapital: true },
  { name: 'Bissau', country: 'Guinée-Bissau', isCapital: true },
  { name: 'Banjul', country: 'Gambie', isCapital: true },
  { name: 'Praia', country: 'Cap-Vert', isCapital: true },

  // Afrique du Nord
  { name: 'Alger', country: 'Algérie', isCapital: true },
  { name: 'Le Caire', country: 'Égypte', isCapital: true },
  { name: 'Tripoli', country: 'Libye', isCapital: true },
  { name: 'Rabat', country: 'Maroc', isCapital: true },
  { name: 'Casablanca', country: 'Maroc', isCapital: false },
  { name: 'Tunis', country: 'Tunisie', isCapital: true },

  // Afrique de l'Est
  { name: 'Gitega', country: 'Burundi', isCapital: true },
  { name: 'Bujumbura', country: 'Burundi', isCapital: false },
  { name: 'Moroni', country: 'Comores', isCapital: true },
  { name: 'Djibouti', country: 'Djibouti', isCapital: true },
  { name: 'Asmara', country: 'Érythrée', isCapital: true },
  { name: 'Addis-Abeba', country: 'Éthiopie', isCapital: true },
  { name: 'Nairobi', country: 'Kenya', isCapital: true },
  { name: 'Mombasa', country: 'Kenya', isCapital: false },
  { name: 'Antananarivo', country: 'Madagascar', isCapital: true },
  { name: 'Lilongwe', country: 'Malawi', isCapital: true },
  { name: 'Port-Louis', country: 'Maurice', isCapital: true },
  { name: 'Maputo', country: 'Mozambique', isCapital: true },
  { name: 'Kigali', country: 'Rwanda', isCapital: true },
  { name: 'Victoria', country: 'Seychelles', isCapital: true },
  { name: 'Mogadiscio', country: 'Somalie', isCapital: true },
  { name: 'Khartoum', country: 'Soudan', isCapital: true },
  { name: 'Djouba', country: 'Soudan du Sud', isCapital: true },
  { name: 'Dodoma', country: 'Tanzanie', isCapital: true },
  { name: 'Dar es Salaam', country: 'Tanzanie', isCapital: false },
  { name: 'Kampala', country: 'Ouganda', isCapital: true },
  { name: 'Lusaka', country: 'Zambie', isCapital: true },
  { name: 'Harare', country: 'Zimbabwe', isCapital: true },

  // Afrique Centrale
  { name: 'Luanda', country: 'Angola', isCapital: true },
  { name: 'Yaoundé', country: 'Cameroun', isCapital: true },
  { name: 'Douala', country: 'Cameroun', isCapital: false },
  { name: 'Bangui', country: 'République Centrafricaine', isCapital: true },
  { name: 'N\'Djaména', country: 'Tchad', isCapital: true },
  { name: 'Brazzaville', country: 'République du Congo', isCapital: true },
  { name: 'Kinshasa', country: 'RD Congo', isCapital: true },
  { name: 'Malabo', country: 'Guinée Équatoriale', isCapital: true },
  { name: 'Libreville', country: 'Gabon', isCapital: true },
  { name: 'São Tomé', country: 'Sao Tomé-et-Principe', isCapital: true },

  // Afrique Australe
  { name: 'Gaborone', country: 'Botswana', isCapital: true },
  { name: 'Mbabane', country: 'Eswatini', isCapital: true },
  { name: 'Maseru', country: 'Lesotho', isCapital: true },
  { name: 'Windhoek', country: 'Namibie', isCapital: true },
  { name: 'Pretoria', country: 'Afrique du Sud', isCapital: true },
  { name: 'Johannesburg', country: 'Afrique du Sud', isCapital: false },
  { name: 'Le Cap', country: 'Afrique du Sud', isCapital: false },
  { name: 'Durban', country: 'Afrique du Sud', isCapital: false },

  // Europe
  { name: 'Berne', country: 'Suisse', isCapital: true },
  { name: 'Zurich', country: 'Suisse', isCapital: false },
  { name: 'Genève', country: 'Suisse', isCapital: false },
  { name: 'Londres', country: 'Royaume-Uni', isCapital: true },
  { name: 'Bruxelles', country: 'Belgique', isCapital: true },
  { name: 'Paris', country: 'France', isCapital: true },
  { name: 'Berlin', country: 'Allemagne', isCapital: true },
  { name: 'Rome', country: 'Italie', isCapital: true },
  { name: 'Abu Dhabi', country: 'Émirats Arabes Unis', isCapital: true },
  { name: 'Dubaï', country: 'Émirats Arabes Unis', isCapital: false },

  // Amérique du Nord
  { name: 'Washington D.C.', country: 'États-Unis', isCapital: true },
  { name: 'New York', country: 'États-Unis', isCapital: false },
  { name: 'Ottawa', country: 'Canada', isCapital: true },
  { name: 'Toronto', country: 'Canada', isCapital: false },
];

// Aéroports majeurs
export const AFRICAN_AIRPORTS: Airport[] = [
  // Afrique de l'Ouest
  { code: 'BKO', name: 'Bamako-Sénou International Airport (BKO)', city: 'Bamako', country: 'Mali' },
  { code: 'CKY', name: 'Conakry International Airport (CKY)', city: 'Conakry', country: 'Guinée' },
  { code: 'ABJ', name: 'Félix-Houphouët-Boigny International Airport (ABJ)', city: 'Abidjan', country: 'Côte d\'Ivoire' },
  { code: 'ACC', name: 'Kotoka International Airport (ACC)', city: 'Accra', country: 'Ghana' },
  { code: 'ABV', name: 'Nnamdi Azikiwe International Airport (ABV)', city: 'Abuja', country: 'Nigeria' },
  { code: 'LOS', name: 'Murtala Muhammed International Airport (LOS)', city: 'Lagos', country: 'Nigeria' },
  { code: 'DSS', name: 'Blaise Diagne International Airport (DSS)', city: 'Dakar', country: 'Sénégal' },
  { code: 'OUA', name: 'Ouagadougou Airport (OUA)', city: 'Ouagadougou', country: 'Burkina Faso' },
  { code: 'NIM', name: 'Diori Hamani International Airport (NIM)', city: 'Niamey', country: 'Niger' },
  { code: 'COO', name: 'Cadjehoun Airport (COO)', city: 'Cotonou', country: 'Bénin' },
  { code: 'LFW', name: 'Gnassingbé Eyadéma International Airport (LFW)', city: 'Lomé', country: 'Togo' },
  { code: 'ROB', name: 'Roberts International Airport (ROB)', city: 'Monrovia', country: 'Liberia' },
  { code: 'FNA', name: 'Lungi International Airport (FNA)', city: 'Freetown', country: 'Sierra Leone' },
  { code: 'NKC', name: 'Nouakchott International Airport (NKC)', city: 'Nouakchott', country: 'Mauritanie' },
  { code: 'OXB', name: 'Osvaldo Vieira International Airport (OXB)', city: 'Bissau', country: 'Guinée-Bissau' },
  { code: 'BJL', name: 'Banjul International Airport (BJL)', city: 'Banjul', country: 'Gambie' },
  { code: 'RAI', name: 'Praia International Airport (RAI)', city: 'Praia', country: 'Cap-Vert' },

  // Afrique du Nord
  { code: 'ALG', name: 'Houari Boumediene Airport (ALG)', city: 'Alger', country: 'Algérie' },
  { code: 'CAI', name: 'Cairo International Airport (CAI)', city: 'Le Caire', country: 'Égypte' },
  { code: 'TIP', name: 'Tripoli International Airport (TIP)', city: 'Tripoli', country: 'Libye' },
  { code: 'CMN', name: 'Mohammed V International Airport (CMN)', city: 'Casablanca', country: 'Maroc' },
  { code: 'RBA', name: 'Rabat-Salé Airport (RBA)', city: 'Rabat', country: 'Maroc' },
  { code: 'TUN', name: 'Tunis-Carthage International Airport (TUN)', city: 'Tunis', country: 'Tunisie' },

  // Afrique de l'Est
  { code: 'BJM', name: 'Bujumbura International Airport (BJM)', city: 'Bujumbura', country: 'Burundi' },
  { code: 'HAH', name: 'Moroni International Airport (HAH)', city: 'Moroni', country: 'Comores' },
  { code: 'JIB', name: 'Djibouti-Ambouli International Airport (JIB)', city: 'Djibouti', country: 'Djibouti' },
  { code: 'ASM', name: 'Asmara International Airport (ASM)', city: 'Asmara', country: 'Érythrée' },
  { code: 'ADD', name: 'Addis Ababa Bole International Airport (ADD)', city: 'Addis-Abeba', country: 'Éthiopie' },
  { code: 'NBO', name: 'Jomo Kenyatta International Airport (NBO)', city: 'Nairobi', country: 'Kenya' },
  { code: 'MBA', name: 'Moi International Airport (MBA)', city: 'Mombasa', country: 'Kenya' },
  { code: 'TNR', name: 'Ivato International Airport (TNR)', city: 'Antananarivo', country: 'Madagascar' },
  { code: 'LLW', name: 'Lilongwe International Airport (LLW)', city: 'Lilongwe', country: 'Malawi' },
  { code: 'MRU', name: 'Sir Seewoosagur Ramgoolam International Airport (MRU)', city: 'Port-Louis', country: 'Maurice' },
  { code: 'MPM', name: 'Maputo International Airport (MPM)', city: 'Maputo', country: 'Mozambique' },
  { code: 'KGL', name: 'Kigali International Airport (KGL)', city: 'Kigali', country: 'Rwanda' },
  { code: 'SEZ', name: 'Seychelles International Airport (SEZ)', city: 'Victoria', country: 'Seychelles' },
  { code: 'MGQ', name: 'Aden Adde International Airport (MGQ)', city: 'Mogadiscio', country: 'Somalie' },
  { code: 'KRT', name: 'Khartoum International Airport (KRT)', city: 'Khartoum', country: 'Soudan' },
  { code: 'JUB', name: 'Juba International Airport (JUB)', city: 'Djouba', country: 'Soudan du Sud' },
  { code: 'DAR', name: 'Julius Nyerere International Airport (DAR)', city: 'Dar es Salaam', country: 'Tanzanie' },
  { code: 'EBB', name: 'Entebbe International Airport (EBB)', city: 'Kampala', country: 'Ouganda' },
  { code: 'LUN', name: 'Kenneth Kaunda International Airport (LUN)', city: 'Lusaka', country: 'Zambie' },
  { code: 'HRE', name: 'Robert Gabriel Mugabe International Airport (HRE)', city: 'Harare', country: 'Zimbabwe' },

  // Afrique Centrale
  { code: 'LAD', name: 'Quatro de Fevereiro Airport (LAD)', city: 'Luanda', country: 'Angola' },
  { code: 'NSI', name: 'Yaoundé Nsimalen International Airport (NSI)', city: 'Yaoundé', country: 'Cameroun' },
  { code: 'DLA', name: 'Douala International Airport (DLA)', city: 'Douala', country: 'Cameroun' },
  { code: 'BGF', name: 'Bangui M\'Poko International Airport (BGF)', city: 'Bangui', country: 'République Centrafricaine' },
  { code: 'NDJ', name: 'N\'Djamena International Airport (NDJ)', city: 'N\'Djaména', country: 'Tchad' },
  { code: 'BZV', name: 'Maya-Maya Airport (BZV)', city: 'Brazzaville', country: 'République du Congo' },
  { code: 'FIH', name: 'N\'djili International Airport (FIH)', city: 'Kinshasa', country: 'RD Congo' },
  { code: 'SSG', name: 'Malabo International Airport (SSG)', city: 'Malabo', country: 'Guinée Équatoriale' },
  { code: 'LBV', name: 'Libreville International Airport (LBV)', city: 'Libreville', country: 'Gabon' },
  { code: 'TMS', name: 'São Tomé International Airport (TMS)', city: 'São Tomé', country: 'Sao Tomé-et-Principe' },

  // Afrique Australe
  { code: 'GBE', name: 'Sir Seretse Khama International Airport (GBE)', city: 'Gaborone', country: 'Botswana' },
  { code: 'SHO', name: 'King Mswati III International Airport (SHO)', city: 'Mbabane', country: 'Eswatini' },
  { code: 'MSU', name: 'Moshoeshoe I International Airport (MSU)', city: 'Maseru', country: 'Lesotho' },
  { code: 'WDH', name: 'Hosea Kutako International Airport (WDH)', city: 'Windhoek', country: 'Namibie' },
  { code: 'JNB', name: 'OR Tambo International Airport (JNB)', city: 'Johannesburg', country: 'Afrique du Sud' },
  { code: 'CPT', name: 'Cape Town International Airport (CPT)', city: 'Le Cap', country: 'Afrique du Sud' },
  { code: 'DUR', name: 'King Shaka International Airport (DUR)', city: 'Durban', country: 'Afrique du Sud' },

  // Europe
  { code: 'ZRH', name: 'Zurich Airport (ZRH)', city: 'Zurich', country: 'Suisse' },
  { code: 'GVA', name: 'Geneva Airport (GVA)', city: 'Genève', country: 'Suisse' },
  { code: 'LHR', name: 'London Heathrow Airport (LHR)', city: 'Londres', country: 'Royaume-Uni' },
  { code: 'BRU', name: 'Brussels Airport (BRU)', city: 'Bruxelles', country: 'Belgique' },
  { code: 'CDG', name: 'Charles de Gaulle Airport (CDG)', city: 'Paris', country: 'France' },
  { code: 'FRA', name: 'Frankfurt Airport (FRA)', city: 'Berlin', country: 'Allemagne' },
  { code: 'FCO', name: 'Leonardo da Vinci Airport (FCO)', city: 'Rome', country: 'Italie' },
  { code: 'DXB', name: 'Dubai International Airport (DXB)', city: 'Dubaï', country: 'Émirats Arabes Unis' },

  // Amérique du Nord
  { code: 'JFK', name: 'John F. Kennedy International Airport (JFK)', city: 'New York', country: 'États-Unis' },
  { code: 'IAD', name: 'Washington Dulles International Airport (IAD)', city: 'Washington D.C.', country: 'États-Unis' },
  { code: 'YYZ', name: 'Toronto Pearson International Airport (YYZ)', city: 'Toronto', country: 'Canada' },
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
