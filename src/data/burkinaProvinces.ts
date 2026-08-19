export interface BurkinaProvince {
  name: string;
  region: string;
  /** Chef-lieu de la province. */
  capital: string;
  longitude: number;
  latitude: number;
}

/**
 * Les 45 provinces du Burkina Faso, positionnées sur leur chef-lieu.
 *
 * ⚠️ Les coordonnées sont **indicatives** (position approchée du chef-lieu) et servent
 * uniquement à construire un découpage de proximité lisible à l'écran. Elles ne
 * constituent pas un référentiel cadastral : les limites affichées ne font pas foi.
 */
export const BURKINA_PROVINCES: BurkinaProvince[] = [
  // Boucle du Mouhoun
  { name: 'Balé', region: 'Boucle du Mouhoun', capital: 'Boromo', longitude: -2.93, latitude: 11.75 },
  { name: 'Banwa', region: 'Boucle du Mouhoun', capital: 'Solenzo', longitude: -4.09, latitude: 12.18 },
  { name: 'Kossi', region: 'Boucle du Mouhoun', capital: 'Nouna', longitude: -3.86, latitude: 12.73 },
  { name: 'Mouhoun', region: 'Boucle du Mouhoun', capital: 'Dédougou', longitude: -3.47, latitude: 12.46 },
  { name: 'Nayala', region: 'Boucle du Mouhoun', capital: 'Toma', longitude: -2.9, latitude: 12.77 },
  { name: 'Sourou', region: 'Boucle du Mouhoun', capital: 'Tougan', longitude: -3.07, latitude: 13.07 },

  // Cascades
  { name: 'Comoé', region: 'Cascades', capital: 'Banfora', longitude: -4.76, latitude: 10.63 },
  { name: 'Léraba', region: 'Cascades', capital: 'Sindou', longitude: -5.17, latitude: 10.66 },

  // Centre
  { name: 'Kadiogo', region: 'Centre', capital: 'Ouagadougou', longitude: -1.52, latitude: 12.37 },

  // Centre-Est
  { name: 'Boulgou', region: 'Centre-Est', capital: 'Tenkodogo', longitude: -0.37, latitude: 11.78 },
  { name: 'Koulpélogo', region: 'Centre-Est', capital: 'Ouargaye', longitude: 0.06, latitude: 11.5 },
  { name: 'Kouritenga', region: 'Centre-Est', capital: 'Koupéla', longitude: -0.35, latitude: 12.18 },

  // Centre-Nord
  { name: 'Bam', region: 'Centre-Nord', capital: 'Kongoussi', longitude: -1.53, latitude: 13.32 },
  { name: 'Namentenga', region: 'Centre-Nord', capital: 'Boulsa', longitude: -0.57, latitude: 12.66 },
  { name: 'Sanmatenga', region: 'Centre-Nord', capital: 'Kaya', longitude: -1.08, latitude: 13.09 },

  // Centre-Ouest
  { name: 'Boulkiemdé', region: 'Centre-Ouest', capital: 'Koudougou', longitude: -2.36, latitude: 12.25 },
  { name: 'Sanguié', region: 'Centre-Ouest', capital: 'Réo', longitude: -2.47, latitude: 12.32 },
  { name: 'Sissili', region: 'Centre-Ouest', capital: 'Léo', longitude: -2.1, latitude: 11.1 },
  { name: 'Ziro', region: 'Centre-Ouest', capital: 'Sapouy', longitude: -1.77, latitude: 11.55 },

  // Centre-Sud
  { name: 'Bazèga', region: 'Centre-Sud', capital: 'Kombissiri', longitude: -1.34, latitude: 12.07 },
  { name: 'Nahouri', region: 'Centre-Sud', capital: 'Pô', longitude: -1.15, latitude: 11.17 },
  { name: 'Zoundwéogo', region: 'Centre-Sud', capital: 'Manga', longitude: -1.07, latitude: 11.66 },

  // Est
  { name: 'Gnagna', region: 'Est', capital: 'Bogandé', longitude: -0.14, latitude: 12.98 },
  { name: 'Gourma', region: 'Est', capital: "Fada N'Gourma", longitude: 0.36, latitude: 12.06 },
  { name: 'Komondjari', region: 'Est', capital: 'Gayéri', longitude: 0.49, latitude: 12.65 },
  { name: 'Kompienga', region: 'Est', capital: 'Pama', longitude: 0.7, latitude: 11.25 },
  { name: 'Tapoa', region: 'Est', capital: 'Diapaga', longitude: 1.79, latitude: 12.07 },

  // Hauts-Bassins
  { name: 'Houet', region: 'Hauts-Bassins', capital: 'Bobo-Dioulasso', longitude: -4.29, latitude: 11.18 },
  { name: 'Kénédougou', region: 'Hauts-Bassins', capital: 'Orodara', longitude: -4.93, latitude: 10.99 },
  { name: 'Tuy', region: 'Hauts-Bassins', capital: 'Houndé', longitude: -3.52, latitude: 11.5 },

  // Nord
  { name: 'Loroum', region: 'Nord', capital: 'Titao', longitude: -2.07, latitude: 13.76 },
  { name: 'Passoré', region: 'Nord', capital: 'Yako', longitude: -2.26, latitude: 12.96 },
  { name: 'Yatenga', region: 'Nord', capital: 'Ouahigouya', longitude: -2.42, latitude: 13.58 },
  { name: 'Zondoma', region: 'Nord', capital: 'Gourcy', longitude: -2.36, latitude: 13.21 },

  // Plateau-Central
  { name: 'Ganzourgou', region: 'Plateau-Central', capital: 'Zorgho', longitude: -0.61, latitude: 12.25 },
  { name: 'Kourwéogo', region: 'Plateau-Central', capital: 'Boussé', longitude: -1.89, latitude: 12.66 },
  { name: 'Oubritenga', region: 'Plateau-Central', capital: 'Ziniaré', longitude: -1.3, latitude: 12.58 },

  // Sahel
  { name: 'Oudalan', region: 'Sahel', capital: 'Gorom-Gorom', longitude: -0.23, latitude: 14.44 },
  { name: 'Séno', region: 'Sahel', capital: 'Dori', longitude: -0.03, latitude: 14.03 },
  { name: 'Soum', region: 'Sahel', capital: 'Djibo', longitude: -1.63, latitude: 14.1 },
  { name: 'Yagha', region: 'Sahel', capital: 'Sebba', longitude: 0.52, latitude: 13.44 },

  // Sud-Ouest
  { name: 'Bougouriba', region: 'Sud-Ouest', capital: 'Diébougou', longitude: -3.25, latitude: 10.96 },
  { name: 'Ioba', region: 'Sud-Ouest', capital: 'Dano', longitude: -3.06, latitude: 11.15 },
  { name: 'Noumbiel', region: 'Sud-Ouest', capital: 'Batié', longitude: -2.91, latitude: 9.88 },
  { name: 'Poni', region: 'Sud-Ouest', capital: 'Gaoua', longitude: -3.18, latitude: 10.33 },
];

/** Provinces d'une région, dans l'ordre alphabétique du jeu de données. */
export const provincesOfRegion = (region: string) =>
  BURKINA_PROVINCES.filter((province) => province.region === region);
