const MEBIBYTE = 1024 * 1024;

export interface UploadFormat {
  extensions: readonly string[];
  mimeTypes: readonly string[];
  canonicalMimeType: string;
}

export interface UploadPolicy {
  maxBytes: number;
  formats: readonly UploadFormat[];
  acceptedLabel: string;
}

export interface ValidatedUploadFile {
  extension: string;
  mimeType: string;
}

export type UploadValidationCode =
  | 'invalid-name'
  | 'unsafe-extension'
  | 'mime-mismatch'
  | 'empty-file'
  | 'file-too-large';

export class UploadValidationError extends Error {
  constructor(public readonly code: UploadValidationCode, message: string) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

const PDF: UploadFormat = {
  extensions: ['pdf'],
  mimeTypes: ['application/pdf'],
  canonicalMimeType: 'application/pdf',
};

const JPEG: UploadFormat = {
  extensions: ['jpg', 'jpeg'],
  mimeTypes: ['image/jpeg', 'image/jpg'],
  canonicalMimeType: 'image/jpeg',
};

const PNG: UploadFormat = {
  extensions: ['png'],
  mimeTypes: ['image/png'],
  canonicalMimeType: 'image/png',
};

const DOCX: UploadFormat = {
  extensions: ['docx'],
  mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  canonicalMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const DANGEROUS_EXTENSIONS = new Set([
  'app', 'bat', 'cmd', 'com', 'cpl', 'dll', 'exe', 'hta', 'html', 'htm',
  'jar', 'js', 'jse', 'lnk', 'msi', 'msp', 'php', 'ps1', 'scr', 'svg',
  'vbe', 'vbs', 'wsf', 'xhtml',
]);

export const UPLOAD_POLICIES = {
  assayCertificate: {
    maxBytes: 10 * MEBIBYTE,
    formats: [PDF],
    acceptedLabel: 'un fichier PDF',
  },
  mineDocument: {
    // Même plafond que `snp_portail_mine_enregistrer_document`.
    maxBytes: 15 * MEBIBYTE,
    formats: [PDF, JPEG, PNG, DOCX],
    acceptedLabel: 'un PDF, une image JPEG/PNG ou un document DOCX',
  },
  productionDocument: {
    maxBytes: 10 * MEBIBYTE,
    formats: [PDF],
    acceptedLabel: 'un fichier PDF',
  },
  freightCustomsDocument: {
    maxBytes: 20 * MEBIBYTE,
    formats: [PDF, JPEG, PNG],
    acceptedLabel: 'un PDF ou une image JPEG/PNG',
  },
  artisanPhoto: {
    maxBytes: 5 * MEBIBYTE,
    formats: [JPEG, PNG],
    acceptedLabel: 'une image JPEG ou PNG',
  },
  artisanDocument: {
    maxBytes: 10 * MEBIBYTE,
    formats: [PDF, JPEG, PNG],
    acceptedLabel: 'un PDF ou une image JPEG/PNG',
  },
  shippingDocument: {
    maxBytes: 10 * MEBIBYTE,
    // Le format DOC binaire n'est pas suffisamment vérifiable sans parseur
    // spécialisé côté serveur. DOCX reste accepté après contrôle ZIP fermé.
    formats: [PDF, JPEG, PNG, DOCX],
    acceptedLabel: 'un PDF, une image JPEG/PNG ou un document DOCX',
  },
} as const satisfies Record<string, UploadPolicy>;

function maximumLabel(maxBytes: number): string {
  return `${Math.round(maxBytes / MEBIBYTE)} Mo`;
}

/**
 * Contrôle de défense en profondeur avant Storage. Le MIME navigateur reste
 * déclaratif : les buckets/RPC doivent conserver leurs propres allowlists.
 */
export function validateUploadFile(
  file: Pick<File, 'name' | 'size' | 'type'>,
  policy: UploadPolicy,
): ValidatedUploadFile {
  const name = file.name.normalize('NFC').trim();
  if (
    name.length === 0
    || name.length > 255
    || /[\u0000-\u001f\u007f/\\]/u.test(name)
    || /[\u202a-\u202e\u2066-\u2069]/u.test(name)
  ) {
    throw new UploadValidationError('invalid-name', 'Le nom du fichier contient des caractères interdits.');
  }

  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    throw new UploadValidationError('empty-file', 'Le fichier est vide ou sa taille est invalide.');
  }
  if (file.size > policy.maxBytes) {
    throw new UploadValidationError(
      'file-too-large',
      `Le fichier dépasse la limite de ${maximumLabel(policy.maxBytes)}.`,
    );
  }

  const segments = name.toLowerCase().split('.');
  if (segments.length < 2 || !segments[0]) {
    throw new UploadValidationError('unsafe-extension', `Format refusé : versez ${policy.acceptedLabel}.`);
  }
  const extension = segments[segments.length - 1] ?? '';
  if (!/^[a-z0-9]{1,10}$/u.test(extension)) {
    throw new UploadValidationError('unsafe-extension', `Format refusé : versez ${policy.acceptedLabel}.`);
  }
  if (segments.slice(1, -1).some((segment) => DANGEROUS_EXTENSIONS.has(segment))) {
    throw new UploadValidationError('unsafe-extension', 'Le nom masque une extension exécutable interdite.');
  }

  const mimeType = file.type.trim().toLowerCase().split(';', 1)[0];
  const format = policy.formats.find((candidate) =>
    candidate.extensions.includes(extension)
    && candidate.mimeTypes.includes(mimeType),
  );
  if (!format) {
    throw new UploadValidationError(
      'mime-mismatch',
      `Le type et l’extension ne correspondent pas à ${policy.acceptedLabel}.`,
    );
  }

  return { extension, mimeType: format.canonicalMimeType };
}
