import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  Save,
  X,
  Eye,
  Calendar,
  Briefcase
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { Tabs } from '@/components/ui/Tabs';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { artisanMinierService } from '@/services/artisanMinierService';
import { carteProfessionnelleGeneratorService } from '@/services/carteProfessionnelleGeneratorService';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import {
  SAHEL_COUNTRIES,
  getRegionsByCountry,
  getCitiesByRegion,
  getPhonePrefix,
  formatPhoneNumber
} from '@/data/burkinaFasoData';

interface ArtisanMinierFormWithTabsProps {
  artisan?: any;
  onCancel: () => void;
  onSuccess: () => void;
}

export function ArtisanMinierFormWithTabs({
  artisan,
  onCancel,
  onSuccess
}: ArtisanMinierFormWithTabsProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('informations');
  const [saving, setSaving] = useState(false);
  const [cartePreview, setCartePreview] = useState<string | null>(null);
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();

  const [selectedCountry, setSelectedCountry] = useState('Burkina Faso');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [availableRegions, setAvailableRegions] = useState<any[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    type_personne: 'physique',
    type_artisan: 'exploitant',
    nom: '',
    prenoms: '',
    raison_sociale: '',
    date_naissance: '',
    lieu_naissance: '',
    nationalite: 'Burkinabé',
    pays: 'Burkina Faso',
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
    observations: '',
    photo_url: ''
  });

  // Charger les régions quand le pays change
  useEffect(() => {
    const regions = getRegionsByCountry(selectedCountry);
    setAvailableRegions(regions);
    setSelectedRegion('');
    setAvailableCities([]);
  }, [selectedCountry]);

  // Charger les villes quand la région change
  useEffect(() => {
    if (selectedRegion) {
      const cities = getCitiesByRegion(selectedCountry, selectedRegion);
      setAvailableCities(cities);
    } else {
      setAvailableCities([]);
    }
  }, [selectedCountry, selectedRegion]);

  // Initialiser avec les données du Burkina Faso
  useEffect(() => {
    const regions = getRegionsByCountry('Burkina Faso');
    setAvailableRegions(regions);
  }, []);

  useEffect(() => {
    if (artisan) {
      const country = artisan.pays || 'Burkina Faso';
      setSelectedCountry(country);
      setSelectedRegion(artisan.region || '');

      setFormData({
        type_personne: artisan.type_personne || 'physique',
        type_artisan: artisan.type_artisan || 'exploitant',
        nom: artisan.nom || '',
        prenoms: artisan.prenoms || '',
        raison_sociale: artisan.raison_sociale || '',
        date_naissance: artisan.date_naissance || '',
        lieu_naissance: artisan.lieu_naissance || '',
        nationalite: artisan.nationalite || 'Burkinabé',
        pays: country,
        sexe: artisan.sexe || 'M',
        telephone: artisan.telephone || '',
        email: artisan.email || '',
        adresse: artisan.adresse || '',
        commune: artisan.commune || '',
        region: artisan.region || '',
        type_piece_identite: artisan.type_piece_identite || 'CNI',
        numero_piece_identite: artisan.numero_piece_identite || '',
        date_delivrance_piece: artisan.date_delivrance_piece || '',
        date_expiration_piece: artisan.date_expiration_piece || '',
        lieu_delivrance_piece: artisan.lieu_delivrance_piece || '',
        observations: artisan.observations || '',
        photo_url: artisan.photo_url || ''
      });
    }
  }, [artisan]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    setFormData(prev => ({ ...prev, pays: country, region: '', commune: '' }));
  };

  const handleRegionChange = (region: string) => {
    setSelectedRegion(region);
    setFormData(prev => ({ ...prev, region, commune: '' }));
  };

  const handlePhoneChange = (phone: string) => {
    setFormData(prev => ({ ...prev, telephone: phone }));
  };

  const handleGeneratePreview = async () => {
    try {
      if (!formData.nom || !formData.telephone) {
        showError('Veuillez remplir au minimum le nom et le téléphone');
        return;
      }

      const carteData = {
        numero_carte: artisan?.numero_carte || 'PREVIEW-001',
        nom: formData.nom,
        prenoms: formData.prenoms,
        type_artisan: formData.type_artisan,
        date_delivrance: new Date().toISOString().split('T')[0],
        date_expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        photo_url: formData.photo_url
      };

      const preview = await carteProfessionnelleGeneratorService.generateCartePreview(carteData);
      setCartePreview(preview);
      setActiveTab('carte');
    } catch (error: any) {
      console.error('Error generating preview:', error);
      showError('Erreur lors de la génération de l\'aperçu');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      if (artisan) {
        await artisanMinierService.update(artisan.id, formData);
        showSuccess('Artisan modifié avec succès!');
      } else {
        await artisanMinierService.create(formData);
        showSuccess('Artisan enregistré avec succès!');
      }

      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error: any) {
      console.error('Error saving artisan:', error);
      showError(error.message || 'Impossible de sauvegarder l\'artisan');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'informations', label: 'Informations', icon: User },
    { id: 'identite', label: 'Identité & Contacts', icon: Phone },
    { id: 'piece', label: 'Pièce d\'Identité', icon: CreditCard },
    { id: 'carte', label: 'Carte Professionnelle', icon: Eye }
  ];

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        {/* En-tête */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {artisan ? 'Modifier l\'Artisan Minier' : 'Nouvel Artisan Minier'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Enregistrer les informations complètes de l'artisan
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-1.5" />
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-gray-200 bg-gray-50 px-6">
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-all whitespace-nowrap
                    ${activeTab === tab.id
                      ? 'border-emerald-600 text-emerald-600 bg-white'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabs Content */}
        <div className="p-6">
          {/* Tab 1: Informations Générales */}
          {activeTab === 'informations' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              {formData.type_personne === 'physique' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <Select
                      value={formData.nationalite}
                      onChange={(e) => handleInputChange('nationalite', e.target.value)}
                    >
                      <option value="Burkinabé">Burkinabé</option>
                      <option value="Malienne">Malienne</option>
                      <option value="Nigérienne">Nigérienne</option>
                      <option value="Autre">Autre</option>
                    </Select>
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
          )}

          {/* Tab 2: Identité & Contacts */}
          {activeTab === 'identite' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">
                  Localisation
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pays *
                    </label>
                    <Select
                      value={selectedCountry}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      required
                    >
                      {SAHEL_COUNTRIES.sort((a, b) => a.priority - b.priority).map(country => (
                        <option key={country.code} value={country.name}>
                          {country.flag} {country.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Région *
                    </label>
                    <Select
                      value={selectedRegion}
                      onChange={(e) => handleRegionChange(e.target.value)}
                      required
                    >
                      <option value="">Sélectionner une région</option>
                      {availableRegions.map(region => (
                        <option key={region.name} value={region.name}>
                          {region.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ville/Commune *
                    </label>
                    <Select
                      value={formData.commune}
                      onChange={(e) => handleInputChange('commune', e.target.value)}
                      required
                      disabled={!selectedRegion}
                    >
                      <option value="">Sélectionner une ville</option>
                      {availableCities.map(city => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Téléphone *
                  </label>
                  <PhoneInput
                    value={formData.telephone}
                    onChange={handlePhoneChange}
                    defaultCountry={selectedCountry}
                    required
                    placeholder="XX XX XX XX"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Sélectionnez l'indicatif pays et entrez le numéro
                  </p>
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
                    icon={Mail}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adresse complète
                  </label>
                  <Input
                    value={formData.adresse}
                    onChange={(e) => handleInputChange('adresse', e.target.value)}
                    placeholder="Quartier, rue, numéro..."
                    icon={MapPin}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observations
                </label>
                <TextArea
                  value={formData.observations}
                  onChange={(e) => handleInputChange('observations', e.target.value)}
                  rows={4}
                  placeholder="Notes additionnelles..."
                />
              </div>
            </div>
          )}

          {/* Tab 3: Pièce d'Identité */}
          {activeTab === 'piece' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <div className="md:col-span-2">
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
          )}

          {/* Tab 4: Carte Professionnelle */}
          {activeTab === 'carte' && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 bg-emerald-100 rounded-lg">
                    <Eye className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Aperçu de la Carte Professionnelle
                    </h3>
                    <p className="text-sm text-gray-600">
                      Visualisez l'aperçu de la carte professionnelle qui sera générée pour cet artisan.
                    </p>
                  </div>
                </div>

                <div className="flex justify-center mb-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGeneratePreview}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Générer l'aperçu
                  </Button>
                </div>

                {cartePreview && (
                  <div className="border border-gray-300 rounded-lg p-4 bg-white">
                    <img
                      src={cartePreview}
                      alt="Aperçu de la carte"
                      className="w-full h-auto rounded-lg shadow-lg"
                    />
                  </div>
                )}

                {!cartePreview && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <CreditCard className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">
                      Cliquez sur "Générer l'aperçu" pour visualiser la carte professionnelle
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Custom Alert */}
      <CustomAlert
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />
    </Card>
  );
}
