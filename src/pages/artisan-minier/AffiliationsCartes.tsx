import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MinusCircle,
  Clock3,
  Copy,
  CreditCard,
  Filter,
  Lightbulb,
  ListChecks,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";
import { NationalDashboardLayout } from "@/components/layout/NationalDashboardLayout";
import { Badge, EmptyState, PageHeader, Section } from "@/components/ui/sn";
import { Modal, ModalBody } from "@/components/ui/Modal";
import { AffiliationDossier } from "@/components/artisan/AffiliationDossier";
import {
  affiliationCountdown,
  affiliationDate,
  AFFILIATION_STATUS_LABELS,
  type AffiliationCard,
} from "@/lib/affiliationCard";
import { affiliationService } from "@/services/affiliationService";
import { artisanMinierService } from "@/services/artisanMinierService";
import { useAuth } from "@/contexts/AuthContext";
import { CAPABILITIES, hasSensitiveCapability } from "@/lib/capabilities";
import { messageErreurUtilisateur } from "@/lib/presentError";
import type { AdhesionBareme } from "@/types/affiliations";
import "./affiliations-registry.css";

type RegistryTab = "cartes" | "baremes" | "activations" | "expirations";
const roleLabels: Record<string, string> = {
  exploitant: "Exploitant",
  fournisseur: "Fournisseur",
  aide_exploitant: "Aide exploitant",
  intermediaire: "Intermédiaire",
  collecteur: "Collecteur",
};
const holderName = (card: AffiliationCard) =>
  card.snapshot
    ? [card.snapshot.prenoms, card.snapshot.nom].filter(Boolean).join(" ") ||
      card.holder_name ||
      "Identité à contrôler"
    : card.holder_name || "Identité à contrôler";
const needsIdentityReview = (card: AffiliationCard) =>
  (card.identity_ready === false ||
    (card.identity_ready === undefined && !card.snapshot)) &&
  card.statut_effectif === "non_validee";
function CardStatus({ card }: { card: AffiliationCard }) {
  const state = card.statut_effectif;
  const tone =
    state === "active"
      ? "success"
      : ["expiree", "suspendue", "annulee"].includes(state)
        ? "danger"
        : ["inactive", "a_reexaminer", "programmee"].includes(state)
          ? "warning"
          : "neutral";
  const Icon =
    state === "active"
      ? CheckCircle2
      : state === "expiree"
        ? XCircle
        : tone === "warning"
          ? Clock3
          : MinusCircle;
  return (
    <Badge tone={tone} icon={Icon}>
      {AFFILIATION_STATUS_LABELS[state]}
    </Badge>
  );
}

export default function AffiliationsCartes({
  expirationsOnly = false,
  validationOnly = false,
}: {
  expirationsOnly?: boolean;
  validationOnly?: boolean;
}) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const artisanId = params.get("artisan") || "";
  const selectedCardId = params.get("carte") || undefined;
  const requestedTab = params.get("onglet");
  const [cards, setCards] = useState<AffiliationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<RegistryTab>(
    expirationsOnly ? "expirations" : "cartes",
  );
  const [documentaryOnly, setDocumentaryOnly] = useState(validationOnly);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [site, setSite] = useState("");
  const [role, setRole] = useState("");
  const [identityOnly, setIdentityOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [copyStatus, setCopyStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [newOpen, setNewOpen] = useState(false);
  const requestId = useRef(0);
  const settings = hasSensitiveCapability(
    user,
    CAPABILITIES.PLATFORM_SETTINGS_MANAGE,
  );
  const membership = hasSensitiveCapability(
    user,
    CAPABILITIES.ARTISAN_MEMBERSHIP_MANAGE,
  );
  const manage =
    membership ||
    hasSensitiveCapability(user, CAPABILITIES.ARTISAN_CARDS_MANAGE);
  const tariffsVisible = settings || membership;
  const load = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    try {
      const next = await affiliationService.list();
      if (request !== requestId.current) return;
      setCards(next);
      setLoaded(true);
      setError("");
    } catch (reason) {
      if (request === requestId.current)
        setError(
          messageErreurUtilisateur(
            reason,
            "Le suivi des affiliations est indisponible.",
          ),
        );
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (artisanId) return;
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
    };
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      requestId.current++;
      window.clearInterval(timer);
    };
  }, [load, artisanId]);
  useEffect(() => {
    setTab(expirationsOnly ? "expirations" : "cartes");
    setDocumentaryOnly(validationOnly);
  }, [expirationsOnly, validationOnly]);
  useEffect(() => {
    if (requestedTab === "baremes") setTab(tariffsVisible ? "baremes" : "cartes");
    if (
      requestedTab === "cartes" ||
      requestedTab === "activations" ||
      requestedTab === "expirations"
    )
      setTab(requestedTab);
    if (requestedTab) setDocumentaryOnly(false);
  }, [requestedTab, tariffsVisible]);
  const current = useMemo(() => {
    const latest = new Map<string, AffiliationCard>();
    for (const card of cards) {
      const previous = latest.get(card.artisan_id);
      if (
        !previous ||
        card.version > previous.version ||
        (card.version === previous.version &&
          card.created_at > previous.created_at)
      )
        latest.set(card.artisan_id, card);
    }
    return [...latest.values()];
  }, [cards]);
  const sites = useMemo(
    () =>
      [
        ...new Set(
          current
            .map((card) => card.site_name || card.snapshot?.site_nom)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort((a, b) => a.localeCompare(b, "fr")),
    [current],
  );
  const expiryCards = useMemo(() => {
    const currentIds = new Set(current.map((card) => card.id));
    const due = new Map<string, AffiliationCard>();
    for (const card of cards) {
      if (!(
        (card.statut_effectif === "active" && card.expires_soon) ||
        (card.statut_effectif === "expiree" && currentIds.has(card.id))
      ))
        continue;
      const previous = due.get(card.artisan_id);
      if (!previous || card.version > previous.version)
        due.set(card.artisan_id, card);
    }
    return [...due.values()];
  }, [cards, current]);
  const counts = useMemo(
    () => ({
      active: new Set(
        cards
          .filter((c) => c.statut_effectif === "active")
          .map((c) => c.artisan_id),
      ).size,
      inactive: current.filter((c) => c.statut_effectif === "inactive").length,
      expiring: expiryCards.filter((c) => c.statut_effectif === "active")
        .length,
      expired: current.filter((c) => c.statut_effectif === "expiree").length,
      identity: current.filter(needsIdentityReview).length,
    }),
    [cards, current, expiryCards],
  );
  const filtered = useMemo(
    () =>
      (tab === "expirations" ? expiryCards : current).filter(
        (card) =>
          (!status || card.statut_effectif === status) &&
          (!documentaryOnly || card.statut === "en_cours") &&
          (tab !== "activations" || card.statut_effectif === "inactive") &&
          (tab !== "expirations" ||
            card.statut_effectif === "expiree" ||
            card.expires_soon) &&
          (!identityOnly || needsIdentityReview(card)) &&
          (!site || (card.site_name || card.snapshot?.site_nom) === site) &&
          (!role || (card.artisan_role || card.snapshot?.role) === role) &&
          [
            card.numero_affiliation,
            holderName(card),
            card.snapshot?.societe,
            card.site_name || card.snapshot?.site_nom,
            card.artisan_role || card.snapshot?.role,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("fr")
            .includes(search.trim().toLocaleLowerCase("fr")),
      ),
    [
      current,
      expiryCards,
      search,
      status,
      tab,
      site,
      role,
      identityOnly,
      documentaryOnly,
    ],
  );
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
    setCopyStatus("");
  }, [
    search,
    status,
    tab,
    site,
    role,
    identityOnly,
    documentaryOnly,
    pageSize,
  ]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const selectedCards = filtered.filter((card) => selected.has(card.id));
  const openDossier = (id: string, cardId?: string) => {
    setNewOpen(false);
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("artisan", id);
      if (cardId) next.set("carte", cardId);
      else next.delete("carte");
      return next;
    });
  };
  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setSite("");
    setRole("");
    setIdentityOnly(false);
    setDocumentaryOnly(false);
  };
  const applyTask = (task: "identity" | "inactive" | "expired") => {
    resetFilters();
    setTab(
      task === "inactive"
        ? "activations"
        : task === "expired"
          ? "expirations"
          : "cartes",
    );
    setIdentityOnly(task === "identity");
    if (task === "expired") setStatus("expiree");
  };
  const switchTab = (next: RegistryTab) => {
    setTab(next);
    setStatus("");
    setIdentityOnly(false);
    setDocumentaryOnly(false);
    setParams(
      (previous) => {
        const updated = new URLSearchParams(previous);
        updated.set("onglet", next);
        return updated;
      },
      { replace: true },
    );
  };
  const selectedState = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const hasFilter = Boolean(
    search || status || site || role || identityOnly || documentaryOnly,
  );
  if (artisanId)
    return (
      <NationalDashboardLayout>
        <div className="sn-page affiliation-registry">
          <AffiliationDossier
            key={artisanId}
            artisanId={artisanId}
            initialCardId={selectedCardId}
            standalone
            onBack={() =>
              setParams((previous) => {
                const next = new URLSearchParams(previous);
                next.delete("artisan");
                next.delete("carte");
                return next;
              })
            }
            onCardChange={(id) =>
              setParams(
                (previous) => {
                  const next = new URLSearchParams(previous);
                  if (id) next.set("carte", id);
                  else next.delete("carte");
                  return next;
                },
                { replace: true },
              )
            }
          />
        </div>
      </NationalDashboardLayout>
    );
  const statValue = (value: number) =>
    loaded ? value.toLocaleString("fr-FR") : "—";
  return (
    <NationalDashboardLayout>
      <div className="sn-page affiliation-registry">
        <PageHeader
          icon={CreditCard}
          title="Affiliations & Cartes"
          subtitle="Émission, activation, droits d’adhésion et validité des cartes Faso SANAMA."
          breadcrumb={[
            { label: "Artisans miniers", to: "/artisan-minier/liste" },
            { label: "Affiliations & Cartes" },
          ]}
          actions={
            <>
              <button
                className="sn-btn sn-btn--secondary"
                disabled={loading}
                onClick={() => void load()}
              >
                <RefreshCw size={17} className={loading ? "sn-spin" : ""} />
                Actualiser
              </button>
              {manage && (
                <button
                  className="sn-btn sn-btn--primary"
                  onClick={() => setNewOpen(true)}
                >
                  <Plus size={19} />
                  Nouvelle affiliation
                </button>
              )}
            </>
          }
        />
        <div
          className="affiliation-registry__stats"
          aria-label="Indicateurs des affiliations"
          aria-busy={loading}
        >
          {[
            {
              label: "Affiliations suivies",
              value: current.length,
              Icon: Users,
              tone: "navy",
            },
            {
              label: "Cartes actives",
              value: counts.active,
              Icon: CreditCard,
              tone: "green",
            },
            {
              label: "Activation en attente",
              value: counts.inactive,
              Icon: Clock3,
              tone: "gold",
            },
            {
              label: "Échéances à surveiller",
              value: counts.expiring,
              Icon: CalendarClock,
              tone: "gold",
            },
          ].map(({ label, value, Icon, tone }) => (
            <div
              className={`affiliation-registry__stat affiliation-registry__stat--${tone}`}
              key={label}
            >
              <Icon size={29} aria-hidden="true" />
              <div>
                <span>{label}</span>
                <strong>{statValue(value)}</strong>
              </div>
            </div>
          ))}
        </div>
        {error && (
          <div role="alert" className="affiliation-registry__error">
            <ShieldAlert size={19} />
            <span>
              {error}
              {loaded && " Les dernières données chargées restent affichées."}
            </span>
            <button
              className="sn-btn"
              disabled={loading}
              onClick={() => void load()}
            >
              Réessayer
            </button>
          </div>
        )}
        <div className="affiliation-registry__navigation">
          <div role="tablist" aria-label="Gestion des affiliations">
            {(
              [
                { value: "cartes", label: "Registre des cartes" },
                ...(tariffsVisible
                  ? [{ value: "baremes", label: "Barèmes d’adhésion" }]
                  : []),
                { value: "activations", label: "Activations" },
                { value: "expirations", label: "Expirations" },
              ] as { value: RegistryTab; label: string }[]
            ).map((item) => (
              <button
                key={item.value}
                role="tab"
                id={`affiliation-tab-${item.value}`}
                aria-selected={tab === item.value}
                aria-controls="affiliation-registry-panel"
                tabIndex={tab === item.value ? 0 : -1}
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const tabs = [
                    ...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                      '[role="tab"]',
                    ) || []),
                  ];
                  const index = tabs.indexOf(event.currentTarget);
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : (index +
                            (event.key === "ArrowRight" ? 1 : -1) +
                            tabs.length) %
                          tabs.length;
                  tabs[next]?.focus();
                  tabs[next]?.click();
                }}
                onClick={() => switchTab(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Link to="/artisan-minier/liste">
            <Users size={17} />
            Voir la liste des artisans
            <ArrowRight size={16} />
          </Link>
        </div>
        <div
          id="affiliation-registry-panel"
          role="tabpanel"
          aria-labelledby={`affiliation-tab-${tab}`}
        >
          {tab === "baremes" && tariffsVisible ? (
            <TariffsPanel canEdit={settings} />
          ) : (
            <div className="affiliation-registry__layout">
              <section
                className="affiliation-registry__register"
                aria-labelledby="affiliation-register-title"
              >
                <header className="affiliation-registry__section-head">
                  <span className="affiliation-registry__section-icon">
                    <CreditCard size={23} />
                  </span>
                  <div>
                    <h2 id="affiliation-register-title">
                      {documentaryOnly
                        ? "Cartes à valider"
                        : tab === "activations"
                          ? "Cartes en attente d’activation"
                          : tab === "expirations"
                            ? "Échéances des affiliations"
                            : "Registre des affiliations et cartes"}
                    </h2>
                    <p>
                      Suivi du dossier, du paiement, de l’activation et de
                      l’échéance.
                    </p>
                  </div>
                  <strong className="affiliation-registry__count">
                    {loaded
                      ? `${filtered.length} dossier${filtered.length > 1 ? "s" : ""}`
                      : "—"}
                  </strong>
                </header>
                <div className="affiliation-registry__register-body">
                  <div className="affiliation-registry__filters">
                    <label className="affiliation-registry__search">
                      <Search size={18} />
                      <input
                        type="search"
                        aria-label="Rechercher une affiliation"
                        placeholder="Rechercher une affiliation, un titulaire ou un site"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Statut de la carte"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="">Tous les états</option>
                      {Object.entries(AFFILIATION_STATUS_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                    <button
                      className="sn-btn sn-btn--secondary"
                      aria-expanded={filtersOpen}
                      aria-controls="affiliation-extra-filters"
                      onClick={() => setFiltersOpen((value) => !value)}
                    >
                      <Filter size={18} />
                      Filtres
                      {(site || role || identityOnly) && (
                        <span className="affiliation-registry__filter-dot" />
                      )}
                    </button>
                  </div>
                  {filtersOpen && (
                    <div
                      id="affiliation-extra-filters"
                      className="affiliation-registry__extra-filters"
                    >
                      <label>
                        Site de rattachement
                        <select
                          value={site}
                          onChange={(e) => setSite(e.target.value)}
                        >
                          <option value="">Tous les sites</option>
                          {sites.map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Rôle du titulaire
                        <select
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                        >
                          <option value="">Tous les rôles</option>
                          {Object.entries(roleLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="affiliation-registry__check">
                        <input
                          type="checkbox"
                          checked={identityOnly}
                          onChange={(e) => setIdentityOnly(e.target.checked)}
                        />
                        Identité à contrôler
                      </label>
                    </div>
                  )}
                  {hasFilter && (
                    <div className="affiliation-registry__filter-summary">
                      <span>
                        {filtered.length} résultat
                        {filtered.length > 1 ? "s" : ""}
                        {identityOnly && " · Identité à contrôler"}
                        {documentaryOnly &&
                          " · Contrôle documentaire en attente"}
                      </span>
                      <button onClick={resetFilters}>
                        Réinitialiser les filtres
                      </button>
                    </div>
                  )}
                  {selectedCards.length > 0 && (
                    <div className="affiliation-registry__selection">
                      <strong>
                        {selectedCards.length} dossier
                        {selectedCards.length > 1 ? "s" : ""} sélectionné
                        {selectedCards.length > 1 ? "s" : ""}
                      </strong>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              selectedCards
                                .map((card) => card.numero_affiliation)
                                .join("\n"),
                            );
                            setCopyStatus("Références copiées.");
                          } catch {
                            setCopyStatus(
                              "La copie n’est pas disponible dans ce navigateur.",
                            );
                          }
                        }}
                      >
                        <Copy size={15} />
                        Copier les références
                      </button>
                      <button
                        onClick={() => {
                          setSelected(new Set());
                          setCopyStatus("");
                        }}
                      >
                        Désélectionner
                      </button>
                    </div>
                  )}
                  {copyStatus && (
                    <p
                      className="affiliation-registry__copy-status"
                      role="status"
                    >
                      {copyStatus}
                    </p>
                  )}
                  {loading && !loaded ? (
                    <div className="affiliation-registry__empty" role="status">
                      <Loader2 className="sn-spin" />
                      Chargement des affiliations…
                    </div>
                  ) : !loaded && error ? (
                    <div className="affiliation-registry__empty">
                      Le registre n’a pas pu être chargé.
                    </div>
                  ) : current.length === 0 ? (
                    <EmptyState
                      title="Aucune affiliation disponible"
                      description="Ouvrez un dossier existant pour enregistrer ses droits d’adhésion."
                    />
                  ) : (
                    <div
                      className="affiliation-registry__table-scroll"
                      tabIndex={0}
                      role="region"
                      aria-label="Registre des affiliations, défilement horizontal si nécessaire"
                    >
                      <table className="affiliation-registry__table">
                        <caption className="sr-only">
                          Registre des affiliations et cartes, dernière émission
                          de chaque titulaire
                        </caption>
                        <thead>
                          <tr>
                            <th
                              scope="col"
                              className="affiliation-registry__checkbox"
                            >
                              <input
                                type="checkbox"
                                aria-label="Sélectionner les dossiers de cette page"
                                checked={
                                  rows.length > 0 &&
                                  rows.every((card) => selected.has(card.id))
                                }
                                onChange={(e) =>
                                  setSelected((previous) => {
                                    const next = new Set(previous);
                                    rows.forEach((card) =>
                                      e.target.checked
                                        ? next.add(card.id)
                                        : next.delete(card.id),
                                    );
                                    return next;
                                  })
                                }
                              />
                            </th>
                            <th scope="col">Affiliation</th>
                            <th scope="col">Titulaire</th>
                            <th scope="col">Site de rattachement</th>
                            <th scope="col">Droit d’adhésion</th>
                            <th scope="col">Statut de la carte</th>
                            <th scope="col">Échéance</th>
                            <th scope="col">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((card) => (
                            <tr
                              key={card.id}
                              data-selected={selected.has(card.id) || undefined}
                            >
                              <td className="affiliation-registry__checkbox">
                                <input
                                  type="checkbox"
                                  aria-label={`Sélectionner ${card.numero_affiliation}`}
                                  checked={selected.has(card.id)}
                                  onChange={() => selectedState(card.id)}
                                />
                              </td>
                              <td>
                                <button
                                  className="affiliation-registry__reference"
                                  onClick={() =>
                                    openDossier(card.artisan_id, card.id)
                                  }
                                >
                                  {card.numero_affiliation}
                                </button>
                                <span className="affiliation-registry__muted">
                                  Émission {card.version}
                                </span>
                              </td>
                              <td>
                                <strong>{holderName(card)}</strong>
                                {(!card.snapshot || card.snapshot?.societe) && (
                                  <span className="affiliation-registry__muted">
                                    {card.snapshot?.societe ||
                                      "Identité à contrôler"}
                                  </span>
                                )}
                              </td>
                              <td>
                                {card.site_name ||
                                  card.snapshot?.site_nom ||
                                  (card.snapshot
                                    ? "Non rattaché"
                                    : "À vérifier")}
                              </td>
                              <td>
                                <DuesStatus card={card} />
                              </td>
                              <td>
                                <CardStatus card={card} />
                              </td>
                              <td>
                                <span>
                                  {card.valid_until
                                    ? affiliationDate(card.valid_until)
                                    : card.statut_effectif === "non_validee"
                                      ? "Non définie"
                                      : "Après activation"}
                                </span>
                                {card.statut_effectif === "active" && (
                                  <span className="affiliation-registry__muted">
                                    {affiliationCountdown(card)}
                                  </span>
                                )}
                              </td>
                              <td>
                                <div className="affiliation-registry__row-actions">
                                  <button
                                    onClick={() =>
                                      openDossier(card.artisan_id, card.id)
                                    }
                                  >
                                    Consulter
                                  </button>
                                  <details>
                                    <summary
                                      aria-label={`Actions pour ${card.numero_affiliation}`}
                                    >
                                      <MoreVertical size={18} />
                                    </summary>
                                    <div>
                                      <button
                                        onClick={() =>
                                          openDossier(card.artisan_id, card.id)
                                        }
                                      >
                                        Ouvrir le dossier
                                      </button>
                                      <Link
                                        to={`/artisan-minier/${encodeURIComponent(card.artisan_id)}`}
                                      >
                                        Voir le titulaire
                                      </Link>
                                    </div>
                                  </details>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {rows.length === 0 && (
                            <tr>
                              <td colSpan={8}>
                                <div className="affiliation-registry__empty">
                                  <Search size={25} />
                                  <strong>
                                    Aucun dossier ne correspond à ces filtres.
                                  </strong>
                                  <button
                                    className="sn-btn"
                                    onClick={resetFilters}
                                  >
                                    Réinitialiser les filtres
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {loaded && current.length > 0 && (
                    <div className="affiliation-registry__pagination">
                      <label>
                        Afficher
                        <select
                          aria-label="Nombre de dossiers par page"
                          value={pageSize}
                          onChange={(e) => setPageSize(Number(e.target.value))}
                        >
                          <option value="10">10 dossiers</option>
                          <option value="25">25 dossiers</option>
                          <option value="50">50 dossiers</option>
                        </select>
                      </label>
                      <span>
                        {filtered.length ? (currentPage - 1) * pageSize + 1 : 0}
                        –{Math.min(currentPage * pageSize, filtered.length)} sur{" "}
                        {filtered.length}
                      </span>
                      <div>
                        <button
                          className="sn-btn"
                          aria-label="Page précédente"
                          disabled={currentPage === 1}
                          onClick={() => setPage(currentPage - 1)}
                        >
                          <ChevronLeft size={17} />
                        </button>
                        <span>
                          {currentPage} / {pages}
                        </span>
                        <button
                          className="sn-btn"
                          aria-label="Page suivante"
                          disabled={currentPage >= pages}
                          onClick={() => setPage(currentPage + 1)}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
              <aside
                className="affiliation-registry__tasks"
                aria-labelledby="affiliation-tasks-title"
              >
                <header className="affiliation-registry__section-head">
                  <span className="affiliation-registry__section-icon">
                    <ListChecks size={22} />
                  </span>
                  <h2 id="affiliation-tasks-title">À traiter</h2>
                </header>
                <div className="affiliation-registry__tasks-body">
                  {[
                    {
                      key: "identity",
                      count: counts.identity,
                      label:
                        counts.identity > 1
                          ? "identités à contrôler"
                          : "identité à contrôler",
                      Icon: Users,
                      tone: "navy",
                    },
                    {
                      key: "inactive",
                      count: counts.inactive,
                      label: "activation en attente",
                      Icon: Clock3,
                      tone: "gold",
                    },
                    {
                      key: "expired",
                      count: counts.expired,
                      label:
                        counts.expired > 1
                          ? "cartes expirées"
                          : "carte expirée",
                      Icon: CalendarX2,
                      tone: "red",
                    },
                  ].map(({ key, count, label, Icon, tone }) => (
                    <button
                      key={key}
                      className={`affiliation-registry__task affiliation-registry__task--${tone}`}
                      aria-label={`${statValue(count)} ${label}`}
                      disabled={!loaded}
                      onClick={() =>
                        applyTask(key as "identity" | "inactive" | "expired")
                      }
                    >
                      <Icon size={23} />
                      <span>
                        <strong>{statValue(count)}</strong>
                        <span>{label}</span>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                  <div className="affiliation-registry__tip">
                    <Lightbulb size={23} />
                    <p>
                      Pensez à régulariser les dossiers en attente pour éviter
                      les interruptions de service.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
        {newOpen && (
          <NewAffiliationDialog
            onClose={() => setNewOpen(false)}
            onSelect={(id) =>
              openDossier(
                id,
                current.find((card) => card.artisan_id === id)?.id,
              )
            }
          />
        )}
      </div>
    </NationalDashboardLayout>
  );
}

function DuesStatus({ card }: { card: AffiliationCard }) {
  // Payment state is supplied by the server; a validated card does not prove payment.
  const summary = card;
  const labels: Record<string, string> = {
    non_renseigne: "Non renseigné",
    en_attente: "En attente",
    partiel: "Paiement partiel",
    paye: "Payé",
    annule: "Annulé",
    a_payer: "À payer",
  };
  if (!summary.adhesion_status)
    return <span className="affiliation-registry__muted">À consulter</span>;
  const label =
    summary.adhesion_status === "en_attente" && summary.adhesion_pending != null
      ? summary.adhesion_pending > 0
        ? "À confirmer"
        : "À payer"
      : labels[summary.adhesion_status] || "À consulter";
  return (
    <span
      className={
        summary.adhesion_status === "paye"
          ? "affiliation-registry__dues-paid"
          : "affiliation-registry__muted"
      }
    >
      {summary.adhesion_status === "paye" && <BadgeCheck size={14} />} {label}
    </span>
  );
}

function NewAffiliationDialog({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [artisans, setArtisans] = useState<
    NonNullable<Awaited<ReturnType<typeof artisanMinierService.getAll>>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    artisanMinierService
      .getAll()
      .then((data) => {
        if (!cancelled)
          setArtisans(
            (data || []).filter((artisan) => artisan.actif !== false),
          );
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            messageErreurUtilisateur(
              reason,
              "La liste des titulaires n’a pas pu être chargée.",
            ),
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  const filtered = artisans.filter((artisan) =>
    [
      artisan.nom,
      artisan.prenoms,
      artisan.raison_sociale,
      artisan.numero_carte,
      artisan.telephone,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("fr")
      .includes(search.trim().toLocaleLowerCase("fr")),
  );
  return (
    <Modal isOpen onClose={onClose} title="Nouvelle affiliation" size="lg">
      <ModalBody className="affiliation-registry__new">
        <p>
          Sélectionnez un titulaire pour enregistrer ses droits d’adhésion. La
          carte sera générée après confirmation du paiement.
        </p>
        <label className="affiliation-registry__search">
          <Search size={18} />
          <input
            type="search"
            aria-label="Rechercher un titulaire"
            placeholder="Nom, société, téléphone ou référence"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {loading ? (
          <p role="status">Chargement des titulaires…</p>
        ) : error ? (
          <div role="alert">
            <p>{error}</p>
            <button
              className="sn-btn"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Réessayer
            </button>
          </div>
        ) : (
          <div className="affiliation-registry__new-list">
            {filtered.map((artisan) => (
              <button key={artisan.id} onClick={() => onSelect(artisan.id)}>
                <span className="affiliation-registry__section-icon">
                  <Users size={19} />
                </span>
                <span>
                  <strong>
                    {artisan.type_personne === "morale"
                      ? artisan.raison_sociale
                      : [artisan.prenoms, artisan.nom]
                          .filter(Boolean)
                          .join(" ") || "Identité à compléter"}
                  </strong>
                  <span>
                    {roleLabels[artisan.type_artisan] || "Artisan minier"} ·{" "}
                    {artisan.telephone}
                  </span>
                </span>
                <ArrowRight size={17} />
              </button>
            ))}
            {filtered.length === 0 && (
              <EmptyState
                title="Aucun titulaire trouvé"
                description="Vérifiez la recherche ou enregistrez d’abord le dossier du titulaire."
              />
            )}
          </div>
        )}
        <Link to="/artisan-minier/liste" onClick={onClose}>
          Consulter la liste des artisans
          <ArrowRight size={15} />
        </Link>
      </ModalBody>
    </Modal>
  );
}
function TariffsPanel({ canEdit }: { canEdit: boolean }) {
  const [tariffs, setTariffs] = useState<AdhesionBareme[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    affiliationService
      .tariffs()
      .then(setTariffs)
      .catch(() => setError("Les barèmes n’ont pas pu être chargés."));
  }, []);
  return (
    <Section
      id="baremes-adhesion"
      icon={Settings2}
      title="Barèmes des droits d’adhésion"
      description="Chaque échéance conserve le montant et la durée du barème appliqué."
    >
      {error && (
        <p className="affiliation-error" role="alert">
          {error}
        </p>
      )}
      {tariffs.map((t) => (
        <div className="affiliation-receipt" key={t.id}>
          <strong>
            {t.libelle} · {t.role_artisan}
          </strong>
          <span>
            {t.montant} {t.devise} · {t.duree_jours} jours · {t.fuseau}
          </span>
        </div>
      ))}
      {canEdit && (
        <details>
          <summary className="sn-btn">Ajouter un barème</summary>
          <form
            className="affiliation-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const form = e.currentTarget;
              const data = new FormData(form);
              setBusy(true);
              setError("");
              try {
                await affiliationService.configureTariff({
                  p_id: key,
                  p_libelle: String(data.get("label")),
                  p_role: String(data.get("role")),
                  p_montant: Number(data.get("amount")),
                  p_devise: String(data.get("currency")).toUpperCase(),
                  p_duree: Number(data.get("duration")),
                  p_fuseau: String(data.get("timezone")),
                  p_alerte: Number(data.get("alert")),
                });
                setTariffs(await affiliationService.tariffs());
                setKey(crypto.randomUUID());
                form.reset();
              } catch (reason) {
                setError(messageErreurUtilisateur(reason));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Libellé
              <input
                name="label"
                required
                minLength={3}
                maxLength={120}
                disabled={busy}
              />
            </label>
            <label>
              Rôle concerné
              <select name="role" required disabled={busy}>
                <option value="">Sélectionner</option>
                <option value="exploitant">Exploitant</option>
                <option value="fournisseur">Fournisseur</option>
                <option value="aide_exploitant">Aide exploitant</option>
                <option value="intermediaire">Intermédiaire</option>
                <option value="collecteur">
                  Collecteur (dossiers existants)
                </option>
              </select>
            </label>
            <div className="affiliation-form__pair">
              <label>
                Montant
                <input
                  name="amount"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  disabled={busy}
                />
              </label>
              <label>
                Devise (code ISO)
                <input
                  name="currency"
                  placeholder="Ex. XOF"
                  pattern="[A-Za-z]{3}"
                  required
                  maxLength={3}
                  disabled={busy}
                />
              </label>
            </div>
            <div className="affiliation-form__pair">
              <label>
                Durée en jours
                <input
                  name="duration"
                  type="number"
                  required
                  min={1}
                  max={3660}
                  disabled={busy}
                />
              </label>
              <label>
                Alerte avant échéance (jours)
                <input
                  name="alert"
                  type="number"
                  required
                  min={0}
                  max={365}
                  disabled={busy}
                />
              </label>
            </div>
            <label>
              Fuseau de validité
              <input
                name="timezone"
                required
                placeholder="Ex. Africa/Ouagadougou"
                disabled={busy}
              />
            </label>
            <p className="affiliation-help">
              Le montant et la durée sont des paramètres métier explicites. La
              fin de période comprend le dernier jour indiqué.
            </p>
            <button className="sn-btn sn-btn--primary" disabled={busy}>
              Enregistrer ce barème
            </button>
          </form>
        </details>
      )}
    </Section>
  );
}
