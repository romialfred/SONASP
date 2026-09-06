import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Check,
  FileText,
  MapPin,
  Plus,
  Save,
  UserRound,
  X,
  Building2,
  Info,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { NationalDashboardLayout } from "@/components/layout/NationalDashboardLayout";
import { Badge, Field, Note, PageHeader } from "@/components/ui/sn";
import { ComboBox } from "@/components/ui/ComboBox";
import { PhoneInput } from "@/components/ui/PhoneInput";
import {
  SAHEL_COUNTRIES,
  getRegionsByCountry,
  getCitiesByRegion,
} from "@/data/burkinaFasoData";
import { useAuth } from "@/contexts/AuthContext";
import { canManageMiningRegistry } from "@/lib/miningRegistryAccess";
import {
  collectorErrors,
  collectorRequirements,
  COLLECTOR_SECTIONS,
  emptyCollector,
  type CollectorFormValues,
} from "@/lib/collectorDossier";
import {
  collectorService,
  type CollectionReference,
  type CollectorRecord,
} from "@/services/collectorService";
import {
  artisanDocumentService,
  type ArtisanDocument,
  type PendingArtisanDocument,
} from "@/services/artisanDocumentService";
import { validateUploadFile, UPLOAD_POLICIES } from "@/lib/uploadValidation";
import { secureRandomId } from "@/lib/secureRandom";
import {
  useArtisanUnsavedChanges,
  confirmArtisanLeave,
} from "@/hooks/useArtisanUnsavedChanges";
import "./collector.css";

export function CollectorDossierForm({
  initial,
  references,
  onSaved,
  onCancel,
}: {
  initial?: CollectorRecord;
  references: CollectionReference;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<CollectorFormValues>(() => {
    const v = emptyCollector();
    if (initial) {
      for (const key of Object.keys(v) as Array<keyof CollectorFormValues>) {
        const value = initial.identity[key as keyof typeof initial.identity];
        if (value != null) Object.assign(v, { [key]: value });
      }
      v.organization_id = initial.organization_id;
      v.site_ids = initial.site_ids;
    }
    return v;
  });
  const [record, setRecord] = useState(initial);
  const creationId = useRef(initial?.id || secureRandomId());
  const savedValues = useRef(JSON.stringify(values));
  const [saved, setSaved] = useState<ArtisanDocument[]>([]);
  const [pending, setPending] = useState<PendingArtisanDocument[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [site, setSite] = useState("");
  const [portrait, setPortrait] = useState("");
  const dirty =
    JSON.stringify(values) !== savedValues.current ||
    pending.some((p) => p.status !== "saved");
  useArtisanUnsavedChanges(dirty);
  useEffect(() => {
    let live = true;
    if (initial)
      artisanDocumentService
        .list(initial.id)
        .then((rows) => {
          if (live) setSaved(rows);
        })
        .catch(() => {
          if (live)
            setMessage(
              "Les pièces existantes ne sont pas disponibles. Rechargez avant de modifier les documents.",
            );
        });
    return () => {
      live = false;
    };
  }, [initial]);
  useEffect(() => {
    const photo = pending.find((p) => p.type === "photo");
    if (photo) {
      const url = URL.createObjectURL(photo.file);
      setPortrait(url);
      return () => URL.revokeObjectURL(url);
    }
    let live = true;
    const doc = saved.find((p) => p.type_document === "photo");
    if (doc)
      artisanDocumentService
        .url(doc)
        .then((url) => {
          if (live) setPortrait(url);
        })
        .catch(() => {
          if (live) setPortrait("");
        });
    return () => {
      live = false;
    };
  }, [pending, saved]);
  const set = (key: keyof CollectorFormValues, value: unknown) =>
    setValues((old) => ({ ...old, [key]: value }));
  const req = collectorRequirements(values),
    filled = req.filter((r) => r.filled).length,
    percent = Math.round((filled / req.length) * 100);
  const organization = references.organizations.find(
    (o) => o.id === values.organization_id,
  );
  function section(n: number, description: string, children: ReactNode) {
    return (
      <section
        id={`collector-section-${n}`}
        className="collector-section"
        aria-labelledby={`collector-heading-${n}`}
      >
        <header>
          <span>{String(n).padStart(2, "0")}</span>
          <div>
            <h2 id={`collector-heading-${n}`}>{COLLECTOR_SECTIONS[n - 1]}</h2>
            <p>{description}</p>
          </div>
        </header>
        <div className="collector-section__body">{children}</div>
      </section>
    );
  }
  const text = (
    key: keyof CollectorFormValues,
    label: string,
    type = "text",
    required = false,
    placeholder?: string,
  ) => (
    <Field
      label={label}
      htmlFor={`collector-${key}`}
      required={required}
      error={errors[key]}
    >
      <input
        id={`collector-${key}`}
        value={String(values[key] || "")}
        onChange={(e) => set(key, e.target.value)}
        type={type}
        required={required}
        aria-invalid={!!errors[key]}
        placeholder={placeholder}
        maxLength={type === "text" ? 180 : undefined}
      />
    </Field>
  );
  function addFiles(files: FileList | null, photo: boolean) {
    if (!files) return;
    try {
      const selected = Array.from(files);
      if (photo && selected.length !== 1)
        throw new Error("Choisissez une seule photo.");
      const additions = selected.map((file) => {
        validateUploadFile(
          file,
          photo
            ? UPLOAD_POLICIES.artisanPhoto
            : UPLOAD_POLICIES.artisanDocument,
        );
        return {
          id: secureRandomId(),
          owner: "artisan" as const,
          type: photo ? "photo" : values.type_piece_identite.toLowerCase(),
          title: photo ? "Photo du collecteur" : "Pièce du collecteur",
          file,
          status: "pending" as const,
        };
      });
      setPending((old) => [
        ...(photo ? old.filter((p) => p.type !== "photo") : old),
        ...additions,
      ]);
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Fichier non accepté.");
    }
  }
  const files = (photo: boolean) => (
    <>
      <label className="collector-upload">
        <span className="collector-upload__icon">
          {photo ? (
            portrait ? (
              <img src={portrait} alt="Photo sélectionnée" />
            ) : (
              <UserRound />
            )
          ) : (
            <FileText />
          )}
        </span>
        <span>
          <strong>
            {photo ? "Ajouter une photo" : "Joindre les pièces justificatives"}
          </strong>
          <small>
            {photo
              ? "JPG ou PNG · 2 Mo maximum"
              : "JPG, PNG ou PDF · 5 Mo par fichier"}
          </small>
        </span>
        <span className="sn-btn sn-btn--secondary">Parcourir</span>
        <input
          aria-label={photo ? "Photo du collecteur" : "Pièces du collecteur"}
          type="file"
          accept={
            photo
              ? "image/jpeg,image/png"
              : "image/jpeg,image/png,application/pdf"
          }
          multiple={!photo}
          disabled={busy}
          onChange={(e) => {
            addFiles(e.target.files, photo);
            e.target.value = "";
          }}
        />
      </label>
      {pending
        .filter((p) => (p.type === "photo") === photo)
        .map((p) => (
          <div className="collector-file" key={p.id}>
            <span>
              {p.file.name}{" "}
              {p.status === "failed" && "— Échec, réessayez avec Enregistrer"}
            </span>
            <button
              type="button"
              className="sn-btn sn-btn--ghost"
              disabled={busy || p.status === "saved"}
              aria-label={`Retirer ${p.file.name}`}
              onClick={() =>
                setPending((old) => old.filter((d) => d.id !== p.id))
              }
            >
              <X size={16} />
            </button>
          </div>
        ))}
      {saved
        .filter((p) => (p.type_document === "photo") === photo)
        .map((p) => (
          <button
            type="button"
            className="collector-file collector-file--saved"
            key={p.id}
            onClick={async () => {
              try {
                const url = await artisanDocumentService.url(p);
                window.open(url, "_blank", "noopener,noreferrer");
              } catch {
                setMessage("La pièce ne peut pas être ouverte. Réessayez.");
              }
            }}
          >
            <FileText size={16} />
            {p.nom_fichier}
            <Check size={16} />
          </button>
        ))}
    </>
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const validation = collectorErrors(values);
    setErrors(validation);
    if (Object.keys(validation).length) {
      setMessage("Complétez les champs signalés avant d’enregistrer.");
      const first = req.find((r) => validation[r.key]);
      document
        .getElementById(`collector-section-${first?.section || 1}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result =
        record && savedValues.current === JSON.stringify(values)
          ? record
          : await collectorService.save(
              values,
              creationId.current,
              record?.version ?? null,
              record?.is_legacy ? record.identity.updated_at : undefined,
            );
      setRecord(result);
      savedValues.current = JSON.stringify(values);
      const queue = [...pending];
      let failed = false;
      for (const p of queue.filter((d) => d.status !== "saved")) {
        try {
          const doc = await artisanDocumentService.upload(result.id, p);
          setSaved((old) => [...old.filter((d) => d.id !== doc.id), doc]);
          p.status = "saved";
        } catch {
          p.status = "failed";
          failed = true;
        }
        setPending([...queue]);
      }
      if (failed) {
        setMessage(
          "Le dossier est enregistré. Certaines pièces ont échoué : cliquez sur Enregistrer pour reprendre leur envoi sans recréer le collecteur.",
        );
        return;
      }
      onSaved(result.id);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "L’enregistrement a échoué. Vos saisies sont conservées.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="collector-form"
      onSubmit={submit}
      noValidate
      aria-label="Dossier du collecteur"
      aria-busy={busy}
    >
      <div className="collector-main">
        <div className="collector-mobile-completion">
          <span>Complétion du dossier</span>
          <strong>{percent} %</strong>
          <small>
            {filled} champs requis renseignés sur {req.length}
          </small>
        </div>
        {message && (
          <div role="alert">
            <Note tone="warning">{message}</Note>
          </div>
        )}
        <fieldset disabled={busy} className="collector-fieldset">
          {section(
            1,
            "Informations personnelles du titulaire. Le collecteur est une personne physique.",
            <>
              <div className="collector-grid">
                {text("nom", "Nom", "text", true, "Nom de famille")}
                {text("prenoms", "Prénom(s)", "text", false, "Prénom(s)")}
              </div>
              <div className="collector-grid collector-grid--four">
                {text("date_naissance", "Date de naissance", "date", true)}
                {text(
                  "lieu_naissance",
                  "Lieu de naissance",
                  "text",
                  false,
                  "Ville, pays",
                )}
                <Field label="Sexe" htmlFor="collector-sexe">
                  <select
                    id="collector-sexe"
                    value={values.sexe}
                    onChange={(e) => set("sexe", e.target.value)}
                  >
                    <option value="">Sélectionner</option>
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </Field>
                {text("nationalite", "Nationalité")}
              </div>
            </>,
          )}
          {section(
            2,
            "Contacts et adresse du collecteur.",
            <>
              <div className="collector-grid">
                <Field
                  label="Téléphone"
                  htmlFor="collector-telephone"
                  required
                  error={errors.telephone}
                >
                  <PhoneInput
                    className="collector-phone"
                    id="collector-telephone"
                    value={values.telephone}
                    onChange={(v) => set("telephone", v)}
                  />
                </Field>
                <div>
                  <Field
                    label="Téléphone WhatsApp"
                    htmlFor="collector-whatsapp"
                  >
                    <PhoneInput
                      className="collector-phone"
                      id="collector-whatsapp"
                      ariaLabel="Téléphone WhatsApp"
                      value={
                        values.whatsapp_identique
                          ? values.telephone
                          : values.whatsapp
                      }
                      onChange={(v) => set("whatsapp", v)}
                      disabled={values.whatsapp_identique}
                    />
                  </Field>
                  <label className="collector-checkbox">
                    <input
                      type="checkbox"
                      checked={values.whatsapp_identique}
                      onChange={(e) =>
                        set("whatsapp_identique", e.target.checked)
                      }
                    />
                    Identique au téléphone
                  </label>
                </div>
                {text(
                  "email",
                  "Adresse e-mail",
                  "email",
                  false,
                  "nom@exemple.bf",
                )}
                <Field label="Pays" htmlFor="collector-pays" required>
                  <select
                    id="collector-pays"
                    value={values.pays}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        pays: e.target.value,
                        region: "",
                        commune: "",
                      }))
                    }
                  >
                    {SAHEL_COUNTRIES.map((c) => (
                      <option key={c.name}>{c.name}</option>
                    ))}
                  </select>
                </Field>
                <div>
                  <ComboBox
                    label="Région"
                    required
                    value={values.region}
                    onChange={(region) =>
                      setValues((v) => ({ ...v, region, commune: "" }))
                    }
                    options={getRegionsByCountry(values.pays).map((value) => ({
                      value: value.name,
                      label: value.name,
                    }))}
                  />
                  {errors.region && (
                    <small className="collector-error">{errors.region}</small>
                  )}
                </div>
                <div>
                  <ComboBox
                    label="Commune"
                    required
                    disabled={!values.region}
                    value={values.commune}
                    onChange={(v) => set("commune", v)}
                    options={getCitiesByRegion(values.pays, values.region).map(
                      (value) => ({ value, label: value }),
                    )}
                    placeholder="Choisir d’abord la région"
                  />
                  {errors.commune && (
                    <small className="collector-error">{errors.commune}</small>
                  )}
                </div>
              </div>
              {text(
                "adresse",
                "Adresse complète",
                "text",
                false,
                "Quartier, secteur, repère…",
              )}
            </>,
          )}
          {section(
            3,
            "Sélectionnez au moins un site existant. Plusieurs rattachements sont possibles.",
            <>
              <div className="collector-selection">
                <ComboBox
                  label="Sites de rattachement"
                  value={site}
                  onChange={setSite}
                  allowCustom={false}
                  options={references.sites
                    .filter((s) => !values.site_ids.includes(s.id))
                    .map((s) => ({
                      value: s.id,
                      label: `${s.name} · ${s.locality}`,
                    }))}
                  placeholder="Rechercher un site par nom ou localité…"
                />
                <button
                  className="sn-btn sn-btn--secondary"
                  type="button"
                  disabled={!site}
                  onClick={() => {
                    set("site_ids", [...new Set([...values.site_ids, site])]);
                    setSite("");
                  }}
                >
                  <Plus size={17} />
                  Ajouter
                </button>
              </div>
              {errors.site_ids && (
                <p className="collector-error">{errors.site_ids}</p>
              )}
              <div className="collector-sites">
                <div className="collector-sites__head">
                  <span>Site</span>
                  <span>Localité</span>
                  <span />
                </div>
                {values.site_ids.map((id) => {
                  const s = references.sites.find((x) => x.id === id);
                  return (
                    <div key={id}>
                      <strong>
                        <MapPin size={17} />
                        {s?.name || "Site précédemment rattaché"}
                      </strong>
                      <span>{s?.locality || "—"}</span>
                      <button
                        type="button"
                        aria-label={`Retirer le site ${s?.name || id}`}
                        onClick={() =>
                          set(
                            "site_ids",
                            values.site_ids.filter((x) => x !== id),
                          )
                        }
                      >
                        <X size={17} />
                      </button>
                    </div>
                  );
                })}
                {!values.site_ids.length && <p>Aucun site sélectionné.</p>}
              </div>
              <small className="collector-help">
                {values.site_ids.length} site(s) sélectionné(s). Les changements
                de rattachement sont historisés.
              </small>
            </>,
          )}
          {section(
            4,
            "Choisissez le comptoir ou la SONASP responsable de l’approbation des ventes.",
            <>
              <ComboBox
                label="Organisme principal"
                required
                value={values.organization_id}
                onChange={(v) => set("organization_id", v)}
                options={references.organizations.map((o) => ({
                  value: o.id,
                  label: `${o.name} · ${o.organization_type === "sonasp" ? "SONASP" : "Comptoir"}`,
                }))}
                allowCustom={false}
                placeholder="Rechercher un comptoir ou la SONASP…"
              />
              {errors.organization_id && (
                <p className="collector-error">{errors.organization_id}</p>
              )}
              {organization && (
                <div className="collector-employer">
                  <Building2 />
                  <span>
                    <strong>{organization.name}</strong>
                    <small>Organisme de rattachement et d’approbation</small>
                  </span>
                  <Check size={18} />
                </div>
              )}
              <p className="collector-help">
                Le paiement par le collecteur nécessite une autorisation
                distincte de cet organisme.
              </p>
            </>,
          )}
          {section(
            5,
            "Références et copie du document d’identité.",
            <>
              <div className="collector-grid">
                <Field
                  label="Type de pièce"
                  htmlFor="collector-type_piece_identite"
                  required
                >
                  <select
                    id="collector-type_piece_identite"
                    value={values.type_piece_identite}
                    onChange={(e) => set("type_piece_identite", e.target.value)}
                  >
                    <option value="CNI">
                      Carte nationale d’identité (CNIB)
                    </option>
                    <option value="Passeport">Passeport</option>
                    <option value="Permis">Permis de conduire</option>
                    <option value="Autre">Autre</option>
                  </select>
                </Field>
                {text(
                  "numero_piece_identite",
                  "Numéro de pièce",
                  "text",
                  true,
                  "Numéro du document",
                )}
              </div>
              <div className="collector-grid collector-grid--three">
                {text("date_delivrance_piece", "Date de délivrance", "date")}
                {text("date_expiration_piece", "Date d’expiration", "date")}
                {text(
                  "lieu_delivrance_piece",
                  "Lieu de délivrance",
                  "text",
                  false,
                  "Ville de délivrance",
                )}
              </div>
              {files(false)}
            </>,
          )}
          {section(
            6,
            "Photo d’identité et informations utiles au suivi.",
            <div className="collector-grid">
              <div>
                <p className="sn-field__label">Photo d’identité</p>
                {files(true)}
              </div>
              <Field label="Observations" htmlFor="collector-observations">
                <textarea
                  id="collector-observations"
                  rows={4}
                  maxLength={2000}
                  value={values.observations}
                  onChange={(e) => set("observations", e.target.value)}
                  placeholder="Informations utiles au suivi du dossier…"
                />
              </Field>
            </div>,
          )}
        </fieldset>
      </div>
      <aside className="collector-aside">
        <section className="collector-summary">
          <h2>
            <FileText size={18} />
            Complétion du dossier
          </h2>
          <div
            className="collector-donut"
            role="progressbar"
            aria-label="Complétion du dossier"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="51" />
              <circle
                cx="60"
                cy="60"
                r="51"
                pathLength="100"
                strokeDasharray={`${percent} 100`}
              />
            </svg>
            <div>
              <strong>{percent} %</strong>
              <small>
                {filled} champs requis sur {req.length}
              </small>
            </div>
          </div>
          <p className="collector-help">
            {req.length - filled} champ(s) à compléter
          </p>
          <nav aria-label="Sections du formulaire">
            <h3>Sections du formulaire</h3>
            {COLLECTOR_SECTIONS.map((s, i) => (
              <a href={`#collector-section-${i + 1}`} key={s}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {s}
                {req.some((r) => r.section === i + 1) &&
                  req
                    .filter((r) => r.section === i + 1)
                    .every((r) => r.filled) && <Check size={14} />}
              </a>
            ))}
          </nav>
        </section>
        <section className="collector-summary">
          <h2>
            <FileText size={18} />
            Récapitulatif
          </h2>
          <div className="collector-avatar">
            {portrait ? (
              <img src={portrait} alt="Portrait du collecteur" />
            ) : (
              <UserRound size={48} />
            )}
          </div>
          <h3 className="collector-name">
            {[values.prenoms, values.nom].filter(Boolean).join(" ") ||
              "Nouveau collecteur"}
          </h3>
          <dl>
            <div>
              <dt>Rôle</dt>
              <dd>Collecteur</dd>
            </div>
            <div>
              <dt>Qualité</dt>
              <dd>Personne physique</dd>
            </div>
            <div>
              <dt>Sites associés</dt>
              <dd>{values.site_ids.length}</dd>
            </div>
            <div>
              <dt>Organisme</dt>
              <dd>{organization?.name || "À renseigner"}</dd>
            </div>
          </dl>
          <Badge tone={percent === 100 ? "success" : "warning"}>
            {percent === 100
              ? "Champs requis renseignés"
              : "Dossier à compléter"}
          </Badge>
        </section>
        <p className="collector-aside__note">
          <Info size={20} />
          Les sites et l’organisme restent modifiables depuis la fiche du
          collecteur.
        </p>
      </aside>
      <footer className="collector-actions">
        <small>* Champs obligatoires</small>
        <div>
          <button
            className="sn-btn sn-btn--secondary"
            type="button"
            disabled={busy}
            onClick={() => {
              if (!dirty || confirmArtisanLeave()) onCancel();
            }}
          >
            Annuler
          </button>
          <button
            className="sn-btn sn-btn--primary"
            type="submit"
            disabled={busy}
          >
            <Save size={18} />
            {busy ? "Enregistrement…" : "Enregistrer le collecteur"}
          </button>
        </div>
      </footer>
    </form>
  );
}

export default function CollectorFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [references, setReferences] = useState<CollectionReference>();
  const [initial, setInitial] = useState<CollectorRecord>();
  const [error, setError] = useState("");
  const allowed = canManageMiningRegistry(user);
  useEffect(() => {
    if (!allowed) return;
    setReferences(undefined);
    setInitial(undefined);
    setError("");
    let live = true;
    Promise.all([
      collectorService.references(),
      id ? collectorService.list() : Promise.resolve([]),
    ])
      .then(([refs, rows]) => {
        if (!live) return;
        const found = rows.find((r) => r.id === id);
        if (id && !found)
          throw new Error("Collecteur introuvable dans votre périmètre.");
        if (found && found.identity.type_personne !== "physique")
          throw new Error(
            "Ce dossier historique est une personne morale. Créez le dossier de la personne physique qui exercera comme collecteur ; l’historique reste conservé.",
          );
        setInitial(found);
        setReferences(refs);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id, allowed]);
  return (
    <NationalDashboardLayout>
      <main className="sn-page collector-page">
        <PageHeader
          icon={UserRound}
          title={id ? "Modifier le collecteur" : "Nouveau collecteur"}
          subtitle="Renseignez son identité et ses sites et organisme de rattachement."
          breadcrumb={[
            { label: "Artisans miniers", to: "/artisan-minier" },
            { label: "Collecteurs", to: "/artisan-minier/collecteurs" },
            { label: id ? "Modification" : "Nouveau collecteur" },
          ]}
          actions={
            <Link
              className="sn-btn sn-btn--secondary"
              to="/artisan-minier/collecteurs"
            >
              <ArrowLeft size={16} />
              Retour à la liste
            </Link>
          }
        />
        {!allowed ? (
          <Note tone="warning">
            La gestion du dossier est réservée à la DGMG et à l’administration.
          </Note>
        ) : error ? (
          <Note tone="danger">{error}</Note>
        ) : references ? (
          <CollectorDossierForm
            key={id || "new"}
            references={references}
            initial={initial}
            onCancel={() => navigate("/artisan-minier/collecteurs")}
            onSaved={(target) =>
              navigate(`/artisan-minier/collecteurs/${target}`, {
                state: { saved: true },
              })
            }
          />
        ) : (
          <p role="status">Chargement du dossier…</p>
        )}
      </main>
    </NationalDashboardLayout>
  );
}
