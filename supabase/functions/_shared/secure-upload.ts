export type SignatureFichier = 'pdf' | 'jpeg' | 'png' | 'docx';

export interface FormatUploadServeur {
  extensions: readonly string[];
  mimeTypes: readonly string[];
  canonicalMimeType: string;
  signature: SignatureFichier;
}

export interface PolitiqueUploadServeur {
  maxBytes: number;
  formats: readonly FormatUploadServeur[];
}

export interface UploadServeurValide {
  extension: string;
  mimeType: string;
  safeFileName: string;
  signature: SignatureFichier;
}

export class ErreurValidationUploadServeur extends Error {
  constructor(
    public readonly code: 'name' | 'extension' | 'mime' | 'size' | 'signature',
  ) {
    super('UPLOAD_REJECTED');
    this.name = 'ErreurValidationUploadServeur';
  }
}

const EXTENSIONS_DANGEREUSES = new Set([
  'app', 'bat', 'cmd', 'com', 'cpl', 'dll', 'exe', 'hta', 'html', 'htm',
  'jar', 'js', 'jse', 'lnk', 'msi', 'msp', 'php', 'ps1', 'scr', 'svg',
  'vbe', 'vbs', 'wsf', 'xhtml',
]);

const NOMS_RESERVES = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const PDF: FormatUploadServeur = {
  extensions: ['pdf'],
  mimeTypes: ['application/pdf'],
  canonicalMimeType: 'application/pdf',
  signature: 'pdf',
};
const JPEG: FormatUploadServeur = {
  extensions: ['jpg', 'jpeg'],
  mimeTypes: ['image/jpeg', 'image/jpg'],
  canonicalMimeType: 'image/jpeg',
  signature: 'jpeg',
};
const PNG: FormatUploadServeur = {
  extensions: ['png'],
  mimeTypes: ['image/png'],
  canonicalMimeType: 'image/png',
  signature: 'png',
};
const DOCX: FormatUploadServeur = {
  extensions: ['docx'],
  mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  canonicalMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  signature: 'docx',
};

export const POLITIQUE_DOCUMENT_SOCIETE_MINIERE: PolitiqueUploadServeur = {
  maxBytes: 15 * 1024 * 1024,
  formats: [PDF, JPEG, PNG, DOCX],
};

export const POLITIQUE_CERTIFICAT_ANALYSE: PolitiqueUploadServeur = {
  maxBytes: 10 * 1024 * 1024,
  formats: [PDF],
};

export const POLITIQUE_DOCUMENT_EXPEDITION: PolitiqueUploadServeur = {
  maxBytes: 10 * 1024 * 1024,
  formats: [PDF, JPEG, PNG, DOCX],
};

export const POLITIQUE_DOCUMENT_PRODUCTION: PolitiqueUploadServeur = {
  maxBytes: 10 * 1024 * 1024,
  formats: [PDF],
};

export const POLITIQUE_DOCUMENT_FRET: PolitiqueUploadServeur = {
  maxBytes: 20 * 1024 * 1024,
  formats: [PDF, JPEG, PNG],
};

export const POLITIQUE_PREUVE_PAIEMENT: PolitiqueUploadServeur = {
  maxBytes: 10 * 1024 * 1024,
  formats: [PDF, JPEG, PNG],
};

export const POLITIQUE_DOCUMENT_RESERVE: PolitiqueUploadServeur = {
  maxBytes: 15 * 1024 * 1024,
  formats: [PDF, JPEG, PNG],
};

export const POLITIQUE_DOCUMENT_ARTISAN: PolitiqueUploadServeur = { maxBytes: 5 * 1024 * 1024, formats: [PDF, JPEG, PNG] };
export const POLITIQUE_PHOTO_ARTISAN: PolitiqueUploadServeur = { maxBytes: 2 * 1024 * 1024, formats: [JPEG, PNG] };

function commencePar(octets: Uint8Array, signature: readonly number[], position = 0): boolean {
  return signature.every((octet, index) => octets[position + index] === octet);
}

function contientDepuisLaFin(
  octets: Uint8Array,
  signature: readonly number[],
  fenetre: number,
): boolean {
  const depart = Math.max(0, octets.length - fenetre);
  for (let position = octets.length - signature.length; position >= depart; position -= 1) {
    if (commencePar(octets, signature, position)) return true;
  }
  return false;
}

function signaturePdf(octets: Uint8Array): boolean {
  return octets.length >= 12
    && commencePar(octets, [0x25, 0x50, 0x44, 0x46, 0x2d])
    && contientDepuisLaFin(octets, [0x25, 0x25, 0x45, 0x4f, 0x46], 4_096);
}

function signatureJpeg(octets: Uint8Array): boolean {
  return octets.length >= 4
    && commencePar(octets, [0xff, 0xd8, 0xff])
    && octets[octets.length - 2] === 0xff
    && octets[octets.length - 1] === 0xd9;
}

function signaturePng(octets: Uint8Array): boolean {
  return octets.length >= 33
    && commencePar(octets, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    && commencePar(octets, [0x49, 0x48, 0x44, 0x52], 12)
    && commencePar(
      octets,
      [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82],
      octets.length - 8,
    );
}

/**
 * Contrôle structurel minimal d'un DOCX sans décompresser son contenu.
 * Les tailles annoncées dans le répertoire central permettent aussi de rejeter
 * les archives chiffrées, les zip bombs évidentes et les documents à macros.
 */
function signatureDocx(octets: Uint8Array): boolean {
  if (octets.length < 22 || !commencePar(octets, [0x50, 0x4b, 0x03, 0x04])) return false;
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const debutRecherche = Math.max(0, octets.length - 65_557);
  let finRepertoire = -1;
  for (let position = octets.length - 22; position >= debutRecherche; position -= 1) {
    if (vue.getUint32(position, true) === 0x06054b50) {
      finRepertoire = position;
      break;
    }
  }
  if (finRepertoire < 0) return false;

  const commentaire = vue.getUint16(finRepertoire + 20, true);
  if (finRepertoire + 22 + commentaire !== octets.length) return false;
  const entrees = vue.getUint16(finRepertoire + 10, true);
  const tailleRepertoire = vue.getUint32(finRepertoire + 12, true);
  const debutRepertoire = vue.getUint32(finRepertoire + 16, true);
  if (
    entrees === 0 || entrees > 1_000 || entrees === 0xffff
    || debutRepertoire + tailleRepertoire > finRepertoire
  ) return false;

  const noms = new Set<string>();
  let tailleDecompressee = 0;
  let position = debutRepertoire;
  const decodeur = new TextDecoder('utf-8', { fatal: true });

  try {
    for (let index = 0; index < entrees; index += 1) {
      if (position + 46 > finRepertoire || vue.getUint32(position, true) !== 0x02014b50) return false;
      const drapeaux = vue.getUint16(position + 8, true);
      const tailleCompressee = vue.getUint32(position + 20, true);
      const tailleEntree = vue.getUint32(position + 24, true);
      const longueurNom = vue.getUint16(position + 28, true);
      const longueurExtra = vue.getUint16(position + 30, true);
      const longueurCommentaire = vue.getUint16(position + 32, true);
      const positionLocale = vue.getUint32(position + 42, true);
      const finEntree = position + 46 + longueurNom + longueurExtra + longueurCommentaire;
      if (
        (drapeaux & 0x0001) !== 0
        || longueurNom === 0
        || finEntree > finRepertoire
        || positionLocale + 4 > debutRepertoire
        || vue.getUint32(positionLocale, true) !== 0x04034b50
        || (tailleCompressee === 0 && tailleEntree > 0)
        || (tailleCompressee > 0 && tailleEntree / tailleCompressee > 500)
      ) return false;

      tailleDecompressee += tailleEntree;
      if (tailleDecompressee > 100 * 1024 * 1024) return false;
      const nom = decodeur.decode(octets.subarray(position + 46, position + 46 + longueurNom));
      if (
        /[\u0000-\u001f\u007f]/u.test(nom) || nom.includes('\\') || nom.startsWith('/')
        || nom.split('/').some((segment) => segment === '..')
      ) return false;
      const nomMinuscule = nom.toLowerCase();
      if (
        nomMinuscule.endsWith('vbaproject.bin')
        || nomMinuscule.includes('/embeddings/')
        || nomMinuscule.startsWith('customui/')
        || nomMinuscule.includes('/externallinks/')
      ) return false;
      noms.add(nom);
      position = finEntree;
    }
  } catch {
    return false;
  }

  return noms.has('[Content_Types].xml')
    && noms.has('_rels/.rels')
    && noms.has('word/document.xml');
}

export function signatureCorrespond(octets: Uint8Array, signature: SignatureFichier): boolean {
  switch (signature) {
    case 'pdf': return signaturePdf(octets);
    case 'jpeg': return signatureJpeg(octets);
    case 'png': return signaturePng(octets);
    case 'docx': return signatureDocx(octets);
  }
}

function securiserNom(nomBrut: string, extensionsAutorisees: Set<string>): {
  extension: string;
  safeFileName: string;
} {
  const nom = nomBrut.normalize('NFC').trim();
  if (
    nom.length === 0 || nom.length > 255 || new TextEncoder().encode(nom).byteLength > 512
    || nom.startsWith('.') || /[. ]$/u.test(nom)
    || /[\u0000-\u001f\u007f/\\]/u.test(nom)
    || /[\u202a-\u202e\u2066-\u2069]/u.test(nom)
  ) throw new ErreurValidationUploadServeur('name');

  const segments = nom.toLowerCase().split('.');
  if (segments.length < 2 || !segments[0]) throw new ErreurValidationUploadServeur('extension');
  const extension = segments.at(-1) ?? '';
  if (!/^[a-z0-9]{1,10}$/u.test(extension) || !extensionsAutorisees.has(extension)) {
    throw new ErreurValidationUploadServeur('extension');
  }
  if (segments.slice(1, -1).some((segment) => EXTENSIONS_DANGEREUSES.has(segment))) {
    throw new ErreurValidationUploadServeur('extension');
  }

  const baseOriginale = nom.slice(0, -(extension.length + 1));
  if (NOMS_RESERVES.test(baseOriginale.split('.')[0] ?? '')) {
    throw new ErreurValidationUploadServeur('name');
  }
  const base = baseOriginale
    .replace(/[^\p{L}\p{N} _().-]+/gu, '_')
    .replace(/\s+/gu, ' ')
    .replace(/_+/gu, '_')
    .replace(/^[. ]+|[. ]+$/gu, '');
  const longueurMax = Math.max(1, 180 - extension.length - 1);
  const baseTronquee = Array.from(base).slice(0, longueurMax).join('').replace(/[. ]+$/gu, '');
  if (!baseTronquee) throw new ErreurValidationUploadServeur('name');
  return { extension, safeFileName: `${baseTronquee}.${extension}` };
}

export function validerUploadServeur(
  entree: { fileName: string; declaredMimeType: string; bytes: Uint8Array },
  politique: PolitiqueUploadServeur,
): UploadServeurValide {
  if (entree.bytes.byteLength === 0 || entree.bytes.byteLength > politique.maxBytes) {
    throw new ErreurValidationUploadServeur('size');
  }
  const mime = entree.declaredMimeType.trim().toLowerCase().split(';', 1)[0];
  const extensions = new Set(politique.formats.flatMap((format) => [...format.extensions]));
  const nom = securiserNom(entree.fileName, extensions);
  const format = politique.formats.find((candidat) =>
    candidat.extensions.includes(nom.extension)
    && candidat.mimeTypes.includes(mime)
  );
  if (!format) throw new ErreurValidationUploadServeur('mime');
  if (!signatureCorrespond(entree.bytes, format.signature)) {
    throw new ErreurValidationUploadServeur('signature');
  }
  return {
    extension: nom.extension,
    mimeType: format.canonicalMimeType,
    safeFileName: nom.safeFileName,
    signature: format.signature,
  };
}
