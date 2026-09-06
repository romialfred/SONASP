import { useState } from 'react';
import { FileText, Plus, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import { validateUploadFile, UPLOAD_POLICIES } from '@/lib/uploadValidation';
import { secureRandomId } from '@/lib/secureRandom';
import {
  artisanDocumentService,
  type ArtisanDocument,
  type DocumentOwner,
  type PendingArtisanDocument,
} from '@/services/artisanDocumentService';

export function ArtisanDocuments({
  owner,
  saved,
  pending,
  onAdd,
  onRemovePending,
  onRemoveSaved,
  busy,
  photo = false,
  onRetry,
}: {
  owner: DocumentOwner;
  saved: ArtisanDocument[];
  pending: PendingArtisanDocument[];
  onAdd: (docs: PendingArtisanDocument[]) => void;
  onRemovePending: (id: string) => void;
  onRemoveSaved: (doc: ArtisanDocument) => Promise<void>;
  busy: boolean;
  photo?: boolean;
  onRetry: () => void;
}) {
  const [type, setType] = useState(
    photo ? 'photo' : owner === 'societe' ? 'rccm' : 'cni',
  );
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [replaces, setReplaces] = useState<string>();
  const options = photo
    ? [['photo', 'Photo d’identité']]
    : owner === 'societe'
      ? [
          ['rccm', 'RCCM'],
          ['ifu', 'IFU'],
          ['autre', 'Autre justificatif'],
        ]
      : [
          ['cni', 'CNIB / Carte nationale d’identité'],
          ['passeport', 'Passeport'],
          ['permis', 'Permis de conduire'],
          ['certificat', 'Certificat'],
          ['autre', 'Autre pièce'],
        ];
  const docs = saved.filter(
    (d) =>
      d.owner_kind === owner &&
      (photo ? d.type_document === 'photo' : d.type_document !== 'photo'),
  );
  const queue = pending.filter(
    (d) =>
      d.owner === owner && (photo ? d.type === 'photo' : d.type !== 'photo'),
  );
  const label = photo
    ? 'Photo d’identité'
    : owner === 'societe'
      ? 'Pièces de la société'
      : owner === 'responsable'
        ? 'Pièces du responsable'
        : 'Pièces de l’artisan';
  const inputId = `files-${owner}-${photo ? 'photo' : 'documents'}`;
  return (
    <div className="artisan-documents">
      {!photo && (
        <div className="artisan-dossier__grid">
          <label className="sn-field">
            <span className="sn-field__label">Type de justificatif</span>
            <select
              value={type}
              disabled={busy}
              onChange={(e) => setType(e.target.value)}
            >
              {options.map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="sn-field">
            <span className="sn-field__label">Titre des pièces</span>
            <input
              value={title}
              maxLength={150}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. CNIB recto / verso"
            />
          </label>
        </div>
      )}
      {replaces && (
        <p>
          Choisissez le fichier de remplacement. La pièce précédente restera
          disponible jusqu’à la réussite du dépôt.{' '}
          <button type="button" onClick={() => setReplaces(undefined)}>
            Annuler le remplacement
          </button>
        </p>
      )}
      <div className="artisan-documents__drop">
        <FileText aria-hidden="true" />
        <div>
          <strong>
            {photo ? 'Ajouter une photo' : 'Joindre des justificatifs'}
          </strong>
          <small>
            {photo
              ? 'JPG ou PNG · 2 Mo maximum'
              : 'JPG, PNG ou PDF · 5 Mo par fichier · recto et verso acceptés'}
          </small>
        </div>
        <label className="sn-btn sn-btn--sm" htmlFor={inputId}>
          <Plus aria-hidden="true" /> Parcourir
        </label>
        <input
          id={inputId}
          aria-label={label}
          type="file"
          multiple={!photo && !replaces}
          disabled={busy}
          accept={
            photo
              ? 'image/jpeg,image/png'
              : 'image/jpeg,image/png,application/pdf'
          }
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            setError('');
            try {
              if (
                files.length > 10 ||
                files.reduce((n, f) => n + f.size, 0) > 50 * 1024 * 1024
              )
                throw new Error(
                  'Ajoutez au maximum 10 fichiers et 50 Mo par sélection.',
                );
              if (
                saved.length +
                  pending.filter((d) => d.status !== 'saved').length +
                  files.length >
                50
              )
                throw new Error('Le dossier accepte au maximum 50 pièces.');
              files.forEach((file) =>
                validateUploadFile(
                  file,
                  photo
                    ? UPLOAD_POLICIES.artisanPhoto
                    : UPLOAD_POLICIES.artisanDocument,
                ),
              );
              onAdd(
                files.map((file) => ({
                  id: secureRandomId(),
                  owner,
                  type,
                  title: title.trim() || file.name.slice(0, 150),
                  file,
                  status: 'pending',
                  replacesId: replaces,
                })),
              );
              setReplaces(undefined);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : 'Le fichier est invalide.',
              );
            }
          }}
        />
      </div>
      {error && (
        <p role="alert" className="artisan-dossier__error">
          {error}
        </p>
      )}
      {(docs.length > 0 || queue.length > 0) && (
        <ul className="artisan-documents__list">
          {docs.map((doc) => (
            <li key={doc.id}>
              <FileText aria-hidden="true" />
              <div>
                <strong>{doc.titre || doc.nom_fichier}</strong>
                <small>
                  {doc.type_document.toUpperCase()} ·{' '}
                  {Math.round((doc.taille_fichier || 0) / 1024)} Ko · Enregistré
                </small>
              </div>
              <button
                type="button"
                className="sn-btn sn-btn--sm"
                aria-label={`Ouvrir ${doc.titre || doc.nom_fichier}`}
                onClick={async () => {
                  try {
                    const url = await artisanDocumentService.url(doc);
                    window.open(url, '_blank', 'noopener,noreferrer');
                  } catch {
                    setError('L’ouverture de la pièce a échoué. Réessayez.');
                  }
                }}
              >
                <ExternalLink />
              </button>
              {doc.storage_bucket === 'artisan-dossiers' && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    className="sn-btn sn-btn--sm"
                    aria-label={`Remplacer ${doc.titre || doc.nom_fichier}`}
                    onClick={() => {
                      setType(doc.type_document);
                      setTitle(doc.titre || doc.nom_fichier);
                      setReplaces(doc.id);
                      document.getElementById(inputId)?.focus();
                    }}
                  >
                    <RefreshCw />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="sn-btn sn-btn--sm"
                    aria-label={`Retirer ${doc.titre || doc.nom_fichier}`}
                    onClick={async () => {
                      try {
                        await onRemoveSaved(doc);
                      } catch {
                        setError('La pièce n’a pas été retirée. Réessayez.');
                      }
                    }}
                  >
                    <Trash2 />
                  </button>
                </>
              )}
            </li>
          ))}
          {queue
            .filter((d) => d.status !== 'saved')
            .map((doc) => (
              <li
                key={doc.id}
                className={doc.status === 'failed' ? 'is-failed' : ''}
              >
                <FileText aria-hidden="true" />
                <div>
                  <strong>{doc.title}</strong>
                  <small>
                    {doc.file.name} ·{' '}
                    {doc.status === 'uploading'
                      ? 'Envoi…'
                      : doc.status === 'failed'
                        ? 'Échec du dépôt'
                        : 'À envoyer à l’enregistrement'}
                  </small>
                  {doc.error && <span role="alert">{doc.error}</span>}
                </div>
                {doc.status === 'failed' && (
                  <button
                    type="button"
                    disabled={busy}
                    className="sn-btn sn-btn--sm"
                    onClick={onRetry}
                  >
                    Réessayer
                  </button>
                )}
                <button
                  type="button"
                  className="sn-btn sn-btn--sm"
                  disabled={busy}
                  aria-label={`Retirer le fichier ${doc.file.name}`}
                  onClick={() => onRemovePending(doc.id)}
                >
                  <Trash2 />
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
