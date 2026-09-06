import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  FileText,
  Info,
  Loader2,
  Pencil,
  Save,
  ShieldCheck,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NationalDashboardLayout } from "@/components/layout/NationalDashboardLayout";
import { Badge, Field, Note, PageHeader } from "@/components/ui/sn";
import { ComboBox } from "@/components/ui/ComboBox";
import { BURKINA_REGIONS } from "@/data/burkinaRegions";
import { canManageMiningRegistry } from "@/lib/miningRegistryAccess";
import { secureRandomId } from "@/lib/secureRandom";
import { UPLOAD_POLICIES, validateUploadFile } from "@/lib/uploadValidation";
import { messageErreurUtilisateur } from "@/lib/presentError";
import {
  useArtisanUnsavedChanges,
  confirmArtisanLeave,
} from "@/hooks/useArtisanUnsavedChanges";
import {
  COMPTOIR_DOCUMENT_KINDS,
  COMPTOIR_FIELD_LABELS,
  COMPTOIR_LEGAL_FORMS,
  COMPTOIR_SECTIONS,
  COMPTOIR_TAX_OFFICES,
  COMPTOIR_TAX_REGIMES,
  authorizationDays,
  authorizationStatus,
  comptoirCompletion,
  comptoirErrors,
  emptyComptoir,
  type ComptoirKey,
  type ComptoirValues,
  type ComptoirDocumentKind,
} from "@/lib/comptoirDossier";
import {
  comptoirService,
  type ComptoirDocument,
  type ComptoirRecord,
  type PendingComptoirDocument,
} from "@/services/comptoirService";
import "./collector.css";
import "./comptoir.css";

const ROOT = "/artisan-minier/comptoirs";
const dateLabel = (value: string) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(value))
    : "Non renseignée";
const identityOptions = [
  { value: "CNIB", label: "Carte nationale d’identité burkinabè (CNIB)" },
  { value: "PASSPORT", label: "Passeport" },
  { value: "RESIDENCE_PERMIT", label: "Carte de séjour" },
];

function DocumentSlot({
  kind,
  documents,
  pending,
  readOnly,
  busy,
  onFiles,
  onRemove,
  onUnstage,
  onError,
}: {
  kind: ComptoirDocumentKind;
  documents: ComptoirDocument[];
  pending: PendingComptoirDocument[];
  readOnly: boolean;
  busy: boolean;
  onFiles: (kind: ComptoirDocumentKind, files: File[]) => void;
  onRemove: (document: ComptoirDocument) => void;
  onUnstage: (id: string) => void;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const option = COMPTOIR_DOCUMENT_KINDS.find((d) => d.value === kind)!;
  const saved = documents.filter((d) => d.kind === kind),
    staged = pending.filter((d) => d.kind === kind);
  const [thumbnail, setThumbnail] = useState("");
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(
    null,
  );
  const [opening, setOpening] = useState("");
  const lastSaved = saved[0],
    lastStaged = staged[0];
  useEffect(() => {
    if (!option.image) return;
    if (lastStaged) {
      const url = URL.createObjectURL(lastStaged.file);
      setThumbnail(url);
      return () => URL.revokeObjectURL(url);
    }
    let live = true;
    setThumbnail("");
    if (lastSaved)
      void comptoirService
        .url(lastSaved)
        .then((url) => {
          if (live) setThumbnail(url);
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [option.image, lastSaved, lastStaged]);
  async function open(document: ComptoirDocument) {
    setOpening(document.id);
    try {
      setPreview({
        url: await comptoirService.url(document),
        name: document.file_name,
      });
    } catch (error) {
      onError(
        messageErreurUtilisateur(error, "Impossible d’ouvrir cette pièce."),
      );
    } finally {
      setOpening("");
    }
  }
  return (
    <div
      className={`comptoir-document${option.image ? " comptoir-document--image" : ""}`}
      id={`comptoir-document-${kind}`}
    >
      <div className="comptoir-document__head">
        <span className="comptoir-document__symbol">
          {thumbnail ? (
            <img src={thumbnail} alt={option.label} />
          ) : option.image ? (
            kind === "logo" ? (
              <Building2 />
            ) : (
              <UserRound />
            )
          ) : (
            <FileText />
          )}
        </span>
        <div>
          <strong>{option.label}</strong>
          <small>
            {option.image
              ? "JPG ou PNG · 2 Mo maximum"
              : "PDF, JPG ou PNG · 5 Mo par fichier"}
          </small>
        </div>
        {!readOnly && (
          <>
            <input
              ref={input}
              type="file"
              aria-label={`Joindre — ${option.label}`}
              accept={option.image ? ".jpg,.jpeg,.png" : ".pdf,.jpg,.jpeg,.png"}
              multiple={!option.image}
              hidden
              disabled={busy}
              onChange={(e) => {
                onFiles(kind, Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <button
              className="sn-btn"
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Upload size={15} /> Joindre
            </button>
          </>
        )}
      </div>
      {!saved.length && !staged.length && (
        <p className="comptoir-document__empty">Aucune pièce jointe</p>
      )}
      {saved.map((d) => (
        <div className="comptoir-document__file" key={d.id}>
          <Check size={15} />
          <button
            type="button"
            disabled={opening === d.id}
            onClick={() => void open(d)}
          >
            {d.file_name}
          </button>
          <small>Enregistré</small>
          {!readOnly && (
            <button
              type="button"
              disabled={busy}
              aria-label={`Retirer ${d.file_name}`}
              onClick={() => onRemove(d)}
            >
              <X size={15} />
            </button>
          )}
        </div>
      ))}
      {staged.map((d) => (
        <div key={d.id}>
          <div className="comptoir-document__file">
            <Upload size={15} />
            <span>{d.file.name}</span>
            <small>{d.error ? "À réessayer" : "À envoyer"}</small>
            <button
              type="button"
              disabled={busy}
              aria-label={`Retirer la sélection ${d.file.name}`}
              onClick={() => onUnstage(d.id)}
            >
              <X size={15} />
            </button>
          </div>
          {d.error && (
            <p className="collector-error" role="alert">
              {d.error}
            </p>
          )}
        </div>
      ))}
      {preview && (
        <div className="comptoir-document__preview" role="status">
          <a href={preview.url} target="_blank" rel="noreferrer">
            Ouvrir {preview.name} dans un nouvel onglet
          </a>
          <button
            type="button"
            aria-label="Fermer le lien du document"
            onClick={() => setPreview(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export function ComptoirDossierForm({
  initial,
  readOnly = false,
  onSaved,
  onCancel,
}: {
  initial?: ComptoirRecord;
  readOnly?: boolean;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ComptoirValues>(
    () => initial?.values ?? emptyComptoir(),
  );
  const [record, setRecord] = useState(initial);
  const [pending, setPending] = useState<PendingComptoirDocument[]>([]);
  const [errors, setErrors] = useState<Partial<Record<ComptoirKey, string>>>(
    {},
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const savedValues = useRef(initial ? JSON.stringify(initial.values) : "");
  const creationId = useRef(initial?.id ?? secureRandomId());
  const request = useRef({ payload: "", id: secureRandomId() });
  const dirty =
    !readOnly &&
    ((record
      ? JSON.stringify(values) !== savedValues.current
      : JSON.stringify(values) !== JSON.stringify(emptyComptoir())) ||
      pending.length > 0);
  useArtisanUnsavedChanges(dirty);
  const docs = record?.documents ?? [];
  const completion = comptoirCompletion(values, [
    ...docs.map((d) => d.kind),
    ...pending.map((d) => d.kind),
  ]);
  const status = authorizationStatus(values),
    days = authorizationDays(values);
  const set = (key: ComptoirKey, value: string) => {
    setValues((old) => ({ ...old, [key]: value }));
    setErrors((old) => ({ ...old, [key]: undefined }));
  };
  const text = (
    key: ComptoirKey,
    type = "text",
    required = false,
    hint?: string,
  ) =>
    readOnly ? (
      <div className="comptoir-value" key={key}>
        <span>{COMPTOIR_FIELD_LABELS[key]}</span>
        <p>
          {values[key]
            ? type === "date"
              ? dateLabel(values[key])
              : values[key]
            : "Non renseigné"}
        </p>
      </div>
    ) : (
      <Field
        key={key}
        label={COMPTOIR_FIELD_LABELS[key]}
        htmlFor={`comptoir-${key}`}
        required={required}
        error={errors[key]}
        hint={hint}
      >
        <input
          id={`comptoir-${key}`}
          value={values[key]}
          onChange={(e) => set(key, e.target.value)}
          type={type}
          inputMode={key === "capital" ? "numeric" : undefined}
          maxLength={key === "name" ? 180 : 250}
          min={type === "date" ? "1900-01-01" : undefined}
          max={type === "date" ? "9999-12-31" : undefined}
          aria-invalid={!!errors[key]}
          autoComplete={
            key === "name"
              ? "organization"
              : key === "phone"
                ? "tel"
                : key === "email"
                  ? "email"
                  : "off"
          }
        />
      </Field>
    );
  const select = (
    key: ComptoirKey,
    options: readonly { value: string; label: string }[],
    required = false,
  ) =>
    readOnly ? (
      <div className="comptoir-value">
        <span>{COMPTOIR_FIELD_LABELS[key]}</span>
        <p>
          {options.find((o) => o.value === values[key])?.label ||
            values[key] ||
            "Non renseigné"}
        </p>
      </div>
    ) : (
      <Field
        label={COMPTOIR_FIELD_LABELS[key]}
        htmlFor={`comptoir-${key}`}
        required={required}
        error={errors[key]}
      >
        <select
          id={`comptoir-${key}`}
          value={values[key]}
          onChange={(e) => set(key, e.target.value)}
          aria-invalid={!!errors[key]}
        >
          <option value="">Sélectionner…</option>
          {values[key] && !options.some((o) => o.value === values[key]) && (
            <option value={values[key]}>
              Ancienne valeur : {values[key]} — à préciser
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
    );
  function files(kind: ComptoirDocumentKind, files: File[]) {
    const image = COMPTOIR_DOCUMENT_KINDS.find((o) => o.value === kind)!.image;
    try {
      if (files.length + docs.length + pending.length > 50)
        throw new Error("Le dossier accepte au maximum 50 pièces.");
      for (const file of files)
        validateUploadFile(
          file,
          image
            ? UPLOAD_POLICIES.artisanPhoto
            : UPLOAD_POLICIES.artisanDocument,
        );
      setPending((old) => [
        ...(image ? old.filter((d) => d.kind !== kind) : old),
        ...files.map((file) => ({ id: secureRandomId(), kind, file })),
      ]);
      setMessage("");
    } catch (error) {
      setMessage(
        messageErreurUtilisateur(error, "Ce fichier ne peut pas être ajouté."),
      );
    }
  }
  async function remove(document: ComptoirDocument) {
    if (!window.confirm(`Retirer « ${document.file_name} » du dossier ?`))
      return;
    setBusy(true);
    setMessage("");
    try {
      await comptoirService.removeDocument(document.id);
      setRecord((old) =>
        old
          ? {
              ...old,
              documents: old.documents.filter((d) => d.id !== document.id),
            }
          : old,
      );
    } catch (error) {
      setMessage(
        messageErreurUtilisateur(error, "La pièce n’a pas pu être retirée."),
      );
    } finally {
      setBusy(false);
    }
  }
  const slot = (kind: ComptoirDocumentKind) => (
    <DocumentSlot
      kind={kind}
      documents={docs}
      pending={pending}
      readOnly={readOnly}
      busy={busy}
      onFiles={files}
      onRemove={(d) => void remove(d)}
      onUnstage={(id) => setPending((old) => old.filter((d) => d.id !== id))}
      onError={setMessage}
    />
  );
  const section = (n: number, description: string, children: ReactNode) => (
    <section
      className="collector-section"
      id={`comptoir-section-${n}`}
      aria-labelledby={`comptoir-heading-${n}`}
    >
      <header>
        <span>{String(n).padStart(2, "0")}</span>
        <div>
          <h2 id={`comptoir-heading-${n}`}>{COMPTOIR_SECTIONS[n - 1]}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="collector-section__body">{children}</div>
    </section>
  );
  const leave = () => {
    if (!dirty || confirmArtisanLeave()) onCancel();
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || readOnly) return;
    const invalid = comptoirErrors(values);
    setErrors(invalid);
    setMessage("");
    if (Object.keys(invalid).length) {
      setMessage("Corrigez les champs signalés avant d’enregistrer.");
      document.getElementById(`comptoir-${Object.keys(invalid)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    let current = record;
    try {
      const payload = JSON.stringify(values);
      if (!current || payload !== savedValues.current) {
        setProgress("Enregistrement du dossier…");
        if (request.current.payload !== payload)
          request.current = { payload, id: secureRandomId() };
        current = await comptoirService.save(
          values,
          creationId.current,
          current,
          request.current.id,
        );
        setRecord(current);
        savedValues.current = payload;
      }
      let failed = false;
      for (const document of pending) {
        setProgress(`Envoi de ${document.file.name}…`);
        try {
          const uploaded = await comptoirService.upload(current.id, document);
          current = {
            ...current,
            documents: [
              uploaded,
              ...current.documents.filter((d) => d.id !== uploaded.id),
            ],
          };
          setRecord(current);
          setPending((old) => old.filter((d) => d.id !== document.id));
        } catch {
          failed = true;
          setPending((old) =>
            old.map((d) =>
              d.id === document.id
                ? {
                    ...d,
                    error: "Envoi incomplet. Réessayez pour cette pièce.",
                  }
                : d,
            ),
          );
        }
      }
      if (failed) {
        setMessage(
          "Le dossier est enregistré. Certaines pièces n’ont pas été envoyées ; elles restent sélectionnées. Cliquez sur Enregistrer pour reprendre leur envoi.",
        );
        return;
      }
      // Relire le serveur confirme les données et les métadonnées effectivement persistées.
      const verified = await comptoirService.get(current.id);
      setRecord(verified);
      onSaved(verified.id);
    } catch (error) {
      setMessage(
        messageErreurUtilisateur(
          error,
          "Impossible de confirmer l’enregistrement. Vos données et vos fichiers restent disponibles pour réessayer.",
        ),
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <form className="collector-form comptoir-form" onSubmit={submit} noValidate>
      <div className="collector-main">
        {message && (
          <div className="comptoir-message">
            <Note tone="danger">{message}</Note>
          </div>
        )}
        {!readOnly && (
          <p className="comptoir-intro">
            <Info size={17} /> Enregistrez le dossier au fur et à mesure. La
            synthèse indique les éléments restant à compléter.
          </p>
        )}
        {initial?.version === 0 && (
          <Note tone="warning">
            Dossier historique : les informations existantes sont conservées.
            Complétez les informations de société et les justificatifs.
          </Note>
        )}
        <fieldset className="collector-fieldset" disabled={busy}>
          {section(
            1,
            "Identité juridique de l’entreprise établie au Burkina Faso.",
            <>
              <div className="collector-grid">
                {text("name", "text", true)}
                {text("short_name")}
              </div>
              <div className="collector-grid">
                {select("legal_form", COMPTOIR_LEGAL_FORMS, true)}
                {text(
                  "capital",
                  "text",
                  false,
                  "Montant entier en francs CFA, si applicable.",
                )}
              </div>
              {slot("logo")}
            </>,
          )}
          {section(
            2,
            "Registre du commerce, identification fiscale et service gestionnaire.",
            <>
              <div className="collector-grid">
                {text("rccm_number")}
                {text("rccm_issued_on", "date")}
              </div>
              {slot("rccm")}
              <div className="collector-grid">
                {text("ifu_number")}
                {text("ifu_issued_on", "date")}
              </div>
              {slot("ifu")}
              {select("tax_regime", COMPTOIR_TAX_REGIMES)}
              {readOnly ? (
                <div className="comptoir-value">
                  <span>{COMPTOIR_FIELD_LABELS.tax_office_code}</span>
                  <p>
                    {COMPTOIR_TAX_OFFICES.find(
                      (o) => o.code === values.tax_office_code,
                    )?.label || "Non renseigné"}
                  </p>
                </div>
              ) : (
                <div>
                  <ComboBox
                    label={COMPTOIR_FIELD_LABELS.tax_office_code}
                    value={values.tax_office_code}
                    onChange={(value) => set("tax_office_code", value)}
                    options={COMPTOIR_TAX_OFFICES.map((o) => ({
                      value: o.code,
                      label: o.label,
                      subtitle: o.group,
                    }))}
                    placeholder="Rechercher une direction, un centre ou une ville…"
                    allowCustom={false}
                  />
                  {errors.tax_office_code && (
                    <p className="collector-error">{errors.tax_office_code}</p>
                  )}
                </div>
              )}
              <p className="collector-help">
                Renseignez le régime et le service portés sur les documents
                fiscaux du comptoir.{" "}
                <a
                  href="https://dgi.bf/contacts/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Annuaire officiel DGI
                </a>{" "}
                · référentiel vérifié le 6 septembre 2026.
              </p>
            </>,
          )}
          {section(
            3,
            "Référence, période de validité et copie de l’autorisation d’achat d’or.",
            <>
              <div className="collector-grid">
                {text("authorization_number")}
                {text("authorization_issuer")}
              </div>
              <div className="collector-grid">
                {text("authorization_issued_on", "date")}
                {text("authorization_expires_on", "date")}
              </div>
              <div className="comptoir-validity">
                <ShieldCheck />
                <div>
                  <strong>Validité de l’autorisation</strong>
                  <p>
                    {days === null
                      ? "Renseignez les dates de délivrance et d’expiration."
                      : `${days.toLocaleString("fr-FR")} jour${days > 1 ? "s" : ""} · dates de début et de fin incluses`}
                  </p>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              {slot("purchase_authorization")}
            </>,
          )}
          {section(
            4,
            "Adresse du siège et coordonnées professionnelles du comptoir.",
            <>
              <div className="collector-grid">
                <div className="comptoir-value">
                  <span>Pays du siège</span>
                  <p>Burkina Faso</p>
                </div>
                {select(
                  "region",
                  BURKINA_REGIONS.map((r) => ({
                    value: r.name,
                    label: r.name,
                  })),
                )}
              </div>
              <div className="collector-grid">
                {text("city", "text", true)}
                {text("district")}
              </div>
              <div className="collector-grid">
                {text("street")}
                {text("postal_address")}
              </div>
              <div className="collector-grid">
                {text("phone", "tel", false, "Ex. +226 70 00 00 00")}
                {text("email", "email")}
              </div>
              {text("website", "url", false, "https://…")}
            </>,
          )}
          {section(
            5,
            "Personne qui représente et dirige le comptoir.",
            <>
              <div className="collector-grid">
                {text("representative_last_name")}
                {text("representative_first_name")}
              </div>
              {text("representative_position")}
              <div className="collector-grid">
                {text(
                  "representative_phone",
                  "tel",
                  false,
                  "Ex. +226 70 00 00 00",
                )}
                {text("representative_email", "email")}
              </div>
              <div className="collector-grid">
                {select("representative_identity_type", identityOptions)}
                {text("representative_identity_number")}
              </div>
              <div className="collector-grid">
                {text("representative_identity_issued_on", "date")}
                {text("representative_identity_expires_on", "date")}
              </div>
              {slot("representative_identity")}
              {slot("representative_photo")}
            </>,
          )}
          {section(
            6,
            "Statuts, autres autorisations et informations utiles au dossier.",
            <>
              {slot("other")}
              {readOnly ? (
                <div className="comptoir-value">
                  <span>Observations</span>
                  <p>{values.notes || "Aucune observation"}</p>
                </div>
              ) : (
                <Field
                  label="Observations"
                  htmlFor="comptoir-notes"
                  error={errors.notes}
                >
                  <textarea
                    id="comptoir-notes"
                    rows={4}
                    value={values.notes}
                    maxLength={4000}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="Précisions utiles à la gestion du comptoir…"
                  />
                </Field>
              )}
            </>,
          )}
        </fieldset>
        {!readOnly && (
          <div className="comptoir-actions">
            <span aria-live="polite">
              {busy ? progress : "* Champs indispensables à l’enregistrement"}
            </span>
            <div>
              <button
                type="button"
                className="sn-btn"
                disabled={busy}
                onClick={leave}
              >
                Annuler
              </button>
              <button
                className="sn-btn sn-btn--primary"
                type="submit"
                disabled={busy}
              >
                {busy ? <Loader2 className="sn-spin" /> : <Save />}
                {busy ? "Enregistrement…" : "Enregistrer le dossier"}
              </button>
            </div>
          </div>
        )}
      </div>
      <aside className="comptoir-aside" aria-label="Synthèse du comptoir">
        <section className="collector-summary">
          <h2>
            <FileText size={18} />{" "}
            {readOnly ? "Complétude du dossier" : "Complétion du dossier"}
          </h2>
          <div
            className="collector-donut"
            role="img"
            aria-label={`Dossier complété à ${completion.percent} %`}
          >
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="49" />
              <circle
                cx="60"
                cy="60"
                r="49"
                strokeDasharray={`${completion.percent * 3.079} 307.9`}
              />
            </svg>
            <div>
              <strong>{completion.percent} %</strong>
              <small>
                {completion.filled} éléments sur {completion.total}
              </small>
            </div>
          </div>
          <p className="comptoir-completion-note">
            {completion.percent === 100
              ? "Informations et pièces renseignées."
              : `${completion.total - completion.filled} éléments à compléter`}
            {pending.length > 0 ? " · fichiers en attente d’envoi" : ""}
          </p>
          <details className="comptoir-missing">
            <summary>Voir les éléments manquants</summary>
            <ul>
              {completion.items
                .filter((i) => !i.filled)
                .map((i) => (
                  <li key={i.key}>{i.label}</li>
                ))}
            </ul>
            {completion.percent === 100 && <p>Aucun élément manquant.</p>}
          </details>
          <nav aria-label="Sections du dossier">
            {COMPTOIR_SECTIONS.map((name, i) => (
              <a key={name} href={`#comptoir-section-${i + 1}`}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {name}
              </a>
            ))}
          </nav>
        </section>
        <section className="collector-summary comptoir-recap">
          <h2>
            <Building2 size={18} /> Fiche du comptoir
          </h2>
          <strong>{values.name || "Nouveau comptoir"}</strong>
          <dl>
            <div>
              <dt>Type</dt>
              <dd>{values.legal_form || "À préciser"}</dd>
            </div>
            <div>
              <dt>Siège</dt>
              <dd>{values.city || "À préciser"}</dd>
            </div>
            <div>
              <dt>Régime</dt>
              <dd>{values.tax_regime || "À préciser"}</dd>
            </div>
            <div>
              <dt>Pièces enregistrées</dt>
              <dd>{docs.length}</dd>
            </div>
          </dl>
          <Badge tone={completion.percent === 100 ? "success" : "warning"}>
            {completion.percent === 100
              ? "Dossier renseigné"
              : "Dossier à compléter"}
          </Badge>
        </section>
        <p className="comptoir-private">
          <ShieldCheck size={18} /> Les justificatifs et les documents
          d’identité sont conservés dans le dossier privé du comptoir.
        </p>
      </aside>
    </form>
  );
}

export default function ComptoirForm({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [record, setRecord] = useState<ComptoirRecord>();
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const requestKey = `${id ?? "new"}:${readOnly}:${reload}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // Une réponse immédiate peut regrouper loading=true/false dans le même rendu.
  // La clé interdit de monter le formulaire avec le dossier du mode précédent.
  const awaitingRecord = loading || loadedKey !== requestKey;
  useEffect(() => {
    let live = true;
    setError("");
    setLoading(!!id);
    if (id)
      void comptoirService
        .get(id)
        .then((row) => {
          if (live) setRecord(row);
        })
        .catch((reason) => {
          if (live)
            setError(
              messageErreurUtilisateur(
                reason,
                "Impossible de charger le comptoir.",
              ),
            );
        })
        .finally(() => {
          if (live) {
            setLoadedKey(requestKey);
            setLoading(false);
          }
        });
    else {
      setRecord(undefined);
      setLoadedKey(requestKey);
    }
    return () => {
      live = false;
    };
  }, [id, requestKey]);
  useEffect(() => {
    if (!awaitingRecord)
      document
        .querySelector("main.comptoir-page")
        ?.scrollIntoView({ block: "start" });
  }, [awaitingRecord, id, readOnly]);
  if (!canManageMiningRegistry(user))
    return (
      <NationalDashboardLayout>
        <main className="sn-page">
          <Note tone="danger">
            La gestion des comptoirs est réservée à la DGMG et à
            l’administrateur.
          </Note>
        </main>
      </NationalDashboardLayout>
    );
  const title = readOnly
    ? record?.name || "Dossier du comptoir"
    : id
      ? "Modifier le comptoir"
      : "Nouveau comptoir";
  return (
    <NationalDashboardLayout>
      <main className="sn-page collector-page comptoir-page">
        <PageHeader
          icon={Building2}
          title={title}
          subtitle={
            readOnly
              ? "Identité de la société, autorisation d’achat et pièces du dossier."
              : "Renseignez la société, sa fiscalité, son autorisation et son premier responsable."
          }
          breadcrumb={[
            { label: "Artisans miniers" },
            { label: "Comptoirs", to: ROOT },
            {
              label: readOnly
                ? "Dossier"
                : id
                  ? "Modification"
                  : "Nouveau comptoir",
            },
          ]}
          actions={
            <>
              <Link className="sn-btn" to={ROOT}>
                <ArrowLeft /> Retour à la liste
              </Link>
              {readOnly && id && (
                <Link
                  className="sn-btn sn-btn--primary"
                  to={`${ROOT}/${id}/modifier`}
                >
                  <Pencil /> Modifier le dossier
                </Link>
              )}
            </>
          }
        />
        {awaitingRecord ? (
          <p className="comptoir-loading">
            <Loader2 className="sn-spin" /> Chargement du dossier…
          </p>
        ) : error ? (
          <div>
            <Note tone="danger">{error}</Note>
            <button className="sn-btn" onClick={() => setReload((v) => v + 1)}>
              Réessayer
            </button>
          </div>
        ) : (
          <ComptoirDossierForm
            key={`${id ?? "new"}-${reload}-${readOnly}`}
            initial={record}
            readOnly={readOnly}
            onSaved={(savedId) =>
              navigate(`${ROOT}/${savedId}`, { replace: true })
            }
            onCancel={() => navigate(ROOT)}
          />
        )}
      </main>
    </NationalDashboardLayout>
  );
}
