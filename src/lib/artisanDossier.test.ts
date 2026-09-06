import { describe, expect, it } from 'vitest';
import {
  artisanDossierPayload,
  artisanErrors,
  completionRate,
  dossierRequirements,
  valuesFromArtisan,
  type ArtisanFormValues,
} from './artisanDossier';

const person = (): ArtisanFormValues => ({
  ...valuesFromArtisan(null),
  nom: 'KABORE',
  date_naissance: '1990-01-01',
  region: 'Centre',
  commune: 'Ouagadougou',
  telephone: '+226 70 00 00 01',
  numero_piece_identite: '0012',
});
const company = (): ArtisanFormValues => ({
  ...person(),
  type_personne: 'morale',
  raison_sociale: 'Société',
  numero_registre_commerce: '000-RCCM',
  numero_ifu: '000-IFU',
  siege_region: 'Centre',
  siege_commune: 'Ouagadougou',
  siege_adresse: 'Siège',
  responsable: {
    ...valuesFromArtisan(null).responsable,
    nom: 'Responsable',
    prenoms: 'Essai',
    date_naissance: '1980-01-01',
    telephone: '+22670000002',
    fonction: 'Gérant',
    numero_piece_identite: 'DOC-001',
  },
});
describe('contrat du dossier artisan', () => {
  for (const quality of ['physique', 'morale'] as const)
    for (const role of [
      'exploitant',
      'fournisseur',
      'aide_exploitant',
      'intermediaire',
    ] as const) {
      it(quality + ' / ' + role, () => {
        const v = quality === 'physique' ? person() : company();
        v.type_artisan = role;
        if (role === 'aide_exploitant') v.exploitant_id = 'parent-id';
        expect(artisanErrors(v)).toEqual({});
        expect(completionRate(v)).toBe(100);
      });
    }
  it('mesure uniquement les obligations, avec les choix déjà renseignés', () => {
    const empty = valuesFromArtisan(null);
    expect(dossierRequirements(empty).filter((f) => f.value)).toHaveLength(4);
    expect(completionRate(empty)).toBe(40);
    expect(completionRate(person())).toBe(100);
  });
  it('exclut les champs et pièces de la branche inactive du payload', () => {
    const c = company();
    const p = artisanDossierPayload(c);
    expect(p).not.toHaveProperty('nom');
    expect(p).not.toHaveProperty('date_naissance');
    expect(p).not.toHaveProperty('photo_url');
    expect(p).toHaveProperty('numero_ifu', '000-IFU');
    c.type_personne = 'physique';
    expect(artisanDossierPayload(c)).not.toHaveProperty('responsable');
    expect(artisanDossierPayload(c)).not.toHaveProperty('numero_ifu');
  });
  it('ne confond pas le responsable avec l’artisan et respecte le choix WhatsApp', () => {
    const c = company();
    c.responsable.whatsapp = '+22670000003';
    expect(artisanDossierPayload(c)).toHaveProperty(
      'responsable.whatsapp',
      '+22670000003',
    );
    c.responsable.whatsapp_identique = true;
    expect(artisanDossierPayload(c)).toHaveProperty(
      'responsable.whatsapp',
      c.responsable.telephone,
    );
  });
  it('un aide exige son exploitant, sans site direct', () => {
    const p = person();
    p.type_artisan = 'aide_exploitant';
    p.artisanal_site_id = 'un-site';
    expect(artisanErrors(p)).toHaveProperty('exploitant_id');
    expect(artisanDossierPayload(p).artisanal_site_id).toBeNull();
  });
  it('rejette une naissance future et des dates incohérentes, sans interdire une pièce expirée', () => {
    expect(
      artisanErrors({ ...person(), date_naissance: '2099-01-01' }),
    ).toHaveProperty('date_naissance');
    expect(
      artisanErrors({
        ...person(),
        date_delivrance_piece: '2020-01-01',
        date_expiration_piece: '2019-01-01',
      }),
    ).toHaveProperty('date_expiration_piece');
    expect(
      artisanErrors({
        ...person(),
        date_delivrance_piece: '2018-01-01',
        date_expiration_piece: '2019-01-01',
      }),
    ).toEqual({});
  });
  it('préserve les collecteurs historiques et un sexe non renseigné', () => {
    const v = valuesFromArtisan({ type_artisan: 'collecteur', sexe: null });
    expect(v.type_artisan).toBe('collecteur');
    expect(v.sexe).toBe('');
  });
});
