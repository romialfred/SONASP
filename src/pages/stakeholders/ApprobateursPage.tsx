import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Lock,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  Badge,
  DataTable,
  EmptyState,
  Note,
  PageHeader,
  SearchInput,
  StatGrid,
  type Column,
} from '@/components/ui/sn';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { useAuth } from '@/contexts/AuthContext';
import { isManagement } from '@/lib/permissions';
import { roleLabel, roleTone } from '@/lib/roleLabels';
import { errorMessage } from '@/lib/errorMessage';
import { salesApproverService, type SalesApproverUser } from '@/services/salesApproverService';

/** Traduit la tonalité de rôle (roleLabels) vers la tonalité des badges sn. */
const badgeToneForRole = (role: SalesApproverUser['role']) => {
  const tone = roleTone(role);
  return tone === 'success' || tone === 'warning' || tone === 'danger' || tone === 'info' ? tone : 'neutral';
};

/** La direction (Propriétaire / Direction) approuve d'office : droit non modifiable ici. */
const estDirection = (u: SalesApproverUser) => u.is_active && (u.role === 'owner' || u.role === 'management');

export default function ApprobateursPage() {
  const { user } = useAuth();
  const canManage = isManagement(user) || user?.role === 'admin';

  const [users, setUsers] = useState<SalesApproverUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();

  const charger = async () => {
    setLoading(true);
    try {
      const data = await salesApproverService.list();
      setUsers(data);
    } catch (error) {
      showError(errorMessage(error, 'Impossible de charger les utilisateurs.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const basculer = async (cible: SalesApproverUser) => {
    const valeur = !cible.is_sales_approver;
    setSavingId(cible.id);
    try {
      await salesApproverService.setApprover(cible.id, valeur);
      setUsers((liste) => liste.map((u) => (u.id === cible.id ? { ...u, is_sales_approver: valeur } : u)));
      showSuccess(valeur ? 'Droit d’approbation accordé.' : 'Droit d’approbation retiré.');
    } catch (error) {
      showError(errorMessage(error, 'La mise à jour a échoué.'));
    } finally {
      setSavingId(null);
    }
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
        return (
          <button
            type="button"
            className={`sn-btn sn-btn--sm ${u.is_sales_approver ? 'sn-btn--danger' : 'sn-btn--primary'}`}
            disabled={!canManage || saving || !u.is_active}
            onClick={() => void basculer(u)}
            title={!u.is_active ? 'Compte inactif' : undefined}
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
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher un utilisateur…"
            ariaLabel="Rechercher un utilisateur"
          />
        }
      />

      <div style={{ marginTop: 16 }}>
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

      <div style={{ marginTop: 16 }}>
      </div>

      {!canManage && (
        <div style={{ marginTop: 16 }}>
          <Note tone="warning" icon={Lock}>
            Vous consultez la liste des approbateurs. Seule la direction peut accorder ou retirer ce droit.
          </Note>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
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
      </div>

      <CustomAlert
        isOpen={alertState.isOpen}
        message={alertState.message}
        type={alertState.type}
        onClose={closeAlert}
      />
    </NationalDashboardLayout>
  );
}
