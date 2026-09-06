import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  CheckCircle2,
  History,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { CAPABILITIES, hasSensitiveCapability } from "@/lib/capabilities";
import { affiliationDate, type AffiliationCard } from "@/lib/affiliationCard";
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

const money = (value: number, currency: string) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
const EVENTS: Record<string, string> = {
  "render-requested": "Génération demandée",
  "dues-cancelled": "Échéance annulée",
  prepared: "Identité figée pour cette émission",
  rendered: "Fichiers générés",
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

export function AffiliationDossier({ artisanId }: { artisanId: string }) {
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
  const [selected, setSelected] = useState("");
  const [tariffs, setTariffs] = useState<AdhesionBareme[]>([]);
  const [dues, setDues] = useState<AdhesionDroit | null>(null);
  const [receipts, setReceipts] = useState<AdhesionEncaissement[]>([]);
  const [events, setEvents] = useState<AffiliationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activationConfirmed, setActivationConfirmed] = useState(false);
  const mutationLock = useRef(false);
  const generation = useRef(0);
  const detailsGeneration = useRef(0);
  const card = cards.find((c) => c.id === selected) || cards[0];
  const activeCard = useRef<string | undefined>(undefined);
  activeCard.current = card?.id;
  const load = useCallback(async () => {
    const request = ++generation.current;
    try {
      const next = await affiliationService.list(artisanId);
      if (request !== generation.current) return;
      setCards(next);
      setError("");
    } catch (reason) {
      if (request === generation.current)
        setError(
          messageErreurUtilisateur(
            reason,
            "Impossible de lire le statut actuel des cartes.",
          ),
        );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [artisanId]);
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
  const loadDetails = useCallback(async () => {
    if (!card) return;
    const request = ++detailsGeneration.current;
    const [history, finance, prices] = await Promise.all([
      affiliationService.history(card.id),
      canFinance
        ? affiliationService.dues(card.dues_card_id || card.id)
        : Promise.resolve({ droit: null, encaissements: [] }),
      duesManage ? affiliationService.tariffs() : Promise.resolve([]),
    ]);
    if (request !== detailsGeneration.current || activeCard.current !== card.id)
      return;
    setEvents(history);
    setDues(finance.droit);
    setReceipts(finance.encaissements);
    setTariffs(prices);
  }, [card?.id, card?.dues_card_id, canFinance, duesManage]);
  useEffect(() => {
    setDues(null);
    setReceipts([]);
    setEvents([]);
    setActivationConfirmed(false);
    void loadDetails().catch((reason) =>
      setError(
        messageErreurUtilisateur(
          reason,
          "Le dossier d’adhésion est indisponible.",
        ),
      ),
    );
    return () => {
      detailsGeneration.current++;
    };
  }, [loadDetails]);
  const run = async (action: () => Promise<unknown>, message: string) => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await action();
      await load();
      await loadDetails();
      setSuccess(message);
      setActivationConfirmed(false);
      return true;
    } catch (reason) {
      await load();
      setError(messageErreurUtilisateur(reason));
      return false;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  };
  if (loading)
    return (
      <p className="sn-empty">
        <Loader2 className="sn-spin" /> Chargement de l’affiliation…
      </p>
    );
  if (!card)
    return (
      <div className="affiliation-panel">
        <h3>Aucune carte disponible</h3>
        <p>Le dossier doit être enregistré avant l’émission de sa carte.</p>
        {error && (
          <p role="alert" className="affiliation-error">
            {error}
          </p>
        )}
        <button className="sn-btn" onClick={() => void load()}>
          Réessayer
        </button>
      </div>
    );
  const paid = receipts
    .filter((p) => p.statut === "confirme")
    .reduce((total, p) => total + Number(p.montant), 0);
  const reserved = receipts
    .filter((p) => ["confirme", "en_attente"].includes(p.statut))
    .reduce((total, p) => total + Number(p.montant), 0);
  const eligible =
    card.statut === "validee" &&
    Boolean(card.validated_at) &&
    dues?.statut === "ouvert" &&
    paid >= Number(dues.montant);
  return (
    <div className="affiliation-dossier" aria-busy={busy}>
      <div className="affiliation-toolbar">
        <label>
          Émission consultée{" "}
          <select
            value={card.id}
            onChange={(e) => setSelected(e.target.value)}
            disabled={busy}
          >
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                Version {c.version} · {c.numero_affiliation}
              </option>
            ))}
          </select>
        </label>
        <button
          className="sn-btn"
          disabled={busy}
          onClick={() => void run(async () => undefined, "Statut actualisé.")}
        >
          <RefreshCw size={15} /> Actualiser
        </button>
      </div>
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
      <div className="affiliation-dossier__grid">
        <div>
          <AffiliationDigitalCard
            card={card}
            busy={busy}
            onRetry={
              manage || (activate && Boolean(card.snapshot))
                ? () =>
                    void run(async () => {
                      if (!card.snapshot)
                        await affiliationService.prepare(card.id);
                      await affiliationService.render(card.id);
                    }, "Les deux faces et le PDF sont disponibles.")
                : undefined
            }
          />
          {manage && (
            <div className="affiliation-panel" style={{ marginTop: 22 }}>
              <h3>
                <BadgeCheck size={18} /> Contrôle documentaire
              </h3>
              <p className="affiliation-help">
                La validation porte sur l’identité et la version affichées. Elle
                doit être réalisée par une personne différente de l’émetteur.
              </p>
              <div
                className="affiliation-form__actions"
                style={{ marginTop: 12 }}
              >
                {card.statut === "en_cours" && (
                  <button
                    className="sn-btn sn-btn--primary"
                    disabled={busy || card.render_status !== "ready"}
                    onClick={() =>
                      void run(
                        () => carteProfessionnelleService.valider(card.id),
                        "Carte validée. L’activation reste conditionnée aux droits d’adhésion.",
                      )
                    }
                  >
                    <BadgeCheck size={16} /> Valider la carte
                  </button>
                )}
                {card.statut !== "en_cours" && (
                  <button
                    className="sn-btn"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await carteProfessionnelleService.renouveler(artisanId);
                        setSelected("");
                      }, "Nouvelle émission créée. L’ancienne carte est conservée.")
                    }
                  >
                    <RefreshCw size={16} /> Renouveler pour une nouvelle période
                  </button>
                )}
              </div>
              {!card.replaced_by && (
                <CardRevision
                  key={card.id}
                  card={card}
                  disabled={busy}
                  onSubmit={(state, reason, id) =>
                    run(
                      async () => {
                        if (state === "correction") {
                          await affiliationService.correct(id, card.id, reason);
                          setSelected("");
                        } else
                          await carteProfessionnelleService.transitionner(
                            card.id,
                            card.statut as CarteProfessionnelleStatut,
                            state as CarteProfessionnelleStatut,
                            reason,
                          );
                      },
                      state === "correction"
                        ? "Nouvelle version créée à partir du dossier actuel. Elle doit être préparée et contrôlée."
                        : "Décision enregistrée dans l’historique.",
                    )
                  }
                />
              )}
            </div>
          )}
          <div className="affiliation-panel">
            <h3>
              <History size={18} /> Historique de cette émission
            </h3>
            {events.length ? (
              <ol className="affiliation-timeline">
                {events.map((event) => (
                  <li key={event.id}>
                    <strong>
                      {EVENTS[event.action] || "Mise à jour du dossier"}
                    </strong>
                    <time dateTime={event.occurred_at}>
                      {new Date(event.occurred_at).toLocaleString("fr-FR")}
                    </time>
                    {event.reason && <p>{event.reason}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="affiliation-help">
                Aucune opération tracée pour cette émission.
              </p>
            )}
          </div>
        </div>
        <aside>
          {canFinance ? (
            <div className="affiliation-panel">
              <h3>
                <Banknote size={18} /> Droits d’adhésion
              </h3>
              {dues ? (
                <>
                  <div className="affiliation-panel__summary">
                    <strong>{money(paid, dues.devise)}</strong>
                    <span>sur {money(Number(dues.montant), dues.devise)}</span>
                  </div>
                  <div className="affiliation-progress">
                    <span
                      style={{
                        width: `${Math.min(100, (paid / Number(dues.montant)) * 100)}%`,
                      }}
                    />
                  </div>
                  {dues.statut === "annule" && (
                    <p className="affiliation-error">
                      Droits annulés. Préparez une nouvelle émission et sa
                      période d’adhésion pour reprendre le dossier.
                    </p>
                  )}
                  <p className="affiliation-help">
                    <CalendarDays size={14} /> Du {affiliationDate(dues.debut)}{" "}
                    au {affiliationDate(dues.fin)} inclus
                  </p>
                  <p className="affiliation-help">
                    Solde à confirmer :{" "}
                    <strong>
                      {money(
                        Math.max(0, Number(dues.montant) - paid),
                        dues.devise,
                      )}
                    </strong>
                  </p>
                  {receipts.map((receipt) => (
                    <div key={receipt.id} className="affiliation-receipt">
                      <div>
                        <strong>
                          {money(Number(receipt.montant), dues.devise)}
                        </strong>
                        <span>
                          {
                            {
                              en_attente: "À contrôler",
                              confirme: "Confirmé",
                              annule: "Annulé",
                              rembourse: "Remboursé",
                            }[receipt.statut]
                          }
                        </span>
                      </div>
                      <div>
                        <span>{receipt.reference}</span>
                        <span>{affiliationDate(receipt.date_paiement)}</span>
                      </div>
                      {confirm && receipt.statut === "en_attente" && (
                        <div>
                          <button
                            className="sn-btn"
                            disabled={busy || receipt.created_by === user?.id}
                            onClick={() =>
                              void run(
                                () =>
                                  affiliationService.reviewReceipt(
                                    receipt.id,
                                    "confirme",
                                  ),
                                "Paiement confirmé. La carte attend son activation manuelle.",
                              )
                            }
                          >
                            <CheckCircle2 size={13} /> Confirmer le paiement
                          </button>
                        </div>
                      )}
                      {confirm &&
                        ["confirme", "en_attente"].includes(receipt.statut) && (
                          <ReceiptRevision
                            receipt={receipt}
                            disabled={busy}
                            onSubmit={(state, reason) =>
                              run(
                                () =>
                                  affiliationService.reviewReceipt(
                                    receipt.id,
                                    state,
                                    reason,
                                  ),
                                "Révision de l’encaissement enregistrée.",
                              )
                            }
                          />
                        )}
                    </div>
                  ))}
                  {duesManage &&
                    dues.statut === "ouvert" &&
                    reserved < Number(dues.montant) && (
                      <ReceiptForm
                        key={dues.id}
                        droit={dues}
                        remaining={Number(dues.montant) - reserved}
                        disabled={busy}
                        onSubmit={(args) =>
                          run(
                            () => affiliationService.recordReceipt(args),
                            "Paiement enregistré, en attente de contrôle.",
                          )
                        }
                      />
                    )}
                  {confirm && dues.statut === "ouvert" && reserved === 0 && (
                    <details>
                      <summary>Annuler cette échéance</summary>
                      <form
                        className="affiliation-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const reason = String(
                            new FormData(e.currentTarget).get("reason"),
                          );
                          void run(
                            () =>
                              affiliationService.cancelDues(dues.id, reason),
                            "Échéance annulée ; son historique est conservé.",
                          );
                        }}
                      >
                        <label>
                          Motif d’annulation
                          <textarea
                            name="reason"
                            required
                            minLength={10}
                            maxLength={500}
                            disabled={busy}
                          />
                        </label>
                        <button className="sn-btn" disabled={busy}>
                          Annuler les droits
                        </button>
                      </form>
                    </details>
                  )}
                </>
              ) : (
                <>
                  <p className="affiliation-help">
                    Définissez la période et le barème applicables à cette
                    émission.
                  </p>
                  {duesManage && (
                    <DuesForm
                      key={card.id}
                      card={card}
                      tariffs={tariffs}
                      disabled={busy}
                      onSubmit={(args) =>
                        run(
                          () => affiliationService.establishDues(args),
                          "Droits d’adhésion établis.",
                        )
                      }
                    />
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="affiliation-panel">
              <h3>Adhésion et validité</h3>
              <p className="affiliation-help">
                Le statut de la carte est contrôlé à partir de sa validation, de
                ses droits et de sa période de validité. Le détail des
                encaissements est réservé aux agents habilités.
              </p>
            </div>
          )}
          {activate && (
            <div className="affiliation-panel">
              <h3>
                <ShieldIcon /> Activation manuelle
              </h3>
              <p className="affiliation-help">
                {eligible
                  ? `Carte validée et droits soldés. Période : ${affiliationDate(dues!.debut)} au ${affiliationDate(dues!.fin)}.`
                  : "Validez la carte et confirmez le règlement intégral des droits pour activer cette émission."}
              </p>
              {eligible && (
                <label className="affiliation-check">
                  <input
                    type="checkbox"
                    checked={activationConfirmed}
                    onChange={(e) => setActivationConfirmed(e.target.checked)}
                    disabled={busy}
                  />
                  Je confirme l’activation de cette carte pour la période
                  indiquée.
                </label>
              )}
              <button
                className="sn-btn sn-btn--primary"
                style={{ marginTop: 14 }}
                disabled={!eligible || !activationConfirmed || busy}
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
                <CheckCircle2 size={16} /> Activer la carte
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
const ShieldIcon = () => <CheckCircle2 size={18} />;
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
  return (
    <details style={{ marginTop: 16 }}>
      <summary>Correction ou décision sur la carte</summary>
      <form
        className="affiliation-form"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          void onSubmit(decision, String(data.get("reason")), id);
        }}
      >
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
              <option value="validee">
                Lever la suspension après contrôle
              </option>
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
        <p className="affiliation-help">
          {decision === "correction"
            ? "Corrigez d’abord les informations du dossier. Une nouvelle version sera préparée et validée. Les droits de la même période restent rattachés à leur encaissement d’origine ; un changement de rôle nécessite des droits compatibles."
            : decision === "validee"
              ? "La levée de suspension nécessite un nouveau contrôle puis une activation manuelle des droits encore valides."
              : "La décision conserve les fichiers et les paiements dans l’historique."}
        </p>
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
        <button className="sn-btn" disabled={disabled}>
          Enregistrer la décision
        </button>
      </form>
    </details>
  );
}
type DuesArgs = Parameters<typeof affiliationService.establishDues>[0];
function DuesForm({
  card,
  tariffs,
  disabled,
  onSubmit,
}: {
  card: AffiliationCard;
  tariffs: AdhesionBareme[];
  disabled: boolean;
  onSubmit: (args: DuesArgs) => Promise<boolean | undefined>;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const [tariff, setTariff] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const applicable = tariffs.filter(
    (t) => t.role_artisan === card.snapshot?.role,
  );
  if (!card.snapshot)
    return (
      <p className="affiliation-help">
        Préparez d’abord la carte avec la commande « Générer les deux faces ».
      </p>
    );
  if (!applicable.length)
    return (
      <p className="affiliation-help">
        Aucun barème applicable. Un administrateur doit le configurer dans «
        Affiliations & Cartes → Barèmes ».
      </p>
    );
  return (
    <form
      className="affiliation-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({
          p_id: key,
          p_carte: card.id,
          p_bareme: tariff,
          p_debut: start,
          p_fin: end,
        });
      }}
    >
      <label>
        Barème
        <select
          required
          value={tariff}
          onChange={(e) => setTariff(e.target.value)}
          disabled={disabled}
        >
          <option value="">Sélectionner</option>
          {applicable.map((t) => (
            <option key={t.id} value={t.id}>
              {t.libelle} · {money(Number(t.montant), t.devise)} ·{" "}
              {t.duree_jours} jours
            </option>
          ))}
        </select>
      </label>
      <div className="affiliation-form__pair">
        <label>
          Date de début
          <input
            required
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={disabled}
          />
        </label>
        <label>
          Date de fin incluse
          <input
            required
            type="date"
            value={end}
            min={start}
            onChange={(e) => setEnd(e.target.value)}
            disabled={disabled}
          />
        </label>
      </div>
      <button className="sn-btn" disabled={disabled}>
        Établir les droits
      </button>
    </form>
  );
}
type ReceiptArgs = Parameters<typeof affiliationService.recordReceipt>[0];
function ReceiptForm({
  droit,
  remaining,
  disabled,
  onSubmit,
}: {
  droit: AdhesionDroit;
  remaining: number;
  disabled: boolean;
  onSubmit: (args: ReceiptArgs) => Promise<boolean | undefined>;
}) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  return (
    <details>
      <summary className="affiliation-help">Enregistrer un paiement</summary>
      <form
        className="affiliation-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          const ok = await onSubmit({
            p_id: key,
            p_droit: droit.id,
            p_montant: Number(data.get("amount")),
            p_reference: String(data.get("reference")),
            p_mode: String(data.get("mode")),
            p_date: String(data.get("date")),
          });
          if (ok) {
            setKey(crypto.randomUUID());
            form.reset();
          }
        }}
      >
        <label>
          Montant ({droit.devise})
          <input
            name="amount"
            type="number"
            required
            min="0.01"
            max={remaining}
            step="0.01"
            disabled={disabled}
          />
        </label>
        <label>
          Référence du reçu / virement
          <input
            name="reference"
            required
            minLength={3}
            maxLength={120}
            disabled={disabled}
          />
        </label>
        <label>
          Date du paiement
          <input name="date" type="date" required disabled={disabled} />
        </label>
        <label>
          Mode
          <select name="mode" required disabled={disabled}>
            <option value="">Sélectionner</option>
            <option value="cash">Espèces</option>
            <option value="virement_bancaire">Virement bancaire</option>
            <option value="cheque">Chèque</option>
            <option value="orange_money">Orange Money</option>
            <option value="moov_money">Moov Money</option>
            <option value="wave">Wave</option>
            <option value="mobile_money">Mobile Money</option>
          </select>
        </label>
        <button className="sn-btn" disabled={disabled}>
          Enregistrer le paiement
        </button>
      </form>
    </details>
  );
}
function ReceiptRevision({
  receipt,
  disabled,
  onSubmit,
}: {
  receipt: AdhesionEncaissement;
  disabled: boolean;
  onSubmit: (state: string, reason: string) => Promise<boolean | undefined>;
}) {
  return (
    <details>
      <summary>Réviser l’encaissement</summary>
      <form
        className="affiliation-form"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          void onSubmit(String(data.get("state")), String(data.get("reason")));
        }}
      >
        <label>
          Décision
          <select name="state" disabled={disabled}>
            <option value="annule">Annuler</option>
            {receipt.statut === "confirme" && (
              <option value="rembourse">Enregistrer le remboursement</option>
            )}
          </select>
        </label>
        <label>
          Motif
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={500}
            disabled={disabled}
          />
        </label>
        <button className="sn-btn" disabled={disabled}>
          Confirmer la révision
        </button>
      </form>
    </details>
  );
}
