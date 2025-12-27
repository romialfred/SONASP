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
  Briefcase,
  Upload,
  Check,
  AlertCircle
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
    photo_url: '',
    piece_identite_url: ''
  });

  const [pieceIdentiteFile, setPieceIdentiteFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPiece, setUploadingPiece] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [ageError, setAgeError] = useState<string>('');

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
        photo_url: artisan.photo_url || '',
        piece_identite_url: artisan.piece_identite_url || ''
      });
    }
  }, [artisan]);

  const handleInputChange = (field: string, value: any) => {
    if (field === 'date_naissance' && value) {
      const age = calculateAge(value);
      if (age < 18) {
        setAgeError('L\'artisan minier doit avoir au moins 18 ans');
      } else {
        setAgeError('');
      }
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateAge = (dateNaissance: string): number => {
    const today = new Date();
    const birthDate = new Date(dateNaissance);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  const handlePieceIdentiteUpload = async (file: File) => {
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      showError('Format de fichier non supporté. Utilisez JPG, PNG ou PDF');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('Le fichier ne doit pas dépasser 5 Mo');
      return;
    }

    setPieceIdentiteFile(file);
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      showError('Format de fichier non supporté. Utilisez JPG ou PNG');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showError('La photo doit faire moins de 2 Mo');
      return;
    }

    setPhotoFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const photoUrl = e.target?.result as string;
      setFormData(prev => ({ ...prev, photo_url: photoUrl }));
    };
    reader.readAsDataURL(file);
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

      const artisanData = {
        type_personne: formData.type_personne,
        type_artisan: formData.type_artisan,
        nom: formData.nom,
        prenoms: formData.prenoms,
        raison_sociale: formData.raison_sociale,
        telephone: formData.telephone,
        region: formData.region,
        site_exploitation: formData.commune,
        photo_url: formData.photo_url,
        adresse_complete: formData.adresse
      };

      const carteData = {
        numero_carte: artisan?.numero_carte || 'SONASP/AM/2025/PREVIEW',
        date_delivrance: new Date().toISOString().split('T')[0],
        date_expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        statut: 'en_cours',
        numero_securite: '0000000000',
        qr_code_data: JSON.stringify({ numero_carte: artisan?.numero_carte || 'PREVIEW' })
      };

      const preview = await carteProfessionnelleGeneratorService.generatePreviewDataUrl(artisanData, carteData);
      setCartePreview(preview);
      setActiveTab('carte');
    } catch (error: any) {
      console.error('Error generating preview:', error);
      showError('Erreur lors de la génération de l\'aperçu');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (ageError) {
      showError(ageError);
      return;
    }

    if (formData.type_personne === 'physique' && formData.date_naissance) {
      const age = calculateAge(formData.date_naissance);
      if (age < 18) {
        showError('L\'artisan minier doit avoir au moins 18 ans');
        return;
      }
    }

    try {
      setSaving(true);

      let savedArtisan;

      if (artisan) {
        savedArtisan = await artisanMinierService.update(artisan.id, formData);
      } else {
        savedArtisan = await artisanMinierService.create(formData);
      }

      if (photoFile && savedArtisan?.id) {
        setUploadingPhoto(true);
        try {
          const photoUrl = await artisanMinierService.uploadDocument(
            savedArtisan.id,
            photoFile,
            'photo'
          );

          await artisanMinierService.update(savedArtisan.id, {
            photo_url: photoUrl
          });
        } catch (uploadError) {
          console.error('Error uploading photo:', uploadError);
        } finally {
          setUploadingPhoto(false);
        }
      }

      if (pieceIdentiteFile && savedArtisan?.id) {
        setUploadingPiece(true);
        try {
          const pieceUrl = await artisanMinierService.uploadDocument(
            savedArtisan.id,
            pieceIdentiteFile,
            'piece_identite'
          );

          await artisanMinierService.update(savedArtisan.id, {
            piece_identite_url: pieceUrl
          });
        } catch (uploadError) {
          console.error('Error uploading piece:', uploadError);
          showError('Document uploadé mais erreur lors de la mise à jour');
        } finally {
          setUploadingPiece(false);
        }
      }

      showSuccess(artisan ? 'Artisan modifié avec succès!' : 'Artisan enregistré avec succès!');

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
                      Date de naissance *
                    </label>
                    <Input
                      type="date"
                      value={formData.date_naissance}
                      onChange={(e) => handleInputChange('date_naissance', e.target.value)}
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                      required
                    />
                    {ageError && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        <span>{ageError}</span>
                      </div>
                    )}
                    {formData.date_naissance && !ageError && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                        <Check className="h-4 w-4" />
                        <span>Âge: {calculateAge(formData.date_naissance)} ans</span>
                      </div>
                    )}
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

              <div className="border-t border-gray-200 pt-6">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 mb-6">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <User className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-900 mb-1">
                        Photo d'Identité
                      </h4>
                      <p className="text-sm text-emerald-700">
                        Photo d'identité format passeport qui sera utilisée sur la carte professionnelle (JPG ou PNG - Max 2 Mo)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <input
                        type="file"
                        id="photo-upload"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(file);
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor="photo-upload"
                        className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all"
                      >
                        <User className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Cliquez pour sélectionner une photo
                        </p>
                        <p className="text-xs text-gray-500">
                          JPG ou PNG (max. 2 Mo)
                        </p>
                      </label>
                    </div>

                    {photoFile && formData.photo_url && (
                      <div className="bg-white border border-emerald-200 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-emerald-200">
                            <img
                              src={formData.photo_url}
                              alt="Photo d'identité"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {photoFile.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(photoFile.size / 1024).toFixed(2)} Ko
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoFile(null);
                              setFormData(prev => ({ ...prev, photo_url: '' }));
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <X className="h-4 w-4 text-gray-500" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Upload className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-blue-900 mb-1">
                        Document de Pièce d'Identité
                      </h4>
                      <p className="text-sm text-blue-700">
                        Joignez une copie scannée de la pièce d'identité ou du passeport (JPG, PNG ou PDF - Max 5 Mo)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <input
                        type="file"
                        id="piece-identite-upload"
                        accept="image/jpeg,image/jpg,image/png,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePieceIdentiteUpload(file);
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor="piece-identite-upload"
                        className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                      >
                        <Upload className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Cliquez pour sélectionner un fichier
                        </p>
                        <p className="text-xs text-gray-500">
                          JPG, PNG ou PDF (max. 5 Mo)
                        </p>
                      </label>
                    </div>

                    {pieceIdentiteFile && (
                      <div className="bg-white border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <FileText className="h-5 w-5 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {pieceIdentiteFile.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(pieceIdentiteFile.size / 1024).toFixed(2)} Ko
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPieceIdentiteFile(null)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <X className="h-4 w-4 text-gray-500" />
                          </button>
                        </div>
                      </div>
                    )}

                    {formData.piece_identite_url && !pieceIdentiteFile && (
                      <div className="bg-white border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Check className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              Document déjà enregistré
                            </p>
                            <a
                              href={formData.piece_identite_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Voir le document
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
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
