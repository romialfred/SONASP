import { useState } from "react";
import {
  Banknote,
  CheckCircle2,
  FileCheck2,
  Paperclip,
  Settings2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { affiliationDate, type AffiliationCard } from "@/lib/affiliationCard";
import { affiliationService } from "@/services/affiliationService";
import type {
  AdhesionBareme,
  AdhesionDroit,
  AdhesionEncaissement,
} from "@/types/affiliations";

export const affiliationMoney = (value: number, currency = "XOF") =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value)} ${currency === "XOF" ? "FCFA" : currency}`;
type Run = (
  action: () => Promise<unknown>,
  message: string,
) => Promise<boolean | undefined>;

export function AffiliationPaymentPanel({
  card,
  dues,
  receipts,
  tariffs,
  manage,
  confirm,
  userId,
  busy,
  run,
  onConfirm,
}: {
  card: AffiliationCard;
  dues: AdhesionDroit | null;
  receipts: AdhesionEncaissement[];
  tariffs: AdhesionBareme[];
  manage: boolean;
  confirm: boolean;
  userId?: string;
  busy: boolean;
  run: Run;
  onConfirm: (receiptId: string) => void;
}) {
  const [configure, setConfigure] = useState(false);
  const [payment, setPayment] = useState(false);
  const paid = receipts
    .filter((r) => r.statut === "confirme")
    .reduce((n, r) => n + Number(r.montant), 0);
  const reserved = receipts
    .filter((r) => ["confirme", "en_attente"].includes(r.statut))
    .reduce((n, r) => n + Number(r.montant), 0);
  const settled = dues?.statut === "ouvert" && paid >= Number(dues.montant);
  return (
    <section
      className="affiliation-detail__finance"
      aria-label="Droits d’adhésion"
    >
      <h2>
        <Banknote size={22} />
        Droits d’adhésion
      </h2>
      <div className="affiliation-detail__dues-line">
        <span
          className={`affiliation-state affiliation-state--${settled ? "active" : "inactive"}`}
        >
          {settled ? <CheckCircle2 size={15} /> : <Banknote size={15} />}
          {!dues
            ? "À définir"
            : dues.statut === "annule"
              ? "Droits annulés"
              : settled
                ? "Droits payés"
                : reserved > paid
                  ? "Paiement à confirmer"
                  : "À régler"}
        </span>
        {manage && !dues && (
          <button
            className="sn-btn sn-btn--secondary"
            disabled={busy}
            aria-expanded={configure}
            onClick={() => setConfigure(!configure)}
          >
            <Settings2 size={16} />
            Configurer les droits
          </button>
        )}
        {manage &&
          dues?.statut === "ouvert" &&
          reserved < Number(dues.montant) && (
            <button
              className="sn-btn sn-btn--primary"
              disabled={busy}
              aria-expanded={payment}
              onClick={() => setPayment(!payment)}
            >
              <Banknote size={16} />
              Enregistrer un paiement
            </button>
          )}
      </div>
      {dues ? (
        <>
          <p className="affiliation-detail__amount">
            <strong>{affiliationMoney(paid, dues.devise)}</strong>
            <span>
              {" "}
              / {affiliationMoney(Number(dues.montant), dues.devise)}
            </span>
          </p>
          <p className="affiliation-help">
            Année {dues.debut.slice(0, 4)} · Du {affiliationDate(dues.debut)} au{" "}
            {affiliationDate(dues.fin)} inclus
          </p>
          {!settled && dues.statut === "ouvert" && (
            <p className="affiliation-help">
              Solde à confirmer :{" "}
              <strong>
                {affiliationMoney(
                  Math.max(0, Number(dues.montant) - paid),
                  dues.devise,
                )}
              </strong>
            </p>
          )}
          {receipts.map((receipt) => (
            <div className="affiliation-detail__receipt" key={receipt.id}>
              <div className="affiliation-detail__dues-line">
                <strong>{receipt.reference}</strong>
                <span className="affiliation-state">
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
              <p>
                {affiliationMoney(Number(receipt.montant), dues.devise)} ·{" "}
                {affiliationDate(receipt.date_paiement)}
              </p>
              <p className="affiliation-help">
                {receipt.lieu_paiement ||
                  "Lieu non renseigné pour ce paiement historique"}
              </p>
              {receipt.preuve_path && (
                <button
                  type="button"
                  className="sn-btn sn-btn--ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const popup = window.open("", "_blank");
                      if (!popup)
                        throw new Error(
                          "Autorisez l’ouverture d’un onglet pour consulter la preuve.",
                        );
                      popup.opener = null;
                      try {
                        popup.location.href =
                          await affiliationService.signedPaymentProof(
                            receipt.preuve_path!,
                          );
                      } catch (reason) {
                        popup.close();
                        throw reason;
                      }
                    }, "La preuve de paiement est disponible dans un nouvel onglet.")
                  }
                >
                  <FileCheck2 size={15} />
                  Consulter la preuve
                </button>
              )}
              {confirm && receipt.statut === "en_attente" && (
                <button
                  className="sn-btn sn-btn--primary"
                  disabled={busy || receipt.created_by === userId}
                  onClick={() => onConfirm(receipt.id)}
                >
                  <CheckCircle2 size={15} />
                  Confirmer le paiement
                </button>
              )}
              {confirm &&
                receipt.statut === "en_attente" &&
                receipt.created_by === userId && (
                  <p className="affiliation-help">
                    Ce paiement doit être confirmé par un autre agent habilité.
                  </p>
                )}
              {confirm &&
                ["confirme", "en_attente"].includes(receipt.statut) && (
                  <details className="affiliation-detail__secondary">
                    <summary>Réviser l’encaissement</summary>
                    <form
                      className="affiliation-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        void run(
                          () =>
                            affiliationService.reviewReceipt(
                              receipt.id,
                              String(data.get("state")),
                              String(data.get("reason")),
                            ),
                          "Révision de l’encaissement enregistrée. Le statut de la carte a été recalculé.",
                        );
                      }}
                    >
                      <label>
                        Décision
                        <select name="state" disabled={busy}>
                          <option value="annule">Annuler</option>
                          {receipt.statut === "confirme" && (
                            <option value="rembourse">
                              Enregistrer le remboursement
                            </option>
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
                          disabled={busy}
                        />
                      </label>
                      <button
                        className="sn-btn sn-btn--secondary"
                        disabled={busy}
                      >
                        Confirmer la révision
                      </button>
                    </form>
                  </details>
                )}
            </div>
          ))}
          {manage &&
            payment &&
            dues.statut === "ouvert" &&
            reserved < Number(dues.montant) && (
              <AffiliationReceiptForm
                key={dues.id}
                card={card}
                droit={dues}
                remaining={Number(dues.montant) - reserved}
                busy={busy}
                run={run}
                onSaved={() => setPayment(false)}
              />
            )}
          {confirm && dues.statut === "ouvert" && reserved === 0 && (
            <details className="affiliation-detail__secondary">
              <summary>Annuler cette échéance</summary>
              <form
                className="affiliation-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const reason = String(
                    new FormData(e.currentTarget).get("reason"),
                  );
                  void run(
                    () => affiliationService.cancelDues(dues.id, reason),
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
                <button className="sn-btn sn-btn--secondary" disabled={busy}>
                  Annuler les droits
                </button>
              </form>
            </details>
          )}
        </>
      ) : (
        <>
          <p className="affiliation-help">Période et barème non configurés.</p>
          {manage && configure && (
            <AffiliationDuesForm
              card={card}
              tariffs={tariffs}
              busy={busy}
              run={run}
            />
          )}
        </>
      )}
    </section>
  );
}

function AffiliationDuesForm({
  card,
  tariffs,
  busy,
  run,
}: {
  card: AffiliationCard;
  tariffs: AdhesionBareme[];
  busy: boolean;
  run: Run;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const [year, setYear] = useState(
    Number(card.server_date?.slice(0, 4)) || new Date().getFullYear(),
  );
  const applicable = tariffs.filter(
    (t) => t.role_artisan === (card.snapshot?.role || card.artisan_role),
  );
  const [tariff, setTariff] = useState(
    applicable.length === 1 ? applicable[0].id : "",
  );
  const start = `${year}-01-01`;
  const duration = applicable.find((t) => t.id === tariff)?.duree_jours;
  const computeEnd = (begin: string, days?: number) => {
    if (!days || !/^\d{4}-\d{2}-\d{2}$/.test(begin)) return "";
    const d = new Date(begin + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days - 1);
    return d.toISOString().slice(0, 10);
  };
  const [from, setFrom] = useState(start);
  if (!applicable.length)
    return (
      <p className="affiliation-help">
        Aucun barème ne correspond au rôle du titulaire.{" "}
        <Link to="/artisan-minier/cartes/suivi?onglet=baremes">
          Configurer les barèmes d’adhésion
        </Link>
        .
      </p>
    );
  return (
    <form
      className="affiliation-form"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          if (!card.snapshot) await affiliationService.prepare(card.id);
          await affiliationService.establishDues({
            p_id: id,
            p_carte: card.id,
            p_bareme: tariff,
            p_debut: from,
            p_fin: computeEnd(from, duration),
          });
        }, "Période d’affiliation enregistrée. Vous pouvez saisir le paiement.");
      }}
    >
      <label>
        Année d’affiliation
        <input
          type="number"
          required
          min={2000}
          max={2100}
          value={year}
          disabled={busy}
          onChange={(e) => {
            const value = Number(e.target.value);
            setYear(value);
            setFrom(`${value}-01-01`);
          }}
        />
      </label>
      <label>
        Barème d’adhésion
        <select
          required
          value={tariff}
          disabled={busy}
          onChange={(e) => setTariff(e.target.value)}
        >
          <option value="">Sélectionner un barème</option>
          {applicable.map((t) => (
            <option key={t.id} value={t.id}>
              {t.libelle} · {affiliationMoney(Number(t.montant), t.devise)} ·{" "}
              {t.duree_jours} jours
            </option>
          ))}
        </select>
      </label>
      <div className="affiliation-form__pair">
        <label>
          Début de validité
          <input
            type="date"
            required
            value={from}
            disabled={busy}
            onChange={(e) => {
              setFrom(e.target.value);
              setYear(Number(e.target.value.slice(0, 4)));
            }}
          />
        </label>
        <label>
          Fin de validité incluse
          <input type="date" readOnly value={computeEnd(from, duration)} />
        </label>
      </div>
      <p className="affiliation-help">
        La durée vient du barème sélectionné. La période est conservée avec le
        paiement et n’est pas décalée lors de l’activation.
      </p>
      <button className="sn-btn sn-btn--primary" disabled={busy || !duration}>
        Enregistrer la période
      </button>
    </form>
  );
}

function AffiliationReceiptForm({
  card,
  droit,
  remaining,
  busy,
  run,
  onSaved,
}: {
  card: AffiliationCard;
  droit: AdhesionDroit;
  remaining: number;
  busy: boolean;
  run: Run;
  onSaved: () => void;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  return (
    <form
      className="affiliation-form affiliation-detail__payment-form"
      aria-label="Enregistrer les droits d’affiliation"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file || busy) return;
        const data = new FormData(e.currentTarget);
        const ok = await run(async () => {
          const proof = await affiliationService.uploadPaymentProof(
            file,
            droit.id,
            id,
          );
          await affiliationService.recordReceipt({
            p_id: id,
            p_droit: droit.id,
            p_montant: Number(data.get("amount")),
            p_reference: String(data.get("reference")),
            p_mode: String(data.get("mode")),
            p_date: String(data.get("date")),
            p_annee: Number(droit.debut.slice(0, 4)),
            p_lieu: String(data.get("place")),
            p_preuve: proof.path,
          });
        }, "Paiement et preuve enregistrés. Un autre agent habilité peut confirmer le règlement.");
        if (ok) onSaved();
      }}
    >
      <h3>Enregistrer le paiement</h3>
      <div className="affiliation-form__pair">
        <label>
          Année d’affiliation
          <input value={droit.debut.slice(0, 4)} readOnly />
        </label>
        <label>
          Date de paiement
          <input
            name="date"
            type="date"
            required
            defaultValue={card.server_date}
            max={card.server_date}
            disabled={busy}
          />
        </label>
      </div>
      <label>
        Lieu de paiement
        <input
          name="place"
          required
          minLength={2}
          maxLength={160}
          placeholder="Agence, caisse ou localité"
          disabled={busy}
        />
      </label>
      <label className="affiliation-detail__upload">
        <span>
          <Paperclip size={18} />
          Preuve de paiement
        </span>
        <span className="affiliation-help">
          Reçu ou justificatif · PDF, JPG ou PNG · 5 Mo maximum
        </span>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          required
          disabled={busy}
          onChange={(e) => {
            const next = e.target.files?.[0] || null;
            setError("");
            if (
              next &&
              (next.size > 5 * 1024 * 1024 ||
                !["application/pdf", "image/jpeg", "image/png"].includes(
                  next.type,
                ))
            ) {
              setFile(null);
              setError("Joignez un PDF, JPG ou PNG de 5 Mo maximum.");
              e.target.value = "";
            } else setFile(next);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="affiliation-error">
          {error}
        </p>
      )}
      <div className="affiliation-form__pair">
        <label>
          Montant ({droit.devise === "XOF" ? "FCFA" : droit.devise})
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            max={remaining}
            defaultValue={remaining}
            required
            disabled={busy}
          />
        </label>
        <label>
          Mode de paiement
          <select name="mode" required defaultValue="cash" disabled={busy}>
            <option value="cash">Espèces</option>
            <option value="virement_bancaire">Virement bancaire</option>
            <option value="cheque">Chèque</option>
            <option value="orange_money">Orange Money</option>
            <option value="moov_money">Moov Money</option>
            <option value="wave">Wave</option>
            <option value="mobile_money">Mobile Money</option>
          </select>
        </label>
      </div>
      <label>
        Référence du reçu
        <input
          name="reference"
          required
          minLength={3}
          maxLength={120}
          placeholder="Numéro du justificatif"
          disabled={busy}
        />
      </label>
      <button
        className="sn-btn sn-btn--primary"
        disabled={busy || !file || !!error}
      >
        <CheckCircle2 size={16} />
        Enregistrer le paiement
      </button>
    </form>
  );
}
