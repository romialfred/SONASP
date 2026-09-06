import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Building2,
  CreditCard,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { NationalDashboardLayout } from "@/components/layout/NationalDashboardLayout";
import {
  Badge,
  DataTable,
  Field,
  Note,
  PageHeader,
  Section,
  StatGrid,
  type Column,
} from "@/components/ui/sn";
import { useAuth } from "@/contexts/AuthContext";
import { canManageMiningRegistry } from "@/lib/miningRegistryAccess";
import {
  collectorService,
  type CollectorRecord,
} from "@/services/collectorService";
import { artisanFullName } from "@/utils/artisanIdentity";
import { CAPABILITIES, hasSensitiveCapability } from "@/lib/capabilities";
import "./collector.css";

export default function CollectorsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<CollectorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [organization, setOrganization] = useState("");
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const manage = canManageMiningRegistry(user);
  const canDelegate =
    hasSensitiveCapability(user, CAPABILITIES.COMPTOIR_PAYMENTS_EXECUTE) ||
    hasSensitiveCapability(user, CAPABILITIES.FINANCE_EXECUTE);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await collectorService.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, location.key]);
  const selected = rows.find((r) => r.id === id);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!organization || r.organization_id === organization) &&
          `${artisanFullName(r.identity)} ${r.identity.telephone} ${r.organization_name}`
            .toLocaleLowerCase("fr")
            .includes(query.toLocaleLowerCase("fr")),
      ),
    [rows, organization, query],
  );
  const organizations = [
    ...new Map(
      rows.map((r) => [r.organization_id, r.organization_name]),
    ).entries(),
  ];
  const columns: Column<CollectorRecord>[] = [
    {
      key: "name",
      header: "Collecteur",
      render: (r) => (
        <Link to={`/artisan-minier/collecteurs/${r.id}`}>
          <strong>{artisanFullName(r.identity)}</strong>
          <small style={{ display: "block" }}>{r.identity.telephone}</small>
          {r.is_legacy && (
            <Badge tone="warning">
              {r.identity.type_personne === "physique"
                ? "Rattachements à compléter"
                : "Personne morale historique"}
            </Badge>
          )}
        </Link>
      ),
    },
    {
      key: "organization",
      header: "Organisme de rattachement",
      render: (r) => r.organization_name,
    },
    { key: "sites", header: "Sites", render: (r) => r.site_ids.length },
    {
      key: "account",
      header: "Accès à la plateforme",
      render: (r) => (
        <Badge tone={r.account_user_id ? "success" : "neutral"}>
          {r.account_user_id ? "Compte rattaché" : "Compte à rattacher"}
        </Badge>
      ),
    },
    {
      key: "payment",
      header: "Délégation de paiement",
      render: (r) => (
        <Badge
          tone={
            r.payment_authorized_until &&
            new Date(r.payment_authorized_until) > new Date()
              ? "success"
              : "neutral"
          }
        >
          {r.payment_authorized_until &&
          new Date(r.payment_authorized_until) > new Date()
            ? "Autorisée"
            : "Non autorisée"}
        </Badge>
      ),
    },
  ];
  async function authorize(revoke: boolean) {
    if (!selected || busy) return;
    if (reason.trim().length < 10 || (!revoke && !until)) {
      setError(
        "Renseignez une échéance et une justification de 10 caractères minimum.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await collectorService.authorizePayment(
        selected.id,
        revoke ? null : new Date(`${until}T23:59:59Z`).toISOString(),
        reason.trim(),
      );
      setNotice(
        revoke
          ? "Délégation révoquée."
          : "Délégation enregistrée. L’habilitation de paiement du compte reste obligatoire.",
      );
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "La délégation n’a pas été enregistrée.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <NationalDashboardLayout>
      <main className="sn-page collector-page">
        <PageHeader
          icon={Users}
          title={
            id
              ? selected
                ? artisanFullName(selected.identity)
                : "Dossier collecteur"
              : "Collecteurs"
          }
          subtitle="Dossiers, sites de collecte et organismes de rattachement."
          breadcrumb={[
            { label: "Artisans miniers", to: "/artisan-minier" },
            {
              label: "Collecteurs",
              to: id ? "/artisan-minier/collecteurs" : undefined,
            },
          ]}
          actions={
            <>
              <button
                className="sn-btn sn-btn--secondary"
                type="button"
                disabled={loading}
                onClick={() => void load()}
              >
                <RefreshCw size={16} />
                Actualiser
              </button>
              {manage &&
                (!id || selected?.identity.type_personne === "physique") && (
                  <Link
                    className="sn-btn sn-btn--primary"
                    to={
                      id
                        ? `/artisan-minier/collecteurs/${id}/modifier`
                        : "/artisan-minier/collecteurs/nouveau"
                    }
                  >
                    <Plus size={16} />
                    {id ? "Modifier le dossier" : "Nouveau collecteur"}
                  </Link>
                )}
            </>
          }
        />
        {error && (
          <div role="alert">
            <Note tone="danger">{error}</Note>
          </div>
        )}
        {notice && (
          <div role="status">
            <Note tone="success">{notice}</Note>
          </div>
        )}
        {location.state?.saved && (
          <Note tone="success">Le dossier du collecteur a été enregistré.</Note>
        )}
        {loading ? (
          <p role="status">Chargement des collecteurs…</p>
        ) : id ? (
          selected ? (
            <>
              <div className="collector-detail-grid">
                <Section
                  id="collector-identity"
                  title="Identité et coordonnées"
                  icon={UserRound}
                >
                  <dl>
                    <dt>Qualité</dt>
                    <dd>
                      {selected.identity.type_personne === "physique"
                        ? "Personne physique"
                        : "Personne morale — dossier historique"}
                    </dd>
                    <dt>Téléphone</dt>
                    <dd>{selected.identity.telephone}</dd>
                    <dt>WhatsApp</dt>
                    <dd>{selected.identity.whatsapp || "Non renseigné"}</dd>
                    <dt>E-mail</dt>
                    <dd>{selected.identity.email || "Non renseigné"}</dd>
                    <dt>Localisation</dt>
                    <dd>
                      {[
                        selected.identity.commune,
                        selected.identity.region,
                        selected.identity.pays,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </dd>
                  </dl>
                </Section>
                <Section
                  id="collector-scope"
                  title="Rattachements et accès"
                  icon={Building2}
                >
                  <p>
                    <strong>{selected.organization_name}</strong>
                  </p>
                  <p>{selected.site_ids.length} site(s) affecté(s)</p>
                  {selected.is_legacy && (
                    <Note tone="warning">
                      {selected.identity.type_personne === "physique"
                        ? "Complétez l’organisme et les sites avant d’utiliser le nouveau circuit de vente."
                        : "L’activité de collecte doit être confiée à une personne physique. Créez son dossier ; les données historiques restent conservées."}
                    </Note>
                  )}
                  {selected.sites?.map((site) => (
                    <p key={site.id}>
                      <strong>{site.name}</strong> · {site.locality}
                    </p>
                  ))}
                  <Badge
                    tone={selected.account_user_id ? "success" : "warning"}
                  >
                    {selected.account_user_id
                      ? "Compte utilisateur associé"
                      : "Compte utilisateur à associer"}
                  </Badge>
                  <p>
                    La création du dossier et l’ouverture d’un accès sont deux
                    étapes distinctes.
                  </p>
                  {manage && (
                    <Link to="/users" className="sn-btn sn-btn--secondary">
                      Gérer le compte du collecteur
                    </Link>
                  )}
                  <Link
                    to="/collecte/ventes"
                    className="sn-btn sn-btn--secondary"
                  >
                    Consulter les ventes de collecte
                  </Link>
                </Section>
              </div>
              <Section
                id="collector-payments"
                title="Autorisation de paiement"
                icon={ShieldCheck}
              >
                <p>
                  {selected.payment_authorized_until
                    ? `Échéance de la délégation : ${new Date(selected.payment_authorized_until).toLocaleString("fr-FR")}`
                    : "Aucune délégation de paiement."}
                </p>
                <Note>
                  Le collecteur doit disposer d’une délégation en cours et de
                  l’habilitation « Collecteur — exécuter un paiement ». Le
                  contrôle du paiement reste effectué par un autre agent de
                  l’organisme.
                </Note>
                {canDelegate && selected.can_delegate_payment && (
                  <div className="collector-payment-form">
                    <Field
                      label="Autoriser jusqu’au"
                      htmlFor="delegation-until"
                    >
                      <input
                        type="date"
                        id="delegation-until"
                        value={until}
                        onChange={(e) => setUntil(e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Justification"
                      htmlFor="delegation-reason"
                      required
                    >
                      <textarea
                        id="delegation-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        minLength={10}
                        maxLength={1000}
                      />
                    </Field>
                    <div>
                      <button
                        type="button"
                        className="sn-btn sn-btn--primary"
                        disabled={busy}
                        onClick={() => void authorize(false)}
                      >
                        Autoriser le paiement
                      </button>
                      <button
                        type="button"
                        className="sn-btn sn-btn--secondary"
                        disabled={busy || !selected.payment_authorized_until}
                        onClick={() => void authorize(true)}
                      >
                        Révoquer
                      </button>
                    </div>
                  </div>
                )}
              </Section>
            </>
          ) : (
            <Note tone="warning">
              Collecteur introuvable dans votre périmètre.
            </Note>
          )
        ) : (
          <>
            <StatGrid
              ariaLabel="Synthèse des collecteurs"
              items={[
                {
                  label: "Collecteurs",
                  value: rows.length,
                  icon: Users,
                  tone: "green",
                },
                {
                  label: "Organismes représentés",
                  value: organizations.length,
                  icon: Building2,
                  tone: "blue",
                },
                {
                  label: "Comptes rattachés",
                  value: rows.filter((r) => r.account_user_id).length,
                  icon: UserRound,
                  tone: "neutral",
                },
                {
                  label: "Délégations en cours",
                  value: rows.filter(
                    (r) =>
                      r.payment_authorized_until &&
                      new Date(r.payment_authorized_until) > new Date(),
                  ).length,
                  icon: CreditCard,
                  tone: "gold",
                },
              ]}
            />
            <div className="sn-card collector-list-filters">
              <Field
                label="Rechercher un collecteur"
                htmlFor="collector-search"
              >
                <input
                  type="search"
                  id="collector-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nom, téléphone ou organisme…"
                />
              </Field>
              <Field label="Organisme" htmlFor="collector-org-filter">
                <select
                  id="collector-org-filter"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                >
                  <option value="">Tous</option>
                  {organizations.map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <DataTable
              columns={columns}
              rows={filtered}
              caption="Liste des collecteurs"
              empty="Aucun collecteur ne correspond à votre recherche."
              onRowClick={(r) =>
                navigate(`/artisan-minier/collecteurs/${r.id}`)
              }
            />
          </>
        )}
      </main>
    </NationalDashboardLayout>
  );
}
