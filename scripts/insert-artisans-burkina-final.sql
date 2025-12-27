-- ============================================================================
-- INSERTION DES ARTISANS MINIERS DU BURKINA FASO
-- ============================================================================
-- Ce script insère 20 artisans miniers de test pour le Burkina Faso
-- Les artisans sont INDEPENDANTS (pas de mining_company_id)
-- ============================================================================

-- Artisan 1: Exploitant - Ouagadougou
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, email, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite,
  observations
) VALUES (
  'SONASP/AM/2025/BF/0001', 'physique', 'exploitant',
  'OUEDRAOGO', 'Abdoulaye', '1985-03-15', 'Ouagadougou', 'M', 'Burkinabé',
  '+226 70 12 34 56', 'a.ouedraogo@gmail.com', 'Secteur 15, Avenue Kwamé N''Krumah', 'Ouagadougou', 'Centre', 'Burkina Faso',
  'CNI', 'B123456789',
  'Exploitant depuis 2010, spécialisé dans l''or alluvionnaire'
);

-- Artisan 2: Collecteur - Bobo-Dioulasso
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite
) VALUES (
  'SONASP/AM/2025/BF/0002', 'physique', 'collecteur',
  'KONE', 'Mamadou', '1978-07-22', 'Bobo-Dioulasso', 'M', 'Burkinabé',
  '+226 76 23 45 67', 'Quartier Kodeni, Rue du Commerce', 'Bobo-Dioulasso', 'Hauts-Bassins', 'Burkina Faso',
  'CNI', 'B234567890'
);

-- Artisan 3: Exploitant - Koudougou
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite
) VALUES (
  'SONASP/AM/2025/BF/0003', 'physique', 'exploitant',
  'SAWADOGO', 'Fatimata', '1990-11-08', 'Koudougou', 'F', 'Burkinabé',
  '+226 71 34 56 78', 'Secteur 3, Avenue de l''Indépendance', 'Koudougou', 'Centre-Ouest', 'Burkina Faso',
  'CNI', 'B345678901'
);

-- Artisan 4: Intermédiaire - Ouagadougou
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  raison_sociale, numero_registre_commerce,
  telephone, email, adresse, commune, region, pays,
  observations
) VALUES (
  'SONASP/AM/2025/BF/0004', 'morale', 'intermediaire',
  'GOLD TRADING SARL', 'BF-OUA-2020-12345',
  '+226 70 45 67 89', 'contact@goldtrading.bf', 'Zone Industrielle, Rue de l''Industrie', 'Ouagadougou', 'Centre', 'Burkina Faso',
  'Société spécialisée dans le commerce de l''or depuis 2020'
);

-- Artisan 5: Exploitant - Dori
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite
) VALUES (
  'SONASP/AM/2025/BF/0005', 'physique', 'exploitant',
  'DIALLO', 'Ibrahim', '1982-05-30', 'Dori', 'M', 'Burkinabé',
  '+226 72 56 78 90', 'Quartier Central', 'Dori', 'Sahel', 'Burkina Faso',
  'CNI', 'B456789012'
);

-- Artisan 6: Fournisseur - Ouagadougou
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  raison_sociale, numero_registre_commerce,
  telephone, email, adresse, commune, region, pays
) VALUES (
  'SONASP/AM/2025/BF/0006', 'morale', 'fournisseur',
  'EQUIPEMENTS MINIERS BF', 'BF-OUA-2018-67890',
  '+226 70 67 89 01', 'info@equipminiers.bf', 'Zone Commerciale, Avenue Charles de Gaulle', 'Ouagadougou', 'Centre', 'Burkina Faso'
);

-- Artisan 7: Exploitant - Banfora
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite
) VALUES (
  'SONASP/AM/2025/BF/0007', 'physique', 'exploitant',
  'TRAORE', 'Seydou', '1988-09-12', 'Banfora', 'M', 'Burkinabé',
  '+226 73 78 90 12', 'Quartier Résidentiel', 'Banfora', 'Cascades', 'Burkina Faso',
  'CNI', 'B567890123'
);

-- Artisan 8: Collecteur - Fada N'Gourma
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite
) VALUES (
  'SONASP/AM/2025/BF/0008', 'physique', 'collecteur',
  'COMPAORE', 'Aminata', '1986-02-25', 'Fada N''Gourma', 'F', 'Burkinabé',
  '+226 74 89 01 23', 'Centre-Ville', 'Fada N''Gourma', 'Est', 'Burkina Faso',
  'CNI', 'B678901234'
);

-- Artisan 9: Exploitant - Gaoua
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite
) VALUES (
  'SONASP/AM/2025/BF/0009', 'physique', 'exploitant',
  'ZONGO', 'Ali', '1983-12-18', 'Gaoua', 'M', 'Burkinabé',
  '+226 75 90 12 34', 'Quartier Administratif', 'Gaoua', 'Sud-Ouest', 'Burkina Faso',
  'CNI', 'B789012345'
);

-- Artisan 10: Intermédiaire - Ouahigouya
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, email, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite
) VALUES (
  'SONASP/AM/2025/BF/0010', 'physique', 'intermediaire',
  'KABORE', 'Jean-Baptiste', '1979-04-07', 'Ouahigouya', 'M', 'Burkinabé',
  '+226 76 01 23 45', 'jb.kabore@yahoo.fr', 'Avenue de la Liberté', 'Ouahigouya', 'Nord', 'Burkina Faso',
  'CNI', 'B890123456'
);

-- Artisan 11: Exploitant - Tenkodogo
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite
) VALUES (
  'SONASP/AM/2025/BF/0011', 'physique', 'exploitant',
  'YAMEOGO', 'Marie', '1991-06-20', 'Tenkodogo', 'F', 'Burkinabé',
  '+226 77 12 34 56', 'Secteur 2', 'Tenkodogo', 'Centre-Est', 'Burkina Faso',
  'CNI', 'B901234567'
);

-- Artisan 12: Collecteur - Ouagadougou
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  raison_sociale, numero_registre_commerce,
  telephone, email, adresse, commune, region, pays
) VALUES (
  'SONASP/AM/2025/BF/0012', 'morale', 'collecteur',
  'BURKINA GOLD COLLECTION', 'BF-OUA-2021-11111',
  '+226 70 23 45 67', 'contact@bgcollection.bf', 'Zone d''Activités Diverses, Secteur 20', 'Ouagadougou', 'Centre', 'Burkina Faso'
);

-- Artisan 13: Exploitant - Djibo
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite
) VALUES (
  'SONASP/AM/2025/BF/0013', 'physique', 'exploitant',
  'BARRY', 'Boureima', '1984-08-14', 'Djibo', 'M', 'Burkinabé',
  '+226 78 34 56 78', 'Quartier Centre', 'Djibo', 'Sahel', 'Burkina Faso',
  'CNI', 'B012345678'
);

-- Artisan 14: Exploitant - Dédougou
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite
) VALUES (
  'SONASP/AM/2025/BF/0014', 'physique', 'exploitant',
  'SOME', 'Rasmata', '1989-01-28', 'Dédougou', 'F', 'Burkinabé',
  '+226 79 45 67 89', 'Secteur 1', 'Dédougou', 'Boucle du Mouhoun', 'Burkina Faso',
  'CNI', 'B123450987'
);

-- Artisan 15: Intermédiaire - Bobo-Dioulasso
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, email, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite
) VALUES (
  'SONASP/AM/2025/BF/0015', 'physique', 'intermediaire',
  'COULIBALY', 'Moussa', '1980-10-05', 'Bobo-Dioulasso', 'M', 'Burkinabé',
  '+226 71 56 78 90', 'm.coulibaly@hotmail.com', 'Quartier Belle-Ville', 'Bobo-Dioulasso', 'Hauts-Bassins', 'Burkina Faso',
  'CNI', 'B234509876'
);

-- Artisan 16: Exploitant - Manga
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite
) VALUES (
  'SONASP/AM/2025/BF/0016', 'physique', 'exploitant',
  'NACANABO', 'Paul', '1987-03-11', 'Manga', 'M', 'Burkinabé',
  '+226 72 67 89 01', 'Centre-Ville', 'Manga', 'Centre-Sud', 'Burkina Faso',
  'CNI', 'B345098765'
);

-- Artisan 17: Fournisseur - Ouagadougou
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  raison_sociale, numero_registre_commerce,
  telephone, email, adresse, commune, region, pays
) VALUES (
  'SONASP/AM/2025/BF/0017', 'morale', 'fournisseur',
  'MATERIELS MINES BURKINA', 'BF-OUA-2019-22222',
  '+226 70 78 90 12', 'ventes@mmbf.com', 'Zone Industrielle Kossodo', 'Ouagadougou', 'Centre', 'Burkina Faso'
);

-- Artisan 18: Collecteur - Ziniaré
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite
) VALUES (
  'SONASP/AM/2025/BF/0018', 'physique', 'collecteur',
  'ILBOUDO', 'Clarisse', '1992-07-16', 'Ziniaré', 'F', 'Burkinabé',
  '+226 73 89 01 23', 'Quartier Résidentiel', 'Ziniaré', 'Plateau-Central', 'Burkina Faso',
  'CNI', 'B450987654'
);

-- Artisan 19: Exploitant - Léo
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite,
  telephone, adresse, commune, region, pays,
  type_piece_identite, numero_piece_identite
) VALUES (
  'SONASP/AM/2025/BF/0019', 'physique', 'exploitant',
  'TAPSOBA', 'Georges', '1985-11-23', 'Léo', 'M', 'Burkinabé',
  '+226 74 90 12 34', 'Centre-Ville', 'Léo', 'Centre-Ouest', 'Burkina Faso',
  'CNI', 'B509876543'
);

-- Artisan 20: Intermédiaire - Ouagadougou
INSERT INTO public.snp_artisans_miniers (
  numero_carte, type_personne, type_artisan,
  raison_sociale, numero_registre_commerce,
  telephone, email, adresse, commune, region, pays,
  observations
) VALUES (
  'SONASP/AM/2025/BF/0020', 'morale', 'intermediaire',
  'SAHEL PRECIOUS METALS', 'BF-OUA-2022-33333',
  '+226 70 01 23 45', 'info@sahelmetals.bf', 'Avenue de la Nation, Immeuble Le Ponant', 'Ouagadougou', 'Centre', 'Burkina Faso',
  'Négociant international en métaux précieux'
);
