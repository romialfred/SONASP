import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Check,
  CircleDollarSign,
  Plus,
  RefreshCw,
  Save,
  ShoppingBag,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isCollectorScopedUser } from "@/lib/collectorAccess";
import { NationalDashboardLayout } from "@/components/layout/NationalDashboardLayout";
import {
  Badge,
  DataTable,
  Field,
  Note,
  PageHeader,
  Section,
  type Column,
} from "@/components/ui/sn";
import { ComboBox } from "@/components/ui/ComboBox";
import {
  collectorService,
  type CollectionArtisan,
  type CollectorSale,
} from "@/services/collectorService";
import { artisanGoldSalesService } from "@/services/artisanGoldSalesService";
import { secureRandomId } from "@/lib/secureRandom";
import "./collector.css";

const statusLabel = {
  submitted: "À approuver",
  approved: "Approuvée",
  rejected: "Refusée",
};
const notificationLabel: Record<string, string> = {
  envoye: "envoyée",
  en_attente: "en attente d’envoi",
  echec: "échec d’envoi",
  contact_manquant: "contact e-mail manquant",
};
export function CollectionSaleForm({ onSaved }: { onSaved: () => void }) {
  const [artisans, setArtisans] = useState<CollectionArtisan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState({
    artisan_id: "",
    site_id: "",
    date: new Date().toISOString().slice(0, 10),
    quantity: "",
    gold_type: "poudre",
    purity: "24",
    price: "",
    observations: "",
  });
  const id = useRef(secureRandomId());
  const selected = artisans.find((a) => a.id === data.artisan_id);
  useEffect(() => {
    let live = true;
    collectorService
      .saleArtisans()
      .then((rows) => {
        if (live) setArtisans(rows);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  const totals = artisanGoldSalesService.calculateTaxes(
    Number(data.quantity) || 0,
    Number(data.price) || 0,
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (
      !selected ||
      !Number.isFinite(Number(data.quantity)) ||
      Number(data.quantity) <= 0 ||
      !Number.isFinite(Number(data.price)) ||
      Number(data.price) <= 0 ||
      Number(data.purity) <= 0 ||
      Number(data.purity) > 24
    ) {
      setError(
        "Sélectionnez un artisan éligible et renseignez une quantité, un prix et une pureté valides.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await collectorService.submitSale(id.current, {
        ...data,
        site_id: selected.site_id,
        quantity: Number(data.quantity),
        price: Number(data.price),
        purity: Number(data.purity),
      });
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "La vente n’a pas été enregistrée.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="collector-payment-form"
      aria-label="Enregistrer une vente de collecte"
    >
      {error && (
        <div role="alert">
          <Note tone="danger">{error}</Note>
        </div>
      )}
      <Note>
        La vente sera soumise à votre comptoir ou à la SONASP. Seuls les
        artisans affiliés et rattachés à vos sites sont proposés.
      </Note>
      {loading ? (
        <p role="status">Chargement des artisans éligibles…</p>
      ) : (
        <ComboBox
          label="Artisan vendeur"
          required
          value={data.artisan_id}
          allowCustom={false}
          onChange={(artisan_id) => setData({ ...data, artisan_id })}
          options={artisans.map((a) => ({
            value: a.id,
            label: `${a.name} · ${a.site_name}`,
          }))}
          placeholder="Rechercher un artisan sur vos sites…"
        />
      )}
      {!loading && !artisans.length && (
        <Note tone="warning">
          Aucun artisan avec une affiliation valide sur vos sites. Faites
          compléter les affiliations ou les rattachements avant de déclarer une
          vente.
        </Note>
      )}
      {selected && (
        <p>
          Site de collecte : <strong>{selected.site_name}</strong>
        </p>
      )}
      <fieldset disabled={busy} className="collector-fieldset collector-grid">
        <Field label="Date de vente" htmlFor="sale-date" required>
          <input
            id="sale-date"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            required
            value={data.date}
            onChange={(e) => setData({ ...data, date: e.target.value })}
          />
        </Field>
        <Field label="Type d’or" htmlFor="sale-gold">
          <select
            id="sale-gold"
            value={data.gold_type}
            onChange={(e) => setData({ ...data, gold_type: e.target.value })}
          >
            <option value="poudre">Poudre</option>
            <option value="lingot">Lingot</option>
            <option value="pepites">Pépites</option>
            <option value="bijoux">Bijoux</option>
            <option value="autre">Autre</option>
          </select>
        </Field>
        {(
          [
            ["quantity", "Quantité (grammes)"],
            ["purity", "Pureté (carats)"],
            ["price", "Prix par kilogramme (FCFA)"],
          ] as const
        ).map(([key, label]) => (
          <Field label={label} htmlFor={`sale-${key}`} required key={key}>
            <input
              id={`sale-${key}`}
              type="number"
              min="0.001"
              step="any"
              max={key === "purity" ? 24 : undefined}
              required
              value={data[key]}
              onChange={(e) => setData({ ...data, [key]: e.target.value })}
            />
          </Field>
        ))}
      </fieldset>
      <p>
        Montant brut :{" "}
        <strong>{totals.montant_brut_fcfa.toLocaleString("fr-FR")} FCFA</strong>{" "}
        · Total calculé :{" "}
        <strong>
          {totals.montant_total_fcfa.toLocaleString("fr-FR")} FCFA
        </strong>
      </p>
      <p className="collector-help">
        TVA 18 % et taxe de développement communal 1 %, selon les règles de
        calcul existantes. La facture détaillera les retenues et le net à payer.
      </p>
      <Field label="Observations" htmlFor="sale-observations">
        <textarea
          id="sale-observations"
          maxLength={2000}
          value={data.observations}
          onChange={(e) => setData({ ...data, observations: e.target.value })}
        />
      </Field>
      <button
        type="submit"
        className="sn-btn sn-btn--primary"
        disabled={loading || busy || !selected}
      >
        <Save size={16} />
        {busy ? "Enregistrement…" : "Soumettre à approbation"}
      </button>
    </form>
  );
}
export default function CollectionSalesPage({
  create = false,
}: {
  create?: boolean;
}) {
  const { user } = useAuth();
  const collector = isCollectorScopedUser(user);
  const navigate = useNavigate();
  const location = useLocation();
  const collectorFilter = new URLSearchParams(location.search).get('collecteur');
  const [rows, setRows] = useState<CollectorSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [decision, setDecision] = useState<{
    sale: CollectorSale;
    value: "approved" | "rejected";
  }>();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await collectorService.sales());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!create) void load();
  }, [load, create, location.key]);
  async function decide(e: FormEvent) {
    e.preventDefault();
    if (!decision || busy) return;
    setBusy(true);
    setError("");
    try {
      await collectorService.decideSale(decision.sale, decision.value, reason);
      setDecision(undefined);
      setReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Décision non enregistrée.");
    } finally {
      setBusy(false);
    }
  }
  const columns: Column<CollectorSale>[] = [
    {
      key: "artisan",
      header: "Artisan / Collecteur",
      render: (s) => (
        <>
          <strong>{s.artisan_name}</strong>
          <small style={{ display: "block" }}>{s.collector_name}</small>
        </>
      ),
    },
    {
      key: "site",
      header: "Site / Organisme",
      render: (s) => (
        <>
          {s.site_name}
          <small style={{ display: "block" }}>{s.organization_name}</small>
        </>
      ),
    },
    {
      key: "quantity",
      header: "Quantité",
      render: (s) => `${s.quantity.toLocaleString("fr-FR")} g`,
    },
    {
      key: "total",
      header: "Total",
      render: (s) => `${s.total.toLocaleString("fr-FR")} FCFA`,
    },
    {
      key: "status",
      header: "Approbation",
      render: (s) => (
        <>
          <Badge
            tone={
              s.status === "approved"
                ? "success"
                : s.status === "rejected"
                  ? "danger"
                  : "warning"
            }
          >
            {statusLabel[s.status]}
          </Badge>
          {s.reason && <small style={{ display: "block" }}>{s.reason}</small>}
        </>
      ),
    },
    {
      key: "notifications",
      header: "Notifications par courriel",
      render: (s) => (
        <>
          {s.notifications.length
            ? s.notifications.map((n, i) => (
                <small key={i} style={{ display: "block" }}>
                  {n.recipient} : {notificationLabel[n.status] || n.status}
                </small>
              ))
            : "Après décision"}
        </>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (s) => (
        <div className="collector-payment-form">
          {s.can_approve && !collector && (
            <>
              <button
                className="sn-btn sn-btn--secondary"
                onClick={() => {
                  setDecision({ sale: s, value: "approved" });
                  setReason("");
                }}
              >
                <Check size={16} />
                Approuver
              </button>
              <button
                className="sn-btn sn-btn--secondary"
                onClick={() => {
                  setDecision({ sale: s, value: "rejected" });
                  setReason("");
                }}
              >
                <X size={16} />
                Refuser
              </button>
            </>
          )}
          {s.can_issue_invoice && !s.invoice_id && !collector && (
            <Link
              className="sn-btn sn-btn--secondary"
              to={`/artisan-minier/ventes-or/${s.id}/facture`}
            >
              Établir la facture
            </Link>
          )}
          {s.can_pay && s.invoice_id && s.payment_status !== "paye" && (
            <Link
              className="sn-btn sn-btn--secondary"
              to={
                s.payment_id
                  ? `/artisan-minier/paiements/historique/${s.payment_id}`
                  : `/artisan-minier/paiements/${s.id}/nouveau`
              }
            >
              <CircleDollarSign size={16} />
              Paiement
            </Link>
          )}
          {s.payment_status === "paye" && <Badge tone="success">Payée</Badge>}
          {s.notifications.some((n) => n.status === "en_attente") && (
            <button
              className="sn-btn sn-btn--secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await collectorService.dispatchNotifications(s.id);
                  await load();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Envoi indisponible.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Relancer les notifications
            </button>
          )}
        </div>
      ),
    },
  ];
  return (
    <NationalDashboardLayout>
      <main className="sn-page collector-page">
        <PageHeader
          icon={ShoppingBag}
          title={create ? "Nouvelle vente de collecte" : "Ventes de collecte"}
          subtitle="Soumission, approbation par l’organisme et suivi du paiement."
          breadcrumb={[
            { label: "Artisans miniers" },
            {
              label: "Ventes de collecte",
              to: create ? "/collecte/ventes" : undefined,
            },
          ]}
          actions={
            <>
              {!create && (
                <button
                  className="sn-btn sn-btn--secondary"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  <RefreshCw size={16} />
                  Actualiser
                </button>
              )}
              {collector && !create && (
                <Link
                  to="/collecte/ventes/nouvelle"
                  className="sn-btn sn-btn--primary"
                >
                  <Plus size={16} />
                  Enregistrer une vente
                </Link>
              )}
              {create && (
                <Link
                  className="sn-btn sn-btn--secondary"
                  to="/collecte/ventes"
                >
                  Retour aux ventes
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
        {create ? (
          collector ? (
            <Section
              id="collection-declaration"
              icon={ShoppingBag}
              title="Déclaration de la vente"
            >
              <CollectionSaleForm
                onSaved={() =>
                  navigate("/collecte/ventes", { state: { submitted: true } })
                }
              />
            </Section>
          ) : (
            <Note tone="warning">
              Cet enregistrement est réservé aux collecteurs.
            </Note>
          )
        ) : (
          <>
            {location.state?.submitted && (
              <Note tone="success">
                Vente enregistrée et soumise à l’organisme de rattachement.
              </Note>
            )}
            {collectorFilter && <Note>Ventes du collecteur sélectionné. <Link to="/collecte/ventes">Voir toutes les ventes autorisées</Link></Note>}
            {decision && (
              <Section
                id="collection-decision"
                icon={Check}
                title={`${decision.value === "approved" ? "Approuver" : "Refuser"} la vente de ${decision.sale.artisan_name}`}
              >
                <form className="collector-payment-form" onSubmit={decide}>
                  <p>
                    Décision pour {decision.sale.quantity} g ·{" "}
                    {decision.sale.total.toLocaleString("fr-FR")} FCFA. Le
                    paiement sera traité séparément.
                  </p>
                  <Field
                    label="Motif de la décision"
                    htmlFor="decision-reason"
                    required={decision.value === "rejected"}
                  >
                    <textarea
                      id="decision-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      required={decision.value === "rejected"}
                      minLength={decision.value === "rejected" ? 10 : undefined}
                      maxLength={1000}
                    />
                  </Field>
                  <div>
                    <button className="sn-btn sn-btn--primary" disabled={busy}>
                      Confirmer la décision
                    </button>
                    <button
                      className="sn-btn sn-btn--secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => setDecision(undefined)}
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </Section>
            )}
            <Field label="Filtrer par approbation" htmlFor="collection-filter">
              <select
                id="collection-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">Toutes les ventes</option>
                <option value="submitted">À approuver</option>
                <option value="approved">Approuvées</option>
                <option value="rejected">Refusées</option>
              </select>
            </Field>
            {loading ? (
              <p role="status">Chargement des ventes…</p>
            ) : (
              <DataTable
                columns={columns}
                rows={rows.filter(
                  (s) => (!collectorFilter || s.collector_id === collectorFilter) && (filter === "all" || s.status === filter),
                )}
                caption="Ventes de collecte"
                empty="Aucune vente dans ce périmètre."
              />
            )}
          </>
        )}
      </main>
    </NationalDashboardLayout>
  );
}
