import type { ReactNode } from "react";
import { Building2, Pickaxe, Truck, Users, UserRound } from "lucide-react";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { ComboBox } from "@/components/ui/ComboBox";
import {
  SAHEL_COUNTRIES,
  getRegionsByCountry,
  getCitiesByRegion,
} from "@/data/burkinaFasoData";
import {
  ARTISAN_ROLE_LABELS,
  EDITABLE_ARTISAN_ROLES,
  type ArtisanFormValues,
} from "@/lib/artisanDossier";
import type {
  TypePersonne,
  TypeArtisan,
} from "@/services/artisanMinierService";
import { artisanFullName } from "@/utils/artisanIdentity";
import type { ExploitantOption } from "@/services/artisanDossierService";

export function DossierSection({
  id,
  number,
  title,
  description,
  children,
}: {
  id: string;
  number: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="artisan-dossier__section"
      aria-labelledby={`${id}-title`}
    >
      <header>
        <span className="artisan-dossier__number">
          {String(number).padStart(2, "0")}
        </span>
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="artisan-dossier__body">{children}</div>
    </section>
  );
}
export function DossierField({
  name,
  label,
  required,
  error,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="sn-field">
      <label htmlFor={name} className="sn-field__label">
        {label}
        {required && <i aria-hidden="true"> *</i>}
      </label>
      {children}
      {error && (
        <small id={`${name}-error`} className="is-error">
          {error}
        </small>
      )}
    </div>
  );
}
type Props = {
  values: ArtisanFormValues;
  setValues: (v: ArtisanFormValues) => void;
  errors: Record<string, string>;
  isEditMode: boolean;
  onTypeChange: (type: TypePersonne) => void;
  sites: Array<{ id: string; code: string; name: string; region?: string }>;
  sitesError: string;
  parent: ExploitantOption | null;
  onParent: (parent: ExploitantOption | null) => void;
  query: string;
  setQuery: (q: string) => void;
  results: ExploitantOption[];
  searching: boolean;
  searchError: string;
  documents: (owner: "artisan" | "societe" | "responsable") => ReactNode;
};
export function ArtisanDossierFields(p: Props) {
  const v = p.values;
  const company = v.type_personne === "morale";
  const set = (key: keyof ArtisanFormValues, value: unknown) =>
    p.setValues({ ...v, [key]: value });
  const get = (key: string): string =>
    String(
      key.startsWith("responsable.")
        ? (v.responsable[key.slice(12) as keyof typeof v.responsable] ?? "")
        : (v[key as keyof ArtisanFormValues] ?? ""),
    );
  const write = (key: string, value: string | boolean) =>
    key.startsWith("responsable.")
      ? set("responsable", { ...v.responsable, [key.slice(12)]: value })
      : set(key as keyof ArtisanFormValues, value);
  const text = (
    key: string,
    label: string,
    required = false,
    type = "text",
  ) => (
    <DossierField
      key={key}
      name={key}
      label={label}
      required={required}
      error={p.errors[key]}
    >
      <input
        id={key}
        type={type}
        value={get(key)}
        required={required}
        aria-invalid={!!p.errors[key]}
        aria-describedby={p.errors[key] ? `${key}-error` : undefined}
        max={
          type === "date" && !key.includes("expiration")
            ? new Date().toISOString().slice(0, 10)
            : undefined
        }
        onChange={(e) => write(key, e.target.value)}
      />
    </DossierField>
  );
  const select = (
    key: string,
    label: string,
    options: Array<[string, string]>,
    required = false,
    disabled = false,
  ) => (
    <DossierField
      key={key}
      name={key}
      label={label}
      required={required}
      error={p.errors[key]}
    >
      <select
        id={key}
        value={get(key)}
        required={required}
        disabled={disabled}
        aria-invalid={!!p.errors[key]}
        onChange={(e) => write(key, e.target.value)}
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </DossierField>
  );
  const phone = (prefix: string, label: string) => (
    <DossierField
      name={`${prefix}telephone`}
      label={label}
      required
      error={p.errors[`${prefix}telephone`]}
    >
      <PhoneInput
        id={`${prefix}telephone`}
        ariaLabel={label}
        value={get(`${prefix}telephone`)}
        onChange={(value) => write(`${prefix}telephone`, value)}
        defaultCountry={company ? v.siege_pays : v.pays}
      />
    </DossierField>
  );
  const whatsapp = (prefix: string) => {
    const checked = prefix
      ? v.responsable.whatsapp_identique
      : v.whatsapp_identique;
    return (
      <DossierField
        name={`${prefix}whatsapp`}
        label="Téléphone WhatsApp"
        error={p.errors[`${prefix}whatsapp`]}
      >
        <PhoneInput
          id={`${prefix}whatsapp`}
          ariaLabel={prefix ? "WhatsApp du responsable" : "WhatsApp"}
          value={checked ? get(`${prefix}telephone`) : get(`${prefix}whatsapp`)}
          disabled={checked}
          onChange={(value) => write(`${prefix}whatsapp`, value)}
          defaultCountry={company ? v.siege_pays : v.pays}
        />
        <label className="artisan-dossier__check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) =>
              write(`${prefix}whatsapp_identique`, e.target.checked)
            }
          />{" "}
          Identique au téléphone
        </label>
      </DossierField>
    );
  };
  const territory = (prefix: "" | "siege_") => {
    const country = get(`${prefix}pays`),
      region = get(`${prefix}region`),
      commune = get(`${prefix}commune`);
    const regions = getRegionsByCountry(country).map((r) => r.name);
    const communes = getCitiesByRegion(country, region);
    return (
      <div className="artisan-dossier__grid is-three">
        <DossierField
          name={`${prefix}pays`}
          label={prefix ? "Pays du siège" : "Pays"}
          required
          error={p.errors[`${prefix}pays`]}
        >
          <select
            id={`${prefix}pays`}
            value={country}
            onChange={(e) =>
              p.setValues({
                ...v,
                [`${prefix}pays`]: e.target.value,
                [`${prefix}region`]: "",
                [`${prefix}commune`]: "",
              })
            }
          >
            {SAHEL_COUNTRIES.map((c) => (
              <option key={c.code} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </DossierField>
        <DossierField
          name={`${prefix}region`}
          label={prefix ? "Région du siège" : "Région"}
          required
          error={p.errors[`${prefix}region`]}
        >
          <select
            id={`${prefix}region`}
            value={region}
            onChange={(e) =>
              p.setValues({
                ...v,
                [`${prefix}region`]: e.target.value,
                [`${prefix}commune`]: "",
              })
            }
          >
            <option value="">Sélectionner une région</option>
            {region && !regions.includes(region) && <option>{region}</option>}
            {regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </DossierField>
        {select(
          `${prefix}commune`,
          prefix ? "Commune du siège" : "Commune",
          [
            [
              "",
              region
                ? "Sélectionner une commune"
                : "Choisir d’abord une région",
            ],
            ...(commune && !communes.includes(commune)
              ? [[commune, commune] as [string, string]]
              : []),
            ...communes.map((c) => [c, c] as [string, string]),
          ],
          true,
          !region,
        )}
      </div>
    );
  };
  const identity = (prefix: string) => (
    <>
      <div className="artisan-dossier__grid">
        {select(
          `${prefix}type_piece_identite`,
          "Type de pièce",
          [
            ["CNI", "CNIB / Carte nationale d’identité"],
            ["Passeport", "Passeport"],
            ["Permis", "Permis de conduire"],
            ["Autre", "Autre"],
          ],
          true,
        )}
        {text(`${prefix}numero_piece_identite`, "Numéro de pièce", true)}
      </div>
      <div className="artisan-dossier__grid is-three">
        {text(
          `${prefix}date_delivrance_piece`,
          "Date de délivrance",
          false,
          "date",
        )}
        {text(
          `${prefix}date_expiration_piece`,
          "Date d’expiration",
          false,
          "date",
        )}
        {text(`${prefix}lieu_delivrance_piece`, "Lieu de délivrance")}
      </div>
    </>
  );
  const roleIcons = [Pickaxe, Truck, Users, UserRound];
  return (
    <>
      <DossierSection
        id="profil"
        number={1}
        title="Profil de l’artisan"
        description="Qualité juridique et rôle dans la filière."
      >
        <fieldset className="artisan-dossier__choices">
          <legend>Qualité juridique</legend>
          <div>
            {(["physique", "morale"] as const).map((type) => (
              <label
                key={type}
                className={v.type_personne === type ? "is-selected" : ""}
              >
                <input
                  type="radio"
                  name="type-personne"
                  value={type}
                  checked={v.type_personne === type}
                  disabled={p.isEditMode}
                  onChange={() => p.onTypeChange(type)}
                />
                {type === "physique" ? <UserRound /> : <Building2 />}
                {type === "physique" ? "Personne physique" : "Personne morale"}
              </label>
            ))}
          </div>
          {p.isEditMode && (
            <small>
              La qualité juridique est conservée pour protéger l’historique du
              dossier.
            </small>
          )}
        </fieldset>
        <fieldset className="artisan-dossier__choices is-roles">
          <legend>Rôle dans la filière</legend>
          <div>
            {EDITABLE_ARTISAN_ROLES.map((role, index) => {
              const Icon = roleIcons[index];
              return (
                <label
                  key={role}
                  className={v.type_artisan === role ? "is-selected" : ""}
                >
                  <input
                    id={`role-${role}`}
                    type="radio"
                    name="type-artisan"
                    value={role}
                    checked={v.type_artisan === role}
                    onChange={() => set("type_artisan", role as TypeArtisan)}
                  />
                  <Icon />
                  {ARTISAN_ROLE_LABELS[role]}
                </label>
              );
            })}
          </div>
          {v.type_artisan === "collecteur" && (
            <p>
              Rôle actuel : Collecteur (historique). Il sera conservé à
              l’enregistrement.
            </p>
          )}
        </fieldset>
      </DossierSection>
      {company ? (
        <>
          <DossierSection
            id="societe"
            number={2}
            title="Identification de la société"
            description="Références de l’entreprise et adresse de son siège."
          >
            {text("raison_sociale", "Raison sociale", true)}
            <div className="artisan-dossier__grid">
              {text("numero_registre_commerce", "Numéro RCCM", true)}
              {text("numero_ifu", "Numéro IFU", true)}
            </div>
            {territory("siege_")}
            {text("siege_adresse", "Adresse complète du siège", true)}
          </DossierSection>
          <DossierSection
            id="responsable"
            number={3}
            title="Responsable de la société"
            description="Personne représentant la société, sans création de compte utilisateur."
          >
            <div className="artisan-dossier__grid">
              {text("responsable.nom", "Nom du responsable", true)}
              {text("responsable.prenoms", "Prénom(s) du responsable", true)}
              {text(
                "responsable.date_naissance",
                "Date de naissance du responsable",
                true,
                "date",
              )}
              {text("responsable.fonction", "Fonction dans la société", true)}
              {phone("responsable.", "Téléphone du responsable")}
              {whatsapp("responsable.")}
              {text(
                "responsable.email",
                "E-mail du responsable",
                false,
                "email",
              )}
            </div>
            <h3>Pièce d’identité du responsable</h3>
            {identity("responsable.")}
            {p.documents("responsable")}
          </DossierSection>
        </>
      ) : (
        <DossierSection
          id="identite"
          number={2}
          title="Identité"
          description="Informations personnelles de l’artisan."
        >
          <div className="artisan-dossier__grid">
            {text("nom", "Nom", true)}
            {text("prenoms", "Prénom(s)")}
          </div>
          <div className="artisan-dossier__grid is-four">
            {text("date_naissance", "Date de naissance", true, "date")}
            {text("lieu_naissance", "Lieu de naissance")}
            {select("sexe", "Sexe", [
              ["", "Sélectionner"],
              ["M", "Masculin"],
              ["F", "Féminin"],
              ["Autre", "Autre"],
            ])}
            {text("nationalite", "Nationalité")}
          </div>
        </DossierSection>
      )}
      <DossierSection
        id="localisation"
        number={company ? 4 : 3}
        title="Rattachement territorial"
        description="Localisation de l’activité et rattachement dans la filière."
      >
        {territory("")}
        {v.type_artisan === "aide_exploitant" ? (
          <div className="artisan-dossier__parent">
            <DossierField
              name="exploitant_id"
              label="Exploitant de rattachement"
              required
              error={p.errors.exploitant_id}
            >
              <input
                id="exploitant_id"
                type="search"
                value={p.query}
                onChange={(e) => p.setQuery(e.target.value)}
                placeholder="Nom, société ou numéro de carte (2 caractères minimum)"
                aria-describedby="parent-help"
              />
            </DossierField>
            <p id="parent-help" className="artisan-dossier__hint">
              Choisissez un exploitant existant. Son site sera repris
              automatiquement.
            </p>
            {p.searching && <p role="status">Recherche…</p>}
            {p.searchError && <p role="alert">{p.searchError}</p>}
            {p.query.trim().length >= 2 && !p.searching && !p.searchError && (
              <ul
                aria-label="Résultats des exploitants"
                className="artisan-dossier__search-results"
              >
                {p.results.map((parent) => (
                  <li key={parent.id}>
                    <button
                      type="button"
                      onClick={() => {
                        p.onParent(parent);
                        p.setQuery("");
                      }}
                    >
                      <strong>{artisanFullName(parent)}</strong>
                      <span>
                        {parent.numero_carte || "Carte non attribuée"} ·{" "}
                        {parent.site_name || "Site non renseigné"}
                      </span>
                    </button>
                  </li>
                ))}
                {!p.results.length && (
                  <li>Aucun exploitant accessible ne correspond.</li>
                )}
              </ul>
            )}
            {p.parent && (
              <div className="artisan-dossier__selected-parent">
                <strong>{artisanFullName(p.parent)}</strong>
                <span>{p.parent.numero_carte}</span>
                <p>
                  {p.parent.site_name || "Site de l’exploitant à renseigner"}
                </p>
                <button
                  type="button"
                  className="sn-btn sn-btn--sm"
                  onClick={() => p.onParent(null)}
                >
                  Changer d’exploitant
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <ComboBox
              label="Site artisanal de rattachement"
              value={v.artisanal_site_id}
              onChange={(value) => set("artisanal_site_id", value)}
              allowCustom={false}
              options={[
                {
                  value: "",
                  label: "Non rattaché — à compléter ultérieurement",
                },
                ...p.sites.map((site) => ({
                  value: site.id,
                  label: `${site.code} · ${site.name}`,
                  subtitle: site.region,
                })),
              ]}
            />
            <p className="artisan-dossier__hint">
              Facultatif. Vous pourrez rattacher le site après l’enregistrement.
            </p>
            {p.sitesError && <p role="alert">{p.sitesError}</p>}
          </>
        )}
      </DossierSection>
      <DossierSection
        id="coordonnees"
        number={company ? 5 : 4}
        title={
          company ? "Coordonnées de la société" : "Coordonnées et observations"
        }
        description="Contacts et informations utiles au suivi."
      >
        <div className="artisan-dossier__grid">
          {phone("", company ? "Téléphone de la société" : "Téléphone")}
          {whatsapp("")}
          {text(
            "email",
            company ? "E-mail de la société" : "Adresse e-mail",
            false,
            "email",
          )}
        </div>
        {text(
          "adresse",
          company ? "Adresse du lieu d’exercice" : "Adresse complète",
        )}
        <DossierField name="observations" label="Observations">
          <textarea
            id="observations"
            rows={3}
            value={v.observations}
            onChange={(e) => set("observations", e.target.value)}
            placeholder="Éléments utiles au suivi du dossier…"
          />
        </DossierField>
      </DossierSection>
      <DossierSection
        id="piece"
        number={company ? 6 : 5}
        title={company ? "Documents de la société" : "Pièce d’identité"}
        description={
          company
            ? "Justificatifs RCCM, IFU et autres pièces de l’entreprise."
            : "Références du document et copies justificatives."
        }
      >
        {!company && identity("")}
        {p.documents(company ? "societe" : "artisan")}
      </DossierSection>
    </>
  );
}
