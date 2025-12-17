import { useEffect, useState } from 'react';
import { Plus, Building2, Edit, Trash2, Star, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Table } from '@/components/ui/Table';
import { userMiningAccessService, MiningCompanyAccess, AccessLevel } from '@/services/userMiningAccessService';
import { supabase } from '@/lib/supabase';

interface SiteAccessTabProps {
  userId: string;
}

interface MiningCompany {
  id: string;
  name: string;
  code: string;
  country: string;
}

const ACCESS_LEVEL_COLORS: Record<AccessLevel, string> = {
  read: 'bg-blue-100 text-blue-700',
  write: 'bg-emerald-100 text-emerald-700',
  admin: 'bg-amber-100 text-amber-700',
  full: 'bg-purple-100 text-purple-700'
};

const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  read: 'Lecture',
  write: 'Écriture',
  admin: 'Administrateur',
  full: 'Complet'
};

export default function SiteAccessTab({ userId }: SiteAccessTabProps) {
  const [accesses, setAccesses] = useState<MiningCompanyAccess[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAccess, setSelectedAccess] = useState<MiningCompanyAccess | null>(null);
  const [formData, setFormData] = useState({
    miningCompanyId: '',
    accessLevel: 'read' as AccessLevel,
    isPrimary: false,
    expiresAt: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [accessesData, companiesData] = await Promise.all([
        userMiningAccessService.getUserAccess(userId),
        fetchMiningCompanies()
      ]);
      setAccesses(accessesData);
      setMiningCompanies(companiesData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMiningCompanies = async () => {
    const { data, error } = await supabase
      .from('mining_companies')
      .select('id, name, code, country')
      .order('name');

    if (error) throw error;
    return data || [];
  };

  const handleOpenModal = (access?: MiningCompanyAccess) => {
    if (access) {
      setSelectedAccess(access);
      setFormData({
        miningCompanyId: access.mining_company_id,
        accessLevel: access.access_level,
        isPrimary: access.is_primary,
        expiresAt: access.expires_at || '',
        notes: access.notes || ''
      });
    } else {
      setSelectedAccess(null);
      setFormData({
        miningCompanyId: '',
        accessLevel: 'read',
        isPrimary: false,
        expiresAt: '',
        notes: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedAccess(null);
    setFormData({
      miningCompanyId: '',
      accessLevel: 'read',
      isPrimary: false,
      expiresAt: '',
      notes: ''
    });
  };

  const handleSubmit = async () => {
    try {
      if (selectedAccess) {
        await userMiningAccessService.updateAccess(selectedAccess.id, {
          accessLevel: formData.accessLevel,
          isPrimary: formData.isPrimary,
          expiresAt: formData.expiresAt || undefined,
          notes: formData.notes || undefined
        });
      } else {
        await userMiningAccessService.grantAccess({
          userId,
          miningCompanyId: formData.miningCompanyId,
          accessLevel: formData.accessLevel,
          isPrimary: formData.isPrimary,
          expiresAt: formData.expiresAt || undefined,
          notes: formData.notes || undefined
        });
      }
      await fetchData();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving access:', error);
      alert('Erreur lors de l\'enregistrement de l\'accès');
    }
  };

  const handleRevoke = async (accessId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir révoquer cet accès?')) return;

    try {
      await userMiningAccessService.revokeAccess(accessId);
      await fetchData();
    } catch (error) {
      console.error('Error revoking access:', error);
      alert('Erreur lors de la révocation de l\'accès');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Aucune';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const columns = [
    {
      key: 'mining_company',
      label: 'Site Minier',
      render: (access: MiningCompanyAccess) => (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-600" />
          <div>
            <div className="text-sm font-medium text-slate-900">
              {access.mining_company?.name}
            </div>
            <div className="text-xs text-slate-500">
              {access.mining_company?.code} • {access.mining_company?.country}
            </div>
          </div>
          {access.is_primary && (
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" title="Site principal" />
          )}
        </div>
      )
    },
    {
      key: 'access_level',
      label: 'Niveau d\'accès',
      render: (access: MiningCompanyAccess) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            ACCESS_LEVEL_COLORS[access.access_level]
          }`}
        >
          {ACCESS_LEVEL_LABELS[access.access_level]}
        </span>
      )
    },
    {
      key: 'granted_at',
      label: 'Accordé le',
      render: (access: MiningCompanyAccess) => (
        <div className="text-sm text-slate-900">{formatDate(access.granted_at)}</div>
      )
    },
    {
      key: 'expires_at',
      label: 'Expire le',
      render: (access: MiningCompanyAccess) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-900">{formatDate(access.expires_at)}</span>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Statut',
      render: (access: MiningCompanyAccess) => {
        const isExpired = access.expires_at && new Date(access.expires_at) < new Date();
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              !access.is_active || isExpired
                ? 'bg-red-100 text-red-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {!access.is_active ? 'Révoqué' : isExpired ? 'Expiré' : 'Actif'}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (access: MiningCompanyAccess) => (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenModal(access)}
            className="flex items-center gap-1"
          >
            <Edit className="w-3 h-3" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleRevoke(access.id)}
            className="flex items-center gap-1 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-64 bg-slate-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Accès aux Sites Miniers
          </h3>
          <p className="text-sm text-slate-600">
            {accesses.filter(a => a.is_active).length} accès actif{accesses.filter(a => a.is_active).length > 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Ajouter un Accès
        </Button>
      </div>

      {accesses.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Aucun accès configuré</p>
          <Button
            variant="primary"
            onClick={() => handleOpenModal()}
            className="mt-4"
          >
            Ajouter le Premier Accès
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table
            columns={columns}
            data={accesses}
            emptyMessage="Aucun accès trouvé"
          />
        </Card>
      )}

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={selectedAccess ? 'Modifier l\'Accès' : 'Ajouter un Accès'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Site Minier
            </label>
            <Select
              value={formData.miningCompanyId}
              onChange={(e) => setFormData(f => ({ ...f, miningCompanyId: e.target.value }))}
              disabled={!!selectedAccess}
              required
            >
              <option value="">Sélectionner un site</option>
              {miningCompanies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name} ({company.code})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Niveau d'Accès
            </label>
            <Select
              value={formData.accessLevel}
              onChange={(e) => setFormData(f => ({ ...f, accessLevel: e.target.value as AccessLevel }))}
              required
            >
              <option value="read">Lecture</option>
              <option value="write">Écriture</option>
              <option value="admin">Administrateur</option>
              <option value="full">Complet</option>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPrimary"
              checked={formData.isPrimary}
              onChange={(e) => setFormData(f => ({ ...f, isPrimary: e.target.checked }))}
              className="rounded border-slate-300"
            />
            <label htmlFor="isPrimary" className="text-sm text-slate-700">
              Définir comme site principal
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date d'Expiration (Optionnel)
            </label>
            <Input
              type="date"
              value={formData.expiresAt}
              onChange={(e) => setFormData(f => ({ ...f, expiresAt: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes (Optionnel)
            </label>
            <TextArea
              value={formData.notes}
              onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Notes ou justification..."
            />
          </div>

          <div className="flex items-center gap-2 pt-4">
            <Button variant="secondary" onClick={handleCloseModal} className="flex-1">
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              className="flex-1"
              disabled={!formData.miningCompanyId}
            >
              {selectedAccess ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
