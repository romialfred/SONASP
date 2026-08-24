import { describe, expect, it } from 'vitest';
import {
  ErreurValidationUploadServeur,
  POLITIQUE_CERTIFICAT_ANALYSE,
  POLITIQUE_DOCUMENT_SOCIETE_MINIERE,
  signatureCorrespond,
  validerUploadServeur,
} from './secure-upload.ts';

const encodeur = new TextEncoder();

function concat(...parties: Uint8Array[]): Uint8Array {
  const resultat = new Uint8Array(parties.reduce((total, partie) => total + partie.length, 0));
  let position = 0;
  for (const partie of parties) {
    resultat.set(partie, position);
    position += partie.length;
  }
  return resultat;
}

function zipMinimal(noms: string[]): Uint8Array {
  const locaux: Uint8Array[] = [];
  const centraux: Uint8Array[] = [];
  let positionLocale = 0;
  for (const nom of noms) {
    const nomOctets = encodeur.encode(nom);
    const contenu = new Uint8Array([0x20]);
    const local = new Uint8Array(30 + nomOctets.length + contenu.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint32(18, contenu.length, true);
    lv.setUint32(22, contenu.length, true);
    lv.setUint16(26, nomOctets.length, true);
    local.set(nomOctets, 30);
    local.set(contenu, 30 + nomOctets.length);
    locaux.push(local);

    const central = new Uint8Array(46 + nomOctets.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(20, contenu.length, true);
    cv.setUint32(24, contenu.length, true);
    cv.setUint16(28, nomOctets.length, true);
    cv.setUint32(42, positionLocale, true);
    central.set(nomOctets, 46);
    centraux.push(central);
    positionLocale += local.length;
  }
  const blocLocal = concat(...locaux);
  const blocCentral = concat(...centraux);
  const fin = new Uint8Array(22);
  const fv = new DataView(fin.buffer);
  fv.setUint32(0, 0x06054b50, true);
  fv.setUint16(8, noms.length, true);
  fv.setUint16(10, noms.length, true);
  fv.setUint32(12, blocCentral.length, true);
  fv.setUint32(16, blocLocal.length, true);
  return concat(blocLocal, blocCentral, fin);
}

describe('secure-upload', () => {
  it('accepte un PDF cohérent et normalise son nom sans réutiliser ce nom comme chemin', () => {
    const result = validerUploadServeur({
      fileName: 'Permis minier (final).PDF',
      declaredMimeType: 'application/pdf',
      bytes: encodeur.encode('%PDF-1.7\nobjet\n%%EOF'),
    }, POLITIQUE_DOCUMENT_SOCIETE_MINIERE);

    expect(result).toMatchObject({
      extension: 'pdf',
      mimeType: 'application/pdf',
      safeFileName: 'Permis minier (final).pdf',
      signature: 'pdf',
    });
  });

  it('rejette un contenu texte renommé en PDF malgré un MIME déclaré conforme', () => {
    expect(() => validerUploadServeur({
      fileName: 'preuve.pdf',
      declaredMimeType: 'application/pdf',
      bytes: encodeur.encode('ceci est un exécutable déguisé'),
    }, POLITIQUE_DOCUMENT_SOCIETE_MINIERE)).toThrowError(
      expect.objectContaining({ code: 'signature' }),
    );
  });

  it.each(['preuve.exe.pdf', '../preuve.pdf', 'preuve.pdf.exe', 'CON.pdf'])('rejette le nom dangereux %s', (fileName) => {
    expect(() => validerUploadServeur({
      fileName,
      declaredMimeType: 'application/pdf',
      bytes: encodeur.encode('%PDF-1.7\n%%EOF'),
    }, POLITIQUE_DOCUMENT_SOCIETE_MINIERE)).toThrow(ErreurValidationUploadServeur);
  });

  it('reconnaît un DOCX structurel et refuse une archive à macros', () => {
    const requis = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml'];
    expect(signatureCorrespond(zipMinimal(requis), 'docx')).toBe(true);
    expect(signatureCorrespond(zipMinimal([...requis, 'word/vbaProject.bin']), 'docx')).toBe(false);
  });

  it('rejette un dépassement selon la politique serveur, indépendamment du client', () => {
    expect(() => validerUploadServeur({
      fileName: 'preuve.pdf',
      declaredMimeType: 'application/pdf',
      bytes: encodeur.encode('%PDF-1.7\n%%EOF'),
    }, { ...POLITIQUE_DOCUMENT_SOCIETE_MINIERE, maxBytes: 4 })).toThrowError(
      expect.objectContaining({ code: 'size' }),
    );
  });

  it('limite le certificat d’analyse au PDF et à 10 Mio côté serveur', () => {
    expect(POLITIQUE_CERTIFICAT_ANALYSE.maxBytes).toBe(10 * 1024 * 1024);
    expect(() => validerUploadServeur({
      fileName: 'certificat.png',
      declaredMimeType: 'image/png',
      bytes: new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0, 0, 0, 0, 0x49, 0x48, 0x44, 0x52,
        ...new Array(9).fill(0),
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]),
    }, POLITIQUE_CERTIFICAT_ANALYSE)).toThrowError(
      expect.objectContaining({ code: 'extension' }),
    );
  });
});
