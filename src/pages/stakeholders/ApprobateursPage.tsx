import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Lock,
  Plus,
  Save,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  Badge,
  DataTable,
  EmptyState,
  Note,
  PageHeader,
  SearchInput,
  Section,
  StatGrid,
  type Column,
} from '@/components/ui/sn';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { useAuth } from '@/contexts/AuthContext';
import { canManageAccount } from '@/lib/roleHierarchy';
import { CAPABILITIES, hasSensitiveCapability } from '@/lib/capabilities';
import { roleLabel, roleTone } from '@/lib/roleLabels';
import { messageErreurUtilisateur } from '@/lib/presentError';
import { salesApproverService, type SalesApproverUser } from '@/services/salesApproverService';
import './approbateurs.css';

/** Traduit la tonalité de rôle (roleLabels) vers la tonalité des badges sn. */
const badgeToneForRole = (role: SalesApproverUser['role']) => {
  const tone = roleTone(role);
  return tone === 'success' || tone === 'warning' || tone === 'danger' || tone === 'info' ? tone : 'neutral';
};

/** La direction (Propriétaire / Direction) approuve d'office : droit non modifiable ici. */
const estDirection = (u: SalesApproverUser) => u.is_active && (u.role === 'owner' || u.role === 'management');

export default function ApprobateursPage() {
  const { user } = useAuth();
  // Aligné sur la capacité autoritative (et sur la RPC snp_definir_approbateur_ventes) :
  // l'ancien test `isManagement || admin` verrouillait l'owner, pourtant seul acteur
  // routé le plus habilité, et ouvrait à `management` que la route n'autorise pas.
  const canManage = hasSensitiveCapability(user, CAPABILITIES.ACCOUNTS_MANAGE);

  const [users, setUsers] = useState<SalesApproverUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();

  const charger = async () => {
    setLoading(true);
    try {
      const data = await salesApproverService.list();
      setUsers(data);
    } catch (error) {
      showError(messageErreurUtilisateur(error, 'Impossible de charger les utilisateurs.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void charger();
  }, []);

  const basculer = async (cible: SalesApproverUser) => {
    const valeur = !cible.is_sales_approver;
    setSavingId(cible.id);
    try {
      await salesApproverService.setApprover(cible.id, valeur);
      setUsers((liste) => liste.map((u) => (u.id === cible.id ? { ...u, is_sales_approver: valeur } : u)));
      showSuccess(valeur ? 'Droit d’approbation accordé.' : 'Droit d’approbation retiré.');
      return true;
    } catch (error) {
      showError(messageErreurUtilisateur(error, 'La mise à jour a échoué.'));
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const candidats = useMemo(
    () => users.filter((cible) =>
      cible.is_active
      && !cible.is_sales_approver
      && !estDirection(cible)
      && canManageAccount(user?.role, cible.role, user?.id, cible.id)
    ),
    [users, user?.id, user?.role],
  );

  const designer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cible = users.find((candidate) => candidate.id === selectedUserId);
    if (!cible) {
      showError('Sélectionnez un utilisateur actif.');
      return;
    }
    const success = await basculer(cible);
    if (!success) return;
    setSelectedUserId('');
    setFormOpen(false);
  };

  const filtres = useMemo(() => {
    const terme = search.trim().toLowerCase();
    if (!terme) return users;
    return users.filter(
      (u) =>
        (u.full_name ?? '').toLowerCase().includes(terme) ||
        u.email.toLowerCase().includes(terme) ||
        roleLabel(u.role).toLowerCase().includes(terme),
    );
  }, [users, search]);

  const stats = useMemo(() => {
    const office = users.filter(estDirection).length;
    const explicites = users.filter((u) => u.is_sales_approver && !estDirection(u)).length;
    return { total: users.length, office, explicites, habilites: office + explicites };
  }, [users]);

  const columns: Column<SalesApproverUser>[] = [
    {
      key: 'full_name',
      header: 'Utilisateur',
      render: (u) => (
        <div>
          <strong>{u.full_name || '—'}</strong>
          <div style={{ fontSize: 11.5, color: 'var(--sn-text-muted, #64748b)' }}>{u.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rôle',
      render: (u) => <Badge tone={badgeToneForRole(u.role)}>{roleLabel(u.role)}</Badge>,
    },
    {
      key: 'is_active',
      header: 'Compte',
      render: (u) =>
        u.is_active ? <Badge tone="success">Actif</Badge> : <Badge tone="neutral">Inactif</Badge>,
    },
    {
      key: 'approbation',
      header: 'Approbation des ventes',
      render: (u) => {
        if (estDirection(u)) {
          return (
            <Badge tone="info" icon={ShieldCheck}>
              D’office
            </Badge>
          );
        }
        return u.is_sales_approver ? (
          <Badge tone="success" icon={CheckCircle2}>
            Approbateur
          </Badge>
        ) : (
          <Badge tone="neutral">Non habilité</Badge>
        );
      },
    },
    {
      key: 'action',
      header: 'Action',
      render: (u) => {
        if (estDirection(u)) {
          return (
            <span className="sn-btn sn-btn--sm" aria-disabled="true" style={{ opacity: 0.5, pointerEvents: 'none' }}>
              <Lock aria-hidden="true" /> Verrouillé
            </span>
          );
        }
        const saving = savingId === u.id;
        const peutModifier = canManageAccount(user?.role, u.role, user?.id, u.id);
        return (
          <button
            type="button"
            className={`sn-btn sn-btn--sm ${u.is_sales_approver ? 'sn-btn--danger' : 'sn-btn--primary'}`}
            disabled={!canManage || !peutModifier || saving || !u.is_active}
            onClick={() => void basculer(u)}
            title={
              !u.is_active
                ? 'Compte inactif'
                : !peutModifier
                  ? 'Vous ne pouvez pas modifier votre propre habilitation ni celle d’un niveau supérieur.'
                  : undefined
            }
          >
            {saving ? <Loader2 className="sn-spin" aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
            {u.is_sales_approver ? 'Retirer' : 'Accorder'}
          </button>
        );
      },
    },
  ];

  return (
    <NationalDashboardLayout>
      <main className="sn-page approvers-page">
        <PageHeader
        title="Approbateurs"
        subtitle="Habilités à approuver les ventes d’or avant facturation et paiement."
        info={{
          titre: 'Rôle de l’approbateur',
          contenu:
            'La facture n’est générée et le paiement émis qu’après son approbation. La direction dispose du droit d’office, non retirable ici.',
        }}
        icon={BadgeCheck}
        breadcrumb={[
          { label: 'Parties prenantes' },
          { label: 'Approbateurs' },
        ]}
          actions={
            <div className="approvers__actions">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Rechercher un utilisateur…"
                ariaLabel="Rechercher un utilisateur"
              />
              {canManage && (
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  onClick={() => setFormOpen((open) => !open)}
                  aria-expanded={formOpen}
                  aria-controls="designation-approbateur"
                >
                  {formOpen ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
                  {formOpen ? 'Fermer' : 'Désigner'}
                </button>
              )}
            </div>
          }
        />

      <div className="approvers__stats">
        <StatGrid
          ariaLabel="Synthèse des approbateurs"
          sober
          items={[
            { label: 'Utilisateurs', value: stats.total, icon: Users, tone: 'neutral' },
            { label: 'Habilités', value: stats.habilites, hint: 'D’office et explicites', icon: BadgeCheck, tone: 'green' },
            { label: 'Approbateurs désignés', value: stats.explicites, icon: UserCheck, tone: 'gold' },
            { label: 'Direction (d’office)', value: stats.office, icon: ShieldCheck, tone: 'blue' },
          ]}
        />
      </div>

      {formOpen && canManage && (
        <Section
          id="designation-approbateur"
          icon={UserPlus}
          tone="emerald"
          title="Désigner un approbateur"
          description="Attribuez cette responsabilité à un compte actif de niveau autorisé."
        >
          <form className="approvers__form" onSubmit={(event) => void designer(event)}>
            <label className="sn-field" htmlFor="approbateur-user">
              <span className="sn-field__label">Utilisateur</span>
              <select
                id="approbateur-user"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                required
              >
                <option value="">Sélectionner un compte actif</option>
                {candidats.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.full_name || candidate.email} — {roleLabel(candidate.role)}
                  </option>
                ))}
              </select>
            </label>
            <Note tone="info" icon={ShieldCheck}>
              L’approbateur pourra valider les ventes avant facturation et paiement. Cette action est
              journalisée et ne modifie pas son rôle principal.
            </Note>
            <div className="approvers__form-actions">
              <button type="button" className="sn-btn" onClick={() => setFormOpen(false)}>
                <X aria-hidden="true" /> Annuler
              </button>
              <button
                type="submit"
                className="sn-btn sn-btn--primary"
                disabled={!selectedUserId || Boolean(savingId)}
              >
                {savingId ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                Confirmer la désignation
              </button>
            </div>
          </form>
          {candidats.length === 0 && (
            <p className="approvers__no-candidate">
              Aucun compte actif et autorisé ne reste à désigner.
            </p>
          )}
        </Section>
      )}

      {!canManage && (
        <div className="approvers__notice">
          <Note tone="warning" icon={Lock}>
            Vous consultez la liste des approbateurs. Seule la direction peut accorder ou retirer ce droit.
          </Note>
        </div>
      )}

      <section className="approvers__registry" aria-label="Registre des approbateurs">
        {!loading && users.length === 0 ? (
          <EmptyState
            title="Aucun utilisateur"
            description="Aucun compte n’est enregistré sur la plateforme."
          />
        ) : (
          <DataTable
            columns={columns}
            rows={filtres}
            loading={loading}
            empty="Aucun utilisateur ne correspond à la recherche."
            caption="Liste des utilisateurs et de leur habilitation d’approbation"
          />
        )}
      </section>

      <CustomAlert
        isOpen={alertState.isOpen}
        message={alertState.message}
        type={alertState.type}
        onClose={closeAlert}
      />
      </main>
    </NationalDashboardLayout>
  );
}
