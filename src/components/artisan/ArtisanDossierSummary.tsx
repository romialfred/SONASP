import { useEffect, useState } from "react";
import {
  Contact,
  FileText,
  MapPin,
  Building2,
  ExternalLink,
} from "lucide-react";
import { Section } from "@/components/ui/sn";
import type { ArtisanMinier } from "@/services/artisanMinierService";
import { ARTISAN_ROLE_LABELS } from "@/lib/artisanDossier";
import {
  artisanDocumentService,
  type ArtisanDocument,
} from "@/services/artisanDocumentService";
import { artisanDossierService } from "@/services/artisanDossierService";
import { artisanalSiteService } from "@/services/artisanalSiteService";
import { artisanFullName } from "@/utils/artisanIdentity";

const date = (value?: string | null) =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString("fr-FR")
    : "Non renseignée";
function Facts({ rows }: { rows: Array<[string, string | undefined | null]> }) {
  return (
    <dl className="artisan-detail__facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || "Non renseigné"}</dd>
        </div>
      ))}
    </dl>
  );
}
export function ArtisanDossierSummary({ artisan }: { artisan: ArtisanMinier }) {
  const [documents, setDocuments] = useState<ArtisanDocument[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState("Non rattaché — à compléter ultérieurement");
  const [parent, setParent] = useState("");
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setDocuments([]);
    setParent("");
    setSite("Non rattaché — à compléter ultérieurement");
    artisanDocumentService
      .list(artisan.id)
      .then((d) => {
        if (alive) setDocuments(d);
      })
      .catch(() => {
        if (alive) setError("Les pièces n’ont pas pu être chargées.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    if (artisan.exploitant_id)
      artisanDossierService
        .getExploitant(artisan.exploitant_id)
        .then((p) => {
          if (alive) {
            setParent(artisanFullName(p));
            setSite(p.site_name || "Site de l’exploitant à renseigner");
          }
        })
        .catch(() => {
          if (alive) setSite("Rattachement non accessible");
        });
    else if (artisan.artisanal_site_id)
      artisanalSiteService
        .listSites()
        .then((s) => {
          if (alive)
            setSite(
              s.find((x) => x.id === artisan.artisanal_site_id)?.name ||
                "Site non accessible",
            );
        })
        .catch(() => {
          if (alive) setSite("Site non accessible");
        });
    return () => {
      alive = false;
    };
  }, [artisan.id, artisan.exploitant_id, artisan.artisanal_site_id]);
  const company = artisan.type_personne === "morale";
  const r = artisan.responsable;
  return (
    <div className="artisan-detail__grid">
      <Section
        id="dossier-identite"
        title={company ? "Société" : "Identité"}
        icon={company ? Building2 : Contact}
        description="Identification du titulaire du dossier."
      >
        <Facts
          rows={[
            [
              "Qualité juridique",
              company ? "Personne morale" : "Personne physique",
            ],
            ["Rôle", ARTISAN_ROLE_LABELS[artisan.type_artisan]],
            ["Nom", artisanFullName(artisan)],
            ...(company
              ? ([
                  ["Numéro RCCM", artisan.numero_registre_commerce],
                  ["Numéro IFU", artisan.numero_ifu],
                  ["Pays du siège", artisan.siege_pays],
                  ["Région du siège", artisan.siege_region],
                  ["Commune du siège", artisan.siege_commune],
                  ["Adresse du siège", artisan.siege_adresse],
                ] as Array<[string, string | null | undefined]>)
              : ([
                  ["Date de naissance", date(artisan.date_naissance)],
                  ["Lieu de naissance", artisan.lieu_naissance],
                  [
                    "Sexe",
                    artisan.sexe === "M"
                      ? "Masculin"
                      : artisan.sexe === "F"
                        ? "Féminin"
                        : artisan.sexe,
                  ],
                  ["Nationalité", artisan.nationalite],
                  ["Type de pièce", artisan.type_piece_identite],
                  ["Numéro de pièce", artisan.numero_piece_identite],
                  ["Délivrance", date(artisan.date_delivrance_piece)],
                  ["Expiration", date(artisan.date_expiration_piece)],
                  ["Lieu de délivrance", artisan.lieu_delivrance_piece],
                ] as Array<[string, string | null | undefined]>)),
          ]}
        />
      </Section>
      <Section
        id="dossier-rattachement"
        title="Coordonnées et rattachement"
        icon={MapPin}
        description="Lieu d’exercice et contacts."
      >
        <Facts
          rows={[
            ["Téléphone", artisan.telephone],
            ["Téléphone secondaire", artisan.telephone_secondaire],
            ["WhatsApp", artisan.whatsapp],
            ["E-mail", artisan.email],
            ["Pays", artisan.pays],
            ["Région", artisan.region],
            ["Commune", artisan.commune],
            ["Adresse du lieu d’exercice", artisan.adresse],
            ...(artisan.exploitant_id
              ? ([
                  ["Exploitant de rattachement", parent || "Chargement…"],
                ] as Array<[string, string]>)
              : []),
            ["Site artisanal", site],
            ["Observations", artisan.observations],
          ]}
        />
      </Section>
      {company && (
        <Section
          id="dossier-responsable"
          title="Responsable de la société"
          icon={Contact}
          description="Identité et coordonnées du représentant."
        >
          {r ? (
            <Facts
              rows={[
                ["Nom", [r.nom, r.prenoms].filter(Boolean).join(" ")],
                ["Date de naissance", date(r.date_naissance)],
                ["Fonction dans la société", r.fonction],
                ["Téléphone", r.telephone],
                ["WhatsApp", r.whatsapp],
                ["E-mail", r.email],
                ["Type de pièce", r.type_piece_identite],
                ["Numéro de pièce", r.numero_piece_identite],
                ["Délivrance", date(r.date_delivrance_piece)],
                ["Expiration", date(r.date_expiration_piece)],
                ["Lieu de délivrance", r.lieu_delivrance_piece],
              ]}
            />
          ) : (
            <p>Responsable à compléter dans la modification du dossier.</p>
          )}
        </Section>
      )}
      <Section
        id="dossier-documents"
        title="Pièces du dossier"
        icon={FileText}
        description="Documents associés à chaque titulaire."
      >
        {loading && <p role="status">Chargement des pièces…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && !documents.length && (
          <p>
            Aucune pièce déposée. Vous pouvez les ajouter depuis la modification
            du dossier.
          </p>
        )}
        <ul className="artisan-documents__list">
          {documents.map((doc) => (
            <li key={doc.id}>
              <FileText />
              <div>
                <strong>{doc.titre || doc.nom_fichier}</strong>
                <small>
                  {doc.owner_kind === "societe"
                    ? "Société"
                    : doc.owner_kind === "responsable"
                      ? "Responsable"
                      : "Artisan"}{" "}
                  · {doc.type_document.toUpperCase()} ·{" "}
                  {Math.round((doc.taille_fichier || 0) / 1024)} Ko
                </small>
              </div>
              <button
                type="button"
                className="sn-btn sn-btn--sm"
                aria-label={"Ouvrir " + (doc.titre || doc.nom_fichier)}
                onClick={async () => {
                  try {
                    window.open(
                      await artisanDocumentService.url(doc),
                      "_blank",
                      "noopener,noreferrer",
                    );
                  } catch {
                    setError(
                      "Cette pièce n’est pas accessible pour le moment.",
                    );
                  }
                }}
              >
                <ExternalLink />
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
