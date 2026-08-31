import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Gavel,
  HandHelping,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Paperclip,
  PencilLine,
  ScrollText,
  ShieldQuestion,
  UserRound,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, type BadgeTone } from '@/components/ui/sn';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import {
  artisanInfractionsService,
  type ArtisanInfraction,
  type ConclusionInfraction,
} from '@/services/artisanInfractionsService';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { artisanFullName } from '@/utils/artisanIdentity';
import { normaliserArtisan } from './artisanRow';
import './infraction-details.css';

const CONCLUSIONS: Record<ConclusionInfraction, { label: string; tone: BadgeTone; icon: typeof Gavel; sens: string }> = {
  reconnu: { label: 'Reconnu', tone: 'danger', icon: Gavel, sens: 'Les faits sont établis à l’encontre de l’artisan.' },
  soupçonne: { label: 'Soupçonné', tone: 'warning', icon: ShieldQuestion, sens: 'Faisceau d’indices sans preuve suffisante.' },
  complice: { label: 'Complice', tone: 'warning', icon: HandHelping, sens: 'Participation indirecte établie.' },
  innocente: { label: 'Innocenté', tone: 'success', icon: CheckCircle2, sens: 'L’artisan est mis hors de cause.' },
};

const EXTENSIONS_IMAGE = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'];
const CONCLUSION_VALUES: readonly ConclusionInfraction[] = ['reconnu', 'soupçonne', 'complice', 'innocente'];

function estConclusion(value: string): value is ConclusionInfraction {
  return CONCLUSION_VALUES.some((candidate) => candidate === value);
}

/** Nom lisible d'une pièce à partir de son URL de stockage. */
export function pieceName(url: string): string {
  const brut = url.split('?')[0].split('/').pop() || 'Pièce jointe';
  try {
    return decodeURIComponent(brut);
  } catch {
    return brut;
  }
}

export function isImage(url: string): boolean {
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase() || '';
  return EXTENSIONS_IMAGE.includes(extension);
}

/** Date au format français ; les dates absentes ou invalides ne doivent pas afficher « Invalid Date ». */
export function formatDate(value?: string | null): string {
  if (!value) return 'Non renseignée';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Non renseignée' : date.toLocaleDateString('fr-FR');
}

/** Durée d'instruction en jours, du constat à la clôture (ou à aujourd'hui si le dossier est ouvert). */
export function dureeInstruction(infraction: ArtisanInfraction): number | null {
  const debut = new Date(infraction.date_infraction).getTime();
  const fin = infraction.date_cloture ? new Date(infraction.date_cloture).getTime() : Date.now();
  if (Number.isNaN(debut) || Number.isNaN(fin)) return null;
  return Math.max(0, Math.round((fin - debut) / 86_400_000));
}

export default function InfractionDetails() {
  const navigate = useNavigate();
  const { artisanId, infractionId } = useParams();
  const { alertState, showError, closeAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [infraction, setInfraction] = useState<ArtisanInfraction | null>(null);
  const [artisan, setArtisan] = useState<ArtisanMinier | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      const [constat, dossier] = await Promise.allSettled([
        infractionId ? artisanInfractionsService.getById(infractionId) : Promise.resolve(null),
        artisanId ? artisanMinierService.getById(artisanId) : Promise.resolve(null),
      ]);
      if (!active) return;

      if (constat.status === 'fulfilled' && constat.value) {
        setInfraction(constat.value);
      } else {
        showError("Impossible de charger ce constat d'infraction");
      }
      // Le dossier artisan n'est qu'un contexte : son absence ne masque pas le constat.
      if (dossier.status === 'fulfilled') {
        setArtisan(dossier.value ? normaliserArtisan(dossier.value) : null);
      }
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [artisanId, infractionId]);

  const retour = artisanId ? `/artisan-minier/${artisanId}` : '/artisan-minier/liste';
  const modifier = `/artisan-minier/${artisanId}/infractions/${infractionId}/modifier`;

  const cloture = infraction?.statut_traitement === 'cloture';
  const conclusion = infraction?.conclusion && estConclusion(infraction.conclusion)
    ? CONCLUSIONS[infraction.conclusion]
    : null;
  const duree = useMemo(() => (infraction ? dureeInstruction(infraction) : null), [infraction]);

  if (loading) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page infraction-detail">
          <div className="infraction-detail__loading">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement du constat…
          </div>
        </div>
      </NationalDashboardLayout>
    );
  }

  if (!infraction) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page infraction-detail">
          <CustomAlert {...alertState} onClose={closeAlert} />
          <PageHeader
            icon={AlertTriangle}
            title="Constat introuvable"
            subtitle="Ce constat a été supprimé ou la référence est erronée."
            breadcrumb={[{ label: 'Artisans miniers', to: '/artisan-minier' }, { label: 'Constat' }]}
          />
          <EmptyState
            title="Aucun constat à afficher"
            description="Revenez au dossier de l’artisan pour consulter les constats existants."
            action={
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate(retour)}>
                <ArrowLeft aria-hidden="true" /> Retour au dossier
              </button>
            }
          />
        </div>
      </NationalDashboardLayout>
    );
  }

  return (
    <NationalDashboardLayout>
      <div className="sn-page infraction-detail">
        <CustomAlert {...alertState} onClose={closeAlert} />

        <PageHeader
          icon={AlertTriangle}
          title={infraction.type_infraction}
          subtitle={`Constaté le ${formatDate(infraction.date_infraction)}${
            infraction.lieu ? ` à ${infraction.lieu}` : ''
          } · Dossier de ${artisanFullName(artisan)}`}
          breadcrumb={[
            { label: 'Artisans miniers', to: '/artisan-minier' },
            { label: artisanFullName(artisan), to: retour },
            { label: 'Constat d’infraction' },
          ]}
          aside={
            <div className="infraction-detail__badges">
              <Badge tone={cloture ? 'neutral' : 'warning'}>
                {cloture ? 'Dossier clôturé' : 'Instruction en cours'}
              </Badge>
              {conclusion && (
                <Badge tone={conclusion.tone} icon={conclusion.icon}>
                  {conclusion.label}
                </Badge>
              )}
            </div>
          }
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => navigate(retour)}>
                <ArrowLeft aria-hidden="true" /> Dossier de l’artisan
              </button>
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate(modifier)}>
                <PencilLine aria-hidden="true" /> {cloture ? 'Modifier le constat' : 'Instruire et clôturer'}
              </button>
            </>
          }
        />

        <div className="infraction-detail__layout">
          <div className="infraction-detail__main">
            <Section
              id="constat"
              icon={ScrollText}
              tone="amber"
              title="Constat"
              description="Références de temps et de lieu du manquement relevé."
            >
              <dl className="infraction-detail__facts">
                <div>
                  <dt>
                    <CalendarDays aria-hidden="true" /> Date du constat
                  </dt>
                  <dd>{formatDate(infraction.date_infraction)}</dd>
                </div>
                <div>
                  <dt>
                    <MapPin aria-hidden="true" /> Lieu
                  </dt>
                  <dd>{infraction.lieu || 'Non renseigné'}</dd>
                </div>
                <div>
                  <dt>
                    <Gavel aria-hidden="true" /> Qualification
                  </dt>
                  <dd>{infraction.type_infraction}</dd>
                </div>
                <div>
                  <dt>
                    <CalendarDays aria-hidden="true" /> {cloture ? 'Durée d’instruction' : 'Ouvert depuis'}
                  </dt>
                  <dd>{duree === null ? 'Non calculable' : `${duree} jour(s)`}</dd>
                </div>
              </dl>
            </Section>

            <Section
              id="faits"
              icon={FileText}
              tone="violet"
              title="Faits constatés"
              description="Description circonstanciée établie par l’agent verbalisateur."
            >
              <p className="infraction-detail__texte">{infraction.description}</p>
            </Section>

            {infraction.remarques && (
              <Section
                id="observations"
                icon={ScrollText}
                tone="blue"
                title="Observations de l’agent"
                description="Suites proposées et mesures recommandées."
              >
                <p className="infraction-detail__texte">{infraction.remarques}</p>
              </Section>
            )}

            <Section
              id="pieces"
              icon={Paperclip}
              tone="slate"
              title="Pièces du dossier"
              description="Photographies, procès-verbaux et justificatifs versés au constat."
            >
              {infraction.documents.length === 0 ? (
                <p className="infraction-detail__vide">
                  Aucune pièce n’a été versée. Ajoutez-en depuis la modification du constat.
                </p>
              ) : (
                <ul className="infraction-detail__pieces">
                  {infraction.documents.map((url) => (
                    <li key={url}>
                      {isImage(url) ? (
                        <img src={url} alt={pieceName(url)} loading="lazy" />
                      ) : (
                        <span className="infraction-detail__piece-icon">
                          <FileText aria-hidden="true" />
                        </span>
                      )}
                      <p>
                        {isImage(url) ? <ImageIcon aria-hidden="true" /> : <FileText aria-hidden="true" />}
                        {pieceName(url)}
                      </p>
                      <div className="infraction-detail__piece-actions">
                        <a className="sn-btn sn-btn--sm" href={url} target="_blank" rel="noreferrer">
                          <ExternalLink aria-hidden="true" /> Ouvrir
                        </a>
                        <a className="sn-btn sn-btn--sm" href={url} download={pieceName(url)}>
                          <Download aria-hidden="true" /> Télécharger
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <aside className="infraction-detail__aside" aria-label="Suivi du constat">
            <section className="sn-card infraction-detail__suivi">
              <h2>
                <CheckCircle2 aria-hidden="true" /> Instruction
              </h2>
              <dl>
                <div>
                  <dt>État</dt>
                  <dd>{cloture ? 'Dossier clôturé' : 'Instruction en cours'}</dd>
                </div>
                <div>
                  <dt>Conclusion</dt>
                  <dd>{conclusion ? conclusion.label : 'Non prononcée'}</dd>
                </div>
                <div>
                  <dt>Date de clôture</dt>
                  <dd>{formatDate(infraction.date_cloture)}</dd>
                </div>
              </dl>
              {conclusion ? (
                <Note tone={conclusion.tone === 'success' ? 'success' : 'warning'} icon={conclusion.icon}>
                  {conclusion.sens}
                </Note>
              ) : (
                <Note tone="info" icon={AlertTriangle}>
                  Le dossier reste ouvert tant qu’aucune conclusion n’a été prononcée.
                </Note>
              )}
            </section>

            <section className="sn-card infraction-detail__artisan">
              <h2>
                <UserRound aria-hidden="true" /> Artisan mis en cause
              </h2>
              {artisan ? (
                <>
                  <p className="infraction-detail__artisan-name">{artisanFullName(artisan)}</p>
                  <dl>
                    <div>
                      <dt>Carte professionnelle</dt>
                      <dd>{artisan.numero_carte || 'Non attribuée'}</dd>
                    </div>
                    <div>
                      <dt>Localisation</dt>
                      <dd>{[artisan.commune, artisan.region].filter(Boolean).join(' · ') || 'Non renseignée'}</dd>
                    </div>
                  </dl>
                  <button type="button" className="sn-btn sn-btn--sm" onClick={() => navigate(retour)}>
                    Ouvrir le dossier complet
                  </button>
                </>
              ) : (
                <p className="infraction-detail__vide">Dossier artisan indisponible.</p>
              )}
            </section>

            <section className="sn-card infraction-detail__trace">
              <h2>
                <ScrollText aria-hidden="true" /> Traçabilité
              </h2>
              <dl>
                <div>
                  <dt>Enregistré le</dt>
                  <dd>{formatDate(infraction.created_at)}</dd>
                </div>
                <div>
                  <dt>Dernière modification</dt>
                  <dd>{formatDate(infraction.updated_at)}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}
