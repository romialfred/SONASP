import { describe, expect, it } from 'vitest';
import {
  UPLOAD_POLICIES,
  UploadValidationError,
  validateUploadFile,
} from './uploadValidation';

const fichier = (name: string, type: string, size = 128) => ({ name, type, size });

describe('validation de sécurité des téléversements', () => {
  it('normalise une extension admise et le MIME canonique', () => {
    expect(validateUploadFile(
      fichier('certificat.PDF', 'application/pdf'),
      UPLOAD_POLICIES.assayCertificate,
    )).toEqual({ extension: 'pdf', mimeType: 'application/pdf' });

    expect(validateUploadFile(
      fichier('photo.JPEG', 'image/jpg'),
      UPLOAD_POLICIES.artisanPhoto,
    )).toEqual({ extension: 'jpeg', mimeType: 'image/jpeg' });
  });

  it('refuse les fichiers vides et ceux qui dépassent la politique', () => {
    expect(() => validateUploadFile(
      fichier('preuve.pdf', 'application/pdf', 0),
      UPLOAD_POLICIES.shippingDocument,
    )).toThrowError(UploadValidationError);

    expect(() => validateUploadFile(
      fichier('preuve.pdf', 'application/pdf', UPLOAD_POLICIES.shippingDocument.maxBytes + 1),
      UPLOAD_POLICIES.shippingDocument,
    )).toThrow(/10 Mo/);
  });

  it('refuse un MIME absent ou incohérent avec l’extension', () => {
    expect(() => validateUploadFile(
      fichier('fausse-photo.jpg', 'application/pdf'),
      UPLOAD_POLICIES.artisanDocument,
    )).toThrow(/ne correspondent pas/);
    expect(() => validateUploadFile(
      fichier('inconnu.pdf', ''),
      UPLOAD_POLICIES.assayCertificate,
    )).toThrow(/ne correspondent pas/);
  });

  it('bloque les doubles extensions actives et les noms de chemin', () => {
    expect(() => validateUploadFile(
      fichier('facture.exe.pdf', 'application/pdf'),
      UPLOAD_POLICIES.shippingDocument,
    )).toThrow(/exécutable/);
    expect(() => validateUploadFile(
      fichier('../facture.pdf', 'application/pdf'),
      UPLOAD_POLICIES.shippingDocument,
    )).toThrow(/caractères interdits/);
  });

  it('aligne le portail mine sur les quatre formats acceptés par son RPC', () => {
    expect(validateUploadFile(
      fichier(
        'rapport.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
      UPLOAD_POLICIES.mineDocument,
    ).extension).toBe('docx');
    expect(() => validateUploadFile(
      fichier('ancien.doc', 'application/msword'),
      UPLOAD_POLICIES.mineDocument,
    )).toThrow(/ne correspondent pas/);
  });
});
