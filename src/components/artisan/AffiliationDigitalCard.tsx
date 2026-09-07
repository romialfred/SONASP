import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  CreditCard,
  Download,
  Loader2,
  LockKeyhole,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  affiliationCountdown,
  affiliationDate,
  AFFILIATION_STATUS_LABELS,
  type AffiliationCard,
} from "@/lib/affiliationCard";
import { affiliationService } from "@/services/affiliationService";
import "./affiliation-card.css";

export function AffiliationDigitalCard({
  card,
  onRetry,
  busy = false,
  presentation = "default",
}: {
  card: AffiliationCard;
  onRetry?: () => void;
  busy?: boolean;
  presentation?: "default" | "detail";
}) {
  const [face, setFace] = useState<"recto" | "verso">("recto");
  const [sources, setSources] = useState<{
    recto: string;
    verso: string;
  } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [reloadImages, setReloadImages] = useState(0);
  useEffect(() => {
    let current = true;
    setSources(null);
    setImageError(false);
    setFace("recto");
    if (
      card.render_status === "ready" &&
      card.recto_path &&
      card.verso_path &&
      (card.adhesion_status === undefined || card.adhesion_status === "paye")
    ) {
      Promise.all([
        affiliationService.signedFile(card.recto_path),
        affiliationService.signedFile(card.verso_path),
      ])
        .then(([recto, verso]) => {
          if (current) setSources({ recto, verso });
        })
        .catch(() => {
          if (current) setImageError(true);
        });
    }
    return () => {
      current = false;
    };
  }, [
    card.id,
    card.render_revision,
    card.render_status,
    card.recto_path,
    card.verso_path,
    card.adhesion_status,
    reloadImages,
  ]);
  const paymentPending =
    card.adhesion_status !== undefined && card.adhesion_status !== "paye";
  const downloadable = card.render_status === "ready" && !paymentPending;
  const download = async (side: "recto" | "verso" | "pdf", path: string) => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError("");
    try {
      await affiliationService.download(
        path,
        `affiliation-${card.numero_affiliation.replace(/[^a-zA-Z0-9-]/g, "-")}-v${card.version}-r${card.render_revision}-${side}.${side === "pdf" ? "pdf" : "png"}`,
      );
    } catch {
      setDownloadError("Le téléchargement a échoué. Réessayez.");
    } finally {
      setDownloading(false);
    }
  };
  const switchFace = () =>
    setFace((value) => (value === "recto" ? "verso" : "recto"));
  return (
    <section
      className={`affiliation-digital${presentation === "detail" ? " affiliation-digital--detail" : ""}`}
      aria-label="Carte numérique d’affiliation"
    >
      <div className="affiliation-digital__status">
        {presentation !== "detail" && (
          <span
            className={`affiliation-state affiliation-state--${card.statut_effectif}`}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            {AFFILIATION_STATUS_LABELS[card.statut_effectif]}
          </span>
        )}
        <strong>
          {card.statut_effectif === "active"
            ? affiliationCountdown(card)
            : `Émission ${card.version}`}
        </strong>
      </div>
      {presentation === "detail" && (
        <div
          className="affiliation-digital__face-tabs"
          aria-label="Face de la carte"
        >
          <button
            type="button"
            aria-pressed={face === "recto"}
            disabled={!sources || paymentPending || imageError}
            onClick={() => setFace("recto")}
          >
            Recto
          </button>
          <button
            type="button"
            aria-pressed={face === "verso"}
            disabled={!sources || paymentPending || imageError}
            onClick={() => setFace("verso")}
          >
            Verso
          </button>
        </div>
      )}
      <div className="affiliation-digital__stage">
        {sources && !imageError && !paymentPending ? (
          <button
            className="affiliation-digital__surface"
            type="button"
            onClick={switchFace}
            aria-label={face === "recto" ? "Voir le verso" : "Voir le recto"}
          >
            <span className="affiliation-digital__rail" data-face={face}>
              <img
                src={sources.recto}
                alt="Recto de la carte d’affiliation"
                aria-hidden={face !== "recto"}
                onError={() => setImageError(true)}
              />
              <img
                src={sources.verso}
                alt="Verso de la carte d’affiliation"
                aria-hidden={face !== "verso"}
                onError={() => setImageError(true)}
              />
            </span>
          </button>
        ) : (
          <div className="affiliation-digital__placeholder">
            {paymentPending ? (
              <LockKeyhole size={36} aria-hidden="true" />
            ) : card.render_status === "rendering" ||
              (downloadable && !imageError) ? (
              <Loader2 className="sn-spin" size={32} aria-hidden="true" />
            ) : (
              <CreditCard size={36} aria-hidden="true" />
            )}
            <strong>
              {paymentPending
                ? "Votre carte sera générée après paiement"
                : imageError
                  ? "Image momentanément indisponible"
                  : card.render_status === "failed"
                    ? "La génération a échoué"
                    : card.render_status === "rendering"
                      ? "Génération des deux faces…"
                      : downloadable
                        ? "Chargement de la carte…"
                        : "Carte à générer"}
            </strong>
            <span>
              {card.numero_affiliation} · Émission {card.version}
            </span>
            {paymentPending && (
              <p className="affiliation-digital__held-note">
                Enregistrez les droits d’affiliation et leur justificatif. La
                confirmation du règlement intégral permettra de générer cette
                carte.
              </p>
            )}
            {!busy &&
              !paymentPending &&
              (imageError ||
                (onRetry &&
                  (card.render_status === "failed" ||
                    card.render_status === "pending"))) && (
                <button
                  type="button"
                  className="sn-btn"
                  onClick={
                    imageError ? () => setReloadImages((v) => v + 1) : onRetry
                  }
                >
                  <RefreshCw size={15} />
                  {imageError
                    ? "Recharger les fichiers"
                    : "Générer les deux faces"}
                </button>
              )}
          </div>
        )}
      </div>
      {presentation !== "detail" && (
        <div className="affiliation-digital__face-control">
          <span aria-live="polite">
            {face === "recto" ? "Recto" : "Verso"} · Format ID-1
          </span>
          <button
            type="button"
            className="sn-btn sn-btn--ghost"
            onClick={switchFace}
            disabled={!sources || imageError}
          >
            <ArrowLeftRight size={16} />
            {face === "recto" ? "Voir le verso" : "Voir le recto"}
          </button>
        </div>
      )}
      {presentation !== "detail" && (
        <dl className="affiliation-digital__dates">
          <div>
            <dt>Numéro d’affiliation</dt>
            <dd>{card.numero_affiliation}</dd>
          </div>
          <div>
            <dt>Début de validité</dt>
            <dd>{affiliationDate(card.valid_from)}</dd>
          </div>
          <div>
            <dt>Valable jusqu’au inclus</dt>
            <dd>{affiliationDate(card.valid_until)}</dd>
          </div>
        </dl>
      )}
      {downloadable && (
        <div className="affiliation-digital__downloads">
          {(presentation === "detail"
            ? ([face, "pdf"] as const)
            : (["recto", "verso", "pdf"] as const)
          ).map((side) => {
            const path = card[`${side}_path`];
            return path ? (
              <button
                key={side}
                type="button"
                className="sn-btn"
                disabled={downloading}
                onClick={() => void download(side, path)}
              >
                <Download size={15} />
                {presentation === "detail"
                  ? side === "pdf"
                    ? "Télécharger PDF"
                    : "Télécharger PNG"
                  : side === "pdf"
                    ? "PDF pour impression"
                    : `Télécharger le ${side}`}
              </button>
            ) : null;
          })}
          {presentation === "detail" && card.pdf_path && (
            <button
              type="button"
              className="sn-btn"
              disabled={downloading}
              onClick={async () => {
                const popup = window.open("", "_blank");
                if (!popup) {
                  setDownloadError(
                    "Autorisez l’ouverture du PDF pour l’imprimer.",
                  );
                  return;
                }
                popup.opener = null;
                try {
                  popup.location.href = await affiliationService.signedFile(
                    card.pdf_path!,
                  );
                } catch {
                  popup.close();
                  setDownloadError(
                    "Le PDF n’a pas pu être ouvert pour impression.",
                  );
                }
              }}
            >
              <Printer size={15} />
              Imprimer
            </button>
          )}
          {presentation === "detail" && onRetry && (
            <button
              type="button"
              className="sn-btn"
              disabled={busy}
              onClick={onRetry}
            >
              <RefreshCw size={15} />
              Régénérer
            </button>
          )}
        </div>
      )}
      {downloadError && (
        <p role="alert" className="affiliation-error">
          {downloadError}
        </p>
      )}
      {card.verification_token && downloadable && (
        <a
          className="sn-btn sn-btn--ghost"
          style={{ marginTop: 12 }}
          href={`/verifier-carte/${encodeURIComponent(card.verification_token)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <QrCode size={15} /> Vérifier le statut de la carte
        </a>
      )}
      {!card.activated_at && (
        <p className="affiliation-help">
          La carte reste inactive jusqu’au paiement intégral confirmé, au
          contrôle documentaire et à son activation manuelle.
        </p>
      )}
    </section>
  );
}
