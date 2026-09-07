import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Loader2, type LucideIcon } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from '@/lib/recharts';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { EmptyState, Note, PageHeader, Section, StatGrid, type StatTone } from '@/components/ui/sn';
import { EMPTY_ROLE_DASHBOARD, nombre, type RoleDashboardData } from './roleDashboardData';
import './role-dashboard.css';

const TONS: StatTone[] = ['green', 'gold', 'blue', 'violet'];

export interface RoleDashboardShellProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  /** Chargeur de données du rôle ; une seule source est interrogée par écran. */
  load: () => Promise<RoleDashboardData>;
  serieTitle: string;
  serieDescription: string;
  serieUnite: string;
  tableTitle: string;
  tableDescription: string;
  tableIcon: LucideIcon;
  colonnes: { reference: string; libelle: string; valeur: string };
  /** Destination du bouton d'accès au module ; la route doit exister. */
  action: { label: string; to: string };
  emptyLabel: string;
}

export function RoleDashboardShell({
  title,
  subtitle,
  icon,
  load,
  serieTitle,
  serieDescription,
  serieUnite,
  tableTitle,
  tableDescription,
  tableIcon,
  colonnes,
  action,
  emptyLabel,
}: RoleDashboardShellProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<RoleDashboardData>(EMPTY_ROLE_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setData(await load());
    } catch (error) {
      console.error('Role dashboard loading failed:', error);
      setData(EMPTY_ROLE_DASHBOARD);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <NationalDashboardLayout>
      <div className="sn-page role-dashboard">
        <PageHeader
          icon={icon}
          title={title}
          subtitle={subtitle}
          breadcrumb={[{ label: 'Tableaux de bord', to: '/dashboard' }, { label: title }]}
          actions={
            <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate(action.to)}>
              {action.label} <ArrowRight aria-hidden="true" />
            </button>
          }
        />

        {data.unavailable.length > 0 && (
          <Note tone="warning" icon={AlertTriangle}>
            Données partielles : {data.unavailable.join(', ')} n’ont pas pu être chargées.
          </Note>
        )}

        {loadError && (
          <div>
            <Note tone="danger" icon={AlertTriangle}>
              Les indicateurs sont temporairement indisponibles.
              <button type="button" className="sn-btn sn-btn--secondary" onClick={() => void charger()}>
                Réessayer
              </button>
            </Note>
          </div>
        )}

        {loading ? (
          <div className="role-dashboard__loading">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement des indicateurs…
          </div>
        ) : (
          <>
            <StatGrid
              ariaLabel="Indicateurs du poste"
              items={data.indicators.map((indicator, index) => ({
                label: indicator.label,
                value: indicator.value,
                hint: indicator.hint,
                icon,
                tone: TONS[index % TONS.length],
              }))}
            />

            <Section id="evolution" icon={icon} tone="emerald" title={serieTitle} description={serieDescription}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data.serie} margin={{ top: 8, right: 12, left: 8, bottom: 42 }}>
                  <defs>
                    <linearGradient id="roleSerieFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--portal-primary, #0f7a56)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--portal-primary, #0f7a56)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e7edf2" strokeDasharray="2 3" />
                  <XAxis dataKey="periode" angle={-35} textAnchor="end" height={64} tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={44} />
                  <Tooltip formatter={(value) => `${nombre(Number(value))} ${serieUnite}`} />
                  <Area
                    type="monotone"
                    dataKey="valeur"
                    stroke="var(--portal-primary, #0f7a56)"
                    strokeWidth={2}
                    fill="url(#roleSerieFill)"
                    name={serieUnite}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Section>

            <Section id="dossiers" icon={tableIcon} tone="blue" title={tableTitle} description={tableDescription}>
              {data.rows.length === 0 ? (
                <EmptyState
                  title={emptyLabel}
                  description="Aucun enregistrement sur la période observée."
                  action={
                    <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate(action.to)}>
                      {action.label}
                    </button>
                  }
                />
              ) : (
                <div className="role-dashboard__table-wrap">
                  <table className="role-dashboard__table">
                    <caption className="sr-only">{tableTitle}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{colonnes.reference}</th>
                        <th scope="col">{colonnes.libelle}</th>
                        <th scope="col" className="is-num">
                          {colonnes.valeur}
                        </th>
                        <th scope="col">Statut</th>
                        <th scope="col">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.reference}</strong>
                          </td>
                          <td>{row.libelle}</td>
                          <td className="is-num">{row.valeur}</td>
                          <td>
                            <span className="role-dashboard__statut">{row.statut}</span>
                          </td>
                          <td>{row.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </NationalDashboardLayout>
  );
}
