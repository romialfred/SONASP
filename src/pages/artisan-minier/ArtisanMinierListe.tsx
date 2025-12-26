import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  UserPlus,
  Search,
  Filter,
  X,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Calendar,
  FileText,
  Camera,
  Save,
  ChevronRight
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { Loading } from '@/components/ui/Loading';
import { artisanMinierService } from '@/services/artisanMinierService';

export default function ArtisanMinierListe() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [artisans, setArtisans] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    type_personne: 'physique',
    type_artisan: 'exploitant',
    nom: '',
    prenoms: '',
    raison_sociale: '',
    date_naissance: '',
    lieu_naissance: '',
    nationalite: 'Malienne',
    sexe: 'M',
    telephone: '',
    email: '',
    adresse: '',
    commune: '',
    region: '',
    type_piece_identite: 'CNI',
    numero_piece_identite: '',
    date_delivrance_piece: '',
    date_expiration_piece: '',
    lieu_delivrance_piece: '',
    collecteur_id: null,
    observations: ''
  });

  useEffect(() => {
    loadArtisans();
  }, []);

  const loadArtisans = async () => {
    try {
      setLoading(true);
      const data = await artisanMinierService.getAll();
      setArtisans(data || []);
    } catch (error) {
      console.error('Error loading artisans:', error);
      setArtisans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      await artisanMinierService.create(formData);

      // Recharger la liste
      await loadArtisans();

      // Fermer le panneau et réinitialiser le formulaire
      setShowSidePanel(false);
      setFormData({
        type_personne: 'physique',
        type_artisan: 'exploitant',
        nom: '',
        prenoms: '',
        raison_sociale: '',
        date_naissance: '',
        lieu_naissance: '',
        nationalite: 'Malienne',
        sexe: 'M',
        telephone: '',
        email: '',
        adresse: '',
        commune: '',
        region: '',
        type_piece_identite: 'CNI',
        numero_piece_identite: '',
        date_delivrance_piece: '',
        date_expiration_piece: '',
        lieu_delivrance_piece: '',
        collecteur_id: null,
        observations: ''
      });

      alert('Artisan enregistré avec succès !');
    } catch (error: any) {
      console.error('Error creating artisan:', error);
      alert('Erreur: ' + (error.message || 'Impossible de créer l\'artisan'));
    } finally {
      setSaving(false);
    }
  };

  const filteredArtisans = artisans.filter(artisan => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      artisan.nom?.toLowerCase().includes(query) ||
      artisan.prenoms?.toLowerCase().includes(query) ||
      artisan.raison_sociale?.toLowerCase().includes(query) ||
      artisan.numero_carte?.toLowerCase().includes(query) ||
      artisan.telephone?.toLowerCase().includes(query)
    );
  });

  if (loading && artisans.length === 0) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Liste des Artisans Miniers
          </h1>
          <p className="text-gray-600 mt-1">
            {filteredArtisans.length} artisan(s) enregistré(s)
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setShowSidePanel(true)}
          className="flex items-center gap-2"
        >
          <UserPlus className="h-5 w-5" />
          Nouvel Artisan
        </Button>
      </div>

      {/* Barre de recherche */}
      <Card>
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Rechercher un artisan (nom, prénom, n° carte, téléphone...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtrer
          </Button>
        </div>
      </Card>

      {/* Liste des artisans */}
      <div className="grid grid-cols-1 gap-4">
        {filteredArtisans.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchQuery ? 'Aucun artisan trouvé' : 'Aucun artisan enregistré'}
              </p>
              <Button
                variant="primary"
                onClick={() => setShowSidePanel(true)}
                className="mt-4"
              >
                Enregistrer le premier artisan
              </Button>
            </div>
          </Card>
        ) : (
          filteredArtisans.map((artisan) => (
            <Card key={artisan.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 rounded-xl">
                    {artisan.type_personne === 'physique' ? (
                      <User className="h-6 w-6 text-emerald-600" />
                    ) : (
                      <Building2 className="h-6 w-6 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {artisan.type_personne === 'physique'
                        ? `${artisan.nom} ${artisan.prenoms || ''}`
                        : artisan.raison_sociale
                      }
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-4 w-4" />
                        {artisan.numero_carte || 'En attente'}
                      </span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
                        {artisan.type_artisan}
                      </span>
                      {artisan.telephone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {artisan.telephone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Panneau latéral pour nouvel artisan */}
      {showSidePanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
          <div className="w-full max-w-3xl bg-white h-full overflow-y-auto shadow-2xl">
            <form onSubmit={handleSubmit}>
              {/* En-tête du panneau */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Nouvel Artisan Minier
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Enregistrer un nouvel artisan dans le système
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSidePanel(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6 text-gray-600" />
                </button>
              </div>

              {/* Contenu du formulaire */}
              <div className="p-6 space-y-6">
                {/* Type de personne et Type d'artisan */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-600" />
                    Informations générales
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Type de personne *
                      </label>
                      <Select
                        value={formData.type_personne}
                        onChange={(e) => handleInputChange('type_personne', e.target.value)}
                        required
                      >
                        <option value="physique">Personne physique</option>
                        <option value="morale">Personne morale</option>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Type d'artisan *
                      </label>
                      <Select
                        value={formData.type_artisan}
                        onChange={(e) => handleInputChange('type_artisan', e.target.value)}
                        required
                      >
                        <option value="exploitant">Exploitant</option>
                        <option value="collecteur">Collecteur</option>
                        <option value="intermediaire">Intermédiaire</option>
                        <option value="fournisseur">Fournisseur</option>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Identité */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Identité
                  </h3>

                  {formData.type_personne === 'physique' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nom *
                        </label>
                        <Input
                          value={formData.nom}
                          onChange={(e) => handleInputChange('nom', e.target.value)}
                          required
                          placeholder="Nom de famille"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Prénom(s)
                        </label>
                        <Input
                          value={formData.prenoms}
                          onChange={(e) => handleInputChange('prenoms', e.target.value)}
                          placeholder="Prénom(s)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date de naissance
                        </label>
                        <Input
                          type="date"
                          value={formData.date_naissance}
                          onChange={(e) => handleInputChange('date_naissance', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Lieu de naissance
                        </label>
                        <Input
                          value={formData.lieu_naissance}
                          onChange={(e) => handleInputChange('lieu_naissance', e.target.value)}
                          placeholder="Ville, Pays"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Sexe
                        </label>
                        <Select
                          value={formData.sexe}
                          onChange={(e) => handleInputChange('sexe', e.target.value)}
                        >
                          <option value="M">Masculin</option>
                          <option value="F">Féminin</option>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nationalité
                        </label>
                        <Input
                          value={formData.nationalite}
                          onChange={(e) => handleInputChange('nationalite', e.target.value)}
                          placeholder="Malienne"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Raison sociale *
                      </label>
                      <Input
                        value={formData.raison_sociale}
                        onChange={(e) => handleInputChange('raison_sociale', e.target.value)}
                        required
                        placeholder="Nom de l'entreprise"
                      />
                    </div>
                  )}
                </div>

                {/* Contact */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Phone className="h-5 w-5 text-purple-600" />
                    Coordonnées
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Téléphone *
                      </label>
                      <Input
                        type="tel"
                        value={formData.telephone}
                        onChange={(e) => handleInputChange('telephone', e.target.value)}
                        required
                        placeholder="+223 XX XX XX XX"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="email@exemple.com"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Adresse
                      </label>
                      <Input
                        value={formData.adresse}
                        onChange={(e) => handleInputChange('adresse', e.target.value)}
                        placeholder="Adresse complète"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Commune
                      </label>
                      <Input
                        value={formData.commune}
                        onChange={(e) => handleInputChange('commune', e.target.value)}
                        placeholder="Commune"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Région
                      </label>
                      <Input
                        value={formData.region}
                        onChange={(e) => handleInputChange('region', e.target.value)}
                        placeholder="Région"
                      />
                    </div>
                  </div>
                </div>

                {/* Pièce d'identité */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-orange-600" />
                    Pièce d'identité
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Type de pièce *
                      </label>
                      <Select
                        value={formData.type_piece_identite}
                        onChange={(e) => handleInputChange('type_piece_identite', e.target.value)}
                        required
                      >
                        <option value="CNI">Carte Nationale d'Identité (CNI)</option>
                        <option value="Passeport">Passeport</option>
                        <option value="Permis">Permis de conduire</option>
                        <option value="Autre">Autre</option>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Numéro de pièce *
                      </label>
                      <Input
                        value={formData.numero_piece_identite}
                        onChange={(e) => handleInputChange('numero_piece_identite', e.target.value)}
                        required
                        placeholder="N° de la pièce"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date de délivrance
                      </label>
                      <Input
                        type="date"
                        value={formData.date_delivrance_piece}
                        onChange={(e) => handleInputChange('date_delivrance_piece', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date d'expiration
                      </label>
                      <Input
                        type="date"
                        value={formData.date_expiration_piece}
                        onChange={(e) => handleInputChange('date_expiration_piece', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lieu de délivrance
                      </label>
                      <Input
                        value={formData.lieu_delivrance_piece}
                        onChange={(e) => handleInputChange('lieu_delivrance_piece', e.target.value)}
                        placeholder="Ville de délivrance"
                      />
                    </div>
                  </div>
                </div>

                {/* Observations */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observations
                  </label>
                  <TextArea
                    value={formData.observations}
                    onChange={(e) => handleInputChange('observations', e.target.value)}
                    rows={3}
                    placeholder="Notes additionnelles..."
                  />
                </div>
              </div>

              {/* Pied de page avec boutons */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSidePanel(false)}
                  disabled={saving}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving}
                  className="flex items-center gap-2"
                >
                  <Save className="h-5 w-5" />
                  {saving ? 'Enregistrement...' : 'Enregistrer l\'artisan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
