import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  FileText,
  Info,
  Mail,
  MapPin,
  MessageCircle,
  Mountain,
  Phone,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
  Users,
  Wallet,
  Weight,
  type LucideIcon,
} from "lucide-react";
import { Badge, Note, Section } from "@/components/ui/sn";
import type { CollectorRecord } from "@/services/collectorService";
import {
  collectorActivityService,
  type CollectorActivity,
} from "@/services/collectorActivityService";
import { valuesFromArtisan } from "@/lib/artisanDossier";
import { collectorRequirements } from "@/lib/collectorDossier";
import { artisanFullName } from "@/utils/artisanIdentity";
import "./collector-details.css";

const number = (value: number) =>
  value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const date = (value: string) =>
  new Date(
    value.length === 10 ? `${value}T12:00:00Z` : value,
  ).toLocaleDateString("fr-FR");

function IdentityRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="collector-detail__identity-row">
      <Icon size={19} aria-hidden="true" />
      <dt>{label}</dt>
      <dd>
        {children || (
          <span className="collector-detail__muted">Non renseigné</span>
        )}
      </dd>
    </div>
  );
}

function ActivityPanel({ id }: { id: string }) {
  const [activity, setActivity] = useState<CollectorActivity | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setActivity(null);
    setError("");
    collectorActivityService
      .get(id)
      .then((value) => {
        if (live) setActivity(value);
      })
      .catch(() => {
        if (live)
          setError(
            "Les indicateurs n’ont pas pu être chargés. Vérifiez votre connexion et vos droits d’accès.",
          );
      });
    return () => {
      live = false;
    };
  }, [id, attempt]);
  return (
    <aside
      className="collector-detail__activity"
      aria-label="Activité du collecteur"
    >
      <Section
        id="collector-activity"
        title="Activité du collecteur"
        icon={Activity}
      >
        <p className="collector-detail__period">
          Toutes périodes · ventes de collecte
        </p>
        {error ? (
          <div role="alert">
            <Note tone="warning">{error}</Note>
            <button
              className="sn-btn sn-btn--secondary"
              onClick={() => setAttempt((v) => v + 1)}
            >
              <RefreshCw size={15} />
              Réessayer
            </button>
          </div>
        ) : !activity ? (
          <p role="status" className="collector-detail__loading">
            Chargement des indicateurs…
          </p>
        ) : (
          <>
            <div className="collector-detail__metric collector-detail__metric--primary">
              <span>
                <Wallet size={19} />
                Chiffre d’affaires suivi (HT)
              </span>
              <strong>
                {number(activity.turnover)} <small>FCFA</small>
              </strong>
              <p>Montant des ventes approuvées</p>
            </div>
            <div className="collector-detail__metric">
              <span>
                <ClipboardList size={18} />
                Total des déclarations
              </span>
              <strong>{number(activity.declarations)}</strong>
              <p>
                {activity.approved} approuvée(s) · {activity.pending} en attente
              </p>
            </div>
            <div className="collector-detail__metric collector-detail__metric--gold">
              <span>
                <FileText size={18} />
                Taxes enregistrées
              </span>
              <strong>
                {activity.taxes === null ? (
                  "À compléter"
                ) : (
                  <>
                    {number(activity.taxes)} <small>FCFA</small>
                  </>
                )}
              </strong>
              <p>
                {activity.taxes === null
                  ? "Des montants de taxe manquent dans les ventes approuvées."
                  : "TVA et taxe de développement communal"}
              </p>
            </div>
            <dl className="collector-detail__activity-rows">
              <div>
                <dt>
                  <Weight size={16} />
                  Or déclaré approuvé
                </dt>
                <dd>{number(activity.quantity)} g</dd>
              </div>
              <div>
                <dt>Ventes payées</dt>
                <dd>{activity.paid}</dd>
              </div>
              <div>
                <dt>Refusées / annulées</dt>
                <dd>{activity.rejected + activity.cancelled}</dd>
              </div>
              <div>
                <dt>Dernière déclaration</dt>
                <dd>
                  {activity.lastDeclaration
                    ? date(activity.lastDeclaration)
                    : "Aucune"}
                </dd>
              </div>
            </dl>
            {!activity.declarations && (
              <p className="collector-detail__empty">
                Aucune vente de collecte enregistrée pour ce dossier.
              </p>
            )}
            <p className="collector-detail__method">
              <Info size={15} />
              Les montants concernent les ventes rattachées au collecteur, hors
              refus et annulations. Les taxes enregistrées ne constituent pas
              une preuve de reversement fiscal.
            </p>
          </>
        )}
      </Section>
    </aside>
  );
}

export function CollectorDetails({
  record,
  manage,
  canDelegate,
  showCollectionSales,
  onRefresh,
  paymentForm,
}: {
  record: CollectorRecord;
  manage: boolean;
  canDelegate: boolean;
  showCollectionSales: boolean;
  onRefresh: () => void;
  paymentForm: ReactNode;
}) {
  const [configure, setConfigure] = useState(false);
  const a = record.identity;
  const name = artisanFullName(a);
  const initials =
    [a.nom, a.prenoms]
      .filter(Boolean)
      .map((v) => v!.trim().charAt(0))
      .join("")
      .slice(0, 2) || "CO";
  const complete =
    a.type_personne === "physique" &&
    collectorRequirements({
      ...valuesFromArtisan(a),
      organization_id: record.organization_id,
      site_ids: record.site_ids,
    }).every((r) => r.filled);
  const linked =
    !!record.organization_id && record.site_ids.length > 0 && !record.is_legacy;
  const delegated =
    !!record.payment_authorized_until &&
    new Date(record.payment_authorized_until) > new Date();
  const location = [a.commune, a.region].filter(Boolean).join(" · ");
  const editUrl = `/artisan-minier/collecteurs/${record.id}/modifier`;
  const salesUrl = `/collecte/ventes?collecteur=${encodeURIComponent(record.id)}`;
  const editable = manage && a.type_personne === "physique";
  return (
    <div className="collector-detail">
      <nav className="collector-detail__breadcrumb" aria-label="Fil d’Ariane">
        <Link to="/artisan-minier">Artisans miniers</Link>
        <span>/</span>
        <Link to="/artisan-minier/collecteurs">Collecteurs</Link>
        <span>/</span>
        <span>Dossier</span>
      </nav>
      <header className="collector-detail__banner">
        <div className="collector-detail__person">
          <span className="collector-detail__avatar" aria-hidden="true">
            {initials}
          </span>
          <div>
            <h1>{name}</h1>
            <Badge
              tone={
                !a.actif && a.actif !== undefined
                  ? "neutral"
                  : complete
                    ? "success"
                    : "warning"
              }
            >
              {a.actif === false ? (
                "Dossier inactif"
              ) : complete ? (
                <>
                  <CheckCircle2 size={14} />
                  Dossier renseigné
                </>
              ) : (
                <>
                  <AlertCircle size={14} />
                  Dossier incomplet
                </>
              )}
            </Badge>
          </div>
        </div>
        <div className="collector-detail__reference">
          <FileText size={21} />
          <div>
            <span>
              {a.numero_carte ? "Numéro de carte" : "Identifiant du dossier"}
            </span>
            <strong title={record.id}>
              {a.numero_carte || record.id.slice(0, 8).toUpperCase()}
            </strong>
          </div>
        </div>
        <div className="collector-detail__location">
          <MapPin size={22} />
          <div>
            <span>Localisation</span>
            <strong>{location || "Non renseignée"}</strong>
          </div>
        </div>
        <div className="collector-detail__actions">
          <button
            type="button"
            className="sn-btn sn-btn--secondary"
            onClick={onRefresh}
          >
            <RefreshCw size={17} />
            Actualiser
          </button>
          {editable && (
            <Link className="sn-btn sn-btn--primary" to={editUrl}>
              <Plus size={18} />
              Modifier le dossier
            </Link>
          )}
        </div>
      </header>
      <section
        className="collector-detail__summary"
        aria-label="Résumé du dossier"
      >
        <h2>
          <BarChart3 size={22} />
          Résumé du dossier
        </h2>
        <div>
          <Mountain size={23} />
          <span>
            Sites affectés<strong>{record.site_ids.length}</strong>
          </span>
        </div>
        <div>
          <UserRound size={23} />
          <span>
            Compte utilisateur
            <strong>
              {record.account_user_id ? "Associé" : "Non associé"}
            </strong>
          </span>
        </div>
        <div className={delegated ? "is-authorized" : "is-unauthorized"}>
          <ShieldCheck size={23} />
          <span>
            Paiement
            <strong>{delegated ? "Délégation active" : "Non autorisé"}</strong>
          </span>
        </div>
      </section>
      <div className="collector-detail__layout">
        <div className="collector-detail__main">
          <div className="collector-detail__cards">
            <Section
              id="collector-identity"
              title="Identité et coordonnées"
              icon={UserRound}
            >
              <dl className="collector-detail__identity">
                <IdentityRow icon={UserRound} label="Qualité">
                  {a.type_personne === "physique"
                    ? "Personne physique"
                    : "Personne morale — dossier historique"}
                </IdentityRow>
                <IdentityRow icon={Phone} label="Téléphone">
                  {a.telephone}
                </IdentityRow>
                <IdentityRow icon={MessageCircle} label="WhatsApp">
                  {a.whatsapp_identique ? a.telephone : a.whatsapp}
                </IdentityRow>
                <IdentityRow icon={Mail} label="E-mail">
                  {a.email}
                </IdentityRow>
                <IdentityRow icon={MapPin} label="Localisation">
                  {[a.commune, a.region, a.pays].filter(Boolean).join(" · ")}
                </IdentityRow>
                {a.adresse && (
                  <IdentityRow icon={MapPin} label="Adresse">
                    {a.adresse}
                  </IdentityRow>
                )}
              </dl>
            </Section>
            <Section
              id="collector-scope"
              title="Rattachements et accès"
              icon={Building2}
            >
              <h2 className="collector-detail__scope-title">
                <ClipboardList size={22} />
                {linked ? "Rattachements renseignés" : "Dossier à compléter"}
              </h2>
              <div className="collector-detail__links-summary">
                <span>
                  <Mountain size={20} />
                  {record.site_ids.length} site(s) affecté(s)
                </span>
                <span>
                  <Users size={20} />
                  {record.organization_id
                    ? record.organization_name
                    : "Aucun organisme associé"}
                </span>
              </div>
              {!linked && (
                <div className="collector-detail__alert">
                  <AlertCircle size={18} />
                  <span>
                    {a.type_personne === "physique"
                      ? "Complétez l’organisme et les sites avant d’utiliser le circuit de vente."
                      : "L’activité de collecte doit être confiée à une personne physique. Les données historiques restent conservées."}
                  </span>
                </div>
              )}
              {!!record.sites?.length && (
                <ul className="collector-detail__sites">
                  {record.sites.map((site) => (
                    <li key={site.id}>
                      <Mountain size={16} />
                      <span>
                        <strong>{site.name}</strong>
                        <small>{site.locality || site.region}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="collector-detail__access-note">
                {record.account_user_id
                  ? "Un compte utilisateur est associé à ce dossier. Ses habilitations déterminent les actions disponibles."
                  : "La création du dossier et l’ouverture d’un accès sont deux étapes distinctes."}
              </p>
              <div className="collector-detail__scope-actions">
                {manage && (
                  <Link to="/users" className="sn-btn sn-btn--secondary">
                    <UserRoundPlus size={18} />
                    {record.account_user_id
                      ? "Gérer le compte utilisateur"
                      : "Associer un compte utilisateur"}
                  </Link>
                )}
                {editable && (
                  <Link
                    to={`${editUrl}#collector-section-3`}
                    className="sn-btn sn-btn--secondary"
                  >
                    <Mountain size={18} />
                    Affecter les sites de collecte
                  </Link>
                )}
                {showCollectionSales && (
                  <Link
                    to={salesUrl}
                    className="sn-btn sn-btn--secondary collector-detail__sales-link"
                  >
                    <BarChart3 size={18} />
                    Consulter les ventes de collecte
                    <ArrowUpRight size={16} />
                  </Link>
                )}
              </div>
            </Section>
          </div>
          <Section
            id="collector-payments"
            title="Autorisation de paiement"
            icon={ShieldCheck}
          >
            <div className="collector-detail__payment">
              <span
                className={`collector-detail__payment-state ${delegated ? "is-authorized" : "is-unauthorized"}`}
              >
                <ShieldCheck size={23} />
                {delegated ? "DÉLÉGATION ACTIVE" : "NON AUTORISÉ"}
              </span>
              <div>
                <strong>
                  {record.payment_authorized_until
                    ? `Délégation ${delegated ? "valable" : "expirée"} au ${date(record.payment_authorized_until)}`
                    : "Aucune délégation de paiement."}
                </strong>
                <p>
                  Une délégation en cours et l’habilitation « Collecteur —
                  exécuter un paiement » sont nécessaires.
                </p>
              </div>
              {canDelegate && (
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  aria-expanded={configure}
                  aria-controls="collector-delegation-form"
                  onClick={() => setConfigure((v) => !v)}
                >
                  <Settings size={18} />
                  {configure
                    ? "Fermer la configuration"
                    : "Configurer la délégation"}
                </button>
              )}
            </div>
            <p className="collector-detail__payment-note">
              <Info size={17} />
              Le contrôle du paiement reste effectué par un autre agent de
              l’organisme.
            </p>
            {canDelegate && configure && (
              <div id="collector-delegation-form">{paymentForm}</div>
            )}
          </Section>
        </div>
        <ActivityPanel id={record.id} />
      </div>
    </div>
  );
}
