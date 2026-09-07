import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  HelpCircle,
  CreditCard,
  History,
  Info,
  Loader2,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { CAPABILITIES, hasSensitiveCapability } from "@/lib/capabilities";
import {
  AFFILIATION_STATUS_LABELS,
  affiliationDate,
  type AffiliationCard,
} from "@/lib/affiliationCard";
import { messageErreurUtilisateur } from "@/lib/presentError";
import { affiliationService } from "@/services/affiliationService";
import {
  carteProfessionnelleService,
  type CarteProfessionnelleStatut,
} from "@/services/carteProfessionnelleService";
import type {
  AdhesionBareme,
  AdhesionDroit,
  AdhesionEncaissement,
  AffiliationEvent,
} from "@/types/affiliations";
import { AffiliationDigitalCard } from "./AffiliationDigitalCard";
import { AffiliationPaymentPanel } from "./AffiliationPaymentPanel";
import "./affiliation-detail.css";

const EVENTS: Record<string, string> = {
  "render-requested": "Génération demandée",
  "dues-cancelled": "Échéance annulée",
  prepared: "Identité préparée pour cette émission",
  rendered: "Fichiers de la carte générés",
  activated: "Activation manuelle confirmée",
  reissued: "Nouvelle émission créée",
  "status-changed": "Contrôle de la carte",
  "dues-established": "Période d’adhésion établie",
  "payment-recorded": "Paiement enregistré, à contrôler",
  "payment-confirme": "Paiement confirmé",
  "payment-annule": "Paiement annulé",
  "payment-rembourse": "Paiement remboursé",
  "correction-requested": "Correction demandée",
  "correction-created": "Nouvelle version à contrôler",
  replaced: "Titre remplacé après contrôle",
  expired: "Expiration de la carte",
};

type AffiliationDossierProps = {
  artisanId: string;
  initialCardId?: string;
  standalone?: boolean;
  onBack?: () => void;
  onCardChange?: (id: string) => void;
};

export function AffiliationDossier(props: AffiliationDossierProps) {
  const { user } = useAuth();
  const contextKey = JSON.stringify([
    props.artisanId, props.initialCardId, user?.id, user?.organization_id,
    user?.mining_company_id, user?.access_role_id, user?.role,
    user && 'account_type' in user ? user.account_type : undefined,
    user?.organization_type, user?.is_active,
    [...(user?.capabilities || [])].sort(),
    [...(user?.module_codes || [])].sort(), [...(user?.site_ids || [])].sort(),
    [...(user?.responsibilities || [])].sort(), [...(user?.module_domains || [])].sort(),
    user?.access_portal_id, user?.access_portal_code, user?.actor_category_code,
  ]);
  return <AffiliationDossierContent key={contextKey} {...props} />;
}

function AffiliationDossierContent({
  artisanId,
  initialCardId,
  standalone = false,
  onBack,
  onCardChange,
}: AffiliationDossierProps) {
  const { user } = useAuth();
  const manage = hasSensitiveCapability(
    user,
    CAPABILITIES.ARTISAN_CARDS_MANAGE,
  );
  const duesManage = hasSensitiveCapability(
    user,
    CAPABILITIES.ARTISAN_MEMBERSHIP_MANAGE,
  );
  const confirm = hasSensitiveCapability(
    user,
    CAPABILITIES.ARTISAN_MEMBERSHIP_CONFIRM,
  );
  const activate = hasSensitiveCapability(
    user,
    CAPABILITIES.ARTISAN_CARDS_ACTIVATE,
  );
  const canFinance = duesManage || confirm || activate;
  const [cards, setCards] = useState<AffiliationCard[]>([]);
  const [selected, setSelected] = useState(initialCardId || "");
  const [tariffs, setTariffs] = useState<AdhesionBareme[]>([]);
  const [dues, setDues] = useState<AdhesionDroit | null>(null);
  const [receipts, setReceipts] = useState<AdhesionEncaissement[]>([]);
  const [events, setEvents] = useState<AffiliationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cardsReadError, setCardsReadError] = useState(false);
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState("controle");
  const [checks, setChecks] = useState<string[]>([]);
  const [activationConfirmed, setActivationConfirmed] = useState(false);
  const mutationLock = useRef(false);
  const generation = useRef(0);
  const detailGeneration = useRef(0);
  const lifecycle = useRef(0);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const card = cards.find((c) => c.id === selected) || cards[0];
  const activeCard = useRef<string>();
  activeCard.current = card?.id;
  const load = useCallback(async () => {
    const request = ++generation.current;
    try {
      const next = await affiliationService.list(artisanId);
      if (request === generation.current) {
        setCards(next);
        setError("");
        setCardsReadError(false);
      }
      return next;
    } catch (reason) {
      if (request === generation.current) {
        setCardsReadError(true);
        setError(
          messageErreurUtilisateur(
            reason,
            "Impossible de lire le statut des cartes.",
          ),
        );
      }
      return null;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [artisanId]);
  useEffect(() => {
    selectedRef.current = initialCardId || "";
    setSelected(initialCardId || "");
  }, [initialCardId]);
  useEffect(() => () => { lifecycle.current++; }, []);
  useEffect(() => {
    void load();
    const refresh = () => {
      if (!mutationLock.current && !document.hidden) void load();
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      generation.current++;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  const loadDetails = useCallback(async (target = card) => {
    if (!target) return false;
    const request = ++detailGeneration.current;
    setDetailsLoading(true);
    try {
      const [history, finance, prices] = await Promise.all([
        affiliationService.history(target.id),
        canFinance
          ? affiliationService.dues(target.dues_card_id || target.id)
          : Promise.resolve({ droit: null, encaissements: [] }),
        duesManage ? affiliationService.tariffs() : Promise.resolve([]),
      ]);
      if (
        request !== detailGeneration.current ||
        (!mutationLock.current && activeCard.current !== target.id)
      )
        return false;
      setEvents(history);
      setDues(finance.droit);
      setReceipts(finance.encaissements);
      setTariffs(prices);
      setDetailsError("");
      return true;
    } catch (reason) {
      if (request === detailGeneration.current)
        setDetailsError(
          messageErreurUtilisateur(
            reason,
            "Les droits d’adhésion n’ont pas pu être chargés.",
          ),
        );
      return false;
    } finally {
      if (request === detailGeneration.current) setDetailsLoading(false);
    }
  }, [card?.id, card?.dues_card_id, canFinance, duesManage]);
  useEffect(() => {
    // A manual operation refreshes its returned card and relations together.
    if (mutationLock.current) return;
    setDues(null);
    setReceipts([]);
    setEvents([]);
    setChecks([]);
    setActivationConfirmed(false);
    setDetailsLoading(true);
    void loadDetails();
    return () => {
      detailGeneration.current++;
    };
  }, [loadDetails]);
  const refreshDossier = async () => {
    const next = await load();
    if (!next) return false;
    const current = next.find((item) => item.id === selectedRef.current) || next[0];
    return loadDetails(current);
  };
  const run = async (action: (() => Promise<unknown>) | null, message: string) => {
    if (mutationLock.current) return;
    const context = lifecycle.current;
    mutationLock.current = true;
    detailGeneration.current++;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (action) await action();
      if (context !== lifecycle.current) return false;
      const refreshed = await refreshDossier();
      if (context !== lifecycle.current) return false;
      if (refreshed) setSuccess(message);
      else if (action) setError(
        "L’opération est enregistrée, mais les informations à jour n’ont pas pu être relues. Utilisez « Actualiser » pour vérifier le dossier sans répéter l’opération.",
      );
      setActivationConfirmed(false);
      // A confirmed write must not be submitted again just because reading failed.
      return Boolean(action) || refreshed;
    } catch (reason) {
      if (context !== lifecycle.current) return false;
      await refreshDossier();
      if (context !== lifecycle.current) return false;
      setError(messageErreurUtilisateur(reason));
      return false;
    } finally {
      mutationLock.current = false;
      if (context === lifecycle.current) setBusy(false);
    }
  };
  if (loading)
    return (
      <p className="sn-empty">
        <Loader2 className="sn-spin" />
        Chargement de l’affiliation…
      </p>
    );
  if (!card)
    return (
      <section className="affiliation-panel">
        <h2>{error ? "Affiliation indisponible" : "Aucun dossier d’affiliation disponible"}</h2>
        {!error && <p>Enregistrez d’abord le dossier de l’artisan.</p>}
        {error && (
          <p role="alert" className="affiliation-error">
            {error}
          </p>
        )}
        <button className="sn-btn" onClick={() => void load()}>
          Réessayer
        </button>
      </section>
    );
  const paid = receipts
    .filter((r) => r.statut === "confirme")
    .reduce((n, r) => n + Number(r.montant), 0);
  const settled = dues?.statut === "ouvert" && paid >= Number(dues.montant);
  const unverified = cardsReadError || detailsLoading || Boolean(detailsError);
  const fullyPaid = !unverified && (canFinance ? settled : card.adhesion_status === "paye");
  const eligible =
    !unverified && card.statut === "validee" &&
    !!card.validated_at &&
    settled &&
    !card.replaced_by &&
    card.statut_effectif !== "active";
  const name =
    card.holder_name ||
    [card.snapshot?.nom, card.snapshot?.prenoms].filter(Boolean).join(" ") ||
    "Titulaire à renseigner";
  const canRender = (manage || activate) && fullyPaid;
  const renderCard = async () => {
    if (!card.snapshot) await affiliationService.prepare(card.id);
    await affiliationService.render(card.id);
  };
  const confirmPayment = (receiptId: string) =>
    void run(async () => {
      await affiliationService.reviewReceipt(receiptId, "confirme");
      const latest = await affiliationService.list(artisanId);
      const refreshed = latest.find((c) => c.id === card.id);
      if (
        refreshed?.adhesion_status === "paye" &&
        (manage || activate) &&
        refreshed.render_status !== "ready"
      ) {
        try {
          if (!refreshed.snapshot) await affiliationService.prepare(card.id);
          await affiliationService.render(card.id);
        } catch {
          throw new Error(
            "Le paiement est confirmé. La génération n’a pas abouti ; utilisez « Générer les deux faces » pour la reprendre sans enregistrer un autre paiement.",
          );
        }
      }
    }, "Paiement confirmé. La carte peut être contrôlée puis activée pour sa période de validité.");
  const changeCard = (id: string) => {
    selectedRef.current = id;
    setSelected(id);
    onCardChange?.(id);
    setError("");
    setSuccess("");
  };
  return (
    <article
      className={`affiliation-detail${standalone ? " affiliation-detail--standalone" : ""}`}
      aria-busy={busy}
    >
      {standalone && (
        <nav
          className="affiliation-detail__breadcrumb"
          aria-label="Fil d’Ariane"
        >
          <Link to="/artisan-minier">Artisans miniers</Link>
          <span>/</span>
          <button type="button" onClick={onBack}>
            Affiliations & Cartes
          </button>
          <span>/</span>
          <strong>{card.numero_affiliation}</strong>
        </nav>
      )}
      <header className="affiliation-detail__header">
        <div>
          {onBack && (
            <button className="affiliation-detail__back" onClick={onBack}>
              <ArrowLeft size={17} />
              Retour au registre
            </button>
          )}
          <div className="affiliation-detail__title">
            <h1>Carte d’affiliation — {name}</h1>
            <span
              className={`affiliation-state affiliation-state--${card.statut_effectif}`}
            >
              <ShieldCheck size={14} />
              {AFFILIATION_STATUS_LABELS[card.statut_effectif]}
            </span>
          </div>
          <p>
            {card.numero_affiliation} · Émission {card.version}
          </p>
        </div>
        <div className="affiliation-detail__toolbar">
          <label>
            <span>Émission consultée</span>
            <select
              aria-label="Émission consultée"
              value={card.id}
              onChange={(e) => changeCard(e.target.value)}
              disabled={busy}
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  Version {c.version}
                </option>
              ))}
            </select>
          </label>
          <button
            className="sn-btn sn-btn--secondary"
            disabled={busy}
            onClick={() => void run(null, "Statut actualisé.")}
          >
            <RefreshCw size={17} />
            Actualiser
          </button>
        </div>
      </header>
      {error && (
        <p role="alert" className="affiliation-error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="sn-note sn-note--success">
          {success}
        </p>
      )}
      <div className="affiliation-detail__sheet">
        <div className="affiliation-detail__overview">
          <section className="affiliation-detail__preview">
            <h2>
              <CreditCard size={22} />
              Aperçu de la carte
            </h2>
            <AffiliationDigitalCard
              card={card}
              busy={busy}
              presentation="detail"
              onRetry={
                canRender
                  ? () =>
                      void run(
                        renderCard,
                        "Les deux faces et le PDF sont disponibles.",
                      )
                  : undefined
              }
            />
          </section>
          <aside className="affiliation-detail__operations">
            <section className="affiliation-detail__issuance">
              <h2>
                <BadgeCheck size={22} />
                Informations de l’émission
              </h2>
              <dl>
                <div>
                  <dt>Numéro d’affiliation</dt>
                  <dd>{card.numero_affiliation}</dd>
                </div>
                <div>
                  <dt>Émission</dt>
                  <dd>{card.version}</dd>
                </div>
                <div>
                  <dt>Début de validité</dt>
                  <dd>{affiliationDate(card.valid_from)}</dd>
                </div>
                <div>
                  <dt>Valable jusqu’au</dt>
                  <dd>{affiliationDate(card.valid_until)}</dd>
                </div>
              </dl>
            </section>
            {detailsError ? (
              <div className="affiliation-error" role="alert">
                {detailsError}
                <button className="sn-btn" disabled={busy} onClick={() => void run(null, "Statut actualisé.")}>
                  Réessayer le chargement des droits
                </button>
              </div>
            ) : detailsLoading ? (
              <p className="affiliation-help">Chargement des droits…</p>
            ) : canFinance ? (
              <AffiliationPaymentPanel
                key={card.id}
                card={card}
                dues={dues}
                receipts={receipts}
                tariffs={tariffs}
                manage={duesManage}
                confirm={confirm}
                userId={user?.id}
                busy={busy || unverified}
                run={run}
                onConfirm={confirmPayment}
              />
            ) : (
              <section className="affiliation-detail__finance">
                <h2>
                  <Banknote size={22} />
                  Droits d’adhésion
                </h2>
                <p className="affiliation-help">
                  Le détail des paiements est réservé aux agents habilités.
                </p>
              </section>
            )}
            <section className="affiliation-detail__activation">
              <h2>
                <Zap size={22} />
                Activation
              </h2>
              <ol>
                {[
                  {
                    label: "Paiement des droits",
                    done: fullyPaid,
                    pending: "Non confirmé",
                  },
                  {
                    label: "Carte générée",
                    done: card.render_status === "ready",
                    pending: fullyPaid ? "À générer" : "Après paiement",
                  },
                  {
                    label: "Contrôle documentaire",
                    done: !!card.validated_at && card.statut !== "en_cours",
                    pending: "En attente",
                  },
                ].map((step, i) => (
                  <li key={step.label}>
                    <span
                      className={`affiliation-detail__step ${step.done ? "is-done" : ""}`}
                    >
                      {step.done ? <CheckCircle2 size={16} /> : i + 1}
                    </span>
                    <strong>{step.label}</strong>
                    <span
                      className={`affiliation-state affiliation-state--${step.done ? "active" : "inactive"}`}
                    >
                      {step.done ? "Terminé" : step.pending}
                    </span>
                  </li>
                ))}
              </ol>
              {activate && (
                <>
                  {eligible && (
                    <label className="affiliation-check">
                      <input
                        type="checkbox"
                        checked={activationConfirmed}
                        disabled={busy}
                        onChange={(e) =>
                          setActivationConfirmed(e.target.checked)
                        }
                      />
                      Je confirme l’activation de cette carte pour la période du{" "}
                      {affiliationDate(dues!.debut)} au{" "}
                      {affiliationDate(dues!.fin)}.
                    </label>
                  )}
                  <button
                    className="sn-btn sn-btn--primary"
                    disabled={
                      !eligible ||
                      !activationConfirmed ||
                      busy ||
                      detailsLoading ||
                      !!detailsError
                    }
                    onClick={() =>
                      void run(async () => {
                        await affiliationService.activate(card.id);
                        try {
                          await affiliationService.render(card.id);
                        } catch {
                          throw new Error(
                            "L’activation est enregistrée. La génération de la carte définitive a échoué : utilisez « Générer les deux faces » pour la reprendre.",
                          );
                        }
                      }, "Activation enregistrée et carte définitive générée.")
                    }
                  >
                    <CheckCircle2 size={17} />
                    {card.statut_effectif === "active"
                      ? "Carte active"
                      : "Activer la carte"}
                  </button>
                </>
              )}
              <p className="affiliation-help">
                <Info size={15} />
                L’activation exige le paiement intégral confirmé et la
                validation documentaire. La période détermine ensuite la
                validité de la carte.
              </p>
            </section>
          </aside>
        </div>
        <div
          className="affiliation-detail__tabs"
          role="tablist"
          aria-label="Contrôle de l’affiliation"
        >
          {[
            { id: "controle", label: "Contrôle documentaire" },
            { id: "decision", label: "Décision & correction" },
            { id: "historique", label: "Historique" },
          ].map((item) => (
            <button
              type="button"
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`affiliation-tab-${item.id}`}
              id={`affiliation-tab-label-${item.id}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <section
          className="affiliation-detail__tab-panel"
          role="tabpanel"
          id={`affiliation-tab-${tab}`}
          aria-labelledby={`affiliation-tab-label-${tab}`}
        >
          {tab === "controle" && (
            <div className="affiliation-detail__control">
              <div>
                <h2>
                  <BadgeCheck size={22} />
                  Contrôle documentaire
                </h2>
                <p className="affiliation-help">
                  La validation doit être réalisée par une personne différente
                  de l’émetteur.
                </p>
                <Link
                  className="affiliation-detail__text-link"
                  to={`/artisan-minier/${artisanId}`}
                >
                  Consulter le dossier du titulaire
                </Link>
              </div>
              <fieldset
                disabled={busy || !manage || card.statut !== "en_cours"}
              >
                <legend className="sr-only">Éléments à contrôler</legend>
                {[
                  "Identité du titulaire",
                  "Site de rattachement",
                  "Informations de la carte",
                ].map((label) => (
                  <label key={label}>
                    <input
                      type="checkbox"
                      checked={Boolean(card.validated_at) || checks.includes(label)}
                      onChange={(e) =>
                        setChecks((v) =>
                          e.target.checked
                            ? [...v, label]
                            : v.filter((x) => x !== label),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <div className="affiliation-detail__control-actions">
                {manage && (
                  <>
                    <button
                      className="sn-btn sn-btn--secondary"
                      disabled={busy}
                      onClick={() => setTab("decision")}
                    >
                      <Pencil size={16} />
                      Demander une correction
                    </button>
                    {card.statut === "en_cours" ? (
                      <button
                        className="sn-btn sn-btn--primary"
                        disabled={
                          busy ||
                          checks.length !== 3 ||
                          card.render_status !== "ready" ||
                          !fullyPaid
                        }
                        onClick={() =>
                          void run(
                            () => carteProfessionnelleService.valider(card.id),
                            "Carte validée. Vous pouvez maintenant confirmer son activation.",
                          )
                        }
                      >
                        <BadgeCheck size={16} />
                        Valider la carte
                      </button>
                    ) : (
                      <span className="affiliation-state">
                        <ShieldCheck size={15} />
                        {AFFILIATION_STATUS_LABELS[card.statut_effectif]}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          {tab === "decision" &&
            (manage ? (
              <CardRevision
                key={card.id}
                card={card}
                disabled={busy}
                onSubmit={(state, reason, id) =>
                  run(
                    async () => {
                      if (state === "correction") {
                        await affiliationService.correct(id, card.id, reason);
                        changeCard(id);
                      } else
                        await carteProfessionnelleService.transitionner(
                          card.id,
                          card.statut as CarteProfessionnelleStatut,
                          state as CarteProfessionnelleStatut,
                          reason,
                        );
                    },
                    state === "correction"
                      ? "Version corrigée créée ; son contrôle reste nécessaire."
                      : "Décision enregistrée dans l’historique.",
                  )
                }
              />
            ) : (
              <p className="affiliation-help">
                La décision est réservée aux agents habilités.
              </p>
            ))}
          {tab === "historique" && <HistoryList events={events} loading={detailsLoading} error={detailsError} />}
        </section>
        {tab !== "historique" && (
          <section className="affiliation-detail__history">
            <h2>
              <History size={21} />
              Chronologie de cette émission
            </h2>
            <HistoryList events={events.slice(0, 3)} loading={detailsLoading} error={detailsError} />
            {events.length > 3 && (
              <button
                className="affiliation-detail__text-link"
                onClick={() => setTab("historique")}
              >
                Voir tout l’historique
              </button>
            )}
          </section>
        )}
        {manage && card.statut !== "en_cours" && (
          <div className="affiliation-detail__renew">
            <button
              className="sn-btn sn-btn--secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await carteProfessionnelleService.renouveler(artisanId);
                  selectedRef.current = "";
                  setSelected("");
                  onCardChange?.("");
                }, "Nouvelle période à préparer. L’ancienne émission est conservée.")
              }
            >
              <RefreshCw size={16} />
              Renouveler pour une nouvelle période
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
function HistoryList({ events, loading, error }: { events: AffiliationEvent[]; loading?: boolean; error?: string }) {
  if (loading || error) return <p className="affiliation-help">{loading ? "Chargement de l’historique…" : "Historique indisponible. Actualisez le dossier pour réessayer."}</p>;
  return events.length ? (
    <ol className="affiliation-timeline">
      {events.map((event) => (
        <li key={event.id}>
          <time dateTime={event.occurred_at}>
            {new Date(event.occurred_at).toLocaleString("fr-FR")}
          </time>
          <div>
            <strong>{EVENTS[event.action] || "Mise à jour du dossier"}</strong>
            {event.reason && <p>{event.reason}</p>}
          </div>
        </li>
      ))}
    </ol>
  ) : (
    <p className="affiliation-help">
      Aucune opération tracée pour cette émission.
    </p>
  );
}
function CardRevision({
  card,
  disabled,
  onSubmit,
}: {
  card: AffiliationCard;
  disabled: boolean;
  onSubmit: (
    state: string,
    reason: string,
    id: string,
  ) => Promise<boolean | undefined>;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const [decision, setDecision] = useState("correction");
  if (card.replaced_by)
    return (
      <p className="affiliation-help">
        Cette émission a été remplacée ; son historique est conservé.
      </p>
    );
  return (
    <form
      className="affiliation-form affiliation-detail__decision"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(
          decision,
          String(new FormData(e.currentTarget).get("reason")),
          id,
        );
      }}
    >
      <div>
        <h2>
          <HelpCircle size={21} />
          Décision & correction
        </h2>
        <p className="affiliation-help">
          Corrigez d’abord le dossier du titulaire. Une nouvelle version
          conserve l’historique et reste soumise au contrôle documentaire.
        </p>
      </div>
      <label>
        Action
        <select
          value={decision}
          disabled={disabled}
          onChange={(e) => setDecision(e.target.value)}
        >
          <option value="correction">Créer une version corrigée</option>
          {["validee", "en_exploitation"].includes(card.statut) && (
            <option value="suspendue">Suspendre la carte</option>
          )}
          {card.statut === "suspendue" && (
            <option value="validee">Lever la suspension après contrôle</option>
          )}
          {!["annulee", "expiree"].includes(card.statut) && (
            <option value="annulee">
              {card.statut === "en_cours"
                ? "Refuser cette émission"
                : "Annuler la carte"}
            </option>
          )}
        </select>
      </label>
      <label>
        Motif de la décision
        <textarea
          name="reason"
          minLength={10}
          maxLength={500}
          required
          disabled={disabled}
        />
      </label>
      <button className="sn-btn sn-btn--primary" disabled={disabled}>
        Enregistrer la décision
      </button>
    </form>
  );
}
