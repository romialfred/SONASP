import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { affiliationService } from "@/services/affiliationService";
import {
  affiliationDate,
  AFFILIATION_STATUS_LABELS,
} from "@/lib/affiliationCard";
import "@/components/artisan/affiliation-card.css";

export default function VerifyAffiliation() {
  const { reference } = useParams();
  const [result, setResult] =
    useState<Awaited<ReturnType<typeof affiliationService.verify>>>(null);
  const [state, setState] = useState<
    "loading" | "ready" | "unknown" | "unavailable"
  >("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setState("loading");
    setResult(null);
    if (
      !reference ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        reference,
      )
    ) {
      setState("unknown");
      return;
    }
    affiliationService
      .verify(reference)
      .then((data) => {
        if (current) {
          setResult(data);
          setState(data ? "ready" : "unknown");
        }
      })
      .catch(() => {
        if (current) setState("unavailable");
      });
    return () => {
      current = false;
    };
  }, [reference, retry]);
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) setRetry((v) => v + 1);
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const active = state === "ready" && result?.statut_effectif === "active";
  return (
    <main style={{ maxWidth: 650, margin: "60px auto", padding: 24 }}>
      <div className="affiliation-panel">
        <p style={{ color: "#967121", fontWeight: 700 }}>Faso SANAMA</p>
        <h1 style={{ fontSize: 28 }}>Vérification de l’affiliation</h1>
        {state === "loading" ? (
          <p role="status">Consultation du statut actuel…</p>
        ) : state === "unavailable" ? (
          <p role="alert" className="affiliation-error">
            Vérification momentanément indisponible. La validité de cette carte
            ne peut pas être confirmée.
          </p>
        ) : state === "unknown" ? (
          <p className="affiliation-error">
            Référence inconnue ou invalidée. Une version provisoire ne constitue
            pas un titre actif.
          </p>
        ) : (
          result && (
            <>
              <p
                className={`affiliation-state affiliation-state--${result.statut_effectif}`}
              >
                {active ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <ShieldAlert size={18} />
                )}
                {AFFILIATION_STATUS_LABELS[result.statut_effectif]}
              </p>
              <dl className="affiliation-digital__dates">
                <div>
                  <dt>Affiliation</dt>
                  <dd>{result.numero_affiliation}</dd>
                </div>
                <div>
                  <dt>Émission</dt>
                  <dd>{result.version}</dd>
                </div>
                <div>
                  <dt>Valable jusqu’au</dt>
                  <dd>{affiliationDate(result.valid_until)}</dd>
                </div>
              </dl>
              <p className="affiliation-help">
                Contrôle effectué le{" "}
                {new Date(result.verified_at).toLocaleString("fr-FR")}. Les
                informations personnelles et les paiements ne sont pas publics.
              </p>
            </>
          )
        )}
        <button
          className="sn-btn"
          style={{ marginTop: 20 }}
          disabled={state === "loading"}
          onClick={() => setRetry((v) => v + 1)}
        >
          <RefreshCw size={15} /> Vérifier à nouveau
        </button>
      </div>
    </main>
  );
}
